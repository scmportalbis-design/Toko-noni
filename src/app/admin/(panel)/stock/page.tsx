import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";
import { one } from "@/lib/format";
import { formatDateTime } from "@/lib/dates";
import { movementLabel } from "@/lib/labels";
import { Badge } from "@/components/admin/badge";

const LOW_STOCK_DEFAULT = 5; // batas "menipis" bila produk tidak punya ambang sendiri

type StockRow = {
  product_id: string; on_hand: number; reserved: number; low_stock_threshold: number;
  products: { name: string; unit: string; is_active: boolean } | { name: string; unit: string; is_active: boolean }[] | null;
};
type Move = {
  id: number; movement_type: string; qty_change: number; on_hand_after: number; note: string | null; created_at: string;
  products: { name: string } | { name: string }[] | null;
};

export default async function StockPage() {
  const staff = await getStaff();
  const supabase = await createClient();
  const [stockRes, movesRes] = await Promise.all([
    supabase.from("stock_levels").select("product_id, on_hand, reserved, low_stock_threshold, products(name, unit, is_active)"),
    supabase.from("stock_movements").select("id, movement_type, qty_change, on_hand_after, note, created_at, products(name)").order("created_at", { ascending: false }).limit(50),
  ]);
  const stock = ((stockRes.data ?? []) as unknown as StockRow[])
    .map((s) => ({ ...s, p: one(s.products), available: Math.max(s.on_hand - s.reserved, 0) }))
    .filter((s) => s.p)
    .sort((a, b) => a.available - b.available || a.p!.name.localeCompare(b.p!.name));
  const moves = (movesRes.data ?? []) as unknown as Move[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Stok</h1>
        <p className="text-sm text-slate-500">Fisik = ada di toko. Dipesan = ditahan untuk pesanan yang belum terverifikasi. Tersedia = fisik − dipesan.</p>
      </div>

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {stock.length === 0 ? <li className="p-4 text-sm text-slate-500">Belum ada produk.</li> : null}
        {stock.map((s) => {
          const low = s.available <= (s.low_stock_threshold > 0 ? s.low_stock_threshold : LOW_STOCK_DEFAULT);
          const row = (
            <div className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{s.p!.name}</p>
                <p className="text-xs text-slate-500">Fisik {s.on_hand} · dipesan {s.reserved}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!s.p!.is_active ? <Badge>Nonaktif</Badge> : null}
                {low && s.p!.is_active ? <Badge tone={s.available === 0 ? "bad" : "wait"}>{s.available === 0 ? "Habis" : "Menipis"}</Badge> : null}
                <span className="w-12 text-right text-lg font-semibold">{s.available}</span>
              </div>
            </div>
          );
          return <li key={s.product_id}>{staff?.role === "owner" ? <Link href={`/admin/products/${s.product_id}`} className="block hover:bg-slate-50">{row}</Link> : row}</li>;
        })}
      </ul>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Riwayat pergerakan stok (50 terakhir)</h2>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
          {moves.length === 0 ? <li className="p-4 text-slate-500">Belum ada pergerakan.</li> : null}
          {moves.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate">{one(m.products)?.name}</p>
                <p className="text-xs text-slate-500">{movementLabel[m.movement_type]} · {formatDateTime(m.created_at)}{m.note ? ` · ${m.note}` : ""}</p>
              </div>
              <p className="shrink-0 text-right">
                <span className={m.qty_change > 0 ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>{m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change}</span>
                <span className="block text-xs text-slate-400">→ {m.on_hand_after}</span>
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
