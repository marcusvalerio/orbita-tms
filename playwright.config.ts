import { defineConfig } from "@playwright/test";

// E2E do ÓRBITA. Pré-requisito: `npm run build`.
//   npm run test:e2e                      → Modo Demo (sem banco) + Mapa
//   E2E_DATABASE_URL=… npm run test:e2e   → inclui o Modo Produção (banco
//                                           dedicado; migrado e semeado pelo
//                                           global setup) com identidade local.
// O mapa roda sem chave do Google (esquemático) para ser determinístico.

const prodDb = process.env.E2E_DATABASE_URL;
const DEV_SECRET = "e2e-only-secret-000000000000000000000000000000";
export const E2E_PASSWORD = "orbita-e2e";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: prodDb ? "./tests/e2e/global-setup.ts" : undefined,
  use: {
    viewport: { width: 1440, height: 900 },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: "demo", testMatch: /(demo|map|experience|a11y|visual)\.spec\.ts/, use: { baseURL: "http://localhost:3100" } },
    ...(prodDb ? [{ name: "production", testMatch: /production\.spec\.ts/, use: { baseURL: "http://localhost:3200" } }] : []),
  ],
  webServer: [
    {
      command: "npx next start -p 3100",
      url: "http://localhost:3100/auth/sign-in",
      reuseExistingServer: !process.env.CI,
      env: { ORBITA_MODE: "demo", GOOGLE_MAPS_API_KEY: "", GOOGLE_MAPS_SERVER_API_KEY: "" },
    },
    ...(prodDb
      ? [
          {
            command: "npx next start -p 3200",
            url: "http://localhost:3200/auth/sign-in",
            reuseExistingServer: !process.env.CI,
            env: {
              ORBITA_MODE: "production",
              ORBITA_AUTH_PROVIDER: "dev",
              ORBITA_ALLOW_INSECURE_DEV_AUTH: "true",
              ORBITA_DEV_AUTH_INSECURE_COOKIE: "true",
              ORBITA_DEV_AUTH_SECRET: DEV_SECRET,
              ORBITA_DEV_AUTH_PASSWORD: E2E_PASSWORD,
              DATABASE_URL: prodDb,
              GOOGLE_MAPS_API_KEY: "",
              GOOGLE_MAPS_SERVER_API_KEY: "",
            },
          },
        ]
      : []),
  ],
});
