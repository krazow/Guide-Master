# Guide Master

**Two weeks guiding the Kenai.** A mobile game (installable PWA, works offline) about life as a charter fishing guide on Alaska's Kenai Peninsula, built for July 13–26, 2026: the peak of the late sockeye run.

You run a small guide business out of Soldotna with a jet sled, a drift boat, a stack of credentials and a phone that won't stop ringing. Meet your clients at the launch by 6 AM, find them fish, keep them happy, fill out your logbook, and stay on the right side of the rules. Three citations and Alaska State Parks pulls your Kenai River guide permit.

## The Kenai

- **Places:** your shop & cabin in Soldotna, town (tackle shop, ADF&G office, diner, clinic), the lower Kenai launch at Centennial Park, Cooper Landing and the Russian River, Kenai City Beach (the dipnet fishery) and the Homer Spit.
- **Trips:** lower-river sockeye trips, early silver (coho) back-trolling, upper-river drift-boat trout floats, and a Homer halibut charter captained on a friend's permit.
- **Lore:** glacial-flour turquoise water, combat fishing at the Russian River confluence, Les Anderson's 97 lb 4 oz world-record king (1985), brown bears on the gravel bars, the midnight sun, the river-mile-19 sockeye sonar, Cook Inlet tides, Friday traffic on the Sterling Highway, Kahtnu (the Dena'ina name for the Kenai).

## The rules it models

Every trip throws decisions at you, and the first option is always the legal one. Among them:

- Kenai kings closed in 2026 by emergency order (no catch-and-release; release by accident without lifting the fish out of the water).
- Below Skilak, Jun 20–Aug 15: one unbaited, single-hook, artificial lure.
- Guide vessels below Skilak, May 1–Jul 31: no fishing Sundays or Mondays, otherwise 6 AM–6 PM only; in July, no more than 5 people aboard while fishing (5 clients only if they fish from shore).
- Guides may not fish while clients are present; rods can't outnumber clients.
- Sockeye hooked in the mouth only; bag limits are per person and change by emergency order.
- KRSMA: 50 hp and 6-person limits, no anchoring in the drift channel, closed habitat banks.
- Russian River fly-fishing-only water and "stop, chop and throw" for carcasses.
- Personal-use dipnetting is for Alaska residents only, with tail clipping and permit records.
- 2026 Area 3A charter halibut: 2 a day (one 27 inches or less), no retention Tuesdays and Wednesdays, no fish for captain or crew.
- Credentials: ADF&G guide and business licenses, USCG six-pack license, State Parks KRSMA permit, vessel decals, a current first-aid/CPR card and the ADF&G logbook.

> **Disclaimer:** this is a simplified summary for a game. Real regulations change every season and by emergency order. Before you fish, check the current regulations and emergency orders at [adfg.alaska.gov](https://www.adfg.alaska.gov).

**Sources:** ADF&G 2026 Southcentral sport fishing regulations (Kenai River, Kenai Peninsula and guiding sections); ADF&G Emergency Order 2-KS-1-7-26 (Kenai late-run kings closed, gear restrictions); 11 AAC 20 (Kenai River Special Management Area); NOAA Fisheries / IPHC 2026 Area 3A charter halibut management measures; Alaska State Parks Kenai River guide permit requirements.

## Careers: 2, 5 or 10 years

When you start a new game you pick a **2-, 5- or 10-year career** (`src/js/24-career.js`). Each season you play the two-week July peak, Monday to Sunday, starting on the Monday nearest July 13 (2026: Jul 13; 2027: Jul 12; 2028: Jul 10…). Between seasons comes the **off-season**:

- **Recap and bills:** the year's trips and earnings, then winter living costs, license and permit renewals (ADF&G guide and business licenses, KRSMA permit, decals) and insurance.
- **Next year's rules and runs:** season 1 is the real 2026 (kings closed, single-hook/no-bait, Area 3A halibut 27-inch second fish, no retention Tue/Wed). Later seasons are invented but plausible. The sockeye and coho forecasts vary in size and timing, and kings may be closed, catch-and-release only or open (1 a day, harvest record). Bait is allowed when kings are open. The halibut size limit and closed days shift too. Weak sockeye years can bring an emergency order cutting the limit to 2; strong years raise it to 6. Pinks run only in even years.
- **Upgrades:** rebuild the outboard (still 50 hp), a new jet sled, a new drift boat, marketing, a winter course, rate increases (need Rep 65+), or a Charter Halibut Permit so you run your own Homer charters.
- **Bookings:** next season's bookings depend on your reputation, marketing and rates.
- **Your record:** a first-aid/CPR card lasts two years. Citations drop off after the following season; three active citations still cost you the permit.

The score covers the whole career (net cash, half the value of what you bought, rep, trips, a clean record), and the grade is per season, so careers of any length compare.

## Fuel, towing and prices

`src/js/25-fuel.js`:

- **Fuel gauge** (HUD): the jet sled has a 30-gallon tank (40 with the new sled) and starts season 1 at 18 gallons. A sockeye trip burns about 9 gallons, a silver trip about 11 and scouting about 4. Long runs (Swiftwater, Moose Range Meadows, the Barren Islands) and wind over 12 kt burn more. Drift-boat floats burn nothing.
- **Harbor-only fueling:** the sled fills only at the **Kenai Harbor** fuel dock (Kenai City Dock at the river mouth, 6 AM–10 PM). Your own Homer charter boat (100 gal, ~45 a day) fills at the Homer Harbor fuel dock. A low tank at launch gives you two choices: send the clients for coffee and run to the harbor (about 65 minutes; they notice), or risk it.
- **Running dry:** the Coast Guard tows you to Kenai Harbor and the harbormaster brings you to the fuel dock for $102 (Homer's harbor tariff rate). The trip is cut short with half the fare refunded, you lose rep, and the boarding may turn up an expired flare kit. Solo outings and scouting can run dry too.
- **Prices (approximate, 2026):** marine gas starts at $6.19/gal at Kenai and $6.45 at Homer (pump gas on the Peninsula was about $5.14–5.55) and drifts each season. DIY boat service is $165 in parts; a dealer 100-hour service is $525. Tackle is $120 for four trips; a broken rod and reel costs $165. The motorized launch fee is $15.
- **Upgrades** at realistic prices: repower with a new 50 hp jet outboard $13,500; new 20-ft welded sled, motor and trailer $52,000; drift boat and trailer $12,500; Charter Halibut Permit plus a used 28-ft six-pack boat $165,000.
- **The rest of the summer:** you play the July peak, and the off-season settles June, August and September. That's about 2.4× your July trip count, scaled by reputation, at your July fares minus fuel, launches and tackle, so realistic boat prices are reachable over a career.

## Fish, weather and timing

`src/js/23-fish.js` models when and where fish are, and drives trip quality, the daily sonar count, dipnetting and solo boat days:

- **Run timing by date** for late-run sockeye (peak at the river-mile-19 sonar around Jul 20–25, reaching the upper river about two weeks later), coho (first fish late July, peak mid-August), pinks (even years only, so 2026 has them), late-run kings (closed), resident rainbows and Dolly Varden, and summer halibut. Daily run pulses vary around the curve.
- **Weather** every morning: temperature, wind, rain and the Kenai's glacial river level (rain and warm-day melt raise it). Rising, dirty water scatters reds; overcast helps trout; wind over 18 kt sours Cook Inlet halibut trips and raises the odds of Skilak and Barren Islands blowups.
- **Tides** at the mouth (semi-diurnal with a spring/neap cycle): reds ride the flood tide into the dipnetters; halibut bite at slack water.
- **Time of day**: first light and long July evenings beat midday sun and crowds.
- **🚤 Take the boat out** at the lower launch or Cooper Landing. It checks your bookings first: the boat can't go while a party is on the dock, and solo runs are capped so you're back an hour before your next launch (plus drive time). Without clients your sled is still a *registered guide vessel*, so the Sun/Mon closure and the 6 AM–6 PM hours below Skilak still apply. Pick a species with live odds, fish 2–6 hours, fill the freezer within bag limits, release any king, and get a scouting bonus for your next trip.
- **🐟 Fish tab**: today's weather, river level, tide table, odds by place and species, and a run-timing chart with your two weeks and today marked.

This is a simplified model of typical run timing, not a forecast.

## Play

Open `index.html`, or deploy the folder to any static https host (GitHub Pages works: `.nojekyll` is included) and install it from the browser. `offline/guidemaster-offline.html` (from `python3 tools/build-offline.py`) runs by double-clicking.

## Build & test

```bash
python3 tools/build.py            # src/ → index.html
python3 -m http.server 8000       # then open http://localhost:8000
npm install && npx playwright install chromium
npm test
```

The game itself lives in `src/js/20-world.js` (places, trips, bookings, tabs), `src/js/21-story.js` (story, events, scoring) and `src/js/22-trips.js` (the trip runner and the regulation dilemmas).

## Built on the Pocket Week / Island Time PWA template

Guide Master is built on [krazow/framework](https://github.com/krazow/framework), the engine behind Island Time: one HTML file, no framework, no bundler, no runtime dependencies. It provides the mobile shell (HUD, scenes, tabs, bottom-sheet modals, toasts), a turn-based day loop, a random-event engine, autosaves with 3 slots, migrations and transfer codes, an offline service worker, accessibility settings, achievements, synthesized sound and a Playwright test suite.

`tools/build.py` concatenates `src/shell.html` + `src/style.css` + `src/js/*.js` (in file-name order) into `index.html`. All game state lives in one object, `S`; after every tap `render()` rebuilds the screen and autosaves.

### Engine API for your content

| Call | What it does |
|---|---|
| `pass(min)` | Let time pass (it also runs your `onTime`) |
| `say(html)` | Narrate at the top of the Here tab and add to the Log |
| `adj('stress', 5)` / `money(-12)` | Nudge a 0–100 stat (clamped) / change cash |
| `go('cafe')` | Travel (plays a transition for long trips; fires `travel` and `arrive`) |
| `endDay('home')` | Sleep: runs `onNight`, the `night` hook and the summary, then the next morning |
| `modal(title, html, [{l, s, fn, dis}])` | Bottom sheet; queued if one is open |
| `showTile(ic, title, sub, 'good'|'bad'|'warn'|'info')` | Toast at the top |
| `transition(ic, caption, sub, done)` | Full-screen interstitial, tap to skip |
| `defEvent({...})` / `chain(id)` / `fireHook(name, ctx)` | Random events; see the header of `03-events.js` |
| `sfx('good')` / `buzz(30)` | Sound / vibration. Add sounds to `SFX` in `01-core.js` |
| `isOpen(loc)` / `hoursTxt(loc)` / `fmt(min)` / `tod()` / `day()` | Time helpers |
| `{{name}}` in any text | The player's current name, updated everywhere when it changes |

Hooks your content implements: `newState`, `onNewGame`, `onMorning(d)`, `onNight(where, notes, d)`, `onTime(min)` (optional), `onArrive(dest, from)` (optional), `daySummary(d)` (optional), `travelMins(a, b)`, `checkLoss()`.

## Saves and updates

- When you add a field, put it in `newState()`. Old saves get it automatically.
- When you rename or restructure a field, bump `GAME.schema` and add a `MIGRATIONS` entry. The player sees a short "upgraded from an older version" note.
- On every release, bump `GAME.version` and rebuild. Installed copies pick up the new cache.

## Deploy

It's a static site. On **GitHub Pages**, push the repo and turn on Pages for the branch root (`.nojekyll` is already there). Netlify, Cloudflare Pages and any static host work too. The site must be served over https to install and run offline.

`python3 tools/build-offline.py` also writes `offline/<id>-offline.html`: the whole game as one file that runs by double-clicking it, with no server needed. It's handy for sharing by email or USB.

## Tests

```bash
npm install
npx playwright install chromium
npm test                     # or: node tests/run.js save   (filter by name)
```

Every `tests/*.test.js` runs against `index.html`, and against the offline build if it exists. `smoke.test.js` is a bot that clicks at random for 1,500 steps across several games and fails on any page error. CI (`.github/workflows/test.yml`) runs the build check and the tests on every push.
