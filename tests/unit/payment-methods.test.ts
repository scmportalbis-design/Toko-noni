import { describe, expect, it } from "vitest";
import { cashChange, isPaymentMethod, methodLabel, pickCurrentPayment } from "@/lib/payment-methods";

describe("payment-methods", () => {
  it("isPaymentMethod & methodLabel", () => {
    expect(isPaymentMethod("cash")).toBe(true);
    expect(isPaymentMethod("qris_static")).toBe(true);
    expect(isPaymentMethod("transfer")).toBe(false);
    expect(methodLabel("cash")).toBe("Tunai");
    expect(methodLabel("qris_static")).toBe("QRIS");
    expect(methodLabel(null)).toBe("QRIS");
    expect(methodLabel("aneh")).toBe("QRIS");
  });

  it("pickCurrentPayment: terverifikasi > terbuka > terbaru", () => {
    const rej = { status: "rejected", method: "qris_static", created_at: "2026-11-22T01:00:00Z" };
    const open = { status: "pending", method: "cash", created_at: "2026-11-22T02:00:00Z" };
    const ver = { status: "verified", method: "cash", created_at: "2026-11-22T03:00:00Z" };
    expect(pickCurrentPayment([rej, open])).toBe(open);
    expect(pickCurrentPayment([rej, open, ver])).toBe(ver);
    expect(pickCurrentPayment([rej])).toBe(rej);
    expect(pickCurrentPayment([])).toBeNull();
    expect(pickCurrentPayment(null)).toBeNull();
  });

  it("cashChange", () => {
    expect(cashChange(50000, 42500)).toBe(7500);
    expect(cashChange(42500, 42500)).toBe(0);
    expect(cashChange(40000, 42500)).toBeNull();
    expect(cashChange(NaN, 42500)).toBeNull();
  });
});
