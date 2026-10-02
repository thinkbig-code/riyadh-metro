// Renders the whole network map as a picture (riyadh-metro-map.png) for search engines and sharing.
// The picture is the app's own map, drawn by the app, so it always matches the interactive map.
// Run after a change to the map or the station names:   node tools/render_map.js
// Needs Playwright with Chromium. The app's web fonts are used when they can be downloaded;
// otherwise similar local fonts stand in (the layout is the same).
const path = require('path'), fs = require('fs');
const {chromium} = require('playwright');
const ROOT = path.join(__dirname, '..');
const SRC = process.env.SRC || path.join(ROOT, 'src', 'riyadh-metro.html');
// MAP_LANG=ar draws the Arabic map (Arabic station and area names) for the Arabic pages
const AR = process.env.MAP_LANG === 'ar';
const OUT = path.join(ROOT, AR ? 'riyadh-metro-map-ar.png' : 'riyadh-metro-map.png');
const W = 1600, H = 1760;
const FALLBACK = `@font-face{font-family:"Golos Text";font-weight:400 700;src:local("Liberation Sans"),local("Arial")}
@font-face{font-family:"Unbounded";font-weight:600;src:local("Poppins SemiBold"),local("Poppins Bold"),local("Liberation Sans Bold")}`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport: {width: W, height: H}, deviceScaleFactor: 1, colorScheme: 'light', locale: 'en-US'});
  let fallback = false;
  await p.route(/fonts\.googleapis\.com/, async r => {
    // use the web fonts only if the font files themselves can be downloaded
    try {
      const res = await r.fetch({timeout: 8000}); const css = await res.text();
      const font = (css.match(/url\((https:[^)]+)\)/) || [])[1];
      const ok = font && (await p.request.get(font, {timeout: 8000})).ok();
      if (!ok) throw new Error('font files unreachable');
      await r.fulfill({response: res, body: css});
    } catch (e) { fallback = true; await r.fulfill({status: 200, contentType: 'text/css', body: FALLBACK}); }
  });
  await p.route(/cdnjs\.cloudflare\.com|gc\.zgo\.at/, r => r.abort());
  if (AR) await p.addInitScript(() => { try { localStorage.setItem('dm_lang', 'ar'); } catch (e) {} });
  await p.goto('file://' + SRC + '#selftest');
  await p.waitForFunction(() => window.__dm);
  await p.evaluate(() => document.fonts.ready);
  // the map alone: no panel, buttons or pop-ups; a title strip with the address instead
  await p.addStyleTag({content: `#panel,#zoom,#pop,#toast,#card{display:none!important}
    #legend{left:24px!important;right:auto!important;bottom:22px!important;top:auto!important;font-size:15px!important}
    #imgtitle{position:fixed;top:22px;left:28px;z-index:50;font:600 30px/1.2 "Unbounded","Golos Text",sans-serif;color:#14202B}
    #imgtitle small{display:block;font:500 17px/1.5 "Golos Text",sans-serif;color:#46535E;margin-top:6px}`});
  // the date of the station names (last checked against the RTA network map), not today's date
  const date = process.env.NAMES_AS_OF || 'October 2026';
  const SITE_LABEL = process.env.SITE_LABEL || 'Riyadh Metro Map';
  await p.evaluate(([date, SITE_LABEL, AR]) => {
    const d = document.createElement('div'); d.id = 'imgtitle';
    d.innerHTML = AR ? 'خريطة مترو الرياض<small>المسارات الستة و83 محطة · أسماء المحطات كما في أكتوبر 2026 · خريطة غير رسمية · riyadhmetro.fyi</small>'
                     : 'Riyadh Metro map<small>All 6 lines and 83 stations · Station names as of ' + date + ' · Unofficial · ' + SITE_LABEL + '</small>';
    if (AR) { d.dir = 'rtl'; d.style.left = 'auto'; d.style.right = '28px'; d.style.fontFamily = '"Noto Sans Arabic",sans-serif'; }
    document.body.appendChild(d);
  }, [date, SITE_LABEL, AR]);
  await p.waitForTimeout(800); // let the app finish re-framing after the panel was hidden
  // frame the whole network below the title
  // (same box as the app's "whole map" button)
  await p.evaluate(({W, H}) => {
    const B = {x0: -60, y0: 30, x1: 1090, y1: 1200}, top = 110, bottom = 70, side = 24;
    const k = Math.min((W - 2 * side) / (B.x1 - B.x0), (H - top - bottom) / (B.y1 - B.y0));
    const x = side + ((W - 2 * side) - (B.x1 - B.x0) * k) / 2 - B.x0 * k, y = top + ((H - top - bottom) - (B.y1 - B.y0) * k) / 2 - B.y0 * k;
    const w = document.getElementById('world'); w.classList.remove('anim');
    w.style.transform = `translate(${x}px,${y}px) scale(${k})`;
  }, {W, H});
  await p.waitForTimeout(500);
  await p.screenshot({path: OUT});
  console.log('map image:', path.relative(ROOT, OUT), (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB', fallback ? '(stand-in fonts)' : '(web fonts)');
  await b.close();
})();
