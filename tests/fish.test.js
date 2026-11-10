const { open, newGame, noErrors, assert } = require('./helpers');

module.exports = [
  { name: 'run timing: sockeye peaks in late July, silvers build, kings never targetable', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => ({
      sockJul13: SPECIES.sockeye.curve(194), sockJul21: SPECIES.sockeye.curve(202), sockSep1: SPECIES.sockeye.curve(244),
      cohoJul13: SPECIES.coho.curve(194), cohoJul26: SPECIES.coho.curve(207), cohoAug16: SPECIES.coho.curve(228),
      king: SPECIES.king.closed, tides: tideTable(0).length, wx: !!S.wxd[0], noise: !!S.noise[0], run: S.run[0] > 0,
    }));
    assert.ok(r.sockJul21 > r.sockJul13 && r.sockJul21 > r.sockSep1, 'sockeye peak');
    assert.ok(r.cohoJul13 < r.cohoJul26 && r.cohoJul26 < r.cohoAug16, 'coho build');
    assert.ok(r.king, 'kings closed');
    assert.ok(r.tides >= 3 && r.tides <= 5, 'two highs and two lows a day (roughly)');
    assert.ok(r.wx && r.noise && r.run, 'day 0 rolled');
    noErrors(errors);
  } },
  { name: 'boat is blocked while the party is on the dock', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const a = await page.evaluate(() => { S.cur = 1; S.t = 1440 + 330; S.loc = 'lower'; return boatAction(); });
    assert.ok(a.dis && /booked/i.test(a.s), a.s);
    noErrors(errors);
  } },
  { name: 'Monday: a registered guide vessel can’t fish below Skilak, even solo', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    await page.evaluate(() => { S.t = 600; S.loc = 'lower'; render(); boatOut(480); });
    assert.match(await page.textContent('#mbg'), /registered guide vessel/i);
    noErrors(errors);
  } },
  { name: 'no booking: take the boat out, fish, fill the freezer, scout', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => {
      S.cur = 1; S.t = 1440 + 780; S.loc = 'lower'; S.book.forEach(b => { if (b.d === 1) b.status = 'done'; });
      const a = boatAction(); if (a.dis) return { err: a.s };
      const t0 = S.t, m0 = S.money; a.fn();
      MBTN(0);            // sockeye
      MBTN(0);            // 2 hours
      return { dt: S.t - t0, paid: m0 - S.money, scout: S.scout, solo: S.solo[1] };
    });
    assert.ok(!r.err, r.err);
    assert.strictEqual(r.dt, 140); assert.ok(r.paid > 0); assert.strictEqual(r.scout, 1); assert.strictEqual(r.solo, 1);
    noErrors(errors);
  } },
  { name: 'the Fish tab renders conditions, tides and the run chart', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    await page.evaluate(() => setTab('fish'));
    const txt = await page.textContent('.content');
    assert.match(txt, /Tides today/); assert.ok(await page.$('.content svg'));
    noErrors(errors);
  } },
];
