"use client";

import { useActionState } from "react";
import { rejectPayment, verifyPayment } from "./actions";
import { Field, FormMessage, SubmitButton, inputClass } from "@/components/admin/form-ui";
import { rupiah } from "@/lib/format";

export function VerifyForm({ paymentId, amount, expired }: { paymentId: string; amount: number; expired: boolean }) {
  const [state, action] = useActionState(verifyPayment, null);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="payment_id" value={paymentId} />
      {expired ? (
        <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
          Pesanan ini sudah kedaluwarsa. Verifikasi akan mencoba memesan ulang stok; bila stok habis, verifikasi
          ditolak dan dana perlu dikembalikan manual.
        </p>
      ) : null}
      <Field
        label="Nomor referensi mutasi"
        htmlFor={`ref-${paymentId}`}
        error={e.reference}
        hint="Dari mutasi resmi di aplikasi bank/e-wallet toko, bukan dari bukti kiriman pelanggan."
      >
        <input id={`ref-${paymentId}`} name="reference" required minLength={3} maxLength={100}
          defaultValue={state?.values?.reference ?? ""} className={inputClass} />
      </Field>
      <Field
        label="Nominal masuk di mutasi (Rp)"
        htmlFor={`amt-${paymentId}`}
        error={e.amount_received}
        hint={`Tagihan: ${rupiah(amount)}. Harus sama persis.`}
      >
        <input id={`amt-${paymentId}`} name="amount_received" inputMode="numeric" required
          defaultValue={state?.values?.amount_received ?? ""} className={inputClass} />
      </Field>
      <Field label="Catatan" htmlFor={`note-${paymentId}`} hint="Opsional.">
        <input id={`note-${paymentId}`} name="note" maxLength={200} defaultValue={state?.values?.note ?? ""} className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingText="Memverifikasi…">Dana sudah masuk — verifikasi</SubmitButton>
    </form>
  );
}

export function RejectForm({ paymentId }: { paymentId: string }) {
  const [state, action] = useActionState(rejectPayment, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="payment_id" value={paymentId} />
      <Field label="Alasan penolakan" htmlFor={`rej-${paymentId}`} error={state?.errors?.reason}
        hint="Pelanggan akan melihat alasan ini. Mis. dana belum masuk, nominal berbeda.">
        <input id={`rej-${paymentId}`} name="reason" required maxLength={200}
          defaultValue={state?.values?.reason ?? ""} className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton variant="danger" pendingText="Menolak…">Tolak pembayaran</SubmitButton>
    </form>
  );
}
