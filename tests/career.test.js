const { open, newGame, noErrors, assert } = require('./helpers');

module.exports = [
  { name: 'career length sets the run: 2, 5 or 10 seasons of 14 days', fn: async ctx => {
    const { page, errors } = await open(ctx);
    for (const y of [2, 5, 10]) {
      await page.evaluate(y => setPref('years', y), y);
      await newGame(page);
      assert.deepStrictEqual(await page.evaluate(() => [S.years, GAME.days]), [y, 14 * y]);
    }
    noErrors(errors);
  } },
  { name: 'calendar: each season starts on the Monday nearest July 13', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => [dlongY(0), dlongY(14), dlongY(28), dlongY(27), doyOf(0), evenYear(0), evenYear(14)]);
    assert.deepStrictEqual(r, ['Monday, July 13, 2026', 'Monday, July 12, 2027', 'Monday, July 10, 2028', 'Sunday, July 25, 2027', 194, true, false]);
    noErrors(errors);
  } },
  { name: 'season rollover: bills, new rules, off-season, new bookings', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await page.evaluate(() => setPref('years', 5));
    await newGame(page);
    const r = await page.evaluate(async () => {
      closeModals(); S.money = 20000; S.cur = 13; S.t = 13 * 1440 + 1300; S.loc = 'shop';
      S.book.forEach(b => { if (b.status === 'booked') b.status = 'done'; });
      const m0 = S.money; endDay('home');
      await new Promise(r => setTimeout(r, 10));
      const winter = !!S.winter, modalTxt = (document.querySelector('#mbg') || {}).textContent || '';
      const acts = actionsHere().map(a => a.l);
      const req = makeRequest();
      closeModals(); finishWinter();
      return { cur: S.cur, season: seasonOf(S.cur), year: REG().year, paid: m0 - S.money, winter, acts, req,
        booked: S.book.filter(b => seasonOf(b.d) === 1).length, seasons: S.seasons.length, limit: S.limit };
    });
    assert.strictEqual(r.cur, 14); assert.strictEqual(r.season, 1); assert.strictEqual(r.year, 2027);
    assert.ok(r.paid >= 3900, 'winter bills paid');   // 1.10.1: living costs $800 (was $1,300), so $500 less than before assert.ok(r.winter, 'off-season pending');
    assert.deepStrictEqual(r.acts, ['Plan the off-season']); assert.strictEqual(r.req, null, 'no calls during the off-season');
    assert.ok(r.booked > 0, 'new bookings'); assert.strictEqual(r.seasons, 1); assert.strictEqual(r.limit, 3);
    noErrors(errors);
  } },
  { name: 'upgrades: rates need rep, a rebuilt motor restores the boat', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => {
      S.money = 50000; S.rep = 40; S.boat = 30;
      const rates = UPGRADES.find(u => u.id === 'rates'), motor = UPGRADES.find(u => u.id === 'motor');
      const why = upOK(rates); buyUp(motor); S.rep = 70; buyUp(rates);
      return { why, boat: S.boat, again: upOK(motor), rate: S.up.rate, pay: payOf({ type: 'reds', n: 2 }) };
    });
    assert.match(r.why, /Rep 65/); assert.strictEqual(r.boat, 100); assert.strictEqual(r.again, 'Done');
    assert.strictEqual(r.rate, 1.1); assert.strictEqual(r.pay, Math.round(275 * 2 * 1.1));
    noErrors(errors);
  } },
  { name: 'first-aid card lasts two years; citations drop off after a season', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await page.evaluate(() => setPref('years', 5));
    await newGame(page);
    const r = await page.evaluate(() => {
      closeModals(); S.cur = 1; const to = faRenewTo(1); S.cred.fa = to;
      const due = [faDue(1), faDue(14), faDue(28)];
      S.citeLog = [3]; S.cites = 1; startSeason(1); const c1 = S.cites; S.winter = null; startSeason(2); const c2 = S.cites; S.winter = null;
      return { to, due, c1, c2 };
    });
    assert.strictEqual(r.to, 30); assert.deepStrictEqual(r.due, [false, false, true]);
    assert.strictEqual(r.c1, 1); assert.strictEqual(r.c2, 0);
    noErrors(errors);
  } },
  { name: 'later seasons can change the king and halibut rules', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => {
      const s0 = genRegs(0), seen = new Set(), sizes = new Set();
      for (let i = 0; i < 200; i++) { const g = genRegs(3); seen.add(g.king); sizes.add(g.hal.size); }
      return { k0: s0.king, h0: s0.hal, kings: [...seen].sort(), sizes: sizes.size };
    });
    assert.strictEqual(r.k0, 'closed'); assert.deepStrictEqual(r.h0, { size: 27, closed: [1, 2] });
    assert.deepStrictEqual(r.kings, ['closed', 'cr', 'open']); assert.ok(r.sizes > 2);
    noErrors(errors);
  } },
];
