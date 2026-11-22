-- Pembayaran tunai (cash) di samping QRIS.
-- Kolom payments.method sudah ada (default 'qris_static'); migrasi ini:
--  1) membatasi nilainya ke 'qris_static' | 'cash',
--  2) menambah choose_payment_method (pelanggan memilih cara bayar via nomor + token pesanan),
--  3) menampilkan metode di get_order_by_token,
--  4) membuat reject_payment mempertahankan metode pada tagihan pengganti.
-- verify_payment TIDAK diubah: pembayaran tunai diverifikasi lewat fungsi yang sama
-- (referensi otomatis "TUNAI-<nomor pesanan>", nominal harus sama dengan tagihan).
-- Aman dijalankan ulang.

-- 1) Batasi nilai metode.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'payments_method_check' and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_method_check check (method in ('qris_static', 'cash'));
  end if;
end $$;

-- 2) Pelanggan memilih/ganti cara bayar selama pembayaran masih 'pending'.
create or replace function public.choose_payment_method(p_order_number text, p_token text, p_method text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype; v_pay public.payments%rowtype;
begin
  if p_method is null or p_method not in ('qris_static', 'cash') then
    raise exception 'METODE_PEMBAYARAN_TIDAK_VALID';
  end if;

  select * into v_order from public.orders
   where order_number = p_order_number and access_token = p_token for update;
  if not found then raise exception 'PESANAN_TIDAK_DITEMUKAN'; end if;
  if v_order.status <> 'open' then raise exception 'PESANAN_TIDAK_AKTIF'; end if;

  select * into v_pay from public.payments
   where order_id = v_order.id and status in ('pending', 'claimed') for update;
  if not found then raise exception 'PEMBAYARAN_TIDAK_DITEMUKAN'; end if;
  -- Sudah menyatakan bayar: petugas sedang memeriksa, metode tidak boleh diganti lagi.
  if v_pay.status <> 'pending' then raise exception 'STATUS_PEMBAYARAN_TIDAK_VALID'; end if;

  if v_pay.method is distinct from p_method then
    update public.payments set method = p_method where id = v_pay.id;
  end if;
  return jsonb_build_object('method', p_method);
end $$;

revoke all on function public.choose_payment_method(text, text, text) from public;
grant execute on function public.choose_payment_method(text, text, text) to anon, authenticated;

-- 3) get_order_by_token: tambah 'method' pada objek payment (selain itu sama dengan tahap 5).
create or replace function public.get_order_by_token(p_order_number text, p_token text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'order_number', o.order_number, 'status', o.status,
    'payment_status', o.payment_status, 'fulfillment_status', o.fulfillment_status,
    'customer_name', o.customer_name, 'note', o.note,
    'subtotal', o.subtotal, 'discount', o.discount, 'total', o.total,
    'expires_at', o.expires_at, 'created_at', o.created_at, 'cancel_reason', o.cancel_reason,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
                'product_id', i.product_id, 'name', i.product_name, 'unit_price', i.unit_price,
                'qty', i.qty, 'line_total', i.line_total) order by i.product_name)
              from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'payment', (select jsonb_build_object('status', pm.status, 'method', pm.method, 'amount', pm.amount,
                  'claimed_at', pm.claimed_at, 'verified_at', pm.verified_at,
                  'rejected_reason', pm.rejected_reason)
                from public.payments pm where pm.order_id = o.id
                order by (pm.status in ('pending', 'claimed', 'verified')) desc, pm.created_at desc
                limit 1),
    'last_rejection_reason', (select pr.rejected_reason from public.payments pr
                where pr.order_id = o.id and pr.status = 'rejected'
                order by pr.updated_at desc limit 1),
    'receipt_number', (select r.receipt_number from public.receipts r where r.order_id = o.id))
  from public.orders o
  where o.order_number = p_order_number and o.access_token = p_token
$$;

-- 4) reject_payment: tagihan pengganti mewarisi metode pembayaran yang ditolak.
create or replace function public.reject_payment(p_payment_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_pay public.payments%rowtype; v_order public.orders%rowtype;
begin
  if not public.is_staff() then raise exception 'AKSES_DITOLAK' using errcode = '42501'; end if;
  p_reason := btrim(coalesce(p_reason, ''));
  if char_length(p_reason) < 3 then raise exception 'ALASAN_WAJIB'; end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'PEMBAYARAN_TIDAK_DITEMUKAN'; end if;
  if v_pay.status not in ('pending', 'claimed') then raise exception 'STATUS_PEMBAYARAN_TIDAK_VALID'; end if;
  select * into v_order from public.orders where id = v_pay.order_id for update;

  update public.payments set status = 'rejected', rejected_reason = p_reason where id = v_pay.id;
  if v_order.status = 'open' then
    insert into public.payments (order_id, amount, method) values (v_order.id, v_order.total, v_pay.method);
    update public.orders set payment_status = 'pending' where id = v_order.id;
  end if;
  perform public._audit('payment.rejected', 'payment', p_payment_id::text,
    jsonb_build_object('order_number', v_order.order_number, 'reason', p_reason, 'method', v_pay.method));
  return jsonb_build_object('payment_status', 'rejected');
end $$;
