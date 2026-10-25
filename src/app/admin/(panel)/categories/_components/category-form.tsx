"use client";

import { useActionState } from "react";
import { saveCategory } from "../actions";
import { Field, FormMessage, SubmitButton, inputClass } from "@/components/admin/form-ui";

export type CategoryRow = { id: string; name: string; sort_order: number; is_active: boolean };

export function CategoryForm({ category }: { category?: CategoryRow }) {
  const [state, action] = useActionState(saveCategory, null);
  const v = (k: string, fallback: string) => state?.values?.[k] ?? fallback;
  const uid = category?.id ?? "new";

  return (
    <form action={action} className="space-y-3">
      {category ? <input type="hidden" name="id" value={category.id} /> : null}
      <Field label="Nama kategori" htmlFor={`name-${uid}`} error={state?.errors?.name}>
        <input
          id={`name-${uid}`}
          name="name"
          required
          maxLength={80}
          defaultValue={v("name", category?.name ?? "")}
          className={inputClass}
        />
      </Field>
      <Field
        label="Urutan tampil"
        htmlFor={`sort-${uid}`}
        error={state?.errors?.sort_order}
        hint="Angka kecil tampil lebih dulu."
      >
        <input
          id={`sort-${uid}`}
          name="sort_order"
          inputMode="numeric"
          defaultValue={v("sort_order", String(category?.sort_order ?? 0))}
          className={inputClass}
        />
      </Field>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="is_active"
          className="h-5 w-5 accent-emerald-700"
          defaultChecked={state?.values ? state.values.is_active === "on" : (category?.is_active ?? true)}
        />
        Tampilkan di katalog pelanggan
      </label>
      <FormMessage state={state} />
      <SubmitButton>{category ? "Simpan perubahan" : "Tambah kategori"}</SubmitButton>
    </form>
  );
}
