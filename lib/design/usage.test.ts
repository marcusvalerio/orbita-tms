import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Disciplina do Órbita DS 2.0 no código das telas e componentes:
//   · cor só por token semântico (nada de paleta crua do Tailwind nem hex solto em className)
//   · texto nunca abaixo de 12px
//   · nada de tokens legados da Fase 1

const ROOTS = ["app", "components"];
const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(name)) files.push(p);
  }
};
ROOTS.forEach((r) => walk(join(process.cwd(), r)));

const RAW_PALETTE = /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|divide|accent|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;
const TINY_TEXT = /text-\[(?:[0-9]|1[01])(?:\.\d+)?px\]/;
const LEGACY = /\b(?:cosmic-ink|milk-mustache|blue-opal|suez-canal|rowdy-orange|cinnamon)\b/;
const HEX_CLASS = /className=["{`][^"}`]*\[#[0-9a-fA-F]{3,8}\]/;

for (const file of files) {
  const rel = file.slice(process.cwd().length + 1);
  test(`DS 2.0 — ${rel}`, () => {
    const src = readFileSync(file, "utf8");
    assert.doesNotMatch(src, RAW_PALETTE, "use tokens semânticos (ex.: text-danger-fg), não a paleta crua do Tailwind");
    assert.doesNotMatch(src, TINY_TEXT, "texto mínimo de 12px (text-caption)");
    assert.doesNotMatch(src, LEGACY, "token legado da Fase 1");
    assert.doesNotMatch(src, HEX_CLASS, "cor hex solta em className — crie/use um token");
  });
}
