# Gillnet: commercial gillnetting in Upper Cook Inlet

A self-contained module for the Cook Inlet sockeye gillnet fisheries: an **east-side setnet site** on the beach below the
Kalifornsky bluffs, and a **drift gillnet boat** out of the Kenai River. For now it lives inside Guide Master (a guide's summer
openers); it follows the same pattern as the camping engine (`src/camp/README.md`) and the cabin (`src/home/README.md`), so it can
be reused or moved without changes.

## Rules of the boundary

- One global, `Gillnet`. Nothing else is created.
- It never reads or writes Guide Master's state (`S`), pop-ups (`modal`), clock (`GAME`), saves or migrations. `tests/gillnet.test.js`
  checks the source for those names and runs the whole engine in an empty `vm` sandbox.
- Everything it needs comes in through a **ticket** (one opener) or a small options object (a season's schedule, the planner, the rest
  of the summer). Everything it produces goes out in a **report**. `src/js/42-gillnet.js` is the thin Guide Master adapter.
- It touches no browser storage.
- `Gillnet.SCHEMA` (currently 1) versions the ticket, the report and the schedule. Bump it when any shape changes.

## Files (concatenated in name order by `tools/build.py`, after `src/home/` and before `src/js/`)

| File | What it holds |
|---|---|
| `gillnet-00-core.js` | the `Gillnet` namespace, small utilities (money, clock times, a seeded generator) |
| `gillnet-10-data.js` | prices, shares, leases, the two fisheries, areas and statuses, citations, event ids, the roles |
| `gillnet-20-engine.js` | `schedule`, `outlook`, `offers`, `session` (one opener as beats), `rest`, `expect`, `partner` |
| `gillnet-30-ui.js` | `Gillnet.start({ticket, host})`: runs a session through the host's pop-ups |
| `gillnet-40-sim.js` | `Gillnet.sim()` and the policies (`first`, `random`, `sensible`, `greedy`), for tests, bots and balancing |

## API

```js
Gillnet.schedule({kind, days:[{d, md, dow}], king, sock}, {rand}) → {kind, days:{[d]: opener}, reopen}
Gillnet.fishable(opener), Gillnet.openerFactor(opener)          // can it be fished; its fish next to a regular open period
Gillnet.outlook(kind, king, sock)                               // a sentence for the planner
Gillnet.offers({cash, costMult, xp, did, own, suit, plan})      // the roles the planner offers: [{id, l, s, cost, dis, why, note}]
Gillnet.buyCost(costMult), Gillnet.buyWhy(t)                    // buying a drift permit and boat
Gillnet.session(ticket, {rand})                                 // one opener: view() / choose(id) / report(), .done, .phase
Gillnet.start({ticket, host})                                   // the same, through host.show; host.onFinish(report)
Gillnet.sim({ticket, seed | rand, policy}) → {report, steps}    // headless
Gillnet.rest({kind, role, played, net, gross, open, count, sock, price, costMult, fuel})   // the unplayed summer
Gillnet.partner(ticket, {rand})                                 // an opener fished for you while you guided
Gillnet.data, Gillnet.util, Gillnet.policies
```

`session.view()` returns `{title, html, buttons:[{id, l, s, dis}], meta:{phase, kind, role, events}}`.

### The host adapter

```js
host = {
  show(title, html, buttons, lock, meta),   // required. buttons: [{l, s, dis, fn}]; call fn after the pop-up closes. lock: Esc must not dismiss it.
                                            // meta.events: [{id, sev}] (Gillnet.data.EVENTS) for a picture. Ignore it if you like.
  onFinish(report),                         // the opener is over: apply the report once (it is called as the summary shows)
  rand(),                                   // optional, [0,1)
}
```

### An opener: the beats

- **Setnet**: the brief (status, hours, tides, wind; go or sit it out) → **set** the nets (at the opening on the low water, on the flood,
  or keep the outer net on the beach in a blow) → **soak** (pick now, or let them soak to high water; seals, kelp, a school) → **pick** on
  the ebb (fast, or bleed and slush-ice for a better price; a lessee can leave the nets fishing past the close and risk a citation) →
  **deliver** (the tender off the beach, or the processor dock in Kenai) → the fish ticket.
- **Drift**: the brief → the **drift line** (the corridor along the east-side beaches, the mid-inlet tide rip, Area 1 or the west side,
  whatever the period allows) → **set** the net (short sets or one long drift) → **the tide** (one event: the flood setting you across the
  corridor line into closed water, a torn net, seals, being corked, a school) → **deliver** (the tender on the grounds, or the dock in
  Kenai if the bar at the river mouth has water) → the fish ticket.
- **Crew**: the same calls, as advice. The skipper takes it more often as you gain experience; otherwise they do it the usual way (the
  first button). Crew are never cited: the permit holder is.
- **Beach seine**: on a closed setnet day the family may run an experimental, cost-neutral beach seine; a day's wage.

### The ticket (host → engine)

| Field | Meaning |
|---|---|
| `kind`, `role` | `'set'` or `'drift'`; `'crew'`, `'lease'` or `'own'` |
| `day` | the opener from `schedule`: `{st, area, hours:[open, close], why}` |
| `seine` | a beach-seine day instead of an opener |
| `run` | sockeye in the inlet today, about 0.15 to 1.4 (1 is the peak of an average run) |
| `price` | this season's ex-vessel price a pound |
| `wind`, `wx`, `tides` ([{m, h, hi}]), `amp` | the day's wind in knots, weather, highs and lows, the tide's range (10 and up: a big tide) |
| `now` | minutes after midnight when the day starts |
| `xp`, `suit`, `exam` | openers worked in this fishery; a survival suit; a current Coast Guard dockside exam decal (own boat) |
| `king`, `costMult`, `fuel`, `skipper` | the king rule, the difficulty's price multiplier, marine fuel a gallon, who you crew for |

### The report (engine → host)

`{kind, role, skipped, seine, fish, lbs, price, gross, share, costs:{lease, crew, fuel, ice, gas, repair}, cashDelta, energyDelta, minutes,
cites:[{what, fine, minor, who}], events:[{id, sev}], lines, kings, xp, mood, quality, status, area}`. The host applies `cashDelta` (all costs
are already in it), `energyDelta`, `minutes`, the citations (through its own rules), and shows `lines`.

### The schedule

Regular periods are **Mondays and Thursdays** in the fishery's window (setnet from late June, drift from mid-June, both to mid-August).
Setnets: open when kings are open (now and then restricted), mostly **restricted** (one net close to the beach, fewer hours) when kings
are catch-and-release, **closed** when kings are closed, with one late **reopening** if the sockeye run is huge (as in August 2025).
Drift: the whole Central District, or restricted to the **corridor** along the east-side beaches or to **Area 1**, more often when kings
are in trouble; early August is the west side only. A weak run can close a period; a strong one brings **extra periods**. Each opener
carries `ann` (the day it is announced: the morning before).

## Money (estimates for play)

| | Setnet | Drift |
|---|---|---|
| Crew | 10% of the fish ticket; a crewmember license | 12% crew share; a crewmember license |
| Lease | $2,800 up front (site, skiff, nets), 20% to the permit holder, 10% to your hand, ice and gas | $6,000 up front, 15% to the owner, 12% to your deckhand, fuel (about 45 gallons) and ice |
| Own | — | $90,000 (permit and boat), $4,200 a winter, 8% a year off the boat's value, sells for 85% |

A sockeye is about 6 lb; the price is drawn between $1.35 and $1.95 a pound each season (bled and iced +$0.20, the dock +$0.10, soft
fish −$0.15). With a lease or your own boat, the openers you don't fish (the unplayed summer, a day you guided) are fished by a partner or
a hired skipper and you keep 40% of the net.

## Facts and estimates

Simplified from recent Upper Cook Inlet seasons (ADF&G, KDLL, KBBI, Peninsula Clarion, Homer News): the east-side setnet fishery has
been closed for most or all of recent summers under the Kenai late-run king plan, and briefly reopened in August 2025 when the king
recovery goal was met during a record sockeye run; families tested beach seines that release kings alive, and in 2026 the Board of
Fisheries put beach seines in the low-abundance king plan; drift periods run on Mondays and Thursdays and are often confined to the
corridor or Area 1. Prices, leases, shares, catches and odds are estimates for play, not quotes. Regulations change by emergency order.
