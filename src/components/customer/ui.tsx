import type { ReactNode } from "react";

export const inputClass =
  "block w-full min-h-11 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-base text-stone-900 " +
  "placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20";

const base =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export const btn = {
  primary: `${base} bg-emerald-700 text-white hover:bg-emerald-800`,
  secondary: `${base} border border-stone-300 bg-white text-stone-800 hover:bg-stone-50`,
  danger: `${base} border border-red-300 bg-white text-red-700 hover:bg-red-50`,
};

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
      <label htmlFor={htmlFor} className="block text-sm font-medium text-stone-700">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-stone-500">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
