#!/usr/bin/env node
// Test runner: node tests/run.js [filter]
// Runs every tests/*.test.js against index.html (and the offline build, if present) in headless Chromium.
// To use an installed Chrome instead of Playwright's: CHROME_PATH=/path/to/chrome npm test
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { TARGETS } = require('./helpers');

(async () => {
  const filter = process.argv[2] || '';
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort();
  const t0 = Date.now();
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  let pass = 0, fail = 0;
  for (const target of TARGETS) {
    console.log(`\n# ${target.name}`);
    for (const f of files) {
      for (const t of require(path.join(__dirname, f))) {
        if (t.only && t.only !== target.name) continue;
        const name = `${f.replace('.test.js', '')}: ${t.name}`;
        if (filter && !name.includes(filter)) continue;
        const s = Date.now();
        const context = await browser.newContext({ viewport: { width: 400, height: 800 } });
        context.setDefaultTimeout(5000);
        try {
          await t.fn({ context, target });
          pass++; console.log(`  ok   ${name} (${Date.now() - s} ms)`);
        } catch (e) {
          fail++; console.log(`  FAIL ${name}\n       ${String(e && e.stack || e).split('\n').slice(0, 6).join('\n       ')}`);
        } finally { await context.close(); }
      }
    }
  }
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
