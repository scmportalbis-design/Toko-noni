import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthUser, getStaff } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { NoAccess } from "@/components/admin/no-access";

export const metadata: Metadata = {
  title: "Admin — Toko Noni",
  robots: { index: false, follow: false },
};

// Semua pembacaan sesi (cookie) ada di dalam <Suspense> agar kompatibel dengan Cache Components.
export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-sm text-slate-500">
          Memuat…
        </div>
      }
    >
      <PanelGate>{children}</PanelGate>
    </Suspense>
  );
}

async function PanelGate({ children }: { children: ReactNode }) {
  const user = await getAuthUser();
  if (!user) redirect("/admin/login");
  const staff = await getStaff();
  if (!staff) return <NoAccess email={user.email ?? null} />;
  return <AdminShell staff={staff}>{children}</AdminShell>;
}
