import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { rupiah } from "@/lib/format";
import { formatDateTime } from "@/lib/dates";
import { fulfillmentLabel, orderStatusLabel, paymentLabel } from "@/lib/labels";
import { Badge, orderTone, paymentTone } from "@/components/admin/badge";

type SP = Promise<{ tab?: string; q?: string }>;
type Row = {
  id: string; order_number: string; customer_name: string; customer_phone: string; total: number;
  status: string; payment_status: string; fulfillment_status: string; created_at: string;
};

const TABS = [
  { key: "prepare", label: "Perlu disiapkan" },
  { key: "unpaid", label: "Menunggu bayar" },
  { key: "done", label: "Selesai" },
  { key: "closed", label: "Batal / kedaluwarsa" },
] as const;

export default function OrdersPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Memuat…</p>}>
      <List searchParams={searchParams} />
    </Suspense>
  );
}

async function List({ searchParams }: { searchParams: SP }) {
  const { tab: rawTab, q } = await searchParams;
  const tab = TABS.some((t) => t.key === rawTab) ? rawTab! : "prepare";
  const term = (q ?? "").replace(/[%_\\,()*]/g, " ").trim().slice(0, 40);

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("id, order_number, customer_name, customer_phone, total, status, payment_status, fulfillment_status, created_at")
    .order("created_at", { ascending: false })
    .limit(60);
  if (tab === "prepare") query = query.eq("status", "open").eq("payment_status", "verified");
  else if (tab === "unpaid") query = query.eq("status", "open").in("payment_status", ["pending", "claimed"]);
  else if (tab === "done") query = query.eq("status", "completed");
  else query = query.in("status", ["cancelled", "expired"]);
  if (term) query = query.or(`order_number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%`);
  const { data } = await query;
  const orders = (data ?? []) as Row[];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Pesanan</h1>
      <nav className="-mx-4 overflow-x-auto px-4" aria-label="Filter pesanan">
        <ul className="flex gap-2">
          {TABS.map((t) => (
            <li key={t.key}>
              <Link href={`/admin/orders?tab=${t.key}`} className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full border px-4 text-sm ${
                tab === t.key ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white text-slate-700"}`}>
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <form action="/admin/orders" className="flex gap-2">
        <input type="hidden" name="tab" value={tab} />
        <input name="q" type="search" defaultValue={term} placeholder="Cari nomor, nama, atau HP…" aria-label="Cari pesanan"
          className="block w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-base" />
        <button type="submit" className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium">Cari</button>
      </form>

      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Tidak ada pesanan.</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/orders/${o.id}`} className="block space-y-1.5 rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{o.order_number}</p>
                  <p className="font-medium">{rupiah(o.total)}</p>
                </div>
                <p className="text-sm text-slate-600">{o.customer_name} · {o.customer_phone}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={orderTone(o.status)}>{orderStatusLabel[o.status]}</Badge>
                  <Badge tone={paymentTone(o.payment_status)}>{paymentLabel[o.payment_status]}</Badge>
                  {o.payment_status === "verified" && o.status === "open" ? <Badge tone="wait">{fulfillmentLabel[o.fulfillment_status]}</Badge> : null}
                  <span className="text-xs text-slate-500">{formatDateTime(o.created_at)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
