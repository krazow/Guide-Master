// ============================================================
//  PURSE SEINE, part 0: the namespace.
//  Salmon seining out of Homer, Alaska (Lower Cook Inlet: Kachemak Bay and the outer coast) lives behind ONE global, Seine.
//  It never reads or writes anything of the game it sits in: everything it needs comes in through a ticket, and everything it
//  produces goes out in a report that a thin adapter applies. See src/seine/README.md for the contract.
// ============================================================
const Seine={
  VERSION:'1.0.0',
  SCHEMA:1,                 // version of the ticket, report and state shapes; bump when any of them change
};
(function(K){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const grp=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  // money for players: whole dollars with thousands separators and a real minus sign
  const $=x=>(x<0?'−':'')+'$'+grp(Math.abs(x));
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const n0=(v,d)=>typeof v==='number'&&isFinite(v)?v:d;
  const copy=o=>JSON.parse(JSON.stringify(o));
  // a small seeded generator (mulberry32) for tests and the headless harness
  function seeded(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
  // a stable number in [0,1) from a few integers: the year's runs and ADF&G's schedule come from it, so looking never changes your luck
  function hash(...k){let h=2166136261>>>0;for(const v of k){h^=Math.round(v*1000)>>>0;h=Math.imul(h,16777619)>>>0;h^=h>>>13;h=Math.imul(h,0x5bd1e995)>>>0;h^=h>>>15}return (h>>>0)/4294967296}
  const pick=(r,a)=>a[Math.floor(r()*a.length)%a.length];
  const gauss=(x,m,s)=>Math.exp(-((x-m)*(x-m))/(2*s*s));
  // month*100+day → day of the year (no leap years: close enough for run timing)
  const DOY0=[0,31,59,90,120,151,181,212,243,273,304,334];
  const doy=md=>DOY0[clamp(Math.floor(md/100),1,12)-1]+(md%100);
  const timeTxt=m=>{m=Math.round(m);const h=Math.floor(m/60)%24,mm=m%60,ap=h<12?'AM':'PM',h12=h%12||12;return `${h12}:${String(mm).padStart(2,'0')} ${ap}`};
  const plural=(n,w,ws)=>`${grp(n)} ${n===1?w:(ws||w+'s')}`;
  K.util={clamp,grp,$,esc,n0,copy,seeded,hash,pick,gauss,doy,timeTxt,plural};
})(Seine);
