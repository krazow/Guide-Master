# KenaiCamp: the winter-camping engine

A self-contained winter camping game for the Kenai Peninsula, Alaska. For now it lives inside Guide Master (the guide's off-season camping trips); it is built so that it can move to its own repository and become **Kenai Winter Camp** with no changes to the engine.

## Rules of the boundary

- One global, `KenaiCamp`. Nothing else is created.
- It never reads or writes Guide Master's state (`S`), pop-ups (`modal`), clock (`GAME`), saves or migrations. `tests/camp-engine.test.js` checks the source for those names and runs the whole engine in an empty sandbox.
- Everything it needs comes in through a **ticket** and a **host** adapter. Everything it produces goes out in a **report**.
- The only browser storage it uses has keys starting with `kenaicamp:`: `kenaicamp:journal` (animals ever seen on this device) and, in solo mode only, `kenaicamp:solo`.
- `KenaiCamp.SCHEMA` (currently 1) versions the ticket, the report and the stored data. Bump it when any shape changes.

## Files (concatenated in name order by `tools/build.py`, before `src/js/*.js`)

| File | What it holds |
|---|---|
| `camp-00-core.js` | the `KenaiCamp` namespace, constants, small utilities, the `kenaicamp:` storage wrapper |
| `camp-10-data.js` | places, months, gear, shelters, animals, encounters and weather, winter work, achievements |
| `camp-20-engine.js` | the state machine: `KenaiCamp.session(ticket, {rand})` with `view()`, `choose(id)`, `report()` |
| `camp-30-ui.js` | `KenaiCamp.start()`, the journal, the solo save, `logView()` |
| `camp-40-sim.js` | `KenaiCamp.sim()` and bot policies, for tests and balancing |
| `standalone.html` | the shell for the dev-only solo page (`tools/build-camp.py`); not an engine file |

## API

```js
KenaiCamp.start({ mode: 'guide' | 'solo', ticket, host })   // opens the winter hub; returns { session, stop() }
KenaiCamp.session(ticket, { rand })                         // the pure state machine
KenaiCamp.sim({ ticket, seed | rand, policy })              // play a whole visit with no screen → { report, steps }
KenaiCamp.solo.{load, save, reset, ticket, apply, newWinter}// the solo save
KenaiCamp.journal.{load, merge}                             // the shared species journal
KenaiCamp.logView(seen)                                     // {title, html} for a read-only animal log
KenaiCamp.data                                              // all content (places, months, gear, encounters, ...)
```

`session.view()` returns `{ title, html, buttons: [{ id, l, s, dis }], exit, meta }`; `session.choose(id)` moves on (returns `false` for a disabled or unknown choice); `session.report()` returns the report at any time; `session.done` is true after the visit ends. Because every screen is data, the engine runs headless: `KenaiCamp.sim` plays it with a policy (`'first'`, `'random'`, `'thoughtful'`, or your own `(view, state) => id`).

### The host adapter

```js
host = {
  show(title, html, buttons, lock),   // required. Show a pop-up. buttons: [{ l, s, dis, fn }]; call fn when the player taps one,
                                      // after the pop-up has closed. lock=true means Esc must not dismiss it.
  onFinish(report, soloSave),         // the visit ended: apply the report (soloSave is set only in solo mode)
  toast(msg),                         // optional
  rand(),                             // optional, [0,1); defaults to Math.random
  now(),                              // optional, ms
}
```

Pop-ups should be accessible: focus moves into the dialog, Tab stays inside, buttons are at least 44 px tall. `standalone.html` has a minimal example.

### The ticket (host → engine)

| Field | Meaning |
|---|---|
| `mode` | `'guide'` or `'solo'` |
| `year` | the calendar year the winter starts in (November and December are this year; January to March the next) |
| `cash`, `energy`, `rep`, `skill` | the player's numbers |
| `gas`, `mpg`, `costMult` | pump gas a gallon, the truck's mileage, the difficulty's multiplier for gas, supplies and fees |
| `gear` | ids of owned gear: `bear fuel bag layers truck ice picks vise` and shelters `wall camper` |
| `licYear` | calendar year of the last fishing license bought (0 for none) |
| `food` | `{ meals, freezerRoom }`: the freezer room caps how many fish can come home |
| `regulars` | `[{ id, name, mood 0-100 }]`: returning clients and how their last trip went |
| `rival` | `{ id, name, mood }` or `null`: only when he has been met; invited only if `mood >= 0` |
| `guideFriend` | `true` to allow inviting a fellow guide |
| `daysLeft`, `tripsLeft`, `gigsLeft`, `gigsDone` | what is left of this winter's budget (10 days, 3 trips, 2 jobs) |
| `seen`, `ach`, `noTraceTrips` | the animal log so far, achievements already earned, clean camps so far |

Missing fields get defaults (`KenaiCamp.normTicket`).

### The report (engine → host)

| Field | Meaning |
|---|---|
| `cashDelta`, `spent`, `earned` | net cash change (negative is a cost), total spent, total earned from winter jobs |
| `energyDelta`, `repDelta`, `skillDelta` | changes to apply (clamp as the host sees fit) |
| `womDelta`, `bookingBoost`, `firstTripBoost` | word of mouth; a small add to next season's daily chance of a booking (max .02); a small add to the catch on the first few trips (max .03) |
| `foodFish`, `tackleCredit` | fish for the freezer; trips' worth of tackle |
| `scout` | `null` or `{ areas: ['upper' \| 'kasilof'], points, hint: true }`: the host decides what hint to give |
| `relations` | `[{ id, kind: 'regular' \| 'guide' \| 'rival', name, delta }]`, delta from -3 to +4 |
| `speciesSeen`, `newSpecies` | counts seen this visit; ids new to the player's log |
| `achievements` | ids newly earned (`every_animal`, `no_trace`) |
| `daysUsed`, `tripsTaken`, `gigs`, `nights`, `encounters`, `noTraceTrips` | counters |
| `gearBought`, `license` | gear ids bought (apply to `gear`); `{ year }` if a license was bought |
| `log`, `trips` | the visit as lines and per-trip summaries, for the host's own summary or end screen |

The host applies it once, in `onFinish`. If the player leaves before finishing, nothing is applied and nothing was spent.

## Modes

- **guide**: the light version inside Guide Master, driven by a ticket built from the save.
- **solo**: a bare standalone mode. `KenaiCamp.solo.ticket()` is a fixed starting ticket (cash 1,500, rep 55, two regulars, no rival) and a tiny save under `kenaicamp:solo`. `tools/build-camp.py` writes `dist-camp/kenai-camp.html`, which runs it with a minimal host: open it from disk to try the engine on its own.

## Moving it to its own repository

1. Copy `src/camp/` to the new repo. The engine files (`camp-*.js`) and `standalone.html` need nothing else.
2. Build the page the same way `tools/build-camp.py` does: put the concatenated `camp-*.js` in a `<script>` inside `standalone.html` (replace `/*@CAMP@*/`), then add the usual manifest, icons and service worker for a PWA. Keep the `kenaicamp:` storage prefix.
3. In Guide Master, either keep the adapter (`src/js/28-camping.js`) and load a published copy of the engine before it, or drop camping and the adapter together. The adapter is the only file here that knows about `S`.
4. Tests: `tests/camp-engine.test.js` runs in Node with no browser (it loads the files into an empty `vm` context) except for the standalone-page test, which needs Playwright. Port both as they are.
5. To grow it into a full game, replace `KenaiCamp.solo` with a real career (carry cash, gear, the license year and the log between winters) and add more places and activities in `camp-10-data.js`.

## Facts and estimates

Distances come from Sterling Highway mileposts. Daylight hours are rounded for about 60.5°N. Prices (license, gear, shelters, cabins, jobs) and odds are estimates for play, not quotes. Public-use cabin locations and rates are given in general terms. Winter event dates are never stated.
