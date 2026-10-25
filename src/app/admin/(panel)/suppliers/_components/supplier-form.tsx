"use client";

import { useActionState } from "react";
import { saveSupplier } from "../actions";
import { Field, FormMessage, SubmitButton, inputClass } from "@/components/admin/form-ui";

export type SupplierRow = { id: string; name: string; phone: string | null; address: string | null; note: string | null; is_active: boolean };

export function SupplierForm({ supplier }: { supplier?: SupplierRow }) {
  const [state, action] = useActionState(saveSupplier, null);
  const v = (k: string, fb: string | null | undefined) => state?.values?.[k] ?? fb ?? "";
  const e = state?.errors ?? {};
  const uid = supplier?.id ?? "new";
  return (
    <form action={action} className="space-y-3">
      {supplier ? <input type="hidden" name="id" value={supplier.id} /> : null}
      <Field label="Nama pemasok" htmlFor={`sn-${uid}`} error={e.name}>
        <input id={`sn-${uid}`} name="name" required maxLength={150} defaultValue={v("name", supplier?.name)} className={inputClass} />
      </Field>
      <Field label="Telepon" htmlFor={`sp-${uid}`} error={e.phone} hint="Opsional.">
        <input id={`sp-${uid}`} name="phone" type="tel" inputMode="tel" maxLength={30} defaultValue={v("phone", supplier?.phone)} className={inputClass} />
      </Field>
      <Field label="Alamat" htmlFor={`sa-${uid}`} error={e.address} hint="Opsional.">
        <input id={`sa-${uid}`} name="address" maxLength={300} defaultValue={v("address", supplier?.address)} className={inputClass} />
      </Field>
      <Field label="Catatan" htmlFor={`sc-${uid}`} error={e.note} hint="Opsional.">
        <input id={`sc-${uid}`} name="note" maxLength={300} defaultValue={v("note", supplier?.note)} className={inputClass} />
      </Field>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="is_active" className="h-5 w-5 accent-emerald-700"
          defaultChecked={state?.values ? state.values.is_active === "on" : (supplier?.is_active ?? true)} />
        Pemasok aktif
      </label>
      <FormMessage state={state} />
      <SubmitButton>{supplier ? "Simpan perubahan" : "Tambah pemasok"}</SubmitButton>
    </form>
  );
}
