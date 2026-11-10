const { open, newGame, noErrors, assert } = require('./helpers');

// A bot that plays by clicking: modal buttons first (prefers .primary), else a random enabled action or place.
const STEPS = 1500;

module.exports = [
  { name: `bot plays ${STEPS} steps`, fn: async ctx => {
    const { page, errors } = await open(ctx, { seed: 20261109 });
    await newGame(page);
    let st = { steps: 0, games: 1 };
    while (st.steps < STEPS && !errors.length) {
      st = await page.evaluate(([st, n]) => {
        const rnd = Math.random, skip = /exit|transfer|settings|change name|save slots|delete/i;
        const ok = b => !b.disabled && !skip.test(b.textContent);
        const pick = a => a[Math.floor(rnd() * a.length)];
        for (let i = 0; i < n; i++, st.steps++) {
          const cross = document.querySelector('.cross'); if (cross) { cross.click(); continue; }
          if (!S || S.over || document.querySelector('.end,.title')) { st.games++; newGame(pick(['easy', 'normal', 'hard'])); closeModals(); render(); continue; }
          const m = document.getElementById('mbg');
          if (m) { const bs = [...m.querySelectorAll('button.act')].filter(ok); const p = bs.find(b => b.classList.contains('primary')); const b = p && rnd() < 0.8 ? p : pick(bs); if (b) b.click(); else m.remove(); continue; }
          if (rnd() < 0.05) { setTab(pick(allTabs().map(t => t[0]))); continue; }
          if (tab !== 'act') setTab('act');
          const bs = [...document.querySelectorAll('#app .content button.act, #app .content button.chip')].filter(ok);
          if (!bs.length) { endDay('home'); continue; }
          pick(bs).click();
        }
        return st;
      }, [st, 100]);
    }
    noErrors(errors);
    assert.ok(st.steps >= STEPS);
    console.log(`       bot: ${st.steps} steps, ${st.games} game(s)`);
  } },
];
