// Purse seining (src/seine/, the Seine module; src/js/43-seine.js, the Guide Master adapter).
// The first half runs the module on its own in Node, in an empty `vm` context, with no browser and no Guide Master;
// the second half plays the adapter in the real game.
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const { open, newGame, noErrors, assert } = require('./helpers');

const ROOT = path.resolve(__dirname, '..'), DIR = path.join(ROOT, 'src', 'seine');
const FILES = fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort();
const SRC = FILES.map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');
function load() {
  const ctx = vm.createContext({});
  const before = new Set(vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx));
  const K = vm.runInContext(SRC + '\n;Seine', ctx);
  const added = vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx).filter(k => !before.has(k));
  return { K, added };
}
const { K } = load();
const D = K.data, J = o => JSON.parse(JSON.stringify(o));
const st = o => Object.assign(K.newState(), o || {});
const tk = o => Object.assign({ role: 'crew', state: st(), md: 715, dow: 2, year: 2028, season: 2, wind: 9, cash: 9000, energy: 80, costMult: 1, bad: 1, late: 0, diesel: 5.6, dayTxt: 'Wednesday, July 15' }, o || {});
const sims = (n, o, pol) => Array.from({ length: n }, (_, i) => K.sim({ ticket: tk(typeof o === 'function' ? o(i) : o), seed: i + 1, policy: pol || 'careful' }).report);
const avg = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
// the game: a 5-year game rolled into its 2nd off-season, with cash
async function secondWinter(ctx, seed) {
  const o = await open(ctx, { seed: seed || 12345 });
  await o.page.evaluate(async () => {
    setPref('years', 5); newGame('normal'); closeModals(); S.money = 30000;
    for (let s = 0; s < 2; s++) { S.cur = s * 14 + 13; S.t = S.cur * 1440 + 1300; S.loc = 'shop'; S.book.forEach(b => { if (b.status === 'booked') b.status = 'done'; }); endDay('home'); await new Promise(r => setTimeout(r, 5)); closeModals(); if (s === 0) { finishWinter(); closeModals(); } }
  });
  return o;
}
// pick a plan in the winter and open the bookings
const planAndOpen = (page, id) => page.evaluate(id => { const r = Seine.plan(seineWinterTicket(), id); seinePlanApply(r); closeModals(); finishWinter(); closeModals(); render(); return SN().ops.length; }, id);

module.exports = [
  // ---------- the module on its own ----------
  { name: 'boundary: src/seine never names the game, its pop-ups, clock, saves or storage, and adds one global', fn: async () => {
    for (const f of FILES) {
      const h = fs.readFileSync(path.join(DIR, f), 'utf8');
      for (const [re, what] of [[/\bS\./, 'S.'], [/\bS\[/, 'S['], [/\bmodal\s*\(/, 'modal('], [/\bGAME\b/, 'GAME'], [/\bMIGRATIONS\b/, 'MIGRATIONS'], [/\bAPP_VERSION\b/, 'APP_VERSION'], [/\blocalStorage\b/, 'localStorage'], [/\bdocument\b/, 'document'], [/\bwindow\b/, 'window'], [/\bsay\s*\(/, 'say('], [/\bmoney\s*\(/, 'money('], [/Math\.random/, 'Math.random']])
        assert.ok(!re.test(h), `${f} mentions ${what}`);
    }
    const r = load(); assert.deepStrictEqual(J(r.added), [], 'nothing leaks onto the global object'); assert.strictEqual(K.SCHEMA, 1);
    assert.strictEqual(vm.runInContext('typeof S + typeof modal + typeof GAME', vm.createContext({})), 'undefinedundefinedundefined');
    ['session', 'start', 'sim', 'schedule', 'isOpen', 'plan', 'planOptions', 'newState', 'normState', 'year'].forEach(k => assert.strictEqual(typeof K[k], 'function', k));
  } },
  { name: 'boundary: the build puts src/seine after src/home and before src/js, --check passes; the README states the contract and sources', fn: async () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const a = html.indexOf('const CabinUpkeep='), b = html.indexOf('const Seine='), c = html.indexOf('function seineApply');
    assert.ok(a > 0 && b > a && c > b, `order ${a} ${b} ${c}`);
    assert.ok(/const Seine=/.test(fs.readFileSync(path.join(ROOT, 'offline', 'guidemaster-offline.html'), 'utf8')));
    assert.strictEqual(cp.spawnSync('python3', ['tools/build.py', '--check'], { cwd: ROOT }).status, 0);
    const md = fs.readFileSync(path.join(DIR, 'README.md'), 'utf8');
    assert.ok(/ticket/i.test(md) && /report/i.test(md) && /SCHEMA/.test(md) && /Facts and sources/.test(md) && /adfg\.alaska\.gov/.test(md) && /cfec/i.test(md));
  } },
  { name: 'schedule: Monday, Wednesday and Friday from mid-June; after July only in a fair pink year; closures flagged; the same every time', fn: async () => {
    for (let y = 2027; y < 2045; y++) {
      const Y = K.year(y), days = [];
      for (let md of [610, 612, 615, 616, 617, 618, 619, 620, 621, 701, 713, 714, 715, 716, 717, 718, 719, 729, 731, 803, 805, 807, 817, 819, 821, 908, 910]) for (let dow = 0; dow < 7; dow++) days.push({ d: days.length, md, dow });
      const sc = K.schedule({ year: y, days });
      assert.deepStrictEqual(J(sc), J(K.schedule({ year: y, days })), 'deterministic');
      sc.forEach(o => {
        assert.ok(D.DAYS.includes(o.dow), `day of week ${o.dow}`); assert.ok(o.md >= 615 && o.md <= 831, `date ${o.md}`);
        if (o.md > 731) assert.ok(!Y.bust && Y.pink >= .6, `August needs pinks (${y})`);
        assert.strictEqual(typeof o.eo, 'boolean'); assert.ok(o.run.length > 3);
      });
      for (const md of [713, 715, 717]) assert.strictEqual(sc.filter(o => o.md === md).length, 3, `the regular July schedule on ${md}`);
    }
    const eo = []; for (let y = 2027; y < 2127; y++) eo.push(K.schedule({ year: y, days: [{ d: 0, md: 715, dow: 2 }] })[0].eo);
    const f = eo.filter(Boolean).length / eo.length; assert.ok(f > .02 && f < .25, `emergency closures now and then: ${f}`);
    const busts = Array.from({ length: 200 }, (_, i) => K.year(2027 + i).bust).filter(Boolean).length; assert.ok(busts > 30 && busts < 90, `pink busts ${busts}`);
  } },
  { name: 'opener: every policy finishes, the report is well formed, and the money adds up (crew share, skipper shares, costs off the top)', fn: async () => {
    for (const pol of ['first', 'random', 'careful', 'greedy']) for (const role of ['crew', 'skip']) {
      for (let i = 0; i < 60; i++) {
        const o = K.sim({ ticket: tk({ role, md: [617, 701, 715, 722, 805][i % 5], wind: [6, 12, 20, 27][i % 4], state: st({ crewOps: 6, skill: 30 }), late: i % 9 === 0 ? 40 : 0 }), seed: 100 + i, policy: pol });
        assert.ok(o.finished, `${pol} ${role} ${i} finished in ${o.steps}`);
        const r = o.report;
        for (const k of ['cashDelta', 'gross', 'lbs', 'sets', 'energyDelta', 'minutes', 'end']) assert.ok(Number.isFinite(r[k]), `${k} ${r[k]}`);
        assert.ok(r.end <= 1425 && r.end >= 360, `back by 11:45 PM: ${r.end}`);
        r.events.forEach(e => assert.ok(D.EVENTS.includes(e.id), `event ${e.id}`));
        const rows = r.rows.slice(role === 'crew' ? 2 : 0).reduce((a, x) => a + x[1], 0);
        if (role === 'skip') assert.strictEqual(rows, r.cashDelta, `skipper rows add up: ${JSON.stringify(r.rows)}`);
        else { const share = r.rows.find(x => /crew share/.test(x[0])); assert.ok(!share || share[1] === Math.max(0, Math.round((r.gross - r.offTop) * (share[0].includes('10%') ? .1 : .08))) || r.missed || r.stayed, JSON.stringify(r.rows)); assert.ok(r.cashDelta <= (share ? share[1] : 0)); }
        if (r.missed || r.stayed) assert.strictEqual(r.lbs, 0);
        assert.ok(r.lbs === Math.round(r.fish.sockeye * D.WT.sockeye) + Math.round(r.fish.pink * D.WT.pink) + Math.round(r.fish.chum * D.WT.chum));
      }
    }
  } },
  { name: 'opener: sockeye pay, pinks pay little; a careful skipper beats a greedy one; crew shares are small and steady', fn: async () => {
    const crewJul = sims(300, i => ({ md: 715 + (i % 7), year: 2027 + (i % 12) })), crewAug = sims(300, i => ({ md: 805, year: 2027 + (i % 12) }));
    const skipC = sims(300, i => ({ role: 'skip', md: 715 + (i % 7), year: 2027 + (i % 12), state: st({ crewOps: 6, skill: 30 }) }));
    const skipG = sims(300, i => ({ role: 'skip', md: 715 + (i % 7), year: 2027 + (i % 12), state: st({ crewOps: 6, skill: 30 }) }), 'greedy');
    const m = a => avg(a.map(r => r.cashDelta));
    assert.ok(m(crewJul) > 150 && m(crewJul) < 600, `July crew share ${m(crewJul)}`);
    assert.ok(m(crewAug) < m(crewJul), 'August pinks pay less');
    assert.ok(m(skipC) > m(skipG), `careful ${m(skipC)} > greedy ${m(skipG)}`);
    assert.ok(m(skipC) > 300 && m(skipC) < 2000, `a July opener as skipper ${m(skipC)}`);
    const neg = skipC.filter(r => r.cashDelta < 0).length / skipC.length; assert.ok(neg > .03 && neg < .35, `some days lose money: ${neg}`);
    const sd = a => { const x = m(a); return Math.sqrt(avg(a.map(r => (r.cashDelta - x) ** 2))) };
    assert.ok(sd(skipC) > sd(crewJul) * 2, 'running your own is riskier than crewing');
    // the pinks: a pound of pink salmon is worth about a ninth of a pound of sockeye
    assert.ok(D.PRICE.sockeye / D.PRICE.pink > 6);
  } },
  { name: 'safety and risks: weather calls, a late crewman, injuries with hurry, a citation inside the line', fn: async () => {
    let s = K.session(tk({ role: 'skip', wind: 28, state: st({ crewOps: 5 }) }), { rand: K.util.seeded(1) });
    assert.deepStrictEqual(J(s.view().buttons.map(b => b.id)), ['go', 'wait', 'stay']);
    s.choose('stay'); let r = s.report(); assert.ok(r.stayed && r.cashDelta === 0 && r.events.some(e => e.id === 'stay_in'));
    s = K.session(tk({ wind: 28 }), { rand: K.util.seeded(1) }); assert.deepStrictEqual(J(s.view().buttons.map(b => b.id)), ['go', 'begoff']);
    s = K.session(tk({ late: 45 }), { rand: K.util.seeded(1) }); assert.deepStrictEqual(J(s.view().buttons.map(b => b.id)), ['missed']);
    s.choose('missed'); while (!s.done) s.choose(s.view().buttons[0].id); r = s.report(); assert.ok(r.missed && r.cashDelta === 0 && r.state.tot.missed === 1);
    // greedy crew get hurt more often; a careful hand rarely
    const inj = pol => sims(400, { wind: 20 }, pol).filter(x => x.events.some(e => /injury/.test(e.id))).length / 400;
    const a = inj('careful'), b = inj('greedy'); assert.ok(a < .08 && b > a * 2, `injuries careful ${a} greedy ${b}`);
    // setting inside a closed line: sometimes a citation (a fine for the skipper, a violation, reputation), the set's fish seized
    const g = sims(200, i => ({ role: 'skip', state: st({ crewOps: 5 }), md: 715 }), 'greedy');
    const cited = g.filter(x => x.fines.length); assert.ok(cited.length > 10, `citations ${cited.length}`);
    cited.forEach(x => { assert.ok(x.viol >= 1 && x.repDelta < 0); assert.ok(x.rows.some(rw => rw[0] === 'Fine')) });
  } },
  { name: 'winter plan: crew first; run your own after a few openers; buy and sell a permit; season costs are paid once', fn: async () => {
    const t = o => Object.assign({ state: K.newState(), season: 2, year: 2028, cash: 60000, costMult: 1 }, o || {});
    let o = K.planOptions(t()); const ids = o.map(x => x.id);
    assert.deepStrictEqual(J(ids.slice(0, 2)), ['none', 'crew']); assert.ok(o.find(x => x.id.startsWith('skip')).dis, 'no boat of your own before you crew'); assert.ok(o.find(x => x.id === 'buy').dis);
    let r = K.plan(t(), 'crew'); assert.strictEqual(r.cashDelta, -(D.SEASON.license + D.SEASON.gear)); assert.strictEqual(r.state.plan.role, 'crew'); assert.ok(r.state.gear);
    let r2 = K.plan(t({ state: r.state }), 'none'); assert.strictEqual(r2.cashDelta, 0);
    r2 = K.plan(t({ state: r2.state }), 'crew'); assert.strictEqual(r2.cashDelta, 0, 'the license and the gear are paid once a season');
    r2 = K.plan(t({ state: r2.state, season: 3 }), 'crew'); assert.strictEqual(r2.cashDelta, -D.SEASON.license, 'gear lasts; the license is yearly');
    const vet = Object.assign(K.newState(), { crewOps: D.SKILL_TO_SKIP });
    let y = 2027; while (K.year(y) && !(K.planOptions(t({ state: vet, year: y })).find(x => x.id === 'skip:transfer') || {}).dis === false) y++;
    const sk = K.plan(t({ state: vet, year: y }), 'skip:transfer'); assert.ok(sk && sk.state.plan.role === 'skip' && sk.state.plan.route === 'transfer'); assert.ok(sk.cashDelta < -2000, `insurance and the Coast Guard exam ${sk.cashDelta}`);
    const b = K.plan(t({ state: vet }), 'buy'); assert.strictEqual(b.cashDelta, -D.PERMIT.price); assert.ok(b.state.permit);
    const own = K.planOptions(t({ state: b.state })); assert.ok(own.some(x => x.id === 'skip:own' && !x.dis) && own.some(x => x.id === 'sell'));
    const sl = K.plan(t({ state: b.state }), 'sell'); assert.ok(sl.cashDelta >= D.PERMIT.price * .9 && sl.cashDelta <= D.PERMIT.price); assert.ok(!sl.state.permit);
    assert.strictEqual(K.plan(t({ cash: 100 }), 'crew'), null, 'not enough cash');
  } },
  // ---------- the game ----------
  { name: 'game: unlocks in the 2nd off-season under Commercial & crab, not the 1st; the plan pays up front', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const r = await page.evaluate(async () => {
      setPref('years', 5); newGame('normal'); closeModals(); S.money = 30000; const out = {};
      for (let s = 0; s < 2; s++) { S.cur = s * 14 + 13; S.t = S.cur * 1440 + 1300; S.loc = 'shop'; S.book.forEach(b => { if (b.status === 'booked') b.status = 'done'; }); endDay('home'); await new Promise(r => setTimeout(r, 5)); closeModals();
        winterModal(); out['w' + s] = MB.some(b => /Commercial & crab/.test(b.l)); closeModals(); if (s === 0) { finishWinter(); closeModals(); } }
      winterModal(); MBTN(MB.findIndex(b => /Commercial & crab/.test(b.l))); await new Promise(r => setTimeout(r, 5));
      out.hub = MB.map(b => b.l); (MB.some(b => /Purse seining/.test(b.l)) ? MBTN(MB.findIndex(b => /Purse seining/.test(b.l))) : 0); await new Promise(r => setTimeout(r, 5));
      out.plan = MB.map(b => b.l); const m0 = S.money; MBTN(MB.findIndex(b => /^Crew on/.test(b.l))); await new Promise(r => setTimeout(r, 5));
      out.paid = m0 - S.money; out.on = MB.find(b => /^✅/.test(b.l)).l; out.role = SN().st.plan.role;
      return out;
    });
    assert.strictEqual(r.w0, false, 'not in the first off-season'); assert.strictEqual(r.w1, true);
    assert.ok(r.hub.some(l => /Purse seining/.test(l)) || r.plan.some(l => /Not this summer/.test(l)), r.hub.join(' | '));
    assert.ok(r.plan.some(l => /Not this summer/.test(l)) && r.plan.some(l => /emergency transfer/.test(l)), r.plan.join(' | '));
    assert.strictEqual(r.paid, 400); assert.match(r.on, /Crew on/); assert.strictEqual(r.role, 'crew');
    noErrors(errors);
  } },
  { name: 'game: openers in Bookings; sign on, conflicts with a booked trip are a real choice, and a signed day takes no requests', fn: async ctx => {
    const { page, errors } = await secondWinter(ctx);
    const n = await planAndOpen(page, 'crew'); assert.ok(n >= 3, `openers ${n}`);
    const r = await page.evaluate(() => {
      const out = {}, F = SN(), d = day();
      tab = 'book'; render(); out.sect = !!document.querySelector('.req') && /Seine openers/.test(document.body.textContent);
      const busy = F.ops.find(o => !o.done && o.d > d && seineMine(o.d).length), free = F.ops.find(o => !o.done && o.d > d && !seineMine(o.d).length);
      if (busy) { out.busy = seineOpts(busy).map(x => x.l); const rep0 = S.rep, k = seineOpts(busy).findIndex(x => /cancel/.test(x.l)); seineAns(busy.d, k); out.cancel = { ans: busy.ans, rep: rep0 - S.rep, left: seineMine(busy.d).length }; }
      if (!free) { const o = F.ops.find(o => !o.done && o.d > d && o !== busy); S.book.filter(b => b.d === o.d).forEach(b => b.status = 'cancelled'); out.freeD = o.d; } else out.freeD = free.d;
      const f = seineOp(out.freeD); out.freeOpts = seineOpts(f).map(x => x.l); seineAns(f.d, 0); out.signed = f.ans;
      out.conf = conflicts(f.d, 'reds'); out.confAsst = conflicts(f.d, 'reds', true);
      // requests skip the day
      let hit = 0; for (let i = 0; i < 200; i++) { const q = makeRequest(); if (q && q.d === f.d && !q.asst && q.kind !== 'dipnet') hit++; } out.reqHit = hit;
      out.todo = todoItems().map(x => x.l).join(' | ');
      return out;
    });
    assert.ok(r.sect, 'a Seine openers section at the top of Bookings');
    if (r.busy) { assert.ok(r.busy.some(l => /cancel/.test(l)) && r.busy.some(l => /Pass/.test(l)), r.busy.join(' | ')); assert.deepStrictEqual(r.cancel, { ans: 'yes', rep: 5 * (r.cancel.rep / 5), left: 0 }); assert.ok(r.cancel.rep >= 5); }
    assert.ok(/Sign on/.test(r.freeOpts[0])); assert.strictEqual(r.signed, 'yes'); assert.strictEqual(r.conf, true); assert.strictEqual(r.confAsst, false);
    assert.strictEqual(r.reqHit, 0, 'no requests for your own lane on a signed day');
    noErrors(errors);
  } },
  { name: 'game: the opener day: drive down and sleep aboard, play the opener, get paid, and a no-show is remembered', fn: async ctx => {
    const { page, errors } = await secondWinter(ctx);
    await planAndOpen(page, 'crew');
    const r = await page.evaluate(async () => {
      const W = ms => new Promise(r => setTimeout(r, ms)), out = { log: [] }, F = SN();
      document.documentElement.classList.add('rm');
      const o = F.ops.find(x => !x.eo && x.d > day() + 1); S.book = S.book.filter(b => b.d !== o.d && b.d !== o.d - 1); o.ans = 'yes';
      S.cur = o.d - 1; S.t = S.cur * 1440 + 19 * 60; S.loc = 'shop'; closeModals();
      const a = actionsHere().find(x => /sleep aboard/.test(x.l)); out.eve = !!a; a.fn(); await W(2500); closeModals();
      out.morning = [day() === o.d, S.loc];
      const go = actionsHere()[0]; out.act = go.l; const m0 = S.money, c0 = F.st.crewOps; go.fn(); await W(300);
      let g = 0; while (document.getElementById('mbg') && g++ < 40) { const t = document.querySelector('#mbg h2').textContent; out.log.push(t); if (/Back in Homer/.test(t)) break; MBTN(0); await W(20); }
      out.res = o.res; out.paid = Math.round(S.money - m0); out.crewOps = SN().st.crewOps - c0; out.late = tod() >= 22 * 60;
      MBTN(0); await W(50); closeModals(); out.next = [day(), S.loc];
      // a no-show: sign on for the next opener and never go
      const n = F.ops.find(x => !x.done && !x.eo && x.d > day()); if (n) { S.book = S.book.filter(b => b.d !== n.d); n.ans = 'yes'; const cap = Seine.captain(2026 + seasonOf(n.d), SN().st).i, r0 = SN().st.respect[cap] || 0;
        S.cur = n.d; S.t = S.cur * 1440 + 20 * 60; S.loc = 'shop'; endDay('home'); await W(5); closeModals(); out.noshow = [n.res && n.res.missed, (SN().st.respect[cap] || 0) - r0]; }
      return out;
    });
    assert.ok(r.eve); assert.deepStrictEqual(r.morning, [true, 'homer']); assert.match(r.act, /Seine opener/);
    assert.match(r.log[0], /Homer harbor/); assert.ok(r.log.some(t => /Fish ticket|in port/.test(t)), r.log.join(' | '));
    assert.ok(r.res && !r.res.missed, JSON.stringify(r.res)); assert.strictEqual(r.crewOps, 1); assert.ok(r.late, 'a long day');
    assert.strictEqual(r.next[1], 'homer', 'slept aboard');
    if (r.noshow) assert.deepStrictEqual(r.noshow, [true, -2]);
    noErrors(errors);
  } },
  { name: 'game: a late crewman is left at the dock; running your own boat late just starts late', fn: async ctx => {
    const { page, errors } = await secondWinter(ctx);
    await planAndOpen(page, 'crew');
    const r = await page.evaluate(async () => {
      const F = SN(), o = F.ops.find(x => !x.eo && x.d > day()); S.book = S.book.filter(b => b.d !== o.d); o.ans = 'yes';
      S.cur = o.d; S.t = S.cur * 1440 + 330; S.loc = 'shop'; closeModals();
      const t = seineTicket(o, Math.max(0, tod() + travelMins('shop', 'homer') - SEINE_MEET)), s = Seine.session(t, { rand: () => .5 });
      return { late: t.late, btn: s.view().buttons.map(b => b.id) };
    });
    assert.ok(r.late > 30, `85 minutes from the shop at 5:30 AM: ${r.late}`); assert.deepStrictEqual(r.btn, ['missed']);
    noErrors(errors);
  } },
  { name: 'migration: an old save with no fishing state loads and plays, and the plan defaults to none', fn: async ctx => {
    const { page, errors } = await secondWinter(ctx);
    const r = await page.evaluate(() => {
      const d = JSON.parse(JSON.stringify(packSave())); delete d.S.fish; d.app = '1.18.0';
      const m = migrate(d); adopt(m); closeModals();
      const out = { fish: typeof S.fish, seine: S.fish && S.fish.seine && S.fish.seine.st.plan.role, schema: m.schema };
      winterModal(); out.btn = MB.some(b => /Commercial & crab/.test(b.l)); closeModals();
      finishWinter(); closeModals(); out.ops = SN().ops.length; out.acts = actionsHere().length > 0; render();
      const d2 = JSON.parse(JSON.stringify(packSave())); d2.S.fish = { seine: { v: 1, st: { plan: { s: 3, role: 'crew' } } } };
      const m2 = migrate(d2); out.norm = Seine.normState(m2.S.fish.seine.st).tot.fish.sockeye;
      return out;
    });
    assert.deepStrictEqual(r, { fish: 'object', seine: 'none', schema: r.schema, btn: true, ops: 0, acts: true, norm: 0 });
    noErrors(errors);
  } },
  { name: 'pop-up budget: openers never open a pop-up on their own: one morning report a day, the rest in Bookings and the log', fn: async ctx => {
    const { page, errors } = await secondWinter(ctx);
    await planAndOpen(page, 'crew');
    const r = await page.evaluate(async () => {
      let n = 0; const m0 = modal; modal = function () { n++; return m0.apply(this, arguments) };
      const per = [];
      try { for (let i = 0; i < 6; i++) { n = 0; S.t = S.cur * 1440 + 1300; S.loc = 'shop'; S.book.forEach(b => { if (b.d === day() && b.status === 'booked') b.status = 'done' }); endDay('home'); await new Promise(r => setTimeout(r, 5)); per.push(n); closeModals(); } }
      finally { modal = m0 }
      return { per, log: S.log.slice(-200).map(l => l.s).filter(s => /seine|ADF&G/.test(s)).length };
    });
    r.per.forEach(n => assert.strictEqual(n, 1, `pop-ups a morning: ${r.per}`));
    noErrors(errors);
  } },
  { name: 'default bots never touch it: a career that never picks it draws nothing from the module; the seine bot does', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await page.addScriptTag({ path: path.join(ROOT, 'tools', 'sim', 'sim-lib.js') });
    const r = await page.evaluate(async () => {
      simSetup(); const c = { schedule: 0, session: 0, start: 0 };
      for (const k of Object.keys(c)) { const f = Seine[k]; Seine[k] = function () { c[k]++; return f.apply(this, arguments) } }
      const a = await runCareer({ style: 'food', diff: 'normal', years: 5, seed: 4242 }); const c1 = JSON.parse(JSON.stringify(c));
      const b = await runCareer({ style: 'seineall', diff: 'normal', years: 5, seed: 4242 });
      return { c1, c2: c, a: { err: a.errors, seine: a.seine }, b: { err: b.errors, seine: b.seine } };
    });
    assert.deepStrictEqual(r.c1, { schedule: 0, session: 0, start: 0 }); assert.deepStrictEqual(r.a.err, []); assert.strictEqual(r.a.seine.ops, 0);
    assert.ok(r.c2.schedule > 0 && r.c2.session > 0, JSON.stringify(r.c2)); assert.deepStrictEqual(r.b.err, []); assert.ok(r.b.seine.ops > 0, JSON.stringify(r.b.seine));
    noErrors(errors);
  } },
  { name: 'help: a Purse seining section; the numbers it quotes are the game’s', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const r = await page.evaluate(() => { const h = HELP.find(x => x[3] === 'seine'); return { t: h && h[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' '), i: HELP.indexOf(h), n: HELP.length, meet: SEINE_MEET, unlock: SEINE_UNLOCK, share: Seine.data.SHARE, open: Seine.data.OPEN, close: Seine.data.CLOSE, days: Seine.data.DAYS } });
    assert.ok(r.t, 'a section'); assert.strictEqual(r.i, r.n - 2, 'just before Feedback');
    assert.match(r.t, new RegExp(['first', 'second', 'third'][r.unlock - 1] + ' off-season'));
    const sh = r.t.match(/(\d+) to (\d+)%/); assert.deepStrictEqual([+sh[1], +sh[2]], [r.share.green * 100, r.share.hand * 100]);
    assert.strictEqual(r.meet, 360); assert.match(r.t, /by 6:00 AM/); assert.deepStrictEqual([r.open, r.close], [360, 1320]); assert.match(r.t, /6 AM to 10 PM/);
    assert.deepStrictEqual(r.days, [0, 2, 4]); assert.match(r.t, /Monday, Wednesday and Friday/);
    noErrors(errors);
  } },
];
