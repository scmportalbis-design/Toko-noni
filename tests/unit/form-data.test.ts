import { describe, expect, it } from "vitest";
import { bool, str, toInt, toRupiah } from "@/lib/form-data";

describe("form-data", () => {
  it("toInt mengambil angka saja", () => {
    expect(toInt("Rp 15.000")).toBe(15000);
    expect(toInt("")).toBeNull();
    expect(toInt(null)).toBeNull();
  });
  it("toRupiah membuang desimal di akhir", () => {
    expect(toRupiah("30.000,00")).toBe(30000);
    expect(toRupiah("30.000")).toBe(30000);
    expect(toRupiah("15.50")).toBe(15);
    expect(toRupiah("Rp 1.250.000")).toBe(1250000);
  });
  it("str dan bool membaca FormData", () => {
    const fd = new FormData();
    fd.set("a", "  halo ");
    fd.set("b", "   ");
    fd.set("c", "on");
    expect(str(fd, "a")).toBe("halo");
    expect(str(fd, "b")).toBeNull();
    expect(str(fd, "tidak-ada")).toBeNull();
    expect(bool(fd, "c")).toBe(true);
    expect(bool(fd, "d")).toBe(false);
  });
});
