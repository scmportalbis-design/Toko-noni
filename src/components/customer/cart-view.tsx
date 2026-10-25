"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/stores/cart";
import { useHydration } from "@/lib/stores/hydrate";
import { createPublicClient } from "@/lib/supabase/public";
import { rupiah, storageUrl } from "@/lib/format";
import { btn } from "./ui";

export function CartView() {
  const hydrated = useHydration((s) => s.done);
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const [notes, setNotes] = useState<string[]>([]);

  // Sinkronkan harga & stok terbaru dari server sekali setelah keranjang dipulihkan.
  useEffect(() => {
    if (!hydrated) return;
    const ids = useCart.getState().items.map((i) => i.productId);
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await createPublicClient()
        .from("catalog_products")
        .select("id, name, price, image_path, available")
        .in("id", ids);
      if (cancelled || !data) return;
      setNotes(useCart.getState().applyServerData(data));
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  if (!hydrated) return <p className="py-10 text-center text-sm text-stone-500">Memuat keranjang…</p>;

  if (items.length === 0) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-stone-600">Keranjangmu masih kosong.</p>
        <Link href="/" className={btn.primary}>
          Lihat produk
        </Link>
      </div>
    );
  }

  const subtotal = items.reduce((n, i) => n + i.price * i.qty, 0);

  return (
    <div className="space-y-4">
      {notes.length > 0 ? (
        <ul role="status" className="space-y-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}

      <ul className="space-y-2">
        {items.map((i) => {
          const img = storageUrl("product-images", i.imagePath);
          return (
            <li key={i.productId} className="flex gap-3 rounded-xl border border-stone-200 bg-white p-3">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="h-20 w-20 shrink-0 rounded-lg bg-stone-100" />
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <p className="line-clamp-2 text-sm font-medium">{i.name}</p>
                  <p className="text-sm text-stone-500">
                    {rupiah(i.price)} /{i.unit}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center">
                    <button
                      type="button"
                      aria-label={`Kurangi ${i.name}`}
                      disabled={i.qty <= 1}
                      onClick={() => setQty(i.productId, i.qty - 1)}
                      className="h-11 w-11 rounded-l-lg border border-stone-300 text-lg disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="flex h-11 min-w-12 items-center justify-center border-y border-stone-300 px-2 text-sm font-medium">
                      {i.qty}
                    </span>
                    <button
                      type="button"
                      aria-label={`Tambah ${i.name}`}
                      disabled={i.qty >= i.max}
                      onClick={() => setQty(i.productId, i.qty + 1)}
                      className="h-11 w-11 rounded-r-lg border border-stone-300 text-lg disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(i.productId)}
                    className="min-h-11 px-2 text-sm text-red-700"
                  >
                    Hapus
                  </button>
                </div>
                {i.qty >= i.max ? <p className="text-xs text-amber-700">Mencapai stok yang tersedia ({i.max}).</p> : null}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex items-center justify-between text-base">
          <span>Subtotal</span>
          <span className="font-semibold">{rupiah(subtotal)}</span>
        </div>
        <p className="text-xs text-stone-500">Pesanan diambil di toko. Harga akhir dihitung ulang saat pesanan dibuat.</p>
        <Link href="/checkout" className={`${btn.primary} w-full`}>
          Lanjut ke checkout
        </Link>
      </div>
    </div>
  );
}
