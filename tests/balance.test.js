const { open, newGame, noErrors, assert } = require('./helpers');

module.exports = [
  { name: 'difficulty gives no score bonus and costs rise with difficulty', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const r = await page.evaluate(() => {
      const out = {};
      for (const k of ['easy', 'normal', 'hard']) {
        newGame(k); closeModals();
        out[k] = { score: DIFFS[k].score, fuel: fuelPrice('kenai', 3), overhead: overhead(), winter: winterCosts().reduce((a, [, c]) => a + c, 0), enforce: DF().enforce, mood: DF().mood, book: DF().book,
          rest: restOfSeason({ trips: 15, fares: 15000 }).net, sc: scoreOf() };
      }
      return out;
    });
    for (const k of ['easy', 'normal', 'hard']) assert.ok(r[k].score === undefined || r[k].score === 1, k + ' has a score multiplier');
    assert.ok(r.hard.fuel > r.normal.fuel && r.normal.fuel > r.easy.fuel, 'fuel');
    assert.ok(r.hard.overhead > r.normal.overhead && r.normal.overhead > r.easy.overhead, 'overhead');
    assert.ok(r.hard.winter > r.normal.winter && r.normal.winter > r.easy.winter, 'winter bills');
    assert.ok(r.hard.enforce > r.normal.enforce && r.normal.enforce > r.easy.enforce, 'enforcement');
    assert.ok(r.hard.mood < r.normal.mood && r.normal.mood < r.easy.mood, 'client mood');
    assert.ok(r.hard.book < r.normal.book && r.normal.book < r.easy.book, 'bookings');
    assert.ok(r.hard.rest < r.normal.rest && r.normal.rest < r.easy.rest, 'rest of season');
    assert.strictEqual(r.normal.overhead, 75);
    noErrors(errors);
  } },
  { name: 'hard catches more violators and fines escalate with each citation', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 7 });
    const r = await page.evaluate(() => {
      const rate = k => { newGame(k); closeModals(); let n = 0; const oc = window.cite; window.cite = () => { n++; }; for (let i = 0; i < 4000; i++) violate([], { p: .3, fine: 400, what: 'x' }); window.cite = oc; return n / 4000; };
      const out = { easy: rate('easy'), normal: rate('normal'), hard: rate('hard') };
      const fineAt = (k, prior) => { newGame(k); closeModals(); S.cites = prior; S.money = 5000; const m = S.money; cite('x', 400, false, []); return m - S.money; };
      out.fn = fineAt('normal', 0); out.fn2 = fineAt('normal', 2); out.fh = fineAt('hard', 0); out.fh2 = fineAt('hard', 2);
      return out;
    });
    assert.ok(r.hard > r.normal * 1.2 && r.normal > r.easy * 1.2, JSON.stringify(r));
    assert.strictEqual(r.fn, 400); assert.strictEqual(r.fn2, 400);
    assert.ok(r.fh >= 400 && r.fh2 > r.fh * 1.3, JSON.stringify(r));
    noErrors(errors);
  } },
  { name: 'grades: per-season cutoffs are the same on every difficulty and boundaries hold', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const r = await page.evaluate(() => {
      const out = {};
      for (const k of ['easy', 'normal', 'hard']) {
        newGame(k); closeModals(); S.years = 2;
        out[k] = [132000, 131999, 114000, 113999, 90000, 89999, 56000, 55999, 0].map(x => gradeOf(x)[0]).join('');
      }
      newGame('normal'); closeModals(); S.years = 5;
      out.five = [330000, 329999, 285000, 284999, 225000, 224999, 140000, 139999].map(x => gradeOf(x)[0]).join('');
      out.cuts = GRADE_CUTS; return out;
    });
    assert.strictEqual(r.normal, 'ABBCCDDFF');
    assert.strictEqual(r.easy, r.normal); assert.strictEqual(r.hard, r.normal);
    assert.strictEqual(r.five, 'ABBCCDDF');
    assert.deepStrictEqual(r.cuts, [66000, 57000, 45000, 28000]);
    noErrors(errors);
  } },
  { name: 'end screen and rules text show the difficulty', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const r = await page.evaluate(() => { newGame('hard'); closeModals(); return { rows: endRows().find(x => x[0] === 'Difficulty')[1], rules: RULES_HTML }; });
    assert.match(r.rows, /Combat Season/); assert.match(r.rules, /no score bonus/); assert.match(r.rules, /66,000/);
    noErrors(errors);
  } },
];
