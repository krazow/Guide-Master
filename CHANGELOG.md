# Changelog

Release notes for Guide Master. `/release now` adds a section here for every release, and the GitHub release notes
are taken from it. Earlier versions are described in the README and the in-game update notice.

## Unreleased

### Added
- **🏆 The trophy wall.** The 📜 Log tab has a switch, **Log | Trophy wall**: your biggest fish of each species (sockeye, silvers,
  rainbows, halibut and kings) with the party and the date, your **firsts** (first trip, first fish of each species, first king, first
  barn-door halibut over 100 lb, first limit-out, first five-star review), **standout clients** (five-star reviews and regulars who keep
  coming back) and **postcards**: when a new season starts, one or two past clients who had a good day with you write in (morning report).
- **★ Your rating.** The top bar shows a star rating where Rep used to be: the average of your last 20 reviews, with your reputation
  filling in while there are few (a new guide starts at about ★4.0). The bar under it is still reputation; at 0, nobody books you.
  - ★4.5 (10+ reviews): **top-rated guide**: parties that pay well find you and tip about 15% more on a good day.
  - ★4.7 (12+ reviews): **a magazine feature**, once a career: up to three extra trips over the coming days (or the first week of next
    season if you're full), on the trip that week's water offers.
  - A season that averages ★4.7: **a lodge partnership**. A Soldotna lodge sends two parties of its guests every season, in your
    chosen weeks, for a 10% referral fee, until your rating falls under ★4.3.
  - Under ★2.5, fewer people book, in your weeks and over the rest of the summer, until the rating comes back.
- **🎉 Catch moments.** Trophies, a king at the boat (one moment a trip, even on a June king trip that lands several), barn doors,
  limit-outs and first fish of a species get a short moment on the trip sheet (under 1.5 s, still with Reduce motion), and a **catch
  card** at the dock with **💾 Save the card as an image**. **🔔 Catch chime** in ⚙️ Settings, off until you turn it on.
- **🧓 A mentor's first trip.** On a new career's first trip, Walt Brandvold, an old Soldotna guide, rides along and says one thing at
  each call: reading the conditions, choosing a move, what the party came for, a rule dilemma. **I've got this** sends him ashore;
  **Help → Ride with the mentor again** (Help is now also in ⚙️ Settings) brings him back for one trip.

### Changed
- Regulars, the dock and the Help sheet talk about "next season" rather than "next July"; the Help entry for season goals has its own icon.
- Save schema 8 (`S.mem`). Saves from 1.12–1.14 (schemas 4–6) run the schema 5, 6 and 8 migrations in order; schema 7 is left
  for the business layer. Records start from the moment you load, past reviews already count toward the rating, and a career already
  under way doesn't get the mentor automatically (Help brings him).

### Added (1.16.0)
- **🧑‍🤝‍🧑 Your outfit.** From your third off-season you can grow the business, if you want to: hire up to three guides (Rep 55, 65
  and 75 for the first, second and third) and buy up to two more boats (a used jet sled for a second lower-river party, or a second
  drift boat for the upper Kenai). The off-season summary has **Your outfit: guides & boats**; the 📅 Bookings tab gets a
  **📅 Schedule | 🧑‍🤝‍🧑 Outfit** switch, with traits, big-day targets and the Schedule's goals still in place.
- **Guides are people.** Each applicant has a name, a skill, a reliability, a wage per trip and a line about who they are. They get
  better every season and expect raises; underpaid or overworked, they grumble and then quit (in the winter, or now and then mid-season).
- **Licensed like you.** Every guide needs an ADF&G guide license, the Kenai River Guide Academy and a State Parks permit, drug testing,
  a first-aid/CPR card and a Coast Guard six-pack license: $745 onboarding (or $2,145 without a six-pack license), renewals and
  insurance every winter.
- **Two parties at once.** Guides take parties on days you're booked, get calls of their own, and you can hand them one of your own
  trips (and take it back). A guide needs a free boat. Staff trips run off-screen and land in the morning report: fish, how the
  clients felt, anything that went wrong (a late start, a dinged jet unit, a ticket) and what you cleared after the guide's wage,
  fuel, fees and wear. A guide's citation goes on your record.
- **With the weeks, parties and reviews.** Guides fish the weeks you picked: June kings (on a jet sled), July sockeye and trout,
  August silvers, September rainbows and silvers; never Homer halibut. Their parties have traits that the guide's skill and
  reliability meet or miss, and each one leaves a review naming the guide ("Ask for Rosa."). **Staff reviews don't count toward
  your ★ rating** (or its milestones, goals and the trophy wall): those are about the trips you guide yourself. Each guide's stars
  show on the Outfit page and in the morning report. Magazine readers, lodge guests and big-day parties booked you, so they can't
  be handed to a guide.
- An Outfit row on the end screen; `outfit` (careful hiring) and `tycoon` (over-expanding) bots in the simulator.

### Changed (1.16.0)
- The five-star-review event names your guide when only a staff trip earned it.
- Save schema 9 (`S.biz`). The business migration (built as schema 7 on 1.12.1 and never released) is now `to:9`, so saves at
  schemas 4, 5, 6 and 8 run 5, 6, 8 and 9 in order; schema 7 stays unused. A save already past its second season can start an
  outfit straight away.

## 1.14.0 (2026-11-18)

This release includes everything planned for 1.13.0, which was never released on its own.

### Added
- **A day on the water.** A trip runs in 3 or 4 beats inside the one trip sheet: the launch (the spot), then calls through
  the day (halibut: the run out, slack tide, the turn, the run home; trout: the upper, middle and lower river). Each call shows the
  clock and legal hours, the tide, yesterday's sonar count, boat traffic, the wind and the bite so far, and offers stay, switch
  tactics (flip/bank, back-troll/drift, beads/streamers, anchor/jig), move (time and fuel), shore lunch or call it early.
  Fish land between beats from the same model as before, split across the day, with tide, traffic and afternoon wind per stretch.
- **Clients with goals.** Every booking has one or two traits (meat fishers, trophy hunters, kids, photographers, fly purists,
  first-timers, seasick-prone), shown on the booking request and at the launch; regulars keep theirs. Happiness and the tip follow
  how well the day fit them, and each party leaves a short written review.
- **Judgment calls.** Ten new dilemmas without an obvious answer: the marine forecast before a halibut run, a hook in a hand,
  a bored kid, a boat dropping in on your drift, an argument aboard, a client fishing past exhaustion, a skunked friend,
  the shot, fog off the inlet, a rod overboard. Several rule dilemmas now cost more or less by party.
- A `guide` bot in the balance simulator that reads conditions and matches the party.
- **Pick your weeks.** From the second summer on, the off-season summary has **📆 Your weeks**: still two played weeks a year
  (careers keep their length), chosen from 👑 June early kings (the Monday nearest June 15), 🐟 July peak week 1 or 2 (season 1
  is always these two), 🎣 August silvers (nearest August 17) or 🍂 September fall rainbows (nearest September 8). The pick carries
  over to the next summer until changed.
- Everything follows the played week's real date: calendar and top bar, bookings and requests, the Sunday/Monday closure and the
  6 PM rule (May 1 to July 31), the no-bait rule (June 20 to August 15), the closed halibut days (through late August), dipnetting
  (July 10 to 31), the run chart, daylight and weather. Between weeks that aren't back to back the morning report says how many
  weeks went by.
- **King trip** (June): early-run kings on the lower river when the year's rules allow them (catch-and-release or one a day), run in
  three stretches like the other trips (back-troll plugs or back-bounce spin-n-glos; Beaver Creek slots, the holes above the bridge,
  the Pillars), with party goals and a review. If kings are closed, June is upper-river rainbows (open from June 11) and Homer halibut.
- **The rest of the summer still counts.** Unplayed weeks are settled in the off-season, scaled so a quieter played week books more
  of the busy summer under your name and the year comes out about even.
- **Season goals.** Three a season, picked to suit the weeks, in the 📅 Bookings tab: limit-outs, five-star days, a clean record, a
  logbook never overdue, Homer charters, a king released the right way, a family with kids who rate you five stars, a new regular,
  a big-day target, upper-river rainbows. Reached goals show in the morning report; rewards (cash, reputation or word of mouth)
  come on the season's last night, and the off-season summary shows how you did.
- **Big days.** Some booking requests come with a target (*a 30-pound halibut for Dad's 70th*, *her first king*, *a limit of
  silvers for the smoker back home*) and a bonus if it's met, through the usual request flow.

### Changed
- At most two random dilemmas a trip on every difficulty (was three on Combat Season); they fall between the beats.
- First-aid classes run Monday, Tuesday and Thursday of both played weeks, so a week of all-day trout floats can't leave you
  without a way to renew the card; the sim bots renew an expired card.
- The run chart in the Fish tab shows both weeks. Silver trips after July are "Silver trips". A request for a closed day is moved
  within its own week.
- Games in progress are brought up to date automatically: they keep playing the two July weeks until you pick others, and a trip
  that was under way finishes the old way.

## 1.12.1 (2026-11-14)

### Added
- A Windows installer and the single-file offline game with every release.
- A beta at `/beta/` with its own saves, so new versions can be tried without touching your career.

### Changed
- Releases go through the shared Krazow release kit (`/release now`, then `/release promote`). Pushing to `main`
  no longer changes the live game. The service worker's `PREFIX` is now `CACHE_PREFIX` (and `tools/build.py` keeps it in step).
