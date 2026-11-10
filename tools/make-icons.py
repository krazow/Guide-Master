#!/usr/bin/env python3
"""Generate placeholder app icons: a colored square with one or two letters.
Replace icons/*.png with real artwork whenever you like (keep the sizes).

Usage:  python3 tools/make-icons.py --text PW --bg "#12313b" --fg "#f3ecdc" [--accent "#e3642e"]
Needs Pillow:  pip install pillow
"""
import argparse, pathlib, sys
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit('Pillow is needed: pip install pillow')

root = pathlib.Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument('--text', default='PW'); ap.add_argument('--bg', default='#12313b')
ap.add_argument('--fg', default='#f3ecdc'); ap.add_argument('--accent', default='#e3642e')
a = ap.parse_args()

def font(px):
    for f in (root / 'fonts/fraunces-latin-600-normal.woff2', 'DejaVuSerif-Bold.ttf', 'Georgia Bold.ttf', 'georgiab.ttf', 'Arial Bold.ttf', 'arialbd.ttf'):
        try: return ImageFont.truetype(str(f), px)
        except Exception: pass
    return ImageFont.load_default()

def icon(size, safe=1.0, radius=0.0):
    """safe: fraction of the canvas the artwork may use (maskable icons need ~0.8)."""
    s = size * 4  # draw big, scale down for smooth edges
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * radius), fill=a.bg)
    inner = s * safe
    bar_h = int(inner * 0.06)
    y_bar = int(s / 2 + inner * 0.30)
    d.rectangle([int(s / 2 - inner * 0.28), y_bar, int(s / 2 + inner * 0.28), y_bar + bar_h], fill=a.accent)
    txt = a.text[:2]
    f = font(int(inner * (0.52 if len(txt) == 1 else 0.40)))
    box = d.textbbox((0, 0), txt, font=f)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((s - w) / 2 - box[0], (s - h) / 2 - box[1] - inner * 0.04), txt, font=f, fill=a.fg)
    return im.resize((size, size), Image.LANCZOS)

out = root / 'icons'; out.mkdir(exist_ok=True)
icon(192, radius=0.18).save(out / 'icon-192.png')
icon(512, radius=0.18).save(out / 'icon-512.png')
icon(512, safe=0.78).save(out / 'maskable-512.png')        # full-bleed: the OS crops it to a circle or squircle
icon(180, safe=0.9).convert('RGB').save(out / 'apple-touch-icon.png')  # iOS adds its own rounded corners
icon(32, radius=0.2).save(out / 'favicon-32.png')
print('wrote icons/: icon-192, icon-512, maskable-512, apple-touch-icon, favicon-32')
