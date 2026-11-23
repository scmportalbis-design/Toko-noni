import { describe, expect, it } from "vitest";
import { pickCurrentPayment } from "@/lib/payments";

describe("pickCurrentPayment", () => {
  const rej = { status: "rejected", created_at: "2026-11-22T01:00:00Z" };
  const open = { status: "pending", created_at: "2026-11-22T02:00:00Z" };
  const ver = { status: "verified", created_at: "2026-11-22T03:00:00Z" };

  it("terverifikasi > terbuka > terbaru", () => {
    expect(pickCurrentPayment([rej, open])).toBe(open);
    expect(pickCurrentPayment([rej, open, ver])).toBe(ver);
    expect(pickCurrentPayment([rej])).toBe(rej);
  });

  it("kosong atau null", () => {
    expect(pickCurrentPayment([])).toBeNull();
    expect(pickCurrentPayment(null)).toBeNull();
    expect(pickCurrentPayment(undefined)).toBeNull();
  });
});
