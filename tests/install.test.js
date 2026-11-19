// The title screen's "📲 Install app" button (src/js/41-install.js) and the iPhone/iPad how-to page (install/ios.html).
// Most of these need the game served over http (the button never shows from a file), so they start a tiny static server.
const fs = require('fs'), path = require('path'), http = require('http');
const { ID, open, noErrors, assert } = require('./helpers');

const ROOT = path.resolve(__dirname, '..');
const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
};
const VIDEO_MAX = 1.6 * 1024 * 1024;   // the how-to video's size budget

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
let server = null;
function serve() {
  if (server) return server;
  server = new Promise(res => {
    const s = http.createServer((req, rsp) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, path.normalize(p));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(rsp);
    });
    s.listen(0, '127.0.0.1', () => { s.unref(); res(`http://127.0.0.1:${s.address().port}/`); });
  });
  return server;
}
// A browser context dressed as a phone, with the game served over http and quiet prefs.
async function phone(ctx, ua, { standalone = false, ipad = false } = {}) {
  const base = await serve();
  const context = await ctx.context.browser().newContext({ viewport: { width: 390, height: 844 }, userAgent: UA[ua], isMobile: ua !== 'ipad', hasTouch: true });
  await context.addInitScript(({ id, standalone, ipad }) => {
    if (!localStorage.getItem(id + '.name')) { localStorage.setItem(id + '.name', 'T'); localStorage.setItem(id + '.popups', 'off');
      localStorage.setItem(id + '.prefs', JSON.stringify({ tips: false, sound: false })); }
    if (standalone) { const mm = window.matchMedia.bind(window); window.matchMedia = q => /display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} } : mm(q); }
    if (ipad) { Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel' }); Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => 5 }); }
  }, { id: ID, standalone, ipad });
  context.setDefaultTimeout(5000);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.stack || e)));
  await page.goto(base + 'index.html');
  await page.waitForSelector('.title');
  return { base, context, page, errors };
}
const btn = page => page.locator('#installBtn');
// A stand-in for Chrome's beforeinstallprompt event.
const firePrompt = page => page.evaluate(() => {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  e.prompt = () => { window.__prompted = (window.__prompted || 0) + 1; };
  e.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
  window.dispatchEvent(e);
  return e.defaultPrevented;
});

module.exports = [
  { name: 'no button from a file or in the one-file offline build', fn: async ctx => {
    const { page, errors } = await open(ctx);
    assert.strictEqual(await btn(page).count(), 0);
    assert.ok(/Transfer a saved game/.test(await page.textContent('.title')), 'title screen drawn');
    assert.ok(await page.evaluate(() => HELP.some(h => /Install app/.test(h[2])) && CHANGELOG[APP_VERSION].some(l => /Install app/.test(l))), 'Help and the update notice mention it');
    if (ctx.target.name === 'offline') assert.strictEqual(await page.evaluate(() => SINGLE_FILE), true);
    // even if a browser offered an install, a file has nothing to install
    await firePrompt(page);
    assert.strictEqual(await btn(page).count(), 0);
    noErrors(errors);
  } },
  { name: 'hidden when already running as the installed app', only: 'index.html', fn: async ctx => {
    for (const ua of ['android', 'iphone']) {
      const { context, page, errors } = await phone(ctx, ua, { standalone: true });
      assert.strictEqual(await btn(page).count(), 0, ua);
      await firePrompt(page);
      assert.strictEqual(await btn(page).count(), 0, ua + ' after an offer');
      noErrors(errors); await context.close();
    }
  } },
  { name: 'Android with an install offer opens the browser prompt, then hides and says thanks', only: 'index.html', fn: async ctx => {
    const { context, page, errors } = await phone(ctx, 'android');
    assert.ok(await firePrompt(page), 'the mini-infobar is held back (preventDefault)');
    await btn(page).waitFor();
    assert.strictEqual((await btn(page).textContent()).trim(), '📲 Install app');
    const box = await btn(page).boundingBox();
    assert.ok(box.height >= 44, 'a 44px target');
    await btn(page).click();
    await page.waitForFunction(() => window.__prompted === 1);
    assert.strictEqual(await page.locator('#mbg').count(), 0, 'no sheet: the browser prompt is the sheet');
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    assert.strictEqual(await btn(page).count(), 0, 'hidden after appinstalled');
    assert.ok(/Thanks for installing/.test(await page.textContent('.inst-toast')));
    assert.strictEqual(await page.evaluate(k => localStorage.getItem(k), ID + '.installed'), '1');
    await page.reload(); await page.waitForSelector('.title');
    assert.strictEqual(await btn(page).count(), 0, 'stays hidden in the browser tab once installed');
    // uninstalled again: Chrome offers the install again and the button comes back
    await firePrompt(page);
    await btn(page).waitFor();
    noErrors(errors); await context.close();
  } },
  { name: 'no install offer yet shows the browser-menu steps (Esc closes them)', only: 'index.html', fn: async ctx => {
    const { context, page, errors } = await phone(ctx, 'android');
    await btn(page).click();
    await page.waitForSelector('#mbg');
    const txt = await page.textContent('#mbg');
    assert.ok(/Install Guide Master/.test(txt) && /menu \(⋮\)/.test(txt) && /Install app/.test(txt) && /Add to Home screen/.test(txt), txt);
    await page.waitForFunction(() => document.getElementById('mbg').contains(document.activeElement));   // focus moves into the sheet
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.locator('#mbg').count(), 0);
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'installBtn');   // focus back on the button
    noErrors(errors); await context.close();
  } },
  { name: 'iPhone Safari opens the how-to page; so does an iPad that reports as a Mac', only: 'index.html', fn: async ctx => {
    for (const [ua, opt] of [['iphone', {}], ['ipad', { ipad: true }]]) {
      const { base, context, page, errors } = await phone(ctx, ua, opt);
      await btn(page).click();
      await page.waitForURL(base + 'install/ios.html');
      await page.waitForSelector('video');
      assert.ok(/Add to Home Screen/.test(await page.textContent('main')), ua);
      noErrors(errors); await context.close();
    }
    // a computer's Safari (no touch) is not an iPad: it gets the steps sheet
    const { context, page } = await phone(ctx, 'ipad');
    await btn(page).click();
    assert.ok(/Add to Dock/.test(await page.textContent('#mbg')));
    await context.close();
  } },
  { name: 'the iPhone page has the video (looping, muted, inline), the steps, the saves note and a way back', only: 'index.html', fn: async ctx => {
    const { base, context, page, errors } = await phone(ctx, 'iphone');
    await page.goto(base + 'install/ios.html');
    const v = await page.evaluate(() => { const v = document.querySelector('video'), s = v.querySelector('source');
      return { autoplay: v.hasAttribute('autoplay'), muted: v.muted && v.hasAttribute('muted'), loop: v.loop, inline: v.hasAttribute('playsinline'),
        poster: v.getAttribute('poster'), src: s.getAttribute('src'), type: s.getAttribute('type'), label: v.getAttribute('aria-label') }; });
    assert.ok(v.autoplay && v.muted && v.loop && v.inline, JSON.stringify(v));
    assert.strictEqual(v.type, 'video/mp4');
    assert.ok(v.label && /Add to Home Screen/.test(v.label));
    const mp4 = path.join(ROOT, 'install', v.src), poster = path.join(ROOT, 'install', v.poster);
    assert.ok(fs.existsSync(mp4) && fs.existsSync(poster));
    const size = fs.statSync(mp4).size;
    assert.ok(size > 100 * 1024 && size <= VIDEO_MAX, `video is ${size} bytes`);
    assert.ok((await page.locator('ol.steps li').count()) >= 4);
    const txt = await page.textContent('main');
    for (const s of ['Share', 'Add to Home Screen', 'Add', 'iPhone and iPad', 'iOS 16.4', 'offline', 'its own saves', 'Transfer a saved game'])
      assert.ok(txt.includes(s), s);
    assert.ok(await page.locator('a[href="../"]').count() >= 2, 'links back to the game');
    await page.click('a.back'); await page.waitForSelector('.title');
    noErrors(errors); await context.close();
  } },
  { name: 'the service worker caches the page and video; both work offline (video with byte ranges)', only: 'index.html', fn: async ctx => {
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const shell = eval(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1]);
    for (const f of ['install/ios.html', 'install/ios-add-to-home.mp4', 'install/ios-poster.jpg']) assert.ok(shell.includes(f), f);
    for (const f of shell.filter(f => f !== './')) assert.ok(fs.existsSync(path.join(ROOT, f)), 'precached file exists: ' + f);
    const version = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
    assert.ok(sw.includes(`const VERSION = CACHE_PREFIX + '${version}';`), 'versioned cache');
    // the release copy keeps install/ (release.json excludes, plus the kit's own list of top-level names)
    const rel = JSON.parse(fs.readFileSync(path.join(ROOT, 'release.json'), 'utf8'));
    assert.ok(!(rel.exclude || []).some(x => /^install/.test(x)));

    const { base, context, page, errors } = await phone(ctx, 'iphone');
    await page.goto(base + 'index.html?sw=1'); await page.waitForSelector('.title');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload(); await page.waitForSelector('.title');
    assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'page is controlled');
    await page.waitForFunction(async () => { const c = await caches.keys(); for (const k of c) { const x = await caches.open(k); if (await x.match('install/ios-add-to-home.mp4')) return true; } return false; });
    await context.setOffline(true);
    await page.goto(base + 'install/ios.html');
    assert.ok(/Put Guide Master on your Home Screen/.test(await page.textContent('h1')), 'the how-to page, not the game, offline');
    const r = await page.evaluate(async () => { const x = await fetch('ios-add-to-home.mp4', { headers: { Range: 'bytes=0-99' } });
      return { status: x.status, len: (await x.arrayBuffer()).byteLength, range: x.headers.get('Content-Range') }; });
    assert.strictEqual(r.status, 206); assert.strictEqual(r.len, 100); assert.ok(/^bytes 0-99\/\d+$/.test(r.range), r.range);
    await page.goto(base + 'index.html'); await page.waitForSelector('.title');
    assert.ok(await page.evaluate(() => typeof titleScreen === 'function'), 'the game still loads offline after visiting the page');
    noErrors(errors); await context.close();
  } },
];
