import { OrderHistoryList } from "@/components/customer/order-history-list";

export default function OrdersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Pesanan saya</h1>
      <p className="text-sm text-stone-500">Daftar ini hanya tersimpan di perangkat yang kamu pakai sekarang.</p>
      <OrderHistoryList />
    </div>
  );
}
