const { open, newGame, noErrors, assert } = require('./helpers');

// Press the first enabled button in the open pop-up (by design the first option is the legal one).
const pressFirst = page => page.evaluate(() => {
  const m = document.getElementById('mbg'); if (!m) return false;
  const i = [...m.querySelectorAll('.modal > button.act')].findIndex(b => !b.disabled);
  if (i < 0) return false; MBTN(i); return true;
});

module.exports = [
  { name: 'first run: name → difficulty → welcome → game', fn: async ctx => {
    const { page, errors } = await open(ctx, { quiet: false });
    await page.click('.title .big');
    await page.fill('#nmIn', 'Robin');
    await page.click('#mbg button.act');                          // That's me
    await page.click('#mbg button.act >> text=Licensed Guide');   // difficulty
    await page.click('#mbg button.act >> text=5-year career');    // career length
    while (await page.$('#mbg')) await pressFirst(page);          // welcome (and any morning pop-ups)
    await page.waitForSelector('.hud');
    assert.match(await page.textContent('.hud-sub'), /Robin/);
    assert.strictEqual(await page.evaluate(() => [S.name, S.diff, S.loc, S.years, GAME.days].join()), 'Robin,normal,shop,5,70');
    noErrors(errors);
  } },
  { name: 'every tab renders', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const tabs = await page.evaluate(() => allTabs().map(t => t[0]));
    for (const k of ['book', 'regs']) assert.ok(tabs.includes(k), `tab ${k}`);
    for (const k of tabs) { await page.evaluate(k => setTab(k), k); assert.ok(await page.$('.content')); }
    noErrors(errors);
  } },
  { name: 'run a sockeye trip: get paid, owe a logbook entry', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r0 = await page.evaluate(() => {
      closeModals(); S.cur = 1; S.t = 1440 + 330; S.loc = 'lower'; S.unlogged = 0; S.overdue = 0;
      const b = todays().find(x => x.type === 'reds') || todays()[0];
      const m = S.money; tripStart(b); return { id: b.id, m };
    });
    for (let i = 0; i < 40 && await page.evaluate(() => !!S.trip); i++) {
      if (!(await pressFirst(page))) await page.evaluate(() => S.trip && tripNext());
    }
    while (await page.$('#mbg')) await pressFirst(page);           // the trip summary
    const r = await page.evaluate(id => ({ st: bk(id).status, ul: S.unlogged, m: S.money, trip: S.trip }), r0.id);
    assert.strictEqual(r.st, 'done'); assert.strictEqual(r.trip, null);
    assert.strictEqual(r.ul, 1, 'one logbook entry owed');
    assert.ok(r.m > r0.m, `paid (${r0.m} → ${r.m})`);
    noErrors(errors);
  } },
  { name: 'a Sunday guide-boat booking triggers the closure step', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    await page.evaluate(() => {
      closeModals(); S.book = S.book.filter(b => b.d !== 6);
      const b = addBooking({ d: 6, type: 'reds', n: 2, who: 'X', from: 'Y', quirk: [] });
      S.cur = 6; S.t = 6 * 1440 + 350; S.loc = 'lower'; tripStart(b);
    });
    await page.waitForSelector('#mbg');
    assert.match(await page.textContent('#mbg'), /Sunday/);
    noErrors(errors);
  } },
  { name: 'three citations pull the permit', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    await page.evaluate(() => { closeModals(); S.cites = 3; afterAction(); });
    await page.waitForSelector('.end');
    assert.match(await page.textContent('.end'), /permit/i);
    noErrors(errors);
  } },
  { name: 'a scripted two-year career reaches the end screen', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await page.evaluate(() => setPref('years', 2));
    await newGame(page);
    await page.evaluate(() => {
      closeModals();
      for (let d = 0; d < GAME.days && S && !S.over; d++) {
        S.loc = 'shop'; S.trip = null; S.money = Math.max(S.money, 5000); S.rep = Math.max(S.rep, 60);
        S.book.forEach(b => { if (b.d === S.cur && b.status === 'booked') b.status = 'done'; });
        S.unlogged = 0; S.overdue = 0; endDay('home'); closeModals();
        if (S && S.winter) { finishWinter(); closeModals(); }
      }
    });
    await page.waitForSelector('.end');
    assert.match(await page.textContent('.end'), /career/);
    assert.match(await page.textContent('.end'), /2026: .*2027: /s);
    assert.strictEqual(await page.evaluate(() => loadSave()), null, 'finished game deletes its save');
    noErrors(errors);
  } },
  { name: 'staying up past midnight ends the day', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    await page.evaluate(() => { closeModals(); pass(1440); afterAction(); });
    assert.strictEqual(await page.evaluate(() => S.cur), 1);
    assert.match(await page.textContent('#mbg'), /night/i);
    noErrors(errors);
  } },
  { name: 'keyboard: number keys press buttons, ? opens the list', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    await page.evaluate(() => { closeModals(); render(); });
    await page.keyboard.press('?');
    assert.match(await page.textContent('#mbg'), /Keyboard shortcuts/);
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.$('#mbg'), null);
    await page.keyboard.press('t');
    assert.strictEqual(await page.evaluate(() => tab), 'todo');
    noErrors(errors);
  } },
  { name: 'coffee: optional, adds 5 minutes, not on the drift boat', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => {
      closeModals(); S.loc = 'shop'; const t0 = S.t;
      const c = actionsHere().find(a => /Grab a cup of coffee/.test(a.l)); c.fn();
      S.loc = 'cooper'; const d = actionsHere().find(a => /Grab a cup of coffee/.test(a.l));
      return { dt: S.t - t0, cooperDis: !!(d && d.dis), shopDis: !!c.dis };
    });
    assert.deepStrictEqual(r, { dt: 5, cooperDis: true, shopDis: false });
    noErrors(errors);
  } },
  { name: 'title screen has a Help! button that opens how to play', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await page.click('.title button >> text=Help!');
    const txt = await page.textContent('#mbg');
    assert.match(txt, /How to play/); assert.match(txt, /Kenai Harbor fuel dock/);
    await page.click('#mbg button.act >> text=Got it');
    assert.ok(await page.$('.title'), 'back on the title screen');
    noErrors(errors);
  } },
];
