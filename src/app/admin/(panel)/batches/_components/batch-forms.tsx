"use client";

import { useActionState, useState } from "react";
import { disposeBatch, setBatchExpiry } from "../actions";
import { Field, FormMessage, SubmitButton } from "@/components/admin/form-ui";
import { inputClass } from "@/lib/admin-styles";
import { lossEstimate } from "@/lib/batch";
import { rupiah } from "@/lib/format";

export function SetExpiryForm({ batchId, current }: { batchId: string; current: string | null }) {
  const [state, action] = useActionState(setBatchExpiry, null);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="batch_id" value={batchId} />
      <Field label="Tanggal kedaluwarsa" htmlFor={`exp-${batchId}`} error={e.expiry_date}
        hint="Hari terakhir barang masih boleh dijual.">
        <input id={`exp-${batchId}`} name="expiry_date" type="date" required defaultValue={state?.values?.expiry_date ?? current ?? ""} className={inputClass} />
      </Field>
      <Field label={current ? "Alasan koreksi" : "Alasan (opsional)"} htmlFor={`why-${batchId}`} error={e.reason}
        hint={current ? "Wajib saat mengubah tanggal yang sudah terisi." : "Pengisian pertama untuk stok lama tidak butuh alasan."}>
        <input id={`why-${batchId}`} name="reason" maxLength={200} required={!!current} defaultValue={state?.values?.reason ?? ""} className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton variant="secondary">Simpan tanggal</SubmitButton>
    </form>
  );
}

export function DisposeForm({ batchId, remaining, unitCost, expired }: { batchId: string; remaining: number; unitCost: number; expired: boolean }) {
  const [state, action] = useActionState(disposeBatch, null);
  const [qty, setQty] = useState(String(remaining));
  const [mode, setMode] = useState<"loss" | "system">("loss");
  const e = state?.errors ?? {};
  const n = Number(qty.replace(/\D/g, "")) || 0;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="batch_id" value={batchId} />
      <input type="hidden" name="mode" value={mode} />
      {!expired ? (
        <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Batch ini belum kedaluwarsa. Buang hanya bila barangnya memang rusak atau tidak layak.</p>
      ) : null}
      <Field label="Jumlah dibuang" htmlFor={`qty-${batchId}`} error={e.qty} hint={`Sisa batch ${remaining}.`}>
        <input id={`qty-${batchId}`} name="qty" inputMode="numeric" required value={qty} onChange={(ev) => setQty(ev.target.value)} className={inputClass} />
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Cara pencatatan</legend>
        <label className={`flex min-h-11 cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${mode === "loss" ? "border-emerald-600 bg-emerald-50" : "border-slate-300 bg-white"}`}>
          <input type="radio" name="mode_ui" checked={mode === "loss"} onChange={() => setMode("loss")} className="mt-1" />
          <span>
            <strong>Hitung sebagai kerugian</strong>
            <span className="block text-xs text-slate-600">
              Masuk laporan laba rugi. Perkiraan kerugian {rupiah(lossEstimate(n, unitCost))} (harga pokok {rupiah(unitCost)} per satuan).
            </span>
          </span>
        </label>
        <label className={`flex min-h-11 cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${mode === "system" ? "border-emerald-600 bg-emerald-50" : "border-slate-300 bg-white"}`}>
          <input type="radio" name="mode_ui" checked={mode === "system"} onChange={() => setMode("system")} className="mt-1" />
          <span>
            <strong>Keluarkan dari sistem saja</strong>
            <span className="block text-xs text-slate-600">
              Untuk barang yang dijual atau dibuang di luar sistem. Stok berkurang, tidak dicatat sebagai kerugian.
            </span>
          </span>
        </label>
        {e.mode ? <p role="alert" className="text-sm text-red-600">{e.mode}</p> : null}
      </fieldset>

      <Field label="Alasan" htmlFor={`rs-${batchId}`} error={e.reason} hint="Mis. kedaluwarsa, dijual murah di luar sistem, rusak.">
        <input id={`rs-${batchId}`} name="reason" required maxLength={200} defaultValue={state?.values?.reason ?? ""} className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton variant="danger" pendingText="Memproses…">Buang batch</SubmitButton>
    </form>
  );
}
