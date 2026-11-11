// ============================================================
//  KENAI WINTER CAMP, part 0: the namespace.
//  The whole camping engine lives behind ONE global, KenaiCamp. It never reads or writes anything of the host game:
//  everything it needs comes in through the trip ticket and a small host adapter, and everything it produces goes
//  out in the trip report. See src/camp/README.md for the contract.
//  The only browser storage it touches uses keys that start with "kenaicamp:".
// ============================================================
const KenaiCamp={
  VERSION:'1.0.0',
  SCHEMA:1,                 // version of the ticket, report and stored-data shapes; bump when any of them change
  PREFIX:'kenaicamp:',      // every storage key this engine uses starts with this
};
(function(K){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const r2=x=>Math.round(x*100)/100;
  const grp=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  // money: $1,234 (cents only when there are some), with a real minus sign
  const $=x=>{const f=(Math.round(Math.abs(x)*100)/100).toFixed(x%1?2:0).split('.');f[0]=grp(+f[0]);return (x<0?'−':'')+'$'+f.join('.')};
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const sgn=n=>(n<0?'−':'+')+Math.abs(n);
  // a small seeded generator (mulberry32) for tests and the solo harness
  function seeded(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
  // storage that never throws and never leaves the kenaicamp: namespace
  const store={
    ok(){try{return typeof localStorage!=='undefined'&&!!localStorage}catch(e){return false}},
    get(k){try{return this.ok()?JSON.parse(localStorage.getItem(K.PREFIX+k)):null}catch(e){return null}},
    set(k,v){try{if(this.ok())localStorage.setItem(K.PREFIX+k,JSON.stringify(v))}catch(e){}},
    del(k){try{if(this.ok())localStorage.removeItem(K.PREFIX+k)}catch(e){}},
  };
  K.util={clamp,r2,grp,$,esc,sgn,seeded,store};
})(KenaiCamp);
