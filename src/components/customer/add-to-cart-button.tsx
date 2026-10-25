"use client";

import { useCart } from "@/lib/stores/cart";
import { useHydration } from "@/lib/stores/hydrate";
import { btn } from "./ui";

export type ProductForCart = {
  id: string;
  slug: string;
  name: string;
  price: number;
  unit: string;
  image_path: string | null;
  available: number;
};

export function AddToCartButton({ product }: { product: ProductForCart }) {
  const hydrated = useHydration((s) => s.done);
  const add = useCart((s) => s.add);
  const inCart = useCart((s) => s.items.find((i) => i.productId === product.id)?.qty ?? 0);
  const qty = hydrated ? inCart : 0;
  const soldOut = product.available <= 0;
  const atMax = qty >= product.available;

  return (
    <button
      type="button"
      disabled={soldOut || atMax}
      onClick={() =>
        add({
          productId: product.id,
          slug: product.slug,
          name: product.name,
          price: product.price,
          unit: product.unit,
          imagePath: product.image_path,
          max: product.available,
        })
      }
      className={`${btn.primary} w-full`}
    >
      {soldOut ? "Habis" : atMax ? "Maksimal di keranjang" : qty > 0 ? `Tambah lagi (${qty})` : "Tambah ke keranjang"}
    </button>
  );
}
