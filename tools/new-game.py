#!/usr/bin/env python3
"""Turn this template into your own game: renames it everywhere, re-colors it,
makes placeholder icons and rebuilds.

Usage:
  python3 tools/new-game.py --id ferrytown --title "Ferry Town" \
      --tagline "A week on the water" --description "Make the boat, every day." \
      --color "#12313b" --initials FT

  --id           storage-key + cache prefix: lowercase letters, digits, hyphens
  --title        the name players see (title screen, home-screen icon, browser tab)
  --tagline      line under the title
  --description  store / search description (manifest + <meta>)
  --color        main dark color: HUD, title screen, app theme color
  --initials     1–2 letters for the placeholder icon (default: from the title)
Only the options you pass are changed. Then edit src/js/20-world.js and 21-story.js.
"""
import argparse, json, pathlib, re, subprocess, sys

root = pathlib.Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
for o in ('id', 'title', 'tagline', 'description', 'color', 'initials'): ap.add_argument('--' + o)
a = ap.parse_args()
if not any(vars(a).values()): ap.print_help(); sys.exit(1)
if a.id and not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,30}', a.id): sys.exit('--id: lowercase letters, digits and hyphens, 2–31 characters')
if a.color and not re.fullmatch(r'#[0-9a-fA-F]{6}', a.color): sys.exit('--color: a hex color like #12313b')

def edit(rel, fn):
    p = root / rel; s = p.read_text(encoding='utf-8'); n = fn(s)
    if n != s: p.write_text(n, encoding='utf-8'); print('updated', rel)

def js_str(v): return v.replace('\\', '\\\\').replace("'", "\\'")
def html(v): return v.replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;')

def game(s):
    if a.id:
        s = re.sub(r"(\n  id:)'[^']*'", lambda m: m.group(1) + f"'{a.id}'", s, count=1)
        s = re.sub(r"(codePrefix:)'[^']*'", lambda m: m.group(1) + f"'{re.sub('[^A-Z0-9]', '', a.id.upper())}'", s, count=1)
    if a.title: s = re.sub(r"(\n  title:)'[^']*'", lambda m: m.group(1) + f"'{js_str(a.title)}'", s, count=1)
    if a.tagline: s = re.sub(r"(tagline:)'[^']*'", lambda m: m.group(1) + f"'{js_str(a.tagline)}'", s, count=1)
    return s
edit('src/js/00-game.js', game)

def shell(s):
    if a.title:
        s = re.sub(r'<title>[^<]*</title>', f'<title>{html(a.title)}</title>', s)
        s = re.sub(r'(name="apple-mobile-web-app-title" content=")[^"]*', lambda m: m.group(1) + html(a.title), s)
    if a.description: s = re.sub(r'(name="description" content=")[^"]*', lambda m: m.group(1) + html(a.description), s)
    if a.color: s = re.sub(r'(name="theme-color" content=")[^"]*', lambda m: m.group(1) + a.color, s)
    return s
edit('src/shell.html', shell)

def manifest(s):
    m = json.loads(s)
    if a.title: m['name'] = a.title; m['short_name'] = a.title if len(a.title) <= 12 else a.title.split()[0][:12]
    if a.description: m['description'] = a.description
    if a.color: m['background_color'] = m['theme_color'] = a.color
    return json.dumps(m, indent=2, ensure_ascii=False) + '\n'
edit('manifest.webmanifest', manifest)

if a.color: edit('src/style.css', lambda s: re.sub(r'--brand-dark:#[0-9a-fA-F]{6}', f'--brand-dark:{a.color}', s, count=1))
if a.id: edit('package.json', lambda s: re.sub(r'"name": "[^"]*"', f'"name": "{a.id}"', s, count=1))

if a.title or a.color or a.initials:
    title = a.title or re.search(r"\n  title:'([^']*)'", (root / 'src/js/00-game.js').read_text()).group(1)
    initials = a.initials or ''.join(w[0] for w in re.findall(r'[A-Za-z0-9]+', title)[:2]).upper() or 'G'
    color = a.color or re.search(r'--brand-dark:(#[0-9a-fA-F]{6})', (root / 'src/style.css').read_text()).group(1)
    r = subprocess.run([sys.executable, str(root / 'tools/make-icons.py'), '--text', initials, '--bg', color])
    if r.returncode: print('(icons not regenerated; install Pillow and run tools/make-icons.py)')

subprocess.run([sys.executable, str(root / 'tools/build.py')], check=True)
print('\nDone. Next: edit src/js/20-world.js and src/js/21-story.js, then python3 tools/build.py')
