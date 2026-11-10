// ---------------- endings ----------------
// finish()        the run reached its last night: graded with scoreOf()/gradeOf()
// gameOver(id)    a loss from LOSSES (checkLoss() in your content returns the id)
// Content supplies: scoreOf(), gradeOf(score), endRows(), LOSSES, FINISH_TEXT. See 21-story.js.
function finish(){clearTiles();S.over=true;sfx('win');endScreen(withName(FINISH_TEXT.h1),FINISH_TEXT.sub())}
function gameOver(why){S.over=true;clearTiles();closeModals();sfx('bad');
  const T=LOSSES[why]||['Game over','It’s over.'];endScreen(T[0],T[1],true)}
function endScreen(h1,sub,lost){
  achCheck({end:true,lost});const achNew=(S.achGame||[]).map(id=>ACH.find(a=>a.id===id)).filter(Boolean);
  const sc=Math.round(scoreOf()*DF().score),g=lost?['F',h1,sub]:gradeOf(sc);
  saveGame(); // S.over is set, so this deletes the save
  let best=null,newBest=false;const ls=store();
  try{const b=ls?Number(ls.getItem(BEST_KEY)||'NaN'):NaN;best=isNaN(b)?null:b;if(!lost&&(best==null||sc>best)){ls&&ls.setItem(BEST_KEY,String(sc));newBest=true}}catch(e){}
  app.innerHTML=withName(`<div class="end"><div style="display:flex;justify-content:space-between;align-items:center"><div class="small-note" style="color:var(--mute)">${lost?'GAME OVER':'COMPLETE'} · {{name}}</div><button class="gear" style="background:var(--surface);color:var(--ink)" onclick="openSettings()" aria-label="Settings">⚙️</button></div><h1>${h1}</h1><p>${sub}</p>
  <div style="display:flex;gap:16px;align-items:center;margin:16px 0"><div class="grade">${g[0]}</div><div><b style="font-family:Fraunces;font-size:20px">${g[1]}</b><div style="color:var(--mute);font-size:14px">${g[2]}</div></div></div>
  <div class="kv"><span>Difficulty</span><b>${DF().ic} ${DF().n}</b></div>
  <div class="kv"><span>Score</span><b>${sc}${newBest?' 🏆 new best':''}</b></div>${best!=null?`<div class="kv"><span>Previous best</span><b>${best}</b></div>`:''}
  <div class="kv"><span>🏆 Achievements this game</span><b style="text-align:right">${achNew.length?achNew.map(a=>a.ic+' '+a.n).join(', '):'none new'}</b></div>
  ${endRows().map(([k,v])=>`<div class="kv"><span>${k}</span><b>${v}</b></div>`).join('')}
  <button class="big" style="width:100%;margin-top:22px" onclick="startNewGame()">Play again</button><button class="act" style="margin-top:10px;justify-content:center" onclick="titleScreen()"><span class="tx" style="text-align:center"><b>Back to title</b></span></button></div>`);
  window.scrollTo(0,0);
}

// ---------------- achievements ----------------
// Kept per device under their own key, separate from saves: they survive new games and deleted slots.
// ACH (21-story.js): [{id, ic, n:'Name', d:'How to get it', test:ctx=>bool}]   ctx: {} | {night,where} | {end,lost}
const ACH_KEY=KEY('achievements');
function achGot(){try{const o=JSON.parse(localStorage.getItem(ACH_KEY)||'{}');return o&&typeof o==='object'&&!Array.isArray(o)?o:{}}catch(e){return {}}}
function achCount(){const g=achGot();return ACH.filter(a=>g[a.id]).length}
function achUnlock(id){const a=ACH.find(x=>x.id===id);if(!a)return;const g=achGot();if(g[id])return;
  g[id]=Date.now();try{localStorage.setItem(ACH_KEY,JSON.stringify(g))}catch(e){}
  if(S){S.achGame=S.achGame||[];S.achGame.push(id)}
  setTimeout(()=>showTile(a.ic,'Achievement: '+a.n,a.d,'good','🏆'),0)}
function achCheck(c){if(!S)return;c=c||{};const g=achGot();
  for(const a of ACH){if(g[a.id])continue;let ok=false;try{ok=a.test(c)}catch(e){}if(ok)achUnlock(a.id)}}
function achModal(back){const g=achGot();
  modal(`🏆 Achievements (${achCount()}/${ACH.length})`,ACH.map(a=>`<div class="todo"><span class="ck">${g[a.id]?a.ic:'🔒'}</span><div><b>${a.n}</b><span>${a.d}</span></div></div>`).join(''),
    (back?[{l:'Back to settings',fn:back}]:[]).concat([{l:'Close',fn:()=>{}}]))}
