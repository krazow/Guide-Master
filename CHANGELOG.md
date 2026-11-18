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

## 1.12.1 (2026-11-14)

### Added
- A Windows installer and the single-file offline game with every release.
- A beta at `/beta/` with its own saves, so new versions can be tried without touching your career.

### Changed
- Releases go through the shared Krazow release kit (`/release now`, then `/release promote`). Pushing to `main`
  no longer changes the live game. The service worker's `PREFIX` is now `CACHE_PREFIX` (and `tools/build.py` keeps it in step).
