"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveProduct } from "../actions";
import { ImageField } from "@/components/admin/image-field";
import { Field, FormMessage, SubmitButton, inputClass, buttonClass } from "@/components/admin/form-ui";

export type ProductFormData = {
  id: string;
  name: string;
  category_id: string | null;
  sku: string | null;
  description: string | null;
  price: number;
  unit: string;
  image_path: string | null;
  is_active: boolean;
};

export function ProductForm({
  product,
  categories,
  costPrice,
}: {
  product?: ProductFormData;
  categories: { id: string; name: string }[];
  costPrice?: number | null;
}) {
  const [state, action] = useActionState(saveProduct, null);
  const v = (k: string, fallback: string) => state?.values?.[k] ?? fallback;
  const e = state?.errors ?? {};

  return (
    <form action={action} className="space-y-4">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}

      <Field label="Foto produk" htmlFor="image">
        <ImageField initialPath={product?.image_path ?? null} />
      </Field>

      <Field label="Nama produk" htmlFor="name" error={e.name}>
        <input id="name" name="name" required maxLength={150} defaultValue={v("name", product?.name ?? "")} className={inputClass} />
      </Field>

      <Field label="Kategori" htmlFor="category_id" error={e.category_id}>
        <select
          id="category_id"
          name="category_id"
          defaultValue={v("category_id", product?.category_id ?? "")}
          className={inputClass}
        >
          <option value="">Tanpa kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Harga jual (Rp)" htmlFor="price" error={e.price}>
          <input
            id="price"
            name="price"
            inputMode="numeric"
            required
            placeholder="15000"
            defaultValue={v("price", product ? String(product.price) : "")}
            className={inputClass}
          />
        </Field>
        <Field label="Harga pokok (Rp)" htmlFor="cost_price" error={e.cost_price} hint="Opsional. Tidak terlihat oleh pelanggan.">
          <input
            id="cost_price"
            name="cost_price"
            inputMode="numeric"
            defaultValue={v("cost_price", costPrice != null ? String(costPrice) : "")}
            className={inputClass}
          />
        </Field>
        <Field label="Satuan" htmlFor="unit" error={e.unit}>
          <input id="unit" name="unit" required maxLength={20} defaultValue={v("unit", product?.unit ?? "pcs")} className={inputClass} />
        </Field>
        <Field label="SKU / kode" htmlFor="sku" error={e.sku} hint="Opsional.">
          <input id="sku" name="sku" maxLength={50} defaultValue={v("sku", product?.sku ?? "")} className={inputClass} />
        </Field>
      </div>

      <Field label="Deskripsi" htmlFor="description" error={e.description} hint="Opsional.">
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={1000}
          defaultValue={v("description", product?.description ?? "")}
          className={inputClass}
        />
      </Field>

      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="is_active"
          className="h-5 w-5 accent-emerald-700"
          defaultChecked={state?.values ? state.values.is_active === "on" : (product?.is_active ?? true)}
        />
        Tampilkan di katalog pelanggan
      </label>

      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton>{product ? "Simpan perubahan" : "Tambah produk"}</SubmitButton>
        <Link href="/admin/products" className={buttonClass.secondary}>
          Kembali
        </Link>
      </div>
    </form>
  );
}
