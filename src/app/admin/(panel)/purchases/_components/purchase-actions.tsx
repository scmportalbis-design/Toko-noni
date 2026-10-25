"use client";

import { useActionState } from "react";
import { cancelPurchase, receivePurchase } from "../actions";
import { FormMessage, SubmitButton } from "@/components/admin/form-ui";

export function PurchaseActions({ purchaseId }: { purchaseId: string }) {
  const [rState, rAction] = useActionState(receivePurchase, null);
  const [cState, cAction] = useActionState(cancelPurchase, null);
  return (
    <div className="space-y-3">
      <form action={rAction} onSubmit={(e) => { if (!confirm("Terima barang? Stok akan bertambah dan pembelian tidak bisa diubah lagi.")) e.preventDefault(); }} className="space-y-2">
        <input type="hidden" name="purchase_id" value={purchaseId} />
        <FormMessage state={rState} />
        <SubmitButton pendingText="Memproses…">Terima barang &amp; tambah stok</SubmitButton>
      </form>
      <form action={cAction} onSubmit={(e) => { if (!confirm("Batalkan draf pembelian ini?")) e.preventDefault(); }} className="space-y-2">
        <input type="hidden" name="purchase_id" value={purchaseId} />
        <FormMessage state={cState} />
        <SubmitButton variant="danger" pendingText="Membatalkan…">Batalkan draf</SubmitButton>
      </form>
    </div>
  );
}
