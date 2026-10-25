"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// Riwayat pesanan tamu, disimpan HANYA di perangkat ini (nomor + token akses).
export type SavedOrder = { orderNumber: string; token: string; total: number; createdAt: string };

type OrdersState = {
  orders: SavedOrder[];
  add: (o: SavedOrder) => void;
};

export const useOrders = create<OrdersState>()(
  persist(
    (set) => ({
      orders: [],
      add: (o) =>
        set((s) => ({
          orders: [o, ...s.orders.filter((x) => x.orderNumber !== o.orderNumber)].slice(0, 20),
        })),
    }),
    { name: "toko-noni-orders", version: 1, skipHydration: true },
  ),
);
