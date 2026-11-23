-- Batch stok, langkah 2 dari 3: tabel batch, saldo awal, penjaga sinkron, RLS.
-- Setiap stok masuk = satu batch dengan tanggal kedaluwarsa sendiri. Stok keluar mengikuti
-- urutan FIFO (batch yang masuk paling dulu keluar dulu). Jumlah sisa semua batch sebuah
-- produk selalu sama dengan stock_levels.on_hand (dijaga trigger di akhir transaksi).
-- Tanggal kedaluwarsa HANYA untuk pemilik: semua tabel batch dibatasi is_owner() + RLS.
-- Zona waktu "hari ini" = Asia/Jakarta. Aman dijalankan ulang.

-- ---------------------------------------------------------------------------
-- 1) Pembantu
-- ---------------------------------------------------------------------------
create or replace function public._today_jakarta()
returns date language sql stable set search_path = public as $$
  select (now() at time zone 'Asia/Jakarta')::date
$$;
revoke all on function public._today_jakarta() from public, anon, authenticated;

create sequence if not exists public.stock_batch_seq;

-- ---------------------------------------------------------------------------
-- 2) Tabel
-- ---------------------------------------------------------------------------
create table if not exists public.stock_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  batch_code text not null check (char_length(btrim(batch_code)) between 1 and 60),
  source text not null check (source in ('opening', 'purchase', 'adjustment')),
  received_at timestamptz not null default clock_timestamp(),
  expiry_date date,
  qty_initial integer not null check (qty_initial > 0),
  qty_remaining integer not null check (qty_remaining >= 0),
  unit_cost bigint not null default 0 check (unit_cost >= 0),
  purchase_item_id uuid references public.purchase_items(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default now(),
  constraint stock_batches_remaining_le_initial check (qty_remaining <= qty_initial),
  -- Hanya saldo awal (stok lama) yang boleh belum punya tanggal; pemilik diminta mengisinya.
  constraint stock_batches_expiry_required check (source = 'opening' or expiry_date is not null),
  constraint stock_batches_product_code_key unique (product_id, batch_code)
);

create index if not exists stock_batches_fifo_idx
  on public.stock_batches (product_id, received_at, created_at, id) where qty_remaining > 0;
create index if not exists stock_batches_expiry_idx
  on public.stock_batches (expiry_date) where qty_remaining > 0;

-- Batch mana yang dipakai oleh pergerakan stok keluar (penjualan, koreksi minus, pembuangan).
create table if not exists public.stock_batch_allocations (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.stock_batches(id) on delete restrict,
  movement_id bigint not null references public.stock_movements(id) on delete restrict,
  qty integer not null check (qty > 0),
  created_at timestamptz not null default now()
);
create index if not exists stock_batch_alloc_batch_idx on public.stock_batch_allocations (batch_id);
create index if not exists stock_batch_alloc_movement_idx on public.stock_batch_allocations (movement_id);

-- Pembuangan batch. count_as_loss = true: dihitung sebagai kerugian di laporan laba rugi;
-- false: hanya dikeluarkan dari sistem (barang dijual/dibuang di luar sistem).
create table if not exists public.stock_write_offs (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.stock_batches(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  movement_id bigint references public.stock_movements(id) on delete set null,
  qty integer not null check (qty > 0),
  unit_cost bigint not null check (unit_cost >= 0),
  count_as_loss boolean not null,
  loss_amount bigint not null default 0 check (loss_amount >= 0),
  was_expired boolean not null default false,
  reason text not null check (char_length(btrim(reason)) >= 3),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists stock_write_offs_created_idx on public.stock_write_offs (created_at desc);

create or replace trigger set_updated_at before update on public.stock_batches
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3) Kolom baru di pembelian: tanggal kedaluwarsa + kode batch dari pemasok (opsional)
-- ---------------------------------------------------------------------------
alter table public.purchase_items add column if not exists expiry_date date;
alter table public.purchase_items add column if not exists batch_code text
  check (batch_code is null or char_length(btrim(batch_code)) between 1 and 60);

-- Barang yang sama boleh muncul lebih dari sekali dalam satu pembelian bila tanggalnya berbeda.
alter table public.purchase_items drop constraint if exists purchase_items_purchase_id_product_id_key;
create unique index if not exists purchase_items_line_unique
  on public.purchase_items (purchase_id, product_id, coalesce(expiry_date, date '0001-01-01'), coalesce(batch_code, ''));

-- ---------------------------------------------------------------------------
-- 4) Saldo awal: stok yang sudah ada menjadi satu batch "SALDO-AWAL" tanpa tanggal.
--    Pemilik diminta mengisi tanggalnya di menu Batch & Kedaluwarsa.
-- ---------------------------------------------------------------------------
insert into public.stock_batches
  (product_id, batch_code, source, received_at, expiry_date, qty_initial, qty_remaining, unit_cost)
select s.product_id, 'SALDO-AWAL', 'opening', least(p.created_at, now()), null,
       s.on_hand, s.on_hand, coalesce(pc.cost_price, 0)
  from public.stock_levels s
  join public.products p on p.id = s.product_id
  left join public.product_costs pc on pc.product_id = s.product_id
 where s.on_hand > 0
   and not exists (select 1 from public.stock_batches b where b.product_id = s.product_id);

-- Pastikan semua produk sudah sinkron SEBELUM penjaga dipasang.
do $$
declare v_bad int;
begin
  select count(*) into v_bad
    from public.stock_levels s
   where s.on_hand <> coalesce((select sum(b.qty_remaining) from public.stock_batches b where b.product_id = s.product_id), 0);
  if v_bad > 0 then
    raise exception 'Saldo awal gagal: % produk punya jumlah batch berbeda dari stok. Migrasi dibatalkan.', v_bad;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5) Penjaga: sum(qty_remaining) per produk = on_hand, diperiksa saat commit.
-- ---------------------------------------------------------------------------
create or replace function public._batch_sync_check()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pid uuid; v_sum bigint; v_hand int;
begin
  v_pid := case when tg_op = 'DELETE' then old.product_id else new.product_id end;
  select on_hand into v_hand from public.stock_levels where product_id = v_pid;
  if v_hand is null then return null; end if;   -- produk sedang dihapus
  select coalesce(sum(qty_remaining), 0) into v_sum from public.stock_batches where product_id = v_pid;
  if v_sum <> v_hand then
    raise exception 'STOK_BATCH_TIDAK_SINKRON' using detail = format('batch %s, stok %s', v_sum, v_hand);
  end if;
  return null;
end $$;
revoke all on function public._batch_sync_check() from public, anon, authenticated;

drop trigger if exists batch_sync_on_batches on public.stock_batches;
create constraint trigger batch_sync_on_batches
  after insert or update or delete on public.stock_batches
  deferrable initially deferred
  for each row execute function public._batch_sync_check();

drop trigger if exists batch_sync_on_levels on public.stock_levels;
create constraint trigger batch_sync_on_levels
  after insert or update of on_hand on public.stock_levels
  deferrable initially deferred
  for each row execute function public._batch_sync_check();

-- ---------------------------------------------------------------------------
-- 6) Keamanan: hanya pemilik yang boleh MEMBACA; tidak ada tulis langsung dari klien.
-- ---------------------------------------------------------------------------
alter table public.stock_batches enable row level security;
alter table public.stock_batch_allocations enable row level security;
alter table public.stock_write_offs enable row level security;

drop policy if exists stock_batches_owner_select on public.stock_batches;
create policy stock_batches_owner_select on public.stock_batches
  for select to authenticated using (public.is_owner());
drop policy if exists stock_batch_alloc_owner_select on public.stock_batch_allocations;
create policy stock_batch_alloc_owner_select on public.stock_batch_allocations
  for select to authenticated using (public.is_owner());
drop policy if exists stock_write_offs_owner_select on public.stock_write_offs;
create policy stock_write_offs_owner_select on public.stock_write_offs
  for select to authenticated using (public.is_owner());

revoke all on table public.stock_batches, public.stock_batch_allocations, public.stock_write_offs from anon, authenticated;
grant select on table public.stock_batches, public.stock_batch_allocations, public.stock_write_offs to authenticated;

