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

module.exports = { ID, TARGETS, open, newGame, reload, noErrors, assert };
