"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { generatePassword, validateNewPassword } from "@/lib/password";
import { rpcMessage } from "@/lib/rpc-errors";
import type { ActionState } from "@/lib/action-state";
import { FormMessage, buttonClass, inputClass } from "@/components/admin/form-ui";

// Tombol "Reset password" untuk pemilik. Berjalan di browser dan memanggil fungsi database
// owner_reset_user_password (pengecekan pemilik dilakukan di database, bukan di sini).
export function ResetPasswordForm({ userId, name }: { userId: string; name: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<ActionState>(null);

  function fillRandom() {
    const p = generatePassword(12);
    setPassword(p);
    setConfirm(p);
    setShow(true);
    setState(null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const problem = validateNewPassword(password, confirm);
    if (problem) {
      setState({ ok: false, message: problem });
      return;
    }
    if (!window.confirm(`Reset password ${name}? Password lama langsung tidak berlaku dan ${name} akan keluar dari semua perangkat.`)) {
      return;
    }
    setPending(true);
    setState(null);
    const { error } = await createClient().rpc("owner_reset_user_password", {
      p_user_id: userId,
      p_new_password: password,
    });
    setPending(false);
    if (error) {
      setState({ ok: false, message: rpcMessage(error) });
      return;
    }
    setState({
      ok: true,
      message: show
        ? `Password ${name} sudah direset. Password baru: ${password} — sampaikan langsung dan minta diganti.`
        : `Password ${name} sudah direset.`,
    });
    setPassword("");
    setConfirm("");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">Reset password</h3>
      <input
        type={show ? "text" : "password"}
        autoComplete="new-password"
        aria-label="Password baru"
        placeholder="Password baru (min. 8 karakter)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={inputClass}
      />
      <input
        type={show ? "text" : "password"}
        autoComplete="new-password"
        aria-label="Ulangi password baru"
        placeholder="Ulangi password baru"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className={inputClass}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-5 w-5 accent-emerald-700" />
          Tampilkan
        </label>
        <button type="button" onClick={fillRandom} className={buttonClass.secondary}>
          Buat acak
        </button>
      </div>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className={buttonClass.danger}>
        {pending ? "Mereset…" : "Reset password"}
      </button>
    </form>
  );
}
