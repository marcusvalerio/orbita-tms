import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COLOR, COLOR_CSS_VAR, DURATION } from "./tokens.ts";

// Garante que o Órbita DS 2.0 continua WCAG 2.2 AA: cada par texto/fundo e
// gráfico/fundo usado pelos componentes é medido a partir de app/globals.css.

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf(":root[data-theme"));

function resolve(name: string, depth = 0): string {
  assert.ok(depth < 10, `referência circular em ${name}`);
  const match = rootBlock.match(new RegExp(`${name.replace(/[-]/g, "\\-")}:\\s*([^;]+);`));
  assert.ok(match, `token ${name} não encontrado em globals.css`);
  const value = match[1].trim();
  const ref = value.match(/^var\((--[\w-]+)\)$/);
  return ref ? resolve(ref[1], depth + 1) : value.toLowerCase();
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const GRAPHIC = 3;

const pairs: [fg: string, bg: string, min: number, label: string][] = [
  // Texto sobre superfícies
  ["--orb-fg", "--orb-canvas", TEXT, "texto / canvas"],
  ["--orb-fg-muted", "--orb-canvas", TEXT, "texto secundário / canvas"],
  ["--orb-fg-muted", "--orb-surface", TEXT, "texto secundário / superfície"],
  ["--orb-fg-subtle", "--orb-surface", TEXT, "texto auxiliar / superfície"],
  ["--orb-fg-subtle", "--orb-canvas", TEXT, "texto auxiliar / canvas"],
  ["--orb-fg-muted", "--orb-surface-sunken", TEXT, "texto secundário / afundado"],
  ["--orb-fg", "--orb-surface-selected", TEXT, "texto / linha selecionada"],
  ["--orb-chrome-fg", "--orb-chrome", TEXT, "navegação / chrome"],
  ["--orb-chrome-muted", "--orb-chrome", TEXT, "navegação secundária / chrome"],
  ["--orb-chrome-muted", "--orb-chrome-hover", TEXT, "navegação secundária / item em hover"],
  ["--orb-chrome-danger", "--orb-chrome", TEXT, "atenção / chrome"],
  ["--orb-chrome-success", "--orb-chrome", TEXT, "sucesso / chrome"],
  ["--orb-chrome-warning", "--orb-chrome", TEXT, "aviso / chrome"],
  // Ação e marca
  ["--orb-primary-fg", "--orb-primary", TEXT, "botão primário"],
  ["--orb-primary-fg", "--orb-primary-hover", TEXT, "botão primário (hover)"],
  ["--orb-brand-fg", "--orb-surface", TEXT, "texto de marca / superfície"],
  ["--orb-brand-fg", "--orb-brand-subtle", TEXT, "texto de marca / fundo de marca"],
  ["--orb-brand", "--orb-surface", GRAPHIC, "indicador de seleção / superfície"],
  ["--orb-focus", "--orb-surface", GRAPHIC, "anel de foco / superfície"],
  ["--orb-focus", "--orb-canvas", GRAPHIC, "anel de foco / canvas"],
  ["--orb-line-strong", "--orb-surface", 1.4, "borda forte (decorativa)"],
  // Estados: texto sobre o próprio fundo + ícone sobre superfície
  ...(["neutral", "info", "success", "warning", "danger", "exception"] as const).flatMap(
    (s) =>
      [
        [`--orb-${s}-fg`, `--orb-${s}-subtle`, TEXT, `${s}: texto / fundo`],
        [`--orb-${s}-fg`, "--orb-surface", TEXT, `${s}: texto / superfície`],
        [`--orb-${s}`, "--orb-surface", GRAPHIC, `${s}: ícone / superfície`],
        [`--orb-${s}`, "--orb-canvas", GRAPHIC, `${s}: ícone / canvas`],
      ] as [string, string, number, string][]
  ),
  ["--orb-critical-fg", "--orb-critical", TEXT, "crítico: texto / sólido"],
  ["--orb-critical", "--orb-surface", GRAPHIC, "crítico: sólido / superfície"],
  // Domínio sobre o mapa claro
  ["--orb-route", "--orb-map-land", GRAPHIC, "rota ativa / mapa"],
  ["--orb-route-muted", "--orb-map-land", 2, "rota secundária / mapa (contextual)"],
  ["--orb-vehicle", "--orb-map-land", GRAPHIC, "veículo / mapa"],
  ["--orb-delivery", "--orb-map-land", GRAPHIC, "entrega / mapa"],
  ["--orb-exception", "--orb-map-land", GRAPHIC, "exceção / mapa"],
  ["--orb-danger", "--orb-map-land", GRAPHIC, "atraso / mapa"],
  ["--orb-warning", "--orb-map-land", GRAPHIC, "risco / mapa"],
  ["--orb-success", "--orb-map-land", GRAPHIC, "concluída / mapa"],
  ["--orb-map-label", "--orb-map-land", TEXT, "rótulo / mapa"],
  ["--orb-delivery", "--orb-delivery-subtle", TEXT, "entrega: texto / fundo"],
];

for (const [fg, bg, min, label] of pairs) {
  test(`contraste AA — ${label}`, () => {
    const ratio = contrast(resolve(fg), resolve(bg));
    assert.ok(ratio >= min, `${label}: ${ratio.toFixed(2)}:1 < ${min}:1 (${fg} sobre ${bg})`);
  });
}

test("ação primária e estado crítico nunca compartilham cor", () => {
  const action = new Set([resolve("--orb-primary"), resolve("--orb-brand")]);
  for (const s of ["danger", "critical", "warning", "exception"]) {
    assert.ok(!action.has(resolve(`--orb-${s}`)), `--orb-${s} igual a uma cor de ação/marca`);
  }
});

test("tokens TS espelham globals.css", () => {
  for (const [key, cssVar] of Object.entries(COLOR_CSS_VAR)) {
    assert.equal(COLOR[key as keyof typeof COLOR], resolve(cssVar), `${key} ≠ ${cssVar}`);
  }
});

test("durações TS espelham globals.css", () => {
  for (const [key, ms] of Object.entries(DURATION)) {
    assert.equal(resolve(`--orb-duration-${key}`), `${ms}ms`);
  }
});
