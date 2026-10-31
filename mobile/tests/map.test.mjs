import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMetroEngine } from "../src/core/metro.js";

const map = JSON.parse(readFileSync(new URL("../src/core/mapGeometry.json", import.meta.url), "utf8"));
const engine = createMetroEngine();

test("every engine station is on the map, with a position, label side and Arabic name", () => {
  const ids = Object.keys(engine.stations).sort();
  assert.deepEqual(map.stations.map((s) => s.id).sort(), ids);
  for (const s of map.stations) {
    assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y), s.id);
    assert.match(s.side, /^[lrtb]{1,2}$/, `${s.id} side`);
    assert.ok(s.ar, `${s.id} Arabic name`);
    assert.ok(s.lines.length >= 1, `${s.id} lines`);
  }
});

test("six numbered lines with drawable polylines and both theme colours", () => {
  assert.deepEqual(map.lines.map((l) => l.number), [1, 2, 3, 4, 5, 6]);
  for (const l of map.lines) {
    assert.ok(l.parts.length >= 1 && l.parts.every((p) => p.length >= 2 && p.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))), l.id);
    assert.match(map.colors.light[l.id], /^#/);
    assert.match(map.colors.dark[l.id], /^#/);
  }
});

test("line stops match the engine services", () => {
  for (const l of map.lines) {
    const svc = engine.services.find((s) => s.line === l.id);
    assert.deepEqual(l.stops, svc.stops, l.id);
  }
});

test("wadi, districts and the map box are present", () => {
  assert.ok(map.wadi.points.length > 3);
  assert.ok(map.districts.length >= 5 && map.districts.every((d) => d.ar));
  assert.ok(map.box.x1 > map.box.x0 && map.box.y1 > map.box.y0);
});
