"use client";

import { useActionState, useRef, useState } from "react";
import { createPurchase } from "../actions";
import { Field, FormMessage, SubmitButton, inputClass } from "@/components/admin/form-ui";
import { rupiah } from "@/lib/format";

type Row = { key: number; productId: string; qty: string; cost: string };
const digits = (s: string) => Number(s.replace(/\D/g, "")) || 0;

export function PurchaseForm({
  suppliers, products, today,
}: {
  suppliers: { id: string; name: string }[];
  products: { id: string; name: string }[];
  today: string;
}) {
  const [state, action] = useActionState(createPurchase, null);
  const counter = useRef(1);
  const [rows, setRows] = useState<Row[]>([{ key: 0, productId: "", qty: "1", cost: "" }]);
  const e = state?.errors ?? {};

  const update = (key: number, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const items = rows.filter((r) => r.productId).map((r) => ({ product_id: r.productId, qty: digits(r.qty), unit_cost: digits(r.cost) }));
  const total = items.reduce((n, i) => n + i.qty * i.unit_cost, 0);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="items_json" value={JSON.stringify(items)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Pemasok" htmlFor="supplier_id" error={e.supplier_id} hint="Opsional.">
          <select id="supplier_id" name="supplier_id" defaultValue={state?.values?.supplier_id ?? ""} className={inputClass}>
            <option value="">Tanpa pemasok</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Tanggal pembelian" htmlFor="purchase_date" error={e.purchase_date}>
          <input id="purchase_date" name="purchase_date" type="date" required defaultValue={state?.values?.purchase_date ?? today} className={inputClass} />
        </Field>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold">Barang</h2>
        {rows.map((r, idx) => (
          <div key={r.key} className="space-y-2 rounded-lg border border-slate-200 p-3">
            <select aria-label={`Produk baris ${idx + 1}`} value={r.productId} onChange={(ev) => update(r.key, { productId: ev.target.value })} className={inputClass}>
              <option value="">Pilih produk…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input aria-label="Jumlah" inputMode="numeric" placeholder="Jumlah" value={r.qty} onChange={(ev) => update(r.key, { qty: ev.target.value })} className={inputClass} />
              <input aria-label="Harga beli satuan (Rp)" inputMode="numeric" placeholder="Harga beli /satuan" value={r.cost} onChange={(ev) => update(r.key, { cost: ev.target.value })} className={inputClass} />
            </div>
            {rows.length > 1 ? (
              <button type="button" onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))} className="min-h-11 text-sm text-red-700">Hapus baris</button>
            ) : null}
          </div>
        ))}
        <button type="button" onClick={() => setRows((x) => [...x, { key: counter.current++, productId: "", qty: "1", cost: "" }])}
          className="min-h-11 w-full rounded-lg border border-dashed border-slate-300 text-sm font-medium text-slate-700">
          + Tambah barang
        </button>
        {e.items ? <p role="alert" className="text-sm text-red-600">{e.items}</p> : null}
        <p className="text-right text-sm">Total: <span className="font-semibold">{rupiah(total)}</span></p>
      </div>

      <Field label="Catatan" htmlFor="note" error={e.note} hint="Opsional, mis. nomor nota pemasok.">
        <input id="note" name="note" maxLength={300} defaultValue={state?.values?.note ?? ""} className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton>Simpan sebagai draf</SubmitButton>
      <p className="text-xs text-slate-500">Draf belum menambah stok. Stok bertambah setelah kamu menekan &ldquo;Terima barang&rdquo;.</p>
    </form>
  );
}
