import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";
import { isUuid } from "@/lib/format";
import { todayJakarta } from "@/lib/dates";
import { batchStatus, batchStatusLabel, expiryText, fifoOrder, formatYmd, nextOutBatchId } from "@/lib/batch";
import { Badge } from "@/components/admin/badge";
import { ProductForm, type ProductFormData } from "../_components/product-form";
import { StockAdjustForm } from "../_components/stock-adjust-form";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await getStaff();
  if (staff?.role !== "owner") redirect("/admin/products");
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [product, categories, cost, stock, batchRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, category_id, sku, description, price, unit, image_path, is_active")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("categories").select("id, name").order("sort_order").order("name"),
    supabase.from("product_costs").select("cost_price").eq("product_id", id).maybeSingle(),
    supabase.from("stock_levels").select("on_hand, reserved").eq("product_id", id).maybeSingle(),
    supabase.from("stock_batches")
      .select("id, batch_code, received_at, created_at, expiry_date, qty_initial, qty_remaining")
      .eq("product_id", id).gt("qty_remaining", 0),
  ]);
  if (!product.data) notFound();

  const onHand = (stock.data?.on_hand as number | undefined) ?? 0;
  const reserved = (stock.data?.reserved as number | undefined) ?? 0;
  const today = todayJakarta();
  const batches = fifoOrder((batchRes.data ?? []) as {
    id: string; batch_code: string; received_at: string; created_at: string; expiry_date: string | null; qty_initial: number; qty_remaining: number;
  }[]);
  const nextId = nextOutBatchId(batches, today);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Ubah produk</h1>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <ProductForm
          product={product.data as ProductFormData}
          categories={(categories.data ?? []) as { id: string; name: string }[]}
          costPrice={(cost.data?.cost_price as number | undefined) ?? null}
        />
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h2 className="text-base font-semibold">Stok</h2>
          <p className="text-sm text-slate-600">
            Fisik {onHand} · sedang dipesan {reserved} · tersedia {Math.max(onHand - reserved, 0)}
          </p>
        </div>
        <StockAdjustForm productId={id} today={today} />
      </section>

      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">Batch stok (urutan keluar FIFO)</h2>
          <Link href="/admin/batches" className="shrink-0 text-sm font-medium text-emerald-800 underline">Kelola batch</Link>
        </div>
        {batches.length === 0 ? <p className="text-sm text-slate-500">Tidak ada batch berisi stok.</p> : null}
        <ul className="divide-y divide-slate-100 text-sm">
          {batches.map((b) => {
            const st = batchStatus(b.expiry_date, today);
            return (
              <li key={b.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium">{b.batch_code} {b.id === nextId ? <span className="text-xs font-normal text-emerald-700">· keluar berikutnya</span> : null}</p>
                  <p className="text-xs text-slate-500">
                    {b.expiry_date ? `Kedaluwarsa ${formatYmd(b.expiry_date)} (${expiryText(b.expiry_date, today)})` : "Tanggal kedaluwarsa belum diisi"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-semibold">{b.qty_remaining}<span className="text-xs font-normal text-slate-400"> / {b.qty_initial}</span></span>
                  {st !== "ok" ? <Badge tone={st === "near" || st === "unfilled" ? "wait" : "bad"}>{batchStatusLabel[st]}</Badge> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
