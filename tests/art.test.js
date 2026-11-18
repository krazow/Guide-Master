// Illustrations (src/js/40-art.js, art/, tools/art.py, sw.js): the registry and its matching, the hooks (Home tab and fall cabin
// sheet, the trip sheet and the dock, the camping hub and days, event pop-ups, the morning report and the cabin's storm prompts),
// the Settings switch, the builds and the service worker's runtime cache. Every image ships switched off: with none enabled, every
// screen is byte-for-byte what it was, and an enabled image adds its <figure> and nothing else.
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const { open, newGame, noErrors, assert, ID } = require('./helpers');
const ROOT = path.resolve(__dirname, '..');

// a tiny 32x18 PNG (the hooks don't care how big the file is)
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAASCAIAAAC1qksFAAAALElEQVR4XmPs33megZaAiZaGg8CoBQTBaBARBKNBRBCMBhFBMBpEBAHNgwgAvtgCO1o9jFEAAAAASUVORK5CYII=';
// one entry per hook ("any" or a key the scenario below is sure to hit)
const FIXTURES = [
  { id: 't-cabin', set: 'cabin', file: PNG, thumb: PNG, alt: 'A log cabin with smoke from the chimney.', when: { season: 'any', cond: [0, 100] } },
  { id: 't-boat', set: 'boat', file: PNG, alt: 'A jet sled at the launch.', when: { boat: 'sled', cond: [0, 100] } },
  { id: 't-camp', set: 'camp', file: PNG, alt: 'A tent in the snow.', when: { time: 'any' } },
  { id: 't-ev', set: 'event', file: PNG, alt: 'Ducks on the dock.', when: { event: 'art_test' } },
  { id: 't-wake', set: 'event', file: PNG, alt: 'Geese at dawn.', when: { event: 'art_wake' } },
  { id: 't-storm', set: 'event', file: PNG, alt: 'Snow piled to the eaves.', when: { event: ['cold', 'snow'], from: 'home' } },
];

// In the page: play the same seeded stretch of the game and keep the HTML of every screen that has a hook.
// mode: 'none' (as shipped), 'off' (fixtures registered but disabled), 'pref' (enabled, Settings → Illustrations off), 'on'.
const scenario = async ({ mode, fixtures }) => {
  // (the keyboard hints, 09-keys.js, are drawn on the next animation frame, so they come and go with timing: leave them out)
  const snaps = [], snap = k => { const m = document.getElementById('mbg'); snaps.push([k, (k === 'home' ? document.getElementById('app').innerHTML : m ? m.innerHTML : '').replace(/<i class="kn" aria-hidden="true">\d<\/i>/g, '')]); };
  const wait = () => new Promise(r => setTimeout(r, 0));
  let a = 4242; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  ART.clear();
  if (mode !== 'none') fixtures.forEach(f => ART.register(Object.assign({}, f, { enabled: mode !== 'off' })));
  setPref('art', mode !== 'pref');
  try { localStorage.setItem(KEY('popups'), 'on'); } catch (e) {}
  if (!EV.some(e => e.id === 'art_test')) {
    defEvent({ id: 'art_test', hook: 'art_hook', tile: ['🦆', 'Ducks on the dock', 'info'], chance: 0, run: () => say('🦆 A raft of mergansers.') });
    defEvent({ id: 'art_wake', hook: 'wake', tile: ['🪿', 'Geese at dawn', 'info'], chance: 0, run: () => say('🪿 Geese overhead.') });
  }
  closeModals(); clearTiles(); newGame('normal'); closeModals(); clearTiles();
  // the Home tab
  tab = 'home'; render(); snap('home'); tab = 'act';
  // a sockeye trip: the first sheet and the dock
  S.cur = 1; S.t = 1440 + 345; S.loc = 'lower'; S.fuel = 30; S.gear = 3; S.boat = 90; S.book = []; S.cred.fa = 999;
  const b = { id: S.nextId++, d: 1, type: 'reds', n: 3, who: 'test party', from: 'Ohio', res: false, quirk: [], status: 'booked' }; S.book.push(b);
  tripStart(b); snap('trip');
  let i = 0; while (S.trip && i++ < 30) MBTN(legalBtn());
  snap('dock'); closeModals(); clearTiles();
  // an event's OK pop-up, then the morning report
  forceEvent('art_test'); fireHook('art_hook', {}); snap('event'); closeModals(); clearTiles();
  S.cur = 2; S.t = 2 * 1440 + 1300; S.loc = 'shop'; S.book = []; S.calls = {}; S.dipnetAsk = 99;
  forceEvent('art_wake'); endDay('home'); snap('morning'); closeModals(); clearTiles();
  // the off-season: the fall cabin sheet, the first storms (the cabin's prompts), then winter camping
  S.years = 2; const d = SEASON - 1; S.cur = d; S.t = d * 1440 + 1300; S.loc = 'shop'; S.book = S.book.filter(x => x.d < d - 1);
  endDay('home'); closeModals(); clearTiles(); S.money = 20000; S.energy = 90;
  homeWinterModal(); snap('cabin-sheet'); closeModals();
  homeRollWinterSync(); if (!cabin().queue.some(q => q.id === 'snow')) cabin().queue.push({ id: 'snow', depth: 2 });
  CabinUpkeep.ui.scenes(homeHost(), null, () => {});
  for (let k = 0; k < 10 && document.getElementById('mbg') && !/Off-season/.test(document.querySelector('#mbg h2').textContent); k++) { snap('storm:' + document.querySelector('#mbg h2').textContent); MBTN(0); await wait(); }
  closeModals();
  campModal();
  for (let k = 0; k < 120 && document.getElementById('mbg'); k++) {
    const h = CAMP_ART && CAMP_ART.h && CAMP_ART.h.session;
    if (!h) { snap('camp-end'); break; }
    snap('camp:' + h.phase);
    const v = h.view(), id = KenaiCamp.policies.thoughtful({ reserve: 100 })(v, h.state), j = v.buttons.findIndex(x => x.id === id);
    MBTN(j < 0 ? 0 : j);
    await wait();
  }
  closeModals();
  return snaps;
};

const strip = h => h.replace(/<figure class="art-fig"[\s\S]*?<\/figure>/g, '');

module.exports = [
  { name: 'registry: defaults off, matching (ranges, any, all-of lists, one-of lists), scores, stable tie-break, null fallback', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => {
      const out = {};
      out.shipped = ART.list().length; out.anyShipped = ART.any();
      ART.clear();
      out.bad = [ART.register(null), ART.register({ id: 'x', set: 'nope', file: 'a.png' }), ART.register({ id: 'y', set: 'cabin' })];
      const e = ART.register({ id: 'c1', set: 'cabin', file: 'cabin/01.png', alt: 'a', when: {} });
      out.def = { enabled: e.enabled, w: e.w, h: e.h };
      out.truthy = ART.register({ id: 'c0', set: 'cabin', file: 'x.png', enabled: 'yes' }).enabled;
      out.nullWhenOff = artFor('cabin', {});
      const sc = (when, ctx) => ART.score({ when }, ctx);
      out.scores = {
        any: sc({ heat: 'any', season: 'any' }, {}),
        eq: sc({ heat: 'wood' }, { heat: 'wood' }), neq: sc({ heat: 'wood' }, { heat: 'oil' }), missing: sc({ heat: 'wood' }, {}),
        ctxList: sc({ heat: 'wood' }, { heat: ['oil', 'wood'] }),
        range: sc({ cond: [40, 70] }, { cond: 55 }), rangeLo: sc({ cond: [40, 70] }, { cond: 39 }), rangeEdge: sc({ cond: [40, 70] }, { cond: 70 }),
        hasAll: sc({ has: ['generator', 'freezer'] }, { has: ['freezer', 'generator', 'vise'] }), hasSome: sc({ has: ['generator', 'freezer'] }, { has: ['generator'] }),
        upOne: sc({ up: 'motor' }, { up: ['motor'] }),
        oneOf: sc({ event: ['cold', 'snow'] }, { event: 'snow' }), oneOfNo: sc({ event: ['cold', 'snow'] }, { event: 'moose' }),
        two: sc({ heat: 'wood', season: 'winter', time: 'any' }, { heat: 'wood', season: 'winter', time: 'day' }),
      };
      ART.clear();
      const reg = (id, when) => ART.register({ id, set: 'cabin', file: id + '.png', alt: id, when, enabled: true });
      reg('generic', { season: 'any' }); reg('winter', { season: 'winter' }); reg('winter-wood', { season: 'winter', heat: 'wood' }); reg('summer', { season: 'summer' });
      out.best = artFor('cabin', { season: 'winter', heat: ['oil', 'wood'] }).id;
      out.mid = artFor('cabin', { season: 'winter', heat: 'oil' }).id;
      out.fallback = artFor('cabin', { season: 'spring' }).id;
      ART.clear(); reg('w', { season: 'winter' });
      out.none = artFor('cabin', { season: 'summer' }); out.noneSet = artFor('boat', {});
      out.slotEmpty = artSlot('cabin', { season: 'summer' });
      // ties: the same pick for the same day and set, every time; different days spread over the candidates
      ART.clear(); ['a', 'b', 'c', 'd'].forEach(id => reg(id, { season: 'any' }));
      out.same = [1, 2, 3, 4, 5].map(() => artFor('cabin', { seed: 7 }).id);
      out.days = new Set(Array.from({ length: 40 }, (_, d) => artFor('cabin', { seed: d }).id)).size;
      out.order = (() => { ART.clear(); ['d', 'c', 'b', 'a'].forEach(id => reg(id, {})); return artFor('cabin', { seed: 7 }).id; })();
      out.today = artFor('cabin', {}).id === artFor('cabin', {}).id;
      out.disabled = (() => { ART.clear(); ART.register({ id: 'off', set: 'cabin', file: 'x.png', when: {} }); return artFor('cabin', {}); })();
      out.enableSet = (() => { ART.enable('cabin'); return artFor('cabin', {}) && artFor('cabin', {}).id; })();
      out.replace = (() => { ART.register({ id: 'off', set: 'cabin', file: 'y.png', when: {}, enabled: true }); return [ART.list().length, ART.get('off').file]; })();
      ART.clear();
      return out;
    });
    assert.strictEqual(r.shipped, 0, 'the game ships with no illustration enabled'); assert.strictEqual(r.anyShipped, false);
    assert.deepStrictEqual(r.bad, [null, null, null]);
    assert.deepStrictEqual(r.def, { enabled: false, w: 1600, h: 900 }); assert.strictEqual(r.truthy, false, 'only enabled:true switches an entry on');
    assert.strictEqual(r.nullWhenOff, null);
    assert.deepStrictEqual(r.scores, { any: 0, eq: 1, neq: -1, missing: -1, ctxList: 1, range: 1, rangeLo: -1, rangeEdge: 1, hasAll: 1, hasSome: -1, upOne: 1, oneOf: 1, oneOfNo: -1, two: 2 });
    assert.strictEqual(r.best, 'winter-wood'); assert.strictEqual(r.mid, 'winter'); assert.strictEqual(r.fallback, 'generic');
    assert.strictEqual(r.none, null); assert.strictEqual(r.noneSet, null); assert.strictEqual(r.slotEmpty, '');
    assert.strictEqual(new Set(r.same).size, 1, 'no flicker'); assert.ok(r.days >= 3, 'ties spread over days: ' + r.days);
    assert.strictEqual(r.order, r.same[0], 'the tie-break does not depend on the order entries were registered');
    assert.ok(r.today); assert.strictEqual(r.disabled, null); assert.strictEqual(r.enableSet, 'off');
    assert.deepStrictEqual(r.replace, [1, 'y.png'], 'registering an id again replaces it');
    noErrors(errors);
  } },
  { name: 'hooks: with no image enabled every screen is byte-identical; an enabled image adds only its figure (alt, lazy) at each hook', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const ls = await page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
    const run = async mode => {
      await page.evaluate(s => { localStorage.clear(); const o = JSON.parse(s); for (const k in o) localStorage.setItem(k, o[k]); }, ls);
      return page.evaluate(scenario, { mode, fixtures: FIXTURES.map(f => Object.assign({}, f)) });
    };
    const none = await run('none'), off = await run('off'), pref = await run('pref'), on = await run('on');
    const keys = none.map(s => s[0]);
    assert.ok(keys.includes('home') && keys.includes('trip') && keys.includes('dock') && keys.includes('event') && keys.includes('morning') && keys.includes('cabin-sheet'), keys.join());
    assert.ok(keys.some(k => k === 'camp:hub') && keys.some(k => k === 'camp:day') && keys.some(k => k === 'camp:night'), 'the camping run reaches a day and a night: ' + keys.join());
    assert.ok(keys.some(k => k.startsWith('storm:')), 'the cabin storm prompts');
    for (const [name, other] of [['disabled entries', off], ['Illustrations off', pref]]) {
      assert.deepStrictEqual(other.map(s => s[0]), keys, name + ': the same screens');
      other.forEach((s, i) => assert.strictEqual(s[1], none[i][1], `${name}: ${s[0]} differs`));
    }
    none.forEach(s => assert.ok(!/art-fig|art-img/.test(s[1]), 'no figure with art off: ' + s[0]));
    assert.deepStrictEqual(on.map(s => s[0]), keys, 'an enabled image changes no screen order and no random draw');
    on.forEach((s, i) => assert.strictEqual(strip(s[1]), none[i][1], 'only the figure is added: ' + s[0]));
    const fig = k => { const s = on.find(x => x[0] === k); return s && (s[1].match(/<figure class="art-fig" data-art="([^"]+)">[\s\S]*?<\/figure>/) || []); };
    for (const [k, id] of [['home', 't-cabin'], ['trip', 't-boat'], ['dock', 't-boat'], ['event', 't-ev'], ['morning', 't-wake'], ['cabin-sheet', 't-cabin'], ['camp:hub', 't-camp'], ['camp:day', 't-camp'], ['camp:night', 't-camp']]) {
      const m = fig(k); assert.ok(m && m[1], `a figure at ${k}`);
      assert.ok(m[1] === id || (k === 'camp:night' && /^t-/.test(m[1])), `${k}: ${m[1]} (wanted ${id})`);
      assert.match(m[0], /<img class="art-img" src="data:image\/png;base64,/); assert.match(m[0], / alt="[^"]+"/); assert.match(m[0], / loading="lazy"/);
      assert.match(m[0], / decoding="async"/); assert.match(m[0], / width="1600" height="900"/); assert.match(m[0], /object-fit:cover/);
    }
    const storm = on.filter(s => s[0].startsWith('storm:') && /data-art="t-storm"/.test(s[1]));
    assert.ok(storm.length >= 1, 'the cabin storm prompt shows its event picture');
    // the trip sheet shows it on the opening step only, not on every decision
    assert.strictEqual(on.filter(s => /data-art="t-boat"/.test(s[1])).length, 2);
    noErrors(errors);
  } },
  { name: 'artImg: srcset for thumb and full, WebP source, save-data uses thumbs, dark mode dims, the 2:1 banner', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(png => {
      const e = { id: 'k', set: 'cabin', file: 'cabin/01-x.png', thumb: 'cabin/01-x.thumb.png', webp: 'cabin/01-x.webp', thumbWebp: 'cabin/01-x.thumb.webp', v: 'abc', w: 1600, h: 900, alt: 'A "quoted" <cabin>.' };
      const full = artImg(e);
      Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
      const lite = artImg(e);
      Object.defineProperty(navigator, 'connection', { value: { saveData: false }, configurable: true });
      ART.clear(); ART.register({ id: 'shown', set: 'cabin', file: png, alt: 'A cabin.', when: {}, enabled: true });
      closeModals(); tab = 'home'; render();
      const img = document.querySelector('#app .art-fig img'), fig = img.closest('.art-fig'), r = fig.getBoundingClientRect();
      const out = { full, lite, ratio: Math.round(r.width / r.height * 100) / 100, fit: getComputedStyle(img).objectFit, bg: getComputedStyle(fig).backgroundImage };
      ART.clear(); render();
      return out;
    }, PNG);
    assert.match(r.full, /src="art\/cabin\/01-x\.png\?v=abc"/);
    assert.match(r.full, /srcset="art\/cabin\/01-x\.thumb\.png\?v=abc 400w, art\/cabin\/01-x\.png\?v=abc 1600w"/);
    assert.match(r.full, /<picture><source type="image\/webp" srcset="art\/cabin\/01-x\.thumb\.webp\?v=abc 400w, art\/cabin\/01-x\.webp\?v=abc 1600w"/);
    assert.match(r.full, /alt="A &quot;quoted&quot; &lt;cabin&gt;\."/);
    assert.match(r.lite, /src="art\/cabin\/01-x\.thumb\.png\?v=abc"/); assert.ok(!/1600w/.test(r.lite), 'save-data: no full-size srcset');
    assert.strictEqual(r.ratio, 2); assert.strictEqual(r.fit, 'cover'); assert.match(r.bg, /gradient/, 'a soft placeholder color while it loads');
    await page.emulateMedia({ colorScheme: 'dark' });
    const dark = await page.evaluate(png => { ART.register({ id: 'shown', set: 'cabin', file: png, alt: 'A cabin.', when: {}, enabled: true }); render(); const f = getComputedStyle(document.querySelector('#app .art-fig img')).filter; ART.clear(); render(); return f; }, PNG);
    assert.match(dark, /brightness/);
    noErrors(errors);
  } },
  { name: 'Settings: "Illustrations" is hidden with no image enabled, then on by default and switches the pictures off and on', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(png => {
      const labels = () => { openSettings(); const l = MB.map(b => b.l); return l; };
      const out = {};
      closeModals(); out.none = labels().filter(l => /Illustrations/.test(l)); closeModals();
      ART.register({ id: 'h', set: 'cabin', file: png, alt: 'A cabin.', when: {}, enabled: true });
      tab = 'home'; render(); out.fig1 = !!document.querySelector('#app .art-fig');
      const l1 = labels(); out.on = l1.find(l => /Illustrations/.test(l));
      MBTN(l1.findIndex(l => /Illustrations/.test(l)));
      out.off = MB.map(b => b.l).find(l => /Illustrations/.test(l)); out.pref = prefs().art; closeModals();
      render(); out.fig2 = !!document.querySelector('#app .art-fig');
      const l2 = labels(); MBTN(l2.findIndex(l => /Illustrations/.test(l))); closeModals(); render();
      out.fig3 = !!document.querySelector('#app .art-fig');
      ART.clear(); render();
      return out;
    }, PNG);
    assert.deepStrictEqual(r.none, []); assert.ok(r.fig1);
    assert.match(r.on, /Illustrations: On/); assert.match(r.off, /Illustrations: Off/); assert.strictEqual(r.pref, false);
    assert.strictEqual(r.fig2, false); assert.strictEqual(r.fig3, true);
    noErrors(errors);
  } },
  { only: 'index.html', name: 'builds: index.html embeds the enabled manifest entries; the offline file carries none and links no art/', fn: async () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'art', 'manifest.json'), 'utf8'));
    assert.ok(Array.isArray(man)); assert.ok(man.every(e => e.enabled !== true), 'the repo ships every illustration switched off');
    assert.strictEqual((html.match(/\/\*@ART@\*\/\[\]\/\*@\/ART@\*\//g) || []).length, 1, 'an empty manifest in index.html');
    assert.ok(!/["(]art\/[^"]*\.(png|webp)/.test(html), 'no image is linked or inlined');
    const off = path.join(ROOT, 'offline', `${ID}-offline.html`);
    if (fs.existsSync(off)) { const o = fs.readFileSync(off, 'utf8'); assert.match(o, /\/\*@ART@\*\/\[\]\/\*@\/ART@\*\//); assert.ok(!/art\/[^"]*\.(png|webp)/.test(o)); }
    for (const f of fs.readdirSync(path.join(ROOT, 'art'))) assert.ok(['README.md', 'manifest.json'].includes(f), 'art/ holds only the README and the manifest: ' + f);
    const rel = JSON.parse(fs.readFileSync(path.join(ROOT, 'release.json'), 'utf8'));
    assert.ok(!(rel.exclude || []).some(x => /^art\/?$/.test(x)), 'the release keeps art/ in the site');
  } },
  { only: 'index.html', name: 'tools/art.py: import copies a set disabled (WebP when it can), validates keys against the game, enable embeds it', fn: async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-art-')), set = path.join(tmp, 'set', 'boat'), repo = path.join(tmp, 'repo');
    try {
      fs.mkdirSync(set, { recursive: true });
      // 1600x900 and 400x225 PNGs written by Python (no dependency needed: zlib + struct)
      const mk = `import struct,zlib,sys
def png(p,w,h):
  raw=b''.join(b'\\x00'+bytes([143,185,207])*w for _ in range(h))
  ch=lambda t,d:struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
  open(p,'wb').write(b'\\x89PNG\\r\\n\\x1a\\n'+ch(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+ch(b'IDAT',zlib.compress(raw,9))+ch(b'IEND',b''))
for n in (1,2):
  png(sys.argv[1]+'/0%d-test.png'%n,1600,900); png(sys.argv[1]+'/0%d-test.thumb.png'%n,400,225)`;
      execFileSync('python3', ['-c', mk, set]);
      fs.writeFileSync(path.join(set, 'manifest.json'), JSON.stringify([
        { id: 'boat-01', set: 'boat', n: 1, title: 'a', file: 'boat/01-test.png', w: 1600, h: 900, alt: 'A jet sled at the launch.', where: 'x', when: { boat: 'sled', where: 'launch', up: ['motor'], cond: [40, 100], time: 'day' }, notes: '' },
        { id: 'boat-02', set: 'boat', n: 2, title: 'b', file: 'boat/02-test.png', w: 1600, h: 900, alt: 'A drift boat.', where: 'x', when: { boat: 'drift', up: ['warp-drive'] }, notes: '' }]));
      fs.mkdirSync(repo);
      for (const d of ['src', 'tools']) fs.cpSync(path.join(ROOT, d), path.join(repo, d), { recursive: true });
      for (const f of ['sw.js']) fs.copyFileSync(path.join(ROOT, f), path.join(repo, f));
      fs.mkdirSync(path.join(repo, 'art')); fs.writeFileSync(path.join(repo, 'art', 'manifest.json'), '[]\n');
      const py = (...a) => { try { return { code: 0, out: execFileSync('python3', [path.join(repo, 'tools', 'art.py'), '--root', repo, ...a], { encoding: 'utf8' }) }; } catch (e) { return { code: e.status, out: String(e.stdout) + String(e.stderr) }; } };
      const imp = py('import', set);
      assert.strictEqual(imp.code, 1, 'the unknown upgrade is an error'); assert.match(imp.out, /boat-02: when\.up has \['warp-drive'\]/); assert.ok(!/boat-01/.test(imp.out), imp.out);
      const man = JSON.parse(fs.readFileSync(path.join(repo, 'art', 'manifest.json'), 'utf8'));
      assert.deepStrictEqual(man.map(e => [e.id, e.enabled]), [['boat-01', false], ['boat-02', false]], 'imported switched off');
      assert.ok(fs.existsSync(path.join(repo, 'art', 'boat', '01-test.png')) && fs.existsSync(path.join(repo, 'art', 'boat', '01-test.thumb.png')));
      assert.ok(/^[0-9a-f]{10}$/.test(man[0].v), 'a content hash for cache-busting');
      assert.strictEqual(py('remove', 'boat-02').code, 0);
      assert.strictEqual(py('validate').code, 0);
      assert.strictEqual(py('enable', 'boat').code, 0);
      execFileSync('python3', [path.join(repo, 'tools', 'build.py')], { cwd: repo });
      const html = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');
      assert.match(html, /\/\*@ART@\*\/\[\{"id":"boat-01","set":"boat","file":"boat\/01-test\.png"/);
      assert.ok(!/"notes"|"where":"x"/.test(html), 'only what the game reads is embedded');
      fs.unlinkSync(path.join(repo, 'art', 'boat', '01-test.png'));
      const gone = py('validate'); assert.strictEqual(gone.code, 1); assert.match(gone.out, /boat-01: file art\/boat\/01-test\.png is missing/);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  } },
  { only: 'index.html', name: 'sw.js: illustrations are not precached; they are cached on first use in their own capped cache that survives releases', fn: async () => {
    const src = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const shell = src.match(/const SHELL = \[([\s\S]*?)\];/)[1]; assert.ok(!/art/.test(shell), 'not precached');
    // run the worker against a fake Cache API
    const stores = {}, handlers = {}, fetched = [];
    const mkCache = () => { const m = new Map(); return { match: async r => m.get(r.url || r), put: async (r, v) => { m.delete(r.url || r); m.set(r.url || r, v); }, keys: async () => [...m.keys()].map(url => ({ url })), delete: async r => m.delete(r.url || r), addAll: async () => {}, size: () => m.size }; };
    const caches = { open: async n => (stores[n] = stores[n] || mkCache()), keys: async () => Object.keys(stores), delete: async n => delete stores[n], match: async () => undefined };
    const self = { addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting: () => {}, clients: { claim: () => {} } };
    const resp = () => ({ ok: true, clone() { return resp(); } });
    new Function('self', 'caches', 'fetch', 'location', src)(self, caches, async r => { fetched.push(r.url); return resp(); }, { origin: 'https://x.test' });
    const get = async url => { let p; handlers.fetch({ request: { method: 'GET', url, mode: 'no-cors' }, respondWith: x => { p = x; } }); return p; };
    await get('https://x.test/art/cabin/01-a.webp?v=1'); await get('https://x.test/art/cabin/01-a.webp?v=1');
    assert.strictEqual(fetched.length, 1, 'the second showing comes from the cache');
    const ART = Object.keys(stores).find(k => /art$/.test(k)); assert.ok(ART, 'its own cache: ' + Object.keys(stores));
    const max = +src.match(/const ART_MAX = (\d+);/)[1];
    for (let i = 0; i < max + 15; i++) await get(`https://x.test/art/boat/${i}.png?v=1`);
    await new Promise(r => setTimeout(r, 20));
    assert.ok(stores[ART].size() <= max, `capped at ${max}: ${stores[ART].size()}`);
    assert.match(src, /k !== VERSION && k !== FONTS && k !== ART\)/, 'a new release keeps the art cache');
  } },
];
