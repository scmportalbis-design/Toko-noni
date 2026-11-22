import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Masuk — Toko Noni",
  robots: { index: false, follow: false },
};

// searchParams dibaca di dalam <Suspense> agar halaman login tetap bisa diprarender
// (proyek ini memakai Cache Components).
async function ResetNotice({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const { reset } = await searchParams;
  if (reset !== "1") return null;
  return (
    <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      Password berhasil diubah. Silakan masuk dengan password baru.
    </p>
  );
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-8 text-slate-900">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">Toko Noni</h1>
          <p className="text-sm text-slate-500">Masuk untuk pemilik dan kasir</p>
        </div>
        <Suspense fallback={null}>
          <ResetNotice searchParams={searchParams} />
        </Suspense>
        <LoginForm />
        <p className="text-center text-sm">
          <Link href="/admin/lupa-password" className="font-medium text-emerald-700 hover:underline">
            Lupa password?
          </Link>
        </p>
      </div>
    </div>
  );
}