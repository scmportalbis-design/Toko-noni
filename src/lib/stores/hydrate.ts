"use client";

import { create } from "zustand";
import { useCart } from "./cart";
import { useOrders } from "./orders";

// Komponen membaca `done` agar tidak menampilkan isi keranjang sebelum dipulihkan dari localStorage.
export const useHydration = create<{ done: boolean }>(() => ({ done: false }));

export async function hydrateStores() {
  await Promise.all([useCart.persist.rehydrate(), useOrders.persist.rehydrate()]);
  useHydration.setState({ done: true });
}
