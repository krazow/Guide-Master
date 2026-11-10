const { open, newGame, noErrors, assert } = require('./helpers');

// a 5-year game rolled into its first off-season (S.winter pending)
async function winterGame(ctx) {
  const { page, errors } = await open(ctx);
  await page.evaluate(() => setPref('years', 5));
  await newGame(page);
  await page.evaluate(async () => {
    closeModals(); S.money = 20000; S.cur = 13; S.t = 13 * 1440 + 1300; S.loc = 'shop';
    S.book.forEach(b => { if (b.status === 'booked') b.status = 'done'; });
    endDay('home'); await new Promise(r => setTimeout(r, 10));
  });
  return { page, errors };
}

module.exports = [
  { name: 'camping: option shows only in the off-season; one trip per winter', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await newGame(page);
    const before = await page.evaluate(() => { closeModals(); return { winter: !!S.winter, go: goCamp(CAMP_DEST[0], 1) }; });
    assert.strictEqual(before.winter, false); assert.strictEqual(before.go, null, 'no camping during the season');
    const w = await winterGame(ctx);
    const r = await w.page.evaluate(() => {
      const has = () => [...document.querySelectorAll('#mbg button.act')].map(b => ({ t: b.textContent, d: b.disabled }));
      closeModals(); winterModal(); const open1 = has().find(b => /winter camping/.test(b.t)); const w1 = has().find(b => /winter camping/.test(b.t));
      const n = CAMP_DEST.length, far = Math.max(...CAMP_DEST.map(d => d.miles));
      const first = goCamp(CAMP_DEST[0], 1), second = goCamp(CAMP_DEST[1], 1);
      closeModals(); winterModal(); const w2 = has().find(b => /winter camping/.test(b.t));
      return { open1: !!open1, dis1: w1 && w1.d, n, far, ok: !!first, second, dis2: w2 && w2.d };
    });
    assert.ok(r.open1); assert.strictEqual(r.dis1, false); assert.strictEqual(r.n, 10); assert.ok(r.far <= 100);
    assert.ok(r.ok); assert.strictEqual(r.second, null, 'one trip per winter'); assert.strictEqual(r.dis2, true);
    noErrors(w.errors); noErrors(errors);
  } },
  { name: 'camping: cost is round-trip gas + fees + supplies, and unaffordable trips are disabled', fn: async ctx => {
    const { page, errors } = await winterGame(ctx);
    const r = await page.evaluate(() => {
      const d = CAMP_DEST.find(x => x.id === 'anchor'), c = campCost(d, 3), gas = campGas();
      const expect = Math.round((d.miles * 2 / 15 * gas + d.fee * 3 + 25 * 3) * 100) / 100;
      S.money = 100; closeModals(); nightsModal(d);
      const btns = [...document.querySelectorAll('#mbg button.act')].map(b => ({ t: b.textContent, d: b.disabled }));
      return { total: c.total, expect, gas, base: S.fuelBase.kenai, fees: c.fees, btns };
    });
    assert.ok(Math.abs(r.total - r.expect) < 0.02, `${r.total} vs ${r.expect}`); assert.strictEqual(r.fees, 60);
    assert.ok(r.gas < r.base && r.gas > 4.5);
    assert.strictEqual(r.btns[0].d, false, '1 night affordable'); assert.strictEqual(r.btns[4].d, true, '7 nights not affordable on $100');
    noErrors(errors);
  } },
  { name: 'camping: forced encounters, money charged, clock untouched', fn: async ctx => {
    const { page, errors } = await winterGame(ctx);
    const r = await page.evaluate(() => {
      closeModals(); const d = CAMP_DEST.find(x => x.id === 'johnson'), c = campCost(d, 3), m0 = S.money, sp = S.stats.spent, cur = S.cur, t = S.t, re = Math.random;
      closeModals(); Math.random = () => 0.1; let out; try { out = goCamp(d, 3); } finally { Math.random = re; }
      const txt = document.querySelector('#mbg').textContent;
      return { enc: out.enc, st: S.stats.encounters, nights: S.stats.campNights, spent: S.stats.spent - sp, lost: m0 - S.money, cost: c.total, cur: S.cur - cur, t: S.t - t, energy: S.energy, report: /Night 3/.test(txt), winter: !!S.winter };
    });
    assert.strictEqual(r.enc, 3); assert.strictEqual(r.st, 3); assert.strictEqual(r.nights, 3);
    assert.ok(r.lost >= r.cost - 0.01 && r.spent >= r.cost - 0.01, JSON.stringify(r)); assert.strictEqual(r.cur, 0); assert.strictEqual(r.t, 0);
    assert.ok(r.energy >= 0 && r.energy <= 100); assert.ok(r.report); assert.ok(r.winter);
    noErrors(errors);
  } },
  { name: 'camping: rolls of 0.5 or more mean no encounters', fn: async ctx => {
    const { page, errors } = await winterGame(ctx);
    const r = await page.evaluate(() => {
      const re = Math.random; Math.random = () => 0.9; let out; try { out = goCamp(CAMP_DEST[2], 5); } finally { Math.random = re; }
      return { enc: out.enc, st: S.stats.encounters, nights: S.stats.campNights };
    });
    assert.strictEqual(r.enc, 0); assert.strictEqual(r.st, 0); assert.strictEqual(r.nights, 5);
    noErrors(errors);
  } },
  { name: 'camping: all 10 encounters run, every habitat has one, and the achievements work', fn: async ctx => {
    const { page, errors } = await winterGame(ctx);
    const r = await page.evaluate(() => {
      const out = []; const hs = new Set(CAMP_DEST.map(d => d.h));
      for (const e of CAMP_ENC) { S.money = 5000; S.energy = 50; const line = e.fx(); out.push({ id: e.id, line: typeof line, e: S.energy, good: e.good }); }
      const covered = [...hs].every(h => CAMP_ENC.some(e => e.h.includes(h)));
      S.stats.campNights = 7; CAMP_ENC.slice(0, 5).forEach(e => { S.stats.seen[e.id] = 1; });
      return { out, n: CAMP_ENC.length, covered, good: CAMP_ENC.filter(e => e.good).length, hc: ACH.find(a => a.id === 'happy_camper').test({}), wk: ACH.find(a => a.id === 'wild_kenai').test({}), rows: endRows().some(x => x[0] === 'Winter camping') };
    });
    assert.strictEqual(r.n, 10); assert.ok(r.good >= 4 && r.good <= 6); assert.ok(r.covered);
    assert.ok(r.out.every(o => o.line === 'string' && o.e >= 0 && o.e <= 100));
    assert.ok(r.hc && r.wk && r.rows);
    noErrors(errors);
  } },
];
