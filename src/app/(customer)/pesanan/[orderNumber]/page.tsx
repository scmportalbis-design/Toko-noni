import Link from "next/link";
import { Suspense } from "react";
import { OrderStatus } from "@/components/customer/order-status";

type Params = Promise<{ orderNumber: string }>;
type SearchParams = Promise<{ t?: string }>;

export default function OrderPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Status pesanan</h1>
      <Suspense fallback={<p className="py-10 text-center text-sm text-stone-500">Memuat…</p>}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { orderNumber } = await params;
  const { t } = await searchParams;
  if (!t) {
    return (
      <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-700">
        Link pesanan tidak lengkap. Buka dari{" "}
        <Link href="/pesanan" className="font-medium text-emerald-800 underline">
          daftar pesananmu
        </Link>{" "}
        atau gunakan link lengkap yang kamu simpan.
      </p>
    );
  }
  return <OrderStatus orderNumber={decodeURIComponent(orderNumber)} token={t} />;
}
