# Illustrations

Optional pictures for Guide Master. The game draws its own scenes in SVG; an illustration can sit on top of a screen as a 2:1 banner
(cropped from 16:9). **Every image ships switched off.** With no entry enabled, every screen is byte-for-byte what it was
(`tests/art.test.js` checks each hook), so art can be added, reviewed and enabled one set at a time, with no game-logic changes.

This folder holds `manifest.json` (the list) and one folder per set (`cabin/`, `boat/`, `camp/`, `event/`). Each image is four small
files: `NN-slug.webp` (1600×900, what players get), `NN-slug.jpg` (a 960×540 fallback for browsers without WebP) and
`NN-slug.thumb.webp` / `NN-slug.thumb.jpg` (400×225, for small screens and data saver). The drawn PNGs and SVGs stay with the artist.

Imported so far (all **disabled**): cabin 12, boat 16, camp 10, event 15 (53 images, about 5.8 MB in all; the biggest full WebP is 88 KB).

## How it fits together

| Piece | What it does |
|---|---|
| `art/manifest.json` | Every imported image: `{id, set, n, title, webp, file, fw, thumbWebp, thumb, v, w, h, alt, where, when, notes, meta?, enabled}`. `webp` is the full picture (`w`×`h`), `file` the JPEG fallback (`fw` = 960 wide), `thumb*` the 400-wide copies. |
| `tools/art.py` | Imports (encodes) a set, validates, enables/disables/removes entries; `events` prints the event ids the game reports. |
| `tools/build.py` | Embeds the **enabled** entries (trimmed to `id set file fw thumb webp thumbWebp v w h alt when enabled`) into `src/js/40-art.js` between `/*@ART@*/` and `/*@/ART@*/`. Images are never inlined in `index.html`. |
| `tools/build-offline.py` | Empties the manifest in the single-file build (the files can't travel with it). `--with-art` inlines the enabled images (the WebP) as `data:` URIs instead. |
| `src/js/40-art.js` | `ART.register(entry)`, `artFor(set, ctx)`, `artImg(entry)`, `artSlot(set, ctx)`, `artNarr`, `artMorning` and the context builders. |
| `sw.js` | Caches an image the first time it is shown, in `guidemaster-art` (kept across releases, at most `ART_MAX` = 60 images). Nothing under `art/` is precached. URLs carry `?v=<content hash>`, so a redrawn image is fetched again. |
| ⚙️ Settings → **Illustrations** | On by default; the switch only appears once at least one image is enabled. Off: the drawn scenes only. |
| Release kit | `art/` is copied with the site (`release.json` excludes only `.kit`; the kit's default excludes are `tools`, `src`, `tests`). |

## Adding a set

1. **Draw.** `NN-slug.png` at **1600×900** plus `NN-slug.thumb.png` at **400×225** (and the `NN-slug.svg` source), with a
   `manifest.json` array of `{id, set, n, title, file: "<set>/NN-slug.png", w: 1600, h: 900, alt, where, when, notes, meta}`.
   `when` holds **only** the set's selection keys (below); anything else (hooks, sources, ideas) goes in `notes` or `meta`.
   Keep the subject in the central 70% of the width: the game crops 16:9 to about 2:1. No text in the image.
2. **Import** (needs Pillow with WebP). It encodes each PNG into `art/<set>/`: the WebP at quality 78 (stepped down by 4 until it
   is under 150 KB), the 960×540 JPEG at quality 82, and the thumb as WebP and JPEG; no PNG is kept. It merges the entries into
   `art/manifest.json` **disabled** and validates them:

   ```sh
   python3 tools/art.py import ~/art/cabin            # --set NAME to rename the set, --quality 78, --jpeg-quality 82
   ```
   Re-importing a set replaces its files and entries (and an older import's PNGs) and keeps each entry's enabled flag.
   `--root DIR` (before the command) works on another copy of the repo, e.g. a scratch checkout.
3. **Review.** `python3 tools/art.py list`; look at the images; fix any `ERROR` (and look at every `warn`) from
   `python3 tools/art.py validate` (`--strict` fails on warnings too).
4. **Enable** what passed review, then rebuild:

   ```sh
   python3 tools/art.py enable cabin-03 cabin-07   # ids, or a whole set: enable cabin
   python3 tools/build.py
   ```
   `disable` switches entries off again; `remove` drops them and their files.
5. **Test.** `NODE_PATH=/opt/npm-tools/node_modules node tests/run.js art`, then the full suite. Serve the folder
   (`python3 -m http.server`) and look at each hook on a phone-size window (390×844): light and dark mode, Settings →
   Illustrations off and on. Commit `art/<set>/` (WebP, JPEG, thumbs) together with `art/manifest.json` and the rebuilt `index.html`.

## File naming and sizes

- `art/<set>/NN-slug.webp` (1600×900), `NN-slug.jpg` (960×540), `NN-slug.thumb.webp` and `NN-slug.thumb.jpg` (400×225).
- Ids are `<set>-NN` (or anything unique); keep them stable once a set is enabled (the pick for a day is a hash of the day, the set
  and the sorted ids of the tied candidates).
- `file`, `thumb`, `webp` and `thumbWebp` are relative to `art/`. `data:`, `blob:` and `http(s):` addresses are used as they are.
- **Budget:** at most **150 KB per full WebP** and **2 MB per set** (every file of the set counted). The validator warns past
  either (`--strict` fails). Flat vector art lands at 20 to 90 KB as a WebP; the drawn PNGs (1 to 1.7 MB each) never ship.

## What the player sees

`artImg(entry)` writes `<figure class="art-fig" data-art="id"><picture>`: a WebP `<source>` (thumb 400w, full 1600w) and an `<img>`
JPEG fallback (thumb 400w, 960w) with the `alt` text, `width`/`height` (1600×900, so nothing jumps while it loads),
`loading="lazy"`, `decoding="async"` and `object-fit: cover`. The figure is a 2:1 banner with a soft sky-colored
placeholder; in dark mode (`prefers-color-scheme: dark`) the image is dimmed a little. With `navigator.connection.saveData` on, only
the thumb is used.

## Where the hooks are

| Set | Screen | Code | Context |
|---|---|---|---|
| cabin | the 🏠 Home tab, on top | `homeView()` in `src/js/32-home.js` | `artCabinCtx()` |
| cabin | the fall sheet "🏠 Get the cabin ready for winter" | `homeWinterModal()` in `32-home.js` | `artCabinCtx()` |
| boat | arriving where one of today's trips launches (the Here tab, above the narration, until the next tap) | `artLaunch()` from `onArrive()` in `src/js/21-story.js` | `artBoatCtx(b, ['launch', 'trailer'])`, or `'harbor'` in Homer |
| boat | the first step of a trip sheet (both the one-sheet trip and "Show every trip step"), when the step has no picture of its own | `tripNext()` in `src/js/22-trips.js` | `artBoatCtx(b, ['launch', 'trailer', 'river'])`, or `['harbor', 'river']` for halibut |
| boat | "Back at the dock" | `tripEnd()` in `22-trips.js` | `artBoatCtx(b, ['dock', 'launch' or 'harbor'])` (harbor for halibut and after a Coast Guard tow) |
| boat | a repair at the Shop & Cabin: DIY service, the dealer's 100-hour service, a major repair, an emergency patch, a loaner (the Here tab, above the narration) | the actions in `src/js/20-world.js` | `artBoatCtx(null, 'shop')`; the patch and loaner at a launch: `'launch'`; the loaner with today's trip |
| boat | your guides' trips in the ☀️ morning report: above the first line about them, in the night section | `artMorning()` from `morningReport()` in `src/js/04-loop.js` | `artBoatCtx(b, 'staff')` with `time: "day"` |
| camp | the camping hub, each day, the evening, the night, results inside a trip, breaking camp | `campArtShow()` in `src/js/28-camping.js` (the adapter keeps the session handle; `src/camp/` is unchanged and never sees the game) | `artCampCtx(session, {activity, night})` |
| event | a night's encounter on the camping night screen (wins over the camp picture) | `campArtShow()` | `artEventCtx(id, 'camp')` |
| event | each trip step, above the dilemma (wins over the boat on the first step) | `tripNext()` | `artEventCtx(stepId, 'trip')` (with the cooler and the spot on one sheet: `pack`, then `spot`) |
| event | "Back at the dock" when the fish station spoiled a batch (wins over the boat) | `tripEnd()` | `artEventCtx('spoiled_batch', 'home')` |
| event | an event's OK pop-up (Settings → Event pop-ups on) | `eventPopup()` in `src/js/03-events.js` | `artEventCtx(id, 'game')` (first event with a picture) |
| event | the ☀️ morning report, on top | `artMorning()` (morning items carry the event `id`, `endDay()` notes the night's event ids, and the cabin's events of the night and morning are collected by `homeArtNote()` in `32-home.js`: `CabinUpkeep.daily`, a summer outage, a generator that won't start) | first picture among: the cabin's mishaps (`sev` ≥ 1, worst first), the morning's events (`'game'`), the cabin's news (`garden_harvest`, `outage_gen`…), the night's events (`time: "night"`) |
| event | the cabin's storm prompts and their results, the winter and spring reports, a cabin mishap's pop-up | `homeHost().show` in `32-home.js`, given `meta.events` by `src/home/home-30-ui.js` | `artEventCtx(id, 'home')`, the worst event first. A prompt shows its own id (`cold_snap`, `heavy_snow`) before the choice and its outcome (`pipe_burst`, `ice_dam`…) after it, never before; nothing happened: the prompt's id again |

Every hook is `artSlot(set, ctxFunction)` (or `artNarr`, `artMorning`, `homeArt`, built on it): it returns `''` without building the
context when no image is enabled or the player turned illustrations off, and it never throws.

## Matching: `when`

An entry is a candidate when **every** key in its `when` matches the context. Its score is the number of keys that matched
something specific (`"any"` matches anything and scores 0); the highest score wins. Ties go to a stable hash of the day (or the
off-season) and the set, so the same screen shows the same picture all day. Nothing matches → `null` → the screen is as before.

- a string matches an equal value (or a context list that contains it): `"heat": "wood"`
- `"any"` (or leaving the key out) matches anything
- `[min, max]` (two numbers) is an inclusive range: `"cond": [0, 39]`
- under `has` and `up`, a list must be **all** present: `"has": ["generator", "freezer"]` (an empty list asks for nothing and scores 0)
- under any other key, a list is **one of**: `"event": ["cold", "snow"]`, `"time": ["dusk", "night"]`

A context key the game doesn't know (null) only matches `"any"`. A `when` key that isn't in the set's table below is ignored by the
game, but `tools/art.py validate` reports it as an error, so a typo such as `"seasn"` can't silently widen a match: notes go in
`notes` or `meta`, outside `when`.

### cabin — `artCabinCtx()`

| key | values | from the game |
|---|---|---|
| `heat` | `"oil"`, `"wood"` | the context is a list: `oil` while the furnace is in (`S.cabin.heat.oil`, every cabin has one), `wood` once the wood stove is bought (`heat.stove`) |
| `season` | `"summer"`, `"winter"` | `winter` during the off-season (`S.winter`), else `summer` (the played weeks) |
| `time` | `"day"`, `"dusk"`, `"night"` | the clock as the scene art draws it (`SCENE.sun` 5:00 AM–11:00 PM; dusk 90 min before sunset to 30 after, and around sunrise). Dusk also counts as night. The off-season has no clock: day and night both match |
| `cond` | `[min, max]` in 0–100 | the cabin's condition (`S.cabin.cond`) |
| `has` | `generator` (`S.home.gen`), `freezer` (the big chest freezer, `S.home.frz`), `vise` (the fly-tying vise from camping, `S.camp.gear`), `detectors` (`detect`), `processing` (the fish station, `proc`), `garden` (planted this year), `woodstove` (`heat.stove`), `propane` (the furnace: the game's furnace burns "heating oil or propane", so this is the same as `furnace`), `furnace`, `bearbin`, `fence` (moose fence), `heattape`, `skirting`, `strapped` (water heater), `fueltank` (the 100-gal home fuel tank, `S.home.tank`) | |

### boat — `artBoatCtx(booking, where)`

| key | values | from the game |
|---|---|---|
| `boat` | `"sled"`, `"drift"`, `"charter"`, `"staff"`, `"loaner"`, `"king"` | a list: the hull for the trip type (sockeye, silver and king trips run on the jet sled, the trout float on the drift boat, halibut on the charter boat), plus `staff` for a hired guide's trip (`b.asst`, shown in the morning report), `loaner` while a borrowed rig is in use today (not on the charter boat), `king` on a June king trip. Your own boats with no trip (the shop) are `sled` |
| `where` | `"river"`, `"launch"`, `"trailer"`, `"harbor"`, `"dock"`, `"shop"`, `"staff"` | arriving for today's trip: `["launch", "trailer"]` (`harbor` in Homer); the first trip step: `["launch", "trailer", "river"]` (`river` means on the water, Cook Inlet included), `["harbor", "river"]` for halibut; back at the dock: `["dock", "launch" or "harbor"]`; the Shop & Cabin repair, service, patch and loaner: `shop` (`launch` for a patch or loaner at a launch); your guides' trips: `staff` |
| `cond` | `[min, max]` | the boats' condition (`S.boat`) |
| `up` | `motor`, `sled`, `drift`, `web`, `course`, `rates`, `asst`, `lodge`, `dock`, `chp` (`UPGRADES` in `src/js/24-career.js`) | owned upgrades; `web` and `course` only in the season they were bought, `rates` once rates are raised |
| `time` | `"day"`, `"dusk"`, `"night"` | as for the cabin |
| `trip` | `reds`, `silver`, `trout`, `halibut`, `king` | extra key: the trip type itself |

### camp — `artCampCtx(session, {activity, night})`

| key | values | from the engine (`src/camp/`) |
|---|---|---|
| `place` | `johnson`, `clam`, `hidden`, `swanson`, `skilak`, `cook`, `deep`, `quartz`, `anchor`, `spit` (`D.PLACES`) | the trip's place, or the planned one while planning; null at the hub |
| `shelter` | `"tent"`, `"wall"`, `"camper"`, `"cabin"` (`D.SHELTERS`) | the trip's shelter |
| `activity` | `icefish`, `ski`, `snowshoe`, `track`, `scout`, `rest` (a day), `fire`, `tie`, `aurora`, `rest` (an evening) | what the player picked last today (null on a fresh morning and outside a trip) |
| `time` | `"day"`, `"night"` | `night` on the evening and night screens and after an evening choice; `day` otherwise |
| `weather` | `"clear"`, `"snow"`, `"cold"`, `"thaw"` | a list: `clear` (a clear sky today), `thaw` (a chinook this trip), `snow` (a snowstorm this trip), `cold` (a cold snap this trip). The engine has no overcast state: with none of these the list is empty |

### event — `artEventCtx(id, from)`

| key | values | from the game |
|---|---|---|
| `event` | **game** (`defEvent` in `src/js`): `call_request`, `trooper_check`, `moose`, `traffic`, `flat`, `midnight_sun`, `mosquitoes`, `cancel`, `gossip`, `bear_bin`, `good_review`, `power_out`, `hungry_morning`, `arc_rival`, `arc_board`; **home** (`CabinUpkeep.EVENTS` in `src/home`): `chimney_fire`, `pipes_frozen`, `pipe_burst`, `cold_snap` and `heavy_snow` (the storm prompts), `ice_dam`, `shed_collapse`, `breakup_stuck`, `frost_heave`, `well_pump`, `septic_backup`, `quake`, `quake_ok`, `co_alarm`, `co_night`, `bear_yard`, `bear_raid`, `garden_moose`, `garden_harvest`, `gen_fail`, `outage_gen`, `outage_dark`, `roof_leak`, `furnace_fail`, `pump_fail`, `spoiled_batch`; **camp** (`src/camp`): `moose`, `wolves`, `lynx`, `fox`, `ravens`, `porcupine`, `swans`, `eagles`, `sheep`, `bear`, `otters`, `wolverine`, `hares`, `ptarmigan`, `seaotters`, `chickadees`, `coldsnap`, `snowstorm`, `chinook`; **trip** (the `STEP` ids in `22-trips.js`, `25-fuel.js`, `30-stories.js`, `31-supplies.js`, `33-day.js`): `combat`, `bear` (a sow and two cubs), `fog`, `whale`, `king`, `hookhand`, `rescue`, `seasick`, `motor`, `beat` (a stretch of the day), `spot`, `pack`, `fuel`, `golook` … (`python3 tools/art.py events` prints them all) | the event's id |
| `from` | `"game"`, `"home"`, `"camp"`, `"trip"` | **required** on every event entry (the validator errors without it): where the id comes from. The same word can mean different things (`moose` on the road or at camp, `bear` at camp or on the river), and the id must be one that origin reports |
| `time` | `"day"`, `"dusk"`, `"night"` | as for the cabin (dusk also counts as night; in the off-season day and night both match); a night event in the morning report is `night`. Most events want `"any"` |

`tools/art.py validate` reads the upgrade ids, camp places and event ids by origin from the source (`tests/art.test.js` checks
them against the running game), so a `when` value the game can never report is an error.

## Accessibility

- Every entry needs `alt`: one plain sentence saying what is in the picture, as you'd describe it to someone on the phone
  ("A jet sled backs down the Centennial Park launch at dawn, two clients in raingear on the bank."). No "image of", no text that is
  already on the screen, under about 250 characters. The validator errors on a missing alt and warns on a long one.
- The picture never carries information the screen doesn't: it is decoration with a description, so players with images off, with
  Settings → Illustrations off, or with a screen reader miss nothing.
- No text inside images (it can't be translated, resized or read aloud).
- Pictures don't move. Dark mode dims them a little; high contrast and text size don't affect them.

## Checklist for a set

- [ ] PNGs at 1600×900, thumbs at 400×225, subject in the central 70% of the width, no text, matches the game's palette
- [ ] `manifest.json`: unique ids, one-sentence `alt` for each, only the set's `when` keys (notes in `notes`/`meta`), `from` on events
- [ ] `python3 tools/art.py import <folder>` then `python3 tools/art.py validate --strict` is clean (≤ 150 KB per image, ≤ 2 MB per set)
- [ ] Looked at each picture in the game at 390×844, light and dark, and with Settings → Illustrations off
- [ ] Enabled only the reviewed entries; `python3 tools/build.py`; `python3 tools/build.py --check` clean
- [ ] `node tests/run.js` green (the art tests check that disabled entries change nothing)
- [ ] A line under `## Unreleased` in `CHANGELOG.md`
