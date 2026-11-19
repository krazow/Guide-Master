// Fish buying & processing (src/tender/, the Tender module; src/js/45-tender.js, the Guide Master adapter).
// The first half runs the module on its own in Node, in an empty `vm` context, with no browser and no Guide Master;
// the second half plays the adapter in the real game.
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const { open, newGame, noErrors, assert } = require('./helpers');

const ROOT = path.resolve(__dirname, '..'), DIR = path.join(ROOT, 'src', 'tender');
const FILES = fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort();
const SRC = FILES.map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');
function load() {
  const ctx = vm.createContext({});
  const before = new Set(vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx));
  const T = vm.runInContext(SRC + '\n;Tender', ctx);
  const added = vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx).filter(k => !before.has(k));
  return { T, added };
}
const { T } = load(), D = T.data, K = D.K;
const J = o => JSON.parse(JSON.stringify(o));
const seeded = s => T.util.seeded(s);
const thrower = () => { throw new Error('drew a random number') };
// a ticket; run: an average Upper Cook Inlet season with the kings closed
const tk = (o = {}) => Object.assign({ state: T.newState(7), phase: 'winter', s: 4, year: 2030, cash: 1000000, rep: 70, energy: 80, costMult: 1, diesel: 5, daysLeft: 10, seasonsLeft: 6, md: 0, run: { sockeye: 1, coho: 1, pinkEven: true, king: 'closed' } }, o);
function act(t, id, arg) { const r = T.act(t, id, arg); assert.ok(!r.refused, `${id}: ${r.refused}`); return Object.assign({}, t, { state: r.state, cash: t.cash + r.cashDelta }) }
// a business with a tender (and optionally a plant) in Upper Cook Inlet, its season open
function open0(o = {}) {
  let t = tk(o.t || {});
  t.state.yrs = o.yrs == null ? 3 : o.yrs;
  t = act(t, o.lease ? 'lease' : 'buyT', { area: 'uci' });
  if (o.plant) { t = act(t, o.plant, { area: o.parea || 'uci' }); t = act(t, 'crew', { lvl: 'full' }); if (o.mix) t = act(t, 'mix', { mix: o.mix }) }
  const r = T.openSeason(Object.assign({}, t, { phase: 'summer' }), { rand: seeded(1) });
  return Object.assign({}, t, { state: r.state, phase: 'summer', cash: t.cash + r.cashDelta });
}
const firstOpener = t => t.state.season.cal.uci.find(md => md >= 710);

module.exports = [
  // ---------- the module on its own ----------
  { name: 'boundary: src/tender never names the game, its pop-ups, clock, saves or storage, and adds one global', fn: async () => {
    for (const f of FILES) {
      const h = fs.readFileSync(path.join(DIR, f), 'utf8');
      for (const [re, what] of [[/\bS\./, 'S.'], [/\bS\[/, 'S['], [/\bmodal\s*\(/, 'modal('], [/\bGAME\b/, 'GAME'], [/\bMIGRATIONS\b/, 'MIGRATIONS'], [/\bAPP_VERSION\b/, 'APP_VERSION'], [/\blocalStorage\b/, 'localStorage'], [/\bdocument\b/, 'document'], [/\bwindow\b/, 'window'], [/\bsay\s*\(/, 'say('], [/\bmoney\s*\(/, 'money('], [/\bREG\s*\(/, 'REG(']])
        assert.ok(!re.test(h), `${f} mentions ${what}`);
    }
    const r = load(); assert.deepStrictEqual(J(r.added), [], 'nothing leaks onto the global object');
    assert.strictEqual(vm.runInContext('typeof Tender', vm.createContext({})), 'undefined');
    assert.strictEqual(T.SCHEMA, 1); assert.ok(T.FLOOR > 0);
    for (const k of ['newState', 'normState', 'normTicket', 'act', 'why', 'openSeason', 'opener', 'route', 'closeSeason', 'estimate', 'value', 'debt', 'forecast', 'calendar', 'autoplay']) assert.strictEqual(typeof T[k], 'function', k);
    for (const k of ['planner', 'opener', 'tab', 'report']) assert.strictEqual(typeof T.ui[k], 'function', 'ui.' + k);
  } },
  { name: 'boundary: the build puts src/tender after the other modules and before src/js, --check passes; the README states the contract', fn: async () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const a = html.indexOf('const KenaiCamp='), b = html.indexOf('const CabinUpkeep='), c = html.indexOf('const Tender='), d = html.indexOf('function tenderApply');
    assert.ok(a > 0 && b > a && c > b && d > c, `order ${a} ${b} ${c} ${d}`);
    assert.ok(/const Tender=/.test(fs.readFileSync(path.join(ROOT, 'offline', 'guidemaster-offline.html'), 'utf8')));
    assert.strictEqual(cp.spawnSync('python3', ['tools/build.py', '--check'], { cwd: ROOT }).status, 0);
    assert.match(fs.readFileSync(path.join(ROOT, 'tools/build.py'), 'utf8'), /\('camp', 'home', 'tender', 'js'\)/);
    const md = fs.readFileSync(path.join(DIR, 'README.md'), 'utf8');
    assert.ok(/ticket/i.test(md) && /report/i.test(md) && /SCHEMA/.test(md) && /Facts and estimates/.test(md) && /never ends a career/i.test(md) && /tenderRoute/.test(md) && /delivery/.test(md));
  } },
  { name: 'state and ticket: a fresh state, an old or broken state filled in, defaults for a bare ticket; nothing happens (no random draw) without a business', fn: async () => {
    const s = T.newState(3); assert.deepStrictEqual([s.tenders.length, s.plant, s.loan, s.brep, s.maint], [0, null, null, 50, 'basic']);
    const n = T.normState({ seed: 3, tenders: 'x', tot: { lbs: 5 } }); assert.ok(Array.isArray(n.tenders) && n.tot.lbs === 5 && n.tot.net === 0 && n.policy.offset === 0);
    assert.strictEqual(T.normState(null).v, 1);
    const t = T.normTicket({}); assert.strictEqual(t.floor, T.FLOOR); assert.strictEqual(t.run.king, 'closed');
    // inactive: the season hooks change nothing and never ask for a random number
    const o = T.openSeason(tk(), { rand: thrower }); assert.strictEqual(o.cashDelta, 0); assert.strictEqual(o.state.season, null);
    const c = T.closeSeason(tk({ s: 5 }), { rand: thrower }); assert.strictEqual(c.cashDelta, 0);
    assert.strictEqual(T.opener(tk({ phase: 'summer', md: 716 }), {}, { rand: thrower }).none, true);
    assert.strictEqual(T.estimate(tk()), 0); assert.strictEqual(T.value(s), 0); assert.strictEqual(T.debt(s), 0);
  } },
  { name: 'markets: drawn from the save’s seed (the same every look), a forecast that is right most winters, and going prices by level', fn: async () => {
    const st = T.newState(11);
    assert.deepStrictEqual(T.market(st, 5), T.market(st, 5), 'the same market every time');
    assert.deepStrictEqual(T.forecast(tk({ state: st, s: 5 })), T.forecast(tk({ state: st, s: 5 })));
    let right = 0, n = 300, weakPink = 0;
    for (let s = 0; s < n; s++) { const x = T.newState(1000 + s), m = T.market(x, 4), f = T.forecast(tk({ state: x, s: 4 })); if (f.lv.salmon === m.lv.salmon) right++; if (m.lv.pink === 0) weakPink++;
      for (const sp of ['sockeye', 'pink']) { const g = D.GOING[sp][m.lv[D.MKT_OF[sp]]]; assert.ok(Math.abs(m.going[sp] - g) <= g * .06, `${sp} ${m.going[sp]} near ${g}`) } }
    assert.ok(right / n > .6 && right / n < .85, `forecast right ${right}/${n}`);
    assert.ok(weakPink / n > .2 && weakPink / n < .4, `weak pink markets ${weakPink}/${n}`);
    assert.match(T.forecast(tk()).text, /salmon market/);
  } },
  { name: 'calendar: Upper Cook Inlet openers are Mondays and Thursdays from late June to mid-August (a midweek extra in a strong July); Homer seiners fish three days a week', fn: async () => {
    const dow = (y, md) => T.util.dowOf(y, md);
    const u = T.calendar(2030, 'uci', { sockeye: 1 });
    assert.ok(u.length >= 15 && u.length <= 18, u.length); assert.ok(u.every(md => [0, 3].includes(dow(2030, md)) && md >= 619 && md <= 815));
    const strong = T.calendar(2030, 'uci', { sockeye: 1.3 }); assert.ok(strong.length > u.length && strong.filter(md => dow(2030, md) === 2).every(md => md >= 710 && md <= 731));
    const l = T.calendar(2030, 'lci', {}); assert.ok(l.length > u.length && l.every(md => [0, 2, 4].includes(dow(2030, md))));
    assert.deepStrictEqual(J(T.calendar(2030, 'west', {})), []);
  } },
  { name: 'permits and ladder: a charter needs reputation and cash; buying needs more reputation, a bank loan 30% down; plants come after seasons of tendering', fn: async () => {
    const t = tk({ rep: 45 }); assert.match(T.why(t, 'lease', {}), /reputation/);
    assert.strictEqual(T.why(tk(), 'lease', {}), null);
    assert.match(T.why(tk({ cash: 20000 }), 'lease', {}), /afford/);
    assert.match(T.why(tk({ cash: T.price(tk(), 'lease') + 5000 }), 'lease', {}), /Keep \$10,000 for your guiding/, 'a charter must leave the guide’s working money');
    assert.match(T.why(tk({ rep: 52 }), 'buyT', { loan: true }), /reputation 55/);
    assert.match(T.why(tk({ cash: 90000 }), 'buyT', { loan: true }), /down/);
    assert.match(T.why(tk({ cash: 110000 }), 'buyT', { loan: true }), /Keep/, 'down payment plus the first season in the bank');
    assert.strictEqual(T.why(tk({ cash: 140000 }), 'buyT', { loan: true }), null);
    assert.match(T.why(tk(), 'space', {}), /Tender a season first/);
    const y1 = tk(); y1.state.yrs = 1; assert.strictEqual(T.why(y1, 'space', {}), null); assert.match(T.why(y1, 'shore', {}), /two seasons/);
    const y2 = tk(); y2.state.yrs = 2; assert.strictEqual(T.why(y2, 'shore', {}), null); assert.match(T.why(y2, 'floater', {}), /three seasons/);
    const y3 = tk({ rep: 60, cash: 3e6 }); y3.state.yrs = 3; assert.match(T.why(y3, 'floater', {}), /reputation 65/);
    assert.match(T.why(tk({ phase: 'summer' }), 'lease', {}), /off-season/);
    // two tenders at most; the loan: the bank lends the rest at 9% over 7 years
    let b = act(tk(), 'buyT', { area: 'uci', loan: true }); assert.strictEqual(b.state.loan.bal, Math.round(D.VESSELS.used.price * (1 - K.DOWN)));
    assert.strictEqual(b.cash, 1000000 - Math.round(D.VESSELS.used.price * K.DOWN)); assert.deepStrictEqual([b.state.loan.rate, b.state.loan.left], [K.RATE, K.TERM]);
    b = act(b, 'lease', { area: 'lci' }); assert.match(T.why(b, 'lease', {}), /2 tenders/);
    assert.strictEqual(T.value(b.state), D.VESSELS.used.price); assert.strictEqual(T.debt(b.state), b.state.loan.bal);
    // a credit ban after a forced sale
    const bad = tk(); bad.state.credit = 6; assert.match(T.why(bad, 'buyT', { loan: true }), /bank won/);
  } },
  { name: 'opener: the fleet’s catch follows the run and its timing; a better price draws more boats for less margin; bled fish earn more; a full hold turns boats away', fn: async () => {
    const t = open0(), md = firstOpener(t), day = (o, ch, seed = 5) => T.opener(Object.assign({}, t, { md }, o || {}), ch, { rand: seeded(seed) });
    const base = day({}, { offset: 0, self: true, wind: 8 });
    assert.ok(base.results[0].lbs > 10000, JSON.stringify(base.results[0]));
    assert.ok(base.lines[0].includes('You run') && /bought at/.test(base.lines[0]));
    assert.strictEqual(base.energyDelta, -K.SELF_ENERGY);
    const hi = day({}, { offset: .1, self: true, wind: 8 }), lo = day({}, { offset: -.05, self: true, wind: 8 });
    assert.ok(hi.results[0].lbs > base.results[0].lbs && base.results[0].lbs > lo.results[0].lbs, 'price draws boats');
    const perLb = r => r.results[0].net / r.results[0].lbs; assert.ok(perLb(hi) < perLb(base) && perLb(base) < perLb(lo), 'and costs margin');
    const weak = day({ run: { sockeye: .6, coho: 1, pinkEven: true, king: 'closed' } }, { offset: 0, self: true, wind: 8 });
    assert.ok(weak.results[0].lbs < base.results[0].lbs * .75, 'a weak run, fewer fish');
    const early = T.opener(Object.assign({}, t, { md: t.state.season.cal.uci[0] }), { self: true, wind: 8 }, { rand: seeded(5) });
    assert.ok(early.results[0].lbs < base.results[0].lbs, 'late June is early in the run');
    // the skipper costs a day's wage and you lose the quality you'd have watched for
    const sk = day({}, { offset: 0, self: false, wind: 8 }); assert.ok(sk.results[0].crew - base.results[0].crew === K.SKIPPER && sk.energyDelta === 0 && /skipper/.test(sk.lines[0]));
    // the day is marked done: no second opener today
    assert.strictEqual(T.openerToday(Object.assign({}, t, { md, state: base.state })), null);
    assert.ok(T.openerToday(Object.assign({}, t, { md: md + 1 })) === null, 'not an opener day');
    // a full hold
    const big = day({ run: { sockeye: 3, coho: 1, pinkEven: true, king: 'closed' } }, { offset: .2, self: true, wind: 8 }, 9);
    assert.ok(big.results[0].turned > 0 && /turn away/.test(big.lines[0]), JSON.stringify(big.results[0]));
  } },
  { name: 'quality and safety: bled fish earn the bonus; waiting for the tide and a run-down hold risk a rejected load; a blow keeps the fleet in and the survival suits get checked', fn: async () => {
    const t = open0(), md = firstOpener(t), n = 200;
    let rejNow = 0, rejTide = 0, q = { bled: 0, fast: 0 };
    for (let i = 0; i < n; i++) {
      const a = T.opener(Object.assign({}, t, { md }), { self: true, run: 'now', care: 'bled', wind: 8 }, { rand: seeded(100 + i) }).results[0];
      const b = T.opener(Object.assign({}, t, { md }), { self: true, run: 'tide', care: 'fast', wind: 8 }, { rand: seeded(100 + i) }).results[0];
      if (a.rej) rejNow++; if (b.rej) rejTide++; q.bled += a.qi; q.fast += b.qi;
    }
    assert.ok(rejTide > rejNow * 2, `rejected loads: tide ${rejTide}, now ${rejNow}`); assert.ok(q.bled > q.fast);
    const calm = T.opener(Object.assign({}, t, { md }), { self: true, wind: 8 }, { rand: seeded(3) }), blow = T.opener(Object.assign({}, t, { md }), { self: true, wind: 28 }, { rand: seeded(3) });
    assert.ok(blow.results[0].lbs < calm.results[0].lbs * .7 && blow.lines.some(l => /survival suit/.test(l) && /28 knots/.test(l)), blow.lines.join(' '));
    assert.ok(blow.energyDelta < calm.energyDelta, 'a rough day costs more energy');
    const buy = T.act(tk(), 'buyT', { area: 'uci' }); assert.match(buy.lines.join(' '), /Coast Guard dockside exam/);
  } },
  { name: 'money: a season settles the openers you didn’t play, the plant, the fall charter, depreciation and the loan payment; leases end with the season', fn: async () => {
    let t = open0({ plant: 'shore', mix: 'fresh' });
    const v0 = T.value(t.state), md = firstOpener(t);
    const op = T.opener(Object.assign({}, t, { md }), { self: true, wind: 8 }, { rand: seeded(2) }); t = Object.assign({}, t, { state: op.state });
    const c = T.closeSeason(Object.assign({}, t, { phase: 'winter', s: 5, cash: 400000 }), { rand: seeded(3) });
    const L = c.lines.join('\n').replace(/<[^>]+>/g, '');
    assert.match(L, /Tendering, 2030: 1[5-8] openers \(1 played\)/); assert.match(L, /Your plant in Kenai, 2030/); assert.match(L, /Loan payment|fall work/);
    assert.ok(c.state.season === null && c.state.yrs === 4 && c.state.hist.length === 1 && c.state.last.openers >= 15);
    assert.ok(T.value(c.state) < v0, 'boats and plants lose value');
    assert.ok(Number.isFinite(c.cashDelta) && c.state.tot.seasons === 1);
    // a charter and line space go back at the end of the season
    let l = open0({ lease: true, plant: 'space', yrs: 2 });
    const cl = T.closeSeason(Object.assign({}, l, { phase: 'winter', s: 5, cash: 400000 }), { rand: seeded(3) });
    assert.deepStrictEqual([cl.state.tenders.length, cl.state.plant], [0, null]); assert.match(cl.lines.join(' '), /charter on the .* ends/);
    // the score's estimate of an open season is steady (no luck), and the plant's market matters
    assert.strictEqual(T.estimate(t), T.estimate(t));
  } },
  { name: 'money: over many seasons a chartered tender is about break-even, an owned one earns a little, a shore plant swings both ways with the market', fn: async () => {
    const season = (o, seed) => {
      const r = seeded(seed), run = { sockeye: .6 + r() * .8, coho: 1, pinkEven: seed % 2 === 0, king: 'closed' };
      let t = tk({ state: T.newState(seed), run, s: 3 + seed % 7, year: 2029 + seed % 7 }); t.state.yrs = 3;
      t = act(t, o.lease ? 'lease' : 'buyT', { area: 'uci' });
      if (o.plant) { t = act(t, o.plant, { area: 'uci' }); t = act(t, 'crew', { lvl: 'full' }); t = act(t, 'mix', { mix: 'fresh' }) }
      const op = T.openSeason(Object.assign({}, t, { phase: 'summer' }), { rand: r });
      const cl = T.closeSeason(Object.assign({}, t, { state: op.state, s: t.s + 1 }), { rand: r });
      return { net: cl.state.last.net - (o.lease ? 0 : 0), lv: cl.state.last.lv.salmon };
    };
    const n = 150, run = o => Array.from({ length: n }, (_, i) => season(o, i + 1)), mean = a => a.reduce((x, y) => x + y.net, 0) / a.length;
    const lease = run({ lease: true }), own = run({}), shore = run({ plant: 'shore' });
    assert.ok(Math.abs(mean(lease)) < 20000, `charter ${mean(lease)}`);
    assert.ok(mean(own) > mean(lease), `own ${mean(own)} vs charter ${mean(lease)}`);
    const by = l => mean(shore.filter(x => x.lv === l));
    assert.ok(by(0) < 0 && by(2) > 50000 && by(2) > by(1) && by(1) > by(0), `shore by market ${by(0)} ${by(1)} ${by(2)}`);
    const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y.net - m) ** 2, 0) / a.length) };
    assert.ok(sd(shore) > 2 * sd(own), 'a plant is the risky rung');
  } },
  { name: 'guardrail: a bad season never takes cash below the floor: the bank carries it on the loan, or everything is sold and the rest written off', fn: async () => {
    // a shore plant in a weak market with no cash to spare
    const bust = (cash, cover, seed = 4) => {
      let t = open0({ plant: 'shore', t: { cash: 2e6 } });
      t.state.season.lv = { salmon: 0, pink: 0, crab: 0 };
      if (!cover) { t.state.loan = { bal: Math.round(T.value(t.state) * .95), rate: K.RATE, left: 7 } }
      return T.closeSeason(Object.assign({}, t, { phase: 'winter', s: 5, cash }), { rand: seeded(seed) });
    };
    const carried = bust(12000, true);
    assert.ok(carried.carried > 0 && !carried.forced && 12000 + carried.cashDelta === T.FLOOR, `carried ${carried.carried} ${carried.cashDelta}`);
    assert.match(carried.lines.join(' '), /adds .* to your loan/);
    const sold = bust(12000, false);
    assert.ok(sold.forced && 12000 + sold.cashDelta >= T.FLOOR, `${sold.cashDelta}`); assert.deepStrictEqual([sold.state.tenders.length, sold.state.plant, sold.state.loan], [0, null, null]);
    assert.match(sold.lines.join(' '), /dock auction/); assert.match(sold.lines.join(' '), /guide business carries on/); assert.ok(sold.events.some(e => e.id === 'forced_sale'));
    assert.ok(sold.state.credit > 5 && sold.state.tot.forced === 1);
    // cash already under the floor: the business takes nothing
    const under = bust(4000, false); assert.ok(under.cashDelta >= 0, `${under.cashDelta}`);
    // fuzz: whatever happens, never below the floor
    for (let i = 0; i < 60; i++) { const cash = 10000 + (i * 7919) % 90000, r = bust(cash, i % 2 === 0, 50 + i); assert.ok(cash + r.cashDelta >= T.FLOOR - 1, `seed ${i}: ${cash} + ${r.cashDelta}`) }
  } },
  { name: 'own catch: your gillnet, seine or crab delivery goes to your own buyer in that water at your posted price; elsewhere it doesn’t', fn: async () => {
    const t = open0();
    assert.strictEqual(T.areaOf('Central District'), 'uci'); assert.strictEqual(T.areaOf('Kasilof section'), 'uci'); assert.strictEqual(T.areaOf('Kachemak Bay'), 'lci'); assert.strictEqual(T.areaOf('Dutch Harbor'), 'west');
    assert.ok(T.buyerIn(t, 'Kenai')); assert.ok(!T.buyerIn(t, 'Homer')); assert.ok(!T.buyerIn(t, 'west'));
    const s1 = act(Object.assign({}, t, { phase: 'winter' }), 'price', { offset: .05 });
    const r = T.route(Object.assign({}, t, { state: s1.state }), { species: 'reds', lbs: 1200, area: 'Central District', day: 3 });
    assert.ok(r.routed && r.species === 'sockeye' && Math.abs(r.price - (t.state.season.going.sockeye + .05)) < .011 && r.value === Math.round(r.price * 1200));
    assert.strictEqual(r.state.season.own.uci.sockeye, 1200); assert.match(r.lines[0], /your own tender/);
    assert.strictEqual(T.route(t, { species: 'pink', lbs: 500, area: 'Homer' }).routed, false);
    assert.strictEqual(T.route(tk(), { species: 'sockeye', lbs: 500, area: 'Kenai' }).routed, false, 'no season open');
    // with a plant in the water the catch goes through the plant at the end of the season
    const p = open0({ plant: 'space', yrs: 2 }), r2 = T.route(p, { species: 'coho', lbs: 3000, area: 'uci' });
    assert.ok(r2.routed && /leased line space/.test(r2.lines[0]));
    const c = T.closeSeason(Object.assign({}, p, { state: r2.state, phase: 'winter', s: 5 }), { rand: seeded(1) }); assert.ok(c.state.last.plant !== 0);
  } },
  { name: 'winter acts: product mix, a floater that moves and winters out west for crab, crew hiring takes a free day, upkeep, sales pay the loan first', fn: async () => {
    let t = tk({ cash: 3e6 }); t.state.yrs = 4;
    t = act(t, 'floater', { area: 'uci', loan: true });
    assert.strictEqual(T.why(t, 'mix', { mix: 'can' }), null); t = act(t, 'mix', { mix: 'can' }); assert.strictEqual(t.state.plant.mix, 'can');
    const crew = T.act(t, 'crew', { lvl: 'full' }); assert.strictEqual(crew.daysUsed, K.CREW_DAY); assert.strictEqual(-crew.cashDelta, T.crewCost(t, 'full'));
    assert.match(T.why(Object.assign({}, t, { daysLeft: 0 }), 'crew', {}), /free days/);
    t = act(t, 'parea', { area: 'lci' }); t = act(t, 'wcrab', {}); assert.ok(t.state.winterCrab);
    t = act(t, 'maint', { lvl: 'skip' }); assert.strictEqual(t.state.maint, 'skip');
    const op = T.openSeason(Object.assign({}, t, { phase: 'summer' }), { rand: seeded(2) });
    const L = op.lines.join(' '); assert.match(L, /winter out west/); assert.match(L, /towed to Lower Cook Inlet/); assert.match(L, /agency/, 'nobody hired a crew');
    // a shore plant can't can without a line? (it can); line space can't
    let s = tk(); s.state.yrs = 1; s = act(s, 'space', { area: 'lci' }); assert.ok(T.act(s, 'mix', { mix: 'can' }).state.plant.mix === 'hg', 'line space has no canning line');
    // selling pays the bank first
    let b = act(tk(), 'buyT', { area: 'uci', loan: true }); const sale = T.act(b, 'sellT', { id: b.state.tenders[0].id });
    assert.strictEqual(sale.state.loan, null); assert.ok(/pays down the loan/.test(sale.lines.join(' ')));
    assert.strictEqual(sale.cashDelta, T.saleValue(b, b.state.tenders[0].id) - b.state.loan.bal);
  } },
  { name: 'autoplay: the processor works up the ladder and keeps the guide’s money; the mogul borrows for everything', fn: async () => {
    const host = (t0) => { let t = t0; return { ticket: () => t, apply: r => { t = Object.assign({}, t, { state: r.state, cash: t.cash + r.cashDelta, daysLeft: t.daysLeft - (r.daysUsed || 0) }) }, get t() { return t } } };
    const h1 = host(tk({ cash: 90000, s: 3 })); T.autoplay(h1, { policy: 'processor' }); assert.strictEqual(h1.t.state.tenders[0].kind, 'lease'); assert.ok(h1.t.cash >= 50000);
    const t2 = tk({ cash: 260000 }); t2.state.yrs = 1; const h2 = host(t2); T.autoplay(h2, { policy: 'processor' }); assert.strictEqual(h2.t.state.tenders[0].kind, 'used'); assert.ok(h2.t.cash >= T.FLOOR);
    const t3 = tk({ cash: 400000 }); t3.state.yrs = 2; const h3 = host(t3); T.autoplay(h3, { policy: 'processor' }); assert.ok(h3.t.state.plant, 'a plant'); assert.strictEqual(h3.t.state.crew.s, t3.s, 'hires the crew');
    const t4 = tk({ cash: 160000 }); t4.state.yrs = 0; const h4 = host(t4); T.autoplay(h4, { policy: 'mogul' }); assert.ok(h4.t.state.loan && h4.t.state.policy.offset >= .08 && h4.t.state.maint === 'skip');
    const done = T.autoplay(host(tk({ cash: 90000, seasonsLeft: 0 })), { policy: 'processor' }); assert.deepStrictEqual(J(done), [], 'nothing in the last winter of a career');
  } },

  // ---------- the game ----------
  { name: 'game: the business opens after three seasons: a planner button, a line in the off-season summary, a tip; nothing before', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const r = await page.evaluate(async () => {
      setPref('years', 10); newGame('normal'); closeModals(); S.money = 200000; S.rep = 70;
      const out = { s: [] };
      for (let s = 1; s <= 3; s++) {
        S.cur = s * SEASON - 1; S.t = S.cur * 1440 + 1300; S.loc = 'shop'; S.book.forEach(b => { if (b.status === 'booked') b.status = 'done' });
        endDay('home'); await new Promise(r => setTimeout(r, 5)); closeModals();
        winterModal(); out.s.push({ s: S.winter.s, btn: MB.some(x => /Commercial & crab/.test(x.l)) && fishHubList().some(x => x.id === 'tender'), sup: (S.winter.sup || []).some(l => /fish buying/i.test(l)) }); closeModals();
        if (s < 3) { finishWinter(); closeModals() }
      }
      out.hub = FISH_HUB.filter(x => x.id === 'tender').length; out.tip = TIPS.some(t => t.id === 'tender' && t.when());
      out.unlock = TENDER_UNLOCK;
      return out;
    });
    assert.strictEqual(r.unlock, 3);
    assert.deepStrictEqual(r.s.map(x => x.btn), [false, false, true]); assert.deepStrictEqual(r.s.map(x => x.sup), [false, false, true]); assert.ok(r.tip); assert.strictEqual(r.hub, 1);
    assert.match(fs.readFileSync(path.join(ROOT, 'src/js/24-career.js'), 'utf8'), /\.\.\.\(typeof fishWinterBtns==='function'\?fishWinterBtns\(\):\[\]\)/, 'the one shared line in winterModal');
    noErrors(errors);
  } },
  { name: 'game: charter a tender in the planner, the season opens with the bookings, an opener shows in the morning and on the Here tab, the skipper runs it at night', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const r = await page.evaluate(async () => {
      setPref('years', 10); newGame('normal'); closeModals(); S.money = 150000; S.rep = 70;
      for (let s = 1; s <= 3; s++) { S.cur = s * SEASON - 1; S.t = S.cur * 1440 + 1300; S.loc = 'shop'; S.book.forEach(b => { if (b.status === 'booked') b.status = 'done' }); endDay('home'); await new Promise(r => setTimeout(r, 5)); closeModals(); if (s < 3) { finishWinter(); closeModals() } }
      const out = {}, m0 = S.money;
      winterModal(); MBTN(MB.findIndex(x => /Commercial & crab/.test(x.l)));
      out.planner = document.querySelector('#mbg h2').textContent;
      MBTN(MB.findIndex(x => /^⚓ Tenders/.test(x.l))); MBTN(MB.findIndex(x => /Charter a tender/.test(x.l))); out.areaBtns = MB.map(x => x.l); MBTN(0);
      out.paid = m0 - S.money; out.kind = S.fish.tender.tenders[0].kind; out.sheets = document.querySelectorAll('.modal-bg').length;
      closeModals(); finishWinter(); closeModals();
      out.season = !!S.fish.tender.season; out.bookTab = EXTRA_TABS.find(t => t.k === 'book').view().includes('Fish buying');
      // walk to the first opener
      let g = 0; while (!tenderToday() && g++ < 14) { S.book.forEach(b => { if (b.d === day() && b.status === 'booked') b.status = 'done' }); endDay('home'); await new Promise(r => setTimeout(r, 5)); closeModals() }
      out.opDay = dlabel(day()); out.morning = S.log.filter(l => l.t >= day() * 1440).some(l => /Opener today/.test(l.s));
      S.t = day() * 1440 + 300; S.loc = 'shop';
      const a = actionsHere().find(x => /Run your tender/.test(x.l)); out.action = !!a && !a.dis;
      S.t = day() * 1440 + 600; out.late = actionsHere().find(x => /Run your tender/.test(x.l)).dis;
      const led0 = S.fish.tender.season.led.n, m1 = S.money;
      S.book.forEach(b => { if (b.d === day() && b.status === 'booked') b.status = 'done' });
      endDay('home'); await new Promise(r => setTimeout(r, 5));
      out.night = document.querySelector('#mbg') ? document.querySelector('#mbg').textContent.includes('skipper runs') : false;
      closeModals();
      out.led = S.fish.tender.season.led.n - led0; out.netNight = S.fish.tender.season.led.net;
      return out;
    });
    assert.match(r.planner, /Fish buying/); assert.strictEqual(r.paid, 24000); assert.strictEqual(r.kind, 'lease'); assert.ok(r.areaBtns.some(l => /Upper Cook Inlet/.test(l)) && r.areaBtns.some(l => /Kachemak/.test(l)));
    assert.ok(r.season && r.bookTab, JSON.stringify(r)); assert.match(r.opDay, /^(Mon|Thu)/); assert.ok(r.morning, 'the morning names the opener');
    assert.ok(r.action && r.late, 'the day choice is on the Here tab until 8 AM'); assert.strictEqual(r.led, 1); assert.ok(r.night, 'the morning report has the skipper’s day');
    noErrors(errors);
  } },
  { name: 'game: running the tender yourself takes the day: a booked party is yours to cancel, three choices, a result, home by evening, energy spent', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const r = await page.evaluate(async () => {
      setPref('years', 10); newGame('normal'); closeModals();
      // a business with an open season, today an opener: set up through the module itself
      S.cur = 3 * SEASON; S.t = S.cur * 1440 + 300; S.loc = 'shop'; S.money = 200000; S.rep = 70; S.seasons = [{}, {}, {}];
      const t0 = tenderTicket({ phase: 'winter', s: 3 }); let rep = Tender.act(t0, 'lease', { area: 'uci' }); tenderApply(rep, true);
      rep = Tender.openSeason(tenderTicket({ phase: 'summer' })); tenderApply(rep, true);
      const cal = S.fish.tender.season.cal.uci, out = { md: tenderTicket().md, isOp: cal.includes(tenderTicket().md) };
      if (!out.isOp) { S.fish.tender.season.cal.uci.push(tenderTicket().md) }
      addBooking({ d: day(), type: 'reds', n: 2, who: 'Testers', from: 'Ohio', res: false, quirk: [] });
      const e0 = S.energy, m0 = S.money, r0 = S.rep;
      actionsHere().find(x => /Run your tender/.test(x.l)).fn();
      out.t1 = document.querySelector('#mbg h2').textContent; out.b1 = MB.map(x => x.l);
      MBTN(MB.findIndex(x => /Cancel on the Testers/.test(x.l)));
      out.t2 = document.querySelector('#mbg h2').textContent; out.b2 = MB.map(x => x.l); MBTN(1);           // +5¢
      out.t3 = document.querySelector('#mbg h2').textContent; MBTN(0);                                      // bled only
      out.t4 = document.querySelector('#mbg h2').textContent; MBTN(0);                                      // run in tonight
      out.t5 = document.querySelector('#mbg h2').textContent; out.body = document.querySelector('#mbg .mb').textContent;
      out.big = [...document.querySelectorAll('#mbg button.act')].every(b => b.getBoundingClientRect().height >= 44);
      MBTN(0);
      out.open = !!document.getElementById('mbg'); out.clock = fmt(S.t); out.energy = e0 - S.energy; out.cash = S.money - m0; out.rep = r0 - S.rep;
      out.cancelled = S.book.find(b => b.who === 'Testers').status; out.done = S.fish.tender.season.done.length; out.self = S.fish.tender.season.done[0].self;
      out.again = !!actionsHere().find(x => /Run your tender/.test(x.l));
      return out;
    });
    assert.match(r.t1, /booked today/); assert.ok(r.b1.some(l => /Let the skipper run/.test(l)));
    assert.match(r.t2, /^⚓ Opener: Kenai\/Kasilof/); assert.ok(r.b2.some(l => /Post \+5¢/.test(l)) && r.b2.some(l => /skipper run it/.test(l)));
    assert.match(r.t3, /Boats alongside/); assert.match(r.t4, /run to the plant/); assert.match(r.t5, /Delivered/); assert.match(r.body, /You run the/);
    assert.ok(r.big, '44 px buttons'); assert.strictEqual(r.open, false);
    assert.strictEqual(r.clock, '8:30 PM'); assert.ok(r.energy >= 25, `energy ${r.energy}`); assert.ok(r.cash !== 0); assert.strictEqual(r.rep, 5);
    assert.strictEqual(r.cancelled, 'cancelled'); assert.deepStrictEqual([r.done, r.self], [1, true]); assert.strictEqual(r.again, false, 'one opener a day');
    noErrors(errors);
  } },
  { name: 'game: pop-up budget: a whole season with a tender and a plant opens no pop-up of its own; the fall statement lands in the off-season summary', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const r = await page.evaluate(async () => {
      setPref('years', 10); newGame('normal'); closeModals();
      S.money = 900000; S.rep = 75; S.seasons = [{}, {}, {}]; S.fish = { gillnet: { keep: 1 } };
      S.cur = 3 * SEASON - 1; S.t = S.cur * 1440 + 1300; S.loc = 'shop'; S.book.forEach(b => { if (b.status === 'booked') b.status = 'done' });
      endDay('home'); await new Promise(r => setTimeout(r, 5)); closeModals();
      TND().yrs = 2; tenderBot('processor'); const has = { t: S.fish.tender.tenders.length, p: S.fish.tender.plant && S.fish.tender.plant.kind };
      finishWinter(); closeModals();
      let pops = 0; const o = window.modal; window.modal = function (t) { if (/⚓|🏭|Fish buying|tender/i.test(String(t))) pops++; return o.apply(this, arguments) };
      try {
        for (let k = 0; k < SEASON; k++) { S.book.forEach(b => { if (b.d === day() && b.status === 'booked') b.status = 'done' }); S.loc = 'shop'; endDay('home'); await new Promise(r => setTimeout(r, 5)); closeModals(); if (S.winter) break }
      } finally { window.modal = o }
      return { has, pops, winter: !!S.winter, sup: (S.winter.sup || []).filter(l => /Tendering|Your (plant|leased|shore)|charter/.test(l)).length, gill: S.fish.gillnet.keep, over: S.over };
    });
    assert.ok(r.has.t >= 1, JSON.stringify(r)); assert.strictEqual(r.pops, 0); assert.ok(r.winter && r.sup >= 1, JSON.stringify(r)); assert.strictEqual(r.gill, 1, 'another module’s state is left alone'); assert.strictEqual(r.over, false);
    noErrors(errors);
  } },
  { name: 'game: score and end screen: tenders and plants at nine tenths, the loan against it, the rest of the summer as an estimate; a row on the end screen', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const r = await page.evaluate(() => {
      setPref('years', 10); newGame('normal'); closeModals();
      const p0 = scoreParts().length;
      S.cur = 3 * SEASON + 2; S.t = S.cur * 1440 + 300; S.money = 300000; S.rep = 70; S.seasons = [{}, {}, {}];
      let rep = Tender.act(tenderTicket({ phase: 'winter', s: 3 }), 'buyT', { area: 'uci', loan: true }); tenderApply(rep, true);
      rep = Tender.openSeason(tenderTicket({ phase: 'summer' })); tenderApply(rep, true);
      const P = scoreParts(), row = k => (P.find(x => x[0] === k) || [])[1];
      return { p0, n: P.length, assets: row('Tenders & plant'), loan: row('Bank loan'), est: row('Fish business, rest of summer'), val: Tender.value(TND()), debt: Tender.debt(TND()),
        sum: scoreOf() === P.reduce((a, x) => a + x[1], 0), end: (endRows().find(x => x[0] === 'Fish business') || [])[1] };
    });
    assert.strictEqual(r.assets, Math.round(r.val * .9)); assert.strictEqual(r.loan, -r.debt); assert.ok(typeof r.est === 'number' && r.est !== 0, JSON.stringify(r));
    assert.strictEqual(r.n, r.p0 + 3); assert.ok(r.sum); assert.match(r.end, /0 seasons/);
    noErrors(errors);
  } },
  { name: 'game: own catch routes to your own buyer (tenderRoute) only where you have one', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const r = await page.evaluate(() => {
      setPref('years', 10); newGame('normal'); closeModals();
      const none = tenderRoute({ species: 'sockeye', lbs: 800, area: 'Kenai', day: day() });
      S.cur = 3 * SEASON + 2; S.t = S.cur * 1440 + 300; S.money = 300000; S.rep = 70;
      tenderApply(Tender.act(tenderTicket({ phase: 'winter', s: 3 }), 'lease', { area: 'uci' }), true); tenderApply(Tender.openSeason(tenderTicket({ phase: 'summer' })), true);
      return { none, yes: tenderRoute({ species: 'sockeye', lbs: 800, area: 'Central District', day: day() }), homer: tenderRoute({ species: 'pink', lbs: 800, area: 'Kachemak Bay', day: day() }), inK: tenderBuyerIn('Kasilof'), own: S.fish.tender.season.own.uci.sockeye };
    });
    assert.strictEqual(r.none, null); assert.strictEqual(r.homer, null); assert.ok(r.inK);
    assert.ok(r.yes && r.yes.value > 0 && r.yes.price > 0 && /own tender/.test(r.yes.line)); assert.strictEqual(r.own, 800);
    noErrors(errors);
  } },
  { name: 'game: old saves load: no S.fish at all, an S.fish from another module, and a business saved mid-season', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const r = await page.evaluate(() => {
      setPref('years', 10); newGame('normal'); closeModals();
      const out = {};
      const d = JSON.parse(JSON.stringify(packSave())); delete d.S.fish; const m = migrate(d); const keep = S;
      S = m.S; try { out.noFish = typeof S.fish; out.parts = scoreParts().length; out.ticket = tenderTicket().state.v; out.has = tenderHas(); out.tab = typeof EXTRA_TABS.find(t => t.k === 'book').view() } finally { S = keep }
      const d2 = JSON.parse(JSON.stringify(packSave())); d2.S.fish = { seine: { a: 2 } }; const m2 = migrate(d2);
      S = m2.S; try { TND(); out.seine = S.fish.seine.a; out.both = Object.keys(S.fish).sort().join(',') } finally { S = keep }
      S.cur = 3 * SEASON + 2; S.money = 300000; S.rep = 70;
      tenderApply(Tender.act(tenderTicket({ phase: 'winter', s: 3 }), 'lease', { area: 'uci' }), true); tenderApply(Tender.openSeason(tenderTicket({ phase: 'summer' })), true);
      const d3 = JSON.parse(JSON.stringify(packSave())); const m3 = migrate(d3);
      S = m3.S; try { out.mid = !!S.fish.tender.season && S.fish.tender.tenders.length === 1; out.est = typeof Tender.estimate(tenderTicket()) } finally { S = keep }
      return out;
    });
    assert.strictEqual(r.noFish, 'undefined'); assert.ok(r.parts > 5); assert.strictEqual(r.ticket, 1); assert.strictEqual(r.has, false); assert.strictEqual(r.tab, 'string');
    assert.strictEqual(r.seine, 2); assert.strictEqual(r.both, 'seine,tender'); assert.ok(r.mid); assert.strictEqual(r.est, 'number');
    noErrors(errors);
  } },
  { name: 'game: Help has one section for the business, and every number it quotes is the module’s own', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const r = await page.evaluate(() => {
      const h = HELP.find(x => x[3] === 'tender');
      return { h: h && h[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), ic: h && h[0], last: HELP[HELP.length - 1][3], K: Tender.data.K, floor: Tender.FLOOR, lease: Tender.data.VESSELS.lease.cost, used: Tender.data.VESSELS.used.price, shore: Tender.data.PLANTS.shore.price, n: HELP.filter(x => /tender|Fish buying/i.test(x[1])).length };
    });
    assert.ok(r.h, 'a tender section'); assert.strictEqual(r.n, 1); assert.strictEqual(r.last, 'feedback');
    const num = s => Number(String(s).replace(/[$,]/g, '')), t = r.h, has = re => { const m = t.match(re); assert.ok(m, re); return m };
    assert.strictEqual(num(has(/With (\d+) seasons behind you/)[1]), r.K.UNLOCK);
    assert.strictEqual(num(has(/season \((\$[\d,]+)\)/)[1]), r.lease); assert.strictEqual(num(has(/buy a used one \((\$[\d,]+)\)/)[1]), r.used);
    assert.strictEqual(num(has(/shore plant \((\$[\d,]+)\)/)[1]), r.shore); assert.strictEqual(num(has(/whole day and (\d+) energy/)[1]), r.K.SELF_ENERGY);
    assert.strictEqual(num(has(/winter \((\d+) free day\)/)[1]), r.K.CREW_DAY);
    const bank = has(/put (\d+)% down, at (\d+)% over (\d+) years/); assert.deepStrictEqual(bank.slice(1).map(Number), [Math.round(r.K.DOWN * 100), Math.round(r.K.RATE * 100), r.K.TERM]);
    assert.strictEqual(num(has(/never takes your last (\$[\d,]+)/)[1]), r.floor); assert.strictEqual(r.K.SCORE, .9); assert.match(t, /nine tenths/);
    assert.match(t, /never|can’t end your career/);
    noErrors(errors);
  } },
  { name: 'game: bot careers with the processor and mogul policies: no page errors, no career lost, the business never below the floor', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const res = await page.evaluate(async () => {
      const out = [];
      for (const pol of ['processor', 'mogul']) {
        setPref('years', 10); newGame('normal'); closeModals(); S.loc = 'shop';
        let low = 1e9;
        for (let k = 1; k <= 7; k++) {
          S.book.forEach(b => { if (b.status === 'booked') b.status = 'done' });
          S.cur = k * SEASON - 1; S.t = S.cur * 1440 + 1300; S.loc = 'shop'; S.energy = 80;
          S.money = Math.max(S.money, 160000); S.rep = Math.max(S.rep, 70);
          endDay('home'); await new Promise(r => setTimeout(r, 5)); closeModals(); if (S.over) break;
          low = Math.min(low, S.money);
          tenderBot(pol); closeModals(); finishWinter(); closeModals(); low = Math.min(low, S.money);
        }
        out.push({ pol, over: S.over, loss: checkLoss(), seasons: TND().tot.seasons, forced: TND().tot.forced, low });
      }
      return out;
    });
    for (const x of res) { assert.strictEqual(x.over, false, JSON.stringify(x)); assert.strictEqual(x.loss, null); assert.ok(x.seasons >= 3, JSON.stringify(x)) }
    noErrors(errors);
  } },
];
