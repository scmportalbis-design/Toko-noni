// Metode pembayaran pesanan. Nilai harus sama dengan payments.method di database
// (dibatasi CHECK payments_method_check).
export const PAYMENT_METHODS = ["qris_static", "cash"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  qris_static: "QRIS",
  cash: "Tunai",
};

export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return typeof v === "string" && (PAYMENT_METHODS as readonly string[]).includes(v);
}

// Label aman untuk nilai tak dikenal (data lama / metode baru di masa depan).
export function methodLabel(m: string | null | undefined): string {
  return isPaymentMethod(m) ? paymentMethodLabel[m] : "QRIS";
}

// Satu pesanan bisa punya beberapa baris pembayaran (yang ditolak tetap tersimpan).
// Yang berlaku: terverifikasi, kalau tidak ada maka yang masih terbuka (pending/claimed),
// kalau tidak ada juga maka yang terbaru.
export function pickCurrentPayment<T extends { status: string; created_at?: string }>(pays: T[] | null | undefined): T | null {
  if (!pays || pays.length === 0) return null;
  const newestFirst = [...pays].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  return (
    newestFirst.find((p) => p.status === "verified") ??
    newestFirst.find((p) => p.status === "pending" || p.status === "claimed") ??
    newestFirst[0]
  );
}

// Uang tunai: diterima harus >= tagihan; selisihnya kembalian.
export function cashChange(received: number, total: number): number | null {
  if (!Number.isFinite(received) || !Number.isFinite(total) || received < total) return null;
  return received - total;
}
