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
function titleScreen(){clearTiles();
  const d=loadSave(),multi=[2,3].some(k=>k<=GAME.slots&&k!==curSlot()&&rawSave(k));
  app.innerHTML=withName(`<div class="title"><button class="tgear" onclick="openSettings()" aria-label="Settings">⚙️</button><div class="art">${TITLE.art()}</div>
  <div class="body"><h1>${esc(GAME.title)}<span>${esc(GAME.tagline)}</span></h1>
  <p>${TITLE.intro}</p>
  ${TITLE.bullets.length?`<ul>${TITLE.bullets.map(b=>`<li>${b}</li>`).join('')}</ul>`:''}
  ${d?`<button class="big" onclick="resumeGame()">Continue as ${esc(d.S.name||currentName())}: ${dayName(d.S.cur)} ${fmt(d.S.t)}${multi||curSlot()>1?` (slot ${curSlot()})`:''}</button><button class="ghost" onclick="startNewGame()">Start a new game</button>`:`<button class="big" onclick="startNewGame()">${TITLE.start}</button>`}
  ${GAME.slots>1?'<button class="ghost" onclick="slotsModal()">💾 Save slots</button>':''}
  ${typeof helpModal==='function'?'<button class="ghost" onclick="helpModal()">❓ Help!</button>':''}
  ${typeof feedbackModal==='function'?'<button class="ghost" onclick="feedbackModal()">💬 Send feedback</button>':''}
  <button class="ghost" onclick="openTransfer()">🔁 Transfer a saved game</button>
  ${saveNotice?`<div class="hint">⚠️ ${saveNotice}</div>`:''}${exitNotice?`<div class="hint">${exitNotice}</div>`:''}
  <button id="installBtn" class="ghost" style="display:${deferredInstall&&!isStandalone()?'block':'none'}" onclick="doInstall()">📲 Install as an app</button>
  ${!isStandalone()&&isIOS()?'<div class="hint">📲 <b>Play it like an app:</b> tap the Share button in Safari, then <b>Add to Home Screen</b>. It works offline, too.</div>':''}
  <div class="small-note">Version ${APP_VERSION}. ${TITLE.note||''}</div></div></div>`);
  exitNotice='';saveNotice='';
  if(typeof maybeUpdateNotice==='function')maybeUpdateNotice();
}

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
    {l:'♿ Accessibility',s:`Text size: ${{n:'Normal',l:'Large',xl:'Extra large'}[prefs().fs]} · High contrast: ${prefs().hc?'On':'Off'} · Reduce motion: ${prefs().rm?'On':'Off'}`,fn:()=>accessModal()},
    {l:`💡 Tips: ${prefs().tips?'On':'Off'}`,s:'One short tip at a time while you learn.',fn:()=>{setPref('tips',!prefs().tips);openSettings()}},
    {l:`🔔 Event pop-ups: ${popupsOn()?'On':'Off'}`,s:popupsOn()?'An OK window for each event during the day. Tap to turn off (the tiles still show).':'Events during the day show as small tiles and log lines. Tap to get an OK window for each. The morning report always shows.',fn:()=>{try{localStorage.setItem(POPUP_KEY,popupsOn()?'off':'on')}catch(e){}openSettings()}},
    {l:`🛶 Show every trip step: ${prefs().tripSteps?'On':'Off'}`,s:prefs().tripSteps?'Each choice on a trip opens its own pop-up. Tap to put a trip back on one sheet.':'A trip is one sheet: your choices and the result change in place. Tap to open a pop-up for every step.',fn:()=>{setPref('tripSteps',!prefs().tripSteps);openSettings()}},
    ...(typeof feedbackModal==='function'?[{l:'💬 Send feedback',s:'Ideas, bugs, a rule we got wrong: it goes straight to the developer.',fn:()=>feedbackModal(openSettings)}]:[]),
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
