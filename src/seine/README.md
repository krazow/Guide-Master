# Seine: purse seining out of Homer

A small module for salmon seining in Lower Cook Inlet's Southern District (Kachemak Bay), worked out of Homer, Alaska: crew on a
limit seiner for a share, or run a chartered boat yourself. For now it lives inside Guide Master; it follows the same pattern as the
camping engine (`src/camp/README.md`) and the cabin (`src/home/README.md`), so it can be reused or moved without changes.

## Rules of the boundary

- One global, `Seine`. Nothing else is created.
- It never reads or writes Guide Master's state (`S`), pop-ups (`modal`), clock (`GAME`), saves or migrations, and it never calls
  `Math.random`: randomness comes from the host's `rand` (or a seeded generator), and the year's runs and ADF&G's schedule come from a
  hash of the year, so looking never changes your luck. `tests/seine.test.js` checks the source and runs the module in an empty sandbox.
- Everything it needs comes in through a **ticket** (with its own **state**, which the host stores and hands back). Everything it
  produces goes out in a **report**. `src/js/43-seine.js` is the thin Guide Master adapter.
- It touches no browser storage.
- `Seine.SCHEMA` (currently 1) versions the ticket, the report and the state. Bump it when any shape changes.

## Files (concatenated in name order by `tools/build.py`, after `src/home/` and before `src/js/*.js`)

| File | What it holds |
|---|---|
| `seine-00-core.js` | the `Seine` namespace, constants, small utilities (seeded generator, a stable hash, money and time text) |
| `seine-10-data.js` | the schedule's days and hours, prices and weights, shares, costs, the four bays, the skippers, run timing, event ids |
| `seine-20-engine.js` | the state, the year, the schedule, the winter plan, and one opener as a state machine |
| `seine-30-ui.js` | `Seine.start` (an opener through the host's pop-ups) and `Seine.ui.plan` (the winter's choices) |
| `seine-40-sim.js` | `Seine.sim` and the policies, for tests and balancing |

## API

```js
Seine.newState() / normState(x)               // a fresh state; fill in whatever an older state lacks
Seine.year(y)                                 // { sock, pink, price, bust, txt }: how the runs and the price came in that year
Seine.isOpen(y, md, dow) / schedule({ year, days: [{ d, md, dow }] })
                                              // the regular schedule among those days: [{ d, md, dow, run, eo }] (eo: closed by emergency order)
Seine.planOptions(t) / plan(t, id)            // the winter: 'none' | 'crew' | 'skip:transfer' | 'skip:own' | 'buy' | 'sell' → a plan report
Seine.session(ticket, { rand })               // one opener: { view(), choose(id), report(), done, phase }
Seine.start({ ticket, host })                 // plays it through host.show; calls host.onFinish(report) once
Seine.ui.plan(host, back)                     // the winter's choices through host.show / host.ticket / host.apply
Seine.sim({ ticket, seed | rand, policy })    // headless: 'first' | 'random' | 'careful' | 'greedy' | your own (view, session) → id
Seine.captain(y, state) / crewShare(state, captain) / permitValue(y, costMult) / runTxt(y, md)
Seine.data                                    // everything in seine-10-data.js
```

`session.view()` returns `{ title, html, buttons: [{ id, l, s, dis }], exit, meta }` (meta: `{ phase, role, spot, t, fish, events, school, i }`).

### The host adapter

```js
host = {
  show(title, html, buttons, lock, meta), // required. Show a pop-up. buttons: [{ l, s, dis, fn }]; call fn after the pop-up has closed.
                                          // lock=true: Esc must not dismiss it (mid-opener). meta: { id: 'seine', phase, events } where
                                          // events are what happened since the last screen ([{ id, sev }], ids from Seine.data.EVENTS).
  onFinish(report),                       // the opener is over: apply the report (once)
  rand(),                                 // optional, [0,1)
}
// for Seine.ui.plan: show, ticket() (a fresh winter ticket), apply(planReport)
```

### The opener ticket (host → module)

| Field | Meaning |
|---|---|
| `role`, `route` | `'crew'` or `'skip'`; for a skipper, `'transfer'` (an emergency transfer: the holder takes a share) or `'own'` |
| `state` | the module's own state |
| `md`, `dow`, `year`, `season`, `dayTxt` | the date (month×100+day), the day of the week (0 is Monday), the calendar year, the host's season number, a label |
| `wind`, `sky` | the day's wind in knots and the sky |
| `cash`, `energy`, `costMult`, `bad` | the player's numbers; the difficulty's price and bad-luck multipliers |
| `late` | minutes after 6:00 AM the player reached the harbor (a crewman more than 30 late is left at the dock) |
| `diesel` | marine diesel, dollars a gallon |

### The winter ticket

`{ state, season, year, cash, costMult }`. A plan report is `{ state, cashDelta, spent, earned, lines, plan, permitDelta }`.

### The report (module → host)

| Field | Meaning |
|---|---|
| `state` | the new state: store it |
| `cashDelta`, `earned`, `spent` | net cash change (negative is a cost); the share or take; what came out of it |
| `gross`, `offTop`, `take`, `rows` | the fish ticket, the day's fuel, ice and groceries, your share or take, and the settlement as `[label, dollars]` rows |
| `fish`, `lbs`, `sets`, `water`, `spot` | the catch by species, pounds delivered, sets made, water hauls, the bay |
| `energyDelta`, `repDelta` | on top of the hours (the host passes the time) |
| `fines`, `viol` | a skipper's citations `[{ what, fine }]` (already in `cashDelta`) and how many |
| `cancels` | a bad injury: the host cancels the next day's booked trip |
| `start`, `end`, `minutes` | minutes after midnight the day began and ended (back at the harbor, at most 11:45 PM) |
| `fished`, `stayed`, `missed` | worked the opener; stayed in port (weather); missed the boat |
| `events`, `lines` | what happened (ids from `Seine.data.EVENTS`, `sev` 0 news, 1 a mishap, 2 a serious one) and narration |

`Seine.data.EVENTS`: `dawn_set`, `full_bag`, `tender`, `water_haul`, `torn_net`, `skiff_wheel`, `injury`, `injury_bad`, `stay_in`,
`weather_wait`, `cut_in`, `corked`, `line_cite`, `jackpot`, `missed_boat`.

## An opener

1. **The harbor.** The wind call: a skipper runs out, waits three hours for a blow to lay down, or stays in port; a crewman goes along
   (or, in a small craft advisory, begs off). The skipper you crew for makes the weather call by temperament.
2. **The grounds.** A skipper picks the bay (Tutka Bay outside the hatchery line, Neptune Bay, China Poot Bay, Halibut Cove: more
   sockeye, more pinks, more reef, more boats). A crewman picks a pace: steady or hustle.
3. **Three stretches** (morning, midday, evening), each: read the water (jumpers, finning, the skiff man's call; a green eye misreads),
   then set now, wait for a better school, run to another bay, take your turn at the hook-off or cut in, or set inside a closed line;
   then set tight to the reef or off it (a crewman: watch the lines or rush the stack). A stretch is one to four sets: a set is a water
   haul or a bag of fish, and a bag can be full to the corks (brail it steady or hurry). What can go wrong: a torn net on the reef, the
   skiff line in the wheel, a hurt hand or worse, a citation inside the line.
4. **The tender.** Pitch the fish aboard; a skipper can bleed and slush the sockeye for a little more a pound.
5. **The fish ticket.** Fuel, ice and groceries come off the top. A crewman gets a share (8%, 10% after six openers or a skipper's good
   word). A skipper pays three crew shares (9% each), the boat's share (20%) and, on an emergency transfer, the permit holder's (20%),
   plus repairs, the diver, an insurance deductible and fines.

## Facts and sources

- **Schedule.** Southern District purse seine waters (Halibut Cove Subdistrict, Tutka Bay Subdistrict outside the Tutka Bay Hatchery
  special harvest area, the Neptune Bay and China Poot Bay sections outside the Hazel Lake and China Poot special harvest areas) open
  on a regular Monday, Wednesday and Friday schedule of 16-hour periods from 6:00 AM, from mid-June. ADF&G Lower Cook Inlet salmon
  advisory announcements, June–July 2026: https://www.adfg.alaska.gov/static/applications/dcfnewsrelease/1781396368.pdf,
  https://www.adfg.alaska.gov/static/applications/dcfnewsrelease/1795465649.pdf. Fishing after mid-July depends on the wild pink
  escapement (the 2025 outlook: https://www.adfg.alaska.gov/static/applications/dcfnewsrelease/1654394418.pdf). In 2026 the Southern
  District took about 114,000 sockeye and only 2,800 pinks against a ten-year average near 162,000 pinks; the district was closed to
  seines in August and the season closed September 1
  (https://www.adfg.alaska.gov/static/applications/dcfnewsrelease/1834550350.pdf). No commercial salmon fishing within 500 yards of a
  salmon stream's fresh water unless a rule says otherwise (the same announcements).
- **Prices and weights.** ADF&G's 2025 preliminary Lower Cook Inlet figures: sockeye 4.5 lb at $2.20 a pound, pinks 3.1 lb at $0.25,
  chum 6.4 lb at $0.53 (https://www.adfg.alaska.gov/static/fishing/pdfs/commercial/2025_preliminary_season_summary_tables.pdf). Each
  year's price moves ±15% around these (a game estimate).
- **Permits.** Cook Inlet purse seine (S01H): about 83 permits, roughly 20 fished in a year, an average 2018 sale of $51,000 (CFEC
  report 19-7N: https://www.adfg.alaska.gov/static/regulations/regprocess/fisheriesboard/pdfs/2019-2020/lci/CFEC_19-7N.pdf). Alaska's
  Limited Entry Act prohibits leasing a permit; a holder kept from fishing by illness or another unavoidable hardship can have it
  **emergency transferred** for the season (CFEC: https://cfec.state.ak.us/Publications/Permit_Transfers.pdf). So the game offers an
  emergency transfer, or buying a permit (an estimated $45,000, resold at 90 to 100%), never a lease. The holder's share is an estimate.
- **Crewmember license.** $60 a year for a resident (ADF&G license price list).
- **Estimates, not checked:** crew and boat shares, the day's diesel, ice and groceries, insurance ($1,500), the Coast Guard dockside
  exam and safety gear ($450), net repairs, the diver, deductibles and medical bills, fines, every catch rate and probability, the run
  timing curves, the bays' character, the captains and boats (fictional), and the quality bonus for bled sockeye.

## Balance

Measured with `Seine.sim` (300 openers a cell, careful policy, years 2027–2038): a July opener pays a crewman about $300 (a June one
about $100, an August pink day about $100), and a skipper about $1,100 with a standard deviation near $1,200 and one day in eight at a
loss; a greedy skipper (cutting in, setting inside lines, tight to reefs, hurrying) earns less and gets cited. In Guide Master careers
(`tools/sim`, style `seine`: crews from the 2nd off-season and signs on only for openers that cost no booked trip) the season score is
within noise of guiding only; style `seineall` (every opener, cancelling the trips in the way) loses about a fifth of it, because a
cancelled trip also shrinks the estimated rest of the summer.
