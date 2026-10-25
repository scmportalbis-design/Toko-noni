"use client";

import Link from "next/link";
import { useOrders } from "@/lib/stores/orders";
import { useHydration } from "@/lib/stores/hydrate";
import { rupiah } from "@/lib/format";

export function OrderHistoryList() {
  const hydrated = useHydration((s) => s.done);
  const orders = useOrders((s) => s.orders);

  if (!hydrated) return <p className="py-10 text-center text-sm text-stone-500">Memuat…</p>;
  if (orders.length === 0)
    return (
      <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
        Belum ada pesanan dari perangkat ini.
      </p>
    );

  return (
    <ul className="space-y-2">
      {orders.map((o) => (
        <li key={o.orderNumber}>
          <Link
            href={`/pesanan/${encodeURIComponent(o.orderNumber)}?t=${encodeURIComponent(o.token)}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4 hover:bg-stone-50"
          >
            <div>
              <p className="font-semibold">{o.orderNumber}</p>
              <p className="text-xs text-stone-500">
                {new Date(o.createdAt).toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Jakarta",
                })}
              </p>
            </div>
            <span className="text-sm font-medium">{rupiah(o.total)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
