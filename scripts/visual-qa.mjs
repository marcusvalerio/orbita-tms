// QA visual da Fase 2: captura rotas em 4 viewports (desktop, laptop, tablet, mobile).
// Uso: node scripts/visual-qa.mjs <pasta-de-saida> [rota ...]
// Pré-requisito: app rodando em QA_BASE_URL (padrão http://localhost:3100) no Modo Demo.
// Carrega o cenário de demonstração antes de capturar (QA_EMPTY=1 para operação vazia).
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [, , out = "docs/orbita-2.0/phase-2/qa/latest", ...routesArg] = process.argv;
const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const routes = routesArg.length ? routesArg : ["/"];
const VIEWPORTS = { desktop: [1440, 900], laptop: [1280, 800], tablet: [834, 1112], mobile: [390, 844] };
const only = process.env.QA_VIEWPORTS?.split(",");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo", viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`${page.url()} ${e.message}`));

if (process.env.QA_SKIP_SETUP !== "1") {
  await page.goto(`${BASE}/`);
  await page.evaluate(() => localStorage.clear());
  if (process.env.QA_EMPTY !== "1") {
    await page.goto(`${BASE}/config/preferencias`);
    await page.getByRole("button", { name: /Carregar cenário de demonstração/i }).first().click();
    await page.getByRole("button", { name: /^Carregar cenário$/i }).click();
    await page.waitForTimeout(300);
  }
}

for (const [vp, [w, h]] of Object.entries(VIEWPORTS)) {
  if (only && !only.includes(vp)) continue;
  await page.setViewportSize({ width: w, height: h });
  for (const r of routes) {
    await page.goto(`${BASE}${r}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(Number(process.env.QA_WAIT ?? 700));
    const name = r === "/" ? "central" : r.replace(/^\//, "").replace(/[/?=&]/g, "_");
    await page.screenshot({ path: `${out}/${vp}-${name}.png`, fullPage: process.env.QA_FULL === "1" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    if (overflow) errors.push(`${vp} ${r}: overflow horizontal da página`);
  }
}
await browser.close();
if (errors.length) {
  console.log(errors.join("\n"));
  process.exitCode = 1;
} else console.log(`ok · ${out}`);
