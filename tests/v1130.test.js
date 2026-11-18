// Version 1.13.0: a day on the water (beats and moves), clients with goals (traits, goal scoring, reviews),
// judgment-call dilemmas and party-dependent costs, legal flags, and the schema-5 migration.
const { open, newGame, noErrors, assert } = require('./helpers');

// a game on a trip morning: day 1 (Tuesday), at the launch, plenty of fuel, food and a current first-aid card
const install = () => {
  window.seedRand = a => { Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  window.at = (type, tr, n) => {
    closeModals(); clearTiles(); S.cur = 1; S.t = 1440 + TRIPS[type].start - 15; S.loc = TRIPS[type].loc; S.fuel = 60; S.hfuel = 200; S.energy = 85; S.boat = 90; S.gear = 3;
    S.cred.fa = 999; S.book = []; S.trip = null; S.dil = null; S.ate = { d: -1, n: 0 }; S.food = { pan: 24, fri: 6, fd: 1, fm: 0, kits: 6 }; S.up.chp = true;
    return addBooking({ d: 1, type, n: n || 3, who: 'test party', from: 'Ohio', res: false, quirk: [], tr });
  };
  window.title = () => document.querySelector('#mbg h2').textContent;
  window.body = () => document.querySelector('#mbg .mb').textContent;
  // play the current trip: f(key, view) returns the option index (in the view's own order) or null for the first legal button
  window.play = f => { let g = 0; while (S.trip && document.getElementById('mbg') && g++ < 40) { const key = S.trip.steps[S.trip.step]; const k = f ? f(key, window.TRIPV) : null; const j = k == null ? legalBtn() : MB.findIndex(x => x.k === k); MBTN(j < 0 ? legalBtn() : j); } };
};

module.exports = [
  // ---- 1. a playable day ----
  { name: 'beats: a sockeye trip is launch + two calls inside ONE sheet, with the conditions and 3-4 legal moves at each call', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 11 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      seedRand(3); const b = at('reds', ['meat']);
      let sheets = 0; const add = ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.id === 'mbg') sheets++ })); const obs = new MutationObserver(add); obs.observe(document.body, { childList: true });
      tripStart(b); const steps = S.trip.steps.slice(), out = { steps, beats: [] };
      let g = 0;
      while (S.trip && g++ < 30) {
        const key = S.trip.steps[S.trip.step];
        if (key === 'beat') out.beats.push({ title: title(), body: body(), opts: MB.map(o => ({ l: o.l, legal: o.legal })), conds: document.querySelectorAll('#mbg .conds li').length, tall: [...document.querySelectorAll('#mbg button.act')].every(e => e.getBoundingClientRect().height >= 44) });
        MBTN(legalBtn());
      }
      add(obs.takeRecords()); obs.disconnect(); out.sheets = sheets; out.done = title(); out.segs = b.out && S.reviews.length; out.notes = body();
      return out;
    });
    const beats = r.steps.filter(k => k === 'beat').length, dil = r.steps.filter(k => !['pack', 'spot', 'beat'].includes(k));
    assert.strictEqual(beats, 2, r.steps.join(',')); assert.ok(dil.length <= 2, 'at most two dilemmas: ' + dil.join(','));
    assert.ok(r.steps.indexOf('spot') < r.steps.indexOf('beat'), 'the launch (spot) comes first');
    assert.strictEqual(r.sheets, 1, 'the whole day is one sheet');
    assert.strictEqual(r.beats.length, 2);
    r.beats.forEach(x => {
      assert.ok(x.opts.length >= 3 && x.opts.length <= 4, JSON.stringify(x.opts)); assert.ok(x.opts.every(o => o.legal === true));
      assert.ok(x.conds >= 5, 'conditions listed: ' + x.body);
      assert.ok(/Tide/.test(x.body) && /Sonar/.test(x.body) && /wind/.test(x.body) && /6 AM to 6 PM/.test(x.body) && /So far/.test(x.body), x.body);
      assert.ok(/(red|reds) (in the box|this stretch)|Nothing in the box/.test(x.body), 'fish landed before the call: ' + x.body);
      assert.ok(x.tall, '44px targets');
    });
    assert.match(r.beats[0].title, /first drift/); assert.match(r.beats[1].title, /midday/);
    assert.ok(r.beats[1].opts.some(o => /Call it a day/.test(o.l)), 'the last call can end the day early');
    assert.match(r.done, /Back at the dock/);
    noErrors(errors);
  } },
  { name: 'beats: halibut runs out, slack tide, the turn and the run home; trout floats the upper, middle and lower river', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 12 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      const names = type => { seedRand(5); const b = at(type, ['photo']); tripStart(b); const t = []; let g = 0; while (S.trip && g++ < 30) { if (S.trip.steps[S.trip.step] === 'beat' || S.trip.steps[S.trip.step] === 'pack') t.push(title()); MBTN(legalBtn()) } closeModals(); return t };
      return { hal: names('halibut'), trout: names('trout'), names: BEATS };
    });
    assert.deepStrictEqual(r.names.halibut.nm, ['The run out', 'Slack tide', 'The turn', 'The run home']);
    assert.deepStrictEqual(r.names.trout.nm, ['The upper river', 'The middle river', 'The lower river']);
    assert.ok(r.hal.some(x => /Slack tide/.test(x)) && r.hal.some(x => /The turn/.test(x)), r.hal.join('|'));
    assert.ok(r.trout.some(x => /middle river/.test(x)) && r.trout.some(x => /lower river/.test(x)), r.trout.join('|'));
    noErrors(errors);
  } },
  { name: 'moves: switching costs minutes, a run costs time and fuel, lunch is once, calling it early skips the rest and gets you home sooner', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 13 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      const out = {};
      seedRand(9); const b = at('reds', ['kids']); tripStart(b); const t = S.trip; t.steps = ['pack', 'spot', 'beat', 'beat']; t.step = 0; closeModals(); tripNext();
      MBTN(MB.findIndex(x => x.k === 0));                     // launch at Big Eddy
      out.k0 = t.bt.spot; const v1 = TRIPV;
      out.opts1 = v1.o.map(o => o.l);
      const run = v1.o.findIndex(o => /^Run to/.test(o.l)), lunch = v1.o.findIndex(o => /lunch/.test(o.l));
      out.hasRun = run >= 0; out.hasLunch = lunch >= 0; out.fuel0 = t.fuelx || 0;
      MBTN(MB.findIndex(x => x.k === run)); out.spot1 = t.bt.spot; out.mv1 = t.bt.mv[1]; out.fuel1 = t.fuelx;
      out.landed1 = [t.bt.segs[0] && t.bt.segs[0].spot, t.bt.segs[1] && t.bt.segs[1].spot];
      const v2 = TRIPV; out.opts2 = v2.o.map(o => o.l); out.lunch2 = v2.o.some(o => /lunch/.test(o.l));
      const early = v2.o.findIndex(o => /Call it a day/.test(o.l)); const t0 = S.t;
      MBTN(MB.findIndex(x => x.k === early)); out.passed = S.t - t0; out.landed = b.out && b.out.fish != null; out.early = t.bt.early; out.segs = t.bt.segs.filter(Boolean).length;
      // switching tactics
      seedRand(9); const b2 = at('trout', ['fly']); tripStart(b2); const t2 = S.trip; t2.steps = ['pack', 'spot', 'beat', 'beat']; t2.step = 0; closeModals(); tripNext();
      MBTN(MB.findIndex(x => x.k === 1)); out.tac0 = t2.bt.tac; const sw = TRIPV.o.findIndex(o => /beads/i.test(o.l));
      MBTN(MB.findIndex(x => x.k === sw)); out.tac1 = t2.bt.tac; out.mvT = t2.bt.mv[1];
      out.trMoves = TRIPV.o.filter(o => /Drift on down/.test(o.l)).map(o => o.l);
      closeModals(); S.trip = null;
      return out;
    });
    assert.ok(r.hasRun && r.hasLunch, r.opts1.join('|'));
    assert.notStrictEqual(r.spot1, r.k0, 'moved'); assert.ok(r.mv1 >= 10, 'time off the water ' + r.mv1); assert.ok(r.fuel1 > r.fuel0, 'and fuel');
    assert.deepStrictEqual(r.landed1, [r.k0, r.spot1], 'the first stretch landed where you launched, the second where you moved');
    assert.ok(r.early === 2 && r.segs === 2, 'called early after two stretches: ' + JSON.stringify(r));
    assert.ok(r.passed < 360, 'home sooner than a full day: ' + r.passed);
    assert.strictEqual(r.tac0, 'streamers'); assert.strictEqual(r.tac1, 'beads'); assert.strictEqual(r.mvT, 10);
    assert.ok(r.trMoves.every(l => !/Russian River/.test(l)), 'a drift boat only goes downstream: ' + r.trMoves.join('|'));
    noErrors(errors);
  } },
  { name: 'moves: reading the conditions beats a fixed plan (same days, same parties)', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 14 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      const res = { fixed: [], read: [] };
      for (const mode of ['fixed', 'read']) for (let i = 0; i < 24; i++) {
        seedRand(100 + i); const type = ['reds', 'silver', 'trout', 'halibut'][i % 4]; S.cur = 1 + (i % 6); const b = at(type, null); b.d = S.cur; S.t = S.cur * 1440 + TRIPS[type].start - 15;
        tripStart(b); const t = S.trip; t.steps = t.steps.filter(k => ['pack', 'spot', 'beat'].includes(k));
        closeModals(); tripNext();
        play((key, v) => { if (mode === 'fixed' || !v || !v.o.some(o => o.v != null)) return key === 'beat' ? 0 : null; let bi = 0; v.o.forEach((o, k) => { if (!o.dis && o.legal !== false && o.v > v.o[bi].v) bi = k }); return bi; });
        res[mode].push(b.out.happy + b.out.fish * 0); closeModals();
      }
      const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
      return { fixed: avg(res.fixed), read: avg(res.read) };
    });
    assert.ok(r.read > r.fixed + 2, `reading the water pays: ${r.read.toFixed(1)} vs ${r.fixed.toFixed(1)}`);
    noErrors(errors);
  } },

  // ---- 2. clients with goals ----
  { name: 'traits: every booking gets 1-2 that fit its trip; requests and the launch show them; regulars keep theirs', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 15 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      const out = { bad: [] };
      S.book.forEach(b => { if (!b.tr || b.tr.length < 1 || b.tr.length > 2 || b.tr.some(k => !TRAITS[k].types.includes(b.type))) out.bad.push(b.who + ':' + b.tr) });
      for (let i = 0; i < 200; i++) { const type = ['reds', 'silver', 'trout', 'halibut'][i % 4], tr = traitsFor({ type, who: pick(PARTIES).who, quirk: [] }); if (tr.length < 1 || tr.length > 2 || tr.some(k => !traitOK(k, type))) out.bad.push(type + ':' + tr) }
      out.seasickOnRiver = traitsFor({ type: 'reds', who: 'x', quirk: [] }).includes('seasick');
      const rq = { kind: 'trip', d: 4, type: 'trout', n: 2, who: 'Tokyo fly-fishing club', from: 'Japan', res: false, quirk: [], tr: ['fly', 'photo'] };
      out.req = requestOpts(rq).body;
      const b = at('reds', ['kids', 'photo']); tripStart(b); out.launch = body(); closeModals(); S.trip = null;
      out.partyLine = partyLine(b);
      S.regs = []; addReg(b, 90, 0, false); out.regTr = S.regs[0].tr;
      const base = seasonFirst(1); regsRebook(base, () => .01); const back = S.book.find(x => x.reg); out.backTr = back && back.tr;
      return out;
    });
    assert.deepStrictEqual(r.bad, []); assert.strictEqual(r.seasickOnRiver, false);
    assert.ok(/What they want/.test(r.req) && /Fly purists/.test(r.req) && /Photographers/.test(r.req), r.req);
    assert.ok(/Kids aboard/.test(r.launch) && /Photographers/.test(r.launch), 'traits at the launch: ' + r.launch);
    assert.ok(/🧒/.test(r.partyLine), r.partyLine);
    assert.deepStrictEqual(r.regTr, ['kids', 'photo']); assert.deepStrictEqual(r.backTr, ['kids', 'photo'], 'regulars keep their traits');
    noErrors(errors);
  } },
  { name: 'goals: happiness follows what the party came for, not only the fish count', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 16 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      const mk = (type, tr, segs, extra) => { const b = { type, tr, n: 3 }; const t = Object.assign({ steps: [], g: {}, bt: { K: segs.length, segs, lunch: -1, early: false, k: segs.length - 1 } }, extra || {}); return { b, t } };
      const seg = (o) => Object.assign({ spot: 0, tac: 'flip', q: .7, w: .33, n: 3, big: 0, rough: 0, shot: 0 }, o);
      const c = (frac, limits, fish) => ({ frac, limits, fishers: 3, fish, big: false });
      const g = (x, cc) => goalOf(x.b, x.t, cc).h;
      const out = {};
      // kids: an early lunch and action vs a slow day with no lunch
      const kGood = mk('reds', ['kids'], [seg({ n: 4 }), seg({ n: 4, tac: 'bank' }), seg({ n: 3 })]); kGood.t.bt.lunch = 1;
      const kBad = mk('reds', ['kids'], [seg({ n: 0 }), seg({ n: 1 }), seg({ n: 0 })]);
      out.kids = [g(kGood, c(.6, 0, 11)), g(kBad, c(.1, 0, 1))];
      // meat: a full cooler vs a light one
      out.meat = [g(mk('reds', ['meat'], [seg({})]), c(1, 3, 9)), g(mk('reds', ['meat'], [seg({})]), c(.3, 0, 3))];
      // trophy: one big fish beats a pile of small ones
      out.trophy = [g(mk('halibut', ['trophy'], [seg({ big: 1, n: 1 })]), Object.assign(c(.3, 0, 2), { big: true })), g(mk('halibut', ['trophy'], [seg({ n: 6 })]), c(1, 3, 6))];
      // seasick: rough stretches hurt
      out.sick = [g(mk('halibut', ['seasick'], [seg({}), seg({})]), c(.5, 0, 3)), g(mk('halibut', ['seasick'], [seg({ rough: 1 }), seg({ rough: 1 })]), c(.5, 0, 3))];
      // fly purists: streamers vs beads
      out.fly = [g(mk('trout', ['fly'], [seg({ tac: 'streamers' }), seg({ tac: 'streamers' })]), c(.6, 0, 12)), g(mk('trout', ['fly'], [seg({ tac: 'beads' }), seg({ tac: 'beads' })]), c(.6, 0, 12))];
      // photographers: the shot
      out.photo = [g(mk('trout', ['photo'], [seg({ shot: 1, spot: 1 })]), c(.4, 0, 6)), g(mk('trout', ['photo'], [seg({})]), c(.4, 0, 6))];
      // first-timers: easy water and coaching
      const fG = mk('reds', ['first'], [seg({ spot: 3, tac: 'bank' })]); fG.t.g.coach = 1;
      out.first = [g(fG, c(.4, 0, 4)), g(mk('trout', ['first'], [seg({ spot: 2 })]), c(.4, 0, 0))];
      return out;
    });
    for (const [k, [good, bad]] of Object.entries(r)) assert.ok(good > bad + 5, `${k}: ${good} vs ${bad}`);
    noErrors(errors);
  } },
  { name: 'reviews: every finished trip leaves a review in the party’s voice, kept in S.reviews and shown at the dock', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 17 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      const out = { texts: new Set(), recs: [] };
      for (let i = 0; i < 12; i++) { seedRand(40 + i); const b = at(['reds', 'trout', 'halibut'][i % 3], [['meat'], ['kids', 'photo'], ['seasick']][i % 3]); S.wxd[1] = Object.assign({}, wxOf(1), { wind: 5 }); tripStart(b); let g = 0; while (S.trip && g++ < 30) MBTN(legalBtn()); out.dock = document.querySelector('#mbg .review') ? document.querySelector('#mbg .review').textContent : ''; closeModals(); const rv = S.reviews[S.reviews.length - 1]; out.recs.push(rv); out.texts.add(rv.text); out.stars = b.out.stars }
      out.texts = out.texts.size; out.n = S.reviews.length;
      return out;
    });
    assert.strictEqual(r.n, 12);
    r.recs.forEach(x => { assert.deepStrictEqual(Object.keys(x).sort(), ['day', 'stars', 'text', 'type', 'who']); assert.ok(x.stars >= 1 && x.stars <= 5 && Number.isInteger(x.stars)); assert.ok(x.text.length > 15 && !/\{\{|undefined|NaN/.test(x.text), x.text) });
    assert.ok(r.texts >= 9, 'varied: ' + r.texts);
    assert.ok(/★/.test(r.dock) && /— the test party, Ohio/.test(r.dock), r.dock);
    noErrors(errors);
  } },

  // ---- 3. judgment calls ----
  { name: 'judgment calls: the new dilemmas render with 2-3 choices, legal flags on every option, and every option runs', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 18 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      const keys = ['golook', 'hookhand', 'boredkid', 'rival', 'couple', 'exhausted', 'friend', 'scenic', 'fog', 'lostrod'], out = {};
      for (const key of keys) {
        const type = ['golook', 'fog'].includes(key) ? 'halibut' : 'reds';
        out[key] = [];
        const n = STEP[key](at(type, ['kids']), { notes: [], x: [], steps: [], g: {} }).o.length;
        for (let i = 0; i < n; i++) {
          seedRand(i + 1); const b = at(type, ['kids']); tripStart(b); const t = S.trip; t.steps = ['pack', 'spot', key, 'beat']; t.step = 0; closeModals(); tripNext(); MBTN(MB.findIndex(x => x.k === 0));
          out[key].push({ title: title(), opts: MB.map(o => ({ l: o.l, legal: o.legal })), v: TRIPV.o.every(o => typeof o.v === 'number') });
          MBTN(MB.findIndex(x => x.k === i)); let g = 0; while (S.trip && g++ < 20) MBTN(legalBtn()); closeModals();
        }
      }
      return out;
    });
    for (const [k, runs] of Object.entries(r)) {
      const v = runs[0];
      assert.ok(v.opts.length >= 2 && v.opts.length <= 3, k + ': ' + JSON.stringify(v.opts));
      assert.ok(v.opts.every(o => typeof o.legal === 'boolean'), k);
      assert.ok(v.v, k + ' carries value hints for the bots');
    }
    assert.ok(r.fog[0].opts.some(o => o.legal === false), 'the fog run at cruising speed breaks the safe-speed rule');
    noErrors(errors);
  } },
  { name: 'judgment calls: the forecast call depends on the wind and the party; cancel refunds, “stay close” drops the run home', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 19 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      const out = {};
      const go = (wind, tr, pick) => { seedRand(7); const b = at('halibut', tr, 6); S.wxd[1] = Object.assign({}, wxOf(1), { wind }); tripStart(b); const t = S.trip; out.has = t.steps.includes('golook');
        const v = TRIPV; const vals = v.o.map(o => o.v); const k = v.o.findIndex(o => pick.test(o.l)); const m0 = S.money, rep0 = S.rep; MBTN(MB.findIndex(x => x.k === k));
        const res = { vals, status: b.status, money: S.money - m0, rep: S.rep - rep0, beats: S.trip ? S.trip.steps.filter(x => x === 'beat').length : 0, short: S.trip && S.trip.bt.short };
        closeModals(); S.trip = null; return res };
      out.calmSick = go(6, ['seasick'], /whole day/); out.windySick = go(22, ['seasick'], /whole day/);
      out.cancel = go(22, ['seasick'], /Call it off/); out.cancelCalm = go(14, ['meat'], /Call it off/);
      out.close = go(18, ['seasick'], /stay close/);
      return out;
    });
    assert.ok(r.has, 'a windy forecast puts the call on the dock');
    const best = v => v.indexOf(Math.max(...v));
    assert.notStrictEqual(best(r.windySick.vals), 0, 'on a windy day with seasick clients, the whole day is not the best call');
    assert.strictEqual(r.cancel.status, 'cancelled'); assert.strictEqual(r.cancel.money, 0, 'no fare'); assert.ok(r.cancel.rep >= 1, 'the advisory came true: ' + r.cancel.rep);
    assert.ok(r.cancelCalm.rep < 0, 'calling off a fine day costs rep');
    assert.ok(r.close.short && r.close.beats === 2, 'stay close: no run home: ' + JSON.stringify(r.close));
    noErrors(errors);
  } },
  { name: 'party-dependent costs: the legal choice costs less for some parties and more for others', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 20 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      const run = (key, type, tr, pick) => { const b = at(type, tr); const t = { q: 0, happy: 0, notes: [], x: [], lost: 0, steps: [], step: 0, g: {} }; S.trip = t; const v = STEP[key](b, t); const o = v.o.find(o => pick.test(o.l)); window.violate = () => false; o.fn(b, t); S.trip = null; return { h: t.happy, x: t.x.reduce((a, y) => a + y[1], 0), g: t.g, legal: o.legal } };
      return {
        rod: [run('extra_rod', 'silver', ['kids'], /One rod/), run('extra_rod', 'silver', ['meat'], /One rod/)],
        king: [run('king', 'reds', ['photo'], /Release it/), run('king', 'reds', ['trophy'], /Release it/)],
        roe: [run('bait', 'silver', ['fly'], /roe/), run('bait', 'silver', ['meat'], /roe/)],
        lures: [run('bait', 'silver', ['fly'], /single-hook/), run('bait', 'silver', ['meat'], /single-hook/)],
        sixpm: [run('sixpm', 'silver', ['kids'], /6:00 sharp/), run('sixpm', 'silver', ['meat'], /6:00 sharp/)],
        sick: [run('seasick', 'halibut', ['seasick'], /lee/), run('seasick', 'halibut', ['meat'], /lee/)],
      };
    });
    assert.ok(r.rod[0].h > r.rod[1].h, 'kids don’t care about the extra rod: ' + JSON.stringify(r.rod));
    assert.ok(r.king[0].h > r.king[1].h && r.king[1].g.release, 'trophy hunters hate releasing the king');
    assert.ok(r.roe[0].x < r.roe[1].x && r.roe[0].h < r.roe[1].h && r.roe[0].g.bait, 'fly purists scorn bait: the illegal option stops paying');
    assert.strictEqual(r.roe[0].legal, false, 'and it is still marked illegal');
    assert.ok(r.lures[0].h > r.lures[1].h); assert.ok(r.sixpm[0].h > r.sixpm[1].h); assert.ok(r.sick[0].h > r.sick[1].h);
    noErrors(errors);
  } },
  { name: 'legal flags: every option of every dilemma is flagged, and every illegal one still risks enforcement', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 21 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      const out = { unflagged: [], noRisk: [] };
      const skip = new Set(['pack', 'spot', 'beat', 'fuel']);
      for (const key of Object.keys(STEP)) {
        if (skip.has(key) || key.startsWith('issue_') || key === 'arc_garza') continue;
        const type = ['tuewed', 'size27', 'crew', 'whale', 'seasick', 'golook', 'fog'].includes(key) ? 'halibut' : key === 'bait' || key === 'extra_rod' || key === 'sixpm' ? 'silver' : ['bear', 'photo', 'flyonly', 'chop'].includes(key) ? 'trout' : 'reds';
        const b = at(type, ['kids']); S.trip = { q: 0, happy: 0, notes: [], x: [], lost: 0, steps: [], step: 0, g: {}, nofish: 0 };
        let v; try { v = STEP[key](b, S.trip) } catch (e) { continue }
        v.o.forEach((o, i) => {
          if (typeof o.legal !== 'boolean') out.unflagged.push(key + ':' + i);
          if (o.legal === false) { let called = 0; const keep = window.violate; window.violate = () => { called++; return false }; try { o.fn(b, { q: 0, happy: 0, notes: [], x: [], lost: 0, steps: [], step: 0, g: {}, nofish: 0 }) } catch (e) { } window.violate = keep; if (!called) out.noRisk.push(key + ':' + i) }
        });
        S.trip = null;
      }
      return out;
    });
    assert.deepStrictEqual(r.unflagged, []); assert.deepStrictEqual(r.noRisk, []);
    noErrors(errors);
  } },

  // ---- 4. old saves ----
  { name: 'migration: a 1.12 save in the middle of a trip loads, gets traits and reviews, and finishes the old way', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 22 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      const b = at('reds', null); tripStart(b); MBTN(legalBtn());           // launched under 1.13 …
      const d = JSON.parse(JSON.stringify(packSave()));
      // … then make it look like a 1.12 save: schema 4, no traits, no reviews, a trip with no beats
      d.schema = 4; d.app = '1.12.1'; delete d.S.reviews; d.S.book.forEach(x => delete x.tr); d.S.regs = [{ who: 'old regulars', from: 'X', res: false, type: 'reds', n: 3, trips: 2, last: { h: 90, s: 0 } }];
      const tr = d.S.trip; delete tr.bt; delete tr.g; delete tr.nz; tr.steps = ['pack', 'spot', 'snag']; tr.step = 2;
      const m = migrate(d); S = m.S;
      const out = { schema: m.schema, tr: S.book.map(x => x.tr), reg: S.regs[0].tr, reviews: S.reviews.length };
      closeModals(); tripNext(); out.title = title(); let g = 0; while (S.trip && g++ < 10) MBTN(legalBtn());
      out.done = title(); out.out = S.book[0].out; out.rev = S.reviews.length;
      return out;
    });
    assert.ok(r.schema >= 5);
    assert.ok(r.tr.every(x => Array.isArray(x) && x.length >= 1), JSON.stringify(r.tr)); assert.ok(Array.isArray(r.reg) && r.reg.length >= 1);
    assert.strictEqual(r.reviews, 0);
    assert.match(r.title, /Hooked in the back/); assert.match(r.done, /Back at the dock/);
    assert.ok(r.out && r.out.fish >= 0 && r.out.stars >= 1); assert.strictEqual(r.rev, 1);
    noErrors(errors);
  } },
];
