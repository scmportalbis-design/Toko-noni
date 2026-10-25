import type { Metadata } from "next";
import { CartView } from "@/components/customer/cart-view";

export const metadata: Metadata = { title: "Keranjang" };

export default function CartPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Keranjang</h1>
      <CartView />
    </div>
  );
}
