# Crab: crabbing for a Kenai guide

A small module for the crab side of a guide's year: a **Dungeness pot** in Kachemak Bay on a free afternoon in a Homer week (personal
and subsistence use: the freezer or a crab feed, never a sale), a **Tanner pot** in the bay on a winter day when that fishery opens,
and a **winter deckhand job** on a Bering Sea crab boat out of Dutch Harbor. It lives inside Guide Master for now and follows the
camping engine's pattern (`src/camp/README.md`) so it can be reused or moved without changes.

## Rules of the boundary

- One global, `Crab`. Nothing else is created.
- It never reads or writes Guide Master's state (`S`), pop-ups (`modal`), clock (`GAME`), saves or migrations. `tests/crab.test.js`
  checks the source for those names and runs the whole module in an empty `vm` sandbox.
- Everything it needs comes in through a **ticket** (with its own **state**, which the host stores and hands back). Everything it
  produces goes out in a **report** that the host applies. `src/js/44-crab.js` is the thin Guide Master adapter.
- It touches no browser storage. Randomness comes from `{rand}` (default `Math.random`).
- `Crab.SCHEMA` (currently 1) versions the ticket, the report and the state. Bump it when any shape changes.

## Files (concatenated in name order by `tools/build.py`, after `src/camp/`, `src/home/` and before `src/js/*.js`)

| File | What it holds |
|---|---|
| `crab-00-core.js` | the `Crab` namespace, small utilities, a seeded generator |
| `crab-10-data.js` | rules, prices, odds, shares, outlook words, `EVENTS` |
| `crab-20-engine.js` | the state, the ticket, openings by year, the pot, the cooler, the winter options, the deckhand job's state machine |
| `crab-30-ui.js` | `Crab.ui`: the pot, the cooler, the winter sheet and the job, through the host's pop-ups |
| `crab-40-sim.js` | `Crab.autoJob`, `Crab.autoSummer` and the job policies, for tests and balancing |

## API

```js
Crab.newState() / normState(x) / normTicket(t)
Crab.prep(ticket, {rand})              // roll this year's openings into the state (idempotent) and return it
Crab.isOpen(ticket, 'dung' | 'tanner')
Crab.potOptions(ticket)                // summer, at Homer: [{id: 'set'|'pull'|'cooler', ic, l, s, dis, why}]
Crab.setPot(ticket, {rand}) / pullPot(ticket, {rand}) → report
Crab.useCrab(ticket, 'freezer' | 'feed') → report      // crab in the cooler; there is no 'sell'
Crab.winterOptions(ticket)             // [{id: 'cooler'|'kit'|'tanner'|'job', ...}]
Crab.buyKit(ticket) → report;  Crab.tannerDay(ticket, {rand}) → report
Crab.job(ticket, {rand})               // {phase, done, view(), choose(id), report()}: intro → (nohire) → hired → drill → storm → sort → ice → pay
Crab.status(ticket)                    // [[label, value]]
Crab.ui.pot(host, id, done) / cooler(host, done) / winter(host, back) / job(host, done)
Crab.autoJob(ticket, {rand, policy}) → {report, steps};  Crab.autoSummer(ticket, {rand, use, next}) → [report]
Crab.policies                          // 'careful' | 'reckless' | 'first'
```

`job.view()` returns `{title, html, buttons: [{id, l, s, dis}], meta: {phase, events}}`; `choose(id)` returns `false` for an unknown
or disabled choice. The report grows as the job goes and is complete when `done`; the host applies it once, at the end. Leaving at
the intro costs nothing; a failed hire costs the airfare (if you flew) and two free days.

### The host adapter (for `ui.*`)

```js
host = {
  show(title, html, buttons, lock, meta), // required. buttons: [{l, s, dis, fn}]; fn runs after the pop-up has closed. lock: Esc must not dismiss it.
                                          // meta (optional): {events: [{id, sev}]} from Crab.data.EVENTS, for an illustration
  ticket(),                               // required. A fresh ticket (it changes after every report)
  apply(report),                          // required
  rand(),                                 // optional
}
```

### The ticket (host → module)

| Field | Meaning |
|---|---|
| `state` | the module's own state (opaque to the host) |
| `phase` | `'summer'` or `'winter'` |
| `year` | summer: the calendar year of the summer; winter: the year the winter starts (Tanner runs Oct 1 to Feb 28) |
| `season`, `day`, `tod` | the host's season index, a running day count (soak time), minutes since midnight |
| `freeMin` | minutes before the player must leave for the next booked trip today |
| `atHomer` | at the Homer Spit, not on a trip |
| `cash`, `energy`, `rep`, `skill` | the player's numbers |
| `costMult` | the difficulty's multiplier for prices (airfare, gear, bait, skiff) |
| `ownBoat` | the player runs a charter boat out of Homer (no skiff to borrow) |
| `daysLeft` | free winter days left (shared by the host with camping, the cabin and winter work) |
| `freezerRoom` | meals of room in the freezer |

### The report (module → host)

| Field | Meaning |
|---|---|
| `state` | the new state: store it |
| `cashDelta`, `spent`, `earned` | net cash change, what was spent, what was paid (the crew share) |
| `energyDelta`, `repDelta`, `womDelta`, `skillDelta` | changes to apply |
| `minutes` | minutes of the summer day used |
| `daysUsed` | free winter days used |
| `meals` | meals of crab meat for the household (Guide Master: four to a freezer "red", the rest to the pantry) |
| `sore` | mornings of next season that start sore after an injury (Guide Master: energy −8 each) |
| `lines`, `severity`, `events` | player-facing lines; 0 nothing, 1 a mishap, 2 serious; `[{id, sev}]` from `Crab.data.EVENTS` |

`Crab.data.EVENTS`: `pot_set`, `pot_pull` (pulling a pot in Kachemak Bay), `pot_lost`, `crab_feed`, `tanner_measure` (measuring a
Tanner crab), `tanner_closed`, `job_hired`, `job_greenhorn`, `suit_drill` (a survival-suit drill on deck), `hauling` (setting and
hauling in a storm), `sorting`, `heavy_seas_ice` (a crab boat in heavy seas with ice), `job_payout`, `job_injury`, `job_not_paid`,
`job_closed`.

## Guardrails

- **Never a money machine, never a career-ender.** The pot is food and goodwill, never cash. The job is a modest, risky alternative to
  a winter of camping and winter work: a greenhorn nets a couple of thousand dollars on average, with real downside (a failed hire,
  a short season, an injury, a skipper who pays a third). The worst case is a few thousand dollars and a sore start to the season.
- **Closed years say so.** The Dungeness subsistence fishery is open in a summer about three times in four (it is new); Kachemak Bay
  Tanner opens in a winter a bit less than half the time (it needs a survey with enough legal males). The option shows the closure.
- **No sales.** Sport, personal-use and subsistence crab is for the household and friends; the sell button is always disabled, with
  the reason.
- **Safety first in the text.** Survival suits, drills, never standing between a swinging pot and the rail, ice on the rails.

## Facts and sources (checked November 2026)

- Cook Inlet / Kachemak Bay Tanner crab: noncommercial season Oct 1 to Feb 28, permit and harvest report, males only, at least
  4½ inches across the shell including the spines, only whole crab off the boat (ADF&G 2026 Southcentral shellfish regulations).
  Opening depends on the survey's legal males; the fishery last opened in 2011–12 and stayed closed until 2017–18, when the limit
  was one pot and three crab (Peninsula Clarion, July 2017).
- Cook Inlet Dungeness subsistence: reopened July 1, 2025 (through March 2026), the first in decades; southern Kachemak Bay around
  Seldovia, Port Graham and Nanwalek; Alaska residents with a permit; males only, at least 6½ inches; one pot a person, at most three
  a boat; harvest reporting (KBBI, July 2025). Dungeness is closed to sport and personal-use pots in Cook Inlet (2026 regulations).
- Pots in Cook Inlet: buoys marked with name and address (and the boat), a biodegradable escape mechanism, two escape rings, no
  floating line at the pot, and nobody may pull another person's pot (2026 regulations).
- Out west: Kodiak, Chignik and South Peninsula Tanner stayed closed for 2026 (too few legal males in the 2025 survey; Alaska Public
  Media / KMXT, Oct 2025). Bering Sea 2025–26: snow crab 9.3 million lb, Bristol Bay red king crab about 2.7 million, Bering Sea Tanner
  about 11.3 million (SeafoodSource). 2026–27, opening Oct 15: Bristol Bay red king crab 3.41 million lb, snow crab 5.1 million,
  Tanner 32.1 million (Baird Maritime, Oct 2026). Southeast Tanner and golden king crab opened Feb 18, 2026, a day late for gales and
  freezing spray (ADF&G). The game keeps the job general: a Bering Sea crab boat out of Dutch Harbor, with a yearly outlook (good,
  fair, thin) instead of real quotas.
- The commercial crewmember license: about $165 for a resident (ADF&G vendor form; treat it as an estimate).

**Estimates, not checked:** the pot ($240), bait, the skiff, airfare to Dutch Harbor ($1,100), a night in Unalaska ($150), crab gear
($420), every share and probability, the injury bills (after the boat's insurance) and the soak curve.
