#!/usr/bin/env python3
"""Build index.html (the whole game in one file) from src/.

  src/shell.html   page skeleton with /*@STYLE@*/ and //@SCRIPT@ placeholders
  src/style.css    all styles
  src/camp/*.js    the KenaiCamp winter-camping engine (one global namespace, no access to the game), concatenated in file-name order
                   FIRST, so the game files that follow can use KenaiCamp. See src/camp/README.md.
  src/js/*.js      the game code, concatenated in file-name order

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

def build():
    shell = read('src/shell.html')
    css = read('src/style.css').rstrip('\n')
    # the camping engine goes first: it is self-contained, and the game adapter (src/js/28-camping.js) calls it
    files = sorted(glob.glob(os.path.join(ROOT, 'src', 'camp', '*.js'))) + sorted(glob.glob(os.path.join(ROOT, 'src', 'js', '*.js')))
    js = '\n'.join(read(os.path.relpath(f, ROOT)).rstrip('\n') for f in files)
    assert shell.count('/*@STYLE@*/') == 1 and shell.count('//@SCRIPT@') == 1, 'placeholders missing in src/shell.html'
    return shell.replace('/*@STYLE@*/', css).replace('//@SCRIPT@', js), len(files)

def stamp_sw():
    gid, ver = game_field('id'), game_field('version')
    sw = read('sw.js')
    sw = re.sub(r"const PREFIX = '[^']*';", f"const PREFIX = '{gid}-';", sw)
    sw = re.sub(r"const VERSION = PREFIX \+ '[^']*';", f"const VERSION = PREFIX + '{ver}';", sw)
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
