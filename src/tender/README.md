# Tender: fish buying & processing on Cook Inlet

A small business module: charter or buy a **tender** (a buyer boat) that anchors near the commercial fleet on openers and buys fish over the rail, then **lease line space** at a custom processor, buy a **small shore plant** (Kenai/Kasilof or Homer) or an **old floating processor**. It follows the pattern of the camping engine (`src/camp/README.md`) and the cabin (`src/home/README.md`): one global, a ticket in, a report out, and a thin adapter (`src/js/45-tender.js`) that is the only file that knows Guide Master.

## Rules of the boundary

- One global, `Tender`. Nothing else is created.
- It never reads or writes Guide Master's state (`S`), pop-ups (`modal`), clock (`GAME`), saves or migrations. `tests/tender.test.js` checks the source for those names and runs the whole module in an empty sandbox.
- Everything it needs comes in through a **ticket** (with its own **state**, which the host stores and hands back). Everything it produces goes out in a **report**.
- It touches no browser storage.
- `Tender.SCHEMA` (currently 1) versions the ticket, the report and the state. Bump it when any shape changes, and add a migration in the host.
- Markets are drawn from a generator seeded by the state's own seed and the season, so a forecast never changes your luck and looking is free. Everything else takes `rand` from the caller (`{rand}`), or `Math.random`.

## Guardrails (what the module promises)

- **It never ends a career.** No report takes the player's cash below the ticket's `floor` (default `Tender.FLOOR`, $10,000: the guide's working money, so a failed business can't starve the guiding that pays the bills). When a season's bills would go below it, first the bank **carries the loss on the loan** (up to `K.CARRY`, 80%, of what the boats and plant are worth, if the player's credit is good); if it can't, **everything is sold at the dock auction** (`K.FIRE`, 55% of value), the loan is paid from the proceeds, and whatever is still short is written off. Credit is shot for `K.NO_CREDIT` seasons after that.
- **A purchase leaves money in the bank.** Buying or leasing is refused unless the floor plus the first season's crew and upkeep stay in the bank after paying.
- **No surprise pop-ups.** The module only shows sheets the player opens (the planner, a day on the tender). Everything else comes back as report lines that the host puts in its own summaries.
- **Nothing happens until you start.** With no tender, plant or loan, the module draws no random numbers and changes nothing.

## The year

| When | Call | What happens |
|---|---|---|
| winter | `act(ticket, id, arg)` | charter (`lease`) or buy (`buyT`, with `{loan:true}` for a bank loan) a tender for an area (`uci` or `lci`), sell one (`sellT`), move one (`areaT`); lease line space (`space`) or buy a `shore` plant or a `floater`; sell it (`sellP`); pick the product (`mix`); move the floater (`parea`); send it west for winter crab (`wcrab`); hire next season's crew (`crew`, a free winter day); pick the upkeep (`maint`: `full`, `basic`, `skip`); set the posted price (`price`: `{offset, care}`); pay the loan down (`payLoan`) |
| spring | `openSeason(ticket)` | upkeep and (if nobody hired one) an agency crew are paid; the floater's winter crab settles; the market, the going prices and the opener calendar are set |
| summer | `opener(ticket, choice)` | one opener, run by you (`{self:true, offset, care, run}`) or your skipper (your standing price and care rule) |
| summer | `route(ticket, delivery)` | your own catch from another module, sold to your own buyer at your posted price |
| summer | `plantDay(ticket)` | a played morning with a plant: a small energy cost |
| fall | `closeSeason(ticket)` | every opener you didn't play, the tender crews' season costs, the plant's season, the fall charter, depreciation, the loan payment, then the guardrail |

`estimate(ticket)` is the rest of an open season with no luck either way (for a score when a career ends in the summer). `value(state)`, `debt(state)`, `active(state)`, `forecast(ticket)`, `market(state, s)`, `calendar(year, area, run)`, `openerToday(ticket)`, `buyerIn(ticket, area)`, `why(ticket, id, arg)` (why an act is refused, or `null`), `price`, `saleValue`, `crewCost` and `status(ticket)` (rows for a screen) round it out. `Tender.ui` has the screens (`planner`, `tenders`, `plant`, `crew`, `maint`, `price`, `loan`, `opener`, `report`, `tab`) and `Tender.autoplay(host, {policy})` plays the winter headless (`processor`, `mogul`, or a function).

### The host adapter (for `ui.*`)

```js
host = {
  show(title, html, buttons, lock, meta), // required. buttons: [{ l, s, dis, fn, stay }]; every button here has stay:true (keep the sheet up and
                                          // show the next step in it). meta: { events: [{id, sev}] } from Tender.EVENTS, for a picture.
  ticket(),                               // required. A fresh ticket from the host's numbers.
  apply(report),                          // required. Apply a report.
  rand(),                                 // optional, [0,1)
}
```

### The ticket (host → module)

| Field | Meaning |
|---|---|
| `state` | the module's own state (opaque to the host) |
| `phase` | `'winter'` or `'summer'` |
| `s`, `year` | the season (the coming one in the winter) and its calendar year |
| `cash`, `rep`, `energy` | the player's numbers |
| `floor` | the cash the business may not take (default `Tender.FLOOR`) |
| `costMult` | the difficulty's multiplier for prices |
| `diesel` | a gallon of marine diesel |
| `daysLeft`, `seasonsLeft` | free winter days left (hiring a crew takes one); seasons left in the career, this one included |
| `md` | in the summer, today's date as month×100+day (716 is Jul 16) |
| `run` | `{ sockeye, coho, pinkEven, king }`: the host's run strengths (1 is average), whether it's an even (big pink) year, and the Kenai king rule (`closed`, `cr`, `open`: the east-side setnets fish less when kings are weak) |

### The report (module → host)

| Field | Meaning |
|---|---|
| `state` | the new state: store it |
| `cashDelta`, `spent`, `earned` | net cash change, spent, earned |
| `energyDelta`, `repDelta` | changes to apply |
| `daysUsed` | free winter days used (hiring the crew yourself) |
| `lines` | player-facing HTML lines |
| `events` | `[{ id, sev }]` from `Tender.EVENTS` (for a picture): `tender_anchor`, `tender_pump`, `tender_reject`, `tender_breakdown`, `plant_line`, `plant_inspect`, `plant_fine`, `plant_freezer`, `floater_bay`, `weak_market`, `forced_sale`, `crab_west` |
| `forced`, `carried`, `refused` | a forced sale happened; the bank carried this much on the loan; why an act was refused |
| `results` | (opener) each tender's day: pounds, price, quality, net |
| `routed`, `price`, `value`, `area`, `species` | (route) whether your own buyer took the catch, and at what price |

## The contract with the other commercial modules

The gillnet, seine and crab modules report `delivery: {species, lbs, area, day}`. Guide Master's adapter offers `tenderRoute(delivery)`: it returns `null` when the player has no buyer in that water (sell to an outside buyer as before), or `{price, value, area, species, line}` when their own tender or plant takes it. The caller pays the player `value`; the business pays it and keeps the plant's (or tender's) margin in its season's books. Areas are matched loosely: anything naming Kenai, Kasilof, the Central District or Upper Cook Inlet is `uci`; Homer, Kachemak Bay or Lower Cook Inlet is `lci`; a port out west (Dutch Harbor, Kodiak, the Bering Sea) is `west`, which only a floating processor wintering out west for crab buys. Species: sockeye (reds), coho (silvers), pink (humpies), chum (dogs), crab.

## How the money works

- **Tender.** Each opener the fleet's catch near your anchorage follows the run's timing and strength; your share follows your posted price against the other buyers (`3` points of share per dollar a pound, so +5¢ is about +15%), the fleet's trust in you, and how picky you are. A processor pays you the going price plus a spread (`K.SPREAD`, 12¢ for sockeye) and a quality bonus (up to `K.QBONUS`, 6¢) for cold, bled fish. Crew (two deckhands, a skipper unless you run it), diesel, a hold full of warm fish (downgraded) or a dead RSW pump come out of it. A chartered tender is about break-even (a learning year); an owned one, kept up, earns a little and is chartered out in the fall.
- **Plant.** It buys from your tender, from outside tenders (more when you post a better price and the fleet trusts you) and at the dock (east-side setnetters in Upper Cook Inlet, when the kings let them fish, and your own catch). Its margin a pound moves with the market (weak, normal, strong) and the product: frozen H&G is steady, fresh adds a premium on part of the sockeye, fillets add value but slow the line, canning saves pinks in a normal year and loses in a glut. Crew (hired in the winter), upkeep, fixed costs, energy, the discharge permit, an inspection (more likely in a run-down plant) and a failed freezer come out of it. Capacity caps the peak; turning boats away costs trust.
- **Bank.** Put `K.DOWN` (30%) down and borrow the rest at `K.RATE` (9%) over `K.TERM` (7) years; one payment each fall. A sale pays the loan first.
- **Score.** The host counts boats and plants at `K.SCORE` (nine tenths) of their value now, the loan against it, and in the summer the rest of the season's estimate.

## Facts and estimates

All prices are **2026 estimates for play**, rounded, scaled by the host's cost multiplier. **None were checked against a quote.** Where the basis is firm it is noted.

| What | In the game | Basis |
|---|---|---|
| Upper Cook Inlet openers | Mondays and Thursdays, about Jun 19 to Aug 15, plus a midweek period in a strong July | the drift fleet's regular periods, simplified; emergency orders add and take hours in real seasons |
| East-side setnets | fish much less when Kenai kings are closed or catch-and-release | in 2025 the East Side Set Net fishery fished two periods (Aug 5 and 6); in recent seasons it was largely closed for king salmon (Peninsula Clarion, ADF&G's 2025 summary; KDLL) |
| Run sizes and values | the host's run strength scales the fleet's catch | 2025: a 12.1 million sockeye return, about 4 million salmon caught commercially and about $36 million ex-vessel in Upper Cook Inlet, mostly drift-caught sockeye (KDLL; Peninsula Clarion) |
| Going prices | sockeye $1.05, $1.45 or $2.05 a pound (weak, normal, strong); pinks 18¢, 30¢ or 42¢ | ADF&G's preliminary 2025 tables: Upper Cook Inlet sockeye about $1.73 and pinks 35¢, Lower Cook Inlet sockeye $2.20 and pinks 25¢, statewide pinks 30¢; prices swing a lot year to year (the 2026 tables show higher salmon prices again) |
| Processors leaving | the shore plant is "bought from a company getting out of Cook Inlet"; a weak-market year lowers what a plant sells for | Copper River Seafoods stopped buying on the Kenai Peninsula in 2022 citing costs, the management plan and a poor forecast, and another processor took over its buying stations (Peninsula Clarion); Trident put four Alaska plants up for sale in late 2023 citing a harsh global market (Alaska Public Media) |
| Tenders | buy for a processor, weigh and grade each delivery, chill in refrigerated seawater, run to the plant; often 30–50 years old; chartered on flat contracts | National Fisherman on Bristol Bay tenders |
| Tender prices | charter $24,000 a season; a used 58-ft steel tender with RSW $340,000, $15,000 a winter to keep | estimates; used packers on brokers' lists run from a couple of hundred thousand dollars (a 1989 65-ft packer of about 100 tons) to about a million (a 133-ft packer of 470,000 lb) (Pacific Boat Brokers) |
| Plants | line space $34,000 a season; a small shore plant $520,000; an old floating processor $1.6 million | estimates for small, old, distressed facilities; real plants vary enormously |
| Plant margins | sockeye about 4.5¢, 12.5¢ or 20.5¢ a pound over a tender's delivered price; pinks −4¢, 2¢ or 6¢; canned pinks −8¢, 8¢ or 13¢ | estimates, chosen so a plant is a modest, risky business, as recent closures suggest |
| Inspections and permits | a state food-safety inspection each season; a wastewater discharge permit | Alaska's seafood processors work under a state food-safety permit and a wastewater discharge permit; the details are described only generally |

Sources: [KDLL, Nov 2025](https://www.kdll.org/local-news/2025-11-24/strong-2025-sockeye-run-roughly-doubles-value-of-local-commercial-fisheries); [Peninsula Clarion, ADF&G 2025 summary](https://www.peninsulaclarion.com/news/alaska-department-of-fish-and-game-publishes-2025-commercial-salmon-summary); [ADF&G 2025 preliminary tables](https://www.adfg.alaska.gov/static/fishing/pdfs/commercial/2025_preliminary_season_summary_tables.pdf); [ADF&G 2026 preliminary tables](https://www.adfg.alaska.gov/static/fishing/pdfs/commercial/2026_preliminary_season_summary_tables.pdf); [Peninsula Clarion, Copper River Seafoods](https://www.peninsulaclarion.com/news/copper-river-seafoods-ending-kenai-operations-this-salmon-season); [Alaska Public Media, Trident's plants](https://alaskapublic.org/news/2024-03-14/trident-seafoods-find-buyers-for-ketchikan-petersburg-and-false-pass-processing-plants); [National Fisherman, tenders](https://www.nationalfisherman.com/inside-the-overlooked-world-of-bristol-bay-s-salmon-tenders); [Pacific Boat Brokers, packers](https://pacificboatbrokers.com/used-boats-for-sale/NS6158/steel-herring-salmon-packer.asp).

## Files (concatenated in name order by `tools/build.py`, after the other modules and before `src/js/*.js`)

| File | What it holds |
|---|---|
| `tender-00-core.js` | the `Tender` namespace, constants, small utilities (money, dates, a seeded generator, loan payments) |
| `tender-10-data.js` | areas, tenders, plants, products, markets, margins, the fleet and its timing, events; `Tender.data.K` holds the numbers Help quotes |
| `tender-20-engine.js` | the state, the ticket, markets and forecasts, the calendar, openers, the plant's season, the fall, the guardrail, the winter's acts |
| `tender-30-ui.js` | the planner and its sheets, a day on the tender, the business at a glance |
| `tender-40-sim.js` | `autoplay` and the `processor` and `mogul` policies |

## Balance

Bot careers on normal difficulty (`tools/sim`, same seeds; season score is the career score; `processor` and `mogul` play like `food` otherwise):

| career | style | careers | mean score | vs `food` | sd | min–max | forced sales | careers lost |
|---|---|---|---|---|---|---|---|---|
| 10 years | `food` (guiding only) | 30 | 630,412 | — | 32,375 | 554,817–711,326 | — | 0 |
| 10 years | `processor` | 30 | 674,888 | +7.1% | 175,906 | 198,669–1,086,071 | 1 | 0 |
| 10 years | `mogul` | 30 | 487,274 | −22.7% | 376,109 | 152,969–1,630,843 | 24 | 0 |
| 5 years | `food` | 40 | 294,402 | — | 17,719 | 260,645–333,573 | — | 0 |
| 5 years | `processor` | 40 | 320,823 | +9.0% | 47,790 | 224,163–419,549 | 0 | 0 |
| 5 years | `mogul` | 40 | 298,421 | +1.4% | 101,080 | 148,234–570,671 | 5 | 0 |

The processor saves for a plant (guiding upgrades only above $120,000 of cash); `food` saving the same way scores 577,159 (10 years) and 277,357 (5 years), so the business itself is worth more than the table's gap. The standard error of a processor cell is about 22,000–32,000 (10 years), so the gap is "modestly ahead", not a sure thing. The mogul borrows for everything, overpays the fleet, skips upkeep and fillets: most of its careers go through a forced sale, and none is lost. Default bots are unchanged (64 of 64 careers identical to main, same seeds). Per season, from runs of the engine alone (an average Upper Cook Inlet season, depreciation in, interest out): a charter about +$13,000 (sd $28,000), an owned tender about +$27,000, line space with your tender about +$12,000 more, a shore plant with fresh fish about +$37,000 more (sd $134,000: −$84,000 in a weak market, +$211,000 in a strong one), a floating processor below zero on average.
