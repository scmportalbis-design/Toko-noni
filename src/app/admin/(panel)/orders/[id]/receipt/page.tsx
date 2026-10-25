import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid, rupiah } from "@/lib/format";
import { formatDateTime } from "@/lib/dates";
import { IssueReceiptButton } from "../../order-actions";
import { PrintButton } from "./print-button";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [orderRes, itemsRes, receiptRes, payRes, nameRes] = await Promise.all([
    supabase.from("orders").select("id, order_number, customer_name, total, discount, subtotal, payment_status, created_at").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("id, product_name, unit_price, qty, line_total").eq("order_id", id).order("product_name"),
    supabase.from("receipts").select("receipt_number, issued_at").eq("order_id", id).maybeSingle(),
    supabase.from("payments").select("verified_at").eq("order_id", id).eq("status", "verified").maybeSingle(),
    supabase.from("store_settings").select("value").eq("key", "store_name").maybeSingle(),
  ]);
  const o = orderRes.data;
  if (!o) notFound();
  const items = (itemsRes.data ?? []) as { id: string; product_name: string; unit_price: number; qty: number; line_total: number }[];
  const verified = o.payment_status === "verified";
  const receipt = receiptRes.data;
  const storeName = typeof nameRes.data?.value === "string" ? nameRes.data.value : "Toko Noni";
  const isPaidReceipt = verified && !!receipt;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href={`/admin/orders/${id}`} className="inline-flex min-h-11 items-center text-sm text-emerald-800">← Kembali ke pesanan</Link>
        {isPaidReceipt || !verified ? <PrintButton /> : null}
      </div>
      {verified && !receipt ? (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 print:hidden">
          <p className="text-sm text-slate-700">Pembayaran sudah terverifikasi. Terbitkan struk lunas agar bisa dicetak.</p>
          <IssueReceiptButton orderId={id} />
        </div>
      ) : null}

      {/* Struk lunas HANYA muncul bila pembayaran terverifikasi DAN struk sudah terbit. */}
      {(isPaidReceipt || !verified) ? (
        <article className="mx-auto w-full max-w-xs space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm print:max-w-none print:border-0 print:p-0">
          <header className="text-center">
            <p className="text-base font-bold">{storeName}</p>
            <p className={`mt-1 inline-block rounded border px-2 py-0.5 text-xs font-bold tracking-wide ${isPaidReceipt ? "border-emerald-700 text-emerald-800" : "border-red-600 text-red-700"}`}>
              {isPaidReceipt ? "STRUK PEMBAYARAN — LUNAS" : "BUKTI PESANAN — BELUM DIBAYAR"}
            </p>
          </header>
          <div className="space-y-0.5 border-y border-dashed border-slate-300 py-2 text-xs">
            <p>Pesanan: {o.order_number}</p>
            {receipt ? <p>Struk: {receipt.receipt_number}</p> : null}
            <p>Tanggal: {formatDateTime(isPaidReceipt && payRes.data?.verified_at ? payRes.data.verified_at : o.created_at)}</p>
            <p>Pelanggan: {o.customer_name}</p>
          </div>
          <ul className="space-y-1">
            {items.map((i) => (
              <li key={i.id}>
                <p>{i.product_name}</p>
                <p className="flex justify-between text-xs text-slate-600"><span>{i.qty} × {rupiah(i.unit_price)}</span><span>{rupiah(i.line_total)}</span></p>
              </li>
            ))}
          </ul>
          <div className="space-y-0.5 border-t border-dashed border-slate-300 pt-2">
            {o.discount > 0 ? <p className="flex justify-between text-xs"><span>Diskon</span><span>− {rupiah(o.discount)}</span></p> : null}
            <p className="flex justify-between font-bold"><span>{isPaidReceipt ? "Total dibayar" : "Total tagihan"}</span><span>{rupiah(o.total)}</span></p>
          </div>
          {!isPaidReceipt ? <p className="text-center text-xs text-red-700">Dokumen ini bukan bukti pembayaran.</p> : <p className="text-center text-xs text-slate-500">Terima kasih telah berbelanja.</p>}
        </article>
      ) : null}
    </div>
  );
}
