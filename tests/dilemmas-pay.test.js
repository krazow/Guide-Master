const { open, newGame, noErrors, assert } = require('./helpers');

// Helpers evaluated in the page. mk(type) makes a booking and a trip record for calling STEP functions directly.
const SETUP = `
  window.mk = type => { const b = { id: 999, d: 1, type, n: type === 'halibut' ? 4 : 3, who: 'test party', from: 'Ohio', res: false, quirk: [], status: 'booked' };
    const t = { id: 999, late: 0, q: 0, happy: 0, notes: [], step: 0, steps: [], shore: false, nofish: 0, kept: 0, abort: false, x: [], lost: 0 };
    return { b, t }; };
  window.seedRand = a => { Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
`;
const KEYS = ['issue_sunmon', 'issue_overload', 'five', 'license', 'expired', 'spot', 'beer', 'king', 'snag', 'over', 'guide_fish', 'extra_rod', 'bait', 'sixpm', 'motor', 'anchor', 'combat', 'photo', 'bear', 'flyonly', 'chop', 'tuewed', 'size27', 'crew', 'fuel'];

module.exports = [
  { name: 'dilemma options are shuffled and none is styled as the primary button', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 5 });
    await newGame(page);
    const r = await page.evaluate(SETUP + `(() => {
      const orders = new Set(); let primaries = 0, unflagged = 0, nbtn = 0;
      for (let i = 0; i < 30; i++) {
        closeModals(); S.book = []; const { b, t } = mk('reds'); b.id = S.nextId++; t.id = b.id; S.book.push(b); S.trip = t; t.steps = ['bait']; b.type = 'silver';
        tripNext();
        const bs = [...document.querySelectorAll('#mbg button.act')];
        orders.add(bs.map(x => x.textContent).join('|'));
        primaries += bs.filter(x => x.classList.contains('primary')).length;
        unflagged += bs.filter(x => x.dataset.legal !== 'true' && x.dataset.legal !== 'false').length; nbtn += bs.length;
      }
      closeModals(); return { orders: orders.size, primaries, unflagged, nbtn };
    })()`);
    assert.ok(r.orders >= 3, 'order varies: ' + r.orders);
    assert.strictEqual(r.primaries, 0, 'no primary button on dilemmas');
    assert.strictEqual(r.unflagged, 0, 'every dilemma button carries data-legal');
    assert.ok(r.nbtn >= 90);
    noErrors(errors);
  } },
  { name: 'every dilemma has a legal option, flags match behavior, and illegal ones can pay cash', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 9 });
    await newGame(page);
    const r = await page.evaluate(SETUP + `((KEYS) => {
      const out = { missing: [], noLegal: [], noIll: [], mismatch: [], cash: [], legalCost: [] };
      const oldV = window.violate; let called = 0; window.violate = () => { called++; return false; };
      for (const k of KEYS) {
        const type = ['tuewed', 'size27', 'crew'].includes(k) ? 'halibut' : (k === 'bait' || k === 'sixpm' ? 'silver' : (k === 'flyonly' || k === 'photo' || k === 'bear' ? 'trout' : 'reds'));
        if (!STEP[k]) { out.missing.push(k); continue; }
        const { b } = mk(type); S.fuel = 3; const v = STEP[k](b, mk(type).t);
        if (!v.o.some(o => o.legal === true)) out.noLegal.push(k);
        v.o.forEach((o, i) => {
          closeModals(); const bb = mk(type), kk = k === 'issue_overload' || k === 'issue_sunmon' || k === 'expired' ? 0 : 1;
          S.book = [bb.b]; S.trip = bb.t; S.cur = 1; S.t = 1440 + 400; S.money = 3000; called = 0;
          try { o.fn(bb.b, bb.t); } catch (e) { out.mismatch.push(k + ' threw ' + e); return; }
          if ((called > 0) !== (o.legal === false)) out.mismatch.push(k + '#' + i + ' legal=' + o.legal + ' violate calls=' + called);
          const sum = (bb.t.x || []).reduce((a, [, v2]) => a + v2, 0);
          if (o.legal === false && sum > 0) out.cash.push(k);
          if (o.legal === false && !(k === 'issue_sunmon' || k === 'expired' || k === 'chop') && sum <= 0) out.noIll.push(k + '#' + i);
          if (o.legal === true && (sum < 0 || (bb.t.lost || 0) > 0 || bb.t.happy < 0 || bb.t.q < 0)) out.legalCost.push(k);
        });
      }
      window.violate = oldV; S.trip = null; closeModals(); return out;
    })(${JSON.stringify(KEYS)})`);
    assert.deepStrictEqual(r.missing, []); assert.deepStrictEqual(r.noLegal, []); assert.deepStrictEqual(r.mismatch, []);
    assert.deepStrictEqual(r.noIll, [], 'every rule-breaking option pays cash, except the ones whose reward is the fare (closed day, expired card) or 20 minutes saved (carcasses)');
    assert.ok(r.cash.length >= 15, 'illegal options pay cash: ' + r.cash.length);
    assert.ok(r.legalCost.length >= 15, 'legal options cost time, fish, mood or cash: ' + r.legalCost.length);
    noErrors(errors);
  } },
  { name: 'breaking a rule and not getting caught pays more than playing it straight', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 3 });
    await newGame(page);
    const r = await page.evaluate(SETUP + `(() => {
      const run = lift => {
        closeModals(); newGame('normal'); closeModals(); window.violate = () => false; seedRand(77);
        S.cur = 1; S.t = 1440 + 345; S.loc = 'lower'; S.fuel = 30; S.gear = 3; S.boat = 90; S.book = [];
        const b = { id: S.nextId++, d: 1, type: 'reds', n: 3, who: 'test party', from: 'Ohio', res: false, quirk: [], status: 'booked' }; S.book.push(b);
        S.cred.fa = 999; tripStart(b); closeModals(); S.trip.steps = ['king']; S.trip.step = 0; const m0 = S.money; tripNext();
        MBTN(MB.findIndex(x => /Lift it for one quick photo/.test(x.l) === lift && x.legal === !lift) );
        let i = 0; while (S.trip && i++ < 20) MBTN(legalBtn()); const net = b.out.net; closeModals(); return net;
      };
      const cheat = run(true), clean = run(false); return { cheat, clean };
    })()`);
    assert.ok(r.cheat - r.clean >= 90, JSON.stringify(r));
    noErrors(errors);
  } },
  { name: 'repeat citations escalate fines on every difficulty', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const r = await page.evaluate(() => {
      const fineAt = (k, prior) => { newGame(k); closeModals(); S.cites = prior; S.money = 5000; const m = S.money; cite('x', 400, false, []); return m - S.money; };
      const out = {};
      for (const k of ['easy', 'normal', 'hard']) out[k] = [0, 1, 2].map(n => fineAt(k, n)).concat([DIFFS[k].esc]);
      return out;
    });
    for (const k of ['easy', 'normal', 'hard']) { const [a, b, c, esc] = r[k]; assert.ok(esc > 0, k + ' esc'); assert.ok(b > a && c > b, k + ' fines climb: ' + r[k]); }
    assert.ok(r.hard[3] > r.normal[3] && r.normal[3] > r.easy[3], 'harder difficulty escalates faster');
    noErrors(errors);
  } },
  { name: 'a warning is per season, not per career', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await page.evaluate(() => setPref('years', 5)); await newGame(page);
    const r = await page.evaluate(() => {
      closeModals(); S.money = 5000;
      cite('a', 100, true, []); const w1 = S.warns, c1 = S.cites;
      cite('b', 100, true, []); const w2 = S.warns, c2 = S.cites;              // second minor offence in the same season: a real citation
      S.winter = null; startSeason(1); closeModals(); const w3 = S.warns;
      cite('c', 100, true, []); const w4 = S.warns, c4 = S.cites;
      return { w1, c1, w2, c2, w3, w4, c4, total: S.stats.warnsTotal };
    });
    assert.deepStrictEqual([r.w1, r.c1, r.w2, r.c2], [1, 0, 1, 1]);
    assert.strictEqual(r.w3, 0, 'warnings reset in the new season');
    assert.strictEqual(r.w4, 1); assert.strictEqual(r.c4, 1, 'the new season earns a new warning instead of a second citation');
    assert.strictEqual(r.total, 2);
    noErrors(errors);
  } },
  { name: 'pay follows the day: a full limit with happy clients beats a skunked, tackle-less, worn-boat trip', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 4 });
    await newGame(page);
    const r = await page.evaluate(SETUP + `(() => {
      const run = good => {
        closeModals(); newGame('normal'); closeModals(); seedRand(31); window.violate = () => false;
        window.runFactor = () => good ? .15 : -.15;
        S.cur = 1; S.t = 1440 + 345; S.loc = 'lower'; S.fuel = 30; S.rep = 60; S.cred.fa = 999; S.book = [];
        S.gear = good ? 3 : 0; S.boat = good ? 95 : 8; S.prep = good ? 1 : -1; S.energy = good ? 90 : 25;
        const b = { id: S.nextId++, d: 1, type: 'reds', n: 3, who: 'test party', from: 'Ohio', res: false, quirk: [], status: 'booked' }; S.book.push(b);
        tripStart(b); closeModals(); const t = S.trip; t.steps = ['spot']; t.step = 0; if (good) t.happy += 10; else { t.q -= .4; t.happy -= 8; }
        tripNext(); let i = 0; while (S.trip && i++ < 20) MBTN(legalBtn());
        const html = document.querySelector('#mbg') && document.querySelector('#mbg').textContent; closeModals();
        return { out: b.out, fare: payOf(b), html };
      };
      return { good: run(true), bad: run(false) };
    })()`);
    const g = r.good.out, b = r.bad.out;
    assert.ok(g.net > b.net + 150, `net ${g.net} vs ${b.net}`);
    assert.ok(g.tip > b.tip && b.refund > 0 && g.refund === 0, JSON.stringify([g, b]));
    assert.ok(g.fish > b.fish, 'more fish on the good day');
    assert.ok(/Booked fare/.test(r.good.html) && /Tip/.test(r.good.html) && /Net:/.test(r.good.html), 'summary shows the pay breakdown');
    assert.ok(/Refund/.test(r.bad.html), 'summary shows the refund');
    noErrors(errors);
  } },
  { name: 'word of mouth: great days raise next-season bookings, bad days cut them', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => {
      const p = { trips: 15, fares: 15000 };
      return [restOfSeason({ ...p, wom: 10 }).trips, restOfSeason({ ...p, wom: 0 }).trips, restOfSeason({ ...p, wom: -10 }).trips];
    });
    assert.ok(r[0] > r[1] && r[1] > r[2], JSON.stringify(r));
    noErrors(errors);
  } },
];
