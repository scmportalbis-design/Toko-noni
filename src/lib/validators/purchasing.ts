import { z } from "zod";

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Nama pemasok wajib diisi").max(150, "Maksimal 150 karakter"),
  phone: z.string().trim().max(30, "Maksimal 30 karakter").nullable(),
  address: z.string().trim().max(300, "Maksimal 300 karakter").nullable(),
  note: z.string().trim().max(300, "Maksimal 300 karakter").nullable(),
  is_active: z.boolean(),
});

export const purchaseSchema = z.object({
  supplier_id: z.string().uuid("Pemasok tidak valid").nullable(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  note: z.string().trim().max(300, "Maksimal 300 karakter").nullable(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        qty: z.number().int().min(1).max(100000),
        unit_cost: z.number().int().min(0).max(1_000_000_000),
      }),
    )
    .min(1, "Tambahkan minimal satu barang")
    .max(100)
    .refine((a) => new Set(a.map((i) => i.product_id)).size === a.length, { message: "Ada produk yang dipilih dua kali" }),
});
