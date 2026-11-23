import { describe, expect, it } from "vitest";
import { batchStatus, daysUntil, expiryText, fifoOrder, lossEstimate, nextOutBatchId } from "@/lib/batch";

const today = "2026-11-23";

describe("batchStatus", () => {
  it("tanggal kosong = belum diisi", () => expect(batchStatus(null, today)).toBe("unfilled"));
  it("hari terakhir masih dijual; besoknya kedaluwarsa", () => {
    expect(batchStatus("2026-11-23", today)).toBe("near");
    expect(batchStatus("2026-11-22", today)).toBe("expired");
  });
  it("batas 30 hari", () => {
    expect(batchStatus("2026-12-23", today)).toBe("near");
    expect(batchStatus("2026-12-24", today)).toBe("ok");
    expect(batchStatus("2026-12-01", today, 5)).toBe("ok");
  });
});

describe("daysUntil / expiryText", () => {
  it("menghitung selisih hari", () => {
    expect(daysUntil("2026-11-30", today)).toBe(7);
    expect(daysUntil("2026-11-20", today)).toBe(-3);
  });
  it("teks", () => {
    expect(expiryText(null, today)).toBe("Belum diisi");
    expect(expiryText("2026-11-23", today)).toBe("Hari ini terakhir");
    expect(expiryText("2026-11-30", today)).toBe("7 hari lagi");
    expect(expiryText("2026-11-20", today)).toBe("Lewat 3 hari");
  });
});

describe("FIFO", () => {
  const b = (id: string, at: string, qty: number, exp: string | null) => ({ id, received_at: at, qty_remaining: qty, expiry_date: exp });
  it("urut berdasarkan tanggal masuk, bukan tanggal kedaluwarsa", () => {
    const list = [b("c", "2026-11-03T00:00:00Z", 5, "2026-12-01"), b("a", "2026-11-01T00:00:00Z", 5, "2027-01-01"), b("b", "2026-11-02T00:00:00Z", 5, null)];
    expect(fifoOrder(list).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
  it("batch berikutnya melewati yang kosong dan yang kedaluwarsa", () => {
    const list = [
      b("a", "2026-10-01T00:00:00Z", 0, "2026-12-01"),
      b("b", "2026-10-02T00:00:00Z", 4, "2026-11-01"),
      b("c", "2026-10-03T00:00:00Z", 4, "2026-12-30"),
    ];
    expect(nextOutBatchId(list, today)).toBe("c");
    expect(nextOutBatchId([b("x", "2026-10-01T00:00:00Z", 0, null)], today)).toBeNull();
  });
  it("batch tanpa tanggal tetap bisa keluar", () => {
    expect(nextOutBatchId([b("o", "2026-01-01T00:00:00Z", 3, null)], today)).toBe("o");
  });
});

describe("lossEstimate", () => {
  it("qty x harga pokok", () => {
    expect(lossEstimate(4, 2500)).toBe(10000);
    expect(lossEstimate(-1, 2500)).toBe(0);
  });
});
