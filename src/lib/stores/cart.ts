"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  unit: string;
  imagePath: string | null;
  qty: number;
  max: number; // stok tersedia saat terakhir dicek
};

export type ServerRow = {
  id: string;
  name: string;
  price: number;
  available: number;
  image_path: string | null;
};

type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  applyServerData: (rows: ServerRow[]) => string[]; // mengembalikan catatan perubahan
};

const HARD_MAX = 99;
const clamp = (qty: number, max: number) => Math.max(1, Math.min(qty, Math.min(max, HARD_MAX)));

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.productId === item.productId);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.productId === item.productId
                  ? { ...i, ...item, qty: clamp(i.qty + qty, item.max) }
                  : i,
              ),
            };
          }
          return { items: [...s.items, { ...item, qty: clamp(qty, item.max) }] };
        }),
      setQty: (productId, qty) =>
        set((s) => ({
          items: s.items.map((i) => (i.productId === productId ? { ...i, qty: clamp(qty, i.max) } : i)),
        })),
      remove: (productId) => set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      clear: () => set({ items: [] }),
      applyServerData: (rows) => {
        const notes: string[] = [];
        const byId = new Map(rows.map((r) => [r.id, r]));
        const next: CartItem[] = [];
        for (const i of get().items) {
          const r = byId.get(i.productId);
          if (!r || r.available <= 0) {
            notes.push(`${i.name} sudah habis atau tidak tersedia, dihapus dari keranjang.`);
            continue;
          }
          const qty = clamp(i.qty, r.available);
          if (qty < i.qty) notes.push(`Jumlah ${i.name} disesuaikan menjadi ${qty} (stok tersedia).`);
          if (r.price !== i.price) notes.push(`Harga ${i.name} berubah.`);
          next.push({ ...i, name: r.name, price: r.price, imagePath: r.image_path, max: r.available, qty });
        }
        set({ items: next });
        return notes;
      },
    }),
    {
      name: "toko-noni-cart",
      version: 1,
      skipHydration: true, // dipulihkan manual setelah mount, agar HTML server = HTML klien
      partialize: (s) => ({ items: s.items }),
    },
  ),
);
