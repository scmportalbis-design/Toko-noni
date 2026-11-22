// Pembuat PDF struk tanpa dependensi tambahan. Lebar kertas 80 mm (struk thermal),
// tinggi menyesuaikan isi, font Courier supaya kolom rata.

export type ReceiptPdfData = {
  storeName: string;
  title: string; // mis. "STRUK PEMBAYARAN - LUNAS"
  orderNumber: string;
  receiptNumber: string | null;
  dateText: string;
  customerName: string;
  paymentMethod: string; // mis. "Tunai"
  items: { name: string; qty: number; unitPrice: number; lineTotal: number }[];
  discount: number;
  totalLabel: string; // "Total dibayar" | "Total tagihan"
  total: number;
  footer: string;
};

const COLS = 38; // karakter per baris (Courier 8 pt)
const FONT_SIZE = 8;
const LEADING = 10;
const WIDTH = 226.77; // 80 mm dalam poin
const MARGIN = 12;

export function pdfText(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u00a0\u2009\u202f]/g, " ")
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u00d7/g, "x")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\x20-\x7e]/g, "?");
}

export function money(n: number): string {
  const digits = Math.abs(Math.trunc(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 ? "-" : ""}Rp ${digits}`;
}

function center(s: string): string {
  const t = pdfText(s).slice(0, COLS);
  return " ".repeat(Math.max(0, Math.floor((COLS - t.length) / 2))) + t;
}

function row(left: string, right: string): string {
  const l = pdfText(left);
  const r = pdfText(right);
  const gap = COLS - l.length - r.length;
  if (gap >= 1) return l + " ".repeat(gap) + r;
  return `${l.slice(0, Math.max(0, COLS - r.length - 1))} ${r}`.slice(0, COLS);
}

function wrap(s: string): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of pdfText(s).split(/\s+/).filter(Boolean)) {
    let w = word;
    while (w.length > COLS) {
      if (line) { out.push(line); line = ""; }
      out.push(w.slice(0, COLS));
      w = w.slice(COLS);
    }
    if (!line) line = w;
    else if (line.length + 1 + w.length <= COLS) line += ` ${w}`;
    else { out.push(line); line = w; }
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

export function receiptLines(d: ReceiptPdfData): string[] {
  const rule = "-".repeat(COLS);
  const lines: string[] = [];
  lines.push(center(d.storeName), center(d.title), rule);
  lines.push(...wrap(`Pesanan: ${d.orderNumber}`));
  if (d.receiptNumber) lines.push(...wrap(`Struk: ${d.receiptNumber}`));
  lines.push(...wrap(`Tanggal: ${d.dateText}`));
  lines.push(...wrap(`Pelanggan: ${d.customerName}`));
  lines.push(...wrap(`Pembayaran: ${d.paymentMethod}`));
  lines.push(rule);
  for (const i of d.items) {
    lines.push(...wrap(i.name));
    lines.push(row(`  ${i.qty} x ${money(i.unitPrice)}`, money(i.lineTotal)));
  }
  lines.push(rule);
  if (d.discount > 0) lines.push(row("Diskon", `- ${money(d.discount)}`));
  lines.push(row(d.totalLabel, money(d.total)), rule);
  lines.push(...wrap(d.footer).map(center));
  return lines;
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function buildReceiptPdf(d: ReceiptPdfData): Uint8Array {
  const lines = receiptLines(d);
  const height = Math.ceil(MARGIN * 2 + lines.length * LEADING);
  const startY = height - MARGIN - FONT_SIZE;

  const body = lines.map((l) => `(${esc(l)}) Tj T*`).join("\n");
  const content = `BT\n/F1 ${FONT_SIZE} Tf\n${LEADING} TL\n${MARGIN} ${startY} Td\n${body}\nET`;

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${WIDTH} ${height}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
  ];

  // Semua karakter sudah ASCII (lihat pdfText), jadi 1 karakter = 1 byte.
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, idx) => {
    offsets.push(pdf.length);
    pdf += `${idx + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const out = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) out[i] = pdf.charCodeAt(i) & 0xff;
  return out;
}
