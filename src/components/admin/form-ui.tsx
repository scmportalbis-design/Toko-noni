"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action-state";

import { inputClass, buttonClass } from "@/lib/admin-styles";

// Diekspor ulang hanya untuk komponen klien yang sudah mengimpor dari sini.
// Server Component: impor langsung dari "@/lib/admin-styles".
export { inputClass, buttonClass };

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  children,
  pendingText = "Menyimpan…",
  variant = "primary",
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: keyof typeof buttonClass;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass[variant]}>
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state?.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`rounded-lg px-3 py-2 text-sm ${
        state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
      }`}
    >
      {state.message}
    </p>
  );
}
