# Guide Master

**A guide's career on the Kenai.** A mobile game (installable PWA, works offline) about life as a charter fishing guide on Alaska's Kenai Peninsula: a 2-, 5- or 10-year career, each year the two-week July peak of the late sockeye run (season 1 is the real July 13–26, 2026).

You run a small guide business out of Soldotna with a jet sled, a drift boat, a stack of credentials and a phone that won't stop ringing. Meet your clients at the launch by 6 AM, find them fish, keep them happy, fill out your logbook, and stay on the right side of the rules. Three citations and Alaska State Parks pulls your Kenai River guide permit.

## The Kenai

- **Places:** your shop & cabin in Soldotna, town (tackle shop, ADF&G office, diner, clinic), the lower Kenai launch at Centennial Park, Cooper Landing and the Russian River, Kenai City Beach (the dipnet fishery) and the Homer Spit.
- **Trips:** lower-river sockeye trips, early silver (coho) back-trolling, upper-river drift-boat trout floats, and a Homer halibut charter captained on a friend's permit.
- **Lore:** glacial-flour turquoise water, combat fishing at the Russian River confluence, Les Anderson's 97 lb 4 oz world-record king (1985), brown bears on the gravel bars, the midnight sun, the river-mile-19 sockeye sonar, Cook Inlet tides, Friday traffic on the Sterling Highway, Kahtnu (the Dena'ina name for the Kenai).

## The rules it models

Every trip throws decisions at you. The options are **shuffled every time** and none is highlighted, so you have to read them. Each legal choice has a real cost (time on the water, fewer fish, a smaller tip or some cash) and each illegal one can pay cash (a client slips you $100 for the king photo, an extra tip, a full limit), if nobody's watching. Each option carries `legal: true/false` in code and `data-legal` on its button, which is how tests and bots find the legal one (`legalBtn()` returns its index). Among the rules:

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

## Player feedback

`src/js/27-feedback.js` adds **💬 Send feedback** to the title screen, the ⚙️ Settings menu and the Help! sheet. The player picks a kind (idea, bug, a rule or fact is wrong, love it, other), writes a message and can add an email address if they want a reply. The game POSTs it as JSON to the Formspree form `mdeeqzbq`, and Formspree emails it to the developer with the subject **"Guide Master Feedback"**:

- **Reply-to:** set to the player's email when they give one, so you can answer straight from your inbox.
- **Context:** the game version, installed app vs browser, device, and career, day, location, cash, rep and trips when a game is running.
- **Spam:** a hidden `_gotcha` field drops bot posts.
- **Offline:** a message that can't be sent (offline, or Formspree busy) waits on the device and is sent automatically when the game is next online.
- **Privacy:** only the form ID is in the public code, never an email address. Formspree's free plan covers 50 submissions a month.

To change the form, edit `FEEDBACK.formId` in `27-feedback.js` and rebuild.

## Accessibility

- **Pop-ups** (`modal()` in `src/js/02-kit.js`): focus moves into the pop-up, Tab and Shift+Tab stay inside it (the page behind is `inert`), **Esc closes it** (it presses the pop-up's own Close/Got it button, or just puts a multi-choice pop-up away; a trip dilemma you put away is picked up again from **Back to your trip**) and focus returns to the button you pressed. Required pop-ups (`modal(…, true)`, like the update notice) ignore Esc.
- **Go buttons** carry an `aria-label` with the destination ("Go to Kenai Harbor · 25 min"). Everything you can press is at least **44×44 px**: action buttons, chips, the ⚙️ gear, toast ✓, tips, pins and the priority list buttons.
- **Top bar:** the day and clock stay on one line and the date line gets its own full-width row (it ellipsizes, with the full text in its tooltip). Stat values never wrap: cash shows compact in the bar ($48k from $10,000 up, full amount in its tooltip) and the largest text setting lays the stats out two rows of three. Settings also has text size, high contrast and reduced motion.

## Update notice

`src/js/29-update-notice.js`. The game remembers the last version it showed on this device (`guidemaster.lastVersion`). When the title screen appears with a different version (including after the service worker brings in an update and the app reloads), a **🆕 Updated to version X.Y.Z** pop-up lists what's new (from the `CHANGELOG` object; unknown versions get a generic line) and, if there are saved games, says they were updated. Every slot's save is run through `migrate()` and re-saved first, keeping its timestamp. It is required: Esc and shortcut keys don't dismiss it (`modal(…, true)`), and only **Got it** stores the new version, so a reload before that shows it again. New players with no saves see nothing. When you release, add a `CHANGELOG` entry for the new version.

## Careers: 2, 5 or 10 years

When you start a new game you pick a **2-, 5- or 10-year career** (`src/js/24-career.js`). Each season you play the two-week July peak, Monday to Sunday, starting on the Monday nearest July 13 (2026: Jul 13; 2027: Jul 12; 2028: Jul 10…). Between seasons comes the **off-season**:

- **Recap and bills:** the year's trips and earnings, then winter living costs, license and permit renewals (ADF&G guide and business licenses, KRSMA permit, decals) and insurance.
- **Next year's rules and runs:** season 1 is the real 2026 (kings closed, single-hook/no-bait, Area 3A halibut 27-inch second fish, no retention Tue/Wed). Later seasons are invented but plausible. The sockeye and coho forecasts vary in size and timing, and kings may be closed, catch-and-release only or open (1 a day, harvest record). Bait is allowed when kings are open. The halibut size limit and closed days shift too. Weak sockeye years can bring an emergency order cutting the limit to 2; strong years raise it to 6. Pinks run only in even years.
- **Upgrades:** rebuild the outboard (still 50 hp), a new jet sled, a new drift boat, marketing, a winter course, rate increases (+10% a step, three steps; see below), or a Charter Halibut Permit so you run your own Homer charters. Late-career money sinks: an **assistant guide**, **guest cabins** and a **riverfront lot with a private launch and fuel dock** (see below).
- **Bookings:** next season's bookings depend on your reputation, marketing and rates.
- **Rates are a trade-off:** each +10% step pays 10% more per trip but cuts bookings by about 8% (July trips and the rest-of-summer income both scale down), makes clients pickier (−3 happiness per step, so tips shrink unless the day goes well) and needs more reputation (65 for the first step, 70, then 75). In 20-career sims a by-the-book guide who raised rates to +30% scored about 2–3% *below* one who never did, instead of 16% above.
- **Booking requests:** phone requests (📞 Return calls) get a random date in the next few days, re-rolled once if it is illegal, so some still land on Sunday/Monday (lower-river trips) or a closed halibut day. The request sheet flags the problem and can offer the nearest later legal, free day instead; "Book it anyway" keeps the on-trip dilemma. The nonresident dipnet "guests" request comes at most once per season.
- **Your record:** a first-aid/CPR card lasts two years. Classes run Monday, Tuesday and Thursday, 1:00–4:00 PM at the Soldotna clinic; you can join from 1:00 until 1:30 PM and still sit the 3 hours. The alert bar and To-do turn urgent from the Monday of the week the card expires. Citations drop off after the following season; three active citations still cost you the permit.

The score covers the whole career (net cash, the estimated rest of the last summer, three quarters of the value of what you bought, rep ×15, 60 a trip, −400 a citation, 2 a freezer fish and 300 a season for a clean record). The **end screen lists every one of those rows and they add up to the score** (`scoreParts()` in `21-story.js`), then your career: July trips played and clients are real counts, while the rest of each summer (June, August, September) is labeled as an estimate. Money everywhere goes through one formatter, `$()` in `01-core.js` (thousands separators: $47,975; `$k()` gives $48k for the cramped top bar). The grade is per season, so careers of any length compare. Per-season cutoffs are the same on every difficulty: **A ≥ 66,000, B ≥ 57,000, C ≥ 45,000, D ≥ 28,000**, F below (a loss is always F). On Licensed Guide a by-the-book career lands mostly on B with some A, an attentive career that takes every request mostly on A, and a passive one (no upgrades, no camping) on B or C.

### Difficulty

Difficulty never changes the score. It changes the game (`DIFFS` in `src/js/00-game.js`, read as `DF().field`):

| | Rookie Season | Licensed Guide | Combat Season |
|---|---|---|---|
| Start cash | $3,000 | $1,500 | $600 |
| Patrol catch chance (`enforce`) | ×0.7 | ×1 | ×1.4 |
| Fines | ×0.8, plus 10% for each active citation | ×1, plus 20% for each active citation | ×1.1, plus 30% for each active citation |
| Fuel, nightly overhead, winter bills, repairs (`cost`) | ×0.8 | ×1 | ×1.2 |
| Client mood (tips and rep) | +6 | 0 | −7 |
| Off-month bookings (`book`) | ×1.08 | ×1 | ×0.88 |
| Boat wear per trip | ×0.85 | ×1 | ×1.25 |
| Bad random events (`bad`) | ×0.6 | ×1 | ×1.5 |

The same play grades about one step lower on Combat Season than on Licensed Guide, and about one step higher on Rookie Season. Combat Season is still winnable by a careful guide.

### What the upgrades really do

- **Repower** (`$13,500`): the boat goes back to 100, wear on it is halved, and the sled burns **20% less fuel** on trips, scouting and solo outings (`fuelMult()` in `25-fuel.js`; the charter boat is a different boat).
- **New sled** (`$52,000`): sockeye and silver trips finish **30 minutes sooner** (a little less tiring), the refuel run to Kenai Harbor takes 45 minutes instead of 65, the tank holds 40 gallons, and the catch and happiness bonuses stay. It does **not** raise the party size: the July limit (5 people including the guide below Skilak) and KRSMA's 6-person cap are law, not horsepower.
- **Boat condition and the safety net.** The Boat stat is the condition of your sled and drift boat. It warns you as it falls: an alert bar, a To-do item and a status tag at **40, 20 and 10** (and a toast when a trip carries it across one). At **0** neither can launch (the halibut charter on a buddy's boat is unaffected) and the shop's $165 and $525 services are locked, so you pay a **major repair** (a jet-unit rebuild and a new drift-boat floor, `$2,400`, 4 hours, back to 50; the dealer lets it go on account). Two cheaper ways to keep a booked trip alive, at the shop or a launch: an **emergency patch** (`$600`, 1 hour, only at 10 or below, boat back to 25; it gives out after two days) and a **loaner** (`$600` for the day, only at 0: today's trips run on a borrowed rig, clients −6 happiness, your own boat unchanged). Winter wear alone never takes a boat below 10, so it takes neglect during a season to get there. In 20-career sims a guide who never services but pays for patches or loaners scores about 2–4% below one who services (and never loses), while one who ignores the warnings and never pays anything still loses (16 of 20 five-year and 20 of 20 ten-year careers).
- **Assistant guide** (`$32,000`, Rep 70, after two seasons): a used second sled and trailer, decals, permit and training. When you are already booked, a second party can take the same slot with your assistant (booking requests and season bookings both offer it). He settles overnight: you keep **60%** of fare and tips, pay the fuel and launch, and about one trip in eight goes wrong (a quarter-fare refund and rep −4, or a ticket of about $300 and rep −5: it's your name on the decal; it doesn't count toward your three citations). He also covers about 20% extra off-month trips. Winter overhead $3,000 (license, decals, insurance, drug testing).
- **Guest cabins** (`$95,000`, Rep 60, after three seasons): four riverside cabins at about $225 a night. About +$12,000 a year at a top reputation after cleaning, staff and utilities (the cabins gross $30,000 × the same rep factor as the rest of the summer, cost $20,000 to run) and a $5,500 winter bill for taxes, insurance and winterizing, plus 10% more off-month trips from guests. Much less if your rep is poor.
- **Riverfront lot with a private launch and pump** (`$240,000`, Rep 70, after four seasons): no $15 launch fees, no trips to Kenai Harbor (fill up at your own dock for about $0.85 a gallon less than the marine dock), +3 happiness on sockeye and silver trips and about 8% more bookings.

Prices are game values in the range of 2026 Alaska costs (used sleds and trailers, cabin construction, Soldotna riverfront lots with ramp and dock permits all vary a lot); they are not quotes. Boats, cabins and the lot count at three quarters of their price in the score, like the other purchases. In 20-career 10-year sims (Licensed Guide, by-the-book) a guide who buys them all scores about **12% more** than one who stops at the old upgrade list (59,000 vs 52,900 per season) and ends with **$161,000** in cash instead of **$285,000**, with $454,000 spent on upgrades instead of $243,000; with and without rate increases they score within 1% of each other.

## Long careers: regulars, more dilemmas, story arcs

`src/js/30-stories.js` (plus the `PARTIES` list in `21-story.js` and the dilemma limits in `22-trips.js`) keeps a 10-year career from repeating itself.

- **54 client parties** (15 Alaska residents, the rest visitors from the Lower 48 and abroad: families, retirees, club and work outings, an adaptive-fishing group, newlyweds, Coast Guard and school-staff outings and more) instead of 15. In a 10-year sim a career met about 68 different parties, up from 30.
- **Returning regulars.** After a trip with a happy party (happiness 75+) there is a 40% chance they slip you their number and become a regular (at most 10 at a time). Each following July they rebook with odds that follow how their last trip went: about 95% after a five-star day, 85% after a good one, 55% after an OK one, 25% after a flat one and never after a bad one; two missed years or a bad trip drops them. A five-star party brings one more person. At launch they remember: +5 happiness for a five-star last trip, +3 for a good one, −4 if the last one was rough. Regulars show a ⭐ on the Bookings tab and in the off-season bookings message. In 10-year sims about 21 trips per career (roughly one in ten) were regulars.
- **Dilemma limits.** No dilemma comes up more than **twice a season** (random picks and quirk beats; rule-forced ones like a closed halibut day, a worn-out motor or the spot's own follow-ups are exempt). The **king dilemma** is also thinned by the rules: it is offered 30% of the time it would otherwise be picked when kings are closed, 55% when catch-and-release only and always when open. In 10-year sims king fell from 4.2 to 1.8 appearances a season and "show us how it's done" from 4.5 to 2.0.
- **Six new dilemmas** from real Kenai guiding, each with the usual shape (a legal option that costs something, a rule-breaking one that pays cash): a child's life jacket (Alaska requires kids 12 and under to wear one on boats under 26 feet underway), a humpback off Homer (stay 100 yards away), a capsized paddler (no rule: stop and help, or call it in), a client's treble-hook spinners under the single-hook emergency order, a posted private bank (state land below the ordinary high-water line, private uplands) and seasick charter clients.
- **Three multi-season story arcs**, each scene at most once a season from the second season on, one scene a morning:
  - *A rival guide* (Dale Voss, any rep of 55+): he parks on your seam; share or hold it. Next season he either sends you a party or runs you down on a forum depending on what you did; in the finale his sled quits and you can tow him in (a small permanent booking bonus, the Good Neighbor achievement).
  - *The Garza family*: your season-1 Garzas become regulars if their first trip goes well (60+). Over four Julys: Mateo's first big fish, Grandpa Ray's first trip, and Mateo asking to work for you (an unlicensed person can't run a guide vessel). Family Tradition achievement.
  - *The advisory committee* (rep 70+): a seat on the Kenai/Soldotna Fish and Game Advisory Committee, a vote on a proposal to the Board of Fisheries about the late-run escapement goal, and testimony at the Board of Fisheries (a three-hour hearing, so it only comes on a day with no trips booked: an earlier version ate the morning's trips and cost a 15-point no-show review). The game doesn't change any rule in response; the arc is about your standing. A Seat at the Table achievement.

## How a trip pays

`tripEnd()` in `src/js/22-trips.js`. The booked fare is the base; the day moves the rest, and the trip summary shows each line.

- **Tips** run from 0 to 30% of the fare and rise with client happiness: the catch against the limit (a run of fish, good weather, tide and run size), the spot, your choices, your sled or drift boat and the difficulty's mood. A full limit adds happiness.
- **Refunds:** unhappy clients get part of the fare back (up to 25%), and a skunked trip costs another 5%. Being towed halves the fare.
- **Tackle:** out of tackle, the fish bite worse and the clients grumble. Restock in Soldotna.
- **Boat:** below 70 the boat can break down on a trip (more likely the lower it is): 1-2 hours lost, a 15% credit for the clients and a roadside repair bill; above 80 the clients are a little happier. Service the boats at the shop.
- **Side deals:** the cash on dilemma options (tips for a bent rule, lunch for a sulking deckhand) shows as separate lines.
- **Word of mouth:** very happy clients (and very unhappy ones) move your reputation, and a season of great days nudges the next off-season bookings up (down for bad days), on top of the reputation effect.
- **Fines and warnings:** the first minor offence each season is only a warning (warnings reset every season). After that every citation costs more per active citation on your record (the percentages above), and three active citations still pull your permit.

## Winter camping

`src/js/28-camping.js`. During the off-season, **🏕️ Go winter camping** opens a destination picker, then a nights picker (1, 2, 3, 5 or 7) and a cost breakdown before you confirm. It is available once per off-season (a second trip would crowd out your winter job) and never moves the game clock: the trip happens between seasons.

| Destination | One-way road miles from Soldotna | Fee per night in the game |
|---|---|---|
| Johnson Lake (Kasilof) | 16 | free in winter ($20 in season) |
| Clam Gulch beach | 22 | free ($20 in season) |
| Hidden Lake (Kenai Refuge) | 24 | free ($15 in season) |
| Swanson River Rd & Swan Lake canoe area | 29 | free |
| Lower Skilak Lake Campground | 33 | free |
| Captain Cook State Rec Area | 36 | free ($20 in season) |
| Deep Creek State Rec Area | 42 | free ($20 in season) |
| Quartz Creek (Kenai Lake) | 51 | free |
| Anchor River State Rec Area | 66 | $20/night |
| Homer Spit | 83 | free (city sites open Apr–Oct only) |

Miles are estimates from Sterling Highway mileposts (Soldotna about MP 95.2; Quartz Creek MP 44.9, Swanson River Rd MP 83.5 plus 17 miles, Skilak Lake Rd west end MP 75.2 plus 3.5 to Hidden Lake and 13.3 to Lower Skilak, Johnson Lake Rd MP 110, Clam Gulch MP 117.4, Deep Creek MP 137.3, Anchor River MP 161, Homer MP 173 plus the Spit road). Sources: [Bells Alaska Sterling Highway road log](https://www.bellsalaska.com/roadlogs/sterling-highway-log.pdf), [Alaska State Parks fees](https://dnr.alaska.gov/parks/asp/unitfees.htm) ($20/site at Johnson Lake, Clam Gulch, Deep Creek, Captain Cook and Anchor River), [Kenai NWR camping fees](https://www.fws.gov/refuge/kenai/visit-us/activities/camping), [Swanson River Rd](https://dnr.alaska.gov/parks/aspunits/kenai/swansonrvld.htm), [Captain Cook SRA](https://dnr.alaska.gov/parks/aspunits/kenai/captcook.htm), [ADF&G Skilak Lake Road](https://www.adfg.alaska.gov/index.cfm%3Fadfg%3Dviewinglocations.skilaklakeroad) and [City of Homer campgrounds](https://www.cityofhomer-ak.gov/node/7456). Most campgrounds are not serviced in winter, so the game charges no site fee there; I could not confirm winter service for the refuge sites, Quartz Creek or Anchor River, and Captain Cook's distance (about 11 miles to Kenai plus 25) is approximate.

**Costs:** gas = round-trip miles ÷ 15 mpg × winter pump price (the Kenai dock price minus the roughly $0.85 marine premium, about $5.34 at the start and drifting each season) + site fees × nights + $25 a night in supplies. Trips you can't afford are disabled.

**Encounters:** each night camped rolls once: 50% chance of one wildlife encounter, weighted by the habitat of the place (lake, forest, coast, river, mountain). Quiet nights give a little rest (+2 energy). Energy carries into the new season; skill, rep and cash change too.

- Good: cow moose and calf (approach her and it turns bad), wolves howling across the lake, a lynx on the trail, trumpeter swans on open water, bald eagles on the beach, Dall sheep on the slope.
- Bad: a red fox raids the food bag, ravens open the cooler, a porcupine chews the truck and axe handle, a brown bear out of its den in a warm spell.

Achievements: Happy Camper (7 nights in total) and Wild Kenai (5 different encounters). The end screen lists nights camped and encounters.

## Waiting and the alarm

Time only moves when you act, so skipping ahead has its own action: **⏳ Wait until…** (every place except mid-trip and the off-season screen; `waitModal()` in `20-world.js`) offers only choices that make sense right now: *until the party shows up* for a launch at your current spot (an hour before the launch), *until it's time to leave* for a launch elsewhere (launch minus the drive), *until the 1:00 PM first-aid class* on a class day when your card is due, and *30* or *60 more minutes*. It never runs past midnight. Waiting passes time like anything else (a little energy). The default alarm for **new** games is **5:00 AM** (`GAME.wake`); a saved game keeps whatever alarm it had, and the shop's alarm action still cycles 4:00–6:00.

## Fuel, towing and prices

`src/js/25-fuel.js`:

- **Fuel gauge** (HUD): the jet sled has a 30-gallon tank (40 with the new sled) and starts season 1 at 18 gallons. A sockeye trip burns about 9 gallons, a silver trip about 11 and scouting about 4 (20% less after the repower). Long runs (Swiftwater, Moose Range Meadows, the Barren Islands) and wind over 12 kt burn more. Drift-boat floats burn nothing.
- **Harbor-only fueling:** the sled fills only at the **Kenai Harbor** fuel dock (Kenai City Dock at the river mouth, 6 AM–10 PM). Your own Homer charter boat (100 gal, ~45 a day) fills at the Homer Harbor fuel dock. A low tank at launch gives you two choices: send the clients for coffee and run to the harbor (about 65 minutes; they notice), or risk it. The check plans for the trip, not the average: base burn, plus the longest run you could pick (Swiftwater or Moose Range Meadows), plus the usual scatter, times the wind factor (`expectBurn()` in `25-fuel.js`: about 13.5 gallons for a sockeye trip and 16.5 for a silver, before the repower and wind). **The first time you ever pick "Risk it", the game asks again** with the consequences spelled out (tow, half fare, rep, a $102 assist, a bad review, a possible ticket). The harbor fuel dock keeps its **6 AM–10 PM** hours in the mid-trip option too: arrive before 6 and the run includes waiting for it to open (clients grumble more); after 10 PM there is nothing to buy. **Evening reminder:** from 5 PM, if the sled's tank won't cover the sled trips booked for the rest of today and tomorrow, the alert bar, To-do ("Fuel up for tomorrow"), the Go to bed line and the night summary say so, with the dock's hours.
- **Running dry:** the Coast Guard tows you to Kenai Harbor and the harbormaster brings you to the fuel dock for $102 (Homer's harbor tariff rate), and sells you 12 gallons to get going again (36 for the charter boat). The trip is cut short with half the fare refunded, you lose rep, and the boarding may turn up an expired flare kit. In 20-career five-year sims a guide who never refuels (always "Risk it") used to lose every career by about day 9 after a run of tows (2,200 points a season); with the 12-gallon top-off and the other changes they still lose 19 of 20, but around day 31, and score about 8,100 a season. A by-the-book guide is unaffected (56,700 against 57,100 a season, within noise). Solo outings and scouting can run dry too.
- **Prices (approximate, 2026):** marine gas starts at $6.19/gal at Kenai and $6.45 at Homer (pump gas on the Peninsula was about $5.14–5.55) and drifts each season. DIY boat service is $165 in parts; a dealer 100-hour service is $525. Tackle is $120 for four trips; a broken rod and reel costs $165. The motorized launch fee is $15.
- **Upgrades** at realistic prices: repower with a new 50 hp jet outboard $13,500; new 20-ft welded sled, motor and trailer $52,000; drift boat and trailer $12,500; Charter Halibut Permit plus a used 28-ft six-pack boat $165,000; assistant guide and second sled $32,000; four guest cabins $95,000; riverfront lot with private launch $240,000 (what each really does is above).
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

The game itself lives in `src/js/20-world.js` (places, trips, bookings, tabs), `src/js/21-story.js` (story, events, scoring), `src/js/22-trips.js` (the trip runner and the regulation dilemmas) and `src/js/30-stories.js` (regulars, extra dilemmas, story arcs).

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
| `endDay('home')` | Sleep: runs `onNight`, the `night` hook and the summary, then the next morning. The night summary opens first; anything the morning brings (booking requests, event pop-ups, the off-season screen) queues behind it |
| `modal(title, html, [{l, s, fn, dis}])` | Bottom sheet; queued if one is open |
| `showTile(ic, title, sub, 'good'|'bad'|'warn'|'info')` | Toast just below the HUD (so Cash and Rep stay visible): one at a time, about 3.5 seconds each, the rest queue briefly (duplicates dropped, at most 3 waiting), and it is skipped if an open or queued pop-up already contains its title. Events that open their own modal or show the OK pop-up (Settings → Event pop-ups) don't also toast |
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
