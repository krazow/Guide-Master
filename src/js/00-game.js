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
//    99-boot.js      starts the app
//  Engine files (00–09) shouldn't need much editing; your game lives in 20+.
// ============================================================
const GAME={
  id:'guidemaster',           // storage-key prefix and service-worker cache prefix (lowercase, no spaces)
  title:'Guide Master',
  tagline:'Two weeks guiding the Kenai',
  codePrefix:'GUIDEMASTER',   // transfer codes start with this, e.g. POCKETWEEK:eyJ…
  version:'1.3.2',           // bump on every release: shown in Settings, stamped into saves and sw.js
  schema:1,                  // bump when the shape of S changes, and add a MIGRATIONS entry (21-story.js)
  days:14,                   // length of a run, in days (Mon Jul 13 – Sun Jul 26, 2026)
  wake:270,                  // default alarm, in minutes after midnight (270 = 4:30 AM: guides start early)
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
  easy:  {n:'Rookie Season',ic:'🎣',d:'A fatter bank account and fewer troopers on the river. For learning the water.',money:3000,bad:0.6,score:1},
  normal:{n:'Licensed Guide',ic:'🛶',d:'The Kenai as it is: busy, beautiful and well patrolled.',money:1500,bad:1,score:1},
  hard:  {n:'Combat Season',ic:'🐻',d:'Thin margins, picky clients, more enforcement and more bears. Score ×1.25.',money:600,bad:1.5,score:1.25},
};
const DF=()=>DIFFS[(typeof S!=='undefined'&&S&&S.diff)||'normal']||DIFFS.normal;
