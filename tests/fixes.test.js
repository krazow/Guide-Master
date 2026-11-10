const { open, newGame, noErrors, assert } = require('./helpers');

// plain text of the Bookings tab
const bookingsText = () => { const e = document.createElement('div'); e.innerHTML = EXTRA_TABS.find(t => t.k === 'book').view(); return e.textContent; };

module.exports = [
  { name: 'resident flag survives a trip: no "undefined" in Bookings, res stays true, result in b.out', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(bookingsText => {
      const view = eval('(' + bookingsText + ')');
      const b = S.book.find(x => x.res && x.type === 'reds');
      const before = view();
      S.cred.fa = 999; S.cur = b.d; S.t = b.d * 1440 + TRIPS[b.type].start - 30; S.loc = TRIPS[b.type].loc;
      tripStart(b); let i = 0; while (S.trip && i++ < 40) MBTN(legalBtn()); closeModals();
      return { before, after: view(), res: b.res, out: b.out, status: b.status, line: partyLine(b) };
    }, bookingsText.toString());
    assert.ok(!/undefined/.test(r.before), 'upcoming resident bookings show no undefined');
    assert.ok(!/undefined/.test(r.after), 'finished bookings show no undefined');
    assert.strictEqual(r.status, 'done');
    assert.strictEqual(r.res, true);
    assert.ok(r.out && typeof r.out.happy === 'number' && r.out.line, 'trip result is in b.out');
    assert.match(r.line, /Alaska residents/);
    assert.ok(r.after.includes(r.out.line));
    noErrors(errors);
  } },
  { name: 'migration: an old object-valued res moves to b.out and res becomes a boolean', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => {
      const d = JSON.parse(JSON.stringify(packSave()));
      d.schema = 1;
      d.S.book[0].res = { happy: 70, fish: 3, line: '3 sockeye' };
      d.S.book[1].res = true;
      delete d.S.dipnetAsk;
      const m = migrate(d);
      return { a: m.S.book[0], b: m.S.book[1], ask: m.S.dipnetAsk, schema: m.schema };
    });
    assert.strictEqual(r.a.res, false); assert.deepStrictEqual(r.a.out, { happy: 70, fish: 3, line: '3 sockeye' });
    assert.strictEqual(r.b.res, true); assert.strictEqual(r.b.out, undefined);
    assert.strictEqual(r.ask, -1); assert.ok(r.schema >= 2);
    noErrors(errors);
  } },
  { name: 'first-aid class: Mon/Tue/Thu, joinable 1:00-1:30 PM only, wait action before 1 PM', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => {
      const at = (d, m) => { S.cur = d; S.t = d * 1440 + m; S.loc = 'town'; const a = actionsHere(); return { cls: a.find(x => /First aid/.test(x.l)), wait: a.find(x => /Wait at the clinic/.test(x.l)) }; };
      const mon1325 = at(0, 805), mon1335 = at(0, 815), mon1100 = at(0, 660), wed = at(2, 805), tue = at(1, 790);
      const w = at(0, 660).wait; w.fn();
      const afterWait = tod();
      const c = at(0, 805).cls; c.fn();
      return { ok1325: !mon1325.cls.dis, ok1335: !mon1335.cls.dis, dis1100: mon1100.cls.dis, wait1100: !!mon1100.wait, wait1325: !!mon1325.wait, wed: wed.cls.dis, wedWait: !!wed.wait, tue: !tue.cls.dis, afterWait, fa: S.cred.fa, renew: faRenewTo(0), t: tod() };
    });
    assert.ok(r.ok1325, 'joinable at 1:25 PM'); assert.ok(!r.ok1335, 'not joinable at 1:35 PM');
    assert.ok(r.dis1100, 'not before 1 PM'); assert.ok(r.wait1100, 'wait action before 1 PM'); assert.ok(!r.wait1325, 'no wait action after 1 PM');
    assert.ok(r.wed && !r.wedWait, 'no class on Wednesday'); assert.ok(r.tue);
    assert.strictEqual(r.afterWait, 780);
    assert.strictEqual(r.fa, r.renew); assert.strictEqual(r.t, 805 + 180, 'late arrival still sits 3 hours');
    noErrors(errors);
  } },
  { name: 'first-aid alerts: alert bar and urgent To-do from Monday of the expiry week', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => {
      const on = (d, m) => { S.book = []; S.cur = d; S.t = d * 1440 + m; S.loc = 'shop'; return { bar: (alertBar() || {}).t || '', todo: todoItems().find(x => /first-aid/.test(x.l)), tip: TIPS.find(x => x.id === 'firstaid').when() }; };
      const mon = on(0, 420), wed = on(2, 420);
      // card expiring the Wednesday of season 2 (two-year card, a year on): alert starts Monday of that week
      S.years = 5; S.cred.fa = 14 + 2;
      const m2 = on(14, 420), s13 = on(13, 420);
      S.cred.fa = 14 * 2 + 2; // expires next season, not this one
      const notYet = on(14, 420);
      return { mon, wed, m2, s13, notYet };
    });
    assert.match(r.mon.bar, /First-aid card expires Wednesday night: classes Mon\/Tue\/Thu 1 PM at the Soldotna clinic/);
    assert.ok(r.mon.todo.urgent && r.mon.tip, 'urgent To-do and tip on Monday');
    assert.match(r.wed.bar, /expires Wednesday night/); assert.ok(r.wed.todo.urgent);
    assert.match(r.m2.bar, /First-aid card expires Wednesday night/); assert.ok(r.m2.todo.urgent);
    assert.ok(!/First-aid/.test(r.s13.bar), 'not the week before');
    assert.ok(!/First-aid/.test(r.notYet.bar) && !r.notYet.todo, 'a card good past this season raises nothing');
    noErrors(errors);
  } },
  { name: 'request modal flags a Sunday reds trip and offers the next legal day', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => {
      S.book = []; S.cur = 0; S.t = 600; S.loc = 'shop';
      const btns = () => [...document.querySelectorAll('#mbg button')].map(b => b.textContent);
      requestModal({ kind: 'trip', d: 6, type: 'reds', n: 3, who: 'test party', from: 'Ohio', res: false, quirk: [] });
      const body = document.querySelector('#mbg .mb').textContent, bs = btns();
      const i = bs.findIndex(t => /Offer .* instead/.test(t));
      MBTN(i);
      const booked = S.book.map(b => [b.d, b.type, b.n, issueOf(b)]);
      // a halibut request on a closed day, and a legal one with no warning
      requestModal({ kind: 'trip', d: 8, type: 'halibut', n: 5, who: 'p', from: 'x', res: false, quirk: [] });
      const hal = document.querySelector('#mbg .mb').textContent, halBtns = btns(); closeModals();
      requestModal({ kind: 'trip', d: 10, type: 'reds', n: 3, who: 'p', from: 'x', res: false, quirk: [] });
      const ok = document.querySelector('#mbg .mb').textContent, okBtns = btns(); closeModals();
      return { body, bs, booked, hal, halBtns, ok, okBtns };
    });
    assert.match(r.body, /Sunday: guide boats can’t fish below Skilak Lake \(May 1–Jul 31\)/);
    assert.ok(r.bs.some(t => /Offer Tuesday, July 21 instead/.test(t)) && r.bs.some(t => /Book it anyway/.test(t)) && r.bs.some(t => /Decline/.test(t)));
    assert.deepStrictEqual(r.booked, [[8, 'reds', 3, null]]);
    assert.match(r.hal, /Tuesday: charter anglers can’t keep halibut today \(Tuesdays and Wednesdays\)/);
    assert.ok(r.halBtns.some(t => /Offer Thursday, July 23 instead/.test(t)));
    assert.ok(!/🚫|⚓ /.test(r.ok) && !r.okBtns.some(t => /Offer|anyway/.test(t)), 'a legal date shows no warning');
    noErrors(errors);
  } },
  { name: 'no legal day left: the offer button is hidden', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => {
      S.cur = 0; S.t = 600;
      for (let d = 7; d < 14; d++) if (!isSunMon(d)) addBooking({ d, type: 'reds', n: 2, who: 'x', from: 'y' });
      requestModal({ kind: 'trip', d: 6, type: 'reds', n: 3, who: 'p', from: 'x', res: false, quirk: [] });
      return [...document.querySelectorAll('#mbg button')].map(b => b.textContent);
    });
    assert.ok(!r.some(t => /Offer/.test(t)) && r.some(t => /Book it anyway/.test(t)));
    noErrors(errors);
  } },
  { name: 'requests: at most one dipnet request per season, and fewer illegal dates', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(() => {
      S.book = []; S.cur = 0; S.t = 600;
      let dip = 0, n = 0, illegal = 0, nulls = 0;
      for (let i = 0; i < 600; i++) {
        const q = makeRequest();
        if (!q) { nulls++; continue; }
        n++; if (q.kind === 'dipnet') dip++; else if (illegalDay(q.type, q.d)) illegal++;
      }
      const ask = S.dipnetAsk;
      // a new season may ask again
      S.cur = 14; S.dipnetAsk = 0; let dip2 = 0; for (let i = 0; i < 300; i++) { const q = makeRequest(); if (q && q.kind === 'dipnet') dip2++; }
      return { dip, n, illegal, nulls, ask, dip2 };
    });
    assert.ok(r.dip <= 1, 'one dipnet request at most: ' + r.dip); assert.strictEqual(r.ask, 0);
    assert.ok(r.dip2 <= 1);
    assert.ok(r.illegal / Math.max(1, r.n) < .15, 'illegal-date rate is lower: ' + r.illegal + '/' + r.n);
    noErrors(errors);
  } },
];
