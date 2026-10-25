export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function bool(fd: FormData, key: string): boolean {
  return fd.get(key) === "on";
}

// "Rp 15.000" -> 15000. Hanya angka bulat tak negatif.
export function toInt(v: string | null): number | null {
  if (v === null) return null;
  const digits = v.replace(/[^\d]/g, "");
  if (digits === "") return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

// Seperti toInt, tetapi membuang desimal rupiah di akhir: "30.000,00" -> 30000.
export function toRupiah(v: string | null): number | null {
  if (v === null) return null;
  return toInt(v.trim().replace(/[,.]\d{1,2}$/, ""));
}

export function snapshot(fd: FormData, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = fd.get(k);
    out[k] = typeof v === "string" ? v : "";
  }
  return out;
}
