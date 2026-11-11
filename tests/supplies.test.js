// Food, home fuel storage, outages and the generator (src/js/31-supplies.js, v1.7.0).
const { open, newGame, noErrors, assert } = require('./helpers');

// Start a game and park the clock somewhere quiet (the shop, day 1, mid-morning, no booked trips in the way).
async function quiet(ctx, diff) {
  const o = await open(ctx);
  await newGame(o.page, diff);
  await o.page.evaluate(() => { closeModals(); S.cur = 1; S.t = 1440 + 600; S.book = []; S.loc = 'shop'; });
  return o;
}

module.exports = [
  { name: 'home fuel: you can only put fuel in the cans by buying it at the harbor dock', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const r = await page.evaluate(() => {
      const where = {}; for (const loc of ['shop', 'town', 'lower', 'cooper', 'kbeach', 'homer']) { S.loc = loc; where[loc] = actionsHere().some(a => /Haul fuel home/.test(a.l)); }
      S.loc = 'harbor'; S.t = 1440 + 600; S.home.gal = 0;
      const a = actionsHere().find(x => /Haul fuel home: fill the cans/.test(x.l)), m0 = S.money, p = fuelPrice('kenai');
      a.fn(); return { where, gal: S.home.gal, paid: Math.round((m0 - S.money) * 100) / 100, expect: Math.round(15 * p * 100) / 100, stat: S.stats.fuelGal };
    });
    assert.ok(Object.values(r.where).every(v => v === false), JSON.stringify(r.where));
    assert.strictEqual(r.gal, 15, 'three 5-gallon cans'); assert.ok(Math.abs(r.paid - r.expect) < 0.02, `${r.paid} vs ${r.expect}`);
    assert.strictEqual(r.stat, 15, 'counted in the fuel stats');
    noErrors(errors);
  } },
  { name: 'home fuel: the sled fuels from storage at the shop, free, and only what is stored', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const r = await page.evaluate(() => {
      S.home.gal = 0; S.fuel = 10; const none = actionsHere().some(a => /Fuel the sled from your home cans/.test(a.l));
      S.home.gal = 8; const a = actionsHere().find(x => /Fuel the sled from your home cans/.test(x.l)), m0 = S.money; a.fn();
      const first = { fuel: S.fuel, home: S.home.gal, free: S.money === m0 };
      S.fuel = 25; S.home.gal = 20; actionsHere().find(x => /Fuel the sled from your home cans/.test(x.l)).fn();
      return { none, first, topped: S.fuel, left: S.home.gal, tank: SLED_TANK() };
    });
    assert.strictEqual(r.none, false, 'no cans, no action');
    assert.deepStrictEqual(r.first, { fuel: 18, home: 0, free: true });
    assert.strictEqual(r.topped, r.tank); assert.strictEqual(r.left, 15, 'only the room in the tank (30) comes out');
    noErrors(errors);
  } },
  { name: 'capacity: cans, the 100-gallon tank, the freezer and the pantry all have limits', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const r = await page.evaluate(() => {
      S.money = 20000; S.loc = 'harbor'; S.t = 1440 + 600; S.home.gal = 10; const room0 = fuelRoom();
      haulFuel(null, 'kenai'); const full = { all: fuelAll(), cap: fuelCap(), again: haulFuel(null, 'kenai') };
      buyHome('tank'); const withTank = fuelCap(); haulFuel(null, 'kenai'); const tankFull = fuelAll();
      for (let i = 0; i < 6; i++) buyHome('cans'); const cans = S.home.cans, maxCap = fuelCap();
      S.freezer = 28; const stored = addFish(5), fz = S.freezer; buyHome('frz'); const big = fishCap();
      S.food.pan = 0; S.food.fri = 0; stockUp(100); const pan = S.food.pan, fri = S.food.fri;
      return { room0, full, withTank, tankFull, cans, maxCap, stored, fz, big, pan, fri };
    });
    assert.strictEqual(r.room0, 5); assert.strictEqual(r.full.all, 15); assert.strictEqual(r.full.again, 0);
    assert.strictEqual(r.withTank, 115); assert.strictEqual(r.tankFull, 115); assert.strictEqual(r.cans, 8); assert.strictEqual(r.maxCap, 140);
    assert.strictEqual(r.stored, 2, 'a freezer of 30 has room for 2 more'); assert.strictEqual(r.fz, 30); assert.strictEqual(r.big, 70);
    assert.ok(r.pan <= 60 && r.fri <= 15 && r.pan + r.fri === 75, `${r.pan}+${r.fri}`);
    noErrors(errors);
  } },
  { name: 'stale fuel: untreated gas goes stale over a winter, stabilized gas does not, and stale gas can be disposed of', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const r = await page.evaluate(() => {
      Math.random = () => 0.99;                                  // no winter storm in this test
      S.home.gal = 6; S.home.tgal = 0; const a = suppliesWinter();
      const bare = { gal: S.home.gal, stale: S.home.stale, fresh: fuelFresh(), lines: a.length };
      S.home.stale = 0; S.home.gal = 12; S.money = 500; S.loc = 'shop'; S.t = 1440 + 600; const m0 = S.money;
      actionsHere().find(x => /Add stabilizer/.test(x.l)).fn();
      const treated = { tgal: S.home.tgal, gal: S.home.gal, paid: m0 - S.money };
      suppliesWinter(); const after = { gal: S.home.gal, tgal: S.home.tgal, stale: S.home.stale };
      S.home.gal = 2; S.home.stale = 7; const room = fuelRoom(); actionsHere().find(x => /Dispose of stale gas/.test(x.l)).fn();
      return { bare, treated, after, room, stale: S.home.stale, roomAfter: fuelRoom() };
    });
    assert.deepStrictEqual(r.bare, { gal: 0, stale: 6, fresh: 0, lines: 1 });
    assert.deepStrictEqual(r.treated, { tgal: 12, gal: 0, paid: 9 }, '12 gal needs one $9 bottle (treats 25)');
    assert.deepStrictEqual(r.after, { gal: 12, tgal: 0, stale: 0 }, 'treated gas made it through the winter');
    assert.strictEqual(r.stale, 0); assert.strictEqual(r.roomAfter, r.room + 7);
    noErrors(errors);
  } },
  { name: 'outage: without a generator a long outage spoils the freezer and fresh food and costs rest; with one it burns home fuel and nothing spoils', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const r = await page.evaluate(() => {
      const setup = gen => { S.home.gen = gen; S.home.gal = 15; S.home.tgal = 0; S.freezer = 10; S.food.fri = 9; S.energy = 80; };
      setup(0); const none = outage(30), noneS = { fish: S.freezer, fri: S.food.fri, fuel: fuelFresh(), energy: S.energy };
      setup(2); const inv = outage(30), invS = { fish: S.freezer, fri: S.food.fri, fuel: fuelFresh(), energy: S.energy };
      setup(1); const open = outage(30), openS = { fuel: fuelFresh() };
      setup(2); S.home.gal = 2; const dry = outage(30), dryS = { fish: S.freezer, fuel: fuelFresh() };
      setup(0); const short = outage(6), shortS = { fish: S.freezer, fri: S.food.fri };
      setup(0); S.freezer = 20; const full = outage(40), fullS = { fish: S.freezer };
      return { none, noneS, inv, invS, openS, dry, dryS, short, shortS, fullS };
    });
    assert.ok(r.none.fish === 3 && r.noneS.fish === 7, `30 h with a freezer under half full loses a quarter: ${JSON.stringify(r.noneS)}`);
    assert.strictEqual(r.noneS.fri, 0, 'the fridge is gone after 30 h'); assert.ok(r.noneS.energy < 80, 'no power costs rest');
    assert.strictEqual(r.noneS.fuel, 15, 'nothing burned without a generator');
    assert.deepStrictEqual([r.invS.fish, r.invS.fri, r.invS.energy], [10, 9, 80], 'the generator keeps freezer, fridge and rest');
    assert.ok(Math.abs(r.invS.fuel - (15 - 30 * 0.28)) < 0.15, `inverter burns 0.28 gal/h: ${r.invS.fuel}`);
    assert.ok(Math.abs(r.openS.fuel - (15 - 30 * 0.45)) < 0.15, `open-frame burns 0.45 gal/h: ${r.openS.fuel}`);
    assert.ok(r.dry.off > 0 && r.dryS.fuel === 0, 'a generator with too little gas runs dry'); assert.ok(r.dry.run > 0 && r.dry.run < 30);
    assert.deepStrictEqual([r.shortS.fish, r.shortS.fri], [10, 9], 'a 6 hour outage is survivable');
    assert.strictEqual(r.fullS.fish, 20, 'a full-ish freezer holds for 40 h (48 h when half full)');
    noErrors(errors);
  } },
  { name: 'outage: the power_out event runs on a windy morning, records the day and shows an alert', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const r = await page.evaluate(() => {
      S.home.gen = 2; S.home.gal = 15; S.freezer = 5; S.wx[1] = 'wind'; chain('power_out'); fireHook('wake', {}); closeModals();
      return { power: S.power, alert: alertBar() && alertBar().t, tags: statusTags().join(' '), n: S.stats.outages, chance: EV.find(e => e.id === 'power_out').chance() };
    });
    assert.ok(r.power && r.power.d === 1 && r.power.h >= 2, JSON.stringify(r.power)); assert.strictEqual(r.n, 1);
    assert.match(r.alert, /generator|outage/i); assert.match(r.tags, /power/); assert.ok(r.chance > 0.05, 'windy mornings are the likely ones');
    noErrors(errors);
  } },
  { name: 'generator: a purchase with a realistic price, bought in Soldotna, nothing without cash', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const r = await page.evaluate(() => {
      S.loc = 'town'; S.t = 1440 + 600; S.money = 1000; const items = homeItems(), g1 = items.find(i => i.id === 'gen1'), g2 = items.find(i => i.id === 'gen2');
      const broke = { g1: g1.dis, g2: g2.dis };
      S.money = 6000; buyHome('gen2'); const m = S.money, gen = S.home.gen; const again = homeItems().some(i => i.id === 'gen2'), swapOpen = homeItems().some(i => i.id === 'gen1');
      return { broke, spent: 6000 - m, gen, again, swapOpen, has: actionsHere().some(a => /Home supplies/.test(a.l)) };
    });
    assert.deepStrictEqual(r.broke, { g1: true, g2: true }, 'cannot afford them on $1,000'); assert.strictEqual(r.spent, 4449 + 600, 'Honda EU7000iS $4,449 plus about $600 for the inlet and interlock');
    assert.strictEqual(r.gen, 2); assert.strictEqual(r.again, false); assert.strictEqual(r.swapOpen, false); assert.ok(r.has);
    noErrors(errors);
  } },
  { name: 'cooler: packing your own lunch vs skipping changes energy, and eats a meal from home', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const run = async skip => page.evaluate(skip => {
      S.cur = 1; S.t = 1440 + 345; S.loc = 'lower'; S.fuel = 30; S.energy = 80; S.book = []; S.ate = { d: -1, n: 0 }; S.food = { pan: 24, fri: 6, fd: 1, fm: 0, kits: 0 };
      const b = addBooking({ d: 1, type: 'reds', n: 3, who: 'test party', from: 'x', res: false, quirk: [] }); tripStart(b);
      const title = document.querySelector('#mbg h2').textContent, labels = MB.map(x => x.l), m0 = foodMeals();
      MBTN(MB.findIndex(x => skip ? /Skip food/.test(x.l) : /Pack your own lunch/.test(x.l)));
      const out = { title, labels, energy: S.energy, meals: m0 - foodMeals(), ate: S.ate.n, happy: S.trip.happy }; closeModals(); return out;
    }, skip);
    const packed = await run(false), skipped = await run(true);
    assert.match(packed.title, /Pack the cooler/); assert.ok(packed.labels[0] === 'Pack your own lunch', 'first option is the plain lunch (tests and bots take index 0)');
    assert.strictEqual(packed.energy, 83); assert.strictEqual(packed.meals, 1); assert.strictEqual(packed.ate, 1);
    assert.strictEqual(skipped.energy, 74, 'a skipped lunch on a 6 hour trip: energy -6'); assert.strictEqual(skipped.meals, 0);
    noErrors(errors);
  } },
  { name: 'cooler: client lunches change happiness; skipping on a long trip costs some', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const run = (type, pick) => page.evaluate(([type, pick]) => {
      S.cur = 1; S.t = 1440 + 345; S.fuel = 30; S.book = []; S.ate = { d: -1, n: 0 }; S.food = { pan: 24, fri: 6, fd: 1, fm: 0, kits: 6 }; S.freezer = 4; S.loc = TRIPS[type].loc;
      const b = addBooking({ d: 1, type, n: 3, who: 'test party', from: 'x', res: false, quirk: [] }); S.t = 1440 + TRIPS[type].start - 15; tripStart(b);
      const labels = MB.map(x => x.l); MBTN(MB.findIndex(x => pick.test(x.l)));
      const out = { happy: S.trip.happy, kits: S.food.kits, fish: S.freezer, pan: S.food.pan, labels }; closeModals(); return out;
    }, [type, pick]);
    const shortKit = await run('reds', /lunch kit/), shortNone = await run('reds', /Pack your own lunch/);
    const longNone = await run('trout', /Pack your own lunch/), longKit = await run('trout', /lunch kit/), longFish = await run('trout', /salmon/), longSnack = await run('trout', /snack/);
    const base = shortNone.happy;   // the new-boat bonus etc., the same on every trip
    assert.strictEqual(shortKit.happy - base, 4); assert.strictEqual(shortKit.kits, 3, 'a kit per client');
    assert.strictEqual(longNone.happy - base, -6, 'hungry clients on the all-day trout float: no short-trip penalty, a long-trip one'); assert.strictEqual(longKit.happy - base, 7); assert.strictEqual(longFish.happy - base, 9); assert.strictEqual(longSnack.happy - base, 4);
    assert.strictEqual(longFish.fish, 3, 'a shore lunch for 3 uses 1 freezer red (4 meals)'); assert.ok(longSnack.pan < 24);
    assert.strictEqual(longFish.labels.length >= 4, true);
    noErrors(errors);
  } },
  { name: 'cooler: with no food at home you grab a gas-station sandwich, and the pack step never blocks a trip', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const r = await page.evaluate(() => {
      S.cur = 1; S.t = 1440 + 345; S.loc = 'lower'; S.fuel = 30; S.energy = 80; S.freezer = 0; S.food = { pan: 0, fri: 0, fd: 1, fm: 0, kits: 0 }; S.book = [];
      const b = addBooking({ d: 1, type: 'reds', n: 3, who: 'test party', from: 'x', res: false, quirk: [] }); const m0 = S.money; tripStart(b);
      const opts = MB.map(x => x.l); let i = 0; while (S.trip && i++ < 30) MBTN(legalBtn()); closeModals();
      return { opts, status: b.status, sandwich: b.out && b.out.net };
    });
    assert.strictEqual(r.opts.length, 2, 'own lunch or skip; no client lunches in stock'); assert.strictEqual(r.status, 'done');
    noErrors(errors);
  } },
  { name: 'food: stock up buys about a week, meals come out of the stores every night, a diner meal is not eaten twice', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const r = await page.evaluate(() => {
      S.food = { pan: 0, fri: 0, fd: 0, fm: 0, kits: 0 }; S.freezer = 0; S.loc = 'town'; S.t = 1440 + 600; S.money = 1000;
      const a = actionsHere().find(x => /Stock up: groceries for a week/.test(x.l)), m0 = S.money; a.fn();
      const bought = { meals: S.food.fri + S.food.pan, fri: S.food.fri, pan: S.food.pan, paid: Math.round((m0 - S.money) * 100) / 100, days: foodDays() };
      const again = actionsHere().find(x => /Stock up/.test(x.l)).dis;
      S.loc = 'shop'; S.t = 1440 + 1200; const before = foodMeals(); endDay('home'); const night1 = before - foodMeals(), fridgeFirst = S.food.fri;
      S.cur = 2; S.t = 2 * 1440 + 800; S.loc = 'town'; S.diner = {}; const b2 = foodMeals(); actionsHere().find(x => /Eat at the diner/.test(x.l)).fn(); S.loc = 'shop'; S.t = 2 * 1440 + 1200; endDay('home');
      return { bought, again, night1, fridgeFirst, night2: b2 - foodMeals(), spent: S.stats.groceries };
    });
    assert.strictEqual(r.bought.meals, 21); assert.strictEqual(r.bought.days, 7); assert.ok(r.bought.fri > 0 && r.bought.pan > r.bought.fri);
    assert.ok(Math.abs(r.bought.paid - (r.bought.fri * 7 + r.bought.pan * 5)) < 0.02, JSON.stringify(r.bought)); assert.ok(r.bought.paid > 100 && r.bought.paid < 140, 'about $18 a day');
    assert.strictEqual(r.again, true, 'already stocked for a week'); assert.strictEqual(r.night1, 3, 'three meals a night'); assert.strictEqual(r.night2, 2, 'the diner lunch counts as a meal');
    assert.strictEqual(r.spent, r.bought.paid);
    noErrors(errors);
  } },
  { name: 'food: fresh food spoils after six days, an empty kitchen costs energy, and freezer reds feed you', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const r = await page.evaluate(() => {
      S.food = { pan: 9, fri: 6, fd: 1, fm: 0, kits: 0 }; S.freezer = 0; S.cur = 7; S.t = 7 * 1440 + 1200; S.energy = 100; const notes = [];
      suppliesNight(notes, 7); const spoiled = { fri: S.food.fri, text: notes.join(' '), pan: S.food.pan };
      S.food = { pan: 0, fri: 0, fd: 7, fm: 0, kits: 0 }; S.freezer = 0; S.energy = 100; S.ate = { d: -1, n: 0 }; const n2 = []; suppliesNight(n2, 8); const hungry = { energy: S.energy, text: n2.join(' '), missed: S.stats.missed };
      S.freezer = 3; S.food.fm = 0; S.energy = 100; const n3 = []; suppliesNight(n3, 9); const fish = { freezer: S.freezer, fm: S.food.fm, energy: S.energy, days: foodDays() };
      return { spoiled, hungry, fish };
    });
    assert.strictEqual(r.spoiled.fri, 0); assert.match(r.spoiled.text, /fresh food went off/); assert.strictEqual(r.spoiled.pan, 6, 'the spoiled fridge is gone, so the pantry fed him: 9 - 3');
    assert.strictEqual(r.hungry.energy, 79); assert.match(r.hungry.text, /bare/); assert.strictEqual(r.hungry.missed, 3);
    assert.deepStrictEqual([r.fish.freezer, r.fish.fm, r.fish.energy], [2, 1, 100], 'a thawed red covers 4 meals: 3 tonight, 1 left over');
    noErrors(errors);
  } },
  { name: 'overhead: groceries are no longer in it, so nobody pays twice', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const r = await page.evaluate(() => {
      const oh = { easy: 0, normal: 0, hard: 0 }; for (const k of Object.keys(oh)) { S.diff = k; oh[k] = overhead(); } S.diff = 'normal';
      S.food = { pan: 30, fri: 0, fd: 0, fm: 0, kits: 0 }; S.loc = 'shop'; S.cur = 1; S.t = 1440 + 1200; S.book = []; const m0 = S.money, sp0 = S.stats.spent; endDay('home');
      const night = document.querySelector('#mbg') && document.querySelector('#mbg').textContent;
      return { oh, delta: Math.round((m0 - S.money) * 100) / 100, spent: S.stats.spent - sp0, night };
    });
    assert.deepStrictEqual(r.oh, { easy: 46, normal: 57, hard: 62 });   // 1.8.1: Combat Season's costs ×1.2 → ×1.08 assert.strictEqual(r.delta, 57, 'a night at home costs the overhead and nothing else: the meals come from the pantry you already paid for');
    assert.strictEqual(r.spent, 57); assert.ok(!/groceries/.test(r.night) && /utilities/.test(r.night), r.night);
    noErrors(errors);
  } },
  { name: 'HUD and status: food days, home fuel, generator and to-do items show up', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const r = await page.evaluate(() => {
      S.home.gen = 1; S.food = { pan: 3, fri: 0, fd: 0, fm: 0, kits: 0 }; S.freezer = 0; closeModals(); render();
      const stat = STATS.find(s => s.l === 'Food'), tags = statusTags().join(' '), alert = alertBar() && alertBar().t, todo = todoItems().find(x => /Keep food/.test(x.l)), v = stat.v(), warn = stat.warn();
      S.food.pan = 30; render(); const tags2 = statusTags().join(' ');
      return { v, warn, tags, alert, todo: todo && todo.urgent, tags2, hud: document.querySelector('.stats').textContent, home: /gal at home/.test(tags), gen: /open-frame generator/.test(tags) };
    });
    assert.strictEqual(r.v, '1d'); assert.ok(r.warn); assert.match(r.tags, /1 day of food/); assert.match(r.alert, /1 day of food/); assert.strictEqual(r.todo, true);
    assert.match(r.tags2, /10 days of food/); assert.match(r.hud, /Food/); assert.ok(r.home && r.gen);
    noErrors(errors);
  } },
  { name: 'saves: an older save without food or home fuel gets sensible defaults', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    const r = await page.evaluate(() => {
      const pack = JSON.parse(JSON.stringify(packSave())); delete pack.S.home; delete pack.S.food; delete pack.S.ate; delete pack.S.power; pack.app = '1.6.2';
      const d = migrate(pack); return { home: d.S.home, food: d.S.food, ate: d.S.ate, power: d.S.power };
    });
    assert.deepStrictEqual(r.home, { cans: 3, tank: 0, gal: 10, tgal: 0, stale: 0, gen: 0, frz: 0 }); assert.deepStrictEqual(r.food, { pan: 24, fri: 6, fd: 0, fm: 0, kits: 0 }); assert.strictEqual(r.power, null);
    noErrors(errors);
  } },
  { name: 'winter: the off-season summary reports stale gas, spoiled fridge food and a storm outage', fn: async ctx => {
    const { page, errors } = await quiet(ctx);
    await page.evaluate(() => setPref('years', 5));
    const r = await page.evaluate(() => new Promise(res => {
      S.years = 5; S.home.gal = 8; S.food.fri = 6; S.home.gen = 2; S.home.tgal = 0; const rnd = Math.random; Math.random = () => 0.1;   // forces the winter storm
      S.cur = 13; S.t = 13 * 1440 + 1300; closeModals(); startSeason(1); Math.random = rnd;
      setTimeout(() => { const m = document.getElementById('mbg'); res({ txt: m ? m.querySelector('.mb').innerText : 'none', fri: S.food.fri, stale: S.home.stale, sup: S.winter.sup }) }, 50);
    }));
    assert.strictEqual(r.fri, 0); assert.strictEqual(r.stale, 8); assert.match(r.txt, /went stale/); assert.match(r.txt, /winter storm/); assert.ok(r.sup.length === 2);
    noErrors(errors);
  } },
];
