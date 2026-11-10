const { open, newGame, noErrors, assert } = require('./helpers');

module.exports = [
  { name: 'fuel: start part-full, fill only at the Kenai Harbor fuel dock', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => {
      closeModals(); const start = S.fuel, inTown = (() => { S.loc = 'town'; return actionsHere().some(a => /Fill the jet sled/.test(a.l)); })();
      S.loc = 'harbor'; S.t = 600; const a = actionsHere().find(x => /Fill the jet sled/.test(x.l)); const m0 = S.money, p = fuelPrice('kenai');
      a.fn(); return { start, inTown, fuel: S.fuel, tank: SLED_TANK(), paid: Math.round((m0 - S.money) * 100) / 100, expect: Math.round((SLED_TANK() - start) * p * 100) / 100 };
    });
    assert.strictEqual(r.start, 18); assert.strictEqual(r.inTown, false, 'no fuel in town');
    assert.strictEqual(r.fuel, r.tank); assert.ok(Math.abs(r.paid - r.expect) < 0.02, `${r.paid} vs ${r.expect}`);
    noErrors(errors);
  } },
  { name: 'a sockeye trip burns fuel from the tank', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => {
      closeModals(); S.cur = 1; S.t = 1440 + 345; S.loc = 'lower'; S.fuel = 30;
      const b = todays()[0]; tripStart(b); let i = 0; while (S.trip && i++ < 30) MBTN(0); closeModals();
      return { fuel: S.fuel, tows: S.stats.tows, status: b.status };
    });
    assert.strictEqual(r.status, 'done'); assert.ok(r.fuel < 30 && r.fuel > 10, `fuel ${r.fuel}`); assert.strictEqual(r.tows, 0);
    noErrors(errors);
  } },
  { name: 'run dry on a trip: Coast Guard tow, half refund, end up at the harbor', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => {
      closeModals(); S.cur = 1; S.t = 1440 + 345; S.loc = 'lower'; S.fuel = 1;
      const b = todays()[0]; tripStart(b);
      const first = document.querySelector('#mbg h2').textContent;
      MBTN(1);                                     // risk it
      let i = 0; while (S.trip && i++ < 30) MBTN(0);
      const txt = document.querySelector('#mbg').textContent; closeModals();
      return { first, tows: S.stats.tows, loc: S.loc, fuel: S.fuel, towedTxt: /Towed in/.test(txt) && /Coast Guard/.test(txt) };
    });
    assert.match(r.first, /Low on fuel/); assert.strictEqual(r.tows, 1); assert.strictEqual(r.loc, 'harbor'); assert.strictEqual(r.fuel, 0); assert.ok(r.towedTxt);
    noErrors(errors);
  } },
  { name: 'scouting on an empty tank gets you towed', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => {
      closeModals(); S.cur = 2; S.t = 2 * 1440 + 800; S.loc = 'lower'; S.fuel = 1; S.book.forEach(b => { if (b.d === 2) b.status = 'done'; });
      actionsHere().find(a => /Scout the river/.test(a.l)).fn();
      return { tows: S.stats.tows, loc: S.loc };
    });
    assert.deepStrictEqual(r, { tows: 1, loc: 'harbor' });
    noErrors(errors);
  } },
  { name: 'off-season settles the rest of the summer and realistic upgrade prices', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await page.evaluate(() => setPref('years', 2));
    await newGame(page);
    const r = await page.evaluate(() => {
      closeModals(); S.stats.trips = 12; S.stats.earned = 14000; const rest = restOfSeason({ trips: 12, fares: 14000 });
      return { rest, motor: UPGRADES.find(u => u.id === 'motor').cost, sled: UPGRADES.find(u => u.id === 'sled').cost, chp: UPGRADES.find(u => u.id === 'chp').cost };
    });
    assert.ok(r.rest.trips > 12 && r.rest.net > 0 && r.rest.net < r.rest.gross);
    assert.ok(r.motor >= 10000 && r.sled >= 40000 && r.chp >= 100000);
    noErrors(errors);
  } },
];
