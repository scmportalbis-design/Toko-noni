"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action-state";

export const inputClass =
  "block w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 " +
  "placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 " +
  "disabled:bg-slate-100";

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

const buttonBase =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export const buttonClass = {
  primary: `${buttonBase} bg-emerald-700 text-white hover:bg-emerald-800`,
  secondary: `${buttonBase} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`,
  danger: `${buttonBase} border border-red-300 bg-white text-red-700 hover:bg-red-50`,
};

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
