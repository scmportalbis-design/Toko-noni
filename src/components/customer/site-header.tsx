import Link from "next/link";
import { CartLink } from "./cart-link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
        <Link href="/" className="text-lg font-bold text-emerald-800">
          Toko Noni
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/pesanan"
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            Pesanan saya
          </Link>
          <CartLink />
        </div>
      </div>
    </header>
  );
}
