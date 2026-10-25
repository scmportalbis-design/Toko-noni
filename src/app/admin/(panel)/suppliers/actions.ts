"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStaff, OWNER_ONLY_MESSAGE } from "@/lib/auth";
import { bool, snapshot, str } from "@/lib/form-data";
import { isUuid } from "@/lib/format";
import { fieldErrors } from "@/lib/validators/catalog";
import { supplierSchema } from "@/lib/validators/purchasing";
import type { ActionState } from "@/lib/action-state";

export async function saveSupplier(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await getStaff();
  if (staff?.role !== "owner") return { ok: false, message: OWNER_ONLY_MESSAGE };
  const values = snapshot(fd, ["name", "phone", "address", "note", "is_active"]);
  const id = str(fd, "id");
  if (id && !isUuid(id)) return { ok: false, message: "Pemasok tidak valid.", values };

  const parsed = supplierSchema.safeParse({
    name: String(fd.get("name") ?? ""),
    phone: str(fd, "phone"),
    address: str(fd, "address"),
    note: str(fd, "note"),
    is_active: bool(fd, "is_active"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  if (id) {
    const { data, error } = await supabase.from("suppliers").update(parsed.data).eq("id", id).select("id");
    if (error) return { ok: false, message: "Gagal menyimpan. Coba lagi.", values };
    if (!data?.length) return { ok: false, message: "Pemasok tidak ditemukan.", values };
  } else {
    const { error } = await supabase.from("suppliers").insert(parsed.data);
    if (error) return { ok: false, message: "Gagal menyimpan. Coba lagi.", values };
  }
  revalidatePath("/admin/suppliers");
  return { ok: true, message: id ? "Perubahan tersimpan." : "Pemasok ditambahkan." };
}
