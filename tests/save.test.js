const { ID, open, newGame, reload, noErrors, assert } = require('./helpers');

module.exports = [
  { name: 'save, reload, continue', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    await page.evaluate(() => { S.money = 1234; pass(60); render(); });
    const t = await page.evaluate(() => S.t);
    await reload(page);
    await page.click('text=Continue as T');
    await page.waitForSelector('.hud');
    assert.deepStrictEqual(await page.evaluate(() => [S.money, S.t]), [1234, t]);
    noErrors(errors);
  } },
  { name: 'migrate fills in fields an older save is missing', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => {
      const d = JSON.parse(JSON.stringify(packSave()));
      delete d.S.visited; delete d.S.prios; delete d.S.stats.kings; d.S.loc = 'nowhere'; d.schema = 0;
      const m = migrate(d); adopt(m); closeModals();
      return [typeof m.S.visited, Array.isArray(m.S.prios), m.S.stats.kings, m.S.loc, m.notes.length > 0];
    });
    assert.deepStrictEqual(r, ['object', true, 0, 'shop', true]);
    noErrors(errors);
  } },
  { name: 'transfer code round trip', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    await page.evaluate(() => { S.money = 777; saveGame(); });
    const code = await page.evaluate(() => exportCode());
    assert.ok(code.startsWith(await page.evaluate(() => GAME.codePrefix + ':')));
    await page.evaluate(() => { localStorage.clear(); S = null; titleScreen(); });
    await page.evaluate(c => { openTransfer(); window.IMPV = c; MBTN(0); }, code);
    await page.waitForFunction(() => S && S.money === 777);
    noErrors(errors);
  } },
  { name: 'save slots are separate', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    await page.evaluate(() => { S.money = 111; saveGame(); setSlot(2); newGame('easy'); closeModals(); S.money = 222; saveGame(); });
    const r = await page.evaluate(() => [loadSave(1).S.money, loadSave(2).S.money, curSlot()]);
    assert.deepStrictEqual(r, [111, 222, 2]);
    noErrors(errors);
  } },
  { name: 'an unreadable save is set aside, not fatal', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await page.evaluate(id => localStorage.setItem(id + '.save', '{"S":'), ID);
    await reload(page);
    assert.match(await page.textContent('.title'), /couldn’t be read/);
    assert.ok(await page.evaluate(id => localStorage.getItem(id + '.save.broken'), ID));
    noErrors(errors);
  } },
  { name: 'version compare is numeric', fn: async ctx => {
    const { page } = await open(ctx);
    const r = await page.evaluate(() => [verCmp('1.10.0', '1.9.2') > 0, verCmp('1.9.9', '1.10.1') < 0, verCmp('1.10', '1.10.0') === 0]);
    assert.deepStrictEqual(r, [true, true, true]);
  } },
];
