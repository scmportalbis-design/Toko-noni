"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaff, OWNER_ONLY_MESSAGE } from "@/lib/auth";
import { insertWithUniqueSlug } from "@/lib/slug";
import { bool, snapshot, str, toInt } from "@/lib/form-data";
import { isUuid } from "@/lib/format";
import { rpcMessage } from "@/lib/rpc-errors";
import { fieldErrors, productSchema } from "@/lib/validators/catalog";
import type { ActionState } from "@/lib/action-state";

const FIELDS = ["name", "category_id", "sku", "description", "price", "cost_price", "unit", "is_active"];

export async function saveProduct(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await getStaff();
  if (staff?.role !== "owner") return { ok: false, message: OWNER_ONLY_MESSAGE };

  const values = snapshot(fd, FIELDS);
  const id = str(fd, "id");
  if (id && !isUuid(id)) return { ok: false, message: "Produk tidak valid.", values };

  const parsed = productSchema.safeParse({
    name: String(fd.get("name") ?? ""),
    category_id: str(fd, "category_id"),
    sku: str(fd, "sku"),
    description: str(fd, "description"),
    price: toInt(str(fd, "price")),
    cost_price: toInt(str(fd, "cost_price")),
    unit: String(fd.get("unit") ?? ""),
    image_path: str(fd, "image_path"),
    is_active: bool(fd, "is_active"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), values };

  const d = parsed.data;
  const row = {
    name: d.name,
    category_id: d.category_id,
    sku: d.sku,
    description: d.description,
    price: d.price as number,
    unit: d.unit,
    image_path: d.image_path,
    is_active: d.is_active,
  };
  const supabase = await createClient();
  let productId = id;
  let oldImage: string | null = null;

  if (id) {
    const { data: current } = await supabase.from("products").select("image_path").eq("id", id).maybeSingle();
    oldImage = (current?.image_path as string | null) ?? null;
    const { data, error } = await supabase.from("products").update(row).eq("id", id).select("id");
    if (error) return productError(error, values);
    if (!data?.length) return { ok: false, message: "Produk tidak ditemukan.", values };
  } else {
    const res = await insertWithUniqueSlug(supabase, "products", row.name, row);
    if (res.error || !res.id) return productError(res.error ?? { message: "gagal" }, values);
    productId = res.id;
  }

  // Harga pokok disimpan terpisah (hanya terbaca pemilik).
  if (d.cost_price !== null) {
    await supabase.from("product_costs").upsert({ product_id: productId, cost_price: d.cost_price });
  } else if (id) {
    await supabase.from("product_costs").delete().eq("product_id", id);
  }

  // Hapus file gambar lama bila diganti/dihapus (gagal hapus tidak menggagalkan simpan).
  if (oldImage && oldImage !== d.image_path) {
    await supabase.storage.from("product-images").remove([oldImage]);
  }

  revalidatePath("/admin/products");
  if (!id) redirect(`/admin/products/${productId}`);
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, message: "Perubahan tersimpan." };
}

function productError(error: { code?: string; message: string }, values: Record<string, string>): ActionState {
  if (error.code === "23505" && error.message.includes("sku")) {
    return { ok: false, errors: { sku: "SKU sudah dipakai produk lain." }, values };
  }
  if (error.code === "23503") {
    return { ok: false, errors: { category_id: "Kategori tidak ditemukan." }, values };
  }
  return { ok: false, message: "Gagal menyimpan. Coba lagi.", values };
}

// Koreksi stok manual lewat fungsi database (tercatat di riwayat stok & audit).
export async function adjustStock(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await getStaff();
  if (staff?.role !== "owner") return { ok: false, message: OWNER_ONLY_MESSAGE };

  const values = snapshot(fd, ["delta", "reason"]);
  const id = str(fd, "product_id");
  if (!id || !isUuid(id)) return { ok: false, message: "Produk tidak valid.", values };

  const rawDelta = str(fd, "delta");
  const delta = rawDelta !== null && /^[+-]?\d+$/.test(rawDelta) ? Number(rawDelta) : NaN;
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100000) {
    return { ok: false, errors: { delta: "Isi angka bulat bukan nol, mis. 10 atau -2." }, values };
  }
  const reason = str(fd, "reason");
  if (!reason || reason.length < 3) {
    return { ok: false, errors: { reason: "Alasan wajib diisi (minimal 3 karakter)." }, values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("adjust_stock", {
    p_product_id: id,
    p_delta: delta,
    p_reason: reason,
  });
  if (error) return { ok: false, message: rpcMessage(error), values };

  revalidatePath(`/admin/products/${id}`);
  revalidatePath("/admin/products");
  const onHand = (data as { on_hand?: number } | null)?.on_hand;
  return { ok: true, message: `Stok tersimpan. Stok fisik sekarang ${onHand ?? "—"}.` };
}
