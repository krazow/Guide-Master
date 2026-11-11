# CabinUpkeep: keeping up a cabin on the Kenai

A small module for the chores, repairs and bad luck of a cabin in Soldotna, Alaska: heat, frozen pipes, snow, a generator, a well and septic tank, bears, a fish table, a garden and its moose, smoke and CO detectors, spring breakup and earthquakes. For now it lives inside Guide Master; it follows the same pattern as the camping engine (`src/camp/README.md`) so it can be reused or moved without changes.

## Rules of the boundary

- One global, `CabinUpkeep`. Nothing else is created.
- It never reads or writes Guide Master's state (`S`), pop-ups (`modal`), clock (`GAME`), saves or migrations. `tests/home.test.js` checks the source for those names and runs the whole module in an empty sandbox.
- Everything it needs comes in through a **ticket** (and its own **state**, which the host stores and hands back). Everything it produces goes out in a **report** that the host applies. `src/js/32-home.js` is the thin Guide Master adapter.
- It touches no browser storage.
- `CabinUpkeep.SCHEMA` (currently 1) versions the ticket, the report and the state. Bump it when any shape changes, and add a migration in the host.

## Guardrails (what the module promises)

- **Three ways, always.** Every job offers do it yourself (time and energy, a little cash), pay someone (cash) or skip it (a risk).
- **Never more than two jobs at once** (`CabinUpkeep.MAX_DUE`). A storm prompt (cold snap, heavy snow) comes first, then jobs by priority. A skipped yearly job does not come back until next year.
- **Home trouble costs money, days, energy or a little rep. It never ends a career**: the host caps how far home trouble can push cash down (Guide Master: −$1,200; the rest is waived as local credit), nothing here touches the loss rules, and the worst single mishap is a few thousand dollars and a few days.
- **Warn first.** A job names its risk before you skip it, a reminder surfaces one due job a day, and the cabin's condition is on screen.
- **A run-down cabin has more bad luck.** Condition runs 0 to 100 (starts at 80). It drifts down 0.5 a July day and 8 an off-season; each job restores 2 to 8. Every event's chance is scaled by `0.7 + 0.9 × (1 − condition/100)` (0.7 when perfect, 1.6 when falling apart) and by the difficulty's bad luck (square-rooted: a 1.5 difficulty makes the cabin about 1.22 times as unlucky).

## The year

A **cycle** is one July (14 days) plus the winter before it. The host says which part it is in the ticket (`phase`):

| Phase | What happens |
|---|---|
| `fall` | the off-season, before the winter's storms: heating oil or firewood, chimney sweep, heat tape, skirting, detectors |
| (roll) | `rollWinter`: a cold snap and a heavy snow become **prompts** in the state's queue; chimney fires, carbon monoxide and a cold cabin after a long outage resolve on the spot. Condition drifts down. |
| `spring` | after the storms: breakup (driveway, foundation), well water test, septic |
| (roll) | `rollSpring`: breakup, the well, the septic tank and a rare earthquake resolve, as the bookings open |
| `summer` | July: bear bins, generator oil and a test run, the garden and its fence, the fish station; `daily` runs each morning |

The off-season costs **free days**, not minutes: the host passes `daysLeft` (Guide Master shares its 10-day winter budget with camping) and a do-it-yourself job in the off-season spends days; in July it spends minutes of the day. Jobs marked "any time" (heat tape, skirting, detectors, strapping the water heater) can be done in any phase.

## API

```js
CabinUpkeep.newState() / normState(x)             // a fresh state; fill in whatever an older state lacks
CabinUpkeep.jobs(ticket, { all })                 // jobs due now: [{ id, ic, kind: 'task'|'event', title, why, risk, opts: [{ id: 'diy'|'pay'|'skip', l, s, cash, min, days, energy, dis, why }] }]
CabinUpkeep.dueCount(ticket)                      // how many are due in all (the list shows at most MAX_DUE)
CabinUpkeep.resolve(ticket, jobId, optId, { rand }) → report
CabinUpkeep.daily(ticket, { rand }) → report      // a July morning: drift, a bear (once a summer), the garden harvest, one reminder
CabinUpkeep.rollWinter(ticket, { rand }) / rollSpring(...) → report
CabinUpkeep.genOdds(ticket) → { p, why[] }        // the chance the generator will not start; genFailed(ticket) → report (the shop gets it going: $85)
CabinUpkeep.noteGen(ticket) → report              // a generator you just bought is in shape
CabinUpkeep.processing(ticket, { rand }) → report // a trip's fish at the processing station: a fee, or a spoiled batch
CabinUpkeep.shop(ticket) / buy(ticket, id) → …    // wood stove, fish processing station, bear-resistant bin
CabinUpkeep.status(ticket)                        // rows for the Home tab
CabinUpkeep.ui.tab(ticket) / open(host, jobId) / shop(host, back) / scenes(host, rep, done) / report(host, title, rep, done)
CabinUpkeep.autoplay(host, { policy, rand })      // headless: 'careful' | 'payall' | 'neglect' | 'first' | your own (job, ticket) → 'diy'|'pay'|'skip'|null
```

### The host adapter (for `ui.*`)

```js
host = {
  show(title, html, buttons, lock),   // required. Show a pop-up. buttons: [{ l, s, dis, fn }]; call fn after the pop-up has closed. lock=true: Esc must not dismiss it.
  ticket(),                           // required. A fresh ticket from the host's numbers (it changes after every report).
  apply(report),                      // required. Apply a report.
  rand(),                             // optional, [0,1)
}
```

`ui.tab(ticket)` returns the Home tab as HTML. Its buttons carry `data-cab="job"` (with `data-id`) or `data-cab="shop"`; the host listens for those clicks and calls `ui.open` / `ui.shop`. Pop-ups should be accessible: focus inside, Tab stays in, 44 px targets.

### The ticket (host → module)

| Field | Meaning |
|---|---|
| `state` | the module's own state (opaque to the host) |
| `phase` | `'summer'`, `'fall'` or `'spring'` |
| `season`, `sday`, `abs` | the cycle number (0 is the first July), the day of the July (0 to 13), a running day count |
| `cash`, `energy`, `rep` | the player's numbers |
| `daysLeft` | free off-season days left (the host shares them with other things) |
| `atHome` | in July, whether the player is at the cabin (do-it-yourself needs it) |
| `costMult`, `bad` | the difficulty's multiplier for prices, and for bad luck |
| `gen` | `{ owned, gas: 'ok'|'stale' }` |
| `homeFuel` | gallons of home gas (a test run of the generator burns half a gallon) |
| `outage` | this winter's power outage `{ h, gen }` or `null` (a long outage with no generator and no stove chills the cabin) |
| `recentFish`, `fish`, `clients` | trips with fish at home in the last few days; for `processing`, the fish and clients of the trip |

### The report (module → host)

| Field | Meaning |
|---|---|
| `state` | the new state: store it |
| `cashDelta`, `spent`, `earned` | net cash change (negative is a cost), total spent, total earned (processing fees) |
| `energyDelta`, `repDelta`, `womDelta` | changes to apply |
| `minutes` | minutes of the day used (July) |
| `daysUsed`, `daysLost` | free off-season days spent on a do-it-yourself job; days lost to trouble (the host takes what is left of its budget and decides what the rest costs) |
| `homeFuel` | gallons of home gas used |
| `freshLost` | the fridge went cold: lose the fresh food |
| `foodMeals` | meals of garden produce for the kitchen |
| `lines` | player-facing HTML lines |
| `severity` | 0 nothing, 1 a mishap, 2 a serious mishap (show a pop-up) |
| `remind` | one gentle reminder, or `''` |
| `cond`, `costs`, `done` | condition now; costs by cause (for balancing); jobs finished |

## Files (concatenated in name order by `tools/build.py`, after `src/camp/` and before `src/js/*.js`)

| File | What it holds |
|---|---|
| `home-00-core.js` | the `CabinUpkeep` namespace, constants, small utilities |
| `home-10-data.js` | the shop and every job: when it is due, its three ways, its prices |
| `home-20-engine.js` | the state, the ticket, the jobs, the storm prompts, the rolls, the generator, processing |
| `home-30-ui.js` | the Home tab, the job pop-up, the shop, the winter scenes |
| `home-40-sim.js` | `autoplay` and the policies, for tests and balancing |

## What each feature does

1. **Condition and the Home tab.** See above. The Home tab lists the cabin's condition, what is fitted, and at most two due jobs.
2. **Heat.** The cabin has a furnace (heating oil or propane). In the fall: top up the tank (or order late at a higher price in January, or run dry in a cold snap: a rush delivery and a freezing night). A **wood stove** (shop) adds a second source: cut or buy firewood, and sweep the chimney every year; skip the sweep and creosote builds (a small chimney fire gets likelier each skipped year). With both fitted and ready, a cold snap cannot run you dry.
3. **Freeze-proofing.** Heat tape on the water line and a skirted crawlspace (each once), and on the coldest night a prompt: drip the taps and open the cabinet doors, have the neighbor look in, or skip. Skip them all and a cold snap can freeze a line ($380 and a day) or burst it ($2,200, three days and the fridge food); a long outage with nothing to heat the cabin makes it worse.
4. **Snow.** A heavy snow is a prompt: rake the roof and plow the drive yourself (a free day), pay a neighbor, or skip: an ice dam leaks, or a shed roof gives, and you are plowed in for one to three days, which comes out of the shared winter budget (the host charges the rest as lost winter work).
5. **Generator.** Oil change and a monthly-style run under load each July (stored gas is stabilized in the supplies system; stale gas left in the cans counts against you). Each neglected item adds to the chance it will not start in an outage; if it does not, the shop gets it going for $85 and the freezer is on its own for that outage.
6. **Well and septic.** A yearly well water test, a septic pump every three years. Neglect makes a rare, costly failure likelier each year (a failed pump or tainted water; a backup): a few days with the house unusable. Many homes around Soldotna have a well and a septic system; the text says so only generally.
7. **Bears and fish waste.** Cleaning clients' catch at home draws bears. Latch the bins and clean up every few days in July. Skip it and a bear in the yard (once a summer at most): damage, a lost morning, or a visit from Fish and Game about attractants. A bear-resistant bin (shop) helps. Local rules are described only generally.
8. **Fish processing station.** Shop upgrade. Each trip with fish from reds, silvers or halibut, about 55% of the clients' fish are filleted, sealed and frozen for $4 a fish (at most 3 fish a client), a modest income. The table's tidiness drops with each trip; below about 55% a batch can spoil (the fee is waived, rep −1 and word of mouth −1), so scrub it, and defrost the freezer and service the sealer once a summer.
9. **Garden.** Plant a small garden each July (optional). Day 10 is the harvest: 8 meals into the fridge. An unfenced garden is eaten by moose 55% of the time (2 meals left); a fence ends that. It is light and a little funny, and worth about $50 a year in groceries.
10. **Detectors.** Fit smoke and CO alarms (once) and test them each fall. A wood stove or a generator can make carbon monoxide. With no alarm a rare night ends in the ER ($950, two days); with one, the alarm sounds and it costs $60. The text always says to run a generator outside, away from the cabin.
11. **Spring breakup.** Mud, frost heaves, soft roads. Fix the driveway and check the foundation (do it yourself, or pay). Skip it and the truck sinks to the axles ($260 tow) or the foundation shifts ($900).
12. **Earthquake.** A rare event (3% a year). Strap the water heater and anchor the shelves (once) and it is a rattle; skip it and the water heater tips ($1,100, a day). Southcentral Alaska has real quakes (the 2018 Anchorage earthquake was felt on the Kenai).

## Prices and sources

All prices are **2026 estimates at the standard difficulty** (the host's cost multiplier scales them), rounded, for a small cabin on the Kenai Peninsula. **None were checked against a quote.** They come from general knowledge of Alaska prices (typically 20 to 40% over the Lower 48) and from the shapes of the game's other prices (`src/js/31-supplies.js`). Where the basis is firm, it is noted.

| Job | Do it yourself | Pay someone | Basis |
|---|---|---|---|
| Top up the heating-oil tank | $215, a day | $260 | about 55 gal at an estimated $4.70 a gallon; hauling it yourself saves the delivery fee. Ordering late: $310. A rush delivery after the tank runs dry: $520. |
| Firewood (stove) | $90, 2 days | $700 | two cords at about $350 a cord delivered and split, an estimate for the Peninsula; the DIY cost is saw gas, bar oil and a permit |
| Chimney sweep (stove) | $45 | $200 | brushes and rods; a sweep's visit |
| Heat tape | $160, a day | $450 | cable and thermostat; a plumber's visit |
| Skirt the crawlspace | $300, a day | $900 | rigid foam, plywood, fasteners; a contractor |
| Fit detectors | $85 | $120 | two smoke and two CO alarms; a handyman |
| Test detectors | $12 | $70 | batteries; a handyman |
| Strap the water heater | $40 | $120 | straps and anchors; a plumber |
| Spring breakup | $160, a day | $400 | gravel; a neighbor with a loader |
| Well water test | $55 | $110 | a mail-in lab kit; a tech's sample |
| Pump the septic tank | $20 (a year's reprieve) | $480 | a pump-out; a few hundred dollars is typical |
| Bear bins and fish waste | free, 30 min | $55 | a dump run |
| Generator oil change | $25, 45 min | $140 | oil, filter and plug; the small-engine shop |
| Generator test run | free, 20 min | $70 | half a gallon of home gas; the shop |
| Garden | $45, 90 min | $80 | soil and seed; a neighbor |
| Garden fence | $210, 150 min | $380 | posts and mesh; a neighbor |
| Scrub the fish table | $12, 40 min | $50 | |
| Defrost and service | $25, 60 min | $110 | |
| Wood stove (shop) | | $3,400 | stove, insulated chimney and installation, an estimate |
| Fish processing station (shop) | | $1,900 | stainless table and sink, a vacuum sealer, a bench freezer |
| Bear-resistant bin (shop) | | $140 | |
| Storm prompts | drip the taps: free; roof and drive: a day | $45; $320 | the neighbor's overnight look; a plow and a roof shoveler |

Mishaps: a thawed line $380; a burst pipe $2,200; an ice dam $1,200 to $1,700; a shed roof $2,600; a chimney fire $500 to $700; carbon monoxide ER visit $950; a stuck truck $260; a shifted post and door $900; a failed well pump or tainted water $1,200; a septic backup $1,800; an earthquake $1,100; a bear $60 to $400. **Estimates, not checked:** all of these, every probability, the processing fee ($4 a fish) and the share of clients who opt in (55%).

### Balance

Run with the bot harness (normal and hard difficulty, 5-year careers, 100 per bot; see the table in the root README). Home trouble roughly: careful upkeep (do it yourself when there is time) costs about $570 a season in cash, 2.2 free days and a little over five hours of July evenings; paying for everything costs about $1,650; full neglect costs about $2,100 in mishaps and lost winter work, with condition near 0 after a few seasons. The winter living bill went from $1,800 to $1,300 to cover the heat that is now itemized, so a player who ignores the Home tab and takes the top button on each prompt loses roughly 1 to 3% of season score against 1.9.0, and one who skips everything about 2.5 to 3% less than a careful one (1 to 2% under 1.9.0, because the lower living bill gives back part of it). None of it can end a career.
