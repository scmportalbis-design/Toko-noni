"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ActionState } from "@/lib/action-state";
import { Field, FormMessage, buttonClass, inputClass } from "@/components/admin/form-ui";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<ActionState>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = email.trim();
    if (!value) {
      setState({ ok: false, message: "Email wajib diisi." });
      return;
    }
    setPending(true);
    setState(null);
    // Berjalan di browser: Supabase Auth mengirim email berisi tautan ke /admin/reset-password.
    const { error } = await createClient().auth.resetPasswordForEmail(value, {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    });
    setPending(false);
    if (error) {
      setState({
        ok: false,
        message:
          error.status === 429
            ? "Terlalu banyak permintaan. Tunggu beberapa menit lalu coba lagi."
            : "Gagal mengirim permintaan. Coba lagi.",
      });
      return;
    }
    // Pesan sengaja umum: tidak membocorkan apakah email terdaftar.
    setState({
      ok: true,
      message: "Jika email terdaftar, tautan untuk membuat password baru sudah dikirim. Periksa kotak masuk dan folder spam.",
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Email" htmlFor="email">
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </Field>
      <FormMessage state={state} />
      <div className="[&>button]:w-full">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Mengirim…" : "Kirim tautan reset"}
        </button>
      </div>
    </form>
  );
}
