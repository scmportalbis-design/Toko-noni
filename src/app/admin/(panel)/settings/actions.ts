"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStaff, OWNER_ONLY_MESSAGE } from "@/lib/auth";
import { snapshot, str, toInt } from "@/lib/form-data";
import type { ActionState } from "@/lib/action-state";

export async function saveSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await getStaff();
  if (staff?.role !== "owner") return { ok: false, message: OWNER_ONLY_MESSAGE };
  const values = snapshot(fd, ["order_expiry_minutes"]);

  const qris = str(fd, "qris_image_path");
  if (qris !== null && !/^qris\/[A-Za-z0-9._-]+$/.test(qris)) return { ok: false, message: "Gambar QRIS tidak valid.", values };
  const expiry = toInt(str(fd, "order_expiry_minutes"));
  if (expiry === null || expiry < 5 || expiry > 240) {
    return { ok: false, errors: { order_expiry_minutes: "Isi 5 sampai 240 menit." }, values };
  }

  const supabase = await createClient();
  const { data: old } = await supabase.from("store_settings").select("value").eq("key", "qris_image_path").maybeSingle();
  const oldPath = typeof old?.value === "string" && old.value ? old.value : null;

  // JSON null tidak bisa dikirim lewat klien; "" dipakai untuk "belum diatur".
  const { error } = await supabase.from("store_settings").upsert([
    { key: "qris_image_path", value: qris ?? "", is_public: true },
    { key: "order_expiry_minutes", value: expiry, is_public: false },
  ]);
  if (error) return { ok: false, message: "Gagal menyimpan. Coba lagi.", values };

  if (oldPath && oldPath !== qris) await supabase.storage.from("store-assets").remove([oldPath]);
  revalidatePath("/admin/settings");
  return { ok: true, message: "Pengaturan tersimpan." };
}
