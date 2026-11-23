import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";
import { isUuid } from "@/lib/format";
import { formatDateTime } from "@/lib/dates";
import { pickCurrentPayment } from "@/lib/payments";
import { buildReceiptPdf } from "@/lib/receipt-pdf";

// Unduh struk / bukti pesanan sebagai PDF. Hanya staf; data dibaca lewat RLS seperti halaman struk.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return new Response("Pesanan tidak valid.", { status: 404 });
  if (!(await getStaff())) return new Response("Sesi berakhir. Masuk lagi.", { status: 401 });

  const supabase = await createClient();
  const [orderRes, itemsRes, receiptRes, paysRes, nameRes] = await Promise.all([
    supabase.from("orders").select("id, order_number, customer_name, total, discount, payment_status, created_at").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("id, product_name, unit_price, qty, line_total").eq("order_id", id).order("product_name"),
    supabase.from("receipts").select("receipt_number").eq("order_id", id).maybeSingle(),
    supabase.from("payments").select("status, verified_at, created_at").eq("order_id", id),
    supabase.from("store_settings").select("value").eq("key", "store_name").maybeSingle(),
  ]);
  const o = orderRes.data;
  if (!o) return new Response("Pesanan tidak ditemukan.", { status: 404 });

  const verified = o.payment_status === "verified";
  const receipt = receiptRes.data;
  // Sama dengan halaman struk: struk lunas butuh pembayaran terverifikasi DAN struk sudah terbit.
  if (verified && !receipt) {
    return new Response("Terbitkan struk lunas dulu di halaman struk, lalu unduh.", { status: 409 });
  }
  const isPaidReceipt = verified && !!receipt;
  const pay = pickCurrentPayment((paysRes.data ?? []) as { status: string; verified_at: string | null; created_at: string }[]);
  const storeName = typeof nameRes.data?.value === "string" ? nameRes.data.value : "Toko Noni";
  const items = (itemsRes.data ?? []) as { product_name: string; unit_price: number; qty: number; line_total: number }[];

  const bytes = buildReceiptPdf({
    storeName,
    title: isPaidReceipt ? "STRUK PEMBAYARAN - LUNAS" : "BUKTI PESANAN - BELUM DIBAYAR",
    orderNumber: o.order_number,
    receiptNumber: receipt?.receipt_number ?? null,
    dateText: formatDateTime(isPaidReceipt && pay?.verified_at ? pay.verified_at : o.created_at),
    customerName: o.customer_name,
    paymentMethod: "QRIS",
    items: items.map((i) => ({ name: i.product_name, qty: i.qty, unitPrice: i.unit_price, lineTotal: i.line_total })),
    discount: o.discount,
    totalLabel: isPaidReceipt ? "Total dibayar" : "Total tagihan",
    total: o.total,
    footer: isPaidReceipt ? "Terima kasih telah berbelanja." : "Dokumen ini bukan bukti pembayaran.",
  });

  const file = `struk-${String(o.order_number).replace(/[^A-Za-z0-9_-]/g, "")}.pdf`;
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
