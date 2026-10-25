"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { placeOrder } from "@/app/(customer)/checkout/actions";
import { useCart } from "@/lib/stores/cart";
import { useOrders } from "@/lib/stores/orders";
import { useHydration } from "@/lib/stores/hydrate";
import { newId } from "@/lib/id";
import { rupiah } from "@/lib/format";
import { Field, btn, inputClass } from "./ui";

export function CheckoutForm() {
  const router = useRouter();
  const hydrated = useHydration((s) => s.done);
  const items = useCart((s) => s.items);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  // Satu kunci per percobaan checkout: kirim ulang (klik ganda / sinyal putus) = pesanan yang sama.
  // Dibuat lazily di handler: nilai acak tidak boleh dibuat saat prerender (Cache Components).
  const keyRef = useRef<string | null>(null); // dibuat saat submit, bukan saat render

  if (!hydrated) return <p className="py-10 text-center text-sm text-stone-500">Memuat…</p>;

  if (items.length === 0) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-stone-600">Keranjangmu kosong.</p>
        <Link href="/" className={btn.primary}>
          Lihat produk
        </Link>
      </div>
    );
  }

  const subtotal = items.reduce((n, i) => n + i.price * i.qty, 0);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    setErrors({});
    setMessage(null);
    startTransition(async () => {
      const res = await placeOrder({
        name: String(fd.get("name") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        note: String(fd.get("note") ?? ""),
        key: (keyRef.current ??= newId()),
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
      });
      if (!res.ok) {
        setErrors(res.errors ?? {});
        setMessage(res.message ?? null);
        return;
      }
      useOrders.getState().add({
        orderNumber: res.orderNumber,
        token: res.token,
        total: res.total,
        createdAt: new Date().toISOString(),
      });
      useCart.getState().clear();
      keyRef.current = null;
      router.push(`/pesanan/${encodeURIComponent(res.orderNumber)}?t=${encodeURIComponent(res.token)}`);
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-2 text-base font-semibold">Ringkasan</h2>
        <ul className="space-y-1 text-sm">
          {items.map((i) => (
            <li key={i.productId} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">
                {i.name} × {i.qty}
              </span>
              <span className="shrink-0">{rupiah(i.price * i.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-stone-100 pt-3 font-semibold">
          <span>Total</span>
          <span>{rupiah(subtotal)}</span>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Pesanan diambil di toko. Stok dipesankan untukmu selama waktu pembayaran.
        </p>
      </section>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="text-base font-semibold">Data pemesan</h2>
        <Field label="Nama" htmlFor="name" error={errors.name}>
          <input id="name" name="name" required maxLength={100} autoComplete="name" className={inputClass} />
        </Field>
        <Field label="Nomor HP" htmlFor="phone" error={errors.phone} hint="Dipakai toko bila perlu menghubungi kamu.">
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            required
            autoComplete="tel"
            placeholder="08123456789"
            className={inputClass}
          />
        </Field>
        <Field label="Catatan" htmlFor="note" error={errors.note} hint="Opsional.">
          <textarea id="note" name="note" rows={2} maxLength={500} className={inputClass} />
        </Field>

        {message ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {message}{" "}
            <Link href="/keranjang" className="font-medium underline">
              Cek keranjang
            </Link>
          </p>
        ) : null}

        <button type="submit" disabled={pending} className={`${btn.primary} w-full`}>
          {pending ? "Membuat pesanan…" : "Buat pesanan"}
        </button>
      </form>
    </div>
  );
}
