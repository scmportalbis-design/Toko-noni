"use client";

import { useActionState } from "react";
import { cancelOrder, issueReceipt, setFulfillment } from "./actions";
import { Field, FormMessage, SubmitButton, inputClass } from "@/components/admin/form-ui";

const NEXT: Record<string, { to: string; label: string } | undefined> = {
  pending: { to: "preparing", label: "Mulai siapkan" },
  preparing: { to: "ready", label: "Tandai siap diambil" },
  ready: { to: "picked_up", label: "Tandai sudah diambil" },
};

export function FulfillmentButton({ orderId, current }: { orderId: string; current: string }) {
  const [state, action] = useActionState(setFulfillment, null);
  const next = NEXT[current];
  if (!next) return null;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="status" value={next.to} />
      <FormMessage state={state} />
      <SubmitButton pendingText="Memproses…">{next.label}</SubmitButton>
    </form>
  );
}

export function CancelOrderForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(cancelOrder, null);
  return (
    <form
      action={action}
      onSubmit={(e) => { if (!confirm("Batalkan pesanan ini?")) e.preventDefault(); }}
      className="space-y-3"
    >
      <input type="hidden" name="order_id" value={orderId} />
      <Field label="Alasan pembatalan" htmlFor="cancel-reason" error={state?.errors?.reason}>
        <input id="cancel-reason" name="reason" required maxLength={200} defaultValue={state?.values?.reason ?? ""} className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton variant="danger" pendingText="Membatalkan…">Batalkan pesanan</SubmitButton>
    </form>
  );
}

export function IssueReceiptButton({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(issueReceipt, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="order_id" value={orderId} />
      <FormMessage state={state} />
      <SubmitButton pendingText="Menerbitkan…">Terbitkan struk lunas</SubmitButton>
    </form>
  );
}
