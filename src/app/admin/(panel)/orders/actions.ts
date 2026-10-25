"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";
import { snapshot, str } from "@/lib/form-data";
import { isUuid } from "@/lib/format";
import { rpcMessage } from "@/lib/rpc-errors";
import type { ActionState } from "@/lib/action-state";

const NEXT_OK = ["preparing", "ready", "picked_up"];

function refresh(id: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin");
}

export async function setFulfillment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await getStaff())) return { ok: false, message: "Sesi berakhir. Muat ulang halaman." };
  const id = str(fd, "order_id");
  const status = str(fd, "status");
  if (!id || !isUuid(id) || !status || !NEXT_OK.includes(status)) return { ok: false, message: "Permintaan tidak valid." };
  const { error } = await (await createClient()).rpc("set_fulfillment_status", { p_order_id: id, p_status: status });
  if (error) return { ok: false, message: rpcMessage(error) };
  refresh(id);
  return { ok: true, message: "Status diperbarui." };
}

export async function cancelOrder(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await getStaff())) return { ok: false, message: "Sesi berakhir. Muat ulang halaman." };
  const values = snapshot(fd, ["reason"]);
  const id = str(fd, "order_id");
  if (!id || !isUuid(id)) return { ok: false, message: "Pesanan tidak valid.", values };
  const reason = str(fd, "reason");
  if (!reason || reason.length < 3) return { ok: false, errors: { reason: "Alasan wajib diisi." }, values };
  const { error } = await (await createClient()).rpc("cancel_order", { p_order_id: id, p_reason: reason });
  if (error) return { ok: false, message: rpcMessage(error), values };
  refresh(id);
  return { ok: true, message: "Pesanan dibatalkan. Stok yang dipesan sudah dilepas." };
}

export async function issueReceipt(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await getStaff())) return { ok: false, message: "Sesi berakhir. Muat ulang halaman." };
  const id = str(fd, "order_id");
  if (!id || !isUuid(id)) return { ok: false, message: "Pesanan tidak valid." };
  const { error } = await (await createClient()).rpc("issue_receipt", { p_order_id: id });
  if (error) return { ok: false, message: error.message === "BELUM_LUNAS" ? "Struk lunas hanya untuk pembayaran yang sudah terverifikasi." : rpcMessage(error) };
  revalidatePath(`/admin/orders/${id}/receipt`);
  refresh(id);
  return { ok: true, message: "Struk diterbitkan." };
}
