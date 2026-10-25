"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStaff, OWNER_ONLY_MESSAGE } from "@/lib/auth";
import { insertWithUniqueSlug } from "@/lib/slug";
import { bool, snapshot, str, toInt } from "@/lib/form-data";
import { isUuid } from "@/lib/format";
import { categorySchema, fieldErrors } from "@/lib/validators/catalog";
import type { ActionState } from "@/lib/action-state";

export async function saveCategory(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await getStaff();
  if (staff?.role !== "owner") return { ok: false, message: OWNER_ONLY_MESSAGE };

  const values = snapshot(fd, ["name", "sort_order", "is_active"]);
  const id = str(fd, "id");
  if (id && !isUuid(id)) return { ok: false, message: "Kategori tidak valid.", values };

  const parsed = categorySchema.safeParse({
    name: String(fd.get("name") ?? ""),
    sort_order: toInt(str(fd, "sort_order")),
    is_active: bool(fd, "is_active"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), values };

  const row = {
    name: parsed.data.name,
    sort_order: parsed.data.sort_order ?? 0,
    is_active: parsed.data.is_active,
  };
  const supabase = await createClient();

  if (id) {
    const { data, error } = await supabase.from("categories").update(row).eq("id", id).select("id");
    if (error) return categoryError(error, values);
    if (!data?.length) return { ok: false, message: "Kategori tidak ditemukan.", values };
  } else {
    const { error } = await insertWithUniqueSlug(supabase, "categories", row.name, row);
    if (error) return categoryError(error, values);
  }

  revalidatePath("/admin/categories");
  return { ok: true, message: id ? "Perubahan tersimpan." : "Kategori ditambahkan." };
}

function categoryError(error: { code?: string; message: string }, values: Record<string, string>): ActionState {
  if (error.code === "23505") {
    return { ok: false, errors: { name: "Nama kategori sudah dipakai." }, values };
  }
  return { ok: false, message: "Gagal menyimpan. Coba lagi.", values };
}

export async function deleteCategory(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await getStaff();
  if (staff?.role !== "owner") return { ok: false, message: OWNER_ONLY_MESSAGE };
  const id = str(fd, "id");
  if (!id || !isUuid(id)) return { ok: false, message: "Kategori tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { ok: false, message: "Gagal menghapus kategori." };
  revalidatePath("/admin/categories");
  return { ok: true, message: "Kategori dihapus." };
}
