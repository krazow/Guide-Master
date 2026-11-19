// The Help sheet (src/js/26-help.js): every section renders, icons are unique, the contents jump to each section (tap and keyboard),
// it reads like a player guide (no code words), and the numbers it quotes are the game's own (read from the game's constants at runtime).
const { open, newGame, noErrors, assert } = require('./helpers');

const WORD = { two: 2, three: 3, four: 4, five: 5, ten: 10 };
// what Help says, as plain text with the HTML taken out (the same words a player reads)
const helpText = () => HELP.map(h => h[1] + ' ' + h[2].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ')).join('\n');

module.exports = [
  { name: 'help: every section renders, in order, with a summary and bullets; titles, icons and anchors are unique', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const r = await page.evaluate(() => {
      closeModals(); helpModal();
      const m = document.querySelector('#mbg'), secs = [...m.querySelectorAll('.help-sec')];
      return {
        n: HELP.length, title: m.querySelector('h2').textContent,
        secs: secs.map(s => ({ id: s.id, h: s.querySelector('h3').textContent.replace('↑', '').trim(), sum: (s.querySelector('.help-sum') || {}).textContent || '', li: s.querySelectorAll('li').length })),
        help: HELP.map(h => ({ ic: h[0], t: h[1], k: h[3] })), btns: MB.map(b => b.l),
      };
    });
    assert.ok(r.n >= 15 && r.n <= 22, `${r.n} sections`); assert.match(r.title, /How to play/);
    assert.strictEqual(r.secs.length, r.n, 'one section on the sheet for each Help entry');
    r.secs.forEach((s, i) => {
      assert.strictEqual(s.id, 'help-' + r.help[i].k, `section ${i} anchor`);
      assert.strictEqual(s.h, `${r.help[i].ic} ${r.help[i].t}`, `section ${i} heading`);
      assert.ok(s.sum.length > 20 && s.sum.length < 140, `a one-line summary for ${s.h}: ${s.sum}`);
      assert.ok(s.li >= 2 && s.li <= 8, `a few bullets in ${s.h}: ${s.li}`);
    });
    for (const k of ['ic', 't', 'k']) assert.strictEqual(new Set(r.help.map(h => h[k])).size, r.n, `unique ${k}: ${r.help.map(h => h[k]).join(' ')}`);
    // the order a new player meets things: getting started first, the first trip next, feedback last
    assert.deepStrictEqual([r.help[0].k, r.help[1].k, r.help[r.n - 1].k], ['start', 'trip', 'feedback']);
    // the topics the game has now, each with a section
    for (const re of [/first trip/i, /clients/i, /fish/i, /rules/i, /money/i, /rating/i, /season/i, /fuel/i, /cabin/i, /camping/i, /business/i, /trophy/i, /mentor/i, /settings/i, /tips/i, /install/i, /feedback/i])
      assert.ok(r.help.some(h => re.test(h.t)), `a section for ${re}`);
    assert.deepStrictEqual(r.btns.filter(l => /Got it|Send feedback/.test(l)).length, 2, r.btns.join(' | '));
    noErrors(errors);
  } },
  { name: 'help: the contents list every section and jump to it (tap and keyboard), and the arrow comes back up', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    await page.evaluate(() => helpModal());
    await page.waitForSelector('#mbg .help-toc');
    const toc = await page.$$eval('#mbg .help-toc a', as => as.map(a => ({ href: a.getAttribute('href'), t: a.textContent })));
    const ids = await page.evaluate(() => HELP.map(h => ({ k: h[3], t: h[0] + ' ' + h[1] })));
    assert.deepStrictEqual(toc.map(x => x.href), ids.map(x => '#help-' + x.k)); assert.deepStrictEqual(toc.map(x => x.t), ids.map(x => x.t));
    const where = k => page.evaluate(k => {
      const m = document.querySelector('#mbg .modal'), s = document.getElementById('help-' + k), a = document.activeElement;
      return { top: Math.round(s.getBoundingClientRect().top - m.getBoundingClientRect().top), h: m.clientHeight, focus: a && a.id, scrolled: m.scrollTop, hash: location.hash };
    }, k);
    // a tap on a contents link (the sheet scrolls to the section; focus goes to its heading; the address doesn't change)
    await page.evaluate(() => document.documentElement.classList.add('rm'));   // reduce motion: the jump is instant
    for (const k of ['cabin', 'feedback', 'rating']) {
      await page.evaluate(() => { document.querySelector('#mbg .modal').scrollTop = 0 });
      await page.click(`#mbg .help-toc a[href="#help-${k}"]`);
      await page.waitForTimeout(50);
      const w = await where(k);
      assert.strictEqual(w.focus, `help-${k}-h`, `focus on the ${k} heading`); assert.ok(w.scrolled > 0, 'the sheet scrolled');
      assert.ok(w.top >= -2 && w.top < w.h, `the ${k} section is in view: ${JSON.stringify(w)}`); assert.strictEqual(w.hash, '');
    }
    // keyboard: Tab to a link, Enter
    await page.evaluate(() => { document.querySelector('#mbg .modal').scrollTop = 0; document.querySelector('#mbg .help-toc a[href="#help-money"]').focus() });
    await page.keyboard.press('Enter'); await page.waitForTimeout(50);
    const kb = await where('money'); assert.strictEqual(kb.focus, 'help-money-h'); assert.ok(kb.top >= -2 && kb.top < kb.h, JSON.stringify(kb));
    // the arrow next to a heading goes back to the contents
    await page.click('#help-money .help-up'); await page.waitForTimeout(50);
    const up = await page.evaluate(() => ({ focus: document.activeElement && document.activeElement.id, top: document.querySelector('#mbg .modal').scrollTop }));
    assert.strictEqual(up.focus, 'help-toc'); assert.ok(up.top < 200, `back near the top: ${up.top}`);
    // every link and arrow is a big enough target
    const small = await page.$$eval('#mbg .help-toc a, #mbg .help-up', as => as.filter(a => { const r = a.getBoundingClientRect(); return r.height < 44 || r.width < 44 }).length);
    assert.strictEqual(small, 0, 'links at least 44 px');
    // Got it still closes it
    await page.click('#mbg button.act >> text=Got it'); assert.strictEqual(await page.$('#mbg'), null);
    noErrors(errors);
  } },
  { name: 'help: written for players: no code words, short sentences', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const t = await page.evaluate(helpText);
    const deny = /\bS\.[a-z]|\bschema\b|\bbots?\b|\bids?\b|localStorage|\bmodal\b|\bJSON\b|\bundefined\b|\bnull\b|\bNaN\b|\bprefs?\b|\bfireHook\b|\bhook:|\bfunction\b|\bmigrat|\brender\b|\bsimulat|\bconsole\b|\bcache\b|\bservice worker\b|\bRNG\b|\bstate\.|=>|\{\{|\$\{|\bsplice\b|\.js\b/i;
    const bad = t.split('\n').filter(l => deny.test(l)).map(l => l.match(deny)[0]);
    assert.deepStrictEqual(bad, [], 'developer terms in Help');
    const long = t.split(/(?<=[.!?:])\s+/).filter(s => s.split(/\s+/).length > 45);
    assert.deepStrictEqual(long, [], 'sentences short enough for a phone');
    noErrors(errors);
  } },
  { name: 'help: the numbers it quotes are the game’s (grades, rating milestones, the outfit, winter days, boat, fuel, losing)', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const r = await page.evaluate(([help]) => {
      const t = eval(help)();
      const loss = {}; const m0 = S.money, c0 = S.cites, r0 = S.rep;
      S.money = -2000; loss.at = checkLoss(); S.money = -2001; loss.past = checkLoss(); S.money = m0;
      S.cites = 2; loss.c2 = checkLoss(); S.cites = 3; loss.c3 = checkLoss(); S.cites = c0; S.rep = 0; loss.rep = checkLoss(); S.rep = r0;
      return { t, cuts: GRADE_CUTS, stars: { top: STAR_TOP, topN: STAR_TOP_N, feat: STAR_FEAT, featN: STAR_FEAT_N, lodge: STAR_LODGE, off: STAR_LODGE_OFF, low: STAR_LOW, n: RATE_N, fee: LODGE_FEE },
        biz: { rep: BIZ_REP, boats: BIZ_MAX_BOATS, unlock: BIZ_UNLOCK }, camp: { days: KenaiCamp.data.WINTER_DAYS, trips: KenaiCamp.data.MAX_TRIPS, jobs: KenaiCamp.data.MAX_GIGS },
        cab: { max: CabinUpkeep.MAX_DUE, grace: CabinUpkeep.GRACE }, boat: { major: MAJOR_REPAIR, patch: PATCH_COST, patchMax: PATCH_MAX, loan: LOANER_COST },
        fuel: { reds: BURN.reds, silver: BURN.silver, tow: HARBOR_TOW, launch: LAUNCH_FEE }, dil: DIL_MAX, req: REQ_WAIT, years: Object.keys(CAREERS).map(Number), alarm: GAME.wake, loss };
    }, [helpText.toString()]);
    const t = r.t, num = s => Number(String(s).replace(/,/g, '')), has = (re, why) => { const m = t.match(re); assert.ok(m, `${why}: ${re}`); return m };
    // grades: A, B, C, D cutoffs, in order, exactly the game's
    const g = has(/A (\d{2},\d{3}), B (\d{2},\d{3}), C (\d{2},\d{3}), D (\d{2},\d{3})/, 'grade cutoffs');
    assert.deepStrictEqual(g.slice(1).map(num), r.cuts);
    // every ★ value Help quotes is a milestone in the game, and every milestone is quoted
    const S_ = r.stars, quoted = [...t.matchAll(/★(\d\.\d)/g)].map(m => Number(m[1])), ms = [S_.top, S_.feat, S_.lodge, S_.off, S_.low];
    assert.ok(quoted.length >= 5 && quoted.every(x => ms.includes(x)), `★ values ${quoted} against ${ms}`); ms.forEach(x => assert.ok(quoted.includes(x), `★${x} quoted`));
    assert.strictEqual(num(has(/★4\.5 with (\d+)\+ reviews/, 'top-rated reviews')[1]), S_.topN); assert.strictEqual(num(has(/★4\.7 with (\d+)\+ reviews/, 'magazine reviews')[1]), S_.featN);
    assert.strictEqual(Number(has(/★(\d\.\d)[^.]*top-rated/, 'top-rated')[1]), S_.top); assert.strictEqual(Number(has(/★(\d\.\d)[^.]*magazine/, 'magazine')[1]), S_.feat);
    assert.strictEqual(Number(has(/season that averages ★(\d\.\d)/, 'lodge')[1]), S_.lodge); assert.strictEqual(Number(has(/falls under ★(\d\.\d)/, 'lodge ends')[1]), S_.off);
    assert.strictEqual(Number(has(/Under ★(\d\.\d)/, 'low rating')[1]), S_.low);
    assert.strictEqual(num(has(/last (\d+) reviews/, 'reviews in the rating')[1]), S_.n); assert.strictEqual(num(has(/for a (\d+)% fee/, 'lodge fee')[1]) / 100, S_.fee);
    // the outfit
    const rep = has(/reputation (\d+), (\d+) and (\d+) for the first, second and third/, 'guide reputation'); assert.deepStrictEqual(rep.slice(1).map(num), r.biz.rep);
    assert.strictEqual(WORD[has(/up to (\w+) guides/, 'guides')[1]], r.biz.rep.length);
    assert.strictEqual(WORD[has(/up to (\w+) more boats/, 'boats')[1]], r.biz.boats); assert.match(t, new RegExp(['first', 'second', 'third'][r.biz.unlock] + ' off-season'));
    // the winter budget, the cabin
    assert.deepStrictEqual(has(/(\d+) free days each winter for up to (\d+) camping trips and (\d+) winter jobs/, 'winter budget').slice(1).map(num), [r.camp.days, r.camp.trips, r.camp.jobs]);
    assert.strictEqual(num(has(/same (\d+) free days as winter camping/, 'cabin days')[1]), r.camp.days);
    assert.strictEqual(WORD[has(/Never more than (\w+) show at once/, 'cabin jobs')[1]], r.cab.max); assert.strictEqual(r.cab.grace, 7); assert.match(t, /first week/);
    // boat, fuel, fees
    const b = has(/\$([\d,]+) major repair; a \$([\d,]+) emergency patch \(at (\d+) or less\) or a \$([\d,]+) loaner/, 'boat rescue');
    assert.deepStrictEqual(b.slice(1).map(num), [r.boat.major, r.boat.patch, r.boat.patchMax, r.boat.loan]);
    assert.deepStrictEqual(has(/sockeye trip burns about (\d+) gallons, a silver trip about (\d+)/, 'fuel burn').slice(1).map(num), [r.fuel.reds, r.fuel.silver]);
    assert.strictEqual(num(has(/\$(\d+) harbor assist/, 'tow')[1]), r.fuel.tow); assert.strictEqual(num(has(/\$(\d+) launch fee/, 'launch fee')[1]), r.fuel.launch);
    assert.match(t, /Kenai Harbor fuel dock/);
    // requests wait, the alarm, career lengths
    assert.strictEqual(WORD[has(/Bookings for (\w+) days/, 'requests wait')[1]], r.req);
    assert.strictEqual(r.alarm, 300); assert.match(t, /alarm rings at 5:00 AM/); assert.deepStrictEqual(r.years, [2, 5, 10]); assert.match(t, /2-, 5- or 10-year career/);
    // how a career ends early: 3 active citations, reputation 0, more than $2,000 in debt
    assert.match(t, /3 active citations/); assert.match(t, /reputation at 0/); assert.match(t, /more than \$2,000 in debt/);
    assert.deepStrictEqual(r.loss, { at: null, past: 'broke', c2: null, c3: 'permit', rep: 'reviews' });
    noErrors(errors);
  } },
  { name: 'help: opens from the title screen with no game, and from ⚙️ Settings mid-game; its buttons still work', fn: async ctx => {
    const { page, errors } = await open(ctx);
    // the title screen, no saved game: no mentor button (nothing to ride along on), feedback opens and comes back to Help
    await page.click('.title button >> text=Help!');
    let b = await page.evaluate(() => MB.map(x => x.l));
    assert.ok(!b.some(l => /mentor/.test(l)), b.join(' | '));
    await page.click('#mbg button.act >> text=Send feedback'); await page.waitForTimeout(30);
    assert.match(await page.textContent('#mbg h2'), /feedback/i);
    await page.evaluate(() => closeModals());
    // mid-game, through Settings
    await newGame(page);
    await page.evaluate(() => { openSettings(); MBTN(MB.findIndex(x => /^❓ Help/.test(x.l))) }); await page.waitForTimeout(30);
    assert.ok(await page.$('#mbg .help-toc'), 'Help from Settings');
    b = await page.evaluate(() => MB.map(x => x.l)); assert.ok(b.some(l => /Ride with the mentor again/.test(l)), b.join(' | '));
    noErrors(errors);
  } },
];
