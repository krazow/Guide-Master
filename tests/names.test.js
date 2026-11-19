// Names (src/js/45-names.js): the cabin carries the player's name, the boats carry the names the player gives them (sanitized,
// unique-ish, saved, shown on trips, at the dock, in the shop, on tows, staff trips, the Outfit page and the end screen), plus the
// 1.18.x loose ends: the sockeye emergency orders only in the July weeks, hired guides' own review lines, the spring breakup picture
// on the spring jobs sheet, font fallbacks (self-hosted Fraunces, no bare web font) and the difficulty line in Help.
const fs = require('fs'), path = require('path');
const { open, newGame, noErrors, assert } = require('./helpers');
const ROOT = path.resolve(__dirname, '..');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAASCAIAAAC1qksFAAAALElEQVR4XmPs33megZaAiZaGg8CoBQTBaBARBKNBRBCMBhFBMBpEBAHNgwgAvtgCO1o9jFEAAAAASUVORK5CYII=';

// In the page: run a trip to the dock, take the game to an off-season.
const install = () => {
  window.RUN = () => { let g = 0; while (document.getElementById('mbg') && g++ < 60) { if (S.trip && S.trip.steps[S.trip.step]) MBTN(legalBtn()); else MBTN(0); } };
  window.toWinter = (s, o = {}) => {
    closeModals(); clearTiles(); S.years = o.years || 5; S.rep = o.rep ?? 72; S.money = o.money ?? 80000;
    while (S.seasons.length < s - 1) S.seasons.push({ year: 2026 + S.seasons.length, trips: 18, fares: 18000, earned: 20000, rep: 70, cites: 0 });
    const d = s * SEASON - 1; S.cur = d; S.t = d * 1440 + 1300; S.loc = 'shop'; S.book = S.book.filter(b => b.d < d - 1);
    endDay('home'); closeModals(); clearTiles(); S.rep = o.rep ?? 72; S.money = o.money ?? 80000;
  };
};
const setup = async (ctx, seed = 7) => { const { page, errors } = await open(ctx, { seed }); await newGame(page); await page.evaluate(install); return { page, errors }; };

module.exports = [
  { name: 'cabin: named after the player (always ’s), “Your Cabin” with no name; Home tab, sheets, planner, Help and end screen; follows a rename', fn: async ctx => {
    const { page, errors } = await setup(ctx);
    const r = await page.evaluate(() => {
      const o = {};
      const as = n => { S.name = n; return cabinName(); };
      o.k = as('Krazow'); o.j = as('James'); o.sp = as('  Mary   Ann '); o.def = as(GAME.defaultName); o.empty = as('   ');
      S.name = 'Krazow';
      tab = 'home'; render(); o.h2 = document.querySelector('.place h2').textContent; o.sect = document.querySelector('#app .sect').textContent; tab = 'act'; render();
      o.end = endRows().map(x => x[0]); o.help = HELP.find(x => x[3] === 'cabin')[1];
      o.helpBody = helpBody().includes('Krazow’s Cabin');
      setPlayerName('Dana'); o.renamed = cabinName(); tab = 'home'; render(); o.h2b = document.querySelector('.place h2').textContent; tab = 'act';
      toWinter(1); winterModal(); o.planner = MB.map(b => b.l).find(l => /Cabin/.test(l)); closeModals();
      homeWinterModal(); o.fall = document.querySelector('#mbg h2').textContent; closeModals();
      return o;
    });
    assert.strictEqual(r.k, 'Krazow’s Cabin'); assert.strictEqual(r.j, 'James’s Cabin', 'names ending in s still take ’s');
    assert.strictEqual(r.sp, 'Mary Ann’s Cabin', 'trimmed'); assert.strictEqual(r.def, 'Your Cabin'); assert.strictEqual(r.empty, 'Your Cabin');
    assert.strictEqual(r.h2, '🏠 Krazow’s Cabin'); assert.match(r.sect, /Krazow’s Cabin · condition/);
    assert.ok(r.end.includes('Krazow’s Cabin') && !r.end.includes('The cabin'), r.end.join('|'));
    assert.strictEqual(r.help, 'Krazow’s Cabin'); assert.ok(r.helpBody);
    assert.strictEqual(r.renamed, 'Dana’s Cabin'); assert.strictEqual(r.h2b, '🏠 Dana’s Cabin');
    assert.match(r.planner, /^🏠 Dana’s Cabin: /); assert.match(r.fall, /Get Dana’s Cabin ready for winter/);
    noErrors(errors);
  } },
  { name: 'boat names: sanitized (no HTML, 24 characters, simple punctuation), unique-ish, suggestions never touch Math.random', fn: async ctx => {
    const { page, errors } = await setup(ctx);
    const r = await page.evaluate(() => {
      const c = x => { const v = cleanBoatName(x); return v.err ? 'ERR' : v.name; };
      const o = { html: c('<b>Reel</b> Therapy<script>x</script>'), sp: c('  Lazy   Oar  '), empty: c('   '), tags: c('<img src=x onerror=alert(1)>'), long: c('x'.repeat(25)), max: c('y'.repeat(24)),
        brace: c('{{name}} Boat'), lt: c('A < B'), amp: c('Fish & Chips'), apos: c('Dad’s Boat'), lead: c('-Dash'), emoji: c('Boat 🚤') };
      setBoatName('sled', 'Reel Therapy'); o.dup = setBoatName('drift', 'reel therapy'); o.loan = setBoatName('drift', LOANER_NAME);
      const R = Math.random; let n = 0; Math.random = () => { n++; return R(); };
      try { boatIdea('sled', 0, 'sled'); boatIdea('drift', 3, 'drift'); boatNameAction(); boatNamesModal(); closeModals(); boatNameModal('drift'); closeModals(); } finally { Math.random = R; }
      o.rand = n; o.idea = [0, 1, 2].map(k => boatIdea('sled', k, 'asst'));
      return o;
    });
    assert.strictEqual(r.html, 'Reel Therapyx', 'tags stripped'); assert.strictEqual(r.sp, 'Lazy Oar');
    for (const k of ['empty', 'tags', 'long', 'brace', 'lt', 'lead', 'emoji']) assert.strictEqual(r[k], 'ERR', k);
    assert.strictEqual(r.max, 'y'.repeat(24)); assert.strictEqual(r.amp, 'Fish & Chips'); assert.strictEqual(r.apos, 'Dad’s Boat');
    assert.strictEqual(r.dup, 'reel therapy II', 'a name another boat has gets a II'); assert.strictEqual(r.loan, 'Rust Bucket II II', 'the loaner’s name is taken too');
    assert.strictEqual(r.rand, 0, 'naming draws no random numbers');
    assert.strictEqual(new Set(r.idea).size, 3); assert.ok(!r.idea.includes('Reel Therapy'), 'a suggestion skips names in use');
    noErrors(errors);
  } },
  { name: 'boat names: the Shop & Cabin sheet names them (no pop-up at the start), they persist through a save and load, old saves load unnamed', fn: async ctx => {
    const { page, errors } = await setup(ctx);
    const r = await page.evaluate(() => ({ modal: !!document.getElementById('mbg'), names: JSON.stringify(S.names), a: actionsHere().find(a => /Name your boats/.test(a.l)) ? 1 : 0 }));
    assert.strictEqual(r.modal, false, 'no naming pop-up at game start'); assert.strictEqual(r.names, '{"sled":"","drift":"","asst":""}'); assert.strictEqual(r.a, 1);
    await page.evaluate(() => { actionsHere().find(a => /Name your boats/.test(a.l)).fn(); });
    await page.click('#mbg button.act >> nth=0');            // Your jet sled
    await page.waitForSelector('#bnIn'); await page.fill('#bnIn', '<i>Silver</i>  Ghost'); await page.click('#mbg button.act >> nth=0');
    await page.waitForSelector('#mbg button.act'); await page.click('#mbg button.act >> nth=1');   // Your drift boat
    await page.waitForSelector('#bnIn'); await page.fill('#bnIn', 'Bad <> Name {'); await page.click('#mbg button.act >> nth=0');
    await page.waitForSelector('#bnIn'); const err = await page.evaluate(() => document.getElementById('mbg').innerText);
    await page.fill('#bnIn', 'Lazy Oar'); await page.click('#mbg button.act >> nth=0');
    await page.waitForSelector('#mbg button.act'); await page.click('#mbg button.act >> nth=2');   // Done
    const r2 = await page.evaluate(() => {
      const o = { names: JSON.stringify(S.names), act: actionsHere().find(a => /Boat names/.test(a.l)).s, log: S.log.map(x => x.s).filter(s => /✏️/.test(s)) };
      saveGame(); const d = loadSave(); o.loaded = JSON.stringify(d.S.names);
      const old = JSON.parse(JSON.stringify(packSave())); delete old.S.names; delete old.S.biz.boats; o.old = JSON.stringify(migrate(old).S.names);
      return o;
    });
    assert.match(err, /Letters, numbers, spaces and simple punctuation only/);
    assert.strictEqual(r2.names, '{"sled":"Silver Ghost","drift":"Lazy Oar","asst":""}');
    assert.match(r2.act, /<i>Silver Ghost<\/i> and <i>Lazy Oar<\/i>/); assert.strictEqual(r2.log.length, 2);
    assert.strictEqual(r2.loaded, r2.names, 'saved and loaded'); assert.strictEqual(r2.old, '{"sled":"","drift":"","asst":""}', 'an old save gets empty names');
    noErrors(errors);
  } },
  { name: 'boat names: on the launch, at the dock, in a breakdown, a tow, the shop, a loaner, the end screen; unnamed boats read as before', fn: async ctx => {
    const { page, errors } = await setup(ctx, 5);
    const r = await page.evaluate(() => {
      const o = {}, trip = (type, f) => { closeModals(); clearTiles(); S.cur = 1; S.t = 1440 + TRIPS[type].start - 20; S.loc = TRIPS[type].loc; S.fuel = 30; S.gear = 3; S.money = 9000; S.book = [];
        const b = addBooking({ d: 1, type, n: 2, who: 'Test party', from: 'Ohio', quirk: [] }); if (f) f(b); tripStart(b); const first = document.getElementById('mbg').innerHTML; RUN(); return { first, log: S.log.map(x => x.s).join(' '), b }; };
      o.plain = trip('reds').first.match(/You load[^<]*/)[0];
      setBoatName('sled', 'Silver Ghost'); setBoatName('drift', 'Lazy Oar');
      S.boat = 90; let dockHTML = ''; const mw = window.modalSwap; window.modalSwap = (t, b, x, n) => { if (/Back at the dock/.test(t)) dockHTML = b; return mw(t, b, x, n); };
      o.launch = trip('reds').first; o.dock = dockHTML; window.modalSwap = mw;
      o.drift = trip('trout').first;
      // a worn sled breaks down; a dry tank gets towed
      const R = Math.random; Math.random = () => 0.01; window.modalSwap = (t, b, x, n) => { if (/Back at the dock/.test(t)) dockHTML = b; return mw(t, b, x, n); };
      try { S.boat = 30; trip('reds'); o.brk = dockHTML; } finally { Math.random = R; window.modalSwap = mw; }
      S.log = []; towIn(null); o.tow = S.log.map(x => x.s).join(' ');
      // the shop
      S.loc = 'shop'; S.boat = 50; S.money = 9000; S.log = []; actionsHere().find(a => /Service the boats yourself/.test(a.l)).fn(); actionsHere().find(a => /Dealer 100-hour/.test(a.l)).fn(); o.shop = S.log.map(x => x.s).join(' ');
      S.boat = 0; S.log = []; actionsHere().find(a => /Major repair/.test(a.l)).fn(); o.major = S.log.map(x => x.s).join(' ');
      // a loaner day
      S.boat = 0; S.loaner = -1; S.book = []; S.loc = 'lower'; S.t = 1440 + 340; const lb = addBooking({ d: 1, type: 'reds', n: 2, who: 'Loaner party', from: 'Utah', quirk: [] });
      o.out = actionsHere().find(a => /out of service/.test(a.l)).l;
      S.log = []; actionsHere().find(a => /Rent a loaner/.test(a.l)).fn(); o.rent = S.log.map(x => x.s).join(' ');
      S.t = 1440 + 360; tripStart(lb); o.loanLaunch = document.getElementById('mbg').innerHTML.match(/You load[^]*?push off/)[0]; window.modalSwap = (t, b, x, n) => { if (/Back at the dock/.test(t)) dockHTML = b; return mw(t, b, x, n); }; try { RUN(); } finally { window.modalSwap = mw; } o.loanOut = dockHTML;
      o.end = endRows().find(x => x[0] === 'Your boats');
      return o;
    });
    assert.match(r.plain, /You load the Test party into the jet sled at/, 'unnamed: as before');
    assert.match(r.launch, /into the jet sled <i>Silver Ghost<\/i> at/); assert.match(r.dock, /⚓ <i>Silver Ghost<\/i> goes back on the trailer/);
    assert.match(r.drift, /into the drift boat <i>Lazy Oar<\/i>/);
    assert.match(r.brk, /<i>Silver Ghost<\/i> quits on the way out/); assert.match(r.tow, /takes <i>Silver Ghost<\/i>’s towline/);
    assert.match(r.shop, /<i>Silver Ghost<\/i> purrs/); assert.match(r.shop, /100-hour service on <i>Silver Ghost<\/i>/);
    assert.match(r.major, /rebuilds <i>Silver Ghost<\/i>’s jet unit and you replace <i>Lazy Oar<\/i>’s floor/);
    assert.match(r.out, /Your jet sled <i>Silver Ghost<\/i> is out of service/);
    assert.match(r.rent, /<i>Rust Bucket II<\/i>/); assert.match(r.loanLaunch, /into the loaner <i>Rust Bucket II<\/i>/); assert.match(r.loanOut, /borrowed rig, the <i>Rust Bucket II<\/i>/);
    assert.deepStrictEqual(r.end, ['Your boats', '<i>Silver Ghost</i> (jet sled), <i>Lazy Oar</i> (drift boat)']);
    noErrors(errors);
  } },
  { name: 'boat names: an outfit boat comes with a name, renamed on the Outfit page; staff trips say which boat they ran on', fn: async ctx => {
    const { page, errors } = await setup(ctx, 9);
    const r = await page.evaluate(() => {
      const o = {}; toWinter(3, { money: 200000, rep: 80 }); setBoatName('sled', 'Silver Ghost');
      bizBuyBoat('sled'); const b = S.biz.boats[0]; o.auto = b.name; o.say = S.log.slice(-1)[0].s;
      bizView(true); o.view = EXTRA_TABS.find(t => t.k === 'book').view(); bizView(false);
      setBoatName('b' + b.id, 'Copper Queen'); o.sum = bizStaffSummary();
      // a hired guide's trip on a day you guide too: the extra boat
      finishWinter(); closeModals(); clearTiles(); S.book = S.book.filter(x => x.d < seasonFirst()); S.cur = seasonFirst() + 1; S.t = S.cur * 1440 + 300;
      const Z = BZ(), g = { id: Z.nid++, name: 'Test Guide', kind: 'steady', line: 'x', skill: 60, rel: .99, wage: 300, uscg: true, hired: 2, seasons: 0, mood: 70, streak: 0, last: -9, sn: bizLedger(), tot: { trips: 0, net: 0, cites: 0 } }; Z.staff.push(g);
      const sb = addBooking({ d: S.cur, type: 'reds', n: 2, who: 'Staff party', from: 'Iowa', quirk: [], asst: true, g: g.id });
      o.key = tripBoatKey(sb); const notes = []; bizSettle(sb, g, notes); o.note = notes.join(' '); o.line = sb.out.line;
      o.end = endRows().find(x => x[0] === 'Your boats');
      return o;
    });
    assert.ok(r.auto && r.auto.length <= 24, r.auto); assert.match(r.say, new RegExp(`<i>${r.auto}</i>`));
    assert.ok(r.view.includes(`Second jet sled · <i>${r.auto}</i>`) && /boatNameModal\('b\d+'/.test(r.view) && /boatNameModal\('sled'/.test(r.view), 'Outfit page: names and ✏️ chips');
    assert.match(r.sum, /your jet sled <i>Silver Ghost<\/i>/); assert.match(r.sum, /a second jet sled <i>Copper Queen<\/i>/);
    assert.match(r.key, /^b\d+$/, 'a staff trip takes the extra boat first'); assert.match(r.note, /sockeye trip on <i>Copper Queen<\/i> with the Staff party/); assert.match(r.line, /run by Test on <i>Copper Queen<\/i>/);
    assert.match(r.end[1], /<i>Copper Queen<\/i> \(second jet sled\)/);
    noErrors(errors);
  } },
  { name: 'loose end: the late-run sockeye emergency orders come only in the July weeks (never in June, August or September)', fn: async ctx => {
    const { page, errors } = await setup(ctx, 3);
    const r = await page.evaluate(() => {
      const run = weeks => { S.weeks = { 1: weeks }; S.years = 5; S.reg = genRegs(1); S.reg.mult.sockeye = 1.1; S.limit = 3; S.eo = []; const out = [];
        for (let i = 0; i < SEASON; i++) { const d = SEASON + i; S.cur = d; S.t = d * 1440 + 300; if (i === 0 || i === 7) { S.limit = 3; S.eo = []; } S.cum = 2500000; S.log = [];
          onMorning(d); closeModals(); clearTiles(); out.push({ i, wk: weekIdOf(d), jd: sockEODay(d), eo: S.eo.length, lim: S.limit, said: S.log.some(x => /Emergency order/.test(x.s)) }); }
        return out; };
      return { autumn: run(['aug', 'sep']), june: run(['june', 'aug']), july: run(['jul1', 'jul2']), mixed: run(['jul2', 'sep']) };
    });
    for (const k of ['autumn', 'june']) assert.ok(r[k].every(x => x.eo === 0 && x.lim === 3 && !x.said && x.jd === -1), k + ': ' + JSON.stringify(r[k].filter(x => x.eo || x.said)));
    assert.deepStrictEqual(r.july.map(x => x.jd), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    assert.ok(r.july.some(x => x.said && x.lim === 6), 'a strong July run still raises the limit');
    assert.ok(r.mixed.slice(0, 7).some(x => x.said) && r.mixed.slice(7).every(x => !x.said && x.eo === 0), 'July 20 week yes, September week no: ' + JSON.stringify(r.mixed));
    noErrors(errors);
  } },
  { name: 'loose end: a hired guide’s reviews use their own lines (no gravel-bar lunch), naming the guide', fn: async ctx => {
    const { page, errors } = await setup(ctx, 4);
    const r = await page.evaluate(() => {
      const g = { id: 99, name: 'Jenna Kowalczyk', sn: { stars: 0 } }, b = { d: 1, who: 'Kid party', type: 'reds' }, texts = [];
      for (const k of Object.keys(REV_T)) for (let i = 0; i < 12; i++) { texts.push(staffReview(b, g, 90, 10, { good: [k], bad: [] }).text); texts.push(staffReview(b, g, 30, 1, { good: [], bad: [k] }).text); }
      const own = Object.values(REV_T).flat(2), staff = Object.values(STAFF_REV_T).flat(2);
      return { texts, reused: texts.filter(t => own.some(l => t.includes(l.replace(/Captain \{\{name\}\}/, 'Jenna')))), keys: Object.keys(REV_T).every(k => STAFF_REV_T[k]), named: staff.every(l => l.includes('{g}')) };
    });
    assert.deepStrictEqual(r.reused, [], 'no line of your own trips’ reviews'); assert.ok(r.keys && r.named);
    assert.ok(!r.texts.some(t => /gravel bar|\{g\}|\{\{name\}\}/.test(t)), 'no gravel bar, no placeholder left');
    assert.ok(r.texts.filter(t => /Jenna/.test(t)).length > r.texts.length * .8, 'the guide is named');
    noErrors(errors);
  } },
  { name: 'loose end: the spring jobs sheet shows the spring breakup picture (no extra pop-up)', fn: async ctx => {
    const { page, errors } = await setup(ctx, 6);
    const r = await page.evaluate(png => {
      ART.clear(); ART.register({ id: 't-breakup', set: 'event', file: png, alt: 'A truck sunk in breakup mud.', enabled: true, when: { event: 'breakup_stuck', from: 'home', time: 'day' } });
      setPref('art', true); toWinter(2); homeRollWinterSync(); homeAnswerStorms(); closeModals(); clearTiles();
      const o = { phase: homePhase(), jobs: CabinUpkeep.jobs(homeTicket()).map(j => j.id) };
      homeWinterModal(); const m = document.getElementById('mbg'); o.title = m.querySelector('h2').textContent; o.fig = (m.querySelector('figure.art-fig') || {}).dataset; o.fig = o.fig && o.fig.art;
      o.count = document.querySelectorAll('#mbg').length; closeModals();
      setPref('art', false); homeWinterModal(); o.off = !!document.querySelector('#mbg figure'); closeModals();
      return o;
    }, PNG);
    assert.strictEqual(r.phase, 'spring'); assert.ok(r.jobs.includes('breakup'), r.jobs.join());
    assert.match(r.title, /Spring breakup at T’s Cabin/); assert.strictEqual(r.fig, 't-breakup'); assert.strictEqual(r.count, 1); assert.strictEqual(r.off, false);
    noErrors(errors);
  } },
  { name: 'loose end: fonts: Fraunces self-hosted with font-display swap and precached; every font-family ends in a fallback; the difficulty line in Help', fn: async ctx => {
    const css = fs.readFileSync(path.join(ROOT, 'src/style.css'), 'utf8'), shell = fs.readFileSync(path.join(ROOT, 'src/shell.html'), 'utf8'), sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    assert.ok(fs.existsSync(path.join(ROOT, 'fonts/fraunces-latin-600-normal.woff2')));
    assert.match(shell, /@font-face\{font-family:"Fraunces";src:url\("fonts\/fraunces-latin-600-normal\.woff2"\)[^}]*font-display:swap/);
    assert.ok(sw.includes("'fonts/fraunces-latin-600-normal.woff2'"), 'precached by the service worker');
    const decls = [...css.matchAll(/font-family:([^;}]+)/g)].map(m => m[1].trim());
    assert.ok(decls.length > 5);
    const vars = Object.fromEntries([...css.matchAll(/--(serif|sans):([^;]+);/g)].map(m => [m[1], m[2]]));
    assert.match(vars.serif, /^"Fraunces",.*serif$/); assert.match(vars.sans, /^"DM Sans",.*sans-serif$/);
    for (const d of decls) assert.ok(/^var\(--(serif|sans)\)$/.test(d) || /(sans-serif|serif)$/.test(d), 'no bare web font: ' + d);
    const js = fs.readdirSync(path.join(ROOT, 'src/js')).map(f => fs.readFileSync(path.join(ROOT, 'src/js', f), 'utf8')).join('\n');
    assert.ok(!/font-family:\s*"?(Fraunces|DM Sans)"?\s*[;"']/.test(js) && !/font-family="DM Sans"/.test(js), 'inline styles and SVG text have fallbacks too');
    const { page, errors } = await open(ctx);
    const r = await page.evaluate(() => ({ tag: getComputedStyle(document.querySelector('.title h1 span')).fontFamily, help: helpBody().replace(/<[^>]+>/g, ''), rules: RULES_HTML }));
    assert.match(r.tag, /DM Sans.*sans-serif/, 'the tagline falls back to a sans, not the default serif');
    assert.ok(/5–15% less on Combat Season, about half a grade/.test(r.help) && /17% more on Rookie Season, a full grade/.test(r.help), 'Help states the measured gaps');
    assert.ok(!/about a step lower|about a step higher/.test(r.help + r.rules));
    noErrors(errors);
  } },
];
