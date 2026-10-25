import { beforeEach, describe, expect, it } from "vitest";
import { useCart } from "@/lib/stores/cart";
import { rpcMessage } from "@/lib/rpc-errors";

const item = { productId: "p1", slug: "a", name: "Roti", price: 1000, unit: "pcs", imagePath: null, max: 3 };

describe("keranjang", () => {
  beforeEach(() => useCart.setState({ items: [] }));

  it("jumlah tidak melebihi stok tersedia", () => {
    useCart.getState().add(item);
    useCart.getState().add(item, 5);
    expect(useCart.getState().items[0].qty).toBe(3);
  });
  it("setQty dibatasi 1..stok", () => {
    useCart.getState().add(item);
    useCart.getState().setQty("p1", 0);
    expect(useCart.getState().items[0].qty).toBe(1);
    useCart.getState().setQty("p1", 99);
    expect(useCart.getState().items[0].qty).toBe(3);
  });
  it("applyServerData menghapus produk habis dan menyesuaikan harga/stok", () => {
    useCart.getState().add(item, 3);
    useCart.getState().add({ ...item, productId: "p2", name: "Kue" }, 1);
    const notes = useCart.getState().applyServerData([
      { id: "p1", name: "Roti", price: 1200, available: 2, image_path: null },
      { id: "p2", name: "Kue", price: 1000, available: 0, image_path: null },
    ]);
    const items = useCart.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ productId: "p1", qty: 2, price: 1200, max: 2 });
    expect(notes.length).toBe(3); // Kue dihapus, qty Roti disesuaikan, harga Roti berubah
  });
});

describe("rpcMessage", () => {
  it("memetakan kode dan menambahkan detail", () => {
    expect(rpcMessage({ message: "STOK_TIDAK_CUKUP", details: "Roti" })).toBe("Stok tidak cukup: Roti.");
    expect(rpcMessage({ message: "BELUM_LUNAS" })).toBe("Pembayaran belum terverifikasi.");
  });
  it("kode tak dikenal tidak membocorkan pesan internal", () => {
    expect(rpcMessage({ message: 'duplicate key value violates unique constraint "x"' })).toBe("Terjadi kesalahan. Coba lagi.");
  });
});
