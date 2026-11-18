// Grow the business (36-business.js): the outfit unlocks mid-career; hire and let go of guides, buy boats, hand parties to guides,
// staff trips that resolve off-screen into the morning report, guide citations on your record, wages and boat costs, quitting, schema 9 (1.16.0).
const { open, newGame, noErrors, assert } = require('./helpers');

// In the page: helpers that take a fresh game to the third off-season (the outfit unlocks), and a seeded Math.random for a stretch of code.
const install = () => {
  window.toWinter = (s, o = {}) => {   // finish season s-1 and open the off-season before season s (s >= 1)
    closeModals(); clearTiles(); S.years = o.years || 5; S.rep = o.rep ?? 72; S.money = o.money ?? 80000;
    while (S.seasons.length < s - 1) S.seasons.push({ year: 2026 + S.seasons.length, trips: 18, fares: 18000, earned: 20000, rep: 70, cites: 0 });
    const d = s * SEASON - 1; S.cur = d; S.t = d * 1440 + 1300; S.loc = 'shop'; S.book = S.book.filter(b => b.d < d - 1);
    endDay('home'); closeModals(); clearTiles(); S.rep = o.rep ?? 72; S.money = o.money ?? 80000;
  };
  window.seeded = (seed, f) => { const R = Math.random; let a = seed >>> 0, n = 0;
    Math.random = () => { n++; a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    try { return { v: f(), n }; } finally { Math.random = R; } };
  window.fixed = (v, f) => { const R = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = R; } };
  // a hired guide with set numbers (skips the applicant pool)
  window.addGuide = (o = {}) => { const Z = BZ(), g = Object.assign({ id: Z.nid++, name: 'Test Guide', kind: 'steady', line: 'x', skill: 60, rel: .95, wage: 300, uscg: true, hired: 2, seasons: 0, mood: 70, streak: 0, last: -9, sn: bizLedger(), tot: { trips: 0, net: 0, cites: 0 } }, o); Z.staff.push(g); Z.tot.hired++; return g; };
  // season 3 is open for bookings, with nothing booked: the day is the Tuesday (sday 1)
  window.inSeason = () => { finishWinter(); closeModals(); clearTiles(); S.book = S.book.filter(b => b.d < seasonFirst()); S.reqs = []; S.cur = seasonFirst() + 1; S.t = S.cur * 1440 + 300; S.energy = 90; return S.cur; };
};
const setup = async (ctx, seed) => { const { page, errors } = await open(ctx, { seed }); await newGame(page); await page.evaluate(install); return { page, errors }; };

module.exports = [
  { name: 'outfit: nothing in seasons 1 and 2; unlocks in the third off-season with a line in the planner, a button and an Outfit page', fn: async ctx => {
    const { page, errors } = await setup(ctx, 11);
    const r = await page.evaluate(() => {
      const out = { on0: S.biz.on, tab0: /Outfit/.test(EXTRA_TABS.find(t => t.k === 'book').view()), btn0: bizWinterBtns().length };
      toWinter(1); out.on1 = S.biz.on; out.btn1 = bizWinterBtns().length; out.sup1 = (S.winter.sup || []).join(' ');
      finishWinter(); toWinter(2); out.on2 = S.biz.on; out.sup2 = (S.winter.sup || []).join(' ');
      winterModal(); out.btns = MB.map(b => b.l); closeModals();
      out.tab2 = EXTRA_TABS.find(t => t.k === 'book').view(); bizView(true); out.view = EXTRA_TABS.find(t => t.k === 'book').view(); bizView(false);
      return out;
    });
    assert.strictEqual(r.on0, false); assert.strictEqual(r.tab0, false); assert.strictEqual(r.btn0, 0);
    assert.strictEqual(r.on1, false, 'still locked after season 1'); assert.strictEqual(r.btn1, 0); assert.ok(!/grow the business/.test(r.sup1));
    assert.strictEqual(r.on2, true, 'unlocked after season 2'); assert.match(r.sup2, /grow the business/);
    assert.ok(r.btns.some(l => /Your outfit/.test(l)), r.btns.join(' | ')); assert.match(r.btns[r.btns.length - 1], /Open bookings/);
    assert.ok(/aria-pressed/.test(r.tab2) && /Outfit/.test(r.tab2), 'a Schedule / Outfit switch on the Bookings tab');
    assert.ok(/No guides yet/.test(r.view) && /Boats/.test(r.view), 'the outfit page');
    noErrors(errors);
  } },
  { name: 'hiring: three applicants that stay put and draw no random numbers; onboarding paid up front; reputation caps; off-season only', fn: async ctx => {
    const { page, errors } = await setup(ctx, 12);
    const r = await page.evaluate(() => {
      toWinter(3, { rep: 60, money: 50000 });
      const a = seeded(1, () => bizApplicants().map(x => Object.assign({}, x))), b = bizApplicants();
      const out = { n: a.v.length, draws: a.n, same: a.v.map(x => x.name).join() === b.map(x => x.name).join(), fields: a.v.every(x => x.name && x.line && x.skill > 0 && x.rel > 0 && x.rel < 1 && x.wage > 0 && x.wage % 5 === 0) };
      out.costs = a.v.map(x => [x.uscg, onboardCost(x)]);
      const m0 = S.money, c0 = onboardCost(b[0]); out.hired = bizHire(0); out.paid = m0 - S.money; out.c0 = c0;
      out.staff = S.biz.staff.length; out.pool = bizApplicants().length; out.uscg = S.biz.staff[0].uscg;
      out.why2 = hireWhy(bizApplicants()[0]); out.hired2 = bizHire(0);
      S.rep = 66; out.why2b = hireWhy(bizApplicants()[0]); S.money = 100; out.whyMoney = hireWhy(bizApplicants()[0]); S.money = 50000;
      finishWinter(); out.whySeason = hireWhy(bizApplicants()[0]); out.noHire = bizHire(0);
      return out;
    });
    assert.strictEqual(r.n, 3); assert.strictEqual(r.draws, 0, 'looking at applicants uses no Math.random'); assert.ok(r.same && r.fields);
    r.costs.forEach(([u, c]) => assert.strictEqual(c, u ? 745 : 2145, 'onboarding: guide license, Academy and permit, drug testing, first aid (+ a Coast Guard license)'));
    assert.ok(r.hired); assert.strictEqual(r.paid, r.c0); assert.strictEqual(r.staff, 1); assert.strictEqual(r.pool, 2); assert.strictEqual(r.uscg, true);
    assert.match(r.why2, /needs Rep 65/); assert.strictEqual(r.hired2, false);
    assert.strictEqual(r.why2b, null); assert.match(r.whyMoney, /afford/);
    assert.match(r.whySeason, /off-season/); assert.strictEqual(r.noHire, false);
    noErrors(errors);
  } },
  { name: 'assignment: a guide needs a lane and a free boat; hand a party over and take it back', fn: async ctx => {
    const { page, errors } = await setup(ctx, 13);
    const r = await page.evaluate(() => {
      toWinter(3); const g = addGuide({ name: 'Rosa Alvarez' }); const d = inSeason() + 1;
      const mine = addBooking({ d, type: 'reds', n: 4, who: 'Ohio party', from: 'Ohio', quirk: [] });
      const out = { reds: staffLane(d, 'reds'), trout: staffLane(d, 'trout') };          // one sled (yours, busy); the drift boat is free
      const tb = addBooking({ d: d + 1, type: 'trout', n: 3, who: 'Vermont teachers', from: 'Vermont', quirk: [] });
      out.hand = bizAssign(tb.id, g.id); out.asst = tb.asst; out.g = tb.g; out.todays = todays(d + 1).length; out.label = EXTRA_TABS.find(t => t.k === 'book').view().includes('(Rosa)');
      out.youFree = !conflicts(d + 1, 'trout');                         // you are free that day, but your only drift boat is out with Rosa
      out.back = bizTakeBack(tb.id); out.asst2 = !!tb.asst; out.todays2 = todays(d + 1).length;
      out.handRedsSameTime = bizAssign(mine.id, g.id);                  // your sled moves with the party: allowed
      bizTakeBack(mine.id);
      S.biz.boats.push({ id: 99, kind: 'sled', val: 26000, bought: 2 }); out.reds2 = staffLane(d, 'reds');
      out.halibut = canHand(addBooking({ d: d + 2, type: 'halibut', n: 6, who: 'oil crew', from: 'Anchorage', quirk: [] }));
      return out;
    });
    assert.strictEqual(r.reds, null, 'no second sled: no parallel sockeye party'); assert.strictEqual(r.trout, 1, 'the drift boat is free for a trout float');
    assert.ok(r.hand && r.asst && r.g === 1); assert.strictEqual(r.todays, 0, 'a handed-off party is off your day'); assert.ok(r.label, 'the Bookings tab names the guide');
    assert.strictEqual(r.youFree, false, 'your own boat is out with your guide');
    assert.ok(r.back && !r.asst2 && r.todays2 === 1, 'taken back');
    assert.strictEqual(r.handRedsSameTime, true); assert.strictEqual(r.reds2, 1, 'a second sled: two sockeye parties at once');
    assert.strictEqual(r.halibut, false, 'the halibut charter stays yours');
    noErrors(errors);
  } },
  { name: 'off-screen trip: it settles at night into the morning report, with fish, happiness and your net after the wage, fuel, fees and wear', fn: async ctx => {
    const { page, errors } = await setup(ctx, 14);
    const r = await page.evaluate(() => {
      toWinter(3); const g = addGuide({ name: 'Ben Okafor', rel: .97, wage: 280 }); const d = inSeason();
      const b = addBooking({ d, type: 'reds', n: 4, who: 'Boston paramedics', from: 'Boston', quirk: [], asst: true, g: g.id });
      const hap0 = S.stats.hapN || 0, e0 = S.energy; closeModals();
      S.t = d * 1440 + 1300; const m0 = S.money; window.__sheets = 0; const obs = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.id === 'mbg') window.__sheets++ })));
      obs.observe(document.body, { childList: true }); endDay('home'); obs.takeRecords().forEach(m => m.addedNodes.forEach(n => { if (n.id === 'mbg') window.__sheets++ })); obs.disconnect();
      const body = document.querySelector('#mbg .mb').textContent, fare = payOf(b);
      return { status: b.status, out: b.out, fare, hap: (S.stats.hapN || 0) - hap0, trips: S.stats.staffTrips, sn: g.sn, body, title: document.querySelector('#mbg h2').textContent, sheets: window.__sheets, tiles: document.querySelectorAll('#tiles .tile').length, eMorning: S.log.slice(-6).some(l => /Your guides have/.test(l.s)) };
    });
    assert.strictEqual(r.status, 'done'); assert.ok(r.out && r.out.g === 1 && r.out.fish >= 0 && r.out.happy > 0);
    assert.strictEqual(r.hap, 1, 'a staff day counts in how the season went'); assert.strictEqual(r.trips, 1);
    assert.strictEqual(r.sn.trips, 1); assert.strictEqual(r.sn.wages, 280); assert.strictEqual(r.sn.net, r.sn.fares - r.sn.wages - r.sn.costs);
    assert.strictEqual(r.out.net, r.sn.net); assert.ok(Number.isInteger(r.out.net), 'whole dollars');
    assert.match(r.title, /Morning report/); assert.ok(/Ben’s 🐟 sockeye trip with the Boston paramedics/.test(r.body), r.body.slice(0, 600)); assert.ok(/fish in the box/.test(r.body));
    assert.strictEqual(r.sheets, 1, 'the morning report is the only sheet'); assert.strictEqual(r.tiles, 0);
    noErrors(errors);
  } },
  { name: 'guide citations: a careless guide’s ticket goes on your record (citations, fines, the clean-record bonus) with no extra toast', fn: async ctx => {
    const { page, errors } = await setup(ctx, 15);
    const r = await page.evaluate(() => {
      toWinter(3); const g = addGuide({ name: 'Nora Ahsoak', rel: .5 }); const d = inSeason();
      const b = addBooking({ d, type: 'reds', n: 4, who: 'Chicago law-firm outing', from: 'Chicago', quirk: [], asst: true, g: g.id });
      const c0 = S.cites, ct0 = S.stats.citesTotal || 0, v0 = S.stats.viol, f0 = S.stats.fines, notes = [];
      S.warns = 1;                                                       // past this season's warning: a citation
      fixed(.01, () => asstSettle(b, notes));
      return { cites: S.cites - c0, total: (S.stats.citesTotal || 0) - ct0, viol: S.stats.viol - v0, fines: S.stats.fines - f0, log: S.citeLog.slice(-1)[0] === S.cur, staff: S.stats.staffCites, gc: g.sn.cites, notes: notes.join(' '), tiles: document.querySelectorAll('#tiles .tile').length, score: scoreParts().find(p => p[0] === 'Clean record bonus')[1] };
    });
    assert.strictEqual(r.cites, 1); assert.strictEqual(r.total, 1); assert.strictEqual(r.viol, 1); assert.ok(r.fines > 0 && r.log);
    assert.strictEqual(r.staff, 1); assert.strictEqual(r.gc, 1);
    assert.ok(/checking Nora’s boat cites you/.test(r.notes) && /your<\/b> record/.test(r.notes), r.notes);
    assert.strictEqual(r.tiles, 0); assert.strictEqual(r.score, 0, 'no clean-record bonus');
    noErrors(errors);
  } },
  { name: 'reliability matters: a reliable guide almost never gets a ticket, a careless one often does', fn: async ctx => {
    const { page, errors } = await setup(ctx, 16);
    const r = await page.evaluate(() => {
      toWinter(3); const d = inSeason();
      const run = rel => { const g = addGuide({ rel }); let c = 0; for (let i = 0; i < 400; i++) { const b = addBooking({ d, type: 'reds', n: 3, who: 'x', from: 'X', quirk: [], asst: true, g: g.id }); const n0 = S.stats.staffCites || 0; S.cites = 0; S.warns = 1; asstSettle(b, []); c += (S.stats.staffCites || 0) - n0; S.book = S.book.filter(x => x !== b); } return c; };
      return seeded(7, () => ({ careless: run(.75), reliable: run(.95) })).v;
    });
    assert.ok(r.careless >= 12, 'careless ' + r.careless); assert.ok(r.reliable <= 4, 'reliable ' + r.reliable); assert.ok(r.careless > 4 * r.reliable + 4);
    noErrors(errors);
  } },
  { name: 'costs: extra boats cost every July night and every winter and lose value; guides cost license renewals each winter', fn: async ctx => {
    const { page, errors } = await setup(ctx, 17);
    const r = await page.evaluate(() => {
      toWinter(3, { money: 100000 }); bizHire(0); const v0 = S.up.value, m0 = S.money; const ok = bizBuyBoat('sled'); const out = { ok, paid: m0 - S.money, val: S.up.value - v0, twice: bizBuyBoat('drift') && !bizBuyBoat('sled') };
      out.third = boatWhy('drift');
      const d = inSeason(); S.t = d * 1440 + 1300; const n0 = S.biz.boatNight || 0; endDay('home'); closeModals(); out.night = (S.biz.boatNight || 0) - n0;
      // to the next winter
      const value0 = S.up.value; toWinter(4, { money: 100000 }); out.bill = S.winter.sup.join(' '); out.drop = value0 - S.up.value; out.boatVal = S.biz.boats.map(b => b.val);
      out.sell = bizSellBoat(S.biz.boats[1].id); out.left = S.biz.boats.length;
      return out;
    });
    assert.ok(r.ok); assert.strictEqual(r.paid, 26000); assert.strictEqual(r.val, 26000, 'counts with boats & permits'); assert.ok(r.twice); assert.match(r.third, /Two extra boats/);
    assert.strictEqual(r.night, 40, 'two boats × $20 a night');
    assert.ok(/Outfit winter bills <b>\$4,000<\/b>/.test(r.bill), r.bill);   // 1 guide 1,900 + sled 1,500 + drift 600
    assert.strictEqual(r.drop, Math.round(26000 * .12) + Math.round(9500 * .12)); assert.deepStrictEqual(r.boatVal, [22880, 8360]);
    assert.ok(r.sell); assert.strictEqual(r.left, 1);
    noErrors(errors);
  } },
  { name: 'people: guides grow every season; a raise helps; underpaid ones quit in the winter, a fed-up one walks off mid-season and the party is reassigned', fn: async ctx => {
    const { page, errors } = await setup(ctx, 18);
    const r = await page.evaluate(() => {
      toWinter(3); const a = addGuide({ name: 'Katie Swanson', skill: 50, wage: 400, mood: 70 }), b = addGuide({ name: 'Cody Pruitt', skill: 60, wage: 120, mood: 30 });
      a.sn.trips = 8; b.sn.trips = 8; toWinter(4);
      const out = { aSkill: a.skill, aMood: a.mood, aStays: !!guideOf(a.id), bGone: !guideOf(b.id), past: S.biz.past.map(p => p.name + ':' + p.why), lines: S.winter.sup.join(' ') };
      const w0 = a.wage, m0 = a.mood; bizRaise(a.id); out.raise = [a.wage - w0, a.mood - m0];
      const c = addGuide({ name: 'Walt Jensen', mood: 10 }); const d = inSeason();
      const bb = addBooking({ d: d + 2, type: 'trout', n: 2, who: 'Juneau bartenders', from: 'Juneau', quirk: [], asst: true, g: c.id });
      S.t = d * 1440 + 1300; fixed(.1, () => endDay('home')); closeModals();
      out.walked = !guideOf(c.id); out.moved = bb.g; out.status = bb.status; out.asst = !!bb.asst;
      return out;
    });
    assert.ok(r.aSkill >= 56, 'skill grows with trips: ' + r.aSkill); assert.ok(r.aStays && r.aMood > 70);
    assert.ok(r.bGone && r.past.includes('Cody Pruitt:quit')); assert.match(r.lines, /Cody Pruitt<\/b> won’t be back/);
    assert.deepStrictEqual(r.raise, [25, 12]);
    assert.ok(r.walked); assert.strictEqual(r.status, 'booked'); assert.ok(r.moved === 1 || (r.moved === undefined && !r.asst), 'Katie or you take the party');
    noErrors(errors);
  } },
  { name: 'firing: severance, and the guide’s parties go to another guide, to you, or get a refund', fn: async ctx => {
    const { page, errors } = await setup(ctx, 19);
    const r = await page.evaluate(() => {
      toWinter(3); const g = addGuide({ wage: 300 }); const d = inSeason();
      addBooking({ d: d + 1, type: 'reds', n: 4, who: 'mine', from: 'X', quirk: [] });
      const p1 = addBooking({ d: d + 1, type: 'trout', n: 2, who: 'clash', from: 'X', quirk: [], asst: true, g: g.id });
      const p2 = addBooking({ d: d + 3, type: 'trout', n: 2, who: 'free day', from: 'X', quirk: [], asst: true, g: g.id });
      const m0 = S.money, r0 = S.rep; const ok = bizFire(g.id);
      return { ok, paid: m0 - S.money, p1: p1.status, p2: [p2.status, !!p2.asst, p2.g], rep: S.rep - r0, past: S.biz.past[0].why };
    });
    assert.ok(r.ok); assert.strictEqual(r.paid, 600); assert.strictEqual(r.past, 'let go');
    assert.strictEqual(r.p1, 'cancelled', 'you are on the river that morning: refund'); assert.deepStrictEqual(r.p2, ['booked', false, undefined], 'a free day: you take it'); assert.strictEqual(r.rep, -2);
    noErrors(errors);
  } },
  { name: 'calls and July bookings: guides get their own bookings and calls on top of yours, and a call books for that guide', fn: async ctx => {
    const { page, errors } = await setup(ctx, 20);
    const r = await page.evaluate(() => {
      toWinter(3, { rep: 80 }); addGuide({ name: 'Mia Fjelstad', skill: 70 }); finishWinter(); closeModals();
      const s = seasonOf(S.cur), staff = S.book.filter(b => seasonOf(b.d) === s && b.g != null), out = { staff: staff.length, legal: staff.every(b => !illegalDay(b.type, b.d) && b.asst && b.type !== 'halibut') };
      S.reqs = []; S.cur = seasonFirst() + 1; S.t = S.cur * 1440 + 400; const q = staffRequest(); out.req = !!q;
      if (q) { const o = requestOpts(q); out.body = o.body; out.l0 = o.opts[0].l; const n0 = S.book.length; o.opts[0].fn(); const b = S.book.find(x => x.who === q.who && x.d === q.d); out.booked = S.book.length - n0; out.bg = b && b.g; }
      return out;
    });
    assert.ok(r.staff >= 1, 'July bookings for the guide: ' + r.staff); assert.ok(r.legal);
    assert.ok(r.req); assert.match(r.body, /Mia Fjelstad is free then/); assert.match(r.l0, /Book it with Mia/); assert.strictEqual(r.booked, 1); assert.strictEqual(r.bg, 1);
    noErrors(errors);
  } },
  { name: 'no outfit, no change: the wrapped functions draw the same random numbers and give the same results as before', fn: async ctx => {
    const { page, errors } = await setup(ctx, 21);
    const r = await page.evaluate(() => {
      S.cur = 3; S.t = 3 * 1440 + 400;
      const a = seeded(5, () => JSON.stringify(_makeRequest())), b = seeded(5, () => JSON.stringify(makeRequest()));
      const book0 = JSON.stringify(S.book), id0 = S.nextId;
      const g1 = seeded(9, () => { _genSeasonBookings(1); return JSON.stringify(S.book) }); S.book = JSON.parse(book0); S.nextId = id0;
      const g2 = seeded(9, () => { genSeasonBookings(1); return JSON.stringify(S.book) }); S.book = JSON.parse(book0); S.nextId = id0;
      const p = { trips: 20, fares: 20000, tips: 2000, hap: 80, wom: 2, cites: 0, year: 2026 };
      return { req: a.v === b.v && a.n === b.n, gen: g1.v === g2.v && g1.n === g2.n, rest: JSON.stringify(_restOfSeason(p)) === JSON.stringify(restOfSeason(p)), conf: [2, 3, 4, 5].every(d => ['reds', 'trout', 'silver'].every(t => conflicts(d, t) === _conflicts(d, t) && conflicts(d, t, true) === _conflicts(d, t, true))), rows: endRows().some(x => x[0] === 'Your outfit') };
    });
    assert.deepStrictEqual(r, { req: true, gen: true, rest: true, conf: true, rows: false });
    noErrors(errors);
  } },
  { name: 'rest of summer and the end screen: guides run June–September trips too; an Outfit row on the end screen', fn: async ctx => {
    const { page, errors } = await setup(ctx, 22);
    const r = await page.evaluate(() => {
      toWinter(3); const g = addGuide(); inSeason(); Object.assign(g.sn, { trips: 6, fares: 6000, wages: 1800, costs: 900, net: 3300 }); S.biz.tot.trips = 6; S.biz.tot.net = 3300;
      const p = curSeason(), base = _restOfSeason(p), with_ = restOfSeason(p);
      return { staff: with_.staff, extra: with_.net - base.net, row: (endRows().find(x => x[0] === 'Your outfit') || [])[1] };
    });
    assert.ok(r.staff >= 4, 'staff off-month trips ' + r.staff); assert.ok(r.extra > 0);
    assert.match(r.row, /1 guide hired, 6 staff trips, \$3,300 net/);
    noErrors(errors);
  } },
  { name: 'migration: schema 4, 6 and 8 saves load with an outfit (unlocked past season 2), and an existing outfit is kept', fn: async ctx => {
    const { page, errors } = await setup(ctx, 23);
    const r = await page.evaluate(() => {
      const d = JSON.parse(JSON.stringify(packSave())); d.schema = 4; d.app = '1.12.1'; delete d.S.biz;
      const m = migrate(d); const out = { schema: m.schema, biz: m.S.biz && Array.isArray(m.S.biz.staff) && m.S.biz.on === false, notes: m.notes.join(' ') };
      const d2 = JSON.parse(JSON.stringify(packSave())); d2.schema = 4; delete d2.S.biz; d2.S.seasons = [{ year: 2026 }, { year: 2027 }]; out.on = migrate(d2).S.biz.on;
      const d3 = JSON.parse(JSON.stringify(packSave())); d3.schema = 6; d3.S.biz = { staff: [{ id: 1, name: 'Kept' }], on: true }; const m3 = migrate(d3);
      out.kept = m3.S.biz.staff[0].name; out.filled = Array.isArray(m3.S.biz.boats) && typeof m3.S.biz.tot === 'object' && m3.S.biz.on;
      const d4 = JSON.parse(JSON.stringify(packSave())); d4.schema = 8; d4.S.biz = null; out.nullFixed = !!migrate(d4).S.biz;
      // and the game carries on
      adopt(migrate(JSON.parse(JSON.stringify(d)))); closeModals(); S.t = S.cur * 1440 + 1300; endDay('home'); closeModals(); out.day = S.cur;
      out.schemaNow = SAVE_SCHEMA;
      return out;
    });
    assert.strictEqual(r.schema, 9); assert.strictEqual(r.schemaNow, 9); assert.ok(r.biz); assert.match(r.notes, /upgraded/);
    assert.strictEqual(r.on, true); assert.strictEqual(r.kept, 'Kept'); assert.ok(r.filled); assert.ok(r.nullFixed); assert.strictEqual(r.day, 1);
    noErrors(errors);
  } },
  { name: 'outfit page: staff with wages, skill, mood and season profit; this week’s assignments with hand-off buttons; the planner sheet', fn: async ctx => {
    const { page, errors } = await setup(ctx, 24);
    const r = await page.evaluate(() => {
      toWinter(3, { money: 90000 }); bizHire(0); bizBuyBoat('sled'); winterModal(); MBTN(MB.findIndex(b => /Your outfit/.test(b.l))); const sheet = document.querySelector('#mbg').textContent; const btns = MB.map(b => b.l); closeModals();
      const d = inSeason(); const g = S.biz.staff[0]; g.sn = { trips: 2, fares: 2000, wages: 600, costs: 300, net: 1100, cites: 0, hap: 140 };
      addBooking({ d: d + 1, type: 'trout', n: 2, who: 'Patel family reunion', from: 'New Jersey', quirk: [] });
      tab = 'book'; bizView(true); render();
      const html = document.querySelector('.content').innerHTML, text = document.querySelector('.content').textContent;
      const hand = [...document.querySelectorAll('.content button')].find(b => /^Hand to/.test(b.textContent)); hand && hand.click();
      return { sheet, btns, text, hand: !!hand, after: S.book.find(b => b.who === 'Patel family reunion').g, html: html.length };
    });
    assert.ok(/cash/.test(r.sheet) && r.btns.some(l => /Give .* a raise/.test(l)) && r.btns.some(l => /Let .* go/.test(l)) && r.btns.some(l => /Buy: New drift boat/.test(l)) && r.btns.some(l => /Sell the second jet sled/.test(l)) && r.btns[r.btns.length - 1] === 'Done', r.btns.join(' | '));
    assert.ok(/Your outfit · this season \$1,100 net/.test(r.text), r.text.slice(0, 300)); assert.ok(/Second jet sled/.test(r.text) && /Assignments/.test(r.text) && /Patel family reunion/.test(r.text));
    assert.ok(r.hand); assert.strictEqual(r.after, 1);
    noErrors(errors);
  } },
  // ---- 1.16.0 on top of 1.13–1.15: weeks, party traits and reviews, the star rating ----
  { name: 'with summer weeks: staff bookings and calls follow the chosen weeks (June kings on a sled, September rainbows and silvers), never halibut', fn: async ctx => {
    const { page, errors } = await setup(ctx, 31);
    const r = await page.evaluate(() => {
      toWinter(3, { rep: 85 }); S.weeks = { 3: ['june', 'sep'] }; S.reg.king = 'open';
      addGuide({ name: 'Mia Fjelstad', skill: 70 }); addGuide({ name: 'Joe Turner', skill: 62 });
      const out = { kind: boatKind('king') };
      let types = [];
      for (let k = 0; k < 6; k++) { S.book = S.book.filter(b => seasonOf(b.d) !== 3); genSeasonBookings(3); types = types.concat(S.book.filter(b => b.g != null && seasonOf(b.d) === 3).map(b => [weekIdOf(b.d), b.type, illegalDay(b.type, b.d)])); }
      out.types = types;
      finishWinter(); closeModals(); S.cur = seasonFirst() + 8; S.t = S.cur * 1440 + 300; S.book = S.book.filter(b => b.d <= S.cur); S.reqs = [];
      const calls = []; for (let k = 0; k < 40; k++) { const q = staffRequest(); if (q) calls.push([weekIdOf(q.d), q.type]); }
      out.calls = calls;
      return out;
    });
    assert.strictEqual(r.kind, 'sled');
    assert.ok(r.types.length > 4, 'staff bookings: ' + r.types.length);
    for (const [wk, type, bad] of r.types) { assert.ok(!bad, 'legal'); assert.notStrictEqual(type, 'halibut'); assert.notStrictEqual(type, 'reds', 'no sockeye trips in June or September');
      if (wk === 'june') assert.ok(['king', 'trout'].includes(type), type); else assert.ok(['trout', 'silver'].includes(type), type); }
    assert.ok(r.types.some(t => t[1] === 'king'), 'June kings for the staff'); assert.ok(r.types.some(t => t[0] === 'sep' && t[1] === 'trout'));
    assert.ok(r.calls.length > 0 && r.calls.every(([wk, t]) => wk === 'sep' && ['trout', 'silver'].includes(t)), JSON.stringify(r.calls));
    noErrors(errors);
  } },
  { name: 'staff review: a September staff trip has party traits, writes a review naming the guide (Ask for …) kept apart from your rating, and shows on the Outfit page', fn: async ctx => {
    const { page, errors } = await setup(ctx, 32);
    const r = await page.evaluate(() => {
      toWinter(3); S.weeks = { 3: ['aug', 'sep'] }; const g = addGuide({ name: 'Rosa Alvarez', skill: 80, rel: .97, wage: 300 }); const d = inSeason() + 7;   // the September Tuesday
      S.cur = d; S.t = d * 1440 + 300;
      const b = addBooking({ d, type: 'trout', n: 3, who: 'Lopez family', from: 'Texas', quirk: [], asst: true, g: g.id });
      const rv0 = S.reviews.length, rating0 = rating().r; closeModals();
      S.t = d * 1440 + 1300; let best = null;
      // a good day for the party, so the review asks for the guide by name
      const R = Math.random; Math.random = () => .55; try { endDay('home'); } finally { Math.random = R; }
      const body = document.querySelector('#mbg .mb').textContent; closeModals();
      const brv = S.biz.reviews[S.biz.reviews.length - 1];
      tab = 'book'; bizView(true); render(); const outfit = document.querySelector('.content').textContent;
      bizView(false); render(); const sched = document.querySelector('.content').textContent;
      // the good-review event names the guide when only a staff trip earned it
      S.cur = d; b.out.happy = 90; uiNarr = []; EV.find(e => e.id === 'good_review').run(); const ev = S.log[S.log.length - 1].s;
      return { tr: b.tr, wk: weekIdOf(d), rv: brv, stars: b.out.stars, mine: S.reviews.length - rv0, rating: [rating0, rating().r], body, outfit, sched, ev };
    });
    assert.strictEqual(r.wk, 'sep'); assert.ok(Array.isArray(r.tr) && r.tr.length >= 1, 'party traits');
    assert.ok(r.rv && r.rv.guide === 'Rosa' && r.rv.stars === r.stars && r.rv.stars >= 1, JSON.stringify(r.rv));
    if (r.rv.stars >= 4) assert.match(r.rv.text, /Ask for Rosa\./);
    assert.doesNotMatch(r.rv.text, /\{\{name\}\}/);
    assert.strictEqual(r.mine, 0, 'not in your own reviews'); assert.deepStrictEqual(r.rating[0], r.rating[1], 'your rating unchanged');
    assert.match(r.body, /Rosa’s 🌈/); assert.ok(r.body.includes(r.rv.text), 'the review is in the morning report');
    assert.match(r.outfit, /Reviews: ★\d\.\d this season/); assert.match(r.outfit, /don’t count toward your own ★ rating/);
    assert.match(r.sched, /Lopez family.*\(Rosa\)/); assert.match(r.ev, /Ask for Rosa/);
    noErrors(errors);
  } },
];
