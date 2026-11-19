// Shared helpers for the tests. Each test gets a fresh browser context (empty localStorage).
const fs = require('fs'), path = require('path'), assert = require('assert');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const ID = fs.readFileSync(path.join(ROOT, 'src/js/00-game.js'), 'utf8').match(/\n  id:'([^']*)'/)[1];
const TARGETS = [{ name: 'index.html', file: path.join(ROOT, 'index.html') }];
const offline = path.join(ROOT, 'offline', `${ID}-offline.html`);
if (fs.existsSync(offline)) TARGETS.push({ name: 'offline', file: offline });

// quiet prefs: a name is set, no tips, no event pop-ups, no sound
const PREFS = { [`${ID}.name`]: 'T', [`${ID}.popups`]: 'off', [`${ID}.prefs`]: JSON.stringify({ tips: false, sound: false }) };

// Runs before any page script: a seeded Math.random (mulberry32) so runs are repeatable.
function initScript({ seed }) {
  if (seed != null) {
    let a = seed >>> 0;
    Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
}

// Open the game; returns { page, errors } where errors collects uncaught page errors.
async function open({ context, target }, { seed = 12345, quiet = true } = {}) {
  await context.addInitScript(initScript, { seed });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.stack || e)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(pathToFileURL(target.file).href);
  await page.waitForSelector('.title');
  if (quiet) {
    await page.evaluate(p => { for (const k in p) localStorage.setItem(k, p[k]); }, PREFS);
    await reload(page);
  }
  return { page, errors };
}

// Start a fresh game with no queued modals.
async function newGame(page, diff = 'normal') {
  await page.evaluate(d => { newGame(d); closeModals(); tab = 'act'; render(); }, diff);
}
async function reload(page) { await page.reload(); await page.waitForSelector('.title'); }
function noErrors(errors) { assert.deepStrictEqual(errors, [], 'page errors:\n' + errors.join('\n')); }

// ---- served over http, dressed as a phone (the install button and bar never show from a file) ----
const http = require('http');
const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  desktop: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
};
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
// storage: extra localStorage items (keys without the game's ID prefix) set before the first load.
async function phone(ctx, ua, { standalone = false, ipad = false, viewport = { width: 390, height: 844 }, storage = {} } = {}) {
  const base = await serve();
  const desk = ua === 'ipad' || ua === 'desktop';
  const context = await ctx.context.browser().newContext({ viewport, userAgent: UA[ua], isMobile: !desk, hasTouch: ua !== 'desktop' });
  await context.addInitScript(({ id, standalone, ipad, storage }) => {
    if (!localStorage.getItem(id + '.name')) { localStorage.setItem(id + '.name', 'T'); localStorage.setItem(id + '.popups', 'off');
      localStorage.setItem(id + '.prefs', JSON.stringify({ tips: false, sound: false }));
      for (const k in storage) localStorage.setItem(id + '.' + k, storage[k]); }
    if (standalone) { const mm = window.matchMedia.bind(window); window.matchMedia = q => /display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} } : mm(q); }
    if (ipad) { Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel' }); Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => 5 }); }
  }, { id: ID, standalone, ipad, storage });
  context.setDefaultTimeout(5000);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.stack || e)));
  await page.goto(base + 'index.html');
  await page.waitForSelector('.title');
  return { base, context, page, errors };
}
// A stand-in for Chrome's beforeinstallprompt event.
const firePrompt = page => page.evaluate(() => {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  e.prompt = () => { window.__prompted = (window.__prompted || 0) + 1; };
  e.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
  window.dispatchEvent(e);
  return e.defaultPrevented;
});


module.exports = { ID, TARGETS, open, newGame, reload, noErrors, assert, UA, serve, phone, firePrompt };
