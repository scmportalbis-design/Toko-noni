import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";
import { one, rupiah } from "@/lib/format";
import { Badge } from "@/components/admin/badge";
import { buttonClass } from "@/components/admin/form-ui";

type Row = {
  id: string; status: string; purchase_date: string;
  suppliers: { name: string } | { name: string }[] | null;
  purchase_items: { qty: number; unit_cost: number }[];
};
const LABEL: Record<string, string> = { draft: "Draf", received: "Diterima", cancelled: "Dibatalkan" };

export default async function PurchasesPage() {
  const staff = await getStaff();
  if (staff?.role !== "owner") redirect("/admin");
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchases")
    .select("id, status, purchase_date, suppliers(name), purchase_items(qty, unit_cost)")
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-semibold">Pembelian</h1>
        <Link href="/admin/purchases/new" className={buttonClass.primary}>Catat pembelian</Link>
      </div>
      <ul className="space-y-2">
        {rows.length === 0 ? <li className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Belum ada pembelian.</li> : null}
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/purchases/${r.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50">
              <div className="min-w-0">
                <p className="truncate font-medium">{one(r.suppliers)?.name ?? "Tanpa pemasok"}</p>
                <p className="text-xs text-slate-500">{r.purchase_date} · {r.purchase_items.length} barang</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold">{rupiah(r.purchase_items.reduce((n, i) => n + i.qty * i.unit_cost, 0))}</p>
                <Badge tone={r.status === "received" ? "ok" : r.status === "draft" ? "wait" : "bad"}>{LABEL[r.status]}</Badge>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
