import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";
import { rupiah } from "@/lib/format";
import { addDays, startOfDayISO, todayJakarta } from "@/lib/dates";
import { NEAR_EXPIRY_DAYS } from "@/lib/batch";

const LOW_STOCK = 5;

export default async function DashboardPage() {
  const staff = await getStaff(); // membaca sesi dulu, baru boleh memakai waktu sekarang
  const today = todayJakarta();
  const since = startOfDayISO(today);
  const supabase = await createClient();
  const isOwner = staff?.role === "owner";

  const [claimed, toPrepare, unpaid, salesToday, stock] = await Promise.all([
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "claimed"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "open").eq("payment_status", "verified"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "open").in("payment_status", ["pending", "claimed"]),
    supabase.from("payments").select("amount").eq("status", "verified").gte("verified_at", since).limit(1000),
    supabase.from("staff_stock").select("on_hand, reserved, is_active"),
  ]);

  // Hanya pemilik: ringkasan batch. (Kasir tidak menjalankan query ini, dan RLS menolak baca.)
  const batchCounts = isOwner
    ? await Promise.all([
        supabase.from("stock_batches").select("id", { count: "exact", head: true })
          .gt("qty_remaining", 0).gte("expiry_date", today).lte("expiry_date", addDays(today, NEAR_EXPIRY_DAYS)),
        supabase.from("stock_batches").select("id", { count: "exact", head: true })
          .gt("qty_remaining", 0).lt("expiry_date", today),
        supabase.from("stock_batches").select("id", { count: "exact", head: true })
          .gt("qty_remaining", 0).is("expiry_date", null),
      ])
    : null;
  const nearCount = batchCounts?.[0].count ?? 0;
  const expiredCount = batchCounts?.[1].count ?? 0;
  const unfilledCount = batchCounts?.[2].count ?? 0;

  const sales = (salesToday.data ?? []) as { amount: number }[];
  const salesTotal = sales.reduce((n, r) => n + r.amount, 0);
  const lowStock = ((stock.data ?? []) as { on_hand: number; reserved: number; is_active: boolean }[])
    .filter((s) => s.is_active && s.on_hand - s.reserved <= LOW_STOCK).length;

  const cards = [
    { label: "Pembayaran perlu diperiksa", value: claimed.count ?? 0, href: "/admin/payments", alert: (claimed.count ?? 0) > 0 },
    { label: "Pesanan perlu disiapkan", value: toPrepare.count ?? 0, href: "/admin/orders?tab=prepare", alert: (toPrepare.count ?? 0) > 0 },
    { label: "Menunggu pembayaran", value: unpaid.count ?? 0, href: "/admin/orders?tab=unpaid", alert: false },
    { label: `Stok menipis (≤ ${LOW_STOCK})`, value: lowStock, href: "/admin/stock", alert: lowStock > 0 },
    ...(isOwner
      ? [
          { label: `Batch hampir kedaluwarsa (≤ ${NEAR_EXPIRY_DAYS} hari)`, value: nearCount, href: "/admin/batches?tab=hampir", alert: nearCount > 0 },
          { label: "Batch sudah kedaluwarsa (belum dibuang)", value: expiredCount, href: "/admin/batches?tab=kedaluwarsa", alert: expiredCount > 0 },
        ]
      : []),
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

      {isOwner && unfilledCount > 0 ? (
        <Link href="/admin/batches?tab=belum" className="block rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 hover:bg-amber-100">
          <strong>{unfilledCount} batch stok lama belum punya tanggal kedaluwarsa.</strong> Isi tanggalnya supaya stok terlacak. Ketuk untuk mengisi.
        </Link>
      ) : null}

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
