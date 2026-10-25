import type { Metadata } from "next";
import { CheckoutForm } from "@/components/customer/checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Checkout</h1>
      <CheckoutForm />
    </div>
  );
}
