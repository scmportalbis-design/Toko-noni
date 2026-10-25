import { createClient } from "@supabase/supabase-js";

// Klien anonim (tanpa sesi login) untuk halaman pelanggan, di server maupun browser.
// Pelanggan hanya bisa: membaca view catalog_products + categories aktif, dan memanggil
// fungsi create_order / get_order_by_token / claim_payment / cancel_order_by_token.
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}
