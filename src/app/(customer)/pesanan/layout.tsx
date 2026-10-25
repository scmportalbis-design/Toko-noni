import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Pesanan",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function OrdersLayout({ children }: { children: ReactNode }) {
  return children;
}
