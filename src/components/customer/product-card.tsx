import Link from "next/link";
import { rupiah, storageUrl } from "@/lib/format";
import { AddToCartButton, type ProductForCart } from "./add-to-cart-button";

export function ProductCard({ product }: { product: ProductForCart }) {
  const img = storageUrl("product-images", product.image_path);
  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white">
      <Link href={`/produk/${product.slug}`} className="block">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={product.name} className="aspect-square w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-stone-100 text-xs text-stone-400">
            Tanpa foto
          </div>
        )}
        <div className="space-y-0.5 p-3 pb-2">
          <p className="line-clamp-2 text-sm font-medium text-stone-900">{product.name}</p>
          <p className="text-base font-semibold text-emerald-800">
            {rupiah(product.price)}
            <span className="text-xs font-normal text-stone-500"> /{product.unit}</span>
          </p>
          <p className={`text-xs ${product.available <= 0 ? "text-red-600" : "text-stone-500"}`}>
            {product.available <= 0 ? "Stok habis" : `Tersedia ${product.available}`}
          </p>
        </div>
      </Link>
      <div className="mt-auto p-3 pt-1">
        <AddToCartButton product={product} />
      </div>
    </li>
  );
}
