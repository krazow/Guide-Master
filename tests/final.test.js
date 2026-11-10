// Tests for the 1.6.1 "final batch": boat safety net, long-career rep, stale text, end screen, accessibility, fuel.
const { open, newGame, noErrors, assert } = require('./helpers');

// drive the open trip dilemmas with the legal option until the trip is over
const prep = page => page.evaluate(() => { window.RUN = () => { let g = 0; while (document.getElementById('mbg') && g++ < 60) { if (S.trip && S.trip.steps[S.trip.step]) MBTN(legalBtn()); else MBTN(0) } } });

module.exports = [
  // ---- 1. the never-service safety net ----
  { name: 'boat: warnings escalate at 40, 20 and 10 (alert bar, To-do, status tag)', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 3 });
    await newGame(page); await prep(page);
    const r = await page.evaluate(() => {
      const o = {};
      closeModals(); S.cur = 2; S.t = 2880 + 100; S.loc = 'shop'; S.book = []; addBooking({ d: 2, type: 'reds', n: 3, who: 'x', from: 'Y', quirk: [] });
      for (const b of [60, 40, 20, 10, 0]) { S.boat = b; const al = alertBar(); o['a' + b] = al ? al.t : ''; o['t' + b] = todoItems().some(x => /boat|Service the boats/i.test(x.l)); o['u' + b] = (todoItems().find(x => /boats|service/i.test(x.l)) || {}).urgent; o['g' + b] = statusTags().some(t => /🔧 boat/.test(t)) }
      return o;
    });
    assert.ok(!/Boat condition/.test(r.a60) && !r.t60 && !r.g60, 'no warning at 60');
    assert.ok(/Boat condition is down to 40/.test(r.a40) && r.t40 && r.g40, 'tier 1 at 40');
    assert.ok(/rough/.test(r.a20) && r.u20, 'tier 2 at 20');
    assert.ok(/one or two more trips/.test(r.a10), 'tier 3 at 10');
    assert.ok(/out of service/.test(r.a0) && /patch/.test(r.a0) && /loaner/.test(r.a0), 'out of service names the ways out');
    noErrors(errors);
  } },
  { name: 'boat: a tile warns once as a trip wears the boat across a threshold', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 3 });
    await newGame(page); await prep(page);
    const r = await page.evaluate(() => {
      const seen = []; const o = window.showTile; window.showTile = (ic, t, s, k) => { seen.push(t); return o(ic, t, s, k) };
      closeModals(); S.cur = 1; S.t = 1440 + 340; S.loc = 'lower'; S.gear = 3; S.fuel = 30; S.book = [];
      const b = addBooking({ d: 1, type: 'reds', n: 3, who: 'x', from: 'Y', quirk: [] });
      S.boat = 42; const t = { id: b.id, late: 0, boat0: 42, q: 0, happy: 0, notes: [], step: 0, steps: [], shore: false, nofish: 0, kept: 0, abort: false, x: [], lost: 0 };
      S.trip = t; Math.random = () => .9; tripEnd(b, t); closeModals();
      return { seen, boat: S.boat };
    });
    assert.ok(r.boat <= 40 && r.seen.some(s => /Boat condition/.test(s)), JSON.stringify(r));
    noErrors(errors);
  } },
  { name: 'boat: emergency patch only near death, costs money, gets the boat to 25 so the trip can launch', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 3 });
    await newGame(page); await prep(page);
    const r = await page.evaluate(() => {
      closeModals(); S.cur = 1; S.t = 1440 + 340; S.loc = 'lower'; S.gear = 3; S.fuel = 30; S.money = 5000; S.book = [];
      const b = addBooking({ d: 1, type: 'reds', n: 3, who: 'x', from: 'Y', quirk: [] }); const o = {};
      S.boat = 30; o.no30 = !actionsHere().some(a => /Emergency patch/.test(a.l));
      S.boat = 0; o.blocked = !!actionsHere().find(a => a.cat === 'trip').dis;
      const p = actionsHere().find(a => /Emergency patch/.test(a.l)); o.has = !!p;
      const m0 = S.money, t0 = S.t; p.fn(); o.paid = m0 - S.money; o.mins = S.t - t0; o.boat = S.boat;
      o.launch = !actionsHere().find(a => a.cat === 'trip').dis; S.t = 1440 + 360; tripStart(b); o.started = !!S.trip; RUN(); o.done = b.status;
      S.boat = 0; S.loc = 'shop'; o.shop = actionsHere().some(a => /Emergency patch/.test(a.l));
      return o;
    });
    assert.ok(r.no30 && r.has && r.blocked); assert.strictEqual(r.paid, 600); assert.strictEqual(r.mins, 60); assert.strictEqual(r.boat, 25);
    assert.ok(r.launch && r.started && r.done === 'done' && r.shop);
    noErrors(errors);
  } },
  { name: 'boat: a loaner runs today’s trip for a fee, spares your boat, and needs renting again tomorrow', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 3 });
    await newGame(page); await prep(page);
    const r = await page.evaluate(() => {
      closeModals(); S.cur = 1; S.t = 1440 + 340; S.loc = 'lower'; S.gear = 3; S.fuel = 30; S.money = 5000; S.book = [];
      const b = addBooking({ d: 1, type: 'reds', n: 3, who: 'x', from: 'Y', quirk: [] }); const o = {};
      S.boat = 0; const l = actionsHere().find(a => /loaner/i.test(a.l)); o.has = !!l;
      const m0 = S.money; l.fn(); o.paid = m0 - S.money; o.out = noBoat();
      o.svcLocked = (S.loc = 'shop', actionsHere().find(a => /Service the boats/.test(a.l)).dis); S.loc = 'lower';
      S.t = 1440 + 360; tripStart(b); o.started = !!S.trip; RUN(); o.done = b.status; o.boat = S.boat; o.note = /borrowed rig/.test((S.log.map(x => x.s).join(' ')) + JSON.stringify(b.out));
      S.cur = 2; S.t = 2880 + 300; o.nextOut = noBoat(); o.canRentAgain = true;
      return o;
    });
    assert.ok(r.has && r.started && r.done === 'done'); assert.strictEqual(r.paid, 600); assert.ok(!r.out); assert.ok(r.svcLocked);
    assert.strictEqual(r.boat, 0, 'a loaner trip does not wear your boat'); assert.ok(r.nextOut, 'out of service again the next day');
    noErrors(errors);
  } },

  // ---- 2. long careers: nothing at the wake hook may cost a booked trip ----
  { name: 'rep: the Board of Fisheries hearing only comes on a day with no trips (it used to cause a no-show)', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 5 });
    await page.evaluate(() => setPref('years', 10));
    await newGame(page);
    const r = await page.evaluate(() => {
      closeModals(); S.cur = 14 * 3 + 4; S.t = S.cur * 1440 + 300; S.rep = 80; S.arcs.board = { st: 2, s: 1 }; S.arcs.day = -1; S.book = [];
      const ev = EV.find(e => e.id === 'arc_board'), o = {};
      o.free = !!ev.cond();
      addBooking({ d: S.cur, type: 'reds', n: 3, who: 'x', from: 'Y', quirk: [] });
      o.busy = !!ev.cond();
      S.arcs.board = { st: 1, s: 1 }; o.vote = !!ev.cond();   // the committee vote takes no time, so it can still come on a trip day
      return o;
    });
    assert.ok(r.free, 'testimony is possible on a free day'); assert.ok(!r.busy, 'but not on a day with a trip booked'); assert.ok(r.vote);
    noErrors(errors);
  } },

  // ---- 3. stale text ----
  { name: 'text: title, To-do header, camping blurb and upgrade descriptions match the code', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 9 });
    const t = await page.evaluate(() => ({ sub: document.querySelector('.title h1 span').textContent, tag: GAME.tagline, intro: TITLE.intro }));
    assert.ok(!/two weeks guiding/i.test(t.sub) && /career/i.test(t.sub), t.sub);
    await page.evaluate(() => setPref('years', 5));
    await newGame(page);
    const r = await page.evaluate(() => {
      const o = {}; tab = 'todo'; render(); o.todo = document.querySelector('.content .sect').textContent; tab = 'act'; render();
      const U = id => UPGRADES.find(u => u.id === id);
      // sled: 30 minutes sooner, a 40-gallon tank and a 45-minute fuel run
      S.up.sled = true; o.saved = sledTimeSaved('reds'); o.tank = SLED_TANK(); delete S.up.sled; o.savedNo = sledTimeSaved('reds');
      o.sledTxt = U('sled').d;
      // repower: 20% less gas
      S.up.motor = true; o.burn = bn('reds') / BURN.reds; delete S.up.motor; o.motorTxt = U('motor').d;
      // rates: 8% fewer bookings a step
      o.rate = RATE_BOOK; o.ratesTxt = U('rates').d; o.dockTxt = U('dock').d;
      // the camping blurb: encounters never pay cash, so the off-season text mustn't promise any
      S.winter = { s: 0, bill: 0, expired: 0 }; S.seasons = [{ year: 2026, trips: 1, earned: 1, rep: 50 }]; winterModal(); o.camp = MB.find(b => /winter camping/.test(b.l)).s; closeModals(); S.winter = null;
      // the motor dilemma says 30 minutes lost: it must lose them
      const t = { lost: 0, q: 0, happy: 0, notes: [], x: [] }; const v = STEP.motor(S.book[0] || { who: 'x' }); const opt = v.o.find(x => /30 minutes lost/.test(x.s)); opt.fn(null, t); o.lost = t.lost;
      return o;
    });
    assert.strictEqual(r.todo, 'Today'); assert.ok(!/This run/.test(r.todo));
    assert.strictEqual(r.saved, 30); assert.strictEqual(r.savedNo, 0); assert.strictEqual(r.tank, 40); assert.ok(/30 minutes sooner/.test(r.sledTxt) && /40-gallon/.test(r.sledTxt));
    assert.ok(Math.abs(r.burn - .8) < .01 && /20% less gas/.test(r.motorTxt));
    assert.strictEqual(r.rate, .08); assert.ok(/8% fewer/.test(r.ratesTxt)); assert.ok(/8% more bookings/.test(r.dockTxt));
    assert.ok(!/and a little cash/.test(r.camp) && /can cost a little cash/.test(r.camp), r.camp);
    assert.strictEqual(r.lost, 30, 'the “30 minutes lost” option loses 30 minutes');
    noErrors(errors);
  } },

  // ---- 4. end screen, money and the off-season ----
  { name: 'money: one formatter with thousands separators', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => [$(47975), $(-1200), $(950), $(6.19), $(1234567.5), $(0), grp(66000), $k(48250), $k(9850), $k(-120000)]);
    assert.deepStrictEqual(r, ['$47,975', '−$1,200', '$950', '$6.19', '$1,234,567.50', '$0', '66,000', '$48k', '$9,850', '−$120k']);
    const hud = await page.evaluate(() => { S.money = 47975; render(); return document.querySelector('.stats').textContent });
    assert.ok(/\$48k/.test(hud) || /\$47,975/.test(hud));
    noErrors(errors);
  } },
  { name: 'end screen: score breakdown adds up, labels real vs estimated trips, no duplicate headline on a loss', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 11 });
    await page.evaluate(() => setPref('years', 2));
    await newGame(page);
    const r = await page.evaluate(() => {
      const o = {}; S.stats.trips = 7; S.stats.viol = 0; S.money = 61975; S.rep = 80; S.up.value = 12500; S.freezer = 5;
      const parts = scoreParts(); o.sum = parts.reduce((a, p) => a + p[1], 0); o.score = scoreOf(); o.labels = parts.map(p => p[0]);
      finish(); const t = document.querySelector('.end').innerText; o.win = t; o.rows = document.querySelectorAll('.end .kv').length;
      return o;
    });
    assert.strictEqual(r.sum, r.score);
    for (const l of ['Net cash', 'Rest of this summer', 'Boats & permits', 'Reputation', 'Trips', 'Citations', 'Clean record bonus']) assert.ok(r.labels.includes(l), l);
    assert.ok(/how the score adds up/i.test(r.win) && /Total/.test(r.win) && /July trips played/.test(r.win), r.win);
    assert.ok(/\d,\d{3}/.test(r.win), 'separators on the end screen');
    // a loss: the headline appears once, with a distinct grade line
    await newGame(page);
    const l = await page.evaluate(() => { S.cites = 3; gameOver('permit'); return document.querySelector('.end').innerText });
    assert.strictEqual((l.match(/Permit pulled/g) || []).length, 1, l);
    assert.strictEqual((l.match(/Three citations\. Alaska State Parks/g) || []).length, 1, l);
    assert.ok(/F\s*\n?.*Hang Up the Waders/s.test(l));
    noErrors(errors);
  } },
  { name: 'off-season: shorter modal, real July trips and estimated rest-of-summer are labeled', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 4 });
    await page.evaluate(() => setPref('years', 5));
    await newGame(page);
    const r = await page.evaluate(() => new Promise(res => {
      S.stats.trips = 18; S.stats.earned = 20000; S.stats.tips = 3000; S.cur = 13; S.t = 13 * 1440 + 1300; closeModals();
      startSeason(1); setTimeout(() => { const m = document.getElementById('mbg'); res(m ? m.querySelector('.mb').innerText : 'none') }, 50);
    }));
    assert.ok(/18 July trips/.test(r) && /estimated, not played/.test(r), r);
    assert.ok(/Winter bills \$[\d,]+/.test(r) && !/Total:/.test(r), r);
    assert.ok(r.length < 900, 'tighter text: ' + r.length);
    noErrors(errors);
  } },

  // ---- 5. accessibility ----
  { name: 'a11y: focus stays inside a pop-up, Esc closes it, focus goes back to the button that opened it', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 6 });
    await newGame(page);
    await page.focus('button.act:has-text("Wait until")');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#mbg');
    await page.waitForTimeout(80);
    const inside = () => page.evaluate(() => !!document.activeElement.closest('#mbg'));
    assert.ok(await inside(), 'focus moves into the pop-up');
    assert.ok(await page.evaluate(() => document.getElementById('app').hasAttribute('inert')), 'the page behind is inert');
    for (let i = 0; i < 9; i++) { await page.keyboard.press('Tab'); assert.ok(await inside(), 'Tab ' + i + ' stays inside'); }
    for (let i = 0; i < 9; i++) { await page.keyboard.press('Shift+Tab'); assert.ok(await inside(), 'Shift+Tab ' + i + ' stays inside'); }
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.locator('#mbg').count(), 0, 'Esc closes it');
    assert.ok(!(await page.evaluate(() => document.getElementById('app').hasAttribute('inert'))));
    const back = await page.evaluate(() => (document.activeElement.textContent || '').trim());
    assert.ok(/Wait until/.test(back), 'focus restored to: ' + back);
    // Esc also closes a multi-choice pop-up with no “close” button (it is just put away), and works from inside a text field
    await page.evaluate(() => modal('Pick one', '<input id="zz">', [{ l: 'Alpha', fn: () => {} }, { l: 'Beta', fn: () => {} }]));
    await page.focus('#zz'); await page.keyboard.press('Escape');
    assert.strictEqual(await page.locator('#mbg').count(), 0);
    noErrors(errors);
  } },
  { name: 'a11y: Esc never closes a required pop-up (the update notice)', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 6 });
    await page.evaluate(() => modal('Required', '<p>x</p>', [{ l: 'Got it', fn: () => {} }], true));
    await page.waitForTimeout(60); await page.keyboard.press('Escape'); await page.keyboard.press('Tab'); await page.keyboard.press('Escape');
    assert.strictEqual(await page.locator('#mbg').count(), 1);
    assert.ok(await page.evaluate(() => !!document.activeElement.closest('#mbg')));
    await page.click('#mbg button'); assert.strictEqual(await page.locator('#mbg').count(), 0);
    noErrors(errors);
  } },
  { name: 'a11y: Go buttons name the destination; tappable things are at least 44px', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 6 });
    await page.setViewportSize({ width: 420, height: 860 });
    await newGame(page);
    await page.evaluate(() => { document.querySelector('details.go').open = true; S.prios = [{ t: 'a', done: false }, { t: 'b', done: false }]; tab = 'todo'; render(); showTile('🔧', 'A tile', 'x', 'warn') });
    const small = await page.evaluate(() => { const o = []; document.querySelectorAll('button,summary,[role=button]').forEach(e => { if (e.closest('.tile')) { } const r = e.getBoundingClientRect(); if (r.width && r.height && (r.height < 43.5 || r.width < 43.5) && !e.closest('.tile')) o.push(e.className + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' ' + e.textContent.trim().slice(0, 20)) }); return o });
    assert.deepStrictEqual(small, [], 'small targets');
    await page.evaluate(() => { tab = 'act'; render() });
    const labels = await page.evaluate(() => [...document.querySelectorAll('.chip')].map(c => c.getAttribute('aria-label')));
    assert.ok(labels.length >= 4 && labels.every(l => /^Go to .+ · \d+ min$/.test(l)), JSON.stringify(labels));
    assert.ok(labels.some(l => /Kenai Harbor/.test(l)));
    const g = await page.evaluate(() => { const e = document.querySelector('.hud .gear').getBoundingClientRect(); const t = document.querySelector('.tile .ok'); return [e.width, e.height, t ? parseFloat(getComputedStyle(t).width) : 44] });
    assert.ok(g.every(v => v >= 43.5), JSON.stringify(g));
    noErrors(errors);
  } },
  { name: 'a11y: the top bar never wraps or clips at the largest text size (420×860)', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 6 });
    await page.setViewportSize({ width: 420, height: 860 });
    await page.evaluate(() => { localStorage.setItem('guidemaster.name', 'Wilhelmina Longname 20c'); setPref('fs', 'xl'); setPref('years', 10) });
    await newGame(page, 'hard');
    for (const fs of ['n', 'l', 'xl']) {
      const r = await page.evaluate(fs => {
        setPref('fs', fs); S.money = -1999; S.cites = 2; S.fuel = 40; S.cur = 9 * 14 + 3; S.t = S.cur * 1440 + 500; render();
        const o = {}, q = s => document.querySelector(s);
        o.top = q('.hud-top').getBoundingClientRect().height; o.time = q('.hud-time').getBoundingClientRect().height; o.day = q('.hud-day').getBoundingClientRect().height;
        o.stats = [...document.querySelectorAll('.stat b')].map(e => [e.textContent, e.getBoundingClientRect().height, e.scrollWidth > e.clientWidth + 1]);
        S.money = 123456; render(); o.cash = q('.stat b').textContent; o.cashTitle = q('.stat').title; o.cashClip = q('.stat b').scrollWidth > q('.stat b').clientWidth + 1;
        return o;
      }, fs);
      const lh = r.stats[1][1];
      assert.ok(r.stats.every(([, h, clip]) => h <= lh + 1 && !clip), fs + ' stats wrap or clip: ' + JSON.stringify(r.stats));
      assert.ok(r.time < 40 && r.day < 40 && r.top < 80, fs + ' top bar: ' + JSON.stringify([r.top, r.time, r.day]));
      assert.strictEqual(r.cash, '$123k'); assert.ok(/\$123,456/.test(r.cashTitle)); assert.ok(!r.cashClip);
    }
    noErrors(errors);
  } },
];
