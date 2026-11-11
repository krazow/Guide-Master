const { ID, open, newGame, reload, noErrors, assert } = require('./helpers');

const LV = `${ID}.lastVersion`;
const lastVer = page => page.evaluate(k => localStorage.getItem(k), LV);
const notice = page => page.evaluate(() => { const m = document.querySelector('#mbg'); return m ? m.textContent : null; });
const setOld = (page, v) => page.evaluate(([k, v]) => localStorage.setItem(k, v), [LV, v]);

module.exports = [
  { name: 'update notice: brand-new player gets no pop-up and the version is remembered', fn: async ctx => {
    const { page, errors } = await open(ctx);
    assert.strictEqual(await notice(page), null);
    assert.strictEqual(await lastVer(page), await page.evaluate(() => APP_VERSION));
    noErrors(errors);
  } },
  { name: 'update notice: old version shows the version and notes; only Got it closes it', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const ver = await page.evaluate(() => APP_VERSION);
    await setOld(page, '1.0.0'); await reload(page);
    const txt = await notice(page);
    assert.ok(txt.includes('Updated to version ' + ver), txt);
    assert.ok(txt.includes('from version 1.0.0'), txt);
    const newest = await page.evaluate(() => CHANGELOG[APP_VERSION][0].slice(3, 40));
    assert.ok(txt.includes('What’s new') && txt.includes(newest), txt);
    assert.ok(!/saved game/i.test(txt), 'no saves, so no saved-games line');
    assert.ok((await page.locator('#mbg li').count()) <= 8);
    await page.mouse.click(5, 5);                 // backdrop area
    await page.click('#mbg', { position: { x: 5, y: 5 } });
    await page.keyboard.press('Escape');
    await page.keyboard.press('x');
    assert.ok(await notice(page), 'still open');
    assert.strictEqual(await lastVer(page), '1.0.0', 'not stored before acknowledging');
    await reload(page);
    assert.ok(await notice(page), 'shows again after a reload');
    await page.click('#mbg >> text=Got it');
    assert.strictEqual(await notice(page), null);
    assert.strictEqual(await lastVer(page), ver);
    await reload(page);
    assert.strictEqual(await notice(page), null, 'does not return');
    noErrors(errors);
  } },
  { name: 'update notice: saved games are brought up to date and still load', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    await page.evaluate(() => { S.money = 4321; saveGame(); });
    // make the stored save look like it came from an older version and drop a field the engine should refill
    await page.evaluate(([k]) => {
      const key = GAME.id + '.save', d = JSON.parse(localStorage.getItem(key));
      d.app = '1.2.0'; delete d.S.visited; localStorage.setItem(key, JSON.stringify(d)); localStorage.setItem(k, '1.2.0');
    }, [LV]);
    await reload(page);
    const txt = await notice(page);
    assert.ok(/saved game was updated/i.test(txt), txt);
    assert.ok(txt.includes('from version 1.2.0'), txt);
    const stored = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem(GAME.id + '.save')); return [d.app === APP_VERSION, typeof d.S.visited, d.S.money]; });
    assert.deepStrictEqual(stored, [true, 'object', 4321]);
    await page.keyboard.press('Escape');
    assert.ok(await notice(page));
    await page.click('#mbg >> text=Got it');
    await page.click('text=Continue as T');
    await page.waitForSelector('.hud');
    assert.strictEqual(await page.evaluate(() => S.money), 4321);
    noErrors(errors);
  } },
  { name: 'update notice: existing save without a remembered version still gets the notice', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    await page.evaluate(k => { saveGame(); localStorage.removeItem(k); }, LV);
    await reload(page);
    assert.ok(/Updated to version/.test(await notice(page)));
    await page.click('#mbg >> text=Got it');
    noErrors(errors);
  } },
];
