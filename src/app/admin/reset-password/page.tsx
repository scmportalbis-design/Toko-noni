import type { Metadata } from "next";
import { AuthCard } from "@/components/admin/auth-card";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = {
  title: "Password baru — Toko Noni",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Buat password baru" subtitle="Masukkan password baru untuk akun adminmu.">
      <ResetForm />
    </AuthCard>
  );
}
