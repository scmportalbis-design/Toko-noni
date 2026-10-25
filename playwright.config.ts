import { defineConfig, devices } from "@playwright/test";

// Semua uji berjalan di lebar ponsel 360 px (mobile-first).
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [{ name: "mobile-360", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 740 } } }],
  webServer: { command: "pnpm dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
});
