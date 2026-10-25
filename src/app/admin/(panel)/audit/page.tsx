import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";

type Row = { id: number; actor_id: string | null; action: string; entity_type: string; entity_id: string | null; details: unknown; created_at: string };

export default async function AuditPage() {
  const staff = await getStaff();
  if (staff?.role !== "owner") redirect("/admin");
  const supabase = await createClient();
  const [logs, people] = await Promise.all([
    supabase.from("audit_log").select("id, actor_id, action, entity_type, entity_id, details, created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const names = new Map(((people.data ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));
  const rows = (logs.data ?? []) as Row[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Log audit</h1>
        <p className="text-sm text-slate-500">100 kejadian terakhir: verifikasi pembayaran, pembatalan, koreksi stok, perubahan data master. Log tidak bisa diubah dari aplikasi.</p>
      </div>
      <ul className="space-y-2">
        {rows.length === 0 ? <li className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Belum ada catatan.</li> : null}
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
            <p className="font-medium">{r.action} <span className="font-normal text-slate-500">· {r.entity_type}</span></p>
            <p className="text-xs text-slate-500">{formatDateTime(r.created_at)} · oleh {r.actor_id ? (names.get(r.actor_id) ?? "pengguna lain") : "sistem / pelanggan"}</p>
            {r.details ? (
              <details className="mt-1">
                <summary className="min-h-11 cursor-pointer py-2.5 text-xs text-emerald-800">Rincian</summary>
                <pre className="overflow-x-auto rounded bg-slate-50 p-2 text-xs">{JSON.stringify(r.details, null, 2).slice(0, 1500)}</pre>
              </details>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
