// Illustrations (src/js/40-art.js, art/, tools/art.py, sw.js): the registry and its matching, the hooks (Home tab and fall cabin
// sheet, arriving at the launch, the trip sheet (the boat, then each step's own picture) and the dock, repairs at the shop, a loaner,
// the camping hub and days, event pop-ups, the morning report (the cabin's events, your guides' trips) and the cabin's storm prompts),
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
  { id: 't-launch', set: 'boat', file: PNG, alt: 'A sled backed down the ramp on its trailer.', when: { boat: 'sled', where: 'trailer', cond: [0, 100] } },
  { id: 't-shop', set: 'boat', file: PNG, alt: 'A sled on its trailer in the shop.', when: { boat: 'sled', where: 'shop', cond: [0, 100] } },
  { id: 't-loaner', set: 'boat', file: PNG, alt: 'A tired borrowed sled.', when: { boat: 'loaner', where: ['shop', 'launch'], cond: [0, 100], trip: 'reds' } },
  { id: 't-staff', set: 'boat', file: PNG, alt: 'Your guide pushes off with a party.', when: { boat: 'staff', where: 'staff', cond: [0, 100] } },
  { id: 't-camp', set: 'camp', file: PNG, alt: 'A tent in the snow.', when: { time: 'any' } },
  { id: 't-ev', set: 'event', file: PNG, alt: 'Ducks on the dock.', when: { event: 'art_test', from: 'game' } },
  { id: 't-wake', set: 'event', file: PNG, alt: 'Geese at dawn.', when: { event: 'art_wake', from: 'game' } },
  { id: 't-storm', set: 'event', file: PNG, alt: 'Snow piled to the eaves.', when: { event: ['cold_snap', 'heavy_snow'], from: 'home' } },
];

// In the page: play the same seeded stretch of the game and keep the HTML of every screen that has a hook.
// mode: 'none' (as shipped), 'off' (fixtures registered but disabled), 'pref' (enabled, Settings → Illustrations off), 'on'.
const scenario = async ({ mode, fixtures }) => {
  // (the keyboard hints, 09-keys.js, are drawn on the next animation frame, so they come and go with timing: leave them out)
  const snaps = [], snap = k => { const m = document.getElementById('mbg'); snaps.push([k, (k === 'home' || k.startsWith('app:') ? document.getElementById('app').innerHTML : m ? m.innerHTML : '').replace(/<i class="kn" aria-hidden="true">\d<\/i>/g, '')]); };
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
  // a sockeye trip: arriving at the launch, the first sheet and the dock
  S.cur = 1; S.t = 1440 + 345; S.loc = 'lower'; S.fuel = 30; S.gear = 3; S.boat = 90; S.book = []; S.cred.fa = 999;
  const b = { id: S.nextId++, d: 1, type: 'reds', n: 3, who: 'test party', from: 'Ohio', res: false, quirk: [], status: 'booked' }; S.book.push(b);
  const act = f => { uiNarr = []; ART_NARR = null; f(); tab = 'act'; render(); };
  act(() => { say('🚙 You pull in at the launch.'); onArrive('lower'); }); snap('app:launch');
  tripStart(b); snap('trip');
  let i = 0; while (S.trip && i++ < 30) MBTN(legalBtn());
  snap('dock'); closeModals(); clearTiles();
  // the shop: a service, then a loaner for a booked trip
  S.loc = 'shop'; S.boat = 50; S.money = 9000;
  act(() => actionsHere().find(x => /Service the boats yourself/.test(x.l)).fn()); snap('app:shop');
  S.boat = 0; S.loaner = -1; const lb = { id: S.nextId++, d: 1, type: 'reds', n: 2, who: 'loaner party', from: 'Utah', res: false, quirk: [], status: 'booked' }; S.book.push(lb);
  act(() => actionsHere().find(x => /Rent a loaner/.test(x.l)).fn()); snap('app:loaner');
  S.book = S.book.filter(x => x !== lb); S.boat = 90; S.loaner = -1; uiNarr = []; ART_NARR = null; closeModals(); clearTiles();
  // an event's OK pop-up, then the morning report
  forceEvent('art_test'); fireHook('art_hook', {}); snap('event'); closeModals(); clearTiles();
  S.cur = 2; S.t = 2 * 1440 + 1300; S.loc = 'shop'; S.book = []; S.calls = {}; S.dipnetAsk = 99;
  S.book.push({ id: S.nextId++, d: 2, type: 'reds', n: 2, who: 'staff party', from: 'Iowa', res: false, quirk: [], status: 'booked', asst: true });   // your assistant's trip
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
        upOne: sc({ up: 'motor' }, { up: ['motor'] }), hasNone: sc({ has: [] }, { has: [] }),
        noteKey: ART.score({ set: 'event', when: { event: 'moose', hook: 'travel', source: 'defEvent' } }, { event: 'moose' }),
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
    assert.deepStrictEqual(r.scores, { any: 0, eq: 1, neq: -1, missing: -1, ctxList: 1, range: 1, rangeLo: -1, rangeEdge: 1, hasAll: 1, hasSome: -1, upOne: 1, hasNone: 0, noteKey: 1, oneOf: 1, oneOfNo: -1, two: 2 });
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
    for (const [k, id] of [['home', 't-cabin'], ['app:launch', 't-launch'], ['trip', 't-launch'], ['dock', 't-boat'], ['app:shop', 't-shop'], ['app:loaner', 't-loaner'], ['event', 't-ev'], ['morning', 't-wake'], ['cabin-sheet', 't-cabin'], ['camp:hub', 't-camp'], ['camp:day', 't-camp'], ['camp:night', 't-camp']]) {
      const m = fig(k); assert.ok(m && m[1], `a figure at ${k}`);
      assert.ok(m[1] === id || (k === 'camp:night' && /^t-/.test(m[1])), `${k}: ${m[1]} (wanted ${id})`);
      assert.match(m[0], /<img class="art-img" src="data:image\/png;base64,/); assert.match(m[0], / alt="[^"]+"/); assert.match(m[0], / loading="lazy"/);
      assert.match(m[0], / decoding="async"/); assert.match(m[0], / width="1600" height="900"/); assert.match(m[0], /object-fit:cover/);
    }
    const storm = on.filter(s => s[0].startsWith('storm:') && /data-art="t-storm"/.test(s[1]));
    assert.ok(storm.length >= 1, 'the cabin storm prompt shows its event picture');
    // the morning report: the morning's event on top, your guide's trip in the night section, right above its line
    const morning = on.find(s => s[0] === 'morning')[1];
    assert.match(morning, /<figure class="art-fig" data-art="t-staff">[\s\S]*?<\/figure><p>🧑‍🤝‍🧑 /, 'the staff picture sits above the guides’ trips');
    assert.ok(morning.indexOf('data-art="t-wake"') < morning.indexOf('data-art="t-staff"'));
    // the boat at the put-in shows on arriving and on the opening step only, not on every decision; the dock has its own
    assert.strictEqual(on.filter(s => /data-art="t-launch"/.test(s[1])).length, 2);
    assert.strictEqual(on.filter(s => /data-art="t-boat"/.test(s[1])).length, 1);
    noErrors(errors);
  } },
  { name: 'morning report: a night event (no pop-up of its own) can bring its picture; a morning event wins', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(png => {
      closeModals(); clearTiles();
      defEvent({ id: 'art_night', hook: 'night', tile: ['🌙', 'Midnight sun', 'info'], chance: 0, run: () => say('🌙 Still light at midnight.') });
      defEvent({ id: 'art_wake2', hook: 'wake', tile: ['🪿', 'Geese', 'info'], chance: 0, run: () => say('🪿 Geese.') });
      ART.register({ id: 'n', set: 'event', file: png, alt: 'Light at midnight.', when: { event: 'art_night', time: 'night' }, enabled: true });
      ART.register({ id: 'w', set: 'event', file: png, alt: 'Geese.', when: { event: 'art_wake2' }, enabled: true });
      const night = () => { S.cur = 2; S.t = 2 * 1440 + 1300; S.loc = 'shop'; S.book = []; S.calls = {}; S.dipnetAsk = 99; };
      night(); forceEvent('art_night'); endDay('home');
      const a = (document.querySelector('#mbg .art-fig') || {}).dataset; closeModals(); clearTiles();
      night(); forceEvent('art_night'); forceEvent('art_wake2'); endDay('home');
      const b = (document.querySelector('#mbg .art-fig') || {}).dataset; closeModals(); ART.clear();
      return { a: a && a.art, b: b && b.art, figs: document.querySelectorAll('.art-fig').length };
    }, PNG);
    assert.strictEqual(r.a, 'n'); assert.strictEqual(r.b, 'w');
    noErrors(errors);
  } },
  { name: 'artImg: a WebP source (thumb 400w + full 1600w) over a small JPEG fallback (thumb 400w + 960w), save-data uses thumbs, dark mode dims, the 2:1 banner', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(png => {
      const e = { id: 'k', set: 'cabin', file: 'cabin/01-x.jpg', fw: 960, thumb: 'cabin/01-x.thumb.jpg', webp: 'cabin/01-x.webp', thumbWebp: 'cabin/01-x.thumb.webp', v: 'abc', w: 1600, h: 900, alt: 'A "quoted" <cabin>.' };
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
    assert.match(r.full, /src="art\/cabin\/01-x\.jpg\?v=abc"/);
    assert.match(r.full, /srcset="art\/cabin\/01-x\.thumb\.jpg\?v=abc 400w, art\/cabin\/01-x\.jpg\?v=abc 960w"/);
    assert.match(r.full, /<picture><source type="image\/webp" srcset="art\/cabin\/01-x\.thumb\.webp\?v=abc 400w, art\/cabin\/01-x\.webp\?v=abc 1600w"/);
    assert.match(r.full, / width="1600" height="900"/, 'the full size sets the aspect ratio');
    assert.match(r.full, /alt="A &quot;quoted&quot; &lt;cabin&gt;\."/);
    assert.match(r.lite, /src="art\/cabin\/01-x\.thumb\.jpg\?v=abc"/); assert.match(r.lite, /<source type="image\/webp" srcset="art\/cabin\/01-x\.thumb\.webp\?v=abc">/);
    assert.ok(!/1600w|960w/.test(r.lite), 'save-data: no full-size srcset');
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
  { name: 'cabin events: CabinUpkeep reports {id, sev} from its own list; a storm prompt shows its id before the choice and the outcome after (never the burst pipe first)', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(png => {
      const C = CabinUpkeep, out = {}, K = v => () => v, ids = rep => rep.events.map(e => e.id + ':' + e.sev);
      out.list = C.EVENTS.slice();
      const tk = (o, st) => Object.assign({ state: Object.assign(C.newState(), st || {}), phase: 'fall', season: 1, cash: 99999, energy: 90, daysLeft: 6, costMult: 1, bad: 1, gen: { owned: false } }, o);
      // winter: a long outage with no generator and no stove; a chimney fire; CO with and without alarms
      out.outDark = ids(C.rollWinter(tk({ outage: { h: 30, gen: false } }), { rand: K(.99) }));
      out.outGen = ids(C.rollWinter(tk({ outage: { h: 30, gen: true } }), { rand: K(.99) }));
      out.fire = ids(C.rollWinter(tk({}, { heat: { oil: 1, stove: 1 } }), { rand: K(0) }));
      out.coAlarm = ids(C.rollWinter(tk({}, { detect: 1 }), { rand: K(0) }));
      // spring: breakup (stuck), the well, the septic tank, the quake (strapped and not)
      out.spring = ids(C.rollSpring(tk({ phase: 'spring' }), { rand: K(0) }));
      out.quakeOk = ids(C.rollSpring(tk({ phase: 'spring' }, { strap: 1, did: Object.assign(C.newState().did, { breakup: 1, well: 1, septic: 1 }) }), { rand: (() => { let n = 0; return () => n++ < 2 ? .999 : 0; })() }));
      // July: the generator, the garden, the fish table
      out.gen = ids(C.genFailed(tk({ phase: 'summer', gen: { owned: true } })));
      out.harvest = ids(C.daily(tk({ phase: 'summer', sday: 10, abs: 30 }, { garden: { y: 1 }, fence: 1, bearY: 1 }), { rand: K(.99) }));
      out.spoil = ids(C.processing(tk({ phase: 'summer', fish: 6, clients: 2 }, { proc: 1, station: { tidy: 10 } }), { rand: K(0) }));
      out.quiet = C.processing(tk({ phase: 'summer', fish: 6, clients: 2 }, { proc: 1 }), { rand: K(.99) }).events;
      // the storm prompt, through Guide Master's host: cold_snap on the prompt, pipe_burst after "Skip it"
      ART.clear();
      const reg = (id, when) => ART.register({ id, set: 'event', file: png, alt: id + '.', when, enabled: true });
      reg('cs', { event: 'cold_snap', from: 'home' }); reg('pb', { event: 'pipe_burst', from: 'home' }); reg('wrong', { event: 'pipe_burst', from: 'game' });
      const st = Object.assign(C.newState(), { queue: [{ id: 'cold', sev: 3 }] }), H = homeHost();
      const rr = Math.random; Math.random = K(0);
      try {
        const host = { show: H.show, ticket: () => tk({}, JSON.parse(JSON.stringify(st))), apply: () => {}, rand: K(0) };
        closeModals(); C.ui.open(host, 'cold', null, true);
        const fig = () => { const f = document.querySelector('#mbg .art-fig'); return f ? f.dataset.art : null; };
        out.prompt = fig(); out.promptHTML = /pipe/i.test(document.querySelector('#mbg').innerHTML.match(/<figure[\s\S]*?<\/figure>/)[0]);
        MBTN(MB.findIndex(b => /Skip it/.test(b.l)));
        out.after = fig(); out.afterText = /pipe under the floor bursts/.test(document.querySelector('#mbg').textContent);
        // nothing came of it: the prompt's own picture again
        closeModals(); host.rand = K(.99); C.ui.open(host, 'cold', null, true); MBTN(MB.findIndex(b => /Do it yourself/.test(b.l))); out.calm = fig();
      } finally { Math.random = rr; closeModals(); ART.clear(); }
      return out;
    }, PNG);
    assert.deepStrictEqual(r.list, ['chimney_fire', 'pipes_frozen', 'pipe_burst', 'cold_snap', 'heavy_snow', 'ice_dam', 'shed_collapse', 'breakup_stuck', 'frost_heave',
      'well_pump', 'septic_backup', 'quake', 'quake_ok', 'co_alarm', 'co_night', 'bear_yard', 'bear_raid', 'garden_moose', 'garden_harvest', 'gen_fail',
      'outage_gen', 'outage_dark', 'roof_leak', 'furnace_fail', 'pump_fail', 'spoiled_batch'], 'the ids of SPEC2, in its order');
    assert.deepStrictEqual(r.outDark, ['outage_dark:1']); assert.deepStrictEqual(r.outGen, ['outage_gen:0']);
    assert.ok(r.fire.includes('chimney_fire:2') && r.fire.includes('co_night:2'), r.fire.join()); assert.ok(r.coAlarm.includes('co_alarm:1'), r.coAlarm.join());
    assert.ok(['breakup_stuck:1', 'well_pump:2', 'septic_backup:2', 'quake:2'].every(x => r.spring.includes(x)), r.spring.join());
    assert.deepStrictEqual(r.quakeOk, ['quake_ok:0']);
    assert.deepStrictEqual(r.gen, ['gen_fail:1']); assert.deepStrictEqual(r.harvest, ['garden_harvest:0']); assert.deepStrictEqual(r.spoil, ['spoiled_batch:1']); assert.deepStrictEqual(r.quiet, []);
    assert.strictEqual(r.prompt, 'cs', 'the prompt shows the cold snap'); assert.strictEqual(r.promptHTML, false);
    assert.strictEqual(r.after, 'pb', 'the outcome shows the burst pipe'); assert.ok(r.afterText);
    assert.strictEqual(r.calm, 'cs');
    // every id in the list is reported somewhere in the engine, and nothing outside it
    const src = fs.readFileSync(path.join(ROOT, 'src/home/home-20-engine.js'), 'utf8');
    const used = new Set([...src.matchAll(/ev\(out,'(\w+)'/g), ...src.matchAll(/\bev:'(\w+)'/g), ...src.matchAll(/O\.gen\?'(\w+)':'(\w+)'/g)].flatMap(m => m.slice(1)));
    assert.deepStrictEqual([...used].sort(), r.list.slice().sort());
    noErrors(errors);
  } },
  { name: 'morning report: the cabin’s mishaps come first, then the morning’s events, the cabin’s news, the night’s; a summer outage brings outage_dark', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(png => {
      ART.clear();
      const reg = (id, when) => ART.register({ id, set: 'event', file: png, alt: id + '.', when, enabled: true });
      reg('bear', { event: 'bear_yard', from: 'home' }); reg('veg', { event: 'garden_harvest', from: 'home' }); reg('moose', { event: 'moose', from: 'game' }); reg('sun', { event: 'midnight_sun', from: 'game' });
      const pick = D => (artMorning(Object.assign({ items: [], night: '', home: [], nightIds: [], from: 0 }, D)).top.match(/data-art="(\w+)"/) || [])[1] || null;
      const out = {
        all: pick({ home: [{ id: 'garden_harvest', sev: 0 }, { id: 'bear_yard', sev: 1 }], items: [{ id: 'moose' }], nightIds: ['midnight_sun'] }),
        game: pick({ home: [{ id: 'garden_harvest', sev: 0 }], items: [{ id: 'moose' }], nightIds: ['midnight_sun'] }),
        news: pick({ home: [{ id: 'garden_harvest', sev: 0 }], nightIds: ['midnight_sun'] }),
        night: pick({ nightIds: ['midnight_sun'] }), none: pick({}),
        campMoose: (() => { ART.clear(); reg('cm', { event: 'moose', from: 'camp' }); return pick({ items: [{ id: 'moose' }] }); })(),
      };
      ART.clear(); reg('dark', { event: 'outage_dark', from: 'home' }); reg('lit', { event: 'outage_gen', from: 'home' });
      closeModals(); clearTiles(); S.home.gen = 0;
      S.cur = 2; S.t = 2 * 1440 + 1300; S.loc = 'shop'; S.book = []; S.calls = {}; S.dipnetAsk = 99;
      forceEvent('power_out'); endDay('home');
      const f = document.querySelector('#mbg .art-fig'); out.outage = f && f.dataset.art; out.said = /power is out/.test(document.querySelector('#mbg').textContent);
      closeModals(); ART.clear();
      return out;
    }, PNG);
    assert.deepStrictEqual(r, { all: 'bear', game: 'moose', news: 'veg', night: 'sun', none: null, campMoose: null, outage: 'dark', said: true });
    noErrors(errors);
  } },
  { name: 'trip events: each step can show its own picture (from "trip", the STEP id) above the dilemma; the boat shows only on the opening step', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(png => {
      const S0 = JSON.stringify(S);
      const run = on => {
        S = JSON.parse(S0); let a = 99; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        ART.clear();
        if (on) {
          const reg = (id, set, when) => ART.register({ id, set, file: png, alt: id + '.', when, enabled: true });
          reg('beat', 'event', { event: 'beat', from: 'trip' }); reg('beat-game', 'event', { event: 'beat', from: 'game' });
          reg('bear', 'event', { event: 'bear', from: 'trip' }); reg('sled', 'boat', { boat: 'drift', where: 'river' });
        }
        closeModals(); clearTiles();
        S.cur = 1; S.t = 1440 + 400; S.loc = 'cooper'; S.gear = 3; S.boat = 90; S.book = []; S.cred.fa = 999; S.dil = null;
        const b = { id: S.nextId++, d: 1, type: 'trout', n: 2, who: 'test party', from: 'Ohio', res: false, quirk: [], status: 'booked' }; S.book.push(b);
        tripStart(b);
        S.trip.steps.splice(S.trip.step + 2, 0, 'bear');   // a sow and two cubs, after the opening sheet
        const sheets = []; let i = 0;
        while (S.trip && i++ < 30) { const m = document.getElementById('mbg'); sheets.push([S.trip.steps[S.trip.step], m.innerHTML]); MBTN(legalBtn()); }
        closeModals(); ART.clear();
        return sheets;
      };
      const off = run(false), on = run(true);
      return { keys: off.map(x => x[0]), keysOn: on.map(x => x[0]), same: off.every((x, i) => x[1] === on[i][1].replace(/<figure class="art-fig"[\s\S]*?<\/figure>/g, '')),
        figs: on.map(x => (x[1].match(/data-art="([\w-]+)"/) || [])[1] || null), first: on[0][1].indexOf('art-fig') < on[0][1].indexOf('small-note') };
    }, PNG);
    assert.deepStrictEqual(r.keysOn, r.keys); assert.ok(r.same, 'only the figures differ');
    assert.strictEqual(r.figs[0], 'sled', 'the opening sheet: the boat at the put-in'); assert.ok(r.first, 'the picture sits above the dilemma');
    r.keys.forEach((k, i) => { if (i > 0) assert.strictEqual(r.figs[i], k === 'beat' ? 'beat' : k === 'bear' ? 'bear' : null, `${k}: ${r.figs[i]}`); });
    assert.ok(r.keys.includes('bear') && r.keys.includes('beat'), r.keys.join());
    noErrors(errors);
  } },
  { name: 'boat context: loaner, king, staff and owned upgrades (dock); where for launch, shop, staff and the dock', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => {
      const bk = (type, x) => Object.assign({ type, who: 'p', n: 2, d: day() }, x || {});
      const out = {};
      S.boat = 60; S.up.dock = 1; S.up.motor = 1;
      out.own = artBoatCtx(bk('reds'), 'river'); out.king = artBoatCtx(bk('king'), 'river').boat; out.staff = artBoatCtx(bk('trout', { asst: true }), 'staff').boat;
      S.boat = 0; S.loaner = S.cur;
      out.loan = artBoatCtx(bk('reds'), 'launch').boat; out.loanHal = artBoatCtx(bk('halibut'), 'harbor').boat; out.shop = artBoatCtx(null, 'shop').boat;
      // a repair is matched with the boat as it came in: a worn-sled picture still shows after the service lifts it to 30
      ART.clear(); ART.register({ id: 'worn', set: 'boat', file: 'x.webp', alt: 'A worn sled.', when: { where: 'shop', cond: [0, 20] }, enabled: true });
      S.boat = 30; S.loaner = -1; S.loc = 'shop'; artShop(10); out.worn = /data-art="worn"/.test(ART_NARR || ''); artShop(30); out.fine = ART_NARR; ART.clear(); ART_NARR = null;
      return out;
    });
    assert.strictEqual(r.worn, true); assert.strictEqual(r.fine, null);
    assert.deepStrictEqual(r.own.boat, ['sled']); assert.ok(r.own.up.includes('dock') && r.own.up.includes('motor')); assert.strictEqual(r.own.trip, 'reds');
    assert.deepStrictEqual(r.king, ['king', 'sled']); assert.deepStrictEqual(r.staff, ['staff', 'drift']);
    assert.deepStrictEqual(r.loan, ['loaner', 'sled']); assert.deepStrictEqual(r.loanHal, ['charter']); assert.deepStrictEqual(r.shop, ['loaner', 'sled']);
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
    // art/ holds the README, the manifest and each set's small files (WebP + JPEG fallback, thumbs): no PNG, nothing unlisted
    const A = path.join(ROOT, 'art'), walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(x => x.isDirectory() ? walk(path.join(d, x.name)) : [path.relative(A, path.join(d, x.name)).split(path.sep).join('/')]);
    const listed = new Set(man.flatMap(e => ['file', 'thumb', 'webp', 'thumbWebp'].filter(k => e[k]).map(k => e[k])));
    for (const f of walk(A)) {
      if (['README.md', 'manifest.json'].includes(f)) continue;
      assert.match(f, /^(cabin|boat|camp|event)\/[\w-]+\.(thumb\.)?(webp|jpg)$/, 'only WebP and JPEG files in a set folder: ' + f);
      assert.ok(listed.has(f), 'every file is in the manifest: ' + f);
    }
    for (const e of man) for (const k of ['file', 'thumb', 'webp', 'thumbWebp']) assert.ok(fs.existsSync(path.join(A, e[k])), `${e.id}: ${k} exists`);
    const rel = JSON.parse(fs.readFileSync(path.join(ROOT, 'release.json'), 'utf8'));
    assert.ok(!(rel.exclude || []).some(x => /^art\/?$/.test(x)), 'the release keeps art/ in the site');
  } },
  { only: 'index.html', name: 'tools/art.py validate: only the set’s when-keys, "from" on events and ids reported from there, file formats and sizes (no Pillow needed); enable embeds an entry', fn: async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-art-')), repo = path.join(tmp, 'repo');
    try {
      fs.mkdirSync(repo);
      for (const d of ['src', 'tools', 'fonts', 'icons']) fs.cpSync(path.join(ROOT, d), path.join(repo, d), { recursive: true });
      for (const f of ['sw.js', 'manifest.webmanifest']) fs.copyFileSync(path.join(ROOT, f), path.join(repo, f));
      // real, small files from the repo's own art (a WebP 1600x900, a JPEG 960x540 and the thumbs)
      const one = JSON.parse(fs.readFileSync(path.join(ROOT, 'art', 'manifest.json'), 'utf8')).find(e => e.set === 'boat');
      for (const s of ['boat', 'event']) { fs.mkdirSync(path.join(repo, 'art', s), { recursive: true }); for (const k of ['webp', 'file', 'thumbWebp', 'thumb']) fs.copyFileSync(path.join(ROOT, 'art', one[k]), path.join(repo, 'art', s, path.basename(one[k]))); }
      const ent = (id, set, when, x) => Object.assign({ id, set, n: 1, title: id, webp: `${set}/${path.basename(one.webp)}`, file: `${set}/${path.basename(one.file)}`, fw: 960,
        thumbWebp: `${set}/${path.basename(one.thumbWebp)}`, thumb: `${set}/${path.basename(one.thumb)}`, v: 'abc', w: 1600, h: 900, alt: 'A sled at the launch.', where: '', when, notes: '', enabled: false }, x || {});
      fs.writeFileSync(path.join(repo, 'art', 'manifest.json'), JSON.stringify([
        ent('boat-01', 'boat', { boat: ['sled', 'loaner', 'king'], where: ['launch', 'trailer', 'dock', 'shop', 'staff'], up: ['motor', 'dock'], cond: [40, 100], time: 'day', trip: 'king' }, { meta: { hook: 'launch' }, notes: 'n' }),
        ent('boat-02', 'boat', { boat: 'drift', up: ['warp-drive'], hook: 'shop' }),
        ent('boat-03', 'boat', { boat: 'sled' }, { fw: 1200 }),
        ent('event-01', 'event', { event: 'pipe_burst', time: 'any' }),
        ent('event-02', 'event', { event: ['combat', 'cold_snap'], from: 'trip' }),
        ent('event-03', 'event', { event: ['combat', 'bear', 'fog', 'whale'], from: 'trip' }),
        ent('event-04', 'event', { event: ['pipe_burst', 'cold_snap', 'outage_dark'], from: 'home' }),
        ent('event-05', 'event', { event: 'moose', from: ['game', 'camp'] }),
        ent('event-06', 'event', { event: 'moose', from: 'home' })], null, 1));
      const py = (...a) => { try { return { code: 0, out: execFileSync('python3', [path.join(repo, 'tools', 'art.py'), '--root', repo, ...a], { encoding: 'utf8' }) }; } catch (e) { return { code: e.status, out: String(e.stdout) + String(e.stderr) }; } };
      const v = py('validate'), errs = v.out.split('\n').filter(l => l.startsWith('ERROR'));
      assert.strictEqual(v.code, 1);
      assert.ok(errs.some(l => /boat-02: when\.up has \['warp-drive'\]/.test(l)) && errs.some(l => /boat-02: when\.hook is not a key of the boat set.*notes.*meta/.test(l)), v.out);
      assert.ok(errs.some(l => /boat-03: art\/boat\/\S+\.jpg is 960x540, expected 1200x675/.test(l)), v.out);
      assert.ok(errs.some(l => /event-01: when\.from is required/.test(l)) && errs.some(l => /event-02: event \['cold_snap'\] is never reported from trip/.test(l)), v.out);
      assert.ok(errs.some(l => /event-06: event \['moose'\] is never reported from home/.test(l)), v.out);
      for (const id of ['boat-01', 'event-03', 'event-04', 'event-05']) assert.ok(!errs.some(l => l.includes(id + ':')), id + ': ' + v.out);
      assert.strictEqual(errs.length, 6, v.out);
      assert.strictEqual(py('remove', 'boat-02', 'boat-03', 'event-01', 'event-02', 'event-06').code, 0);
      const ok = py('validate', '--strict'); assert.strictEqual(ok.code, 0, ok.out); assert.match(ok.out, /4 entries checked: 0 errors, 0 warnings; 0 enabled in all; files: boat \d+ KB, event \d+ KB/);
      assert.ok(fs.existsSync(path.join(repo, 'art', 'boat', path.basename(one.webp))), 'remove keeps files another entry still uses');
      assert.strictEqual(py('enable', 'boat-01').code, 0);
      execFileSync('python3', [path.join(repo, 'tools', 'build.py')], { cwd: repo });
      const html = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');
      assert.match(html, /\/\*@ART@\*\/\[\{"id":"boat-01","set":"boat","file":"boat\/[\w-]+\.jpg","fw":960,"thumb":"boat\/[\w-]+\.thumb\.jpg","webp":"boat\/[\w-]+\.webp"/);
      assert.ok(!/"notes"|"meta"/.test(html.match(/\/\*@ART@\*\/.*?\/\*@\/ART@\*\//s)[0]), 'only what the game reads is embedded');
      execFileSync('python3', [path.join(repo, 'tools', 'build-offline.py'), '--with-art'], { cwd: repo, stdio: 'pipe' });
      const off = fs.readdirSync(path.join(repo, 'offline')).map(f => fs.readFileSync(path.join(repo, 'offline', f), 'utf8')).join('').match(/\/\*@ART@\*\/.*?\/\*@\/ART@\*\//s)[0];
      assert.match(off, /"file":"data:image\/webp;base64,/, 'the offline file inlines the WebP'); assert.ok(!/"fw":/.test(off));
      fs.unlinkSync(path.join(repo, 'art', 'boat', path.basename(one.file)));
      const gone = py('validate'); assert.strictEqual(gone.code, 1); assert.match(gone.out, /boat-01: file art\/boat\/\S+\.jpg is missing/);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  } },
  { only: 'index.html', name: 'tools/art.py import encodes a drawn set: WebP 1600x900 (≤150 KB), JPEG 960x540, thumbs as WebP + JPEG, no PNG, disabled, notes and meta kept (needs Pillow)', fn: async () => {
    try { execFileSync('python3', ['-c', "from PIL import features;assert features.check('webp')"], { stdio: 'pipe' }); }
    catch (e) { console.log('       (skipped: no Pillow with WebP here; tools/art.py import needs it, validate does not)'); return; }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-art-')), set = path.join(tmp, 'set', 'boat'), repo = path.join(tmp, 'repo');
    try {
      fs.mkdirSync(set, { recursive: true });
      // 1600x900 and 400x225 PNGs written by Python (zlib + struct): soft bands, like the flat art
      const mk = `import struct,zlib,sys
def png(p,w,h):
  rows=[b'\\x00'+b''.join(bytes([143,(185+x*60//w)%256,207-k*9]) for x in range(w)) for k in range(9)]
  raw=b''.join(rows[y*9//h] for y in range(h))
  ch=lambda t,d:struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
  open(p,'wb').write(b'\\x89PNG\\r\\n\\x1a\\n'+ch(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+ch(b'IDAT',zlib.compress(raw,9))+ch(b'IEND',b''))
for n in (1,2):
  png(sys.argv[1]+'/0%d-test.png'%n,1600,900); png(sys.argv[1]+'/0%d-test.thumb.png'%n,400,225)`;
      execFileSync('python3', ['-c', mk, set]);
      fs.writeFileSync(path.join(set, 'manifest.json'), JSON.stringify([
        { id: 'boat-01', set: 'boat', n: 1, title: 'a', file: 'boat/01-test.png', svg: 'boat/01-test.svg', w: 1600, h: 900, alt: 'A jet sled at the launch.', where: 'x', when: { boat: 'loaner', where: 'launch' }, notes: 'n', meta: { hook: 'launch' } },
        { id: 'boat-02', set: 'boat', n: 2, title: 'b', file: 'boat/02-test.png', w: 1600, h: 900, alt: 'A drift boat.', where: 'x', when: { boat: 'drift', where: 'dock' }, notes: '' }]));
      fs.mkdirSync(path.join(repo, 'art'), { recursive: true });
      for (const d of ['src', 'tools']) fs.cpSync(path.join(ROOT, d), path.join(repo, d), { recursive: true });
      fs.writeFileSync(path.join(repo, 'art', 'manifest.json'), '[]\n');
      const imp = (() => { try { return { code: 0, out: execFileSync('python3', [path.join(repo, 'tools', 'art.py'), '--root', repo, 'import', set], { encoding: 'utf8' }) }; } catch (e) { return { code: e.status, out: String(e.stdout) + String(e.stderr) }; } })();
      assert.strictEqual(imp.code, 0, imp.out); assert.match(imp.out, /imported 2 entries \(2 new\).*disabled/);
      const man = JSON.parse(fs.readFileSync(path.join(repo, 'art', 'manifest.json'), 'utf8')), e1 = man[0], B = f => path.join(repo, 'art', f);
      assert.deepStrictEqual(man.map(e => [e.id, e.enabled]), [['boat-01', false], ['boat-02', false]], 'imported switched off');
      assert.deepStrictEqual([e1.webp, e1.file, e1.fw, e1.thumbWebp, e1.thumb, e1.w, e1.h], ['boat/01-test.webp', 'boat/01-test.jpg', 960, 'boat/01-test.thumb.webp', 'boat/01-test.thumb.jpg', 1600, 900]);
      assert.deepStrictEqual(e1.meta, { hook: 'launch' }); assert.strictEqual(e1.notes, 'n'); assert.ok(!('svg' in e1)); assert.ok(/^[0-9a-f]{10}$/.test(e1.v), 'a content hash for cache-busting');
      assert.deepStrictEqual(fs.readdirSync(path.join(repo, 'art', 'boat')).sort(), ['01-test.jpg', '01-test.thumb.jpg', '01-test.thumb.webp', '01-test.webp', '02-test.jpg', '02-test.thumb.jpg', '02-test.thumb.webp', '02-test.webp'], 'no PNG is kept');
      const size = f => JSON.parse(execFileSync('python3', ['-c', 'import sys,json;from PIL import Image;im=Image.open(sys.argv[1]);print(json.dumps([im.format,*im.size]))', B(f)], { encoding: 'utf8' }));
      assert.deepStrictEqual(size(e1.webp), ['WEBP', 1600, 900]); assert.deepStrictEqual(size(e1.file), ['JPEG', 960, 540]);
      assert.deepStrictEqual(size(e1.thumbWebp), ['WEBP', 400, 225]); assert.deepStrictEqual(size(e1.thumb), ['JPEG', 400, 225]);
      assert.ok(fs.statSync(B(e1.webp)).size <= 150 * 1024 && fs.statSync(B(e1.file)).size < fs.statSync(path.join(set, '01-test.png')).size);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  } },
  { only: 'index.html', name: 'tools/art.py events: the ids it reads from the source are the ids the running game reports (defEvent, CabinUpkeep.EVENTS, camp encounters, trip steps)', fn: async ctx => {
    const py = JSON.parse(execFileSync('python3', [path.join(ROOT, 'tools', 'art.py'), 'events'], { encoding: 'utf8' }));
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => ({ game: EV.map(e => e.id), home: CabinUpkeep.EVENTS.slice(), trip: Object.keys(STEP) }));
    const S = a => [...new Set(a)].sort();
    assert.deepStrictEqual(py.game, S(r.game)); assert.deepStrictEqual(py.home, S(r.home)); assert.deepStrictEqual(py.trip, S(r.trip));
    assert.ok(py.camp.includes('wolves') && py.camp.includes('chinook') && py.camp.length >= 19, py.camp.join());
    for (const k of ['combat', 'bear', 'fog', 'whale', 'king', 'hookhand']) assert.ok(py.trip.includes(k), k);
    noErrors(errors);
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
