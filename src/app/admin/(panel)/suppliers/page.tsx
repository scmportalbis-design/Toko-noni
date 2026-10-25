import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";
import { Badge } from "@/components/admin/badge";
import { SupplierForm, type SupplierRow } from "./_components/supplier-form";

export default async function SuppliersPage() {
  const staff = await getStaff();
  if (staff?.role !== "owner") redirect("/admin");
  const supabase = await createClient();
  const { data } = await supabase.from("suppliers").select("id, name, phone, address, note, is_active").order("name");
  const suppliers = (data ?? []) as SupplierRow[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Pemasok</h1>
        <p className="text-sm text-slate-500">Pemasok tidak dihapus, hanya dinonaktifkan, agar riwayat pembelian tetap utuh.</p>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-base font-semibold">Tambah pemasok</h2>
        <SupplierForm />
      </section>
      <section className="space-y-2">
        {suppliers.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Belum ada pemasok.</p> : null}
        {suppliers.map((s) => (
          <details key={s.id} className="rounded-xl border border-slate-200 bg-white">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-2">
              <span className="font-medium">{s.name}</span>
              <Badge tone={s.is_active ? "ok" : "muted"}>{s.is_active ? "Aktif" : "Nonaktif"}</Badge>
            </summary>
            <div className="border-t border-slate-100 p-4"><SupplierForm supplier={s} /></div>
          </details>
        ))}
      </section>
    </div>
  );
}
