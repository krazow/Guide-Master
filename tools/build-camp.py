#!/usr/bin/env python3
"""Build dist-camp/kenai-camp.html: a dev-only standalone page that runs the KenaiCamp engine in solo mode.

It proves the engine separates cleanly from Guide Master: the page contains src/camp/*.js and a tiny host
(src/camp/standalone.html) and nothing from src/js. dist-camp/ is git-ignored; the page is not linked from the game,
not deployed and not in sw.js.

Usage:  python3 tools/build-camp.py
"""
import glob, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def read(p): return open(os.path.join(ROOT, p), encoding='utf-8').read()

shell = read('src/camp/standalone.html')
files = sorted(glob.glob(os.path.join(ROOT, 'src', 'camp', '*.js')))
js = '\n'.join(read(os.path.relpath(f, ROOT)).rstrip('\n') for f in files)
assert shell.count('/*@CAMP@*/') == 1, 'placeholder missing in src/camp/standalone.html'
out = shell.replace('/*@CAMP@*/', js)
os.makedirs(os.path.join(ROOT, 'dist-camp'), exist_ok=True)
target = os.path.join(ROOT, 'dist-camp', 'kenai-camp.html')
open(target, 'w', encoding='utf-8').write(out)
print(f'wrote dist-camp/kenai-camp.html ({len(out.encode()) // 1024} KB) from {len(files)} engine files')
