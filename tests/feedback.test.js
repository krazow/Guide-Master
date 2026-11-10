const { open, newGame, noErrors, assert } = require('./helpers');
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

module.exports = [
  { name: 'feedback: emails the message with the subject "Guide Master Feedback"', fn: async ctx => {
    const { page, errors } = await open(ctx);
    const posts = [];
    await page.route('https://formspree.io/**', route => {
      const r = route.request();
      if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      posts.push({ url: r.url(), body: JSON.parse(r.postData()), accept: r.headers()['accept'] });
      return route.fulfill({ status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: '{"ok":true}' });
    });
    await newGame(page);
    await page.evaluate(() => { FEEDBACK.formId = 'testform'; });
    await page.evaluate(() => openSettings());
    await page.click('#mbg button.act >> text=Send feedback');
    await page.fill('#fbmsg', 'The coffee break is great.');
    await page.fill('#fbmail', 'player@example.com');
    await page.click('#mbg button.act >> text=Send');
    await page.waitForSelector('#mbg >> text=Thanks!');
    assert.strictEqual(posts.length, 1);
    const p = posts[0];
    assert.strictEqual(p.url, 'https://formspree.io/f/testform'); assert.match(p.accept, /application\/json/);
    assert.strictEqual(p.body._subject, 'Guide Master Feedback');
    assert.strictEqual(p.body.message, 'The coffee break is great.');
    assert.strictEqual(p.body._replyto, 'player@example.com');
    assert.ok(p.body.version && p.body.career && p.body.day, 'game context attached');
    noErrors(errors);
  } },
  { name: 'feedback: offline messages are saved and sent later', fn: async ctx => {
    const { page, errors } = await open(ctx);
    let up = false; const posts = [];
    await page.route('https://formspree.io/**', route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      if (!up) return route.abort('internetdisconnected');
      posts.push(JSON.parse(route.request().postData()));
      return route.fulfill({ status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: '{"ok":true}' });
    });
    await page.evaluate(() => { FEEDBACK.formId = 'testform'; });
    await page.click('.title button >> text=Send feedback');
    await page.fill('#fbmsg', 'Saved while offline.');
    await page.click('#mbg button.act >> text=Send');
    await page.waitForSelector('#mbg >> text=Saved for later');
    assert.strictEqual(await page.evaluate(() => fbQueue().length), 1);
    up = true;
    await page.evaluate(() => fbFlush());
    assert.strictEqual(await page.evaluate(() => fbQueue().length), 0);
    assert.strictEqual(posts.length, 1); assert.strictEqual(posts[0]._subject, 'Guide Master Feedback');
    noErrors(errors);
  } },
  { name: 'feedback: empty messages are not sent; the spam trap drops bot posts', fn: async ctx => {
    const { page, errors } = await open(ctx);
    let posts = 0;
    await page.route('https://formspree.io/**', route => { posts++; return route.fulfill({ status: 200, headers: CORS, body: '{}' }); });
    await page.evaluate(() => { FEEDBACK.formId = 'testform'; });
    await page.click('.title button >> text=Send feedback');
    await page.click('#mbg button.act >> text=Send');
    assert.match(await page.textContent('#mbg'), /few words/);
    await page.click('#mbg button.act >> text=Back to the form');
    await page.fill('#fbmsg', 'Buy cheap stuff');
    await page.evaluate(() => { FBD.trap = 'http://spam'; });
    await page.click('#mbg button.act >> text=Send');
    assert.strictEqual(posts, 0);
    noErrors(errors);
  } },
];
