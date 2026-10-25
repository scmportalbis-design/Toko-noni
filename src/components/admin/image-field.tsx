"use client";

import { useState, type ChangeEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { storageUrl } from "@/lib/format";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

export function ImageField({
  initialPath,
  bucket = "product-images",
  prefix = "products",
  name = "image_path",
  emptyText = "Belum ada foto",
  previewClass = "h-28 w-28",
}: {
  initialPath: string | null;
  bucket?: string;
  prefix?: string;
  name?: string;
  emptyText?: string;
  previewClass?: string;
}) {
  const [path, setPath] = useState<string | null>(initialPath);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = storageUrl(bucket, path);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED.includes(file.type)) return setError("Format harus JPG, PNG, atau WebP.");
    if (file.size > MAX_BYTES) return setError("Ukuran gambar maksimal 2 MB.");
    setBusy(true);
    setError(null);
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const uid = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newPath = `${prefix}/${uid}.${ext}`;
    const { error: upErr } = await createClient()
      .storage.from(bucket)
      .upload(newPath, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    setBusy(false);
    if (upErr) return setError(`Gagal mengunggah: ${upErr.message}`);
    setPath(newPath);
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={path ?? ""} />
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Pratinjau" className={`${previewClass} rounded-lg border border-slate-200 object-cover`} />
      ) : (
        <div className={`${previewClass} flex items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400`}>
          {emptyText}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50">
          {busy ? "Mengunggah…" : path ? "Ganti gambar" : "Pilih gambar"}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} disabled={busy} className="sr-only" />
        </label>
        {path ? (
          <button type="button" onClick={() => setPath(null)} className="min-h-11 rounded-lg px-3 text-sm text-red-700 hover:bg-red-50">
            Hapus
          </button>
        ) : null}
      </div>
      <p className="text-xs text-slate-500">JPG, PNG, atau WebP, maksimal 2 MB. Tersimpan setelah tombol Simpan ditekan.</p>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
