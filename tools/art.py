#!/usr/bin/env python3
"""Illustrations for the game (src/js/40-art.js): import a drawn set, review it, switch it on, check it.

The images live in art/<set>/ as separate files; art/manifest.json lists them. Every imported entry starts DISABLED, and the game
only embeds enabled entries (tools/build.py), so importing changes nothing a player sees until you enable it. See art/README.md.

Usage:
  python3 tools/art.py import ~/art/cabin               encode a drawn set (1600x900 PNGs + 400x225 thumbs) into art/cabin/: a WebP
                                                        (1600x900, the picture players get), a small JPEG fallback (960x540) and the
                                                        thumb as WebP + JPEG (no PNG is kept), and merge the entries into
                                                        art/manifest.json, disabled. Needs Pillow with WebP.
          [--set NAME] [--enable] [--quality 78] [--jpeg-quality 82]
  python3 tools/art.py enable  cabin-03 | cabin ...     switch entries (ids) or whole sets on
  python3 tools/art.py disable cabin-03 | cabin ...     ... or off
  python3 tools/art.py remove  cabin-03 | cabin ...     drop entries from the manifest (and their files from art/)
  python3 tools/art.py list                             one line per entry
  python3 tools/art.py validate [--strict]              files exist, sizes, alt text, when-keys and values known to the game
Put --root DIR before the command to work on another copy of the repo (a scratch checkout, say). After enable/disable, run
python3 tools/build.py so index.html picks up the change.

validate checks: the files exist with the right sizes and formats, alt text, budgets (150 KB per full WebP, 2 MB per set in all),
"when" keys (only the set's selection keys; notes and meta go outside "when"), and every value against what the game reports,
read from its source: upgrades, camp places, and event ids by origin (event entries must say "from"): game = defEvent ids,
home = CabinUpkeep.EVENTS (src/home), camp = the camp encounters, trip = the trip STEP ids.
"""
import argparse, glob, hashlib, json, os, re, struct, sys

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
    'boat.boat': {'sled', 'drift', 'charter', 'staff', 'loaner', 'king'},
    'boat.where': {'river', 'launch', 'trailer', 'harbor', 'dock', 'shop', 'staff'},
    'boat.time': {'day', 'dusk', 'night'},
    'boat.trip': {'reds', 'silver', 'trout', 'halibut', 'king'},
    'camp.shelter': {'tent', 'wall', 'camper', 'cabin'},
    'camp.activity': {'icefish', 'ski', 'snowshoe', 'track', 'scout', 'rest', 'fire', 'tie', 'aurora'},
    'camp.time': {'day', 'night'},
    'camp.weather': {'clear', 'snow', 'cold', 'thaw'},
    'event.from': {'game', 'home', 'camp', 'trip'},
    'event.time': {'day', 'dusk', 'night'},
}
RANGES = {'cabin.cond', 'boat.cond'}
BUDGET_IMG, BUDGET_SET = 150 * 1024, 2 * 1024 * 1024   # bytes per full WebP; bytes per set, every file counted
FULL, FALLBACK, THUMB = (1600, 900), (960, 540), (400, 225)
TOP = {'id', 'set', 'n', 'title', 'file', 'fw', 'thumb', 'webp', 'thumbWebp', 'v', 'w', 'h', 'alt', 'where', 'when', 'notes', 'meta', 'enabled'}
FILES = ('webp', 'file', 'thumbWebp', 'thumb')


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
    v['_events'] = events = known_events(root)
    v['event.event'] = set().union(*events.values())
    return v


def known_events(root):
    """The event ids the game reports, by origin, read from its source (tests/art.test.js checks them against the running game)."""
    src = lambda p: open(os.path.join(root, p), encoding='utf-8').read() if os.path.exists(os.path.join(root, p)) else ''
    js = {f: open(f, encoding='utf-8').read() for f in sorted(glob.glob(os.path.join(root, 'src/js/*.js')))}
    game = set().union(*(re.findall(r"defEvent\(\{id:'(\w+)'", t) for t in js.values())) if js else set()
    m = re.search(r"C\.EVENTS=\[(.*?)\];", src('src/home/home-20-engine.js'), re.S)
    home = set(re.findall(r"'(\w+)'", m.group(1))) if m else set()
    camp = set(re.findall(r"add\(\{id:'(\w+)'", src('src/camp/camp-10-data.js')))
    trip = set()
    for t in js.values():   # the trip steps: const STEP={...}, Object.assign(STEP,{...}) (keys at two spaces) and STEP.x=
        for b in re.finditer(r"(?:const STEP=\{|Object\.assign\(STEP,\{)\n(.*?)\n\}\)?;", t, re.S):
            trip |= set(re.findall(r"^  (\w+):", b.group(1), re.M))
        trip |= set(re.findall(r"^STEP\.(\w+)=", t, re.M))
    return {'game': game, 'home': home, 'camp': camp, 'trip': trip}


def png_size(path):
    with open(path, 'rb') as f:
        head = f.read(24)
    if head[:8] != b'\x89PNG\r\n\x1a\n': return None
    return struct.unpack('>II', head[16:24])


def webp_size(path):
    with open(path, 'rb') as f:
        h = f.read(30)
    if h[:4] != b'RIFF' or h[8:12] != b'WEBP': return None
    kind = h[12:16]
    if kind == b'VP8 ': return struct.unpack('<H', h[26:28])[0] & 0x3fff, struct.unpack('<H', h[28:30])[0] & 0x3fff
    if kind == b'VP8L':
        b = int.from_bytes(h[21:25], 'little'); return (b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1
    if kind == b'VP8X': return int.from_bytes(h[24:27], 'little') + 1, int.from_bytes(h[27:30], 'little') + 1
    return None


def jpeg_size(path):
    with open(path, 'rb') as f:
        d = f.read()
    if d[:2] != b'\xff\xd8': return None
    i = 2
    while i + 9 < len(d):
        if d[i] != 0xff: i += 1; continue
        m = d[i + 1]
        if m in (0xd8, 0x01) or 0xd0 <= m <= 0xd7: i += 2; continue
        n = struct.unpack('>H', d[i + 2:i + 4])[0]
        if 0xc0 <= m <= 0xcf and m not in (0xc4, 0xc8, 0xcc):
            hh, ww = struct.unpack('>HH', d[i + 5:i + 9]); return ww, hh
        i += 2 + n
    return None


def img_size(path):
    """(width, height) from the file's header (PNG, WebP, JPEG), or None: no Pillow needed to validate."""
    try:
        ext = os.path.splitext(path)[1].lower()
        return png_size(path) if ext == '.png' else webp_size(path) if ext == '.webp' else jpeg_size(path) if ext in ('.jpg', '.jpeg') else None
    except (OSError, struct.error):
        return None


def pillow():
    try:
        from PIL import Image, features
    except ImportError:
        sys.exit('tools/art.py import needs Pillow with WebP: pip install pillow')
    if not features.check('webp'): sys.exit('this Pillow has no WebP support')
    return Image


def encode(png, thumb_png, dest, stem, q, jq):
    """One drawn image → <stem>.webp (1600x900), <stem>.jpg (960x540), <stem>.thumb.webp / .thumb.jpg (400x225).
    The full WebP steps its quality down (by 4, to 50 at the least) until it fits the budget."""
    Image = pillow()
    rs = getattr(Image, 'Resampling', Image).LANCZOS
    with Image.open(png) as im0:
        im = im0.convert('RGB')
    if im.size != FULL: im = im.resize(FULL, rs)
    out = {}
    w = os.path.join(dest, stem + '.webp')
    while True:
        im.save(w, 'WEBP', quality=q, method=6)
        if os.path.getsize(w) <= BUDGET_IMG or q <= 50: break
        q -= 4
    out['webp'] = q
    im.resize(FALLBACK, rs).save(os.path.join(dest, stem + '.jpg'), 'JPEG', quality=jq, optimize=True, progressive=True)
    if thumb_png and os.path.exists(thumb_png):
        with Image.open(thumb_png) as t0:
            th = t0.convert('RGB')
    else:
        th = im
    if th.size != THUMB: th = th.resize(THUMB, rs)
    th.save(os.path.join(dest, stem + '.thumb.webp'), 'WEBP', quality=q, method=6)
    th.save(os.path.join(dest, stem + '.thumb.jpg'), 'JPEG', quality=jq, optimize=True, progressive=True)
    return out


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
        stem = os.path.splitext(rel)[0]
        for old in (stem + '.png', stem + '.thumb.png'):   # an earlier import's PNGs
            if os.path.exists(os.path.join(dest, old)): os.remove(os.path.join(dest, old))
        encode(png, os.path.join(src, stem + '.thumb.png'), dest, stem, a.quality, a.jpeg_quality)
        x = {'id': e['id'], 'set': s, 'n': e.get('n'), 'title': e.get('title', ''),
             'webp': f'{s}/{stem}.webp', 'file': f'{s}/{stem}.jpg', 'fw': FALLBACK[0],
             'thumbWebp': f'{s}/{stem}.thumb.webp', 'thumb': f'{s}/{stem}.thumb.jpg',
             'w': FULL[0], 'h': FULL[1], 'alt': e.get('alt', ''), 'where': e.get('where', ''),
             'when': e.get('when', {}), 'notes': e.get('notes', '')}
        if 'meta' in e: x['meta'] = e['meta']
        x['v'] = digest([os.path.join(a.root, 'art', x[k]) for k in FILES])
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
    used = {e[k] for e in keep for k in FILES if k in e}   # a file another entry still lists stays
    for e in es:
        if match(e, a.names):
            for k in FILES:
                p = os.path.join(a.root, 'art', e[k]) if k in e and e[k] not in used else None
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
        extra = sorted(set(e) - TOP)
        if extra: warns.append(f'{i}: unknown entry keys {extra} (notes and meta are the places for anything else)')
        alt = (e.get('alt') or '').strip()
        if not alt: errs.append(f'{i}: no alt text')
        elif len(alt) > 250: warns.append(f'{i}: alt text is long ({len(alt)} characters); one sentence is plenty')
        elif re.match(r'(?i)(an? )?(image|picture|illustration) of', alt): warns.append(f'{i}: alt text starts with "image of"; describe the scene instead')
        w0, h0 = e.get('w', FULL[0]), e.get('h', FULL[1])
        for k in FILES:
            if k not in e:
                if k == 'file': errs.append(f'{i}: no file')
                else: warns.append(f'{i}: no {k} (re-import the set: tools/art.py import)')
                continue
            p = os.path.join(root, 'art', e[k])
            if not os.path.exists(p): errs.append(f'{i}: {k} art/{e[k]} is missing'); continue
            per_set[s] = per_set.get(s, 0) + os.path.getsize(p)
            ext = os.path.splitext(p)[1].lower()
            if k in ('webp', 'thumbWebp') and ext != '.webp': errs.append(f'{i}: {k} art/{e[k]} must be a .webp')
            if k in ('file', 'thumb') and ext == '.png': warns.append(f'{i}: {k} art/{e[k]} is a PNG; re-import for a JPEG fallback')
            want = THUMB if k.lower().startswith('thumb') else (w0, h0) if k == 'webp' else (e.get('fw', w0), round(e.get('fw', w0) * h0 / w0))
            got = img_size(p)
            if got and tuple(got) != tuple(want): errs.append(f'{i}: art/{e[k]} is {got[0]}x{got[1]}, expected {want[0]}x{want[1]}')
            if k == 'webp' and os.path.getsize(p) > BUDGET_IMG: warns.append(f'{i}: {os.path.getsize(p) // 1024} KB full WebP (budget {BUDGET_IMG // 1024} KB)')
        w = e.get('when')
        if not isinstance(w, dict): errs.append(f'{i}: when must be an object'); continue
        for k, val in w.items():
            if k not in KEYS[s]: errs.append(f'{i}: when.{k} is not a key of the {s} set ({", ".join(KEYS[s])}); put notes in "notes" or "meta"'); continue
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
        if s == 'event':
            frm = w.get('from')
            if frm in (None, 'any'): errs.append(f'{i}: when.from is required on an event entry ({", ".join(sorted(V["event.from"]))})')
            elif w.get('event') not in (None, 'any'):
                frms = [x for x in (frm if isinstance(frm, list) else [frm]) if x in V['_events']]
                ev = w['event'] if isinstance(w['event'], list) else [w['event']]
                miss = [x for x in ev if x != 'any' and frms and not any(x in V['_events'][f] for f in frms)]
                if miss: errs.append(f'{i}: event {miss!r} is never reported from {"/".join(frms)}')
    for s, b in per_set.items():
        if b > BUDGET_SET: warns.append(f'set {s}: {b / 1048576:.2f} MB in all (budget {BUDGET_SET // 1048576} MB)')
    for x in errs: print('ERROR  ' + x)
    for x in warns: print('warn   ' + x)
    n = len([e for e in es if not only or e.get('set') in only])
    sizes = ', '.join(f'{k} {v / 1024:.0f} KB' for k, v in sorted(per_set.items()))
    print(f'{n} entries checked: {len(errs)} errors, {len(warns)} warnings; {sum(1 for e in es if e.get("enabled") is True)} enabled in all'
          + (f'; files: {sizes}' if sizes else ''))
    return 1 if errs or (strict and warns) else 0


def cmd_events(a):
    """Print the known event ids by origin (JSON), for tests and artists."""
    print(json.dumps({k: sorted(v) for k, v in known_events(a.root).items()}, indent=1))
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--root', default=REPO, help='repo copy to work on (default: this one)')
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('import'); p.add_argument('src'); p.add_argument('--set'); p.add_argument('--enable', action='store_true')
    p.add_argument('--quality', type=int, default=78); p.add_argument('--jpeg-quality', type=int, default=82)
    for c in ('enable', 'disable', 'remove'):
        sub.add_parser(c).add_argument('names', nargs='+')
    sub.add_parser('list')
    sub.add_parser('events')
    sub.add_parser('validate').add_argument('--strict', action='store_true')
    a = ap.parse_args()
    a.root = os.path.abspath(a.root)
    if a.cmd == 'import': return cmd_import(a)
    if a.cmd == 'enable': return cmd_toggle(a, True)
    if a.cmd == 'disable': return cmd_toggle(a, False)
    if a.cmd == 'remove': return cmd_remove(a)
    if a.cmd == 'list': return cmd_list(a)
    if a.cmd == 'events': return cmd_events(a)
    return validate(a.root, a.strict)


if __name__ == '__main__':
    sys.exit(main())
