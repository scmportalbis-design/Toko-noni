import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid, rupiah } from "@/lib/format";
import { formatDateTime } from "@/lib/dates";
import { fulfillmentLabel, orderStatusLabel, paymentLabel } from "@/lib/labels";
import { Badge, orderTone, paymentTone } from "@/components/admin/badge";
import { buttonClass } from "@/components/admin/form-ui";
import { CancelOrderForm, FulfillmentButton } from "../order-actions";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [orderRes, itemsRes, paysRes, receiptRes] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("id, product_name, unit_price, qty, line_total").eq("order_id", id).order("product_name"),
    supabase.from("payments").select("id, amount, status, provider_reference, claimed_at, verified_at, rejected_reason, created_at").eq("order_id", id).order("created_at"),
    supabase.from("receipts").select("receipt_number").eq("order_id", id).maybeSingle(),
  ]);
  const o = orderRes.data as Record<string, any> | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!o) notFound();
  const items = (itemsRes.data ?? []) as { id: string; product_name: string; unit_price: number; qty: number; line_total: number }[];
  const pays = (paysRes.data ?? []) as { id: string; amount: number; status: string; provider_reference: string | null; claimed_at: string | null; verified_at: string | null; rejected_reason: string | null; created_at: string }[];
  const payIds = pays.map((p) => p.id);
  const histRes = payIds.length
    ? await supabase.from("payment_status_history").select("id, payment_id, from_status, to_status, note, changed_at").in("payment_id", payIds).order("changed_at")
    : { data: [] };
  const history = (histRes.data ?? []) as { id: number; from_status: string | null; to_status: string; note: string | null; changed_at: string }[];

  const verified = o.payment_status === "verified";
  const canCancel = o.status === "open" && !verified;

  return (
    <div className="space-y-4">
      <Link href="/admin/orders" className="inline-flex min-h-11 items-center text-sm text-emerald-800">← Semua pesanan</Link>

      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">{o.order_number}</h1>
            <p className="text-sm text-slate-600">{o.customer_name} · {o.customer_phone}</p>
            <p className="text-xs text-slate-500">Dibuat {formatDateTime(o.created_at)}</p>
          </div>
          <p className="text-lg font-bold">{rupiah(o.total)}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={orderTone(o.status)}>{orderStatusLabel[o.status]}</Badge>
          <Badge tone={paymentTone(o.payment_status)}>{paymentLabel[o.payment_status]}</Badge>
          {verified ? <Badge tone="wait">{fulfillmentLabel[o.fulfillment_status]}</Badge> : null}
        </div>
        {o.note ? <p className="text-sm text-slate-600">Catatan pelanggan: {o.note}</p> : null}
        {o.cancel_reason ? <p className="text-sm text-red-700">Alasan: {o.cancel_reason}</p> : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-base font-semibold">Isi pesanan</h2>
        <ul className="space-y-1 text-sm">
          {items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3">
              <span>{i.product_name} × {i.qty} <span className="text-slate-400">@ {rupiah(i.unit_price)}</span></span>
              <span>{rupiah(i.line_total)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 font-semibold"><span>Total</span><span>{rupiah(o.total)}</span></div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold">Tindakan</h2>
        {verified && o.status === "open" ? <FulfillmentButton orderId={id} current={o.fulfillment_status} /> : null}
        {!verified && o.status === "open" ? (
          <p className="text-sm text-slate-600">
            Pembayaran belum terverifikasi. {" "}
            <Link href="/admin/payments" className="font-medium text-emerald-800 underline">Buka halaman Pembayaran</Link>.
          </p>
        ) : null}
        <Link href={`/admin/orders/${id}/receipt`} className={buttonClass.secondary}>
          {receiptRes.data ? "Lihat / cetak struk" : verified ? "Struk & bukti pesanan" : "Bukti pesanan (belum bayar)"}
        </Link>
        {canCancel ? <details><summary className="min-h-11 cursor-pointer py-2.5 text-sm text-red-700">Batalkan pesanan</summary><div className="pt-2"><CancelOrderForm orderId={id} /></div></details> : null}
        {verified ? <p className="text-xs text-slate-500">Pesanan yang sudah dibayar tidak bisa dibatalkan di sini. Aturan refund belum ditetapkan.</p> : null}
      </section>

      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold">Riwayat pembayaran</h2>
        <ul className="space-y-1 text-sm">
          {pays.map((p) => (
            <li key={p.id}>
              {rupiah(p.amount)} · <Badge tone={paymentTone(p.status)}>{paymentLabel[p.status]}</Badge>
              {p.provider_reference ? <span className="text-slate-500"> · ref {p.provider_reference}</span> : null}
              {p.rejected_reason ? <span className="text-red-700"> · {p.rejected_reason}</span> : null}
            </li>
          ))}
        </ul>
        {history.length > 0 ? (
          <ol className="space-y-0.5 border-t border-slate-100 pt-2 text-xs text-slate-500">
            {history.map((h) => (
              <li key={h.id}>{formatDateTime(h.changed_at)} — {h.from_status ? `${paymentLabel[h.from_status]} → ` : ""}{paymentLabel[h.to_status]}{h.note ? ` (${h.note})` : ""}</li>
            ))}
          </ol>
        ) : null}
      </section>
    </div>
  );
}
