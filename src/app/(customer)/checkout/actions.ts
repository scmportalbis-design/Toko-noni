"use server";

import { createPublicClient } from "@/lib/supabase/public";
import { checkoutSchema, type CheckoutInput } from "@/lib/validators/checkout";
import { rpcMessage } from "@/lib/rpc-errors";

export type PlaceOrderResult =
  | { ok: true; orderNumber: string; token: string; total: number }
  | { ok: false; message?: string; errors?: Record<string, string> };

// Harga TIDAK dikirim dari klien: database menghitung dari tabel produk.
export async function placeOrder(input: CheckoutInput): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? "_");
      if (!(k in errors)) errors[k] = issue.message;
    }
    return { ok: false, errors, message: errors.items };
  }
  const d = parsed.data;

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("create_order", {
    p_items: d.items.map((i) => ({ product_id: i.productId, qty: i.qty })),
    p_customer_name: d.name,
    p_customer_phone: d.phone,
    p_note: d.note === "" ? null : d.note,
    p_idempotency_key: d.key,
  });
  if (error) return { ok: false, message: rpcMessage(error) };

  const r = data as { order_number: string; access_token: string; total: number } | null;
  if (!r) return { ok: false, message: "Terjadi kesalahan. Coba lagi." };
  return { ok: true, orderNumber: r.order_number, token: r.access_token, total: Number(r.total) };
}
