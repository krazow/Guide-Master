// 🆕 What's new (src/js/29-update-notice.js whatsNewModal): one sheet with every update's notes, newest first, the player's version
// marked and older updates folded; opened from the title screen, ⚙️ Settings and Help; and the update pop-up's
// "See everything new since …" for a player who skipped versions.
const { ID, open, reload, noErrors, assert } = require('./helpers');

const LV = `${ID}.lastVersion`;
const lastVer = page => page.evaluate(k => localStorage.getItem(k), LV);
// what the open sheet shows: each version heading in order, which are inside "Show older", which is marked, and the h2
const sheet = page => page.evaluate(() => {
  const m = document.querySelector('#mbg'); if (!m) return null;
  const secs = [...m.querySelectorAll('.wn-ver')];
  return { h2: m.querySelector('h2').textContent, text: m.textContent,
    vs: secs.map(s => s.id.replace(/^wn-/, '').replace(/-/g, '.')),
    older: secs.filter(s => s.closest('details.wn-older')).map(s => s.id.replace(/^wn-/, '').replace(/-/g, '.')),
    cur: secs.filter(s => s.querySelector('.wn-tag')).map(s => s.id.replace(/^wn-/, '').replace(/-/g, '.')),
    olderOpen: (m.querySelector('details.wn-older') || {}).open, btns: MB.map(b => b.l) };
});
const allVersions = page => page.evaluate(() => Object.keys(CHANGELOG).filter(v => verCmp(v, APP_VERSION) <= 0).sort((a, b) => verCmp(b, a)));

module.exports = [
  { name: 'what’s new: every version, newest first, the current one marked; older ones folded behind Show older (keyboard)', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const vs = await allVersions(page), ver = await page.evaluate(() => APP_VERSION);
    assert.strictEqual(vs[0], ver, 'this version has its own notes');
    for (const v of ['1.13.0', '1.14.0', '1.15.0', '1.16.0', '1.17.0', '1.18.0', '1.19.0', '1.19.1']) assert.ok(vs.includes(v), 'notes for ' + v);
    await page.click('#whatsNewBtn');
    await page.waitForSelector('#mbg .wn-ver');
    let s = await sheet(page);
    assert.match(s.h2, /What’s new/);
    assert.deepStrictEqual(s.vs, vs, 'every version, newest first');
    assert.deepStrictEqual(s.cur, [ver], 'only the current version is marked');
    assert.ok(s.text.includes('Your version'));
    assert.strictEqual(s.olderOpen, false, 'older updates start folded');
    assert.deepStrictEqual(s.older, vs.slice(3), 'the newest three are open');
    assert.ok(s.text.includes('Nov 19, 2026'), 'a known release date is shown');
    assert.ok(!(await page.locator('#wn-1-3-0').isVisible()), 'old notes hidden');
    // every line of a version is there
    const lines = await page.evaluate(() => CHANGELOG['1.19.0'].map(l => l.replace(/<[^>]+>/g, '')));
    for (const l of lines) assert.ok(s.text.includes(l), l.slice(0, 40));
    // the sheet starts at the top
    assert.strictEqual(await page.evaluate(() => document.querySelector('#mbg .modal').scrollTop), 0);
    // keyboard: focus the summary, Enter opens, Space closes; a 44px target
    const sum = page.locator('#mbg details.wn-older summary');
    assert.match(await sum.textContent(), /Show older updates \(\d+\)/);
    const b = await sum.boundingBox(); assert.ok(b.height >= 44, `summary ${b.height}px`);
    await sum.press('Enter'); await page.waitForFunction(() => document.querySelector('#mbg details.wn-older')?.open === true);
    s = await sheet(page); assert.strictEqual(s.olderOpen, true, 'Enter opens');
    assert.ok(await page.locator('#wn-1-3-0').isVisible(), 'the oldest notes show');
    await page.keyboard.press(' ');
    assert.strictEqual((await sheet(page)).olderOpen, false, 'Space closes');
    // Tab stays in the sheet and Esc closes it, focus going back to the title button
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => document.getElementById('mbg').contains(document.activeElement)));
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.$('#mbg'), null);
    assert.ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'whatsNewBtn'), 'focus returns to the button');
    noErrors(errors);
  } },
  { name: 'what’s new: Settings has an entry (Back returns to Settings) and Help links to it', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await page.evaluate(() => openSettings());
    await page.click('#mbg button.act >> text=What’s new');
    let s = await sheet(page);
    assert.match(s.h2, /What’s new/); assert.deepStrictEqual(s.btns, ['Back', 'Close']);
    assert.strictEqual(s.vs.length, (await allVersions(page)).length);
    await page.click('#mbg button.act >> text=Back');
    assert.match((await sheet(page)).h2, /Settings/);
    await page.evaluate(() => closeModals());
    // Help: Feedback section has a link; it replaces the Help sheet (one pop-up) and Back returns to Help
    await page.evaluate(() => helpModal());
    const link = page.locator('#help-feedback .linkbtn');
    assert.match(await link.textContent(), /What’s new/);
    const lb = await link.boundingBox(); assert.ok(lb.height >= 44, 'a 44px target');
    await link.click();
    assert.strictEqual(await page.locator('.modal-bg').count(), 1, 'one sheet');
    assert.match((await sheet(page)).h2, /What’s new/);
    await page.click('#mbg button.act >> text=Back');
    assert.match((await sheet(page)).h2, /How to play/);
    noErrors(errors);
  } },
  { name: 'what’s new: from 1.12.1 the pop-up stays short and offers everything since 1.12.1, which acknowledges the update', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const ver = await page.evaluate(() => APP_VERSION);
    await page.evaluate(k => localStorage.setItem(k, '1.12.1'), LV); await reload(page);
    await page.waitForSelector('#mbg');
    assert.ok((await page.locator('#mbg li').count()) <= 8, 'still short');
    assert.match(await page.textContent('#mbg'), /more changes? from earlier updates/);
    const btns = await page.evaluate(() => MB.map(b => b.l));
    assert.deepStrictEqual(btns, ['Got it', 'See everything new since 1.12.1']);
    await page.click('#mbg button.act >> text=See everything new since 1.12.1');
    assert.strictEqual(await lastVer(page), ver, 'opening the full list counts as Got it');
    const s = await sheet(page);
    assert.match(s.h2, /What’s new/);
    assert.ok(s.text.includes('New since version 1.12.1'));
    const since = (await allVersions(page)).filter(v => v !== '1.12.1' && !s.older.includes(v) && s.vs.includes(v));
    for (const v of ['1.13.0', '1.14.0', '1.15.0', '1.16.0', '1.17.0', '1.18.0', '1.19.0', ver]) assert.ok(since.includes(v), v + ' shows unfolded');
    assert.ok(s.older.includes('1.12.1') && s.older.includes('1.3.0'), '1.12.1 and before are under Show older');
    for (const v of ['1.13.0', '1.17.0']) assert.ok(await page.locator('#wn-' + v.replace(/\./g, '-')).isVisible(), v + ' visible');
    assert.strictEqual(await page.evaluate(() => document.querySelector('#mbg .modal').scrollTop), 0, 'starts at the newest');
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.$('#mbg'), null);
    await reload(page);
    assert.strictEqual(await page.$('#mbg'), null, 'the notice does not return');
    noErrors(errors);
  } },
  { name: 'what’s new: a one-version update has no See everything button', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const prev = await page.evaluate(() => Object.keys(CHANGELOG).filter(v => verCmp(v, APP_VERSION) < 0).sort((a, b) => verCmp(b, a))[0]);
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [LV, prev]); await reload(page);
    await page.waitForSelector('#mbg');
    assert.ok((await page.textContent('#mbg')).includes('from version ' + prev));
    assert.deepStrictEqual(await page.evaluate(() => MB.map(b => b.l)), ['Got it']);
    assert.ok(!/more changes? from earlier/.test(await page.textContent('#mbg')));
    await page.click('#mbg >> text=Got it');
    assert.strictEqual(await lastVer(page), await page.evaluate(() => APP_VERSION));
    noErrors(errors);
  } },
];
