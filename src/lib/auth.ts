import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type StaffRole = "owner" | "cashier";
export type Staff = { id: string; email: string | null; fullName: string; role: StaffRole };

// Akun yang sedang login (diverifikasi ke server Supabase).
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// Staf = akun login YANG punya profil aktif. Akun tanpa profil = tidak punya akses.
export const getStaff = cache(async (): Promise<Staff | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !profile.is_active) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    fullName: profile.full_name as string,
    role: profile.role as StaffRole,
  };
});

export const OWNER_ONLY_MESSAGE = "Hanya pemilik yang boleh melakukan tindakan ini.";
