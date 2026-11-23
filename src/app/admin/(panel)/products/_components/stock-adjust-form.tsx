"use client";

import { useActionState } from "react";
import { adjustStock } from "../actions";
import { Field, FormMessage, SubmitButton, inputClass } from "@/components/admin/form-ui";

export function StockAdjustForm({ productId, today }: { productId: string; today: string }) {
  const [state, action] = useActionState(adjustStock, null);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="product_id" value={productId} />
      <Field
        label="Perubahan stok"
        htmlFor="delta"
        error={e.delta}
        hint="Positif menambah, negatif mengurangi (keluar mengikuti FIFO). Contoh: 24 atau -2."
      >
        <input
          id="delta"
          name="delta"
          inputMode="numeric"
          required
          defaultValue={state?.ok ? "" : (state?.values?.delta ?? "")}
          className={inputClass}
        />
      </Field>
      <Field
        label="Tanggal kedaluwarsa batch baru"
        htmlFor="expiry_date"
        error={e.expiry_date}
        hint="WAJIB bila menambah stok (angka positif): stok masuk menjadi batch baru. Abaikan bila mengurangi stok."
      >
        <input
          id="expiry_date"
          name="expiry_date"
          type="date"
          min={today}
          defaultValue={state?.ok ? "" : (state?.values?.expiry_date ?? "")}
          className={inputClass}
        />
      </Field>
      <Field label="Alasan" htmlFor="reason" error={e.reason} hint="Mis. stok awal, opname, barang rusak.">
        <input
          id="reason"
          name="reason"
          required
          maxLength={200}
          defaultValue={state?.ok ? "" : (state?.values?.reason ?? "")}
          className={inputClass}
        />
      </Field>
      <FormMessage state={state} />
      <SubmitButton variant="secondary">Simpan koreksi stok</SubmitButton>
    </form>
  );
}
