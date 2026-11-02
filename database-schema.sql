


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."fulfillment_status" AS ENUM (
    'pending',
    'preparing',
    'ready',
    'picked_up'
);


ALTER TYPE "public"."fulfillment_status" OWNER TO "postgres";


CREATE TYPE "public"."order_status" AS ENUM (
    'open',
    'completed',
    'cancelled',
    'expired'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'claimed',
    'verified',
    'rejected',
    'refunded'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."purchase_status" AS ENUM (
    'draft',
    'received',
    'cancelled'
);


ALTER TYPE "public"."purchase_status" OWNER TO "postgres";


CREATE TYPE "public"."reservation_status" AS ENUM (
    'active',
    'consumed',
    'released'
);


ALTER TYPE "public"."reservation_status" OWNER TO "postgres";


CREATE TYPE "public"."stock_movement_type" AS ENUM (
    'purchase_receipt',
    'sale',
    'adjustment',
    'return'
);


ALTER TYPE "public"."stock_movement_type" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'owner',
    'cashier'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_audit"("p_action" "text", "p_entity_type" "text", "p_entity_id" "text", "p_details" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_details)
$$;


ALTER FUNCTION "public"."_audit"("p_action" "text", "p_entity_type" "text", "p_entity_id" "text", "p_details" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_cancel_open_order"("p_order_id" "uuid", "p_reason" "text", "p_actor" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public._release_reservations(p_order_id);
  update public.orders
     set status = 'cancelled', cancel_reason = p_reason, cancelled_by = p_actor, cancelled_at = now()
   where id = p_order_id;
  update public.payments
     set status = 'rejected', rejected_reason = 'Pesanan dibatalkan: ' || p_reason
   where order_id = p_order_id and status in ('pending', 'claimed');
end $$;


ALTER FUNCTION "public"."_cancel_open_order"("p_order_id" "uuid", "p_reason" "text", "p_actor" "uuid") OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."order_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."order_number_seq" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_number" "text" DEFAULT ((('NON-'::"text" || "to_char"(("now"() AT TIME ZONE 'Asia/Jakarta'::"text"), 'YYMMDD'::"text")) || '-'::"text") || "lpad"(("nextval"('"public"."order_number_seq"'::"regclass"))::"text", 5, '0'::"text")) NOT NULL,
    "access_token" "text" DEFAULT "replace"((("gen_random_uuid"())::"text" || ("gen_random_uuid"())::"text"), '-'::"text", ''::"text") NOT NULL,
    "customer_name" "text" NOT NULL,
    "customer_phone" "text" NOT NULL,
    "note" "text",
    "status" "public"."order_status" DEFAULT 'open'::"public"."order_status" NOT NULL,
    "payment_status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status" NOT NULL,
    "fulfillment_status" "public"."fulfillment_status" DEFAULT 'pending'::"public"."fulfillment_status" NOT NULL,
    "subtotal" bigint NOT NULL,
    "discount" bigint DEFAULT 0 NOT NULL,
    "total" bigint NOT NULL,
    "expires_at" timestamp with time zone,
    "idempotency_key" "text",
    "cancel_reason" "text",
    "cancelled_by" "uuid",
    "cancelled_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "orders_cancel_reason" CHECK ((("status" <> 'cancelled'::"public"."order_status") OR (("cancel_reason" IS NOT NULL) AND ("char_length"("btrim"("cancel_reason")) > 0)))),
    CONSTRAINT "orders_completed_paid" CHECK ((("status" <> 'completed'::"public"."order_status") OR ("payment_status" = 'verified'::"public"."payment_status"))),
    CONSTRAINT "orders_customer_name_check" CHECK ((("char_length"("btrim"("customer_name")) >= 1) AND ("char_length"("btrim"("customer_name")) <= 100))),
    CONSTRAINT "orders_customer_phone_check" CHECK (("customer_phone" ~ '^\+?[0-9]{8,15}$'::"text")),
    CONSTRAINT "orders_discount_check" CHECK (("discount" >= 0)),
    CONSTRAINT "orders_note_check" CHECK ((("note" IS NULL) OR ("char_length"("note") <= 500))),
    CONSTRAINT "orders_subtotal_check" CHECK (("subtotal" >= 0)),
    CONSTRAINT "orders_total_check" CHECK (("total" >= 0)),
    CONSTRAINT "orders_total_matches" CHECK (("total" = ("subtotal" - "discount")))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_order_ref"("o" "public"."orders") RETURNS "jsonb"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select jsonb_build_object(
    'order_id', o.id, 'order_number', o.order_number, 'access_token', o.access_token,
    'total', o.total, 'status', o.status, 'payment_status', o.payment_status,
    'expires_at', o.expires_at)
$$;


ALTER FUNCTION "public"."_order_ref"("o" "public"."orders") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_release_reservations"("p_order_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare r record;
begin
  for r in
    select product_id, qty from public.stock_reservations
    where order_id = p_order_id and status = 'active'
    order by product_id for update
  loop
    update public.stock_levels set reserved = reserved - r.qty where product_id = r.product_id;
  end loop;
  update public.stock_reservations set status = 'released', resolved_at = now()
  where order_id = p_order_id and status = 'active';
end $$;


ALTER FUNCTION "public"."_release_reservations"("p_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_reserve_stock"("p_order_id" "uuid", "p_expires" timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
    if not found or v_stock.on_hand - v_stock.reserved < r.qty then
      raise exception 'STOK_TIDAK_CUKUP' using detail = r.name;
    end if;
    update public.stock_levels set reserved = reserved + r.qty where product_id = r.product_id;
    insert into public.stock_reservations (order_id, product_id, qty, status, expires_at)
    values (p_order_id, r.product_id, r.qty, 'active', p_expires)
    on conflict (order_id, product_id) do update
      set status = 'active', qty = excluded.qty, expires_at = excluded.expires_at, resolved_at = null;
  end loop;
end $$;


ALTER FUNCTION "public"."_reserve_stock"("p_order_id" "uuid", "p_expires" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_setting_int"("p_key" "text", "p_default" integer) RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce((select (value #>> '{}')::int from public.store_settings where key = p_key), p_default)
$$;


ALTER FUNCTION "public"."_setting_int"("p_key" "text", "p_default" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."adjust_stock"("p_product_id" "uuid", "p_delta" integer, "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_stock public.stock_levels%rowtype; v_after int;
begin
  if not public.is_owner() then raise exception 'AKSES_DITOLAK' using errcode = '42501'; end if;
  if p_delta is null or p_delta = 0 then raise exception 'PERUBAHAN_STOK_TIDAK_VALID'; end if;
  p_reason := btrim(coalesce(p_reason, ''));
  if char_length(p_reason) < 3 then raise exception 'ALASAN_WAJIB'; end if;

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
  values (p_product_id, 'adjustment', p_delta, v_after, null, p_reason, auth.uid());
  perform public._audit('stock.adjusted', 'product', p_product_id::text,
    jsonb_build_object('delta', p_delta, 'on_hand_after', v_after, 'reason', p_reason));
  return jsonb_build_object('on_hand', v_after);
end $$;


ALTER FUNCTION "public"."adjust_stock"("p_product_id" "uuid", "p_delta" integer, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_role"() RETURNS "public"."user_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select role from public.profiles where id = auth.uid() and is_active
$$;


ALTER FUNCTION "public"."app_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_row_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  j_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  j_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
begin
  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), lower(tg_op), tg_table_name,
          coalesce(j_new->>'id', j_new->>'product_id', j_new->>'key',
                   j_old->>'id', j_old->>'product_id', j_old->>'key'),
          jsonb_build_object('old', j_old, 'new', j_new));
  return null;
end $$;


ALTER FUNCTION "public"."audit_row_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_order"("p_order_id" "uuid", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_order public.orders%rowtype;
begin
  if not public.is_staff() then raise exception 'AKSES_DITOLAK' using errcode = '42501'; end if;
  p_reason := btrim(coalesce(p_reason, ''));
  if char_length(p_reason) < 3 then raise exception 'ALASAN_WAJIB'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'PESANAN_TIDAK_DITEMUKAN'; end if;
  if v_order.payment_status = 'verified' then raise exception 'SUDAH_DIBAYAR_BUTUH_ALUR_REFUND'; end if;
  if v_order.status <> 'open' then raise exception 'PESANAN_TIDAK_AKTIF'; end if;

  perform public._cancel_open_order(v_order.id, p_reason, auth.uid());
  perform public._audit('order.cancelled', 'order', p_order_id::text,
    jsonb_build_object('order_number', v_order.order_number, 'reason', p_reason,
                       'payment_status_before', v_order.payment_status));
  return jsonb_build_object('status', 'cancelled');
end $$;


ALTER FUNCTION "public"."cancel_order"("p_order_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_order_by_token"("p_order_number" "text", "p_token" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_order public.orders%rowtype;
begin
  select * into v_order from public.orders
   where order_number = p_order_number and access_token = p_token for update;
  if not found then raise exception 'PESANAN_TIDAK_DITEMUKAN'; end if;
  if v_order.status <> 'open' or v_order.payment_status <> 'pending' then
    raise exception 'PESANAN_TIDAK_BISA_DIBATALKAN';
  end if;
  perform public._cancel_open_order(v_order.id,
          coalesce(nullif(left(btrim(coalesce(p_reason, '')), 200), ''), 'Dibatalkan pelanggan'), null);
  return jsonb_build_object('status', 'cancelled');
end $$;


ALTER FUNCTION "public"."cancel_order_by_token"("p_order_number" "text", "p_token" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_payment"("p_order_number" "text", "p_token" "text", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_order public.orders%rowtype; v_pay public.payments%rowtype;
begin
  select * into v_order from public.orders
   where order_number = p_order_number and access_token = p_token for update;
  if not found then raise exception 'PESANAN_TIDAK_DITEMUKAN'; end if;
  if v_order.payment_status = 'verified' then
    return jsonb_build_object('payment_status', 'verified');
  end if;
  -- 'expired' diizinkan: pelanggan mungkin membayar terlambat; petugas yang memutuskan.
  if v_order.status not in ('open', 'expired') then raise exception 'PESANAN_TIDAK_AKTIF'; end if;

  select * into v_pay from public.payments
   where order_id = v_order.id and status in ('pending', 'claimed') for update;
  if not found then raise exception 'PEMBAYARAN_TIDAK_DITEMUKAN'; end if;
  if v_pay.status = 'claimed' then return jsonb_build_object('payment_status', 'claimed'); end if;

  update public.payments
     set status = 'claimed', claimed_at = now(), customer_note = nullif(left(btrim(coalesce(p_note, '')), 300), '')
   where id = v_pay.id;
  update public.orders set payment_status = 'claimed' where id = v_order.id;
  return jsonb_build_object('payment_status', 'claimed');
end $$;


ALTER FUNCTION "public"."claim_payment"("p_order_number" "text", "p_token" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_order"("p_items" "jsonb", "p_customer_name" "text", "p_customer_phone" "text", "p_note" "text" DEFAULT NULL::"text", "p_idempotency_key" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_order public.orders%rowtype;
  v_item jsonb; v_qty int; v_count int;
  v_expiry int; v_max_open int; v_subtotal bigint;
begin
  if p_idempotency_key is not null then
    select * into v_order from public.orders where idempotency_key = p_idempotency_key;
    if found then return public._order_ref(v_order); end if;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'KERANJANG_KOSONG';
  end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'KERANJANG_TERLALU_BESAR'; end if;

  p_customer_name  := btrim(coalesce(p_customer_name, ''));
  p_customer_phone := regexp_replace(btrim(coalesce(p_customer_phone, '')), '[\s\-]', '', 'g');
  if char_length(p_customer_name) not between 1 and 100 then raise exception 'NAMA_TIDAK_VALID'; end if;
  if p_customer_phone !~ '^\+?[0-9]{8,15}$' then raise exception 'NOMOR_HP_TIDAK_VALID'; end if;
  p_note := nullif(left(btrim(coalesce(p_note, '')), 500), '');

  for v_item in select e from jsonb_array_elements(p_items) e loop
    if jsonb_typeof(v_item) <> 'object'
       or coalesce(v_item->>'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(v_item->>'qty', '') !~ '^[0-9]{1,2}$' then
      raise exception 'ITEM_TIDAK_VALID';
    end if;
    v_qty := (v_item->>'qty')::int;
    if v_qty < 1 then raise exception 'ITEM_TIDAK_VALID'; end if;
  end loop;

  perform public.expire_stale_orders();   -- bebaskan stok dari pesanan kedaluwarsa

  v_max_open := public._setting_int('max_open_orders_per_phone', 3);
  select count(*) into v_count from public.orders
   where customer_phone = p_customer_phone and status = 'open' and payment_status = 'pending';
  if v_count >= v_max_open then raise exception 'TERLALU_BANYAK_PESANAN_TERBUKA'; end if;

  v_expiry := public._setting_int('order_expiry_minutes', 30);
  insert into public.orders (customer_name, customer_phone, note, subtotal, total, expires_at, idempotency_key)
  values (p_customer_name, p_customer_phone, p_note, 0, 0, now() + make_interval(mins => v_expiry), p_idempotency_key)
  on conflict (idempotency_key) do nothing
  returning * into v_order;

  if not found then   -- permintaan ganda yang bersamaan
    select * into v_order from public.orders where idempotency_key = p_idempotency_key;
    return public._order_ref(v_order);
  end if;

  insert into public.order_items (order_id, product_id, product_name, unit_price, qty, line_total)
  select v_order.id, p.id, p.name, p.price, i.qty, p.price * i.qty
  from (select (e->>'product_id')::uuid as product_id, sum((e->>'qty')::int)::int as qty
        from jsonb_array_elements(p_items) e group by 1) i
  join public.products p on p.id = i.product_id and p.is_active;

  get diagnostics v_count = row_count;
  if v_count <> (select count(distinct (e->>'product_id')::uuid) from jsonb_array_elements(p_items) e) then
    raise exception 'PRODUK_TIDAK_TERSEDIA';
  end if;

  select coalesce(sum(line_total), 0) into v_subtotal from public.order_items where order_id = v_order.id;
  update public.orders set subtotal = v_subtotal, total = v_subtotal
   where id = v_order.id returning * into v_order;

  perform public._reserve_stock(v_order.id, v_order.expires_at);   -- gagal = semua dibatalkan
  insert into public.payments (order_id, amount) values (v_order.id, v_order.total);

  return public._order_ref(v_order);
end $_$;


ALTER FUNCTION "public"."create_order"("p_items" "jsonb", "p_customer_name" "text", "p_customer_phone" "text", "p_note" "text", "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_stale_orders"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare r record; n int := 0;
begin
  for r in
    select id from public.orders
    where status = 'open' and payment_status = 'pending'
      and expires_at is not null and expires_at < now()
    order by id for update skip locked
  loop
    perform public._release_reservations(r.id);
    update public.orders
       set status = 'expired', cancelled_at = now(),
           cancel_reason = 'Kedaluwarsa otomatis: pembayaran tidak diterima sebelum batas waktu'
     where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;


ALTER FUNCTION "public"."expire_stale_orders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_order_by_token"("p_order_number" "text", "p_token" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."get_order_by_token"("p_order_number" "text", "p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."init_stock_level"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.stock_levels (product_id) values (new.id) on conflict do nothing;
  return new;
end $$;


ALTER FUNCTION "public"."init_stock_level"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_owner"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(public.app_role() = 'owner', false)
$$;


ALTER FUNCTION "public"."is_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.app_role() is not null
$$;


ALTER FUNCTION "public"."is_staff"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."issue_receipt"("p_order_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_order public.orders%rowtype; v_receipt public.receipts%rowtype;
begin
  if not public.is_staff() then raise exception 'AKSES_DITOLAK' using errcode = '42501'; end if;
  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception 'PESANAN_TIDAK_DITEMUKAN'; end if;
  if v_order.payment_status <> 'verified' then raise exception 'BELUM_LUNAS'; end if;

  insert into public.receipts (order_id, issued_by) values (p_order_id, auth.uid())
  on conflict (order_id) do nothing;
  select * into v_receipt from public.receipts where order_id = p_order_id;
  return jsonb_build_object('receipt_number', v_receipt.receipt_number, 'issued_at', v_receipt.issued_at);
end $$;


ALTER FUNCTION "public"."issue_receipt"("p_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_payment_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    insert into public.payment_status_history (payment_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.payment_status_history (payment_id, from_status, to_status, changed_by, note)
    values (new.id, old.status, new.status, auth.uid(),
            case new.status when 'rejected' then new.rejected_reason
                            when 'claimed'  then new.customer_note end);
  end if;
  return null;
end $$;


ALTER FUNCTION "public"."log_payment_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purchase_items_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_status public.purchase_status; v_pid uuid;
begin
  if coalesce(current_setting('app.rpc', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  v_pid := case when tg_op = 'DELETE' then old.purchase_id else new.purchase_id end;
  select status into v_status from public.purchases where id = v_pid;
  if tg_op = 'DELETE' and v_status is null then return old; end if;   -- hapus berantai dari draf
  if v_status is distinct from 'draft' then raise exception 'PEMBELIAN_TIDAK_BISA_DIUBAH'; end if;
  if tg_op = 'UPDATE' and new.purchase_id <> old.purchase_id then raise exception 'PEMBELIAN_TIDAK_BISA_DIUBAH'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;


ALTER FUNCTION "public"."purchase_items_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purchases_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if coalesce(current_setting('app.rpc', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'PEMBELIAN_TIDAK_BISA_DIUBAH'; end if;
    return old;
  elsif tg_op = 'INSERT' then
    if new.status <> 'draft' then raise exception 'PEMBELIAN_HARUS_DRAF'; end if;
    new.received_at := null; new.received_by := null;
    return new;
  else
    if old.status <> 'draft' then raise exception 'PEMBELIAN_TIDAK_BISA_DIUBAH'; end if;
    if new.status = 'received' then raise exception 'GUNAKAN_RECEIVE_PURCHASE'; end if;
    new.received_at := null; new.received_by := null;
    return new;
  end if;
end $$;


ALTER FUNCTION "public"."purchases_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."receive_purchase"("p_purchase_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_purchase public.purchases%rowtype; r record; v_after int;
begin
  if not public.is_owner() then raise exception 'AKSES_DITOLAK' using errcode = '42501'; end if;
  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if not found then raise exception 'PEMBELIAN_TIDAK_DITEMUKAN'; end if;
  if v_purchase.status <> 'draft' then raise exception 'PEMBELIAN_BUKAN_DRAF'; end if;
  if not exists (select 1 from public.purchase_items where purchase_id = p_purchase_id) then
    raise exception 'PEMBELIAN_KOSONG';
  end if;

  perform set_config('app.rpc', 'on', true);   -- berlaku hanya dalam transaksi ini

  for r in
    select product_id, qty, unit_cost from public.purchase_items
    where purchase_id = p_purchase_id order by product_id
  loop
    update public.stock_levels set on_hand = on_hand + r.qty
     where product_id = r.product_id returning on_hand into v_after;
    insert into public.stock_movements
      (product_id, movement_type, qty_change, on_hand_after, reference_type, reference_id, created_by)
    values (r.product_id, 'purchase_receipt', r.qty, v_after, 'purchase', p_purchase_id, auth.uid());
    insert into public.product_costs (product_id, cost_price) values (r.product_id, r.unit_cost)
    on conflict (product_id) do update set cost_price = excluded.cost_price;
  end loop;

  update public.purchases
     set status = 'received', received_by = auth.uid(), received_at = now()
   where id = p_purchase_id;
  perform public._audit('purchase.received', 'purchase', p_purchase_id::text, null);
  return jsonb_build_object('status', 'received');
end $$;


ALTER FUNCTION "public"."receive_purchase"("p_purchase_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_payment"("p_payment_id" "uuid", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."reject_payment"("p_payment_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_summary"("p_from" "date", "p_to" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."report_summary"("p_from" "date", "p_to" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_fulfillment_status"("p_order_id" "uuid", "p_status" "public"."fulfillment_status") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_order public.orders%rowtype;
begin
  if not public.is_staff() then raise exception 'AKSES_DITOLAK' using errcode = '42501'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'PESANAN_TIDAK_DITEMUKAN'; end if;
  if v_order.status <> 'open' then raise exception 'PESANAN_TIDAK_AKTIF'; end if;
  if v_order.payment_status <> 'verified' then raise exception 'BELUM_TERVERIFIKASI'; end if;

  update public.orders
     set fulfillment_status = p_status,
         status       = case when p_status = 'picked_up' then 'completed'::public.order_status else status end,
         completed_at = case when p_status = 'picked_up' then now() else completed_at end
   where id = p_order_id;
  perform public._audit('order.fulfillment', 'order', p_order_id::text,
    jsonb_build_object('order_number', v_order.order_number, 'to', p_status));
  return jsonb_build_object('fulfillment_status', p_status);
end $$;


ALTER FUNCTION "public"."set_fulfillment_status"("p_order_id" "uuid", "p_status" "public"."fulfillment_status") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end $$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."snapshot_item_costs"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status = 'verified' and old.status is distinct from 'verified' then
    update public.order_items oi
       set unit_cost = pc.cost_price
      from public.product_costs pc
     where oi.order_id = new.order_id and pc.product_id = oi.product_id and oi.unit_cost is null;
  end if;
  return null;
end $$;


ALTER FUNCTION "public"."snapshot_item_costs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_payment"("p_payment_id" "uuid", "p_reference" "text", "p_amount_received" bigint, "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_pay public.payments%rowtype; v_order public.orders%rowtype;
  r record; v_after int;
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
    values (r.product_id, 'sale', -r.qty, v_after, 'order', v_order.id, v_order.order_number, auth.uid());
  end loop;

  update public.stock_reservations set status = 'consumed', resolved_at = now()
   where order_id = v_order.id and status = 'active';
  update public.orders set payment_status = 'verified' where id = v_order.id;

  perform public._audit('payment.verified', 'payment', p_payment_id::text,
    jsonb_build_object('order_number', v_order.order_number, 'reference', p_reference,
                       'amount', v_pay.amount, 'note', p_note));
  return jsonb_build_object('payment_status', 'verified', 'order_number', v_order.order_number);
end $$;


ALTER FUNCTION "public"."verify_payment"("p_payment_id" "uuid", "p_reference" "text", "p_amount_received" bigint, "p_note" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" bigint NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text",
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


ALTER TABLE "public"."audit_log" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid",
    "sku" "text",
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "price" bigint NOT NULL,
    "unit" "text" DEFAULT 'pcs'::"text" NOT NULL,
    "image_path" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "products_name_check" CHECK ((("char_length"("btrim"("name")) >= 1) AND ("char_length"("btrim"("name")) <= 150))),
    CONSTRAINT "products_price_check" CHECK (("price" >= 0))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_levels" (
    "product_id" "uuid" NOT NULL,
    "on_hand" integer DEFAULT 0 NOT NULL,
    "reserved" integer DEFAULT 0 NOT NULL,
    "low_stock_threshold" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stock_levels_low_stock_threshold_check" CHECK (("low_stock_threshold" >= 0)),
    CONSTRAINT "stock_levels_on_hand_check" CHECK (("on_hand" >= 0)),
    CONSTRAINT "stock_levels_reserved_check" CHECK (("reserved" >= 0)),
    CONSTRAINT "stock_reserved_within_on_hand" CHECK (("reserved" <= "on_hand"))
);


ALTER TABLE "public"."stock_levels" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."catalog_products" AS
 SELECT "p"."id",
    "p"."category_id",
    "p"."name",
    "p"."slug",
    "p"."description",
    "p"."price",
    "p"."unit",
    "p"."image_path",
    GREATEST(("s"."on_hand" - "s"."reserved"), 0) AS "available"
   FROM ("public"."products" "p"
     JOIN "public"."stock_levels" "s" ON (("s"."product_id" = "p"."id")))
  WHERE "p"."is_active";


ALTER VIEW "public"."catalog_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "categories_name_check" CHECK ((("char_length"("btrim"("name")) >= 1) AND ("char_length"("btrim"("name")) <= 80)))
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "product_name" "text" NOT NULL,
    "unit_price" bigint NOT NULL,
    "qty" integer NOT NULL,
    "line_total" bigint NOT NULL,
    "unit_cost" bigint,
    CONSTRAINT "order_items_line_total" CHECK (("line_total" = ("unit_price" * "qty"))),
    CONSTRAINT "order_items_line_total_check" CHECK (("line_total" >= 0)),
    CONSTRAINT "order_items_qty_check" CHECK (("qty" > 0)),
    CONSTRAINT "order_items_unit_cost_check" CHECK ((("unit_cost" IS NULL) OR ("unit_cost" >= 0))),
    CONSTRAINT "order_items_unit_price_check" CHECK (("unit_price" >= 0))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_status_history" (
    "id" bigint NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "from_status" "public"."payment_status",
    "to_status" "public"."payment_status" NOT NULL,
    "changed_by" "uuid",
    "note" "text",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payment_status_history" OWNER TO "postgres";


ALTER TABLE "public"."payment_status_history" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."payment_status_history_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "provider" "text" DEFAULT 'manual'::"text" NOT NULL,
    "method" "text" DEFAULT 'qris_static'::"text" NOT NULL,
    "amount" bigint NOT NULL,
    "status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status" NOT NULL,
    "provider_reference" "text",
    "customer_note" "text",
    "claimed_at" timestamp with time zone,
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "rejected_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payments_amount_check" CHECK (("amount" > 0)),
    CONSTRAINT "payments_verified_has_time" CHECK ((("status" <> 'verified'::"public"."payment_status") OR ("verified_at" IS NOT NULL)))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_costs" (
    "product_id" "uuid" NOT NULL,
    "cost_price" bigint NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_costs_cost_price_check" CHECK (("cost_price" >= 0))
);


ALTER TABLE "public"."product_costs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "role" "public"."user_role" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_full_name_check" CHECK ((("char_length"("btrim"("full_name")) >= 1) AND ("char_length"("btrim"("full_name")) <= 100)))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "qty" integer NOT NULL,
    "unit_cost" bigint NOT NULL,
    CONSTRAINT "purchase_items_qty_check" CHECK (("qty" > 0)),
    CONSTRAINT "purchase_items_unit_cost_check" CHECK (("unit_cost" >= 0))
);


ALTER TABLE "public"."purchase_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid",
    "status" "public"."purchase_status" DEFAULT 'draft'::"public"."purchase_status" NOT NULL,
    "purchase_date" "date" DEFAULT (("now"() AT TIME ZONE 'Asia/Jakarta'::"text"))::"date" NOT NULL,
    "note" "text",
    "created_by" "uuid",
    "received_by" "uuid",
    "received_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "purchases_received_has_time" CHECK ((("status" <> 'received'::"public"."purchase_status") OR ("received_at" IS NOT NULL)))
);


ALTER TABLE "public"."purchases" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."receipt_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."receipt_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "receipt_number" "text" DEFAULT ((('STR-'::"text" || "to_char"(("now"() AT TIME ZONE 'Asia/Jakarta'::"text"), 'YYMMDD'::"text")) || '-'::"text") || "lpad"(("nextval"('"public"."receipt_number_seq"'::"regclass"))::"text", 5, '0'::"text")) NOT NULL,
    "order_id" "uuid" NOT NULL,
    "issued_by" "uuid",
    "issued_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."receipts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_movements" (
    "id" bigint NOT NULL,
    "product_id" "uuid" NOT NULL,
    "movement_type" "public"."stock_movement_type" NOT NULL,
    "qty_change" integer NOT NULL,
    "on_hand_after" integer NOT NULL,
    "reference_type" "text",
    "reference_id" "uuid",
    "note" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stock_movements_on_hand_after_check" CHECK (("on_hand_after" >= 0)),
    CONSTRAINT "stock_movements_qty_change_check" CHECK (("qty_change" <> 0))
);


ALTER TABLE "public"."stock_movements" OWNER TO "postgres";


ALTER TABLE "public"."stock_movements" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."stock_movements_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."stock_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "qty" integer NOT NULL,
    "status" "public"."reservation_status" DEFAULT 'active'::"public"."reservation_status" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "stock_reservations_qty_check" CHECK (("qty" > 0))
);


ALTER TABLE "public"."stock_reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "is_public" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."store_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "address" "text",
    "note" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "suppliers_name_check" CHECK ((("char_length"("btrim"("name")) >= 1) AND ("char_length"("btrim"("name")) <= 150)))
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_product_id_key" UNIQUE ("order_id", "product_id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_access_token_key" UNIQUE ("access_token");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_status_history"
    ADD CONSTRAINT "payment_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_costs"
    ADD CONSTRAINT "product_costs_pkey" PRIMARY KEY ("product_id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_sku_key" UNIQUE ("sku");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_purchase_id_product_id_key" UNIQUE ("purchase_id", "product_id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receipts"
    ADD CONSTRAINT "receipts_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."receipts"
    ADD CONSTRAINT "receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receipts"
    ADD CONSTRAINT "receipts_receipt_number_key" UNIQUE ("receipt_number");



ALTER TABLE ONLY "public"."stock_levels"
    ADD CONSTRAINT "stock_levels_pkey" PRIMARY KEY ("product_id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_reservations"
    ADD CONSTRAINT "stock_reservations_order_id_product_id_key" UNIQUE ("order_id", "product_id");



ALTER TABLE ONLY "public"."stock_reservations"
    ADD CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_settings"
    ADD CONSTRAINT "store_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



CREATE INDEX "audit_log_created_idx" ON "public"."audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "audit_log_entity_idx" ON "public"."audit_log" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "orders_expiry_idx" ON "public"."orders" USING "btree" ("expires_at") WHERE (("status" = 'open'::"public"."order_status") AND ("payment_status" = 'pending'::"public"."payment_status"));



CREATE INDEX "orders_phone_idx" ON "public"."orders" USING "btree" ("customer_phone");



CREATE INDEX "orders_status_idx" ON "public"."orders" USING "btree" ("status", "payment_status", "created_at" DESC);



CREATE INDEX "payment_history_idx" ON "public"."payment_status_history" USING "btree" ("payment_id", "changed_at");



CREATE UNIQUE INDEX "payments_one_open_per_order" ON "public"."payments" USING "btree" ("order_id") WHERE ("status" = ANY (ARRAY['pending'::"public"."payment_status", 'claimed'::"public"."payment_status"]));



CREATE UNIQUE INDEX "payments_one_verified_per_order" ON "public"."payments" USING "btree" ("order_id") WHERE ("status" = 'verified'::"public"."payment_status");



CREATE INDEX "payments_order_idx" ON "public"."payments" USING "btree" ("order_id");



CREATE UNIQUE INDEX "payments_reference_unique" ON "public"."payments" USING "btree" ("provider", "provider_reference") WHERE (("status" = 'verified'::"public"."payment_status") AND ("provider_reference" IS NOT NULL));



CREATE INDEX "products_category_idx" ON "public"."products" USING "btree" ("category_id");



CREATE INDEX "stock_movements_product_idx" ON "public"."stock_movements" USING "btree" ("product_id", "created_at" DESC);



CREATE INDEX "stock_movements_ref_idx" ON "public"."stock_movements" USING "btree" ("reference_type", "reference_id");



CREATE INDEX "stock_reservations_active_idx" ON "public"."stock_reservations" USING "btree" ("expires_at") WHERE ("status" = 'active'::"public"."reservation_status");



CREATE OR REPLACE TRIGGER "audit_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."product_costs" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."store_settings" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "audit_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."audit_row_change"();



CREATE OR REPLACE TRIGGER "payments_log_status" AFTER INSERT OR UPDATE OF "status" ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."log_payment_status"();



CREATE OR REPLACE TRIGGER "payments_snapshot_costs" AFTER UPDATE OF "status" ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."snapshot_item_costs"();



CREATE OR REPLACE TRIGGER "products_init_stock" AFTER INSERT ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."init_stock_level"();



CREATE OR REPLACE TRIGGER "purchase_items_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."purchase_items" FOR EACH ROW EXECUTE FUNCTION "public"."purchase_items_guard"();



CREATE OR REPLACE TRIGGER "purchases_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."purchases" FOR EACH ROW EXECUTE FUNCTION "public"."purchases_guard"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."product_costs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."purchases" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."stock_levels" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."store_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payment_status_history"
    ADD CONSTRAINT "payment_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payment_status_history"
    ADD CONSTRAINT "payment_status_history_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_costs"
    ADD CONSTRAINT "product_costs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."receipts"
    ADD CONSTRAINT "receipts_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receipts"
    ADD CONSTRAINT "receipts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."stock_levels"
    ADD CONSTRAINT "stock_levels_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."stock_reservations"
    ADD CONSTRAINT "stock_reservations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."stock_reservations"
    ADD CONSTRAINT "stock_reservations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_select_owner" ON "public"."audit_log" FOR SELECT TO "authenticated" USING ("public"."is_owner"());



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_owner_write" ON "public"."categories" TO "authenticated" USING ("public"."is_owner"()) WITH CHECK ("public"."is_owner"());



CREATE POLICY "categories_select" ON "public"."categories" FOR SELECT TO "authenticated", "anon" USING (("is_active" OR "public"."is_staff"()));



ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_items_select" ON "public"."order_items" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orders_select" ON "public"."orders" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "payment_history_select" ON "public"."payment_status_history" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



ALTER TABLE "public"."payment_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_select" ON "public"."payments" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



ALTER TABLE "public"."product_costs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_costs_owner" ON "public"."product_costs" TO "authenticated" USING ("public"."is_owner"()) WITH CHECK ("public"."is_owner"());



ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_owner_write" ON "public"."products" TO "authenticated" USING ("public"."is_owner"()) WITH CHECK ("public"."is_owner"());



CREATE POLICY "products_select_staff" ON "public"."products" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_owner_write" ON "public"."profiles" TO "authenticated" USING ("public"."is_owner"()) WITH CHECK ("public"."is_owner"());



CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."is_owner"()));



ALTER TABLE "public"."purchase_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "purchase_items_owner" ON "public"."purchase_items" TO "authenticated" USING ("public"."is_owner"()) WITH CHECK ("public"."is_owner"());



ALTER TABLE "public"."purchases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "purchases_owner" ON "public"."purchases" TO "authenticated" USING ("public"."is_owner"()) WITH CHECK ("public"."is_owner"());



ALTER TABLE "public"."receipts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "receipts_select" ON "public"."receipts" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "settings_owner_write" ON "public"."store_settings" TO "authenticated" USING ("public"."is_owner"()) WITH CHECK ("public"."is_owner"());



CREATE POLICY "settings_select" ON "public"."store_settings" FOR SELECT TO "authenticated", "anon" USING (("is_public" OR "public"."is_owner"()));



ALTER TABLE "public"."stock_levels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_levels_select" ON "public"."stock_levels" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



ALTER TABLE "public"."stock_movements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_movements_select" ON "public"."stock_movements" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



ALTER TABLE "public"."stock_reservations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_reservations_select" ON "public"."stock_reservations" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



ALTER TABLE "public"."store_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "suppliers_owner" ON "public"."suppliers" TO "authenticated" USING ("public"."is_owner"()) WITH CHECK ("public"."is_owner"());



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."_audit"("p_action" "text", "p_entity_type" "text", "p_entity_id" "text", "p_details" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_audit"("p_action" "text", "p_entity_type" "text", "p_entity_id" "text", "p_details" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_cancel_open_order"("p_order_id" "uuid", "p_reason" "text", "p_actor" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_cancel_open_order"("p_order_id" "uuid", "p_reason" "text", "p_actor" "uuid") TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_number_seq" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



REVOKE ALL ON FUNCTION "public"."_order_ref"("o" "public"."orders") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_order_ref"("o" "public"."orders") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_release_reservations"("p_order_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_release_reservations"("p_order_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_reserve_stock"("p_order_id" "uuid", "p_expires" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_reserve_stock"("p_order_id" "uuid", "p_expires" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."_setting_int"("p_key" "text", "p_default" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_setting_int"("p_key" "text", "p_default" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."adjust_stock"("p_product_id" "uuid", "p_delta" integer, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."adjust_stock"("p_product_id" "uuid", "p_delta" integer, "p_reason" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."adjust_stock"("p_product_id" "uuid", "p_delta" integer, "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."app_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."app_role"() TO "service_role";
GRANT ALL ON FUNCTION "public"."app_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."app_role"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."audit_row_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."audit_row_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_order"("p_order_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_order"("p_order_id" "uuid", "p_reason" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."cancel_order"("p_order_id" "uuid", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."cancel_order_by_token"("p_order_number" "text", "p_token" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_order_by_token"("p_order_number" "text", "p_token" "text", "p_reason" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."cancel_order_by_token"("p_order_number" "text", "p_token" "text", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_order_by_token"("p_order_number" "text", "p_token" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."claim_payment"("p_order_number" "text", "p_token" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_payment"("p_order_number" "text", "p_token" "text", "p_note" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."claim_payment"("p_order_number" "text", "p_token" "text", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_payment"("p_order_number" "text", "p_token" "text", "p_note" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_order"("p_items" "jsonb", "p_customer_name" "text", "p_customer_phone" "text", "p_note" "text", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_order"("p_items" "jsonb", "p_customer_name" "text", "p_customer_phone" "text", "p_note" "text", "p_idempotency_key" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_order"("p_items" "jsonb", "p_customer_name" "text", "p_customer_phone" "text", "p_note" "text", "p_idempotency_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_order"("p_items" "jsonb", "p_customer_name" "text", "p_customer_phone" "text", "p_note" "text", "p_idempotency_key" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."expire_stale_orders"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expire_stale_orders"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_order_by_token"("p_order_number" "text", "p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_order_by_token"("p_order_number" "text", "p_token" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_order_by_token"("p_order_number" "text", "p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_order_by_token"("p_order_number" "text", "p_token" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."init_stock_level"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."init_stock_level"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_owner"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_owner"() TO "service_role";
GRANT ALL ON FUNCTION "public"."is_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_owner"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_staff"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_staff"() TO "service_role";
GRANT ALL ON FUNCTION "public"."is_staff"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_staff"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."issue_receipt"("p_order_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."issue_receipt"("p_order_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."issue_receipt"("p_order_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."log_payment_status"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_payment_status"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."purchase_items_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."purchase_items_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."purchases_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."purchases_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."receive_purchase"("p_purchase_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."receive_purchase"("p_purchase_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."receive_purchase"("p_purchase_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."reject_payment"("p_payment_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reject_payment"("p_payment_id" "uuid", "p_reason" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."reject_payment"("p_payment_id" "uuid", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."report_summary"("p_from" "date", "p_to" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."report_summary"("p_from" "date", "p_to" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_summary"("p_from" "date", "p_to" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_fulfillment_status"("p_order_id" "uuid", "p_status" "public"."fulfillment_status") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_fulfillment_status"("p_order_id" "uuid", "p_status" "public"."fulfillment_status") TO "service_role";
GRANT ALL ON FUNCTION "public"."set_fulfillment_status"("p_order_id" "uuid", "p_status" "public"."fulfillment_status") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."snapshot_item_costs"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."snapshot_item_costs"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."verify_payment"("p_payment_id" "uuid", "p_reference" "text", "p_amount_received" bigint, "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verify_payment"("p_payment_id" "uuid", "p_reference" "text", "p_amount_received" bigint, "p_note" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."verify_payment"("p_payment_id" "uuid", "p_reference" "text", "p_amount_received" bigint, "p_note" "text") TO "authenticated";



GRANT SELECT,MAINTAIN ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."stock_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_levels" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."catalog_products" TO "authenticated";
GRANT ALL ON TABLE "public"."catalog_products" TO "service_role";
GRANT SELECT ON TABLE "public"."catalog_products" TO "anon";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";
GRANT SELECT ON TABLE "public"."categories" TO "anon";



GRANT SELECT,MAINTAIN ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."payment_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_status_history" TO "service_role";



GRANT ALL ON SEQUENCE "public"."payment_status_history_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."payment_status_history_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."payment_status_history_id_seq" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."product_costs" TO "authenticated";
GRANT ALL ON TABLE "public"."product_costs" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."purchase_items" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_items" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."purchases" TO "service_role";



GRANT ALL ON SEQUENCE "public"."receipt_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."receipt_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."receipt_number_seq" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."receipts" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_movements" TO "service_role";



GRANT ALL ON SEQUENCE "public"."stock_movements_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."stock_movements_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."stock_movements_id_seq" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."stock_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_reservations" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."store_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."store_settings" TO "service_role";
GRANT SELECT ON TABLE "public"."store_settings" TO "anon";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







