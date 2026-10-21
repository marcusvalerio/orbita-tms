import { test, expect, type Page } from "@playwright/test";

// Experiência da Fase 2 (Modo Demo): navegação, Command Menu, filtros na URL,
// fila "Agora", Caixa de entrada, contratação, resolução rápida e mobile.

async function loadScenario(page: Page) {
  await page.goto("/config/preferencias");
  await page.getByRole("button", { name: "Carregar Cenário de Demonstração" }).first().click();
  await page.getByRole("button", { name: "Carregar cenário", exact: true }).click();
}

test.beforeEach(async ({ page }) => loadScenario(page));

test("⌘K encontra uma viagem e abre a página dela", async ({ page }) => {
  await page.goto("/shipments");
  await expect(page.getByRole("link", { name: "VIA-00001" })).toBeVisible(); // hidratado
  await page.keyboard.press("ControlOrMeta+k");
  const menu = page.getByRole("dialog", { name: "Command Menu" });
  await expect(menu).toBeVisible();
  await menu.getByPlaceholder(/Buscar viagem/).fill("VIA-00004");
  await menu.getByRole("option", { name: /VIA-00004/ }).first().click();
  await expect(page).toHaveURL(/\/shipments\/VIA-00004$/);
  await expect(menu).toBeHidden();
});

test("filtro da Central vai para a URL e a fila Agora resolve a ocorrência", async ({ page }) => {
  await page.goto("/");
  const filters = page.getByRole("radiogroup", { name: "Situação das viagens" });
  await filters.getByRole("radio", { name: /Com ocorrência/ }).click();
  await expect(page).toHaveURL(/filtro=ocorrencia/);
  await expect(filters.getByRole("radio", { name: /Com ocorrência/ })).toHaveAttribute("aria-checked", "true");

  // O estado sobrevive ao recarregar (fonte da verdade = URL).
  await page.reload();
  await expect(page.getByRole("radiogroup", { name: "Situação das viagens" }).getByRole("radio", { name: /Com ocorrência/ })).toHaveAttribute("aria-checked", "true");

  const agora = page.getByRole("region", { name: "Agora" });
  const item = agora.getByRole("article").filter({ hasText: /Ocorrência .+ aberta/ }).first();
  await expect(item).toBeVisible();
  await item.getByRole("button", { name: "Resolver", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Resolver ocorrência" });
  await dialog.getByRole("button", { name: "Nova tentativa" }).click();
  await expect(dialog).toBeHidden();
  await expect(agora.getByText(/Ocorrência .+ aberta/)).toHaveCount(0);
});

test("rotas antigas redirecionam sem perder função", async ({ page }) => {
  await page.goto("/solicitacoes");
  await expect(page).toHaveURL(/\/orders\?aba=entrada$/);
  await expect(page.getByRole("table", { name: "Caixa de entrada" })).toBeVisible();

  await page.goto("/contratacao");
  await expect(page).toHaveURL(/\/loads\?filtro=aguardando$/);
});

test("Caixa de entrada: solicitação vira pedido", async ({ page }) => {
  await page.goto("/orders?aba=entrada");
  await page.getByRole("table", { name: "Caixa de entrada" }).getByRole("row", { name: /SOL-00002/ }).click();
  const convert = page.getByRole("region", { name: "Converter em pedido" });
  await convert.getByRole("button", { name: "Converter em pedido" }).click();
  await expect(page).toHaveURL(/pedido=PED-\d+/);
});

test("Cargas: contratar com frota própria cria a viagem", async ({ page }) => {
  await page.goto("/loads?filtro=aguardando");
  const row = page.getByRole("table", { name: "Cargas" }).getByRole("row").nth(1);
  await row.click();
  await expect(page).toHaveURL(/carga=CAR-\d+/);
  const options = page.getByRole("radiogroup", { name: "Opções de transporte" });
  await await options.getByRole("radio", { name: /Frota própria/i }).click();
  await expect(options.getByRole("radio", { name: /Frota própria/i })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Confirmar contratação" }).click();
  await expect(page).toHaveURL(/\/shipments\/VIA-\d+$/);
  await expect(page.getByTestId("trip-status").getByText("Planejada")).toBeVisible();
});

test("Ocorrências: resolução rápida com a ação sugerida", async ({ page }) => {
  await page.goto("/occurrences");
  const table = page.getByRole("table", { name: "Ocorrências" });
  const row = table.getByRole("row").nth(1);
  const id = (await row.getByRole("cell").first().innerText()).trim();
  await row.getByRole("button").first().click();
  // Resolvida sai de "Abertas" e aparece em "Resolvidas".
  await expect(page.getByRole("row", { name: new RegExp(id) })).toHaveCount(0);
  await page.getByRole("radiogroup", { name: "Ocorrências" }).getByRole("radio", { name: /Resolvidas/ }).click();
  await expect(page.getByRole("row", { name: new RegExp(id) })).toBeVisible();
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("bottom nav com 5 destinos e sheet Mais com o restante", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByRole("link")).toHaveCount(4);
    await expect(nav.getByRole("button", { name: "Mais" })).toBeVisible();

    await nav.getByRole("link", { name: "Viagens" }).click();
    await expect(page).toHaveURL(/\/shipments$/);
    await expect(nav.getByRole("link", { name: "Viagens" })).toHaveAttribute("aria-current", "page");

    await nav.getByRole("button", { name: "Mais" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("link", { name: "Frota" }).click();
    await expect(page).toHaveURL(/\/fleet$/);
    await expect(sheet).toBeHidden();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
