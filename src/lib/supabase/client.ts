import { createBrowserClient } from "@supabase/ssr";

// Dipakai di komponen klien (mis. unggah gambar). Sesi dibaca dari cookie.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
