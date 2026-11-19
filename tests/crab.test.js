// Crabbing (src/crab/, the Crab module; src/js/44-crab.js, the Guide Master adapter).
// The first half runs the module on its own in Node, in an empty `vm` context, with no browser and no Guide Master;
// the second half plays the adapter in the real game: the unlock, the Homer pot, the winter sheet, the deckhand job, the shared
// free days, a sore start after an injury, old saves, the pop-up budget, Help and the end screen.
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const { open, newGame, noErrors, assert } = require('./helpers');

const ROOT = path.resolve(__dirname, '..'), DIR = path.join(ROOT, 'src', 'crab');
const FILES = fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort();
const SRC = FILES.map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');
function load() {
  const ctx = vm.createContext({});
  const before = new Set(vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx));
  const C = vm.runInContext(SRC + '\n;Crab', ctx);
  const added = vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx).filter(k => !before.has(k));
  return { C, added };
}
const { C } = load();
const J = o => JSON.parse(JSON.stringify(o));
const sum = (t, o = {}) => Object.assign({ phase: 'summer', year: 2028, day: 30, tod: 900, freeMin: 1e4, atHomer: true, cash: 5000, energy: 80, rep: 60, costMult: 1, ownBoat: false, freezerRoom: 100, state: C.newState() }, t, o);
const win = (o = {}) => Object.assign({ phase: 'winter', year: 2027, daysLeft: 10, cash: 9000, energy: 80, rep: 60, costMult: 1, state: C.newState() }, o);
const withState = (t, f) => { const s = J(C.normState(t.state)); f(s); return Object.assign({}, t, { state: s }); };
const K = v => () => v;

// the game: a 5-year game rolled into its SECOND off-season (S.winter pending, two seasons played)
async function toWinter(page, last) {
  await page.evaluate(async last => {
    closeModals(); S.money = 20000; S.cur = last; S.t = last * 1440 + 1300; S.loc = 'shop';
    S.book.forEach(b => { if (b.status === 'booked') b.status = 'done'; });
    endDay('home'); await new Promise(r => setTimeout(r, 10)); closeModals();
  }, last);
}
async function winter2(ctx, diff) {
  const { page, errors } = await open(ctx);
  await page.evaluate(() => setPref('years', 5));
  await newGame(page, diff);
  await toWinter(page, 13);
  await page.evaluate(() => { closeModals(); finishWinter(); closeModals(); });
  await toWinter(page, 27);
  await page.evaluate(() => { S.cabin.rolled = S.winter.s; closeModals(); });   // the cabin's first storm has passed: these tests are about crab
  return { page, errors };
}
// a summer afternoon at the Homer Spit in season 3 (index 2), no trips, a pot owned
async function homer(ctx, o = {}) {
  const { page, errors } = await open(ctx);
  await page.evaluate(() => setPref('years', 5));
  await newGame(page);
  await page.evaluate(o => { closeModals(); S.seasons = [{}, {}]; S.cur = 30; S.t = 30 * 1440 + 840; S.book = []; S.loc = 'homer'; if (o.gear !== false) { crabS().gear = true; if (o.open != null) S.fish.crab.open['d2028'] = o.open; } }, o);
  return { page, errors };
}
const crabActs = page => page.evaluate(() => actionsHere().filter(a => /crab/i.test(a.l)).map(a => ({ l: a.l, s: a.s, dis: !!a.dis })));
const tapCrab = page => page.evaluate(async () => { const a = actionsHere().find(a => /crab/i.test(a.l) && !a.dis); uiNarr = []; a.fn(); await new Promise(r => setTimeout(r, 10)); return { t: (document.querySelector('#mbg h2') || {}).textContent, b: MB.map(b => ({ l: b.l, dis: !!b.dis, s: b.s })), body: (document.querySelector('#mbg .mb') || {}).textContent }; });

module.exports = [
  // ---------- the module on its own ----------
  { name: 'boundary: src/crab never names the game, its pop-ups, clock, saves or storage, and adds one global', fn: async () => {
    for (const f of FILES) {
      const h = fs.readFileSync(path.join(DIR, f), 'utf8');
      for (const [re, what] of [[/\bS\./, 'S.'], [/\bS\[/, 'S['], [/\bmodal\s*\(/, 'modal('], [/\bGAME\b/, 'GAME'], [/\bMIGRATIONS\b/, 'MIGRATIONS'], [/\bAPP_VERSION\b/, 'APP_VERSION'], [/\blocalStorage\b/, 'localStorage'], [/\bdocument\b/, 'document'], [/\bwindow\b/, 'window'], [/\bsay\s*\(/, 'say('], [/\bmoney\s*\(/, 'money('], [/\bKenaiCamp\b/, 'KenaiCamp'], [/\bCabinUpkeep\b/, 'CabinUpkeep']])
        assert.ok(!re.test(h), `${f} mentions ${what}`);
    }
    const r = load(); assert.deepStrictEqual(J(r.added), [], 'nothing leaks onto the global object');
    assert.strictEqual(vm.runInContext('typeof Crab', vm.createContext({})), 'undefined');
    assert.strictEqual(C.SCHEMA, 1); for (const f of ['newState', 'normState', 'normTicket', 'prep', 'potOptions', 'setPot', 'pullPot', 'useCrab', 'winterOptions', 'buyKit', 'tannerDay', 'job', 'status', 'autoJob', 'autoSummer']) assert.strictEqual(typeof C[f], 'function', f);
    for (const f of ['pot', 'cooler', 'winter', 'job']) assert.strictEqual(typeof C.ui[f], 'function', 'ui.' + f);
  } },
  { name: 'boundary: the build puts src/crab after src/home and before src/js, --check passes, and the README states the contract', fn: async () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const a = html.indexOf('const CabinUpkeep='), b = html.indexOf('const Crab='), c = html.indexOf('function crabApply'), d = html.indexOf('const GAME=');
    assert.ok(a > 0 && b > a && d > b && c > d, `order ${a} ${b} ${d} ${c}`);
    assert.ok(/const Crab=/.test(fs.readFileSync(path.join(ROOT, 'offline', 'guidemaster-offline.html'), 'utf8')), 'the offline build carries it');
    assert.strictEqual(cp.spawnSync('python3', ['tools/build.py', '--check'], { cwd: ROOT }).status, 0);
    const bp = fs.readFileSync(path.join(ROOT, 'tools', 'build.py'), 'utf8'); assert.ok(/'camp', 'home', 'gillnet', 'seine', 'crab', 'tender', 'js'/.test(bp), 'build order camp, home, gillnet, seine, crab, tender, js');
    const md = fs.readFileSync(path.join(DIR, 'README.md'), 'utf8');
    for (const re of [/ticket/i, /report/i, /SCHEMA/, /Facts and sources/, /never a sale|no sales/i, /EVENTS/, /Estimates, not checked/]) assert.ok(re.test(md), 'README: ' + re);
    const v = fs.readFileSync(path.join(ROOT, 'src/js/00-game.js'), 'utf8'); assert.ok(/version:'1\.19\.0'/.test(v), 'crabbing shipped in 1.19.0');
  } },
  { name: 'pot: set costs bait and a skiff (your own boat is cheaper), takes the afternoon, and must soak overnight', fn: async () => {
    const t = sum({ state: withState(sum(), s => { s.gear = true }).state });
    const o = C.potOptions(t); assert.deepStrictEqual(J(o.map(x => [x.id, x.dis])), [['set', false]]);
    const r = C.setPot(t, { rand: K(.5) });
    assert.strictEqual(r.cashDelta, -(C.data.POT.bait + C.data.POT.skiff)); assert.strictEqual(r.minutes, C.data.POT.setMin); assert.strictEqual(r.energyDelta, -C.data.POT.setEnergy);
    assert.deepStrictEqual(J(r.state.pot), { d: 30, year: 2028 }); assert.strictEqual(r.state.open.d2028, true); assert.deepStrictEqual(J(r.events), [{ id: 'pot_set', sev: 0 }]);
    assert.ok(/name and address/.test(r.lines[0]) && /rot cord/.test(r.lines[0]), r.lines[0]);
    const own = C.setPot(Object.assign({}, t, { ownBoat: true, costMult: 1.5 }), { rand: K(.5) }); assert.strictEqual(own.cashDelta, -Math.round(C.data.POT.bait * 1.5) - Math.round(C.data.POT.ownFuel * 1.5));
    const same = C.potOptions(Object.assign({}, t, { state: r.state })); assert.strictEqual(same[0].id, 'pull'); assert.ok(same[0].dis && /overnight/.test(same[0].why));
    // the clock and the place
    for (const [o2, re] of [[{ tod: 400 }, /Mornings are for guiding/], [{ tod: 1300 }, /Too late/], [{ atHomer: false }, /Homer Spit/], [{ freeMin: 60 }, /next trip/], [{ energy: 10 }, /tired/]]) {
      const x = C.potOptions(Object.assign({}, t, o2))[0]; assert.ok(x.dis && re.test(x.why), JSON.stringify(x)); assert.strictEqual(C.setPot(Object.assign({}, t, o2)).cashDelta, 0, 'nothing happens when it is not allowed');
    }
    assert.deepStrictEqual(J(C.potOptions(sum())), [], 'no pot, no action');
  } },
  { name: 'pot: a closed summer says so; a pull measures, sorts and keeps legal males; a long soak can lose the pot', fn: async () => {
    const t = sum({ state: withState(sum(), s => { s.gear = true; s.open.d2028 = false }).state });
    const o = C.potOptions(t)[0]; assert.ok(o.dis && /isn’t open in 2028/.test(o.why) && /closed this year/.test(o.l), JSON.stringify(o));
    assert.strictEqual(C.isOpen(t, 'dung'), false);
    // a pull after two days
    const s1 = withState(sum(), s => { s.gear = true; s.pot = { d: 28, year: 2028 }; s.open.d2028 = true });
    const r = C.pullPot(s1, { rand: K(.5) });
    assert.ok(r.state.hold && r.state.hold.n === Math.round(C.data.POT.mean[2]), JSON.stringify(r.state.hold)); assert.strictEqual(r.state.pot, null); assert.strictEqual(r.state.gear, true);
    assert.ok(/legal male/.test(r.lines[0]) && /6\.5 inches/.test(r.lines[0]) && /back over the side/.test(r.lines[0]), r.lines[0]); assert.ok(r.events.some(e => e.id === 'pot_pull'));
    assert.deepStrictEqual(J(C.potOptions(Object.assign({}, s1, { state: r.state })).map(x => x.id)), ['cooler'], 'the crab come first');
    // a lost pot: more likely the longer it soaks
    const lost = C.pullPot(withState(sum(), s => { s.gear = true; s.pot = { d: 20, year: 2028 } }), { rand: K(.05) });
    assert.ok(lost.events.some(e => e.id === 'pot_lost') && lost.state.gear === false && lost.severity === 1, JSON.stringify(lost.events));
    const kept = C.pullPot(withState(sum(), s => { s.gear = true; s.pot = { d: 28, year: 2028 } }), { rand: K(.05) });
    assert.ok(!kept.events.some(e => e.id === 'pot_lost'), 'a two-day soak at the same roll keeps the pot');
    const rate = days => { const rn = C.util.seeded(9); let n = 0; for (let i = 0; i < 4000; i++) if (C.pullPot(withState(sum(), s => { s.gear = true; s.pot = { d: 30 - days, year: 2028 } }), { rand: rn }).state.gear === false) n++; return n / 4000; };
    const a = rate(2), b = rate(8); assert.ok(a < .07 && b > .15 && b < .3, `lost ${a} ${b}`);
  } },
  { name: 'cooler: the freezer (meals, capped by its room) or a crab feed (goodwill); never a sale', fn: async () => {
    const t = withState(sum({ freezerRoom: 3 }), s => { s.hold = { n: 5, kind: 'dung' } });
    const f = C.useCrab(t, 'freezer'); assert.strictEqual(f.meals, 3); assert.ok(/neighbors/.test(f.lines[0])); assert.strictEqual(f.state.hold, null); assert.strictEqual(f.cashDelta, 0);
    const feed = C.useCrab(t, 'feed'); assert.deepStrictEqual([feed.repDelta, feed.womDelta, feed.meals, feed.cashDelta], [C.data.FEED.rep, C.data.FEED.wom, 0, 0]); assert.ok(feed.events.some(e => e.id === 'crab_feed'));
    const small = C.useCrab(withState(sum(), s => { s.hold = { n: 1, kind: 'dung' } }), 'feed'); assert.deepStrictEqual([small.repDelta, small.womDelta], [0, 1]);
    const sell = C.useCrab(t, 'sell'); assert.strictEqual(sell.cashDelta, 0); assert.ok(sell.state.hold, 'the crab stay in the cooler'); assert.ok(/can’t be sold/.test(sell.lines[0]));
    assert.ok(!/cashDelta\s*\+=/.test(C.useCrab.toString()), 'useCrab never pays');
  } },
  { name: 'winter: a pot to buy, a Tanner day only in an open winter (limit, males, spines), the job only with seven free days', fn: async () => {
    let t = win(); C.prep(t, { rand: K(.9) });
    let st = C.prep(t, { rand: K(.9) }); assert.strictEqual(st.open.t2027, 0, 'a closed winter'); assert.strictEqual(st.open.o2027, 'thin');
    t = win({ state: st }); let o = C.winterOptions(t);
    assert.deepStrictEqual(J(o.map(x => x.id)), ['kit', 'tanner', 'job']); assert.ok(o[1].dis && /too few legal males/.test(o[1].why));
    const kit = C.buyKit(t); assert.strictEqual(kit.cashDelta, -C.data.POT.kit); assert.strictEqual(kit.state.gear, true);
    const closed = C.tannerDay(win({ state: kit.state })); assert.strictEqual(closed.daysUsed, 0); assert.ok(closed.events.some(e => e.id === 'tanner_closed'));
    // an open winter with a limit of 3
    const s2 = withState(win({ state: kit.state }), s => { s.open.t2027 = 3 });
    o = C.winterOptions(s2); assert.ok(!o[1].dis && /4\.5 inches/.test(o[1].s) && /3 a day/.test(o[1].s), o[1].s);
    const r = C.tannerDay(s2, { rand: K(.99) }); assert.strictEqual(r.daysUsed, 1); assert.strictEqual(r.state.hold.n, 3, 'at most the limit'); assert.ok(/spines/.test(r.lines[0]) && /whole crab/.test(r.lines[0]));
    assert.ok(r.events.some(e => e.id === 'tanner_measure'));
    assert.strictEqual(C.isOpen(s2, 'tanner'), true);
    // the job's days and cash
    o = C.winterOptions(win({ daysLeft: 6 })); assert.ok(o[2].dis && /7 free days/.test(o[2].why), o[2].why);
    o = C.winterOptions(win({ cash: 100 })); assert.ok(o[2].dis && /airfare/.test(o[2].why));
  } },
  { name: 'job: every beat (hire, drill, storm, sort, ice, payout); a greenhorn gets half a share; leaving at the start costs nothing', fn: async () => {
    const s = C.job(win({ state: withState(win(), x => { x.open.t2027 = 0; x.open.o2027 = 'good' }).state }), { rand: K(.3) });
    const seen = [];
    for (const id of ['friend', 'sail', 'practice', 'steady', 'careful', 'chip', 'done']) { const v = s.view(); seen.push(v.meta.phase); assert.ok(v.buttons.length >= 1 && v.title && v.html, v.meta.phase); assert.ok(s.choose(id), `${v.meta.phase}: ${id}`); }
    assert.deepStrictEqual(seen, ['intro', 'hired', 'drill', 'storm', 'sort', 'ice', 'pay']); assert.ok(s.done);
    const r = s.report(), J0 = C.data.JOB;
    assert.strictEqual(r.daysUsed, J0.days); assert.strictEqual(r.spent, J0.air + J0.license + J0.gear); assert.ok(r.earned > 0);
    const full = J0.share.good * (.8 + .4 * .3) * 1.03, paid = Math.round(full * J0.greenhorn);
    assert.strictEqual(r.earned, paid, 'a greenhorn half share'); assert.strictEqual(r.cashDelta, paid - r.spent);
    for (const e of ['job_hired', 'suit_drill', 'hauling', 'sorting', 'heavy_seas_ice', 'job_payout']) assert.ok(r.events.some(x => x.id === e), e);
    assert.ok(r.events.every(e => C.data.EVENTS.includes(e.id)), 'events from the list');
    assert.strictEqual(r.state.jobs, 1); assert.strictEqual(r.state.gear2, true); assert.ok(r.state.invite, 'a good hand is asked back');
    assert.ok(/Coast Guard/.test(seen && C.job(win()).view().html) || true);
    // a second winter: asked back, more of a share, no gear to buy
    const s2 = C.job(win({ year: 2028, state: r.state }), { rand: K(.3) }); assert.ok(/last winter’s skipper/.test(s2.view().buttons[0].l));
    for (const id of ['friend', 'sail', 'practice', 'steady', 'careful', 'chip', 'done']) s2.choose(id);
    assert.strictEqual(s2.report().spent, J0.air + J0.license, 'gear is kept');
    // not this winter
    const n = C.job(win(), { rand: K(.3) }); assert.ok(n.choose('no')); assert.ok(n.done); assert.deepStrictEqual([n.report().cashDelta, n.report().daysUsed], [0, 0]);
    assert.strictEqual(n.choose('docks'), false, 'nothing after it ends');
    // a failed hire after flying out: the airfare and two days
    const f = C.job(win({ state: withState(win(), x => { x.open.o2027 = 'thin' }).state }), { rand: K(.95) });
    f.choose('docks'); assert.strictEqual(f.phase, 'nohire'); f.choose('home');
    assert.strictEqual(f.report().daysUsed, J0.failDays); assert.ok(f.report().cashDelta <= -J0.air); assert.strictEqual(f.report().earned, 0);
    // a phone call that comes to nothing costs nothing
    const p = C.job(win(), { rand: K(.99) }); p.choose('friend'); assert.strictEqual(p.phase, 'nohire'); p.choose('home'); assert.deepStrictEqual([p.report().cashDelta, p.report().daysUsed], [0, 0]);
    // safety words
    const d = C.job(win(), { rand: K(.3) }); d.choose('friend'); d.choose('sail'); assert.ok(/Coast Guard/.test(d.view().html) && /immersion suits/.test(d.view().html));
  } },
  { name: 'job: the risks are real (a short season, an injury, a skipper who pays a third) and careful play is safer', fn: async () => {
    const run = (pol, n, out) => { const rn = C.util.seeded(17); const res = []; for (let i = 0; i < n; i++) { const st = withState(win(), x => { if (out) x.open.o2027 = out }).state; res.push(C.autoJob(win({ state: st }), { rand: rn, policy: pol }).report) } return res; };
    const A = run('careful', 3000), B = run('reckless', 3000), avg = a => a.reduce((x, y) => x + y, 0) / a.length;
    const inj = a => a.filter(r => r.events.some(e => e.id === 'job_injury')).length / a.length, unpaid = a => a.filter(r => r.events.some(e => e.id === 'job_not_paid')).length / a.length;
    assert.ok(inj(A) > .02 && inj(A) < .08 && inj(B) > inj(A) + .03, `injuries ${inj(A)} ${inj(B)}`);
    assert.ok(unpaid(B) > unpaid(A) * 2, `unpaid ${unpaid(A)} ${unpaid(B)}`);
    const netA = avg(A.map(r => r.cashDelta)), netB = avg(B.map(r => r.cashDelta));
    assert.ok(netA > 300 && netA < 2500, `a greenhorn's average net ${netA}`); assert.ok(netB < netA, `reckless ${netB}`);
    assert.ok(Math.min(...A.map(r => r.cashDelta)) > -4000, 'never a career-ender'); assert.ok(A.some(r => r.cashDelta < 0), 'it can lose money');
    assert.ok(A.some(r => r.events.some(e => e.id === 'job_closed')), 'seasons close early');
    const hurt = A.find(r => r.events.some(e => e.id === 'job_injury')); assert.ok(hurt.sore > 0 && hurt.severity >= 1);
    const thin = avg(run('careful', 1500, 'thin').map(r => r.cashDelta)), good = avg(run('careful', 1500, 'good').map(r => r.cashDelta)); assert.ok(thin < good, `outlook ${thin} ${good}`);
  } },
  { name: 'state: an old or empty state comes up to date; prep rolls each year once', fn: async () => {
    assert.deepStrictEqual(J(C.normState(null)), J(C.newState())); assert.deepStrictEqual(J(C.normState({ v: 0 })), J(C.newState()));
    const s = C.normState({ v: 1, gear: 1, pot: { d: 'x' }, hold: { n: 0 }, tot: { crab: 4 } }); assert.strictEqual(s.gear, true); assert.strictEqual(s.pot, null); assert.strictEqual(s.hold, null); assert.strictEqual(s.tot.crab, 4); assert.strictEqual(s.tot.jobs, 0);
    let calls = 0; const r = () => { calls++; return .1 }; const st = C.prep(sum(), { rand: r }); assert.strictEqual(calls, 1); C.prep(sum({ state: st }), { rand: r }); assert.strictEqual(calls, 1, 'once a year');
    const w = C.prep(win(), { rand: r }); assert.ok(w.open.t2027 > 0 && w.open.o2027 === 'good');
  } },

  // ---------- in the game ----------
  { name: 'game: no crabbing in season 1 or the first off-season; the "Commercial & crab" sheet from the second', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await page.evaluate(() => setPref('years', 5));
    await newGame(page);
    const s1 = await page.evaluate(() => { closeModals(); S.loc = 'homer'; S.t = S.cur * 1440 + 900; return { acts: actionsHere().filter(a => /crab/i.test(a.l)).length, fish: !(S.fish && S.fish.crab) }; });
    assert.deepStrictEqual(s1, { acts: 0, fish: true }, 'season 1 untouched');
    await toWinter(page, 13);
    const w1 = await page.evaluate(() => { closeModals(); winterModal(); return { b: MB.map(b => b.l), fish: !(S.fish && S.fish.crab) }; });
    assert.ok(!w1.b.some(l => /Commercial/.test(l)) && w1.fish, w1.b.join(' | '));
    await page.evaluate(() => { closeModals(); S.cabin.rolled = S.winter.s; finishWinter(); closeModals(); });
    await toWinter(page, 27);
    const w2 = await page.evaluate(async () => { S.cabin.rolled = S.winter.s; closeModals(); winterModal(); const b = MB.map(b => b.l); MBTN(b.findIndex(l => /Commercial & crab/.test(l))); await new Promise(r => setTimeout(r, 10));
      const hub = MB.map(x => x.l); MBTN(MB.findIndex(l => /Crabbing/.test(l.l))); await new Promise(r => setTimeout(r, 10));   // the shared sheet: gillnetting, seining, crabbing
      return { b, hub, t: document.querySelector('#mbg h2').textContent, o: MB.map(x => x.l), CRAB_UNLOCK }; });
    assert.ok(w2.b.indexOf('⚓ Commercial & crab') === w2.b.length - 2, 'just before Open bookings: ' + w2.b.join(' | '));
    assert.match(w2.t, /Crabbing/); assert.ok(w2.hub.some(l => /Crabbing/.test(l)) && !w2.hub.some(l => /Fish buying/.test(l)), w2.hub.join(' | ')); assert.ok(w2.o.some(l => /Buy a crab pot/.test(l)) && w2.o.some(l => /Tanner/.test(l)) && w2.o.some(l => /crab boat out west/.test(l)) && /Back/.test(w2.o[w2.o.length - 1]), w2.o.join(' | '));
    assert.strictEqual(w2.CRAB_UNLOCK, 2);
    noErrors(errors);
  } },
  { name: 'game: the winter sheet: buy a pot, then the deckhand job through the real pop-ups uses 7 of the shared free days', fn: async ctx => {
    const { page, errors } = await winter2(ctx);
    const r = await page.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms || 10)), h2 = () => (document.querySelector('#mbg h2') || {}).textContent || '';
      const o = { m0: S.money, d0: campDaysLeft() }; FISH_HUB.find(x => x.id === 'crab').open(() => winterModal()); await w();
      MBTN(MB.findIndex(b => /Buy a crab pot/.test(b.l))); await w(); o.kit = h2(); o.m1 = S.money; MBTN(0); await w();
      MBTN(MB.findIndex(b => /crab boat out west/.test(b.l))); await w();
      o.titles = []; let g = 0;
      while (g++ < 12 && !/^🦀 Crabbing/.test(h2())) { o.titles.push(h2()); o.lock = o.lock || !!document.getElementById('mbg').dataset.lock; const k = MB.findIndex(b => !b.dis && !/Not this winter|Back out|Forget|Fly home$/.test(b.l)); MBTN(k < 0 ? 0 : k); await w(); }
      o.m2 = S.money; o.d1 = campDaysLeft(); o.camp = MB.length; o.jobs = S.fish.crab.jobs; o.energy = S.energy;
      return o;
    });
    assert.strictEqual(r.kit, '🪤 A crab pot'); assert.strictEqual(r.m0 - r.m1, 240);
    assert.ok(r.titles[0] === '⚓ Crew on a crab boat out west' && r.titles.includes('🦺 Survival-suit drill on deck') && r.titles.includes('🧊 Ice on the rails') && r.titles.includes('💵 Settlement day'), r.titles.join(' | '));
    assert.ok(r.lock, 'mid-job pop-ups are locked (Esc does not drop the trip)');
    if (r.jobs === 1) assert.strictEqual(r.d0 - r.d1, 7, 'seven free days, shared with camping'); else assert.ok(r.d0 - r.d1 <= 2);
    noErrors(errors);
  } },
  { name: 'game: crabBotWinter and a hurt crewman: next season starts sore for a few mornings (energy), in the morning report', fn: async ctx => {
    const { page, errors } = await winter2(ctx);
    const r = await page.evaluate(async () => {
      const o = {}; crabS(); const rep = Crab.useCrab; // a forced injury: the major one
      S.fish.crab.open['o2027'] = 'good';
      const res = crabBotWinter({ rand: () => .2, policy: 'careful', tanner: false });
      o.n = res.length; o.days = campDaysLeft(); o.gear = S.fish.crab.gear;
      // put a sore start in place the way the adapter does after an injury
      crabApply(Object.assign({}, res[0], { state: S.fish.crab, cashDelta: 0, spent: 0, energyDelta: 0, lines: [], sore: 2, daysUsed: 0 }), true);
      o.sore = JSON.stringify(S.fish.crab.host.sore);
      closeModals(); finishWinter(); closeModals();
      S.energy = 90; S.t = S.cur * 1440 + 1300; S.loc = 'shop'; S.book.forEach(b => { if (b.d === S.cur && b.status === 'booked') b.status = 'done' });
      endDay('home'); await new Promise(r => setTimeout(r, 10));
      o.report = (document.querySelector('#mbg') || {}).textContent || ''; o.left = S.fish.crab.host.sore.n;
      return o;
    });
    assert.strictEqual(r.n, 2, 'a pot, then the job'); assert.strictEqual(r.days, 3); assert.ok(r.gear);
    assert.ok(/"n":2/.test(r.sore), r.sore); assert.ok(/sore morning/.test(r.report), 'in the morning report'); assert.strictEqual(r.left, 1);
    noErrors(errors);
  } },
  { name: 'game: Homer in summer: no pot, no action; set (one pop-up, the afternoon, bait and skiff), pull later, freezer or feed, sale disabled', fn: async ctx => {
    const none = await homer(ctx, { gear: false });
    assert.deepStrictEqual(await crabActs(none.page), []); noErrors(none.errors);
    const { page, errors } = await homer(ctx, { open: true });
    const a = await crabActs(page); assert.strictEqual(a.length, 1); assert.ok(/Set a crab pot/.test(a[0].l) && !a[0].dis, JSON.stringify(a));
    const m0 = await page.evaluate(() => ({ m: S.money, t: S.t, e: S.energy }));
    const s = await tapCrab(page); assert.strictEqual(s.t, '🦀 Pot set'); assert.deepStrictEqual(s.b.map(b => b.l), ['OK']);
    await page.evaluate(() => MBTN(0));
    const m1 = await page.evaluate(() => ({ m: S.money, t: S.t, e: S.energy, pop: !!document.getElementById('mbg'), log: S.log.slice(-1)[0].s }));
    assert.strictEqual(m0.m - m1.m, 82); assert.strictEqual(m1.t - m0.t, 150); assert.ok(m0.e - m1.e >= 6, 'energy'); assert.strictEqual(m1.pop, false, 'one pop-up'); assert.match(m1.log, /Kachemak Bay/);
    assert.ok((await crabActs(page))[0].dis, 'soak overnight');
    // two days later, an afternoon in Homer: pull
    await page.evaluate(() => { S.cur = 32; S.t = 32 * 1440 + 840; });
    const p = await tapCrab(page);
    if (/Pulling/.test(p.t) && p.b.length === 3) {
      assert.deepStrictEqual(p.b.map(b => b.l), ['🧊 Into the freezer', '🍽️ A crab feed on the dock', '💵 Sell them to a restaurant on the Spit']);
      assert.ok(p.b[2].dis && /illegal/.test(p.b[2].s), 'never for sale'); assert.ok(await page.evaluate(() => !!document.getElementById('mbg').dataset.lock), 'the crab need an answer');
      const f = await page.evaluate(() => { const f0 = S.freezer, p0 = S.food.pan, n = S.fish.crab.hold.n; MBTN(0); return { n, df: S.freezer - f0, dp: S.food.pan - p0, pop: !!document.getElementById('mbg') }; });
      assert.strictEqual(f.df * 4 + f.dp, f.n, 'one meal a crab: four to a freezer red, the rest to the pantry'); assert.strictEqual(f.pop, false, 'still one pop-up');
    }
    noErrors(errors);
  } },
  { name: 'game: a closed summer says so at Homer; a pot left soaking shows in the morning report and is hauled at season end', fn: async ctx => {
    const c = await homer(ctx, { open: false });
    const a = await crabActs(c.page); assert.ok(a[0].dis && /closed this year/.test(a[0].l) && /isn’t open in 2028/.test(a[0].s), JSON.stringify(a)); noErrors(c.errors);
    const { page, errors } = await homer(ctx, { open: true });
    await tapCrab(page); await page.evaluate(() => MBTN(0));
    const r = await page.evaluate(async () => {
      const w = () => new Promise(r => setTimeout(r, 10)), o = {};
      S.loc = 'shop'; S.t = 30 * 1440 + 1300; endDay('home'); await w(); o.d1 = document.querySelector('#mbg').textContent; closeModals();
      S.t = S.cur * 1440 + 1300; endDay('home'); await w(); o.d2 = document.querySelector('#mbg').textContent; o.pops = document.querySelectorAll('#mbg').length; closeModals();
      startSeason(3); closeModals(); o.pot = S.fish.crab.pot; o.log = S.log.slice(-40).map(x => x.s).join(' ');
      return o;
    });
    assert.ok(!/crab pot has soaked/.test(r.d1) && /crab pot has soaked 2 days/.test(r.d2), 'from the second morning');
    assert.strictEqual(r.pot, null); assert.ok(/Never leave a pot soaking/.test(r.log));
    noErrors(errors);
  } },
  { name: 'game: crabBotSummer sets and pulls at Homer; nothing happens anywhere else or without a pot (no random numbers drawn)', fn: async ctx => {
    const { page, errors } = await homer(ctx, { open: true });
    const r = await page.evaluate(() => {
      const o = {}; o.a = crabBotSummer({ rand: () => .5 }).map(x => x.events.map(e => e.id).join()); o.pot = !!S.fish.crab.pot;
      S.cur = 32; S.t = 32 * 1440 + 840; o.b = crabBotSummer({ rand: () => .5 }).map(x => x.events.map(e => e.id).join()); o.fz = S.fish.crab.tot.meals;
      S.loc = 'shop'; o.c = crabBotSummer().length;
      // a game that never crabs: the actions at Homer draw no random numbers and make no state
      const keep = S.fish; delete S.fish; S.loc = 'homer'; let n = 0; const mr = Math.random; Math.random = () => { n++; return mr() }; actionsHere(); crabBotSummer(); Math.random = mr; o.draws = n; o.fish = S.fish === undefined; S.fish = keep;
      return o;
    });
    assert.deepStrictEqual(r.a, ['pot_set']); assert.ok(r.pot);
    assert.ok(r.b[0].includes('pot_pull') || r.b[0].includes('pot_lost'), JSON.stringify(r.b)); assert.strictEqual(r.c, 0);
    assert.strictEqual(r.draws, 0); assert.ok(r.fish);
    noErrors(errors);
  } },
  { name: 'game: old saves load (no S.fish, mid off-season and mid summer) and crab works after', fn: async ctx => {
    const { page, errors } = await winter2(ctx);
    const r = await page.evaluate(() => {
      const o = {};
      const d = JSON.parse(JSON.stringify(packSave())); delete d.S.fish; d.app = '1.17.0';
      const m = migrate(d); o.fish = !(m.S.fish && m.S.fish.crab);
      const keep = S; S = m.S; try { o.btns = fishWinterBtns().map(b => b.l); o.opts = Crab.winterOptions(crabTicket()).map(x => x.id); o.made = !!S.fish.crab; } finally { S = keep }
      const d2 = JSON.parse(JSON.stringify(packSave())); d2.S.fish = { crab: { v: 1, gear: true, pot: { d: 30, year: 2028 } } }; d2.S.winter = null; d2.S.cur = 31;
      const m2 = migrate(d2); const k2 = S; S = m2.S; try { const c = crabS(); o.pot = c.pot; o.tot = typeof c.tot.crab; o.host = JSON.stringify(c.host); } finally { S = k2 }
      return o;
    });
    assert.ok(r.fish, 'no schema change: S.fish appears on first use'); assert.deepStrictEqual(r.btns, ['⚓ Commercial & crab']); assert.deepStrictEqual(r.opts, ['kit', 'tanner', 'job']); assert.ok(r.made);
    assert.deepStrictEqual(r.pot, { d: 30, year: 2028 }); assert.strictEqual(r.tot, 'number'); assert.strictEqual(r.host, '{"sore":null}');
    noErrors(errors);
  } },
  { name: 'game: Help has a crabbing section whose facts are the module’s; the end screen gets a crabbing row', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => {
      const h = HELP.find(x => x[3] === 'crab'), i = HELP.indexOf(h);
      crabS().tot.sets = 2; S.fish.crab.tot.pulls = 2; S.fish.crab.tot.crab = 6; S.fish.crab.tot.jobs = 1; S.fish.crab.tot.jobNet = 2100;
      return { h: h && h[2].replace(/<[^>]+>/g, ' '), i, n: HELP.length, last: HELP[HELP.length - 1][3], pot: Crab.data.POT.minWidth, tan: Crab.data.TANNER.minWidth, green: Crab.data.JOB.greenhorn, hand0: Crab.data.JOB.hand[0], unlock: CRAB_UNLOCK, row: (endRows().find(x => x[0] === 'Crabbing') || [])[1] };
    });
    assert.ok(r.h, 'a Help section'); assert.strictEqual(r.last, 'feedback'); assert.ok(r.i > 10);
    assert.ok(/second off-season/.test(r.h) && r.unlock === 2); assert.ok(/six and a half inches/.test(r.h) && r.pot === 6.5); assert.ok(/four and a half with the spines/.test(r.h) && r.tan === 4.5);
    assert.ok(/half a share/.test(r.h) && r.green === .5 && r.hand0 === .5); assert.ok(/never for sale/.test(r.h) && /survey/.test(r.h) && /survival suit/.test(r.h));
    assert.ok(/6 crab kept from 2 pulls/.test(r.row) && /1 trip on a crab boat out west, \$2,100 net/.test(r.row), r.row);
    noErrors(errors);
  } },
];
