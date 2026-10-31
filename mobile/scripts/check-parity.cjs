// Dev-only browser reference; the shipped application has no browser dependency.
const { readFileSync } = require("node:fs");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
(async () => {
  const { createMetroEngine } = await import("../src/core/metro.js");
  const source = readFileSync("../src/riyadh-metro.html", "utf8");
  const fixtures = JSON.parse(
    source.match(/const VALIDATION=(\[[\s\S]*?\n\]);/)[1],
  );
  const browser = await chromium.launch({
    channel: "chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.route("**/*", (r) => r.abort());
    const at = Date.parse("2026-10-25T09:00:00Z");
    const html = source
      .replace("(function(){", "(function(){Date.now=()=>" + at + ";")
      .replace(
        "// ================= START =================",
        "window.__parity={plan:computeOptions,parse:parseToken};\n// ================= START =================",
      );
    await page.setContent(html);
    const engine = createMetroEngine();
    const ids = Object.keys(engine.stations);
    const cases = [
      ...fixtures.map(([a, b]) => [a, b]),
      ...ids
        .filter((_, i) => i % 4 === 0)
        .map((a, i) => [a, ids[(i * 13 + 7) % ids.length]]),
    ];
    for (const [a, b] of cases) {
      const expected = await page.evaluate(
        ([a, b]) =>
          window.__parity.plan(
            window.__parity.parse(a),
            window.__parity.parse(b),
          ),
        [a, b],
      );
      assert.deepEqual(
        JSON.parse(JSON.stringify(engine.plan(a, b, at))),
        expected,
        `${a} → ${b}`,
      );
    }
    console.log(
      `Website/native parity: ${cases.length}/${cases.length} exact route comparisons passed`,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
