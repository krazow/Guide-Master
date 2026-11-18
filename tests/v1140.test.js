// Version 1.14.0: more of the summer. Pick two weeks of the summer to guide (June kings, the July peak, August silvers,
// September rainbows), with each week's dates, rules, runs and trips; the rest of the summer scaled to match; season goals; big-day requests.
const { open, newGame, noErrors, assert } = require('./helpers');

// helpers put in the page: end season 1 into the off-season, optionally pick weeks for season 2 and open its bookings
const install = () => {
  window.toWinter = () => {
    closeModals(); clearTiles(); S.money = 30000; S.cur = 13; S.t = 13 * 1440 + 1300; S.loc = 'shop';
    S.book.forEach(b => { if (b.status === 'booked') b.status = 'done'; if (!b.out) b.out = { happy: 70, fish: 4, line: 'x', fare: 1000, refund: 0, tip: 0, net: 1000 }; });
    endDay('home'); closeModals();
  };
  window.season2 = (weeks, king) => {
    toWinter(); if (king) S.reg.king = king;
    if (weeks) weeksSet(1, weeks);
    closeModals(); finishWinter(); closeModals();
  };
};

module.exports = [
  // ---- picking the weeks ----
  { name: 'weeks: season 1 is the July peak; the off-season summary offers a week pick that toggles two weeks and books them', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 21 });
    await page.evaluate(() => setPref('years', 5));
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(async () => {
      const s1 = [dlongY(0), dlongY(13), weeksOf(0).join(','), weekGap(0)];
      toWinter(); await new Promise(r => setTimeout(r, 10));
      const tap = async re => { MBTN(MB.findIndex(b => re.test(b.l))); await new Promise(r => setTimeout(r, 5)); };
      closeModals(); winterModal();
      const opt = MB.some(b => /Your weeks for 2027/.test(b.l));
      await tap(/Your weeks for 2027/);
      const m1 = { title: document.querySelector('#mbg h2').textContent, btns: MB.map(b => b.l) };
      // choose June, then August: the first July week drops out (two in all)
      await tap(/June/);
      const after1 = MB.map(b => b.l);
      await tap(/August/);
      const after2 = MB.map(b => b.l), doneOk = !MB[MB.length - 1].dis;
      MBTN(MB.length - 1); await new Promise(r => setTimeout(r, 5));
      const back = document.querySelector('#mbg h2').textContent;
      closeModals(); finishWinter(); closeModals();
      return { s1, opt, m1, after1, after2, doneOk, back, weeks: weeksOf(1), d14: dlongY(14), d21: dlongY(21), types: [...new Set(S.book.filter(b => seasonOf(b.d) === 1).map(b => weekIdOf(b.d) + ':' + b.type))].sort() };
    });
    assert.deepStrictEqual(r.s1, ['Monday, July 13, 2026', 'Sunday, July 26, 2026', 'jul1,jul2', false]);
    assert.ok(r.opt, 'the off-season summary has the week pick');
    assert.match(r.m1.title, /Your two weeks · 2027/);
    assert.strictEqual(r.m1.btns.length, 6, 'five weeks and Done: ' + r.m1.btns.join(' | '));
    assert.ok(/✅ <span class="sr-only">Chosen: <\/span>.*July peak, week 1/.test(r.m1.btns[1]) && /✅ <span class="sr-only">Chosen: <\/span>.*July peak, week 2/.test(r.m1.btns[2]), 'last pick (July) starts chosen');
    assert.ok(/✅ <span class="sr-only">Chosen: <\/span>.*June/.test(r.after1[0]) && /⬜/.test(r.after1[1]), 'a third pick replaces the oldest');
    assert.ok(r.doneOk && /Off-season/.test(r.back), 'Done goes back to the off-season summary');
    assert.deepStrictEqual(r.weeks, ['june', 'aug']);
    assert.strictEqual(r.d14, 'Monday, June 14, 2027'); assert.strictEqual(r.d21, 'Monday, August 16, 2027');
    assert.ok(r.types.every(t => /^june:(king|trout|halibut)$|^aug:(silver|trout|halibut)$/.test(t)), 'each week books its own trips: ' + r.types.join(' '));
    assert.ok(r.types.includes('aug:silver'), 'silvers in August');
    noErrors(errors);
  } },
  { name: 'weeks: the June week books king trips when kings are catch-and-release, and trout floats instead when kings are closed', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 22 });
    await page.evaluate(() => setPref('years', 5));
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      season2(['june', 'jul1'], 'cr');
      const open = S.book.filter(b => seasonOf(b.d) === 1 && sday(b.d) < 7).map(b => b.type);
      const reqTypes = weekReqTypes(16), asst = weekAsstTypes(16);
      S.reg.king = 'closed';
      return { open, reqTypes, asst, closedReq: weekReqTypes(16), closedAsst: weekAsstTypes(16), swap: weekType('reds', 16), swapAug: weekType('reds', 30) };
    });
    assert.ok(r.open.includes('king'), 'king trips booked: ' + r.open.join(','));
    assert.ok(r.open.every(t => ['king', 'trout', 'halibut'].includes(t)), 'only June trips in June: ' + r.open.join(','));
    assert.ok(r.reqTypes.includes('king') && !r.reqTypes.includes('reds'));
    assert.ok(!r.closedReq.includes('king') && r.closedReq.includes('trout') && !r.closedAsst.includes('king'));
    assert.strictEqual(r.swap, 'trout', 'a sockeye booking in a closed-king June becomes a trout float');
    noErrors(errors);
  } },

  // ---- dates and rules follow the week ----
  { name: 'dates & regs: Sunday/Monday closure, 6 PM rule, bait, halibut closed days and dipnetting follow the played week’s date', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 23 });
    await page.evaluate(() => setPref('years', 5));
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      const jul = { sunmon: isSunMon(6) && isSunMon(7), hal: REG().hal.closed.length ? halClosed(REG().hal.closed[0]) : true, bait: noBait(1), dip: dipOpen(1) };
      season2(['aug', 'sep'], 'closed'); S.reg.hal.closed = [1, 2];
      const aug = { label: dlabel(14), hud: hudDay(14), sunmon: isSunMon(20) || isSunMon(21), hal: halClosed(15), bait: noBait(15), dip: dipOpen(15), six: guideDaysRule(15) };
      S.cur = 22; const sep = { label: dlabel(21), hal: halClosed(22), sun: SCENE.sun };
      S.cur = 15; S.t = 15 * 1440 + 400; tab = 'regs';
      const regs = regsView().replace(/<[^>]+>/g, ' ');
      S.loc = 'kbeach'; const dip = actionsHere().find(a => /Dipnet/.test(a.l));
      return { jul, aug, sep, regs, dip: dip && [dip.dis, dip.s] };
    });
    assert.deepStrictEqual(r.jul, { sunmon: true, hal: true, bait: true, dip: true });
    assert.strictEqual(r.aug.label, 'Mon Aug 16'); assert.match(r.aug.hud, /Aug 16, 2027/);
    assert.strictEqual(r.aug.sunmon, false, 'guide boats may fish Sundays and Mondays after Jul 31');
    assert.strictEqual(r.aug.hal, true, 'closed charter days still run in August');
    assert.strictEqual(r.aug.bait, false, 'Tuesday Aug 17: the no-bait rule ended Aug 15');
    assert.strictEqual(r.aug.six, false); assert.strictEqual(r.aug.dip, false);
    assert.strictEqual(r.sep.label, 'Mon Sep 6'); assert.strictEqual(r.sep.hal, false, 'no closed halibut days in September');
    assert.ok(r.sep.sun[0] > 400 && r.sep.sun[1] < 1300, 'short September days');
    assert.match(r.regs, /This week/); assert.match(r.regs, /After Jul 31/);
    assert.ok(r.dip[0] && /Jul 10–31/.test(r.dip[1]), 'the dipnet beach is closed in August');
    noErrors(errors);
  } },
  { name: 'dates & regs: no bait rule ends Aug 15; a booked silver trip after July has no 6 PM step and no Sunday closure issue', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 24 });
    await page.evaluate(() => setPref('years', 5));
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      season2(['jul1', 'aug'], 'closed');
      const tue = 22;   // Tuesday of the August week (Aug 17, 2027)
      const md = mdOf(tue), bait = noBait(tue), gear = (S.cur = tue, gearRuleTxt());
      closeModals(); S.cur = 21; S.t = 21 * 1440 + 700; S.loc = 'lower'; S.fuel = 30; S.energy = 80; S.book = S.book.filter(b => b.d !== 21);
      const b = addBooking({ d: 21, type: 'silver', n: 3, who: 'test party', from: 'Ohio', res: false, quirk: [] });
      const iss = issueOf(b); tripStart(b);
      const steps = S.trip.steps.slice(), name = TRIPS.silver.n;
      closeModals(); S.trip = null;
      return { md, bait, gear, iss, steps, name };
    });
    assert.strictEqual(r.md, 817); assert.strictEqual(r.bait, false); assert.match(r.gear, /bait and treble hooks are legal again/);
    assert.strictEqual(r.iss, null, 'a Monday silver trip in August breaks no rule');
    assert.ok(!r.steps.includes('sixpm') && !r.steps.includes('issue_sunmon'), r.steps.join(','));
    assert.strictEqual(r.name, 'Silver trip');
    noErrors(errors);
  } },

  // ---- run timing ----
  { name: 'run timing: early kings in June, coho in August, rainbows best in September, July unchanged', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 25 });
    await newGame(page);
    const r = await page.evaluate(() => {
      const c = (sp, doy) => runCurve(sp, doy, 0);
      return { kJun: c('king', 170), kJul: c('king', 196), kJulBase: .35 * gauss(196, 205, 9) * REG().mult.king, coAug: c('coho', 229), coJul: c('coho', 195), tSep: c('trout', 252), tJul: c('trout', 200), tJulBase: .45 + .4 * gauss(200, 225, 15), sJun: c('sockeye', 168), sJul: c('sockeye', 202) };
    });
    assert.ok(r.kJun > 0.2, 'early-run kings in mid-June'); assert.ok(Math.abs(r.kJul - r.kJulBase) < 1e-9, 'July kings unchanged');
    assert.ok(r.coAug > 5 * r.coJul, 'silvers peak in August');
    assert.ok(r.tSep > r.tJul + .2, 'fall rainbows'); assert.ok(Math.abs(r.tJul - r.tJulBase) < 1e-9, 'July trout unchanged');
    assert.ok(r.sJul > 3 * r.sJun, 'the late sockeye run is a July thing');
    noErrors(errors);
  } },
  { name: 'run timing: a week jump moves the date, resets the river for the new week and says so in the morning report', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 26 });
    await page.evaluate(() => setPref('years', 5));
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      season2(['june', 'aug'], 'cr');
      closeModals(); S.cur = 20; S.t = 20 * 1440 + 1300; S.loc = 'shop'; S.book.forEach(b => { if (b.d <= 20 && b.status === 'booked') b.status = 'done'; });
      S.food.fri = 5; S.cum = 30000;
      endDay('home');
      const body = document.querySelector('#mbg .mb').textContent;
      return { body, cur: S.cur, date: dlongY(S.cur), cum: S.cum, fri: S.food.fri, wk: weekIdOf(S.cur) };
    });
    assert.strictEqual(r.cur, 21); assert.strictEqual(r.date, 'Monday, August 16, 2027'); assert.strictEqual(r.wk, 'aug');
    assert.match(r.body, /8 weeks on/); assert.match(r.body, /August: silvers/);
    assert.ok(r.cum > 1000000, 'the sonar count is the August count'); assert.strictEqual(r.fri, 0, 'the fridge was cleared');
    noErrors(errors);
  } },

  // ---- June king trips ----
  { name: 'king trip: a June catch-and-release king trip runs end to end with the king decision and a king catch line', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 27 });
    await page.evaluate(() => setPref('years', 5));
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      season2(['june', 'jul2'], 'cr');
      closeModals(); S.cur = 15; S.t = 15 * 1440 + 345; S.loc = 'lower'; S.fuel = 30; S.energy = 80; S.dil = null; S.cred.fa = 999;
      S.book = S.book.filter(b => b.d !== 15);
      const b = addBooking({ d: 15, type: 'king', n: 3, who: 'king party', from: 'Ohio', res: false, quirk: [] });
      const k0 = S.stats.kings, f0 = S.fuel;
      tripStart(b); const steps = S.trip.steps.slice();
      let g = 0; while (S.trip && g++ < 20) MBTN(legalBtn());
      return { steps, status: b.status, line: b.out && b.out.line, fuel: f0 - S.fuel, kings: S.stats.kings - k0, kb: b.kings, title: document.querySelector('#mbg h2').textContent };
    });
    assert.ok(r.steps.includes('king') && r.steps.includes('spot'), r.steps.join(','));
    assert.strictEqual(r.status, 'done'); assert.match(r.line, /king/); assert.match(r.line, /released in the water/);
    assert.ok(r.fuel > 5, 'the king trip burns sled fuel'); assert.ok(r.kings >= r.kb, 'released kings counted');
    assert.match(r.title, /Back at the dock/);
    noErrors(errors);
  } },

  // ---- the rest of the summer ----
  { name: 'rest of the summer: unchanged for the July pick, scaled up for quieter weeks so the summer comes out about even', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 28 });
    await page.evaluate(() => setPref('years', 5));
    await newGame(page);
    const r = await page.evaluate(() => {
      const p = { year: 2027, trips: 20, fares: 20000, tips: 2000, hap: 76, wom: 0, cites: 0 };
      const july = restWeeksX(p), r0 = restOfSeason(p);
      S.weeks[1] = ['june', 'aug']; const x = restWeeksX(p), a = WEEKS.june.w + WEEKS.aug.w;
      // the same guide plays fewer trips in quieter weeks (trips scaled by the weeks' weight): played + rest ≈ the July summer
      const pq = Object.assign({}, p, { trips: Math.round(20 * a / 2), fares: 20000 * a / 2, tips: 2000 * a / 2 }), r1 = restOfSeason(pq);
      S.weeks[1] = ['bogus', 'jul1']; const bad = weeksOf(1);
      return { july, x, a, tot0: 20 + r0.trips, tot1: pq.trips + r1.trips, bad };
    });
    assert.strictEqual(r.july, 1);
    assert.ok(r.x > 1.2 && r.x < 1.5, 'more of the summer is booked for you: ' + r.x);
    assert.ok(Math.abs(r.tot1 - r.tot0) <= 0.03 * r.tot0, `summer trips about even: ${r.tot0} vs ${r.tot1}`);
    assert.deepStrictEqual(r.bad, ['jul1', 'jul2'], 'a bad pick falls back to July');
    noErrors(errors);
  } },

  // ---- season goals ----
  { name: 'goals: three goals a season in the Bookings tab, picked without using random numbers, ticked off at night and paid on the last night', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 29 });
    await newGame(page);
    const r = await page.evaluate(() => {
      let calls = 0; const R0 = Math.random; Math.random = () => { calls++; return R0(); };
      S.goals = null; const G = goalsFor(0); const n = calls; Math.random = R0;
      const again = goalsFor(0) === G;
      tab = 'book'; render(); const view = document.body.textContent;
      // force a known set: limits (3) and halibut (2), then meet them
      S.goals = { s: 0, list: [{ id: 'limits', k: 3 }, { id: 'halibut', k: 2 }, { id: 'clean', k: 1 }], met: {}, fail: {}, paid: false };
      S.stats.limits = 3; S.book.forEach(b => { if (b.type === 'halibut') { b.status = 'done'; b.out = { happy: 80, fish: 6 }; } });
      if (S.book.filter(b => b.type === 'halibut' && b.status === 'done').length < 2) addBooking({ d: 13, type: 'halibut', n: 4, who: 'h', from: 'X', quirk: [], status: 'done', out: { happy: 80, fish: 6 } });
      closeModals(); S.cur = 12; S.t = 12 * 1440 + 1300; S.loc = 'shop'; S.book.forEach(b => { if (b.d <= 12 && b.status === 'booked') { b.status = 'done'; b.out = b.out || { happy: 70, fish: 3 } } });
      endDay('home'); const mid = document.querySelector('#mbg .mb').textContent; closeModals();
      const m0 = S.money, rep0 = S.rep, wom0 = S.wom || 0;
      S.t = 13 * 1440 + 1300; S.book.forEach(b => { if (b.status === 'booked') { b.status = 'done'; b.out = b.out || { happy: 70, fish: 3 } } });
      const notes = []; goalsNight(notes, 13);
      return { n, len: G.list.length, again, view: /Season goals · 2026/.test(view), mid: /Season goal reached/.test(mid), notes, paid: S.money - m0, rep: S.rep - rep0, wom: (S.wom || 0) - wom0, log: S.goalLog, line: goalsWinterLine(0) };
    });
    assert.strictEqual(r.n, 0, 'no random numbers used'); assert.strictEqual(r.len, 3); assert.ok(r.again);
    assert.ok(r.view, 'goals in the Bookings tab'); assert.ok(r.mid, 'a goal reached is in the morning report');
    assert.ok(r.notes.some(l => /Season goals: 3 of 3 met/.test(l)), r.notes.join(' | '));
    assert.strictEqual(r.paid, 300); assert.strictEqual(r.rep, 3); assert.strictEqual(r.wom, 2);
    assert.strictEqual(r.log.length, 1); assert.match(r.line, /3 of 3 met/);
    noErrors(errors);
  } },
  { name: 'goals: a goal about families with kids reads 1.13 party traits and star reviews when present, and works without them', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 30 });
    await newGame(page);
    const r = await page.evaluate(() => {
      const a = { quirk: ['kid'], out: { happy: 90 } }, b = { quirk: [], traits: ['kids'], out: { happy: 60, stars: 5 } }, c = { quirk: [], out: { happy: 95 } }, d = { quirk: [], traits: [{ id: 'kids' }], out: { happy: 95, stars: 4 } };
      return [hasKids(a) && fiveStar(a), hasKids(b) && fiveStar(b), hasKids(c), hasKids(d) && fiveStar(d)];
    });
    assert.deepStrictEqual(r, [true, true, false, false]);
    noErrors(errors);
  } },

  // ---- big days ----
  { name: 'big day: a request with a target waits in Bookings, is named in the morning report, books with its target and pays the bonus when met', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 31 });
    await newGame(page);
    const r = await page.evaluate(() => {
      closeModals(); clearTiles(); S.cur = 2; S.t = 2 * 1440 + 1300; S.loc = 'shop'; S.book = []; S.reqs = [];
      const orig = window.makeRequest; window.makeRequest = () => ({ kind: 'trip', d: 6, type: 'halibut', n: 4, who: 'Birthday crew', from: 'Ohio', res: false, quirk: [], big: { k: 'hal30', txt: 'a 30-pound halibut for Dad’s 70th', bonus: 300 } });
      forceEvent('call_request'); endDay('home'); window.makeRequest = orig;
      const report = document.querySelector('#mbg .mb').textContent, sheets = document.querySelectorAll('#mbg').length + MQ.length;
      closeModals(); tab = 'book'; render(); const view = document.body.textContent;
      const q = S.reqs[0]; reqAns(q.id, 0);
      const b = S.book.find(x => x.who === 'Birthday crew');
      // the trip: a good day meets the target
      b.status = 'done'; b.out = { happy: 85, fish: 6, line: '6 halibut', fare: 450, refund: 0, tip: 50, net: 500 };
      const m0 = S.money, notes = []; S.reg.hal.closed = []; bigAfterTrip(b, notes);
      const miss = Object.assign({}, b, { big: Object.assign({}, b.big, { done: undefined }), out: { happy: 50, fish: 1 } }), n2 = [];
      const m1 = S.money; bigAfterTrip(miss, n2);
      return { report, sheets, view, big: b.big, bonus: S.money - m0 - (S.money - m1), paidOnce: m1 - m0, notes, miss: n2, hit: S.stats.bigHit };
    });
    assert.match(r.report, /🎯 a 30-pound halibut/); assert.strictEqual(r.sheets, 1, 'no extra pop-up');
    assert.match(r.view, /A big day:/); assert.match(r.view, /\$300 bonus/);
    assert.strictEqual(r.big.k, 'hal30');
    assert.strictEqual(r.paidOnce, 300); assert.match(r.notes[0], /got it/); assert.match(r.miss[0], /Not today/);
    assert.strictEqual(r.hit, 1);
    noErrors(errors);
  } },
  { name: 'big day: some phone requests carry a target, decided by a hash (no extra random numbers), never on a closed halibut day', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 32 });
    await newGame(page);
    const r = await page.evaluate(() => {
      let big = 0, n = 0, bad = 0;
      for (let i = 0; i < 300; i++) { S.cur = 1 + (i % 9); S.t = S.cur * 1440 + 400 + i; S.reqN = i; S.book = []; const q = makeRequest(); if (!q || q.kind !== 'trip') continue; n++; if (q.big) { big++; if (q.type === 'halibut' && halClosed(q.d)) bad++; } }
      return { big, n, bad };
    });
    assert.ok(r.n > 100); assert.ok(r.big > r.n * .08 && r.big < r.n * .35, `${r.big} of ${r.n}`); assert.strictEqual(r.bad, 0);
    noErrors(errors);
  } },

  // ---- saves ----
  { name: 'migration: a 1.12 save (schema 4) mid-season and mid-off-season loads, plays the July weeks and gets goals', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 33 });
    await page.evaluate(() => setPref('years', 5));
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      const mk = () => { const d = JSON.parse(JSON.stringify(packSave())); delete d.S.weeks; delete d.S.goals; delete d.S.goalLog; d.schema = 4; d.app = '1.12.1'; return d; };
      closeModals(); S.cur = 5; S.t = 5 * 1440 + 400;
      const a = migrate(mk()); adopt(a); closeModals();
      const mid = { weeks: JSON.stringify(S.weeks), log: Array.isArray(S.goalLog), date: dlongY(5), goals: goalsFor(0).list.length };
      toWinter();
      const w = mk(); w.schema = 5;   // as if 1.13's schema 5 ran first
      const b = migrate(w); adopt(b); closeModals();
      winterModal(); const hasPick = MB.some(x => /Your weeks for 2027/.test(x.l)); closeModals();
      finishWinter(); closeModals();
      return { mid, hasPick, winter: !!S.winter, weeks: weeksOf(1), date: dlongY(14), schema: b.schema };
    });
    assert.deepStrictEqual(r.mid, { weeks: '{}', log: true, date: 'Saturday, July 18, 2026', goals: 3 });
    assert.ok(r.hasPick); assert.strictEqual(r.winter, false);
    assert.deepStrictEqual(r.weeks, ['jul1', 'jul2']); assert.strictEqual(r.date, 'Monday, July 12, 2027');
    assert.ok(r.schema >= 6);
    noErrors(errors);
  } },
  { name: 'save: a career with chosen weeks round-trips through a save and keeps its dates', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 34 });
    await page.evaluate(() => setPref('years', 5));
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      season2(['jul2', 'sep'], 'open');
      const d = JSON.parse(JSON.stringify(packSave())), m = migrate(d); adopt(m); closeModals();
      return { weeks: weeksOf(1), d14: dlongY(14), d21: dlongY(21), label: weeksLabel(1) };
    });
    assert.deepStrictEqual(r.weeks, ['jul2', 'sep']);
    assert.strictEqual(r.d14, 'Monday, July 19, 2027'); assert.strictEqual(r.d21, 'Monday, September 6, 2027');
    assert.strictEqual(r.label, 'Jul 19–25 & Sep 6–12');
    noErrors(errors);
  } },
];
