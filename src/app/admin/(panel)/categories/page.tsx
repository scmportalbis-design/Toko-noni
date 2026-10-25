import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";
import { CategoryForm, type CategoryRow } from "./_components/category-form";
import { DeleteCategoryButton } from "./_components/delete-category-button";

export default async function CategoriesPage() {
  const staff = await getStaff();
  const isOwner = staff?.role === "owner";
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, sort_order, is_active")
    .order("sort_order")
    .order("name");
  const categories = (data ?? []) as CategoryRow[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Kategori</h1>
        <p className="text-sm text-slate-500">Pengelompokan produk di katalog pelanggan.</p>
      </div>

      {isOwner ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-base font-semibold">Tambah kategori</h2>
          <CategoryForm />
        </section>
      ) : null}

      <section className="space-y-2">
        {categories.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            Belum ada kategori.
          </p>
        ) : null}
        {categories.map((c) => (
          <details key={c.id} className="rounded-xl border border-slate-200 bg-white">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-2">
              <span className="font-medium">{c.name}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs ${
                  c.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {c.is_active ? "Aktif" : "Nonaktif"}
              </span>
            </summary>
            {isOwner ? (
              <div className="space-y-4 border-t border-slate-100 p-4">
                <CategoryForm category={c} />
                <DeleteCategoryButton id={c.id} />
              </div>
            ) : null}
          </details>
        ))}
      </section>
    </div>
  );
}
