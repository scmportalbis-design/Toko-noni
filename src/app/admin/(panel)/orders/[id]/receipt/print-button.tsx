"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()}
      className="inline-flex min-h-11 items-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">
      Cetak
    </button>
  );
}
