"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/payments", label: "Pembayaran" },
  { href: "/admin/orders", label: "Pesanan" },
  { href: "/admin/transactions", label: "Transaksi" },
  { href: "/admin/products", label: "Produk" },
  { href: "/admin/categories", label: "Kategori" },
  { href: "/admin/stock", label: "Stok" },
  { href: "/admin/suppliers", label: "Pemasok", ownerOnly: true },
  { href: "/admin/purchases", label: "Pembelian", ownerOnly: true },
  { href: "/admin/reports", label: "Laporan", ownerOnly: true },
  { href: "/admin/users", label: "Pengguna", ownerOnly: true },
  { href: "/admin/audit", label: "Audit", ownerOnly: true },
  { href: "/admin/settings", label: "Pengaturan", ownerOnly: true },
] as const;

export function AdminNav({ role }: { role: "owner" | "cashier" }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu admin" className="mx-auto max-w-5xl overflow-x-auto px-2">
      <ul className="flex gap-1 pb-2">
        {ITEMS.filter((i) => !("ownerOnly" in i) || role === "owner").map((item) => {
          const exact = "exact" in item && item.exact;
          const active = exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-4 text-sm font-medium ${
                  active ? "bg-emerald-700 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
