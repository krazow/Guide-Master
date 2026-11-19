# Balance simulator

Bots play whole careers against the real game code (the built `index.html`, in headless Chromium) so grades, season scores and loss rates can be compared before and after a balance change. Nothing in the game is modified: `sim-lib.js` is injected into the page and stubs out rendering and animation.

## Run it

```
python3 tools/build.py                       # the simulator plays the built index.html
tools/sim/run.sh mytag                       # defaults: normal+hard, 5 years, 40 careers per cell, 2 pages
STYLES=food,skilled DIFFS=normal YEARS=2 N=10 tools/sim/run.sh quick
```

It needs Playwright (`npm install`, or set `NODE_PATH` to a folder that has it). Two pages run at once (`W`); a 5-year career takes a few seconds, so a 40-career cell takes a minute or two. Results are written to `tools/sim/out/` (git-ignored) as `TAG-<difficulty>-<years>.json`, one record per career, and summarised on screen.

Environment variables: `STYLES` (comma list), `DIFFS` (space list for run.sh), `YEARS`, `N` careers per cell, `W` parallel pages, `IDX` game file to play (for example a build from another branch, to compare), `SEED0` (shift the seeds to get fresh careers), `PATCH` (JS run in the page after setup, to try a tweak without editing the source), `OVER` (JSON of bot-style overrides), `MATRIX=1` (run each style three times: default home policy, `_c` careful, `_n` neglect).

## Bot styles

| style | plays like |
| --- | --- |
| `food` | by the book: stocks food, refuels, logs, first aid, sensible upgrades |
| `expert` | by the book, picks the best spot, returns calls daily, declines illegal requests, no camping |
| `phone` | like food, but returns calls every day |
| `skilled` | expert plus camping, scouting, the Fish tab, smart food and tight boat service |
| `passive` | buys no upgrades, no camping |
| `ignores` / `hungry` | never buys food |
| `opport` | rule-breaker: takes bending-the-rules options while it has fewer than two citations |
| `outfit` | like `food`, and grows the business from the third off-season (36-business.js): hires a reliable guide at a fair wage (a second at Rep 72 and $70k), buys a second jet sled once cash allows, gives raises before a guide sours, lets a guide with a citation go |
| `tycoon` | like `food`, and over-expands: every guide its reputation allows at the lowest wage, every boat it can afford, no raises |
| `processor` | like `food`, and, once three seasons are behind it, runs a fish-buying business (45-tender.js, src/tender): charters a tender, buys a used one (a bank loan for most of it), leases line space, buys a shore plant once cash allows in a year the market doesn't look weak; full crew, fresh fish, +2¢ over the going price; runs the tender itself on opener days with no party booked |
| `mogul` | like `food`, and over-invests in the fish business: borrows for two tenders and a plant (a floating processor when it can), overpays the fleet by 8¢, skips upkeep, fillets everything |
| others | `bytb`, `ruler`, `careless`, `nofuel`, `nolog` ... single-habit variants, see `STYLES` in `sim-lib.js` |

Weeks (1.14.0): from the second season the bots pick which two weeks of the summer they guide. The default policy, `mix`, keeps one July week and tries June kings, August silvers and September rainbows in turn (seasons 2–5: Jul 13 + Aug, Jun + Jul 20, Jul 20 + Sep, both July weeks). `OVER='{"weeks":"july"}'` plays the two July weeks every year as before; `junaug`, `augsep`, `junsep`, `julaug` are fixed pairs (see `WEEKPOL` in `sim-lib.js`).

Records of the fish-business styles carry `tenderTot` (career totals), `tenderHist` (each season's net), `tenderVal`, `tenderDebt`, `tenderPlant`, `tenderN` and `tenderSelf` (openers run in person).

Append `_c`, `_p` or `_n` to a style for the careful, pay-everything or full-neglect cabin policy. Camping is played by `campBot` (style flag `camp`).

## Reading and comparing runs

`node tools/sim/analyze.js tools/sim/out/a.json` prints, per style, difficulty and years: mean season score (careers that were not lost), grade mix (A..F, F is a lost career), score parts, losses and citations. Records also carry `staffTrips`, `staffNet`, `staffCites`, `bizStaff`, `bizBoats` and `bizPast` (why each guide left) for the outfit styles. Grade cuts per season are A 62,000, B 55,000, C 44,000, D 27,000 (`CUTS=a,b,c,d` overrides). `MATRIX=1 node tools/sim/analyze.js ...` shows careful / default / neglect side by side with the neglect cost in percent.

To compare a change: run with the same `N` and seeds on the old build (`IDX=/path/old/index.html`) and the new one, then read both. The seeds are the same in both runs, but the game consumes random numbers differently once anything changes, so treat differences under about two standard errors (the `+-` column) as noise, and use `N` of 40 or more.

## Illustration coverage

`node tools/sim/art-coverage.js [careers] [years]` plays careers with the shipped pictures on (the off-season through the real fall
sheet, storm prompts and camping screens) and prints, for every `art/manifest.json` entry, how often it was shown and where, then the
pictures and kilobytes of a first week. See `art/README.md` (Coverage).
