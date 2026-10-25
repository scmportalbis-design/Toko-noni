"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { rupiah, storageUrl } from "@/lib/format";
import { rpcMessage } from "@/lib/rpc-errors";
import { btn } from "./ui";

type OrderView = {
  order_number: string;
  status: "open" | "completed" | "cancelled" | "expired";
  payment_status: "pending" | "claimed" | "verified" | "rejected" | "refunded";
  fulfillment_status: "pending" | "preparing" | "ready" | "picked_up";
  customer_name: string;
  note: string | null;
  subtotal: number;
  discount: number;
  total: number;
  expires_at: string | null;
  created_at: string;
  cancel_reason: string | null;
  last_rejection_reason: string | null;
  receipt_number: string | null;
  items: { product_id: string; name: string; unit_price: number; qty: number; line_total: number }[];
};

type Tone = "wait" | "ok" | "bad" | "done";

// Status ditampilkan dari pembayaran TERVERIFIKASI petugas, bukan dari pengakuan pelanggan.
function describe(o: OrderView): { title: string; detail?: string; tone: Tone } {
  if (o.status === "cancelled") return { title: "Pesanan dibatalkan", detail: o.cancel_reason ?? undefined, tone: "bad" };
  if (o.payment_status === "verified") {
    if (o.status === "completed" || o.fulfillment_status === "picked_up")
      return { title: "Selesai", detail: "Pesanan sudah diambil. Terima kasih!", tone: "done" };
    if (o.fulfillment_status === "ready")
      return { title: "Siap diambil di toko", detail: "Sebutkan nomor pesananmu ke kasir.", tone: "ok" };
    if (o.fulfillment_status === "preparing") return { title: "Pesanan sedang disiapkan", tone: "ok" };
    return { title: "Pembayaran terverifikasi", detail: "Pesananmu akan segera disiapkan.", tone: "ok" };
  }
  if (o.payment_status === "claimed")
    return { title: "Pembayaran sedang diperiksa", detail: "Petugas mencocokkannya dengan mutasi toko. Mohon tunggu.", tone: "wait" };
  if (o.status === "expired")
    return {
      title: "Waktu pembayaran habis",
      detail: "Stok sudah dilepas. Silakan buat pesanan baru. Jika kamu terlanjur membayar, hubungi toko dan sebutkan nomor pesanan ini.",
      tone: "bad",
    };
  return { title: "Menunggu pembayaran", tone: "wait" };
}

const TONE: Record<Tone, string> = {
  wait: "bg-amber-50 text-amber-900 border-amber-200",
  ok: "bg-emerald-50 text-emerald-900 border-emerald-200",
  bad: "bg-red-50 text-red-800 border-red-200",
  done: "bg-stone-100 text-stone-800 border-stone-200",
};

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function mmss(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function OrderStatus({ orderNumber, token }: { orderNumber: string; token: string }) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [busy, setBusy] = useState<"cancel" | "claim" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qris, setQris] = useState<string | null>(null);
  const [qrisLoaded, setQrisLoaded] = useState(false);
  const qrisRequested = useRef(false);

  const load = useCallback(async (): Promise<OrderView | null> => {
    const { data, error } = await createPublicClient().rpc("get_order_by_token", {
      p_order_number: orderNumber,
      p_token: token,
    });
    if (error) {
      setState((s) => (s === "ready" ? s : "error"));
      return null;
    }
    if (!data) {
      setOrder(null);
      setState("notfound");
      return null;
    }
    setOrder(data as OrderView);
    setState("ready");
    return data as OrderView;
  }, [orderNumber, token]);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function tick() {
      if (stop) return;
      let final = false;
      if (document.visibilityState === "visible") {
        const o = await load();
        final = !!o && (o.status === "completed" || o.status === "cancelled");
      }
      if (!stop && !final) timer = setTimeout(tick, 5000);
    }
    void tick();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [load]);

  const waiting = !!order && order.status === "open" && order.payment_status === "pending";
  const now = useNow(waiting);

  // Gambar QRIS toko (pengaturan publik) dimuat sekali saat dibutuhkan.
  useEffect(() => {
    if (!waiting || qrisRequested.current) return;
    qrisRequested.current = true;
    void createPublicClient()
      .from("store_settings")
      .select("value")
      .eq("key", "qris_image_path")
      .maybeSingle()
      .then(({ data }) => {
        const v = data?.value;
        setQris(typeof v === "string" && v ? storageUrl("store-assets", v) : null);
        setQrisLoaded(true);
      });
  }, [waiting]);

  async function cancel() {
    if (!confirm("Batalkan pesanan ini?")) return;
    setBusy("cancel");
    setMsg(null);
    const { error } = await createPublicClient().rpc("cancel_order_by_token", {
      p_order_number: orderNumber,
      p_token: token,
      p_reason: "Dibatalkan pelanggan",
    });
    if (error) setMsg(rpcMessage(error));
    await load();
    setBusy(null);
  }

  async function claim() {
    if (!order) return;
    if (!confirm(`Pastikan kamu sudah membayar tepat ${rupiah(order.total)} ke QRIS toko. Lanjutkan?`)) return;
    setBusy("claim");
    setMsg(null);
    const { error } = await createPublicClient().rpc("claim_payment", {
      p_order_number: orderNumber,
      p_token: token,
      p_note: null,
    });
    if (error) setMsg(rpcMessage(error));
    await load();
    setBusy(null);
  }

  async function copyAmount() {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(String(order.total));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg("Tidak bisa menyalin otomatis. Ketik nominalnya secara manual.");
    }
  }

  if (state === "loading") return <p className="py-10 text-center text-sm text-stone-500">Memuat pesanan…</p>;
  if (state === "notfound")
    return (
      <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-700">
        Pesanan tidak ditemukan. Pastikan kamu membuka link pesanan yang lengkap.
      </p>
    );
  if (state === "error" || !order)
    return <p className="py-10 text-center text-sm text-stone-500">Gagal memuat pesanan. Mencoba lagi…</p>;

  const d = describe(order);
  const remaining = order.expires_at ? new Date(order.expires_at).getTime() - now : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <p className="text-xs text-stone-500">Nomor pesanan</p>
        <p className="text-lg font-bold tracking-wide">{order.order_number}</p>
      </div>

      <div role="status" className={`space-y-1 rounded-xl border p-4 ${TONE[d.tone]}`}>
        <p className="text-base font-semibold">{d.title}</p>
        {d.detail ? <p className="text-sm">{d.detail}</p> : null}
        {waiting ? (
          <p className="text-sm">
            {remaining > 0 ? `Sisa waktu pembayaran ${mmss(remaining)}` : "Waktu pembayaran hampir habis"}
          </p>
        ) : null}
      </div>

      {waiting ? (
        <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="text-base font-semibold">Bayar dengan QRIS</h2>
          {order.last_rejection_reason ? (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              Pembayaran sebelumnya ditolak petugas: {order.last_rejection_reason}. Periksa lalu coba lagi.
            </p>
          ) : null}

          {qris ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qris} alt="QRIS Toko Noni" className="mx-auto w-full max-w-xs rounded-lg border border-stone-200" />
          ) : qrisLoaded ? (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              QRIS toko belum tersedia di halaman ini. Hubungi toko dan sebutkan nomor pesananmu.
            </p>
          ) : null}

          <div className="rounded-lg bg-stone-50 p-3 text-center">
            <p className="text-xs text-stone-500">Nominal yang harus dibayar (tepat)</p>
            <p className="text-2xl font-bold text-emerald-800">{rupiah(order.total)}</p>
            <button type="button" onClick={copyAmount} className="mt-1 min-h-11 px-3 text-sm font-medium text-emerald-800 underline">
              {copied ? "Tersalin" : "Salin nominal"}
            </button>
          </div>

          <ol className="list-decimal space-y-1 pl-5 text-sm text-stone-700">
            <li>Buka aplikasi bank atau e-wallet, pindai QRIS di atas.</li>
            <li>Masukkan nominal <strong>tepat</strong> {rupiah(order.total)}.</li>
            <li>Setelah berhasil, tekan tombol di bawah.</li>
          </ol>
          <p className="text-xs text-stone-500">
            Pesananmu baru diproses setelah petugas memeriksa mutasi toko. Tombol di bawah hanya memberi tahu toko
            bahwa kamu sudah membayar.
          </p>

          {msg ? <p role="alert" className="text-sm text-red-600">{msg}</p> : null}
          <button type="button" onClick={claim} disabled={busy !== null} className={`${btn.primary} w-full`}>
            {busy === "claim" ? "Mengirim…" : "Saya sudah bayar"}
          </button>
        </section>
      ) : null}

      <section className="space-y-2 rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="text-base font-semibold">Isi pesanan</h2>
        <ul className="space-y-1 text-sm">
          {order.items.map((i) => (
            <li key={i.product_id} className="flex justify-between gap-3">
              <span className="min-w-0">{i.name} × {i.qty}</span>
              <span className="shrink-0">{rupiah(i.line_total)}</span>
            </li>
          ))}
        </ul>
        {order.discount > 0 ? (
          <div className="flex justify-between text-sm text-stone-600">
            <span>Diskon</span>
            <span>− {rupiah(order.discount)}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-stone-100 pt-2 font-semibold">
          <span>Total</span>
          <span>{rupiah(order.total)}</span>
        </div>
        <p className="text-xs text-stone-500">
          Atas nama {order.customer_name} · diambil di toko
          {order.note ? ` · catatan: ${order.note}` : ""}
        </p>
      </section>

      {waiting ? (
        <button type="button" onClick={cancel} disabled={busy !== null} className={`${btn.danger} w-full`}>
          {busy === "cancel" ? "Membatalkan…" : "Batalkan pesanan"}
        </button>
      ) : null}

      <p className="text-xs text-stone-500">
        Simpan link halaman ini. Siapa pun yang punya link ini dapat melihat pesananmu.
      </p>
    </div>
  );
}
