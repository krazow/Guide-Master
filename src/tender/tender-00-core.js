// ============================================================
//  TENDER & PROCESSOR, part 0: the namespace.
//  A fish-buying business on Cook Inlet: charter or buy a tender that anchors near the fleet on openers and buys fish over the rail,
//  then lease line space, buy a small shore plant or an old floating processor. It lives behind ONE global, Tender, and never reads
//  or writes the game it sits in: everything it needs comes in through a ticket, everything it produces goes out in a report that a
//  thin adapter applies. See src/tender/README.md for the contract.
// ============================================================
const Tender={
  VERSION:'1.0.0',
  SCHEMA:1,                 // version of the ticket, report and state shapes; bump when any of them change
  FLOOR:-1500,              // the guardrail: business bills never take the player's cash below this (a forced sale covers the rest)
};
(function(T){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const grp=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  const $=x=>(x<0?'−':'')+'$'+grp(Math.abs(x));                 // whole dollars, a real minus sign
  const c2=x=>{const v=Math.round(x*100);return (v<0?'−':'')+(Math.abs(v)>=100?'$'+(Math.abs(v)/100).toFixed(2):Math.abs(v)+'¢')};   // a price a pound
  const lb=x=>grp(x)+' lb';
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const n0=(v,d)=>typeof v==='number'&&isFinite(v)?v:d;
  const copy=o=>JSON.parse(JSON.stringify(o));
  const gs=(x,c,s)=>Math.exp(-Math.pow((x-c)/s,2)/2);
  // a small seeded generator (mulberry32): markets are drawn from it, so looking at a forecast never changes your luck
  function seeded(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
  const hash=(...k)=>{let h=2166136261>>>0;for(const v of k){const s=String(v);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}h^=124;h=Math.imul(h,16777619)>>>0}return h>>>0};
  // calendar helpers (pure date math): md is month*100+day, dow 0 = Monday
  const DOY0=[0,31,59,90,120,151,181,212,243,273,304,334];
  const doyOf=md=>DOY0[Math.floor(md/100)-1]+md%100;
  const dowOf=(y,md)=>(new Date(Date.UTC(y,Math.floor(md/100)-1,md%100)).getUTCDay()+6)%7;
  const mdAdd=(y,md,k)=>{const d=new Date(Date.UTC(y,Math.floor(md/100)-1,md%100)+k*864e5);return (d.getUTCMonth()+1)*100+d.getUTCDate()};
  const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],DAY=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const mdTxt=md=>`${MON[Math.floor(md/100)-1]} ${md%100}`;
  // the share of a payment you can afford: amortized yearly payment on a loan
  const payment=(bal,rate,n)=>n<=0?bal:rate<=0?bal/n:bal*rate/(1-Math.pow(1+rate,-n));
  T.util={clamp,grp,$,c2,lb,esc,n0,copy,gs,seeded,hash,doyOf,dowOf,mdAdd,mdTxt,DAY,payment};
})(Tender);
