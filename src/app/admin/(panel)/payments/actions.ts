"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";
import { snapshot, str, toRupiah } from "@/lib/form-data";
import { isUuid } from "@/lib/format";
import { rpcMessage } from "@/lib/rpc-errors";
import type { ActionState } from "@/lib/action-state";

function refresh() {
  revalidatePath("/admin/payments");
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}

export async function verifyPayment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await getStaff())) return { ok: false, message: "Sesi berakhir. Muat ulang halaman dan masuk lagi." };
  const values = snapshot(fd, ["reference", "amount_received", "note"]);
  const id = str(fd, "payment_id");
  if (!id || !isUuid(id)) return { ok: false, message: "Pembayaran tidak valid.", values };

  const errors: Record<string, string> = {};
  const reference = str(fd, "reference");
  if (!reference || reference.length < 3) errors.reference = "Nomor referensi wajib diisi (min. 3 karakter).";
  const amount = toRupiah(str(fd, "amount_received"));
  if (amount === null) errors.amount_received = "Isi nominal yang tercatat di mutasi.";
  if (Object.keys(errors).length) return { ok: false, errors, values };

  const { error } = await (await createClient()).rpc("verify_payment", {
    p_payment_id: id,
    p_reference: reference,
    p_amount_received: amount,
    p_note: str(fd, "note"),
  });
  if (error) return { ok: false, message: rpcMessage(error), values };
  refresh();
  return { ok: true, message: "Pembayaran terverifikasi. Stok sudah dikurangi." };
}

export async function rejectPayment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await getStaff())) return { ok: false, message: "Sesi berakhir. Muat ulang halaman dan masuk lagi." };
  const values = snapshot(fd, ["reason"]);
  const id = str(fd, "payment_id");
  if (!id || !isUuid(id)) return { ok: false, message: "Pembayaran tidak valid.", values };
  const reason = str(fd, "reason");
  if (!reason || reason.length < 3) return { ok: false, errors: { reason: "Alasan wajib diisi." }, values };

  const { error } = await (await createClient()).rpc("reject_payment", { p_payment_id: id, p_reason: reason });
  if (error) return { ok: false, message: rpcMessage(error), values };
  refresh();
  return { ok: true, message: "Pembayaran ditolak. Pelanggan bisa mencoba lagi." };
}
