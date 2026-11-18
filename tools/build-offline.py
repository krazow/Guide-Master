#!/usr/bin/env python3
"""Build offline/<id>-offline.html: the whole game in ONE file that runs by
double-clicking it, with no server and no internet (handy for sharing by email
or USB). Run tools/build.py first.

Usage:  python3 tools/build-offline.py              the game without illustrations (the default: art/ images are separate files)
        python3 tools/build-offline.py --with-art   inline the ENABLED illustrations (art/manifest.json) as data: URIs
"""
import base64, json, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text(encoding="utf-8")
gid = re.search(r"id\s*:\s*'([^']*)'", (root / "src/js/00-game.js").read_text(encoding="utf-8")).group(1)

def data_uri(path, mime):
    return f"data:{mime};base64," + base64.b64encode((root / path).read_bytes()).decode()

# Inline the heading font.
html = html.replace('url("fonts/fraunces-latin-600-normal.woff2")',
                    'url("' + data_uri("fonts/fraunces-latin-600-normal.woff2", "font/woff2") + '")')
# App-install bits only work when hosted; drop them and inline the favicon.
html = re.sub(r'\s*<link rel="manifest"[^>]*>', '', html)
html = re.sub(r'\s*<link rel="apple-touch-icon"[^>]*>', '', html)
html = html.replace('href="icons/favicon-32.png"', 'href="' + data_uri("icons/favicon-32.png", "image/png") + '"')
# No service worker in the single-file build.
html = html.replace("if('serviceWorker' in navigator&&", "if(false&&")

# Illustrations (src/js/40-art.js): the images live in art/ next to index.html, which a single file can't reach. By default the
# embedded manifest is emptied, so the offline game shows its drawn scenes exactly as with art off; --with-art inlines them instead.
ART_RE = re.compile(r'/\*@ART@\*/.*?/\*@/ART@\*/', re.S)
assert len(ART_RE.findall(html)) == 1, 'art manifest markers missing: run tools/build.py first'
def inline_art(m):
    if '--with-art' not in sys.argv: return '/*@ART@*/[]/*@/ART@*/'
    entries = json.loads(m.group(0)[len('/*@ART@*/'):-len('/*@/ART@*/')].replace('<\\/', '</'))
    out = []
    for e in entries:
        f = e.get('webp') or e['file']
        mime = 'image/webp' if f.endswith('.webp') else 'image/png' if f.endswith('.png') else 'image/jpeg'
        x = {k: v for k, v in e.items() if k not in ('thumb', 'webp', 'thumbWebp', 'v')}
        x['file'] = data_uri('art/' + f, mime)
        out.append(x)
    return '/*@ART@*/' + json.dumps(out, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + '/*@/ART@*/'
html = ART_RE.sub(inline_art, html)

for leftover in ('fonts/', 'icons/', 'manifest.webmanifest'):
    assert leftover not in html, leftover

out = root / "offline" / f"{gid}-offline.html"
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding="utf-8")
print(f"wrote {out.relative_to(root)} ({out.stat().st_size // 1024} KB)")
