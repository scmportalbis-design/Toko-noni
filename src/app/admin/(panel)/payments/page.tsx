import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { one, rupiah } from "@/lib/format";
import { formatDateTime } from "@/lib/dates";
import { RealtimeRefresh } from "./realtime-refresh";
import { RejectForm, VerifyForm } from "./payment-forms";

type OrderEmbed = { id: string; order_number: string; customer_name: string; customer_phone: string; status: string; expires_at: string | null };
type Row = {
  id: string; amount: number; status: string; claimed_at: string | null; customer_note: string | null;
  created_at: string; verified_at: string | null; provider_reference: string | null;
  orders: OrderEmbed | OrderEmbed[] | null;
};

const SELECT = "id, amount, status, claimed_at, customer_note, created_at, verified_at, provider_reference, orders(id, order_number, customer_name, customer_phone, status, expires_at)";

export default async function PaymentsPage() {
  const supabase = await createClient();
  const [open, recent] = await Promise.all([
    supabase.from("payments").select(SELECT).in("status", ["claimed", "pending"]).order("created_at"),
    supabase.from("payments").select(SELECT).eq("status", "verified").order("verified_at", { ascending: false }).limit(10),
  ]);
  const rows = ((open.data ?? []) as unknown as Row[]).filter((p) => {
    const o = one(p.orders);
    return p.status === "claimed" || o?.status === "open"; // pesanan kedaluwarsa tanpa klaim disembunyikan
  });
  const claimed = rows.filter((p) => p.status === "claimed");
  const pending = rows.filter((p) => p.status === "pending");
  const verified = (recent.data ?? []) as unknown as Row[];

  const card = (p: Row, openByDefault: boolean) => {
    const o = one(p.orders);
    return (
      <li key={p.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={o ? `/admin/orders/${o.id}` : "#"} className="font-semibold text-emerald-800 underline">
              {o?.order_number}
            </Link>
            <p className="text-sm text-slate-600">{o?.customer_name} · {o?.customer_phone}</p>
            <p className="text-xs text-slate-500">
              {p.claimed_at ? `Mengaku bayar ${formatDateTime(p.claimed_at)}` : `Dibuat ${formatDateTime(p.created_at)}`}
            </p>
            {p.customer_note ? <p className="text-xs text-slate-500">Catatan: {p.customer_note}</p> : null}
          </div>
          <p className="shrink-0 text-lg font-bold">{rupiah(p.amount)}</p>
        </div>
        <details open={openByDefault} className="rounded-lg border border-slate-200">
          <summary className="min-h-11 cursor-pointer px-3 py-2.5 text-sm font-medium">Periksa &amp; verifikasi</summary>
          <div className="space-y-4 border-t border-slate-100 p-3">
            <VerifyForm paymentId={p.id} amount={p.amount} expired={o?.status === "expired"} />
            <details>
              <summary className="min-h-11 cursor-pointer py-2.5 text-sm text-red-700">Tolak pembayaran</summary>
              <div className="pt-2"><RejectForm paymentId={p.id} /></div>
            </details>
          </div>
        </details>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <RealtimeRefresh />
      <div>
        <h1 className="text-xl font-semibold">Pembayaran</h1>
        <p className="text-sm text-slate-500">
          Verifikasi hanya dengan mutasi resmi toko. Bukti kiriman atau pengakuan pelanggan belum berarti dana masuk.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Perlu diperiksa ({claimed.length})</h2>
        {claimed.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Tidak ada.</p> : null}
        <ul className="space-y-3">{claimed.map((p) => card(p, true))}</ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Belum menyatakan bayar ({pending.length})</h2>
        <ul className="space-y-3">{pending.map((p) => card(p, false))}</ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Terverifikasi terakhir</h2>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {verified.length === 0 ? <li className="p-4 text-sm text-slate-500">Belum ada.</li> : null}
          {verified.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span>{one(p.orders)?.order_number} · {p.verified_at ? formatDateTime(p.verified_at) : ""}</span>
              <span className="font-medium">{rupiah(p.amount)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
