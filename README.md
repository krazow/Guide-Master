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
- **Top bar:** the day and clock stay on one line and the date line gets its own full-width row (it ellipsizes, with the full text in its tooltip). Stat values never wrap: cash shows compact in the bar ($48k from $10,000 up, full amount in its tooltip) and the largest text setting lays the stats out two rows of four. Settings also has text size, high contrast and reduced motion.

## Update notice

`src/js/29-update-notice.js`. The game remembers the last version it showed on this device (`guidemaster.lastVersion`). When the title screen appears with a different version (including after the service worker brings in an update and the app reloads), a **🆕 Updated to version X.Y.Z** pop-up lists what's new (from the `CHANGELOG` object; unknown versions get a generic line) and, if there are saved games, says they were updated. Every slot's save is run through `migrate()` and re-saved first, keeping its timestamp. It is required: Esc and shortcut keys don't dismiss it (`modal(…, true)`), and only **Got it** stores the new version, so a reload before that shows it again. New players with no saves see nothing. When you release, add a `CHANGELOG` entry for the new version.

## Fewer pop-ups (1.12.0)

New players were getting 6 to 9 pop-ups a day. Now a day is a **morning report** and, on a trip day, **one trip sheet**.

- **Morning report** (`endDay()` and `morningReport()` in `src/js/04-loop.js`): the night summary, overnight lines, morning events (`fireHook('wake')`, `eventPopup()`), toasts that would have fired while you wake (`showTile()` collects them while `DIGEST` is set), reminders and the requests waiting in Bookings are ONE pop-up. While it is being put together `modal()` holds any other pop-up (a hungry morning, a rival or board story, the off-season) and shows it right behind the report, so a decision that cannot wait is never lost. The toasts that repeated its content are dropped.
- **Booking requests** (`queueRequest()`, `reqView()`, `reqAns()` in `src/js/21-story.js`): `S.reqs` holds `{id, r, exp}`. They sit at the top of the 📅 Bookings tab with a dot, for two days (`REQ_WAIT`), with the same answers the old pop-up had (`requestOpts()` builds both). A request that lapses is named in the next morning report. Only a request made while you return calls at the shop (`requestArrives()`) and for tomorrow or sooner still opens its own pop-up; later ones queue with one small toast.
- **A trip is one sheet** (`tripNext()` in `src/js/22-trips.js`, `modalSwap()` and the `stay` button flag in `src/js/02-kit.js`): the cooler is shown with the spot choice (a group of toggle buttons, first option selected like the old first button), each dilemma and the "Back at the dock" result swap in place on the same sheet, with "n of m" progress. Options, shuffling, `legal` flags, `data-legal` and `window.legalBtn()` are unchanged. **⚙️ Settings → Show every trip step** (`prefs().tripSteps`, off by default) brings back one pop-up per step, the cooler on its own. A button with `stay:true` keeps the sheet while its `fn` runs; if `fn` calls `modalSwap()` the sheet's content changes, otherwise it closes. The cabin engine's job, storm and spring-job pop-ups use the same flag (`src/home/home-30-ui.js`), so the off-season has no repeated sheets.
- **Everything else informational** (Event pop-ups in Settings now default to off): a tile and a log line.
- Tests and bots: a test or bot that walks pop-ups still calls `MBTN(legalBtn())` until `#mbg` is gone; the sheet just stays up between steps. `tools/sim/sim-lib.js` answers waiting requests (`answerReqs()`) and picks the cooler through `tripPack()`/`packSel()`.

Pop-ups on screen, days 1 to 7 of a fresh normal 5-year career at 390 x 844 (the playtest script: a bot plays each day, the next morning's pop-ups are counted, a pop-up that was queued counts once): 43 before, 13 after (never more than 2 a day); the first off-season 8 before, 4 after. A trip day also has 3 or 4 choices and the result inside its one sheet. `tests/v1120.test.js` plays the week and asserts at most 4 a day, 25 for the week and 6 for the off-season.

Balance (5-year careers, 40 per cell, default cabin play, mean season score; before = 1.11.0, same seeds; the noise is about plus or minus 500):

| style | difficulty | 1.11.0 | 1.12.0 | change |
|---|---|---|---|---|
| expert | hard | 58,354 | 58,231 | -123 |
| expert | normal | 60,278 | 60,278 | +0 |
| food | hard | 55,153 | 55,045 | -108 |
| food | normal | 57,956 | 57,956 | +0 |
| ignores | hard | 44,668 | 44,483 | -185 |
| ignores | normal | 46,752 | 46,746 | -6 |
| opport | hard | 52,439 | 52,393 | -46 |
| opport | normal | 55,267 | 55,267 | +0 |
| passive | hard | 47,623 | 47,593 | -30 |
| passive | normal | 54,719 | 54,642 | -77 |
| phone | hard | 57,396 | 57,371 | -25 |
| phone | normal | 60,766 | 60,754 | -12 |
| skilled | hard | 60,860 | 60,860 | +0 |
| skilled | normal | 69,741 | 69,741 | +0 |

## Careers: 2, 5 or 10 years

When you start a new game you pick a **2-, 5- or 10-year career** (`src/js/24-career.js`). Each season you play the two-week July peak, Monday to Sunday, starting on the Monday nearest July 13 (2026: Jul 13; 2027: Jul 12; 2028: Jul 10…). Between seasons comes the **off-season**:

- **Recap and bills:** the year's trips and earnings, then winter living costs, license and permit renewals (ADF&G guide and business licenses, KRSMA permit, decals) and insurance.
- **Next year's rules and runs:** season 1 is the real 2026 (kings closed, single-hook/no-bait, Area 3A halibut 27-inch second fish, no retention Tue/Wed). Later seasons are invented but plausible. The sockeye and coho forecasts vary in size and timing, and kings may be closed, catch-and-release only or open (1 a day, harvest record). Bait is allowed when kings are open. The halibut size limit and closed days shift too. Weak sockeye years can bring an emergency order cutting the limit to 2; strong years raise it to 6. Pinks run only in even years.
- **Upgrades:** rebuild the outboard (still 50 hp), a new jet sled, a new drift boat, marketing, a winter course, rate increases (+10% a step, three steps; see below), or a Charter Halibut Permit so you run your own Homer charters. Late-career money sinks: an **assistant guide**, **guest cabins** and a **riverfront lot with a private launch and fuel dock** (see below).
- **Bookings:** next season's bookings depend on your reputation, marketing and rates.
- **Rates are a trade-off:** each +10% step pays 10% more per trip but cuts bookings (about 8% fewer at +10%, 18% at +20%, 31% at +30%: the first step is cheap, the third is not; July trips and the rest-of-summer income both scale down), makes clients pickier (−3 happiness per step, so tips shrink unless the day goes well, and 30% of that also counts against the season's quality, see *Skill and the quality of your season*) and needs more reputation (65 for the first step, 70, then 75). In 30-career sims (1.8.0) a by-the-book guide who bought every upgrade and raised rates to +30% scored 8% (2 years) and 8% (5 years) *below* the same guide who stopped before raising rates (59,100 against 64,100 over 2 years, 59,700 against 65,000 over 5): going all the way is a mistake, which is part of why a skilled career beats a by-the-book one.
- **Booking requests:** phone requests (📞 Return calls) get a random date in the next few days, re-rolled once if it is illegal, so some still land on Sunday/Monday (lower-river trips) or a closed halibut day. The request sheet flags the problem and can offer the nearest later legal, free day instead; "Book it anyway" keeps the on-trip dilemma. The nonresident dipnet "guests" request comes at most once per season.
- **Your record:** a first-aid/CPR card lasts two years. Classes run Monday, Tuesday and Thursday, 1:00–4:00 PM at the Soldotna clinic; you can join from 1:00 until 1:30 PM and still sit the 3 hours. The alert bar and To-do turn urgent from the Monday of the week the card expires. Citations drop off after the following season; three active citations still cost you the permit.

The score covers the whole career (net cash, the estimated rest of the last summer, nine tenths of the value of what you bought, rep ×15, 60 a trip, −400 a citation, 2 a freezer fish and 300 a season for a clean record). The **end screen lists every one of those rows and they add up to the score** (`scoreParts()` in `21-story.js`), then your career: July trips played and clients are real counts, while the rest of each summer (June, August, September) is labeled as an estimate. Money everywhere goes through one formatter, `$()` in `01-core.js` (thousands separators: $47,975; `$k()` gives $48k for the cramped top bar). The grade is per season, so careers of any length compare. Per-season cutoffs are the same on every difficulty: **A ≥ 62,000, B ≥ 55,000, C ≥ 44,000, D ≥ 27,000**, F below (a loss is always F). Since 1.8.0 (fresh 30-career sims, Licensed Guide; 20 for the 10-year ones) good play pays a lot more than it did, so the cutoffs now separate the styles. **Skilled** play (reads the Fish tab and scouts to pick the spot, keeps the boat above 60, takes every phone request, declines illegal ones, hands out cards, buys the motor, course, marketing, sled and drift boat and stops before raising rates) scores about 69,000-71,000 a season over 2 and 5 years (10-year about 76,000) and is nearly always an A. **Sharp but not studied** (every request answered, no Fish tab) scores about 61,000-62,000 (10-year 64,000): A or high B. **By the book** (stocks food, packs lunches, keeps the boat and record in order, buys the usual upgrades *and raises rates three steps*) scores about 59,000-60,000 (10-year 61,000) and is mostly a B with some A and a few C at every length. **Passive** (no upgrades, no camping) scores about 55,000-57,000 and is a C or a B. A career that **never stocks food or packs a lunch** scores about 51,000 over 2 years and 46,000-47,000 over 5 and 10, a C or a D (since 1.8.1; it was 37,000-39,000 over 5 and 10 in 1.8.0, see *Going hungry*). A guide who **bends the low-risk rules when it pays** scores about 57,000-59,000, about 7% below the same guide playing it straight (see *Breaking the rules over a career*). Careless careers that rack up citations lose their permit (F). A skilled career scores about 25% above a passive one at 2 and 5 years (37% at 10) and about 20% above a by-the-book one. In 1.7.1 the styles were 5-10% apart. The by-the-book style scores about what it did (−4% to +2%) and the sharp-but-not-studied styles about 3-5% lower (the tune moved the middle down so that the top could climb), and long careers (8-10 years) still score a bit higher per season because the big-ticket upgrades (charter permit, cabins) pay back late.

### Difficulty

Difficulty never changes the score. It changes the game (`DIFFS` in `src/js/00-game.js`, read as `DF().field`):

| | Rookie Season | Licensed Guide | Combat Season |
|---|---|---|---|
| Start cash | $3,000 | $1,500 | $600 |
| Patrol catch chance (`enforce`) | ×0.7 | ×1 | ×1.4 |
| Fines | ×0.8, plus 10% for each active citation | ×1, plus 20% for each active citation | ×1.1, plus 30% for each active citation |
| Fuel, groceries, nightly overhead, winter bills, repairs (`cost`) | ×0.8 | ×1 | ×1.08 |
| Client mood (tips and rep) | +5 | 0 | −2 |
| Off-month bookings (`book`) | ×1.08 | ×1 | ×0.97 |
| Boat wear per trip | ×0.85 | ×1 | ×1.25 |
| Bad random events (`bad`) | ×0.6 | ×1 | ×1.5 |

Combat Season was re-tuned in 1.8.1 (costs ×1.2 → ×1.08, client mood −5 → −2, off-month bookings ×0.88 → ×0.97): before it, a sharp career (every request answered, illegal ones declined) was a C on Combat Season about 90% of the time, so the difficulty felt unwinnable without studying the Fish tab. In fresh 30-career sims (20 for 10 years) the same play now scores about 4,000-5,000 a season (6-8%) below Licensed Guide: by-the-book about 55,000-57,500, B or C; a sharp career about 56,000-59,000, mostly B; a skilled one about 63,000-70,000, mostly A. It is still clearly the harder difficulty: more patrols, steeper fines, dearer bills, more bad luck and harder-wearing boats. Rookie Season grades about one step higher than Licensed Guide (by-the-book about 69,000, A; a career that skips food B or C).

### What the upgrades really do

- **Repower** (`$13,500`): the boat goes back to 100, wear on it is halved, and the sled burns **20% less fuel** on trips, scouting and solo outings (`fuelMult()` in `25-fuel.js`; the charter boat is a different boat). Since 1.8.0 the real payoff is the boat condition: a boat that stays above 80 pleases clients (see *How a trip pays*) and does not break down.
- **New sled** (`$52,000`): sockeye and silver trips finish **30 minutes sooner** (a little less tiring), the refuel run to Kenai Harbor takes 45 minutes instead of 65, the tank holds 40 gallons, and it gives a slightly better catch (+.03) and happier clients (+2). It does **not** raise the party size: the July limit (5 people including the guide below Skilak) and KRSMA's 6-person cap are law, not horsepower.
- **Winter course** (`$750`, once a winter): skill +14, worth +.056 of catch until the winter rust (40%) takes some of it back.
- **Website refresh and sport-show booth** (`$2,200`, once a winter): +15 points of booking odds for the July you are about to guide and **12% more rest-of-summer trade** for that season only (it used to help July alone, where the calendar is usually full, so it paid nothing).
- **Boat condition and the safety net.** The Boat stat is the condition of your sled and drift boat. It warns you as it falls: an alert bar, a To-do item and a status tag at **40, 20 and 10** (and a toast when a trip carries it across one). At **0** neither can launch (the halibut charter on a buddy's boat is unaffected) and the shop's $165 and $525 services are locked, so you pay a **major repair** (a jet-unit rebuild and a new drift-boat floor, `$2,400`, 4 hours, back to 50; the dealer lets it go on account). Two cheaper ways to keep a booked trip alive, at the shop or a launch: an **emergency patch** (`$600`, 1 hour, only at 10 or below, boat back to 25; it gives out after two days) and a **loaner** (`$600` for the day, only at 0: today's trips run on a borrowed rig, clients −6 happiness, your own boat unchanged). Winter wear alone never takes a boat below 10, so it takes neglect during a season to get there. In 20-career sims a guide who never services but pays for patches or loaners scores about 2–4% below one who services (and never loses), while one who ignores the warnings and never pays anything still loses (16 of 20 five-year and 20 of 20 ten-year careers).
- **Assistant guide** (`$32,000`, Rep 70, after two seasons): a used second sled and trailer, decals, permit and training. When you are already booked, a second party can take the same slot with your assistant (booking requests and season bookings both offer it). He settles overnight: you keep **60%** of fare and tips, pay the fuel and launch, and about one trip in eight goes wrong (a quarter-fare refund and rep −4, or a ticket of about $300 and rep −5: it's your name on the decal; it doesn't count toward your three citations). He also covers about 20% extra off-month trips. Winter overhead $3,000 (license, decals, insurance, drug testing).
- **Guest cabins** (`$95,000`, Rep 60, after three seasons): four riverside cabins at about $225 a night. About +$12,000 a year at a top reputation after cleaning, staff and utilities (the cabins gross $30,000 × the same rep factor as the rest of the summer, cost $20,000 to run) and a $5,500 winter bill for taxes, insurance and winterizing, plus 10% more off-month trips from guests. Much less if your rep is poor.
- **Riverfront lot with a private launch and pump** (`$240,000`, Rep 70, after four seasons): no $15 launch fees, no trips to Kenai Harbor (fill up at your own dock for about $0.85 a gallon less than the marine dock), +3 happiness on sockeye and silver trips and about 8% more bookings.

Prices are game values in the range of 2026 Alaska costs (used sleds and trailers, cabin construction, Soldotna riverfront lots with ramp and dock permits all vary a lot); they are not quotes. Boats, cabins and the lot count at nine tenths of their price in the score, like the other purchases (it was three quarters before 1.7.1, which made a 3- to 6-year career that bought a sled or the charter permit score 5-10% lower per season than a 2-year or a 10-year one). In 20-career 10-year sims (Licensed Guide, by-the-book, 1.6.x) a guide who buys them all ends with **$161,000** in cash instead of **$285,000**, with $454,000 spent on upgrades instead of $243,000; with and without rate increases they score within 1% of each other.

## Long careers: regulars, more dilemmas, story arcs

`src/js/30-stories.js` (plus the `PARTIES` list in `21-story.js` and the dilemma limits in `22-trips.js`) keeps a 10-year career from repeating itself.

- **54 client parties** (15 Alaska residents, the rest visitors from the Lower 48 and abroad: families, retirees, club and work outings, an adaptive-fishing group, newlyweds, Coast Guard and school-staff outings and more) instead of 15. In a 10-year sim a career met about 68 different parties, up from 30.
- **Returning regulars.** After a trip with a happy party (happiness 75+) there is a 40% chance they slip you their number and become a regular (at most 10 at a time); if they didn't, the dock pop-up offers **Hand them your card and ask them back** (10 minutes, 60% yes, 85% after a five-star day). Each following July they rebook with odds that follow how their last trip went: about 95% after a five-star day, 85% after a good one, 55% after an OK one, 25% after a flat one and never after a bad one; two missed years or a bad trip drops them. A five-star party brings one more person. At launch they remember: +5 happiness for a five-star last trip, +3 for a good one, −4 if the last one was rough. Regulars show a ⭐ on the Bookings tab and in the off-season bookings message. In 10-year sims about 21 trips per career (roughly one in ten) were regulars.
- **Dilemma limits.** No dilemma comes up more than **twice a season** (random picks and quirk beats; rule-forced ones like a closed halibut day, a worn-out motor or the spot's own follow-ups are exempt). The **king dilemma** is also thinned by the rules: it is offered 30% of the time it would otherwise be picked when kings are closed, 55% when catch-and-release only and always when open. In 10-year sims king fell from 4.2 to 1.8 appearances a season and "show us how it's done" from 4.5 to 2.0.
- **Six new dilemmas** from real Kenai guiding, each with the usual shape (a legal option that costs something, a rule-breaking one that pays cash): a child's life jacket (Alaska requires kids 12 and under to wear one on boats under 26 feet underway), a humpback off Homer (stay 100 yards away), a capsized paddler (no rule: stop and help, or call it in), a client's treble-hook spinners under the single-hook emergency order, a posted private bank (state land below the ordinary high-water line, private uplands) and seasick charter clients.
- **Three multi-season story arcs**, each scene at most once a season from the second season on, one scene a morning:
  - *A rival guide* (Dale Voss, any rep of 55+): he parks on your seam; share or hold it. Next season he either sends you a party or runs you down on a forum depending on what you did; in the finale his sled quits and you can tow him in (a small permanent booking bonus, the Good Neighbor achievement).
  - *The Garza family*: your season-1 Garzas become regulars if their first trip goes well (60+). Over four Julys: Mateo's first big fish, Grandpa Ray's first trip, and Mateo asking to work for you (an unlicensed person can't run a guide vessel). Family Tradition achievement.
  - *The advisory committee* (rep 70+): a seat on the Kenai/Soldotna Fish and Game Advisory Committee, a vote on a proposal to the Board of Fisheries about the late-run escapement goal, and testimony at the Board of Fisheries (a three-hour hearing, so it only comes on a day with no trips booked: an earlier version ate the morning's trips and cost a 15-point no-show review). The game doesn't change any rule in response; the arc is about your standing. A Seat at the Table achievement.

## How a trip pays

`tripEnd()` in `src/js/22-trips.js`. The booked fare is the base; the day moves the rest, and the trip summary shows each line.

- **Tips** run from 0 to 30% of the fare and rise with client happiness: nothing at 60, about 14% at 74 (an average day) and the full 30% at 90 and up (it was (happiness − 62) ÷ 130 before 1.8.0, so a great day tipped about 20%). Happiness comes from the catch against the limit (a run of fish, good weather, tide and run size), the spot you pick, your choices, your sled or drift boat, your boat's condition and the difficulty's mood. A full limit adds happiness.
- **Refunds:** unhappy clients get part of the fare back (up to 25%), and a skunked trip costs another 5%. Being towed halves the fare.
- **Tackle:** out of tackle, the fish bite worse and the clients grumble. Restock in Soldotna.
- **Boat:** below 70 the boat can break down on a trip (more likely the lower it is): 1-2 hours lost, a 15% credit for the clients and a roadside repair bill. Since 1.8.0 the boat's condition also moves client happiness on every trip: **+4 at 100**, +3 at 85, nothing at 65, −3 by 44 and below. Service the boats at the shop.
- **Side deals:** the cash on dilemma options (tips for a bent rule, lunch for a sulking deckhand) shows as separate lines.
- **Word of mouth:** very happy clients (and very unhappy ones) move your reputation, and a season of great days nudges the next off-season bookings up (down for bad days), on top of the reputation effect.
- **Fines and warnings:** the first minor offence each season is only a warning (warnings reset every season). After that every citation costs more per active citation on your record (the percentages above), and three active citations still pull your permit.

## Skill and the quality of your season

Version 1.8.0 (`src/js/22-trips.js`, `23-fish.js`, `24-career.js`, `25-fuel.js`, `30-stories.js`). Before it, the play styles scored only 5-10% apart: reputation sat at 100 for everyone, tips were about 3% of income, the spot barely mattered and the rest of the summer (about 60% of the score) counted trips, not how good they were. Now:

- **Season quality** (`seasonHap()`): the average client happiness over the July trips (`stats.hapSum / hapN`, a no-show counts as 20, the difficulty's client mood is taken out and 30% of the rate mood stays in). The rest of the summer is scaled by it (`qualityF()`, 0.7 to 1.25, about 1.1% a point around 76) together with reputation, word of mouth (±: 0.6% a point, −10% to +15%), your regulars (0.3% each) and the winter marketing buy (12%), and it earns your July **tips** as well as fares. A sloppy season (hungry crew, tired boat, no tackle, no-shows, tows) costs the whole off-season trade, not only a few tips.
- **Skill** (`skillQ()`): +.004 of catch a point up to .16. A trip, a scouting run (2 for a solo outing), an ADF&G office stop, a coaching choice, camping encounters and the winter course (+14) all build it; 40% rusts away every winter (`SKILL_KEEP`). New guides start at 20 (it used to cap at .10 after ten trips, for everyone).
- **Spots, scouting, the Fish tab:** see *Fish, weather and timing*.
- **Regulars:** a happy party (75+) that didn't offer a number can be handed your card at the dock (**Hand them your card and ask them back**, 10 minutes, 60% say yes, 85% after a five-star day). The default roll is still 40%.
- **Upgrades** pay through quality: the new motor keeps the boat above 80 (+4 happiness), the sled and drift boat add catch and happiness, the winter course builds skill and the marketing buy lifts the rest of the summer. Raising rates now gets steeper (see above), so the third step costs more than it brings.

In 30-career sims (Licensed Guide) the styles now sit well apart. See the table below.

## Breaking the rules over a career

Version 1.8.1 (`src/js/22-trips.js`, `25-fuel.js`). Before it, a guide who broke the low-risk rules whenever it paid (with one or no active citations) slightly out-scored the same guide playing it straight: the side cash and the extra fish were worth more than the expected fines, and reputation sat at 100 either way. Now a habit gets noticed:

- **Heat** (`heat()`, `HEAT_P`): every rule you break this season (caught or not) makes the next one 15% likelier to be caught (a 30% risk becomes 39% after two, 48% after four). It resets each winter. Once you have broken a rule this season, every dilemma pop-up with an illegal option says so, and after two the status bar shows *🚔 troopers know your boat*.
- **Word of mouth** (`SEEN_WOM`): when another guide sees it (30% of the uncaught ones) you lose 2 rep, as before, and 4 points of word of mouth, which trims the rest of the summer.
- **Citations are public record** (`citeCancel()`, `CITE_CANCEL`, `CITE_REST`): a citation (not a warning) makes one booked party later this season cancel and take its deposit back 85% of the time, and each citation this season cuts the rest-of-summer bookings by 8% (up to four).

Each choice still pays on the day (the tip and the extra fish are unchanged), so bending a rule stays a real temptation in the moment. Over a career, in 30-career sims, the rule-bending bot now scores 7-11% below the same bot playing it straight on every difficulty and career length (it was 1-2% above on Licensed and Rookie).

## Going hungry

Version 1.8.1 (`src/js/31-supplies.js`). In 1.8.0 a career that never bought food lost a great deal: on Combat Season about 40% of five-year careers scored an F. Now:

- **A warning with a way out:** after a second night in a row without enough to eat (and no more than once a week) the morning opens with *🍽️ Running on empty*: what it costs, what a week of groceries costs, and a quick fix: breakfast and a day of food at the 24-hour gas station for $38 (×the difficulty's cost; about twice grocery prices, 15 minutes). **Not now: push through** keeps you hungry.
- **A softer curve:** a hungry guide's clients lose 5 / 9 / 13 happiness after 1 / 2 / 3 nights in a row (it was 5 / 10 / 15), and the catch suffers a little less.

Ignoring food still costs about a grade: on Licensed Guide 46,000-51,000 a season (C or D, against 56,000-61,000 for the same guide who keeps food in the house); on Combat Season 43,000-47,000, C or D, with 1 career in 30 lost (was 12 of 30 F over 5 years).

## Winter camping

Camping is its own engine, **KenaiCamp**, in `src/camp/` (see `src/camp/README.md`). It touches nothing of Guide Master: `src/js/28-camping.js` is the thin adapter that builds a trip *ticket* from the save, shows the engine's screens in our pop-ups, and applies the trip *report* back. It is built so it can become its own game later ("Kenai Winter Camp"); for now it is hidden inside this one. `tools/build-camp.py` writes a dev-only standalone page, `dist-camp/kenai-camp.html` (git-ignored, not linked, not deployed, not in `sw.js`), that runs the engine in solo mode.

**The off-season hub** (🏕️ Winter camping & work): you have **10 free days** each winter, up to **3 camping trips** and **2 winter jobs** inside them (a job takes a day). The budget restarts every off-season and nothing moves the game clock.

**A trip:** a place (ten, all within 100 road miles of Soldotna), a month (Nov to Mar: sets daylight, ice, weather and the fishing license year), 1, 2, 3 or 5 nights, who comes, where you sleep, what you pack, then each day an activity and an evening, and a night.
- **Daylight:** about 7.3 h in November, 5.8 in December, 6.8 in January, 9 in February, 11.5 in March (Soldotna, approximate). Under 9 h you get **one** daylight activity a day, from 9 h **two**. The evening is separate.
- **Activities:** ice fishing (Johnson Lake and Captain Cook's Stormy Lake only; ADF&G stocks them), cross-country skiing (Swanson River and Captain Cook), snowshoeing, tracking wildlife, scouting next season's water (upper Kenai from Hidden Lake, Skilak and Quartz Creek; Kasilof from Johnson Lake), keeping camp. Evenings: early to bed, a talk by the fire (with company), tie flies and fix gear (tackle credit toward next season: +2 with a vise, +1 without), photograph the northern lights (clear nights, 70% to see them).
- **Ice fishing rules:** it needs a **fishing license, which runs by calendar year** ($20 for an Alaska resident, the game charges $20): a license bought in December does not cover January. Rent an ice kit for $15 or pack your own. **Ice safety:** check the thickness (4 inches of clear ice holds a person on foot) or walk out: a fall is 45% / 30% / 6% / 1% by thickness under 3 / 4 / 5 / more inches, and ice picks turn a dangerous soak into a bad hour. What you catch goes to the freezer, a fish fry (energy) or a story (rep).
- **Packing:** the truck takes 12 load points (a camper adds 4); the tent takes 2, a wall tent 3, each guest 2. Bear container 3 ($80), extra stove fuel 2 ($14 a trip), a -20°F bag 3 ($160), spare layers 2 ($70), a truck kit 2 ($70), ice kit 4 ($90), ice picks and rope 1 ($25), fly vise 1 ($40). Gear is bought once and kept (the fuel is a per-trip cost). Items make specific bad nights rarer and gentler: the container for foxes, ravens, wolverines and bears, the bag, layers and fuel for a cold snap, the truck kit for a dead battery or a drifted-in road, picks for the ice. "Pack the usual" fills the pack in that order.
- **Where you sleep:** tent (comfort 0), wall tent with a stove ($1,200, comfort 1), truck camper ($7,500, comfort 2), or a public-use cabin at Swanson River, Skilak or Quartz Creek ($50-75 a night; comfort 2). Each point of comfort has a 20% chance of turning a bad night into a quiet one.
- **Company:** a regular client, a fellow guide, or the rival (once the arc has started, and only if he is friendly). Guests cost 60% more in supplies. A good trip lifts a regular's last-trip mood (so next July's rebooking odds), earns a little rep and bookings; a bad night costs goodwill.
- **Encounters:** each night still rolls once, 50% for an encounter, weighted by the habitat of the place. The original ten are unchanged; added: river otters, a wolverine, snowshoe hares, ptarmigan, sea otters (the Spit only), chickadees, and three weather events: a cold snap, a snowstorm (an extra night and a tow without a truck kit) and a chinook thaw (softens ice). Over all places and months about 49% of the odds are bad unpacked (it was 58%), and about 38% with a bear container and truck kit.
- **Winter jobs** (a day each): guide ice fishers (about $140 plus tips, with a license and kit), run a snowmachine tour (about $240 less fuel; needs rep 45), help at a winter event (Soldotna's Peninsula Winter Games or Kasilof's Tustumena 200, whenever they run: $60, rep +1, word of mouth, a few bookings).
- **Carried into next summer:** energy (never below 40), rep, skill, word of mouth, fish in the freezer (stocked trout and char are small: three of them count as one red in the freezer), **tackle credit** (up to 12 trips of tackle), **scouting** (a hint at the run's timing and up to +3% catch on your first three trips) and a small **booking boost** (up to +2 points on the chance of a booking each day, which is about 3% more bookings).

**Costs:** gas = round-trip miles ÷ 15 mpg × winter pump price (the Kenai dock price minus the roughly $0.85 marine premium) × the difficulty's cost multiplier; campsite fees (only Anchor River, $20 a night, because most campgrounds are unserviced in winter) or the cabin; supplies $25 a night per person.

| Destination | One-way road miles from Soldotna | Fee per night in the game | Extras |
|---|---|---|---|
| Johnson Lake (Kasilof) | 16 | free in winter ($20 in season) | ice fishing, scouting (Kasilof) |
| Clam Gulch beach | 22 | free ($20 in season) | |
| Hidden Lake (Kenai Refuge) | 24 | free ($15 in season) | scouting (upper Kenai) |
| Swanson River Rd & Swan Lake canoe area | 29 | free | skiing, cabin |
| Lower Skilak Lake Campground | 33 | free | scouting (upper Kenai), cabin |
| Captain Cook State Rec Area | 36 | free ($20 in season) | ice fishing (Stormy Lake), skiing |
| Deep Creek State Rec Area | 42 | free ($20 in season) | |
| Quartz Creek (Kenai Lake) | 51 | free | scouting (upper Kenai), cabin |
| Anchor River State Rec Area | 66 | $20/night | |
| Homer Spit | 83 | free (city sites open Apr-Oct only) | sea otters |

Miles are estimates from Sterling Highway mileposts (Soldotna about MP 95.2; Quartz Creek MP 44.9, Swanson River Rd MP 83.5 plus 17 miles, Skilak Lake Rd west end MP 75.2 plus 3.5 to Hidden Lake and 13.3 to Lower Skilak, Johnson Lake Rd MP 110, Clam Gulch MP 117.4, Deep Creek MP 137.3, Anchor River MP 161, Homer MP 173 plus the Spit road). Sources: [Bells Alaska Sterling Highway road log](https://www.bellsalaska.com/roadlogs/sterling-highway-log.pdf), [Alaska State Parks fees](https://dnr.alaska.gov/parks/asp/unitfees.htm) ($20/site at Johnson Lake, Clam Gulch, Deep Creek, Captain Cook and Anchor River), [Kenai NWR camping fees](https://www.fws.gov/refuge/kenai/visit-us/activities/camping), [Swanson River Rd](https://dnr.alaska.gov/parks/aspunits/kenai/swansonrvld.htm), [Captain Cook SRA](https://dnr.alaska.gov/parks/aspunits/kenai/captcook.htm), [ADF&G Skilak Lake Road](https://www.adfg.alaska.gov/index.cfm%3Fadfg%3Dviewinglocations.skilaklakeroad) and [City of Homer campgrounds](https://www.cityofhomer-ak.gov/node/7456). **Estimates, not checked:** the cabin rates and which areas have a winter public-use cabin, the $29 license price, all gear and shelter prices, winter-job pay, the monthly daylight hours (rounded from 60.5°N) and every month's ice and weather odds. Winter event dates are not asserted.

**Achievements:** Happy Camper (7 nights in total), Wild Kenai (5 different animals), Every Animal (all 16) and No Trace (break camp with food stored, trash packed out and no raided camp). The end screen lists nights, trips, animals logged, fish, tackle credits, winter jobs and what they netted.

**Balance:** camping is optional and small. 40 paired five-year careers per bot (same game seeds; the camping bot uses its own random stream), a "thoughtful" camper (2 trips and 2 jobs a winter, ice fishing or scouting, a good pack, company, flies, no trace; it never buys the camper), season score per season with camping on / off:

| Licensed Guide (normal) | camping | no camping | change |
|---|---|---|---|
| by the book (food stocked) | 59,966 | 58,711 | +2.1% |
| phone | 61,345 | 59,785 | +2.6% |
| skilled | 70,534 | 70,211 | +0.5% |
| opportunist | 56,451 | 54,613 | +3.4% |

| Combat Season (hard) | camping | no camping | change |
|---|---|---|---|
| by the book (food stocked) | 55,622 | 54,102 | +2.8% |
| phone | 56,752 | 56,156 | +1.1% |
| skilled | 65,590 | 64,701 | +1.4% |
| opportunist | 51,118 | 52,345 | -2.3% (checked again in 1.11.0 with 120+ paired careers: the 6-against-1 permit losses were noise, no real effect) |

That averages about +2.1% (normal) and +0.8% (hard); a winter nets about -$80 to -$100 in cash (gear is bought once), +2 rep, 7 stocked fish and 2 tackle credits. Since 1.11.0 stocked fish only spare pantry meals when there are meals to spare, so a guide who **never stocks food** no longer eats from the freezer: that style now scores C and D on normal and Combat Season. A bot that never camps (the "expert" and "passive" styles) scores exactly what it did in 1.8.1 (same seeds, identical scores): camping draws no random numbers and changes no state until you open it. The truck camper ($7,500) is a luxury, not an investment: it lowers bad nights, but it costs more than it returns in score.

## Facts checked for 1.11.0

Numbers in the game were compared against 2025-2026 sources; a number changed only where a source supports it.

| Item | Before | Now | Source |
|---|---|---|---|
| Alaska resident sport fishing license | $29 | $20 | [ADF&G license price list](https://www.adfg.alaska.gov/index.cfm?adfg=license.pricinglist), [2026 sport fishing regulations, licensing](https://www.wafwa.adfg.alaska.gov/static/regulations/fishregulations/PDFs/Southwest/2026sw_sfregs_licensing.pdf) |
| Public-use cabins on the Kenai | $45-65 a night | $50-75 a night (an estimate) | Confirmed only for the Forest Service's Crescent Lake Cabin: $75 a night in the main season, $50 in the shoulder season ([Chugach fee proposal, 2025](https://www.fs.usda.gov/r10/chugach/newsroom/releases/public-input-requested-proposed-cabin-fee-changes)). The Swanson River, Skilak and Quartz Creek rates are not confirmed (the [recreation.gov refuge page](https://www.recreation.gov/camping/campgrounds/233317) lists no nightly fees), so the range is an estimate |
| Wall tent with a stove | $1,100 | $1,200 (an estimate) | not verified against a source in this pass |
| Septic pump-out (hired) | $480 | $400 | [Homeyou, Kenai](https://www.homeyou.com/ak/septic-pumping-kenai-costs): average about $380, most jobs $280 to $520 |
| Tustumena 200 | "runs every winter" | "does not run every winter" | [Peninsula Clarion](https://www.peninsulaclarion.com/news/its-happening-tustumena-200-gets-to-30th-anniversary-after-4-tries/): cancelled four years for lack of snow |

Not verified (left unchanged): truck camper price, heating oil and propane prices, firewood price per cord, well test price, winter job pay, Stormy Lake and Johnson Lake stocking schedules, and this winter's Kenai Peninsula Winter Games status. No 2025-2026 source that could be confirmed was found for them in this pass, so they stay as earlier estimates.

### Grades in 1.11.0 (5-year careers, 40 per cell, default cabin play, season score; the noise is about plus or minus 500 points)

| style | Licensed Guide (normal) | Combat Season (hard) |
|---|---|---|
| skilled | A 40 of 40 | A13 B25 C1 F1 |
| expert | A7 B33 | A5 B27 C6 F2 |
| phone | A12 B26 C1 F1 | A1 B30 C6 F3 |
| by the book (food) | A4 B29 C7 (82% A or B) | A1 B20 C19 (52% A or B) |
| passive | B17 C23 | C36 D3 F1 |
| ignores food | B1 C31 D7 F1 | C24 D16 |

Neglecting the cabin against careful upkeep costs 4.0 to 6.9% on normal and 5.7 to 8.8% on Combat Season (expert 8.8, within noise of the 8% line) for the main styles (ignores-food and the rule-breaker lose more). Two-year Rookie careers that ignore food score A17 B33 C10 against A57 B3 for the by-the-book bot. Combat Season's gap between skilled and expert narrowed because the price-rise trap ("rates" upgrade) and camping and spot-reading credit are tuned on hard only; the normal ladder is unchanged in kind.

## Cabin upkeep

The cabin in Soldotna is its own engine, **CabinUpkeep**, in `src/home/` (contract, prices with their basis and the balance in `src/home/README.md`). `src/js/32-home.js` is the thin adapter, as for camping: it builds a *ticket* from the save, shows the engine's screens in our pop-ups and applies the *report*. The module never touches `S`, `modal(` or `GAME` (`tests/home.test.js` checks the source).

Every chore is offered three ways: do it yourself (July minutes and energy, or a shared winter free day), pay someone (cash), or skip it (a remembered risk). **At most two jobs show at once**, on the **Home** tab, with one gentle reminder a morning. Fall jobs come before the cold, spring jobs after it. A cabin condition meter (0-100) makes bad luck likelier as it falls. Home trouble costs money, days, energy, food, a booked trip or rep, but cash never drops below -$1,200 because of it, so **it never ends a career**.

Features: the condition meter and Home tab; heat (furnace oil, or a wood stove with firewood and a chimney sweep, creosote and chimney fires, running dry in a cold snap); freeze-proofing (heat tape, skirting, dripping taps, burst pipes); snow on the roof and the driveway (lost days come out of the shared 10 free winter days); generator upkeep (oil, a test run, stale gas, wired into `outage()` so a neglected generator may not start); well and septic; bear-safe trash and fish waste; a fish processing station (a modest fee per trip, upkeep, spoilage); moose in the garden; smoke and CO detectors; spring breakup; and a rare earthquake check. Prices are 2026 estimates, not quotes.

**Balance** (80 careers per cell, same seeds; season score, normal / hard, 5-year): careful upkeep, the default bots (top button on each prompt, jobs skipped) and full neglect: skilled 71.8k / 65.9k, 70.0k / 64.5k, 67.9k / 62.7k; by-the-book food 59.9k / 55.9k, 57.4k / 53.5k, 55.7k / 52.7k; phone 62.1k / 58.0k, 60.7k / 56.4k, 58.6k / 53.7k; expert 61.7k / 57.1k, 60.0k / 55.7k, 59.2k / 52.9k. Neglect costs 4-7% of score against careful play (ignores-food about 11%), and careful play beats the defaults on both difficulties and in 2-year careers. The default ladder holds (skilled A, food B, passive B/C, ignores C/D; hard expert and phone mostly B). What neglect costs: faster wear, a steeper luck curve, bigger bills, a booked trip lost to a stuck truck, a dead pump or a run-down place, and bad sleep in July; a kept-up cabin sends you out rested. None of it can end a career. Cells are noisy by roughly 1%.

## Waiting and the alarm

Time only moves when you act, so skipping ahead has its own action: **⏳ Wait until…** (every place except mid-trip and the off-season screen; `waitModal()` in `20-world.js`) offers only choices that make sense right now: *until the party shows up* for a launch at your current spot (an hour before the launch), *until it's time to leave* for a launch elsewhere (launch minus the drive), *until the 1:00 PM first-aid class* on a class day when your card is due, and *30* or *60 more minutes*. It never runs past midnight. Waiting passes time like anything else (a little energy). The default alarm for **new** games is **5:00 AM** (`GAME.wake`); a saved game keeps whatever alarm it had, and the shop's alarm action still cycles 4:00–6:00.

## Fuel, towing and prices

`src/js/25-fuel.js`:

- **Fuel gauge** (HUD): the jet sled has a 30-gallon tank (40 with the new sled) and starts season 1 at 18 gallons. A sockeye trip burns about 9 gallons, a silver trip about 11 and scouting about 4 (20% less after the repower). Long runs (Swiftwater, Moose Range Meadows, the Barren Islands) and wind over 12 kt burn more. Drift-boat floats burn nothing.
- **Harbor-only fueling:** fuel is bought only at the **Kenai Harbor** fuel dock (you can haul extra home into cans, see *Food, home fuel and the generator* below); the sled fills at the **Kenai Harbor** fuel dock (Kenai City Dock at the river mouth, 6 AM–10 PM). Your own Homer charter boat (100 gal, ~45 a day) fills at the Homer Harbor fuel dock. A low tank at launch gives you two choices: send the clients for coffee and run to the harbor (about 65 minutes; they notice), or risk it. The check plans for the trip, not the average: base burn, plus the longest run you could pick (Swiftwater or Moose Range Meadows), plus the usual scatter, times the wind factor (`expectBurn()` in `25-fuel.js`: about 13.5 gallons for a sockeye trip and 16.5 for a silver, before the repower and wind). **The first time you ever pick "Risk it", the game asks again** with the consequences spelled out (tow, half fare, rep, a $102 assist, a bad review, a possible ticket). The harbor fuel dock keeps its **6 AM–10 PM** hours in the mid-trip option too: arrive before 6 and the run includes waiting for it to open (clients grumble more); after 10 PM there is nothing to buy. **Evening reminder:** from 5 PM, if the sled's tank won't cover the sled trips booked for the rest of today and tomorrow, the alert bar, To-do ("Fuel up for tomorrow"), the Go to bed line and the night summary say so, with the dock's hours.
- **Running dry:** the Coast Guard tows you to Kenai Harbor and the harbormaster brings you to the fuel dock for $102 (Homer's harbor tariff rate), and sells you 12 gallons to get going again (36 for the charter boat). The trip is cut short with half the fare refunded, you lose rep, and the boarding may turn up an expired flare kit. In 20-career five-year sims a guide who never refuels (always "Risk it") used to lose every career by about day 9 after a run of tows (2,200 points a season); with the 12-gallon top-off and the other changes they still lose 19 of 20, but around day 31, and score about 8,100 a season. A by-the-book guide is unaffected (56,700 against 57,100 a season, within noise). Solo outings and scouting can run dry too.
- **Prices (approximate, 2026):** marine gas starts at $6.19/gal at Kenai and $6.45 at Homer (pump gas on the Peninsula was about $5.14–5.55) and drifts each season. DIY boat service is $165 in parts; a dealer 100-hour service is $525. Tackle is $120 for four trips; a broken rod and reel costs $165. The motorized launch fee is $15.
- **Upgrades** at realistic prices: repower with a new 50 hp jet outboard $13,500; new 20-ft welded sled, motor and trailer $52,000; drift boat and trailer $12,500; Charter Halibut Permit plus a used 28-ft six-pack boat $165,000; assistant guide and second sled $32,000; four guest cabins $95,000; riverfront lot with private launch $240,000 (what each really does is above).
- **The rest of the summer:** you play the July peak, and the off-season settles June, August and September. That's about 1.95× your July trip count (it was 2.4× before 1.8.0), scaled by reputation, **by how the July went** (the season's average client happiness: an average season is 76, and each point is about 1.1% either way, from 0.7× to 1.25×), by word of mouth and by your regulars (+0.3% each), at your July fares **and tips** minus fuel, launches and tackle, so realistic boat prices are reachable over a career. The winter marketing buy adds 12% to that summer.

## Food, home fuel and the generator

`src/js/31-supplies.js` (v1.7.0). Three small systems that make the cabin a place with stores that can run out. Nothing needs daily micromanaging: one tap stocks a week, meals eat themselves, and the top bar, status tags, alert bar and To-do tell you when something needs attention.

### Food

- **Units:** meals, three a day. The **pantry** (dry goods, 60 meals, never spoils), the **fridge** (fresh food, 15 meals, goes off after 6 days) and the **freezer** (your dipnet and solo-trip reds: one red feeds you about 4 meals; it holds 30 fish, or 70 with the chest freezer upgrade) feed you. You start with 24 pantry meals and 6 fresh (10 days).
- **Stock up:** in Soldotna the **🛒 Stock up** action buys about a week (40% fresh, 60% pantry) for roughly $120, 45 minutes; **🧺 Big shop** fills the pantry and fridge (about $400, 25 days) for a long stretch. **Meals per day cost about $18**: fresh $7 a meal, pantry $5, ×1.0 / 0.8 / 1.2 by difficulty. Soldotna groceries run about 23% over the national average (Areavibes' groceries index for Kenai: 123, Alaska 119; an estimate, not a price list), which on a USDA moderate-cost adult plan of roughly $14 a day (my estimate; I did not re-check the USDA figure for 2026) is about $17-18.
- **No double charging:** the nightly overhead (boat payment, insurance, utilities) dropped from **$75 to $57** (the old figure included groceries, $18 a day). Winter living costs ($800 since 1.10.1, $1,300 in 1.10.0; it was $1,800 before the cabin's heat and upkeep were itemized on the Home tab) already cover eating in the off-season, so there is no food tracking then. The diner ($22) and fish and chips ($20) count as one meal that day, so tonight's home meals drop by one.
- **Every night** the game eats the day's meals for you: the fridge first (it spoils), then the pantry, then a thawed red (so freezer fish have a use besides the score). A meal you can't eat costs **7 energy** and, after a night or more of it, makes you short with the clients: **−5 happiness per night in a row (up to 3)** and a slightly worse catch, on every trip, until you eat again. Food left in the fridge past 6 days is thrown out.
- **Pack the cooler** (a step at the start of every trip, not shuffled; the first option is the plain lunch). *Your lunch* uses one meal and gives **+3 energy** (no food at home: a $12 gas-station sandwich on the way; skipping it costs **−6 energy**, −10 on an all-day trip). *Client lunches* come from stock: **snack bags** (1 pantry meal per 3 clients, +2 happiness, +4 on a long trip), **lunch kits** bought in Soldotna ($12 each, 6 for $72, up to 18, +4 / +7) or a **shore lunch of freezer reds** (1 red per 4 clients, +6 / +9). On a **long trip** (the 8-hour trout float, the 10-hour halibut charter) clients with no lunch are **−6 happiness**. Sockeye (6 h) and silver (5 h) trips need no client lunch.

### Home fuel

- **Fuel is still bought only at the Kenai Harbor dock** (or your own pump with the riverfront lot). At the harbor, **🛢️ Haul fuel home** fills your storage at the dock price; at the shop **Fuel the sled from your home cans** moves it into the sled, free and in 10 minutes. You start with **three 5-gallon approved cans (15 gal) and 10 gallons in them**.
- **Storage limits:** up to 8 cans ($35 each, two at a time), and a **100-gallon steel transfer tank with pump ($768)**. Everything stays outside on a pad, away from the cabin and from ignition (no indoor storage, the game says so).
- **Stale gas:** gas left untreated all winter goes stale (3 to 6 months is the usual figure for untreated pump gas; stabilized gas is good for about a year, up to two with a double dose). The game moves untreated gas to *stale* at each season rollover, where it takes up room (no use in the sled or generator) until you **dispose of it at the hazardous-waste drop-off ($15, an estimate)**. **Stabilizer** ($9 per 25 gallons; a 10 oz bottle treats 25 gal, $8.06 at one marine supplier) turns it into gas that makes it through one winter; a year-old treated lot comes out the other side needing treating again. The alert bar and To-do remind you from three days before the season ends.

### Outages and the generator

- **Outages:** a power outage rolls on most mornings of the season (2.5% a morning, 10% on a windy day: about one season in three has one) and once in each winter (55%). July outages are mostly short (55% under 8 hours; 10% run 24-40 hours); winter storms run 8-110 hours. Peninsula outages are real: [KDLL](https://www.kdll.org/local-news/2025-10-31/multiple-outages-leave-thousands-of-kenai-peninsula-residents-in-the-dark) reported 14,986 Homer Electric Association members out in a late-October 2025 windstorm; the game just says "the power".
- **Without a generator:** the freezer holds **24 hours when under half full and 48 when at least half full** (USDA / FoodSafety.gov guidance for freezers, from memory; I couldn't re-fetch the page), then loses a quarter of its fish for each 6 hours more (all of it 24 hours later); the fridge's fresh food is gone after 8 to 24 hours (the real guidance is 4 hours; the game is gentler in a cool cabin). A night in a dark, cold cabin costs up to **10 energy** (July only; the off-season resets energy).
- **With a generator** (bought in Soldotna, **Home supplies**, runs outside with an electrician's inlet and interlock; carbon-monoxide and indoor warnings in the text): it burns home fuel for as long as it lasts and keeps the freezer, fridge and lights going. Two tiers: a **7,500 W open-frame** ($849.99 at Tractor Supply for the Champion 7500/6000 W, 7.7 gal tank, up to 11 hours at half load; the game rounds to $850 + about $600 for the inlet and interlock, my estimate) burning about **0.45 gal/hour** at a cabin's light load (my estimate from that 11 hours at half load), and a **7,000 W inverter** (the Honda EU7000iS, **$4,449**, 5.1 gal tank, 6.5 hours at rated load and **18 hours at quarter load**, so about **0.28 gal/hour**; [Sportsman's Warehouse](https://www.sportsmans.com/camping-gear-supplies/safety-survival/portable-generators-accessories/honda-eu7000is-ultra-quiet-7000-watt-inverter-generator-with-gfi-and-i-monitor/p/1404889)) plus the same install. The generator is not counted in the score and never pays for itself in cash; it protects the freezer and your sleep (in 4,000 simulated seasons per case a 12-fish freezer loses about 3 reds per season with no generator and about 0.4 with an inverter).

### Balance

In 20-career sims (Licensed Guide, by-the-book bot taught to stock groceries, pack lunches, haul fuel and stabilize it): 2-year **58,000 a season** against 57,500 in v1.6.2 (grades B 14 / C 6, was B 11 / C 9), 5-year **55,700** against 54,700 (C 16 / B 4, was C 14 / B 5 / D 1), no losses. A bot that never stocks food or packs a lunch scores **52,900 (2-year) and 51,500 (5-year)**, about 7-8% lower, with tips down by half or more and grades slipping to C and D; nobody loses. A bot that buys the $5,049 inverter generator scores about 4% lower over 2 years and 2% over 5 (the generator never pays for itself in cash).

### Prices and sources

All prices are 2026 estimates, not quotes. Checked: Honda EU7000iS $4,449, 5.1 gal, 6.5 h / 18 h ([Sportsman's Warehouse](https://www.sportsmans.com/camping-gear-supplies/safety-survival/portable-generators-accessories/honda-eu7000is-ultra-quiet-7000-watt-inverter-generator-with-gfi-and-i-monitor/p/1404889)); Champion 7500/6000 W $849.99 ([Tractor Supply](https://www.tractorsupply.com/tsc/product/champion-power-equipment-7500-6000-start-running-watt-generator-201033)); Better Built 100-gallon steel transfer tank $767.99 ([Tractor Supply](https://www.tractorsupply.com/tsc/product/better-built-rectangle-transfer-tank-black-steel-100-gal)); STA-BIL 10 oz $8.06, treats 25 gal for 12 months, a double dose for up to 2 years ([Fisheries Supply](https://www.fisheriessupply.com/sta-bil-storage-concentrated-gasoline-fuel-stabilizer/22206)); STA-BIL treated fuel good for up to 24 months ([Gold Eagle](https://www.goldeagle.com/?p=268535)); Kenai groceries index 123 against 100 nationally ([Areavibes](https://www.areavibes.com/kenai-ak/cost-of-living/)); Anchorage grocery inflation, food at home +1.4% over the year to June 2026 ([BLS](https://www.bls.gov/regions/west/news-release/2026/consumerpriceindex_anchorage_20260714.htm)). **Estimates, not checked:** the 5-gallon can ($35), chest freezer ($650), the $600 install, the $9 stabilizer price in Alaska, the $15 hazardous-waste fee, meal prices ($5 pantry, $7 fresh, $12 lunch kit) and all outage odds and durations.

## Fish, weather and timing

`src/js/23-fish.js` models when and where fish are, and drives trip quality, the daily sonar count, dipnetting and solo boat days:

- **Run timing by date** for late-run sockeye (peak at the river-mile-19 sonar around Jul 20–25, reaching the upper river about two weeks later), coho (first fish late July, peak mid-August), pinks (even years only, so 2026 has them), late-run kings (closed), resident rainbows and Dolly Varden, and summer halibut. Daily run pulses vary around the curve.
- **Weather** every morning: temperature, wind, rain and the Kenai's glacial river level (rain and warm-day melt raise it). Rising, dirty water scatters reds; overcast helps trout; wind over 18 kt sours Cook Inlet halibut trips and raises the odds of Skilak and Barren Islands blowups.
- **Tides** at the mouth (semi-diurnal with a spring/neap cycle): reds ride the flood tide into the dipnetters; halibut bite at slack water.
- **Time of day**: first light and long July evenings beat midday sun and crowds.
- **🚤 Take the boat out** at the lower launch or Cooper Landing. It checks your bookings first: the boat can't go while a party is on the dock, and solo runs are capped so you're back an hour before your next launch (plus drive time). Without clients your sled is still a *registered guide vessel*, so the Sun/Mon closure and the 6 AM–6 PM hours below Skilak still apply. Pick a species with live odds, fish 2–6 hours, fill the freezer within bag limits, release any king, and get a scouting bonus for your next trip.
- **🐟 Fish tab**: today's weather, river level, tide table, odds by place and species, **where to fish today** (a read of every spot for the trips you have booked) and a run-timing chart with your two weeks and today marked.
- **Spots answer to the day** (1.8.0, `SPOT_FIT` in `23-fish.js`): each spot in the *Where to, Captain?* step does better or worse with the day's water (rising or falling, high or low), wind, cloud, tide and the size of the run: Big Eddy's seams like a strong run and clearing water, the Swiftwater bars like high water, the Centennial walkway likes overcast, Skilak needs a calm lake, the Barren Islands need calm seas. The fit moves the catch by up to ±.15 (`SPOT_Q`) on top of each spot's own trade-offs, so the classic spot is not always the best one. **Nothing is hidden from a player who looks:** after you read the Fish tab today the spot buttons carry a 🐟 *Hot / Good / Fair / Poor* read with the reason, and after you scout the river (or fish the upper river) the buttons carry an exact 🔭 read that also includes the day's local noise. With no look you pick blind. The closed-habitat bank has no read; it is still against the rules. In 70-day samples the best spot beats always taking the first by .04 to .11 of catch.

This is a simplified model of typical run timing, not a forecast.

## Play

Open `index.html`, or deploy the folder to any static https host (GitHub Pages works: `.nojekyll` is included) and install it from the browser. `offline/guidemaster-offline.html` (from `python3 tools/build-offline.py`) runs by double-clicking.

## Build & test

```bash
python3 tools/build.py            # src/camp + src/home + src/js → index.html
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

## Releasing

Type **`/release now`** in a Claude chat on this repo. It bumps `VERSION` and `GAME.version`, adds a `CHANGELOG.md`
entry and starts the shared [Krazow release kit](https://github.com/krazow/release-kit) pipeline: the build check
and tests, then a beta at https://krazow.github.io/Guide-Master/beta/ (with its own saves) and a pre-release with
the Android and Windows beta apps. **`/release promote`** puts the same version live and publishes the Latest
release: `GuideMaster-<version>.apk`, `GuideMaster-Setup-<version>.exe` and `GuideMaster-offline.html`.
`/release all`, `status` and `rollback` are there too. Pushing to `main` no longer changes the live game.

## Deploy

It's a static site, published by the release kit (above). Netlify, Cloudflare Pages and any static host work too. The site must be served over https to install and run offline.

`python3 tools/build-offline.py` also writes `offline/<id>-offline.html`: the whole game as one file that runs by double-clicking it, with no server needed. It's handy for sharing by email or USB.

## Tests

```bash
npm install
npx playwright install chromium
npm test                     # or: node tests/run.js save   (filter by name)
```

Every `tests/*.test.js` runs against `index.html`, and against the offline build if it exists. `smoke.test.js` is a bot that clicks at random for 1,500 steps across several games and fails on any page error. CI (`.github/workflows/ci.yml`, the release kit's QA) runs the build check and the tests on every pull request and push to `main`.
