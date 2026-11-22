import { describe, expect, it } from "vitest";
import { generatePassword, validateNewPassword } from "@/lib/password";

describe("validateNewPassword", () => {
  it("menolak password terlalu pendek", () => {
    expect(validateNewPassword("abc123", "abc123")).toMatch(/minimal 8/);
  });
  it("menolak konfirmasi yang berbeda", () => {
    expect(validateNewPassword("password123", "password124")).toMatch(/tidak sama/);
  });
  it("menolak lebih dari 72 byte", () => {
    const p = "a".repeat(73);
    expect(validateNewPassword(p, p)).toMatch(/terlalu panjang/);
  });
  it("menerima password valid", () => {
    expect(validateNewPassword("password123", "password123")).toBeNull();
  });
});

describe("generatePassword", () => {
  it("menghasilkan panjang yang diminta dan lolos validasi", () => {
    const p = generatePassword(12);
    expect(p).toHaveLength(12);
    expect(validateNewPassword(p, p)).toBeNull();
  });
});
