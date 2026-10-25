-- Tahap 5: pelanggan perlu melihat alasan bila pembayarannya ditolak petugas.
-- get_order_by_token ditambah field last_rejection_reason (hak eksekusi tetap).
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
