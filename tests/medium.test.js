// Tests for the 1.6.0 "medium batch": rates cost something, money has a purpose, Wait until…, night summary first, more content.
const { open, newGame, noErrors, assert } = require('./helpers');

module.exports = [
  // ---- 1. rates ----
  { name: 'rates: each step needs more rep, cuts bookings and makes clients pickier', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await page.evaluate(() => setPref('years', 5));
    await newGame(page);
    const r = await page.evaluate(() => {
      const out = {};
      const u = UPGRADES.find(x => x.id === 'rates');
      S.rep = 70; out.need0 = rateRep(); out.ok0 = upOK(u);
      S.up.rate = 1.1; out.need1 = rateRep(); out.ok1 = upOK(u);   // rep 70 buys step 2
      S.up.rate = 1.2; out.need2 = rateRep(); out.ok2 = upOK(u);   // step 3 needs 75
      S.up.rate = 1.3; out.ok3 = upOK(u);
      // demand: season bookings and the rest of the summer both shrink with price
      const count = rate => { S.up.rate = rate; S.rep = 90; let n = 0; for (let i = 0; i < 40; i++) { S.book = []; genSeasonBookings(1); n += S.book.length } return n / 40 };
      out.b10 = count(1); out.b13 = count(1.3);
      const p = { trips: 30, fares: 30 * 1100, wom: 0 };
      S.up.rate = 1; out.r10 = restOfSeason(p).trips; S.up.rate = 1.3; out.r13 = restOfSeason(p).trips;
      return out;
    });
    assert.deepStrictEqual([r.need0, r.need1, r.need2], [65, 70, 75]);
    assert.strictEqual(r.ok0, null); assert.strictEqual(r.ok1, null); assert.strictEqual(r.ok2, 'Needs Rep 75'); assert.strictEqual(r.ok3, 'Maxed out');
    assert.ok(r.b13 < r.b10 * .85, `season bookings drop with price ${r.b10} -> ${r.b13}`);
    assert.ok(r.r13 < r.r10 * .85, `rest-of-season trips drop ${r.r10} -> ${r.r13}`);
    noErrors(errors);
  } },
  { name: 'rates: the same day leaves clients less happy at higher rates', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 7 });
    await newGame(page);
    const r = await page.evaluate(() => {
      const run = rate => {
        newGame('normal'); closeModals(); S.up.rate = rate; S.cur = 3; S.t = 3 * 1440 + 360; S.loc = 'lower'; S.gear = 3; S.fuel = 30; S.boat = 90;
        const b = addBooking({ d: 3, type: 'reds', n: 4, who: 'testers', from: 'X', quirk: [] });
        let a = 123456; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
        const t = { id: b.id, late: 0, q: 0, happy: 0, notes: [], step: 0, steps: [], shore: false, nofish: 0, kept: 0, abort: false, x: [], lost: 0 };
        S.trip = t; tripEnd(b, t); closeModals();
        return b.out.happy;
      };
      return { lo: run(1), hi: run(1.3) };
    });
    assert.strictEqual(r.lo - r.hi, 9, `three steps cost 9 happiness: ${r.lo} -> ${r.hi}`);
    noErrors(errors);
  } },

  // ---- 2. money has a purpose ----
  { name: 'repower burns ~20% less fuel; the new sled saves 30 minutes and a faster fuel run', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 3 });
    await newGame(page);
    const r = await page.evaluate(() => {
      const run = up => {
        newGame('normal'); closeModals(); Object.assign(S.up, up); S.cur = 3; S.t = 3 * 1440 + 360; S.fuel = 30; S.gear = 3; S.boat = 90;
        const b = addBooking({ d: 3, type: 'reds', n: 4, who: 'testers', from: 'X', quirk: [] });
        let a = 99; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
        const f0 = S.fuel, t0 = S.t, gal0 = tripFuel(b).gal;
        S.trip = { id: b.id, late: 0, q: 0, happy: 0, notes: [], step: 0, steps: [], shore: false, nofish: 0, kept: 0, abort: false, x: [], lost: 0 };
        tripEnd(b, S.trip); closeModals();
        return { burned: f0 - S.fuel, mins: S.t - t0, gal0 };
      };
      return { plain: run({}), motor: run({ motor: true }), sled: run({ sled: true }) };
    });
    assert.ok(r.motor.gal0 < r.plain.gal0 * .85, 'planned burn falls');
    assert.ok(r.motor.burned < r.plain.burned * .85, `fuel burned ${r.plain.burned} -> ${r.motor.burned}`);
    assert.strictEqual(r.plain.mins - r.sled.mins, 30, 'new sled: 30 minutes quicker');
    noErrors(errors);
  } },
  { name: 'a boat at condition 0 is out of service until a major repair', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 3 });
    await newGame(page);
    const r = await page.evaluate(() => {
      closeModals(); S.cur = 1; S.t = 1440 + 340; S.loc = 'lower'; S.gear = 3; S.fuel = 30; S.money = 5000;
      S.book = []; const b = addBooking({ d: 1, type: 'reds', n: 3, who: 'testers', from: 'X', quirk: [] });
      S.boat = 0; const out = { down: boatDown() };
      const launch = actionsHere().find(a => a.cat === 'trip');
      out.launchDis = !!launch.dis; out.launchTxt = launch.l;
      tripStart(b); out.started = !!S.trip;
      out.solo = !!(boatAction() || {}).dis;
      S.loc = 'shop'; const acts = actionsHere();
      const svc = acts.find(a => /Service the boats/.test(a.l)), dealer = acts.find(a => /Dealer 100-hour/.test(a.l)), major = acts.find(a => /Major repair/.test(a.l));
      out.svcDis = !!svc.dis; out.dealerDis = !!dealer.dis; out.major = !!major && !major.dis;
      const m0 = S.money; major.fn(); out.boat = S.boat; out.paid = m0 - S.money; out.after = boatDown();
      S.boat = 0; S.loc = 'homer'; S.book = []; const hb = addBooking({ d: 1, type: 'halibut', n: 4, who: 'h', from: 'X', quirk: [] }); S.t = 1440 + 330;
      out.halibutOk = !actionsHere().some(a => /out of service/.test(a.l));
      return out;
    });
    assert.ok(r.down && r.launchDis && /out of service/.test(r.launchTxt)); assert.ok(!r.started); assert.ok(r.solo);
    assert.ok(r.svcDis && r.dealerDis && r.major); assert.strictEqual(r.boat, 50); assert.strictEqual(r.paid, 2400); assert.ok(!r.after);
    assert.ok(r.halibutOk, 'the buddy’s charter boat is not yours');
    noErrors(errors);
  } },
  { name: 'winter wear alone never takes a boat out of service', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await page.evaluate(() => setPref('years', 5));
    await newGame(page);
    const r = await page.evaluate(async () => {
      closeModals(); S.boat = 4; S.cur = 13; S.t = 13 * 1440 + 1300; S.loc = 'shop';
      S.book.forEach(b => { if (b.status === 'booked') b.status = 'done'; }); S.stats.trips = 30; S.stats.earned = 30000;
      endDay('home'); await new Promise(r => setTimeout(r, 10)); closeModals();
      return S.boat;
    });
    assert.ok(r >= 4, 'boat after winter ' + r);
    noErrors(errors);
  } },
  { name: 'assistant guide: second trip in a booked slot, 60% cut, settled overnight', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 11 });
    await page.evaluate(() => setPref('years', 10));
    await newGame(page);
    const r = await page.evaluate(() => {
      closeModals(); const out = {};
      const u = UPGRADES.find(x => x.id === 'asst');
      S.money = 90000; S.rep = 80; out.gate0 = upOK(u); S.seasons = [{}, {}]; out.gate1 = upOK(u);
      buyUp(u); out.has = !!S.up.asst; out.winter = winterCosts().some(([n]) => /Assistant/.test(n));
      S.book = []; S.cur = 2; S.t = 2 * 1440 + 400;
      addBooking({ d: 2, type: 'reds', n: 3, who: 'mine', from: 'X', quirk: [] });
      out.conflict = conflicts(2, 'reds'); out.asstFree = !conflicts(2, 'reds', true);
      const ab = addBooking({ d: 2, type: 'reds', n: 3, who: 'his', from: 'X', quirk: [], asst: true });
      out.todays = todays(2).map(b => b.who);
      const m0 = S.money; const notes = []; onNight('home', notes, 2);
      out.status = ab.status; out.gain = Math.round(S.money - m0); out.fare = payOf(ab); out.note = notes.some(n => /assistant/i.test(n));
      out.noshowMine = S.book.find(b => b.who === 'mine').status;
      // a booking request for a slot you already hold goes to the assistant
      S.book = []; S.cur = 1; S.t = 1440 + 400; S.calls = {}; S.dipnetAsk = 99; addBooking({ d: 3, type: 'reds', n: 3, who: 'x', from: 'X', quirk: [] });
      const seen = new Set(); for (let i = 0; i < 400; i++) { const q = makeRequest(); if (q && q.asst) seen.add(q.type) } out.reqAsst = [...seen];
      // season bookings include overlapping assistant trips
      S.rep = 95; S.up.rate = 1; let n = 0, ok = true; for (let i = 0; i < 15; i++) { S.book = []; genSeasonBookings(1); S.book.filter(b => b.asst).forEach(b => { n++; if (!S.book.some(o => !o.asst && o.d === b.d && o.id !== b.id)) ok = false }) }
      out.genAsst = n; out.genOverlap = ok;
      return out;
    });
    assert.strictEqual(r.gate0, 'Needs two seasons first'); assert.strictEqual(r.gate1, null); assert.ok(r.has && r.winter);
    assert.ok(r.conflict && r.asstFree); assert.deepStrictEqual(r.todays, ['mine'], 'his trip is not on your schedule');
    assert.strictEqual(r.status, 'done'); assert.ok(r.note); assert.strictEqual(r.noshowMine, 'noshow');
    assert.ok(r.gain < r.fare * .75 && r.gain > -2000, `your share of ${r.fare} is ${r.gain}`);
    assert.ok(r.reqAsst.length > 0, 'requests overlapping your trips can go to the assistant');
    assert.ok(r.genAsst > 10 && r.genOverlap, 'season bookings give the assistant overlapping parties');
    noErrors(errors);
  } },
  { name: 'guest cabins and a riverfront dock: real income, real savings', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 5 });
    await page.evaluate(() => setPref('years', 10));
    await newGame(page);
    const r = await page.evaluate(() => {
      closeModals(); const out = {}; S.rep = 80; S.money = 500000; S.seasons = [{}, {}, {}, {}];
      const p = { trips: 30, fares: 33000, wom: 0 };
      out.base = restOfSeason(p).net;
      buyUp(UPGRADES.find(x => x.id === 'lodge')); out.lodge = restOfSeason(p).net; out.lodgeWinter = winterCosts().some(([n]) => /Cabins/.test(n));
      out.dockPrice = fuelPrice('dock'); out.harborPrice = fuelPrice('kenai');
      const dock = UPGRADES.find(x => x.id === 'dock'); out.dockOk = upOK(dock); buyUp(dock);
      S.loc = 'shop'; S.fuel = 5; out.dockAct = actionsHere().some(a => /own dock/.test(a.l));
      const f = actionsHere().find(a => /own dock/.test(a.l)); f.fn(); out.fuel = S.fuel;
      S.cur = 3; S.t = 3 * 1440 + 360; const b = addBooking({ d: 3, type: 'reds', n: 3, who: 'q', from: 'X', quirk: [] });
      S.trip = { id: b.id, late: 0, q: 0, happy: 0, notes: [], step: 0, steps: [], shore: false, nofish: 0, kept: 0, abort: false, x: [], lost: 0 };
      S.gear = 3; S.fuel = 30; tripEnd(b, S.trip); closeModals(); out.launchFee = (b.out.fare + b.out.tip - b.out.refund) - b.out.net;
      return out;
    });
    assert.ok(r.lodge > r.base + 3000, `cabins add income ${r.base} -> ${r.lodge}`); assert.ok(r.lodgeWinter);
    assert.ok(r.dockPrice < r.harborPrice - .5); assert.strictEqual(r.dockOk, null); assert.ok(r.dockAct); assert.ok(r.fuel > 29);
    assert.strictEqual(r.launchFee, 0, 'no launch fee at your own ramp');
    noErrors(errors);
  } },

  // ---- 3. Wait until… and the 5:00 AM alarm ----
  { name: 'new games wake at 5:00 AM; an old save keeps its alarm', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => ({ alarm: S.alarm, t: S.t, fmt: fmt(S.t) }));
    assert.strictEqual(r.alarm, 300); assert.strictEqual(r.t, 300);
    const old = await page.evaluate(() => { closeModals(); S.alarm = 240; S.cur = 0; S.t = 1300; S.loc = 'shop'; endDay('home'); closeModals(); return [S.alarm, S.t - 1440]; });
    assert.deepStrictEqual(old, [240, 240], 'an existing alarm setting stays');
    noErrors(errors);
  } },
  { name: 'Wait until…: next launch, the 1 PM class, +30 and +60 minutes', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 4 });
    await newGame(page);
    const r = await page.evaluate(() => {
      closeModals(); const out = {};
      S.book = []; S.cur = 1; S.t = 1440 + 200; S.loc = 'lower'; addBooking({ d: 1, type: 'reds', n: 3, who: 'early', from: 'X', quirk: [] });
      out.here = waitChoices().map(x => x.l);
      out.action = actionsHere().some(a => /Wait until/.test(a.l));
      const w = waitChoices().find(x => /show up/.test(x.l)); const a = actionsHere().find(x => /Wait until/.test(x.l)); a.fn();
      const btn = [...document.querySelectorAll('#mbg button.act')].findIndex(b => /show up/.test(b.textContent)); MBTN(btn);
      out.t = tod(); out.launch = !!actionsHere().find(x => /Meet the/.test(x.l) && !x.dis);
      // away from the launch: wait until it is time to leave
      S.t = 1440 + 200; S.loc = 'shop'; out.away = waitChoices().map(x => x.l);
      // the first-aid class
      S.book = []; S.cred.fa = 1; S.cur = 0; S.t = 600; S.loc = 'town'; out.fa = waitChoices().map(x => x.l);
      S.cur = 0; S.t = 1439 - 20; out.late = waitChoices().map(x => x.l);   // 23:39: +30 would pass midnight
      return out;
    });
    assert.ok(r.action); assert.ok(r.here.some(l => /show up: 5:00 AM/.test(l)), r.here.join('|')); assert.strictEqual(r.t, 300); assert.ok(r.launch, 'the launch is open after waiting');
    assert.ok(r.here.some(l => /30 more/.test(l)) && r.here.some(l => /60 more/.test(l)));
    assert.ok(r.away.some(l => /time to leave for the sockeye trip/.test(l)), r.away.join('|'));
    assert.ok(r.fa.some(l => /1:00 PM first-aid class/.test(l)), r.fa.join('|'));
    assert.ok(!r.late.some(l => /60 more/.test(l)), 'no waiting past midnight');
    noErrors(errors);
  } },
];
