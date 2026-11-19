// The title screen (src/js/08-settings.js titleScreen): the install bar at the top (src/js/41-install.js), one big button,
// "What's the game about?" folded, the other buttons in a two-column grid, and the whole screen fitting a phone without scrolling.
const { ID, open, noErrors, assert, phone, firePrompt } = require('./helpers');

const bar = page => page.locator('#installBar');
// Turn the current page into a returning player's: a saved game, back on the title screen.
const returning = page => page.evaluate(() => { newGame('normal'); closeModals(); S.t += 600; saveGame(); S = null; closeModals(); titleScreen(); });
// Where things are on screen.
const layout = page => page.evaluate(() => {
  const r = e => { if (typeof e === 'string') e = document.querySelector(e); if (!e) return null; const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height, w: b.width }; };
  const cells = [...document.querySelectorAll('.title .tgrid button')];
  return { sh: document.scrollingElement.scrollHeight, sw: document.scrollingElement.scrollWidth, ih: innerHeight, iw: innerWidth,
    bar: r('#installBar'), barText: r('#installBar .ib-t'), barLine: parseFloat(getComputedStyle(document.querySelector('#installBar .ib-t') || document.body).lineHeight),
    big: r('.title .big'), about: r('.title details.about'), note: r('.title .small-note'), grid: r('.title .tgrid'),
    cells: cells.map(b => Object.assign(r(b), { t: b.textContent.trim(), clip: b.scrollWidth > b.clientWidth + 1, wide: b.classList.contains('wide') })) };
});
// WCAG contrast ratio of two CSS rgb() colours.
function contrast(a, b) {
  const lum = c => { const [r, g, bl] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * bl; };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05);
}

module.exports = [
  { name: 'the install bar shows on phones and tablets in a browser, one line at 390 wide', only: 'index.html', fn: async ctx => {
    for (const [ua, opt] of [['android', {}], ['iphone', {}], ['ipad', { ipad: true }]]) {
      const { context, page, errors } = await phone(ctx, ua, opt);
      await bar(page).waitFor();
      assert.strictEqual((await page.textContent('#installBar .ib-t')).trim(), '📲 Play offline: install the app', ua);
      assert.strictEqual((await page.textContent('#installBarBtn')).trim(), 'Install');
      assert.strictEqual(await page.getAttribute('#installBar .ib-x', 'aria-label'), 'Dismiss');
      const l = await layout(page);
      assert.ok(l.bar.top === 0 || l.bar.top < 1, 'at the very top');
      assert.ok(l.barText.h < l.barLine * 1.5, `one line: ${l.barText.h}px`);
      assert.ok(l.bar.h <= 50, `slim: ${l.bar.h}px`);
      for (const s of ['#installBarBtn', '#installBar .ib-x']) { const b = await page.locator(s).boundingBox(); assert.ok(b.height >= 44 && b.width >= 44, s + ' is a 44px target'); }
      assert.strictEqual(await page.locator('#installBtn').count(), 1, 'the full Install app button stays in the grid');
      noErrors(errors); await context.close();
    }
    // two lines at most on a 360-wide phone
    const { context, page } = await phone(ctx, 'android', { viewport: { width: 360, height: 740 } });
    const l = await layout(page);
    assert.ok(l.barText.h < l.barLine * 2.5, `at most two lines: ${l.barText.h}px`);
    await context.close();
  } },
  { name: 'the install bar: on a computer only once the browser offers an install; never on a Mac’s Safari', only: 'index.html', fn: async ctx => {
    const { context, page, errors } = await phone(ctx, 'desktop', { viewport: { width: 1280, height: 800 } });
    assert.strictEqual(await bar(page).count(), 0, 'desktop Chrome without an offer');
    assert.strictEqual(await page.locator('#installBtn').count(), 1, 'the grid button is there');
    assert.ok(await firePrompt(page));
    await bar(page).waitFor();
    await page.click('#installBarBtn');
    await page.waitForFunction(() => window.__prompted === 1);
    noErrors(errors); await context.close();
    const mac = await phone(ctx, 'ipad', { viewport: { width: 1280, height: 800 } });   // a Mac (no touch): not a tablet
    assert.strictEqual(await bar(mac.page).count(), 0);
    await mac.context.close();
  } },
  { name: 'the install bar is hidden in the installed app, from a file and in the one-file offline build', fn: async ctx => {
    const { page, errors } = await open(ctx);
    assert.strictEqual(await bar(page).count(), 0, 'file://');
    await firePrompt(page);
    assert.strictEqual(await bar(page).count(), 0, 'file:// even after an offer');
    if (ctx.target.name === 'offline') assert.strictEqual(await page.evaluate(() => SINGLE_FILE), true);
    noErrors(errors);
    if (ctx.target.name !== 'index.html') return;
    for (const ua of ['android', 'iphone']) {
      const p = await phone(ctx, ua, { standalone: true });
      assert.strictEqual(await bar(p.page).count(), 0, ua + ' standalone');
      await firePrompt(p.page);
      assert.strictEqual(await bar(p.page).count(), 0, ua + ' standalone after an offer');
      noErrors(p.errors); await p.context.close();
    }
  } },
  { name: 'Install in the bar: the browser prompt, else the steps sheet, and the iPhone page', only: 'index.html', fn: async ctx => {
    // Android with an offer: the browser's own prompt; once installed, the bar and the button go
    let p = await phone(ctx, 'android');
    await firePrompt(p.page);
    await p.page.click('#installBarBtn');
    await p.page.waitForFunction(() => window.__prompted === 1);
    assert.strictEqual(await p.page.locator('#mbg').count(), 0, 'no sheet');
    await p.page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    assert.strictEqual(await bar(p.page).count(), 0);
    assert.strictEqual(await p.page.locator('#installBtn').count(), 0);
    const l = await layout(p.page);
    assert.ok(l.cells.length % 2 === 0 || l.cells[l.cells.length - 1].wide, 'the grid re-balances');
    noErrors(p.errors); await p.context.close();
    // Android with no offer yet: the menu steps; Esc brings focus back to the bar's button
    p = await phone(ctx, 'android');
    await p.page.click('#installBarBtn');
    await p.page.waitForSelector('#mbg');
    assert.ok(/Install Guide Master/.test(await p.page.textContent('#mbg')));
    await p.page.waitForFunction(() => document.getElementById('mbg').contains(document.activeElement));
    await p.page.keyboard.press('Escape');
    await p.page.waitForFunction(() => document.activeElement && document.activeElement.id === 'installBarBtn');
    noErrors(p.errors); await p.context.close();
    // iPhone: the how-to page
    p = await phone(ctx, 'iphone');
    await p.page.click('#installBarBtn');
    await p.page.waitForURL(p.base + 'install/ios.html');
    noErrors(p.errors); await p.context.close();
  } },
  { name: '✕ hides the install bar for 30 days, then it comes back', only: 'index.html', fn: async ctx => {
    const { context, page, errors } = await phone(ctx, 'android');
    await page.click('#installBar .ib-x');
    assert.strictEqual(await bar(page).count(), 0);
    assert.ok(await page.evaluate(() => document.activeElement === document.querySelector('.title .big')), 'focus moves to the big button');
    assert.strictEqual(await page.locator('#installBtn').count(), 1, 'Install app is still in the grid');
    const t = Number(await page.evaluate(k => localStorage.getItem(k), ID + '.installBarHidden'));
    assert.ok(Math.abs(Date.now() - t) < 60000, 'the time is stored');
    await page.reload(); await page.waitForSelector('.title');
    assert.strictEqual(await bar(page).count(), 0, 'stays hidden after a reload');
    await firePrompt(page);
    assert.strictEqual(await bar(page).count(), 0, 'and when the browser offers an install');
    for (const [days, shown] of [[29, false], [30.01, true], [45, true]]) {
      await page.evaluate(([k, d]) => { localStorage.setItem(k, String(Date.now() - d * 864e5)); titleScreen(); }, [ID + '.installBarHidden', days]);
      assert.strictEqual(await bar(page).count(), shown ? 1 : 0, `${days} days later`);
    }
    await page.evaluate(k => { localStorage.setItem(k, 'junk'); titleScreen(); }, ID + '.installBarHidden');
    assert.strictEqual(await bar(page).count(), 1, 'a bad stored value shows the bar');
    // storage that throws (private mode): the bar still works and ✕ still hides it for now
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('quota'); }; dismissInstallBar(); });
    assert.strictEqual(await bar(page).count(), 0);
    noErrors(errors); await context.close();
  } },
  { name: 'What’s the game about? is folded for returning players and opens with the keyboard', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await returning(page);
    const det = page.locator('.title details.about');
    assert.strictEqual(await det.evaluate(d => d.open), false, 'folded');
    assert.strictEqual((await page.textContent('.title details.about summary')).trim(), 'What’s the game about?');
    assert.ok(!(await page.locator('.title details.about ul').isVisible()), 'bullets hidden');
    const sb = await page.locator('.title details.about summary').boundingBox();
    assert.ok(sb.height >= 44, 'a 44px target');
    // keyboard: Tab from the big button reaches the summary; Enter opens, Space closes
    await page.focus('.title .big');
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => document.activeElement.tagName === 'SUMMARY'), 'summary is next in the tab order');
    await page.keyboard.press('Enter');
    assert.strictEqual(await det.evaluate(d => d.open), true, 'Enter opens');
    const txt = await page.textContent('.title details.about');
    assert.ok(await page.evaluate(t => t.includes(TITLE.intro) && TITLE.bullets.every(b => t.includes(b.replace(/<[^>]+>/g, ''))), txt), 'the intro and all bullets');
    assert.strictEqual(await page.locator('.title details.about li').count(), await page.evaluate(() => TITLE.bullets.length));
    assert.ok(await page.locator('.title details.about ul').isVisible());
    await page.keyboard.press(' ');
    assert.strictEqual(await det.evaluate(d => d.open), false, 'Space closes');
    // a click works too, and a redraw of the title screen keeps it as the player left it
    await page.click('.title details.about summary');
    await page.evaluate(() => titleScreen());
    assert.strictEqual(await det.evaluate(d => d.open), true, 'kept open across a redraw');
    noErrors(errors);
  } },
  { name: 'a brand-new player sees the intro open only when it fits with the whole picture', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await page.evaluate(() => { localStorage.removeItem(GAME.id + '.save'); document.querySelector('.title').remove(); titleScreen(); });
    assert.strictEqual(await page.locator('.title details.about').evaluate(d => d.open), false, 'folded on a 400×800 phone');
    await page.setViewportSize({ width: 480, height: 1600 });
    await page.evaluate(() => { document.querySelector('.title').remove(); titleScreen(); });
    assert.strictEqual(await page.locator('.title details.about').evaluate(d => d.open), true, 'open on a tall screen');
    const l = await layout(page);
    assert.ok(l.sh <= l.ih + 1, 'and it still fits');
    noErrors(errors);
  } },
  { name: 'the screen fits a 390×844 phone with no scrolling; at 360×740 the bar, big button and first row show', only: 'index.html', fn: async ctx => {
    for (const ua of ['android', 'iphone']) for (const who of ['new', 'returning']) {
      for (const [w, h] of [[390, 844], [360, 740]]) {
        const { context, page, errors } = await phone(ctx, ua, { viewport: { width: w, height: h } });
        if (who === 'returning') await returning(page);
        await page.evaluate(() => document.fonts.ready);
        const l = await layout(page), tag = `${ua} ${who} ${w}×${h}`;
        assert.ok(l.bar && l.bar.top >= 0 && l.bar.bottom <= l.ih, tag + ': install bar');
        assert.ok(l.big.bottom <= l.ih, tag + ': big button');
        assert.ok(l.cells[0].bottom <= l.ih && l.cells[1].bottom <= l.ih, tag + ': first row of the grid');
        assert.ok(l.sw <= l.iw, tag + ': no sideways scroll');
        for (const c of l.cells) { assert.ok(c.h >= 44, `${tag}: ${c.t} is ${c.h}px tall`); assert.ok(!c.clip, `${tag}: ${c.t} is cut off`); }
        if (w === 390) {
          assert.ok(l.sh <= l.ih + 1, `${tag}: scrolls (${l.sh} > ${l.ih})`);
          for (const c of l.cells) assert.ok(c.bottom <= l.ih, `${tag}: ${c.t} below the fold`);
          assert.ok(l.note.bottom <= l.ih, tag + ': the version note');
        }
        // the main action sits higher than the old layout's (below the intro and bullets)
        assert.ok(l.big.top < 0.55 * l.ih, `${tag}: big button at ${l.big.top}`);
        assert.ok(l.big.top < l.about.top && l.about.top < l.grid.top && l.grid.bottom < l.note.top, tag + ': order');
        noErrors(errors); await context.close();
      }
    }
  } },
  { name: 'tablet and landscape: nothing overlaps or gets cut off (scrolling allowed)', only: 'index.html', fn: async ctx => {
    for (const vp of [{ width: 768, height: 1024 }, { width: 844, height: 390 }]) {
      const { context, page, errors } = await phone(ctx, 'android', { viewport: vp });
      await returning(page);
      const l = await layout(page), tag = `${vp.width}×${vp.height}`;
      assert.ok(l.sw <= l.iw, tag + ': no sideways scroll');
      for (const c of l.cells) { assert.ok(c.h >= 44 && !c.clip, tag + ': ' + c.t); }
      assert.ok(l.bar.bottom <= l.big.top && l.big.bottom <= l.about.top && l.about.bottom <= l.grid.top && l.grid.bottom <= l.note.top, tag + ': stacked in order');
      const art = await page.locator('.title .art').boundingBox();
      assert.ok(art.height >= 119, tag + ': the picture keeps some height');
      if (vp.width === 768) assert.ok(l.sh <= l.ih + 1, 'a tablet fits too');
      noErrors(errors); await context.close();
    }
  } },
  { name: 'grid: every button works as before; an odd one out spans both columns; tab order and contrast', only: 'index.html', fn: async ctx => {
    const { context, page, errors } = await phone(ctx, 'android');
    let l = await layout(page);
    assert.deepStrictEqual(l.cells.map(c => c.t), ['💾 Save slots', '📲 Install app', '❓ Help!', '💬 Send feedback', '🔁 Transfer a saved game']);
    const last = l.cells[4];
    assert.ok(last.wide && Math.abs(last.w - l.grid.w) < 1, 'the fifth spans the row');
    assert.ok(Math.abs(l.cells[0].w - l.cells[1].w) < 1 && l.cells[0].top === l.cells[1].top, 'two columns');
    assert.ok(/Start your guiding career/.test(await page.textContent('.title .big')));
    // focus order: the bar, the gear, the big button, the intro, then the grid
    const order = await page.evaluate(() => [...document.querySelectorAll('.title button, .title summary')].slice(0, 6).map(e => e.id || e.getAttribute('aria-label') || e.textContent.trim().slice(0, 14)));
    assert.deepStrictEqual(order, ['installBarBtn', 'Dismiss', 'Settings', 'Start your gui', 'What’s the gam', '💾 Save slots']);
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('.title button, .title summary')].every(e => e.tabIndex >= 0)));
    // contrast of the bar
    const col = await page.evaluate(() => { const g = (s, p) => getComputedStyle(document.querySelector(s))[p];
      return { t: g('#installBar', 'color'), bg: g('#installBar', 'backgroundColor'), bt: g('#installBarBtn', 'color'), bb: g('#installBarBtn', 'backgroundColor'), x: g('#installBar .ib-x', 'color') }; });
    assert.ok(contrast(col.t, col.bg) >= 7, 'bar text');
    assert.ok(contrast(col.bt, col.bb) >= 4.5, 'Install button');
    assert.ok(contrast(col.x, col.bg) >= 4.5, '✕');
    // each grid button still opens what it did
    for (const [label, re] of [['Save slots', /Save slots/], ['Help!', /How to play/], ['Send feedback', /Send feedback/], ['Transfer a saved game', /Transfer a saved game/], ['Install app', /Install Guide Master/]]) {
      await page.click(`.title .tgrid button >> text=${label}`);
      await page.waitForSelector('#mbg');
      assert.ok(re.test(await page.textContent('#mbg h2')), label);
      await page.evaluate(() => closeModals());
    }
    // with a save: Continue is the big button, and New game joins the grid (six: two full rows)
    await returning(page);
    l = await layout(page);
    assert.ok(/^Continue as T:/.test(await page.textContent('.title .big')));
    assert.deepStrictEqual(l.cells.map(c => c.t), ['🆕 New game', '💾 Save slots', '📲 Install app', '❓ Help!', '💬 Send feedback', '🔁 Transfer a save']);
    assert.ok(l.cells.every(c => !c.wide));
    assert.strictEqual(await page.getAttribute('.title .tgrid button >> text=Transfer a save', 'title'), 'Transfer a saved game to another device or browser');
    await page.click('.title .tgrid button >> text=New game');
    await page.waitForSelector('#mbg');
    assert.ok(/difficulty/i.test(await page.textContent('#mbg h2')), 'New game starts a new game, as Start a new game did');
    await page.evaluate(() => closeModals());
    await page.click('.title .big');
    await page.waitForSelector('.hud');
    noErrors(errors); await context.close();
  } },
];
