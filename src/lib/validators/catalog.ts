import { z } from "zod";

const MAX_RUPIAH = 1_000_000_000;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

const rupiahRequired = (label: string) =>
  z
    .number()
    .nullable()
    .refine((v) => v !== null, { message: `${label} wajib diisi` })
    .refine((v) => v === null || (v >= 0 && v <= MAX_RUPIAH), { message: `${label} tidak valid` });

const rupiahOptional = (label: string) =>
  z
    .number()
    .nullable()
    .refine((v) => v === null || (v >= 0 && v <= MAX_RUPIAH), { message: `${label} tidak valid` });

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama kategori wajib diisi")
    .max(80, "Maksimal 80 karakter"),
  sort_order: z
    .number()
    .nullable()
    .refine((v) => v === null || (v >= 0 && v <= 9999), { message: "Urutan 0 sampai 9999" }),
  is_active: z.boolean(),
});

export const productSchema = z.object({
  name: z.string().trim().min(1, "Nama produk wajib diisi").max(150, "Maksimal 150 karakter"),
  category_id: z.string().uuid("Kategori tidak valid").nullable(),
  sku: z.string().trim().max(50, "Maksimal 50 karakter").nullable(),
  description: z.string().trim().max(1000, "Maksimal 1000 karakter").nullable(),
  price: rupiahRequired("Harga"),
  cost_price: rupiahOptional("Harga pokok"),
  unit: z.string().trim().min(1, "Satuan wajib diisi").max(20, "Maksimal 20 karakter"),
  image_path: z
    .string()
    .regex(/^products\/[A-Za-z0-9._-]+$/, "Gambar tidak valid")
    .nullable(),
  is_active: z.boolean(),
});
