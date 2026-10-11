"""Search Console opportunity report: what to improve or request first, from the files the Stats workflow already keeps.

Usage:  python3 tools/gsc_report.py --stats DIR_WITH_gsc.json_AND_gsc_index.json [--prev DIR_WITH_OLD_report.json] --out DIR

Reads gsc.json (last 28 days of queries, pages and query + page pairs) and gsc_index.json (index status per page).
Writes:
  report.json  the lists below as data, plus the pages suggested for manual indexing in the last 14 days
  report.md    the same lists for people: open it on the `stats` branch on GitHub

Lists:
  1. queries on page 1-3 that get far fewer clicks than their position usually brings (fix the title or description)
  2. queries just below page 1 (positions 11-20): small improvements can bring them onto page 1
  3. pages with impressions and no clicks
  4. index status by page type, and 10 pages to submit by hand today (not suggested in the last 14 days)
  5. English and Arabic side by side
Search Console data is about 2 days behind and index statuses are checked 150 pages a day, so some are days old.
"""
import argparse, datetime, json, os, re

ap = argparse.ArgumentParser()
ap.add_argument('--stats', required=True)
ap.add_argument('--prev', default='')
ap.add_argument('--sitemap', default='', help='sitemap.xml: pages not yet inspected (new ones) are also suggested')
ap.add_argument('--out', required=True)
a = ap.parse_args()

G = json.load(open(os.path.join(a.stats, 'gsc.json'), encoding='utf-8'))
I = json.load(open(os.path.join(a.stats, 'gsc_index.json'), encoding='utf-8'))
host = G.get('host', '')
today = datetime.date.today()

# typical share of clicks by position (rough, for ranking only)
def expected_ctr(p):
    for lim, c in ((1.5, .28), (2.5, .15), (3.5, .10), (4.5, .07), (5.5, .05), (10.5, .03), (20.5, .01), (30.5, .005)):
        if p <= lim:
            return c
    return .002

path = lambda u: re.sub(r'^https?://[^/]+', '', u) or '/'
best_page = {}
for r in G.get('query_page', []):
    q = r['query']
    if q not in best_page or r['impressions'] > best_page[q]['impressions']:
        best_page[q] = r
is_ar = lambda s: bool(re.search(r'[؀-ۿ]', s))

# 1. low CTR for the position
q1 = []
for r in G.get('queries', []):
    if r['impressions'] >= 3 and r['position'] <= 30:
        lost = r['impressions'] * expected_ctr(r['position']) - r['clicks']
        if lost > 0.05:
            q1.append(dict(query=r['query'], impressions=r['impressions'], clicks=r['clicks'], position=round(r['position'], 1),
                           page=path(best_page.get(r['query'], {}).get('page', '')), lost_clicks=round(lost, 2)))
q1.sort(key=lambda x: -x['lost_clicks'])

# 2. just below page 1
q2 = sorted((dict(query=r['query'], impressions=r['impressions'], position=round(r['position'], 1),
                  page=path(best_page.get(r['query'], {}).get('page', '')))
             for r in G.get('queries', []) if 10.5 < r['position'] <= 20.5 and r['impressions'] >= 2),
            key=lambda x: -x['impressions'])

# 3. pages seen but never clicked
p3 = sorted((dict(page=path(r['page']), impressions=r['impressions'], position=round(r['position'], 1))
             for r in G.get('pages', []) if r['clicks'] == 0 and r['impressions'] >= 10),
            key=lambda x: -x['impressions'])

# 4. index status by page type, and today's manual requests
def ptype(p):
    p = path(p).strip('/')
    ar = p.startswith('ar/') or p == 'ar.html'
    p = p[3:] if p.startswith('ar/') else p
    t = p.split('/')[0] if '/' in p else ('home' if p in ('', 'ar.html', 'index.html') else ('home-other-language' if p.endswith('.html') else p))
    return ('ar ' if ar else 'en ') + t

pages_idx = dict(I.get('pages', {}))
if a.sitemap and os.path.exists(a.sitemap):     # new pages the index check has not reached yet
    for u in re.findall(r'<loc>([^<]+)</loc>', open(a.sitemap, encoding='utf-8').read()):
        pages_idx.setdefault(u, {'state': 'new, not checked yet'})
by_type = {}
for u, v in pages_idx.items():
    t = ptype(u)
    d = by_type.setdefault(t, {'indexed': 0, 'not_indexed': 0, 'not_checked': 0})
    st = v.get('state', '')
    if st == 'Submitted and indexed' or v.get('verdict') == 'PASS':
        d['indexed'] += 1
    elif st in ('', 'not checked yet') or st.startswith('new'):
        d['not_checked'] += 1
    else:
        d['not_indexed'] += 1

prev_suggested = {}
if a.prev and os.path.exists(os.path.join(a.prev, 'report.json')):
    try:
        prev_suggested = json.load(open(os.path.join(a.prev, 'report.json'), encoding='utf-8')).get('suggested_history', {})
    except Exception:
        prev_suggested = {}
recent = {u for u, d in prev_suggested.items() if (today - datetime.date.fromisoformat(d)).days < 14}
# most useful page types first; English and Arabic alternate inside each type
ORDER = ['routes', 'nearest-station', 'rules', 'timings', 'map', 'destinations', 'stations', 'lines', 'districts', 'home-other-language']
cand = [u for u, v in pages_idx.items()
        if v.get('state') not in ('Submitted and indexed',) and v.get('verdict') != 'PASS' and u not in recent]
def rank(u):
    t = ptype(u).split(' ', 1)[1]
    new = pages_idx[u].get('state', '').startswith('new')
    return (ORDER.index(t) if t in ORDER else len(ORDER), not new, path(u).startswith('/ar/'), path(u))
cand.sort(key=rank)
today_list = []
seen_types = {}
for u in cand:     # no more than 4 of one type a day, so several kinds of pages get a chance
    t = ptype(u)
    if seen_types.get(t, 0) >= 4:
        continue
    seen_types[t] = seen_types.get(t, 0) + 1
    today_list.append(u)
    if len(today_list) == 10:
        break
history = {u: d for u, d in prev_suggested.items() if (today - datetime.date.fromisoformat(d)).days < 30}
for u in today_list:
    history[u] = today.isoformat()

# 5. English and Arabic
lang = {'en': {'impressions': 0, 'clicks': 0}, 'ar': {'impressions': 0, 'clicks': 0}}
for r in G.get('queries', []):
    k = 'ar' if is_ar(r['query']) else 'en'
    lang[k]['impressions'] += r['impressions']; lang[k]['clicks'] += r['clicks']

out = dict(host=host, generated=today.isoformat(), gsc_period=[G.get('start'), G.get('end')], index_checked=I.get('generated'),
           low_ctr_queries=q1[:20], near_page_one=q2[:15], pages_no_clicks=p3[:15], index_by_type=dict(sorted(by_type.items())),
           request_today=today_list, languages=lang, suggested_history=history,
           _about='Built by tools/gsc_report.py from gsc.json and gsc_index.json. Positions are averages over the period; '
                  'lost_clicks = impressions x typical CTR for that position - clicks (a ranking aid, not a forecast).')
os.makedirs(a.out, exist_ok=True)
json.dump(out, open(os.path.join(a.out, 'report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

L = ['# Search opportunities: %s' % host, '',
     'Updated %s. Search data %s to %s (about 2 days behind). Index statuses checked up to %s.' % (today, G.get('start'), G.get('end'), (I.get('generated') or '')[:10]), '',
     '## 1. Fewer clicks than the position should bring', 'Improve the title or description of the page, or the page itself.', '',
     '| Query | Impr. | Clicks | Pos. | Page |', '|---|---|---|---|---|']
L += ['| %s | %d | %d | %.1f | %s |' % (x['query'], x['impressions'], x['clicks'], x['position'], x['page']) for x in q1[:20]] or ['| none yet | | | | |']
L += ['', '## 2. Just below page 1 (positions 11-20)', '', '| Query | Impr. | Pos. | Page |', '|---|---|---|---|']
L += ['| %s | %d | %.1f | %s |' % (x['query'], x['impressions'], x['position'], x['page']) for x in q2[:15]] or ['| none yet | | | |']
L += ['', '## 3. Pages seen but never clicked', '', '| Page | Impr. | Pos. |', '|---|---|---|']
L += ['| %s | %d | %.1f |' % (x['page'], x['impressions'], x['position']) for x in p3[:15]] or ['| none yet | | |']
L += ['', '## 4. Index', '', '| Page type | Indexed | Not indexed | Not checked yet |', '|---|---|---|---|']
L += ['| %s | %d | %d | %d |' % (t, d['indexed'], d['not_indexed'], d['not_checked']) for t, d in sorted(by_type.items())]
L += ['', 'Request indexing by hand today (Search Console, URL inspection; skip any that already show as indexed):', '', '```'] + today_list + ['```']
L += ['', '## 5. English and Arabic searches', '', '| | Impressions | Clicks |', '|---|---|---|',
      '| English (top queries) | %d | %d |' % (lang['en']['impressions'], lang['en']['clicks']), '| Arabic (top queries) | %d | %d |' % (lang['ar']['impressions'], lang['ar']['clicks'])]
open(os.path.join(a.out, 'report.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print('report: %d low-CTR queries, %d near page 1, %d pages without clicks, %d to request today' % (len(q1), len(q2), len(p3), len(today_list)))
