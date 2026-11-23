import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";
import { one, rupiah } from "@/lib/format";
import { addDays, formatDateTime, todayJakarta } from "@/lib/dates";
import {
  NEAR_EXPIRY_DAYS, batchStatus, batchStatusLabel, expiryText, fifoOrder, formatYmd, nextOutBatchId, type BatchStatus,
} from "@/lib/batch";
import { Badge } from "@/components/admin/badge";
import { DisposeForm, SetExpiryForm } from "./_components/batch-forms";

// Menu khusus PEMILIK. Tanggal kedaluwarsa tidak ditampilkan di tempat lain untuk kasir/pelanggan.
// Dijaga tiga lapis: nav tersembunyi untuk kasir, redirect di halaman ini, dan RLS is_owner() di database.

type SP = Promise<{ tab?: string }>;
type Batch = {
  id: string; product_id: string; batch_code: string; source: string; received_at: string; created_at: string;
  expiry_date: string | null; qty_initial: number; qty_remaining: number; unit_cost: number;
  products: { name: string; unit: string } | { name: string; unit: string }[] | null;
};
type WriteOff = {
  id: number; qty: number; unit_cost: number; count_as_loss: boolean; loss_amount: number; was_expired: boolean;
  reason: string; created_at: string;
  stock_batches: { batch_code: string } | { batch_code: string }[] | null;
  products: { name: string; unit: string } | { name: string; unit: string }[] | null;
};

const TABS = [
  { key: "aktif", label: "Semua batch" },
  { key: "hampir", label: "Hampir kedaluwarsa" },
  { key: "kedaluwarsa", label: "Kedaluwarsa" },
  { key: "belum", label: "Belum diisi" },
  { key: "riwayat", label: "Riwayat pembuangan" },
] as const;

const TONE: Record<BatchStatus, "ok" | "wait" | "bad" | "muted"> = { ok: "ok", near: "wait", unfilled: "wait", expired: "bad" };
const SOURCE: Record<string, string> = { opening: "Saldo awal", purchase: "Pembelian", adjustment: "Koreksi stok" };

export default function BatchesPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Memuat batch…</p>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: SP }) {
  const { tab: rawTab } = await searchParams;
  const staff = await getStaff(); // sesi dulu, baru boleh memakai waktu sekarang
  if (staff?.role !== "owner") redirect("/admin");
  const tab = TABS.some((t) => t.key === rawTab) ? rawTab! : "aktif";
  const today = todayJakarta();

  const supabase = await createClient();
  const [activeRes, offRes] = await Promise.all([
    supabase.from("stock_batches")
      .select("id, product_id, batch_code, source, received_at, created_at, expiry_date, qty_initial, qty_remaining, unit_cost, products(name, unit)")
      .gt("qty_remaining", 0).order("received_at").limit(1000),
    supabase.from("stock_write_offs")
      .select("id, qty, unit_cost, count_as_loss, loss_amount, was_expired, reason, created_at, stock_batches(batch_code), products(name, unit)")
      .order("created_at", { ascending: false }).limit(50),
  ]);
  const all = (activeRes.data ?? []) as unknown as Batch[];
  const writeOffs = (offRes.data ?? []) as unknown as WriteOff[];

  const withStatus = all.map((b) => ({ ...b, status: batchStatus(b.expiry_date, today) }));
  const count = {
    near: withStatus.filter((b) => b.status === "near").length,
    expired: withStatus.filter((b) => b.status === "expired").length,
    unfilled: withStatus.filter((b) => b.status === "unfilled").length,
  };
  const shown = withStatus.filter((b) =>
    tab === "hampir" ? b.status === "near" : tab === "kedaluwarsa" ? b.status === "expired" : tab === "belum" ? b.status === "unfilled" : true);

  // Kelompokkan per produk, tiap kelompok berurutan FIFO.
  const groups = new Map<string, { name: string; unit: string; batches: typeof shown }>();
  for (const b of shown) {
    const p = one(b.products);
    const g = groups.get(b.product_id) ?? { name: p?.name ?? "Produk", unit: p?.unit ?? "", batches: [] };
    g.batches.push(b);
    groups.set(b.product_id, g);
  }
  const ordered = [...groups.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  const nextOut = new Set(
    [...new Set(withStatus.map((b) => b.product_id))]
      .map((pid) => nextOutBatchId(withStatus.filter((b) => b.product_id === pid), today))
      .filter((x): x is string => !!x),
  );
  const lossTotal = writeOffs.filter((w) => w.count_as_loss).reduce((n, w) => n + w.loss_amount, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Batch &amp; Kedaluwarsa</h1>
        <p className="text-sm text-slate-500">
          Khusus pemilik. Setiap stok masuk menjadi satu batch. Penjualan mengambil batch yang masuk paling dulu (FIFO).
          Batch yang sudah lewat tanggal kedaluwarsa tidak ikut dijual lewat sistem.
        </p>
      </div>

      {count.unfilled > 0 ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>{count.unfilled} batch stok lama belum punya tanggal kedaluwarsa.</strong>{" "}
          <Link href="/admin/batches?tab=belum" className="underline">Tampilkan</Link> lalu isi tanggalnya.
        </p>
      ) : null}

      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-xl border border-slate-200 bg-white p-3"><dt className="text-slate-500">Hampir ({NEAR_EXPIRY_DAYS} hr)</dt><dd className="text-2xl font-semibold">{count.near}</dd></div>
        <div className={`rounded-xl border p-3 ${count.expired > 0 ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}><dt className="text-slate-500">Kedaluwarsa</dt><dd className="text-2xl font-semibold">{count.expired}</dd></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3"><dt className="text-slate-500">Belum diisi</dt><dd className="text-2xl font-semibold">{count.unfilled}</dd></div>
      </dl>

      <nav className="-mx-4 overflow-x-auto px-4" aria-label="Filter batch">
        <ul className="flex gap-2">
          {TABS.map((t) => (
            <li key={t.key}>
              <Link href={`/admin/batches?tab=${t.key}`} className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full border px-4 text-sm ${
                tab === t.key ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white text-slate-700"}`}>
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "riwayat" ? (
        <section className="space-y-2">
          <p className="text-sm text-slate-600">
            Kerugian yang dihitung (50 pembuangan terakhir): <strong>{rupiah(lossTotal)}</strong>. Pembuangan &ldquo;keluar dari sistem saja&rdquo; tidak dihitung.
          </p>
          {writeOffs.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Belum ada pembuangan batch.</p> : null}
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
            {writeOffs.map((w) => (
              <li key={w.id} className="space-y-0.5 p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 font-medium">{one(w.products)?.name} <span className="font-normal text-slate-500">· {one(w.stock_batches)?.batch_code}</span></p>
                  <p className="shrink-0 font-semibold text-red-700">−{w.qty}</p>
                </div>
                <p className="text-xs text-slate-500">
                  {formatDateTime(w.created_at)} · {w.reason}{w.was_expired ? " · sudah kedaluwarsa" : ""}
                </p>
                <p className="text-xs">
                  {w.count_as_loss ? <Badge tone="bad">Kerugian {rupiah(w.loss_amount)}</Badge> : <Badge>Keluar dari sistem saja</Badge>}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="space-y-4">
          {ordered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Tidak ada batch pada filter ini.</p>
          ) : null}
          {ordered.map(([pid, g]) => (
            <div key={pid} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold">{g.name}</h2>
              <ul className="divide-y divide-slate-100">
                {fifoOrder(g.batches).map((b) => (
                  <li key={b.id} className="space-y-2 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {b.batch_code}
                          {nextOut.has(b.id) ? <span className="ml-2 text-xs font-normal text-emerald-700">keluar berikutnya</span> : null}
                        </p>
                        <p className="text-xs text-slate-500">
                          {SOURCE[b.source] ?? b.source} · masuk {formatDateTime(b.created_at)} · harga pokok {rupiah(b.unit_cost)}
                        </p>
                        <p className="text-sm">
                          {b.expiry_date ? `Kedaluwarsa ${formatYmd(b.expiry_date)} · ${expiryText(b.expiry_date, today)}` : "Tanggal kedaluwarsa belum diisi"}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-lg font-semibold">{b.qty_remaining}<span className="text-xs font-normal text-slate-400"> / {b.qty_initial} {g.unit}</span></span>
                        <Badge tone={TONE[b.status]}>{batchStatusLabel[b.status]}</Badge>
                      </div>
                    </div>
                    <details className="rounded-lg border border-slate-200">
                      <summary className="min-h-11 cursor-pointer px-3 py-2.5 text-sm font-medium">{b.expiry_date ? "Ubah tanggal" : "Isi tanggal kedaluwarsa"}</summary>
                      <div className="border-t border-slate-100 p-3"><SetExpiryForm batchId={b.id} current={b.expiry_date} /></div>
                    </details>
                    <details className="rounded-lg border border-slate-200">
                      <summary className={`min-h-11 cursor-pointer px-3 py-2.5 text-sm font-medium ${b.status === "expired" ? "text-red-700" : "text-slate-700"}`}>Buang batch</summary>
                      <div className="border-t border-slate-100 p-3">
                        <DisposeForm batchId={b.id} remaining={b.qty_remaining} unitCost={b.unit_cost} expired={b.status === "expired"} />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-xs text-slate-500">
            Hampir kedaluwarsa = {NEAR_EXPIRY_DAYS} hari ke depan (sampai {formatYmd(addDays(today, NEAR_EXPIRY_DAYS))}).
            Tanggal kedaluwarsa adalah hari terakhir barang boleh dijual.
          </p>
        </section>
      )}
    </div>
  );
}
