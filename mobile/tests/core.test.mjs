import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMetroEngine } from "../src/core/metro.js";
const at = Date.parse("2026-10-25T09:00:00Z");
const engine = createMetroEngine();
test("83 stations and six services have valid geometry", () => {
  assert.equal(Object.keys(engine.stations).length, 83);
  assert.equal(engine.services.length, 6);
  for (const s of engine.services) {
    assert.ok(engine.linePath(s.stops).startsWith("M"));
    for (const id of s.stops) assert.ok(engine.stations[id]);
  }
});
const source = readFileSync(
  new URL("../../src/riyadh-metro.html", import.meta.url),
  "utf8",
);
const fixtures = JSON.parse(
  source.match(/const VALIDATION=(\[[\s\S]*?\n\]);/)[1],
);
for (const [from, to, lines, transfers, mode] of fixtures)
  test(`existing route fixture ${from} → ${to}`, () => {
    const options = engine.plan(from, to, at),
      r = options.find((x) => x.modes.includes(mode || "fast")) || options[0];
    assert.ok(r);
    assert.equal(r.xf, transfers);
    assert.equal(
      r.legs
        .filter((l) => l.type === "ride")
        .map((l) => engine.services.find((s) => s.id === l.svc).line)
        .join(">"),
      lines,
    );
    assert.ok(r.timeMax >= r.time);
    assert.ok(r.time >= 0);
  });
test("unknown and same station inputs", () => {
  assert.throws(() => engine.plan("missing", "kafd", at));
  const r = engine.plan("kafd", "kafd", at)[0];
  assert.equal(r.rides, 0);
  assert.equal(r.time, 0);
  assert.equal(r.xf, 0);
});
test("language changes preserve routes and isolate engine instances", () => {
  const before = engine.plan("sab", "naseem", at);
  const ar = createMetroEngine();
  ar.setLanguage("ar");
  assert.deepEqual(ar.plan("sab", "naseem", at), before);
  assert.notEqual(ar.name("sab"), engine.name("sab"));
  assert.ok(
    ar
      .search("المركز المالي")
      .some((x) => x.id === "kafd" || x.place?.st === "kafd"),
  );
  assert.ok(ar.search("SAB").some((x) => x.id === "sab"));
  assert.throws(() => ar.setLanguage("missing"));
});
test("search aliases, station numbers and places", () => {
  assert.ok(engine.search("Olaya").some((x) => x.id === "stc"));
  assert.ok(engine.search("#1").some((x) => x.id === "sab"));
  assert.ok(
    engine
      .search("Airport")
      .some((x) => x.id === "t12" || x.place?.st === "t12"),
  );
});
test("nearest station and public share links", () => {
  assert.equal(engine.nearestStation([24.768004, 46.643644]).id, "kafd");
  assert.equal(
    engine.shareUrl("t12", "kafd"),
    "https://riyadhmetro.fyi/#t12~kafd~en",
  );
  assert.throws(() => engine.shareUrl("bad", "kafd"));
});
test("operating hours use Riyadh time", () => {
  assert.equal(
    engine.serviceState(Date.parse("2026-10-23T05:00:00Z")).open,
    false,
  );
  assert.equal(
    engine.serviceState(Date.parse("2026-10-23T08:00:00Z")).open,
    true,
  );
});
