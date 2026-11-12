// Version 1.12.0: fewer pop-ups. The morning report, requests that wait in the Bookings tab, a trip on one sheet, and the pop-up cap.
const path = require('path');
const { open, newGame, noErrors, assert } = require('./helpers');
const LIB = path.resolve(__dirname, '..', 'tools', 'sim', 'sim-lib.js');

// a game on a trip morning: day 1 (Tuesday), at the launch, with one sockeye booking, plenty of fuel and food
const install = () => { window.tripSetup = () => {
  closeModals(); clearTiles(); S.cur = 1; S.t = 1440 + 345; S.loc = 'lower'; S.fuel = 30; S.energy = 80; S.book = [];
  S.ate = { d: -1, n: 0 }; S.food = { pan: 24, fri: 6, fd: 1, fm: 0, kits: 4 }; S.dil = null;
  const b = addBooking({ d: 1, type: 'reds', n: 3, who: 'test party', from: 'Ohio', res: false, quirk: [] });
  return b;
};
// counts the sheets that are really put on screen
window.watch = () => { window.__sheets = []; const add = ms => { for (const m of ms) for (const n of m.addedNodes) if (n.id === 'mbg') window.__sheets.push(n.querySelector('h2').textContent) };
    window.__obs = new MutationObserver(add); window.__obs.observe(document.body, { childList: true }); window.sheets = () => { add(window.__obs.takeRecords()); return window.__sheets } };
};

module.exports = [
  // ---- 1. the morning report ----
  { name: 'morning report: the night summary, overnight lines and morning events are ONE pop-up, and their toasts are dropped', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 5 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      closeModals(); clearTiles(); S.cur = 2; S.t = 2 * 1440 + 1300; S.loc = 'shop'; S.book = []; S.calls = {};
      addBooking({ d: 4, type: 'reds', n: 3, who: 'x', from: 'X', quirk: [] });
      defEvent({ id: 'test_morning', hook: 'wake', tile: ['🦆', 'Ducks on the dock', 'info'], chance: 0, run: () => say('🦆 A raft of mergansers lines the dock.') });
      forceEvent('test_morning'); forceEvent('call_request'); S.dipnetAsk = 99;
      endDay('home');
      const out = { title: document.querySelector('#mbg h2').textContent, queued: MQ.length, body: document.querySelector('#mbg .mb').textContent, tiles: document.querySelectorAll('#tiles .tile').length + tileQ.length, btns: MB.map(b => b.l), sheets: document.querySelectorAll('#mbg').length };
      return out;
    });
    assert.match(r.title, /Morning report/); assert.strictEqual(r.queued, 0, 'nothing waits behind the report'); assert.strictEqual(r.sheets, 1);
    assert.ok(/Wednesday night/i.test(r.body) && /Boat payment/.test(r.body), 'the night summary is in it');
    assert.ok(/Ducks on the dock/.test(r.body) && /mergansers/.test(r.body), 'a morning event is in it');
    assert.strictEqual(r.tiles, 0, 'no toast repeats what the report says');
    assert.match(r.btns[0], /Wake up/);
    noErrors(errors);
  } },
  { name: 'morning report: decisions that cannot wait (a hungry morning) still follow it as their own pop-up', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 6 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      closeModals(); S.cur = 3; S.t = 3 * 1440 + 1300; S.loc = 'shop'; S.book = []; S.hungry = 2; S.food = { pan: 0, fri: 0, fd: 1, fm: 0, kits: 0 };
      forceEvent('hungry_morning'); endDay('home');
      const first = document.querySelector('#mbg h2').textContent, q = MQ.map(x => x[0].replace(/<[^>]+>/g, ''));
      return { first, q };
    });
    assert.match(r.first, /Morning report/); assert.ok(r.q.some(t => /Running on empty/.test(t)), 'the decision is queued behind the report: ' + r.q.join('|'));
    noErrors(errors);
  } },

  // ---- 2. requests wait in the Bookings tab ----
  { name: 'requests: a morning request waits in the Bookings tab with a dot, is named in the report, and Accept books it', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 7 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      closeModals(); clearTiles(); S.cur = 2; S.t = 2 * 1440 + 1300; S.loc = 'shop'; S.book = []; S.reqs = [];
      const orig = window.makeRequest; window.makeRequest = () => ({ kind: 'trip', d: 6, type: 'reds', n: 3, who: 'Garza cousins', from: 'Texas', res: false, quirk: [] });
      forceEvent('call_request'); endDay('home'); window.makeRequest = orig;
      const out = { title: document.querySelector('#mbg h2').textContent, body: document.querySelector('#mbg .mb').textContent, btns: MB.map(b => b.l), modals: document.querySelectorAll('#mbg').length, reqs: S.reqs.length, book0: S.book.length };
      MBTN(1);   // "Review requests in Bookings"
      out.tab = tab; out.dot = !!document.querySelector('nav.tabs button.on .dot'); out.view = document.querySelector('.content').textContent;
      out.acceptBtn = [...document.querySelectorAll('.content .req button.act')].map(b => b.textContent);
      document.querySelector('.content .req button.act').click();
      out.after = { reqs: S.reqs.length, book: S.book.length, dot: !!document.querySelector('nav.tabs .dot') && [...document.querySelectorAll('nav.tabs button')].some(b => /Bookings/.test(b.textContent) && b.querySelector('.dot')) };
      return out;
    });
    assert.match(r.title, /Morning report/); assert.ok(/1 booking request/.test(r.body) && /Garza cousins/.test(r.body)); assert.strictEqual(r.reqs, 1); assert.strictEqual(r.book0, 0);
    assert.ok(r.btns.some(b => /Review requests/.test(b)));
    assert.strictEqual(r.tab, 'book'); assert.ok(r.dot, 'the Bookings tab has a dot'); assert.ok(/Garza cousins/.test(r.view));
    assert.ok(r.acceptBtn.some(b => /Book it/.test(b)) && r.acceptBtn.some(b => /Decline/.test(b)), 'Accept and Decline are right there: ' + r.acceptBtn.join('|'));
    assert.deepStrictEqual([r.after.reqs, r.after.book], [0, 1]); assert.strictEqual(r.after.dot, false, 'the dot goes when nothing waits');
    noErrors(errors);
  } },
  { name: 'requests: while you are out, a request for later queues with ONE small toast and no pop-up; one for tomorrow is answered on the spot', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 8 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      closeModals(); clearTiles(); S.cur = 3; S.t = 3 * 1440 + 600; S.loc = 'shop'; S.book = []; S.reqs = []; S.calls = {};
      const later = { kind: 'trip', d: 7, type: 'reds', n: 3, who: 'later party', from: 'X', res: false, quirk: [] }, soon = { kind: 'trip', d: 4, type: 'reds', n: 3, who: 'soon party', from: 'X', res: false, quirk: [] };
      requestArrives(later);
      const a = { modal: !!document.getElementById('mbg'), reqs: S.reqs.length, tiles: document.querySelectorAll('#tiles .tile').length + tileQ.length };
      requestArrives(soon);
      const b = { modal: !!document.getElementById('mbg'), title: document.querySelector('#mbg h2') && document.querySelector('#mbg h2').textContent, reqs: S.reqs.length };
      closeModals(); return { a, b };
    });
    assert.deepStrictEqual(r.a, { modal: false, reqs: 1, tiles: 1 }); assert.strictEqual(r.b.modal, true); assert.match(r.b.title, /Booking request/); assert.strictEqual(r.b.reqs, 1, 'the one for tomorrow did not queue');
    noErrors(errors);
  } },
  { name: 'requests: they lapse after a couple of days, and the morning report says so', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 9 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      closeModals(); S.cur = 2; S.t = 2 * 1440 + 1300; S.loc = 'shop'; S.book = []; S.reqs = [];
      queueRequest({ kind: 'trip', d: 9, type: 'reds', n: 3, who: 'slow party', from: 'X', res: false, quirk: [] }, true);
      const mine = () => S.reqs.filter(q => q.r.who === 'slow party').length, exp = S.reqs[0].exp, out = { exp, today: day() };
      endDay('home'); closeModals(); out.d3 = mine();   // day 3: still waiting
      S.t = S.cur * 1440 + 1300; endDay('home'); out.d4 = mine(); out.d4body = document.querySelector('#mbg .mb').textContent; closeModals();
      S.t = S.cur * 1440 + 1300; endDay('home'); out.d5 = mine(); out.d5body = document.querySelector('#mbg .mb').textContent;
      return out;
    });
    assert.strictEqual(r.exp, r.today + 2); assert.strictEqual(r.d3, 1); assert.strictEqual(r.d4, 1, 'still there on the 2nd morning');
    assert.strictEqual(r.d5, 0, 'gone on the 3rd'); assert.ok(/slow party/.test(r.d5body) && /booked somebody else/.test(r.d5body), 'the report says it lapsed');
    noErrors(errors);
  } },
  { name: 'requests: all three kinds (trip, king, dipnet) can be answered from the Bookings tab; the pop-up form still works', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 10 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      closeModals(); S.cur = 2; S.t = 2 * 1440 + 600; S.book = []; S.reqs = [];
      const out = {};
      for (const [k, r] of Object.entries({ trip: { kind: 'trip', d: 6, type: 'reds', n: 3 }, king: { kind: 'king', d: 7, type: 'reds', n: 3 }, dip: { kind: 'dipnet', d: 8, n: 3 } })) {
        Object.assign(r, { who: k + ' party', from: 'X', res: false, quirk: [] });
        const v = requestOpts(r); out[k] = v.opts.length; queueRequest(r, true);
      }
      out.shown = (reqView().match(/class="req"/g) || []).length;
      const id = S.reqs[1].id; reqAns(id, 0); out.afterKing = [S.reqs.length, S.book.length];
      requestModal({ kind: 'trip', d: 6, type: 'reds', n: 3, who: 'p', from: 'x', res: false, quirk: [] }); out.modal = !!document.getElementById('mbg'); closeModals();
      return out;
    });
    assert.ok(r.trip >= 2 && r.king >= 2 && r.dip === 2); assert.strictEqual(r.shown, 3); assert.deepStrictEqual(r.afterKing, [2, 1]); assert.ok(r.modal);
    noErrors(errors);
  } },

  // ---- 3. a trip on one sheet ----
  { name: 'trips: a whole trip is one sheet: the cooler rides with the spot, each dilemma and the result swap in place', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 11 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      const b = tripSetup(); watch(); tripStart(b);
      const out = { first: document.querySelector('#mbg h2').textContent, pack: document.querySelectorAll('#mbg .packopt').length, radio: document.querySelectorAll('#mbg [role=group]').length, titles: [], legalFlags: [], steps: 0 };
      out.packFirstOn = document.querySelector('#mbg .packopt').classList.contains('on');
      const m0 = foodMeals(); let g = 0;
      while (document.getElementById('mbg') && g++ < 12) {
        const t = document.querySelector('#mbg h2').textContent; out.titles.push(t);
        if (/Back at the dock/.test(t)) { out.resultBtns = MB.map(x => x.l); break }
        out.legalFlags.push(MB.every(x => x.legal === true || x.legal === false));
        MBTN(legalBtn());
      }
      out.sheets = sheets().slice(); out.status = b.status; out.eat = m0 - foodMeals();
      closeModals(); return out;
    });
    assert.match(r.first, /Where to, Captain/); assert.ok(r.pack >= 2 && r.radio === 1, 'the cooler choices ride in the spot sheet'); assert.ok(r.packFirstOn);
    assert.ok(r.titles.length >= 4, 'spot + two dilemmas + result: ' + r.titles.join('|')); assert.match(r.titles[r.titles.length - 1], /Back at the dock/);
    assert.strictEqual(r.sheets.length, 1, 'ONE sheet on screen for the whole trip: ' + r.sheets.join('|'));
    assert.ok(r.legalFlags.every(Boolean), 'every decision keeps its legal flags'); assert.match(r.resultBtns[0], /Head in/);
    noErrors(errors);
  } },
  { name: 'trips: the cooler pick in the spot sheet still does what it did (own lunch eats a meal, skipping costs energy, kits feed the clients)', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 12 });
    await newGame(page); await page.evaluate(install);
    const run = (pick) => page.evaluate(pick => {
      const b = tripSetup(); tripStart(b); const labels = tripPack().o.map(o => o.l), m0 = foodMeals(), kits0 = S.food.kits, e0 = S.energy;
      const i = tripPack().o.findIndex(o => pick.test(o.l)); packSel(i);
      const sel = [...document.querySelectorAll('#mbg .packopt')].map(e => e.getAttribute('aria-pressed'));
      MBTN(legalBtn());
      const out = { labels, meals: m0 - foodMeals(), kits: kits0 - S.food.kits, energy: S.energy - e0, sel, happy: S.trip.happy }; closeModals(); return out;
    }, pick);
    const own = await run(/Pack your own lunch/), skip = await run(/Skip food/), kit = await run(/lunch kit/);
    assert.strictEqual(own.meals, 1); assert.strictEqual(skip.meals, 0); assert.ok(skip.energy < own.energy, 'skipping costs energy');
    assert.strictEqual(kit.kits, 3, 'a kit per client'); assert.ok(kit.happy > own.happy);
    assert.strictEqual(kit.sel.filter(x => x === 'true').length, 1, 'one cooler choice pressed at a time');
    assert.strictEqual(own.labels[0], 'Pack your own lunch');
    noErrors(errors);
  } },
  { name: 'trips: a decision that breaks a rule is still flagged and still shuffled (legalBtn finds the legal one on a sheet that swaps in place)', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 13 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      const b = tripSetup(); b.quirk = ['drinker']; S.dil = null; tripStart(b);
      let g = 0; const seen = [];
      while (document.getElementById('mbg') && g++ < 12) {
        const t = document.querySelector('#mbg h2').textContent;
        if (/Back at the dock/.test(t)) break;
        const legal = MB.filter(x => x.legal === true).length, illegal = MB.filter(x => x.legal === false).length;
        seen.push({ t, legal, illegal, att: [...document.querySelectorAll('#mbg button.act')].map(e => e.dataset.legal) });
        MBTN(legalBtn());
      }
      closeModals(); return { seen, status: b.status, cites: S.cites };
    });
    assert.ok(r.seen.some(s => s.illegal > 0 && s.legal > 0), 'a dilemma offered a legal and an illegal option'); assert.strictEqual(r.cites, 0, 'always picking the legal one never cites');
    assert.ok(r.seen.filter(s => s.illegal > 0).every(s => s.att.every(a => a === 'true' || a === 'false')), 'data-legal on the buttons');
    noErrors(errors);
  } },
  { name: 'trips: Esc on the trip sheet puts it away, and the trip picks up where it was from "Back to your trip"', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 14 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      const b = tripSetup(); tripStart(b); MBTN(legalBtn()); const step = S.trip.step; const t1 = document.querySelector('#mbg h2').textContent;
      escModal(); const gone = !document.getElementById('mbg');
      const act = actionsHere().find(a => /Back to your trip/.test(a.l)); act.fn();
      const t2 = document.querySelector('#mbg h2').textContent; closeModals(); return { gone, t1, t2, step, resumed: S.trip.step };
    });
    assert.strictEqual(r.gone, true); assert.strictEqual(r.t1, r.t2); assert.strictEqual(r.step, r.resumed);
    noErrors(errors);
  } },

  // ---- 4. the setting ----
  { name: 'setting: "Show every trip step" is off by default, is in Settings, and when on each step opens its own pop-up (cooler included)', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 15 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      const out = { def: prefs().tripSteps };
      openSettings(); const lab = MB.find(b => /Show every trip step/.test(b.l)); out.label = lab && lab.l; MBTN(MB.findIndex(b => /Show every trip step/.test(b.l)));
      out.on = prefs().tripSteps; closeModals();
      const b = tripSetup(); watch(); tripStart(b); const titles = []; let g = 0;
      while (document.getElementById('mbg') && g++ < 14) { titles.push(document.querySelector('#mbg h2').textContent); MBTN(legalBtn()) }
      out.sheets = sheets().length; out.titles = titles; out.packOpts = 0; return out;
    });
    assert.strictEqual(r.def, false); assert.match(r.label, /Show every trip step: Off/); assert.strictEqual(r.on, true);
    assert.ok(r.titles.some(t => /Pack the cooler/.test(t)) && r.titles.some(t => /Where to, Captain/.test(t)) && r.titles.some(t => /Back at the dock/.test(t)), r.titles.join('|'));
    assert.ok(r.sheets >= 5, 'a sheet per step: ' + r.sheets); assert.strictEqual(r.sheets, r.titles.length);
    noErrors(errors);
  } },

  // ---- 5. the cap ----
  { name: 'pop-up cap: a fresh normal 5-year career plays days 1-7 with at most 4 pop-ups on any day and 25 in all (the old build: about 45)', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 3, quiet: false });
    await page.evaluate(() => { setPref('years', 5); localStorage.setItem(KEY('name'), 'Sam') });
    await page.reload(); await page.waitForSelector('.title');
    await page.evaluate(() => { setPref('years', 5); newGame('normal'); closeModals(); tab = 'act'; render() });
    await page.addScriptTag({ path: LIB }); await page.evaluate(install);
    const r = await page.evaluate(async () => {
      const real = { render: window.render }; simSetup(); window.render = real.render;
      watch(); const days = [];
      for (let d = 0; d < 8; d++) {
        const n0 = sheets().length;
        simInternals.initM({ style: 'food', diff: 'normal', years: 5, seed: 1 }); simInternals.playDay(STYLES.food);
        await new Promise(r => setTimeout(r, 30));
        days.push(sheets().length - n0);
        let g = 0; while (document.getElementById('mbg') && g++ < 50) MBTN(0);
      }
      const wk = days.slice(1);   // days 1-7: what the playtest measures (the bot plays a day, the morning report waits on screen)
      // the rest of the season, then the first off-season through its own buttons
      let k = 0; while (!S.winter && !S.over && k++ < 20) { simInternals.playDay(STYLES.food); await new Promise(r => setTimeout(r, 0)); let q = 0; while (document.getElementById('mbg') && !S.winter && q++ < 40) MBTN(0) }
      await new Promise(r => setTimeout(r, 50));
      const w0 = sheets().length; let guard = 0;
      while (S.winter && guard++ < 30) {
        if (!document.getElementById('mbg')) { winterModal(); continue }
        const i = MB.findIndex(b => /Open bookings/.test(b.l)); MBTN(i >= 0 ? i : 0);
      }
      await new Promise(r => setTimeout(r, 50));
      return { wk, total: wk.reduce((a, b) => a + b, 0), winter: sheets().length - w0, left: !!S.winter };
    });
    assert.ok(r.wk.every(n => n <= 4), 'pop-ups per day ' + r.wk.join('/'));
    assert.ok(r.total <= 25, 'days 1-7 total ' + r.total + ' (' + r.wk.join('/') + ')');
    assert.ok(r.winter <= 6, 'the first off-season: ' + r.winter);
    noErrors(errors);
  } },
];
