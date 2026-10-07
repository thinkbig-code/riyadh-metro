"""Make data/districts.json: the Riyadh districts (أحياء) that the metro serves, with the stations inside each
district and the nearest stations to its middle. Used by the district pages ("nearest metro station to <district>").

Source: district boundaries of the Saudi National Address (maps.address.gov.sa), as published in
https://github.com/homaily/Saudi-Arabia-Regions-Cities-and-Districts (json/districts.json).
Only names and the computed middle point and distances are kept, not the boundaries.

Usage:  python3 tools/make_districts.py PATH/TO/districts.json
Run again only if the districts or the station positions (data/coords_official.csv) change.
"""
import csv, json, math, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
RIYADH_CITY_ID = '3'
MAX_KM = 3.5          # a district is listed if a station is inside it or this close to its middle

geo = {r['id']: (float(r['lat']), float(r['lon'])) for r in csv.DictReader(open(os.path.join(ROOT, 'data', 'coords_official.csv')))}


def km(a, b):
    return math.hypot(a[0] - b[0], (a[1] - b[1]) * math.cos(math.radians(24.7))) * 111


def inside(p, ring):
    y, x = p; c = False
    for i in range(len(ring)):
        (ay, ax), (by, bx) = ring[i], ring[i - 1]
        if (ax > x) != (bx > x) and y < (by - ay) * (x - ax) / (bx - ax) + ay:
            c = not c
    return c


def slug(n):
    return re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', n.lower()))


out, seen = [], set()
for d in json.load(open(sys.argv[1], encoding='utf-8')):
    if str(d['city_id']) != RIYADH_CITY_ID or not d['name_ar'].strip().startswith('حي '):   # districts only, not campuses or parks
        continue
    B = d['boundaries']; B = json.loads(B) if isinstance(B, str) else B
    rings = []          # outer rings of every part (a district can have several parts)

    def walk(x):
        if isinstance(x[0][0], (int, float)):
            rings.append(x)
        else:
            for y in x:
                walk(y)
    walk(B)

    def shoelace(ring):
        A = cy = cx = 0.0
        for i in range(len(ring)):
            (y0, x0), (y1, x1) = ring[i - 1], ring[i]
            f = y0 * x1 - y1 * x0; A += f; cy += (y0 + y1) * f; cx += (x0 + x1) * f
        return A, cy, cx
    parts = [shoelace(r) for r in rings]
    A = sum(abs(p[0]) for p in parts)
    if not A:
        continue
    # middle of all parts together
    mid = (sum(p[1] for p in parts) / (3 * sum(p[0] for p in parts)), sum(p[2] for p in parts) / (3 * sum(p[0] for p in parts)))
    ins = sorted((s for s, g in geo.items() if any(inside(g, r) for r in rings)), key=lambda s: km(mid, geo[s]))
    near = sorted(geo, key=lambda s: km(mid, geo[s]))[:3]
    if not ins and km(mid, geo[near[0]]) > MAX_KM:
        continue
    en = re.sub(r'\s*Dist\.?$', '', d['name_en']).strip()
    sl = slug(en)
    if sl in seen:
        sl += '-' + str(d['district_id'])[-3:]
    seen.add(sl)
    out.append({'slug': sl, 'en': en, 'ar': d['name_ar'].strip(), 'mid': [round(mid[0], 5), round(mid[1], 5)],
                'area': round(abs(A) / 2 * 111 * 111 * math.cos(math.radians(24.7)), 1),
                'inside': ins, 'near': [[s, round(km(mid, geo[s]), 1)] for s in near]})
out.sort(key=lambda x: x['en'])
json.dump({'_about': __doc__.strip().split('\n\n')[1], 'districts': out}, open(os.path.join(ROOT, 'data', 'districts.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=0)
print('districts:', len(out))
