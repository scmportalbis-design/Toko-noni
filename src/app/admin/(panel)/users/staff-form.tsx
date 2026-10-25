"use client";

import { useActionState } from "react";
import { updateStaff } from "./actions";
import { FormMessage, SubmitButton, inputClass } from "@/components/admin/form-ui";

export function StaffForm({ id, role, isActive }: { id: string; role: string; isActive: boolean }) {
  const [state, action] = useActionState(updateStaff, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <select name="role" defaultValue={role} aria-label="Peran" className={inputClass}>
        <option value="cashier">Kasir</option>
        <option value="owner">Pemilik</option>
      </select>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="is_active" defaultChecked={isActive} className="h-5 w-5 accent-emerald-700" />
        Akun aktif (bisa masuk ke admin)
      </label>
      <FormMessage state={state} />
      <SubmitButton>Simpan</SubmitButton>
    </form>
  );
}
