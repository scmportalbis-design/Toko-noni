import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";
import { isUuid, one, rupiah } from "@/lib/format";
import { formatDateTime } from "@/lib/dates";
import { Badge } from "@/components/admin/badge";
import { PurchaseActions } from "../_components/purchase-actions";

type Item = { id: string; qty: number; unit_cost: number; products: { name: string } | { name: string }[] | null };
const LABEL: Record<string, string> = { draft: "Draf", received: "Diterima", cancelled: "Dibatalkan" };

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await getStaff();
  if (staff?.role !== "owner") redirect("/admin");
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [pRes, iRes] = await Promise.all([
    supabase.from("purchases").select("id, status, purchase_date, note, received_at, suppliers(name)").eq("id", id).maybeSingle(),
    supabase.from("purchase_items").select("id, qty, unit_cost, products(name)").eq("purchase_id", id),
  ]);
  const p = pRes.data as unknown as { id: string; status: string; purchase_date: string; note: string | null; received_at: string | null; suppliers: { name: string } | { name: string }[] | null } | null;
  if (!p) notFound();
  const items = (iRes.data ?? []) as unknown as Item[];
  const total = items.reduce((n, i) => n + i.qty * i.unit_cost, 0);

  return (
    <div className="space-y-4">
      <Link href="/admin/purchases" className="inline-flex min-h-11 items-center text-sm text-emerald-800">← Semua pembelian</Link>
      <section className="space-y-1 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-semibold">{one(p.suppliers)?.name ?? "Tanpa pemasok"}</h1>
          <Badge tone={p.status === "received" ? "ok" : p.status === "draft" ? "wait" : "bad"}>{LABEL[p.status]}</Badge>
        </div>
        <p className="text-sm text-slate-600">Tanggal {p.purchase_date}{p.note ? ` · ${p.note}` : ""}</p>
        {p.received_at ? <p className="text-xs text-slate-500">Diterima {formatDateTime(p.received_at)}</p> : null}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <ul className="space-y-1 text-sm">
          {items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3">
              <span>{one(i.products)?.name} × {i.qty} <span className="text-slate-400">@ {rupiah(i.unit_cost)}</span></span>
              <span>{rupiah(i.qty * i.unit_cost)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex justify-between border-t border-slate-100 pt-2 font-semibold"><span>Total</span><span>{rupiah(total)}</span></p>
      </section>
      {p.status === "draft" ? <section className="rounded-xl border border-slate-200 bg-white p-4"><PurchaseActions purchaseId={id} /></section> : null}
    </div>
  );
}
