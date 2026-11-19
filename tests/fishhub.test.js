// The four commercial modules together (1.19.0, src/js/41b-fishhub.js): one "⚓ Commercial & crab" sheet whose sections open on their
// own unlocks, one commercial activity a day, the same booked-party choice, the Here and Bookings tabs together, and the delivery contract
// (gillnet, seine and crab-job reports carry delivery; your own tender or plant buys it at your own price when it works that water).
const fs = require('fs'), path = require('path');
const { open, newGame, noErrors, assert } = require('./helpers');
const ROOT = path.join(__dirname, '..');

const install = () => {
  window.toWinter = (s, o = {}) => {   // finish season s-1 and open the off-season before season s
    closeModals(); clearTiles(); S.years = o.years || 5; S.rep = o.rep ?? 70; S.money = o.money ?? 60000;
    while (S.seasons.length < s - 1) S.seasons.push({ year: 2026 + S.seasons.length, trips: 18, fares: 18000, earned: 20000, rep: 70, cites: 0 });
    const d = s * SEASON - 1; S.cur = d; S.t = d * 1440 + 1300; S.loc = 'shop'; S.book = S.book.filter(b => b.d < d - 1);
    endDay('home'); closeModals(); clearTiles(); S.rep = o.rep ?? 70; S.money = o.money ?? 60000;
  };
  // a chartered tender in an area, its season open, mid-summer of season 3 (5 AM, at the shop)
  window.withTender = (area = 'uci') => {
    S.cur = 3 * SEASON + 1; S.t = S.cur * 1440 + 300; S.loc = 'shop'; S.money = 200000; S.rep = 70; S.seasons = [{}, {}, {}]; S.winter = null;
    tenderApply(Tender.act(tenderTicket({ phase: 'winter', s: 3 }), 'lease', { area }), true);
    tenderApply(Tender.openSeason(tenderTicket({ phase: 'summer' })), true);
    return S.fish.tender;
  };
  window.todayOpener = () => { const st = S.fish.tender, md = tenderTicket().md; for (const a of ['uci', 'lci']) if (!st.season.cal[a].includes(md)) st.season.cal[a].push(md); };
};
const setup = async (ctx, seed = 5) => { const { page, errors } = await open(ctx, { seed }); await newGame(page); await page.evaluate(install); return { page, errors }; };

module.exports = [
  { name: 'fishhub: one shared definition of the sheet (41b-fishhub.js), none left in the adapters; the build order; the one line in winterModal', fn: async () => {
    const js = Object.fromEntries(fs.readdirSync(path.join(ROOT, 'src/js')).map(f => [f, fs.readFileSync(path.join(ROOT, 'src/js', f), 'utf8')]));
    const where = re => Object.keys(js).filter(f => re.test(js[f]));
    assert.deepStrictEqual(where(/var FISH_HUB\b/), ['41b-fishhub.js']);
    for (const n of ['fishHubList', 'fishHubOn', 'fishWinterBtns', 'fishHubModal']) assert.deepStrictEqual(where(new RegExp(`function ${n}\\b|\\b${n}\\s*=\\s*(typeof|function)`)), ['41b-fishhub.js'], n);
    assert.deepStrictEqual(where(/FISH_HUB\.push\(/).sort(), ['42-gillnet.js', '43-seine.js', '44-crab.js', '46-tender.js']);
    assert.ok(!js['45-tender.js'] && js['46-tender.js'] && js['45-names.js'], 'the tender adapter is 46 (45 is the names)');
    assert.strictEqual((js['24-career.js'].match(/fishWinterBtns\(\)/g) || []).length, 1);
    assert.match(fs.readFileSync(path.join(ROOT, 'tools/build.py'), 'utf8'), /\('camp', 'home', 'gillnet', 'seine', 'crab', 'tender', 'js'\)/);
  } },
  { name: 'fishhub: nothing in the first off-season; gillnetting, seining and crabbing from the second; the fish business joins in the third', fn: async ctx => {
    const { page, errors } = await setup(ctx);
    const r = await page.evaluate(async () => {
      const out = {};
      for (const s of [1, 2, 3]) {
        toWinter(s); S.cabin.rolled = S.winter.s;
        winterModal(); const b = MB.map(x => x.l); closeModals();
        out[s] = { btn: b.filter(l => /Commercial & crab/.test(l)).length, last: b[b.length - 2], list: fishHubList().map(x => x.id) };
        if (s === 3) { fishHubModal(); out.sheet = MB.map(x => x.l); closeModals(); }
        finishWinter(); closeModals();
      }
      return out;
    });
    assert.deepStrictEqual(r[1], { btn: 0, last: r[1].last, list: [] });
    assert.deepStrictEqual(r[2].list, ['gillnet', 'seine', 'crab']); assert.strictEqual(r[2].btn, 1); assert.match(r[2].last, /Commercial & crab/);
    assert.deepStrictEqual(r[3].list, ['gillnet', 'seine', 'crab', 'tender']);
    assert.deepStrictEqual(r.sheet.map(l => l.replace(/^[^A-Za-z]+/, '')), ['Gillnetting: setnet or drift', 'Purse seining out of Homer', 'Crabbing', 'Fish buying & processing', 'Back to the off-season']);
    noErrors(errors);
  } },
  { name: 'fishhub: delivery contract: your own tender buys your catch in its own water at your posted price (the difference times your share); elsewhere an outside buyer', fn: async ctx => {
    const { page, errors } = await setup(ctx);
    const r = await page.evaluate(() => {
      withTender('uci'); const out = { uci: tenderBuyerIn('Upper Cook Inlet'), lci: tenderBuyerIn('Kachemak Bay (Lower Cook Inlet)'), west: tenderBuyerIn('Dutch Harbor (out west)') };
      out.none = fishDeliver({ species: 'sockeye', lbs: 800, area: 'Kachemak Bay (Lower Cook Inlet)', day: day(), value: 1300, share: .1 });
      const own0 = (S.fish.tender.season.own.uci || {}).sockeye || 0;
      const x = fishDeliver({ species: 'sockeye', lbs: 1000, area: 'Upper Cook Inlet', day: day(), value: 1500, share: .12 });
      out.x = x; out.own = S.fish.tender.season.own.uci.sockeye - own0; out.want = Math.round(Math.max(0, x.value - 1500) * .12);
      out.price = S.fish.tender.season.going.sockeye;
      // the gillnet adapter applies it: a crew share on a drift boat, through gnApply
      const d = day(); GNS().plan = { s: seasonOf(d), id: 'drift:crew', kind: 'drift', role: 'crew', paid: 0 };
      const m0 = S.money, own1 = S.fish.tender.season.own.uci.sockeye;
      const rep = { kind: 'drift', role: 'crew', fish: 200, lbs: 1200, gross: 1800, cashDelta: 216, energyDelta: -20, minutes: 60, cites: [], events: [], lines: ['x'], xp: 1,
        delivery: { species: 'sockeye', lbs: 1200, area: 'Upper Cook Inlet', day: null, value: 1800, share: .12 } };
      const a = gnApply(rep, d); out.gn = { paid: S.money - m0, routed: !!a.routed, diff: a.routed && a.routed.diff, lbs: S.fish.tender.season.own.uci.sockeye - own1, net: GNS().done[d].net, log: S.log.slice(-4).map(l => l.s).join(' ') };
      return out;
    });
    assert.deepStrictEqual([r.uci, r.lci, r.west], [true, false, false]);
    assert.strictEqual(r.none, null, 'no buyer in Kachemak Bay: the outside tender buys it');
    assert.ok(r.x && r.x.value > 0 && r.x.diff === r.want, JSON.stringify(r.x)); assert.strictEqual(r.own, 1000, 'the fish are in your tender’s books');
    assert.ok(r.x.lines.some(l => /your own tender/.test(l)), r.x.lines.join(' '));
    assert.ok(r.gn.routed); assert.strictEqual(r.gn.paid, 216 + r.gn.diff); assert.strictEqual(r.gn.lbs, 1200); assert.strictEqual(r.gn.net, 216 + r.gn.diff);
    assert.match(r.gn.log, /your own tender/);
    noErrors(errors);
  } },
  { name: 'fishhub: delivery contract from the engines: gillnet, seine and crab-job reports carry delivery; the seine and crab adapters route it', fn: async ctx => {
    const { page, errors } = await setup(ctx);
    const r = await page.evaluate(() => {
      const out = {};
      // gillnet: a headless drift opener, crew
      const gt = { kind: 'drift', role: 'crew', day: { st: 'open', area: 'district', hours: [420, 1140], reg: true, dow: 'Mon', md: 716, ann: 0 }, seine: false, run: 1, price: 1.6, wind: 8, wx: 'sun',
        tides: [{ m: 300, h: 2, hi: false }, { m: 680, h: 20, hi: true }, { m: 1050, h: 1, hi: false }], amp: 18, now: 300, energy: 90, cash: 5000, xp: 0, suit: true, exam: false, king: 'open', costMult: 1, fuel: 5, skipper: 'Dale', d: 31 };
      const gr = Gillnet.sim({ ticket: gt, seed: 3, policy: 'sensible' }).report; out.gn = gr.delivery; out.gnGross = gr.gross; out.gnFish = gr.lbs;
      // seine: a crew opener in July
      withTender('lci'); const d = day();
      const st = SN(); st.st.plan = { s: seasonOf(d), role: 'crew', route: '', cap: 0 }; seineSchedule(seasonOf(d));
      const o = { d, md: mdOf(d), dow: sday(d) % 7, run: 'x', ans: 'yes', done: false };
      let sr = null; for (let k = 1; k < 40 && !(sr && sr.delivery); k++) sr = Seine.sim({ ticket: seineTicket(o, 0), rand: (() => { let a = k * 977; return () => { a = (a * 16807) % 2147483647; return a / 2147483647 } })(), policy: 'careful' }).report;
      out.sn = sr.delivery;
      const m0 = S.money, a = seineApply(sr, o); out.snPaid = S.money - m0; out.snCash = Math.round(sr.cashDelta); out.snRouted = a.routed && a.routed.diff;
      // crab: the deckhand job's report, and the adapter routing it to a floater out west (stubbed: the business side is tested above)
      const job = Crab.autoJob(Object.assign(crabTicket(), { phase: 'winter', daysLeft: 10, cash: 9000 }), { rand: (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647 } })(), policy: 'careful' }).report;
      out.cb = job.delivery;
      const keep = [window.tenderBuyerIn, window.tenderRoute];
      try {
        window.tenderBuyerIn = a => /Dutch/.test(a); window.tenderRoute = dl => ({ price: 5, value: dl.lbs * 5, area: 'west', species: 'crab', line: '🤝 to your own floater' });
        const m1 = S.money; const ap = crabApply(job, true); out.cbPaid = S.money - m1; out.cbCash = job.cashDelta; out.cbDiff = ap.routed && ap.routed.diff;
      } finally { window.tenderBuyerIn = keep[0]; window.tenderRoute = keep[1]; }
      return out;
    });
    assert.ok(r.gn && r.gn.species === 'sockeye' && r.gn.lbs === r.gnFish && r.gn.value === r.gnGross && /Upper Cook Inlet/.test(r.gn.area) && r.gn.day === 31 && Math.abs(r.gn.share - .12) < 1e-9, JSON.stringify(r.gn));
    assert.ok(r.sn && /Kachemak/.test(r.sn.area) && r.sn.lbs > 0 && r.sn.parts.length >= 1 && r.sn.share > 0 && r.sn.share <= 1, JSON.stringify(r.sn));
    assert.ok(typeof r.snRouted === 'number', 'your own tender in Kachemak Bay buys the seiner’s fish'); assert.strictEqual(r.snPaid, r.snCash + r.snRouted, 'the share at your own price');
    assert.ok(r.cb && r.cb.species === 'crab' && /Dutch Harbor/.test(r.cb.area) && r.cb.lbs > 0 && r.cb.share > 0 && r.cb.share <= 1, JSON.stringify(r.cb));
    assert.strictEqual(r.cbDiff, Math.round(Math.max(0, r.cb.lbs * 5 - r.cb.value) * r.cb.share)); assert.strictEqual(r.cbPaid, r.cbCash);
    noErrors(errors);
  } },
  { name: 'fishhub: one commercial activity a day; today’s openers together under “⚓ Commercial today”; the same booked-party choice (hand off, cancel −5, keep)', fn: async ctx => {
    const { page, errors } = await setup(ctx);
    const r = await page.evaluate(() => {
      withTender('uci'); todayOpener(); const d = day(), out = {};
      const acts = () => actionsHere().filter(a => a.cat === 'comm').map(a => a.l);
      out.a0 = acts(); out.cats = ACT_CATS.comm;
      out.book0 = EXTRA_TABS.find(t => t.k === 'book').view();
      fishClaim(d, 'gillnet'); out.a1 = acts(); out.taken = fishTaken(d, 'tender'); out.book1 = EXTRA_TABS.find(t => t.k === 'book').view();
      S.fish.today = null; out.a2 = acts();
      // the booked-party choice, from the tender
      addBooking({ d, type: 'reds', n: 2, who: 'Testers', from: 'Ohio', res: false, quirk: [] });
      const r0 = S.rep; actionsHere().find(a => /Run your tender/.test(a.l)).fn(); out.t = document.querySelector('#mbg h2').textContent; out.b = MB.map(x => x.l);
      MBTN(MB.findIndex(x => /^Cancel/.test(x.l))); out.rep = r0 - S.rep; out.cancelled = S.book.find(b => b.who === 'Testers').status; out.claim = S.fish.today; closeModals();
      return out;
    });
    assert.strictEqual(r.cats, '⚓ Commercial today');
    assert.ok(r.a0.some(l => /Run your tender/.test(l)), r.a0.join(' | '));
    assert.ok(!r.a1.some(l => /Run your tender/.test(l)), 'the gillnet opener took the day'); assert.strictEqual(r.taken, 'gillnet'); assert.match(r.book1, /fishing the gillnet opener today/);
    assert.ok(r.a2.some(l => /Run your tender/.test(l)));
    const i = r.book0.indexOf('Commercial today'), j = r.book0.indexOf('<div class="sect">Season '); assert.ok(i > 0 && j > i, 'the commercial block sits above the season’s days');
    assert.match(r.t, /You’re booked today/); assert.ok(r.b.some(l => /^Cancel the trip, and go/.test(l)) && r.b.some(l => /Let the skipper run/.test(l)), r.b.join(' | '));
    assert.strictEqual(r.rep, 5); assert.strictEqual(r.cancelled, 'cancelled'); assert.deepStrictEqual(r.claim && r.claim.id, 'tender');
    noErrors(errors);
  } },
  { name: 'fishhub: Help: the four sections just before Feedback, unique icons; the unlocks it states are the code’s (second / third off-season; the outfit the second)', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const r = await page.evaluate(() => ({ k: HELP.slice(-5).map(h => h[3]), ic: HELP.map(h => h[0]), t: Object.fromEntries(HELP.map(h => [h[3], h[2].replace(/<[^>]+>/g, ' ')])),
      u: { gn: Gillnet.data.UNLOCK, sn: SEINE_UNLOCK, cr: CRAB_UNLOCK, td: TENDER_UNLOCK, biz: BIZ_UNLOCK } }));
    assert.deepStrictEqual(r.k, ['gillnet', 'seine', 'crab', 'tender', 'feedback']); assert.strictEqual(new Set(r.ic).size, r.ic.length);
    const W = ['', 'first', 'second', 'third'];
    assert.match(r.t.gillnet, new RegExp(W[r.u.gn] + ' off-season')); assert.match(r.t.seine, new RegExp(W[r.u.sn] + ' off-season')); assert.match(r.t.crab, new RegExp(W[r.u.cr] + ' off-season'));
    assert.match(r.t.tender, new RegExp(`With ${r.u.td} seasons behind you`)); assert.strictEqual(r.u.td, 3);
    assert.match(r.t.outfit, new RegExp(W[r.u.biz] + ' off-season')); assert.strictEqual(r.u.biz, 2);
    assert.match(r.t.tender, /your own tender or plant buys it/);
    noErrors(errors);
  } },
];
