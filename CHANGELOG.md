# Changelog

Release notes for Guide Master. `/release now` adds a section here for every release, and the GitHub release notes
are taken from it. Earlier versions are described in the README and the in-game update notice.

## Unreleased

### Added
- **A day on the water (1.13.0).** A trip runs in 3 or 4 beats inside the one trip sheet: the launch (the spot), then calls through
  the day (halibut: the run out, slack tide, the turn, the run home; trout: the upper, middle and lower river). Each call shows the
  clock and legal hours, the tide, yesterday's sonar count, boat traffic, the wind and the bite so far, and offers stay, switch
  tactics (flip/bank, back-troll/drift, beads/streamers, anchor/jig), move (time and fuel), shore lunch or call it early.
  Fish land between beats from the same model as before, split across the day, with tide, traffic and afternoon wind per stretch.
- **Clients with goals.** Every booking has one or two traits (meat fishers, trophy hunters, kids, photographers, fly purists,
  first-timers, seasick-prone), shown on the booking request and at the launch; regulars keep theirs. Happiness and the tip follow
  how well the day fit them, and each party leaves a short written review (`S.reviews`: day, who, type, stars 1–5, text).
- **Judgment calls.** Ten new dilemmas without an obvious answer: the marine forecast before a halibut run, a hook in a hand,
  a bored kid, a boat dropping in on your drift, an argument aboard, a client fishing past exhaustion, a skunked friend,
  the shot, fog off the inlet, a rod overboard. Several rule dilemmas now cost more or less by party.
- A `guide` bot in the balance simulator that reads conditions and matches the party.

### Changed
- At most two random dilemmas a trip on every difficulty (was three on Combat Season); they fall between the beats.
- Save schema 5: bookings, regulars and waiting requests get traits; a trip in progress finishes the old way.

### Added (1.14.0)
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

### Changed (1.14.0)
- First-aid classes run Monday, Tuesday and Thursday of both played weeks, so a week of all-day trout floats can't leave you
  without a way to renew the card; the sim bots renew an expired card.
- The run chart in the Fish tab shows both weeks. Silver trips after July are "Silver trips". A request for a closed day is moved
  within its own week.
- Save schema 6 (`S.weeks`, `S.goals`, `S.goalLog`); older saves run the schema 5 and 6 migrations in order and play the two July weeks.

## 1.12.1 (2026-11-14)

### Added
- A Windows installer and the single-file offline game with every release.
- A beta at `/beta/` with its own saves, so new versions can be tried without touching your career.

### Changed
- Releases go through the shared Krazow release kit (`/release now`, then `/release promote`). Pushing to `main`
  no longer changes the live game. The service worker's `PREFIX` is now `CACHE_PREFIX` (and `tools/build.py` keeps it in step).
