"""Arabic guide pages (ar/map/, ar/stations/, ar/timings/, ar/lines/..., ar/destinations/..., ar/routes/...).

The same pages as tools/seo_pages.py, for people who search in Arabic (اقرب محطة مترو، مواعيد مترو الرياض،
اسعار مترو الرياض، خريطة مترو الرياض). Called by tools/build.py after seo_pages.build().
Facts come from the same app data; station names from the RCRC open data and place names are in
tools/ar_names.json; interface phrases (steps, times) come from the app's own Arabic strings.
Returns {path: title} for the sitemap.
"""
import json, html, os, re
import seo_pages as P

HERE = P.HERE; ROOT = P.ROOT; SITE = P.SITE; OUT = P.OUT
AN = json.load(open(os.path.join(HERE, 'ar_names.json'), encoding='utf-8'))
_src = open(os.path.join(ROOT, 'src', 'riyadh-metro.html'), encoding='utf-8').read()
_i = _src.index('const I18N=') + 11
A = json.loads(_src[_i:_src.index(';\n', _i)])['ar']
D, ST, PL, CFG, FARE, PASSES, WALKS = P.D, P.ST, P.PL, P.CFG, P.FARE, P.PASSES, P.WALKS
COLORS = P.COLORS
LN = {c: A['lg' + c.capitalize()] for c in COLORS}
NUM = P.LINE_NUM
e = html.escape
PAGES = {}


def plural_cat(n):
    if n == 0: return 'zero'
    if n == 1: return 'one'
    if n == 2: return 'two'
    if 3 <= n % 100 <= 10: return 'few'
    if 11 <= n % 100 <= 99: return 'many'
    return 'other'


def t(key, **kw):
    s = A[key]
    if isinstance(s, dict):
        s = s.get(plural_cat(kw.get('n', 0)), s['other'])
    for k, v in kw.items():
        s = s.replace('{' + k + '}', str(v))
    # a leading "~" is reordered oddly in right-to-left text; say it in words
    return s.replace('~', 'نحو ')


def sn(sid):
    return AN['stations'].get(sid) or ST[sid]['n']


def pn(pid):
    return AN['places'].get(pid) or PL[pid]['n']


def name_of(tok):
    return sn(tok) if tok in ST else pn(tok)


def mins(n):
    return 'دقيقة واحدة' if n == 1 else 'دقيقتان' if n == 2 else ('%d دقائق' % n) if 3 <= n <= 10 else ('%d دقيقة' % n)


def and_join(xs):
    xs = list(xs)
    return xs[0] if len(xs) == 1 else '، '.join(xs[:-1]) + ' و' + xs[-1]


def lines_txt(ls):
    return and_join(LN[l] for l in ls)


# ---------------- pages that exist (same slugs as English, under ar/) ----------------
DEST = {d['slug']: d for d in CFG['destinations']}
DEST_PAGE = {pid: 'ar/' + p for pid, p in P.DEST_PAGE.items()}
STATION_PAGE = {sid: 'ar/' + p for sid, p in P.STATION_PAGE.items()}
DIST_PAGE = {k: 'ar/' + p for k, p in P.DIST_PAGE.items()}
DISTRICTS = P.DISTRICTS


def dn(d):
    """district name without the word حي, for phrases like «لحي الملقا»"""
    return re.sub(r'^حي\s+', '', d['ar'])


def count_st(n):
    return 'محطة مترو واحدة' if n == 1 else 'محطتا مترو' if n == 2 else ('%d محطات مترو' % n) if n <= 10 else ('%d محطة مترو' % n)


def kmt(k):
    return '%.1f كم' % k
PAIR_PAGE = {k: 'ar/' + p for k, p in P.PAIR_PAGE.items()}
LINE_PAGE = {c: 'ar/' + p for c, p in P.LINE_PAGE.items()}


def station_links(sid):
    out = []
    if sid in STATION_PAGE:
        out.append((STATION_PAGE[sid], 'محطة ' + sn(sid)))
    for d in CFG['destinations']:
        if PL[d['main']]['st'] == sid:
            out.append(('ar/destinations/%s/' % d['slug'], d['title_ar']))
    return out


# ---------------- route facts in Arabic ----------------
def direction(leg):
    stops = P.SVC[leg['svc']]['stops']
    i0, i1 = stops.index(leg['stops'][0]), stops.index(leg['stops'][-1])
    return sn(stops[-1] if i1 > i0 else stops[0])


def steps(v, a, b):
    A_, B_ = P.end_of(a), P.end_of(b)
    legs = list(v['legs'])
    lead = legs.pop(0) if legs and legs[0]['type'] == 'walk' else None
    tail = legs.pop() if legs and legs[-1]['type'] == 'walk' else None
    out = []
    if A_['lm']:
        lm = A_['lm']
        if lead:
            out.append((t('goTo', s=sn(lead['to'])), t('onFootFrom', n=lead['t'] + (lm.get('min') or 0), x=pn(lm['id']))))
        else:
            sub = t(lm['note'], s=sn(lm['st'])) if lm.get('note') else t('fromPlace', n=lm['min'], p=pn(lm['id']), w=t(lm['walk'])) if lm.get('min') else t('nearestTo', p=pn(lm['id']))
            out.append((t('goTo', s=sn(A_['st'])), sub))
    elif lead:
        out.append((t('walkTo', s=sn(lead['to'])), t('onFootFrom', n=lead['t'], x=sn(lead['from']))))
    for i, l in enumerate(legs):
        if l['type'] == 'ride':
            n = len(l['stops']) - 1
            first = i == 0 or legs[i - 1]['type'] == 'walk'
            sub = (t('boardAt', s=sn(l['stops'][0])) + ' · ' if first else '') + t('stops', n=n) + ' · ' + t('min', n=round(l['min']))
            out.append((t('take', l=LN[l['line']], d=direction(l)), sub + ' · ' + t('getOff', s=sn(l['stops'][-1]))))
        elif l['type'] == 'xfer':
            nxt = legs[i + 1]
            out.append((t('changeTo', l=LN[nxt['line']]), t('followSigns', l=LN[nxt['line']], s=sn(l['from']), n=l['t'])))
        else:
            w = next(w for w in WALKS if {w['a'], w['b']} == {l['from'], l['to']})
            out.append((t('walkTo', s=sn(l['to'])), t('onFootOut' if w.get('long') else 'onFootSign', n=l['t'])))
    if B_['lm']:
        lm = B_['lm']
        if tail:
            out.append((t('walkToPlace', p=pn(lm['id'])), t('onFootFrom', n=tail['t'] + (lm.get('min') or 0), x=sn(tail['from']))))
        elif lm.get('note'):
            out.append((pn(lm['id']), t(lm['note'], s=sn(lm['st']))))
        else:
            out.append((t('walkToPlace', p=pn(lm['id'])), t('placeWalk', n=lm['min'], w=t(lm['walk'])) if lm.get('min') else t('noWalkData')))
    elif tail:
        out.append((t('walkTo', s=sn(tail['to'])), t('onFootFrom', n=tail['t'], x=sn(tail['from']))))
    return out


def sar(x):
    return '%s ريال' % P.sar(x)


def fare_text(v):
    f = P.fare(v)
    return sar(f['std']) if f['std'] is not None else 'بدون أجرة (سيراً)'


def xf_text(n):
    return t('noChanges') if n == 0 else t('changes', n=n)


def span(v):
    return t('min', n=v['time']) if v['time'] == v['timeMax'] else t('minRange', a=v['time'], b=v['timeMax'])


def summary(v):
    return ' · '.join([span(v), xf_text(v['xf']), t('walking', n=v['walk']) if v['walk'] else t('noWalking'), fare_text(v)])


def chips(v):
    h = []
    for x in P.lines_of(v):
        if x == 'walk':
            h.append('<span class="chip w">سيراً</span>')
        else:
            h.append('<span class="chip" style="--c:%s">%s</span>' % (P.LINE_COLOR[x], e(LN[x])))
    return ' '.join(h)


def plan(a, b, label='افتح هذا المسار على الخريطة', small=False):
    return '<a class="cta%s" href="{ROOT}ar.html#%s~%s~ar">%s</a>' % (' sm' if small else '', a, b, e(label))


def route_card(a, b, heading=None):
    v, _ = P.best(a, b)
    h = ['<div class="card">']
    if heading:
        h.append('<h3>%s</h3>' % e(heading))
    h.append('<p class="sum">%s</p><p>%s</p>' % (e(summary(v)), chips(v)))
    h.append('<ol class="steps">' + ''.join('<li>%s<span class="sub">%s</span></li>' % (e(x), e(y)) for x, y in steps(v, a, b)) + '</ol>')
    h.append(plan(a, b, small=True))
    h.append('</div>')
    return '\n'.join(h)


def routes_table(pairs):
    rows = ['<div class="scroll"><table><tr><th>من</th><th>إلى</th><th>المسارات</th><th>الوقت</th><th>التبديل</th><th>السعر</th><th></th></tr>']
    for a, b in pairs:
        v, _ = P.best(a, b)
        page = PAIR_PAGE.get(a + '~' + b)
        more = ('<a href="{ROOT}%s">خطوة بخطوة</a> · ' % page) if page else ''
        rows.append('<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s<a href="{ROOT}ar.html#%s~%s~ar">الخريطة</a></td></tr>' % (
            e(name_of(a)), e(name_of(b)), chips(v), e(span(v)), e(xf_text(v['xf'])), e(fare_text(v)), more, a, b))
    rows.append('</table></div>')
    return '\n'.join(rows)


# ---------------- hours and fares ----------------
DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']


def hours_html():
    H = D['hours']['metro']
    groups = []
    for d in [6, 0, 1, 2, 3, 4, 5]:   # Saturday first
        oc = tuple(H[d])
        if groups and groups[-1][1] == oc:
            groups[-1][0].append(d)
        else:
            groups.append([[d], oc])
    h = ['<h2 id="hours">مواعيد التشغيل</h2>', '<table class="hrs"><caption>مترو الرياض</caption><tr><th>الأيام</th><th>أول قطار</th><th>الإغلاق</th></tr>']
    for ds, (o, c) in groups:
        days = DAYS[ds[0]] if len(ds) == 1 else '%s–%s' % (DAYS[ds[0]], DAYS[ds[-1]])
        h.append('<tr><td>%s</td><td dir="ltr">%s</td><td dir="ltr">%s</td></tr>' % (days, P.hm(o), P.hm(c) + (' (+1)' if c > 1440 else '')))
    h.append('</table>')
    h.append('<p class="note">%s تتغير المواعيد في رمضان والأعياد.</p>' % e(t('hoursNote')))
    return '\n'.join(h)


def fare_table():
    names = {'t2h': 'تذكرة ساعتين', 't3d': 'تذكرة 3 أيام', 't7d': 'تذكرة 7 أيام', 't30d': 'تذكرة 30 يوماً'}
    h = ['<h2>أسعار التذاكر</h2><table><tr><th>التذكرة</th><th>الدرجة العادية</th><th>الدرجة الأولى</th></tr>']
    for k, a, b in PASSES:
        h.append('<tr><td>%s</td><td>%s</td><td>%s</td></tr>' % (names[k], sar(a), sar(b)))
    h.append('</table><p class="note">تذكرة الساعتين تكفي لعدد غير محدود من الرحلات والتبديلات في المترو وحافلات الرياض. الأطفال دون 6 سنوات مجاناً مع مرافق بالغ.</p>')
    return '\n'.join(h)


def station_facts(sid):
    rows = [('رقم المحطة', '%d (كما في الخريطة الرسمية ولوحات المحطات)' % P.ST_NO[sid])] if sid in P.ST_NO else []
    rows.append(('المسارات', lines_txt(ST[sid]['lines'])))
    if sid in P.ST_TYPE:
        rows.append(('نوع المحطة', P.ST_TYPE[sid][1]))
    rows.append(('مواقف «اركن واركب»', 'نعم، مواقف سيارات لركاب المترو' if sid in P.PARK_RIDE else 'لا'))
    for w in WALKS:
        if sid in (w['a'], w['b']):
            o = w['b'] if w['a'] == sid else w['a']
            rows.append(('ممر مشاة', '%s، نحو %s سيراً' % (sn(o), mins(w['t']))))
    return '<table>' + ''.join('<tr><th>%s</th><td>%s</td></tr>' % (e(k), e(v)) for k, v in rows) + '</table>'


def st_cell(sid):
    links = station_links(sid)
    return ('<a href="{ROOT}%s">%s</a>' % (links[0][0], e(sn(sid)))) if links else e(sn(sid))


# ---------------- page frame ----------------
CSS = P.CSS + 'body{font-family:"Noto Sans Arabic","Segoe UI",Tahoma,system-ui,sans-serif}\nol.steps{padding-inline-start:22px}\n'


_RNG = re.compile(r'(?<![\u2066\d:])(\d+(?::\d+)?–\d+(?::\d+)?)')


def ltr_ranges(x):
    """after Arabic letters a range like 05:30–00:00 would be shown reversed; isolate it left to right"""
    return _RNG.sub('\u2066\\1\u2069', x)


def frame(path, title, desc, body, crumbs, ld_extra=None, og_image='og-image.png'):
    depth = path.count('/')
    root = '../' * depth
    PAGES[path] = title
    url = SITE + path
    en = path[3:]
    crumb_html = ' › '.join(['<a href="%sar.html">خريطة مترو الرياض</a>' % root] + ['<a href="%s%s">%s</a>' % (root, p, e(n)) for p, n in crumbs[:-1]] + [e(crumbs[-1][1])]) if crumbs else ''
    items = [{"@type": "ListItem", "position": 1, "name": "خريطة مترو الرياض", "item": SITE + 'ar.html'}] + \
            [{"@type": "ListItem", "position": i + 2, "name": n, "item": SITE + p} for i, (p, n) in enumerate(crumbs)]
    ld = [{"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items}]
    if ld_extra:
        ld.append(ld_extra)
    body = ltr_ranges(body.replace('{ROOT}', root)); title = ltr_ranges(title); desc = ltr_ranges(desc)
    COUNTER = ('<script data-goatcounter="%s" async src="//gc.zgo.at/count.js"></script>' % P.GOAT) if P.GOAT else ''
    return f'''<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
<link rel="alternate" hreflang="ar" href="{url}">
<link rel="alternate" hreflang="en" href="{SITE}{en}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="article">
<meta property="og:locale" content="ar_SA">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="{SITE}{og_image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F4F7F8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#10161C" media="(prefers-color-scheme: dark)">
<link rel="icon" href="{P.FAV}">
<link rel="apple-touch-icon" href="{root}apple-touch-icon.png">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
{COUNTER}
<style>{CSS}</style>
</head>
<body>
<header class="top"><nav><a class="brand" href="{root}ar.html">خريطة مترو الرياض</a><a href="{root}ar/map/">الخريطة</a><a href="{root}ar/stations/">المحطات</a><a href="{root}ar/districts/">الأحياء</a><a href="{root}ar/timings/">المواعيد والأسعار</a><a href="{root}{en}" hreflang="en" lang="en">English</a></nav></header>
<main>
<div class="crumbs">{crumb_html}</div>
{body}
</main>
<footer>
<p>{e(t('foot'))} {e(t('attrib'))} أوقات الرحلات في هذه الصفحة ليوم عمل في منتصف النهار، مع الانتظار المعتاد للقطار.</p>
<p>خريطة مستقلة غير تجارية، لا علاقة لها بالنقل العام بمدينة الرياض أو الهيئة الملكية لمدينة الرياض. <a href="mailto:callmebackemail@protonmail.com?subject=Riyadh%20Metro%20Map">الإبلاغ عن مشكلة</a> · <a href="{root}ar.html">افتح الخريطة التفاعلية</a></p>
</footer>
</body>
</html>
'''


def write(path, content):
    P.write(path, content)


MAP_IMG = 'riyadh-metro-map-ar.png'   # drawn by tools/render_map.js with MAP_LANG=ar
MAP_ALT = 'خريطة مترو الرياض: المسارات الأزرق والأحمر والبرتقالي والأصفر والأخضر والبنفسجي مع جميع المحطات ومحطات التبديل'


def map_figure():
    return ('<figure style="margin:12px 0"><a href="{ROOT}ar/map/"><img src="{ROOT}%s" width="%d" height="%d" alt="%s" loading="lazy" style="width:100%%;height:auto;border:1px solid var(--rule);border-radius:12px;background:#fff"></a>'
            '<figcaption class="note">الشبكة كاملة على خريطة واحدة. <a href="{ROOT}ar.html">افتح الخريطة التفاعلية</a> واضغط على محطة لتحصل على الطريق.</figcaption></figure>') % (MAP_IMG, P.MAP_W, P.MAP_H, e(MAP_ALT))


# ---------------- destination pages ----------------
def related_dest(slug, n=4):
    me = DEST[slug]; sid = PL[me['main']]['st']
    others = sorted((d for d in CFG['destinations'] if d['slug'] != slug), key=lambda d: P.km(sid, PL[d['main']]['st']))[:n]
    return '<ul class="links">' + ''.join('<li><a href="{ROOT}ar/destinations/%s/">%s</a></li>' % (d['slug'], e(d['title_ar'])) for d in others) + '</ul>'


def destination(d):
    main = PL[d['main']]; sid = main['st']; s = ST[sid]
    path = 'ar/destinations/%s/' % d['slug']
    T = d['title_ar']
    if d.get('lead_ar'):
        lead = d['lead_ar']
    else:
        lead = 'أقرب محطة مترو إلى %s هي محطة %s على %s.' % (pn(d['main']), sn(sid), lines_txt(s['lines']))
        if main.get('min'):
            lead += ' المسافة سيراً نحو %s، %s.' % (mins(main['min']), t(main['walk']))
        if main.get('note'):
            lead += ' ' + t(main['note'], s=sn(sid))
    body = ['<h1>%s بالمترو: أقرب محطة وطريق الوصول</h1>' % e(T), '<p class="lead">%s</p>' % e(lead)]
    o0 = d['origins'][0]
    body.append(plan(*((d['main'], o0) if d.get('reverse') else (o0, d['main'])), 'افتح على الخريطة التفاعلية'))
    body.append('<h2>أقرب محطة ووقت المشي</h2><div class="scroll"><table><tr><th>المكان</th><th>أقرب محطة</th><th>سيراً</th></tr>')
    for pid in [d['main']] + d['also']:
        p = PL[pid]
        if p.get('note'):
            foot = t(p['note'], s=sn(p['st']))
        elif p.get('min'):
            foot = 'نحو %s، %s' % (mins(p['min']), t(p['walk']))
        else:
            foot = 'مسافة قصيرة؛ لا يتوفر وقت موثوق'
        body.append('<tr><td>%s</td><td>%s (%s)</td><td>%s</td></tr>' % (e(pn(pid)), e(sn(p['st'])), e(lines_txt(ST[p['st']]['lines'])), e(foot)))
    body.append('</table></div>')
    body.append('<h2>%s</h2>' % ('طريق الوصول' if not d.get('reverse') else 'من المطار'))
    pairs = [(d['main'], o) for o in d['origins']] if d.get('reverse') else [(o, d['main']) for o in d['origins']]
    body.append(routes_table(pairs))
    first = pairs[0]
    body.append('<h3>خطوة بخطوة: من %s إلى %s</h3>' % (e(name_of(first[0])), e(name_of(first[1]))))
    body.append(route_card(*first))
    body.append('<h2>المحطة</h2><p><b>%s</b></p>' % e(sn(sid)))
    body.append(station_facts(sid))
    links = [x for x in station_links(sid) if x[0] != path]
    body.append('<ul class="links">' + ''.join('<li><a href="{ROOT}%s">%s</a></li>' % (LINE_PAGE[l], e(LN[l])) for l in s['lines']) +
                ''.join('<li><a href="{ROOT}%s">%s</a></li>' % (p, e(n)) for p, n in links) + '</ul>')
    body.append(hours_html())
    body.append('<h2>أماكن قريبة على الخريطة</h2>' + related_dest(d['slug']))
    TT = re.sub(r'\s*\(.*?\)', '', T) if len(T) > 25 else T     # shorter in search results
    walk = ('، %s سيراً' % mins(main['min'])) if main.get('min') and not main.get('note') else ''
    title = 'محطة مترو %s: محطة %s (%s)%s' % (TT, sn(sid), lines_txt(s['lines']), walk)
    if len(title) > 75:     # too long for the search results: the lines are on the page anyway
        title = 'محطة مترو %s: محطة %s%s' % (TT, sn(sid), walk)
    desc = 'أقرب محطة مترو إلى %s هي محطة %s على %s' % (T, sn(sid), lines_txt(s['lines']))
    desc += ('، ثم بالحافلة أو سيارة الأجرة' if main.get('note') else ('، على بُعد نحو %s سيراً' % mins(main['min'])) if main.get('min') else '')
    desc += '. وقت الرحلة من المطار ومناطق أخرى والسعر ومواعيد التشغيل.'
    write(path, frame(path, title, desc, '\n'.join(body), [(path, T)]))


# ---------------- station pages ----------------
def station(cfg):
    sid = cfg['id']; s = ST[sid]
    path = 'ar/stations/%s/' % cfg['slug']
    ls = s['lines']
    if len(ls) > 1:
        lead = 'محطة %s محطة تبديل على %s. يمكنك التبديل بين المسارين داخل المحطة دون الخروج منها.' % (sn(sid), lines_txt(ls))
    else:
        lead = 'محطة %s على %s.' % (sn(sid), lines_txt(ls))
    if sid in P.ST_NO:
        lead += ' رقمها في الخريطة الرسمية %d.' % P.ST_NO[sid]
    if sid in P.PARK_RIDE:
        lead += ' وفي المحطة مواقف «اركن واركب» للسيارات.'
    ds = P.districts_of(sid)
    if ds:
        lead += ' وتخدم %s.' % and_join(d['ar'] for d in ds[:4])
    body = ['<h1>محطة %s، مترو الرياض</h1>' % e(sn(sid)), '<p class="lead">%s</p>' % e(lead), plan(sid, cfg['to'][0], 'خطّط رحلة من هنا')]
    body.append('<h2>معلومات المحطة</h2>' + station_facts(sid))
    body.append('<h2>المحطات المجاورة</h2><ul>')
    seen = set()
    for sv in D['services']:
        if sid not in sv['stops'] or sv['line'] in seen:
            continue
        seen.add(sv['line'])
        st = sv['stops']; i = st.index(sid)
        parts = []
        if i > 0: parts.append('باتجاه %s: %s' % (sn(st[0]), sn(st[i - 1])))
        if i + 1 < len(st): parts.append('باتجاه %s: %s' % (sn(st[-1]), sn(st[i + 1])))
        body.append('<li>%s: %s</li>' % (e(LN[sv['line']]), e(' · '.join(parts))))
    body.append('</ul>')
    near = [p for p in D['places'] if p['st'] == sid]
    if near:
        body.append('<h2>أماكن قرب المحطة</h2><ul class="links">')
        for p in near:
            link = DEST_PAGE.get(p['id'])
            nm = '<a href="{ROOT}%s">%s</a>' % (link, e(pn(p['id']))) if link else e(pn(p['id']))
            body.append('<li>%s%s</li>' % (nm, ('، نحو %s سيراً' % mins(p['min'])) if p.get('min') else ''))
        body.append('</ul>')
    if ds:
        body.append('<h2>الأحياء التي تخدمها المحطة</h2><ul class="links">' + ''.join('<li><a href="{ROOT}%s">%s</a></li>' % (DIST_PAGE[d['slug']], e(d['ar'])) for d in ds) + '</ul>')
    body.append('<h2>رحلات من محطة %s</h2>' % e(sn(sid)))
    body.append(routes_table([(sid, x) for x in cfg['to']]))
    body.append(hours_html())
    body.append('<ul class="links">' + ''.join('<li><a href="{ROOT}%s">%s</a></li>' % (LINE_PAGE[l], e(LN[l])) for l in ls) + '<li><a href="{ROOT}ar/stations/">جميع المحطات</a></li></ul>')
    title = 'محطة %s، مترو الرياض: %s%s' % (sn(sid), lines_txt(ls), (' (رقم %d)' % P.ST_NO[sid]) if sid in P.ST_NO else '')
    write(path, frame(path, title, lead.split('. ')[0] + '. المسارات والرحلات والمواعيد.', '\n'.join(body), [('ar/stations/', 'المحطات'), (path, sn(sid))],
                      {"@context": "https://schema.org", "@type": "SubwayStation", "name": sn(sid), "alternateName": s['n'],
                       "geo": {"@type": "GeoCoordinates", "latitude": D['geo'][sid][0], "longitude": D['geo'][sid][1]}} if sid in D['geo'] else None))


# ---------------- route pages ----------------
def route_page(r):
    path = 'ar/routes/%s/' % r['slug']
    a, b = r['pairs'][0]
    v, _ = P.best(a, b)
    uses = ' ثم '.join(LN[l] if l != 'walk' else 'مسافة قصيرة سيراً' for l in P.lines_of(v))
    lead = 'من %s اركب %s إلى %s: نحو %s من الباب إلى الباب مع %s، وتذكرة الساعتين بسعر %s.' % (
        name_of(a), uses, name_of(b), t('minRange', a=v['time'], b=v['timeMax']).replace('نحو ', ''), xf_text(v['xf']), sar(P.fare(v)['std']))
    body = ['<h1>%s</h1>' % e(r['title_ar']), '<p class="lead">%s</p>' % e(lead), plan(a, b)]
    for x, y in r['pairs']:
        body.append(route_card(x, y, 'من %s إلى %s' % (name_of(x), name_of(y))))
    body.append(fare_table())
    x, y = r['return']
    body.append('<h2>رحلة العودة</h2>')
    body.append(route_card(x, y, 'من %s إلى %s' % (name_of(x), name_of(y))))
    body.append(hours_html())
    ends = []
    for pr in r['pairs']:
        for tok in pr:
            pg = DEST_PAGE.get(tok)
            if pg and pg not in ends:
                ends.append(pg)
    title_of = {'ar/destinations/%s/' % d['slug']: d['title_ar'] for d in CFG['destinations']}
    body.append('<h2>المزيد عن هذه الأماكن</h2><ul class="links">' + ''.join('<li><a href="{ROOT}%s">%s بالمترو</a></li>' % (p, e(title_of[p])) for p in ends) + '</ul>')
    write(path, frame(path, '%s: الوقت والسعر والخطوات' % r['title_ar'], lead, '\n'.join(body), [(path, r['title_ar'])]))


# ---------------- district pages (أقرب محطة مترو لحي ...) ----------------
def district(d):
    path = DIST_PAGE[d['slug']]
    sid = P.district_station(d); k0 = P.dist_km(d, sid)
    if d['inside']:
        n = len(d['inside'])
        lead = 'في %s %s: %s.' % (d['ar'], count_st(n), '؛ '.join('%s (%s)' % (sn(x), lines_txt(ST[x]['lines'])) for x in d['inside']))
        lead += (' أقربها إلى وسط الحي محطة %s، على بُعد نحو %s.' % (sn(sid), kmt(k0))) if n > 1 else (' وتبعد عن وسط الحي نحو %s.' % kmt(k0))
    else:
        lead = 'لا توجد محطة مترو داخل %s. أقرب محطة إلى وسط الحي هي محطة %s على %s، على بُعد نحو %s في خط مستقيم.' % (d['ar'], sn(sid), lines_txt(ST[sid]['lines']), kmt(k0))
    if k0 <= 1.5:
        lead += ' أي نحو %s سيراً تقريباً.' % mins(P.walk_min(k0))
    pr = P.nearest_park_ride(d)
    if pr != sid or sid not in P.PARK_RIDE:
        lead += ' وأقرب محطة فيها مواقف «اركن واركب» هي محطة %s، على بُعد نحو %s.' % (sn(pr), kmt(P.dist_km(d, pr)))
    else:
        lead += ' وفي المحطة مواقف «اركن واركب» للسيارات.'
    cfg = next(x for x in P.STATIONS if x['id'] == sid)
    body = ['<h1>أقرب محطة مترو ل%s في الرياض</h1>' % e(d['ar']), '<p class="lead">%s</p>' % e(lead), plan(sid, cfg['to'][0], 'خطّط رحلة من محطة %s' % sn(sid))]
    rows = [(x, P.dist_km(d, x)) for x in d['inside']] + [(x, k) for x, k in d['near'] if x not in d['inside']]
    rows = sorted(rows, key=lambda r: r[1])[:5]
    body.append('<h2>محطات المترو ل%s</h2><div class="scroll"><table><tr><th>المحطة</th><th>المسارات</th><th>البعد عن وسط الحي</th></tr>' % e(d['ar']))
    for x, k in rows:
        where = 'داخل الحي، ' if x in d['inside'] else ''
        foot = '، نحو %s سيراً' % mins(P.walk_min(k)) if k <= 1.5 else ''
        body.append('<tr><td><a href="{ROOT}%s">%s</a>%s</td><td>%s</td><td>%s%s%s</td></tr>' % (
            STATION_PAGE[x], e(sn(x)), ' <span class="note">مواقف</span>' if x in P.PARK_RIDE else '', e(lines_txt(ST[x]['lines'])), where, kmt(k), foot))
    body.append('</table></div>')
    body.append('<p class="note">المسافات في خط مستقيم من وسط الحي، والمشي في الشوارع أطول. «مواقف»: مواقف «اركن واركب» للسيارات.</p>')
    body.append('<h2>من محطة %s بالمترو</h2>' % e(sn(sid)))
    body.append(routes_table([(sid, x) for x in cfg['to']]))
    body.append('<h2>أحياء قريبة</h2><ul class="links">' + ''.join('<li><a href="{ROOT}%s">%s</a></li>' % (DIST_PAGE[o['slug']], e(o['ar'])) for o in P.near_districts(d)) +
                '<li><a href="{ROOT}ar/districts/">جميع الأحياء</a></li></ul>')
    body.append(hours_html())
    title = 'أقرب محطة مترو ل%s في الرياض: محطة %s%s' % (d['ar'], sn(sid), ' (داخل الحي)' if d['inside'] else '، %s' % kmt(k0))
    desc = '. '.join(lead.split('. ')[:2]).rstrip('.') + '. المسافة ومواقف السيارات ووقت الرحلة بالمترو.'
    ld = {"@context": "https://schema.org", "@type": "Place", "name": d['ar'] + '، الرياض', "alternateName": d['en'],
          "geo": {"@type": "GeoCoordinates", "latitude": d['mid'][0], "longitude": d['mid'][1]}}
    write(path, frame(path, title, desc, '\n'.join(body), [('ar/districts/', 'الأحياء'), (path, d['ar'])], ld))


def districts_list():
    path = 'ar/districts/'
    lead = 'اعرف أقرب محطة مترو لحيّك في الرياض: %d حياً قرب مسارات المترو الستة، مع المحطات داخل كل حي أو أقرب محطة إليه وبُعدها.' % len(DISTRICTS)
    body = ['<h1>أحياء الرياض وأقرب محطات المترو</h1>', '<p class="lead">%s</p>' % e(lead)]
    body.append('<div class="scroll"><table><tr><th>الحي</th><th>أقرب محطة</th><th>المسافة</th></tr>')
    for d in sorted(DISTRICTS, key=dn):
        sid = P.district_station(d)
        body.append('<tr><td><a href="{ROOT}%s">%s</a></td><td>%s</td><td>%s</td></tr>' % (
            DIST_PAGE[d['slug']], e(d['ar']), e(sn(sid)), 'داخل الحي' if d['inside'] else kmt(P.dist_km(d, sid))))
    body.append('</table></div>')
    body.append('<p class="note">حدود الأحياء: العنوان الوطني. المسافات في خط مستقيم من وسط الحي.</p>')
    write(path, frame(path, 'أقرب محطة مترو لكل أحياء الرياض', lead, '\n'.join(body), [(path, 'الأحياء')]))


# ---------------- lines, stations list, timings, map ----------------
def line_pages():
    for v in D['services']:
        c = v['line']; ids = v['stops']; n = NUM[c]
        path = LINE_PAGE[c]
        xs = [x for x in ids if len(ST[x]['lines']) > 1]
        lead = '%s (المسار %d) يمتد من %s إلى %s ويضم %s. محطات التبديل: %s.' % (
            LN[c], n, sn(ids[0]), sn(ids[-1]), t('stops', n=len(ids)),
            '؛ '.join('%s (%s)' % (sn(x), lines_txt([l for l in ST[x]['lines'] if l != c])) for x in xs))
        if c in ('yellow', 'purple'):
            lead += ' ويشترك مع %s في المحطات الأربع من المركز المالي إلى سابك.' % LN['purple' if c == 'yellow' else 'yellow']
        body = ['<h1>%s (المسار %d) في مترو الرياض: المحطات والمواعيد</h1>' % (e(LN[c]), n), '<p class="lead">%s</p>' % e(lead),
                plan(ids[0], ids[-1], 'خطّط رحلة على هذا المسار')]
        body.append('<h2>المحطات</h2><div class="scroll"><table><tr><th>#</th><th>المحطة</th><th>التبديل</th></tr>')
        for i, sid in enumerate(ids, 1):
            other = [l for l in ST[sid]['lines'] if l != c]
            body.append('<tr><td>%d</td><td>%s</td><td>%s</td></tr>' % (i, st_cell(sid), e(lines_txt(other)) if other else ''))
        body.append('</table></div>')
        body.append(hours_html())
        body.append(fare_table())
        body.append('<h2>المسارات الأخرى</h2><ul class="links">' + ''.join('<li><a href="{ROOT}%s">%s (المسار %d)</a></li>' % (LINE_PAGE[o], e(LN[o]), NUM[o]) for o in COLORS if o != c) + '</ul>')
        write(path, frame(path, '%s مترو الرياض (المسار %d): المحطات والخريطة والمواعيد' % (LN[c], n), lead, '\n'.join(body), [(path, LN[c])]))


def stations_list():
    path = 'ar/stations/'
    ids = sorted(ST, key=lambda i: sn(i))
    lead = 'جميع محطات المسارات الستة لمترو الرياض (%d محطة) مع المسارات ومحطات التبديل.' % len(ids)
    body = ['<h1>محطات مترو الرياض: القائمة الكاملة</h1>', '<p class="lead">%s</p>' % e(lead), map_figure()]
    body.append('<h2>محطات التبديل</h2><ul>')
    for i in sorted((i for i in ids if len(ST[i]['lines']) > 1), key=sn):
        body.append('<li>%s: %s</li>' % (st_cell(i), e(lines_txt(ST[i]['lines']))))
    body.append('</ul>')
    body.append('<h2>جميع المحطات أبجدياً</h2><div class="scroll"><table><tr><th>المحطة</th><th>المسارات</th></tr>')
    for i in ids:
        body.append('<tr><td>%s</td><td>%s</td></tr>' % (st_cell(i), e(lines_txt(ST[i]['lines']))))
    body.append('</table></div>')
    body.append('<ul class="links">' + ''.join('<li><a href="{ROOT}%s">%s (المسار %d)</a></li>' % (LINE_PAGE[l], e(LN[l]), NUM[l]) for l in COLORS) + '</ul>')
    write(path, frame(path, 'محطات مترو الرياض: القائمة الكاملة للمسارات الستة', lead, '\n'.join(body), [(path, 'المحطات')]))


def timings_page():
    path = 'ar/timings/'
    H = D['hours']['metro']
    lead = 'يعمل مترو الرياض من السبت إلى الخميس %s–%s ويوم الجمعة %s–%s. تذكرة الساعتين بسعر %s (الدرجة الأولى %s) مع عدد غير محدود من الرحلات والتبديلات.' % (
        P.hm(H[0][0]), P.hm(H[0][1]), P.hm(H[5][0]), P.hm(H[5][1]), sar(FARE['std']), sar(FARE['first']))
    body = ['<h1>مواعيد مترو الرياض وأسعار التذاكر</h1>', '<p class="lead">%s</p>' % e(lead),
            plan(P.pid_of('King Khalid Airport Terminals 1-2'), P.pid_of('Kingdom Centre'), 'خطّط رحلة')]
    body.append(hours_html())
    body.append('<p>تمر القطارات كل 3–5 دقائق تقريباً في أوقات الذروة، وكل 5–10 دقائق في بقية اليوم، ونحو كل 10 دقائق في آخر المساء.</p>')
    body.append(fare_table())
    body.append('<p>الدفع ببطاقة درب أو تطبيق درب أو البطاقة البنكية اللاتلامسية. في القطارات درجة أولى وقسم للعائلات وقسم للأفراد.</p>')
    H = D['hours']['metro']; groups = []
    for d in [6, 0, 1, 2, 3, 4, 5]:   # Saturday first
        if groups and groups[-1][1] == tuple(H[d]):
            groups[-1][0].append(d)
        else:
            groups.append([[d], tuple(H[d])])
    hm = lambda m: '%02d:%02d' % (m // 60 % 24, m % 60)
    title = 'مواعيد مترو الرياض اليوم: %s' % '، '.join('%s %s–%s' % (DAYS[g[0]] if len(g) == 1 else DAYS[g[0]] + '–' + DAYS[g[-1]], hm(o), hm(c)) for g, (o, c) in groups)
    write(path, frame(path, title, lead, '\n'.join(body), [(path, 'المواعيد والأسعار')]))


def map_page():
    path = 'ar/map/'
    xs = sorted({sid for sid in ST if len(ST[sid]['lines']) > 1}, key=sn)
    lead = 'خريطة تخطيطية للمسارات الستة لمترو الرياض: %s. %d محطة في المجموع مع جميع محطات التبديل.' % (
        '، '.join('%s (%s)' % (LN[v['line']], t('stops', n=len(v['stops']))) for v in D['services']), len(ST))
    body = ['<h1>خريطة مترو الرياض 2026: جميع المسارات والمحطات</h1>', '<p class="lead">%s</p>' % e(lead),
            '<a class="cta" href="{ROOT}ar.html">افتح الخريطة التفاعلية</a>',
            '<figure style="margin:12px 0"><img src="{ROOT}%s" width="%d" height="%d" alt="%s" style="width:100%%;height:auto;border:1px solid var(--rule);border-radius:12px;background:#fff"><figcaption class="note">%s</figcaption></figure>' % (
                MAP_IMG, P.MAP_W, P.MAP_H, e(MAP_ALT), 'خريطة تخطيطية بغير مقياس رسم، وأسماء المحطات كما في 2026. خريطة غير رسمية لا علاقة لها بالنقل العام بمدينة الرياض.'),
            '<h2>كيف تقرأ الخريطة</h2><ul>']
    for v in D['services']:
        body.append('<li><b>%s (المسار %d)</b>: من %s إلى %s. <a href="{ROOT}%s">المحطات</a></li>' % (e(LN[v['line']]), NUM[v['line']], e(sn(v['stops'][0])), e(sn(v['stops'][-1])), LINE_PAGE[v['line']]))
    body.append('<li><b>محطات التبديل</b>: %s.</li>' % e('، '.join(sn(x) for x in xs)))
    body.append('<li>يشترك المساران الأصفر والبنفسجي في المسار وفي المحطات الأربع من المركز المالي إلى سابك، ويظهران على الخريطة متجاورين هناك.</li></ul>')
    body.append('<p><a href="{ROOT}ar/stations/">جميع المحطات</a> · <a href="{ROOT}ar/timings/">المواعيد والأسعار</a></p>')
    ld = {"@context": "https://schema.org", "@type": "ImageObject", "contentUrl": SITE + MAP_IMG, "name": "خريطة مترو الرياض",
          "description": MAP_ALT, "width": P.MAP_W, "height": P.MAP_H, "encodingFormat": "image/png", "inLanguage": "ar"}
    write(path, frame(path, 'خريطة مترو الرياض 2026: جميع المسارات والمحطات (صورة وخريطة تفاعلية)', lead, '\n'.join(body), [(path, 'الخريطة')], ld, og_image=MAP_IMG))


def build():
    PAGES.clear()
    map_page()
    stations_list()
    timings_page()
    line_pages()
    for d in CFG['destinations']:
        destination(d)
    for s in P.STATIONS:
        station(s)
    for r in CFG['routes']:
        route_page(r)
    districts_list()
    for d in DISTRICTS:
        district(d)
    return dict(PAGES)


if __name__ == '__main__':
    print('arabic guide pages:', len(build()))
