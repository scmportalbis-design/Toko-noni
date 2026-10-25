import { describe, expect, it } from "vitest";
import { isUuid, one, rupiah, slugify } from "@/lib/format";

describe("format", () => {
  it("slugify membersihkan simbol dan aksen", () => {
    expect(slugify("Roti Tawar & Selai Cokelat!")).toBe("roti-tawar-selai-cokelat");
    expect(slugify("Café Éclair")).toBe("cafe-eclair");
    expect(slugify("!!!")).toBe("item");
  });
  it("rupiah memakai pemisah ribuan titik", () => {
    expect(rupiah(15000).replace(/\u00a0/g, " ")).toBe("Rp 15.000");
    expect(rupiah(0).replace(/\u00a0/g, " ")).toBe("Rp 0");
  });
  it("isUuid", () => {
    expect(isUuid("8ce987d3-58cb-49c4-8f31-829a1c27809b")).toBe(true);
    expect(isUuid("bukan-uuid")).toBe(false);
  });
  it("one menormalkan objek atau larik", () => {
    expect(one({ a: 1 })).toEqual({ a: 1 });
    expect(one([{ a: 1 }])).toEqual({ a: 1 });
    expect(one(null)).toBeNull();
    expect(one([])).toBeNull();
  });
});
