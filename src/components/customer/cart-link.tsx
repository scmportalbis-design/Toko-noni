"use client";

import Link from "next/link";
import { useCart } from "@/lib/stores/cart";
import { useHydration } from "@/lib/stores/hydrate";

export function CartLink() {
  const hydrated = useHydration((s) => s.done);
  const count = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));
  return (
    <Link
      href="/keranjang"
      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"
    >
      Keranjang
      {hydrated && count > 0 ? (
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-emerald-800">{count}</span>
      ) : null}
    </Link>
  );
}
