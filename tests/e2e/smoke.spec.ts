import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("pelanggan (360 px)", () => {
  test("katalog tampil tanpa geser horizontal", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Toko Noni" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("keranjang dan checkout kosong menampilkan pesan", async ({ page }) => {
    await page.goto("/keranjang");
    await expect(page.getByText("Keranjangmu masih kosong.")).toBeVisible();
    await page.goto("/checkout");
    await expect(page.getByText("Keranjangmu kosong.")).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("link pesanan dengan token salah tidak membocorkan data", async ({ page }) => {
    await page.goto("/pesanan/NON-000000-00000?t=token-salah");
    await expect(page.getByText("Pesanan tidak ditemukan")).toBeVisible();
  });
});

test.describe("admin tanpa login", () => {
  test("diarahkan ke halaman masuk", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole("button", { name: "Masuk" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
  test("halaman dalam admin juga dijaga", async ({ page }) => {
    await page.goto("/admin/payments");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});

const email = process.env.E2E_OWNER_EMAIL;
const password = process.env.E2E_OWNER_PASSWORD;

test.describe("admin (butuh akun uji)", () => {
  test.skip(!email || !password, "Isi E2E_OWNER_EMAIL dan E2E_OWNER_PASSWORD untuk menjalankan uji ini.");

  test("pemilik masuk dan semua halaman utama terbuka", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText(/Halo,/)).toBeVisible();
    await expectNoHorizontalScroll(page);

    for (const path of ["/admin/payments", "/admin/orders", "/admin/transactions", "/admin/products", "/admin/categories", "/admin/stock", "/admin/suppliers", "/admin/purchases", "/admin/reports", "/admin/users", "/admin/audit", "/admin/settings"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBeLessThan(400);
      await expect(page.getByRole("heading", { level: 1 }), path).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
  });
});
