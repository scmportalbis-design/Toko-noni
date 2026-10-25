import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { ProductCard } from "@/components/customer/product-card";
import type { ProductForCart } from "@/components/customer/add-to-cart-button";
import { inputClass, btn } from "@/components/customer/ui";

type SearchParams = Promise<{ k?: string; q?: string }>;

export default function HomePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="py-10 text-center text-sm text-stone-500">Memuat produk…</p>}>
      <Catalog searchParams={searchParams} />
    </Suspense>
  );
}

async function Catalog({ searchParams }: { searchParams: SearchParams }) {
  await connection(); // data selalu segar, jangan dibekukan saat build
  const { k, q } = await searchParams;
  const term = (q ?? "").replace(/[%_\\,()]/g, " ").trim().slice(0, 60);

  const supabase = createPublicClient();
  const { data: cats } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("sort_order")
    .order("name");
  const categories = (cats ?? []) as { id: string; name: string; slug: string }[];
  const active = categories.find((c) => c.slug === k) ?? null;

  let query = supabase
    .from("catalog_products")
    .select("id, name, slug, price, unit, image_path, available")
    .order("name")
    .limit(120);
  if (active) query = query.eq("category_id", active.id);
  if (term) query = query.ilike("name", `%${term}%`);
  const { data, error } = await query;
  const products = (data ?? []) as ProductForCart[];

  const chip = (isActive: boolean) =>
    `inline-flex min-h-11 items-center whitespace-nowrap rounded-full border px-4 text-sm ${
      isActive ? "border-emerald-700 bg-emerald-700 text-white" : "border-stone-300 bg-white text-stone-700"
    }`;

  return (
    <div className="space-y-4">
      <form action="/" className="flex gap-2">
        {active ? <input type="hidden" name="k" value={active.slug} /> : null}
        <input
          name="q"
          type="search"
          defaultValue={term}
          placeholder="Cari produk…"
          aria-label="Cari produk"
          className={inputClass}
        />
        <button type="submit" className={btn.secondary}>
          Cari
        </button>
      </form>

      {categories.length > 0 ? (
        <nav aria-label="Kategori" className="-mx-4 overflow-x-auto px-4">
          <ul className="flex gap-2 pb-1">
            <li>
              <Link href="/" className={chip(!active)}>
                Semua
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/?k=${encodeURIComponent(c.slug)}`} className={chip(active?.id === c.id)}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Produk gagal dimuat. Coba muat ulang halaman.
        </p>
      ) : products.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
          {term || active ? "Tidak ada produk yang cocok." : "Belum ada produk."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </ul>
      )}
    </div>
  );
}
