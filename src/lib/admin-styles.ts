// Kelas Tailwind bersama untuk panel admin.
// Ini modul biasa (BUKAN "use client") supaya Server Component boleh mengimpor konstanta
// langsung. Jangan mengimpor konstanta dari components/admin/form-ui.tsx di Server Component:
// modul "use client" hanya mengekspor referensi klien ke server, bukan nilainya.

export const inputClass =
  "block w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 " +
  "placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 " +
  "disabled:bg-slate-100";

const buttonBase =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export const buttonClass = {
  primary: `${buttonBase} bg-emerald-700 text-white hover:bg-emerald-800`,
  secondary: `${buttonBase} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`,
  danger: `${buttonBase} border border-red-300 bg-white text-red-700 hover:bg-red-50`,
};
