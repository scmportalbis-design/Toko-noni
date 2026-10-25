// Memetakan kode galat dari fungsi database ke pesan untuk pengguna.
const MESSAGES: Record<string, string> = {
  AKSES_DITOLAK: "Kamu tidak punya izin untuk tindakan ini.",
  ALASAN_WAJIB: "Alasan wajib diisi (minimal 3 karakter).",
  PERUBAHAN_STOK_TIDAK_VALID: "Perubahan stok tidak valid.",
  PRODUK_TIDAK_DITEMUKAN: "Produk tidak ditemukan.",
  STOK_DI_BAWAH_RESERVASI: "Stok tidak boleh lebih rendah dari jumlah yang sedang dipesan pelanggan.",
  STOK_TIDAK_CUKUP: "Stok tidak cukup",
  PRODUK_TIDAK_TERSEDIA: "Ada produk yang sudah tidak tersedia",
  KERANJANG_KOSONG: "Keranjang masih kosong.",
  KERANJANG_TERLALU_BESAR: "Terlalu banyak jenis produk dalam satu pesanan.",
  ITEM_TIDAK_VALID: "Ada isi keranjang yang tidak valid. Coba muat ulang halaman keranjang.",
  NAMA_TIDAK_VALID: "Nama tidak valid.",
  NOMOR_HP_TIDAK_VALID: "Nomor HP tidak valid.",
  TERLALU_BANYAK_PESANAN_TERBUKA: "Kamu masih punya beberapa pesanan yang belum dibayar. Selesaikan atau batalkan dulu.",
  PESANAN_TIDAK_DITEMUKAN: "Pesanan tidak ditemukan.",
  PESANAN_TIDAK_BISA_DIBATALKAN: "Pesanan ini tidak bisa dibatalkan lagi.",
  PESANAN_TIDAK_AKTIF: "Pesanan ini sudah tidak aktif.",
  PESANAN_DIBATALKAN: "Pesanan ini sudah dibatalkan, pembayarannya tidak bisa diverifikasi.",
  PEMBAYARAN_TIDAK_DITEMUKAN: "Pembayaran tidak ditemukan.",
  STATUS_PEMBAYARAN_TIDAK_VALID: "Status pembayaran ini sudah berubah. Muat ulang halaman.",
  NOMINAL_TIDAK_SESUAI: "Nominal tidak sama dengan tagihan",
  REFERENSI_WAJIB: "Nomor referensi mutasi wajib diisi.",
  REFERENSI_SUDAH_DIPAKAI: "Nomor referensi ini sudah dipakai pembayaran lain.",
  RESERVASI_TIDAK_ADA: "Reservasi stok pesanan ini tidak ditemukan. Periksa pesanan secara manual.",
  SUDAH_DIBAYAR_BUTUH_ALUR_REFUND: "Pesanan sudah dibayar. Pembatalan perlu proses refund yang belum tersedia.",
  BELUM_TERVERIFIKASI: "Pembayaran pesanan ini belum terverifikasi.",
  BELUM_LUNAS: "Pembayaran belum terverifikasi.",
  PEMBELIAN_TIDAK_DITEMUKAN: "Pembelian tidak ditemukan.",
  PEMBELIAN_BUKAN_DRAF: "Hanya pembelian berstatus draf yang bisa diterima.",
  PEMBELIAN_KOSONG: "Pembelian belum berisi barang.",
  PEMBELIAN_TIDAK_BISA_DIUBAH: "Pembelian ini sudah tidak bisa diubah.",
  RENTANG_TANGGAL_TIDAK_VALID: "Rentang tanggal tidak valid (maksimal 366 hari).",
};

export function rpcMessage(err: { message: string; details?: string | null }): string {
  const base = MESSAGES[err.message];
  if (!base) return "Terjadi kesalahan. Coba lagi.";
  return err.details ? `${base}: ${err.details}.` : base.endsWith(".") ? base : `${base}.`;
}
