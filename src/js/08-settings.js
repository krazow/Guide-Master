// ---------------- starting a game ----------------
let NMV='';
window.nameInput=v=>{NMV=v};
function nameModal(opts={}){
  NMV=opts.value!=null?opts.value:(profileName()||'');
  modal(opts.first?'👋 Welcome':'👤 Change your name',`${opts.first?'<p>What should everyone call you?</p>':'<p>Every line in your log will use the new name.</p>'}
    <input class="nm-in" id="nmIn" maxlength="20" autocomplete="off" aria-label="Your name" placeholder="${esc(GAME.defaultName)}" value="${esc(NMV)}" oninput="nameInput(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();MBTN(0)}">
    ${opts.err?`<div style="color:var(--bad);font-size:13px;margin-top:6px">${esc(opts.err)}</div>`:'<div style="color:var(--mute);font-size:12px;margin-top:6px">Up to 20 characters. You can change it any time in ⚙️ Settings.</div>'}`,
  [{l:opts.first?'That’s me':'Save name',fn:()=>{const r=cleanName(NMV);if(r.err)return setTimeout(()=>nameModal(Object.assign({},opts,{value:NMV,err:r.err})),0);
      setPlayerName(r.name);if(opts.then)opts.then();else if(document.querySelector('.title'))titleScreen();else if(S&&!S.over)render()}},
   ...(opts.first?[]:[{l:'Cancel',fn:()=>{if(opts.back)opts.back()}}])]);
  setTimeout(()=>{const i=document.getElementById('nmIn');if(i){i.focus();i.select()}},60);
}
function diffModal(then){
  const cur=prefs().diff;
  modal('🎚️ Pick a difficulty','',Object.keys(DIFFS).map(k=>({l:`${DIFFS[k].ic} ${DIFFS[k].n}${k===cur?' (last time)':''}`,s:DIFFS[k].d,fn:()=>{setPref('diff',k);then(k)}})));
}
// Name (first time only) → difficulty → play. Add more pickers to this chain if your game needs them.
window.startNewGame=()=>{const go=k=>{newGame(k);render()};const pickDiff=()=>diffModal(go);if(!profileName())nameModal({first:true,then:pickDiff});else pickDiff()};

// ---------------- title screen ----------------
// Phone-first: an install bar (41-install.js, when installing makes sense), the art with the ⚙️ gear, the title, ONE big button
// (Start, or Continue when there's a save), "What's the game about?" (intro + bullets, folded), then the other buttons in a
// two-column grid (an odd one out spans both columns) and the version note. fitTitle() shrinks the art when the screen is short.
function titleScreen(){clearTiles();
  const prev=document.querySelector('.title details.about'),wasOpen=prev?prev.open:null;
  const d=loadSave(),multi=[2,3].some(k=>k<=GAME.slots&&k!==curSlot()&&rawSave(k));
  const cells=[
    ...(d?['<button class="ghost" onclick="startNewGame()">🆕 New game</button>']:[]),
    ...(GAME.slots>1?['<button class="ghost" onclick="slotsModal()">💾 Save slots</button>']:[]),
    ...(installButton()?[installButton()]:[]),
    ...(typeof helpModal==='function'?['<button class="ghost" onclick="helpModal()">❓ Help!</button>']:[]),
    ...(typeof feedbackModal==='function'?['<button class="ghost" onclick="feedbackModal()">💬 Send feedback</button>']:[]),
    '<button class="ghost" onclick="openTransfer()" title="Transfer a saved game to another device or browser">🔁 Transfer a save</button>'];
  if(cells.length%2)cells[cells.length-1]=cells[cells.length-1].replace('class="ghost"','class="ghost wide"').replace('🔁 Transfer a save<','🔁 Transfer a saved game<');
  const about=TITLE.intro||TITLE.bullets.length;
  app.innerHTML=withName(`<div class="title">${typeof installBar==='function'?installBar():''}<div class="art"><button class="tgear" onclick="openSettings()" aria-label="Settings">⚙️</button>${TITLE.art()}</div>
  <div class="body"><h1>${esc(GAME.title)}<span>${esc(GAME.tagline)}</span></h1>
  ${d?`<button class="big" onclick="resumeGame()">Continue as ${esc(d.S.name||currentName())}: ${dayName(d.S.cur)} ${fmt(d.S.t)}${multi||curSlot()>1?` (slot ${curSlot()})`:''}</button>`:`<button class="big" onclick="startNewGame()">${TITLE.start}</button>`}
  ${about?`<details class="about"><summary>What’s the game about?</summary>${TITLE.intro?`<p>${TITLE.intro}</p>`:''}
  ${TITLE.bullets.length?`<ul>${TITLE.bullets.map(b=>`<li>${b}</li>`).join('')}</ul>`:''}</details>`:''}
  <div class="tgrid">${cells.join('')}</div>
  ${saveNotice?`<div class="hint">⚠️ ${saveNotice}</div>`:''}${exitNotice?`<div class="hint">${exitNotice}</div>`:''}
  <div class="small-note">Version ${APP_VERSION}. ${TITLE.note||''}</div></div></div>`);
  exitNotice='';saveNotice='';
  const det=document.querySelector('.title details.about');
  // folded for returning players; a brand-new player sees it open only when everything still fits with the full picture
  if(det){if(wasOpen!=null)det.open=wasOpen;else if(!d&&!anySave()){det.open=true;if(!titleFits(250))det.open=false}}
  fitTitle();
  if(typeof maybeUpdateNotice==='function')maybeUpdateNotice();
}
function anySave(){for(let k=1;k<=GAME.slots;k++)if(rawSave(k))return true;return false}
const TITLE_ART_MIN=120,TITLE_ART_MAX=250;
// Does the title screen fit the window with the art at this height?
function titleFits(h){const t=document.querySelector('.title'),a=t&&t.querySelector('.art');if(!a)return true;
  a.style.height=h+'px';const r=document.scrollingElement.scrollHeight<=innerHeight+1;a.style.height='';return r}
// The art gives up height (down to TITLE_ART_MIN) so the buttons stay on screen.
function fitTitle(){const t=document.querySelector('.title'),a=t&&t.querySelector('.art');if(!a)return;
  a.style.height='';const det=t.querySelector('details.about');if(det&&det.open)return;   // reading the intro: scroll instead
  const over=document.scrollingElement.scrollHeight-innerHeight;
  if(over>0)a.style.height=Math.max(TITLE_ART_MIN,TITLE_ART_MAX-over)+'px'}
window.addEventListener('resize',()=>{if(document.querySelector('.title'))fitTitle()});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{if(document.querySelector('.title'))fitTitle()});

// ---------------- save slots ----------------
function slotLabel(n){const d=loadSave(n);return d?`${esc(d.S.name||currentName())} · ${DIFFS[d.S.diff].ic} ${dayName(d.S.cur)} ${fmt(d.S.t)}`:'<span class="slot-empty">Empty</span>'}
window.slotsModal=()=>{
  const inGame=S&&!S.over&&!document.querySelector('.title,.end');
  modal('💾 Save slots',`<p>${inGame?'Your game is saved first. ':''}Each slot holds one game.</p>`,[
    ...Array.from({length:GAME.slots},(_,i)=>i+1).map(n=>({l:`Slot ${n}${n===curSlot()?' (current)':''}`,s:slotLabel(n),fn:()=>slotModal(n)})),
    {l:'Close',fn:()=>{}}]);
};
function slotModal(n){
  const has=!!loadSave(n);
  const use=()=>{if(S&&!S.over)saveGame();setSlot(n);S=null;closeModals()};
  modal(`💾 Slot ${n}`,`<p>${slotLabel(n)}</p>`,[
    ...(has?[{l:'▶️ Continue this game',fn:()=>{use();resumeGame()}}]:[]),
    {l:has?'🆕 Start over in this slot':'🆕 Start a new game here',s:has?'Replaces the game in this slot.':'',fn:()=>{use();titleScreen();startNewGame()}},
    ...(has?[{l:'🗑️ Delete this save',fn:()=>modal('🗑️ Delete this save?',`<p>Slot ${n}: ${slotLabel(n)}. This can’t be undone.</p>`,[
      {l:'Delete it',fn:()=>{const ls=store();slotKeys(n).forEach(k=>ls&&ls.removeItem(k));if(n===curSlot()&&S&&!S.over){S=null;titleScreen()}else if(document.querySelector('.title'))titleScreen()}},
      {l:'Keep it',fn:()=>slotsModal()}])}]:[]),
    {l:'Back',fn:()=>slotsModal()}]);
}

// ---------------- settings ----------------
let exitNotice='',inGameExited=false;
function accessModal(){
  const p=prefs();
  modal('♿ Accessibility','<p>These settings apply on this device.</p>',[
    {l:`🔠 Text size: ${{n:'Normal',l:'Large',xl:'Extra large'}[p.fs]}`,s:'Tap to cycle Normal → Large → Extra large.',fn:()=>{setPref('fs',{n:'l',l:'xl',xl:'n'}[p.fs]);accessModal()}},
    {l:`🌓 High contrast: ${p.hc?'On':'Off'}`,s:'Darker text and borders.',fn:()=>{setPref('hc',!p.hc);accessModal()}},
    {l:`🎞️ Reduce motion: ${p.rm?'On':'Off'}`,s:'Turns off animations and shortens transitions.',fn:()=>{setPref('rm',!p.rm);accessModal()}},
    {l:'Back to settings',fn:()=>openSettings()}]);
}
window.openSettings=()=>{
  const inGame=S&&!S.over&&!document.querySelector('.title,.end');
  modal('⚙️ Settings',`<p>Playing as <b>{{name}}</b>${inGame?` · ${DF().ic} ${DF().n}`:''}.</p><p style="font-size:12px;color:var(--mute)">${esc(GAME.title)} version ${APP_VERSION}</p>`,[
    {l:'👤 Change name',s:'Updates your name everywhere in the game.',fn:()=>nameModal({back:openSettings})},
    {l:`🔊 Sound: ${prefs().sound?'On':'Off'}`,s:'Alerts and chimes.',fn:()=>{setPref('sound',!prefs().sound);if(prefs().sound)sfx('good');openSettings()}},
    {l:`🔔 Catch chime: ${prefs().chime?'On':'Off'}`,s:'A short chime for trophies, kings, limit-outs and first fish. Off unless you turn it on.',fn:()=>{setPref('chime',!prefs().chime);if(prefs().chime&&typeof memChime==='function')memChime();openSettings()}},
    ...(ART.any()?[{l:`🖼️ Illustrations: ${artPref()?'On':'Off'}`,s:'Pictures on the Home tab, trips, camping and events. Turn off to keep the drawn scenes only (and save data).',fn:()=>{setPref('art',!artPref());if(S&&!S.over&&!document.querySelector('.title,.end'))render();openSettings()}}]:[]),
    {l:'♿ Accessibility',s:`Text size: ${{n:'Normal',l:'Large',xl:'Extra large'}[prefs().fs]} · High contrast: ${prefs().hc?'On':'Off'} · Reduce motion: ${prefs().rm?'On':'Off'}`,fn:()=>accessModal()},
    {l:`💡 Tips: ${prefs().tips?'On':'Off'}`,s:'One short tip at a time while you learn.',fn:()=>{setPref('tips',!prefs().tips);openSettings()}},
    {l:`🔔 Event pop-ups: ${popupsOn()?'On':'Off'}`,s:popupsOn()?'An OK window for each event during the day. Tap to turn off (the tiles still show).':'Events during the day show as small tiles and log lines. Tap to get an OK window for each. The morning report always shows.',fn:()=>{try{localStorage.setItem(POPUP_KEY,popupsOn()?'off':'on')}catch(e){}openSettings()}},
    {l:`🛶 Show every trip step: ${prefs().tripSteps?'On':'Off'}`,s:prefs().tripSteps?'Each choice on a trip opens its own pop-up. Tap to put a trip back on one sheet.':'A trip is one sheet: your choices and the result change in place. Tap to open a pop-up for every step.',fn:()=>{setPref('tripSteps',!prefs().tripSteps);openSettings()}},
    ...(typeof feedbackModal==='function'?[{l:'💬 Send feedback',s:'Ideas, bugs, a rule we got wrong: it goes straight to the developer.',fn:()=>feedbackModal(openSettings)}]:[]),
    ...(typeof helpModal==='function'?[{l:'❓ Help',s:'How to play, the trophy wall, the rating, and the mentor’s ride-along.',fn:()=>helpModal()}]:[]),
    {l:'⌨️ Keyboard shortcuts',s:'On a computer: numbers press buttons, ? for the list.',fn:()=>keysModal(openSettings)},
    {l:`🏆 Achievements (${achCount()}/${ACH.length})`,s:'Earned on this device, across all your games.',fn:()=>achModal(openSettings)},
    ...(GAME.slots>1?[{l:`💾 Save slots (current: ${curSlot()})`,s:'Continue, start or delete games in each slot.',fn:()=>slotsModal()}]:[]),
    {l:'🚪 Exit game',s:inGame?'Saves first.':'Close '+GAME.title+'.',fn:()=>confirmExit(inGame)},
    {l:'Close',fn:()=>{}}]);
};
function tryClose(){try{window.close()}catch(e){}
  setTimeout(()=>{if(!document.hidden){exitNotice=inGameExited?'✅ Your game is saved. Your browser won’t let a page close itself, so just close this tab. Continue picks up right where you left off.':'Your browser won’t let a page close itself. You can close this tab.';titleScreen()}},250)}
function confirmExit(inGame){
  if(!inGame){inGameExited=!!loadSave();return tryClose()}
  modal(`🚪 Exit ${esc(GAME.title)}?`,`<p>Your game is saved automatically. Next time, tap <b>Continue</b> on the title screen to pick up right here (${dayName(day())} ${fmt(S.t)}).</p>`,[
    {l:'Save and exit',fn:()=>{saveGame();MQ=[];clearTiles();inGameExited=true;S=null;titleScreen();tryClose()}},
    {l:'Keep playing',fn:()=>{}}]);
}
