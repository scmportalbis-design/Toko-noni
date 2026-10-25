"use client";

import { useActionState } from "react";
import { adjustStock } from "../actions";
import { Field, FormMessage, SubmitButton, inputClass } from "@/components/admin/form-ui";

export function StockAdjustForm({ productId }: { productId: string }) {
  const [state, action] = useActionState(adjustStock, null);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="product_id" value={productId} />
      <Field
        label="Perubahan stok"
        htmlFor="delta"
        error={e.delta}
        hint="Positif menambah, negatif mengurangi. Contoh: 24 atau -2."
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
