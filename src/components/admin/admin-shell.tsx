import type { ReactNode } from "react";
import type { Staff } from "@/lib/auth";
import { signOut } from "@/app/admin/login/actions";
import { AdminNav } from "./admin-nav";

export function AdminShell({ staff, children }: { staff: Staff; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 print:bg-white">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-base font-semibold">Toko Noni</p>
            <p className="truncate text-xs text-slate-500">
              {staff.fullName} · {staff.role === "owner" ? "Pemilik" : "Kasir"}
            </p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Keluar
            </button>
          </form>
        </div>
        <AdminNav role={staff.role} />
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
