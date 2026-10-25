const TZ = "Asia/Jakarta";

export function todayJakarta(d: Date = new Date()): string {
  return d.toLocaleDateString("sv-SE", { timeZone: TZ }); // YYYY-MM-DD
}

export function isYmd(v: string | null | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function firstOfMonth(ymd: string): string {
  return `${ymd.slice(0, 8)}01`;
}

// Awal hari WIB (UTC+7, tanpa DST) sebagai ISO UTC.
export function startOfDayISO(ymd: string): string {
  return new Date(`${ymd}T00:00:00+07:00`).toISOString();
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: TZ });
}
