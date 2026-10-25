import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";
import { ProductForm } from "../_components/product-form";

export default async function NewProductPage() {
  const staff = await getStaff();
  if (staff?.role !== "owner") redirect("/admin/products");

  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, name").order("sort_order").order("name");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Tambah produk</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <ProductForm categories={(data ?? []) as { id: string; name: string }[]} />
      </div>
      <p className="text-sm text-slate-500">Stok awal diisi setelah produk tersimpan.</p>
    </div>
  );
}
