const { open, newGame, noErrors, assert } = require('./helpers');

// 1.8.0: skilled choices pay and sloppy play costs. Spots answer to the day's conditions, the rest of the summer follows how happy the
// clients were, tips climb with a good day, regulars can be asked back, skill builds and rusts.
const SETUP = `
  window.mk = (type, n) => { const b = { id: 999, d: 1, type, n: n || (type === 'halibut' ? 4 : 3), who: 'test party', from: 'Ohio', res: false, quirk: [], status: 'booked' };
    const t = { id: 999, late: 0, q: 0, happy: 0, notes: [], step: 0, steps: [], shore: false, nofish: 0, kept: 0, abort: false, x: [], lost: 0, boat0: 100 };
    return { b, t }; };
  window.fixRand = v => { Math.random = () => v; };
`;

module.exports = [
  { name: 'spots: every legal spot has a read, the reads differ day to day, and the best spot beats always taking the first', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 4 });
    await newGame(page);
    const r = await page.evaluate(() => {
      setPref('years', 10); const out = { missing: [], gain: {}, bestShare: {}, words: new Set() };
      for (const type of ['reds', 'silver', 'trout', 'halibut']) {
        SPOTS[type].forEach((sp, i) => { const f = spotFit(type, i, 1, true); if (!sp.viol && !f) out.missing.push(type + i); if (sp.viol && f) out.missing.push('viol ' + type + i); });
        let gain = 0, n = 0; const wins = SPOTS[type].map(() => 0);
        for (let s = 0; s < 10; s++) { S.reg = genRegs(s); for (let k = 0; k < 14; k++) {
          const d = s * 14 + k; S.wx[d] = pick(['sun', 'sun', 'cloud', 'cloud', 'rain', 'wind']); rollWeather(d); rollRun(d);
          const legal = SPOTS[type].map((x, i) => i).filter(i => !SPOTS[type][i].viol);
          const val = i => SPOTS[type][i].q + spotFit(type, i, d, true).f * SPOT_Q + (SPOTS[type][i].h || 0) * .012;
          let bi = legal[0]; legal.forEach(i => { if (val(i) > val(bi)) bi = i; });
          gain += val(bi) - val(legal[0]); wins[bi]++; n++; legal.forEach(i => out.words.add(spotWord(spotFit(type, i, d, false).f)));
        } }
        out.gain[type] = gain / n; out.bestShare[type] = wins.map(w => w / n);
      }
      out.words = [...out.words]; return out;
    });
    assert.deepStrictEqual(r.missing, []);
    for (const t of Object.keys(r.gain)) assert.ok(r.gain[t] >= .03, `${t}: the best spot should beat the first by at least .03 of catch on average (${r.gain[t].toFixed(3)})`);
    assert.ok(r.bestShare.reds[0] < .75 && r.bestShare.silver[0] < .75, 'the default spot is not always best: ' + JSON.stringify(r.bestShare));
    assert.ok(['Hot', 'Good', 'Fair', 'Poor'].every(w => r.words.includes(w)), 'all four words appear: ' + r.words);
    noErrors(errors);
  } },
  { name: 'spots: the buttons carry a read only after the Fish tab or a scouting run, and the pick moves the catch', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 6 });
    await newGame(page);
    const r = await page.evaluate(SETUP + `(() => {
      const out = {}; S.cur = 3; S.t = 3 * 1440 + 330; S.book = []; const { b, t } = mk('reds', 3); b.d = 3; S.book.push(b); S.trip = t; t.steps = ['spot'];
      S.look = -1; S.scout = -1; closeModals(); tripNext();
      out.blind = [...document.querySelectorAll('#mbg button.act')].map(x => x.textContent); out.blindNote = document.querySelector('#mbg').textContent;
      S.look = day(); closeModals(); tripNext();
      out.tab = [...document.querySelectorAll('#mbg button.act')].map(x => x.textContent); out.tabNote = document.querySelector('#mbg').textContent;
      S.look = -1; S.scout = day(); closeModals(); tripNext();
      out.exact = [...document.querySelectorAll('#mbg button.act')].map(x => x.textContent); out.exactNote = document.querySelector('#mbg').textContent;
      closeModals();
      // the pick moves the catch: a Hot spot and a Poor spot differ by the fit times SPOT_Q
      const v = STEP.spot(b, t), d = day(), fits = SPOTS.reds.map((sp, i) => spotFit('reds', i, d, true));
      const legal = [0, 1, 3], hi = legal.reduce((a, i) => fits[i].f > fits[a].f ? i : a, 0), lo = legal.reduce((a, i) => fits[i].f < fits[a].f ? i : a, 0);
      const qa = mk('reds').t, qb = mk('reds').t; fixRand(.99);
      v.o[hi].fn(b, qa); v.o[lo].fn(b, qb);
      out.expect = (SPOTS.reds[hi].q + fits[hi].f * SPOT_Q) - (SPOTS.reds[lo].q + fits[lo].f * SPOT_Q); out.got = qa.q - qb.q; out.spread = fits[hi].f - fits[lo].f;
      return out;
    })()`);
    assert.ok(!r.blind.some(x => /🐟|🔭/.test(x)), 'no read before you look: ' + r.blind.join(' | '));
    assert.ok(/Fish tab or scout/.test(r.blindNote));
    assert.ok(r.tab.filter(x => /🐟 (Hot|Good|Fair|Poor)/.test(x)).length === 3, 'three reads from the Fish tab: ' + r.tab.join(' | '));
    assert.ok(/From the Fish tab/.test(r.tabNote));
    assert.ok(r.exact.filter(x => /🔭 (Hot|Good|Fair|Poor)/.test(x)).length === 3, 'three exact reads after scouting: ' + r.exact.join(' | '));
    assert.ok(/You scouted/.test(r.exactNote));
    assert.ok(Math.abs(r.got - r.expect) < 1e-9, `catch moves by the fit: ${r.got} vs ${r.expect}`);
    assert.ok(r.spread > .2, 'a real spread between the best and the worst spot today: ' + r.spread);
    noErrors(errors);
  } },
  { name: 'Fish tab: “Where to fish today” lists the spots for today’s trips and counts as looking', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 8 });
    await newGame(page);
    const r = await page.evaluate(() => {
      S.cur = 1; S.t = 1440 + 400; S.look = -1; tab = 'fish'; render(); const html = document.querySelector('.content').textContent;
      const o = { html, look: S.look, d: day(), types: spotsToday(day()) }; tab = 'act'; render(); return o;
    });
    assert.match(r.html, /Where to fish today/); assert.strictEqual(r.look, r.d, 'opening the tab marks today as read');
    assert.ok(/Big Eddy/.test(r.html) && /(Hot|Good|Fair|Poor)/.test(r.html));
    noErrors(errors);
  } },
  { name: 'scouting: an upper-river outing scouts the upper river only, and old saves without the new fields still work', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 3 });
    await newGame(page);
    const r = await page.evaluate(() => {
      S.cur = 2; S.t = 2 * 1440 + 500; S.loc = 'cooper'; S.book = []; S.scout = -1; S.scoutAt = {}; S.up.drift = true;
      boatFish('trout', 2, false);
      const o = { lower: S.scout, upper: S.scoutAt.cooper, d: day(), forTrout: scoutedFor('trout', day()), forReds: scoutedFor('reds', day()) };
      delete S.scoutAt; delete S.look; o.noCrash = scoutedFor('trout', day()) === false && spotHint('reds', day()) === null; return o;
    });
    assert.strictEqual(r.lower, -1, 'the lower river is not scouted from Cooper Landing'); assert.strictEqual(r.upper, r.d);
    assert.ok(r.forTrout && !r.forReds); assert.ok(r.noCrash, 'works without S.scoutAt / S.look');
    noErrors(errors);
  } },
  { name: 'rest of the summer follows how the July went: happy seasons earn more, sour ones less, same trips', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 2 });
    await newGame(page);
    const r = await page.evaluate(() => {
      S.rep = 80; S.regs = []; S.up.rate = 1; const base = { trips: 17, fares: 17 * 1100, tips: 17 * 130, wom: 0, year: 2026 };
      const f = hap => restOfSeason(Object.assign({}, base, { hap })).net;
      return { avg: f(HAP0), good: f(HAP0 + 10), great: f(HAP0 + 25), bad: f(HAP0 - 10), awful: f(HAP0 - 40), none: restOfSeason(Object.assign({}, base, { hap: undefined })).net, q: [qualityF({ hap: 0 }), qualityF({ hap: 200 })], noTips: restOfSeason({ trips: 17, fares: 17 * 1100, wom: 0, year: 2026, hap: HAP0 }).net };
    });
    assert.ok(r.good > r.avg * 1.05 && r.great > r.good, 'better days earn more: ' + JSON.stringify(r));
    assert.ok(r.bad < r.avg * .95 && r.awful < r.bad, 'sour days earn less');
    assert.strictEqual(r.none, r.avg, 'an old save with no quality record is treated as an average season');
    assert.ok(r.q[0] === .7 && r.q[1] === 1.25, 'bounded: ' + r.q);
    assert.ok(r.noTips < r.avg, 'tips count in the off-season trade');
    noErrors(errors);
  } },
  { name: 'season quality: trips record client happiness, a no-show counts as a bad day, difficulty mood is taken out', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 11 });
    await newGame(page);
    const r = await page.evaluate(SETUP + `(() => {
      const o = {}; S.cur = 1; S.t = 1440 + 400; S.loc = 'lower'; S.fuel = 30; S.up.rate = 1;
      const run = (diff, bump) => { S.diff = diff; S.book = []; const { b, t } = mk('reds', 3); b.d = 1; S.book.push(b); S.trip = t; t.happy = bump; t.steps = []; t.q = .2; fixRand(.5); const n0 = S.stats.hapN || 0, s0 = S.stats.hapSum || 0; tripEnd(b, t); closeModals(); return { dn: S.stats.hapN - n0, dh: S.stats.hapSum - s0, out: b.out.happy }; };
      o.normal = run('normal', 10); o.hard = run('hard', 10);
      const n0 = S.stats.hapN, s0 = S.stats.hapSum; S.book = []; const { b } = mk('reds'); b.d = day(); b.id = 77; S.book.push(b); onNight('home', [], day()); o.noshow = { dn: S.stats.hapN - n0, dh: S.stats.hapSum - s0, status: b.status };
      S.diff = 'normal'; o.hardMood = DIFFS.hard.mood; return o;
    })()`);
    assert.strictEqual(r.normal.dn, 1); assert.ok(Math.abs(r.normal.dh - r.normal.out) <= 1, 'quality is the day’s happiness');
    assert.ok(Math.abs(r.hard.dh - (r.hard.out - r.hardMood)) <= 1, 'Combat Season’s client mood is taken out: ' + JSON.stringify(r));
    assert.ok(r.hardMood < 0, 'Combat Season clients are pickier');
    assert.deepStrictEqual(r.noshow, { dn: 1, dh: 20, status: 'noshow' });
    noErrors(errors);
  } },
  { name: 'tips climb with a good day: 0 to 30% of the fare, about 14% at 74 happiness and the full 30% at 90+', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 12 });
    await newGame(page);
    const r = await page.evaluate(SETUP + `(() => {
      S.cur = 1; S.t = 1440 + 400; S.loc = 'lower'; S.fuel = 30; S.up.rate = 1; S.diff = 'normal'; const out = [];
      for (const h of [-40, 0, 14, 40]) { S.fuel = 30; S.gear = 3; S.energy = 90; S.hungry = 0; S.cur = 1; S.book = []; const { b, t } = mk('reds', 4); b.d = 1; S.book.push(b); S.trip = t; t.steps = []; t.q = .3; t.happy = h; fixRand(.5); S.boat = 100; tripEnd(b, t); closeModals(); out.push([b.out.happy, b.out.tip / b.out.fare]); }
      return out.sort((a, b) => a[0] - b[0]);
    })()`);
    for (let i = 1; i < r.length; i++) assert.ok(r[i][1] >= r[i - 1][1], 'tips never fall as the day gets better: ' + JSON.stringify(r));
    assert.ok(r[0][1] === 0 && r[3][1] === .3, 'from nothing to the 30% cap: ' + JSON.stringify(r));
    noErrors(errors);
  } },
  { name: 'boat condition: a well-kept boat pleases clients up to +4, a worn one costs up to −3', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 13 });
    await newGame(page);
    const r = await page.evaluate(() => {
      const out = {}; S.cur = 1; S.t = 1440 + 340; S.loc = 'lower'; S.fuel = 30; S.up.rate = 1; S.food.pan = 60; S.hungry = 0;
      for (const boat of [100, 85, 65, 44, 20]) { Math.random = () => .99; closeModals(); S.book = []; S.trip = null; S.boat = boat; S.gear = 3; const b = { id: 5, d: 1, type: 'reds', n: 3, who: 'x', from: 'y', res: false, quirk: [], status: 'booked' }; S.book.push(b); tripStart(b); out[boat] = S.trip && S.trip.happy; closeModals(); S.trip = null; }
      return out;
    });
    assert.strictEqual(r[100], 4); assert.ok(r[85] >= 2 && r[85] <= 3); assert.strictEqual(r[65], 0); assert.ok(r[44] <= -2 && r[20] === -3, JSON.stringify(r));
    noErrors(errors);
  } },
  { name: 'regulars: a happy party that did not ask can be handed your card at the dock', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 14 });
    await newGame(page);
    const r = await page.evaluate(SETUP + `(() => {
      const o = {}; S.cur = 1; S.t = 1440 + 400; S.loc = 'lower'; S.fuel = 30; S.regs = []; S.up.rate = 1; S.diff = 'normal';
      S.book = []; const { b, t } = mk('reds', 3); b.d = 1; S.book.push(b); S.trip = t; t.steps = []; t.q = .4; t.happy = 20; Math.random = () => .9;
      tripEnd(b, t); o.card = b.card; o.happy = b.out.happy; o.btns = MB.map(x => x.l); o.regsBefore = S.regs.length; const t0 = S.t;
      const i = MB.findIndex(x => /card/.test(x.l)); Math.random = () => .01; MBTN(i); o.regsAfter = S.regs.length; o.mins = S.t - t0; o.cardAfter = b.card; closeModals();
      // an unhappy party gets no offer
      S.book = []; const x = mk('reds', 3); x.b.d = 1; x.b.id = 1000; S.book.push(x.b); S.trip = x.t; x.t.steps = []; x.t.q = -.3; x.t.happy = -30; Math.random = () => .9; tripEnd(x.b, x.t); o.sad = !!x.b.card; closeModals();
      return o;
    })()`);
    assert.ok(r.happy >= 75 && r.card === true, 'a happy party that did not offer a number: ' + JSON.stringify(r));
    assert.ok(r.btns.length === 2 && /Head in/.test(r.btns[0]) && /card/.test(r.btns[1]));
    assert.strictEqual(r.regsBefore, 0); assert.strictEqual(r.regsAfter, 1, 'they say yes'); assert.strictEqual(r.mins, 10); assert.strictEqual(r.cardAfter, false);
    assert.strictEqual(r.sad, false);
    noErrors(errors);
  } },
  { name: 'skill: builds with practice, is worth up to .16 of catch, rusts 40% each winter, and the winter course is worth more', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 15 });
    await newGame(page);
    const r = await page.evaluate(() => {
      const o = { start: S.skill }; S.skill = 0; o.q0 = skillQ(); S.skill = 20; o.q20 = skillQ(); S.skill = 500; o.qmax = skillQ(); S.skill = -5; o.qneg = skillQ();
      S.skill = 50; S.cur = 14; S.winter = null; startSeason(1); o.after = S.skill; closeModals(); S.winter = null;
      S.skill = 10; S.up.course = -1; S.money = 5000; buyUp(UPGRADES.find(u => u.id === 'course')); o.course = S.skill;
      return o;
    });
    assert.strictEqual(r.q0, 0); assert.ok(Math.abs(r.q20 - .08) < 1e-9); assert.strictEqual(r.qmax, .16); assert.strictEqual(r.qneg, 0);
    assert.strictEqual(r.after, 30, 'rust keeps 60%'); assert.strictEqual(r.course, 24, 'course +14');
    assert.ok(r.start >= 10, 'a new guide starts with some feel for the river: ' + r.start);
    noErrors(errors);
  } },
  { name: 'rates: the first step costs 8% of bookings and each further step more', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 16 });
    await newGame(page);
    const r = await page.evaluate(() => [0, 1, 2, 3].map(n => { S.up.rate = 1 + n / 10; return rateDemand(); }));
    [1, .92, .815, .685].forEach((v, i) => assert.ok(Math.abs(r[i] - v) < 1e-6, `step ${i}: ${r[i]} vs ${v}`));
    noErrors(errors);
  } },
  { name: 'a bot that reads the Fish tab and picks the best spot out-scores one that always takes the first (same seeds)', only: 'index.html', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 17 });
    await newGame(page);
    const r = await page.evaluate(() => {
      // 60 trips each: the same weather and run on both sides, many random trips averaged
      const mean = pick2 => { let sum = 0, n = 0; for (let k = 0; k < 200; k++) { const d = 14 * (k % 5) + (k % 14); if (!S.wxd[d]) { S.wx[d] = ['sun', 'cloud', 'rain', 'wind'][k % 4]; rollWeather(d); rollRun(d); }
        for (const type of ['reds', 'silver', 'trout', 'halibut']) { const legal = SPOTS[type].map((x, i) => i).filter(i => !SPOTS[type][i].viol); const i = pick2(type, d, legal); sum += SPOTS[type][i].q + spotFit(type, i, d, true).f * SPOT_Q; n++; } } return sum / n; };
      S.reg = genRegs(0);
      const first = mean((t, d, l) => l[0]);
      const best = mean((t, d, l) => l.reduce((a, i) => (SPOTS[t][i].q + spotFit(t, i, d, false).f * SPOT_Q + (SPOTS[t][i].h || 0) * .012) > (SPOTS[t][a].q + spotFit(t, a, d, false).f * SPOT_Q + (SPOTS[t][a].h || 0) * .012) ? i : a, l[0]));
      return { first, best };
    });
    assert.ok(r.best > r.first + .02, `reading the conditions beats the default: ${r.best.toFixed(3)} vs ${r.first.toFixed(3)}`);
    noErrors(errors);
  } },
];
