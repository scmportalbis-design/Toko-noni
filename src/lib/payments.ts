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
