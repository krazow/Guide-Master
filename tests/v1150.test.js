// Version 1.15: memories (trophy wall, records, firsts, postcards), the star rating and its milestones, catch moments (reduced motion,
// the chime off by default, the dock card), the mentor's first trip (once, skip, replay) and the schema-8 migration.
const { open, newGame, noErrors, assert } = require('./helpers');

// a game on a trip morning (day 1), at the launch, fueled and fed, first-aid current
const install = () => {
  window.seedRand = a => { Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  window.at = (type, tr, n, d) => {
    d = d || 1; closeModals(); clearTiles(); S.cur = d; S.t = d * 1440 + TRIPS[type].start - 15; S.loc = TRIPS[type].loc; S.fuel = 60; S.hfuel = 200; S.energy = 85; S.boat = 90; S.gear = 3;
    S.cred.fa = 999; S.book = S.book.filter(b => b.d !== d); S.trip = null; S.dil = null; S.ate = { d: -1, n: 0 }; S.food = { pan: 24, fri: 6, fd: 1, fm: 0, kits: 6 }; S.up.chp = true;
    return addBooking({ d, type, n: n || 3, who: 'test party', from: 'Ohio', res: false, quirk: [], tr: tr || ['meat'] });
  };
  window.play = () => { let g = 0; const views = []; while (S.trip && document.getElementById('mbg') && g++ < 40) { views.push({ key: S.trip.steps[S.trip.step], mentor: document.querySelectorAll('#mbg .gm-mentor').length, moment: document.querySelectorAll('#mbg .gm-moment').length }); MBTN(legalBtn()); } return views; };
  window.fakeT = b => ({ id: b.id, bt: { k: 0, K: 3, spot: 0, tac: 'flip', segs: [], mv: [], ang: [0, 0, 0], box: 0, lunch: -1, early: false }, notes: [], steps: [], step: 0, g: {} });
};

module.exports = [
  // ---- 1. records and firsts ----
  { name: 'trophy wall: a trip records the biggest fish per species with a plausible size; firsts for species, king, barn door, limit-out and five stars', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 21 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      seedRand(5); const b = at('reds', ['meat']); tripStart(b); play();
      const out = { rec: JSON.parse(JSON.stringify(S.mem.rec)), firsts: Object.keys(S.mem.firsts), trips: S.mem.trips.length };
      // sizes: ordinary fish stay inside each species' range; a trophy reads its size off the 🏆 line
      const bb = { id: 3, d: 2, type: 'reds' }, sz = {};
      for (const sp of ['sockeye', 'silver', 'rainbow', 'halibut']) { sz[sp] = []; for (let n = 1; n < 9; n++) for (let k = 0; k < 3; k++) sz[sp].push(segSize({ id: n * 11 + k, d: n }, { k, n, big: 0 }, sp).z); }
      out.sz = sz; out.trophy = segSize(bb, { k: 0, n: 2, big: 1, line: '🐟 Two reds in the box. 🏆 A 11-pound buck sockeye, the fish of the day.' }, 'sockeye');
      out.trophyH = segSize(bb, { k: 0, n: 2, big: 1, line: '⚓ Two halibut. 🏆 A 142-pound halibut comes over the rail.' }, 'halibut');
      // a barn door, a king and a limit-out, straight into the memory
      const h = at('halibut', ['trophy'], 4, 2), t = fakeT(h);
      memNote(h, t, 'halibut', 142, true); memNote(h, t, 'king', 52, true, 'at the boat');
      const t2 = fakeT(b); b.n = 2; t2.bt.box = 2 * limOf(b); memScan(b, t2, 'beat');
      out.ev = t.mm.ev.map(e => e.k); out.ev2 = t2.mm.ev.map(e => e.k);
      memDock(h, t, { C: null, rv: { stars: 5, text: 'Five stars, no question. Everybody limited.' }, happy: 95, fish: 3 });
      out.firsts2 = Object.keys(S.mem.firsts); out.five = S.mem.firsts.five.txt; out.barn = S.mem.rec.halibut;
      // the wall, in the Log tab
      closeModals(); setTab('log'); logSub('wall'); out.wall = document.querySelector('.content').textContent;
      out.segTall = [...document.querySelectorAll('.gm-seg button')].every(e => e.getBoundingClientRect().height >= 44);
      logSub('log'); out.logBack = !!document.querySelector('.content .log');
      return out;
    });
    assert.ok(r.rec.sockeye && r.rec.sockeye.z >= 5 && r.rec.sockeye.z <= 12, JSON.stringify(r.rec));
    assert.ok(r.firsts.includes('sp_sockeye') && r.firsts.includes('trip'), r.firsts.join()); assert.strictEqual(r.trips, 1);
    const R = { sockeye: [5, 9], silver: [8, 13], rainbow: [16, 26], halibut: [15, 60] };
    for (const sp in R) assert.ok(r.sz[sp].every(z => z >= R[sp][0] && z < R[sp][1]), sp + ' ' + r.sz[sp].join(','));
    assert.deepStrictEqual(r.trophy, { z: 11, big: true }); assert.strictEqual(r.trophyH.z, 142);
    assert.ok(r.ev.includes('barn') && r.ev.includes('king') && r.ev.includes('first'), r.ev.join()); assert.ok(r.ev2.includes('limit'), r.ev2.join());
    for (const k of ['barn', 'king', 'limit', 'five', 'sp_halibut', 'sp_king']) assert.ok(r.firsts2.includes(k), k + ' in ' + r.firsts2.join());
    assert.match(r.five, /five-star/i); assert.strictEqual(r.barn.z, 142);
    assert.match(r.wall, /Biggest fish/); assert.match(r.wall, /Halibut: 142 lb · barn door/); assert.match(r.wall, /Firsts/); assert.match(r.wall, /Standout clients/); assert.match(r.wall, /★/);
    assert.ok(r.segTall, 'the Log / Trophy wall switch is 44px tall'); assert.ok(r.logBack);
    noErrors(errors);
  } },

  // ---- 2. postcards ----
  { name: 'postcards: at a new season, one or two past clients with a good day write in, in the morning report, once a season', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 22 });
    await newGame(page);
    const r = await page.evaluate(() => {
      const M = MEM();
      M.trips = [{ d: 3, who: 'Kowalskis', from: 'Wisconsin', type: 'reds', stars: 5, best: ['sockeye', 10], tr: ['meat'] }, { d: 5, who: 'Lopez family', from: 'New Mexico', type: 'trout', stars: 5, best: ['rainbow', 22], tr: ['kids'] },
        { d: 6, who: 'grumps', from: 'Nowhere', type: 'reds', stars: 2, best: null, tr: [] }, { d: 8, who: 'Nguyens', from: 'Anchorage', type: 'silver', stars: 4, best: ['silver', 11], tr: ['photo'] }];
      DIGEST = { night: '', items: [], lines: [], held: [], open: false, from: 13 };
      memSeasonStart(1); const lines1 = DIGEST.lines.slice(); DIGEST.lines = [];
      memSeasonStart(1); const again = DIGEST.lines.length; DIGEST = null;
      // the real season turn: the morning report carries them
      M.cardS = -1; M.cards = []; closeModals(); S.cur = 13; S.t = 13 * 1440 + 1200; endDay('home');
      const rep = [...document.querySelectorAll('#mbg .digest p')].map(p => p.textContent).filter(t => /postcard/.test(t));
      const sheets = document.querySelectorAll('.modal-bg').length;
      return { lines1, again, rep, cards: M.cards.length, sheets };
    });
    assert.ok(r.lines1.length >= 1 && r.lines1.length <= 2, JSON.stringify(r.lines1));
    assert.ok(r.lines1.every(l => /postcard/.test(l) && !/grumps/.test(l)), 'only clients with a good day: ' + r.lines1.join(' | '));
    assert.ok(r.lines1.some(l => /Kowalskis|Lopez/.test(l)), 'five-star clients first');
    assert.strictEqual(r.again, 0, 'once a season');
    assert.ok(r.rep.length >= 1 && r.rep.length <= 2, 'in the morning report: ' + r.rep.join(' | ')); assert.ok(r.cards >= 1);
    assert.strictEqual(r.sheets, 1, 'no new pop-up: the morning report only');
    noErrors(errors);
  } },

  // ---- 3. the star rating ----
  { name: 'rating: the average of the last 20 reviews (rep fills in early), ★ in the top bar, top-rated tips, under ★2.5 fewer bookings, rep 0 still loses', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 23 });
    await newGame(page);
    const r = await page.evaluate(() => {
      const o = {}; render();
      o.start = rating(); o.hud = [...document.querySelectorAll('.stat')].map(e => e.textContent).find(t => /Rating/.test(t)); o.rep = [...document.querySelectorAll('.stat small')].some(e => e.textContent === 'Rep');
      o.title = document.querySelector('.stat[title*="Rating"]').title;
      const rv = st => ({ day: 1, who: 'x', type: 'reds', stars: st, text: '' });
      S.reviews = Array.from({ length: 30 }, (_, i) => rv(i < 10 ? 1 : 5));   // the ten 1★ are older than the last 20
      o.last20 = rating(); o.top = topRated(); o.tipK = memTipK();
      S.reviews = Array.from({ length: 20 }, () => rv(4)); o.four = rating(); o.topNo = topRated(); o.tip1 = memTipK(); o.book4 = starBook();
      S.reviews = Array.from({ length: 20 }, () => rv(1)); o.low = rating(); o.bookLow = starBook(); render(); o.warn = document.querySelector('.stat[title*="Rating"] b').getAttribute('style') || '';
      // fewer July bookings under ★2.5 (same seeds, same rep)
      const count = () => { S.book = S.book.filter(b => seasonOf(b.d) !== 1); const before = S.book.length; let n = 0; for (let i = 0; i < 30; i++) { genSeasonBookings(1); n += S.book.length - before; S.book = S.book.filter(b => seasonOf(b.d) !== 1) } return n };
      S.reviews = Array.from({ length: 20 }, () => rv(4)); const s0 = Math.random; let a = 9; Math.random = () => { a = (a * 16807) % 2147483647; return a / 2147483647 }; const nOK = count();
      S.reviews = Array.from({ length: 20 }, () => rv(1)); a = 9; const nLow = count(); Math.random = s0; o.nOK = nOK; o.nLow = nLow;
      o.restOK = (S.reviews = Array.from({ length: 20 }, () => rv(4)), restOfSeason({ trips: 40, hap: 76 }).trips); o.restLow = (S.reviews = Array.from({ length: 20 }, () => rv(1)), restOfSeason({ trips: 40, hap: 76 }).trips);
      S.rep = 0; o.loss = checkLoss(); S.rep = 50;
      return o;
    });
    assert.ok(Math.abs(r.start.r - 4) < .01 && r.start.n === 0, 'a new guide starts at ★4.0: ' + JSON.stringify(r.start));
    assert.match(r.hud, /Rating★4\.0/); assert.ok(!r.rep, 'the rating takes Rep’s place in the top bar'); assert.match(r.title, /Reputation 50\/100/);
    assert.ok(r.last20.r > 4.8 && r.last20.n === 20, 'only the last 20 count: ' + JSON.stringify(r.last20)); assert.ok(r.top); assert.strictEqual(r.tipK, 1.15);
    assert.ok(Math.abs(r.four.r - 4) < .05 && !r.topNo && r.tip1 === 1 && r.book4 === 1, JSON.stringify(r));
    assert.ok(r.low.r < 1.5 && r.bookLow < 1 && r.bookLow >= .7, JSON.stringify(r.low) + ' ' + r.bookLow); assert.match(r.warn, /color/, 'the low rating shows as a warning');
    assert.ok(r.nLow < r.nOK, `bookings fall under ★2.5: ${r.nLow} vs ${r.nOK}`); assert.ok(r.restLow < r.restOK, `rest of summer too: ${r.restLow} vs ${r.restOK}`);
    assert.strictEqual(r.loss, 'reviews', 'reputation 0 still ends the career');
    noErrors(errors);
  } },

  { name: 'rating milestones: top-rated note, a once-a-career magazine feature that books the coming week, a lodge partnership after a ★4.7 season (referral fee, ends under ★4.3)', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 24 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      const o = {}, rv = (st, d) => ({ day: d == null ? 1 : d, who: 'x', type: 'reds', stars: st, text: '' });
      S.cur = 2; S.t = 2 * 1440 + 900; S.book = S.book.filter(b => b.d <= 2);
      S.reviews = Array.from({ length: 14 }, () => rv(5));
      const n0 = S.book.length; o.html = starsAfterTrip({ d: 2 }, {}, {}); o.added = S.book.length - n0;
      o.feat = JSON.parse(JSON.stringify(S.mem.feat)); o.top = S.mem.top;
      o.legal = S.book.filter(b => b.feat).every(b => !illegalDay(b.type, b.d) && b.d > 2 && b.d <= 9);
      const n1 = S.book.length; starsAfterTrip({ d: 2 }, {}, {}); o.again = S.book.length - n1;
      // the lodge: a season averaging ★4.7 or better at the season turn
      S.reviews = Array.from({ length: 8 }, () => rv(5, 3)).concat([rv(4, 4)]);
      DIGEST = { night: '', items: [], lines: [], held: [], open: false, from: 13 }; starsSeasonStart(1); o.lodgeLine = DIGEST.lines.join(' '); DIGEST = null;
      o.lodge = JSON.parse(JSON.stringify(S.mem.lodge));
      S.book = S.book.filter(b => seasonOf(b.d) !== 1); o.openLines = starsSeasonOpen(1); const lb = S.book.filter(b => b.lodge);
      o.lodgeN = lb.length; o.lodgeOK = lb.every(b => seasonOf(b.d) === 1 && !illegalDay(b.type, b.d));
      // the referral fee rides along as a side deal on the trip
      const b = lb[0]; const t = { x: [] }; memTripStart(b, t); o.fee = t.x; o.pay = payOf(b);
      // the rating slips: the partnership ends at the next turn
      S.reviews = Array.from({ length: 20 }, () => rv(3, 20)); DIGEST = { night: '', items: [], lines: [], held: [], open: false, from: 27 }; starsSeasonStart(2); o.off = DIGEST.lines.join(' '); DIGEST = null;
      o.lodgeOff = S.mem.lodge.off; S.book = S.book.filter(b => seasonOf(b.d) !== 2); starsSeasonOpen(2); o.lodge2 = S.book.filter(b => b.lodge && seasonOf(b.d) === 2).length;
      closeModals(); setTab('log'); logSub('wall'); o.wall = document.querySelector('.content').textContent;
      return o;
    });
    assert.match(r.html, /Top-rated guide/); assert.ok(r.top); assert.match(r.html, /magazine feature/i);
    assert.ok(r.added >= 1 && r.added <= 3, 'a burst of bookings: ' + r.added); assert.ok(r.legal, 'on legal days in the coming week'); assert.strictEqual(r.feat.n, r.added); assert.strictEqual(r.again, 0, 'once a career');
    assert.match(r.lodgeLine, /lodge partnership/i); assert.strictEqual(r.lodge.s, 1);
    assert.strictEqual(r.lodgeN, 2); assert.ok(r.lodgeOK); assert.ok(r.openLines.some(l => /lodge/.test(l)));
    assert.deepStrictEqual(r.fee, [['Referral fee to the lodge', -Math.round(r.pay * .1)]]);
    assert.match(r.off, /partnership is over/); assert.strictEqual(r.lodgeOff, 2); assert.strictEqual(r.lodge2, 0);
    assert.match(r.wall, /magazine feature/); assert.match(r.wall, /lodge partnership/);
    noErrors(errors);
  } },

  // ---- 4. catch moments ----
  { name: 'catch moments: a trophy shows a short moment inside the trip sheet and a catch card at the dock (PNG); no new sheets; reduced motion stops the animation', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 25 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      MEM().mentor = 'done';
      seedRand(7); const b = at('reds', ['trophy']);
      let sheets = 0; const obs = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.id === 'mbg') sheets++ }))); obs.observe(document.body, { childList: true });
      // every stretch lands a trophy: the 🏆 line from 33-day.js
      const oBig = window.bigLine; window.bigLine = () => '🏆 A 11-pound buck sockeye, the fish of the day.';
      const oLand = window.landSeg; window.landSeg = function (b2, t2, k) { const sg = oLand(b2, t2, k); if (sg && !sg.big) { sg.big = 1; sg.n = Math.max(1, sg.n); sg.line += ' ' + bigLine(b2) } return sg };
      tripStart(b); const o = { moments: [] }; let g = 0;
      while (S.trip && g++ < 30) { const m = document.querySelector('#mbg .gm-moment'); if (m) { const cs = getComputedStyle(m); o.moments.push({ txt: m.textContent, anim: cs.animationName, dur: cs.animationDuration, role: m.getAttribute('role') }); const f = m.querySelector('.gm-fishg'); o.fishDur = f && getComputedStyle(f).animationDuration } MBTN(legalBtn()) }
      window.landSeg = oLand; window.bigLine = oBig;
      obs.takeRecords().forEach(m => m.addedNodes.forEach(n => { if (n.id === 'mbg') sheets++ })); obs.disconnect(); o.sheets = sheets;
      o.card = !!document.querySelector('#mbg .gm-card'); o.cardTxt = (document.querySelector('#mbg .gm-card') || {}).textContent || '';
      const sv = document.querySelector('#mbg .gm-save'); o.save = !!sv && sv.getBoundingClientRect().height >= 44;
      o.png = (cardPNG() || '').slice(0, 22);
      o.btnsAct = [...document.querySelectorAll('#mbg button.act')].map(e => e.textContent);
      // reduced motion (the in-game setting): no animation
      setPref('rm', true); const div = document.createElement('div'); div.innerHTML = momentHTML(momentOf([{ k: 'trophy', sp: 'sockeye', z: 11 }])); document.body.appendChild(div);
      o.rmAnim = getComputedStyle(div.querySelector('.gm-moment')).animationName; o.rmFish = getComputedStyle(div.querySelector('.gm-fishg')).animationName; div.remove(); setPref('rm', false);
      return o;
    });
    assert.ok(r.moments.length >= 1, 'a moment inside the trip sheet'); assert.match(r.moments[0].txt, /Trophy|First sockeye/); assert.strictEqual(r.moments[0].role, 'status');
    const secs = s => parseFloat(s) * (/ms/.test(s) ? .001 : 1);
    assert.ok(r.moments[0].anim !== 'none' && secs(r.moments[0].dur) <= 1.5 && secs(r.fishDur) <= 1.5, 'a short animation: ' + JSON.stringify(r.moments[0]) + ' ' + r.fishDur);
    assert.strictEqual(r.sheets, 1, 'the whole trip is still one sheet');
    assert.ok(r.card, 'a catch card at the dock'); assert.match(r.cardTxt, /11 lb sockeye/); assert.match(r.cardTxt, /Trophy/); assert.ok(r.save, 'Save image button, 44px');
    assert.strictEqual(r.png, 'data:image/png;base64,');
    assert.ok(!r.btnsAct.some(t => /Save/.test(t)), 'the save button is not one of the sheet’s answers');
    assert.strictEqual(r.rmAnim, 'none'); assert.strictEqual(r.rmFish, 'none');
    // the system setting: prefers-reduced-motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const sys = await page.evaluate(() => { const d = document.createElement('div'); d.innerHTML = momentHTML(momentOf([{ k: 'limit', sp: 'sockeye', n: 9 }])); document.body.appendChild(d); const a = getComputedStyle(d.querySelector('.gm-moment')).animationName; d.remove(); return a });
    assert.strictEqual(sys, 'none');
    noErrors(errors);
  } },

  { name: 'catch chime: off by default, a Settings toggle turns it on, synthesized (no audio files)', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 26 });
    await newGame(page);
    const r = await page.evaluate(() => {
      const o = {}; let calls = 0; const oTone = window.tone; window.tone = (...a) => { calls++ };
      o.def = !!prefs().chime; o.defKey = PREF_DEF.chime; memChime(); o.callsOff = calls;
      openSettings(); const i = MB.findIndex(b => /Catch chime/.test(b.l)); o.label = MB[i] && MB[i].l; MBTN(i);
      o.on = prefs().chime; o.callsOn = calls; o.label2 = MB.find(b => /Catch chime/.test(b.l)).l; closeModals();
      calls = 0; memChime(); o.chime = calls; setPref('chime', false); window.tone = oTone;
      o.audioFiles = document.querySelectorAll('audio').length;
      return o;
    });
    assert.strictEqual(r.def, false, 'off by default'); assert.strictEqual(r.callsOff, 0);
    assert.match(r.label, /Catch chime: Off/); assert.strictEqual(r.on, true); assert.match(r.label2, /Catch chime: On/);
    assert.ok(r.callsOn > 0 && r.chime > 0, 'turning it on plays it'); assert.strictEqual(r.audioFiles, 0);
    noErrors(errors);
  } },

  // ---- 5. the mentor ----
  { name: 'mentor: rides the first trip of a new career, one line per beat inside the one sheet, then never again', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 27 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      const o = { due: S.mem ? S.mem.mentor : MEM().mentor };
      seedRand(9); const b = at('reds', ['kids']);
      let sheets = 0; const obs = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.id === 'mbg') sheets++ }))); obs.observe(document.body, { childList: true });
      tripStart(b); const lines = []; let g = 0;
      while (S.trip && g++ < 30) { const ls = [...document.querySelectorAll('#mbg .gm-mentor')]; lines.push({ key: S.trip.steps[S.trip.step], n: ls.length, txt: ls.map(e => e.textContent).join(' '), skip: ls.map(e => e.querySelector('.gm-skip')).filter(Boolean).every(x => x.getBoundingClientRect().height >= 44) }); MBTN(legalBtn()) }
      o.dock = [...document.querySelectorAll('#mbg .gm-mentor')].map(e => e.textContent).join(' ');
      obs.takeRecords().forEach(m => m.addedNodes.forEach(n => { if (n.id === 'mbg') sheets++ })); obs.disconnect(); o.sheets = sheets; o.lines = lines; o.after = S.mem.mentor;
      closeModals(); const b2 = at('trout', ['photo'], 2, 2); tripStart(b2); const v2 = play(); o.second = v2.reduce((a, v) => a + v.mentor, 0);
      return o;
    });
    assert.strictEqual(r.due, 'due');
    const spot = r.lines.find(l => l.key === 'spot' || l.key === 'pack'), beats = r.lines.filter(l => l.key === 'beat');
    assert.ok(spot && spot.n === 1 && /Walt/.test(spot.txt) && /Read it top to bottom/.test(spot.txt), 'reading the conditions at the launch: ' + JSON.stringify(spot));
    assert.ok(beats[0] && /Your call now/.test(beats[0].txt), 'choosing a move at the first call');
    assert.ok(r.lines.some(l => /🎯 line/.test(l.txt)) || /what the party came for/.test(r.dock), 'the party’s goals');
    assert.ok(r.lines.every(l => l.n <= 1), 'one line per beat'); assert.ok(r.lines.every(l => l.skip), 'the skip button is 44px');
    assert.ok(r.lines.filter(l => l.n).length >= 3, 'he talks on at least three sheets');
    assert.strictEqual(r.sheets, 1, 'no extra sheets'); assert.match(r.dock, /You don’t need me/); assert.strictEqual(r.after, 'done');
    assert.strictEqual(r.second, 0, 'only once');
    noErrors(errors);
  } },

  { name: 'mentor: a rule dilemma gets his line; “I’ve got this” sends him ashore for good; Help brings him back for one trip (in a game and from the title screen)', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 28 });
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      const o = {};
      // a dilemma with an illegal option: his rules line
      const b = at('reds', ['meat']); tripStart(b); let g = 0;
      S.trip.steps.splice(S.trip.step + (S.trip.steps[S.trip.step] === 'pack' ? 2 : 1), 0, 'snag'); MBTN(legalBtn());   // the next sheet: a foul-hooked red
      o.rulesKey = S.trip.steps[S.trip.step]; o.rules = [...document.querySelectorAll('#mbg .gm-mentor')].map(e => e.textContent).join(' ');
      // skip
      const sk = document.querySelector('#mbg .gm-skip'); if (sk) sk.click(); else mentorSkip();
      o.gone = document.querySelectorAll('#mbg .gm-mentor').length; o.state = S.mem.mentor; o.focus = document.activeElement && document.activeElement.classList.contains('act');
      let rest = 0; g = 0; while (S.trip && g++ < 30) { MBTN(legalBtn()); rest += document.querySelectorAll('#mbg .gm-mentor').length } o.rest = rest;
      // Help in a game: ride with him again
      closeModals(); helpModal(); const i = MB.findIndex(x => /Ride with the mentor again/.test(x.l)); o.helpBtn = i >= 0; MBTN(i); closeModals();
      o.again = S.mem.mentor; const b2 = at('reds', ['first'], 3, 3); tripStart(b2); o.back = document.querySelectorAll('#mbg .gm-mentor').length; play(); o.after = S.mem.mentor;
      // Settings has a way into Help
      closeModals(); openSettings(); o.settingsHelp = MB.some(x => /^❓ Help/.test(x.l)); closeModals();
      return o;
    });
    assert.match(r.rules, /lose permits/, 'the rule dilemma line on ' + r.rulesKey);
    assert.strictEqual(r.gone, 0); assert.strictEqual(r.state, 'skipped'); assert.ok(r.focus, 'focus goes to the first answer'); assert.strictEqual(r.rest, 0);
    assert.ok(r.helpBtn); assert.strictEqual(r.again, 'due'); assert.strictEqual(r.back, 1); assert.strictEqual(r.after, 'done'); assert.ok(r.settingsHelp);
    // from the title screen: the saved game gets him back
    const t = await page.evaluate(async () => { S.mem.mentor = 'done'; saveGame(); S = null; closeModals(); titleScreen(); closeModals(); helpModal(); const i = MB.findIndex(x => /Ride with the mentor again/.test(x.l)); MBTN(i); await new Promise(r => setTimeout(r, 20)); const d = loadSave(); return { i, m: d.S.mem.mentor, note: document.querySelector('#mbg h2') && document.querySelector('#mbg h2').textContent } });
    assert.ok(t.i >= 0); assert.strictEqual(t.m, 'due'); assert.match(t.note, /Walt/);
    noErrors(errors);
  } },

  // ---- 6. migration ----
  { name: 'migration to schema 8: older saves (4–6) get S.mem without losing anything; a career under way keeps the mentor home', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 29 });
    await newGame(page);
    const r = await page.evaluate(() => {
      const o = {};
      S.stats.trips = 9; S.reviews = [{ day: 1, who: 'a', type: 'reds', stars: 5, text: 'x' }];
      for (const sc of [4, 5, 6]) { const d = JSON.parse(JSON.stringify(packSave())); d.schema = sc; d.app = '1.13.0'; delete d.S.mem; const m = migrate(d); o['s' + sc] = { schema: m.schema, mem: m.S.mem && Object.keys(m.S.mem).sort().join(), mentor: m.S.mem.mentor, rev: m.S.reviews.length } }
      const d2 = JSON.parse(JSON.stringify(packSave())); d2.schema = 6; d2.S.stats.trips = 0; delete d2.S.mem; o.fresh = migrate(d2).S.mem.mentor;
      const d3 = JSON.parse(JSON.stringify(packSave())); d3.schema = 6; d3.S.mem = { mentor: 'due', rec: { sockeye: { z: 8, who: 'q', d: 1, year: 2026 } } }; const m3 = migrate(d3).S.mem; o.keep = [m3.mentor, m3.rec.sockeye.z, Array.isArray(m3.trips)];
      // a migrated save plays a trip
      S = migrate(JSON.parse(JSON.stringify(Object.assign(packSave(), { schema: 5 })))).S; delete S.mem; render(); o.hud = !!document.querySelector('.stat[title*="Rating"]');
      return o;
    });
    for (const sc of [4, 5, 6]) { assert.ok(r['s' + sc].schema >= 8); assert.match(r['s' + sc].mem, /cards.*firsts.*mentor.*rec.*trips/); assert.strictEqual(r['s' + sc].mentor, 'done'); assert.strictEqual(r['s' + sc].rev, 1) }
    assert.strictEqual(r.fresh, 'due', 'a save from before its first trip still gets the mentor');
    assert.deepStrictEqual(r.keep, ['due', 8, true]); assert.ok(r.hud);
    noErrors(errors);
  } },
  // ---- 1.15 on top of 1.14's summer weeks ----
  { name: 'with summer weeks: the magazine and the lodge book inside the chosen weeks, on that week’s trip (June kings, August silvers, September rainbows)', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 41 });
    await page.evaluate(() => setPref('years', 5));
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      const o = {}, rv = (st, d) => ({ day: d, who: 'x', type: 'reds', stars: st, text: '' });
      S.weeks = { 1: ['june', 'aug'], 2: ['aug', 'sep'] }; S.reg = genRegs(1); S.reg.king = 'open';
      // the magazine on a June Tuesday of season 2 (day 15): the coming days are king trips (Tue–Sat) and trout/halibut on Sun/Mon
      S.cur = 15; S.t = 15 * 1440 + 900; S.book = S.book.filter(b => seasonOf(b.d) !== 1); MEM().feat = null;
      S.reviews = Array.from({ length: 14 }, () => rv(5, 15));
      starsAfterTrip({ d: 15 }, {}, {});
      const fb = S.book.filter(b => b.feat);
      o.feat = fb.map(b => [b.d, b.type, weekIdOf(b.d), illegalDay(b.type, b.d)]);
      // the lodge for season 3 (August + September), after a season averaging ★4.7
      S.mem.lodge = null; S.reviews = [5, 5, 5, 5, 5, 4, 5, 5, 4, 5].map(k => rv(k, 20));
      DIGEST = { night: '', items: [], lines: [], held: [], open: false, from: 27 }; starsSeasonStart(2); o.line = DIGEST.lines.join(' '); DIGEST = null;
      S.book = S.book.filter(b => seasonOf(b.d) !== 2); starsSeasonOpen(2);
      o.lodge = S.book.filter(b => b.lodge).map(b => [b.d, b.type, weekIdOf(b.d), illegalDay(b.type, b.d), sday(b.d) % 7, WEEKS[weekIdOf(b.d)].main(b.d)]);
      return o;
    });
    assert.ok(r.feat.length >= 1 && r.feat.length <= 3, JSON.stringify(r.feat));
    for (const [d, type, wk, bad] of r.feat) { assert.strictEqual(wk, 'june'); assert.ok(!bad, 'legal'); assert.ok(['king', 'trout', 'halibut'].includes(type), type); }
    assert.ok(r.feat.some(f => f[1] === 'king'), 'magazine readers book June kings: ' + JSON.stringify(r.feat));
    assert.match(r.line, /lodge partnership/i); assert.match(r.line, /season’s reviews averaged ★4\.8/); assert.doesNotMatch(r.line, /July/);
    assert.strictEqual(r.lodge.length, 2, JSON.stringify(r.lodge));
    for (const [d, type, wk, bad, w, main] of r.lodge) { assert.ok(['aug', 'sep'].includes(wk)); assert.ok(!bad); assert.ok(w >= 1 && w <= 5);
      assert.strictEqual(type, main, 'the week’s own trip'); assert.notStrictEqual(type, 'reds'); }
    noErrors(errors);
  } },

  { name: 'with summer weeks: postcards and the lodge check run once per season turn; a June king trip records kings with one king moment', fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 43 });
    await page.evaluate(() => setPref('years', 5));
    await newGame(page); await page.evaluate(install);
    const r = await page.evaluate(() => {
      const o = {};
      MEM().trips = [{ d: 3, who: 'Chen family', from: 'Oregon', type: 'reds', stars: 5, best: ['sockeye', 8], tr: ['kids'], lim: false },
        { d: 5, who: 'Navy buddies', from: 'Virginia', type: 'reds', stars: 5, best: ['sockeye', 7], tr: ['trophy'], lim: true }];
      S.reviews = Array.from({ length: 9 }, (_, i) => ({ day: 2 + i, who: 'x', type: 'reds', stars: 5, text: '' }));
      S.weeks = { 1: ['june', 'sep'] };
      const n0 = S.seasons.length;
      // the season turn (endDay → startSeason, wrapped by 34-summer.js), then the bookings (finishWinter)
      closeModals(); clearTiles(); S.money = 30000; S.cur = 13; S.t = 13 * 1440 + 1300; S.loc = 'shop';
      S.book.forEach(b => { if (b.status === 'booked') b.status = 'done'; if (!b.out) b.out = { happy: 70, fish: 4, line: 'x', fare: 1000, refund: 0, tip: 0, net: 1000 }; });
      endDay('home'); closeModals();
      o.turns = S.seasons.length - n0; o.cards = S.mem.cards.length; o.lodge = JSON.parse(JSON.stringify(S.mem.lodge));
      memSeasonStart(1); o.cards2 = S.mem.cards.length; o.lodgeS = S.mem.lodge && S.mem.lodge.s;
      S.reg.king = 'open'; finishWinter(); closeModals();
      o.weeks = weeksOf(1).join(); o.lodgeB = S.book.filter(b => b.lodge).map(b => [weekIdOf(b.d), b.type]);
      // a June king trip: kings on the wall, one king moment however many land
      let kings = 0, moments = 0, rec = null, tries = 0;
      for (let d = 15; d <= 19 && !kings; d++) {
        tries++; closeModals(); S.cur = d; S.t = d * 1440 + 345; S.loc = 'lower'; S.fuel = 30; S.energy = 80; S.dil = null; S.cred.fa = 999; S.ate = { d: -1, n: 0 };
        S.book = S.book.filter(b => b.d !== d); S.mem.rec = {};
        const b = addBooking({ d, type: 'king', n: 4, who: 'king party ' + d, from: 'Idaho', res: false, quirk: [], tr: ['trophy'] });
        tripStart(b); let g = 0, m = 0; while (S.trip && g++ < 30) { m += document.querySelectorAll('#mbg .gm-moment.gm-king').length; MBTN(legalBtn()); }
        m += document.querySelectorAll('#mbg .gm-moment.gm-king').length;
        kings = b.kings || 0; moments = m; rec = S.mem.rec.king || null;
      }
      o.kings = kings; o.moments = moments; o.rec = rec; o.sp = speciesOf('king');
      return o;
    });
    assert.strictEqual(r.turns, 1, 'one season turn'); assert.ok(r.cards >= 1 && r.cards <= 2, 'postcards: ' + r.cards); assert.strictEqual(r.cards2, r.cards, 'not again for the same season');
    assert.ok(r.lodge && r.lodge.s === 1, 'a ★4.7+ season signs the lodge'); assert.strictEqual(r.lodgeS, 1);
    assert.strictEqual(r.weeks, 'june,sep');
    assert.strictEqual(r.lodgeB.length, 2); for (const [wk, type] of r.lodgeB) { assert.ok(['june', 'sep'].includes(wk)); assert.ok(type !== 'reds', type); }
    assert.strictEqual(r.sp, 'king');
    assert.ok(r.kings >= 1, 'some king landed in five tries');
    assert.ok(r.rec && r.rec.type === 'king' && r.rec.z >= 20, JSON.stringify(r.rec));
    assert.strictEqual(r.moments, 1, `one king moment for ${r.kings} kings`);
    noErrors(errors);
  } },
];
