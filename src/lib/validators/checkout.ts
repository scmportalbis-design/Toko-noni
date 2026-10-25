import { z } from "zod";

export const checkoutSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(100, "Maksimal 100 karakter"),
  phone: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => /^\+?[0-9]{8,15}$/.test(v), { message: "Nomor HP tidak valid (8–15 angka)" }),
  note: z.string().trim().max(500, "Maksimal 500 karakter"),
  key: z.string().min(8).max(100),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        qty: z.number().int().min(1).max(99),
      }),
    )
    .min(1, "Keranjang masih kosong")
    .max(50),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;
