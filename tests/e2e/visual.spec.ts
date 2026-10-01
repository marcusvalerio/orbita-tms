import { test, expect, type Page } from "@playwright/test";

// Regressão visual das telas-âncora. Relógio congelado (cenário e ETAs são
// relativos ao "agora"), animações desligadas e simulação parada → imagem
// determinística. Atualizar baseline: npx playwright test visual --update-snapshots

const NOW = new Date("2026-03-10T10:30:00-03:00");

async function prepare(page: Page) {
  await page.clock.setFixedTime(NOW);
  await page.goto("/config/preferencias");
  await page.getByRole("button", { name: "Carregar Cenário de Demonstração" }).first().click();
  await page.getByRole("button", { name: "Carregar cenário", exact: true }).click();
}

async function snap(page: Page, route: string, name: string) {
  await page.goto(route);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(name, { animations: "disabled", caret: "hide", fullPage: false, maxDiffPixelRatio: 0.01 });
}

// page.clock também congela performance.now → a câmera do mapa só fica
// determinística com movimento reduzido (transições instantâneas).
test.use({ contextOptions: { reducedMotion: "reduce" } });

test.describe("visual · desktop", () => {
  test.beforeEach(async ({ page }) => prepare(page));
  test("Command Center", async ({ page }) => snap(page, "/", "command-center.png"));
  test("Mapa", async ({ page }) => snap(page, "/mapa?viagem=VIA-00004", "mapa.png"));
  test("Viagens", async ({ page }) => snap(page, "/shipments", "viagens.png"));
  test("Viagem", async ({ page }) => snap(page, "/shipments/VIA-00004", "viagem.png"));
  test("Ocorrências", async ({ page }) => snap(page, "/occurrences", "ocorrencias.png"));
  test("Design System", async ({ page }) => snap(page, "/design-system", "design-system.png"));
});

test.describe("visual · mobile", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test.beforeEach(async ({ page }) => prepare(page));
  test("Command Center", async ({ page }) => snap(page, "/", "command-center-mobile.png"));
  test("Viagem", async ({ page }) => snap(page, "/shipments/VIA-00004", "viagem-mobile.png"));
});
