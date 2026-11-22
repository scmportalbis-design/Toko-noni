"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { validateNewPassword } from "@/lib/password";
import type { ActionState } from "@/lib/action-state";
import { Field, FormMessage, buttonClass, inputClass } from "@/components/admin/form-ui";

type Phase = "checking" | "ready" | "invalid";

export function ResetForm() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<ActionState>(null);
  const started = useRef(false); // cegah dua kali jalan (token sekali pakai) di mode dev

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const supabase = createClient();
      const params = new URLSearchParams(window.location.search);
      const hasError = window.location.hash.includes("error");

      // Format tautan email dengan token_hash (jika template email di Supabase diubah).
      const tokenHash = params.get("token_hash");
      if (tokenHash && params.get("type") === "recovery") {
        const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
        if (error) {
          setPhase("invalid");
          return;
        }
      }
      // Format bawaan (PKCE): klien Supabase menukar ?code=... menjadi sesi saat getSession().
      const {
        data: { session },
      } = await supabase.auth.getSession();
      window.history.replaceState(null, "", window.location.pathname); // buang token dari URL
      setPhase(session && !hasError ? "ready" : "invalid");
    })();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const problem = validateNewPassword(password, confirm);
    if (problem) {
      setState({ ok: false, message: problem });
      return;
    }
    setPending(true);
    setState(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setPending(false);
      setState({
        ok: false,
        message:
          error.code === "same_password"
            ? "Password baru harus berbeda dari yang lama."
            : error.code === "weak_password"
              ? "Password terlalu lemah. Gunakan kombinasi huruf dan angka."
              : "Gagal menyimpan password baru. Coba lagi atau minta tautan baru.",
      });
      return;
    }
    // Berhasil: keluar dulu, lalu masuk dengan password baru.
    await supabase.auth.signOut();
    window.location.assign("/admin/login?reset=1");
  }

  if (phase === "checking") {
    return <p className="text-center text-sm text-slate-500">Memeriksa tautan…</p>;
  }

  if (phase === "invalid") {
    return (
      <div className="space-y-4 text-center">
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Tautan tidak valid atau sudah kedaluwarsa. Buka tautan dari email di browser yang sama dengan yang kamu pakai
          untuk meminta reset, atau minta tautan baru.
        </p>
        <Link href="/admin/lupa-password" className="text-sm font-medium text-emerald-700 hover:underline">
          Minta tautan baru
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Password baru" htmlFor="password" hint="Minimal 8 karakter.">
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Ulangi password baru" htmlFor="confirm">
        <input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
        />
      </Field>
      <FormMessage state={state} />
      <div className="[&>button]:w-full">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Menyimpan…" : "Simpan password baru"}
        </button>
      </div>
    </form>
  );
}
