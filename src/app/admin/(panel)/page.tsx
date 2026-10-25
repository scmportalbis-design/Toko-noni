import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";
import { one, rupiah } from "@/lib/format";
import { startOfDayISO, todayJakarta } from "@/lib/dates";

const LOW_STOCK = 5;

export default async function DashboardPage() {
  const staff = await getStaff(); // membaca sesi dulu, baru boleh memakai waktu sekarang
  const since = startOfDayISO(todayJakarta());
  const supabase = await createClient();

  const [claimed, toPrepare, unpaid, salesToday, stock] = await Promise.all([
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "claimed"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "open").eq("payment_status", "verified"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "open").in("payment_status", ["pending", "claimed"]),
    supabase.from("payments").select("amount").eq("status", "verified").gte("verified_at", since).limit(1000),
    supabase.from("stock_levels").select("on_hand, reserved, products(is_active)"),
  ]);

  const sales = (salesToday.data ?? []) as { amount: number }[];
  const salesTotal = sales.reduce((n, r) => n + r.amount, 0);
  const lowStock = ((stock.data ?? []) as unknown as { on_hand: number; reserved: number; products: { is_active: boolean } | { is_active: boolean }[] | null }[])
    .filter((s) => one(s.products)?.is_active && s.on_hand - s.reserved <= LOW_STOCK).length;

  const cards = [
    { label: "Pembayaran perlu diperiksa", value: claimed.count ?? 0, href: "/admin/payments", alert: (claimed.count ?? 0) > 0 },
    { label: "Pesanan perlu disiapkan", value: toPrepare.count ?? 0, href: "/admin/orders?tab=prepare", alert: (toPrepare.count ?? 0) > 0 },
    { label: "Menunggu pembayaran", value: unpaid.count ?? 0, href: "/admin/orders?tab=unpaid", alert: false },
    { label: `Stok menipis (≤ ${LOW_STOCK})`, value: lowStock, href: "/admin/stock", alert: lowStock > 0 },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Halo, {staff?.fullName}</h1>
        <p className="text-sm text-slate-500">Ringkasan hari ini.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">Uang masuk terverifikasi hari ini</p>
        <p className="text-3xl font-bold">{rupiah(salesTotal)}</p>
        <p className="text-xs text-slate-500">
          {sales.length} transaksi · hanya pembayaran yang sudah diverifikasi, bukan jumlah pesanan masuk.{" "}
          <Link href="/admin/transactions" className="font-medium text-emerald-800 underline">Lihat riwayat</Link>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.label} href={c.href}
            className={`rounded-xl border p-4 hover:bg-slate-50 ${c.alert ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
            <p className="text-sm text-slate-600">{c.label}</p>
            <p className="mt-1 text-3xl font-semibold">{c.value}</p>
          </Link>
        ))}
      </div>

      {staff?.role === "owner" ? (
        <Link href="/admin/reports" className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50">
          Buka laporan penjualan &amp; laba
        </Link>
      ) : null}
    </div>
  );
}
