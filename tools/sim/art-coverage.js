// Illustration coverage (art/README.md): plays bot careers (sim-lib.js) with the shipped pictures on and the off-season played through
// the real screens (the fall cabin sheet, the storm prompts, camping with a random or a thoughtful policy), draws the Home tab at
// dawn, after each trip and at night, and lists which manifest entries are ever shown, and where (the artSlot key: home, narr, trip,
// beat, dock, morning, camp, event…), then what a first week downloads (one full WebP per drawing).
//   node tools/sim/art-coverage.js [careers=12] [years=3]        env: W (parallel pages, 3), STYLES, OUT (a JSON file)
// Entries the bots never buy their way into (a wood stove, the freezer, a garden, detectors, a hired guide, a loaner, the private dock)
// show as NO here; tests/art.test.js and the README's coverage table say how each is reached.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const N = +(process.argv[2] || 12), YEARS = +(process.argv[3] || 3), W = +(process.env.W || 3);
const STY = (process.env.STYLES || 'skilled,careless,opport,foodgen1,guide,noservice').split(',');
(async () => {
  const br = await chromium.launch(); const hits = {}; const WEEKS = []; const errs = []; let idx = 0;
  const jobs = Array.from({ length: N }, (_, i) => ({ style: STY[i % STY.length], diff: i % 3 === 2 ? 'hard' : 'normal', years: YEARS, seed: 7000 + i * 13, popups: i % 2 === 1, over: { home: i % 3 === 1 ? 'neglect' : 'careful', camp: true } }));
  async function worker() {
    const pg = await br.newPage(); pg.on('pageerror', e => errs.push(String(e).slice(0, 300)));
    await pg.goto('file://' + path.join(ROOT, 'index.html')); await pg.waitForSelector('.title');
    await pg.addScriptTag({ path: path.join(ROOT, 'tools/sim/sim-lib.js') }); await pg.evaluate(() => simSetup());
    await pg.evaluate(() => {
      window.HITS = {};
      const rec = (h, where) => { const m = h && h.match(/data-art="([^"]+)"/); if (m) { const r = HITS[m[1]] = HITS[m[1]] || { n: 0, at: {}, days: {} }; r.n++; const dd = S ? (S.winter ? 'w' : day()) : 0; r.days[dd] = 1; r.at[where] = (r.at[where] || 0) + 1; } };
      const _slot = artSlot; artSlot = function (set, ctx, o) { const h = _slot(set, ctx, o); rec(h, (o && o.key || '').replace(/:\d+$/, '') || set); return h; };
      const _end = endDay; endDay = function (w) { if (!S.winter) { const t0 = tab; tab = 'home'; artScene(); tab = t0; } const r = _end(w); if (S && !S.over && !S.winter) { const t0 = tab; tab = 'home'; artScene(); tab = t0; } return r; };
      const _te = tripEnd; tripEnd = function (...a) { const t0 = tab; tab = 'home'; artScene(); tab = t0; return _te.apply(this, a); };
      const _hb = homeBotWinter;
      homeBotWinter = function (policy, o) {
        homeBot(policy, o); closeModals(); homeWinterModal(); closeModals();
        { const t0 = tab; tab = 'home'; artScene(); tab = t0; }
        if (cabin().rolled !== S.winter.s) {
          const rep = homeApply(CabinUpkeep.rollWinter(homeTicket()), true); let done = false;
          CabinUpkeep.ui.scenes(homeHost(), rep, () => { done = true; });
          for (let k = 0; k < 20 && document.getElementById('mbg') && !done; k++) { const ok = MB.map((b, i) => [b, i]).filter(([b]) => !b.dis); MBTN(ok.length ? ok[Math.floor(Math.random() * ok.length)][1] : 0); }
          closeModals();
        }
        return homeBot(policy, o);
      };
      campBot = function () {
        const q = [], ost = window.setTimeout; window.setTimeout = (f, ms, ...a) => { if (typeof f === 'function' && !(ms > 30)) { q.push(() => f(...a)); return 0; } return ost(f, ms, ...a); };
        const drain = () => { let g = 0; while (q.length && g++ < 50) q.shift()(); };
        try {
        closeModals(); campModal(); drain(); const pol = Math.random() < .5 ? 'random' : 'thoughtful';
        for (let k = 0; k < 400 && document.getElementById('mbg'); k++, drain()) {
          const h = CAMP_ART && CAMP_ART.h && CAMP_ART.h.session;
          if (!h) { MBTN(0); continue; }
          const v = h.view(); let id = pol === 'random' ? KenaiCamp.policies.random(Math.random)(v, h.state) : KenaiCamp.policies.thoughtful({ reserve: 100 })(v, h.state);
          if (h.phase === 'hub' && id === 'done' && (window.CAMPN = (window.CAMPN || 0) + 1) % 4 !== 0) { const pl = v.buttons.find(x => x.id === 'plan' && !x.dis); if (pl) id = 'plan'; }
          const j = v.buttons.findIndex(x => x.id === id);
          MBTN(j < 0 ? 0 : j);
        }
        closeModals(); drain(); closeModals();
        } finally { window.setTimeout = ost; }
        return null;
      };
    });
    while (idx < jobs.length) {
      const j = jobs[idx++];
      try {
        await pg.evaluate(() => { HITS = {}; });
        await pg.evaluate(async o => { const pop = o.popups; const _c = localStorage.clear.bind(localStorage); localStorage.clear = () => { _c(); if (pop) localStorage.setItem(KEY('popups'), 'on'); }; const r = await runCareer(o); localStorage.clear = _c; return r.errors; }, j).then(e => e && e.length && errs.push(...e));
      } catch (e) { errs.push('job ' + JSON.stringify(j) + ' ' + String(e).slice(0, 300)); }
      const h1 = await pg.evaluate(() => HITS);
      for (const [id, r] of Object.entries(h1)) { const x = hits[id] = hits[id] || { n: 0, at: {} }; x.n += r.n; for (const k in r.at) x.at[k] = (x.at[k] || 0) + r.at[k]; }
      const wk = Object.keys(h1).filter(id => Object.keys(h1[id].days).some(d => d !== 'w' && +d < 7));
      WEEKS.push({ style: j.style, popups: j.popups, ids: wk });
      process.stdout.write('.');
    }
  }
  await Promise.all(Array.from({ length: W }, worker));
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'art/manifest.json'), 'utf8'));
  console.log(`\n${N} careers x ${YEARS} years, popups on in half`);
  const rows = man.map(e => [e.id, hits[e.id] ? hits[e.id].n : 0, hits[e.id] ? Object.entries(hits[e.id].at).map(([k, v]) => k + ':' + v).join(' ') : '']);
  rows.forEach(r => console.log((r[1] ? 'yes ' : 'NO  ') + r[0].padEnd(42) + String(r[1]).padStart(6) + '  ' + r[2]));
  console.log('unreached:', rows.filter(r => !r[1]).map(r => r[0]).join(', ') || 'none');
  console.log('errors:', errs.length, errs.slice(0, 5).join('\n'));
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify({ hits, rows, weeks: WEEKS }, null, 1));
  const sz = id => { const e = man.find(x => x.id === id); return fs.statSync(path.join(ROOT, 'art', e.webp)).size; };
  const kb = WEEKS.map(w => { const files = new Set(w.ids.map(id => man.find(x => x.id === id).webp)); let b = 0; files.forEach(f => b += fs.statSync(path.join(ROOT, 'art', f)).size); return [w.style, w.popups, files.size, Math.round(b / 1024)]; });
  console.log('first week (days 1-7), unique drawings and KB of full WebP:', JSON.stringify(kb));
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length; console.log('mean', avg(kb.map(x => x[2])).toFixed(1), 'pictures', Math.round(avg(kb.map(x => x[3]))), 'KB; max', Math.max(...kb.map(x => x[3])), 'KB');
  await br.close();
})();
