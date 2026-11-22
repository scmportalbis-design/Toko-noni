import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Masuk — Toko Noni",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const { reset } = await searchParams;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-8 text-slate-900">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">Toko Noni</h1>
          <p className="text-sm text-slate-500">Masuk untuk pemilik dan kasir</p>
        </div>
        {reset === "1" ? (
          <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Password berhasil diubah. Silakan masuk dengan password baru.
          </p>
        ) : null}
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
