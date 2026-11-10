// Tests for the 1.6.1 "final batch": boat safety net, long-career rep, stale text, end screen, accessibility, fuel.
const { open, newGame, noErrors, assert } = require('./helpers');

// drive the open trip dilemmas with the legal option until the trip is over
const prep = page => page.evaluate(() => { window.RUN = () => { let g = 0; while (document.getElementById('mbg') && g++ < 60) { if (S.trip && S.trip.steps[S.trip.step]) MBTN(legalBtn()); else MBTN(0) } } });

module.exports = [
  // ---- 1. the never-service safety net ----
  { name: 'boat: warnings escalate at 40, 20 and 10 (alert bar, To-do, status tag)', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 3 });
    await newGame(page); await prep(page);
    const r = await page.evaluate(() => {
      const o = {};
      closeModals(); S.cur = 2; S.t = 2880 + 100; S.loc = 'shop'; S.book = []; addBooking({ d: 2, type: 'reds', n: 3, who: 'x', from: 'Y', quirk: [] });
      for (const b of [60, 40, 20, 10, 0]) { S.boat = b; const al = alertBar(); o['a' + b] = al ? al.t : ''; o['t' + b] = todoItems().some(x => /boat|Service the boats/i.test(x.l)); o['u' + b] = (todoItems().find(x => /boats|service/i.test(x.l)) || {}).urgent; o['g' + b] = statusTags().some(t => /🔧 boat/.test(t)) }
      return o;
    });
    assert.ok(!/Boat condition/.test(r.a60) && !r.t60 && !r.g60, 'no warning at 60');
    assert.ok(/Boat condition is down to 40/.test(r.a40) && r.t40 && r.g40, 'tier 1 at 40');
    assert.ok(/rough/.test(r.a20) && r.u20, 'tier 2 at 20');
    assert.ok(/one or two more trips/.test(r.a10), 'tier 3 at 10');
    assert.ok(/out of service/.test(r.a0) && /patch/.test(r.a0) && /loaner/.test(r.a0), 'out of service names the ways out');
    noErrors(errors);
  } },
  { name: 'boat: a tile warns once as a trip wears the boat across a threshold', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 3 });
    await newGame(page); await prep(page);
    const r = await page.evaluate(() => {
      const seen = []; const o = window.showTile; window.showTile = (ic, t, s, k) => { seen.push(t); return o(ic, t, s, k) };
      closeModals(); S.cur = 1; S.t = 1440 + 340; S.loc = 'lower'; S.gear = 3; S.fuel = 30; S.book = [];
      const b = addBooking({ d: 1, type: 'reds', n: 3, who: 'x', from: 'Y', quirk: [] });
      S.boat = 42; const t = { id: b.id, late: 0, boat0: 42, q: 0, happy: 0, notes: [], step: 0, steps: [], shore: false, nofish: 0, kept: 0, abort: false, x: [], lost: 0 };
      S.trip = t; Math.random = () => .9; tripEnd(b, t); closeModals();
      return { seen, boat: S.boat };
    });
    assert.ok(r.boat <= 40 && r.seen.some(s => /Boat condition/.test(s)), JSON.stringify(r));
    noErrors(errors);
  } },
  { name: 'boat: emergency patch only near death, costs money, gets the boat to 25 so the trip can launch', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 3 });
    await newGame(page); await prep(page);
    const r = await page.evaluate(() => {
      closeModals(); S.cur = 1; S.t = 1440 + 340; S.loc = 'lower'; S.gear = 3; S.fuel = 30; S.money = 5000; S.book = [];
      const b = addBooking({ d: 1, type: 'reds', n: 3, who: 'x', from: 'Y', quirk: [] }); const o = {};
      S.boat = 30; o.no30 = !actionsHere().some(a => /Emergency patch/.test(a.l));
      S.boat = 0; o.blocked = !!actionsHere().find(a => a.cat === 'trip').dis;
      const p = actionsHere().find(a => /Emergency patch/.test(a.l)); o.has = !!p;
      const m0 = S.money, t0 = S.t; p.fn(); o.paid = m0 - S.money; o.mins = S.t - t0; o.boat = S.boat;
      o.launch = !actionsHere().find(a => a.cat === 'trip').dis; S.t = 1440 + 360; tripStart(b); o.started = !!S.trip; RUN(); o.done = b.status;
      S.boat = 0; S.loc = 'shop'; o.shop = actionsHere().some(a => /Emergency patch/.test(a.l));
      return o;
    });
    assert.ok(r.no30 && r.has && r.blocked); assert.strictEqual(r.paid, 600); assert.strictEqual(r.mins, 60); assert.strictEqual(r.boat, 25);
    assert.ok(r.launch && r.started && r.done === 'done' && r.shop);
    noErrors(errors);
  } },
  { name: 'boat: a loaner runs today’s trip for a fee, spares your boat, and needs renting again tomorrow', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 3 });
    await newGame(page); await prep(page);
    const r = await page.evaluate(() => {
      closeModals(); S.cur = 1; S.t = 1440 + 340; S.loc = 'lower'; S.gear = 3; S.fuel = 30; S.money = 5000; S.book = [];
      const b = addBooking({ d: 1, type: 'reds', n: 3, who: 'x', from: 'Y', quirk: [] }); const o = {};
      S.boat = 0; const l = actionsHere().find(a => /loaner/i.test(a.l)); o.has = !!l;
      const m0 = S.money; l.fn(); o.paid = m0 - S.money; o.out = noBoat();
      o.svcLocked = (S.loc = 'shop', actionsHere().find(a => /Service the boats/.test(a.l)).dis); S.loc = 'lower';
      S.t = 1440 + 360; tripStart(b); o.started = !!S.trip; RUN(); o.done = b.status; o.boat = S.boat; o.note = /borrowed rig/.test((S.log.map(x => x.s).join(' ')) + JSON.stringify(b.out));
      S.cur = 2; S.t = 2880 + 300; o.nextOut = noBoat(); o.canRentAgain = true;
      return o;
    });
    assert.ok(r.has && r.started && r.done === 'done'); assert.strictEqual(r.paid, 600); assert.ok(!r.out); assert.ok(r.svcLocked);
    assert.strictEqual(r.boat, 0, 'a loaner trip does not wear your boat'); assert.ok(r.nextOut, 'out of service again the next day');
    noErrors(errors);
  } },

  // ---- 2. long careers: nothing at the wake hook may cost a booked trip ----
  { name: 'rep: the Board of Fisheries hearing only comes on a day with no trips (it used to cause a no-show)', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 5 });
    await page.evaluate(() => setPref('years', 10));
    await newGame(page);
    const r = await page.evaluate(() => {
      closeModals(); S.cur = 14 * 3 + 4; S.t = S.cur * 1440 + 300; S.rep = 80; S.arcs.board = { st: 2, s: 1 }; S.arcs.day = -1; S.book = [];
      const ev = EV.find(e => e.id === 'arc_board'), o = {};
      o.free = !!ev.cond();
      addBooking({ d: S.cur, type: 'reds', n: 3, who: 'x', from: 'Y', quirk: [] });
      o.busy = !!ev.cond();
      S.arcs.board = { st: 1, s: 1 }; o.vote = !!ev.cond();   // the committee vote takes no time, so it can still come on a trip day
      return o;
    });
    assert.ok(r.free, 'testimony is possible on a free day'); assert.ok(!r.busy, 'but not on a day with a trip booked'); assert.ok(r.vote);
    noErrors(errors);
  } },
];
