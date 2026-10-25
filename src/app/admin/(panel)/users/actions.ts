"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStaff, OWNER_ONLY_MESSAGE } from "@/lib/auth";
import { bool, str } from "@/lib/form-data";
import { isUuid } from "@/lib/format";
import type { ActionState } from "@/lib/action-state";

export async function updateStaff(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await getStaff();
  if (staff?.role !== "owner") return { ok: false, message: OWNER_ONLY_MESSAGE };
  const id = str(fd, "id");
  const role = str(fd, "role");
  if (!id || !isUuid(id) || (role !== "owner" && role !== "cashier")) return { ok: false, message: "Permintaan tidak valid." };
  if (id === staff.id) return { ok: false, message: "Kamu tidak bisa mengubah akunmu sendiri di sini." };

  const { data, error } = await (await createClient())
    .from("profiles").update({ role, is_active: bool(fd, "is_active") }).eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, message: "Gagal menyimpan. Coba lagi." };
  revalidatePath("/admin/users");
  return { ok: true, message: "Tersimpan." };
}
