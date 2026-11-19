#!/usr/bin/env python3
"""Build index.html (the whole game in one file) from src/.

  src/shell.html   page skeleton with /*@STYLE@*/ and //@SCRIPT@ placeholders
  src/style.css    all styles
  src/camp/*.js    the KenaiCamp winter-camping engine (one global namespace, no access to the game), concatenated in file-name order
                   FIRST, so the game files that follow can use KenaiCamp. See src/camp/README.md.
  src/home/*.js    the CabinUpkeep home-maintenance module (one global namespace, no access to the game), concatenated next, also
                   before the game files. See src/home/README.md.
  src/tender/*.js  the Tender fish-buying and processing module (one global namespace, no access to the game), after the other
                   modules and before the game files. See src/tender/README.md.
  src/js/*.js      the game code, concatenated in file-name order
  art/manifest.json  the illustrations' manifest (tools/art.py writes it): its ENABLED entries are embedded in src/js/40-art.js
                   between /*@ART@*/ and /*@/ART@*/. The images themselves stay separate files under art/ (never inlined here).

It also keeps sw.js in step with GAME.id and GAME.version (src/js/00-game.js),
so each release gets a fresh offline cache.

Usage:  python3 tools/build.py          write index.html (and update sw.js)
        python3 tools/build.py --check  fail if index.html or sw.js is out of date with src/
"""
import glob, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def read(p): return open(os.path.join(ROOT, p), encoding='utf-8').read()

def game_field(name):
    m = re.search(name + r"\s*:\s*'([^']*)'", read('src/js/00-game.js'))
    if not m: sys.exit(f'GAME.{name} not found in src/js/00-game.js')
    return m.group(1)

ART_RE = re.compile(r'/\*@ART@\*/.*?/\*@/ART@\*/', re.S)
ART_FIELDS = ('id', 'set', 'file', 'fw', 'thumb', 'webp', 'thumbWebp', 'v', 'w', 'h', 'alt', 'when', 'enabled', 'focus', 'bg')

def art_entries():
    """The enabled entries of art/manifest.json, trimmed to what the game reads (a missing manifest is an empty one)."""
    p = os.path.join(ROOT, 'art', 'manifest.json')
    if not os.path.exists(p): return []
    import json
    data = json.load(open(p, encoding='utf-8'))
    if not isinstance(data, list): sys.exit('art/manifest.json must be a JSON array (see art/README.md)')
    return [{k: e[k] for k in ART_FIELDS if k in e} for e in data if isinstance(e, dict) and e.get('enabled') is True]

def art_js(entries):
    import json
    return '/*@ART@*/' + json.dumps(entries, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + '/*@/ART@*/'

def build():
    shell = read('src/shell.html')
    css = read('src/style.css').rstrip('\n')
    # the camping engine goes first: it is self-contained, and the game adapter (src/js/28-camping.js) calls it
    # the home-upkeep module goes second for the same reason (src/js/32-home.js is its adapter)
    files = [f for d in ('camp', 'home', 'tender', 'js') for f in sorted(glob.glob(os.path.join(ROOT, 'src', d, '*.js')))]
    js = '\n'.join(read(os.path.relpath(f, ROOT)).rstrip('\n') for f in files)
    assert len(ART_RE.findall(js)) == 1, 'the /*@ART@*/ manifest markers are missing in src/js/40-art.js'
    js = ART_RE.sub(lambda m: art_js(art_entries()), js)
    assert shell.count('/*@STYLE@*/') == 1 and shell.count('//@SCRIPT@') == 1, 'placeholders missing in src/shell.html'
    return shell.replace('/*@STYLE@*/', css).replace('//@SCRIPT@', js), len(files)

def stamp_sw():
    gid, ver = game_field('id'), game_field('version')
    sw = read('sw.js')
    sw = re.sub(r"const CACHE_PREFIX = '[^']*';", f"const CACHE_PREFIX = '{gid}-';", sw)
    sw = re.sub(r"const VERSION = CACHE_PREFIX \+ '[^']*';", f"const VERSION = CACHE_PREFIX + '{ver}';", sw)
    return sw

if __name__ == '__main__':
    out, n = build(); sw = stamp_sw()
    target = os.path.join(ROOT, 'index.html')
    if '--check' in sys.argv:
        cur = open(target, encoding='utf-8').read() if os.path.exists(target) else ''
        bad = [f for f, a, b in (('index.html', cur, out), ('sw.js', read('sw.js'), sw)) if a != b]
        if bad: print(', '.join(bad) + ' out of date with src/. Run: python3 tools/build.py'); sys.exit(1)
        print('index.html and sw.js match src/'); sys.exit(0)
    # catch syntax errors before writing anything (needs Node.js; skipped if it isn't installed)
    if shutil.which('node'):
        js = out[out.index('<script>') + 8: out.rindex('</script>')]
        r = subprocess.run(['node', '-e', 'new Function(require("fs").readFileSync(0,"utf8"))'], input=js, text=True, capture_output=True)
        if r.returncode:
            print('Syntax error in the built game code, index.html not written:')
            print(r.stderr.strip().splitlines()[-1] if r.stderr.strip() else r.stderr); sys.exit(1)
    open(target, 'w', encoding='utf-8').write(out)
    open(os.path.join(ROOT, 'sw.js'), 'w', encoding='utf-8').write(sw)
    print(f'wrote index.html ({len(out.encode()) // 1024} KB) from {n} modules; sw.js cache {game_field("id")}-{game_field("version")}')
