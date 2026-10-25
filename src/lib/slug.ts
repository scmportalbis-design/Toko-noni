import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/format";

type Db = Awaited<ReturnType<typeof createClient>>;

// Insert baris baru dengan slug unik (menambah akhiran acak bila bentrok).
export async function insertWithUniqueSlug(
  supabase: Db,
  table: "products" | "categories",
  name: string,
  row: Record<string, unknown>,
): Promise<{ id: string | null; error: { code?: string; message: string } | null }> {
  const base = slugify(name);
  for (let i = 0; i < 4; i++) {
    const slug = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase
      .from(table)
      .insert({ ...row, slug })
      .select("id")
      .single();
    if (!error) return { id: data.id as string, error: null };
    if (error.code === "23505" && error.message.includes("_slug_key")) continue;
    return { id: null, error };
  }
  return { id: null, error: { message: "Gagal membuat slug unik" } };
}
