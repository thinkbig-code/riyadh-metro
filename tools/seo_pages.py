"""Build the English guide pages (stations, lines, destinations, routes, map, timings) of the Riyadh Metro map.
Every page has an Arabic twin under ar/ (tools/seo_pages_ar.py), linked both ways with hreflang.

Usage (from the repository root, after tools/export_data.js):  python3 tools/seo_pages.py
Called by tools/build.py. Reads tools/seo_config.json (which pages exist) and tools/seo_data.json
(the app's own data and routes it calculated). No fact on these pages is typed by hand: names,
lines, walk times, travel times and fares all come from the app, so a data fix reaches
every page on the next export and build.
Returns the list of page paths, for the sitemap.
"""
import json, html, os, math, datetime, re

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
SITE = os.environ.get('SITE', 'https://riyadhmetro.fyi/')
GOAT = os.environ.get('GOAT', '')
OUT = os.environ.get('OUT', ROOT + '/')
CFG = json.load(open(os.path.join(HERE, 'seo_config.json')))
D = json.load(open(os.path.join(HERE, 'seo_data.json')))
ST, EN, FARE, PASSES = D['stations'], D['en'], D['fare'], D['passes']
SVC = {s['id']: s for s in D['services']}
PL = {p['id']: p for p in D['places']}
WALKS = D['walks']
SUSP = {k for k, v in D['status'].items() if v == 'suspended'}
COLORS = ['blue', 'red', 'orange', 'yellow', 'green', 'purple']
LINE_NUM = {c: i + 1 for i, c in enumerate(COLORS)}
LINE_KIND = {c: 'metro' for c in COLORS}
LINE_NAME = {c: EN['lg' + c.capitalize()] for c in COLORS}
LINE_COLOR = {'blue': '#1E6FD9', 'red': '#E1251B', 'orange': '#E07F0C', 'yellow': '#D9AD00', 'green': '#21A246', 'purple': '#8A3FB3'}
LINE_PAGE = {c: 'lines/%s-line/' % c for c in COLORS}
e = html.escape


def t(key, **kw):
    s = EN[key]
    if isinstance(s, dict):
        s = s['one'] if kw.get('n') == 1 else s['other']
    for k, v in kw.items():
        s = s.replace('{' + k + '}', str(v))
    return s


# ---------------- what exists ----------------
PAGES = {}            # path -> title, for links and the sitemap
import csv, re
_slug = lambda n: re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', n.lower()))
# every station has a page; seo_config.json "stations" can set a slug and the places it gives travel times to,
# the others use the station name and "station_to" (minus places at or right next to the station)
_given = {s['id']: s for s in CFG['stations']}
STATIONS = []
for sid in sorted(ST, key=lambda i: ST[i]['n'].lower()):
    c = dict(_given.get(sid) or {'id': sid, 'slug': _slug(ST[sid]['n'])})
    if 'to' not in c:
        c['to'] = [x for x in CFG.get('station_to', []) if PL[x]['st'] != sid][:5]
    STATIONS.append(c)
assert len({c['slug'] for c in STATIONS}) == len(STATIONS), 'two stations with the same slug'
STATION_PAGE = {c['id']: 'stations/%s/' % c['slug'] for c in STATIONS}
# official station numbers and Park & Ride, from the app; station type (elevated, underground) from the RCRC open data
_src = open(os.path.join(ROOT, 'src', 'riyadh-metro.html'), encoding='utf-8').read()
ST_NO = json.loads(re.search(r'const ST_NO=(\{[^;]*\});', _src).group(1))
PARK_RIDE = set(json.loads(re.search(r'const PARK_RIDE=new Set\((\[[^\]]*\])\)', _src).group(1)))
_code = {r['id']: r['rcrc_code'] for r in csv.DictReader(open(os.path.join(ROOT, 'data', 'coords_official.csv')))}
_type = {r['metro_station_cd']: (r['metro_station_type_desc_en'], r['metro_station_type_desc_ar'])
         for r in csv.DictReader(open(os.path.join(ROOT, 'data', 'rcrc_metro_stations_2024.csv'), encoding='utf-8-sig'), delimiter=';')}
ST_TYPE = {sid: _type[c] for sid, c in _code.items() if c in _type}
# districts (أحياء) near the metro: data/districts.json, made by tools/make_districts.py
DISTRICTS = json.load(open(os.path.join(ROOT, 'data', 'districts.json'), encoding='utf-8'))['districts']
DIST_PAGE = {d['slug']: 'districts/%s/' % d['slug'] for d in DISTRICTS}


def district_station(d):
    """the station a district page plans from: the one inside the district nearest its middle, else the nearest"""
    return d['inside'][0] if d['inside'] else d['near'][0][0]


def districts_of(sid):
    """districts a station is in or is the nearest station to"""
    return [d for d in DISTRICTS if sid in d['inside'] or (not d['inside'] and d['near'][0][0] == sid)]


def dist_km(d, sid):
    for s_, k in d['near']:
        if s_ == sid:
            return k
    (la, lo), (lb, lob) = d['mid'], D['geo'][sid]
    return round(math.hypot(la - lb, (lo - lob) * math.cos(math.radians(24.7))) * 111, 1)


def walk_min(k):
    """a rough walking time for a straight-line distance (streets add about a quarter)"""
    return max(1, round(k * 1.25 / 4.8 * 60))
DEST_PAGE = {}        # place id -> path
for d in CFG['destinations']:
    for pid in [d['main']] + d['also']:
        DEST_PAGE.setdefault(pid, 'destinations/%s/' % d['slug'])
PAIR_PAGE = {}        # "a~b" -> route page path
for r in CFG['routes']:
    for a, b in r['pairs']:
        PAIR_PAGE[a + '~' + b] = 'routes/%s/' % r['slug']
    PAIR_PAGE['~'.join(r['return'])] = 'routes/%s/' % r['slug']


def station_links(sid):
    """pages about a station: its own page and destination pages whose place uses it"""
    out = []
    if sid in STATION_PAGE:
        out.append((STATION_PAGE[sid], ST[sid]['n'] + ' station'))
    for d in CFG['destinations']:
        if PL[d['main']]['st'] == sid:
            out.append(('destinations/%s/' % d['slug'], d['title']))
    return out


def other_names(sid):
    n = ST[sid]['n'].lower()
    return [x for x in ST[sid]['f'] if x.lower() not in n]


# ---------------- route facts ----------------
def end_of(tok):
    if tok in ST:
        return {'st': tok, 'name': ST[tok]['n'], 'lm': None}
    p = PL[tok]
    return {'st': p['st'], 'name': p['n'], 'lm': p}


def direction(leg):
    stops = SVC[leg['svc']]['stops']
    i0, i1 = stops.index(leg['stops'][0]), stops.index(leg['stops'][-1])
    return ST[stops[-1] if i1 > i0 else stops[0]]['n']


def fare(v):
    ride = any(l['type'] == 'ride' for l in v['legs'])
    return {'std': FARE['std'] if ride else None, 'first': FARE['first'] if ride else None}


def sar(x):
    return ('%g' % x)


def fare_text(f):
    return 'SAR %s' % sar(f['std']) if f['std'] is not None else 'no fare (on foot)'


def lines_of(v):
    out = []
    for l in v['legs']:
        if l['type'] == 'ride':
            out.append(l['line'])
        elif l['type'] == 'walk':
            out.append('walk')
    return out


def chips(v):
    h = []
    for x in lines_of(v):
        if x == 'walk':
            h.append('<span class="chip w">walk</span>')
        else:
            h.append('<span class="chip" style="--c:%s">%s</span>' % (LINE_COLOR[x], e(LINE_NAME[x])))
    return ' '.join(h)


def suspended_in(v):
    return any(l['type'] == 'ride' and LINE_KIND[l['line']] in SUSP for l in v['legs'])


def steps(v, a, b):
    A, B = end_of(a), end_of(b)
    legs = list(v['legs'])
    lead = legs.pop(0) if legs and legs[0]['type'] == 'walk' else None
    tail = legs.pop() if legs and legs[-1]['type'] == 'walk' else None
    out = []
    if A['lm']:
        lm = A['lm']
        if lead:
            out.append((t('goTo', s=ST[lead['to']]['n']), t('onFootFrom', n=lead['t'] + (lm.get('min') or 0), x=lm['n'])))
        else:
            sub = t(lm['note'], s=ST[lm['st']]['n']) if lm.get('note') else t('fromPlace', n=lm['min'], p=lm['n'], w=t(lm['walk'])) if lm.get('min') else t('nearestTo', p=lm['n'])
            out.append((t('goTo', s=ST[A['st']]['n']), sub))
    elif lead:
        out.append((t('walkTo', s=ST[lead['to']]['n']), t('onFootFrom', n=lead['t'], x=ST[lead['from']]['n'])))
    for i, l in enumerate(legs):
        if l['type'] == 'ride':
            n = len(l['stops']) - 1
            first = i == 0 or legs[i - 1]['type'] == 'walk'
            sub = (t('boardAt', s=ST[l['stops'][0]]['n']) + ' · ' if first else '') + t('stops', n=n) + ' · ' + t('min', n=round(l['min']))
            out.append((t('take', l=LINE_NAME[l['line']], d=direction(l)), sub + ' · ' + t('getOff', s=ST[l['stops'][-1]]['n'])))
        elif l['type'] == 'xfer':
            nxt = legs[i + 1]
            same = nxt['line'] == legs[i - 1]['line']
            if same:
                out.append((t('changeTrains', s=ST[l['from']]['n']), t('waitPlatform', d='Expo 2020' if nxt['svc'] == 'R2' else 'Life Pharmacy', n=l['t'])))
            else:
                out.append((t('changeTo', l=LINE_NAME[nxt['line']]), t('followSigns', l=LINE_NAME[nxt['line']], s=ST[l['from']]['n'], n=l['t'])))
        else:
            w = next(w for w in WALKS if {w['a'], w['b']} == {l['from'], l['to']})
            out.append((t('walkTo', s=ST[l['to']]['n']), t('onFootOut' if w.get('long') else 'onFootSign', n=l['t'])))
    if B['lm']:
        lm = B['lm']
        if tail:
            out.append((t('walkToPlace', p=lm['n']), t('onFootFrom', n=tail['t'] + (lm.get('min') or 0), x=ST[tail['from']]['n'])))
        elif lm.get('note'):
            out.append((lm['n'], t(lm['note'], s=ST[lm['st']]['n'])))
        else:
            out.append((t('walkToPlace', p=lm['n']), t('placeWalk', n=lm['min'], w=t(lm['walk'])) if lm.get('min') else t('noWalkData')))
    elif tail:
        out.append((t('walkTo', s=ST[tail['to']]['n']), t('onFootFrom', n=tail['t'], x=ST[tail['from']]['n'])))
    return out


def best(a, b):
    vs = D['routes'][a + '~' + b]
    return next((v for v in vs if 'fast' in v['modes']), vs[0]), vs


def xf_text(n):
    return 'no change' if n == 0 else ('1 change' if n == 1 else '%d changes' % n)


def span(v):
    return ('%d min' % v['time']) if v['time'] == v['timeMax'] else ('%d–%d min' % (v['time'], v['timeMax']))


def summary(v):
    return '%s · %s · %d min walking · %s' % (span(v), xf_text(v['xf']), v['walk'], fare_text(fare(v)))


# ---------------- hours ----------------
DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']


def hm(m):
    m = m % 1440
    return '%02d:%02d' % (m // 60, m % 60)


def hours_rows(kind):
    H = D['hours'][kind]
    order = [6, 0, 1, 2, 3, 4, 5]  # Saturday first, as the Saudi week
    groups = []
    for d in order:
        o, c = H[d]
        if groups and groups[-1][1] == (o, c):
            groups[-1][0].append(d)
        else:
            groups.append([[d], (o, c)])
    rows = []
    for ds, (o, c) in groups:
        days = DAYS[ds[0]] if len(ds) == 1 else '%s–%s' % (DAYS[ds[0]], DAYS[ds[-1]])
        rows.append((days, hm(o), hm(c) + (' (next day)' if c > 1440 else '')))
    return rows


def hours_html(kinds):
    h = ['<h2 id="hours">Opening hours</h2>']
    for k in kinds:
        label = {'metro': 'Riyadh Metro'}[k]
        if k in SUSP:
            h.append('<p><b>%s</b>: %s</p>' % (label, e(t('monoSuspended'))))
            continue
        h.append('<table class="hrs"><caption>%s</caption><tr><th>Days</th><th>First</th><th>Closes</th></tr>' % label)
        h.extend('<tr><td>%s</td><td>%s</td><td>%s</td></tr>' % r for r in hours_rows(k))
        h.append('</table>')
    h.append('<p class="note">%s Hours change during Ramadan and on public holidays.</p>' % e(t('hoursNote')))
    return '\n'.join(h)


# ---------------- page frame ----------------
FAV = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M16 31s11-10.2 11-18A11 11 0 0 0 5 13c0 7.8 11 18 11 18z' fill='%231E6FD9'/%3E%3Crect x='10.5' y='6.5' width='11' height='12' rx='3' fill='%23fff'/%3E%3Crect x='12.3' y='8.6' width='7.4' height='4' rx='1' fill='%231E6FD9'/%3E%3Ccircle cx='13.3' cy='15.6' r='1.1' fill='%231E6FD9'/%3E%3Ccircle cx='18.7' cy='15.6' r='1.1' fill='%231E6FD9'/%3E%3C/svg%3E"
CSS = """
:root{--bg:#F4F7F8;--surface:#fff;--fg:#14202B;--muted:#5B6773;--rule:#DCE3E8;--accent:#0B6E99;--warn:#8A4B00;--warnbg:#FFF4E0}
@media (prefers-color-scheme:dark){:root{--bg:#10161C;--surface:#18212A;--fg:#E6EDF2;--muted:#9AA7B2;--rule:#2A3742;--accent:#6CC4EE;--warn:#FFCF8A;--warnbg:#2E2414}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--accent)}
header.top{background:var(--surface);border-bottom:1px solid var(--rule)}
header.top nav{max-width:860px;margin:0 auto;padding:10px 16px;display:flex;gap:16px;flex-wrap:wrap;align-items:center;font-size:14px}
@media (max-width:420px){header.top nav{gap:10px;font-size:13px}}
header.top .brand{font-weight:700;color:var(--fg);text-decoration:none;margin-inline-end:auto}
main{max-width:860px;margin:0 auto;padding:16px 16px 40px}
.crumbs{font-size:13px;color:var(--muted);margin:4px 0 8px}
.crumbs a{color:var(--muted)}
h1{font-size:28px;line-height:1.2;margin:8px 0 12px}
h2{font-size:20px;margin:28px 0 8px}
h3{font-size:16px;margin:18px 0 6px}
.lead{font-size:18px}
.cta{display:inline-block;background:#1D5FB4;color:#fff;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:999px;margin:6px 0}
.cta.sm{font-size:14px;padding:6px 12px}
.card{background:var(--surface);border:1px solid var(--rule);border-radius:12px;padding:12px 14px;margin:10px 0}
.sum{font-weight:600}
.chip{display:inline-block;font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px;background:var(--c);color:#fff}
.chip.w{background:var(--rule);color:var(--fg)}
ol.steps{padding-inline-start:20px;margin:8px 0}
ol.steps li{margin:6px 0}
ol.steps .sub{display:block;color:var(--muted);font-size:14px}
table{border-collapse:collapse;width:100%;margin:8px 0;background:var(--surface);font-size:15px}
th,td{border:1px solid var(--rule);padding:6px 8px;text-align:start;vertical-align:top}
th{background:var(--bg);font-weight:600}
caption{text-align:start;font-weight:600;padding:4px 0}
.scroll{overflow-x:auto}
.warn{background:var(--warnbg);color:var(--warn);border-radius:10px;padding:10px 12px;margin:10px 0}
.note,.muted{color:var(--muted);font-size:14px}
footer{max-width:860px;margin:0 auto;padding:16px;border-top:1px solid var(--rule);color:var(--muted);font-size:13px}
ul.links{padding-inline-start:18px}
@media (max-width:560px){h1{font-size:24px}table{font-size:14px}}
"""


def frame(path, title, desc, body, crumbs, ld_extra=None, og_image='og-image.png'):
    depth = path.count('/')
    root = '../' * depth
    PAGES[path] = title
    url = SITE + path
    crumb_html = ' › '.join(['<a href="%s">Riyadh Metro Map</a>' % root] + ['<a href="%s%s">%s</a>' % (root, p, e(n)) for p, n in crumbs[:-1]] + [e(crumbs[-1][1])]) if crumbs else ''
    items = [{"@type": "ListItem", "position": 1, "name": "Riyadh Metro Map", "item": SITE}] + \
            [{"@type": "ListItem", "position": i + 2, "name": n, "item": SITE + p} for i, (p, n) in enumerate(crumbs)]
    ld = [{"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items}]
    if ld_extra:
        ld.append(ld_extra)
    body = body.replace('{ROOT}', root)
    COUNTER = ('<script data-goatcounter="%s" async src="//gc.zgo.at/count.js"></script>' % GOAT) if GOAT else ''
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
<link rel="alternate" hreflang="en" href="{url}">
<link rel="alternate" hreflang="ar" href="{SITE}ar/{path}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="article">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="{SITE}{og_image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F4F7F8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#10161C" media="(prefers-color-scheme: dark)">
<link rel="icon" href="{FAV}">
<link rel="apple-touch-icon" href="{root}apple-touch-icon.png">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
{COUNTER}
<style>{CSS}</style>
</head>
<body>
<header class="top"><nav><a class="brand" href="{root}">Riyadh Metro Map</a><a href="{root}map/">Map</a><a href="{root}stations/">Stations</a><a href="{root}districts/">Districts</a><a href="{root}timings/">Timings and fares</a><a href="{root}ar/{path}" hreflang="ar" lang="ar">العربية</a></nav></header>
<main>
<div class="crumbs">{crumb_html}</div>
{body}
</main>
<footer>
<p>{e(t('foot'))} {e(t('attrib'))} Travel times on this page are for a weekday at midday, including typical waiting.</p>
<p>An independent, non-commercial map, not affiliated with Riyadh Public Transport or the Royal Commission for Riyadh City. <a href="mailto:callmebackemail@protonmail.com?subject=Riyadh%20Metro%20Map">Report a problem</a> · <a href="{root}">Open the interactive map</a></p>
</footer>
</body>
</html>
'''


def write(path, content):
    full = os.path.join(OUT, path, 'index.html')
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, 'w').write(content)


def plan(a, b, label='Open this route on the map', small=False):
    return '<a class="cta%s" href="{ROOT}#%s~%s~en">%s</a>' % (' sm' if small else '', a, b, e(label))


def route_card(a, b, heading=None, show_alt=True):
    v, vs = best(a, b)
    h = ['<div class="card">']
    if heading:
        h.append('<h3>%s</h3>' % e(heading))
    if suspended_in(v):
        h.append('<div class="warn">%s This route uses it, so it cannot be travelled right now.</div>' % e(t('monoSuspended')))
    h.append('<p class="sum">%s</p><p>%s</p>' % (e(summary(v)), chips(v)))
    h.append('<ol class="steps">' + ''.join('<li>%s<span class="sub">%s</span></li>' % (e(a1), e(b1)) for a1, b1 in steps(v, a, b)) + '</ol>')
    # same rule as the app: only the route with fewer changes, and only if it costs at most 5 minutes more
    others = [x for x in vs if x is not v and 'few' in x['modes'] and x['xf'] < v['xf'] and x['time'] - v['time'] <= 5]
    if show_alt and others:
        h.append('<p class="muted">With fewer changes: ' + '; '.join(summary(x) for x in others) + '.</p>')
    h.append(plan(a, b, small=True))
    h.append('</div>')
    return '\n'.join(h)


def routes_table(pairs, label_of):
    rows = ['<div class="scroll"><table><tr><th>From</th><th>To</th><th>Lines</th><th>Time</th><th>Changes</th><th>Fare</th><th></th></tr>']
    for a, b in pairs:
        v, _ = best(a, b)
        page = PAIR_PAGE.get(a + '~' + b)
        more = ('<a href="{ROOT}%s">Step by step</a> · ' % page) if page else ''
        warn = ' <span class="muted">(not running now)</span>' if suspended_in(v) else ''
        rows.append('<tr><td>%s</td><td>%s</td><td>%s%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s<a href="{ROOT}#%s~%s~en">Map</a></td></tr>' % (
            e(end_of(a)['name']), e(end_of(b)['name']), chips(v), warn, span(v), xf_text(v['xf']), e(fare_text(fare(v))), more, a, b))
    rows.append('</table></div>')
    return '\n'.join(rows)


def km(a, b):
    if a not in D['geo'] or b not in D['geo']:   # no sourced position: use the schematic distance
        return math.hypot(ST[a]['x'] - ST[b]['x'], ST[a]['y'] - ST[b]['y']) / 30
    if a == b:
        return 0.0
    (la1, lo1), (la2, lo2) = D['geo'][a], D['geo'][b]
    return math.hypot(la1 - la2, (lo1 - lo2) * math.cos(math.radians(25.2))) * 111


def station_facts(sid):
    s = ST[sid]
    lines = ', '.join(LINE_NAME[l] for l in s['lines'])
    rows = [('Station number', '%d (as on the official map and station signs)' % ST_NO[sid])] if sid in ST_NO else []
    rows.append(('Lines', lines))
    if sid in ST_TYPE:
        rows.append(('Station type', ST_TYPE[sid][0]))
    rows.append(('Park & Ride', 'Yes, a car park for metro riders' if sid in PARK_RIDE else 'No'))
    if other_names(sid):
        rows.append(('Other or former names', ', '.join(other_names(sid))))
    for w in WALKS:
        if sid in (w['a'], w['b']):
            o = w['b'] if w['a'] == sid else w['a']
            rows.append(('Walking link', '%s, ~%d min on foot' % (ST[o]['n'], w['t'])))
    return '<table>' + ''.join('<tr><th>%s</th><td>%s</td></tr>' % (e(k), e(v)) for k, v in rows) + '</table>'


def related_dest(slug, n=4):
    me = next(d for d in CFG['destinations'] if d['slug'] == slug)
    sid = PL[me['main']]['st']
    others = sorted((d for d in CFG['destinations'] if d['slug'] != slug), key=lambda d: km(sid, PL[d['main']]['st']))[:n]
    return '<ul class="links">' + ''.join('<li><a href="{ROOT}destinations/%s/">%s</a></li>' % (d['slug'], e(d['title'])) for d in others) + '</ul>'



def short_lines(ls):
    """'Blue Line' or 'Blue/Yellow/Purple lines', for titles"""
    names = [LINE_NAME[l] for l in ls]
    return names[0] if len(names) == 1 else '/'.join(n.replace(' Line', '') for n in names) + ' lines'


def answer_title(T, kind, main, sid, with_lines=True):
    """a title that answers the search: 'Kingdom Centre Metro Station: Al Urubah (Blue Line), 4 min walk'"""
    t = '%s %s: %s' % (T, 'Tram Stop' if kind == 'stop' else 'Metro Station', ST[sid]['n'])
    if with_lines:
        t += ' (%s)' % short_lines(ST[sid]['lines'])
    if main.get('min') and not main.get('note'):
        t += ', %d min walk' % main['min']
    if len(t) > 75 and with_lines:   # too long for the search results: the lines are on the page anyway
        return answer_title(T, kind, main, sid, False)
    if len(t) > 75 and '(' in T:     # still too long: drop the other name in brackets
        return answer_title(re.sub(r'\s*\(.*?\)', '', T), kind, main, sid, False)
    return t


def answer_desc(T, kind, main, sid, tail):
    d = 'The nearest %s to %s is %s on the %s' % ('tram stop' if kind == 'stop' else 'metro station', T, ST[sid]['n'], ' and '.join(LINE_NAME[l] for l in ST[sid]['lines']))
    if main.get('note'):
        d += ', then by bus or taxi'
    elif main.get('min'):
        d += ', about %d minutes on foot' % main['min']
    return d + '. ' + tail


# ---------------- destination pages ----------------
def destination(d):
    main = PL[d['main']]; sid = main['st']; s = ST[sid]
    path = 'destinations/%s/' % d['slug']
    lines = [l for l in s['lines']]
    line_txt = ' and '.join(LINE_NAME[l] for l in lines)
    kind_word = 'stop' if any(l in ('tram', 'mono') for l in lines) else 'station'
    if d.get('lead'):
        lead = d['lead']
    else:
        lead = 'The nearest %s to %s is %s on the %s.' % (kind_word, main['n'], s['n'], line_txt)
        if main.get('min'):
            lead += ' It is about %d minutes on foot, %s.' % (main['min'], t(main['walk']))
        if other_names(sid):
            lead += ' The station has also been called %s.' % ' and '.join(other_names(sid))
        if main.get('note'):
            lead += ' ' + t(main['note'], s=s['n'])
    body = ['<h1>%s by metro: nearest station and how to get there</h1>' % e(d['title']), '<p class="lead">%s</p>' % e(lead)]
    if any(LINE_KIND[l] in SUSP for l in lines):
        body.append('<div class="warn">%s The routes below show the monorail part for when it reopens; check the operator before you travel.</div>' % e(t('monoSuspended')))
    o0 = d['origins'][0]
    body.append(plan(*((d['main'], o0) if d.get('reverse') else (o0, d['main'])), 'Open on the interactive map'))
    # the places on this page and their walks
    allp = [d['main']] + d['also']
    body.append('<h2>Nearest stop and walking time</h2><div class="scroll"><table><tr><th>Place</th><th>Nearest stop</th><th>On foot</th></tr>')
    for pid in allp:
        p = PL[pid]
        if p.get('note'):
            foot = t(p['note'], s=ST[p['st']]['n'])
        elif p.get('min'):
            foot = '~%d min, %s' % (p['min'], t(p['walk']))
        else:
            foot = 'Short walk; no reliable time known'
        body.append('<tr><td>%s</td><td>%s (%s)</td><td>%s</td></tr>' % (e(p['n']), e(ST[p['st']]['n']), e(', '.join(LINE_NAME[l] for l in ST[p['st']]['lines'])), e(foot)))
    body.append('</table></div>')
    body.append('<h2>%s</h2>' % ('Getting there' if not d.get('reverse') else 'From the airport'))
    pairs = [(d['main'], o) for o in d['origins']] if d.get('reverse') else [(o, d['main']) for o in d['origins']]
    body.append(routes_table(pairs, None))
    first = pairs[0]
    body.append('<h3>Step by step: %s to %s</h3>' % (e(end_of(first[0])['name']), e(end_of(first[1])['name'])))
    body.append(route_card(*first))
    body.append('<h2>The station</h2><p><b>%s</b></p>' % e(s['n']))
    body.append(station_facts(sid))
    links = station_links(sid)
    links = [x for x in links if x[0] != path]
    body.append('<ul class="links">' + ''.join('<li><a href="{ROOT}%s">%s</a></li>' % (LINE_PAGE[l], e(LINE_NAME[l])) for l in lines) +
                ''.join('<li><a href="{ROOT}%s">%s</a></li>' % (p, e(n)) for p, n in links) + '</ul>')
    kinds = sorted({LINE_KIND[l] for l in lines}, key=['metro', 'tram', 'mono'].index)
    body.append(hours_html(kinds))
    body.append('<h2>Nearby on this map</h2>' + related_dest(d['slug']))
    title = answer_title(d['title'], kind_word, main, sid)
    desc = answer_desc(d['title'], kind_word, main, sid, 'Travel times from the airport and other areas, fare and hours.')
    write(path, frame(path, title, desc, '\n'.join(body), [(path, d['title'])]))


# ---------------- station pages ----------------
def station(cfg):
    sid = cfg['id']; s = ST[sid]
    path = 'stations/%s/' % cfg['slug']
    lines = s['lines']
    xchg = len(lines) > 1
    lead = '%s is %s station on the %s.' % (s['n'], 'an interchange' if xchg else 'a metro', ' and '.join(LINE_NAME[l] for l in lines))
    if xchg:
        lead += ' You can change between the %s here without leaving the station.' % ' and '.join(LINE_NAME[l] for l in lines)
    for w in WALKS:
        if sid in (w['a'], w['b']):
            o = w['b'] if w['a'] == sid else w['a']
            lead += ' %s (%s) is about %d minutes away on foot.' % (ST[o]['n'], ', '.join(LINE_NAME[l] for l in ST[o]['lines']), w['t'])
    if other_names(sid):
        lead += ' Other or former names: %s.' % ', '.join(other_names(sid))
    if sid in ST_NO:
        lead += ' Its number on the official map is %d.' % ST_NO[sid]
    if sid in PARK_RIDE:
        lead += ' The station has a Park & Ride car park.'
    ds = districts_of(sid)
    if ds:
        lead += ' It serves %s.' % and_en([d['en'] for d in ds[:4]])
    body = ['<h1>%s metro station</h1>' % e(s['n']), '<p class="lead">%s</p>' % e(lead), plan(sid, cfg['to'][0], 'Plan a route from here')]
    body.append('<h2>Station facts</h2>' + station_facts(sid))
    # neighbours on each line
    body.append('<h2>Next stations</h2><ul>')
    seen = set()
    for sv in D['services']:
        if sid not in sv['stops'] or sv['line'] in seen:
            continue
        seen.add(sv['line'])
        st = sv['stops']; i = st.index(sid)
        prev = ST[st[i - 1]]['n'] if i > 0 else None; nxt = ST[st[i + 1]]['n'] if i + 1 < len(st) else None
        body.append('<li>%s: %s</li>' % (e(LINE_NAME[sv['line']]), e(' · '.join(x for x in [prev and ('towards %s: %s' % (ST[st[0]]['n'], prev)), nxt and ('towards %s: %s' % (ST[st[-1]]['n'], nxt))] if x))))
    body.append('</ul>')
    near = [p for p in D['places'] if p['st'] == sid]
    for w in WALKS:
        if sid in (w['a'], w['b']):
            o = w['b'] if w['a'] == sid else w['a']
            near += [p for p in D['places'] if p['st'] == o]
    if near:
        body.append('<h2>Places near the station</h2><ul class="links">')
        for p in near:
            link = DEST_PAGE.get(p['id'])
            nm = '<a href="{ROOT}%s">%s</a>' % (link, e(p['n'])) if link else e(p['n'])
            via = '' if p['st'] == sid else ' (via %s)' % ST[p['st']]['n']
            body.append('<li>%s%s%s</li>' % (nm, e(via), (', ~%d min on foot' % p['min']) if p.get('min') and p['st'] == sid else ''))
        body.append('</ul>')
    if ds:
        body.append('<h2>Districts served</h2><ul class="links">' + ''.join('<li><a href="{ROOT}%s">%s</a></li>' % (DIST_PAGE[d['slug']], e(d['en'])) for d in ds) + '</ul>')
    body.append('<h2>Routes from %s</h2>' % e(s['n']))
    body.append(routes_table([(sid, x) for x in cfg['to']], None))
    body.append(hours_html(sorted({LINE_KIND[l] for l in lines}, key=['metro', 'tram', 'mono'].index)))
    body.append('<ul class="links">' + ''.join('<li><a href="{ROOT}%s">%s</a></li>' % (LINE_PAGE[l], e(LINE_NAME[l])) for l in lines) + '<li><a href="{ROOT}stations/">All stations and their former names</a></li></ul>')
    title = '%s Metro Station, Riyadh: %s%s' % (s['n'], short_lines(lines), (', No. %d' % ST_NO[sid]) if sid in ST_NO else '')
    desc = lead.split('. ')[0] + '. ' + ('Also called %s. ' % ', '.join(other_names(sid)) if other_names(sid) else '') + 'Routes, lines and hours.'
    write(path, frame(path, title, desc, '\n'.join(body), [('stations/', 'Stations'), (path, s['n'])],
                      {"@context": "https://schema.org", "@type": "SubwayStation", "name": s['n'], **({"alternateName": s['f']} if s['f'] else {}),
                       "geo": {"@type": "GeoCoordinates", "latitude": D['geo'][sid][0], "longitude": D['geo'][sid][1]}} if sid in D['geo'] else None))


def and_en(xs):
    xs = list(xs)
    return xs[0] if len(xs) == 1 else ', '.join(xs[:-1]) + ' and ' + xs[-1]


def st_lines(sid):
    return ' and '.join(LINE_NAME[l] for l in ST[sid]['lines'])


# ---------------- district pages (nearest metro station to a district) ----------------
def near_districts(d, n=6):
    k = lambda o: math.hypot(o['mid'][0] - d['mid'][0], (o['mid'][1] - d['mid'][1]) * 0.91)
    return sorted((o for o in DISTRICTS if o is not d), key=k)[:n]


def nearest_park_ride(d):
    return min(PARK_RIDE, key=lambda s_: dist_km(d, s_))


def district(d):
    path = DIST_PAGE[d['slug']]
    sid = district_station(d); k0 = dist_km(d, sid)
    if d['inside']:
        n = len(d['inside'])
        lead = '%s has %s inside the district: %s.' % (d['en'], 'one metro station' if n == 1 else '%d metro stations' % n,
                                                      '; '.join('%s (%s)' % (ST[x]['n'], st_lines(x)) for x in d['inside']))
        lead += ' %s is the closest to the middle of the district, about %.1f km away.' % (ST[sid]['n'], k0) if n > 1 else \
                ' From the middle of the district it is about %.1f km away.' % k0
    else:
        lead = '%s has no metro station of its own. The nearest station to the middle of the district is %s on the %s, about %.1f km away in a straight line.' % (
            d['en'], ST[sid]['n'], st_lines(sid), k0)
    if k0 <= 1.5:
        lead += ' That is roughly %d minutes on foot.' % walk_min(k0)
    pr = nearest_park_ride(d)
    if pr != sid or sid not in PARK_RIDE:
        lead += ' The nearest station with Park & Ride is %s, about %.1f km away.' % (ST[pr]['n'], dist_km(d, pr))
    else:
        lead += ' The station has a Park & Ride car park.'
    body = ['<h1>Nearest metro station to %s, Riyadh</h1>' % e(d['en']), '<p class="lead">%s</p>' % e(lead),
            plan(sid, next(x for x in STATIONS if x['id'] == sid)['to'][0], 'Plan a route from %s' % ST[sid]['n'])]
    rows = [(x, dist_km(d, x)) for x in d['inside']] + [(x, k) for x, k in d['near'] if x not in d['inside']]
    rows = sorted(rows, key=lambda r: r[1])[:5]
    body.append('<h2>Metro stations for %s</h2><div class="scroll"><table><tr><th>Station</th><th>Lines</th><th>From the middle of the district</th></tr>' % e(d['en']))
    for x, k in rows:
        where = 'in the district, ' if x in d['inside'] else ''
        foot = ', ~%d min on foot' % walk_min(k) if k <= 1.5 else ''
        body.append('<tr><td><a href="{ROOT}%s">%s</a>%s</td><td>%s</td><td>%s%.1f km%s</td></tr>' % (
            STATION_PAGE[x], e(ST[x]['n']), ' <span class="note">P&amp;R</span>' if x in PARK_RIDE else '', e(st_lines(x)), where, k, foot))
    body.append('</table></div>')
    body.append('<p class="note">Distances are in a straight line from the middle of the district; streets make the walk longer. P&amp;R: Park &amp; Ride car park.</p>')
    cfg = next(x for x in STATIONS if x['id'] == sid)
    body.append('<h2>From %s station by metro</h2>' % e(ST[sid]['n']))
    body.append(routes_table([(sid, x) for x in cfg['to']], None))
    body.append('<h2>Districts nearby</h2><ul class="links">' + ''.join('<li><a href="{ROOT}%s">%s</a></li>' % (DIST_PAGE[o['slug']], e(o['en'])) for o in near_districts(d)) +
                '<li><a href="{ROOT}districts/">All districts</a></li></ul>')
    body.append(hours_html(['metro']))
    title = 'Nearest Metro Station to %s, Riyadh: %s%s' % (d['en'], ST[sid]['n'], ' (in the district)' if d['inside'] else ', %.1f km' % k0)
    desc = '. '.join(lead.split('. ')[:2]).rstrip('.') + '. Distances, Park & Ride and travel times by metro.'
    ld = {"@context": "https://schema.org", "@type": "Place", "name": d['en'] + ', Riyadh', "alternateName": d['ar'],
          "geo": {"@type": "GeoCoordinates", "latitude": d['mid'][0], "longitude": d['mid'][1]}}
    write(path, frame(path, title, desc, '\n'.join(body), [('districts/', 'Districts'), (path, d['en'])], ld))


def districts_list():
    path = 'districts/'
    lead = 'Find the nearest Riyadh Metro station to your district. %d districts near the six metro lines, with the stations inside each district or the nearest one and its distance.' % len(DISTRICTS)
    body = ['<h1>Riyadh districts and their nearest metro stations</h1>', '<p class="lead">%s</p>' % e(lead)]
    body.append('<div class="scroll"><table><tr><th>District</th><th>Nearest station</th><th>Distance</th></tr>')
    for d in DISTRICTS:
        sid = district_station(d)
        body.append('<tr><td><a href="{ROOT}%s">%s</a></td><td>%s</td><td>%s</td></tr>' % (
            DIST_PAGE[d['slug']], e(d['en']), e(ST[sid]['n']), 'in the district' if d['inside'] else '%.1f km' % dist_km(d, sid)))
    body.append('</table></div>')
    body.append('<p class="note">District boundaries: Saudi National Address. Distances are in a straight line from the middle of the district.</p>')
    write(path, frame(path, 'Nearest Metro Station to Every Riyadh District', lead, '\n'.join(body), [(path, 'Districts')]))


# ---------------- route pages ----------------
def route_page(r):
    path = 'routes/%s/' % r['slug']
    a, b = r['pairs'][0]
    v, _ = best(a, b)
    A, B = end_of(a), end_of(b)
    f = fare(v)
    uses = ', then '.join(('the ' + LINE_NAME[l]) if l != 'walk' else 'a short walk' for l in lines_of(v))
    lead = 'From %s, take %s to %s: about %d–%d minutes door to door with %s, SAR %s for a 2-hour ticket.' % (
        A['name'], uses, B['name'], v['time'], v['timeMax'], xf_text(v['xf']), sar(f['std']))
    body = ['<h1>%s</h1>' % e(r['title']), '<p class="lead">%s</p>' % e(lead), plan(a, b)]
    for i, (x, y) in enumerate(r['pairs']):
        body.append(route_card(x, y, 'From %s to %s' % (end_of(x)['name'], end_of(y)['name'])))
    # fares for this trip
    body.append(fare_table())
    x, y = r['return']
    body.append('<h2>Return trip</h2>')
    body.append(route_card(x, y, 'From %s to %s' % (end_of(x)['name'], end_of(y)['name'])))
    kinds = sorted({LINE_KIND[l['line']] for p in r['pairs'] for l in best(*p)[0]['legs'] if l['type'] == 'ride'}, key=['metro', 'tram', 'mono'].index)
    body.append(hours_html(kinds))
    title_of = {'destinations/%s/' % d['slug']: d['title'] for d in CFG['destinations']}
    ends = []
    for pr in r['pairs']:
        for tok in pr:
            pg = DEST_PAGE.get(tok)
            if pg and pg not in ends:
                ends.append(pg)
    body.append('<h2>More about these places</h2><ul class="links">' + ''.join('<li><a href="{ROOT}%s">%s by metro</a></li>' % (p, e(title_of[p])) for p in ends) + '</ul>')
    title = '%s: Time, Fare and Steps' % r['title']
    desc = lead
    write(path, frame(path, title, desc, '\n'.join(body), [(path, r['title'])]))


# ---------------- line pages ----------------
def conn(sid, line):
    s = ST[sid]; out = [LINE_NAME[l] for l in s['lines'] if l != line]
    for w in WALKS:
        if sid in (w['a'], w['b']):
            o = w['b'] if w['a'] == sid else w['a']
            out.append('walk to %s (%s), ~%d min' % (ST[o]['n'], ', '.join(LINE_NAME[l] for l in ST[o]['lines']), w['t']))
    return '; '.join(out)


def st_cell(sid):
    links = station_links(sid)
    nm = e(ST[sid]['n'])
    return ('<a href="{ROOT}%s">%s</a>' % (links[0][0], nm)) if links else nm


def station_table(ids, line):
    zc = False
    h = ['<div class="scroll"><table><tr><th>#</th><th>Station</th>%s<th>Other or former names</th><th>Connections</th></tr>' % ('<th>Zone</th>' if zc else '')]
    for i, sid in enumerate(ids, 1):
        z = ('<td>%s</td>' % ZONE.get(sid, '')) if zc else ''
        h.append('<tr><td>%d</td><td>%s</td>%s<td>%s</td><td>%s</td></tr>' % (i, st_cell(sid), z, e(', '.join(other_names(sid))), e(conn(sid, line))))
    h.append('</table></div>')
    return '\n'.join(h)


def fare_table():
    h = ['<h2>Fare</h2><table><tr><th>Ticket</th><th>Standard</th><th>First class</th></tr>']
    names = {'t2h': '2-hour ticket', 't3d': '3-day pass', 't7d': '7-day pass', 't30d': '30-day pass'}
    for k, a, b in PASSES:
        h.append('<tr><td>%s</td><td>SAR %s</td><td>SAR %s</td></tr>' % (names[k], sar(a), sar(b)))
    h.append('</table><p class="note">One 2-hour ticket covers any number of rides and transfers on the metro and Riyadh buses. Children under 6 travel free with an adult.</p>')
    return '\n'.join(h)


def line_pages():
    for v in D['services']:
        c = v['line']; ids = v['stops']; n = LINE_NUM[c]
        path = LINE_PAGE[c]
        xs = [x for x in ids if len(ST[x]['lines']) > 1]
        lead = 'The %s (Line %d) runs from %s to %s with %d stations. Interchanges: %s.' % (
            LINE_NAME[c], n, ST[ids[0]]['n'], ST[ids[-1]]['n'], len(ids),
            '; '.join('%s (%s)' % (ST[x]['n'], ', '.join(LINE_NAME[l] for l in ST[x]['lines'] if l != c)) for x in xs))
        if c in ('yellow', 'purple'):
            other = 'Purple' if c == 'yellow' else 'Yellow'
            lead += ' It shares the four stations from KAFD to SABIC with the %s Line.' % other
        body = ['<h1>Riyadh Metro %s (Line %d): stations and hours</h1>' % (e(LINE_NAME[c]), n), '<p class="lead">%s</p>' % e(lead),
                plan(ids[0], ids[-1], 'Plan a trip on this line')]
        body.append('<h2>Stations</h2>' + station_table(ids, c))
        body.append(hours_html(['metro']))
        body.append(fare_table())
        body.append('<h2>Other lines</h2><ul class="links">' + ''.join('<li><a href="{ROOT}%s">%s (Line %d)</a></li>' % (LINE_PAGE[o], e(LINE_NAME[o]), LINE_NUM[o]) for o in COLORS if o != c) + '</ul>')
        write(path, frame(path, 'Riyadh Metro %s (Line %d): Stations, Map and Hours' % (LINE_NAME[c], n), lead, '\n'.join(body), [(path, LINE_NAME[c])]))


def stations_list():
    path = 'stations/'
    ids = sorted(ST, key=lambda i: ST[i]['n'].lower())
    named = [i for i in ids if other_names(i)]
    lead = 'All %d stations of the six Riyadh Metro lines, with their lines and interchanges. Several stations carry sponsor names; find any station below.' % len(ids)
    body = ['<h1>Riyadh Metro stations: full list</h1>', '<p class="lead">%s</p>' % e(lead), map_figure()]
    if named:
        body.append('<h2>Stations with other or former names</h2><div class="scroll"><table><tr><th>Current name</th><th>Other or former names</th><th>Lines</th></tr>')
        for i in named:
            body.append('<tr><td>%s</td><td>%s</td><td>%s</td></tr>' % (st_cell(i), e(', '.join(other_names(i))), e(', '.join(LINE_NAME[l] for l in ST[i]['lines']))))
        body.append('</table></div>')
    body.append('<h2>All stations A–Z</h2><div class="scroll"><table><tr><th>Station</th><th>Lines</th></tr>')
    for i in ids:
        body.append('<tr><td>%s</td><td>%s</td></tr>' % (st_cell(i), e(', '.join(LINE_NAME[l] for l in ST[i]['lines']))))
    body.append('</table></div>')
    body.append('<ul class="links">' + ''.join('<li><a href="{ROOT}%s">%s (Line %d)</a></li>' % (LINE_PAGE[l], e(LINE_NAME[l]), LINE_NUM[l]) for l in COLORS) + '</ul>')
    write(path, frame(path, 'Riyadh Metro Stations: Full List of All 6 Lines', lead, '\n'.join(body), [(path, 'Stations')]))


def timings_page():
    path = 'timings/'
    H = D['hours']['metro']
    lead = 'The Riyadh Metro runs Saturday to Thursday %s–%s and on Friday %s–%s. One 2-hour ticket costs SAR %s (first class SAR %s) with any number of rides and transfers.' % (
        hm(H[0][0]), hm(H[0][1]), hm(H[5][0]), hm(H[5][1]), sar(FARE['std']), sar(FARE['first']))
    body = ['<h1>Riyadh Metro timings and fares</h1>', '<p class="lead">%s</p>' % e(lead), plan(pid_of('King Khalid Airport Terminals 1-2'), pid_of('Kingdom Centre'), 'Plan a trip')]
    body.append(hours_html(['metro']))
    body.append('<p>Trains run about every 3–5 minutes at peak times and every 5–10 minutes the rest of the day, about every 10 minutes late in the evening.</p>')
    body.append(fare_table())
    body.append('<p>Pay with a darb card, the darb app or a contactless bank card. Trains have First Class, Family and Singles sections.</p>')
    # the answer in the title: people search 'what time metro open'
    title = 'Riyadh Metro Timings: %s, Fares' % ', '.join('%s %s–%s' % (d, o, c.replace(' (next day)', '')) for d, o, c in hours_rows('metro'))
    write(path, frame(path, title, lead, '\n'.join(body), [(path, 'Timings and fares')]))


def pid_of(n):
    import re as _re
    return 'p_' + _re.sub(r'^_|_$', '', _re.sub(r'[^a-z0-9]+', '_', n.lower()))


MAP_IMG = 'riyadh-metro-map.png'
MAP_W, MAP_H = 1600, 1760
MAP_ALT = 'Riyadh Metro map: Blue, Red, Orange, Yellow, Green and Purple lines with all stations and interchanges'


def map_figure(link=True):
    img = '<img src="{ROOT}%s" width="%d" height="%d" alt="%s" loading="lazy" style="width:100%%;height:auto;border:1px solid var(--rule);border-radius:12px;background:#fff">' % (MAP_IMG, MAP_W, MAP_H, e(MAP_ALT))
    if link:
        img = '<a href="{ROOT}map/">%s</a>' % img
    return '<figure style="margin:12px 0">%s<figcaption class="note">The whole network on one map. <a href="{ROOT}">Open the interactive map</a> to tap a station and get a route.</figcaption></figure>' % img


def map_page():
    path = 'map/'
    xs = sorted({sid for sid in ST if len(ST[sid]['lines']) > 1}, key=lambda i: ST[i]['n'])
    lead = 'A schematic map of all six Riyadh Metro lines: %s. %d stations in all, with every interchange.' % (
        ', '.join('%s (%d stations)' % (LINE_NAME[v['line']], len(v['stops'])) for v in D['services']), len(ST))
    body = ['<h1>Riyadh Metro map 2026: all lines and stations</h1>', '<p class="lead">%s</p>' % e(lead),
            '<a class="cta" href="{ROOT}">Open the interactive map</a>',
            '<figure style="margin:12px 0"><img src="{ROOT}%s" width="%d" height="%d" alt="%s" style="width:100%%;height:auto;border:1px solid var(--rule);border-radius:12px;background:#fff"><figcaption class="note">%s</figcaption></figure>' % (
                MAP_IMG, MAP_W, MAP_H, e(MAP_ALT), 'Schematic, not to scale. Station names as of 2026. An unofficial map, not affiliated with Riyadh Public Transport.'),
            '<h2>How to read the map</h2><ul>']
    for v in D['services']:
        body.append('<li><b>%s (Line %d)</b>: %s to %s. <a href="{ROOT}%s">Stations</a></li>' % (e(LINE_NAME[v['line']]), LINE_NUM[v['line']], e(ST[v['stops'][0]]['n']), e(ST[v['stops'][-1]]['n']), LINE_PAGE[v['line']]))
    body.append('<li><b>Interchanges</b>: %s.</li>' % e(', '.join(ST[x]['n'] for x in xs)))
    body.append('<li>The Yellow and Purple lines share the track and the four stations from KAFD to SABIC; on the map they run side by side there.</li></ul>')
    body.append('<p><a href="{ROOT}stations/">All stations A–Z</a> · <a href="{ROOT}timings/">Timings and fares</a></p>')
    ld = {"@context": "https://schema.org", "@type": "ImageObject", "contentUrl": SITE + MAP_IMG, "name": "Riyadh Metro map",
          "description": MAP_ALT, "width": MAP_W, "height": MAP_H, "encodingFormat": "image/png"}
    write(path, frame(path, 'Riyadh Metro Map 2026: All Lines and Stations (Image and Interactive)', lead, '\n'.join(body), [(path, 'Map')], ld, og_image=MAP_IMG))


def build():
    PAGES.clear()
    map_page()
    stations_list()
    timings_page()
    line_pages()
    for d in CFG['destinations']:
        destination(d)
    for s in STATIONS:
        station(s)
    for r in CFG['routes']:
        route_page(r)
    districts_list()
    for d in DISTRICTS:
        district(d)
    return dict(PAGES)


if __name__ == '__main__':
    p = build()
    print('guide pages:', len(p))
