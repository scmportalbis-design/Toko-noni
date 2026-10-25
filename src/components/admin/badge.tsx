const TONES = {
  ok: "bg-emerald-50 text-emerald-700",
  wait: "bg-amber-50 text-amber-800",
  bad: "bg-red-50 text-red-700",
  muted: "bg-slate-100 text-slate-600",
};

export function Badge({ tone = "muted", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

export function paymentTone(s: string): keyof typeof TONES {
  return s === "verified" ? "ok" : s === "claimed" ? "wait" : s === "rejected" || s === "refunded" ? "bad" : "muted";
}
export function orderTone(s: string): keyof typeof TONES {
  return s === "completed" ? "ok" : s === "open" ? "wait" : "bad";
}
