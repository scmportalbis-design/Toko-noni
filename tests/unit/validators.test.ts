import { describe, expect, it } from "vitest";
import { checkoutSchema } from "@/lib/validators/checkout";
import { categorySchema, productSchema } from "@/lib/validators/catalog";
import { purchaseSchema } from "@/lib/validators/purchasing";

const uuid = "8ce987d3-58cb-49c4-8f31-829a1c27809b";
const uuid2 = "11111111-2222-4333-8444-555555555555";

describe("checkoutSchema", () => {
  const base = { name: "Budi", phone: "0812-3456 7890", note: "", key: "kunci-uji-12345", items: [{ productId: uuid, qty: 2 }] };
  it("menormalkan nomor HP", () => {
    const r = checkoutSchema.safeParse(base);
    expect(r.success && r.data.phone).toBe("081234567890");
  });
  it("menolak nomor pendek, keranjang kosong, dan qty 0", () => {
    expect(checkoutSchema.safeParse({ ...base, phone: "123" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, items: [{ productId: uuid, qty: 0 }] }).success).toBe(false);
  });
});

describe("catalog schemas", () => {
  const product = { name: "Roti", category_id: null, sku: null, description: null, price: 15000, cost_price: null, unit: "pcs", image_path: null, is_active: true };
  it("produk valid", () => expect(productSchema.safeParse(product).success).toBe(true));
  it("harga wajib diisi", () => {
    const r = productSchema.safeParse({ ...product, price: null });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Harga wajib diisi");
  });
  it("path gambar harus di folder products/", () => {
    expect(productSchema.safeParse({ ...product, image_path: "../rahasia.png" }).success).toBe(false);
    expect(productSchema.safeParse({ ...product, image_path: "products/abc.webp" }).success).toBe(true);
  });
  it("nama kategori wajib", () => expect(categorySchema.safeParse({ name: " ", sort_order: 0, is_active: true }).success).toBe(false));
});

describe("purchaseSchema", () => {
  const base = { supplier_id: null, purchase_date: "2026-10-24", note: null, items: [{ product_id: uuid, qty: 5, unit_cost: 1000 }] };
  it("valid", () => expect(purchaseSchema.safeParse(base).success).toBe(true));
  it("menolak produk ganda dan daftar kosong", () => {
    expect(purchaseSchema.safeParse({ ...base, items: [base.items[0], base.items[0]] }).success).toBe(false);
    expect(purchaseSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(purchaseSchema.safeParse({ ...base, items: [base.items[0], { ...base.items[0], product_id: uuid2 }] }).success).toBe(true);
  });
});
