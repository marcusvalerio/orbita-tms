import { test, expect } from "@playwright/test";

// Mapa Operacional sem chave do Google: provedor esquemático + rotas estimadas.
// Mesmo contrato de tela usado com Google Maps.

test.beforeEach(async ({ page }) => {
  await page.goto("/config/preferencias");
  await page.getByRole("button", { name: "Carregar Cenário de Demonstração" }).first().click();
  await page.getByRole("button", { name: "Carregar Cenário", exact: true }).click();
});

test("mapa mostra rotas, paradas e veículo; seleção muda o painel", async ({ page }) => {
  await page.goto("/mapa");
  await expect(page.getByRole("img", { name: "Mapa esquemático da operação" })).toBeVisible();
  await expect(page.getByText("Mapa esquemático", { exact: true })).toBeVisible();

  const routes = page.getByRole("navigation", { name: "Rotas" });
  await routes.getByRole("button", { name: /BH-CENTRO-SUL-008/ }).click();
  const panel = page.getByRole("complementary", { name: /Detalhes da rota BH-CENTRO-SUL-008/ });
  await expect(panel).toContainText("Savassi");
  await expect(panel).toContainText(/Estimativa local|Google Routes/);
  await expect(page.locator('[data-marker-id="veh:VIA-00006"]')).toBeVisible();

  // Clicar no veículo seleciona a rota dele.
  await page.locator('[data-marker-id="veh:VIA-00004"]').dispatchEvent("click"); // fora do enquadramento atual
  await expect(page.getByRole("complementary", { name: /RJ-ZONA-OESTE-042/ })).toContainText("Carlos Mendes");
});

test("simulação: iniciar a 10×, estados das paradas avançam, reiniciar volta a 0%", async ({ page }) => {
  await page.goto("/mapa?viagem=VIA-00004");
  const panel = page.getByRole("complementary", { name: /RJ-ZONA-OESTE-042/ });
  const progress = panel.getByRole("progressbar", { name: "Progresso da rota" });

  await page.getByRole("button", { name: /Reiniciar simulação/ }).click();
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
  await expect(panel).toContainText("Em rota");

  await page.getByRole("radio", { name: "10×" }).click();
  await expect(page.getByRole("radio", { name: "10×" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Iniciar simulação", exact: true }).click();
  await expect.poll(async () => Number(await progress.getAttribute("aria-valuenow")), { timeout: 20_000 }).toBeGreaterThan(10);
  await expect(panel).toContainText(/Concluída/);

  await page.getByRole("button", { name: "Pausar simulação", exact: true }).click();
  await page.getByRole("button", { name: /Reiniciar simulação/ }).click();
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
});

test("busca de endereço cai para o cadastro local quando o Geocoding não está disponível", async ({ page }) => {
  await page.goto("/mapa");
  await page.getByLabel("Buscar endereço ou local").fill("Pampulha");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByRole("button", { name: /Pampulha — Belo Horizonte\/MG/ })).toBeVisible();
});

test("sem rotas: estado vazio orienta para o planejamento", async ({ page }) => {
  await page.goto("/config/preferencias");
  await page.getByRole("button", { name: "Reiniciar Simulação" }).first().click();
  await page.getByRole("button", { name: "Reiniciar Simulação" }).last().click();
  await page.goto("/mapa");
  await expect(page.getByText("Nenhuma rota em planejamento ou execução.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir para o planejamento" })).toBeVisible();
});
