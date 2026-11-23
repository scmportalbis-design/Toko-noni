import { addDays } from "@/lib/dates";

// Hanya dipakai di halaman pemilik. Tanggal kedaluwarsa tidak boleh sampai ke kasir/pelanggan.
export const NEAR_EXPIRY_DAYS = 30; // batas peringatan "hampir kedaluwarsa"

export type BatchStatus = "unfilled" | "expired" | "near" | "ok";

// expiry/today berformat YYYY-MM-DD (zona Asia/Jakarta). Tanggal kedaluwarsa = hari TERAKHIR
// boleh dijual; baru "kedaluwarsa" mulai hari berikutnya (sama dengan aturan di database).
export function batchStatus(expiry: string | null, today: string, warnDays: number = NEAR_EXPIRY_DAYS): BatchStatus {
  if (!expiry) return "unfilled";
  if (expiry < today) return "expired";
  if (expiry <= addDays(today, warnDays)) return "near";
  return "ok";
}

// Selisih hari kalender (negatif = sudah lewat).
export function daysUntil(expiry: string, today: string): number {
  const a = Date.parse(`${expiry}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

export const batchStatusLabel: Record<BatchStatus, string> = {
  unfilled: "Tanggal belum diisi",
  expired: "Kedaluwarsa",
  near: "Hampir kedaluwarsa",
  ok: "Aman",
};

export function expiryText(expiry: string | null, today: string): string {
  if (!expiry) return "Belum diisi";
  const d = daysUntil(expiry, today);
  if (d < 0) return `Lewat ${-d} hari`;
  if (d === 0) return "Hari ini terakhir";
  return `${d} hari lagi`;
}

export function formatYmd(ymd: string): string {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString("id-ID", { dateStyle: "medium", timeZone: "UTC" });
}

type Fifo = { id: string; received_at: string; created_at?: string; qty_remaining: number; expiry_date: string | null };

// Urutan FIFO persis seperti di database: received_at, lalu created_at, lalu id.
export function fifoOrder<T extends Fifo>(batches: T[]): T[] {
  return [...batches].sort(
    (a, b) =>
      a.received_at.localeCompare(b.received_at) ||
      (a.created_at ?? "").localeCompare(b.created_at ?? "") ||
      a.id.localeCompare(b.id),
  );
}

// Batch yang akan keluar lebih dulu: batch pertama (urutan FIFO) yang masih ada isinya
// dan belum kedaluwarsa.
export function nextOutBatchId<T extends Fifo>(batches: T[], today: string): string | null {
  const b = fifoOrder(batches).find((x) => x.qty_remaining > 0 && (x.expiry_date === null || x.expiry_date >= today));
  return b?.id ?? null;
}

// Perkiraan kerugian (qty x harga pokok batch).
export function lossEstimate(qty: number, unitCost: number): number {
  return Math.max(0, Math.trunc(qty)) * Math.max(0, Math.trunc(unitCost));
}
