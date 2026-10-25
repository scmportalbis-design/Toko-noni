"use client";

import { useActionState } from "react";
import { deleteCategory } from "../actions";
import { FormMessage, SubmitButton } from "@/components/admin/form-ui";

export function DeleteCategoryButton({ id }: { id: string }) {
  const [state, action] = useActionState(deleteCategory, null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Hapus kategori ini? Produk di dalamnya menjadi tanpa kategori.")) {
          e.preventDefault();
        }
      }}
      className="space-y-2"
    >
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      <SubmitButton variant="danger" pendingText="Menghapus…">
        Hapus kategori
      </SubmitButton>
    </form>
  );
}
