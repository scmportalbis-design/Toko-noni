-- Batch stok, langkah 3 dari 3: fungsi FIFO, penerimaan pembelian, koreksi stok, verifikasi
-- pembayaran, reservasi, pembuangan batch, koreksi tanggal, view stok, dan laporan.
-- Jalankan SETELAH 20261123100000_batch_enum.sql dan 20261123100100_stock_batches.sql.
-- Aman dijalankan ulang. Bagian pertama menolak berjalan bila fungsi di database ternyata
-- berbeda dari yang dipakai sebagai dasar (supaya tidak menimpa perubahan yang tidak terlihat).

-- ---------------------------------------------------------------------------
-- 0) Pemeriksaan dasar
-- ---------------------------------------------------------------------------
do $$
declare v_oid regprocedure; v_def text;
begin
  v_oid := to_regprocedure('public.verify_payment(uuid,text,bigint,text)');
  if v_oid is null then raise exception 'verify_payment tidak ditemukan'; end if;
  v_def := pg_get_functiondef(v_oid);
  if position('_fifo_consume' in v_def) = 0
     and (position('RESERVASI_TIDAK_ADA' in v_def) = 0 or position('on_hand = on_hand - r.qty' in v_def) = 0
          or position('REFERENSI_SUDAH_DIPAKAI' in v_def) = 0) then
    raise exception 'verify_payment di database berbeda dari yang diharapkan. Kirim hasil pg_get_functiondef-nya.';
  end if;

  v_oid := to_regprocedure('public._reserve_stock(uuid,timestamp with time zone)');
  if v_oid is null then raise exception '_reserve_stock tidak ditemukan'; end if;
  v_def := pg_get_functiondef(v_oid);
  if position('_expired_qty' in v_def) = 0
     and (position('STOK_TIDAK_CUKUP' in v_def) = 0 or position('RESERVASI_SUDAH_AKTIF' in v_def) = 0) then
    raise exception '_reserve_stock di database berbeda dari yang diharapkan. Kirim hasil pg_get_functiondef-nya.';
  end if;

  v_oid := to_regprocedure('public.receive_purchase(uuid)');
  if v_oid is null then raise exception 'receive_purchase tidak ditemukan'; end if;
  v_def := pg_get_functiondef(v_oid);
  if position('_add_batch' in v_def) = 0
     and (position('PEMBELIAN_BUKAN_DRAF' in v_def) = 0 or position('on_hand = on_hand + r.qty' in v_def) = 0) then
    raise exception 'receive_purchase di database berbeda dari yang diharapkan. Kirim hasil pg_get_functiondef-nya.';
  end if;

  v_oid := to_regprocedure('public.adjust_stock(uuid,integer,text)');   -- bentuk lama; null bila sudah dimigrasi
  if v_oid is not null then
    v_def := pg_get_functiondef(v_oid);
    if position('STOK_DI_BAWAH_RESERVASI' in v_def) = 0 then
      raise exception 'adjust_stock di database berbeda dari yang diharapkan. Kirim hasil pg_get_functiondef-nya.';
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1) Pembantu internal (tidak bisa dipanggil dari klien)
-- ---------------------------------------------------------------------------
create or replace function public._next_batch_code(p_prefix text)
returns text language sql security definer set search_path = public as $$
  select p_prefix || '-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDD') || '-'
         || lpad(nextval('public.stock_batch_seq')::text, 4, '0')
$$;

-- Jumlah stok kedaluwarsa (tanggal sudah lewat) yang belum dibuang. Hanya mengembalikan ANGKA.
create or replace function public._expired_qty(p_product_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(qty_remaining), 0)::int
    from public.stock_batches
   where product_id = p_product_id and qty_remaining > 0
     and expiry_date is not null and expiry_date < public._today_jakarta()
$$;

-- Tambah satu batch baru (stok masuk). Penyeimbang on_hand dilakukan oleh pemanggil.
create or replace function public._add_batch(
  p_product_id uuid, p_qty integer, p_expiry date, p_unit_cost bigint,
  p_source text, p_code text, p_purchase_item_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text;
begin
  if p_expiry is null then raise exception 'TANGGAL_KEDALUWARSA_WAJIB'; end if;
  if p_expiry < public._today_jakarta() then raise exception 'TANGGAL_KEDALUWARSA_TIDAK_VALID'; end if;
  v_code := nullif(btrim(coalesce(p_code, '')), '');
  if v_code is null then
    v_code := public._next_batch_code(case p_source when 'purchase' then 'BT' else 'ADJ' end);
  end if;
  begin
    insert into public.stock_batches
      (product_id, batch_code, source, received_at, expiry_date, qty_initial, qty_remaining,
       unit_cost, purchase_item_id, created_by)
    values (p_product_id, v_code, p_source, clock_timestamp(), p_expiry, p_qty, p_qty,
            coalesce(p_unit_cost, 0), p_purchase_item_id, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'KODE_BATCH_SUDAH_ADA' using detail = v_code;
  end;
  return v_id;
end $$;

-- Ambil p_qty dari batch dengan urutan FIFO (received_at, lalu urutan pembuatan).
-- p_include_expired = false: batch yang sudah lewat tanggal kedaluwarsa dilewati (penjualan).
-- Pemanggil WAJIB sudah mengunci baris stock_levels produk (urutan kunci: stock_levels -> batch).
create or replace function public._fifo_consume(
  p_product_id uuid, p_qty integer, p_movement_id bigint, p_include_expired boolean)
returns void language plpgsql security definer set search_path = public as $$
declare b record; v_need int := p_qty; v_take int; v_today date := public._today_jakarta(); v_name text;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'PERUBAHAN_STOK_TIDAK_VALID'; end if;
  for b in
    select id, qty_remaining from public.stock_batches
     where product_id = p_product_id and qty_remaining > 0
       and (p_include_expired or expiry_date is null or expiry_date >= v_today)
     order by received_at, created_at, id
       for update
  loop
    exit when v_need = 0;
    v_take := least(b.qty_remaining, v_need);
    update public.stock_batches set qty_remaining = qty_remaining - v_take where id = b.id;
    insert into public.stock_batch_allocations (batch_id, movement_id, qty) values (b.id, p_movement_id, v_take);
    v_need := v_need - v_take;
  end loop;
  if v_need > 0 then
    select name into v_name from public.products where id = p_product_id;
    raise exception 'STOK_TIDAK_CUKUP' using detail = coalesce(v_name, 'produk');
  end if;
end $$;

revoke all on function public._next_batch_code(text) from public, anon, authenticated;
revoke all on function public._expired_qty(uuid) from public, anon, authenticated;
revoke all on function public._add_batch(uuid, integer, date, bigint, text, text, uuid) from public, anon, authenticated;
revoke all on function public._fifo_consume(uuid, integer, bigint, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Penerimaan pembelian: setiap baris menjadi satu batch (tanggal kedaluwarsa WAJIB)
-- ---------------------------------------------------------------------------
create or replace function public.receive_purchase(p_purchase_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_purchase public.purchases%rowtype; r record; v_after int; v_n int := 0;
begin
  if not public.is_owner() then raise exception 'AKSES_DITOLAK' using errcode = '42501'; end if;
  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if not found then raise exception 'PEMBELIAN_TIDAK_DITEMUKAN'; end if;
  if v_purchase.status <> 'draft' then raise exception 'PEMBELIAN_BUKAN_DRAF'; end if;
  if not exists (select 1 from public.purchase_items where purchase_id = p_purchase_id) then
    raise exception 'PEMBELIAN_KOSONG';
  end if;
  if exists (select 1 from public.purchase_items where purchase_id = p_purchase_id and expiry_date is null) then
    raise exception 'TANGGAL_KEDALUWARSA_WAJIB';
  end if;

  perform set_config('app.rpc', 'on', true);   -- berlaku hanya dalam transaksi ini

  -- Urut per produk lalu tanggal kedaluwarsa: tanggal lebih dekat = masuk lebih dulu = keluar lebih dulu.
  for r in
    select id, product_id, qty, unit_cost, expiry_date, batch_code from public.purchase_items
    where purchase_id = p_purchase_id order by product_id, expiry_date, id
  loop
    update public.stock_levels set on_hand = on_hand + r.qty
     where product_id = r.product_id returning on_hand into v_after;
    if not found then raise exception 'PRODUK_TIDAK_DITEMUKAN'; end if;
    insert into public.stock_movements
      (product_id, movement_type, qty_change, on_hand_after, reference_type, reference_id, created_by)
    values (r.product_id, 'purchase_receipt', r.qty, v_after, 'purchase', p_purchase_id, auth.uid());
    perform public._add_batch(r.product_id, r.qty, r.expiry_date, r.unit_cost, 'purchase', r.batch_code, r.id);
    insert into public.product_costs (product_id, cost_price) values (r.product_id, r.unit_cost)
    on conflict (product_id) do update set cost_price = excluded.cost_price;
    v_n := v_n + 1;
  end loop;

  update public.purchases
     set status = 'received', received_by = auth.uid(), received_at = now()
   where id = p_purchase_id;
  perform public._audit('purchase.received', 'purchase', p_purchase_id::text,
    jsonb_build_object('batches', v_n));
  return jsonb_build_object('status', 'received');
end $$;

-- ---------------------------------------------------------------------------
-- 3) Koreksi stok: tambah = batch baru (tanggal WAJIB); kurang = FIFO
-- ---------------------------------------------------------------------------
drop function if exists public.adjust_stock(uuid, integer, text);
create or replace function public.adjust_stock(
  p_product_id uuid, p_delta integer, p_reason text, p_expiry_date date default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_stock public.stock_levels%rowtype; v_after int; v_mid bigint; v_cost bigint;
begin
  if not public.is_owner() then raise exception 'AKSES_DITOLAK' using errcode = '42501'; end if;
  if p_delta is null or p_delta = 0 then raise exception 'PERUBAHAN_STOK_TIDAK_VALID'; end if;
  p_reason := btrim(coalesce(p_reason, ''));
  if char_length(p_reason) < 3 then raise exception 'ALASAN_WAJIB'; end if;
  if p_delta > 0 and p_expiry_date is null then raise exception 'TANGGAL_KEDALUWARSA_WAJIB'; end if;

  select * into v_stock from public.stock_levels where product_id = p_product_id for update;
  if not found then raise exception 'PRODUK_TIDAK_DITEMUKAN'; end if;
  if v_stock.on_hand + p_delta < v_stock.reserved then
    raise exception 'STOK_DI_BAWAH_RESERVASI'
      using detail = format('Stok fisik %s, sedang direservasi %s', v_stock.on_hand, v_stock.reserved);
  end if;

  update public.stock_levels set on_hand = on_hand + p_delta
   where product_id = p_product_id returning on_hand into v_after;
  insert into public.stock_movements
    (product_id, movement_type, qty_change, on_hand_after, reference_type, note, created_by)
  values (p_product_id, 'adjustment', p_delta, v_after, null, p_reason, auth.uid())
  returning id into v_mid;

  if p_delta > 0 then
    select coalesce(cost_price, 0) into v_cost from public.product_costs where product_id = p_product_id;
    perform public._add_batch(p_product_id, p_delta, p_expiry_date, coalesce(v_cost, 0), 'adjustment', null, null);
  else
    -- Koreksi minus = selisih fisik: FIFO atas seluruh batch (termasuk yang sudah kedaluwarsa).
    perform public._fifo_consume(p_product_id, -p_delta, v_mid, true);
  end if;

  perform public._audit('stock.adjusted', 'product', p_product_id::text,
    jsonb_build_object('delta', p_delta, 'on_hand_after', v_after, 'reason', p_reason,
                       'expiry_date', case when p_delta > 0 then p_expiry_date end));
  return jsonb_build_object('on_hand', v_after);
end $$;

revoke all on function public.adjust_stock(uuid, integer, text, date) from public, anon;
grant execute on function public.adjust_stock(uuid, integer, text, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Reservasi: stok kedaluwarsa tidak dihitung tersedia (dasar: tahap awal + 1 baris)
-- ---------------------------------------------------------------------------
create or replace function public._reserve_stock(p_order_id uuid, p_expires timestamp with time zone)
returns void
language plpgsql security definer set search_path = public as $$
declare r record; v_stock public.stock_levels%rowtype;
begin
  if exists (select 1 from public.stock_reservations where order_id = p_order_id and status = 'active') then
    raise exception 'RESERVASI_SUDAH_AKTIF';
  end if;
  -- Urut per product_id agar penguncian konsisten (mencegah deadlock).
  for r in
    select oi.product_id, oi.qty, p.name, p.is_active
    from public.order_items oi join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id
    order by oi.product_id
  loop
    if not r.is_active then raise exception 'PRODUK_TIDAK_TERSEDIA' using detail = r.name; end if;
    select * into v_stock from public.stock_levels where product_id = r.product_id for update;
    if not found or v_stock.on_hand - v_stock.reserved - public._expired_qty(r.product_id) < r.qty then
      raise exception 'STOK_TIDAK_CUKUP' using detail = r.name;
    end if;
    update public.stock_levels set reserved = reserved + r.qty where product_id = r.product_id;
    insert into public.stock_reservations (order_id, product_id, qty, status, expires_at)
    values (p_order_id, r.product_id, r.qty, 'active', p_expires)
    on conflict (order_id, product_id) do update
      set status = 'active', qty = excluded.qty, expires_at = excluded.expires_at, resolved_at = null;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5) Verifikasi pembayaran: pengurangan stok mengikuti FIFO batch (dasar: tahap awal)
-- ---------------------------------------------------------------------------
create or replace function public.verify_payment(
  p_payment_id uuid, p_reference text, p_amount_received bigint, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_pay public.payments%rowtype; v_order public.orders%rowtype;
  r record; v_after int; v_mid bigint;
begin
  if not public.is_staff() then raise exception 'AKSES_DITOLAK' using errcode = '42501'; end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'PEMBAYARAN_TIDAK_DITEMUKAN'; end if;
  if v_pay.status = 'verified' then
    return jsonb_build_object('payment_status', 'verified', 'already_verified', true);
  end if;
  if v_pay.status not in ('pending', 'claimed') then raise exception 'STATUS_PEMBAYARAN_TIDAK_VALID'; end if;

  p_reference := btrim(coalesce(p_reference, ''));
  if char_length(p_reference) < 3 then raise exception 'REFERENSI_WAJIB'; end if;
  if p_amount_received is distinct from v_pay.amount then
    raise exception 'NOMINAL_TIDAK_SESUAI'
      using detail = format('Seharusnya %s, diterima %s', v_pay.amount, p_amount_received);
  end if;

  select * into v_order from public.orders where id = v_pay.order_id for update;
  if v_order.status = 'cancelled' then raise exception 'PESANAN_DIBATALKAN'; end if;

  begin
    update public.payments
       set status = 'verified', provider_reference = p_reference,
           verified_by = auth.uid(), verified_at = now()
     where id = v_pay.id;
  exception when unique_violation then
    raise exception 'REFERENSI_SUDAH_DIPAKAI';
  end;

  -- Bayar setelah reservasi kedaluwarsa: coba pesan ulang stok; gagal = perlu refund manual.
  if v_order.status = 'expired' then
    perform public._reserve_stock(v_order.id, now() + interval '5 minutes');
    update public.orders set status = 'open', cancel_reason = null, cancelled_at = null
     where id = v_order.id;
  end if;

  if not exists (select 1 from public.stock_reservations where order_id = v_order.id and status = 'active') then
    raise exception 'RESERVASI_TIDAK_ADA';
  end if;

  for r in
    select product_id, qty from public.stock_reservations
    where order_id = v_order.id and status = 'active'
    order by product_id for update
  loop
    update public.stock_levels
       set on_hand = on_hand - r.qty, reserved = reserved - r.qty
     where product_id = r.product_id
    returning on_hand into v_after;
    insert into public.stock_movements
      (product_id, movement_type, qty_change, on_hand_after, reference_type, reference_id, note, created_by)
    values (r.product_id, 'sale', -r.qty, v_after, 'order', v_order.id, v_order.order_number, auth.uid())
    returning id into v_mid;
    -- FIFO: ambil dari batch yang masuk paling dulu (batch kedaluwarsa dilewati).
    perform public._fifo_consume(r.product_id, r.qty, v_mid, false);
  end loop;

  update public.stock_reservations set status = 'consumed', resolved_at = now()
   where order_id = v_order.id and status = 'active';
  update public.orders set payment_status = 'verified' where id = v_order.id;

  perform public._audit('payment.verified', 'payment', p_payment_id::text,
    jsonb_build_object('order_number', v_order.order_number, 'reference', p_reference,
                       'amount', v_pay.amount, 'note', p_note));
  return jsonb_build_object('payment_status', 'verified', 'order_number', v_order.order_number);
end $$;

-- ---------------------------------------------------------------------------
-- 6) Pembuangan batch (pemilik). Pilihan: hitung sebagai kerugian, atau hanya keluarkan dari sistem.
-- ---------------------------------------------------------------------------
create or replace function public.dispose_batch(
  p_batch_id uuid, p_qty integer, p_reason text, p_count_as_loss boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid; v_stock public.stock_levels%rowtype; v_b public.stock_batches%rowtype;
  v_after int; v_mid bigint; v_loss bigint; v_expired boolean;
begin
  if not public.is_owner() then raise exception 'AKSES_DITOLAK' using errcode = '42501'; end if;
  p_reason := btrim(coalesce(p_reason, ''));
  if char_length(p_reason) < 3 then raise exception 'ALASAN_WAJIB'; end if;
  if p_count_as_loss is null then raise exception 'PERUBAHAN_STOK_TIDAK_VALID'; end if;

  select product_id into v_pid from public.stock_batches where id = p_batch_id;
  if not found then raise exception 'BATCH_TIDAK_DITEMUKAN'; end if;

  -- Urutan kunci sama dengan jalur penjualan: stock_levels dulu, baru batch.
  select * into v_stock from public.stock_levels where product_id = v_pid for update;
  select * into v_b from public.stock_batches where id = p_batch_id for update;

  if p_qty is null or p_qty < 1 or p_qty > v_b.qty_remaining then
    raise exception 'JUMLAH_BATCH_TIDAK_VALID' using detail = format('Sisa batch %s', v_b.qty_remaining);
  end if;
  if v_stock.on_hand - p_qty < v_stock.reserved then
    raise exception 'STOK_DI_BAWAH_RESERVASI'
      using detail = format('Stok fisik %s, sedang direservasi %s', v_stock.on_hand, v_stock.reserved);
  end if;

  update public.stock_batches set qty_remaining = qty_remaining - p_qty where id = p_batch_id;
  update public.stock_levels set on_hand = on_hand - p_qty
   where product_id = v_pid returning on_hand into v_after;

  -- Catatan pergerakan sengaja kosong: kasir ikut melihat riwayat stok, dan alasan/tanggal
  -- kedaluwarsa hanya boleh diketahui pemilik (tersimpan di stock_write_offs dan audit_log).
  insert into public.stock_movements
    (product_id, movement_type, qty_change, on_hand_after, reference_type, reference_id, note, created_by)
  values (v_pid, 'write_off', -p_qty, v_after, 'batch', p_batch_id, null, auth.uid())
  returning id into v_mid;
  insert into public.stock_batch_allocations (batch_id, movement_id, qty) values (p_batch_id, v_mid, p_qty);

  v_expired := v_b.expiry_date is not null and v_b.expiry_date < public._today_jakarta();
  v_loss := case when p_count_as_loss then p_qty::bigint * v_b.unit_cost else 0 end;
  insert into public.stock_write_offs
    (batch_id, product_id, movement_id, qty, unit_cost, count_as_loss, loss_amount, was_expired, reason, created_by)
  values (p_batch_id, v_pid, v_mid, p_qty, v_b.unit_cost, p_count_as_loss, v_loss, v_expired, p_reason, auth.uid());

  perform public._audit('batch.disposed', 'batch', p_batch_id::text,
    jsonb_build_object('batch_code', v_b.batch_code, 'product_id', v_pid, 'qty', p_qty,
                       'expiry_date', v_b.expiry_date, 'count_as_loss', p_count_as_loss,
                       'loss_amount', v_loss, 'reason', p_reason));
  return jsonb_build_object('on_hand', v_after, 'loss_amount', v_loss);
end $$;

-- ---------------------------------------------------------------------------
-- 7) Koreksi / pengisian tanggal kedaluwarsa batch (pemilik)
-- ---------------------------------------------------------------------------
create or replace function public.set_batch_expiry(p_batch_id uuid, p_expiry_date date, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_pid uuid; v_b public.stock_batches%rowtype; v_stock public.stock_levels%rowtype;
begin
  if not public.is_owner() then raise exception 'AKSES_DITOLAK' using errcode = '42501'; end if;
  if p_expiry_date is null then raise exception 'TANGGAL_KEDALUWARSA_WAJIB'; end if;
  p_reason := btrim(coalesce(p_reason, ''));

  select product_id into v_pid from public.stock_batches where id = p_batch_id;
  if not found then raise exception 'BATCH_TIDAK_DITEMUKAN'; end if;
  select * into v_stock from public.stock_levels where product_id = v_pid for update;
  select * into v_b from public.stock_batches where id = p_batch_id for update;

  if v_b.expiry_date is not distinct from p_expiry_date then raise exception 'TANGGAL_TIDAK_BERUBAH'; end if;
  -- Mengubah tanggal yang sudah terisi butuh alasan; pengisian pertama (stok lama) tidak.
  if v_b.expiry_date is not null and char_length(p_reason) < 3 then raise exception 'ALASAN_WAJIB'; end if;

  update public.stock_batches set expiry_date = p_expiry_date where id = p_batch_id;

  -- Tanggal yang dimajukan ke masa lalu tidak boleh membuat stok layak-jual lebih kecil dari reservasi aktif.
  if v_stock.on_hand - public._expired_qty(v_pid) < v_stock.reserved then
    raise exception 'STOK_DI_BAWAH_RESERVASI'
      using detail = format('Ada pesanan aktif yang menahan %s stok', v_stock.reserved);
  end if;

  perform public._audit('batch.expiry_changed', 'batch', p_batch_id::text,
    jsonb_build_object('batch_code', v_b.batch_code, 'product_id', v_pid,
                       'old', v_b.expiry_date, 'new', p_expiry_date, 'reason', nullif(p_reason, '')));
  return jsonb_build_object('expiry_date', p_expiry_date);
end $$;

revoke all on function public.dispose_batch(uuid, integer, text, boolean) from public, anon;
grant execute on function public.dispose_batch(uuid, integer, text, boolean) to authenticated;
revoke all on function public.set_batch_expiry(uuid, date, text) from public, anon;
grant execute on function public.set_batch_expiry(uuid, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8) View. Pelanggan & kasir hanya melihat ANGKA stok layak-jual, tanpa tanggal.
-- ---------------------------------------------------------------------------
-- 8a) Katalog publik: tersedia = fisik - dipesan - stok kedaluwarsa. Kolom & urutan tetap.
create or replace view public.catalog_products as
 select p.id,
    p.category_id,
    p.name,
    p.slug,
    p.description,
    p.price,
    p.unit,
    p.image_path,
    greatest((s.on_hand - s.reserved - coalesce(x.expired, 0)::int), 0) as available
   from public.products p
     join public.stock_levels s on s.product_id = p.id
     left join (
       select b.product_id, sum(b.qty_remaining) as expired
         from public.stock_batches b
        where b.qty_remaining > 0 and b.expiry_date is not null
          and b.expiry_date < (now() at time zone 'Asia/Jakarta')::date
        group by b.product_id
     ) x on x.product_id = p.id
  where p.is_active;

-- 8b) Stok untuk staf (kasir & pemilik). on_hand di sini = stok fisik layak-jual
--     (tidak termasuk batch kedaluwarsa), supaya angkanya sama dengan yang dilihat pelanggan.
create or replace view public.staff_stock as
 select s.product_id,
    p.name,
    p.unit,
    p.is_active,
    (s.on_hand - coalesce(x.expired, 0)::int) as on_hand,
    s.reserved,
    s.low_stock_threshold
   from public.stock_levels s
     join public.products p on p.id = s.product_id
     left join (
       select b.product_id, sum(b.qty_remaining) as expired
         from public.stock_batches b
        where b.qty_remaining > 0 and b.expiry_date is not null
          and b.expiry_date < (now() at time zone 'Asia/Jakarta')::date
        group by b.product_id
     ) x on x.product_id = s.product_id
  where public.is_staff();

revoke all on table public.staff_stock from anon, authenticated;
grant select on table public.staff_stock to authenticated;

-- ---------------------------------------------------------------------------
-- 9) Laporan: tambah kerugian pembuangan batch (dasar: tahap 7)
-- ---------------------------------------------------------------------------
create or replace function public.report_summary(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_owner() then raise exception 'AKSES_DITOLAK' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'RENTANG_TANGGAL_TIDAK_VALID';
  end if;

  with
  ord as (
    select status, payment_status, total from public.orders
    where (created_at at time zone 'Asia/Jakarta')::date between p_from and p_to),
  pay as (
    select p.order_id, p.amount, (p.verified_at at time zone 'Asia/Jakarta')::date as d
    from public.payments p
    where p.status = 'verified'
      and (p.verified_at at time zone 'Asia/Jakarta')::date between p_from and p_to),
  its as (
    select oi.product_id, oi.product_name, oi.qty, oi.line_total, oi.unit_cost
    from public.order_items oi join pay on pay.order_id = oi.order_id),
  wo as (
    select w.qty, w.loss_amount, w.count_as_loss from public.stock_write_offs w
    where (w.created_at at time zone 'Asia/Jakarta')::date between p_from and p_to)
  select jsonb_build_object(
    'orders_created',        (select count(*) from ord),
    'orders_created_value',  (select coalesce(sum(total), 0) from ord),
    'orders_cancelled',      (select count(*) from ord where status in ('cancelled', 'expired')),
    'orders_unpaid_open',    (select count(*) from ord where status = 'open' and payment_status in ('pending', 'claimed')),
    'verified_count',        (select count(*) from pay),
    'verified_total',        (select coalesce(sum(amount), 0) from pay),
    'items_sold',            (select coalesce(sum(qty), 0) from its),
    'revenue_with_cost',     (select coalesce(sum(line_total) filter (where unit_cost is not null), 0) from its),
    'cogs',                  (select coalesce(sum(unit_cost * qty) filter (where unit_cost is not null), 0) from its),
    'items_missing_cost',    (select count(*) from its where unit_cost is null),
    'writeoff_loss',         (select coalesce(sum(loss_amount) filter (where count_as_loss), 0) from wo),
    'writeoff_loss_qty',     (select coalesce(sum(qty) filter (where count_as_loss), 0) from wo),
    'writeoff_system_qty',   (select coalesce(sum(qty) filter (where not count_as_loss), 0) from wo),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('date', x.d, 'count', x.c, 'total', x.t) order by x.d)
                       from (select d, count(*) c, sum(amount) t from pay group by d) x), '[]'::jsonb),
    'top_products', coalesce((select jsonb_agg(jsonb_build_object('name', y.n, 'qty', y.q, 'revenue', y.r) order by y.q desc)
                       from (select product_name n, sum(qty) q, sum(line_total) r from its
                             group by product_id, product_name order by sum(qty) desc limit 10) y), '[]'::jsonb)
  ) into v;
  return v;
end $$;
