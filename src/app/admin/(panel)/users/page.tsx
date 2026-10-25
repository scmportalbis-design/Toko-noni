import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";
import { Badge } from "@/components/admin/badge";
import { StaffForm } from "./staff-form";

type P = { id: string; full_name: string; role: string; is_active: boolean };

export default async function UsersPage() {
  const staff = await getStaff();
  if (staff?.role !== "owner") redirect("/admin");
  const { data } = await (await createClient()).from("profiles").select("id, full_name, role, is_active").order("full_name");
  const people = (data ?? []) as P[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Pengguna</h1>
        <p className="text-sm text-slate-500">Pemilik dan kasir yang bisa masuk ke admin.</p>
      </div>
      <ul className="space-y-2">
        {people.map((p) => (
          <li key={p.id}>
            {p.id === staff.id ? (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                <span className="font-medium">{p.full_name} <span className="text-slate-400">(kamu)</span></span>
                <Badge tone="ok">Pemilik</Badge>
              </div>
            ) : (
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-2">
                  <span className="font-medium">{p.full_name}</span>
                  <span className="flex gap-1.5"><Badge>{p.role === "owner" ? "Pemilik" : "Kasir"}</Badge><Badge tone={p.is_active ? "ok" : "bad"}>{p.is_active ? "Aktif" : "Nonaktif"}</Badge></span>
                </summary>
                <div className="border-t border-slate-100 p-4"><StaffForm id={p.id} role={p.role} isActive={p.is_active} /></div>
              </details>
            )}
          </li>
        ))}
      </ul>
      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <h2 className="text-base font-semibold">Menambah kasir baru</h2>
        <ol className="list-decimal space-y-1 pl-5 text-slate-700">
          <li>Di dashboard Supabase buka Authentication → Users → Add user (isi email &amp; password, centang Auto Confirm).</li>
          <li>Di SQL Editor jalankan (ganti email dan nama):</li>
        </ol>
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{`insert into public.profiles (id, full_name, role)
select id, 'Nama Kasir', 'cashier'
from auth.users where email = 'EMAIL_KASIR';`}</pre>
        <p className="text-xs text-slate-500">Pembuatan akun dari halaman ini belum tersedia karena butuh kunci rahasia server.</p>
      </section>
    </div>
  );
}
