// ---------------- "Updated to version X" notice ----------------
// The title screen calls maybeUpdateNotice(). If this device last acknowledged a different version, a pop-up says which
// version the game is now, what's new, and (when there are saved games) that they were brought up to date. The only way
// to dismiss it is its "Got it" button; the version is remembered only after that, so a reload shows it again.
// A brand-new player (no remembered version, no saves) gets no pop-up: the version is just remembered.
// Add a line list here for each release (newest last). Unknown versions get the generic line below.
const CHANGELOG={
  '1.3.0':['⛽ Fuel: gas up the jet sled and the truck, and watch the gauge before a long run.'],
  '1.3.1':['☕ Coffee break: spend 5 minutes on coffee to settle in (not on the drift boat).'],
  '1.3.2':['❓ Help! button on the title screen and in Settings explains the rules and the game.'],
  '1.4.0':['💬 Send feedback: tell the developer about ideas, bugs or a rule that looks wrong.'],
  '1.5.0':['🏕️ Winter camping in the off-season: pick a destination and how many nights.'],
  '1.5.1':['🩹 Fixes: no more “undefined” on bookings; first-aid classes now Mon/Tue/Thu with earlier reminders; booking requests for days you can’t legally fish are flagged, with an offer to move them.'],
  '1.5.2':['🆕 This notice: after each update you’ll see what changed, and your progress is brought up to date automatically.'],
  '1.5.3':['⚖️ Difficulty now changes the game, not the score: Combat Season means more patrols and dearer bills, Rookie the reverse. Grades were recalibrated, so an A takes real work.'],
  '1.5.4':['🎲 Dilemma options shuffle: playing it straight costs something, bending a rule can pay cash, and repeat offenders pay steeper fines. Pay now follows the day: catch, tackle and boat shape tips, refunds and word of mouth.'],
  '1.6.0':['💲 Higher rates now cost you: fewer bookings, pickier clients and a rep requirement that rises each step.','🔧 Boats at condition 0 are out of service until repaired; new motors burn less gas, new sleds finish sooner, and late-career money can buy an assistant guide, guest cabins or a riverfront launch.','⏳ New “Wait until…” action skips to the next launch or the 1 PM class. New games start with a 5:00 AM alarm.','🌙 The night summary now comes before the morning’s news, and pop-up toasts are fewer, shorter and sit below your Cash and Rep.','⭐ Longer careers: 54 client parties, regulars who come back (or don’t), six new river dilemmas, fewer repeats and three multi-season stories.'],
  '1.6.1':['🔧 A worn-out boat now gives warnings at 40, 20 and 10, and at condition 0 you can pay for an emergency patch or rent a loaner to keep a booked trip running.','🏛️ The Board of Fisheries hearing only comes on a day with no trips booked, so it can’t cost you a no-show.','💵 Money shows thousands separators ($47,975), the end screen breaks your score down line by line and labels played trips versus the estimated rest of the summer, and the off-season summary is shorter.','♿ Pop-ups keep keyboard focus inside and close with Esc, Go buttons say where they go, tap targets are 44 px and the top bar no longer wraps at large text.'],
};
const CHANGELOG_GENERIC='Fixes and small improvements throughout.';
const LASTVER_KEY=KEY('lastVersion');
function lastSeenVersion(){try{return localStorage.getItem(LASTVER_KEY)||''}catch(e){return ''}}
function rememberVersion(){try{localStorage.setItem(LASTVER_KEY,APP_VERSION)}catch(e){}}
// Run every slot's save through the engine's own migrate() and write it back stamped with this version
// (keeping its timestamp, so the current slot and "newest save" don't change). Returns {count, oldest app version}.
function upgradeAllSaves(){
  const ls=store(),out={count:0,oldest:''};if(!ls)return out;
  for(let n=1;n<=GAME.slots;n++){
    try{
      const r=rawSave(n);if(!r)continue;
      const raw=JSON.parse(r.v),d=migrate(raw);if(d.S.over)continue;
      out.count++;
      if(typeof raw.app==='string'&&raw.app&&(!out.oldest||verCmp(raw.app,out.oldest)<0))out.oldest=raw.app;
      if(d.newer)continue; // from a newer version: leave it exactly as it is
      ls.setItem(r.k,JSON.stringify({schema:d.schema,app:APP_VERSION,S:d.S,uiNarr:d.uiNarr,tab:d.tab,at:r.at||d.at}));
    }catch(e){}
  }
  return out;
}
function changelogLines(from){
  const vs=Object.keys(CHANGELOG).filter(v=>verCmp(v,APP_VERSION)<=0&&(!from||verCmp(v,from)>0)).sort((a,b)=>verCmp(b,a));
  const lines=[];
  if(!CHANGELOG[APP_VERSION])lines.push([APP_VERSION,CHANGELOG_GENERIC]);
  vs.forEach(v=>CHANGELOG[v].forEach(t=>lines.push([v,t])));
  return lines.slice(0,8);
}
function maybeUpdateNotice(){
  try{
    const seen=lastSeenVersion();
    if(seen===APP_VERSION)return;
    if(document.getElementById('mbg'))return; // something else is open; the next title screen will show it
    const saves=upgradeAllSaves(),from=seen||saves.oldest;
    if(!seen&&!saves.count){rememberVersion();return} // brand-new player
    const lines=changelogLines(from),multi=new Set(lines.map(l=>l[0])).size>1;
    const intro=from&&from!==APP_VERSION?`<p>${esc(GAME.title)} was updated from version ${esc(from)} to <b>${esc(APP_VERSION)}</b>.</p>`:`<p>${esc(GAME.title)} is now on version <b>${esc(APP_VERSION)}</b>.</p>`;
    const sv=saves.count?`<p>${saves.count>1?'Your saved games were':'Your saved game was'} updated to work with this version.</p>`:'';
    modal(`🆕 Updated to version ${esc(APP_VERSION)}`,`${intro}${sv}<p style="margin-bottom:2px"><b>What’s new</b></p><ul>${lines.map(l=>`<li>${multi?`<small>${esc(l[0])}</small> `:''}${l[1]}</li>`).join('')}</ul>`,
      [{l:'Got it',fn:rememberVersion}],true);
  }catch(e){}
}
