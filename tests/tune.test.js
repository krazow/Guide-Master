// 1.8.1 balance tune: a rule-breaking habit catches up with you over a season (22-trips.js: heat, word of mouth,
// public citations), and a hungry guide gets a warning with a quick, pricier fix (31-supplies.js).
const { open, newGame, noErrors, assert } = require('./helpers');

async function quiet(ctx, diff, seed) {
  const o = await open(ctx, { seed: seed || 81 });
  await newGame(o.page, diff);
  await o.page.evaluate(() => { closeModals(); S.cur = 1; S.t = 1440 + 600; S.book = []; S.loc = 'shop'; });
  return o;
}
const MK = `window.mk = (type, d, id) => ({ id: id || 900 + d, d, type, n: 3, who: 'Test ' + d, from: 'Ohio', res: false, quirk: [], status: 'booked' });`;

module.exports = [
  { name: 'heat: every rule broken this season raises the catch chance of the next; a new season starts clean', fn: async ctx => {
    const { page, errors } = await quiet(ctx, 'normal', 82);
    const r = await page.evaluate(() => {
      const oc = window.cite; let n = 0; window.cite = () => { n++; };
      const rate = h => { n = 0; for (let i = 0; i < 4000; i++) { S.stats.viol = (S.st0 ? S.st0.viol || 0 : 0) + h; violate([], { p: .3, fine: 400, what: 'x' }); } return n / 4000; };
      S.st0 = { viol: 0 };
      const out = { h0: rate(0), h4: rate(4), heatP: HEAT_P };
      S.stats.viol = 6; out.heatNow = heat();
      S.st0 = JSON.parse(JSON.stringify(S.stats)); out.heatNewSeason = heat();
      window.cite = oc; return out;
    });
    assert.ok(Math.abs(r.h0 - .3) < .03, JSON.stringify(r));
    assert.ok(Math.abs(r.h4 - .3 * (1 + 4 * r.heatP)) < .04, 'four earlier violations: catch chance × (1 + 4 × HEAT_P) ' + JSON.stringify(r));
    assert.strictEqual(r.heatNow, 6); assert.strictEqual(r.heatNewSeason, 0);
    noErrors(errors);
  } },
  { name: 'heat: a guide who sees it costs word of mouth; the trip pop-up and a tag warn you once you have a habit', fn: async ctx => {
    const { page, errors } = await quiet(ctx, 'normal', 83);
    const r = await page.evaluate(() => {
      const R = Math.random; const seq = [.99, .1]; Math.random = () => seq.length ? seq.shift() : R();   // not caught, but seen
      S.wom = 0; S.rep = 60; const notes = []; violate(notes, { p: .3, fine: 400, what: 'x' }); Math.random = R;
      const seen = { wom: S.wom, rep: S.rep, note: notes.join(' ') };
      const tags0 = statusTags().join(' ');
      S.st0 = { viol: 0 }; S.stats.viol = 2; const tags2 = statusTags().join(' ');
      // a trip at the dilemma about extra rods (it has an illegal option)
      const b = { id: 950, d: day(), type: 'reds', n: 3, who: 'Heat party', from: 'Ohio', res: false, quirk: [], status: 'booked' }; S.book.push(b);
      S.trip = { id: 950, late: 0, q: 0, happy: 0, notes: [], step: 0, steps: ['extra_rod'], shore: false, nofish: 0, kept: 0, abort: false, x: [], lost: 0, boat0: 100 };
      tripNext(); const hot = document.querySelector('#mbg .heat-note'); const hotTxt = hot ? hot.textContent : null; closeModals();
      S.stats.viol = 0; S.trip.step = 0; tripNext(); const cool = !!document.querySelector('#mbg .heat-note'); closeModals(); S.trip = null;
      return { seen, tags0, tags2, hotTxt, cool };
    });
    assert.strictEqual(r.seen.wom, -4, 'seen: word of mouth −4'); assert.strictEqual(r.seen.rep, 58); assert.match(r.seen.note, /Another guide saw it/);
    assert.ok(!/troopers know your boat/.test(r.tags0)); assert.match(r.tags2, /troopers know your boat \(2 rules broken\)/);
    assert.ok(r.hotTxt && /2 rules this season/.test(r.hotTxt), String(r.hotTxt)); assert.strictEqual(r.cool, false, 'no warning on a clean season');
    noErrors(errors);
  } },
  { name: 'citations are public: one can cost a booked July party, and each trims the rest of the summer', fn: async ctx => {
    const { page, errors } = await quiet(ctx, 'normal', 84);
    const r = await page.evaluate(MK + `(() => {
      S.book = [mk('reds', 3), mk('trout', 5)]; S.money = 5000; S.cites = 0; S.warns = 0; const R = Math.random;
      Math.random = () => 0; const notes = []; cite('x', 400, false, notes, 'a trooper'); Math.random = R;
      const after = S.book.map(b => b.status), note = notes.join(' ');
      S.book = [mk('reds', 3)]; S.warns = 0; Math.random = () => 0; const wn = []; cite('y', 200, true, wn, 'a trooper'); Math.random = R;
      const warnOnly = S.book[0].status;
      S.rep = 80; S.regs = []; S.up.rate = 1; const p = { trips: 20, fares: 20000, tips: 2000, wom: 0, year: 2026, hap: HAP0 };
      const rest = [0, 1, 2].map(c => restOfSeason(Object.assign({}, p, { cites: c })).trips);
      const cs = curSeason();
      return { after, note, warnOnly, rest, curCites: cs.cites, CITE_REST };
    })()`);
    assert.strictEqual(r.after.filter(s => s === 'cancelled').length, 1, JSON.stringify(r.after));
    assert.match(r.note, /look you up, find the citation and cancel/); assert.match(r.note, /public record/);
    assert.strictEqual(r.warnOnly, 'booked', 'a warning is not a citation: nobody cancels');
    assert.ok(r.rest[0] > r.rest[1] && r.rest[1] > r.rest[2], JSON.stringify(r.rest));
    assert.ok(Math.abs(r.rest[1] / r.rest[0] - (1 - r.CITE_REST)) < .05, JSON.stringify(r));
    assert.strictEqual(r.curCites, 1, 'the season counts its citations');
    noErrors(errors);
  } },
  { name: 'hunger: a second hungry night brings a morning warning with a gas-station fix; it is not repeated every day', fn: async ctx => {
    const { page, errors } = await quiet(ctx, 'normal', 85);
    const r = await page.evaluate(() => {
      S.food = { pan: 0, fri: 0, fd: 0, fm: 0, kits: 0 }; S.freezer = 0; S.hungry = 1; S.money = 3000; S.energy = 80;
      suppliesNight([], day()); const forced = S.ev.force.includes('hungry_morning');
      S.cur = 2; S.t = 2 * 1440 + 300; fireHook('wake');
      const m = document.querySelector('#mbg'), title = m && m.querySelector('h2').textContent, body = m && m.textContent;
      const i = MB.findIndex(b => /Gas station/.test(b.l)), m0 = S.money; MBTN(i);
      const fixed = { hungry: S.hungry, pan: S.food.pan, paid: m0 - S.money, price: emergencyPrice() };
      // two more hungry nights soon after: no second warning within the gap
      S.food.pan = 0; S.hungry = 1; suppliesNight([], 3); const again = S.ev.force.includes('hungry_morning');
      S.ev.force = []; S.cur = 9; S.hungry = 1; suppliesNight([], 9); const later = S.ev.force.includes('hungry_morning');
      S.ev.force = [];
      // the softer curve: −5 / −9 / −13 happiness after 1 / 2 / 3 hungry nights
      const curve = [1, 2, 3].map(h => { S.hungry = h; const t = { happy: 0, q: 0, notes: [] }; hungerTrip(t); return t.happy; });
      return { forced, title, body, fixed, again, later, curve };
    });
    assert.ok(r.forced, 'queued for the morning'); assert.match(r.title, /Running on empty/);
    assert.match(r.body, /Not now: push through/); assert.match(r.body, /grocer/);
    assert.deepStrictEqual(r.fixed, { hungry: 0, pan: 3, paid: r.fixed.price, price: 38 });
    assert.strictEqual(r.again, false, 'not again the next morning'); assert.strictEqual(r.later, true, 'again a week later');
    assert.deepStrictEqual(r.curve, [-5, -9, -13]);
    noErrors(errors);
  } },
  { name: 'hunger: pushing through keeps you hungry; hard prices the fix at its dearer costs', fn: async ctx => {
    const { page, errors } = await quiet(ctx, 'hard', 86);
    const r = await page.evaluate(() => {
      S.food = { pan: 0, fri: 0, fd: 0, fm: 0, kits: 0 }; S.freezer = 0; S.hungry = 2; S.money = 3000;
      hungerModal(); const i = MB.findIndex(b => /Not now/.test(b.l)), m0 = S.money; MBTN(i);
      return { hungry: S.hungry, paid: m0 - S.money, price: emergencyPrice(), cost: DF().cost };
    });
    assert.strictEqual(r.hungry, 2); assert.strictEqual(r.paid, 0); assert.strictEqual(r.price, Math.round(38 * r.cost));
    noErrors(errors);
  } },
];
