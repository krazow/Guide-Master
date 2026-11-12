// The balance simulator (tools/sim/) still runs against the current build: one short career of each of two bot styles.
const fs = require('fs'), path = require('path');
const { open, noErrors, assert } = require('./helpers');
const LIB = path.resolve(__dirname, '..', 'tools', 'sim', 'sim-lib.js');
module.exports = [
  { name: 'balance simulator: a 1-year bot career runs to the end and reports a score and grade', only: 'index.html', fn: async ctx => {
    const { page, errors } = await open(ctx);
    await page.addScriptTag({ path: LIB });
    await page.evaluate(() => simSetup());
    for (const style of ['food', 'passive']) {
      const r = await page.evaluate(o => runCareer(o), { style, diff: 'normal', years: 1, seed: 100001 });
      assert.deepStrictEqual(r.errors, [], style + ' bot errors');
      assert.ok(r.finished && r.score > 0 && /^[ABCDF]$/.test(r.grade), style + ' ' + JSON.stringify([r.finished, r.score, r.grade]));
    }
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'tools', 'sim', 'README.md')));
    noErrors(errors);
  } },
];
