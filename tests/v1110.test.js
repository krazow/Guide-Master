// Version 1.11.0 balance knobs: Combat Season's price rises and skill, the cabin's grace, and the data checks that go with them.
const { open, newGame, noErrors, assert } = require('./helpers');

module.exports = [
  { name: 'difficulty: Combat Season trades cheaper price rises for less reward from reading the water and camping; Rookie and Licensed Guide are unchanged', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const r = await page.evaluate(() => {
      const out = {};
      for (const k of ['easy', 'normal', 'hard']) {
        newGame(k); closeModals(); S.up.rate = 1.3;
        S.camp.boost = { s: seasonOf(day()), q: .03, book: .02 }; S.stats.trips = 0; S.st0 = { trips: 0 };
        const b = S.book.find(x => TRIPS[x.type].len && x.type === 'reds' || x.type === 'silver') || S.book[0];
        const t = { q: 0, happy: 0, notes: [] };
        // a spot whose fit is not zero: the same conditions on every difficulty
        let spot = -1, fit = 0; for (let i = 0; i < SPOTS[b.type].length && spot < 0; i++) { const f = spotFit(b.type, i, day(), true); if (f && Math.abs(f.f) > .05) { spot = i; fit = f.f } }
        const opt = STEP.spot(b, t).o[spot]; opt.fn(b, t);
        out[k] = { craft: DF().craft, rateK: DF().rateK, demand: Math.round(rateDemand() * 1000) / 1000, campQ: campQ(), campBook: campBook(seasonOf(day())), spotQ: Math.round((t.q - SPOTS[b.type][spot].q) * 1e4) / 1e4, fit, mood: DF().mood };
      }
      return out;
    });
    for (const k of ['easy', 'normal']) { assert.strictEqual(r[k].craft, 1, k); assert.strictEqual(r[k].rateK, 1, k); }
    assert.ok(r.normal.demand === .685 && r.easy.demand === .685, 'at +30% 31.5% of bookings go on Rookie and Licensed Guide: ' + JSON.stringify([r.easy.demand, r.normal.demand]));
    assert.ok(r.hard.demand > r.normal.demand + .04, `Combat Season keeps more bookings at the same price: ${r.hard.demand}`);
    assert.strictEqual(r.normal.campQ, .03); assert.strictEqual(r.normal.campBook, .02);
    assert.strictEqual(r.hard.campQ, 0, 'camping pays less on Combat Season'); assert.strictEqual(r.hard.campBook, 0);
    assert.ok(Math.abs(r.normal.spotQ - r.normal.fit * .15) < 1e-3 && r.hard.spotQ === 0, `spot fit pays ${r.normal.spotQ} and ${r.hard.spotQ}`);
    assert.ok(r.hard.mood < r.normal.mood && r.normal.mood < r.easy.mood);
    assert.ok(/fewer bookings/.test(await page.evaluate(() => DIFFS.hard.d)) && /camping pay less/.test(await page.evaluate(() => DIFFS.hard.d)), 'the difficulty description says so');
    noErrors(errors);
  } },
  { name: 'cabin: the first week of a career is quiet, and the winter jobs wait for the first fall', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const r = await page.evaluate(() => {
      newGame('normal'); closeModals(); const out = {};
      for (const d of [0, 3, 6]) { S.cur = d; S.t = d * 1440 + 400; out['d' + d] = CabinUpkeep.dueCount(homeTicket()) }
      S.cur = 9; S.t = 9 * 1440 + 400; const all = CabinUpkeep.jobs(homeTicket(), { all: true }).map(j => j.id);
      out.late = all; return out;
    });
    assert.strictEqual(r.d0 + r.d3 + r.d6, 0, 'no cabin jobs due in the first week: ' + JSON.stringify(r));
    assert.ok(!r.late.some(id => ['tape', 'skirt', 'detect', 'strap'].includes(id)), 'the cold-weather jobs wait for fall: ' + r.late);
    noErrors(errors);
  } },
];
