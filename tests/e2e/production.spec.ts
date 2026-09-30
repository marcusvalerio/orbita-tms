import { test, expect, type Page } from "@playwright/test";
import pg from "pg";
import { E2E_PASSWORD } from "../../playwright.config";

// Modo Produção: PostgreSQL real, sessão, RBAC e isolamento do parceiro.
// Identidade via provedor local (o Neon Auth é substituível pela mesma porta);
// autorização e dados são 100% os de produção.

async function signIn(page: Page, email: string) {
  await page.goto("/auth/sign-in");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"));
}

test("sem sessão, qualquer página operacional leva ao login", async ({ page }) => {
  await page.goto("/shipments");
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
});

test("senha errada é recusada sem revelar se o e-mail existe", async ({ page }) => {
  await page.goto("/auth/sign-in");
  await page.getByLabel("E-mail").fill("operador@atlas.test");
  await page.getByLabel("Senha").fill("errada");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos." })).toBeVisible();
});

test("identidade válida sem vínculo vai para Acesso pendente", async ({ page }) => {
  await signIn(page, "desconhecido@outra.test");
  await expect(page).toHaveURL(/\/acesso-pendente$/);
});

test("operador executa comando: persiste no banco e fica na auditoria", async ({ page }) => {
  await signIn(page, "operador@atlas.test");
  await expect(page.getByText("Operador", { exact: true })).toBeVisible();
  await page.goto("/shipments/VIA-00006");
  await page.getByRole("button", { name: "Concluir Entrega" }).click();
  await expect(page.getByText("Entrega concluída — POD gerado.")).toBeVisible();
  await page.reload();
  await expect(page.locator("header").getByText("Entregue")).toBeVisible();

  const client = new pg.Client({ connectionString: process.env.E2E_DATABASE_URL });
  await client.connect();
  const { rows } = await client.query(
    "select email, outcome from audit_log where command_type = 'COMPLETE_DELIVERY' order by id desc limit 1"
  );
  await client.end();
  expect(rows[0]).toEqual({ email: "operador@atlas.test", outcome: "applied" });
});

test("somente leitura não vê ações de escrita", async ({ page }) => {
  await signIn(page, "visualizacao@atlas.test");
  await expect(page.getByRole("button", { name: "Novo Pedido" })).toHaveCount(0);
  await page.goto("/shipments/VIA-00007");
  await expect(page.getByRole("button", { name: /Iniciar Viagem|Concluir Entrega|Registrar Ocorrência/ })).toHaveCount(0);
});

test("sessão autenticada pode consultar a API de rotas (entrada inválida → 400, não 401)", async ({ page }) => {
  await signIn(page, "visualizacao@atlas.test");
  const status = await page.evaluate(async () => (await fetch("/api/geo/route", { method: "POST", body: "{}" })).status);
  expect(status).toBe(400);
});

test("parceiro só acessa o Portal e só vê a própria empresa", async ({ page }) => {
  await signIn(page, "parceiro@atlas.test");
  await page.goto("/orders");
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByText("Farmavida")).toBeVisible();
  await expect(page.getByText("SOL-00001")).toBeVisible();
  // Nada de dados internos na página.
  const html = await page.content();
  expect(html).not.toContain("ORBT-014");
  expect(html).not.toContain("Carlos Mendes");
});

test("APIs geo exigem sessão em produção", async ({ request }) => {
  const res = await request.post("/api/geo/route", { data: { stops: [{ lat: -22.9, lng: -43.3 }, { lat: -22.95, lng: -43.35 }] } });
  expect(res.status()).toBe(401);
});
