import test from "node:test";
import assert from "node:assert/strict";
import { createMetroEngine } from "../src/core/metro.js";

const SAMPLE_TRIPS = [
  ["kafd", "hokm"],
  ["t12", "stc"],
  ["ksu", "sportcity"],
  ["jeddahrd", "naseem"],
  ["moe", "museum"],
];

test("WS5 route planner parity on 5 sample trips", () => {
  const engineEn = createMetroEngine();
  engineEn.setLanguage("en");

  const engineAr = createMetroEngine();
  engineAr.setLanguage("ar");

  for (const [from, to] of SAMPLE_TRIPS) {
    const routesEn = engineEn.plan(from, to);
    const routesAr = engineAr.plan(from, to);

    assert.ok(routesEn.length > 0, `Expected route for ${from} -> ${to}`);
    assert.equal(routesEn.length, routesAr.length);

    const primaryEn = routesEn[0];
    const primaryAr = routesAr[0];

    assert.equal(primaryEn.time, primaryAr.time);
    assert.equal(primaryEn.timeMax, primaryAr.timeMax);
    assert.equal(primaryEn.xf, primaryAr.xf);
    assert.equal(primaryEn.stops, primaryAr.stops);
    assert.ok(primaryEn.time > 0 && primaryEn.timeMax >= primaryEn.time);
    assert.ok(primaryEn.stops > 0);
  }
});
