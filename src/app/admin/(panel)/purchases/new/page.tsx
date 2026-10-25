import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";
import { todayJakarta } from "@/lib/dates";
import { PurchaseForm } from "../_components/purchase-form";

export default async function NewPurchasePage() {
  const staff = await getStaff();
  if (staff?.role !== "owner") redirect("/admin");
  const supabase = await createClient();
  const [sup, prod] = await Promise.all([
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
    supabase.from("products").select("id, name").order("name"),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Catat pembelian</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <PurchaseForm
          suppliers={(sup.data ?? []) as { id: string; name: string }[]}
          products={(prod.data ?? []) as { id: string; name: string }[]}
          today={todayJakarta()}
        />
      </div>
    </div>
  );
}
