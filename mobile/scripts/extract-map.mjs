// Generate src/core/mapGeometry.json from the website's source of truth (src/riyadh-metro.html):
// schematic station positions, label sides and multi-line labels, line polylines (with the yellow/purple
// shared section drawn side by side), line numbers and colours, the wadi and district labels.
// Like extract-core.mjs: a changed boundary fails the build; --check fails when the JSON is stale.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const source = readFileSync(new URL("../../src/riyadh-metro.html", import.meta.url), "utf8");
function block(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`Source boundary changed: ${start}`);
  return source.slice(a, b);
}
function line(start) {
  const a = source.indexOf(start);
  if (a < 0) throw new Error(`Source line changed: ${start}`);
  return source.slice(a, source.indexOf("\n", a));
}
function cssVars(selectorStart) {
  const a = source.indexOf(selectorStart);
  if (a < 0) throw new Error(`CSS block changed: ${selectorStart}`);
  const css = source.slice(a, source.indexOf("}", a));
  const out = {};
  for (const m of css.matchAll(/--(blue|red|orange|yellow|green|purple|water|bg|surface|fg|muted|rule):(#[0-9A-Fa-f]{3,8})/g)) out[m[1]] = m[2];
  return out;
}

const code = [
  block("const LANGS=[", "function starPts"),
  block("const I18N=", "// ================= DATA"),
  block("const RAW = {", "function renderStatus()"),
  block("function offsetPts(", "\nfunction nrm("),
  line("function nrm("),
  line("const DIST_AR="),
]
  .join("\n")
  .replace(/^function linePath\(.*$/m, "")
  .replace(/^function gmLink\(.*$/m, "")
  .replace(/^const sno=.*$/m, "")
  .replace(/^document.addEventListener\("click",.*a\.gm.*$/m, "");
{
  const bad = code.split("\n").filter((l) => /\b(document|window|navigator|localStorage)\s*\./.test(l));
  if (bad.length) throw new Error("Browser API in extracted map code:\n" + bad.join("\n").slice(0, 600));
}

// the wadi and the district labels live in drawing calls: take their literal data only
const wadiM = source.match(/class:"wadi",d:smoothD\((\[\[.*?\]\])\)/);
const wadiLblM = source.match(/class:"water-label",x:(-?\d+),y:(-?\d+)[^;]*;wl\.textContent="([^"]+)"/);
const distM = source.match(/\n(\[\["AL OLAYA".*?\]\])\s*\n\s*\.forEach/);
const boxM = source.match(/const BOX=(\{[^}]*\});/);
if (!wadiM || !wadiLblM || !distM || !boxM) throw new Error("Wadi, district or BOX literal changed");

const geometry = new Function(code + `
const r1=v=>Math.round(v*10)/10, pt=p=>[r1(p[0]),r1(p[1])];
const NUM={blue:1,red:2,orange:3,yellow:4,green:5,purple:6};
SVC.forEach(v=>v.stops.forEach(s=>ST[s].lines.add(v.line)));
const ends=new Set(SVC.flatMap(v=>[v.stops[0],v.stops[v.stops.length-1]]));
const stations=Object.keys(ST).map(id=>{const s=ST[id];return {id,x:s.x,y:s.y,side:s.p,en:s.n,ar:(AR_NAMES.st||{})[id]||null,
  former:s.f,lines:[...s.lines],interchange:s.lines.size>1,terminus:ends.has(id),walkTo:(typeof WALK_OF!=='undefined'&&WALK_OF[id])?{id:WALK_OF[id].to,min:WALK_OF[id].t}:null,number:ST_NO[id]||null,labelEn:LABEL_LINES[id]||[s.n]};});
const sharedIds=SHARED46;
const lines=SVC.map(v=>{const shared=(v.line==="yellow"||v.line==="purple");
  const own=shared?v.stops.slice(sharedIds.length-1):v.stops;
  const parts=[chainPts(own).map(pt)];
  if(shared)parts.unshift(offsetPts(chainPts(sharedIds),v.line==="purple"?3.2:-3.2).map(pt));
  return {id:v.line,service:v.id,number:NUM[v.line],stops:v.stops,parts};});
return {stations,lines,sharedSection:{stops:sharedIds,lines:["purple","yellow"],offset:3.2},distAr:DIST_AR};`)();

const districts = new Function("return " + distM[1])().map(([en, x, y]) => ({ en, ar: geometry.distAr[en] || en, x, y }));
const out = {
  generatedFrom: "src/riyadh-metro.html",
  sourceSha256: createHash("sha256").update(source).digest("hex"),
  box: new Function("return " + boxM[1])(),
  colors: { light: cssVars(":root{"), dark: cssVars("@media (prefers-color-scheme:dark)") },
  stations: geometry.stations,
  lines: geometry.lines,
  sharedSection: geometry.sharedSection,
  wadi: { points: new Function("return " + wadiM[1])(), label: { en: wadiLblM[3], ar: "وادي حنيفة", x: +wadiLblM[1], y: +wadiLblM[2] } },
  districts,
};
const json = JSON.stringify(out, null, 1) + "\n";
const target = new URL("../src/core/mapGeometry.json", import.meta.url);
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== json) throw new Error("Map geometry is stale; run npm run generate:map");
} else writeFileSync(target, json);
