import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveBrowserKey, resolveServerKey } from "./google-keys";

test("chave de navegador: nome novo tem prioridade, nome antigo é alias", () => {
  assert.deepEqual(resolveBrowserKey({ GOOGLE_MAPS_BROWSER_KEY: "b", GOOGLE_MAPS_API_KEY: "old" }), { value: "b", variable: "GOOGLE_MAPS_BROWSER_KEY" });
  assert.deepEqual(resolveBrowserKey({ GOOGLE_MAPS_API_KEY: "old" }), { value: "old", variable: "GOOGLE_MAPS_API_KEY" });
});

test("chave de servidor: nome novo tem prioridade, nome antigo é alias", () => {
  assert.deepEqual(resolveServerKey({ GOOGLE_MAPS_SERVER_KEY: "s", GOOGLE_MAPS_SERVER_API_KEY: "old" }), { value: "s", variable: "GOOGLE_MAPS_SERVER_KEY" });
  assert.deepEqual(resolveServerKey({ GOOGLE_MAPS_SERVER_API_KEY: "old" }), { value: "old", variable: "GOOGLE_MAPS_SERVER_API_KEY" });
});

test("uma chave nunca substitui a outra", () => {
  assert.equal(resolveServerKey({ GOOGLE_MAPS_BROWSER_KEY: "b", GOOGLE_MAPS_API_KEY: "b" }), null);
  assert.equal(resolveBrowserKey({ GOOGLE_MAPS_SERVER_KEY: "s", GOOGLE_MAPS_SERVER_API_KEY: "s" }), null);
});

test("vazio ou só espaços conta como ausente", () => {
  assert.equal(resolveBrowserKey({ GOOGLE_MAPS_BROWSER_KEY: "  ", GOOGLE_MAPS_API_KEY: "" }), null);
  assert.equal(resolveServerKey({}), null);
});
