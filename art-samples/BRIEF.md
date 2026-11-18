# Guide Master art brief (shared by all four sets)

Game: Guide Master, a phone-first web game about a fishing guide on Alaska's Kenai Peninsula (Soldotna, Kenai River, Cooper Landing, Homer, Cook Inlet).
Source (READ ONLY, do not edit): /home/claude/gm-r114 (main, v1.16.0). Existing art style: flat vector SVG with layered silhouettes, soft linear-gradient skies,
spruce triangles, mountains as polygons; see SCENE/K/spruce/forest/mtns in src/js/20-world.js (~line 55), the party art in src/js/21-story.js (~line 55),
the trip header in src/js/05-ui.js (~line 15), catch moment SVG in src/js/37-memories.js. Palette (src/style.css): --brand #1f5d63, --brand-dark #0f3b3f,
--accent #2f6d5a, --accent-soft #6f8f5a, --surface #f3ecdc, --paper #fbf8f1, --cta #e3642e, --cta-dark #a9441b, --ink #1b2326, --mute #6b7478,
--line #ddd4c0, --good #2f7d4f, --bad #b8402a, --warn #c98a12; sky day #8fb9cf→#e4eee9, dusk #5f6f96→#f0b98a, night #0c1a2a→#1f3448, ground #4e7a4a.

## Quality bar
- Each image is a finished, attractive illustration a player would enjoy: clear focal point, depth (foreground/mid/background), consistent light source,
  warm interior light vs cool exterior, subtle gradients and shadows, believable Alaskan details (spruce, birch, fireweed, Chugach/Kenai mountains,
  Carhartt-brown/XtraTuf-boot vibe, Xtratuf boots, bear spray, Grundéns raingear, coolers, nets, rod racks, moose antlers, cabin logs, snow loads).
- Flat-vector "storybook" style matching the game; NO text/words in images (no labels, no brand names/logos, no real people, no copyrighted characters).
- Composition safe for a 16:9 frame that may be cropped to ~2:1 in the game header: keep the subject in the central 70% width.
- Hand-write SVG (viewBox 0 0 800 450), self-contained (no external images/fonts), reasonably compact (aim < 60 KB each). Generate with a script if
  that helps (e.g. a small JS/Python helper library of shapes you write yourself), but every image must be distinct and composed, not random noise.

## Output (per set) in /tmp/art/<set>/
- NN-slug.svg and NN-slug.png for NN = 01..10. Render PNG at 1600x900 with Playwright Chromium (NODE_PATH=/opt/npm-tools/node_modules; deviceScaleFactor 2,
  viewport 800x450, page with the inline SVG, body margin 0). Also a 400x225 thumbnail NN-slug.thumb.png.
- manifest.json: array of {id, set, n, title, file:"<set>/NN-slug.png", svg:"<set>/NN-slug.svg", w:1600, h:900, alt (one sentence for screen readers),
  where (when the game would show it, in plain words), when (selection conditions, object; keys defined per set below), notes (design notes, 1–2 lines)}.
- contact-sheet.png: all 10 thumbnails in a 2x5 grid with small numbers (numbers only, outside the art).
- Look at every PNG yourself (Read tool) and redo any that look weak, muddled, or inconsistent with the set. Quality matters more than speed.

## "when" keys (must match what the game can know; read the code to confirm names)
- cabin: {heat:"wood"|"oil"|"any", season:"summer"|"winter"|"any", time:"day"|"night"|"any", cond:[min,max] (home condition 0–100), has:[...]}
  where has uses home features: generator, freezer, vise (fly-tying), detectors, processing (fish processing station), garden, woodstove, propane.
- boat: {boat:"sled"|"drift"|"charter"|"staff", where:"river"|"launch"|"harbor"|"trailer"|"shop", cond:[min,max] (boat condition), up:[...] (upgrade ids from UPGRADES in 24-career.js), time:"day"|"dusk"|"night"|"any"}
- camp: {place:<place id from src/camp data>, shelter:"tent"|"wall"|"camper"|"cabin"|"any", activity:<activity id or "any">, time:"day"|"night"|"any", weather:"clear"|"snow"|"cold"|"thaw"|"any"}
- event: {event:<real event id from the code: defEvent ids in src/js, home events in src/home, camp encounters in src/camp>, time:"any"}
