-- Hapus pembayaran tunai (cash). Hanya QRIS yang dipakai toko.
-- Membatalkan migrasi 20261122120000_cash_payment.sql. Aman dijalankan ulang.
--  1) tagihan tunai yang masih terbuka dikembalikan ke QRIS,
--  2) fungsi choose_payment_method dihapus,
--  3) constraint payments_method_check dihapus,
--  4) get_order_by_token kembali ke versi tahap 5 (tanpa field method),
--  5) reject_payment kembali ke versi asli (tagihan pengganti memakai metode bawaan).
-- Kolom payments.method TETAP ada (bawaan 'qris_static'); tidak dipakai lagi oleh aplikasi.

do $$
declare v_open int; v_history int;
begin
  select count(*) into v_open    from public.payments where method = 'cash' and status in ('pending', 'claimed');
  select count(*) into v_history from public.payments where method = 'cash' and status not in ('pending', 'claimed');
  raise notice 'Tagihan tunai terbuka (diubah ke QRIS): %. Riwayat tunai (dibiarkan apa adanya): %.', v_open, v_history;
end $$;

-- 1) Tagihan tunai yang belum selesai menjadi tagihan QRIS biasa.
update public.payments set method = 'qris_static'
 where method = 'cash' and status in ('pending', 'claimed');

-- 2) Fungsi pilih metode.
drop function if exists public.choose_payment_method(text, text, text);

-- 3) Batasan nilai metode.
alter table public.payments drop constraint if exists payments_method_check;

-- 4) get_order_by_token: sama dengan tahap 5 (tanpa 'method').
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
    'payment', (select jsonb_build_object('status', pm.status, 'amount', pm.amount,
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

-- 5) reject_payment: versi asli.
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
    insert into public.payments (order_id, amount) values (v_order.id, v_order.total);
    update public.orders set payment_status = 'pending' where id = v_order.id;
  end if;
  perform public._audit('payment.rejected', 'payment', p_payment_id::text,
    jsonb_build_object('order_number', v_order.order_number, 'reason', p_reason));
  return jsonb_build_object('payment_status', 'rejected');
end $$;
