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
];
