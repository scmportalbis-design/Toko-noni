import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const staff = await getStaff();
  if (staff?.role !== "owner") redirect("/admin");
  const supabase = await createClient();
  const { data } = await supabase.from("store_settings").select("key, value").in("key", ["qris_image_path", "order_expiry_minutes"]);
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as unknown]));
  const qris = map.get("qris_image_path");
  const expiry = Number(map.get("order_expiry_minutes") ?? 30);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Pengaturan toko</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <SettingsForm qrisPath={typeof qris === "string" && qris ? qris : null} expiryMinutes={Number.isFinite(expiry) ? expiry : 30} />
      </div>
      <p className="text-sm text-slate-500">
        Unggah foto QRIS statis toko yang jelas dan tidak terpotong. QRIS ini tampil di halaman pembayaran pelanggan.
      </p>
    </div>
  );
}
