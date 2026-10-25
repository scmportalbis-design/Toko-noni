export const orderStatusLabel: Record<string, string> = {
  open: "Aktif", completed: "Selesai", cancelled: "Dibatalkan", expired: "Kedaluwarsa",
};
export const paymentLabel: Record<string, string> = {
  pending: "Belum bayar", claimed: "Menunggu verifikasi", verified: "Terverifikasi",
  rejected: "Ditolak", refunded: "Dikembalikan",
};
export const fulfillmentLabel: Record<string, string> = {
  pending: "Belum disiapkan", preparing: "Sedang disiapkan", ready: "Siap diambil", picked_up: "Sudah diambil",
};
export const movementLabel: Record<string, string> = {
  purchase_receipt: "Pembelian", sale: "Penjualan", adjustment: "Koreksi", return: "Retur",
};
