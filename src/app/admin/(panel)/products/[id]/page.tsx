import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";
import { isUuid } from "@/lib/format";
import { ProductForm, type ProductFormData } from "../_components/product-form";
import { StockAdjustForm } from "../_components/stock-adjust-form";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await getStaff();
  if (staff?.role !== "owner") redirect("/admin/products");
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [product, categories, cost, stock] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, category_id, sku, description, price, unit, image_path, is_active")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("categories").select("id, name").order("sort_order").order("name"),
    supabase.from("product_costs").select("cost_price").eq("product_id", id).maybeSingle(),
    supabase.from("stock_levels").select("on_hand, reserved").eq("product_id", id).maybeSingle(),
  ]);
  if (!product.data) notFound();

  const onHand = (stock.data?.on_hand as number | undefined) ?? 0;
  const reserved = (stock.data?.reserved as number | undefined) ?? 0;

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
        <StockAdjustForm productId={id} />
      </section>
    </div>
  );
}
