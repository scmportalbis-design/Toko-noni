// Bentuk hasil Server Action yang dipakai semua form admin.
export type ActionState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>; // pesan per kolom
  values?: Record<string, string>; // isian yang dikirim, agar tidak hilang saat galat
} | null;
