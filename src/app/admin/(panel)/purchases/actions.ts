"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaff, OWNER_ONLY_MESSAGE } from "@/lib/auth";
import { snapshot, str } from "@/lib/form-data";
import { isUuid } from "@/lib/format";
import { rpcMessage } from "@/lib/rpc-errors";
import { fieldErrors } from "@/lib/validators/catalog";
import { purchaseSchema } from "@/lib/validators/purchasing";
import type { ActionState } from "@/lib/action-state";

export async function createPurchase(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await getStaff();
  if (staff?.role !== "owner") return { ok: false, message: OWNER_ONLY_MESSAGE };
  const values = snapshot(fd, ["supplier_id", "purchase_date", "note"]);

  let items: unknown;
  try {
    items = JSON.parse(String(fd.get("items_json") ?? "[]"));
  } catch {
    return { ok: false, message: "Data barang tidak valid.", values };
  }
  if (Array.isArray(items) && items.some((i) => !i || !(i.qty >= 1) || !(i.unit_cost >= 0))) {
    return { ok: false, errors: { items: "Isi jumlah (minimal 1) dan harga beli setiap barang." }, values };
  }

  const parsed = purchaseSchema.safeParse({
    supplier_id: str(fd, "supplier_id"),
    purchase_date: str(fd, "purchase_date") ?? "",
    note: str(fd, "note"),
    items,
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), values };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: p, error } = await supabase
    .from("purchases")
    .insert({ supplier_id: d.supplier_id, purchase_date: d.purchase_date, note: d.note, created_by: staff.id })
    .select("id")
    .single();
  if (error || !p) return { ok: false, message: "Gagal menyimpan pembelian. Coba lagi.", values };

  const { error: itemsErr } = await supabase
    .from("purchase_items")
    .insert(d.items.map((i) => ({ ...i, purchase_id: p.id })));
  if (itemsErr) {
    await supabase.from("purchases").delete().eq("id", p.id); // jangan tinggalkan draf kosong
    return { ok: false, message: "Gagal menyimpan barang pembelian. Coba lagi.", values };
  }
  revalidatePath("/admin/purchases");
  redirect(`/admin/purchases/${p.id}`);
}

export async function receivePurchase(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await getStaff();
  if (staff?.role !== "owner") return { ok: false, message: OWNER_ONLY_MESSAGE };
  const id = str(fd, "purchase_id");
  if (!id || !isUuid(id)) return { ok: false, message: "Pembelian tidak valid." };
  const { error } = await (await createClient()).rpc("receive_purchase", { p_purchase_id: id });
  if (error) return { ok: false, message: rpcMessage(error) };
  revalidatePath("/admin/purchases");
  revalidatePath(`/admin/purchases/${id}`);
  revalidatePath("/admin/stock");
  return { ok: true, message: "Barang diterima. Stok sudah bertambah." };
}

export async function cancelPurchase(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await getStaff();
  if (staff?.role !== "owner") return { ok: false, message: OWNER_ONLY_MESSAGE };
  const id = str(fd, "purchase_id");
  if (!id || !isUuid(id)) return { ok: false, message: "Pembelian tidak valid." };
  const { data, error } = await (await createClient())
    .from("purchases").update({ status: "cancelled" }).eq("id", id).eq("status", "draft").select("id");
  if (error || !data?.length) return { ok: false, message: "Hanya pembelian berstatus draf yang bisa dibatalkan." };
  revalidatePath("/admin/purchases");
  revalidatePath(`/admin/purchases/${id}`);
  return { ok: true, message: "Pembelian dibatalkan." };
}
