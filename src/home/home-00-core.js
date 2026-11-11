// ============================================================
//  CABIN UPKEEP, part 0: the namespace.
//  Keeping up a cabin on the Kenai Peninsula (heat, pipes, snow, a generator, a well and septic, bears, a fish table, a garden,
//  detectors, spring breakup, earthquakes) lives behind ONE global, CabinUpkeep. It never reads or writes anything of the game
//  it sits in: everything it needs comes in through a ticket, and everything it produces goes out in a report that a thin
//  adapter applies. See src/home/README.md for the contract.
// ============================================================
const CabinUpkeep={
  VERSION:'1.0.0',
  SCHEMA:1,                 // version of the ticket, report and state shapes; bump when any of them change
  MAX_DUE:2,                // the most jobs offered at once (the guardrail: home never buries the game)
};
(function(C){
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
  C.util={clamp,grp,$,esc,n0,copy,seeded};
})(CabinUpkeep);
