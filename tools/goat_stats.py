"""Download the site's visit statistics from GoatCounter into JSON files (run daily by
.github/workflows/goat-stats.yml, which commits them to the `stats` branch).

Usage:  GOATCOUNTER_TOKEN=... python3 tools/goat_stats.py --site https://riyadhmetro.goatcounter.com --out DIR [--days 30]

Writes DIR/latest.json (last N days) and DIR/YYYY-MM-DD.json (a copy, so changes over time can be compared).
Only aggregate counts are stored (pages, events, referrers and the pages each referrer sent visitors to, languages, countries, screen sizes);
GoatCounter keeps no personal data. The token needs only "Read statistics".
"""
import argparse, datetime, json, os, sys, time, urllib.parse, urllib.request

ap = argparse.ArgumentParser()
ap.add_argument('--site', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--days', type=int, default=30)
a = ap.parse_args()
TOKEN = os.environ.get('GOATCOUNTER_TOKEN', '')
if not TOKEN:
    sys.exit('GOATCOUNTER_TOKEN is not set')

today = datetime.date.today()
start = (today - datetime.timedelta(days=a.days)).isoformat()
end = (today + datetime.timedelta(days=1)).isoformat()


def get(path, **q):
    q = {k: v for k, v in q.items() if v is not None}
    url = a.site.rstrip('/') + '/api/v0/' + path + ('?' + urllib.parse.urlencode(q) if q else '')
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 3:      # rate limit: wait and try again
                time.sleep(2 + attempt * 2); continue
            return {'error': 'HTTP %d' % e.code, 'body': e.read().decode()[:500]}
        except Exception as e:  # network problems are recorded, not fatal
            if attempt < 3:
                time.sleep(2); continue
            return {'error': str(e)}


out = {'site': a.site, 'generated': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'), 'start': start, 'end': end}
out['total'] = get('stats/total', start=start, end=end)

# every page and event, with daily counts (paged: the API returns a limited number at a time)
hits, seen = [], []
for _ in range(20):
    r = get('stats/hits', start=start, end=end, limit=100, exclude_paths=','.join(str(x) for x in seen) if seen else None)
    if 'hits' not in r:
        out['hits_error'] = r; break
    new = [h for h in r['hits'] if h.get('path_id') not in seen]
    if not new:   # the server ignored the exclusion list: stop instead of looping
        break
    for h in new:
        hits.append({'path': h.get('path'), 'path_id': h.get('path_id'), 'title': h.get('title'), 'event': h.get('event'), 'count': h.get('count'),
                     'daily': {d['day']: d.get('daily', 0) for d in h.get('stats', []) if d.get('daily')}})
        seen.append(h.get('path_id'))
    if not r.get('more'):
        break
    time.sleep(0.5)
out['hits'] = sorted(hits, key=lambda h: -(h['count'] or 0))


def summary(hits, visits):
    """the core numbers, computed from the events: did people use the map to answer a trip question?"""
    ev = [h for h in hits if h.get('event')]
    n = lambda h: h.get('count') or 0
    top = lambda d, k=15: [{'name': x, 'count': v} for x, v in sorted(d.items(), key=lambda kv: -kv[1])[:k]]
    pairs, origins, dests, shares, geo, visit, failed = {}, {}, {}, {}, {}, {}, {}
    routes = routes_none = picks = 0
    for h in ev:
        p = (h.get('path') or '').split('/')
        if p[0] == 'route' and len(p) >= 3:
            routes += n(h); k = p[1] + ' > ' + p[2]
            pairs[k] = pairs.get(k, 0) + n(h); origins[p[1]] = origins.get(p[1], 0) + n(h); dests[p[2]] = dests.get(p[2], 0) + n(h)
        elif p[0] == 'route_none':
            routes_none += n(h)
        elif p[0] in ('place', 'station'):
            picks += n(h)
        elif p[0] == 'share':
            m = p[1] if len(p) == 4 else 'unknown'      # older events kept the method in the title only
            shares[m] = shares.get(m, 0) + n(h)
        elif p[0] == 'geo' and len(p) >= 2:
            geo[p[1]] = geo.get(p[1], 0) + n(h)
        elif p[0] == 'visit' and len(p) >= 2:
            visit[p[1]] = visit.get(p[1], 0) + n(h)
        elif p[0] == 'noresult' and len(p) == 2:          # older events (noresult/from/-) had no text
            failed[p[1].replace('_', ' ')] = failed.get(p[1].replace('_', ' '), 0) + n(h)
    nores = sum(failed.values())
    sh = sum(shares.values())
    return {
        'visits': visits, 'routes': routes, 'routes_not_found': routes_none,
        'routes_per_visit': round(routes / visits, 2) if visits else None,
        'share_rate': round(sh / routes, 3) if routes else None, 'shares': shares,
        'failed_search_rate': round(nores / (nores + picks), 3) if (nores + picks) else None, 'failed_searches': top(failed, 30),
        'nearest_station': geo, 'visitors_new_return': visit,
        'top_routes': top(pairs), 'top_origins': top(origins, 10), 'top_destinations': top(dests, 10),
    }


tv = out['total'].get('total') if isinstance(out['total'], dict) else None
out['summary'] = summary(out['hits'], tv)

# where the visitors of each page came from (pages only, not events; the 60 most visited)
by_page, by_ref = {}, {}
for h in [h for h in out['hits'] if not h['event']][:60]:
    if h.get('path_id') is None:
        continue
    r = get('stats/hits/%s' % h['path_id'], start=start, end=end, limit=20)
    refs = r.get('refs', r.get('stats', r)) if isinstance(r, dict) else r
    if not isinstance(refs, list):
        out.setdefault('page_refs_error', r); continue
    refs = [{'name': x.get('name') or '(direct or unknown)', 'count': x.get('count')} for x in refs]
    by_page[h['path']] = refs
    for x in refs:
        by_ref.setdefault(x['name'], []).append({'path': h['path'], 'count': x['count']})
    time.sleep(0.5)
out['page_refs'] = by_page                     # page -> where its visitors came from
out['ref_pages'] = {k: sorted(v, key=lambda x: -(x['count'] or 0)) for k, v in by_ref.items()}   # source -> pages it sent visitors to

for page in ['toprefs', 'languages', 'locations', 'sizes', 'browsers', 'systems', 'campaigns']:
    r = get('stats/' + page, start=start, end=end, limit=50)
    out[page] = r.get('stats', r)
    time.sleep(0.5)

os.makedirs(a.out, exist_ok=True)
for name in ('latest.json', today.isoformat() + '.json'):
    json.dump(out, open(os.path.join(a.out, name), 'w'), ensure_ascii=False, indent=1)
t = out['total']
print('total:', t.get('total', t), '| pages and events:', len(out['hits']), '| pages with sources:', len(out['page_refs']))
for k in ('Google', 'www.bing.com'):
    print(k, '->', out['ref_pages'].get(k))
