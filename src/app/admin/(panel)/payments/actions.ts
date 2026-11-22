"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";
import { snapshot, str, toRupiah } from "@/lib/form-data";
import { isUuid, rupiah } from "@/lib/format";
import { rpcMessage } from "@/lib/rpc-errors";
import type { ActionState } from "@/lib/action-state";
import { cashChange } from "@/lib/payment-methods";

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

// Pembayaran tunai: kasir memasukkan uang yang diterima. Tidak ada mutasi bank, jadi referensi
// dibuat otomatis (TUNAI-<nomor pesanan>) dan verifikasi memakai verify_payment yang sama
// (nominal harus sama dengan tagihan; kembalian dicatat di catatan/audit).
export async function verifyCashPayment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await getStaff())) return { ok: false, message: "Sesi berakhir. Muat ulang halaman dan masuk lagi." };
  const values = snapshot(fd, ["cash_received", "note"]);
  const id = str(fd, "payment_id");
  if (!id || !isUuid(id)) return { ok: false, message: "Pembayaran tidak valid.", values };

  const received = toRupiah(str(fd, "cash_received"));
  if (received === null) return { ok: false, errors: { cash_received: "Isi jumlah uang yang diterima." }, values };

  const supabase = await createClient();
  const { data: pay } = await supabase
    .from("payments")
    .select("id, amount, method, status, orders(order_number)")
    .eq("id", id)
    .maybeSingle();
  if (!pay) return { ok: false, message: "Pembayaran tidak ditemukan.", values };
  if (pay.method !== "cash") {
    return { ok: false, message: "Ini bukan pembayaran tunai. Verifikasi lewat mutasi QRIS.", values };
  }
  const order = Array.isArray(pay.orders) ? pay.orders[0] : pay.orders;
  if (!order?.order_number) return { ok: false, message: "Pesanan pembayaran tidak ditemukan.", values };

  const total = Number(pay.amount);
  const change = cashChange(received, total);
  if (change === null) {
    return { ok: false, errors: { cash_received: `Uang diterima kurang dari tagihan ${rupiah(total)}.` }, values };
  }

  const userNote = str(fd, "note");
  const note = `Tunai diterima ${rupiah(received)}, kembalian ${rupiah(change)}${userNote ? ` · ${userNote}` : ""}`;
  const { error } = await supabase.rpc("verify_payment", {
    p_payment_id: id,
    p_reference: `TUNAI-${order.order_number}`,
    p_amount_received: total,
    p_note: note,
  });
  if (error) return { ok: false, message: rpcMessage(error), values };
  refresh();
  return {
    ok: true,
    message: change > 0
      ? `Pembayaran tunai terverifikasi. Kembalian ${rupiah(change)}. Stok sudah dikurangi.`
      : "Pembayaran tunai terverifikasi. Stok sudah dikurangi.",
  };
}
