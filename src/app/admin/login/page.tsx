import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Masuk — Toko Noni",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-8 text-slate-900">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">Toko Noni</h1>
          <p className="text-sm text-slate-500">Masuk untuk pemilik dan kasir</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
