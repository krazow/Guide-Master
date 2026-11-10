// ---------------- saving ----------------
// render() autosaves after every tap, and the page saves when it's hidden (app switch, tab close).
// Saves live in localStorage, one key per slot. A finished game deletes its save.
const BEST_KEY=KEY('best'),SLOT_KEY=KEY('slot');
let saveNotice='';
function store(){try{return window.localStorage}catch(e){return null}}
function curSlot(){let n=1;try{n=parseInt(localStorage.getItem(SLOT_KEY)||'1',10)}catch(e){}return n>=1&&n<=GAME.slots?n:1}
function setSlot(n){try{localStorage.setItem(SLOT_KEY,String(n))}catch(e){}}
function slotKeys(n){n=n||curSlot();return [n===1?KEY('save'):KEY('save.slot'+n)]}
function packSave(){return {schema:SAVE_SCHEMA,app:APP_VERSION,S,uiNarr,tab,at:Date.now()}}
function saveGame(){const ls=store();if(!ls||!S)return;const keys=slotKeys();
  try{if(S.over)keys.forEach(k=>ls.removeItem(k));else{const v=JSON.stringify(packSave());keys.forEach(k=>{try{ls.setItem(k,v)}catch(e){}})}}catch(e){}}

// ---- loading and upgrading ----
// fillDefaults adds anything an older save is missing (new fields in baseState()/newState()) without touching what it has.
function fillDefaults(obj,def){
  for(const k in def){
    if(obj[k]===undefined||(obj[k]===null&&def[k]!==null&&typeof def[k]==='object'&&!Array.isArray(def[k]))) obj[k]=JSON.parse(JSON.stringify(def[k]));
    else if(def[k]&&typeof def[k]==='object'&&!Array.isArray(def[k])&&obj[k]&&typeof obj[k]==='object') fillDefaults(obj[k],def[k]);
  }
  return obj;
}
const num=(v,d)=>typeof v==='number'&&isFinite(v)?v:d;
// numeric dotted version compare: >0 when a is newer than b ('1.10.0' > '1.9.2')
const verCmp=(a,b)=>{const p=v=>String(v||'').split('.').map(n=>parseInt(n,10)||0),x=p(a),y=p(b);for(let i=0;i<Math.max(x.length,y.length);i++){const k=(x[i]||0)-(y[i]||0);if(k)return k}return 0};
let newerWarned='';
function migrate(d){
  if(!d||typeof d!=='object'||!d.S||typeof d.S!=='object') throw new Error('not a '+GAME.title+' save');
  const from=num(d.schema,1),x=d.S,notes=[];
  // your schema upgrades (21-story.js), oldest first
  for(const m of (typeof MIGRATIONS!=='undefined'?MIGRATIONS:[]).slice().sort((a,b)=>a.to-b.to)) if(from<m.to) m.run(x,notes,d);
  fillDefaults(x,baseState());
  // engine fields must be sane
  x.t=num(x.t,GAME.wake);x.cur=clamp(num(x.cur,Math.floor(x.t/1440)),0,GAME.days-1);
  if(!L[x.loc]){notes.push('a place from another version doesn’t exist here, so you’re back at the start');x.loc=GAME.startLoc}
  if(!DIFFS[x.diff]) x.diff='normal';
  if(!Array.isArray(x.log)) x.log=[];
  if(!Array.isArray(x.prios)) x.prios=[];
  if(!Array.isArray(x.ev.force)) x.ev.force=[];
  if(!Array.isArray(x.ev.history)) x.ev.history=[];
  const newer=typeof d.app==='string'&&verCmp(d.app,APP_VERSION)>0?d.app:null;
  if(from>SAVE_SCHEMA&&!newer) notes.push(`this save is from a newer version (${d.app||'unknown'}). Anything this version doesn’t know about is kept but ignored`);
  else if(from<SAVE_SCHEMA) notes.push(`upgraded from an older version${d.app?' ('+d.app+')':''}`);
  const tabs=allTabs().map(t=>t[0]);
  return {schema:Math.max(from,SAVE_SCHEMA),app:d.app,S:x,uiNarr:Array.isArray(d.uiNarr)?d.uiNarr:[],tab:tabs.includes(d.tab)?d.tab:'act',at:d.at,notes,newer};
}
function rawSave(n){const ls=store();if(!ls)return null;let best=null;
  for(const k of slotKeys(n)){const v=ls.getItem(k);if(!v)continue;let at=0;try{at=JSON.parse(v).at||0}catch(e){}if(!best||at>best.at)best={k,v,at}}
  return best}
function loadSave(n){
  const r=rawSave(n);if(!r)return null;
  try{const d=migrate(JSON.parse(r.v));return d.S.over?null:d}
  catch(e){ // set an unreadable save aside instead of crashing on it forever
    try{const ls=store(),sn=n||curSlot();ls.setItem(KEY('save.broken'+(sn>1?'.slot'+sn:'')),r.v);slotKeys(sn).forEach(k=>ls.removeItem(k))}catch(_){}
    saveNotice='Your saved game couldn’t be read, so it was set aside. Start a new game.';return null}
}
function adopt(d){
  S=d.S;uiNarr=d.uiNarr;tab=d.tab;
  render();
  if(d.newer&&newerWarned!==d.newer){newerWarned=d.newer;modal('⚠️ Save from a newer version',`<p>This save is from ${esc(GAME.title)} ${esc(d.newer)}, newer than this copy (${APP_VERSION}). Update to keep everything: whatever this copy doesn’t know about is ignored, and may be lost if you keep playing here.</p>`,[{l:'Continue anyway',fn:()=>{}}])}
  if(d.notes&&d.notes.length) modal('Save loaded',`<p>Welcome back. Note: ${d.notes.join('; ')}.</p>`,[{l:'Continue',fn:()=>{}}]);
}
window.resumeGame=()=>{const d=loadSave();if(!d)return titleScreen();
  try{adopt(d)}catch(e){saveNotice='That save couldn’t be loaded in this version.';titleScreen()}};

// ---- transfer codes: move a game between devices, browsers or the installed app ----
function b64enc(str){return btoa(unescape(encodeURIComponent(str)))}
function b64dec(b){return decodeURIComponent(escape(atob(b)))}
function exportCode(){const d=rawSave();if(!d&&!S)return '';const obj=d?JSON.parse(d.v):packSave();return GAME.codePrefix+':'+b64enc(JSON.stringify(obj))}
window.openTransfer=()=>{
  const code=exportCode();
  modal('🔁 Transfer a saved game',`<p>Copy this code to move your game to another device or browser.</p>
  ${code?`<textarea id="exp" readonly aria-label="Your transfer code" style="width:100%;height:70px;font-size:11px;border-radius:8px;border:1.5px solid var(--line);padding:6px">${code}</textarea>
  <button class="act" style="margin-top:6px" onclick="copyCode()"><span class="tx"><b id="cpl">📋 Copy code</b></span></button>`:'<p><i>No game in progress to export.</i></p>'}
  <p style="margin-top:12px">Or paste a code here to load it. It replaces the save in this slot.</p>
  <textarea id="imp" aria-label="Paste a transfer code" oninput="window.IMPV=this.value" placeholder="${GAME.codePrefix}:…" style="width:100%;height:70px;font-size:12px;border-radius:8px;border:1.5px solid var(--line);padding:6px"></textarea>
  <div id="imperr" style="color:var(--bad);font-size:13px"></div>`,
  [{l:'Load pasted code',fn:importCode},{l:'Close',fn:()=>{if(!S||S.over)titleScreen()}}]);
};
window.copyCode=async()=>{const t=document.getElementById('exp');t.select();try{await navigator.clipboard.writeText(t.value);document.getElementById('cpl').textContent='✅ Copied'}catch(e){document.getElementById('cpl').textContent='Selected: press Ctrl+C / Copy'}};
function importCode(){
  const raw=(window.IMPV||document.getElementById('imp')?.value||'').trim();window.IMPV='';
  try{
    const body=raw.replace(new RegExp('^'+GAME.codePrefix+':'),'').replace(/\s+/g,'');
    const d=migrate(JSON.parse(b64dec(body)));
    if(d.S.over) throw new Error('already over');
    setTimeout(()=>adopt(d),0);
  }catch(e){setTimeout(()=>{openTransfer();const el=document.getElementById('imperr');if(el)el.textContent=/already over/.test(e.message)?'That game is already finished.':`That code didn’t work. Make sure you copied all of it, starting with ${GAME.codePrefix}:`;const i=document.getElementById('imp');if(i)i.value=raw},0)}
}

// ---- install as an app (PWA) + offline service worker ----
let deferredInstall=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;const b=document.getElementById('installBtn');if(b)b.style.display='block'});
window.addEventListener('appinstalled',()=>{deferredInstall=null;const b=document.getElementById('installBtn');if(b)b.style.display='none'});
const isStandalone=()=>{try{return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}catch(e){return false}};
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
window.doInstall=async()=>{if(!deferredInstall)return;deferredInstall.prompt();try{await deferredInstall.userChoice}catch(e){}deferredInstall=null;const b=document.getElementById('installBtn');if(b)b.style.display='none'};
// Skipped on localhost so you never debug a stale cached copy; add ?sw=1 to the URL to test offline mode locally.
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)&&(!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)||/[?&]sw=1\b/.test(location.search))){window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{})})}
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveGame()});
