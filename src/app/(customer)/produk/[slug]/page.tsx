import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { rupiah, storageUrl } from "@/lib/format";
import { AddToCartButton } from "@/components/customer/add-to-cart-button";

type Params = Promise<{ slug: string }>;

export default function ProductPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<p className="py-10 text-center text-sm text-stone-500">Memuat…</p>}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: Params }) {
  await connection();
  const { slug } = await params;
  const { data } = await createPublicClient()
    .from("catalog_products")
    .select("id, name, slug, description, price, unit, image_path, available")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) notFound();
  const p = data as {
    id: string; name: string; slug: string; description: string | null;
    price: number; unit: string; image_path: string | null; available: number;
  };
  const img = storageUrl("product-images", p.image_path);

  return (
    <div className="space-y-4">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm text-emerald-800">
        ← Kembali
      </Link>
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt={p.name} className="aspect-square w-full rounded-xl border border-stone-200 object-cover sm:max-w-md" />
      ) : null}
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{p.name}</h1>
        <p className="text-2xl font-bold text-emerald-800">
          {rupiah(p.price)} <span className="text-sm font-normal text-stone-500">/{p.unit}</span>
        </p>
        <p className={`text-sm ${p.available <= 0 ? "text-red-600" : "text-stone-600"}`}>
          {p.available <= 0 ? "Stok habis" : `Tersedia ${p.available} ${p.unit}`}
        </p>
      </div>
      {p.description ? <p className="whitespace-pre-line text-sm text-stone-700">{p.description}</p> : null}
      <div className="sm:max-w-xs">
        <AddToCartButton product={p} />
      </div>
    </div>
  );
}
