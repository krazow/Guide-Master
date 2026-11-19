// Commercial gillnetting (src/gillnet/, the Gillnet engine; src/js/42-gillnet.js, the Guide Master adapter).
// The first half runs the engine on its own in Node, in an empty `vm` context, with no browser and no Guide Master;
// the second half plays the adapter in the real game: the planner, the openers as day choices, the report, citations, the rest of
// the summer, old saves, the pop-up budget and a bot.
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const { open, newGame, noErrors, assert } = require('./helpers');

const ROOT = path.resolve(__dirname, '..'), DIR = path.join(ROOT, 'src', 'gillnet');
const FILES = fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort();
const SRC = FILES.map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');
function load() {
  const ctx = vm.createContext({});
  const before = new Set(vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx));
  const G = vm.runInContext(SRC + '\n;Gillnet', ctx);
  const added = vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx).filter(k => !before.has(k));
  return { G, added };
}
const { G } = load();
const J = o => JSON.parse(JSON.stringify(o));
const D = G.data;
// a morning low tide (good for setting), an afternoon high, an evening low
const TIDES = [{ m: 140, h: 19, hi: true }, { m: 470, h: 1.5, hi: false }, { m: 845, h: 20, hi: true }, { m: 1215, h: 2.5, hi: false }];
const tk = (o = {}) => Object.assign({ kind: 'set', role: 'lease', run: .8, price: 1.65, wind: 8, wx: 'sun', tides: TIDES, amp: 9, now: 330, energy: 80, xp: 4, suit: true, exam: true, king: 'open', costMult: 1, fuel: 5.2 }, o);
const avgOf = (n, f) => { let s = 0; for (let i = 0; i < n; i++) s += f(i); return s / n; };
// a season's played days (two July weeks starting on a Monday)
const july = (y0 = 13) => Array.from({ length: 14 }, (_, i) => ({ d: 28 + i, md: 700 + y0 + i, dow: (1 + i) % 7 }));

// In the page: take a fresh 5-year game to the off-season before season s, with gillnetting unlocked when s >= 2.
const install = () => {
  window.toWinter = (s, o = {}) => {
    closeModals(); clearTiles(); S.years = 5; S.rep = o.rep ?? 70; S.money = o.money ?? 40000;
    while (S.seasons.length < s - 1) S.seasons.push({ year: 2026 + S.seasons.length, trips: 18, fares: 18000, earned: 20000, rep: 70, cites: 0 });
    const d = s * SEASON - 1; S.cur = d; S.t = d * 1440 + 1300; S.loc = 'shop'; S.book = S.book.filter(b => b.d < d - 1);
    endDay('home'); closeModals(); clearTiles(); S.rep = o.rep ?? 70; S.money = o.money ?? 40000;
  };
  // open the season with a plan and set the king rule; an empty booking sheet unless keep
  window.openSeason = (id, o = {}) => {
    if (o.king) S.reg.king = o.king; if (o.sock) S.reg.mult.sockeye = o.sock;
    if (id) assertTrue(gnSetPlan(id), 'plan ' + id);
    finishWinter(); closeModals(); clearTiles(); if (!o.keep) S.book = S.book.filter(b => b.d < seasonFirst()); S.reqs = []; S.energy = 90;
  };
  window.assertTrue = (v, m) => { if (!v) throw new Error(m); };
  // go to the morning of day d (through the night, so the morning report is built)
  window.toMorning = d => { closeModals(); S.cur = d - 1; S.t = (d - 1) * 1440 + 1300; S.loc = 'shop'; S.trip = null; endDay('home'); };
  window.seeded = (seed, f) => { const R = Math.random; let a = seed >>> 0, n = 0;
    Math.random = () => { n++; a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    try { return { v: f(), n }; } finally { Math.random = R; } };
  // play an open sheet to the end by tapping button i (or a function of the buttons) every time
  window.playSheets = async (pickI = () => 0) => { const seen = []; let g = 0;
    while (document.getElementById('mbg') && g++ < 20) { seen.push({ t: document.querySelector('#mbg h2').textContent, b: MB.map(x => x.l) }); MBTN(pickI(MB, seen.length - 1)); await new Promise(r => setTimeout(r, 5)); }
    return seen; };
};
const setup = async (ctx, seed = 7) => { const { page, errors } = await open(ctx, { seed }); await newGame(page); await page.evaluate(install); return { page, errors }; };

module.exports = [
  // ---------- the engine on its own ----------
  { name: 'boundary: src/gillnet never names the game, its pop-ups, clock, saves or storage, and adds one global', fn: async () => {
    for (const f of FILES) {
      const h = fs.readFileSync(path.join(DIR, f), 'utf8');
      for (const [re, what] of [[/\bS\./, 'S.'], [/\bS\[/, 'S['], [/\bmodal\s*\(/, 'modal('], [/\bGAME\b/, 'GAME'], [/\bMIGRATIONS\b/, 'MIGRATIONS'], [/\bAPP_VERSION\b/, 'APP_VERSION'],
        [/\blocalStorage\b/, 'localStorage'], [/\bdocument\b/, 'document'], [/\bwindow\b/, 'window'], [/\bcite\s*\(/, 'cite('], [/\bmoney\s*\(/, 'money('], [/\bsay\s*\(/, 'say(']])
        assert.ok(!re.test(h), `${f} mentions ${what}`);
    }
    const r = load(); assert.deepStrictEqual(J(r.added), [], 'nothing leaks onto the global object');
    assert.strictEqual(vm.runInContext('typeof Gillnet', vm.createContext({})), 'undefined');
    assert.strictEqual(G.SCHEMA, 1); ['schedule', 'session', 'start', 'sim', 'rest', 'partner', 'offers', 'outlook'].forEach(k => assert.strictEqual(typeof G[k], 'function', k));
  } },
  { name: 'boundary: the build puts src/gillnet after src/home and before src/js, --check passes, the README states the contract', fn: async () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const a = html.indexOf('const CabinUpkeep='), b = html.indexOf('const Gillnet='), c = html.indexOf('function gnApply');
    assert.ok(a > 0 && b > a && c > b, `order ${a} ${b} ${c}`);
    assert.ok(/const Gillnet=/.test(fs.readFileSync(path.join(ROOT, 'offline', 'guidemaster-offline.html'), 'utf8')), 'the offline build has it');
    assert.strictEqual(cp.spawnSync('python3', ['tools/build.py', '--check'], { cwd: ROOT }).status, 0);
    const md = fs.readFileSync(path.join(DIR, 'README.md'), 'utf8');
    assert.ok(/ticket/i.test(md) && /report/i.test(md) && /SCHEMA/.test(md) && /host/.test(md) && /Facts and estimates/.test(md));
  } },
  { name: 'schedule: regular periods on Mondays and Thursdays inside each fishery’s window, announced the morning before', fn: async () => {
    for (const kind of ['set', 'drift']) for (let i = 0; i < 60; i++) {
      const days = july(3 + (i % 20)), x = G.schedule({ kind, days, king: ['open', 'cr', 'closed'][i % 3], sock: .7 + (i % 7) * .1 }, { rand: G.util.seeded(i + 1) });
      Object.entries(x.days).forEach(([d, o]) => {
        const day = days.find(y => y.d === +d);
        assert.ok(o.md >= D[kind].open && o.md <= D[kind].close, `${kind} ${o.md} in the window`);
        if (o.reg) assert.ok(day.dow === 1 || day.dow === 4, 'regular periods are Mondays and Thursdays'); else { assert.strictEqual(o.st, 'extra'); assert.notStrictEqual(day.dow, 0, 'no extra period on a Sunday'); }
        assert.strictEqual(o.ann, +d - 1); assert.ok(o.why && o.why.length > 20);
      });
    }
    // June and mid-August weeks: setnets don't open before late June or after mid-August
    const june = Array.from({ length: 7 }, (_, i) => ({ d: i, md: 612 + i, dow: (1 + i) % 7 })), aug = Array.from({ length: 7 }, (_, i) => ({ d: i, md: 816 + i, dow: (1 + i) % 7 }));
    assert.deepStrictEqual(Object.keys(G.schedule({ kind: 'set', days: june, king: 'open', sock: 1 }, { rand: G.util.seeded(1) }).days), []);
    assert.deepStrictEqual(Object.keys(G.schedule({ kind: 'drift', days: aug, king: 'open', sock: 1 }, { rand: G.util.seeded(1) }).days), []);
  } },
  { name: 'schedule: the setnets follow the kings (closed, restricted, open), can reopen late in a huge run, and drift periods move to the corridor', fn: async () => {
    const tally = (kind, king, sock, n = 300) => { const t = {}; for (let i = 0; i < n; i++) Object.values(G.schedule({ kind, days: july(), king, sock }, { rand: G.util.seeded(i + 11) }).days).forEach(o => { if (!o.reg) { t.extra = (t.extra || 0) + 1; return; } t[o.st] = (t[o.st] || 0) + 1; t['a:' + o.area] = (t['a:' + o.area] || 0) + 1; if (o.seine) t.seine = (t.seine || 0) + 1; }); return t; };
    const closed = tally('set', 'closed', .9), big = tally('set', 'closed', 1.3), cr = tally('set', 'cr', 1), open = tally('set', 'open', 1);
    assert.ok(!closed.open && !closed.restricted && !closed.reopen && closed.closed > 0, JSON.stringify(closed));
    assert.ok(closed.seine > 0, 'a beach seine day sometimes on the closed beach');
    assert.ok(big.reopen > 0 && big.closed > big.reopen, `a huge run sometimes reopens the beach late: ${JSON.stringify(big)}`);
    assert.ok(cr.restricted > cr.open * 2, JSON.stringify(cr)); assert.ok(open.open > open.restricted * 3, JSON.stringify(open));
    const dc = tally('drift', 'closed', 1), dopen = tally('drift', 'open', 1);
    assert.ok(dc['a:corridor'] + dc['a:area1'] > dc['a:district'] * 2, JSON.stringify(dc)); assert.ok(dopen['a:district'] > dopen['a:corridor'], JSON.stringify(dopen));
    // early August: the west side only
    const aug = Array.from({ length: 7 }, (_, i) => ({ d: i, md: 803 + i, dow: (1 + i) % 7 }));
    Object.values(G.schedule({ kind: 'drift', days: aug, king: 'cr', sock: 1 }, { rand: G.util.seeded(3) }).days).forEach(o => assert.strictEqual(o.area, 'west'));
    // a weak run closes some periods; a strong one brings extra periods
    assert.ok(tally('drift', 'open', .6).closed > 0); assert.ok(tally('set', 'open', 1.3).extra > 0); assert.ok(!tally('set', 'open', .9).extra);
    assert.ok(/closed/.test(G.outlook('set', 'closed', 1)) && /restricted/.test(G.outlook('set', 'cr', 1)) && /corridor/.test(G.outlook('drift', 'closed', 1)));
  } },
  { name: 'session: a setnet opener is four calls (set, soak, pick, deliver), a drift opener four (drift line, set, the tide, deliver), with sane reports', fn: async () => {
    const phases = {};
    for (const kind of ['set', 'drift']) for (const role of ['crew', 'lease', 'own']) for (const pol of ['first', 'random', 'sensible', 'greedy']) {
      if (kind === 'set' && role === 'own') continue;
      for (let i = 0; i < 40; i++) {
        const t = tk({ kind, role, wind: [5, 12, 19, 24][i % 4], amp: 8 + i % 5, run: .3 + (i % 9) * .12, day: { st: ['open', 'restricted', 'reopen', 'extra'][i % 4], area: kind === 'set' ? 'beach' : ['district', 'corridor', 'area1', 'west'][i % 4], hours: [420, 1140], why: 'x' } });
        const { report: r, steps } = G.sim({ ticket: t, seed: i + 1, policy: pol });
        phases[kind] = phases[kind] || new Set(); steps.forEach(s => phases[kind].add(s[0]));
        assert.ok(Number.isFinite(r.cashDelta) && r.fish >= 0 && r.minutes > 0 && r.minutes <= 1440 - t.now, JSON.stringify(r));
        assert.ok(r.energyDelta <= 0 && r.energyDelta >= -60);
        if (role === 'crew') { assert.strictEqual(r.cites.length, 0, 'crew are never cited'); assert.strictEqual(r.cashDelta, r.share); assert.strictEqual(r.costs.repair, 0); }
        else { const c = r.costs; assert.strictEqual(r.cashDelta, r.gross - c.lease - c.crew - c.fuel - c.ice - c.gas - c.repair, 'the costs add up'); }
        if (role === 'own') assert.strictEqual(r.costs.lease, 0);
        if (!r.skipped) { assert.strictEqual(r.lbs, r.fish * D.LB); assert.ok(r.lines.some(l => /Fish ticket/.test(l))); }
      }
    }
    assert.deepStrictEqual([...phases.set].sort(), ['brief', 'deliver', 'pick', 'set', 'soak']);
    assert.deepStrictEqual([...phases.drift].sort(), ['brief', 'deliver', 'line', 'set2', 'tide']);
    // sitting it out spends nothing
    const s = G.session(tk(), { rand: G.util.seeded(1) }); s.choose('skip'); const r = s.report();
    assert.ok(r.skipped && r.cashDelta === 0 && r.energyDelta === 0 && s.done === false);
    assert.strictEqual(s.choose('nope'), false, 'an unknown choice is refused');
  } },
  { name: 'session: reading the water pays: a low tide at the opening, picking ahead of the seals, bled and iced fish, a long drift in a rip', fn: async () => {
    const ticket = (o) => tk(Object.assign({ role: 'lease' }, o));
    const play = (t, plan, seed) => { const s = G.session(t, { rand: G.util.seeded(seed) }); for (const id of plan) { if (s.view().meta.phase === 'done') break; if (!s.choose(id)) s.choose(s.view().buttons[0].id); } return s; };
    const fishOf = (t, plan) => avgOf(300, i => play(t, plan, i + 1).report().fish);
    // the same "set at the opening" on a morning low tide catches more than on a morning high
    const HIGH = [{ m: 450, h: 20, hi: true }, { m: 830, h: 2, hi: false }, { m: 1200, h: 19, hi: true }];
    assert.ok(fishOf(ticket(), ['go', 'all', 'pick', 'fast', 'tender']) > fishOf(ticket({ tides: HIGH }), ['go', 'all', 'pick', 'fast', 'tender']) * 1.05, 'the low water at the opening');
    // bled and iced fish fetch more a pound, soft fish less
    const price = plan => avgOf(50, i => play(ticket(), plan, i + 1).report().price);
    assert.ok(price(['go', 'all', 'pick', 'bleed', 'tender']) > price(['go', 'all', 'pick', 'fast', 'tender']) + .15);
    assert.ok(price(['go', 'all', 'soak', 'fast', 'tender']) < price(['go', 'all', 'pick', 'fast', 'tender']));
    // seals take fish from a net left to soak
    const seals = plan => avgOf(400, i => { const s = play(ticket(), plan.slice(0, 2), i + 1); s.view(); const sealy = s.state.flags.seals; play; if (!sealy) return null; for (const id of plan.slice(2)) s.choose(id); return s.state.lost; }).toString();
    let soakLost = 0, pickLost = 0, n = 0;
    for (let i = 0; i < 400; i++) { const a = play(ticket(), ['go', 'all'], i + 1); a.view(); if (!a.state.flags.seals) continue; n++; a.choose('soak'); soakLost += a.state.lost; const b = play(ticket(), ['go', 'all'], i + 1); b.view(); b.choose('pick'); pickLost += b.state.lost; }
    assert.ok(n > 50 && soakLost > pickLost * 3, `${n} ${soakLost} ${pickLost}`); void seals;
    // over many openers, the sensible skipper beats the first-button habit, and the greedy one is cited
    const net = (pol, o) => avgOf(400, i => G.sim({ ticket: ticket(Object.assign({ wind: [6, 10, 14, 18][i % 4] }, o)), seed: i + 1, policy: pol }).report.cashDelta);
    assert.ok(net('sensible') > net('first'), 'sensible setnetting pays'); assert.ok(net('sensible', { kind: 'drift', day: { st: 'open', area: 'district', hours: [420, 1140] } }) > net('first', { kind: 'drift', day: { st: 'open', area: 'district', hours: [420, 1140] } }));
    const cites = (pol, o) => avgOf(300, i => G.sim({ ticket: ticket(o), seed: i + 1, policy: pol }).report.cites.length);
    assert.strictEqual(cites('sensible'), 0); assert.ok(cites('greedy') > .2, 'nets fishing past the close get caught');
    const corr = { kind: 'drift', day: { st: 'restricted', area: 'corridor', hours: [420, 1140] } };
    assert.strictEqual(cites('sensible', corr), 0); assert.ok(cites('greedy', corr) > .05, 'riding the tide across the corridor line');
  } },
  { name: 'session: crew advise and the skipper decides; with experience the skipper listens more', fn: async () => {
    const taken = xp => avgOf(300, i => { const s = G.session(tk({ role: 'crew', xp }), { rand: G.util.seeded(i + 5) }); s.choose('go'); s.choose('flood'); s.choose('soak'); s.choose('bleed'); s.choose('dock'); return s.state.advice.taken / s.state.advice.asked; });
    const a = taken(0), b = taken(8); assert.ok(a > .4 && a < .8 && b > a + .1, `${a} ${b}`);
    const v = G.session(tk({ role: 'crew', skipper: 'Marge Ostrander' }), { rand: G.util.seeded(1) }); v.choose('go');
    assert.match(v.view().html, /Marge Ostrander/); assert.ok(!v.view().buttons.some(b => b.id === 'late'), 'crew can’t leave the nets fishing past the close');
  } },
  { name: 'safety: a gale offers the beach; no survival suit makes a swamping worse; the beach seine pays a day’s wage', fn: async () => {
    const s = G.session(tk({ kind: 'drift', wind: 28, suit: false }), { rand: G.util.seeded(2) });
    assert.match(s.view().html, /small-craft advisory/); assert.match(s.view().html, /no survival suit/); assert.match(s.view().buttons[1].l, /weather/);
    assert.strictEqual(G.sim({ ticket: tk({ kind: 'drift', wind: 28, suit: false }), seed: 1, policy: 'sensible' }).report.skipped, true, 'a sensible skipper stays in');
    const loss = suit => avgOf(600, i => { const x = G.session(tk({ kind: 'drift', wind: 22, suit, day: { st: 'open', area: 'district', hours: [420, 1140] } }), { rand: G.util.seeded(i + 1) }); x.choose('go'); x.choose('corridor'); return x.state.lost; });
    assert.ok(loss(false) > loss(true) * 1.3, 'without a survival suit a swamping costs more');
    const sw = G.sim({ ticket: tk({ seine: true, day: { st: 'closed', area: 'beach', hours: [420, 1140] } }), seed: 3, policy: 'sensible' }).report;
    assert.ok(sw.seine && sw.cashDelta === D.SEINE_WAGE && sw.cites.length === 0 && sw.events.some(e => e.id === 'gn_beach_seine'));
    // an own boat without a dockside exam decal can be boarded and written up (a warning first, in the game)
    const ex = avgOf(300, i => G.sim({ ticket: tk({ kind: 'drift', role: 'own', exam: false, day: { st: 'open', area: 'district', hours: [420, 1140] } }), seed: i + 1, policy: 'sensible' }).report.cites.filter(c => c.minor).length);
    assert.ok(ex > .1 && ex < .4, String(ex));
  } },
  { name: 'money: crew is a modest day; a lease pays more per opener but costs up front; the rest of the summer keeps a share; nothing for crew', fn: async () => {
    const day = kind => ({ st: 'open', area: kind === 'set' ? 'beach' : 'district', hours: [420, 1140] });
    const ev = (kind, role) => avgOf(500, i => G.sim({ ticket: tk({ kind, role, day: day(kind), wind: [6, 10, 14][i % 3] }), seed: i + 1, policy: 'sensible' }).report.cashDelta);
    const sc = ev('set', 'crew'), sl = ev('set', 'lease'), dc = ev('drift', 'crew'), dl = ev('drift', 'lease'), dn = ev('drift', 'own');
    assert.ok(sc > 100 && sc < 500 && dc > 120 && dc < 600, `crew ${sc} ${dc}`);
    assert.ok(sl > sc * 3 && dl > dc * 3 && dn > dl, `lease ${sl} ${dl} own ${dn}`);
    assert.ok(sl < 3000 && dn < 3500, 'no opener is a gold mine');
    const r = G.rest({ kind: 'drift', role: 'lease', played: 2, net: 2400, gross: 4000, open: 1, count: 12, sock: 1 });
    assert.strictEqual(r.periods, 12); assert.strictEqual(r.net, Math.round(1200 * 12 * D.REST.share));
    assert.strictEqual(G.rest({ kind: 'set', role: 'crew', played: 2, net: 600, gross: 6000, open: 1, count: 12 }).net, 0);
    assert.strictEqual(G.rest({ kind: 'set', role: 'lease', played: 0, net: 0, gross: 0, open: 0, count: 15 }).net, 0, 'a closed beach earns nothing for the rest of the summer');
    // the up-front cost of a lease is about a season of share-fished openers: a gamble, not a sure thing
    assert.ok(D.set.leaseUp < G.rest({ kind: 'set', role: 'lease', played: 0, open: 1, count: 13, sock: 1 }).net + 2 * sl, 'an open season pays back the setnet lease');
    const o = G.offers({ cash: 50000, xp: { set: 0, drift: 0 }, did: {} });
    assert.ok(o.find(x => x.id === 'set:lease').dis && o.find(x => x.id === 'drift:lease').dis && !o.find(x => x.id === 'set:crew').dis, 'crew first');
    assert.ok(!G.offers({ cash: 50000, xp: { set: 3, drift: 0 }, did: {} }).find(x => x.id === 'set:lease').dis);
    assert.ok(!G.offers({ cash: 50000, xp: {}, did: { 'drift:crew': 1 } }).find(x => x.id === 'drift:lease').dis);
    assert.match(G.buyWhy({ cash: 1e6, did: {} }), /Lease/); assert.strictEqual(G.buyWhy({ cash: 1e6, did: { 'drift:lease': 1 } }), null);
    const p = G.partner(tk({ kind: 'drift', role: 'lease', day: day('drift') }), { rand: G.util.seeded(4) });
    assert.ok(p.cashDelta > 0 && p.cashDelta < p.gross * D.REST.share && p.partner);
    assert.strictEqual(G.partner(tk({ role: 'crew' }), { rand: G.util.seeded(4) }).cashDelta, 0);
  } },
  { name: 'start: runs through host.show, locks the beats, applies once as the summary shows, and nothing if the player walks away', fn: async () => {
    const shows = []; let fin = 0, rep = null;
    const host = { show: (t, h, b, lock, meta) => shows.push({ t, b, lock, meta }), onFinish: r => { fin++; rep = r; }, rand: G.util.seeded(9) };
    const h = G.start({ ticket: tk(), host });
    // tap the first button of every sheet (setTimeout in start: drive it by hand)
    const tick = () => new Promise(r => setTimeout(r, 1));
    for (let i = 0; i < 8 && fin === 0; i++) { shows[shows.length - 1].b[0].fn(); await tick(); }
    assert.strictEqual(fin, 1); assert.ok(rep && rep.fish >= 0);
    assert.strictEqual(shows[0].lock, false, 'the brief can be dismissed'); assert.ok(shows.slice(1, -1).every(s => s.lock), 'the beats are locked');
    assert.strictEqual(shows[shows.length - 1].meta.phase, 'done'); assert.ok(shows.some(s => s.meta.events.length));
    shows[shows.length - 1].b[0].fn(); await tick(); assert.strictEqual(fin, 1, 'applied once');
    let fin2 = 0; G.start({ ticket: tk(), host: { show: () => {}, onFinish: () => fin2++ } }); h.stop(); assert.strictEqual(fin2, 0, 'walking away applies nothing');
    assert.throws(() => G.start({ ticket: tk(), host: {} }));
  } },

  // ---------- the game ----------
  { name: 'game: nothing in season 1 or the first off-season; unlocks in the second with a line, one Commercial & crab button before Open bookings', fn: async ctx => {
    const { page, errors } = await setup(ctx, 21);
    const r = await page.evaluate(() => {
      const out = { on0: gnOn(), btn0: fishWinterBtns().length, act0: actionsHere().some(a => /opener/.test(a.l)) };
      toWinter(1); out.on1 = gnOn(); out.btn1 = fishWinterBtns().length; out.sup1 = (S.winter.sup || []).join(' ');
      finishWinter(); toWinter(2); out.on2 = gnOn(); out.sup2 = (S.winter.sup || []).join(' ');
      winterModal(); out.btns = MB.map(b => b.l); closeModals();
      out.hub = fishHubList().map(x => x.l); fishHubModal(); out.hubBtns = MB.map(b => b.l); closeModals(); FISH_HUB.find(x => x.id === 'gillnet').open(() => {}); out.sheet = document.querySelector('#mbg').textContent; out.gn = MB.map(b => b.l); closeModals();
      return out;
    });
    assert.strictEqual(r.on0, false); assert.strictEqual(r.btn0, 0); assert.strictEqual(r.act0, false);
    assert.strictEqual(r.on1, false, 'still locked after season 1'); assert.strictEqual(r.btn1, 0); assert.ok(!/commercial fishing/.test(r.sup1));
    assert.strictEqual(r.on2, true); assert.match(r.sup2, /New: commercial fishing/);
    const i = r.btns.findIndex(l => /Commercial & crab/.test(l)); assert.ok(i > 0 && i === r.btns.length - 2, r.btns.join(' | '));
    assert.strictEqual(r.btns.filter(l => /Commercial & crab/.test(l)).length, 1);
    assert.match(r.hub[0], /Gillnetting/); assert.deepStrictEqual(r.hub.length, 3, 'gillnetting, seining and crabbing (the fish business waits a winter more)'); assert.ok(r.hubBtns.some(l => /Gillnetting/.test(l)), r.hubBtns.join(' | '));
    assert.match(r.sheet, /Setnets:/); assert.match(r.sheet, /Drift boats:/);
    for (const re of [/Crew on a family setnet site/, /Lease a setnet site/, /Deckhand on a drift boat/, /Lease a drift permit/, /Buy a drift permit and boat/, /survival suit/]) assert.ok(r.gn.some(l => re.test(l)), String(re));
    noErrors(errors);
  } },
  { name: 'game: no random numbers drawn and no openers without a plan; the planner charges up front, refunds a change of mind, and crew comes first', fn: async ctx => {
    const { page, errors } = await setup(ctx, 22);
    const r = await page.evaluate(() => {
      toWinter(2); const out = {};
      const snap = JSON.stringify(S);
      out.n0 = seeded(5, () => _gnFinishWinter()).n; S = JSON.parse(snap); out.n1 = seeded(5, () => finishWinter()).n;
      out.sched = gnSched(); out.acts = actionsHere().filter(a => /opener|seine/.test(a.l)).length; out.book = /openers ·/.test(EXTRA_TABS.find(t => t.k === 'book').view());
      S = JSON.parse(snap); const m0 = S.money;
      out.leaseDis = !gnSetPlan('set:lease'); out.crew = gnSetPlan('drift:crew'); out.m1 = m0 - S.money;
      out.re = gnSetPlan('set:crew'); out.m2 = m0 - S.money; out.plan = gnPlan().id; out.none = gnSetPlan(null); out.m3 = m0 - S.money; out.plan3 = gnPlan();
      GNS().did['drift:crew'] = 1; out.lease = gnSetPlan('drift:lease'); out.m4 = m0 - S.money; out.up = GNS().sn.up;
      return out;
    });
    assert.strictEqual(r.n0, r.n1, 'finishing the winter draws the same random numbers with or without gillnetting when no summer is planned');
    assert.strictEqual(r.sched, null); assert.strictEqual(r.acts, 0); assert.strictEqual(r.book, false);
    assert.ok(r.leaseDis, 'a lease needs a crew season first'); assert.ok(r.crew); assert.strictEqual(r.m1, 60);
    assert.ok(r.re); assert.strictEqual(r.m2, 60, 'switching refunds the old plan'); assert.strictEqual(r.plan, 'set:crew');
    assert.ok(r.none); assert.strictEqual(r.m3, 0); assert.strictEqual(r.plan3, null);
    assert.ok(r.lease); assert.strictEqual(r.m4, 6000); assert.strictEqual(r.up, 6000);
    noErrors(errors);
  } },
  { name: 'game: buying a permit and boat counts toward boats and permits, costs a winter bill, sells back for less; the dockside exam takes a free day', fn: async ctx => {
    const { page, errors } = await setup(ctx, 23);
    const r = await page.evaluate(() => {
      toWinter(2, { money: 150000 }); const out = {}, v0 = S.up.value, m0 = S.money;
      out.why0 = !gnBuy(); GNS().did['drift:lease'] = 1; out.buy = gnBuy(); out.cost = m0 - S.money; out.dv = S.up.value - v0; out.plan = gnPlan().id;
      const d0 = campDaysLeft(); out.exam = gnExam(); out.days = d0 - campDaysLeft(); out.exam2 = gnExam();
      out.suit = gnSuit(); out.suit2 = gnSuit();
      finishWinter(); closeModals(); toWinter(3, { money: 150000 }); out.val = GNS().own.val; out.bill = (S.winter.sup || []).join(' '); out.plan3 = gnPlan() && gnPlan().id;
      const m1 = S.money; out.sell = gnSell(); out.back = S.money - m1; out.dv2 = S.up.value;
      return out;
    });
    assert.ok(r.why0, 'no buying before a lease season'); assert.ok(r.buy); assert.strictEqual(r.cost, 90000); assert.strictEqual(r.dv, 90000); assert.strictEqual(r.plan, 'drift:own');
    assert.ok(r.exam && r.days === 1 && !r.exam2); assert.ok(r.suit && !r.suit2);
    assert.strictEqual(r.val, 90000 - Math.round(90000 * .08)); assert.match(r.bill, /haul-out/); assert.strictEqual(r.plan3, 'drift:own', 'an owned boat plans itself');
    assert.ok(r.sell); assert.strictEqual(r.back, Math.round(r.val * .85)); assert.strictEqual(r.dv2, 0);
    noErrors(errors);
  } },
  { name: 'game: an opener day: Bookings and the morning report show it, 🧭 Here starts it, a few sheets, and the report lands in the save', fn: async ctx => {
    const { page, errors } = await setup(ctx, 24);
    const r = await page.evaluate(async () => {
      toWinter(2); openSeason('drift:crew', { king: 'open', sock: 1.1 });
      const x = gnSched(), ds = Object.keys(x.days).map(Number).sort((a, b) => a - b), d = ds.find(y => y > day() && Gillnet.fishable(x.days[y]));
      const out = { n: ds.length, d, book: EXTRA_TABS.find(t => t.k === 'book').view() };
      toMorning(d); out.morning = document.querySelector('#mbg').textContent; closeModals();
      out.todo = todoItems()[0].l; const a = actionsHere()[0]; out.act = a.l; out.primary = a.cls;
      const m0 = S.money, e0 = S.energy; a.fn(); out.sheets = await playSheets();
      out.money = S.money - m0; out.energy = S.energy - e0; out.time = tod(); out.loc = S.loc; out.done = GNS().done[d]; out.xp = GNS().xp.drift;
      out.after = actionsHere().some(x => /opener/.test(x.l)); out.todoOk = todoItems()[0].ok; out.book2 = EXTRA_TABS.find(t => t.k === 'book').view();
      out.log = S.log.slice(-6).map(l => l.s).join(' ');
      return out;
    });
    assert.ok(r.n >= 4, `${r.n} periods in two July weeks`); assert.match(r.book, /Drift openers · Deckhand on a drift boat/);
    assert.match(r.morning, /Today: drift opener/); assert.match(r.act, /Work the drift opener with/); assert.strictEqual(r.primary, 'primary');
    assert.match(r.todo, /Drift opener/);
    assert.ok(r.sheets.length >= 5 && r.sheets.length <= 7, r.sheets.map(s => s.t).join(' | '));
    assert.match(r.sheets[0].t, /Drift opener/); assert.match(r.sheets[r.sheets.length - 1].t, /Opener over/);
    assert.ok(r.money > 0 && r.money < 1500, `crew share ${r.money}`); assert.ok(r.energy <= -20, `energy ${r.energy}`);
    assert.ok(r.time >= 19 * 60 && r.time < 1440, `back in the evening: ${r.time}`); assert.strictEqual(r.loc, 'shop');
    assert.ok(r.done && !r.done.skipped && r.done.fish > 0); assert.strictEqual(r.xp, 1); assert.strictEqual(r.after, false); assert.strictEqual(r.todoOk, true);
    assert.match(r.book2, /✅ \d+ sockeye/); assert.match(r.log, /crew share/);
    noErrors(errors);
  } },
  { name: 'game: a trip booked on an opener day is a real choice: hand it off, cancel it (refund, rep), or guide; a lease’s partner fishes it at night', fn: async ctx => {
    const { page, errors } = await setup(ctx, 25);
    const r = await page.evaluate(async () => {
      toWinter(2); GNS().did['drift:crew'] = 1; openSeason('drift:lease', { king: 'open', sock: 1 });
      const x = gnSched(), ds = Object.keys(x.days).map(Number).filter(y => y > day() + 1 && Gillnet.fishable(x.days[y])).sort((a, b) => a - b);
      const out = {}, d = ds[0], d2 = ds[1];
      toMorning(d); closeModals(); const b = addBooking({ d, type: 'trout', n: 2, who: 'test party', from: 'Ohio', res: false, quirk: [] });
      const a = actionsHere().find(z => /opener/.test(z.l)); out.sub = a.s; out.primary = a.cls; a.fn();
      out.sheet = document.querySelector('#mbg h2').textContent; out.btns = MB.map(z => z.l);
      MBTN(MB.findIndex(z => /Guide today/.test(z.l))); out.open = !!document.getElementById('mbg'); out.status0 = b.status;
      // guide through it: the partner fishes the opener at night
      b.status = 'done'; const m0 = S.money; S.t = d * 1440 + 1300; endDay('home'); out.night = document.querySelector('#mbg').textContent; closeModals();
      out.partner = S.money - m0; out.done = GNS().done[d];
      // the next one: cancel the party and go
      toMorning(d2); closeModals(); const b2 = addBooking({ d: d2, type: 'trout', n: 2, who: 'second party', from: 'Iowa', res: false, quirk: [] });
      const rep0 = S.rep; actionsHere().find(z => /opener/.test(z.l)).fn(); MBTN(MB.findIndex(z => /Cancel/.test(z.l))); await new Promise(r => setTimeout(r, 5));
      out.status2 = b2.status; out.rep = S.rep - rep0; out.cancelRep = FISH_CANCEL_REP; out.sess = document.querySelector('#mbg h2').textContent; await playSheets(); out.done2 = GNS().done[d2];
      return out;
    });
    assert.match(r.sub, /test party/); assert.strictEqual(r.primary, ''); assert.match(r.sheet, /booked today/);
    assert.ok(r.btns.some(l => /Cancel the trip, and go/.test(l)) && r.btns.some(l => /Guide today instead/.test(l)), r.btns.join(' | '));
    assert.strictEqual(r.open, false); assert.strictEqual(r.status0, 'booked');
    assert.ok(r.partner > 0, `your partner's share ${r.partner}`); assert.match(r.night, /Your hired skipper ran the boat/); assert.ok(r.done.partner);
    assert.strictEqual(r.status2, 'cancelled'); assert.strictEqual(r.rep, -r.cancelRep); assert.strictEqual(r.cancelRep, 5); assert.match(r.sess, /Drift opener/); assert.ok(r.done2 && !r.done2.skipped);
    noErrors(errors);
  } },
  { name: 'game: a citation from the opener goes through the game’s own cite(): a fine, the record and the permit count', fn: async ctx => {
    const { page, errors } = await setup(ctx, 26);
    const r = await page.evaluate(() => {
      toWinter(2); GNS().did['set:crew'] = 1; openSeason('set:lease', { king: 'open', sock: 1 });
      const d = Object.keys(gnSched().days).map(Number).find(y => y > day() && Gillnet.fishable(gnDay(y))); toMorning(d); closeModals();
      const c0 = S.cites, w0 = S.warns, m0 = S.money;
      gnApply({ kind: 'set', role: 'lease', fish: 100, lbs: 600, gross: 1000, cashDelta: 500, energyDelta: -20, minutes: 600, cites: [{ what: Gillnet.data.CITE.late.what, fine: 1000, minor: false, who: 'a trooper' }], events: [], lines: ['x'], xp: 1 }, d);
      return { cites: S.cites - c0, paid: m0 + 500 - S.money, log: S.log.slice(-3).map(l => l.s).join(' '), g: GNS().tot.cites, warns: S.warns - w0 };
    });
    assert.strictEqual(r.cites, 1); assert.ok(r.paid >= 1000, `fine ${r.paid}`); assert.match(r.log, /set gillnets left fishing after the period closed/); assert.strictEqual(r.g, 1);
    noErrors(errors);
  } },
  { name: 'game: the setnet beach follows the kings: closed mornings (and a beach seine day), and a closed summer’s lease is money gone', fn: async ctx => {
    const { page, errors } = await setup(ctx, 27);
    const r = await page.evaluate(async () => {
      toWinter(2); GNS().did['set:crew'] = 1; openSeason('set:lease', { king: 'closed', sock: .9 });
      const out = { paid: GNS().plan.paid }, x = gnSched(); out.open = Object.values(x.days).filter(o => Gillnet.fishable(o)).length;
      const ds = Object.keys(x.days).map(Number).filter(y => y > day()).sort((a, b) => a - b), d = ds[0];
      toMorning(d); out.morning = document.querySelector('#mbg').textContent; closeModals(); out.acts = actionsHere().filter(a => /opener|seine/.test(a.l)).map(a => a.l);
      const sd = ds.find(y => x.days[y].seine);
      if (sd) { toMorning(sd); closeModals(); const a = actionsHere().find(z => /beach seine/.test(z.l)); out.seineAct = !!a; const m1 = S.money; a.fn(); await playSheets(); out.wage = S.money - m1; }
      out.rest = restOfSeason(curSeason()).gill || null;
      return out;
    });
    assert.strictEqual(r.paid, 2800); assert.strictEqual(r.open, 0, 'no setnet opener in a kings-closed season without a huge run');
    assert.match(r.morning, /No setnet opener today/); assert.ok(!r.acts.some(l => /opener/.test(l)));
    if (r.seineAct !== undefined) { assert.ok(r.seineAct); assert.strictEqual(r.wage, 180); }
    assert.ok(!r.rest || r.rest.net === 0, `nothing for the rest of a closed summer: ${JSON.stringify(r.rest)}`);
    noErrors(errors);
  } },
  { name: 'game: the rest of the summer: a lease adds its share to the season’s estimate and the winter recap; crew adds nothing', fn: async ctx => {
    const { page, errors } = await setup(ctx, 28);
    const r = await page.evaluate(() => {
      toWinter(2); GNS().did['drift:crew'] = 1; openSeason('drift:lease', { king: 'open', sock: 1.1 });
      const out = {}; const c = curSeason(); out.rest = restOfSeason(c).gill; out.base = _gnRestOfSeason(c).net; out.all = restOfSeason(c).net;
      S.book.filter(b => b.d >= day()).forEach(b => b.status = 'done'); toWinter(3); out.sup = (S.winter.sup || []).join(' '); out.tot = GNS().tot;
      out.crew = (() => { gnSetPlan('drift:crew'); return restOfSeason(curSeason()).gill || null; })();
      return out;
    });
    assert.ok(r.rest && r.rest.net > 0 && r.rest.periods > 0, JSON.stringify(r.rest)); assert.strictEqual(r.all, r.base + r.rest.net);
    assert.match(r.sup, /Gillnetting, 2028/); assert.match(r.sup, /the rest of the summer/); assert.match(r.sup, /up front/);
    assert.ok(r.tot.rest > 0); assert.strictEqual(r.crew, null);
    noErrors(errors);
  } },
  { name: 'game: old saves load: no S.fish at all, a broken one, a mid-off-season save already past its second season', fn: async ctx => {
    const { page, errors } = await setup(ctx, 29);
    const r = await page.evaluate(() => {
      const pack = x => JSON.parse(JSON.stringify(Object.assign(packSave(), { schema: 9, app: '1.18.0' }, x ? { S: x } : {})));
      const out = {};
      const a = pack(); delete a.S.fish; const m1 = migrate(a); out.a = m1.S.fish && m1.S.fish.gillnet && m1.S.fish.gillnet.v;
      const b = pack(); b.S.fish = 'nonsense'; S = migrate(b).S; out.b = (() => { try { return GNS().v; } catch (e) { return String(e); } })();
      toWinter(3); const c = pack(); delete c.S.fish; c.S.seasons = c.S.seasons.slice(0, 2); S = migrate(c).S; out.c = gnOn(); out.btn = fishWinterBtns().length; out.plan = gnPlan();
      winterModal(); out.ok = MB.some(x => /Commercial & crab/.test(x.l)); closeModals();
      return out;
    });
    assert.strictEqual(r.a, 1); assert.strictEqual(r.b, 1); assert.strictEqual(r.c, true, 'a save past its second season unlocks'); assert.strictEqual(r.btn, 1); assert.strictEqual(r.plan, null); assert.ok(r.ok);
    noErrors(errors);
  } },
  { name: 'game: pop-up budget: a planned week opens no pop-up of its own (the morning report only); the opener’s sheets come only when you tap it', fn: async ctx => {
    const { page, errors } = await setup(ctx, 30);
    const r = await page.evaluate(() => {
      toWinter(2); openSeason('drift:crew', { king: 'open', sock: 1.1 });
      let n = 0, titles = []; const M0 = window.modal; modal = (t, ...rest) => { n++; titles.push(t); return M0(t, ...rest); };
      try { for (let i = 0; i < 6; i++) { S.t = day() * 1440 + 1300; S.loc = 'shop'; endDay('home'); closeModals(); } } finally { modal = M0; }
      return { n, titles, days: 6, ann: S.log.filter(l => /ADF&G: tomorrow/.test(l.s)).length + 0 };
    });
    assert.ok(!r.titles.some(t => /opener|gillnet|setnet|drift|Trips booked|seine/i.test(t)), r.titles.join(' | '));
    assert.strictEqual(r.titles.filter(t => /Morning report/.test(t)).length, r.days, 'one morning report a day');
    noErrors(errors);
  } },
  { name: 'game: Help has one Commercial gillnetting section; the planner and the openers name no code words; the end screen has a row', fn: async ctx => {
    const { page, errors } = await setup(ctx, 31);
    const r = await page.evaluate(async () => {
      const h = HELP.filter(x => /gillnet/i.test(x[1])); toWinter(2); GNS().did['drift:crew'] = 1; openSeason('drift:lease', { king: 'cr', sock: 1 });
      const d = Object.keys(gnSched().days).map(Number).find(y => y > day() && Gillnet.fishable(gnDay(y))); toMorning(d); closeModals();
      actionsHere()[0].fn(); const sh = await playSheets(); const rows = endRows().filter(x => x[0] === 'Commercial fishing');
      return { n: h.length, k: h[0] && h[0][3], last: HELP[HELP.length - 1][3], text: sh.map(s => s.t + ' ' + s.b.join(' ')).join(' '), rows: rows.length };
    });
    assert.strictEqual(r.n, 1); assert.strictEqual(r.k, 'gillnet'); assert.strictEqual(r.last, 'feedback');
    assert.ok(!/undefined|NaN|null|\$\{|=>/.test(r.text), r.text); assert.strictEqual(r.rows, 1);
    noErrors(errors);
  } },
  { name: 'game: illustrations: the opener’s sheets ask for event pictures from "gillnet", and an enabled entry shows', fn: async ctx => {
    const { page, errors } = await setup(ctx, 32);
    const r = await page.evaluate(async () => {
      const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAASCAIAAAC1qksFAAAALElEQVR4XmPs33megZaAiZaGg8CoBQTBaBARBKNBRBCMBhFBMBpEBAHNgwgAvtgCO1o9jFEAAAAASUVORK5CYII=';
      ART.clear(); ART.register({ id: 't-gn', set: 'event', file: PNG, alt: 'A drift boat in a tide rip.', when: { event: ['gn_tide_rip', 'gn_low_tide_site'], from: 'gillnet' }, enabled: true });
      toWinter(2); openSeason('drift:crew', { king: 'open', sock: 1 });
      const d = Object.keys(gnSched().days).map(Number).find(y => y > day() && Gillnet.fishable(gnDay(y))); toMorning(d); closeModals();
      actionsHere()[0].fn(); const html = document.querySelector('#mbg').innerHTML; closeModals();
      return { fig: /data-art="t-gn"/.test(html), ctx: JSON.stringify(artEventCtx('gn_tide_rip', 'gillnet')), evs: Gillnet.data.EVENTS };
    });
    assert.ok(r.fig, 'the brief shows the drift boat in a tide rip'); assert.match(r.ctx, /"from":"gillnet"/);
    for (const id of ['gn_low_tide_site', 'gn_full_net', 'gn_tide_rip', 'gn_tender', 'gn_closed_morning']) assert.ok(r.evs.includes(id), id);
    noErrors(errors);
  } },
  { name: 'game: a gillnetting bot plays a whole career with no page errors, fishes openers, and never loses it to the fishery', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 33 });
    await page.addScriptTag({ path: path.join(ROOT, 'tools', 'sim', 'sim-lib.js') });
    const r = await page.evaluate(async () => { simSetup(); const a = await runCareer({ style: 'gillnet', diff: 'normal', years: 5, seed: 4242, over: { weeks: 'july' } }); return { loss: a.loss, err: a.errors, gn: a.gn, score: a.score }; });
    assert.deepStrictEqual(r.err, []); assert.strictEqual(r.loss, null);
    assert.ok(r.gn && r.gn.tot.openers + r.gn.tot.partner > 0, JSON.stringify(r.gn)); assert.strictEqual(r.gn.tot.cites, 0);
    noErrors(errors);
  } },
];
