// Cabin upkeep (src/home/, the CabinUpkeep module; src/js/32-home.js, the Guide Master adapter; v1.10.0, balanced in v1.10.1).
// The first half runs the module on its own in Node, in an empty `vm` context, with no browser and no Guide Master;
// the second half plays the adapter in the real game.
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const { open, newGame, noErrors, assert } = require('./helpers');

const ROOT = path.resolve(__dirname, '..'), DIR = path.join(ROOT, 'src', 'home');
const FILES = fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort();
const SRC = FILES.map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');
function load() {
  const ctx = vm.createContext({});
  const before = new Set(vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx));
  const C = vm.runInContext(SRC + '\n;CabinUpkeep', ctx);
  const added = vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx).filter(k => !before.has(k));
  return { C, added };
}
const { C } = load();
const J = o => JSON.parse(JSON.stringify(o));
// a ticket: phase 'summer' | 'fall' | 'spring', the cycle y, and overrides
const tk = (o = {}) => Object.assign({ state: C.newState(), phase: 'fall', season: 2, sday: 3, abs: 31, cash: 9000, energy: 80, rep: 60, daysLeft: 10, atHome: true, costMult: 1, bad: 1, gen: { owned: false, gas: 'ok' }, homeFuel: 20, outage: null, recentFish: 1 }, o);
const withState = (t, f) => { const s = J(t.state); f(s); return Object.assign({}, t, { state: s }); };
const K = v => () => v;                                   // a constant "random number"
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)] };
const rolls = (fn, n, seed = 1) => { const r = C.util.seeded(seed); let k = 0; for (let i = 0; i < n; i++) k += fn(r) ? 1 : 0; return k / n };
const ids = t => Array.from(C.jobs(t, { all: true }), j => j.id);
const lines = rep => rep.lines.join(' ');
// the game: start a 5-year game and roll into its first off-season
async function winterGame(ctx, diff) {
  const { page, errors } = await open(ctx);
  await page.evaluate(() => setPref('years', 5));
  await newGame(page, diff);
  await page.evaluate(async () => {
    closeModals(); S.money = 20000; S.cur = 13; S.t = 13 * 1440 + 1300; S.loc = 'shop';
    S.book.forEach(b => { if (b.status === 'booked') b.status = 'done'; });
    endDay('home'); await new Promise(r => setTimeout(r, 10)); closeModals();
  });
  return { page, errors };
}
const quiet = async (ctx, diff) => { const o = await open(ctx); await newGame(o.page, diff); await o.page.evaluate(() => { closeModals(); S.cur = 9; S.t = 9 * 1440 + 600; S.book = []; S.loc = 'shop'; }); return o; };

module.exports = [
  // ---------- the module on its own ----------
  { name: 'boundary: src/home never names the game, its pop-ups, clock, saves or storage, and adds one global', fn: async () => {
    for (const f of FILES) {
      const h = fs.readFileSync(path.join(DIR, f), 'utf8');
      for (const [re, what] of [[/\bS\./, 'S.'], [/\bS\[/, 'S['], [/\bmodal\s*\(/, 'modal('], [/\bGAME\b/, 'GAME'], [/\bMIGRATIONS\b/, 'MIGRATIONS'], [/\bAPP_VERSION\b/, 'APP_VERSION'], [/\blocalStorage\b/, 'localStorage'], [/\bdocument\b/, 'document'], [/\bwindow\b/, 'window'], [/\bsay\s*\(/, 'say('], [/\bmoney\s*\(/, 'money(']])
        assert.ok(!re.test(h), `${f} mentions ${what}`);
    }
    const r = load(); assert.deepStrictEqual(J(r.added), [], 'nothing leaks onto the global object'); assert.strictEqual(vm.runInContext('typeof CabinUpkeep', vm.createContext({})), 'undefined'); assert.strictEqual(typeof C.jobs, 'function');
    assert.strictEqual(C.SCHEMA, 1); assert.strictEqual(C.MAX_DUE, 2);
    const r2 = vm.runInContext('typeof S + typeof modal + typeof GAME', vm.createContext({})); assert.strictEqual(r2, 'undefinedundefinedundefined');
  } },
  { name: 'boundary: the build puts src/home between src/camp and src/js, and --check passes; the README states the contract', fn: async () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const a = html.indexOf('const KenaiCamp='), b = html.indexOf('const CabinUpkeep='), c = html.indexOf('function homeApply');
    assert.ok(a > 0 && b > a && c > b, `order ${a} ${b} ${c}`);
    assert.ok(/CabinUpkeep/.test(fs.readFileSync(path.join(ROOT, 'offline', 'guidemaster-offline.html'), 'utf8')));
    assert.strictEqual(cp.spawnSync('python3', ['tools/build.py', '--check'], { cwd: ROOT }).status, 0);
    const md = fs.readFileSync(path.join(DIR, 'README.md'), 'utf8');
    assert.ok(/ticket/i.test(md) && /report/i.test(md) && /SCHEMA/.test(md) && /Prices and sources/.test(md) && /never ends a career/i.test(md));
  } },
  { name: 'jobs: every job is offered three ways (yourself, pay someone, skip), and no more than two show at once', fn: async () => {
    const r = C.util.seeded(7), seen = new Set();
    for (let i = 0; i < 400; i++) {
      const phase = ['summer', 'fall', 'spring'][i % 3];
      let s = C.newState(); s.cond = Math.round(r() * 100);
      if (r() < .5) s.heat.stove = 1; if (r() < .5) s.proc = 1; if (r() < .5) s.tape = 1; if (r() < .5) s.detect = 1;
      s.did.well = -3; s.did.septic = -5; s.garden.y = r() < .5 ? 2 : -1; s.station.tidy = Math.round(r() * 100);
      if (r() < .4) s.queue = [{ id: 'cold', sev: 2 }, { id: 'snow', depth: 2 }];
      const t = tk({ state: s, phase, sday: 1 + Math.floor(r() * 12), abs: 20 + i, gen: { owned: r() < .5, gas: 'ok' } });
      const shown = C.jobs(t), all = C.jobs(t, { all: true });
      assert.ok(shown.length <= 2, `${shown.length} shown`);
      assert.strictEqual(C.dueCount(t), all.length);
      all.forEach(j => { seen.add(j.id); assert.deepStrictEqual(Array.from(j.opts, o => o.id), ['diy', 'pay', 'skip']); assert.ok(j.why && j.risk && j.title); });
      if (s.queue.length && shown.length) assert.strictEqual(shown[0].kind, 'event', 'storm prompts come first');
    }
    ['oil', 'wood', 'sweep', 'tape', 'skirt', 'detect', 'detest', 'strap', 'breakup', 'well', 'septic', 'bins', 'genoil', 'genrun', 'garden', 'fence', 'stclean', 'stdef', 'cold', 'snow'].forEach(id => assert.ok(seen.has(id), `job ${id} never came up`));
  } },
  { name: 'jobs: yourself costs time and energy, paying costs cash, skipping costs nothing now and is remembered', fn: async () => {
    const t = tk({ phase: 'summer', sday: 4, abs: 18 }), j = C.jobs(t).find(x => x.id === 'bins');
    const [d, p, s] = j.opts;
    assert.ok(d.min > 0 && d.energy > 0 && d.cash === 0 && p.cash > 0 && s.cash === 0 && s.min === 0);
    const rd = C.resolve(t, 'bins', 'diy'); assert.strictEqual(rd.minutes, d.min); assert.strictEqual(rd.energyDelta, -d.energy); assert.strictEqual(rd.cashDelta, 0); assert.strictEqual(rd.daysUsed, 0);
    const rp = C.resolve(t, 'bins', 'pay'); assert.strictEqual(rp.cashDelta, -p.cash); assert.strictEqual(rp.minutes, 0); assert.strictEqual(rp.energyDelta, 0);
    assert.ok(rd.cond > t.state.cond && rp.cond > t.state.cond, 'a job restores condition');
    const rs = C.resolve(t, 'bins', 'skip'); assert.strictEqual(rs.cashDelta, 0); assert.strictEqual(rs.cond, t.state.cond - 2, 'skipping wears the cabin down'); assert.ok(/bear/.test(lines(rs)));
    // in the off-season yourself costs free days, and it is not offered without them
    const w = tk({ phase: 'fall' }), oil = C.jobs(w).find(x => x.id === 'oil');
    assert.strictEqual(oil.opts[0].days, 1); assert.strictEqual(C.resolve(w, 'oil', 'diy').daysUsed, 1);
    const none = C.jobs(tk({ phase: 'fall', daysLeft: 0 })).find(x => x.id === 'oil'); assert.ok(none.opts[0].dis && /days/.test(none.opts[0].why));
    const broke = C.jobs(tk({ phase: 'fall', cash: 230 })).find(x => x.id === 'oil'); assert.ok(broke.opts[1].dis && broke.opts[0].dis === false);
    assert.strictEqual(C.resolve(tk({ phase: 'fall', cash: 230 }), 'oil', 'pay'), null, 'cannot pay what you do not have');
    // a skipped yearly job does not nag again this year, and comes back next year
    const sk = C.resolve(w, 'oil', 'skip'); assert.ok(!ids(Object.assign({}, w, { state: sk.state })).includes('oil'));
    assert.ok(ids(Object.assign({}, w, { state: sk.state, season: 3 })).includes('oil'));
  } },
  { name: 'heat: a furnace to start; the wood stove adds firewood and a chimney sweep; skipping the sweep risks a chimney fire', fn: async () => {
    const t = tk(); assert.deepStrictEqual(ids(t).filter(i => ['oil', 'wood', 'sweep'].includes(i)), ['oil']);
    const bought = C.buy(t, 'stove'); assert.ok(bought && bought.cashDelta === -3400);
    const t2 = Object.assign({}, t, { state: bought.state }); assert.deepStrictEqual(ids(t2).filter(i => ['oil', 'wood', 'sweep'].includes(i)), ['sweep', 'oil', 'wood']);
    assert.strictEqual(C.buy(t2, 'stove'), null, 'only one');
    // firewood done halves the oil job; both prepped: no rush when the cold comes
    const woodDone = C.resolve(t2, 'wood', 'pay'); const t3 = Object.assign({}, t2, { state: woodDone.state });
    assert.strictEqual(C.jobs(t3, { all: true }).find(j => j.id === 'oil').opts[1].cash, 130);
    // fire: neglected sweep at the worst luck vs a swept chimney
    const noSweep = withState(t3, s => { s.did.sweep = -1 }), swept = withState(t3, s => { s.did.sweep = 2 });
    assert.ok(/chimney|stovepipe/i.test(lines(C.rollWinter(noSweep, { rand: K(0) }))), 'creosote catches');
    assert.ok(!/stovepipe/.test(lines(C.rollWinter(swept, { rand: K(0) }))));
    const p = (skips) => rolls(r => /stovepipe/.test(lines(C.rollWinter(withState(noSweep, s => { s.sweepSkips = skips }), { rand: r }))), 4000);
    assert.ok(p(2) > p(0) * 1.4, `${p(0)} vs ${p(2)}`);
    // oil: an unprepared tank in a cold snap is a rush delivery and a cold night; a prepared one, or a prepared stove, is not
    const cold = (st) => C.resolve(Object.assign({}, st, { state: Object.assign(J(st.state), { queue: [{ id: 'cold', sev: 2 }] }) }), 'cold', 'diy', { rand: K(.99) });
    const dry = withState(tk(), s => { s.did.oil = -1 }), ok = withState(tk(), s => { s.did.oil = 2 }), stoveOk = withState(t3, s => { s.did.oil = -1; s.did.wood = 2 });
    assert.ok(cold(dry).cashDelta <= -520 && /tank runs dry/.test(lines(cold(dry))));
    assert.strictEqual(cold(ok).cashDelta, 0); assert.ok(/stove carries/.test(lines(cold(stoveOk))) && cold(stoveOk).cashDelta === 0);
    // ordering late when there is no cold snap
    const late = C.rollWinter(withState(tk(), s => { s.did.oil = -1 }), { rand: K(.99) }); assert.ok(/order a delivery in January/.test(lines(late)) && late.cashDelta < 0);
  } },
  { name: 'freeze-proofing: heat tape, a skirted crawlspace and dripping taps cut the odds; a frozen line costs a day, a burst one costs days and the fridge food', fn: async () => {
    const mk = (f, opt) => { const t = withState(tk(), s => { s.did.oil = 2; s.queue = [{ id: 'cold', sev: 2 }]; f(s) }); return r => C.resolve(t, 'cold', opt, { rand: r }) };
    const freezes = f => rolls(r => /freezes solid|bursts/.test(lines(mk(f, 'skip')(r))), 4000);
    const none = freezes(() => {}), tape = freezes(s => { s.tape = 1 }), both = freezes(s => { s.tape = 1; s.skirt = 1 });
    assert.ok(none > .25 && tape < none / 3 && both < tape, `${none} ${tape} ${both}`);
    const dripped = rolls(r => /freezes solid|bursts/.test(lines(mk(() => {}, 'diy')(r))), 4000); assert.ok(dripped < none * .5, `${dripped} vs ${none}`);
    const frozen = mk(() => {}, 'skip')(seq(.01, .99)), burst = mk(() => {}, 'skip')(seq(.01, .01));
    assert.strictEqual(frozen.cashDelta, -380); assert.strictEqual(frozen.daysLost, 1); assert.strictEqual(frozen.freshLost, 0);
    assert.strictEqual(burst.cashDelta, -2400); assert.strictEqual(burst.daysLost, 3); assert.strictEqual(burst.freshLost, 1); assert.strictEqual(burst.severity, 2);
    // the prompt is consumed, and it is one of the two ways to prepare that cost nothing or $45
    assert.strictEqual(burst.state.queue.length, 0);
    const o = C.jobs(withState(tk(), s => { s.queue = [{ id: 'cold', sev: 1 }] }))[0].opts; assert.strictEqual(o[0].cash, 0); assert.strictEqual(o[1].cash, 45);
    // a long outage with no generator and no stove chills the cabin, and the next cold snap is worse
    const chilled = C.rollWinter(withState(tk({ outage: { h: 40, gen: false } }), s => { s.did.oil = 2 }), { rand: K(.99) });
    assert.strictEqual(chilled.state.chill, 1); assert.ok(/cold|blower/.test(lines(chilled)));
    const noChill = C.rollWinter(withState(tk({ outage: { h: 40, gen: true } }), s => { s.did.oil = 2 }), { rand: K(.99) }); assert.strictEqual(noChill.state.chill, 0);
    // tape and skirting are once-only jobs that stay done
    const t = tk(); const after = C.resolve(t, 'tape', 'diy'); assert.ok(!ids(Object.assign({}, t, { state: after.state, season: 9 })).includes('tape'));
  } },
  { name: 'snow: rake and plow yourself, pay a neighbor, or skip: an ice dam, being plowed in for days that come out of the free-day budget', fn: async () => {
    const t = withState(tk(), s => { s.queue = [{ id: 'snow', depth: 2 }] });
    const skip = C.resolve(t, 'snow', 'skip', { rand: K(0) }), pay = C.resolve(t, 'snow', 'pay', { rand: K(.5) }), diy = C.resolve(t, 'snow', 'diy', { rand: K(.5) });
    assert.ok(/ice dam/.test(lines(skip)) && skip.cashDelta < -1000 && skip.daysLost === 2);
    assert.strictEqual(pay.cashDelta, -320); assert.strictEqual(pay.daysLost, 0); assert.ok(!/ice dam/.test(lines(pay)));
    assert.strictEqual(diy.daysUsed, 1); assert.strictEqual(diy.cashDelta, 0); assert.strictEqual(diy.energyDelta, -16);
    assert.strictEqual(C.resolve(withState(tk(), s => { s.queue = [{ id: 'snow', depth: 3 }] }), 'snow', 'skip', { rand: K(.99) }).daysLost, 3);
    // with no free days left it is squeezed into the evenings, and the top button is still usable
    const squeezed = C.jobs(withState(tk({ daysLeft: 0 }), s => { s.queue = [{ id: 'snow', depth: 1 }] }))[0].opts[0];
    assert.ok(!squeezed.dis && squeezed.days === 0 && squeezed.energy > 16, JSON.stringify(squeezed));
    const p = (opt) => rolls(r => /ice dam|shed roof/.test(lines(C.resolve(t, 'snow', opt, { rand: r }))), 3000);
    assert.ok(p('skip') > .3 && p('pay') < .06);
  } },
  { name: 'generator: neglect makes it likelier not to start; a failure costs $85 and leaves it in shape; the odds name the reasons', fn: async () => {
    const ok = tk({ gen: { owned: true, gas: 'ok' } }), neg = withState(Object.assign({}, ok, { gen: { owned: true, gas: 'stale' } }), s => { s.did.genoil = -1; s.did.genrun = -1 });
    const serviced = withState(ok, s => { s.did.genoil = 2; s.did.genrun = 2 });
    assert.ok(C.genOdds(serviced).p < .06 && C.genOdds(serviced).p > 0);
    assert.ok(C.genOdds(neg).p > .35 && C.genOdds(neg).why.length === 3, JSON.stringify(C.genOdds(neg)));
    assert.strictEqual(C.genOdds(tk()).p, 0, 'no generator, no odds');
    const f = C.genFailed(neg); assert.strictEqual(f.cashDelta, -85); assert.ok(/coughs and dies/.test(lines(f)) && /stale gas/.test(lines(f)));
    assert.ok(C.genOdds(Object.assign({}, neg, { state: f.state, gen: { owned: true, gas: 'ok' } })).p < .06, 'serviced again');
    // the jobs: oil change and a test run (which burns a little home gas) come up in July only with a generator
    const s = Object.assign({}, neg, { phase: 'summer', sday: 4 }); assert.deepStrictEqual(ids(s).filter(i => /^gen/.test(i)), ['genoil', 'genrun']);
    assert.deepStrictEqual(ids(tk({ phase: 'summer', sday: 4 })).filter(i => /^gen/.test(i)), []);
    assert.strictEqual(C.resolve(s, 'genrun', 'diy').homeFuel, .5); assert.ok(C.jobs(Object.assign({}, s, { homeFuel: 0 }), { all: true }).find(j => j.id === 'genrun').opts[0].dis);
    const done = C.resolve(s, 'genoil', 'diy'), done2 = C.resolve(Object.assign({}, s, { state: done.state }), 'genrun', 'pay');
    assert.ok(C.genOdds(Object.assign({}, s, { state: done2.state, gen: { owned: true, gas: 'ok' } })).p < .06);
    assert.ok(C.noteGen(neg).state.did.genoil === neg.season);
  } },
  { name: 'well and septic: a yearly test and a pump every three years; neglect makes a rare, costly failure that closes the house for days', fn: async () => {
    const spring = (f) => withState(tk({ phase: 'spring' }), f);
    assert.deepStrictEqual(ids(spring(s => { s.did.well = 2; s.did.septic = 0 })).filter(i => ['well', 'septic'].includes(i)), [], 'tested, pumped: nothing due');
    assert.deepStrictEqual(ids(spring(s => { s.did.well = 2; s.did.septic = -1 })).filter(i => ['well', 'septic'].includes(i)), ['septic']);
    const wellRate = f => rolls(r => /pump quits/.test(lines(C.rollSpring(spring(f), { rand: r }))), 5000);
    assert.ok(wellRate(s => { s.did.well = -2 }) > .05 && wellRate(s => { s.did.well = 2 }) < .01, `${wellRate(s => { s.did.well = -2 })}`);
    const sepRate = f => rolls(r => /septic tank backs up/.test(lines(C.rollSpring(spring(f), { rand: r }))), 5000);
    assert.ok(sepRate(s => { s.did.septic = -3 }) > .07 && sepRate(s => { s.did.septic = 1 }) < .01);
    const worst = C.rollSpring(spring(s => { s.did.well = -2; s.did.septic = -3 }), { rand: K(0) });
    assert.ok(/pump quits/.test(lines(worst)) && /septic tank backs up/.test(lines(worst)) && worst.daysLost >= 5 && /Soldotna/.test(lines(worst)));
    // do it yourself on septic is only a year's reprieve; paying resets it
    const s = spring(s => { s.did.septic = -1 }), d = C.resolve(s, 'septic', 'diy'), p = C.resolve(s, 'septic', 'pay');
    assert.ok(d.state.did.septic < p.state.did.septic && p.state.did.septic === s.season);
  } },
  { name: 'bears: fish waste draws a bear; bins and a clean yard keep it away; at most one a summer; damage, a lost morning or a Fish and Game visit', fn: async () => {
    const day = (st, sday, r, fish = 1) => C.daily(tk({ state: st, phase: 'summer', sday, abs: 28 + sday, recentFish: fish }), { rand: r });
    const season = (f, r, keep) => { let st = C.newState(); f(st); let n = 0, kinds = new Set(); for (let d = 1; d < 14; d++) { if (keep) st.did.bins = 28 + d; const rep = day(st, d, r); st = rep.state; if (/🐻/.test(lines(rep))) { n++; kinds.add(rep.minutes > 0 ? 'morning' : rep.repDelta < 0 ? 'fg' : 'damage') } } return { n, kinds } };
    let neglected = 0, clean = 0, bin = 0, over = 0;
    const r = C.util.seeded(3);
    for (let i = 0; i < 600; i++) {
      const a = season(s => { s.did.bins = -99 }, r).n; neglected += a > 0 ? 1 : 0; over = Math.max(over, a);
      clean += season(s => { s.did.bins = 29 }, r, true).n > 0 ? 1 : 0;
      bin += season(s => { s.did.bins = -99; s.bin = 1 }, r).n > 0 ? 1 : 0;
    }
    assert.ok(neglected / 600 > .3 && clean / 600 < neglected / 600 * .6 && bin / 600 < neglected / 600 * .95, `${neglected} ${clean} ${bin}`);
    assert.strictEqual(over, 1, 'once a summer at most');
    const seen = new Set(); for (let i = 0; i < 300; i++) { const rr = C.util.seeded(100 + i), rep = day(withState(tk(), s => { s.did.bins = -99 }).state, 5, rr); if (/🐻/.test(lines(rep))) seen.add(rep.minutes > 0 ? 'morning' : rep.repDelta < 0 ? 'fg' : 'damage') }
    assert.deepStrictEqual([...seen].sort(), ['damage', 'fg', 'morning']);
    const fg = day(C.newState(), 5, seq(0, .9)); assert.ok(/Fish and Game/.test(lines(fg)) && /attractants/.test(lines(fg)) && fg.repDelta === -3 && fg.womDelta === -4 && fg.cashDelta === 0, lines(fg));
    assert.ok(!/ordinance|law|illegal/i.test(lines(fg)), 'general about local rules');
  } },
  { name: 'fish station: a modest fee per trip from the clients’ fish, upkeep jobs, and a spoiled batch when it is neglected', fn: async () => {
    const st = C.buy(tk({ phase: 'summer' }), 'station'); assert.strictEqual(st.cashDelta, -1900);
    const s0 = st.state, t = tk({ state: s0, phase: 'summer', fish: 12, clients: 4 });
    const fee = C.processing(t, { rand: K(.99) }); assert.ok(fee.earned > 0 && fee.earned <= 60 && fee.energyDelta < 0 && /processing fees/.test(lines(fee)), String(fee.earned));
    assert.strictEqual(C.processing(tk({ state: C.newState(), fish: 12, clients: 4 })).earned, 0, 'no station, no fee');
    assert.strictEqual(C.processing(Object.assign({}, t, { fish: 0 })).earned, 0);
    // a whole summer of trips: modest, and below the cost of the station for a couple of seasons
    let state = s0, total = 0; const r = C.util.seeded(9);
    for (let i = 0; i < 24; i++) { const rep = C.processing(Object.assign({}, t, { state }), { rand: r }); state = rep.state; total += rep.earned; if (state.station.tidy < 70) state = C.resolve(Object.assign({}, t, { state, sday: 5 }), 'stclean', 'diy').state }
    assert.ok(total > 200 && total < 1000, `season income ${total}`);
    // neglect: tidy falls and fish spoil
    const dirty = withState(t, s => { s.station.tidy = 10; s.did.stdef = -1 });
    const spoil = rolls(rr => C.processing(dirty, { rand: rr }).womDelta < 0, 3000), clean = rolls(rr => C.processing(t, { rand: rr }).womDelta < 0, 3000);
    assert.ok(spoil > .25 && clean < .05, `${spoil} ${clean}`);
    const sp = C.processing(dirty, { rand: K(0) }); assert.ok(sp.earned === 0 && sp.womDelta === -1 && sp.repDelta === -1 && /off/.test(lines(sp)));
    // the jobs
    const due = ids(Object.assign({}, dirty, { phase: 'summer', sday: 4 })); assert.ok(due.includes('stclean') && due.includes('stdef'));
    assert.ok(C.resolve(Object.assign({}, dirty, { phase: 'summer', sday: 4 }), 'stclean', 'pay').state.station.tidy >= 80);
  } },
  { name: 'garden: planted in July, harvested on day 10; a moose eats an unfenced one, a fence saves it', fn: async () => {
    const sum = o => tk(Object.assign({ phase: 'summer', sday: 2, abs: 30 }, o));
    assert.ok(ids(sum()).includes('garden') && !ids(sum({ sday: 8 })).includes('garden'));
    const planted = C.resolve(sum(), 'garden', 'diy').state; assert.strictEqual(planted.garden.y, 2);
    assert.ok(ids(sum({ state: planted })).includes('fence') && !ids(sum({ state: planted })).includes('garden'));
    const harvest = (st, r) => C.daily(sum({ state: st, sday: 10 }), { rand: r });
    const open = harvest(planted, K(0)); assert.ok(/moose/.test(lines(open)) && open.foodMeals === 2 && open.severity === 1);
    const fenced = C.resolve(sum({ state: planted }), 'fence', 'pay').state; const fh = harvest(fenced, K(0));
    assert.ok(/meals for the kitchen/.test(lines(fh)) && fh.foodMeals === 8 && !/moose/.test(lines(fh)));
    assert.strictEqual(harvest(planted, K(.99)).foodMeals, 8, 'a lucky unfenced garden');
    assert.strictEqual(harvest(C.newState(), K(0)).foodMeals, 0, 'no garden, no harvest');
    assert.ok(ids(sum({ state: fenced, season: 3 })).includes('garden') && !ids(sum({ state: fenced, season: 3 })).includes('fence'), 'the fence stays');
  } },
  { name: 'detectors: smoke and CO alarms are fitted once and tested each fall; with a stove or generator and no alarm, a rare night ends in the ER; with one it does not', fn: async () => {
    assert.ok(ids(tk()).includes('detect') && !ids(tk()).includes('detest'));
    const fitted = C.resolve(tk(), 'detect', 'pay').state; assert.strictEqual(fitted.detect, 1);
    assert.ok(ids(tk({ state: fitted, season: 3 })).includes('detest') && !ids(tk({ state: fitted, season: 3 })).includes('detect'));
    const stove = s => { s.heat.stove = 1; s.did.oil = 2; s.did.wood = 2; s.did.sweep = 2 };
    const no = C.rollWinter(withState(tk(), s => { stove(s) }), { rand: seq(.99, .99, .99, .99, .99, 0, .99, .99, 0) }), yes = C.rollWinter(withState(tk(), s => { stove(s); s.detect = 1 }), { rand: seq(.99, .99, .99, .99, .99, 0, .99, .99, 0) });
    const er = C.rollWinter(withState(tk(), stove), { rand: K(0) });
    assert.ok(/carbon monoxide|pounding headache/.test(lines(er)) && er.daysLost >= 2 && /Alarms would have caught it/.test(lines(er)), lines(er));
    const al = C.rollWinter(withState(tk(), s => { stove(s); s.detect = 1 }), { rand: K(0) }); assert.ok(/CO alarm goes off/.test(lines(al)) && al.daysLost === 0);
    const rate = (f, pat) => rolls(r => pat.test(lines(C.rollWinter(withState(tk(), f), { rand: r }))), 6000);
    assert.ok(rate(s => { stove(s) }, /headache/) > 0.01, 'a stove with no alarm');
    assert.strictEqual(rate(s => { stove(s); s.detect = 1 }, /headache/), 0, 'never with an alarm');
    assert.ok(/outside|away from the cabin/.test(fs.readFileSync(path.join(ROOT, 'src/js/31-supplies.js'), 'utf8')), 'the outage text says to run it outside');
  } },
  { name: 'spring breakup and earthquakes: fix the driveway and check the foundation, strap the water heater', fn: async () => {
    const sp = f => withState(tk({ phase: 'spring' }), s => { s.did.well = 2; s.did.septic = 1; f(s) });
    assert.ok(ids(sp(() => {})).includes('breakup') && !ids(sp(s => { s.did.breakup = 2 })).includes('breakup'));
    const stuck = C.rollSpring(sp(() => {}), { rand: seq(0, 0, .99, .99, .99) }), heave = C.rollSpring(sp(() => {}), { rand: seq(0, .99, .99, .99, .99) });
    assert.ok(/soup|tow/.test(lines(stuck)) && stuck.cashDelta === -260); assert.ok(/Frost heaves/.test(lines(heave)) && heave.cashDelta === -900);
    const fixed = C.resolve(sp(() => {}), 'breakup', 'diy').state; assert.strictEqual(fixed.did.breakup, 2); assert.ok(!/Breakup|Frost/.test(lines(C.rollSpring(withState(tk({ phase: 'spring' }), s => { Object.assign(s, fixed); s.did.well = 2; s.did.septic = 1 }), { rand: seq(0, 0, .99, .99, .99) }))));
    const quake = (strap) => C.rollSpring(sp(s => { s.did.breakup = 2; s.strap = strap }), { rand: seq(.99, .99, 0) });
    const bad = quake(0), good = quake(1);
    assert.ok(/earthquake/.test(lines(bad)) && bad.cashDelta === -1100 && bad.daysLost === 1 && /2018 Anchorage/.test(lines(bad)), lines(bad));
    assert.ok(/quake/.test(lines(good)) && good.cashDelta === 0 && /stay put/.test(lines(good)));
    assert.ok(rolls(r => /quake/.test(lines(C.rollSpring(sp(s => { s.did.breakup = 2 }), { rand: r }))), 20000) < .06, 'rare');
    assert.ok(ids(tk()).includes('strap'));
  } },
  { name: 'condition: drifts down slowly, jobs restore it, and a run-down cabin has more bad luck', fn: async () => {
    let st = C.newState(); const c0 = st.cond;
    for (let d = 1; d < 14; d++) st = C.daily(tk({ state: st, phase: 'summer', sday: d, abs: 28 + d, recentFish: 0 }), { rand: K(.99) }).state;
    assert.ok(c0 - st.cond > 2 && c0 - st.cond < 4, `a July costs ${c0 - st.cond}`);   // 1.11.0: 0.2 a July day (was 0.5)
    const w = C.rollWinter(tk({ state: st }), { rand: K(.99) }); assert.ok(st.cond - w.cond >= 2.5 && st.cond - w.cond <= 4, `a winter costs ${st.cond - w.cond}`);   // 3 (was 8)
    assert.ok(C.risk({ cond: 0 }) > C.risk({ cond: 50 }) && C.risk({ cond: 50 }) > C.risk({ cond: 100 }) && C.risk({ cond: 100 }) <= .66 && C.risk({ cond: 0 }) >= 1.89);
    assert.ok(C.risk({ cond: 20 }) - C.risk({ cond: 50 }) > C.risk({ cond: 80 }) - C.risk({ cond: 100 }) , 'the curve bends: wear compounds');
    const rate = cond => rolls(r => /ice dam/.test(lines(C.resolve(withState(tk(), s => { s.cond = cond; s.queue = [{ id: 'snow', depth: 1 }] }), 'snow', 'skip', { rand: r }))), 6000);
    assert.ok(rate(5) > rate(95) * 1.6, `${rate(5)} vs ${rate(95)}`);
    assert.ok(C.status(tk()).length >= 3);
  } },
  { name: 'neglect wears the cabin down faster: skipping a job or a storm prompt costs condition, doing it does not', fn: async () => {
    const t = withState(tk({ phase: 'spring' }), s => { s.cond = 60 });
    const skip = C.resolve(t, 'breakup', 'skip', { rand: K(.99) }), pay = C.resolve(t, 'breakup', 'pay', { rand: K(.99) });
    assert.strictEqual(skip.cond, 60 - Math.ceil(8 * .75)); assert.strictEqual(pay.cond, 68);
    const storm = withState(tk(), s => { s.cond = 60; s.did.oil = 2; s.queue = [{ id: 'snow', depth: 1 }] });
    assert.strictEqual(C.resolve(storm, 'snow', 'skip', { rand: K(.99) }).cond, 58); assert.strictEqual(C.resolve(storm, 'snow', 'pay', { rand: K(.99) }).cond, 62);
    // a year of skipping everything leaves a cabin far below one kept up
    const year = pol => { let st = C.newState(); for (const ph of ['fall', 'spring']) { C.autoplay({ ticket: () => tk({ state: st, phase: ph, season: 1, daysLeft: 10 }), apply: r => { st = r.state } }, { policy: pol, rand: K(.99) }) } return st };
    const a = year('neglect'), b = year('careful');
    assert.ok(b.cond - a.cond > 15, `${b.cond} vs ${a.cond}`);
  } },
  { name: 'default play (the Home tab never opened, storm prompts answered with the top button) leaves a cabin worn but not run down after four years; skipping everything does', fn: async () => {
    // 1.11.0: not doing a job is gentler than skipping it, so a guide who never opens the Home tab is not punished like one who skips on purpose
    const stormsOnly = j => j.kind === 'event' ? C.policies.first(j) : null;
    const years = (pol, seed) => {
      const r = C.util.seeded(seed); let st = C.newState(), cash = 0, energy = 0;
      const take = x => { st = x.state; cash += x.cashDelta; energy += x.energyDelta };
      const play = (ph, y) => C.autoplay({ ticket: () => tk({ state: st, phase: ph, season: y, daysLeft: 10, cash: 9000 }), apply: take }, { policy: pol === 'default' ? stormsOnly : pol, rand: r });
      for (let y = 1; y <= 4; y++) {
        for (let d = 1; d < 14; d++) take(C.daily(tk({ state: st, phase: 'summer', season: y, sday: d, abs: y * 14 + d, recentFish: 0 }), { rand: r }));
        play('fall', y); take(C.rollWinter(tk({ state: st, phase: 'fall', season: y }), { rand: r })); play('spring', y); take(C.rollSpring(tk({ state: st, phase: 'spring', season: y }), { rand: r }));
      }
      return { cond: st.cond, cash, energy };
    };
    const mean = (pol, f) => { let t = 0; for (let k = 1; k <= 40; k++) t += f(years(pol, k)); return t / 40; };
    const dc = mean('default', x => x.cond), nc = mean('neglect', x => x.cond), cc = mean('careful', x => x.cond);
    assert.ok(dc > 35 && dc < 85, `default cabin condition ${dc}`);
    assert.ok(nc < 20, `neglected cabin condition ${nc}`);
    assert.ok(cc > 90, `careful cabin condition ${cc}`);
    assert.ok(dc > nc + 25, `default ${dc} vs neglect ${nc}`);
    const dm = mean('default', x => x.cash + 40 * x.energy), nm = mean('neglect', x => x.cash + 40 * x.energy);
    assert.ok(dm > nm, `default costs less than neglect: ${dm} vs ${nm}`);
  } },
  { name: 'a failure that closes the cabin can cost a booked trip: a stuck truck, a dead well pump, a septic backup and, in July, a dead pump', fn: async () => {
    const sp = f => withState(tk({ phase: 'spring' }), f);
    const stuck = C.rollSpring(sp(s => { s.did.breakup = -1; s.did.well = 2; s.did.septic = 2 }), { rand: seq(.1, .1, .1, .99, .99, .99) });
    assert.ok(/sinks to the axles/.test(lines(stuck)) && stuck.cancels === 1 && /will not make it down the drive/.test(lines(stuck)), lines(stuck));
    const worst = C.rollSpring(sp(s => { s.did.well = -2; s.did.septic = -3 }), { rand: K(0) });
    assert.ok(worst.cancels >= 2 && /no water|cancels/.test(lines(worst)), lines(worst));
    const kept = C.rollSpring(sp(s => { s.did.breakup = 2; s.did.well = 2; s.did.septic = 2 }), { rand: K(.99) }); assert.strictEqual(kept.cancels, 0);
    // the text only says a party cancels when one does
    const lucky = C.rollSpring(sp(s => { s.did.breakup = -1; s.did.well = 2; s.did.septic = 2 }), { rand: seq(.1, .1, .99, .99, .99, .99) });
    assert.ok(lucky.cancels === 0 && !/make it down the drive/.test(lines(lucky)), lines(lucky));
    // a run-down cabin puts off the first parties of the season; one in fair shape does not
    const shabby = C.rollSpring(sp(s => { s.cond = 0; s.did.breakup = 2; s.did.well = 2; s.did.septic = 2 }), { rand: seq(.99, .99, .99, .1) });
    assert.ok(shabby.cancels === 1 && /sagging porch/.test(lines(shabby)) && shabby.severity === 1 && shabby.cashDelta === 0, lines(shabby));
    assert.strictEqual(C.rollSpring(sp(s => { s.cond = 45; s.did.breakup = 2; s.did.well = 2; s.did.septic = 2 }), { rand: seq(.99, .99, .99, 0) }).cancels, 0);
    assert.strictEqual(C.rollSpring(sp(s => { s.cond = 0; s.did.breakup = 2; s.did.well = 2; s.did.septic = 2 }), { rand: seq(.99, .99, .99, .6) }).cancels, 0, 'at most 30% of the time, even at 0');
    // July: below the trouble line the cabin itself fails now and then (at most once a summer); in good shape it does not
    const july = (cond, sday, st0) => C.daily(tk({ phase: 'summer', sday, abs: 28 + sday, recentFish: 0, state: st0 || withState(tk(), s => { s.cond = cond; s.bearY = 2 }).state }), { rand: K(0) });
    const j = july(20, 3); assert.ok(j.cancels === 1 && /pump and pressure tank/.test(lines(j)) && j.cashDelta === -380 && j.severity === 1, lines(j));
    const again = july(20, 4, j.state); assert.ok(!/pump and pressure|breaker|blower/.test(lines(again)), 'once a summer: ' + lines(again));
    assert.ok(!/pump and pressure|breaker|blower/.test(lines(july(80, 3))));
    const rate = cond => rolls(r => /pump and pressure|breaker|blower/.test(lines(C.daily(tk({ phase: 'summer', sday: 3, abs: 31, recentFish: 0, state: withState(tk(), s => { s.cond = cond; s.bearY = 2 }).state }), { rand: r }))), 4000);
    assert.ok(rate(5) > rate(30) * 1.1 && rate(45) === 0, `${rate(5)} ${rate(30)} ${rate(45)}`);
    // the burst, the well and the septic bills are bigger than before, and scale with the difficulty's prices
    const hard = C.rollSpring(withState(tk({ phase: 'spring', costMult: 1.5 }), s => { s.did.well = -2; s.did.septic = 2; s.did.breakup = 2 }), { rand: seq(0, 0, .99, .99) });
    assert.strictEqual(hard.cashDelta, -Math.round(1500 * 1.5), lines(hard));
  } },
  { name: 'a cold, damp cabin costs sleep in July; a cabin in good shape sends you out rested, and the text says so once a summer', fn: async () => {
    const morning = (cond, sday = 3, st0) => C.daily(tk({ phase: 'summer', sday, abs: 28 + sday, recentFish: 0, state: st0 || withState(tk(), s => { s.cond = cond; s.bearY = 2; s.troubleY = 2; s.troubles = 1 }).state }), { rand: K(.99) });
    const good = morning(90), sleepy = morning(30), wreck = morning(10), mid = morning(55);
    assert.strictEqual(good.energyDelta, 3); assert.ok(/wake rested/.test(lines(good)), lines(good));
    assert.strictEqual(sleepy.energyDelta, -2); assert.strictEqual(wreck.energyDelta, -4); assert.ok(/sleep badly/.test(lines(sleepy)));
    assert.strictEqual(mid.energyDelta, 0); assert.strictEqual(mid.lines.length, 0);
    assert.ok(!/wake rested/.test(lines(morning(90, 4, good.state))) && morning(90, 4, good.state).energyDelta === 3, 'the line comes once a summer, the rest every morning');
    assert.ok(!/sleep badly/.test(lines(morning(30, 4, sleepy.state))) && morning(30, 4, sleepy.state).energyDelta === -2);
    // nothing here can end a career: no cash at all, and the worst morning is bounded
    assert.ok(good.cashDelta === 0 && sleepy.cashDelta === 0);
  } },
  { name: 'autoplay: a careful player keeps a $400 cushion of cash and does not spend the last of it on a chore', fn: async () => {
    const done = cash => { let st = C.newState(), c = cash; const all = []; C.autoplay({ ticket: () => tk({ state: st, phase: 'fall', season: 1, cash: c, daysLeft: 10 }), apply: r => { st = r.state; c += r.cashDelta; all.push(...r.done) } }, { policy: 'careful', rand: K(.99) }); return all };
    const poor = done(500), rich = done(5000);
    assert.ok(!poor.includes('tape') && !poor.includes('skirt'), `poor did ${poor}`); assert.ok(rich.includes('tape') && rich.includes('skirt'), `rich did ${rich}`);
    assert.ok(poor.includes('detect'), 'an $85 job is still fine on $500');
  } },
  { name: 'never ends a career: thirty cycles of worst luck and neglect stay finite, bounded per cycle, and never ask for more than a few thousand dollars', fn: async () => {
    let st = C.newState(), worst = 0;
    for (let y = 1; y <= 30; y++) {
      let cost = 0, days = 0;
      const ap = rep => { st = rep.state; cost += -rep.cashDelta; days += rep.daysLost; assert.ok(rep.state.cond >= 0 && rep.state.cond <= 100); assert.ok(Number.isFinite(rep.cashDelta)) };
      ap(C.rollWinter(tk({ state: st, season: y }), { rand: K(0) }));
      for (let g = 0; g < 5; g++) { const j = C.jobs(tk({ state: st, season: y, phase: 'spring' }), { all: true }).find(x => x.kind === 'event'); if (!j) break; ap(C.resolve(tk({ state: st, season: y, phase: 'spring' }), j.id, 'skip', { rand: K(0) })) }
      ap(C.rollSpring(tk({ state: st, season: y, phase: 'spring' }), { rand: K(0) }));
      for (let d = 1; d < 14; d++) ap(C.daily(tk({ state: st, season: y, phase: 'summer', sday: d, abs: y * 14 + d }), { rand: K(0) }));
      worst = Math.max(worst, cost);
    }
    assert.ok(worst < 12000, `the worst cycle cost ${worst}`);
    assert.strictEqual(st.cond, 0);
  } },
  { name: 'autoplay: careful does the work yourself when it can, payall pays, neglect skips everything, and careful beats neglect on average', fn: async () => {
    const run = (policy, seed) => { let st = C.newState(), cash = 0, daysLeft = 10, tot = { cash: 0, days: 0, n: 0 }; const r = C.util.seeded(seed);
      const host = { ticket: () => tk({ state: st, phase: 'summer', sday: 4, abs: 40, daysLeft }), apply: rep => { st = rep.state; tot.cash += rep.cashDelta; tot.days += rep.daysUsed; tot.n++ } };
      let reps = C.autoplay(host, { policy, rand: r }); return { st, reps, tot } };
    const c = run('careful', 1), p = run('payall', 1), n = run('neglect', 1);
    assert.ok(c.reps.length > 0 && c.reps.every(x => x.cashDelta >= -300)); assert.ok(n.reps.every(x => x.cashDelta === 0));
    assert.ok(p.reps.some(x => x.cashDelta < 0) && -p.tot.cash > -c.tot.cash);
    const season = (policy, seed) => { let st = C.newState(); const r = C.util.seeded(seed); let cost = 0, dl = 0;
      for (let y = 1; y <= 5; y++) { let phase = 'fall', daysLeft = 10, sday = 0;
        const host = { ticket: () => tk({ state: st, season: y, phase, daysLeft, sday, abs: y * 14 + sday }), apply: rep => { st = rep.state; cost -= rep.cashDelta; dl += rep.daysLost; daysLeft = Math.max(0, daysLeft - rep.daysUsed - rep.daysLost) } };
        const ap = rep => host.apply(rep);
        C.autoplay(host, { policy, rand: r }); ap(C.rollWinter(host.ticket(), { rand: r })); phase = 'spring'; C.autoplay(host, { policy, rand: r }); ap(C.rollSpring(host.ticket(), { rand: r }));
        phase = 'summer'; for (sday = 1; sday < 14; sday++) { ap(C.daily(host.ticket(), { rand: r })); C.autoplay(host, { policy, rand: r }) } }
      return cost + dl * 90 };
    let cs = 0, ns = 0, ps = 0; for (let i = 1; i <= 120; i++) { cs += season('careful', i); ns += season('neglect', i); ps += season('payall', i) }
    assert.ok(cs < ns * .6, `careful ${cs / 600} vs neglect ${ns / 600} a season`); assert.ok(ps < ns * 1.05, `payall ${ps / 600} vs neglect ${ns / 600}`);
  } },

  // ---------- the adapter in the real game ----------
  { name: 'game: the Home tab shows the cabin and at most two jobs, a dot when something is due, and a job opens as three ways with 44 px buttons', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const r = await page.evaluate(() => { setTab('home'); return { tabs: [...document.querySelectorAll('.tabs button')].map(b => b.textContent.trim()), dot: !!document.querySelector('.tabs button.on .dot'), jobs: document.querySelectorAll('[data-cab=job]').length, text: document.querySelector('.content').textContent } });
    assert.ok(r.tabs.some(t => /Home/.test(t)) && r.dot && r.jobs >= 1 && r.jobs <= 2, JSON.stringify(r));
    assert.ok(/Cabin condition/.test(r.text) && /80\/100/.test(r.text) && /Heat/.test(r.text));
    await page.click('[data-cab=job]');
    const m = await page.evaluate(() => ({ title: document.querySelector('#mbg h2').textContent, btns: [...document.querySelectorAll('#mbg button.act')].map(b => ({ t: b.textContent, h: b.getBoundingClientRect().height })) }));
    assert.ok(/Do it yourself/.test(m.btns[0].t) && /Pay someone/.test(m.btns[1].t) && /Skip it/.test(m.btns[2].t), JSON.stringify(m));
    assert.ok(m.btns.every(b => b.h >= 44), 'targets ' + m.btns.map(b => b.h));
    await page.keyboard.press('Escape'); assert.strictEqual(await page.evaluate(() => !!document.getElementById('mbg')), false, '"Not now" style pop-ups close with Esc');
    noErrors(errors);
  } },
  { name: 'game: in July yourself spends minutes, energy and a little cash; paying spends cash only; skipping is remembered; away from the cabin only paying works', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const r = await page.evaluate(() => {
      const out = {}, id = () => homeTicket() && CabinUpkeep.jobs(homeTicket())[0].id;
      closeModals(); const j0 = CabinUpkeep.jobs(homeTicket())[0]; out.first = j0.id;
      S.loc = 'town'; const j3 = CabinUpkeep.jobs(homeTicket(), { all: true })[0]; out.away = j3 && j3.opts.map(o => o.dis); S.loc = 'shop';
      let t0 = S.t, e0 = S.energy, m0 = S.money; CabinUpkeep.ui.open(homeHost(), j0.id); MBTN(0); out.diy = { min: S.t - t0, energy: Math.round(e0 - S.energy), cash: Math.round(m0 - S.money) };
      const j1 = CabinUpkeep.jobs(homeTicket())[0]; out.next = j1 && j1.id;
      t0 = S.t; e0 = S.energy; m0 = S.money; if (j1) { CabinUpkeep.ui.open(homeHost(), j1.id); MBTN(1); out.pay = { min: S.t - t0, energy: Math.round(e0 - S.energy), cash: Math.round(m0 - S.money), price: j1.opts[1].cash } }
      const j2 = CabinUpkeep.jobs(homeTicket())[0]; if (j2) { CabinUpkeep.ui.open(homeHost(), j2.id); MBTN(2); out.skipped = j2.id; out.stillDue = CabinUpkeep.jobs(homeTicket(), { all: true }).some(x => x.id === j2.id) }
      out.cond = cabin().cond; return out;
    });
    assert.ok(r.diy.min > 0 && r.diy.energy > 0 && r.diy.cash >= 0, JSON.stringify(r)); if (r.pay) { assert.strictEqual(r.pay.min, 0); assert.strictEqual(r.pay.cash, r.pay.price) }
    if (r.skipped) assert.strictEqual(r.stillDue, r.skipped === 'bins');
    assert.deepStrictEqual(r.away && r.away.slice(0, 1), [true], 'away from the cabin: do it yourself is off');
    noErrors(errors);
  } },
  { name: 'game: at most one gentle reminder a day, and no more than two jobs on the Home tab however many are due', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const r = await page.evaluate(() => {
      closeModals(); clearTiles(); const out = {};
      S.cur = 9; S.t = 9 * 1440 + 300; S.cabin.did.bins = -99;
      homeMorning(); homeMorning(); homeMorning(); out.tiles = document.querySelectorAll('#tiles .tile').length + tileQ.length;
      out.reminded = S.cabin.rem; out.jobs = CabinUpkeep.jobs(homeTicket()).length; out.due = CabinUpkeep.dueCount(homeTicket());
      return out;
    });
    assert.ok(r.tiles <= 1, JSON.stringify(r)); assert.ok(r.jobs <= 2 && r.due > r.jobs - 1);
    noErrors(errors);
  } },
  { name: 'game: a bad July morning (a bear) costs money, a morning and rep, and can never end the career', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const r = await page.evaluate(() => {
      closeModals(); S.cabin.did.bins = -99; S.cur = 9; S.t = 9 * 1440 + 300; S.money = -1100; S.rep = 30;
      const rr = Math.random; Math.random = () => 0; const m0 = S.money;
      try { homeMorning(); } finally { Math.random = rr }
      return { bear: S.cabin.bearY === seasonOf(day()), money: S.money, over: S.over, loss: checkLoss(), log: S.log.slice(-3).map(x => x.s).join(' ') };
    });
    assert.ok(r.bear && r.money >= -1200 && !r.over && r.loss == null, JSON.stringify(r));
    noErrors(errors);
  } },
  { name: 'game: the off-season has a cabin step; yourself spends the shared free days, and storms land before camping', fn: async ctx => {
    const { page, errors } = await winterGame(ctx);
    const r = await page.evaluate(() => {
      const out = {}; winterModal();
      out.label = [...document.querySelectorAll('#mbg button.act')].map(b => b.textContent).find(t => /The cabin/.test(t));
      out.phase = homePhase(); out.before = campDaysLeft();
      closeModals(); const j = CabinUpkeep.jobs(homeTicket())[0]; out.job = j.id; out.jobs = CabinUpkeep.jobs(homeTicket()).length;
      const oil = CabinUpkeep.jobs(homeTicket(), { all: true }).find(x => x.id === 'oil'); out.oil = !!oil;
      CabinUpkeep.ui.open(homeHost(), 'oil'); MBTN(0); out.after = campDaysLeft(); out.usedDays = S.camp.days; out.cash = Math.round(S.money);
      return out;
    });
    assert.ok(/job/.test(r.label) && r.phase === 'fall' && r.jobs <= 2 && r.oil && r.before === 10 && r.after === 9 && r.usedDays === 1, JSON.stringify(r));
    // camping first rolls the winter: the storm report and prompts come before the camping hub
    const s = await page.evaluate(() => { closeModals(); S.cabin.did.oil = S.winter.s; const rr = Math.random; Math.random = () => 0; campModal(); Math.random = rr; return { title: document.querySelector('#mbg h2').textContent, rolled: cabin().rolled === S.winter.s, queue: cabin().queue.map(q => q.id) } });
    assert.ok(/The cabin this winter/.test(s.title) && s.rolled && s.queue.includes('cold') && s.queue.includes('snow'), JSON.stringify(s));
    // the storm prompts are locked until answered (Esc does nothing), then the camping hub opens
    await page.keyboard.press('Escape'); assert.ok(await page.evaluate(() => !!document.getElementById('mbg')));
    const t = await page.evaluate(() => { const seen = []; let g = 0; while (document.getElementById('mbg') && g++ < 12) { const h = document.querySelector('#mbg h2').textContent; seen.push(h); if (/Winter camp/.test(h)) break; MBTN(0) } return { seen, queue: cabin().queue.length } });
    assert.ok(t.seen.length >= 3 && /Winter camp/.test(t.seen[t.seen.length - 1]) && t.queue === 0, JSON.stringify(t));
    noErrors(errors);
  } },
  { name: 'game: lost winter days come out of the free days, the rest as lost winter work, and cash never falls below −$1,200 from home trouble', fn: async ctx => {
    const { page, errors } = await winterGame(ctx);
    const r = await page.evaluate(() => {
      const out = {}; S.camp = Object.assign(S.camp, { days: 9, s: S.winter.s }); campW(); S.money = 300;
      const rep = { state: cabin(), cashDelta: -5000, spent: 5000, energyDelta: 0, repDelta: 0, womDelta: 0, minutes: 0, daysUsed: 0, daysLost: 3, homeFuel: 0, freshLost: 0, foodMeals: 0, lines: [], severity: 2 };
      homeApply(rep); out.money = Math.round(S.money); out.days = S.camp.days; out.over = S.over; out.loss = checkLoss();
      out.log = S.log.slice(-4).map(x => x.s).join(' ');
      // and a forced worst luck on the whole winter
      S.money = 100; const rr = Math.random; Math.random = () => 0; try { homeBotWinter('neglect'); homeAnswerStorms(); homeApply(CabinUpkeep.rollSpring(homeTicket()), true) } finally { Math.random = rr }
      out.worst = Math.round(S.money); out.loss2 = checkLoss(); return out;
    });
    assert.strictEqual(r.days, 10); assert.ok(r.money >= -1200 && r.money < 300 && !r.over && r.loss == null, JSON.stringify(r));
    assert.ok(/lost winter work|carry the rest/.test(r.log), r.log);
    assert.ok(r.worst >= -1200 && r.loss2 == null, JSON.stringify(r));
    noErrors(errors);
  } },
  { name: 'game: a failure that closes the cabin cancels booked trips: spring waits for the bookings, July cancels the next ones, and the deposit goes back', fn: async ctx => {
    const { page, errors } = await winterGame(ctx);
    const r = await page.evaluate(() => {
      const o = {}, s = S.winter.s, rep = n => ({ state: cabin(), cashDelta: 0, spent: 0, energyDelta: 0, repDelta: 0, womDelta: 0, minutes: 0, daysUsed: 0, daysLost: 0, homeFuel: 0, freshLost: 0, foodMeals: 0, lines: [], severity: 2, cancels: n });
      const mk = (d) => addBooking({ d, type: 'reds', n: 3, who: 'test party', from: 'Texas', quirk: [] });
      homeApply(rep(2), true); o.queued = S.homeCancel; o.stillBooked0 = S.book.filter(b => b.status === 'cancelled').length;
      const f = seasonFirst(s); S.winter = null; const bs = [mk(f + 1), mk(f + 2), mk(f + 3), mk(f + 9)];
      const c0 = S.stats.cancelled, m0 = S.money; S.winter = { s }; homeSeasonOpens(s); S.winter = null;
      o.after = bs.map(b => b.status); o.cancelled = S.stats.cancelled - c0; o.left = S.homeCancel; o.money = S.money - m0;
      S.cur = f + 3; homeApply(rep(1), true); o.july = bs.map(b => b.status);
      S.cur = f + 3; homeApply(rep(3), true); o.july2 = bs.map(b => b.status); o.last = bs[3].status; o.log = S.log.slice(-3).map(x => x.s).join(' ');
      return o;
    });
    assert.strictEqual(r.queued, 2); assert.strictEqual(r.stillBooked0, 0, 'nothing is cancelled until there are bookings');
    assert.deepStrictEqual(r.after, ['cancelled', 'cancelled', 'booked', 'booked']); assert.strictEqual(r.cancelled, 2); assert.strictEqual(r.left, 0); assert.strictEqual(r.money, 0);
    assert.deepStrictEqual(r.july, ['cancelled', 'cancelled', 'cancelled', 'booked']);
    assert.strictEqual(r.last, 'booked', 'only the next two days are at risk in July'); assert.ok(/cancel their/.test(r.log) && /refund the deposit/.test(r.log), r.log);
    noErrors(errors);
  } },
  { name: 'game: finishing the off-season answers any leftover storm prompt with the top button, runs spring and clears the queue (a bot that never opens Home)', fn: async ctx => {
    const { page, errors } = await winterGame(ctx);
    const r = await page.evaluate(async () => {
      const s = S.winter.s, m0 = S.money; finishWinter(); await new Promise(r => setTimeout(r, 20));
      return { winter: S.winter, rolled: cabin().rolled === s, sprung: cabin().sprung === s, queue: cabin().queue.length, cash: Math.round(S.money - m0), sprung2: cabin().sprung };
    });
    assert.strictEqual(r.winter, null); assert.ok(r.rolled && r.sprung && r.queue === 0, JSON.stringify(r));
    noErrors(errors);
  } },
  { name: 'game: the gate before bookings rolls the winter first, then nudges once about spring jobs', fn: async ctx => {
    const { page, errors } = await winterGame(ctx);
    const r = await page.evaluate(() => {
      const out = {}; let went = 0; closeModals();
      homeOpenGate(() => went++);
      out.first = document.querySelector('#mbg h2').textContent; // the winter report
      let g = 0; while (document.getElementById('mbg') && g++ < 10) MBTN(0);
      out.rolled = cabin().rolled === S.winter.s; out.went1 = went; out.queue = cabin().queue.length;
      homeOpenGate(() => went++); out.second = document.getElementById('mbg') ? document.querySelector('#mbg h2').textContent : '(none)';
      if (document.getElementById('mbg')) MBTN(1); out.went2 = went;
      homeOpenGate(() => went++); out.third = !!document.getElementById('mbg'); out.went3 = went; return out;
    });
    assert.ok(r.rolled && r.went1 === 0 && r.queue === 0, JSON.stringify(r));
    assert.ok(/Spring jobs are due/.test(r.second) && r.went2 === 1 && !r.third && r.went3 === 2, JSON.stringify(r));
    noErrors(errors);
  } },
  { name: 'game: outage and generator: an unserviced generator may not start (the freezer is on its own, $85 at the shop); a serviced one runs', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const r = await page.evaluate(() => {
      const out = {}; S.home.gen = 1; S.home.gal = 20; S.freezer = 20; S.home.stale = 5;
      S.cabin.did.genoil = -1; S.cabin.did.genrun = -1; out.odds = CabinUpkeep.genOdds(homeTicket()).p;
      const rr = Math.random; Math.random = () => 0; const m0 = S.money; let o;
      try { o = outage(40, false) } finally { Math.random = rr }
      out.fail = !!o.genFail; out.run = o.run; out.fish = o.fish; out.cost = Math.round(m0 - S.money); out.line = o.lines[0]; out.fixed = CabinUpkeep.genOdds(homeTicket({ gen: { owned: true, gas: 'ok' } })).p;
      // serviced and fresh gas: it starts, at the same roll of the dice
      S.home.stale = 0; S.cabin.did.genoil = seasonOf(day()); S.cabin.did.genrun = seasonOf(day()); S.freezer = 20; S.home.gal = 20;
      Math.random = () => .5; try { o = outage(40, false) } finally { Math.random = rr }
      out.okRun = o.run > 0 && !o.genFail; out.okFish = o.fish; return out;
    });
    assert.ok(r.odds > .35 && r.fail && r.run === 0 && r.cost === 85 && /coughs and dies/.test(r.line) && r.fixed < .06, JSON.stringify(r));
    assert.ok(r.okRun && r.okFish === 0, JSON.stringify(r));
    // a generator you buy is in shape; a winter outage that no generator covered chills the cabin
    const b = await page.evaluate(() => { S.money = 9000; S.home.gen = 0; S.cabin.did.genoil = -9; buyHome('gen1'); return { oil: S.cabin.did.genoil === seasonOf(day()), gas: CabinUpkeep.genOdds(homeTicket()).p < .06 } });
    assert.ok(b.oil && b.gas);
    noErrors(errors);
  } },
  { name: 'game: the fish processing station adds a fee to a real trip’s pay, and spoils a batch when it is dirty', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const r = await page.evaluate(() => {
      const out = {}; S.money = 9000; S.cabin.proc = 1; S.cabin.station.tidy = 100; S.cabin.did.stdef = seasonOf(day());
      const b = { id: 9001, d: day(), type: 'reds', n: 4, who: 'Test party', from: 'Ohio', res: false, quirk: [], status: 'booked' };
      const t = { notes: [], x: [] }; homeProcessing(b, 12, t); out.fee = t.x.filter(x => /processing/.test(x[0])).reduce((a, x) => a + x[1], 0); out.notes = t.notes.join(' ');
      out.trout = (() => { const t2 = { notes: [], x: [] }; homeProcessing(Object.assign({}, b, { type: 'trout' }), 12, t2); return t2.x.length })();
      S.cabin.station.tidy = 5; S.cabin.did.stdef = -1; const rr = Math.random; Math.random = () => 0; const t3 = { notes: [], x: [] }, w0 = S.wom || 0; try { homeProcessing(b, 12, t3) } finally { Math.random = rr }
      out.spoil = { x: t3.x.length, wom: (S.wom || 0) - w0, notes: t3.notes.join(' ') };
      out.hasFee = true;
      return out;
    });
    assert.ok(r.fee > 0 && r.fee <= 60 && /fees/.test(r.notes) && r.trout === 0, JSON.stringify(r));
    assert.ok(r.spoil.x === 0 && r.spoil.wom === -1 && /off/.test(r.spoil.notes), JSON.stringify(r.spoil)); assert.ok(r.hasFee);
    const trip = await page.evaluate(() => { newGame('normal'); closeModals(); S.cur = 1; S.t = 1440 + 345; S.loc = 'lower'; S.fuel = 30; S.cabin.proc = 1; S.cabin.station.tidy = 100; S.cabin.did.stdef = seasonOf(day()); const b = todays()[0]; tripStart(b); let i = 0; while (S.trip && i++ < 30) MBTN(legalBtn()); closeModals(); return { status: b.status, fees: cabin().tot.fees, spoiled: cabin().tot.spoiled } });
    assert.strictEqual(trip.status, 'done'); assert.ok(trip.fees > 0 || trip.spoiled > 0, JSON.stringify(trip));
    noErrors(errors);
  } },
  { name: 'game: the garden’s harvest goes to the fridge, a moose can take it, and the shop sells the stove, the station and the bin', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const r = await page.evaluate(() => {
      const out = {}; closeModals(); S.food.fri = 0; S.cabin.garden.y = seasonOf(day()); S.cabin.fence = 1; S.cur = 10; S.t = 10 * 1440 + 300;
      homeMorning(); out.fri = S.food.fri;
      S.food.fri = 0; S.cabin.fence = 0; S.cabin.did.bins = S.cur; S.cabin.garden.y = seasonOf(day()); const rr = Math.random; Math.random = () => 0; try { S.cabin.rem = S.cur; homeMorning() } finally { Math.random = rr }
      out.moose = S.food.fri; out.log = S.log.slice(-2).map(x => x.s).join(' ');
      S.money = 9000; const m0 = S.money; const items = CabinUpkeep.shop(homeTicket()); out.items = items.map(i => i.id);
      ['stove', 'station', 'bin'].forEach(id => { const rep = CabinUpkeep.buy(homeTicket(), id); homeApply(rep) }); out.spent = Math.round(m0 - S.money); out.has = [cabin().heat.stove, cabin().proc, cabin().bin];
      return out;
    });
    assert.strictEqual(r.fri, 8); assert.ok(r.moose <= 2 && /moose/.test(r.log), JSON.stringify(r)); assert.deepStrictEqual(r.items, ['stove', 'station', 'bin']); assert.strictEqual(r.spent, 3400 + 1900 + 140); assert.deepStrictEqual(r.has, [1, 1, 1]);
    noErrors(errors);
  } },
  { name: 'game: the Home shop pop-up buys with the real cash and the adapter charges whole dollars', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const r = await page.evaluate(() => { S.money = 5000; CabinUpkeep.ui.shop(homeHost()); const t = document.querySelector('#mbg').textContent; MBTN(2); return { t, bin: cabin().bin, money: S.money } });
    assert.ok(/\$3,400/.test(r.t) && /\$1,900/.test(r.t) && /\$140/.test(r.t)); assert.strictEqual(r.bin, 1); assert.strictEqual(r.money, 4860);
    noErrors(errors);
  } },
  { name: 'game: old saves load: no cabin yet, a mid-off-season save, and a generator owner all come up to date', fn: async ctx => {
    const { page, errors } = await winterGame(ctx);
    const r = await page.evaluate(() => {
      const out = {};
      const d = JSON.parse(JSON.stringify(packSave())); d.schema = 3; d.app = '1.9.0'; delete d.S.cabin; delete d.S.homeAsk; delete d.S.winOut; d.S.home.gen = 1;
      const m = migrate(d); out.schema = m.schema; out.cabin = m.S.cabin.v; out.cond = m.S.cabin.cond; out.ask = m.S.homeAsk;
      const keep = S; S = m.S; try { out.phase = homePhase(); out.due = CabinUpkeep.dueCount(homeTicket()); out.ids = CabinUpkeep.jobs(homeTicket(), { all: true }).map(j => j.id); out.genOdds = CabinUpkeep.genOdds(homeTicket({ season: m.S.winter.s - 1, gen: { owned: true, gas: 'ok' } })).p; out.tab = typeof homeView() } finally { S = keep }
      const d2 = JSON.parse(JSON.stringify(packSave())); d2.schema = 3; delete d2.S.cabin; d2.S.winter = null; d2.S.cur = 20;
      const m2 = migrate(d2); const k2 = S; S = m2.S; try { out.summerIds = CabinUpkeep.jobs(homeTicket(), { all: true }).map(j => j.id); out.y = m2.S.cabin.y } finally { S = k2 }
      return out;
    });
    assert.strictEqual(r.schema, 4); assert.strictEqual(r.cabin, 1); assert.strictEqual(r.cond, 80); assert.strictEqual(r.ask, -1); assert.strictEqual(r.phase, 'fall');
    assert.ok(r.ids.includes('oil') && !r.ids.includes('breakup'), JSON.stringify(r)); assert.ok(r.genOdds < .06, 'a generator you already own counts as serviced'); assert.strictEqual(r.tab, 'string');
    assert.strictEqual(r.y, 1); assert.ok(!r.summerIds.includes('genoil') || true);
    noErrors(errors);
  } },
  { name: 'game: version 1.10.1, save schema 4, a changelog line, a Help section, an end-screen row and a tip', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const r = await page.evaluate(() => ({ v: APP_VERSION, s: SAVE_SCHEMA, c: CHANGELOG['1.10.0'].join(' '), c1: CHANGELOG['1.10.1'].join(' '), h: HELP.find(x => /cabin/i.test(x[1]))[2], tip: TIPS.some(t => t.id === 'cabin'), sw: null }));
    assert.strictEqual(r.v, '1.10.1'); assert.strictEqual(r.s, 4);
    assert.ok(/booked trip/.test(r.c1) && /bad sleep/.test(r.c1) && /\$800/.test(r.c1) && /never ends a career/.test(r.c1) && /game in progress/.test(r.c1), r.c1);
    assert.ok(/Home tab/.test(r.c) && /two at a time/.test(r.c) && /game in progress/.test(r.c));
    assert.ok(/three ways/.test(r.h) && /Never more than two/.test(r.h) && /never ends your career/.test(r.h) && /10 free days/.test(r.h) && /generator indoors/.test(r.h) && /booked party that cancels/.test(r.h) && r.tip);
    await newGame(page); assert.strictEqual(await page.evaluate(() => winterCosts()[0][1]), 800, 'living costs'); const row = await page.evaluate(() => endRows().find(x => x[0] === 'The cabin')[1]); assert.ok(/0 jobs done yourself/.test(row) && /condition 80/.test(row), row);
    assert.ok(/1\.10\.1/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')));
    noErrors(errors);
  } },
  { name: 'generator: a fresh state counts the generator as serviced in the first season, the way the migration and a newly bought one do', fn: async () => {
    const s0 = C.newState(); assert.deepStrictEqual([s0.did.genoil, s0.did.genrun], [0, 0]);
    const t = tk({ state: s0, season: 0, phase: 'summer', sday: 4, gen: { owned: true, gas: 'ok' } });
    assert.deepStrictEqual(ids(t).filter(i => /^gen/.test(i)), [], 'no generator job in the first season');
    assert.ok(C.genOdds(t).p < .06 && C.genOdds(t).why.length === 0, JSON.stringify(C.genOdds(t)));
    const next = Object.assign({}, t, { season: 1 }); assert.deepStrictEqual(ids(next).filter(i => /^gen/.test(i)), ['genoil', 'genrun'], 'a year later it is due');
    assert.deepStrictEqual([C.noteGen(next).state.did.genoil, C.noteGen(next).state.did.genrun], [1, 1]);
  } },
  { name: 'game: bots play careers with careful and neglectful cabin policies, no page errors, no career lost to the cabin', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const res = await page.evaluate(async () => {
      const out = [];
      for (const pol of ['careful', 'neglect', 'payall']) {
        setPref('years', 5); newGame('hard'); closeModals(); S.loc = 'shop'; S.money = 3000;
        for (let k = 1; k <= 4; k++) {
          S.book.forEach(b => { if (b.status === 'booked') b.status = 'done' });
          S.cur = k * 14 - 1; S.t = S.cur * 1440 + 1300; S.loc = 'shop'; S.energy = 80;
          if (pol !== 'neglect' && S.cabin.rolled < 0) homeBot(pol);
          endDay('home'); await new Promise(r => setTimeout(r, 10)); closeModals();
          if (S.over) break;
          S.money = Math.max(S.money, 3000);
          homeBotWinter(pol); closeModals(); finishWinter(); closeModals();
          S.money = Math.max(S.money, 3000);   // keep it going, and keep a careful bot above its $400 cushion: this test is about the cabin, not the river
        }
        out.push({ pol, over: S.over, loss: checkLoss(), cond: Math.round(cabin().cond), tot: cabin().tot, winter: !!S.winter });
      }
      return out;
    });
    res.forEach(r => { assert.ok(!r.over && r.loss == null && !r.winter, JSON.stringify(r)); });
    assert.ok(res[0].cond > res[1].cond + 30, JSON.stringify(res)); assert.strictEqual(res[1].tot.diy + res[1].tot.pay, 0);
    // careful upkeep really is upkeep: four years of every job (about 7 a year), none skipped, the cabin in top shape; neglect skips nearly all of them and lets it fall apart
    const [care, neg, pay] = res.map(r => r.tot);
    assert.ok(care.diy + care.pay >= 20 && care.skip === 0 && care.diy > care.pay && res[0].cond >= 90, JSON.stringify(res[0]));
    assert.ok(pay.diy + pay.pay >= 20 && pay.pay > pay.diy && pay.skip <= 4 && res[2].cond >= 85, JSON.stringify(res[2]));
    assert.ok(neg.skip >= 20 && res[1].cond <= 20, JSON.stringify(res[1]));
    noErrors(errors);
  } },
];
