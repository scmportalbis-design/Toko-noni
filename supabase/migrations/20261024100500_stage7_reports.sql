-- Tahap 7: laporan. Penjualan (pesanan dibuat) != uang diterima (pembayaran
-- terverifikasi) != laba (butuh harga pokok saat transaksi).

-- 1) Harga pokok disalin ke item saat pembayaran terverifikasi (riwayat tidak berubah
--    bila harga pokok diubah kemudian).
alter table public.order_items
  add column if not exists unit_cost bigint check (unit_cost is null or unit_cost >= 0);

create or replace function public.snapshot_item_costs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'verified' and old.status is distinct from 'verified' then
    update public.order_items oi
       set unit_cost = pc.cost_price
      from public.product_costs pc
     where oi.order_id = new.order_id and pc.product_id = oi.product_id and oi.unit_cost is null;
  end if;
  return null;
end $$;

create trigger payments_snapshot_costs after update of status on public.payments
  for each row execute function public.snapshot_item_costs();
revoke execute on function public.snapshot_item_costs() from public, anon, authenticated;

-- 2) Ringkasan laporan (hanya pemilik). Tanggal dihitung dalam zona Asia/Jakarta.
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
    from public.order_items oi join pay on pay.order_id = oi.order_id)
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
    'daily', coalesce((select jsonb_agg(jsonb_build_object('date', x.d, 'count', x.c, 'total', x.t) order by x.d)
                       from (select d, count(*) c, sum(amount) t from pay group by d) x), '[]'::jsonb),
    'top_products', coalesce((select jsonb_agg(jsonb_build_object('name', y.n, 'qty', y.q, 'revenue', y.r) order by y.q desc)
                       from (select product_name n, sum(qty) q, sum(line_total) r from its
                             group by product_id, product_name order by sum(qty) desc limit 10) y), '[]'::jsonb)
  ) into v;
  return v;
end $$;

revoke execute on function public.report_summary(date, date) from public, anon;
grant execute on function public.report_summary(date, date) to authenticated;
