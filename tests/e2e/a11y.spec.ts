import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Acessibilidade automatizada (axe-core, WCAG 2.1 A/AA) nas telas principais
// e nos estados de overlay. Falha em violações "serious" ou "critical".

async function loadScenario(page: Page) {
  await page.goto("/config/preferencias");
  await page.getByRole("button", { name: "Carregar Cenário de Demonstração" }).first().click();
  await page.getByRole("button", { name: "Carregar cenário", exact: true }).click();
}

async function audit(page: Page, context: string) {
  // Overlays entram com fade: analisar no meio da animação gera falso contraste.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity));
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const report = blocking.map((v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n    ")}`).join("\n  ");
  expect(report, context).toBe("");
}

const ROUTES = [
  "/",
  "/mapa",
  "/shipments",
  "/shipments/VIA-00004",
  "/deliveries",
  "/occurrences",
  "/orders",
  "/orders?aba=entrada",
  "/planning",
  "/loads",
  "/fleet",
  "/drivers",
  "/carriers",
  "/parceiros",
  "/config/preferencias",
  "/design-system",
];

test.describe("axe", () => {
  test.beforeEach(async ({ page }) => loadScenario(page));

  for (const route of ROUTES) {
    test(`tela ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await audit(page, route);
    });
  }

  test("overlays: Command Menu, Novo pedido, drawer de carga, resolução", async ({ page }) => {
    await page.goto("/shipments");
    await expect(page.getByRole("link", { name: "VIA-00001" })).toBeVisible();
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByRole("dialog", { name: "Command Menu" })).toBeVisible();
    await audit(page, "Command Menu");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Novo", exact: true }).click();
    await page.getByRole("menuitem", { name: /Novo pedido/ }).click();
    await expect(page.getByRole("dialog", { name: /Novo pedido/ })).toBeVisible();
    await audit(page, "Novo pedido");
    await page.keyboard.press("Escape");

    await page.goto("/loads?filtro=aguardando");
    await page.getByRole("table", { name: "Cargas" }).getByRole("row").nth(1).click();
    await expect(page.getByRole("radiogroup", { name: "Opções de transporte" })).toBeVisible();
    await audit(page, "Drawer de carga");

    await page.goto("/occurrences");
    await page.getByRole("table", { name: "Ocorrências" }).getByRole("row").nth(1).getByRole("cell").first().click();
    await expect(page.getByRole("region", { name: "Resolver" })).toBeVisible();
    await audit(page, "Drawer de ocorrência");
  });

  test.describe("mobile", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    test("Central e sheet Mais", async ({ page }) => {
      await page.goto("/");
      await audit(page, "Central mobile");
      await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("button", { name: "Mais" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await audit(page, "Sheet Mais");
    });
  });
});

test("login e portal (fora do shell)", async ({ page }) => {
  for (const route of ["/auth/sign-in", "/portal"]) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await audit(page, route);
  }
});
