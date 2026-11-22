import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/admin/auth-card";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = {
  title: "Lupa password — Toko Noni",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Lupa password" subtitle="Kami kirim tautan untuk membuat password baru ke emailmu.">
      <ForgotForm />
      <p className="text-center text-sm">
        <Link href="/admin/login" className="font-medium text-emerald-700 hover:underline">
          Kembali ke halaman masuk
        </Link>
      </p>
    </AuthCard>
  );
}
