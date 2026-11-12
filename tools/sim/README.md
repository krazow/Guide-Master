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
| others | `bytb`, `ruler`, `careless`, `nofuel`, `nolog` ... single-habit variants, see `STYLES` in `sim-lib.js` |

Append `_c`, `_p` or `_n` to a style for the careful, pay-everything or full-neglect cabin policy. Camping is played by `campBot` (style flag `camp`).

## Reading and comparing runs

`node tools/sim/analyze.js tools/sim/out/a.json` prints, per style, difficulty and years: mean season score (careers that were not lost), grade mix (A..F, F is a lost career), score parts, losses and citations. Grade cuts per season are A 62,000, B 55,000, C 44,000, D 27,000 (`CUTS=a,b,c,d` overrides). `MATRIX=1 node tools/sim/analyze.js ...` shows careful / default / neglect side by side with the neglect cost in percent.

To compare a change: run with the same `N` and seeds on the old build (`IDX=/path/old/index.html`) and the new one, then read both. The seeds are the same in both runs, but the game consumes random numbers differently once anything changes, so treat differences under about two standard errors (the `+-` column) as noise, and use `N` of 40 or more.
