"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStaff, OWNER_ONLY_MESSAGE } from "@/lib/auth";
import { snapshot, str, toInt } from "@/lib/form-data";
import { isUuid } from "@/lib/format";
import { isYmd } from "@/lib/dates";
import { rpcMessage } from "@/lib/rpc-errors";
import type { ActionState } from "@/lib/action-state";

function refresh() {
  for (const p of ["/admin/batches", "/admin", "/admin/stock", "/admin/products", "/admin/reports"]) revalidatePath(p);
}

// Isi / koreksi tanggal kedaluwarsa batch (hanya pemilik; dijaga ulang di database).
export async function setBatchExpiry(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await getStaff();
  if (staff?.role !== "owner") return { ok: false, message: OWNER_ONLY_MESSAGE };

  const values = snapshot(fd, ["expiry_date", "reason"]);
  const id = str(fd, "batch_id");
  if (!id || !isUuid(id)) return { ok: false, message: "Batch tidak valid.", values };
  const expiry = str(fd, "expiry_date");
  if (!isYmd(expiry)) return { ok: false, errors: { expiry_date: "Tanggal kedaluwarsa wajib diisi." }, values };

  const { error } = await (await createClient()).rpc("set_batch_expiry", {
    p_batch_id: id,
    p_expiry_date: expiry,
    p_reason: str(fd, "reason") ?? "",
  });
  if (error) return { ok: false, message: rpcMessage(error), values };
  refresh();
  return { ok: true, message: "Tanggal kedaluwarsa tersimpan." };
}

// Buang batch. mode = "loss": dihitung sebagai kerugian di laporan. mode = "system": hanya
// dikeluarkan dari sistem (barang dijual/dibuang di luar sistem), tanpa kerugian.
export async function disposeBatch(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await getStaff();
  if (staff?.role !== "owner") return { ok: false, message: OWNER_ONLY_MESSAGE };

  const values = snapshot(fd, ["qty", "reason", "mode"]);
  const id = str(fd, "batch_id");
  if (!id || !isUuid(id)) return { ok: false, message: "Batch tidak valid.", values };

  const qty = toInt(str(fd, "qty"));
  if (qty === null || qty < 1 || qty > 100000) {
    return { ok: false, errors: { qty: "Isi jumlah bulat minimal 1." }, values };
  }
  const reason = str(fd, "reason");
  if (!reason || reason.length < 3) {
    return { ok: false, errors: { reason: "Alasan wajib diisi (minimal 3 karakter)." }, values };
  }
  const mode = str(fd, "mode");
  if (mode !== "loss" && mode !== "system") {
    return { ok: false, errors: { mode: "Pilih cara pencatatan." }, values };
  }

  const { data, error } = await (await createClient()).rpc("dispose_batch", {
    p_batch_id: id,
    p_qty: qty,
    p_reason: reason,
    p_count_as_loss: mode === "loss",
  });
  if (error) return { ok: false, message: rpcMessage(error), values };
  refresh();
  const loss = (data as { loss_amount?: number } | null)?.loss_amount ?? 0;
  return {
    ok: true,
    message: mode === "loss"
      ? `Batch dibuang dan dicatat sebagai kerugian Rp ${loss.toLocaleString("id-ID")}.`
      : "Batch dikeluarkan dari sistem tanpa dicatat sebagai kerugian.",
  };
}
