import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { one, rupiah } from "@/lib/format";
import { addDays, formatDateTime, isYmd, startOfDayISO, todayJakarta } from "@/lib/dates";
import { inputClass, buttonClass } from "@/components/admin/form-ui";

type SP = Promise<{ from?: string; to?: string }>;
type Row = {
  id: string; amount: number; verified_at: string; provider_reference: string | null;
  orders: { id: string; order_number: string; customer_name: string } | { id: string; order_number: string; customer_name: string }[] | null;
};

export default function TransactionsPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Memuat…</p>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const today = todayJakarta();
  let from = isYmd(sp.from) ? sp.from : addDays(today, -6);
  let to = isYmd(sp.to) ? sp.to : today;
  if (to < from) [from, to] = [to, from];
  if (addDays(from, 92) < to) from = addDays(to, -92); // batasi rentang 93 hari

  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("id, amount, verified_at, provider_reference, orders(id, order_number, customer_name)")
    .eq("status", "verified")
    .gte("verified_at", startOfDayISO(from))
    .lt("verified_at", startOfDayISO(addDays(to, 1)))
    .order("verified_at", { ascending: false })
    .limit(300);
  const rows = (data ?? []) as unknown as Row[];
  const total = rows.reduce((n, r) => n + r.amount, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Riwayat transaksi</h1>
        <p className="text-sm text-slate-500">Hanya pembayaran yang sudah terverifikasi.</p>
      </div>
      <form action="/admin/transactions" className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-sm">Dari<input type="date" name="from" defaultValue={from} className={inputClass} /></label>
        <label className="space-y-1 text-sm">Sampai<input type="date" name="to" defaultValue={to} className={inputClass} /></label>
        <button type="submit" className={buttonClass.secondary}>Tampilkan</button>
      </form>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">{rows.length} transaksi</p>
        <p className="text-2xl font-bold">{rupiah(total)}</p>
        {rows.length >= 300 ? <p className="text-xs text-amber-700">Hanya 300 transaksi terbaru yang ditampilkan. Persempit rentang tanggal.</p> : null}
      </div>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {rows.length === 0 ? <li className="p-4 text-sm text-slate-500">Tidak ada transaksi.</li> : null}
        {rows.map((r) => {
          const o = one(r.orders);
          return (
            <li key={r.id}>
              <Link href={o ? `/admin/orders/${o.id}` : "#"} className="flex items-center justify-between gap-3 p-3 hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="font-medium">{o?.order_number}</p>
                  <p className="truncate text-xs text-slate-500">{o?.customer_name} · {formatDateTime(r.verified_at)}{r.provider_reference ? ` · ref ${r.provider_reference}` : ""}</p>
                </div>
                <p className="shrink-0 font-semibold">{rupiah(r.amount)}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
