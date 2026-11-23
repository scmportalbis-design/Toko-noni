import { describe, expect, it } from "vitest";
import { buildReceiptPdf, money, pdfText, receiptLines, type ReceiptPdfData } from "@/lib/receipt-pdf";

const base: ReceiptPdfData = {
  storeName: "Toko Noni",
  title: "STRUK PEMBAYARAN - LUNAS",
  orderNumber: "NON-261122-00001",
  receiptNumber: "STR-261122-00001",
  dateText: "22 Nov 2026 19.30",
  customerName: "Budi (Pelanggan) \\ Test",
  paymentMethod: "QRIS",
  items: [
    { name: "Kopi Susu Café “Spesial” dengan nama produk yang sangat panjang sekali", qty: 2, unitPrice: 15000, lineTotal: 30000 },
    { name: "Roti", qty: 1, unitPrice: 12500, lineTotal: 12500 },
  ],
  discount: 2500,
  totalLabel: "Total dibayar",
  total: 40000,
  footer: "Terima kasih telah berbelanja.",
};

function decode(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => String.fromCharCode(b)).join("");
}

describe("receipt-pdf", () => {
  it("money memakai titik ribuan", () => {
    expect(money(15000)).toBe("Rp 15.000");
    expect(money(0)).toBe("Rp 0");
    expect(money(1234567)).toBe("Rp 1.234.567");
  });

  it("pdfText membuang karakter di luar ASCII", () => {
    expect(pdfText("Café — 2 × “x”")).toBe('Cafe - 2 x "x"');
    expect(pdfText("日本")).toBe("??");
    expect(pdfText("a\u00a0b")).toBe("a b");
  });

  it("tidak ada baris melebihi lebar kolom", () => {
    for (const l of receiptLines(base)) expect(l.length).toBeLessThanOrEqual(38);
  });

  it("berisi metode pembayaran, total, dan diskon", () => {
    const text = receiptLines(base).join("\n");
    expect(text).toContain("Pembayaran: QRIS");
    expect(text).toContain("Total dibayar");
    expect(text).toContain("Rp 40.000");
    expect(text).toContain("Diskon");
  });

  it("menghasilkan PDF valid: header, xref benar, kurung di-escape", () => {
    const bytes = buildReceiptPdf(base);
    const pdf = decode(bytes);
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf).toContain("\\(Pelanggan\\)");
    expect(pdf).toContain("\\\\");
    // startxref menunjuk ke tabel xref
    const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(pdf)![1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe("xref");
    // setiap offset objek menunjuk ke "<n> 0 obj"
    const entries = [...pdf.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(entries).toHaveLength(5);
    entries.forEach((off, i) => expect(pdf.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
    // Length stream sesuai isi
    const m = /<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/.exec(pdf)!;
    expect(Number(m[1])).toBe(m[2].length);
  });

  it("struk belum dibayar tidak memuat nomor struk", () => {
    const text = receiptLines({ ...base, receiptNumber: null, title: "BUKTI PESANAN - BELUM DIBAYAR", totalLabel: "Total tagihan" }).join("\n");
    expect(text).not.toContain("Struk:");
    expect(text).toContain("Total tagihan");
  });
});
