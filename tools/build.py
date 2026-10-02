"""Build the six language pages of the Riyadh Metro map from src/riyadh-metro.html.

Usage (from the repository root):  python3 tools/build.py
Writes index.html (English), ar.html, ur.html, hi.html, bn.html, tl.html, the English guide pages
(see tools/seo_pages.py), sitemap.xml, robots.txt, manifest.webmanifest and sw.js into the repository
root. Texts for each language page live in tools/seo_texts.py.
"""
import re, json, html, datetime, sys, os, hashlib
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from seo_texts import TX, ORDER
import seo_pages
SITE = os.environ.get('SITE', 'https://riyadhmetro.fyi/')
OUT = os.environ.get('OUT', ROOT + '/')
GOAT = os.environ.get('GOAT', '')   # GoatCounter address, e.g. https://riyadhmetro.goatcounter.com/count
s = open(os.path.join(ROOT, 'src', 'riyadh-metro.html'), encoding='utf-8').read()
s, n = re.subn(r'const BASE_URL="[^"]*";', '// On your own site, shared links point to wherever this page is hosted\nconst BASE_URL=location.origin+location.pathname;', s)
assert n == 1, "BASE_URL line not found"
te = s.index('</title>') + len('</title>'); rest = s[te:]
i_map = rest.index('<div id="map"')

# ---------- data from the app, so the text always matches the map ----------
rawblk = s[s.index('const RAW = {'):s.index('};', s.index('const RAW = {'))]
names = {m.group(1): m.group(2) for m in re.finditer(r'\b(\w+):\["([^"]+)",-?\d+,-?\d+,', rawblk)}
def arr(n):
    m = re.search(r'const %s=\[([^\]]*)\];' % n, s); return re.findall(r'"(\w+)"', m.group(1))
LINES = [(1, 'Blue Line', arr('L1')), (2, 'Red Line', arr('L2')), (3, 'Orange Line', arr('L3')),
         (4, 'Yellow Line', arr('L4')), (5, 'Green Line', arr('L5')), (6, 'Purple Line', arr('L6'))]
I18N = json.loads(s[s.index('const I18N=') + 11:s.index(';\n', s.index('const I18N='))])
LKEY = {1: 'lgBlue', 2: 'lgRed', 3: 'lgOrange', 4: 'lgYellow', 5: 'lgGreen', 6: 'lgPurple'}
fm = re.search(r'const FARE=\{std:(\d+),first:(\d+)', s); STD, FIRST = fm.group(1), fm.group(2)
hm = lambda m: '%02d:%02d' % (m // 60 % 24, m % 60)
H = json.loads(re.search(r'metro:(\[\[.*?\]\])', s).group(1))
FV = dict(std=STD, first=FIRST, wk='%s–%s' % (hm(H[0][0]), hm(H[0][1])), fri='%s–%s' % (hm(H[5][0]), hm(H[5][1])))
N = lambda i: html.escape(names[i])
lst = lambda ids: ', '.join(N(i) for i in ids)
pid = lambda n: 'p_' + re.sub(r'^_|_$', '', re.sub(r'[^a-z0-9]+', '_', n.lower()))
AP = pid('King Khalid Airport Terminals 1-2')
TRIPS = [(AP, pid('KAFD (King Abdullah Financial District)')), (AP, pid('Kingdom Centre')), (AP, pid('Al Batha')),
         (pid('KAFD (King Abdullah Financial District)'), pid('National Museum')), (pid('Kingdom Centre'), pid('Souq Al Zal')),
         (pid('Riyadh Railway Station'), pid('National Museum'))]
url = lambda L: SITE + ("" if TX[L]["file"] == "index.html" else TX[L]["file"])
fav = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M16 31s11-10.2 11-18A11 11 0 0 0 5 13c0 7.8 11 18 11 18z' fill='%231E6FD9'/%3E%3Crect x='10.5' y='6.5' width='11' height='12' rx='3' fill='%23fff'/%3E%3Crect x='12.3' y='8.6' width='7.4' height='4' rx='1' fill='%231E6FD9'/%3E%3Ccircle cx='13.3' cy='15.6' r='1.1' fill='%231E6FD9'/%3E%3Ccircle cx='18.7' cy='15.6' r='1.1' fill='%231E6FD9'/%3E%3C/svg%3E"
alts = '\n'.join(f'<link rel="alternate" hreflang="{L}" href="{url(L)}">' for L in ORDER) + f'\n<link rel="alternate" hreflang="x-default" href="{SITE}">'
COUNTER = (f'<!-- anonymous visit counter (GoatCounter): no cookies, no personal data -->\n<script data-goatcounter="{GOAT}" async src="//gc.zgo.at/count.js"></script>' if GOAT else '')

SW_REG = """
<script>
if("serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost")){
  addEventListener("load",()=>{navigator.serviceWorker.register("sw.js").then(()=>navigator.serviceWorker.ready)
    .then(r=>{if(r.active)r.active.postMessage({type:"cache",url:location.pathname});}).catch(()=>{});});
}
</script>"""

GUIDES = seo_pages.build()
short = lambda t: t.split(':')[0].replace(' by Metro', '')
GUIDE_LINKS = ' · '.join(f'<a href="{p}" hreflang="en" lang="en">{html.escape(short(t))}</a>' for p, t in GUIDES.items())


def page(L):
    X = TX[L]
    trips = '\n'.join(f'<li><a href="#{a}~{b}~{L}">{html.escape(t)}</a></li>' for (a, b), t in zip(TRIPS, X["trips"]))
    faq = '\n'.join(f'<h3>{html.escape(q)}</h3>\n<p>{html.escape(a.format(**FV))}</p>' for q, a in X["q"])
    other = ' · '.join(f'<a href="{TX[o]["file"] if TX[o]["file"]!="index.html" else "./"}" hreflang="{o}" lang="{o}">{TX[o]["langName"]}</a>' for o in ORDER if o != L)
    lines = '\n'.join(f'<p>{X["line"].format(n=html.escape(I18N[L][LKEY[k]]), a=N(ids[0]), b=N(ids[-1]))}</p>\n<p class="lst" dir="ltr">{lst(ids)}.</p>' for k, _, ids in LINES)
    about = f'''<section id="about" aria-labelledby="aboutH" lang="{L}" dir="{X["dir"]}">
<button id="aboutClose" aria-label="{html.escape(X["close"])}">×</button>
<h1 id="aboutH">{html.escape(X["h1"])}</h1>
<p>{html.escape(X["intro"])}</p>
<p><a href="map/" hreflang="en"><img src="riyadh-metro-map.png" width="{seo_pages.MAP_W}" height="{seo_pages.MAP_H}" alt="{html.escape(seo_pages.MAP_ALT)}" loading="lazy" style="width:100%;height:auto;border-radius:12px"></a></p>
<h2>{html.escape(X["popular"])}</h2>
<ul>
{trips}
</ul>
<h2>{html.escape(X["lines"])}</h2>
{lines}
<p>{html.escape(X["shared"])}</p>
<h2>{html.escape(X["guides"])}</h2>
<p class="lst" dir="ltr">{GUIDE_LINKS}</p>
<h2>{html.escape(X["faq"])}</h2>
{faq}
<p><a href="https://github.com/thinkbig-code/riyadh-metro/issues">{html.escape(X["report"])}</a></p>
<p class="lst">{other}</p>
</section>
'''
    ld = {"@context": "https://schema.org", "@type": "WebApplication", "name": html.unescape(X["ogTitle"]), "url": url(L),
          "description": html.unescape(X["desc"]), "applicationCategory": "TravelApplication", "operatingSystem": "Any", "isAccessibleForFree": True,
          "inLanguage": L, "offers": {"@type": "Offer", "price": "0", "priceCurrency": "SAR"},
          "about": {"@type": "Place", "name": "Riyadh", "address": {"@type": "PostalAddress", "addressCountry": "SA"}}}
    oglocs = '\n'.join(f'<meta property="og:locale:alternate" content="{TX[o]["locale"]}">' for o in ORDER if o != L)
    head = f'''<!doctype html>
<html lang="{L}" data-pagelang="{L}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{X["title"]}</title>
<meta name="description" content="{X["desc"]}">
<link rel="canonical" href="{url(L)}">
{alts}
<meta name="robots" content="index,follow">
<meta name="msvalidate.01" content="26F6B07BDF6CE6FA1D82E4B9966FBEFF">
<meta property="og:type" content="website">
<meta property="og:url" content="{url(L)}">
<meta property="og:locale" content="{X["locale"]}">
{oglocs}
<meta property="og:title" content="{X["ogTitle"]}">
<meta property="og:description" content="{X["ogDesc"]}">
<meta property="og:image" content="{SITE}og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F4F7F8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#10161C" media="(prefers-color-scheme: dark)">
<link rel="icon" href="{fav}">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
{COUNTER}
<style>body{{margin:0}}[hidden]{{display:none!important}}img{{max-width:100%}}</style>
'''
    # the English root page keeps the visitor's own language; the others open in theirs
    if L == "en": head = head.replace(' data-pagelang="en"', '')
    return head + rest[:i_map] + '</head>\n<body>\n' + about + rest[i_map:] + SW_REG + '\n</body>\n</html>\n'


for L in ORDER:
    open(OUT + TX[L]["file"], 'w', encoding='utf-8').write(page(L))
ver = hashlib.sha1(''.join(open(OUT + TX[L]["file"], encoding='utf-8').read() for L in ORDER).encode()).hexdigest()[:10]
manifest = {"name": "Riyadh Metro Map & Route Planner", "short_name": "Riyadh Metro", "description": html.unescape(TX["en"]["ogDesc"]),
            "start_url": "./", "scope": "./", "display": "standalone", "background_color": "#F4F7F8", "theme_color": "#F4F7F8",
            "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
                      {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}]}
open(OUT + 'manifest.webmanifest', 'w').write(json.dumps(manifest, ensure_ascii=False, indent=1))
open(OUT + 'sw.js', 'w').write(open(os.path.join(HERE, 'sw.template.js')).read().replace('__VERSION__', ver))
today = datetime.date.today().isoformat()
xl = '\n'.join(f'    <xhtml:link rel="alternate" hreflang="{o}" href="{url(o)}"/>' for o in ORDER) + f'\n    <xhtml:link rel="alternate" hreflang="x-default" href="{SITE}"/>'
IMG = f'\n    <image:image><image:loc>{SITE}{seo_pages.MAP_IMG}</image:loc></image:image>'
urls = '\n'.join(f'  <url>\n    <loc>{url(L)}</loc>\n    <lastmod>{today}</lastmod>\n{xl}{IMG}\n  </url>' for L in ORDER)
urls += '\n' + '\n'.join(f'  <url>\n    <loc>{SITE}{p}</loc>\n    <lastmod>{today}</lastmod>{IMG if p in ("map/", "stations/") else ""}\n  </url>' for p in GUIDES)
open(OUT + 'sitemap.xml', 'w').write(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n{urls}\n</urlset>\n')
open(OUT + 'robots.txt', 'w').write(f'User-agent: *\nAllow: /\n\nSitemap: {SITE}sitemap.xml\n')
print("deploy built:", ', '.join(TX[L]["file"] for L in ORDER), "+", len(GUIDES), "guide pages")
