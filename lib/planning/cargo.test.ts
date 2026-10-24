import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_ITEMS, VEHICLES, packCargo, stagingLayout } from "./cargo";

const truck = VEHICLES.find((v) => v.id === "truck")!;

test("só carrega os itens informados", () => {
  const r = packCargo([DEMO_ITEMS[0]], truck);
  assert.ok(r.placed.every((p) => p.itemId === DEMO_ITEMS[0].id));
});

test("primeira parada fica mais perto da porta que a última", () => {
  const r = packCargo(DEMO_ITEMS, truck);
  const stop = (id: string) => DEMO_ITEMS.find((i) => i.id === id)!.stop;
  const maxX = (s: number) => Math.max(...r.placed.filter((p) => stop(p.itemId) === s).map((p) => p.x + p.dx));
  const minX = (s: number) => Math.min(...r.placed.filter((p) => stop(p.itemId) === s).map((p) => p.x));
  assert.ok(minX(1) >= maxX(4) - 1e-3);
});

test("nenhuma caixa sobrepõe outra nem sai do baú", () => {
  const r = packCargo(DEMO_ITEMS, truck);
  for (const a of r.placed) {
    assert.ok(a.x + a.dx <= truck.length && a.y + a.dy <= truck.height && a.z + a.dz <= truck.width);
    for (const b of r.placed) {
      if (a === b) continue;
      const o = a.x < b.x + b.dx && b.x < a.x + a.dx && a.y < b.y + b.dy && b.y < a.y + a.dy && a.z < b.z + b.dz && b.z < a.z + a.dz;
      assert.ok(!o, `${a.key} sobrepõe ${b.key}`);
    }
  }
});

test("nada é empilhado sobre carga não empilhável", () => {
  const r = packCargo(DEMO_ITEMS, truck);
  const nonStack = r.placed.filter((p) => !DEMO_ITEMS.find((i) => i.id === p.itemId)!.stackable);
  for (const base of nonStack) {
    const above = r.placed.some((p) => Math.abs(p.y - (base.y + base.dy)) < 1e-3 && p.x < base.x + base.dx && base.x < p.x + p.dx && p.z < base.z + base.dz && base.z < p.z + p.dz);
    assert.ok(!above, `${base.key} tem carga por cima`);
  }
});

test("pátio: uma rua por parada, A = 1ª entrega, sem sobreposição", () => {
  const r = packCargo(DEMO_ITEMS, truck);
  const { slots, lanes } = stagingLayout(r.placed, DEMO_ITEMS, truck.length + 300, truck.width / 2);
  assert.deepEqual(lanes.map((l) => l.letter), ["A", "B", "C", "D"]);
  assert.equal(lanes[0].stop, 1);
  assert.equal(slots.size, r.placed.length);
  const boxes = r.placed.map((p) => ({ ...p, ...slots.get(p.key)! }));
  for (const a of boxes)
    for (const b of boxes) {
      if (a === b) continue;
      const o = a.x < b.x + b.dx && b.x < a.x + a.dx && a.y < b.y + b.dy && b.y < a.y + a.dy && a.z < b.z + b.dz && b.z < a.z + a.dz;
      assert.ok(!o, `${a.key} sobrepõe ${b.key} no pátio`);
    }
});
