import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";
import { rupiah } from "@/lib/format";
import { addDays, firstOfMonth, isYmd, todayJakarta } from "@/lib/dates";
import { rpcMessage } from "@/lib/rpc-errors";
import { buttonClass, inputClass } from "@/components/admin/form-ui";

type SP = Promise<{ from?: string; to?: string }>;
type Summary = {
  orders_created: number; orders_created_value: number; orders_cancelled: number; orders_unpaid_open: number;
  verified_count: number; verified_total: number; items_sold: number;
  revenue_with_cost: number; cogs: number; items_missing_cost: number;
  daily: { date: string; count: number; total: number }[];
  top_products: { name: string; qty: number; revenue: number }[];
};

export default function ReportsPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Memuat laporan…</p>}>
      <Report searchParams={searchParams} />
    </Suspense>
  );
}

async function Report({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const staff = await getStaff();
  if (staff?.role !== "owner") redirect("/admin");

  const today = todayJakarta();
  let from = isYmd(sp.from) ? sp.from : firstOfMonth(today);
  let to = isYmd(sp.to) ? sp.to : today;
  if (to < from) [from, to] = [to, from];
  if (addDays(from, 366) < to) from = addDays(to, -366);

  const { data, error } = await (await createClient()).rpc("report_summary", { p_from: from, p_to: to });
  const s = data as Summary | null;

  const grossProfit = s ? s.revenue_with_cost - s.cogs : 0;
  const margin = s && s.revenue_with_cost > 0 ? (grossProfit / s.revenue_with_cost) * 100 : 0;
  const maxDaily = s ? Math.max(1, ...s.daily.map((d) => d.total)) : 1;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Laporan</h1>
        <p className="text-sm text-slate-500">Tanggal memakai zona waktu WIB.</p>
      </div>
      <form action="/admin/reports" className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-sm">Dari<input type="date" name="from" defaultValue={from} className={inputClass} /></label>
        <label className="space-y-1 text-sm">Sampai<input type="date" name="to" defaultValue={to} className={inputClass} /></label>
        <button type="submit" className={buttonClass.secondary}>Tampilkan</button>
      </form>

      {error || !s ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error ? rpcMessage(error) : "Laporan gagal dimuat."} Pastikan migrasi laporan sudah dijalankan.
        </p>
      ) : (
        <>
          <p className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
            Tiga angka di bawah <strong>berbeda</strong>: pesanan masuk (belum tentu dibayar), uang masuk terverifikasi, dan laba kotor.
            Jangan dicampur.
          </p>

          <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold">1. Pesanan masuk (dibuat dalam rentang)</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-slate-500">Jumlah pesanan</dt><dd className="text-xl font-semibold">{s.orders_created}</dd></div>
              <div><dt className="text-slate-500">Nilai pesanan</dt><dd className="text-xl font-semibold">{rupiah(s.orders_created_value)}</dd></div>
              <div><dt className="text-slate-500">Batal / kedaluwarsa</dt><dd className="font-semibold">{s.orders_cancelled}</dd></div>
              <div><dt className="text-slate-500">Belum dibayar</dt><dd className="font-semibold">{s.orders_unpaid_open}</dd></div>
            </dl>
          </section>

          <section className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <h2 className="text-base font-semibold">2. Uang masuk terverifikasi (diverifikasi dalam rentang)</h2>
            <p className="text-3xl font-bold">{rupiah(s.verified_total)}</p>
            <p className="text-sm text-slate-600">{s.verified_count} pembayaran · {s.items_sold} item terjual</p>
          </section>

          <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold">3. Laba kotor (estimasi)</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-slate-500">Penjualan berharga pokok</dt><dd className="font-semibold">{rupiah(s.revenue_with_cost)}</dd></div>
              <div><dt className="text-slate-500">Harga pokok (HPP)</dt><dd className="font-semibold">{rupiah(s.cogs)}</dd></div>
              <div><dt className="text-slate-500">Laba kotor</dt><dd className="text-xl font-semibold">{rupiah(grossProfit)}</dd></div>
              <div><dt className="text-slate-500">Margin</dt><dd className="text-xl font-semibold">{margin.toFixed(1)}%</dd></div>
            </dl>
            {s.items_missing_cost > 0 ? (
              <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                {s.items_missing_cost} baris item belum punya harga pokok, jadi tidak ikut dihitung. Isi harga pokok di
                halaman produk atau lewat pembelian. Berlaku untuk transaksi berikutnya.
              </p>
            ) : null}
            <p className="text-xs text-slate-500">Belum memperhitungkan biaya operasional, diskon di luar harga, atau refund.</p>
          </section>

          <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold">Uang masuk per hari</h2>
            {s.daily.length === 0 ? <p className="text-sm text-slate-500">Tidak ada data.</p> : null}
            <ul className="space-y-1.5 text-sm">
              {s.daily.map((d) => (
                <li key={d.date}>
                  <div className="flex justify-between"><span>{d.date} · {d.count} transaksi</span><span className="font-medium">{rupiah(d.total)}</span></div>
                  <div className="h-2 rounded bg-slate-100"><div className="h-2 rounded bg-emerald-600" style={{ width: `${Math.max(2, (d.total / maxDaily) * 100)}%` }} /></div>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold">Produk terlaris</h2>
            {s.top_products.length === 0 ? <p className="text-sm text-slate-500">Tidak ada data.</p> : null}
            <ol className="space-y-1 text-sm">
              {s.top_products.map((p, i) => (
                <li key={`${p.name}-${i}`} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{i + 1}. {p.name}</span>
                  <span className="shrink-0">{p.qty} · {rupiah(p.revenue)}</span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
