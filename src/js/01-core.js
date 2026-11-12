// ---------------- state ----------------
// S is the whole saved game. Anything you put in S is saved, loaded and transferred automatically.
// tab is the open tab; uiNarr is the narration shown at the top of the Here tab (cleared on each tap).
let S, tab='act', uiNarr=[];

// ---------------- preferences (device-wide, not per save) ----------------
const PREF_KEY=KEY('prefs');
const PREF_DEF={fs:'n',hc:false,rm:(()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}})(),sound:true,tips:true,diff:'normal',goOpen:null,tripSteps:false};
function prefs(){try{return Object.assign({},PREF_DEF,JSON.parse(localStorage.getItem(PREF_KEY)||'{}'))}catch(e){return Object.assign({},PREF_DEF)}}
function setPref(k,v){const p=prefs();p[k]=v;try{localStorage.setItem(PREF_KEY,JSON.stringify(p))}catch(e){}applyPrefs()}
function applyPrefs(){const p=prefs(),c=document.documentElement.classList;c.toggle('fs-l',p.fs==='l');c.toggle('fs-xl',p.fs==='xl');c.toggle('hc',!!p.hc);c.toggle('rm',!!p.rm)}

// ---------------- sound (synthesized with Web Audio: no files to ship) ----------------
let AC=null;
function audio(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)()}catch(e){return null}}if(AC.state==='suspended')AC.resume().catch(()=>{});return AC}
function tone(f,dur,type,vol,when,slide){const a=audio();if(!a)return;const t=a.currentTime+(when||0);const o=a.createOscillator(),g=a.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+dur);
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol||0.1,t+0.03);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(g).connect(a.destination);o.start(t);o.stop(t+dur+0.05)}
// Add your own named sounds here.
const SFX={
  good:()=>{tone(784,0.18,'sine',0.09);tone(1175,0.28,'sine',0.07,0.12)},
  bad: ()=>{tone(233,0.22,'triangle',0.12);tone(175,0.35,'triangle',0.1,0.15)},
  info:()=>tone(660,0.16,'sine',0.06),
  win: ()=>[523,659,784,1046].forEach((f,i)=>tone(f,0.28,'sine',0.09,i*0.1)),
  tap: ()=>tone(520,0.05,'sine',0.03),
  whoosh:()=>tone(300,0.6,'triangle',0.05,0,900),
  horn:()=>{tone(110,1.5,'triangle',0.16);tone(138.6,1.5,'triangle',0.12);tone(220,1.5,'sine',0.04)},
};
function sfx(n){if(!prefs().sound||!SFX[n])return;try{SFX[n]()}catch(e){}}
function buzz(p){try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}}

// ---------------- player name ----------------
// Any text can contain {{name}}. It's swapped in only when shown, so renaming updates every line already in the log.
const NAME_KEY=KEY('name');
function esc(t){return String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function profileName(){try{return localStorage.getItem(NAME_KEY)||''}catch(e){return ''}}
function currentName(){return (typeof S!=='undefined'&&S&&S.name)||profileName()||GAME.defaultName}
function withName(t){return typeof t==='string'?t.replace(/\{\{name\}\}/g,esc(currentName())):t}
function cleanName(raw){const n=String(raw||'').replace(/\s+/g,' ').trim();
  if(!n) return {err:'Please enter a name.'};
  if(n.length>20) return {err:'Keep it to 20 characters or fewer.'};
  if(!/^[\p{L}\p{N}][\p{L}\p{N} '’.\-]*$/u.test(n)) return {err:'Letters, numbers, spaces, apostrophes, periods and hyphens only.'};
  return {name:n}}
function setPlayerName(n){
  const old=currentName();
  try{localStorage.setItem(NAME_KEY,n)}catch(e){}
  if(S&&!S.over){S.name=n;if(old!==n)say('✏️ From now on, everyone calls you {{name}}.');saveGame()}
  else{ // on the title screen: rename the saved game too, so Continue uses the new name
    const ls=store();if(ls)try{for(const k of slotKeys()){const v=ls.getItem(k);if(!v)continue;const d=JSON.parse(v);if(d&&d.S){d.S.name=n;ls.setItem(k,JSON.stringify(d))}}}catch(e){}
    if(S&&S.over) S.name=n}
}

// ---------------- time ----------------
// S.t is minutes since the start of the run (day 0, midnight). S.cur is the current day index.
const day=()=>S.cur;
const tod=()=>S.t-S.cur*1440;                       // minutes since midnight today
const dayName=d=>DAYS[((d%7)+7)%7];
function fmt(m){m=((m%1440)+1440)%1440;let h=Math.floor(m/60),mi=m%60;const ap=h<12?'AM':'PM';h=h%12||12;return h+':'+String(mi).padStart(2,'0')+' '+ap}
function fmtAbs(a){const d=Math.floor(a/1440);return (d!==day()?dayName(d).slice(0,3)+' ':'')+fmt(a)}

// ---------------- helpers for content ----------------
function say(s){uiNarr.push(s);S.log.push({t:S.t,s})}              // narrate + log
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function adj(k,v,lo=0,hi=100){S[k]=clamp(Math.round(S[k]+v),lo,hi)} // nudge a 0–100 stat
function money(v){S.money=Math.round((S.money+v)*100)/100}
// Numbers with thousands separators; $() is the one money formatter (cents only when there are some): $47,975, −$1,200, $6.19.
const grp=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,',');
const $=x=>{const f=(Math.round(Math.abs(x)*100)/100).toFixed(x%1?2:0).split('.');f[0]=grp(+f[0]);return (x<0?'−':'')+'$'+f.join('.')};
const $k=x=>Math.abs(x)>=10000?(x<0?'−':'')+'$'+Math.round(Math.abs(x)/1000)+'k':$(x);   // compact money for tight spots (the top bar): $48k
const pick=a=>a[Math.floor(Math.random()*a.length)];
function isOpen(id,t=S.t){const h=L[id].hours;if(!h)return true;const r=h(Math.floor(t/1440));if(!r)return false;const m=t%1440;return m>=r[0]&&m<r[1]}
function hoursTxt(id){const h=L[id].hours;if(!h)return '';const r=h(day());return r?`Open ${fmt(r[0])}–${fmt(r[1])}`:'Closed today'}
