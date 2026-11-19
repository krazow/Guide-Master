// ============================================================
//  GILLNET, part 0: the namespace.
//  Upper Cook Inlet commercial gillnetting (an east-side setnet site on the beach, or a drift boat out of Kenai) behind ONE
//  global, Gillnet. It never reads or writes anything of the host game: everything it needs comes in through a ticket and a
//  small host adapter, and everything it produces goes out in a report. See src/gillnet/README.md for the contract.
//  It touches no browser storage.
// ============================================================
const Gillnet={
  VERSION:'1.0.0',
  SCHEMA:1,                 // version of the ticket, report and schedule shapes; bump when any of them change
};
(function(G){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const r2=x=>Math.round(x*100)/100;
  const grp=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  // money: $1,234 (cents only when there are some), with a real minus sign
  const $=x=>{const f=(Math.round(Math.abs(x)*100)/100).toFixed(Math.round(x*100)%100?2:0).split('.');f[0]=grp(+f[0]);return (x<0?'−':'')+'$'+f.join('.')};
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  // minutes after midnight → 7:00 AM
  const hm=m=>{m=((Math.round(m)%1440)+1440)%1440;const h=Math.floor(m/60),mm=m%60;return `${h%12||12}:${String(mm).padStart(2,'0')} ${h<12?'AM':'PM'}`};
  // a small seeded generator (mulberry32) for tests and the headless sim
  function seeded(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
  const pick=(rand,a)=>a[Math.floor(rand()*a.length)%a.length];
  G.util={clamp,r2,grp,$,esc,hm,seeded,pick};
})(Gillnet);
