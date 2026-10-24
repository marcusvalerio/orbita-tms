import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_ITEMS, VEHICLES, axleLoads, cgWindow, packCargo, palletize, stagingLayout } from "./cargo";

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

test("tudo vai paletizado: paletes 120×100 e quantidade de volumes preservada", () => {
  const units = palletize(DEMO_ITEMS);
  for (const item of DEMO_ITEMS) {
    const mine = units.filter((u) => u.itemId === item.id);
    assert.equal(mine.reduce((s, u) => s + u.count, 0), item.quantity, item.id);
    if (item.kind !== "palete" && item.kind !== "saco") for (const u of mine) assert.deepEqual([u.dx, u.dz], [120, 100]);
  }
  // tambores de 2 em 2 (Ø60 cm sobre 120×100), geladeiras uma por palete
  assert.deepEqual(units.filter((u) => u.itemId === "P4").map((u) => u.count), [2, 2]);
  assert.deepEqual(units.filter((u) => u.itemId === "P2").map((u) => u.count), [1, 1]);
});

test("palete só vai em cima de palete empilhável de mesma base", () => {
  const r = packCargo(DEMO_ITEMS, truck);
  for (const top of r.placed.filter((p) => p.y > 0)) {
    const base = r.placed.find((p) => p.x === top.x && p.z === top.z && Math.abs(p.y + p.dy - top.y) < 1e-3);
    assert.ok(base && base.stackable && base.y === 0 && base.weightKg >= top.weightKg, `${top.key} sem apoio válido`);
  }
});

test("pátio: uma rua por parada, A = 1ª entrega, paletes sem sobreposição", () => {
  const r = packCargo(DEMO_ITEMS, truck);
  const { slots, lanes } = stagingLayout(r.placed, DEMO_ITEMS, truck.length + 400, truck.width / 2);
  assert.deepEqual(lanes.map((l) => l.letter), ["A", "B", "C", "D"]);
  assert.equal(lanes[0].stop, 1);
  assert.equal(slots.size, r.placed.length);
  // no pátio o palete fica girado: x-extensão = dz, z-extensão = dx
  const rects = r.placed.map((p) => ({ key: p.key, ...slots.get(p.key)!, hx: p.dz / 2, hz: p.dx / 2 }));
  for (const a of rects)
    for (const b of rects) {
      if (a === b) continue;
      const o = Math.abs(a.x - b.x) < a.hx + b.hx && Math.abs(a.z - b.z) < a.hz + b.hz;
      assert.ok(!o, `${a.key} sobrepõe ${b.key} no pátio`);
    }
});
test("peso por eixo: soma bate com tara + carga e diminui após cada entrega", () => {
  const r = packCargo(DEMO_ITEMS, truck);
  const loads = axleLoads(r.placed, DEMO_ITEMS, truck);
  const a = truck.axles;
  assert.equal(loads[0].afterStop, 0);
  assert.ok(Math.abs(loads[0].frontKg + loads[0].rearKg - (a.tareFrontKg + a.tareRearKg + r.weightKg)) <= 1);
  assert.equal(r.unplaced.length, 0);
  for (let i = 1; i < loads.length; i++) assert.ok(loads[i].cargoKg < loads[i - 1].cargoKg);
});

test("janela do CG: carga no CG dentro da janela é legal", () => {
  const w = cgWindow(5000, truck)!;
  assert.ok(w.min < w.max);
});
