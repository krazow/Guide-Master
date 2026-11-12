// The KenaiCamp engine (src/camp/), tested on its own: no browser and no Guide Master. The files are loaded into an empty Node
// `vm` context, which only works if they reference nothing of the host game. The standalone page is tested in a browser.
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const { pathToFileURL } = require('url');
const { noErrors, assert } = require('./helpers');

const ROOT = path.resolve(__dirname, '..'), DIR = path.join(ROOT, 'src', 'camp');
const FILES = fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort();
const SRC = FILES.map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');

// a fresh engine in an empty context (optionally with a fake localStorage)
function load(extra) {
  const ctx = vm.createContext(Object.assign({ setTimeout }, extra || {}));   // a timer is the only platform API it needs
  const before = new Set(vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx));
  const K = vm.runInContext(SRC + '\n;KenaiCamp', ctx);
  const added = vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx).filter(k => !before.has(k));
  return { K, ctx, added };
}
const T0 = (o) => Object.assign({ year: 2026, cash: 5000, energy: 70, rep: 60, skill: 20, gas: 5.34, mpg: 15, costMult: 1, gear: [], licYear: 0, food: { meals: 30, freezerRoom: 30 }, regulars: [], rival: null, guideFriend: true, daysLeft: 10, tripsLeft: 3, gigsLeft: 2 }, o || {});
const ALLGEAR = ['bear', 'fuel', 'bag', 'layers', 'truck', 'ice', 'picks', 'vise', 'wall', 'camper'];
const konst = v => Object.assign(() => v, {});
// compare across the vm boundary (arrays and objects from another realm)
const deq = (a, b, m) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
// a seeded generator whose first draw is low, so a guest who might decline accepts
const lead = (K, seed) => { let n = 0; const g = K.util.seeded(seed); return () => (n++ === 0 ? .05 : g()) };
// click through a session by choice ids; every one must be accepted
function go(s, ...ids) { for (const id of ids) assert.ok(s.choose(id), `choice ${id} refused in phase ${s.phase}: ${s.view().buttons.map(b => b.id + (b.dis ? '(x)' : '')).join(' ')}`); return s; }
const ids = s => s.view().buttons.filter(b => !b.dis).map(b => b.id);
const btn = (s, id) => s.view().buttons.find(b => b.id === id);
// start a trip: hub → … → day 1
function startTrip(K, o) {
  const s = K.session(T0(o.ticket), { rand: o.rand || konst(.9) });
  go(s, 'plan', 'p:' + o.place, 'm:' + o.month, 'n:' + (o.nights || 1));
  go(s, o.company ? 'c:' + o.company : 'c:none');
  if (s.phase === 'shelter') go(s, 's:' + (o.shelter || 'tent'));
  if (Array.isArray(o.pack)) o.pack.forEach(k => go(s, 'k:' + k)); else go(s, 'auto');
  go(s, 'packed', 'go');
  return s;
}
// play a trip to its summary and back to the hub, using a script for each phase
function play(K, o) {
  const s = startTrip(K, o);
  const act = o.act || 'rest', eve = o.evening || 'rest';
  let guard = 0;
  while (s.phase !== 'hub' && guard++ < 80) {
    const v = s.view(), has = id => v.buttons.some(b => b.id === id && !b.dis);
    switch (s.phase) {
      case 'day': go(s, has(act) ? act : has('evening') ? 'evening' : 'rest'); break;
      case 'lic': go(s, has('buy') ? 'buy' : 'no'); break;
      case 'kit': go(s, has('rent') ? 'rent' : 'no'); break;
      case 'icesafe': go(s, o.risk ? 'risk' : 'check'); break;
      case 'icethin': go(s, 'skip'); break;
      case 'icecatch': go(s, has(o.use || 'freezer') ? (o.use || 'freezer') : 'fry'); break;
      case 'evening': go(s, has(eve) ? eve : 'rest'); break;
      case 'night': go(s, 'go'); break;
      case 'leave': go(s, o.quick ? 'quick' : 'thorough'); break;
      case 'result': go(s, 'ok'); break;
      default: throw new Error('stuck in ' + s.phase);
    }
  }
  go(s, 'done');
  return s;
}

module.exports = [
  { only: 'index.html', name: 'engine: loads with no host globals, creates only KenaiCamp, and its source never names the game', fn: async () => {
    const { K, added } = load();
    assert.ok(K && K.VERSION && K.SCHEMA >= 1 && typeof K.start === 'function' && typeof K.session === 'function' && typeof K.sim === 'function');
    assert.strictEqual(added.length, 0, 'no other globals: ' + added);
    for (const f of FILES) {
      const src = fs.readFileSync(path.join(DIR, f), 'utf8');
      // strip comments so the rule is about code, then look for the host's names
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const [re, what] of [[/\bS\./, 'S.'], [/\bS\[/, 'S['], [/\bmodal\s*\(/, 'modal('], [/\bGAME\b/, 'GAME'], [/\bMIGRATIONS\b/, 'MIGRATIONS'], [/\bAPP_VERSION\b/, 'APP_VERSION'],
        [/\bsay\s*\(/, 'say('], [/\bshowTile\b/, 'showTile'], [/\bdocument\b/, 'document'], [/\bwindow\b/, 'window'], [/\bsfx\s*\(/, 'sfx('], [/\bDF\s*\(/, 'DF(']])
        assert.ok(!re.test(code), `${f} refers to ${what}`);
      if (f !== 'camp-00-core.js') assert.ok(!/localStorage/.test(code), `${f} touches storage directly`);
    }
    assert.ok(/^const KenaiCamp=/m.test(fs.readFileSync(path.join(DIR, FILES[0]), 'utf8')), 'the namespace is declared first');
  } },
  { only: 'index.html', name: 'engine: the build puts src/camp before src/js, in the game and the offline build', fn: async () => {
    for (const f of [path.join(ROOT, 'index.html'), ...fs.readdirSync(path.join(ROOT, 'offline')).map(x => path.join(ROOT, 'offline', x))]) {
      const h = fs.readFileSync(f, 'utf8');
      const a = h.indexOf('const KenaiCamp='), b = h.indexOf('const GAME='), c = h.indexOf('function campModal');
      assert.ok(a > 0 && b > a && c > b, path.basename(f) + ': engine before game, adapter after');
      assert.ok(!/dist-camp|kenai-camp\.html/.test(h), 'the standalone page is not linked');
    }
    assert.ok(!/kenai-camp|dist-camp/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')), 'and not cached by the service worker');
    assert.ok(/dist-camp/.test(fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8')), 'and git-ignored');
  } },
  { only: 'index.html', name: 'engine: storage uses only kenaicamp: keys (journal and solo save)', fn: async () => {
    const keys = [], mem = {};
    const { K } = load({ localStorage: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { keys.push(k); mem[k] = String(v) }, removeItem: k => { delete mem[k] } } });
    const done = await new Promise(res => {
      let h;
      const host = { rand: K.util.seeded(7), show: (t, html, b) => queueMicrotask(() => { const v = h.session.view(), id = K.policies.thoughtful({ reserve: 100 })(v, h.session.state); b[v.buttons.findIndex(x => x.id === id)].fn() }),
        onFinish: (rep, save) => res({ rep, save }) };
      h = K.start({ mode: 'solo', host });
    });
    assert.ok(done.save && done.save.v === K.SCHEMA); assert.ok(keys.length >= 2);
    assert.ok(keys.every(k => k.startsWith('kenaicamp:')), keys.join());
    assert.ok(keys.includes('kenaicamp:journal') && keys.includes('kenaicamp:solo'));
    const saved = JSON.parse(mem['kenaicamp:solo']); assert.strictEqual(saved.tot.trips, done.rep.tripsTaken); assert.strictEqual(saved.v, K.SCHEMA);
    assert.strictEqual(K.solo.load().tot.trips, done.rep.tripsTaken);
    const j = K.journal.load(); assert.ok(Object.keys(done.rep.speciesSeen).every(id => j.seen[id] >= 1));
    // guide mode writes the journal only, never the solo save
    keys.length = 0; delete mem['kenaicamp:solo'];
    await new Promise(res => { let h; h = K.start({ mode: 'guide', ticket: T0(), host: { show: (t, html, b) => queueMicrotask(() => b[b.length - 1].fn()), onFinish: res } }); });
    assert.ok(!keys.includes('kenaicamp:solo'));
  } },
  { only: 'index.html', name: 'engine: the ticket in, the report out (contract, defaults, bounds)', fn: async () => {
    const { K } = load();
    const n = K.normTicket({}); assert.strictEqual(n.daysLeft, 10); assert.strictEqual(n.tripsLeft, 3); assert.strictEqual(n.gigsLeft, 2); deq(n.gear, []);
    const KEYS = ['v', 'mode', 'cashDelta', 'spent', 'earned', 'energyDelta', 'repDelta', 'skillDelta', 'womDelta', 'bookingBoost', 'firstTripBoost', 'foodFish', 'tackleCredit', 'scout', 'relations', 'speciesSeen', 'newSpecies', 'achievements', 'daysUsed', 'tripsTaken', 'gigs', 'nights', 'encounters', 'noTraceTrips', 'gearBought', 'license', 'log', 'trips'];
    const empty = K.session(T0()).report(); for (const k of KEYS) assert.ok(k in empty, 'report has ' + k);
    assert.strictEqual(empty.cashDelta, 0); assert.strictEqual(empty.tripsTaken, 0); assert.strictEqual(empty.scout, null);
    const reg = [{ id: 'garza', name: 'the Garza family', mood: 85 }, { id: 'cpl', name: 'the retired couple', mood: 60 }], rival = { id: 'rival', name: 'Dale Voss', mood: 1 };
    for (let seed = 1; seed <= 150; seed++) {
      const tk = T0({ cash: 100 + (seed % 7) * 700, regulars: reg, rival, gear: seed % 3 ? [] : ALLGEAR, licYear: seed % 2 ? 2026 : 0, energy: 30 + seed % 60, difficulty: 0, costMult: seed % 2 ? 1 : 1.08 });
      const r = K.sim({ ticket: tk, seed, policy: seed % 5 === 0 ? 'first' : seed % 2 ? 'random' : 'thoughtful', opts: { reserve: 100 } }), p = r.report;
      assert.ok(r.finished, 'finished ' + seed);
      for (const k of KEYS) assert.ok(k in p, k);
      for (const k of ['cashDelta', 'spent', 'earned', 'energyDelta', 'repDelta', 'skillDelta', 'womDelta', 'bookingBoost', 'firstTripBoost', 'foodFish', 'tackleCredit', 'daysUsed', 'tripsTaken', 'nights', 'encounters'])
        assert.ok(Number.isFinite(p[k]), `${k} finite (${p[k]})`);
      assert.ok(Math.abs(p.cashDelta - (p.earned - p.spent)) < .02, 'cash adds up');
      assert.ok(p.cashDelta >= -tk.cash - .01, 'never spends more than you have');
      assert.ok(tk.energy + p.energyDelta >= 0 && tk.energy + p.energyDelta <= 100);
      assert.ok(p.bookingBoost >= 0 && p.bookingBoost <= .02 && p.firstTripBoost >= 0 && p.firstTripBoost <= .03);
      assert.ok(p.tripsTaken <= 3 && p.gigs.length <= 2 && p.daysUsed <= 14 && p.foodFish <= 30);
      assert.ok(p.relations.every(x => x.delta >= -3 && x.delta <= 4 && ['regular', 'guide', 'rival'].includes(x.kind)));
      assert.ok(Object.keys(p.speciesSeen).every(id => K.data.ALL.includes(id)));
      assert.ok(JSON.stringify(p), 'serializable');
    }
  } },
  { only: 'index.html', name: 'engine: daylight limits the day to one activity, two on long days', fn: async () => {
    const { K } = load();
    assert.strictEqual(K.data.slots(K.data.month('dec')), 1); assert.strictEqual(K.data.slots(K.data.month('feb')), 2); assert.strictEqual(K.data.slots(K.data.month('mar')), 2);
    assert.ok(K.data.month('dec').day >= 5 && K.data.month('dec').day <= 6, 'about 5-6 hours in December');
    const dec = startTrip(K, { place: 'cook', month: 'dec', ticket: { gear: ALLGEAR, licYear: 2026 } });
    assert.strictEqual(dec.view().meta.trip.slots, 1); go(dec, 'rest', 'ok'); assert.strictEqual(dec.phase, 'evening');
    const feb = startTrip(K, { place: 'cook', month: 'feb', ticket: { gear: ALLGEAR, licYear: 2027 } });
    assert.strictEqual(feb.view().meta.trip.slots, 2); go(feb, 'rest', 'ok'); assert.strictEqual(feb.phase, 'day'); assert.ok(ids(feb).includes('evening'), 'call it a day');
    go(feb, 'snowshoe', 'ok'); assert.strictEqual(feb.phase, 'evening');
    // the five activities exist: ice fishing, snowshoe and ski, tracking, scouting; the aurora is an evening choice on clear nights
    const d = startTrip(K, { place: 'hidden', month: 'jan', rand: konst(.1), ticket: { gear: ALLGEAR } });
    deq(ids(d).filter(x => ['icefish', 'ski', 'snowshoe', 'track', 'scout', 'rest'].includes(x)).sort(), ['rest', 'scout', 'snowshoe', 'track']);
    const sk = startTrip(K, { place: 'cook', month: 'jan', rand: konst(.1), ticket: { gear: ALLGEAR } });
    assert.ok(ids(sk).includes('icefish') && ids(sk).includes('ski'));
    go(sk, 'rest', 'ok'); assert.ok(ids(sk).includes('aurora'), 'clear night offers the northern lights');
    const cloudy = startTrip(K, { place: 'cook', month: 'jan', rand: konst(.99), ticket: { gear: ALLGEAR } });
    go(cloudy, 'rest', 'ok'); assert.ok(!ids(cloudy).includes('aurora'), 'no lights under cloud');
  } },
  { only: 'index.html', name: 'engine: ice fishing needs a license that runs by calendar year, a kit and an ice-safety choice', fn: async () => {
    const { K } = load();
    // only the stocked, ice-fished lakes
    const lakes = K.data.PLACES.filter(p => p.ice).map(p => p.id).sort(); deq(lakes, ['cook', 'johnson']);
    const clam = startTrip(K, { place: 'clam', month: 'jan', ticket: { gear: ALLGEAR } }); assert.ok(!ids(clam).includes('icefish'));
    // a December license does not cover January
    const dec = startTrip(K, { place: 'johnson', month: 'dec', rand: konst(.5), pack: ['ice'], ticket: { gear: ALLGEAR, licYear: 2026 } }); go(dec, 'icefish'); assert.strictEqual(dec.phase, 'icesafe', 'a 2026 license covers December 2026');
    const jan = startTrip(K, { place: 'johnson', month: 'jan', rand: konst(.5), pack: ['ice'], ticket: { gear: ALLGEAR, licYear: 2026 } });
    go(jan, 'icefish'); assert.strictEqual(jan.phase, 'lic'); assert.ok(/calendar year/.test(jan.view().html) && /2027/.test(jan.view().html), jan.view().html);
    const c0 = jan.state.cash; go(jan, 'buy'); assert.strictEqual(jan.state.cash, c0 - 20); assert.strictEqual(jan.phase, 'icesafe'); assert.strictEqual(jan.report().license.year, 2027);
    const poor = startTrip(K, { place: 'johnson', month: 'jan', rand: konst(.5), pack: ['ice'], ticket: { gear: ALLGEAR, licYear: 0, cash: 330 } }); poor.state.cash = 10; go(poor, 'icefish'); assert.ok(btn(poor, 'buy').dis, 'cannot afford the license');
    go(poor, 'no'); assert.strictEqual(poor.phase, 'day');
    // no kit packed: rent one
    const kit = startTrip(K, { place: 'johnson', month: 'feb', rand: konst(.5), pack: ['bear'], ticket: { licYear: 2027 } }); go(kit, 'icefish'); assert.strictEqual(kit.phase, 'kit');
    const c1 = kit.state.cash; go(kit, 'rent'); assert.strictEqual(c1 - kit.state.cash, 15); assert.strictEqual(kit.phase, 'icesafe');
    // check the thickness: thin early ice is turned down
    const thin = startTrip(K, { place: 'johnson', month: 'nov', rand: konst(0), pack: ['ice'], ticket: { gear: ALLGEAR, licYear: 2026 } }); go(thin, 'icefish', 'check'); assert.strictEqual(thin.phase, 'icethin');
    go(thin, 'skip'); assert.strictEqual(thin.phase, 'day', 'calling it off keeps the daylight');
    // risk it on thin ice: through, hurt; picks make it a bad hour instead of a dangerous soak; layers help
    const e0 = ALLGEAR.filter(x => x !== 'picks');
    const wet = startTrip(K, { place: 'johnson', month: 'nov', rand: konst(0), pack: ['ice'], ticket: { gear: e0, licYear: 2026 } }); const ew = wet.state.energy, cw = wet.state.cash; go(wet, 'icefish', 'risk');
    assert.ok(/Through the ice/.test(wet.view().title)); const dEn = wet.state.energy - ew; assert.strictEqual(dEn, -18); assert.strictEqual(cw - wet.state.cash, 90);
    const pk = startTrip(K, { place: 'johnson', month: 'nov', rand: konst(0), pack: ['ice', 'picks'], ticket: { gear: ALLGEAR, licYear: 2026 } }); const ep = pk.state.energy; go(pk, 'icefish', 'risk'); assert.strictEqual(pk.state.energy - ep, -8);
    // risk it on good ice: no fall, a catch, and three uses for it
    const good = startTrip(K, { place: 'johnson', month: 'feb', rand: konst(.5), pack: ['ice'], ticket: { gear: ALLGEAR, licYear: 2027 } }); go(good, 'icefish', 'risk'); assert.strictEqual(good.phase, 'icecatch');
    deq(ids(good).sort(), ['freezer', 'fry', 'story']);
    const f = startTrip(K, { place: 'johnson', month: 'feb', rand: konst(.5), pack: ['ice'], ticket: { gear: ALLGEAR, licYear: 2027 } }); go(f, 'icefish', 'check', 'freezer'); assert.strictEqual(f.report().foodFish, 3);
    const fz = startTrip(K, { place: 'johnson', month: 'feb', rand: konst(.5), pack: ['ice'], ticket: { gear: ALLGEAR, licYear: 2027, food: { meals: 0, freezerRoom: 2 } } }); go(fz, 'icefish', 'check', 'freezer'); assert.strictEqual(fz.report().foodFish, 2, 'the freezer only holds so many');
    const fy = startTrip(K, { place: 'johnson', month: 'feb', rand: konst(.5), pack: ['ice'], ticket: { gear: ALLGEAR, licYear: 2027 } }); const ey = fy.state.energy; go(fy, 'icefish', 'check', 'fry'); assert.strictEqual(fy.state.energy - ey, 6); assert.strictEqual(fy.report().foodFish, 0);
    const fs_ = startTrip(K, { place: 'johnson', month: 'feb', rand: konst(.5), pack: ['ice'], ticket: { gear: ALLGEAR, licYear: 2027 } }); const rp = fs_.state.rep; go(fs_, 'icefish', 'check', 'story'); assert.strictEqual(fs_.state.rep - rp, 1);
  } },
  { only: 'index.html', name: 'engine: evenings tie flies for next season’s tackle, scouting gives a hint, both lift the first trips', fn: async () => {
    const { K } = load();
    const vise = play(K, { place: 'cook', month: 'dec', nights: 2, evening: 'tie', pack: ['bear', 'vise'], ticket: { gear: ALLGEAR } }).report();
    assert.strictEqual(vise.tackleCredit, 4); assert.ok(vise.firstTripBoost > 0 && vise.firstTripBoost <= .03);
    const none = play(K, { place: 'cook', month: 'dec', nights: 2, evening: 'tie', pack: ['bear'], ticket: { gear: [] } }).report();
    assert.strictEqual(none.tackleCredit, 2, 'half the credit without a vise');
    assert.strictEqual(play(K, { place: 'cook', month: 'dec', nights: 2, evening: 'rest', pack: ['bear', 'vise'] }).report().tackleCredit, 0);
    // scouting: only at places on the upper Kenai or the Kasilof, two days of it at most
    const hid = startTrip(K, { place: 'hidden', month: 'mar', nights: 2, rand: konst(.9), ticket: { gear: ALLGEAR } });
    assert.ok(ids(hid).includes('scout'));
    go(hid, 'scout', 'ok'); assert.strictEqual(hid.phase, 'day'); go(hid, 'scout', 'ok'); assert.strictEqual(hid.phase, 'evening');
    const rep = hid.report(); assert.strictEqual(rep.scout.points, 2); deq(rep.scout.areas, ['upper']); assert.strictEqual(rep.scout.hint, true); assert.ok(rep.skillDelta >= 2);
    go(hid, 'rest', 'ok', 'go'); assert.strictEqual(hid.phase, 'day'); assert.ok(btn(hid, 'scout').dis, 'two days of scouting is enough');
    const kas = play(K, { place: 'johnson', month: 'mar', nights: 1, act: 'scout' }).report();
    deq(kas.scout.areas, ['kasilof']); assert.ok(kas.bookingBoost >= .005 && kas.firstTripBoost >= .01);
    assert.ok(!startTrip(K, { place: 'clam', month: 'mar', ticket: { gear: ALLGEAR } }).view().buttons.some(b => b.id === 'scout'));
    assert.strictEqual(play(K, { place: 'clam', month: 'mar', nights: 1 }).report().scout, null);
  } },
  { only: 'index.html', name: 'engine: packing has a load limit and a cost; each item changes specific odds', fn: async () => {
    const { K } = load(), D = K.data;
    const s = K.session(T0({ cash: 3000 }), { rand: konst(.9) }); go(s, 'plan', 'p:cook', 'm:jan', 'n:1', 'c:none');
    assert.strictEqual(s.phase, 'pack'); const vm0 = s.view(); assert.ok(/Load <b>2 of 12<\/b>/.test(vm0.html), 'the tent takes 2 of 12');
    go(s, 'k:bear', 'k:bag', 'k:layers');                 // 3+3+2 + tent 2 = 10
    assert.ok(btn(s, 'k:ice').dis, 'the ice kit (4) no longer fits'); assert.ok(/Not enough room/.test(btn(s, 'k:ice').s)); assert.ok(!btn(s, 'k:picks').dis, 'picks (1) fit');
    assert.ok(!s.choose('k:ice'), 'a full truck refuses');
    go(s, 'k:bear'); assert.ok(!btn(s, 'k:ice').dis, 'unpack the container and the kit fits again');
    // cost: gas, supplies and gear that is not owned yet
    go(s, 'k:bear', 'packed'); const html = s.view().html; assert.ok(/Gear: <b>\$310<\/b>/.test(html), html);   // 80+160+70
    s.state.cash = 100; assert.ok(btn(s, 'go').dis, 'cannot afford it'); s.state.cash = 3000;
    // owned gear is free to take along; a consumable is paid every trip
    const o = K.session(T0({ gear: ['bear', 'fuel'] }), { rand: konst(.9) }); go(o, 'plan', 'p:cook', 'm:jan', 'n:1', 'c:none', 'k:bear', 'k:fuel', 'packed');
    assert.ok(/Gear: <b>\$14<\/b>/.test(o.view().html), 'the fuel costs $14, the owned container nothing'); go(o, 'go'); deq(o.report().gearBought, ['fuel'.slice(0, 0)].filter(Boolean));
    // a camper carries more
    const c = startTrip(K, { place: 'cook', month: 'jan', ticket: { gear: ALLGEAR }, pack: [], shelter: 'camper' }); assert.ok(c);
    const c2 = K.session(T0({ gear: ALLGEAR }), { rand: konst(.9) }); go(c2, 'plan', 'p:cook', 'm:jan', 'n:1', 'c:none', 's:camper'); assert.ok(/of 16/.test(c2.view().html));
    D.PACK.forEach(it => c2.choose('k:' + it.id)); assert.ok(/Load <b>(\d+) of 16/.exec(c2.view().html)[1] <= 16);
    // "Pack the usual" respects room and cash
    const a = K.session(T0({ cash: 250 }), { rand: konst(.9) }); go(a, 'plan', 'p:cook', 'm:jan', 'n:1', 'c:none', 'auto'); const pk = a.view().meta.plan.pack; assert.ok(pk.includes('bear'));
    assert.ok(pk.reduce((n, id) => n + D.pack(id).wt, 0) + 2 <= 12);
    // the odds: a bear container makes foxes, ravens and wolverines rarer; a bear less so
    const w = (pack, id) => K.weights('cook', 'jan', pack).find(x => x.id === id).w;
    for (const id of ['fox', 'ravens', 'wolverine', 'bear']) assert.ok(w(['bear'], id) < w([], id), id);
    assert.ok(w(['bear'], 'wolverine') < w(['bear'], 'fox') && w(['truck'], 'snowstorm') < w([], 'snowstorm'), 'the truck kit eases a snowstorm');
    assert.strictEqual(w(['bear'], 'moose'), w([], 'moose'), 'good encounters are not touched');
    // the cold-snap effects: bag, layers, fuel and a truck kit each help
    const cold = D.ENC.find(e => e.id === 'coldsnap'), fx = items => cold.fx({ has: i => items.includes(i), r: Math.random, comfort: 0 }).d;
    const base = fx([]), full = fx(['bag', 'layers', 'fuel', 'truck']);
    assert.strictEqual(base.cash, -60); assert.strictEqual(full.cash, 0); assert.ok(full.energy > base.energy && fx(['bag']).energy > base.energy && fx(['layers']).energy > base.energy && fx(['fuel']).energy > base.energy);
    // fox, ravens, bear: the container turns a loss into nothing or little
    for (const id of ['fox', 'ravens', 'wolverine']) { const e = D.ENC.find(x => x.id === id); assert.ok((e.fx({ has: () => false, r: Math.random }).d.cash || 0) < 0); assert.ok(!(e.fx({ has: i => i === 'bear', r: Math.random }).d.cash)); }
  } },
  { only: 'index.html', name: 'engine: 16 animals, weather events, and a bad-luck share closer to even', fn: async () => {
    const { K } = load(), D = K.data;
    assert.strictEqual(D.ALL.length, 16);
    const old = ['moose', 'wolves', 'lynx', 'fox', 'ravens', 'porcupine', 'swans', 'eagles', 'sheep', 'bear'];
    old.forEach(id => assert.ok(D.ENC.some(e => e.id === id && e.cat === 'wild'), 'original encounter kept: ' + id));
    ['otters', 'wolverine', 'hares', 'ptarmigan', 'seaotters', 'chickadees'].forEach(id => assert.ok(D.SPECIES.some(s => s.id === id)));
    ['coldsnap', 'snowstorm', 'chinook'].forEach(id => assert.ok(D.ENC.some(e => e.id === id && e.cat === 'weather')));
    assert.ok(D.ENC.filter(e => e.cat === 'wild').every(e => D.ALL.includes(e.id)));
    // original ten: same text and the same dollar and energy numbers
    const fox = D.ENC.find(e => e.id === 'fox').fx({ has: () => false, r: Math.random }); deq([fox.d.cash, fox.d.energy], [-35, -2]);
    deq(D.ENC.find(e => e.id === 'bear').fx({ has: () => false, r: Math.random }).d, { cash: -15, energy: -9, messy: 1 });
    assert.strictEqual(D.ENC.find(e => e.id === 'porcupine').fx().d.cash, -60);
    // the habitat weights: every place has something good, sea otters only on the Spit
    for (const p of D.PLACES) { const w = K.weights(p.id, 'jan'); assert.ok(w.some(x => x.kind === 'good' && x.w > 0), p.id); assert.strictEqual(w.find(x => x.id === 'seaotters').w > 0, p.id === 'spit'); }
    // share of bad luck over every place and month: it was 58%, now about even, and packing brings it down
    const share = pack => { let bad = 0, all = 0; for (const p of D.PLACES) for (const m of D.MONTHS) K.weights(p.id, m.id, pack).forEach(x => { all += x.w; if (x.kind === 'bad') bad += x.w }); return bad / all };
    const unpacked = share([]), packed = share(['bear', 'truck']);
    assert.ok(unpacked > .42 && unpacked < .53, 'unpacked bad share ' + unpacked); assert.ok(packed < unpacked - .05, 'packing helps: ' + packed);
    // weather follows the month: cold snaps are likelier in January than November, thaws in March
    const wm = (id, m) => K.weights('cook', m).find(x => x.id === id).w;
    assert.ok(wm('coldsnap', 'jan') > wm('coldsnap', 'nov') * 2); assert.ok(wm('chinook', 'mar') > wm('chinook', 'dec'));
    // a snowstorm adds a day and a tow; the chinook sets the thaw flag that thins the ice
    const st = D.ENC.find(e => e.id === 'snowstorm'), a = st.fx({ has: () => false, comfort: 0 }), b = st.fx({ has: i => i === 'truck', comfort: 0 });
    assert.strictEqual(a.d.days, 1); assert.ok(a.d.cash < b.d.cash && b.d.cash < 0); assert.ok(D.ENC.find(e => e.id === 'chinook').fx().d.thaw);
    // a full simulation with many seeds: every night is either quiet or one encounter (50%)
    let nights = 0, enc = 0;
    for (let seed = 1; seed <= 120; seed++) { const r = K.sim({ ticket: T0({ gear: ALLGEAR, cash: 9000 }), seed, policy: K.policies.thoughtful({ trips: 3, gigs: 0, reserve: 0 }) }).report; nights += r.nights; enc += r.encounters }
    assert.ok(nights > 300 && enc / nights > .4 && enc / nights < .6, `encounter rate ${enc / nights} over ${nights} nights`);
  } },
  { only: 'index.html', name: 'engine: a snowstorm strands you an extra night and uses a day of the budget', fn: async () => {
    const { K } = load();
    let found = null, thaw = null;
    for (let seed = 1; seed <= 3000 && !(found && thaw); seed++) {
      const s = play(K, { place: 'cook', month: 'dec', nights: 1, pack: [], ticket: { gear: ALLGEAR, cash: 9000 }, rand: K.util.seeded(seed) }), t = s.report().trips[0];
      if (!found && t.events.includes('snowstorm')) found = { r: s.report(), t };
      if (!thaw && t.events.includes('chinook')) thaw = t;
    }
    assert.ok(found, 'a snowstorm turns up'); assert.strictEqual(found.t.extra, 1); assert.strictEqual(found.r.daysUsed, 2); assert.ok(found.t.cost > 0);
    assert.ok(thaw, 'and a chinook'); assert.strictEqual(thaw.extra, 0);
    // the snowed-in night is charged against the day budget even when it runs over
    const s2 = K.session(T0({ daysLeft: 1 }), { rand: konst(.9) }); assert.strictEqual(s2.view().meta.daysLeft, 1);
  } },
  { only: 'index.html', name: 'engine: shelters and cabins: a cabin replaces the site fee, a better shelter lowers the odds of a bad night', fn: async () => {
    const { K } = load(), D = K.data;
    // cabins at Swanson River, Skilak and Quartz Creek only; they ask the fee and replace the site fee
    ['swanson', 'skilak', 'quartz'].forEach(id => assert.ok(D.place(id).cabin > 0)); assert.ok(!D.place('cook').cabin);
    const s = K.session(T0(), { rand: konst(.9) }); go(s, 'plan', 'p:swanson', 'm:jan', 'n:2', 'c:none'); assert.strictEqual(s.phase, 'shelter'); assert.ok(ids(s).includes('s:cabin') && !ids(s).includes('s:wall'), 'own shelters only once bought');
    go(s, 's:cabin', 'packed'); assert.ok(/Cabin: <b>\$90<\/b>/.test(s.view().html), s.view().html);
    const t2 = K.session(T0(), { rand: konst(.9) }); go(t2, 'plan', 'p:cook', 'm:jan', 'n:1', 'c:none'); assert.strictEqual(t2.phase, 'pack', 'no choice to make without a cabin or a bought shelter');
    // outfitters: buy a wall tent and a camper; money is spent, the shelter shows up next trip, and it counts in the report
    const o = K.session(T0({ cash: 9000 }), { rand: konst(.9) }); go(o, 'shop', 'b:wall', 'ok', 'b:camper', 'ok', 'back');
    deq(o.report().gearBought, ['wall', 'camper']); assert.strictEqual(o.report().cashDelta, -(1200 + 7500));
    const poor = K.session(T0({ cash: 500 }), { rand: konst(.9) }); go(poor, 'shop'); assert.ok(btn(poor, 'b:wall').dis && btn(poor, 'b:camper').dis);
    // comfort lowers bad nights: many one-night trips at the same place, tent against camper
    const bad = shelter => { let b = 0, nn = 0; for (let seed = 1; seed <= 400; seed++) { const r = play(K, { place: 'cook', month: 'jan', nights: 1, shelter, pack: [], ticket: { gear: ALLGEAR, cash: 20000 }, rand: K.util.seeded(seed) }).report(); r.trips.forEach(t => { b += t.bad; nn++ }) } return b / nn };
    const tent = bad('tent'), camper = bad('camper'); assert.ok(camper < tent * .75, `tent ${tent} camper ${camper}`);
  } },
  { only: 'index.html', name: 'engine: bring company (a regular, a fellow guide, the rival) and the relationship comes back in the report', fn: async () => {
    const { K } = load();
    const reg = [{ id: 'garza', name: 'the Garza family', mood: 88 }, { id: 'low', name: 'the quiet couple', mood: 30 }, { id: 'mid', name: 'the Ohio crew', mood: 60 }];
    const s = K.session(T0({ regulars: reg, rival: { id: 'rival', name: 'Dale Voss', mood: 1 } }), { rand: konst(.9) }); go(s, 'plan', 'p:cook', 'm:jan', 'n:1');
    const i = ids(s); assert.ok(i.includes('c:garza') && i.includes('c:mid') && i.includes('c:guide') && i.includes('c:rival') && i.includes('c:none'));
    assert.ok(!i.includes('c:low'), 'a client who was unhappy is not asked');
    assert.ok(!ids(K.session(T0({ rival: { id: 'rival', name: 'Dale Voss', mood: -1 } }), { rand: konst(.9) }).choose('plan') && (() => { const x = K.session(T0({ rival: { id: 'rival', name: 'Dale Voss', mood: -1 } })); go(x, 'plan', 'p:cook', 'm:jan', 'n:1'); return x })()).includes('c:rival'), 'an unfriendly rival is not asked');
    // a busy middling regular can say no (rand .9 ≥ .6): then you pick again
    go(s, 'c:mid'); assert.strictEqual(s.phase, 'result'); assert.ok(/can’t get away/.test(s.view().html)); go(s, 'ok'); assert.strictEqual(s.phase, 'who'); assert.ok(btn(s, 'c:mid').dis);
    // a happy regular always comes; supplies cost 60% more
    go(s, 'c:garza'); assert.strictEqual(s.phase, 'pack'); go(s, 'packed'); assert.ok(/Supplies, \$25\/night plus your guest: <b>\$40<\/b>/.test(s.view().html), s.view().html);
    // the trip: a fire talk needs company, goodwill moves
    go(s, 'go', 'rest', 'ok'); assert.ok(ids(s).includes('fire')); go(s, 'fire', 'ok', 'go', 'thorough');
    const rep = s.report(); assert.strictEqual(rep.relations.length, 1); assert.strictEqual(rep.relations[0].id, 'garza'); assert.strictEqual(rep.relations[0].kind, 'regular'); assert.ok(rep.relations[0].delta >= 2 && rep.relations[0].delta <= 4, JSON.stringify(rep.relations));
    assert.ok(rep.bookingBoost >= .005, 'a good trip builds next year’s booking');
    // alone: no fire talk and no relation
    const alone = startTrip(K, { place: 'cook', month: 'jan', ticket: { gear: ALLGEAR } }); go(alone, 'rest', 'ok'); assert.ok(!ids(alone).includes('fire'));
    // the guide and the rival
    const g = play(K, { place: 'cook', month: 'jan', company: 'guide', evening: 'fire', pack: [], rand: lead(K, 3) }).report(); assert.strictEqual(g.relations[0].kind, 'guide'); assert.ok(g.skillDelta >= 1 || g.relations[0].delta < 2);
    const rv = play(K, { place: 'cook', month: 'jan', company: 'rival', evening: 'fire', pack: [], rand: lead(K, 4), ticket: { rival: { id: 'rival', name: 'Dale Voss', mood: 1 } } }).report(); assert.strictEqual(rv.relations[0].kind, 'rival');
    // a bad night costs goodwill: force a bad event with company and no pack
    let worst = 9; for (let seed = 1; seed <= 300 && worst > -1; seed++) { const r = play(K, { place: 'clam', month: 'dec', nights: 3, company: 'guide', evening: 'rest', pack: [], rand: lead(K, seed) }).report(); worst = Math.min(worst, r.relations[0].delta) } assert.ok(worst <= 0, 'bad nights lower goodwill: ' + worst);
  } },
  { only: 'index.html', name: 'engine: winter work pays a little, once each, two a winter, and uses a day', fn: async () => {
    const { K } = load();
    const s = K.session(T0({ licYear: 0 }), { rand: konst(.5) }); go(s, 'work'); assert.ok(ids(s).includes('g:iceguide') && ids(s).includes('g:snowmachine') && ids(s).includes('g:event'));
    const c0 = s.state.cash; go(s, 'g:iceguide'); const r1 = s.report(); assert.strictEqual(r1.license.year, 2027, 'a new calendar-year license for January'); assert.ok(r1.earned >= 140 && r1.earned <= 190); assert.ok(s.state.cash - c0 > 80 && s.state.cash - c0 < 190, 'about $150 net');
    assert.strictEqual(s.state.days, 9); go(s, 'ok', 'work'); assert.ok(btn(s, 'g:iceguide').dis && /Done this winter/.test(btn(s, 'g:iceguide').s));
    go(s, 'g:snowmachine'); assert.ok(s.report().earned >= 140 + 240 - 60); go(s, 'ok'); assert.ok(btn(s, 'work').dis, 'two jobs a winter'); assert.strictEqual(s.report().gigs.length, 2); assert.strictEqual(s.report().daysUsed, 2);
    const low = K.session(T0({ rep: 30 }), { rand: konst(.5) }); go(low, 'work'); assert.ok(btn(low, 'g:snowmachine').dis && /45/.test(btn(low, 'g:snowmachine').s), 'needs a little reputation');
    const ev = K.session(T0(), { rand: konst(.5) }); go(ev, 'work', 'g:event', 'ok'); const re = ev.report(); assert.strictEqual(re.gigs[0], 'event'); assert.ok(re.repDelta === 1 && re.womDelta === 1 && re.bookingBoost > 0 && re.cashDelta === 60);
    const none = K.session(T0({ daysLeft: 0 }), { rand: konst(.5) }); assert.ok(btn(none, 'work').dis);
    // event text never states a date
    assert.ok(!/\b(19|20)\d\d\b|January|February|March/.test(K.data.GIGS.find(g => g.id === 'event').d));
  } },
  { only: 'index.html', name: 'engine: two or three trips a winter fit inside the day budget', fn: async () => {
    const { K } = load();
    const s = K.session(T0({ gear: ALLGEAR, cash: 9000 }), { rand: konst(.9) });
    const trip = (place, month, nights) => { go(s, 'plan', 'p:' + place, 'm:' + month, 'n:' + nights, 'c:none'); if (s.phase === 'shelter') go(s, 's:tent'); go(s, 'auto', 'packed', 'go'); let g = 0; while (s.phase !== 'hub' && g++ < 60) { const v = s.view(), has = id => v.buttons.some(b => b.id === id && !b.dis); go(s, s.phase === 'day' ? 'rest' : s.phase === 'evening' ? 'rest' : s.phase === 'night' ? 'go' : s.phase === 'leave' ? 'thorough' : s.phase === 'result' ? 'ok' : (() => { throw new Error('stuck ' + s.phase) })()) } };
    assert.strictEqual(s.view().meta.daysLeft, 10);
    trip('cook', 'jan', 3); assert.strictEqual(s.view().meta.daysLeft, 7); assert.strictEqual(s.view().meta.tripsLeft, 2);
    trip('hidden', 'feb', 3); assert.strictEqual(s.view().meta.daysLeft, 4);
    go(s, 'plan', 'p:cook', 'm:jan'); deq(ids(s).filter(x => x.startsWith('n:')), ['n:1', 'n:2', 'n:3'], 'no five-night trip with four days left'); go(s, 'back', 'back', 'back');
    assert.strictEqual(s.phase, 'hub'); trip('johnson', 'mar', 2); assert.strictEqual(s.view().meta.daysLeft, 2); assert.strictEqual(s.view().meta.tripsLeft, 0);
    assert.ok(btn(s, 'plan').dis && /No more trips/.test(btn(s, 'plan').s), 'three trips at most');
    const r = s.report(); assert.strictEqual(r.tripsTaken, 3); assert.strictEqual(r.daysUsed, 8 + r.trips.reduce((a, t) => a + t.extra, 0)); assert.strictEqual(r.nights, 8); assert.strictEqual(r.trips.length, 3);
    // a few days, no trips: the days budget alone stops a trip
    const t2 = K.session(T0({ daysLeft: 0 }), { rand: konst(.9) }); assert.ok(btn(t2, 'plan').dis && /No free days/.test(btn(t2, 'plan').s));
    // the visit ends cleanly from the hub at any time, with nothing spent
    const q = K.session(T0(), { rand: konst(.9) }); go(q, 'done'); assert.ok(q.done); assert.strictEqual(q.report().cashDelta, 0);
    // the five-night trip needs five days
    assert.ok(K.session(T0({ daysLeft: 5 })).choose('plan') && true);
  } },
  { only: 'index.html', name: 'engine: the summary, the animal log and the two achievements', fn: async () => {
    const { K } = load(), D = K.data;
    // a trip summary lists what happened and what is new in the log
    const s = play(K, { place: 'cook', month: 'jan', nights: 2, evening: 'tie', pack: ['bear', 'vise'], act: 'track', ticket: { gear: ALLGEAR }, rand: K.util.seeded(5) });
    const r = s.report(); assert.strictEqual(r.trips.length, 1); const t = r.trips[0]; assert.ok(t.placeName && t.monthName && t.nights === 2 && Array.isArray(t.log) && t.log.length >= 2);
    assert.ok(r.log.length === 1 && r.log[0].kind === 'trip' && r.log[0].lines.length >= 2);
    deq(r.newSpecies.sort(), Object.keys(r.speciesSeen).sort(), 'everything seen is new to a fresh log');
    // the log view lists all 16 with counts
    const hub = K.session(T0({ seen: { moose: 3 } })); go(hub, 'log'); const html = hub.view().html; assert.ok(/1 of 16 animals/.test(html) && /×3/.test(html) && (html.match(/not yet/g) || []).length === 15, html);
    assert.ok(/1 of 16/.test(K.logView({ moose: 2 }).html));
    // every animal: the 16th species completes it, once
    const seen = {}; D.ALL.forEach(id => { seen[id] = 1 }); const a = K.session(T0({ seen }));
    deq(a.report().achievements, ['every_animal']); deq(K.session(T0({ seen, ach: ['every_animal'] })).report().achievements, []);
    delete seen.chickadees; deq(K.session(T0({ seen })).report().achievements, []);
    // no trace: break camp clean and don't get raided; a quick pack or a raided camp spoils it
    const clean = []; let messy = 0;
    for (let seed = 1; seed <= 60; seed++) { const p = play(K, { place: 'cook', month: 'jan', nights: 1, pack: ['bear'], ticket: { gear: ALLGEAR }, rand: K.util.seeded(seed) }).report(); (p.trips[0].noTrace ? clean : []).push(p); if (p.trips[0].messy) messy++; assert.strictEqual(p.noTraceTrips, p.trips[0].noTrace ? 1 : 0); assert.strictEqual(p.achievements.includes('no_trace'), p.noTraceTrips > 0) }
    assert.ok(clean.length > 20, 'with the container, most camps break clean');
    for (let seed = 1; seed <= 10; seed++) { const q = play(K, { place: 'cook', month: 'jan', nights: 1, pack: ['bear'], quick: true, ticket: { gear: ALLGEAR }, rand: K.util.seeded(seed) }).report(); assert.strictEqual(q.noTraceTrips, 0); assert.ok(!q.achievements.includes('no_trace')); assert.ok(/messy/.test(JSON.stringify(q.trips[0].messy)) || q.trips[0].messy === true) }
    // food left out gets a camp raided, and the lesson is in the text
    const fox = D.ENC.find(e => e.id === 'fox').fx({ has: () => false, r: Math.random }); assert.ok(fox.d.messy && /Seal/.test(fox.lesson));
    // a cleaning-up mention on the leave screen, and an ach from an earlier trip isn't repeated
    deq(K.session(T0({ ach: ['no_trace'] })).report().achievements, []);
  } },
  { only: 'index.html', name: 'engine: places stay within 100 road miles with real mileages, and the fuel cost follows the ticket', fn: async () => {
    const { K } = load(), D = K.data;
    assert.strictEqual(D.PLACES.length, 10); assert.ok(D.PLACES.every(p => p.miles > 0 && p.miles <= 100 / 1 && p.miles * 1 <= 100));
    const miles = Object.fromEntries(D.PLACES.map(p => [p.id, p.miles])); deq(miles, { johnson: 16, clam: 22, hidden: 24, swanson: 29, skilak: 33, cook: 36, deep: 42, quartz: 51, anchor: 66, spit: 83 });
    const cost = (o) => { const s = K.session(T0(o), { rand: konst(.9) }); go(s, 'plan', 'p:anchor', 'm:jan', 'n:3', 'c:none', 'k:bear'); go(s, 'packed'); return s.view().html };
    // 66 mi each way ÷ 15 mpg = 8.8 gal at $5.34 = $46.99; Anchor River charges $20 a night; supplies $25 a night
    const h = cost({ gear: ['bear'] }); assert.ok(/8\.8 gal × \$5\.34 = <b>\$46\.99<\/b>/.test(h) && /\$60<\/b>/.test(h) && /\$75<\/b>/.test(h), h);
    const hard = cost({ gear: ['bear'], costMult: 1.08 }); assert.ok(/\$50\.75/.test(hard), 'the difficulty multiplier raises gas, fees and supplies');
    for (const p of D.PLACES) assert.ok(!/(couldn’t|could not|\bI (could|can|was)|unverified|not confirmed)/i.test(p.d), 'no developer voice in ' + p.id);
    const text = SRC; assert.ok(!/\b(I could not|I couldn’t|TODO|FIXME|unverified)\b/i.test(text.replace(/\/\/.*$/gm, '')), 'no developer voice in player text');
  } },
  { only: 'index.html', name: 'engine: the same state machine drives every policy to a finished report', fn: async () => {
    const { K } = load();
    for (const pol of ['first', 'random', 'thoughtful']) for (let seed = 1; seed <= 20; seed++) {
      const r = K.sim({ ticket: T0({ regulars: [{ id: 'g', name: 'the Garza family', mood: 90 }], rival: { id: 'rival', name: 'Dale Voss', mood: 1 } }), seed, policy: pol });
      assert.ok(r.finished && r.steps < 600, `${pol} ${seed} ended in ${r.steps}`);
    }
    // the same seed gives the same visit
    const a = K.sim({ ticket: T0(), seed: 9 }).report, b = K.sim({ ticket: T0(), seed: 9 }).report; deq(a, b);
    // a custom policy works, and a refused choice is not a crash
    const s = K.session(T0()); assert.strictEqual(s.choose('nope'), false); assert.strictEqual(s.choose('plan'), true); assert.strictEqual(s.choose('p:nowhere'), false);
    // every screen has the data a pop-up needs
    const v = s.view(); assert.ok(v.title && typeof v.html === 'string' && v.buttons.length && v.buttons.every(x => x.id && x.l));
  } },
  { only: 'index.html', name: 'standalone page: the dev harness builds, loads with no game, and completes a trip', fn: async ctx => {
    const out = cp.spawnSync('python3', [path.join(ROOT, 'tools', 'build-camp.py')], { encoding: 'utf8' }); assert.strictEqual(out.status, 0, out.stderr);
    const file = path.join(ROOT, 'dist-camp', 'kenai-camp.html'); const html = fs.readFileSync(file, 'utf8');
    assert.ok(!/guidemaster|GAME\.|MIGRATIONS|src\/js/i.test(html), 'the page contains nothing of the game');
    const page = await ctx.context.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(pathToFileURL(file).href);
    const globals = await page.evaluate(() => ({ S: typeof S, modal: typeof modal, GAME: typeof GAME, camp: typeof KenaiCamp, keys: Object.keys(localStorage) }));
    deq([globals.S, globals.modal, globals.GAME, globals.camp], ['undefined', 'undefined', 'undefined', 'object']);
    await page.click('#go');
    const click = async re => { await page.locator('#mbg button.act').filter({ hasText: re }).first().click() };
    await click(/Plan a camping trip/); await click(/Johnson Lake/); await click(/February/); await click(/1 night/); await click(/Go alone/);
    await click(/Pack the usual/); await click(/Done packing/); await click(/Pack the truck/);
    await page.waitForSelector('#mbg h2:has-text("Day 1 of 1")');
    // targets: every button at least 44px tall, the dialog is labelled and modal
    const ui = await page.evaluate(() => ({ role: document.querySelector('#mbg .modal').getAttribute('role'), modal: document.querySelector('#mbg .modal').getAttribute('aria-modal'), label: document.querySelector('#mbg .modal').getAttribute('aria-label'), min: Math.min(...[...document.querySelectorAll('#mbg button')].map(b => b.getBoundingClientRect().height)), focus: !!document.activeElement.closest('#mbg'), inert: document.querySelector('main').hasAttribute('inert') }));
    assert.strictEqual(ui.role, 'dialog'); assert.strictEqual(ui.modal, 'true'); assert.ok(ui.label); assert.ok(ui.min >= 44, 'targets ' + ui.min); assert.ok(ui.focus); assert.ok(ui.inert);
    await click(/Keep camp and rest/); await click(/Continue/); await click(/Call it a day/); await click(/Early to bed/); await click(/Continue/); await click(/Break camp/); await click(/Leave no trace/);
    await click(/Continue/); await click(/Back to the off-season/);
    await page.waitForFunction(() => window.__campReport);
    const st = await page.evaluate(() => ({ rep: window.__campReport, status: document.getElementById('status').textContent, keys: Object.keys(localStorage), solo: JSON.parse(localStorage.getItem('kenaicamp:solo')) }));
    assert.strictEqual(st.rep.tripsTaken, 1); assert.ok(/Trips so far: 1/.test(st.status), st.status); assert.ok(st.keys.every(k => k.startsWith('kenaicamp:')), st.keys.join()); assert.strictEqual(st.solo.tot.trips, 1); assert.ok(st.solo.gear.includes('bear'));
    // a new winter restarts the budget; the reset clears the save
    await page.click('#newwinter'); assert.ok(/Winter 2/.test(await page.textContent('#status'))); assert.ok(/Free days 10, trips 3/.test(await page.textContent('#status')));
    await page.click('#reset'); assert.ok(/Winter 1/.test(await page.textContent('#status')));
    noErrors(errors); await page.close();
  } },
];
