// ============================================================
//  CRAB, part 0: the namespace.
//  Crabbing for a guide on the Kenai Peninsula: a personal-use / subsistence pot in Kachemak Bay on a free afternoon in a Homer
//  week, a Tanner pot in the bay on a winter day when the fishery opens, and a winter deckhand job on a Bering Sea crab boat.
//  It lives behind ONE global, Crab. It never reads or writes anything of the game it sits in: everything it needs comes in
//  through a ticket (with its own state, which the host stores and hands back), and everything it produces goes out in a report
//  that a thin adapter applies. See src/crab/README.md for the contract.
// ============================================================
const Crab={
  VERSION:'1.0.0',
  SCHEMA:1,                 // version of the ticket, report and state shapes; bump when any of them change
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
  const pick=(a,r)=>a[Math.floor(r()*a.length)%a.length];
  const plural=(n,w,ws)=>`${n} ${n===1?w:(ws||w+'s')}`;
  C.util={clamp,grp,$,esc,n0,copy,seeded,pick,plural};
})(Crab);
