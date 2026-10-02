"""Tell IndexNow (Bing, Yandex, Seznam, Naver and others) which pages changed, so they are crawled soon.
Google does not use IndexNow; it reads sitemap.xml.

  python3 tools/indexnow.py --all                 every URL in sitemap.xml
  python3 tools/indexnow.py --changed <git range> pages changed in that range, e.g. HEAD~1..HEAD

The key is the file <key>.txt in the site root; IndexNow checks it to confirm the request comes from the owner."""
import glob, json, os, re, subprocess, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITEMAP = open(os.path.join(ROOT, 'sitemap.xml'), encoding='utf-8').read()
ALL = re.findall(r'<loc>([^<]+)</loc>', SITEMAP)
SITE = re.match(r'(https?://[^/]+/(?:[^/]+/)?)', ALL[0]).group(1) if ALL else ''
KEYS = [os.path.basename(p)[:-4] for p in glob.glob(os.path.join(ROOT, '*.txt')) if re.fullmatch(r'[0-9a-f]{32}', os.path.basename(p)[:-4])]


def changed(rng):
    files = subprocess.run(['git', 'diff', '--name-only', rng], cwd=ROOT, capture_output=True, text=True, check=True).stdout.split()
    urls = set()
    for f in files:
        if not f.endswith('.html') or f.startswith(('src/', 'tools/')):
            continue
        u = SITE + (f[:-len('index.html')] if f.endswith('index.html') else f)
        if u in ALL:
            urls.add(u)
    return sorted(urls)


def send(urls):
    if not urls:
        print('nothing to send'); return
    if not KEYS:
        sys.exit('no key file')
    host = re.match(r'https?://([^/]+)', SITE).group(1)
    body = {'host': host, 'key': KEYS[0], 'keyLocation': SITE + KEYS[0] + '.txt', 'urlList': urls}
    req = urllib.request.Request('https://api.indexnow.org/indexnow', data=json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json; charset=utf-8'})
    with urllib.request.urlopen(req, timeout=30) as r:
        print('IndexNow', r.status, len(urls), 'URLs')   # 200 or 202 = accepted


if __name__ == '__main__':
    if sys.argv[1:2] == ['--all']:
        send(ALL)
    elif sys.argv[1:2] == ['--changed']:
        send(changed(sys.argv[2]))
    else:
        sys.exit(__doc__)
