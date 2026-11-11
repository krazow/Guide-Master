// ============================================================
//  GAME CONFIG: start here when you make a new game.
//  tools/new-game.py rewrites id / title / codePrefix / colors for you
//  (in this file, src/shell.html, the web manifest and sw.js).
//
//  Files, in build order (tools/build.py concatenates src/js/*.js by name):
//    00-game.js      this config
//    01-core.js      state, preferences, sound, player name, time + stat helpers
//    02-kit.js       bottom-sheet modals, event tiles, full-screen transitions
//    03-events.js    random-event engine (hooks, chances, cooldowns, chains)
//    04-loop.js      new game, days, nights, travel, the passing of time
//    05-ui.js        HUD, scene, tabs, action list, to-do + priorities, log, tips
//    06-save.js      autosave, 3 slots, migrations, transfer codes, install, service worker
//    07-endings.js   end screen, score, best score, achievements
//    08-settings.js  title screen, name/difficulty pickers, settings, accessibility, slots
//    09-keys.js      keyboard shortcuts for desktop
//    20-world.js     ← YOUR GAME: stats, starting state, places, actions, scenery
//    21-story.js     ← YOUR GAME: events, tips, to-do, achievements, scoring, migrations
//    31-supplies.js  ← YOUR GAME: food, home fuel storage, power outages and the generator
//    99-boot.js      starts the app
//  Engine files (00–09) shouldn't need much editing; your game lives in 20+.
// ============================================================
const GAME={
  id:'guidemaster',           // storage-key prefix and service-worker cache prefix (lowercase, no spaces)
  title:'Guide Master',
  tagline:'A guide’s career on the Kenai',
  codePrefix:'GUIDEMASTER',   // transfer codes start with this, e.g. POCKETWEEK:eyJ…
  version:'1.8.0',           // bump on every release: shown in Settings, stamped into saves and sw.js
  schema:2,                  // bump when the shape of S changes, and add a MIGRATIONS entry (21-story.js)
  days:14,                   // days in ONE season (the July peak, Mon–Sun twice; season 1 is Jul 13–26, 2026). A career is 14 × years: see the getter below
  wake:300,                  // default alarm for new games, in minutes after midnight (300 = 5:00 AM: guides start early; saves keep their own S.alarm)
  startLoc:'shop',
  travelAnim:20,             // trips this many minutes or longer play the full-screen transition
  defaultName:'Skipper',      // used until the player picks a name
  slots:3,                   // save slots
};
// Guide Master: a run is 2, 5 or 10 seasons of 14 days (24-career.js), so days is computed from the save.
Object.defineProperty(GAME,'days',{get(){return 14*((typeof S!=='undefined'&&S&&S.years)||2)},configurable:true});
const APP_VERSION=GAME.version, SAVE_SCHEMA=GAME.schema;
const KEY=k=>GAME.id+'.'+k;  // every localStorage key goes through this
const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
// Difficulties: anything here is readable in your content as DF().something.
const DIFFS={
  // money: starting cash. bad: random-event multiplier. enforce: catch-chance multiplier. fine: fine multiplier;
  // esc: extra fine per citation already on your record. cost: fuel, overhead, winter bills and repairs.
  // mood: client happiness (tips, rep). book: off-month bookings. wear: boat wear. No difficulty changes the score.
  easy:  {n:'Rookie Season',ic:'🎣',d:'More cash, fewer troopers, cheaper bills and easygoing clients. For learning the water.',money:3000,bad:0.6,enforce:0.7,fine:0.8,esc:0.1,cost:0.8,mood:5,book:1.08,wear:0.85},
  normal:{n:'Licensed Guide',ic:'🛶',d:'The Kenai as it is: busy, beautiful and well patrolled.',money:1500,bad:1,enforce:1,fine:1,esc:0.2,cost:1,mood:0,book:1,wear:1},
  hard:  {n:'Combat Season',ic:'🐻',d:'Thin cash, more troopers, fines that climb steeply with every citation, dearer fuel and bills, pickier clients, quieter off-months and more bad luck. Same score, tougher grade.',money:600,bad:1.5,enforce:1.4,fine:1.1,esc:0.3,cost:1.2,mood:-5,book:0.88,wear:1.25},
};
const DF=()=>DIFFS[(typeof S!=='undefined'&&S&&S.diff)||'normal']||DIFFS.normal;
