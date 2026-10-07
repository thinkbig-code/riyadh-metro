"""Download Google Search Console data into JSON files (run daily by .github/workflows/goat-stats.yml,
which commits them to the `stats` branch next to the GoatCounter files).

Usage:  GSC_KEY='<service account JSON>' python3 tools/gsc_stats.py --host riyadhmetro.fyi --sitemap sitemap.xml \
            --prev DIR_WITH_OLD_gsc_index.json --out DIR [--days 28] [--inspect 150]

Needs a Google Cloud service account with the Search Console API enabled, added as a user of the property
in Search Console (read access is enough). The key lives only in the GSC_KEY secret of the repository.

Writes:
  gsc.json        search performance for the last N days: totals per day, top queries, pages,
                  query + page pairs, countries, devices; and the sitemaps as Google sees them
  gsc_index.json  index status per page (URL Inspection API), checked in turns: the pages checked
                  longest ago (or never) first, up to --inspect pages a day (the API allows 2000 a day)
Search Console data arrives with a delay of about 2 days; dataState "all" includes the freshest rows.
"""
import argparse, datetime, json, os, re, sys, time, urllib.parse
from google.oauth2 import service_account
from google.auth.transport.requests import AuthorizedSession

ap = argparse.ArgumentParser()
ap.add_argument('--host', required=True)
ap.add_argument('--sitemap', required=True)
ap.add_argument('--prev', default='')
ap.add_argument('--out', required=True)
ap.add_argument('--days', type=int, default=28)
ap.add_argument('--inspect', type=int, default=150)
a = ap.parse_args()

KEY = os.environ.get('GSC_KEY', '').strip()
if not KEY:
    sys.exit('GSC_KEY is not set')
creds = service_account.Credentials.from_service_account_info(json.loads(KEY), scopes=['https://www.googleapis.com/auth/webmasters.readonly'])
S = AuthorizedSession(creds)
WM = 'https://www.googleapis.com/webmasters/v3/'
os.makedirs(a.out, exist_ok=True)


def call(method, url, body=None):
    for attempt in range(4):
        try:
            r = S.request(method, url, json=body, timeout=60)
        except Exception as e:
            if attempt < 3:
                time.sleep(3); continue
            return {'error': str(e)}
        if r.status_code == 429 and attempt < 3:
            time.sleep(10 * (attempt + 1)); continue
        try:
            j = r.json()
        except ValueError:
            j = {'raw': r.text[:300]}
        if r.status_code >= 400:
            return {'error': 'HTTP %d' % r.status_code, 'body': j}
        return j
    return {'error': 'gave up'}


# which property: a domain property (sc-domain:host) or a URL-prefix property (https://host/ or https://www.host/)
sites = call('GET', WM + 'sites')
mine = [s['siteUrl'] for s in sites.get('siteEntry', [])]
prop = next((p for p in ['sc-domain:' + a.host, 'https://%s/' % a.host, 'https://www.%s/' % a.host, 'http://%s/' % a.host] if p in mine), None)
out = {'host': a.host, 'generated': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'), 'property': prop, 'properties_visible': mine}
if not prop:
    out['error'] = ('the service account cannot see %s in Search Console: add its e-mail as a user of the property' % a.host)
    json.dump(out, open(os.path.join(a.out, 'gsc.json'), 'w'), ensure_ascii=False, indent=1)
    print(out['error'], '| visible:', mine)
    sys.exit(0)
P = urllib.parse.quote(prop, safe='')

# ---------------- search performance ----------------
end = datetime.date.today()
start = end - datetime.timedelta(days=a.days)
out['start'], out['end'] = start.isoformat(), end.isoformat()


def query(dims, limit=1000, **extra):
    body = {'startDate': out['start'], 'endDate': out['end'], 'dimensions': dims, 'rowLimit': limit, 'dataState': 'all', **extra}
    r = call('POST', WM + 'sites/%s/searchAnalytics/query' % P, body)
    if 'error' in r:
        return r
    rows = []
    for x in r.get('rows', []):
        row = dict(zip(dims, x.get('keys', [])))
        row.update(clicks=x.get('clicks', 0), impressions=x.get('impressions', 0), ctr=round(x.get('ctr', 0), 4), position=round(x.get('position', 0), 1))
        rows.append(row)
    return rows


out['by_date'] = query(['date'], 500)
out['queries'] = query(['query'])
out['pages'] = query(['page'])
out['query_page'] = query(['query', 'page'])
out['countries'] = query(['country'], 50)
out['devices'] = query(['device'], 10)
tot = [r for r in out['by_date'] if isinstance(r, dict) and 'clicks' in r] if isinstance(out['by_date'], list) else []
out['totals'] = {'clicks': sum(r['clicks'] for r in tot), 'impressions': sum(r['impressions'] for r in tot)}

# ---------------- sitemaps ----------------
sm = call('GET', WM + 'sites/%s/sitemaps' % P)
out['sitemaps'] = sm.get('sitemap', sm)

json.dump(out, open(os.path.join(a.out, 'gsc.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(out, open(os.path.join(a.out, 'gsc-%s.json' % end.isoformat()), 'w'), ensure_ascii=False, indent=1)
print('search: %(clicks)d clicks, %(impressions)d impressions' % out['totals'], '| queries:', len(out['queries']) if isinstance(out['queries'], list) else out['queries'])

# ---------------- index status per page, in turns ----------------
urls = re.findall(r'<loc>([^<]+)</loc>', open(a.sitemap, encoding='utf-8').read())
idx = {}
old = os.path.join(a.prev, 'gsc_index.json') if a.prev else ''
if old and os.path.exists(old):
    idx = json.load(open(old, encoding='utf-8')).get('pages', {})
idx = {u: v for u, v in idx.items() if u in urls}            # pages no longer in the sitemap are dropped
todo = sorted(urls, key=lambda u: idx.get(u, {}).get('checked', ''))[:a.inspect]
done = 0
for u in todo:
    r = call('POST', 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {'inspectionUrl': u, 'siteUrl': prop})
    if 'error' in r:
        idx.setdefault(u, {})['error'] = r['error']
        if r['error'] in ('HTTP 429', 'HTTP 403'):
            break                                              # quota or permission: stop for today
        continue
    s = r.get('inspectionResult', {}).get('indexStatusResult', {})
    idx[u] = {'verdict': s.get('verdict'), 'state': s.get('coverageState'), 'lastCrawl': s.get('lastCrawlTime'),
              'googleCanonical': s.get('googleCanonical'), 'checked': out['generated']}
    done += 1
    time.sleep(0.15)
summary = {}
for v in idx.values():
    k = v.get('state') or 'not checked yet'
    summary[k] = summary.get(k, 0) + 1
summary['not checked yet'] = summary.get('not checked yet', 0) + sum(1 for u in urls if u not in idx)
json.dump({'host': a.host, 'generated': out['generated'], 'sitemap_pages': len(urls), 'summary': summary, 'pages': idx},
          open(os.path.join(a.out, 'gsc_index.json'), 'w'), ensure_ascii=False, indent=1)
print('inspected today:', done, '| index summary:', summary)
