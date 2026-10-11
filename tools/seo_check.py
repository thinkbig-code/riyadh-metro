"""SEO check of the built site, run at the end of tools/build.py (also runnable on its own):

    python3 tools/seo_check.py [ROOT] [--site https://riyadhmetro.fyi/]

Reads every generated HTML page and sitemap.xml and reports:
  ERROR    missing title, missing or wrong canonical, the same canonical on two pages, hreflang to a page that does
           not exist or does not link back, sitemap URL without a page, broken internal link, JSON-LD that is not JSON
  WARNING  missing description, title over 75 characters (the generators keep titles to 75), not exactly one H1, page not in the sitemap,
           duplicate title or description, hreflang without x-default
  INFO     counts
Exit code 1 when there is any ERROR, so a broken build is not published by accident.
"""
import collections, glob, json, os, re, sys

args = [x for x in sys.argv[1:] if not x.startswith('--')]
ROOT = os.path.abspath(args[0] if args else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SITE = next((sys.argv[i + 1] for i, x in enumerate(sys.argv) if x == '--site'), None)
SKIP = {'.git', 'src', 'tools', 'node_modules', 'data'}

files = []
for d, dirs, fs in os.walk(ROOT):
    dirs[:] = [x for x in dirs if x not in SKIP and not x.startswith('.')]
    files += [os.path.join(d, f) for f in fs if f.endswith('.html')]
sm_path = os.path.join(ROOT, 'sitemap.xml')
sitemap = re.findall(r'<loc>([^<]+)</loc>', open(sm_path, encoding='utf-8').read()) if os.path.exists(sm_path) else []
if not SITE:
    SITE = re.match(r'https?://[^/]+/', sitemap[0]).group(0) if sitemap else 'https://example.com/'


def url_of(f):
    r = os.path.relpath(f, ROOT).replace(os.sep, '/')
    if r == 'index.html':
        return SITE
    if r.endswith('/index.html'):
        return SITE + r[:-10]
    return SITE + r


def file_of(u):
    if not u.startswith(SITE):
        return None
    p = u[len(SITE):]
    f = os.path.join(ROOT, p, 'index.html') if (p == '' or p.endswith('/')) else os.path.join(ROOT, p)
    return f if os.path.exists(f) else None


E, W = [], []
pages = {}
for f in sorted(files):
    s = open(f, encoding='utf-8').read()
    if re.search(r'<meta http-equiv="refresh"', s) or 'google-site-verification' in s[:300] and '<title>' not in s:
        continue
    if re.match(r'google[0-9a-f]+\.html$', os.path.basename(f)):
        continue
    pages[url_of(f)] = (f, s)

titles, descs, canon = collections.defaultdict(list), collections.defaultdict(list), collections.defaultdict(list)
for u, (f, s) in pages.items():
    rel = os.path.relpath(f, ROOT)
    t = re.search(r'<title>([^<]*)</title>', s)
    if not t or not t.group(1).strip():
        E.append('missing title: %s' % rel)
    else:
        titles[t.group(1).strip()].append(rel)
        import html as _h
        tl = len(re.sub('[\u2066-\u2069\u200e\u200f]', '', _h.unescape(t.group(1))))   # direction marks are invisible
        if tl > 75:
            W.append('title %d characters: %s' % (tl, rel))
    d = re.search(r'<meta name="description" content="([^"]*)"', s)
    if not d or not d.group(1).strip():
        W.append('missing description: %s' % rel)
    else:
        descs[d.group(1)].append(rel)
    c = re.search(r'<link rel="canonical" href="([^"]+)"', s)
    if not c:
        E.append('missing canonical: %s' % rel)
    else:
        canon[c.group(1)].append(rel)
        if c.group(1) != u:
            E.append('canonical %s on %s (expected %s)' % (c.group(1), rel, u))
    h1 = len(re.findall(r'<h1[\s>]', s))
    if h1 != 1:
        W.append('%d H1 on %s' % (h1, rel))
    alts = re.findall(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"', s)
    if alts and not any(l == 'x-default' for l, _ in alts):
        W.append('hreflang without x-default: %s' % rel)
    for lang, h in alts:
        if lang == 'x-default':
            if not file_of(h):
                E.append('x-default to a missing page %s from %s' % (h, rel))
            continue
        tf = file_of(h)
        if not tf:
            E.append('hreflang %s to a missing page %s from %s' % (lang, h, rel))
        elif h != u and h in pages and u not in [x for _, x in re.findall(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"', pages[h][1])]:
            E.append('hreflang not returned: %s -> %s' % (rel, h))
    for blk in re.findall(r'<script type="application/ld\+json">(.*?)</script>', s, re.S):
        try:
            json.loads(blk)
        except Exception as ex:
            E.append('JSON-LD is not valid JSON on %s: %s' % (rel, ex))
    for h in re.findall(r'href="([^"#?]+)', s):
        if h.startswith(('http', 'mailto', 'data:', 'tel:', 'javascript:')) or '${' in h:
            continue
        tgt = os.path.normpath(os.path.join(os.path.dirname(f), h))
        if os.path.isdir(tgt):
            tgt = os.path.join(tgt, 'index.html')
        if not os.path.exists(tgt):
            E.append('broken link %s on %s' % (h, rel))

for k, v in canon.items():
    if len(v) > 1:
        E.append('same canonical %s on %s' % (k, ', '.join(v[:3])))
for k, v in titles.items():
    if len(v) > 1:
        W.append('same title on %d pages: %s' % (len(v), ', '.join(v[:3])))
for k, v in descs.items():
    if len(v) > 1:
        W.append('same description on %d pages: %s' % (len(v), ', '.join(v[:3])))
for u in sitemap:
    if not file_of(u):
        E.append('sitemap URL without a page: %s' % u)
sm = set(sitemap)
for u, (f, s) in pages.items():
    if u not in sm and '<meta name="robots" content="noindex' not in s:
        W.append('not in sitemap: %s' % os.path.relpath(f, ROOT))

print('SEO check: %d pages, %d sitemap URLs, %d errors, %d warnings' % (len(pages), len(sitemap), len(E), len(W)))
for x in E[:30]:
    print('  ERROR   ' + x)
for x in W[:15]:
    print('  WARNING ' + x)
if len(W) > 15:
    print('  ... %d more warnings' % (len(W) - 15))
sys.exit(1 if E else 0)
