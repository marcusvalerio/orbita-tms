import { test, expect, type Page } from "@playwright/test";

// Modo Demo: operação inteira no navegador, sem banco nem login.

async function freshDemo(page: Page, withScenario: boolean) {
  await page.goto("/config/preferencias");
  await page.getByRole("button", { name: "Reiniciar Simulação" }).first().click();
  await page.getByRole("button", { name: "Reiniciar Simulação" }).last().click();
  if (withScenario) {
    await page.getByRole("button", { name: "Carregar Cenário de Demonstração" }).first().click();
    await page.getByRole("button", { name: "Carregar Cenário", exact: true }).click();
  }
}

test("operação vazia oferece criar pedido ou carregar o cenário", async ({ page }) => {
  await freshDemo(page, false);
  await page.goto("/");
  await expect(page.getByText("Nenhuma operação em andamento.")).toBeVisible();
  await expect(page.getByText("Modo Demo")).toBeVisible();
});

test("fluxo ponta a ponta: pedido → planejamento → viagem → ocorrência → entrega", async ({ page }) => {
  await freshDemo(page, false);
  await page.goto("/");

  // Pedido: o domínio recusa item sem produto nem descrição e a tela mostra o motivo (L1).
  await page.getByRole("button", { name: "+ Novo Pedido" }).click();
  await page.getByRole("button", { name: "Criar Pedido" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "produto do catálogo ou de uma descrição" }).first()).toBeVisible();
  await page.getByLabel("Descrição do item 1").fill("Caixas de medicamentos");
  await page.getByLabel("Quantidade do item 1").fill("20");
  await page.getByLabel("Peso unitário (kg) do item 1").fill("12");
  await page.getByRole("button", { name: "Criar Pedido" }).click();
  await expect(page.getByText("Pedido criado e enviado para a fila de planejamento.")).toBeVisible();

  // Planejamento → carga → contratação → viagem.
  await page.goto("/planning");
  await page.getByRole("button", { name: /PED-00001/ }).click();
  await page.getByRole("button", { name: "Analisar Consolidação" }).click();
  await page.getByRole("button", { name: "Selecionar Plano" }).first().click();
  await page.getByRole("button", { name: "Confirmar Planejamento" }).click();
  await expect(page).toHaveURL(/\/shipments\/VIA-00001$/);

  await page.getByRole("button", { name: "Iniciar Viagem" }).click();
  await expect(page.getByTestId("trip-status").getByText("Em rota")).toBeVisible();

  await page.getByRole("button", { name: "Registrar Ocorrência" }).click();
  await page.getByRole("button", { name: "Atraso" }).click();
  await expect(page.getByTestId("trip-status").getByText("Com ocorrência")).toBeVisible();
  await expect(page.getByRole("button", { name: "Concluir Entrega" })).toHaveCount(0);

  await page.getByRole("button", { name: "Nova tentativa" }).click();
  await page.getByRole("button", { name: "Concluir Entrega" }).click();
  await expect(page.getByTestId("trip-status").getByText("Entregue")).toBeVisible();

  // Persistência local: sobrevive ao recarregar.
  await page.reload();
  await expect(page.getByTestId("trip-status").getByText("Entregue")).toBeVisible();
});

test("cenário demo é coerente: exceção aparece na Central com ocorrência aberta", async ({ page }) => {
  await freshDemo(page, true);
  await page.goto("/");
  await expect(page.getByText(/ocorrência aguarda resolução/)).toBeVisible();
  await page.goto("/shipments");
  await expect(page.getByRole("link", { name: "VIA-00001" })).toBeVisible();
});
