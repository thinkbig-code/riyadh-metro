// Exports the app's own data and the routes the SEO pages need to tools/seo_data.json.
// The routes are calculated by the app itself (its #selftest hook), so the pages can never
// disagree with the planner. Run after any change to the network data or to seo_config.json:
//   node tools/export_data.js            (needs Playwright with Chromium)
// Times are for a weekday at midday (Wednesday 12:00 Riyadh), so waiting ranges use daytime frequencies.
const path = require('path'), fs = require('fs');
const {chromium} = require('playwright');
const ROOT = path.join(__dirname, '..');
const SRC = process.env.SRC || path.join(ROOT, 'src', 'riyadh-metro.html');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'seo_config.json'), 'utf8'));

const pairs = new Set();
const add = (a, b) => { if (a && b && a !== b) pairs.add(a + '~' + b); };
for (const d of cfg.destinations) for (const o of d.origins) d.reverse ? add(d.main, o) : add(o, d.main);
for (const s of cfg.stations) for (const t of s.to) add(s.id, t);
for (const r of cfg.routes) { r.pairs.forEach(([a, b]) => add(a, b)); add(...r.return); }
for (const [a, b] of cfg.extra_pairs || []) add(a, b);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.clock.setFixedTime(new Date('2026-10-07T09:00:00Z'));
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + SRC + '#selftest');
  await p.waitForFunction(() => window.__dm && window.__dm.data);
  const out = await p.evaluate(pairs => {
    const D = window.__dm, d = D.data;
    const ST = {};
    for (const id in d.ST) { const s = d.ST[id]; ST[id] = {n: s.n, lines: [...s.lines], f: s.f || [], x: s.x, y: s.y}; }
    const svc = d.SVC.map(s => ({id: s.id, line: s.line, stops: s.stops, oneway: !!s.oneway}));
    const lineOf = Object.fromEntries(svc.map(s => [s.id, s.line]));
    const routes = {};
    for (const key of pairs) {
      const [a, b] = key.split('~');
      const A = D.parseToken(a), B = D.parseToken(b);
      if (!A || !B) { routes[key] = {error: 'unknown token'}; continue; }
      const vs = D.computeVariants(A, B);
      routes[key] = vs.map(v => ({
        modes: v.modes, time: v.time, timeMax: v.timeMax, walk: v.walk, xf: v.xf, stops: v.stops,
        legs: v.legs.map(l => l.type === 'ride'
          ? {type: 'ride', svc: l.svc, line: lineOf[l.svc], stops: l.stops, min: Math.round(D.legTime(l) * 10) / 10}
          : {type: l.type, from: l.from, to: l.to, t: l.t})
      }));
    }
    return {
      stations: ST, services: svc, places: d.PLACES, popular: d.POPULAR, fare: d.FARE, passes: d.PASSES, hours: d.HOURS, status: d.SERVICE_STATUS, walks: d.WALKS, geo: d.GEO,
      alias: d.ALIAS, en: d.I18N_EN, routes
    };
  }, [...pairs]);
  out.generatedFor = 'Wednesday 12:00 Riyadh time';
  if (errs.length) { console.error('page errors:', errs); process.exit(1); }
  const bad = Object.entries(out.routes).filter(([, v]) => !Array.isArray(v) || !v.length).map(([k]) => k);
  if (bad.length) { console.error('no route for:', bad); process.exit(1); }
  fs.writeFileSync(path.join(__dirname, 'seo_data.json'), JSON.stringify(out));
  console.log('exported', Object.keys(out.stations).length, 'stations,', out.places.length, 'places,', Object.keys(out.routes).length, 'routes');
  await b.close();
})();
