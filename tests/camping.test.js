// The Guide Master side of winter camping (src/js/28-camping.js): the ticket, the report, the pop-ups, the save migration.
// The engine itself is covered by camp-engine.test.js.
const { open, newGame, noErrors, assert } = require('./helpers');

// a 5-year game rolled into its first off-season (S.winter pending)
async function winterGame(ctx, diff) {
  const { page, errors } = await open(ctx);
  await page.evaluate(() => setPref('years', 5));
  await newGame(page, diff);
  await page.evaluate(async () => {
    closeModals(); S.money = 20000; S.cur = 13; S.t = 13 * 1440 + 1300; S.loc = 'shop';
    S.book.forEach(b => { if (b.status === 'booked') b.status = 'done'; });
    endDay('home'); await new Promise(r => setTimeout(r, 10));
    S.cabin.rolled = S.winter.s;   // (1.10.0) the cabin's first storm lands before camping starts; these tests are about camping, so it has already passed
  });
  return { page, errors };
}
const btn = (page, re) => page.locator('#mbg button.act').filter({ hasText: re }).first();
const click = async (page, re) => { await btn(page, re).click(); };
const title = async (page, re) => { if (re) await page.waitForFunction(r => new RegExp(r).test((document.querySelector('#mbg h2') || {}).textContent || ''), re.source); return page.evaluate(() => (document.querySelector('#mbg h2') || {}).textContent || '') };

module.exports = [
  { name: 'camping: the option shows only in the off-season, and opens the winter hub', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const before = await page.evaluate(() => { closeModals(); campModal(); return { winter: !!S.winter, open: !!document.getElementById('mbg') }; });
    assert.strictEqual(before.winter, false); assert.strictEqual(before.open, false, 'no camping during the season');
    const w = await winterGame(ctx);
    await w.page.evaluate(() => { closeModals(); winterModal(); });
    const label = await w.page.evaluate(() => [...document.querySelectorAll('#mbg button.act')].map(b => b.textContent).find(t => /Winter camping/.test(t)));
    assert.ok(/10 free days/.test(label), label);
    await click(w.page, /Winter camping/);
    assert.ok(/Winter camp/.test(await title(w.page)));
    const hub = await w.page.evaluate(() => document.querySelector('#mbg').textContent);
    assert.ok(/10 free days/.test(hub) && /up to 3 camping trips/.test(hub) && /2 jobs/.test(hub), hub);
    noErrors(w.errors); noErrors(errors);
  } },
  { name: 'camping: the ticket is built from the save (cash, gas, gear, license, regulars, rival, difficulty)', fn: async ctx => {
    const { page, errors } = await winterGame(ctx, 'hard');
    const t = await page.evaluate(() => {
      S.camp.gear = ['bear']; S.camp.lic = 2025; S.freezer = 20; S.arcs.rival.st = 2; S.arcs.rival.mood = 1;
      S.regs = [{ who: 'Garza family', from: 'Texas', res: false, type: 'reds', n: 4, trips: 2, last: { h: 90, s: 0 }, arc: null }];
      closeModals(); return { t: campTicket(), gas: campGas(), cost: DF().cost, fish: fishCap() };
    });
    const k = t.t;
    assert.strictEqual(k.mode, 'guide'); assert.strictEqual(k.year, 2026); assert.ok(k.cash > 0);
    assert.strictEqual(k.gas, t.gas); assert.strictEqual(k.costMult, t.cost); assert.ok(t.cost > 1, 'Combat Season costs more');
    assert.deepStrictEqual(k.gear, ['bear']); assert.strictEqual(k.licYear, 2025);
    assert.strictEqual(k.food.freezerRoom, (t.fish - 20) * 3, 'room counted in stocked fish: three to a red');
    assert.deepStrictEqual(k.regulars, [{ id: 'Garza family', name: 'the Garza family', mood: 90 }]);
    assert.deepStrictEqual(k.rival, { id: 'rival', name: 'Dale Voss', mood: 1 });
    assert.strictEqual(k.daysLeft, 10); assert.strictEqual(k.tripsLeft, 3); assert.strictEqual(k.gigsLeft, 2);
    noErrors(errors);
  } },
  { name: 'camping: a trip played through the real pop-ups, clock untouched, nothing applied until the visit ends', fn: async ctx => {
    const { page, errors } = await winterGame(ctx);
    const before = await page.evaluate(() => { closeModals(); return { cur: S.cur, t: S.t, money: S.money }; });
    await page.evaluate(() => campModal());
    await click(page, /Plan a camping trip/);
    await click(page, /Johnson Lake/); await click(page, /February/); await click(page, /1 night/); await click(page, /Go alone/);
    await click(page, /Pack the usual/); await click(page, /Done packing/);
    assert.ok(/1 night at Johnson Lake/.test(await title(page, /1 night at Johnson Lake/)));
    await click(page, /Pack the truck/);
    assert.ok(/Day 1 of 1/.test(await title(page, /Day 1 of 1/)));
    const mid = await page.evaluate(() => S.money); assert.strictEqual(mid, before.money, 'cash is applied when the visit ends');
    await click(page, /Keep camp and rest/); await click(page, /Continue/);       // February: two activities on a long day
    assert.ok(/Day 1 of 1/.test(await title(page, /Day 1 of 1/)), 'a second daylight activity');
    await click(page, /Call it a day/); await click(page, /Early to bed/); await click(page, /Continue/);
    await click(page, /Break camp/); await click(page, /Leave no trace/);
    assert.ok(/Back from Johnson Lake/.test(await title(page, /Back from/)));
    await click(page, /Continue/);
    await click(page, /Back to the off-season/);          // hub → report → wrap-up
    assert.ok(/What camping did/.test(await title(page, /What camping did/)));
    const r = await page.evaluate(() => ({ cur: S.cur, t: S.t, money: S.money, days: S.camp.days, trips: S.camp.trips, nights: S.stats.campNights, gear: S.camp.gear.slice() }));
    assert.strictEqual(r.cur, before.cur); assert.strictEqual(r.t, before.t); assert.ok(r.money < before.money);
    assert.strictEqual(r.days, 1); assert.strictEqual(r.trips, 1); assert.strictEqual(r.nights, 1); assert.ok(r.gear.includes('bear'));
    await click(page, /Back to the off-season/);
    assert.ok(/Off-season/.test(await title(page, /Off-season/)));
    noErrors(errors);
  } },
  { name: 'camping: applying a report moves cash, energy, rep, skill, freezer, tackle, regulars, the rival and the log', fn: async ctx => {
    const { page, errors } = await winterGame(ctx);
    const r = await page.evaluate(() => {
      closeModals(); S.energy = 60; S.rep = 60; S.freezer = 2; S.gear = 1; S.skill = 20; S.wom = 0;
      S.regs = [{ who: 'Garza family', from: 'Texas', res: false, type: 'reds', n: 4, trips: 2, last: { h: 70, s: 0 }, arc: null }];
      S.arcs.rival.st = 2; S.arcs.rival.mood = -1;
      const m0 = S.money, st0 = S.stats.spent, cur = S.cur;
      const rep = { cashDelta: -150, spent: 190, energyDelta: 8, repDelta: 2, skillDelta: 1, womDelta: 1, bookingBoost: .02, firstTripBoost: .025, foodFish: 5, tackleCredit: 3,
        scout: { areas: ['upper'], points: 2, hint: true }, relations: [{ id: 'Garza family', kind: 'regular', name: 'the Garza family', delta: 3 }, { id: 'rival', kind: 'rival', name: 'Dale Voss', delta: 2 }],
        speciesSeen: { moose: 2, wolverine: 1 }, newSpecies: ['wolverine'], achievements: ['no_trace'], daysUsed: 3, tripsTaken: 1, gigs: ['event'], nights: 2, encounters: 3, noTraceTrips: 1,
        gearBought: ['bear', 'bag'], license: { year: 2026 }, log: [], trips: [] };
      campApply(rep);
      const C = S.camp;
      return { dm: S.money - m0, spent: S.stats.spent - st0, e: S.energy, rep: S.rep, skill: S.skill, wom: S.wom, fz: S.freezer, gear: S.gear, h: S.regs[0].last.h, mood: S.arcs.rival.mood, seen: S.stats.seen, nights: S.stats.campNights, enc: S.stats.encounters,
        days: C.days, trips: C.trips, gigs: C.gigs, gd: C.gigsDone, cg: C.gear, lic: C.lic, boost: C.boost, ach: C.ach, nt: C.noTrace, hint: campHintLine(), tot: C.tot, cur: S.cur - cur, left: campDaysLeft(), ach2: ACH.find(a => a.id === 'no_trace').test({}) };
    });
    assert.strictEqual(r.dm, -150); assert.strictEqual(r.spent, 190); assert.strictEqual(r.e, 68); assert.strictEqual(r.rep, 62); assert.strictEqual(r.skill, 21); assert.strictEqual(r.wom, 1);
    assert.strictEqual(r.fz, 4, '5 stocked fish are about 2 reds of meals'); assert.strictEqual(r.gear, 4); assert.strictEqual(r.h, 85, 'a good trip lifts the regular’s last-trip mood'); assert.strictEqual(r.mood, 1);
    assert.strictEqual(r.seen.moose, 2); assert.strictEqual(r.seen.wolverine, 1); assert.strictEqual(r.nights, 2); assert.strictEqual(r.enc, 3);
    assert.strictEqual(r.days, 3); assert.strictEqual(r.left, 7); assert.strictEqual(r.trips, 1); assert.strictEqual(r.gigs, 1); assert.deepStrictEqual(r.gd, ['event']);
    assert.deepStrictEqual(r.cg, ['bear', 'bag']); assert.strictEqual(r.lic, 2026); assert.strictEqual(r.boost.q, .025); assert.strictEqual(r.boost.book, .02);
    assert.ok(r.ach.includes('no_trace') && r.nt === 1 && r.ach2); assert.ok(/late run/.test(r.hint), r.hint); assert.strictEqual(r.tot.nights, 2); assert.strictEqual(r.cur, 0);
    noErrors(errors);
  } },
  { name: 'camping: energy never drops below 40 from camping, and tackle and the freezer are capped', fn: async ctx => {
    const { page, errors } = await winterGame(ctx);
    const r = await page.evaluate(() => {
      closeModals(); S.energy = 90; S.freezer = fishCap() - 1; S.gear = 11;
      const base = { cashDelta: 0, spent: 0, energyDelta: -80, repDelta: 0, skillDelta: 0, womDelta: 0, bookingBoost: 0, firstTripBoost: 0, foodFish: 9, tackleCredit: 9, scout: null, relations: [], speciesSeen: {}, newSpecies: [], achievements: [], daysUsed: 0, tripsTaken: 0, gigs: [], nights: 0, encounters: 0, noTraceTrips: 0, gearBought: [], license: null };
      campApply(base); return { e: S.energy, fz: S.freezer, cap: fishCap(), gear: S.gear };
    });
    assert.strictEqual(r.e, 40); assert.strictEqual(r.fz, r.cap); assert.strictEqual(r.gear, 12);
    noErrors(errors);
  } },
  { name: 'camping: the winter day budget, three trips at most, restarts every winter', fn: async ctx => {
    const { page, errors } = await winterGame(ctx);
    const r = await page.evaluate(() => {
      closeModals(); const a = { daysLeft: campDaysLeft(), trips: campTripsLeft(), used: campUsed() };
      const rep = (d, t) => ({ cashDelta: 0, spent: 0, energyDelta: 0, repDelta: 0, skillDelta: 0, womDelta: 0, bookingBoost: 0, firstTripBoost: 0, foodFish: 0, tackleCredit: 0, scout: null, relations: [], speciesSeen: {}, newSpecies: [], achievements: [], daysUsed: d, tripsTaken: t, gigs: [], nights: d, encounters: 0, noTraceTrips: 0, gearBought: [], license: null });
      campApply(rep(4, 2)); const b = { daysLeft: campDaysLeft(), trips: campTripsLeft(), used: campUsed() };
      campApply(rep(2, 1)); const c = { daysLeft: campDaysLeft(), trips: campTripsLeft(), used: campUsed() };
      S.winter.s = 2; const d = { daysLeft: campDaysLeft(), trips: campTripsLeft(), used: campUsed() };
      return { a, b, c, d };
    });
    assert.deepStrictEqual(r.a, { daysLeft: 10, trips: 3, used: false }); assert.deepStrictEqual(r.b, { daysLeft: 6, trips: 1, used: false });
    assert.deepStrictEqual(r.c, { daysLeft: 4, trips: 0, used: false }, 'jobs are still open');
    assert.deepStrictEqual(r.d, { daysLeft: 10, trips: 3, used: false }, 'a new winter starts fresh');
    noErrors(errors);
  } },
  { name: 'camping: next season’s first trips and bookings get the camping bonus, and only then', fn: async ctx => {
    const { page, errors } = await winterGame(ctx);
    const r = await page.evaluate(() => {
      closeModals(); const none = { q: campQ(), b: campBook(1) };
      S.camp.boost = { s: 1, q: .03, book: .02 };
      // the season that is about to start is S.winter.s (1), and the game is already on its first day
      const out = { none };
      S.cur = 14; S.st0 = { trips: 0 }; S.stats.trips = 0; out.first = campQ();
      S.stats.trips = 3; out.fourth = campQ(); S.stats.trips = 0; out.book = campBook(1); out.bookOther = campBook(2);
      return out;
    });
    assert.deepStrictEqual(r.none, { q: 0, b: 0 }); assert.strictEqual(r.first, .03); assert.strictEqual(r.fourth, 0);
    assert.strictEqual(r.book, .02); assert.strictEqual(r.bookOther, 0);
    noErrors(errors);
  } },
  { name: 'camping: a bot that does not camp is untouched (no randomness, no state change)', fn: async ctx => {
    const { page, errors } = await winterGame(ctx);
    const r = await page.evaluate(() => {
      closeModals(); const re = Math.random; let calls = 0; Math.random = () => { calls++; return re() };
      const s0 = JSON.stringify([S.money, S.energy, S.rep, S.freezer, S.gear, S.skill]);
      try { campTicket(); campQ(); campBook(1); campUsed(); campEndText(); campHintLine(); } finally { Math.random = re }
      return { calls, same: s0 === JSON.stringify([S.money, S.energy, S.rep, S.freezer, S.gear, S.skill]), end: campEndText() };
    });
    assert.strictEqual(r.calls, 0); assert.ok(r.same); assert.strictEqual(r.end, 'none');
    noErrors(errors);
  } },
  { name: 'camping: a thoughtful bot camps through the engine and the report lands in the save', fn: async ctx => {
    const { page, errors } = await winterGame(ctx);
    const r = await page.evaluate(() => {
      closeModals(); const m0 = S.money, cur = S.cur; const rep = campBot({ trips: 2, gigs: 2 });
      return { trips: rep.tripsTaken, gigs: rep.gigs.length, dm: Math.round(S.money - m0), cur: S.cur - cur, days: S.camp.days, nights: S.stats.campNights, end: campEndText(), used: campUsed(), again: campBot({}) && campW().trips };
    });
    assert.ok(r.trips >= 1 && r.trips <= 3); assert.ok(r.gigs >= 1); assert.strictEqual(r.cur, 0); assert.ok(r.days >= r.nights && r.days <= 10);
    assert.ok(/night/.test(r.end) && /animals logged/.test(r.end), r.end);
    noErrors(errors);
  } },
  { name: 'camping: a save from 1.8.1 in the middle of an off-season is brought up to date', fn: async ctx => {
    const { page, errors } = await winterGame(ctx);
    const r = await page.evaluate(() => {
      closeModals();
      // what 1.8.1 saved: a camp trip taken this winter (one trip, 3 nights) and a few animals seen
      const d = JSON.parse(JSON.stringify(packSave())); d.schema = 2; d.app = '1.8.1';
      d.S.camp = { s: S.winter.s, dest: 'johnson', nights: 3, enc: 2 }; d.S.stats.campNights = 3; d.S.stats.encounters = 2; d.S.stats.seen = { moose: 1, bear: 1 };
      const m = migrate(d); const x = m.S;
      const out = { schema: m.schema, camp: x.camp, winter: !!x.winter, seen: x.stats.seen, notes: m.notes.slice() };
      // loading it: the winter counters use it up, 7 days are left
      const keep = S; S = x; try { out.days = campDaysLeft(); out.trips = campTripsLeft(); out.used = campUsed(); out.tk = campTicket().daysLeft; campModal(); out.hub = document.querySelector('#mbg').textContent } finally { S = keep }
      // a save from an older winter: its trip belongs to last winter
      const d2 = JSON.parse(JSON.stringify(packSave())); d2.schema = 2; d2.S.camp = { s: 99, dest: 'clam', nights: 5, enc: 1 }; d2.S.stats.campNights = 5;
      const m2 = migrate(d2); const keep2 = S; S = m2.S; try { out.days2 = campDaysLeft(); out.tn2 = m2.S.camp.tot.nights } finally { S = keep2 }
      // an old game that never camped
      const d3 = JSON.parse(JSON.stringify(packSave())); d3.schema = 2; d3.S.camp = null; const m3 = migrate(d3);
      out.fresh = m3.S.camp.v === 2 && m3.S.camp.days === 0;
      return out;
    });
    assert.strictEqual(r.schema, 4); assert.strictEqual(r.camp.v, 2); assert.strictEqual(r.camp.days, 3); assert.strictEqual(r.camp.trips, 1); assert.deepStrictEqual(r.seen, { moose: 1, bear: 1 });
    assert.strictEqual(r.days, 7); assert.strictEqual(r.trips, 2); assert.strictEqual(r.used, false); assert.strictEqual(r.tk, 7); assert.ok(/7 free days/.test(r.hub), r.hub);
    assert.strictEqual(r.days2, 10); assert.strictEqual(r.tn2, 5); assert.ok(r.fresh); assert.ok(r.winter);
    noErrors(errors);
  } },
  { name: 'camping: the new achievements, the end-screen row and the log of animals', fn: async ctx => {
    const { page, errors } = await winterGame(ctx);
    const r = await page.evaluate(() => {
      closeModals(); const ach = id => ACH.find(a => a.id === id);
      const none = { all: ach('every_animal').test({}), nt: ach('no_trace').test({}) };
      KenaiCamp.data.ALL.forEach(id => { S.stats.seen[id] = 1; }); S.camp.noTrace = 1; S.stats.campNights = 8; S.camp.tot.trips = 3; S.camp.tot.nights = 8; S.camp.tot.fish = 6; S.camp.tot.gigs = 2; S.camp.ach = ['no_trace'];
      const rows = endRows().find(x => x[0] === 'Winter camping');
      return { none, all: ach('every_animal').test({}), nt: ach('no_trace').test({}), hc: ach('happy_camper').test({}), wk: ach('wild_kenai').test({}), row: rows && rows[1], n: KenaiCamp.data.ALL.length };
    });
    assert.deepStrictEqual(r.none, { all: false, nt: false }); assert.ok(r.all && r.nt && r.hc && r.wk); assert.strictEqual(r.n, 16);
    assert.ok(/8 nights over 3 trips/.test(r.row) && /16 of 16 animals logged/.test(r.row) && /6 fish/.test(r.row) && /No Trace/.test(r.row), r.row);
    noErrors(errors);
  } },
  { name: 'camping: Help and the off-season blurb describe the new camping', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const r = await page.evaluate(() => { const h = HELP.find(x => /camping/i.test(x[1])); return { t: h[2], v: APP_VERSION, notes: CHANGELOG['1.9.0'].join(' ') }; });
    assert.ok(/ice fish/i.test(r.t) && /license/i.test(r.t) && /10 free days|ten free days/i.test(r.t), r.t);
    assert.ok(/^\d+\.\d+\.\d+$/.test(r.v)); assert.ok(/camping/i.test(r.notes) && /game in progress|saved game/i.test(r.notes), r.notes);
    noErrors(errors);
  } },
];
