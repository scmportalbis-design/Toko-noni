import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";
import { one, rupiah, storageUrl } from "@/lib/format";
import { buttonClass } from "@/lib/admin-styles";

type Row = {
  id: string;
  name: string;
  price: number;
  unit: string;
  image_path: string | null;
  is_active: boolean;
  categories: { name: string } | { name: string }[] | null;
};

export default async function ProductsPage() {
  const staff = await getStaff();
  const isOwner = staff?.role === "owner";
  const supabase = await createClient();
  const [{ data }, stockRes, unfilled] = await Promise.all([
    supabase.from("products").select("id, name, price, unit, image_path, is_active, categories(name)").order("name"),
    // Angka stok layak-jual (tanpa tanggal kedaluwarsa) agar sama dengan yang dilihat pelanggan.
    supabase.from("staff_stock").select("product_id, on_hand, reserved"),
    isOwner
      ? supabase.from("stock_batches").select("id", { count: "exact", head: true }).gt("qty_remaining", 0).is("expiry_date", null)
      : Promise.resolve({ count: 0 }),
  ]);
  const products = (data ?? []) as unknown as Row[];
  const stockById = new Map(((stockRes.data ?? []) as { product_id: string; on_hand: number; reserved: number }[]).map((s) => [s.product_id, s]));
  const unfilledCount = unfilled.count ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Produk</h1>
          <p className="text-sm text-slate-500">{products.length} produk</p>
        </div>
        {isOwner ? (
          <Link href="/admin/products/new" className={buttonClass.primary}>
            Tambah produk
          </Link>
        ) : null}
      </div>

      {isOwner && unfilledCount > 0 ? (
        <Link href="/admin/batches?tab=belum" className="block rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 hover:bg-amber-100">
          {unfilledCount} batch stok lama belum punya tanggal kedaluwarsa. Ketuk untuk mengisi.
        </Link>
      ) : null}

      {products.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Belum ada produk.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {products.map((p) => {
            const stock = stockById.get(p.id);
            const available = stock ? Math.max(stock.on_hand - stock.reserved, 0) : 0;
            const img = storageUrl("product-images", p.image_path);
            const body = (
              <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-16 w-16 shrink-0 rounded-lg bg-slate-100" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-sm text-slate-500">
                    {one(p.categories)?.name ?? "Tanpa kategori"} · {rupiah(p.price)}/{p.unit}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span className={available === 0 ? "text-red-600" : "text-slate-700"}>
                      Tersedia {available}
                    </span>
                    <span className="text-slate-400">· fisik {stock?.on_hand ?? 0}</span>
                    {!p.is_active ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Nonaktif</span>
                    ) : null}
                  </p>
                </div>
              </div>
            );
            return (
              <li key={p.id}>
                {isOwner ? (
                  <Link href={`/admin/products/${p.id}`} className="block">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
