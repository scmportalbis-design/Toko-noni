"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Muat ulang data saat ada perubahan pembayaran/pesanan (Realtime), plus cadangan tiap 30 detik.
export function RealtimeRefresh() {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("staff-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => router.refresh())
      .subscribe();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30000);
    return () => {
      void supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [router]);
  return null;
}
