#!/usr/bin/env python3
"""Illustrations for the game (src/js/40-art.js): import a drawn set, review it, switch it on, check it.

The images live in art/<set>/ as separate files; art/manifest.json lists them. Every imported entry starts DISABLED, and the game
only embeds enabled entries (tools/build.py), so importing changes nothing a player sees until you enable it. See art/README.md.

Usage:
  python3 tools/art.py import /tmp/art/cabin            copy a set's PNGs + thumbs into art/cabin/, make WebP copies if Pillow
                                                        (or cwebp) is installed, merge the entries into art/manifest.json (disabled)
          [--set NAME] [--enable] [--no-webp] [--quality 80]
  python3 tools/art.py enable  cabin-03 | cabin ...     switch entries (ids) or whole sets on
  python3 tools/art.py disable cabin-03 | cabin ...     ... or off
  python3 tools/art.py remove  cabin-03 | cabin ...     drop entries from the manifest (and their files from art/)
  python3 tools/art.py list                             one line per entry
  python3 tools/art.py validate [--strict]              files exist, sizes, alt text, when-keys and values known to the game
Put --root DIR before the command to work on another copy of the repo (a scratch checkout, say). After enable/disable, run
python3 tools/build.py so index.html picks up the change.
"""
import argparse, glob, hashlib, json, os, re, shutil, struct, subprocess, sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---- what the game understands (keep in step with ART.KEYS in src/js/40-art.js) ----
KEYS = {
    'cabin': ['heat', 'season', 'time', 'cond', 'has'],
    'boat': ['boat', 'where', 'cond', 'up', 'time', 'trip'],
    'camp': ['place', 'shelter', 'activity', 'time', 'weather'],
    'event': ['event', 'from', 'time'],
}
FIXED = {
    'cabin.heat': {'wood', 'oil'},
    'cabin.season': {'summer', 'winter'},
    'cabin.time': {'day', 'dusk', 'night'},
    'cabin.has': {'generator', 'freezer', 'vise', 'detectors', 'processing', 'garden', 'woodstove', 'propane',
                  'furnace', 'bearbin', 'fence', 'heattape', 'skirting', 'strapped', 'fueltank'},
    'boat.boat': {'sled', 'drift', 'charter', 'staff'},
    'boat.where': {'river', 'launch', 'harbor', 'trailer', 'shop'},
    'boat.time': {'day', 'dusk', 'night'},
    'boat.trip': {'reds', 'silver', 'trout', 'halibut', 'king'},
    'camp.shelter': {'tent', 'wall', 'camper', 'cabin'},
    'camp.activity': {'icefish', 'ski', 'snowshoe', 'track', 'scout', 'rest', 'fire', 'tie', 'aurora'},
    'camp.time': {'day', 'night'},
    'camp.weather': {'clear', 'snow', 'cold', 'thaw'},
    'event.from': {'game', 'home', 'camp'},
    'event.time': {'day', 'dusk', 'night'},
}
RANGES = {'cabin.cond', 'boat.cond'}
BUDGET_IMG, BUDGET_SET = 150 * 1024, 2 * 1024 * 1024   # bytes served per image (WebP if there is one), per set
FULL, THUMB = (1600, 900), (400, 225)


def code_values(root):
    """Ids the game really uses, read from its source: upgrades, camp places, events."""
    src = lambda p: open(os.path.join(root, p), encoding='utf-8').read() if os.path.exists(os.path.join(root, p)) else ''
    v = {k: set(s) for k, s in FIXED.items()}
    career = src('src/js/24-career.js')
    m = re.search(r'const UPGRADES=\[(.*?)\n\];', career, re.S)
    v['boat.up'] = set(re.findall(r"\{id:'(\w+)'", m.group(1))) if m else set()
    data = src('src/camp/camp-10-data.js')
    m = re.search(r'D\.PLACES=\[(.*?)\n\s*\];', data, re.S)
    v['camp.place'] = set(re.findall(r"\{id:'(\w+)'", m.group(1))) if m else set()
    game = set()
    for f in sorted(glob.glob(os.path.join(root, 'src/js/*.js'))):
        game |= set(re.findall(r"defEvent\(\{id:'(\w+)'", open(f, encoding='utf-8').read()))
    home = set(re.findall(r"\b(\w+):\{id:'\1',ic:'[^']*',kind:'event'", src('src/home/home-20-engine.js')))
    camp = set(re.findall(r"add\(\{id:'(\w+)'", data))
    v['event.event'] = game | home | camp
    v['_events'] = {'game': game, 'home': home, 'camp': camp}
    return v


def png_size(path):
    with open(path, 'rb') as f:
        head = f.read(24)
    if head[:8] != b'\x89PNG\r\n\x1a\n': return None
    return struct.unpack('>II', head[16:24])


def img_size(path):
    if path.endswith('.png'): return png_size(path)
    try:
        from PIL import Image
        with Image.open(path) as im: return im.size
    except Exception:
        return None


def to_webp(src, dst, quality):
    """PNG → WebP without the network: Pillow if it has WebP, else cwebp. Returns True if dst was written."""
    try:
        from PIL import Image, features
        if features.check('webp'):
            with Image.open(src) as im:
                im.save(dst, 'WEBP', quality=quality, method=6)
            return True
    except ImportError:
        pass
    if shutil.which('cwebp'):
        return subprocess.run(['cwebp', '-quiet', '-q', str(quality), src, '-o', dst]).returncode == 0
    return False


def load(root):
    p = os.path.join(root, 'art', 'manifest.json')
    if not os.path.exists(p): return []
    data = json.load(open(p, encoding='utf-8'))
    if not isinstance(data, list): sys.exit('art/manifest.json must be a JSON array')
    return data


def save(root, entries):
    entries.sort(key=lambda e: (e.get('set', ''), e.get('n', 0), e['id']))
    os.makedirs(os.path.join(root, 'art'), exist_ok=True)
    with open(os.path.join(root, 'art', 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(entries, f, ensure_ascii=False, indent=1)
        f.write('\n')


def digest(paths):
    h = hashlib.sha1()
    for p in paths:
        if p and os.path.exists(p): h.update(open(p, 'rb').read())
    return h.hexdigest()[:10]


def cmd_import(a):
    src = os.path.abspath(a.src)
    man = json.load(open(os.path.join(src, 'manifest.json'), encoding='utf-8'))
    have = {e['id']: e for e in load(a.root)}
    n_new = 0
    for e in man:
        s = a.set or e.get('set') or os.path.basename(src.rstrip('/'))
        rel = e['file'].split('/', 1)[-1] if '/' in e['file'] else e['file']   # "cabin/01-x.png" or "01-x.png"
        png = os.path.join(src, rel)
        if not os.path.exists(png): sys.exit(f'{e["id"]}: {png} not found')
        dest = os.path.join(a.root, 'art', s)
        os.makedirs(dest, exist_ok=True)
        stem = rel[:-4] if rel.endswith('.png') else os.path.splitext(rel)[0]
        shutil.copyfile(png, os.path.join(dest, stem + '.png'))
        x = {'id': e['id'], 'set': s, 'n': e.get('n'), 'title': e.get('title', ''), 'file': f'{s}/{stem}.png',
             'w': e.get('w', FULL[0]), 'h': e.get('h', FULL[1]), 'alt': e.get('alt', ''), 'where': e.get('where', ''),
             'when': e.get('when', {}), 'notes': e.get('notes', '')}
        th = os.path.join(src, stem + '.thumb.png')
        if os.path.exists(th):
            shutil.copyfile(th, os.path.join(dest, stem + '.thumb.png'))
            x['thumb'] = f'{s}/{stem}.thumb.png'
        if not a.no_webp:
            if to_webp(png, os.path.join(dest, stem + '.webp'), a.quality):
                x['webp'] = f'{s}/{stem}.webp'
                if 'thumb' in x and to_webp(th, os.path.join(dest, stem + '.thumb.webp'), a.quality):
                    x['thumbWebp'] = f'{s}/{stem}.thumb.webp'
        x['v'] = digest([os.path.join(a.root, 'art', x[k]) for k in ('file', 'thumb', 'webp', 'thumbWebp') if k in x])
        old = have.get(x['id'])
        x['enabled'] = True if a.enable else bool(old and old.get('enabled') is True)
        if not old: n_new += 1
        have[x['id']] = x
    save(a.root, list(have.values()))
    print(f'imported {len(man)} entries ({n_new} new) from {src} into {os.path.join(a.root, "art")}'
          f'{" (enabled)" if a.enable else " (disabled: run tools/art.py enable <id|set> when they are reviewed)"}')
    return validate(a.root, False, only={x.get('set') or a.set for x in man} | ({a.set} if a.set else set()))


def match(e, names):
    return e['id'] in names or e.get('set') in names


def cmd_toggle(a, on):
    es = load(a.root)
    hit = [e for e in es if match(e, a.names)]
    if not hit: sys.exit('no entry matches ' + ' '.join(a.names))
    for e in hit: e['enabled'] = on
    save(a.root, es)
    print(f'{"enabled" if on else "disabled"} {len(hit)}: {", ".join(e["id"] for e in hit)}. Now run: python3 tools/build.py')
    return validate(a.root, False) if on else 0


def cmd_remove(a):
    es = load(a.root)
    keep = [e for e in es if not match(e, a.names)]
    for e in es:
        if match(e, a.names):
            for k in ('file', 'thumb', 'webp', 'thumbWebp'):
                p = os.path.join(a.root, 'art', e[k]) if k in e else None
                if p and os.path.exists(p): os.remove(p)
    save(a.root, keep)
    print(f'removed {len(es) - len(keep)} entries')
    return 0


def cmd_list(a):
    for e in load(a.root):
        print(f'{"ON " if e.get("enabled") else "off"} {e["id"]:<16} {e.get("file", ""):<36} {json.dumps(e.get("when", {}), ensure_ascii=False)}')
    return 0


def validate(root, strict, only=None):
    es, V = load(root), code_values(root)
    errs, warns, per_set = [], [], {}
    ids = set()
    for e in es:
        s, i = e.get('set'), e.get('id', '?')
        if only and s not in only: continue
        if i in ids: errs.append(f'{i}: duplicate id')
        ids.add(i)
        if s not in KEYS: errs.append(f'{i}: unknown set {s!r} (one of {", ".join(KEYS)})'); continue
        if not isinstance(e.get('enabled', False), bool): errs.append(f'{i}: enabled must be true or false')
        alt = (e.get('alt') or '').strip()
        if not alt: errs.append(f'{i}: no alt text')
        elif len(alt) > 250: warns.append(f'{i}: alt text is long ({len(alt)} characters); one sentence is plenty')
        elif re.match(r'(?i)(an? )?(image|picture|illustration) of', alt): warns.append(f'{i}: alt text starts with "image of"; describe the scene instead')
        for k in ('file', 'thumb', 'webp', 'thumbWebp'):
            if k not in e:
                if k in ('file', 'thumb'): (errs if k == 'file' else warns).append(f'{i}: no {k}')
                continue
            p = os.path.join(root, 'art', e[k])
            if not os.path.exists(p): errs.append(f'{i}: {k} art/{e[k]} is missing'); continue
            want = THUMB if k.lower().startswith('thumb') else (e.get('w', FULL[0]), e.get('h', FULL[1]))
            got = img_size(p)
            if got and tuple(got) != tuple(want): errs.append(f'{i}: art/{e[k]} is {got[0]}x{got[1]}, expected {want[0]}x{want[1]}')
        served = os.path.join(root, 'art', e.get('webp') or e.get('file', ''))
        if os.path.isfile(served):
            b = os.path.getsize(served)
            per_set[s] = per_set.get(s, 0) + b + (os.path.getsize(os.path.join(root, 'art', e['thumbWebp' if 'thumbWebp' in e else 'thumb'])) if os.path.isfile(os.path.join(root, 'art', e.get('thumbWebp') or e.get('thumb') or '-')) else 0)
            if b > BUDGET_IMG: warns.append(f'{i}: {b // 1024} KB served (budget {BUDGET_IMG // 1024} KB)')
        w = e.get('when')
        if not isinstance(w, dict): errs.append(f'{i}: when must be an object'); continue
        for k, val in w.items():
            if k not in KEYS[s]: errs.append(f'{i}: when.{k} is not a {s} key ({", ".join(KEYS[s])})'); continue
            if val == 'any': continue
            key = f'{s}.{k}'
            if key in RANGES:
                ok = isinstance(val, list) and len(val) == 2 and all(isinstance(x, (int, float)) for x in val) and 0 <= val[0] <= val[1] <= 100
                if not ok: errs.append(f'{i}: when.{k} must be [min, max] within 0..100, got {val!r}')
                continue
            known = V.get(key)
            vals = val if isinstance(val, list) else [val]
            bad = [x for x in vals if x != 'any' and (known is None or x not in known)]
            if bad: errs.append(f'{i}: when.{k} has {bad!r}, which the game never reports' + (f' (known: {", ".join(sorted(known))})' if known else ''))
        if s == 'event' and w.get('event') not in (None, 'any') and 'from' not in w:
            ev = w['event'] if isinstance(w['event'], list) else [w['event']]
            both = [x for x in ev if sum(x in V['_events'][src] for src in V['_events']) > 1]
            if both: warns.append(f'{i}: event {both} exists in more than one place ({", ".join(src for src in V["_events"] if both[0] in V["_events"][src])}); add when.from to pick one')
    for s, b in per_set.items():
        if b > BUDGET_SET: warns.append(f'set {s}: {b / 1048576:.1f} MB served (budget {BUDGET_SET // 1048576} MB)')
    for x in errs: print('ERROR  ' + x)
    for x in warns: print('warn   ' + x)
    n = len([e for e in es if not only or e.get('set') in only])
    print(f'{n} entries checked: {len(errs)} errors, {len(warns)} warnings; {sum(1 for e in es if e.get("enabled") is True)} enabled in all')
    return 1 if errs or (strict and warns) else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--root', default=REPO, help='repo copy to work on (default: this one)')
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('import'); p.add_argument('src'); p.add_argument('--set'); p.add_argument('--enable', action='store_true')
    p.add_argument('--no-webp', action='store_true'); p.add_argument('--quality', type=int, default=80)
    for c in ('enable', 'disable', 'remove'):
        sub.add_parser(c).add_argument('names', nargs='+')
    sub.add_parser('list')
    sub.add_parser('validate').add_argument('--strict', action='store_true')
    a = ap.parse_args()
    a.root = os.path.abspath(a.root)
    if a.cmd == 'import': return cmd_import(a)
    if a.cmd == 'enable': return cmd_toggle(a, True)
    if a.cmd == 'disable': return cmd_toggle(a, False)
    if a.cmd == 'remove': return cmd_remove(a)
    if a.cmd == 'list': return cmd_list(a)
    return validate(a.root, a.strict)


if __name__ == '__main__':
    sys.exit(main())
