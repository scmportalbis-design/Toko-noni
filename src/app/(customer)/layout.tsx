import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/customer/site-header";
import { CartHydrator } from "@/components/customer/cart-hydrator";

export const metadata: Metadata = {
  title: { default: "Toko Noni", template: "%s — Toko Noni" },
  description: "Belanja di Toko Noni dan ambil pesananmu di toko.",
};

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-stone-50 text-stone-900">
      <CartHydrator />
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
      <footer className="mx-auto max-w-3xl px-4 pb-8 text-center text-xs text-stone-400">
        Toko Noni · pesanan diambil di toko
      </footer>
    </div>
  );
}
