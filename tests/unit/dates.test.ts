import { describe, expect, it } from "vitest";
import { addDays, firstOfMonth, isYmd, startOfDayISO, todayJakarta } from "@/lib/dates";

describe("dates (WIB)", () => {
  it("todayJakarta memakai zona Asia/Jakarta", () => {
    // 20:00 UTC tanggal 24 = 03:00 WIB tanggal 25
    expect(todayJakarta(new Date("2026-10-24T20:00:00Z"))).toBe("2026-10-25");
    expect(todayJakarta(new Date("2026-10-24T10:00:00Z"))).toBe("2026-10-24");
  });
  it("startOfDayISO = 17:00 UTC hari sebelumnya", () => {
    expect(startOfDayISO("2026-10-24")).toBe("2026-10-23T17:00:00.000Z");
  });
  it("addDays melewati batas bulan", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("isYmd dan firstOfMonth", () => {
    expect(isYmd("2026-10-24")).toBe(true);
    expect(isYmd("24-10-2026")).toBe(false);
    expect(isYmd(undefined)).toBe(false);
    expect(firstOfMonth("2026-10-24")).toBe("2026-10-01");
  });
});
