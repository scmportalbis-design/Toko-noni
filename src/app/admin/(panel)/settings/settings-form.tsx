"use client";

import { useActionState } from "react";
import { saveSettings } from "./actions";
import { ImageField } from "@/components/admin/image-field";
import { Field, FormMessage, SubmitButton, inputClass } from "@/components/admin/form-ui";

export function SettingsForm({ qrisPath, expiryMinutes }: { qrisPath: string | null; expiryMinutes: number }) {
  const [state, action] = useActionState(saveSettings, null);
  return (
    <form action={action} className="space-y-5">
      <Field label="Gambar QRIS toko" htmlFor="qris">
        <ImageField initialPath={qrisPath} bucket="store-assets" prefix="qris" name="qris_image_path"
          emptyText="Belum ada QRIS" previewClass="h-56 w-56" />
      </Field>
      <Field label="Batas waktu pembayaran (menit)" htmlFor="order_expiry_minutes"
        error={state?.errors?.order_expiry_minutes}
        hint="Stok dipesan selama waktu ini. Pesanan yang belum dibayar lewat batas ini kedaluwarsa otomatis.">
        <input id="order_expiry_minutes" name="order_expiry_minutes" inputMode="numeric" required
          defaultValue={state?.values?.order_expiry_minutes ?? String(expiryMinutes)} className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton>Simpan pengaturan</SubmitButton>
    </form>
  );
}
