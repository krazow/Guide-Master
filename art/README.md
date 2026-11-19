# Illustrations

Pictures for Guide Master. The game draws its own scenes in SVG; an illustration sits at the top of a screen as a banner cropped from
16:9 (see **How pictures are shown**). Since 1.17.0 **all 55 entries are enabled** and ⚙️ Settings → Illustrations is on by default.
An entry is imported switched off and enabled after review; with no entry enabled, or Illustrations off, every screen is byte-for-byte
what it is without art (`tests/art.test.js` checks each hook), so a set can be added, reviewed and enabled with no game-logic changes.

This folder holds `manifest.json` (the list) and one folder per set (`cabin/`, `boat/`, `camp/`, `event/`). Each image is four small
files: `NN-slug.webp` (1600×900, what players get), `NN-slug.jpg` (a 960×540 fallback for browsers without WebP) and
`NN-slug.thumb.webp` / `NN-slug.thumb.jpg` (400×225, for small screens and data saver). The drawn PNGs and SVGs stay with the artist.

Imported and **enabled** (1.17.0): cabin 12, boat 16, camp 10, event 17 (55 entries, 53 drawings: `event-16` and `event-17` reuse the
combat-fishing and sow-and-cubs drawings of `boat-11` and `boat-12` for those trip incidents). About 6 MB of files in all; what a player
downloads is one full WebP per drawing shown (2.1 MB for all 53, 40 KB on average, 88 KB at most).

## How it fits together

| Piece | What it does |
|---|---|
| `art/manifest.json` | Every imported image: `{id, set, n, title, webp, file, fw, thumbWebp, thumb, v, w, h, alt, where, when, notes, meta?, enabled, focus?, bg?}`. `webp` is the full picture (`w`×`h`), `file` the JPEG fallback (`fw` = 960 wide), `thumb*` the 400-wide copies. `focus` is the crop's `object-position` (`"50% 70%"` keeps a low subject in the banner; default centered); `bg` the placeholder color, `#rrggbb`, the thumb's average (`tools/art.py colors`; import sets it). |
| `tools/art.py` | Imports (encodes) a set, validates, enables/disables/removes entries; `colors` recomputes the placeholder colors; `events` prints the event ids the game reports. |
| `tools/build.py` | Embeds the **enabled** entries (trimmed to `id set file fw thumb webp thumbWebp v w h alt when enabled focus bg`, about 32 KB for the 55) into `src/js/40-art.js` between `/*@ART@*/` and `/*@/ART@*/`. Images are never inlined in `index.html`. |
| `tools/build-offline.py` | Empties the manifest in the single-file build (the files can't travel with it). `--with-art` inlines the enabled images (the WebP) as `data:` URIs instead. |
| `src/js/40-art.js` | `ART.register(entry)`, `artFor(set, ctx, o)`, `artImg(entry, o)`, `artSlot(set, ctx, o)`, `artScene`, `artNarr`, `artNarrEvent`, `artBeat`, `artMorning`, the display rules (`ART_REST`, `ART_SEEN`) and the context builders. |
| `sw.js` | Caches an image the first time it is shown, in `guidemaster-art` (kept across releases, at most `ART_MAX` = 60 images: room for every drawing, about 2.1 MB). Nothing under `art/` is precached. URLs carry `?v=<content hash>`, so a redrawn image is fetched again. |
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
- Ids are `<set>-NN` (or anything unique); keep them stable once a set is enabled (tied candidates take turns by day, in an order set
  by a hash of the set and their sorted ids).
- `file`, `thumb`, `webp` and `thumbWebp` are relative to `art/`. `data:`, `blob:` and `http(s):` addresses are used as they are.
- **Budget:** at most **150 KB per full WebP** and **2 MB per set** (every file of the set counted). The validator warns past
  either (`--strict` fails). Flat vector art lands at 20 to 90 KB as a WebP; the drawn PNGs (1 to 1.7 MB each) never ship.

## What the player sees

`artImg(entry, o)` writes `<figure class="art-fig" data-art="id">` around a `<picture>`: a WebP `<source>` (thumb 400w, full 1600w) and
an `<img>` JPEG fallback (thumb 400w, 960w) with the `alt` text, `width`/`height` (1600×900), `loading="lazy"`, `decoding="async"`,
`object-fit: cover` and the entry's `focus` as `object-position`. The figure's background is the entry's `bg` (its average color).
`sizes` is `(max-width: 480px) 100vw, 480px`, so a phone at 2× takes the 1600w WebP and a 1× screen or data saver the 400w thumb.
With `navigator.connection.saveData` on, only the thumb is offered.

## How pictures are shown (1.17.0)

Measured at 390×844 (iPhone 12–15 class) at 2×, checked at 360×740, 768×1024 and 844×390, light and dark; `tests/art.test.js` checks
the numbers. The aim: a picture marks a moment (arriving, pushing off, an incident, a morning, a camp), never pushes the choices off the
screen and never repeats itself into wallpaper.

**Where it sits.** Never a new pop-up: the 1.12.0 budget is unchanged; pictures live inside screens that already exist.
- **A sheet** (a trip step, the dock, the morning report, an event pop-up, a storm prompt, a camping screen, the fall cabin sheet): a
  full-bleed banner across the top of the sheet, above the title. `sheetHTML()` in `src/js/02-kit.js` lifts a figure that opens the
  body there. The sheet's rounded top corners clip it. Your guides' trip picture (when it is the morning report's only one) stays in
  place above their line.
- **A tab** (the 🏠 Home tab's cabin; the 🧭 Here tab's picture while its narration lasts: arriving at a launch, a repair at the shop, a
  road event with no pop-up): the picture takes the place of the drawn scene (`artScene()` from `render()` in `05-ui.js`), at the
  banner's height, and the place's name moves to a one-line label in the sky (top left; the subjects sit low in the frame). No second
  picture stacked under the scene. The next tap brings the drawn scene back.

**How big.** `--art-h = min(column width ÷ 2, 30vh)` (the column is `min(100vw, 480px)`); 16:9 instead of 2:1 on tall, wide screens
(`min-width: 600px` and `min-height: 900px`: tablets), still capped at 30vh.

| Screen | Banner | Share of the height | With it, on a sheet |
|---|---|---|---|
| 390×844 phone | 390×195 | 23% | the title and the first lines of text show; the trip sheet's buttons were below the fold before too |
| 360×740 phone | 360×180 | 24% | |
| 768×1024 tablet (480 column) | 480×270 (16:9) | 26% | |
| 844×390 landscape | 480×117 (capped) | 30% | |

The Here and Home tabs: 144 px of top bar, then the 195 px picture where the 170 px drawn scene was (+25 px), so the content starts at
40% of a 390×844 screen. The crop from 16:9 to 2:1 takes 6% off the top and the bottom; `focus` moves it down for the 11 drawings whose
subject sits low (people at the bottom of `boat-07`, `boat-10`, `boat-12`/`event-17`, `event-08`, `-09`, `-11`, `-13`, `camp-06`, `-08`,
`cabin-06`).

**How often.** One picture per screen, at most.
- *Events always show* for their event: they are rare, and the picture is the event. An event pop-up; a trip incident above its
  dilemma; the morning report's event; a storm prompt and its outcome; a camping night's encounter; and, new in 1.17.0, a road or
  arrival event (`moose`, `flat`, `trooper_check`, `gossip`) that showed no pop-up (Event pop-ups are off by default since 1.12.0):
  its picture goes over the narration (`artNarrEvent()` from `fireHook()` in `03-events.js`; it wins over the launch picture).
- *Routine scenes rest.* The boat at the launch, on the opening trip step, on a stretch of the day, at the dock, at the shop, and your
  guides' trips: once shown, a drawing doesn't come back on another screen for `ART_REST` = 3 game days; the next-best match that
  isn't resting shows instead, or nothing. The same screen drawn again (a redraw) keeps its picture. `ART_SEEN` (in memory) holds
  the day each drawing was last shown and on which screen; every picture shown counts, the Home tab's and the events' too, and two
  entries sharing a drawing (`boat-11`/`event-16`) count as one.
- *A trip:* the opening step shows the boat at the put-in; then at most **one** stretch of the day (a `beat` step, `artBeat()`) shows
  the river at that hour, never the opening drawing; the dock shows a third only if one fits and isn't resting. A drawing a coming
  incident of this trip will show (the combat fishing, the sow and cubs) is left to the incident (`artTripAhead()`). The other beats
  and decisions show none: no picture on every screen of a trip.
- *The morning report:* one picture. An event (the cabin's mishaps first, then the morning's events, the cabin's news, the night's
  events) on top; with none, your guides' trips. A picture shown there rests like any other, so the next sheet that day doesn't
  repeat it.
- *Camping:* a night's encounter always shows; a camp scene shows on the first screen it fits in a camping trip and not again that trip.
- *The Home tab:* the cabin as it is (heat, season, time of day, condition, what you own). It changes when that changes, not on a
  redraw; equally good pictures take turns by day.

Numbers from 24 bot careers of 4 years (`tools/sim` bots, the off-season played through the real screens; half with Event pop-ups on):
a typical first week shows **about 8 different drawings (250 KB of WebP; 130 to 420 KB)**, each downloaded once (the browser and the
service worker keep it). A trip day: two or three pictures, 60 to 120 KB the first time. `index.html` carries the manifest (32 KB, no
image), so the first load is unchanged apart from that; the title screen loads no picture, and the first Home tab or launch loads one.

**Motion and loading.** The box is sized by CSS before the image arrives (no layout shift) and painted the drawing's average color. The
image fades in over 0.45 s once decoded (`data-ld` on the figure, set by one capturing `load` listener); a picture already shown this
session is drawn at once on a redraw (no second fade); with `prefers-reduced-motion: reduce` there is no fade. A picture that can't load
(offline and not cached yet) gets `data-err` and takes its box away, so a tab shows its drawn scene again. Pictures never move.

**Dark mode.** The figure (placeholder and picture) is dimmed: `brightness(.86) saturate(.95)`.

**Settings → Illustrations.** On by default. Off: every screen is byte-for-byte what it is without art (tested on every hook with the
shipped manifest), so the layout is identical to 1.16.

**Offline.** The single-file offline build (`offline/*.html`) carries no pictures (`build-offline.py` empties the manifest;
`--with-art` would add about 2.8 MB of `data:` URIs). The installed PWA caches each drawing the first time it is shown (`sw.js`,
`ART_MAX` = 60, enough for all 53 at about 2.1 MB), so once seen a picture works offline.

**Alt text.** One picture per screen, so a description is read once. Where the text right below says what the picture shows (every
event: the pop-up's lines, the dilemma, the morning report's item, the storm prompt, the camp encounter), the figure is decorative:
`alt=""` and `aria-hidden="true"`, so nothing is read twice. Scenes (the cabin, the launch, the boat on the river, the dock, the shop,
your guides' launch, camp scenes) keep their `alt`: the text around them doesn't describe them.

## Where the hooks are

| Set | Screen | Code | Context |
|---|---|---|---|
| cabin | the 🏠 Home tab, in the drawn scene's place | `artScene()` from `render()` in `src/js/05-ui.js` | `artCabinCtx()` |
| cabin | the fall sheet "🏠 Get the cabin ready for winter" | `homeWinterModal()` in `32-home.js` | `artCabinCtx()` |
| boat | arriving where one of today's trips launches (the Here tab, in the scene, until the next tap) | `artLaunch()` from `onArrive()` in `src/js/21-story.js` | `artBoatCtx(b, ['launch', 'trailer'])`, or `'harbor'` in Homer |
| boat | the first step of a trip sheet (both the one-sheet trip and "Show every trip step"), when the step has no picture of its own | `tripNext()` in `src/js/22-trips.js` | `artBoatCtx(b, ['launch', 'trailer', 'river'])`, or `['harbor', 'river']` for halibut |
| boat | one stretch of the day (a `beat` step) per trip, a different drawing from the opening one | `artBeat()` from `tripNext()` | `artBoatCtx(b, 'river')` |
| boat | "Back at the dock" | `tripEnd()` in `22-trips.js` | `artBoatCtx(b, ['dock', 'launch' or 'harbor'])` (harbor for halibut and after a Coast Guard tow) |
| boat | a repair at the Shop & Cabin: DIY service, the dealer's 100-hour service, a major repair, an emergency patch, a loaner (the Here tab, in the scene) | the actions in `src/js/20-world.js` | `artShop(cond0)`: `artBoatCtx(null, 'shop')` with `cond` = the boat's condition as it came in (before the work); the patch and loaner at a launch: `'launch'`; the loaner with today's trip |
| boat | your guides' trips in the ☀️ morning report, when no event has a picture: above the first line about them, in the night section | `artMorning()` from `morningReport()` in `src/js/04-loop.js` | `artBoatCtx(b, 'staff')` with `time: "day"` |
| camp | the camping hub, each day, the evening, the night, results inside a trip, breaking camp | `campArtShow()` in `src/js/28-camping.js` (the adapter keeps the session handle; `src/camp/` is unchanged and never sees the game) | `artCampCtx(session, {activity, night})` |
| event | a night's encounter on the camping night screen (wins over the camp picture) | `campArtShow()` | `artEventCtx(id, 'camp')` |
| event | each trip step, above the dilemma (wins over the boat on the first step) | `tripNext()` | `artEventCtx(stepId, 'trip')` (with the cooler and the spot on one sheet: `pack`, then `spot`) |
| event | "Back at the dock" when the fish station spoiled a batch (wins over the boat) | `tripEnd()` | `artEventCtx('spoiled_batch', 'home')` |
| event | an event's OK pop-up (Settings → Event pop-ups on) | `eventPopup()` in `src/js/03-events.js` | `artEventCtx(id, 'game')` (first event with a picture) |
| event | a day-time event with no pop-up (pop-ups off, or today's one used): the Here tab, in the scene, until the next tap | `artNarrEvent()` from `fireHook()` in `03-events.js` | `artEventCtx(id, 'game')` |
| event | the ☀️ morning report, on top | `artMorning()` (morning items carry the event `id`, `endDay()` notes the night's event ids, and the cabin's events of the night and morning are collected by `homeArtNote()` in `32-home.js`: `CabinUpkeep.daily`, a summer outage, a generator that won't start) | first picture among: the cabin's mishaps (`sev` ≥ 1, worst first), the morning's events (`'game'`), the cabin's news (`garden_harvest`, `outage_gen`…), the night's events (`time: "night"`) |
| event | the cabin's storm prompts and their results, the winter and spring reports, a cabin mishap's pop-up | `homeHost().show` in `32-home.js`, given `meta.events` by `src/home/home-30-ui.js` | `artEventCtx(id, 'home')`, the worst event first. A prompt shows its own id (`cold_snap`, `heavy_snow`) before the choice and its outcome (`pipe_burst`, `ice_dam`…) after it, never before; nothing happened: the prompt's id again |

Every hook is `artSlot(set, ctxFunction, o)` (or `artScene`, `artNarr`, `artBeat`, `artMorning`, `homeArt`, built on it): it returns `''`
without building the context when no image is enabled or the player turned illustrations off, and it never throws. `o`: `{rest, key}`
(the routine-scene rule and the screen it is on), `avoid` (drawings to leave out), `deco` (decorative), `peek` (don't count as shown).

## Matching: `when`

An entry is a candidate when **every** key in its `when` matches the context. Its score is the number of keys that matched
something specific (`"any"` matches anything and scores 0); the highest score wins. Tied candidates take turns by game day (each
gets its share; the off-season hashes its season), so the same screen shows the same picture all day. Nothing matches → `null` → the screen is as before.

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
- The picture never carries information the screen doesn't, so players with images off, with Settings → Illustrations off, or with a
  screen reader miss nothing. Event pictures are marked decorative (the text says the same); scenes keep their description.
- No text inside images (it can't be translated, resized or read aloud).
- Pictures don't move (a 0.45 s fade-in on first load, none with reduced motion). Dark mode dims them a little; high contrast and
  text size don't affect them.

## Coverage (1.17.0)

Can every picture come up in normal play? `node tools/sim/art-coverage.js 24 4` (24 bot careers of 4 years, the off-season through
the real screens) showed 44 of the 55 entries; the other 11 need something the bots never buy, and each was then shown through the
real hook with that purchase in the save (`tests/art.test.js` covers the hooks). Counts are showings in the 24 careers.

| Entry | Shown | How |
|---|---|---|
| boat-01 dawn run | 41 | opening step of a sockeye trip (6 AM is the dawn window) |
| boat-02 seam crowd | 5 | a sockeye trip's mid-day stretch (`beat`) |
| boat-03 drift boat | 11 | opening step of a trout float |
| boat-04 Homer charter | 4 | opening step of a halibut charter; arriving at the harbor |
| boat-05 slack tide | 17 | a halibut charter's stretch |
| boat-06 trailer at the launch | 60 | arriving at the launch, opening step |
| boat-07 worn sled in the shop | 5 | a repair at the shop with the boat at 20 or less |
| boat-08 new sled | 21 | the launch, opening step or dock once the new sled is bought (`when` widened to dawn and condition 60+) |
| boat-09 Coast Guard tow | 6 | the dock after a tow |
| boat-10 outfit launch | buy | your assistant's or guides' trip in the morning report, on a morning with no event picture |
| boat-11 combat fishing | 2 | a sockeye stretch (and as `event-16`) |
| boat-12 sow and cubs | 24 | a trout float's opening or stretch (and as `event-17`; left to the incident when one is coming) |
| boat-13 loaner | buy | renting a loaner at the shop or a launch (`where` widened to the shop), arriving with it |
| boat-14 private dock | buy | the dock once the riverfront lot is bought |
| boat-15 June king | 17 | a king trip (June week) |
| boat-16 evening silvers | 47 | a silver trip (1–6 PM: `time` widened to day) |
| cabin-01 / -08 wood stove | buy | the Home tab or the fall sheet in winter with a wood stove (condition 40+ / 75+) |
| cabin-02 summer morning | 1377 | the Home tab by day |
| cabin-03 fly-tying bench | 16 | the off-season Home tab with the vise from camping |
| cabin-04 pantry and freezer | buy | the Home tab by day with the chest freezer (takes turns with -02 and -09) |
| cabin-05 arctic entry | 8 | the off-season Home tab, condition 30–74 |
| cabin-06 outage, generator | 16 | the off-season Home tab with a generator and detectors |
| cabin-07 run-down cabin | 238 | the summer Home tab under condition 35 |
| cabin-09 fish station | buy | the Home tab by day with the fish station and the freezer |
| cabin-10 loft, midnight sun | 1603 | the summer Home tab at night |
| cabin-11 outage, no generator | 16 | the off-season Home tab under condition 30 (`when` moved from any season, where it never won) |
| cabin-12 oil heat | 64 | the off-season Home tab, condition 75+ |
| camp-01 aurora | 4 | an aurora evening in a tent, clear sky (`place` widened to any) |
| camp-02 ice fishing | 37 | ice fishing at Johnson or Stormy Lake (`place` and `weather` widened) |
| camp-03 wall tent | 4 | a wall-tent evening (`place` widened) |
| camp-04 truck camper | 15 | a day in the truck camper (`place` and `weather` widened) |
| camp-05 public-use cabin | 2 | snowshoeing from the Skilak cabin (`weather` widened) |
| camp-06 moose tracks | 1 | tracking at Anchor River |
| camp-07 scouting | 1 | scouting at Quartz Creek on a clear day |
| camp-08 fly tying by the fire | 56 | an evening tying flies |
| camp-09 Homer Spit | 5 | a day on the Spit |
| camp-10 snowstorm | 3 | a night in a tent in a snowstorm |
| event-01 to -04 (moose, flat, trooper, gossip) | 226, 40, 225, 307 | the pop-up, or over the narration with pop-ups off (new hook) |
| event-05 midnight sun, -06 bear in the bin | 136, 18 | the morning report (night events) |
| event-07 cold snap | 64 | the storm prompt |
| event-08 burst pipe, -10 breakup, -11 frozen pipes, -14 ice dam | 3, 7, 3, 5 | storm outcomes, the spring report |
| event-09 chimney fire | buy | the winter report with a wood stove |
| event-12 garden moose | buy | the morning report on the garden's harvest day (`time` widened: it comes at dawn) |
| event-13 earthquake | rare | the spring report (1 in the first 24-career run, 0 in the second) |
| event-15 CO alarm | rare | the winter report with detectors: about 1.5% of winters, and it shows unless a chimney fire beats it |
| event-16 combat, -17 sow and cubs | 89, 48 | the trip incidents, above the dilemma |

## Checklist for a set

- [ ] PNGs at 1600×900, thumbs at 400×225, subject in the central 70% of the width, no text, matches the game's palette
- [ ] Looked at the 2:1 crop (and 30vh in landscape): a low subject gets a `focus` (`"50% 70%"`)
- [ ] `manifest.json`: unique ids, one-sentence `alt` for each, only the set's `when` keys (notes in `notes`/`meta`), `from` on events
- [ ] `python3 tools/art.py import <folder>` then `python3 tools/art.py validate --strict` is clean (≤ 150 KB per image, ≤ 2 MB per set)
- [ ] Looked at each picture in the game at 390×844, light and dark, and with Settings → Illustrations off
- [ ] Enabled only the reviewed entries; `python3 tools/build.py`; `python3 tools/build.py --check` clean
- [ ] `node tests/run.js` green (the art tests check that disabled entries change nothing)
- [ ] A line under `## Unreleased` in `CHANGELOG.md`
