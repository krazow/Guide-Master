// ============================================================
//  GUIDE MASTER: the shared "⚓ Commercial & crab" pieces (1.19.0).
//  Four modules work the water when you aren't guiding: gillnetting (42-gillnet.js), purse seining (43-seine.js), crabbing
//  (44-crab.js) and fish buying & processing (46-tender.js). This file holds what they share, in ONE place:
//    - the off-season sheet: FISH_HUB (each adapter pushes one section {id, order, ic, l, short, s(), open(back), on()}; a section
//      shows only once its own on() says so), fishHubList(), fishHubOn(), fishWinterBtns() (one line in winterModal, 24-career.js)
//      and fishHubModal(). Gillnetting, seining and crabbing open from the second off-season; the fish business from the third.
//    - the day: at most one commercial activity a day (fishClaim / fishTaken), and one way to settle a booked party when you go
//      fishing instead (fishTripsChoice: hand it to a guide, cancel it for FISH_CANCEL_REP reputation, or keep it). The Here tab
//      shows today's openers together under "⚓ Commercial today" (ACT_CATS.comm, 20-world.js); the Bookings tab shows each
//      module's section (FISH_BOOK) together, above the season's days, under one line about today.
//    - the delivery contract: gillnet, seine and crab reports carry delivery {species, lbs, area, day, value, share[, parts]}.
//      fishDeliver(delivery) sells it to your own tender or plant (46-tender.js: tenderRoute) when you have a buyer in that water,
//      at your own posted price, and returns the difference to you (null: an outside buyer took it, as before).
//  Nothing here draws a random number.
// ============================================================
var FISH_HUB=[];
function fishHubList(){return FISH_HUB.filter(x=>{try{return !x.on||x.on()}catch(e){return false}}).sort((a,b)=>a.order-b.order)}
function fishHubOn(){return !!(S&&S.winter&&fishHubList().length)}
function fishWinterBtns(){
  const H=fishHubList();if(!fishHubOn()||!H.length) return [];
  const t=H.map(x=>x.short).join(' · ');
  return [{l:'⚓ Commercial & crab',s:t.charAt(0).toUpperCase()+t.slice(1)+'. Optional, and risky.',fn:()=>fishHubModal()}];
}
function fishHubModal(){
  const back=()=>setTimeout(winterModal,0),again=()=>setTimeout(fishHubModal,0),H=fishHubList();
  if(!H.length) return back();
  if(H.length===1) return H[0].open(back);
  modal('⚓ Commercial & crab',`<p style="font-size:13px;color:var(--mute)">Work the water when you are not guiding. Cash ${$(Math.round(S.money))}. ${campDaysLeft()} free day${campDaysLeft()===1?'':'s'} left this winter.</p>`,
    H.map(x=>({l:`${x.ic} ${x.l}`,s:x.s(),fn:()=>x.open(again)})).concat([{l:'Back to the off-season',fn:back}]));
}

// ---- the day: one commercial activity at a time ----
const FISH_CANCEL_REP=5;          // reputation each party costs you when you cancel on them to go fishing (or to run your tender)
const FISH_WHAT={gillnet:'You’re fishing the gillnet opener today.',seine:'You’re on the seiner today.',tender:'You’re running your tender today.'};
function fishClaim(d,id){if(!S.fish||typeof S.fish!=='object')S.fish={};S.fish.today={d,id}}
// the commercial activity (other than id) that already has day d, or null
function fishTaken(d,id){
  const t=S&&S.fish&&S.fish.today;if(t&&t.d===d&&t.id!==id) return t.id;
  if(id!=='seine'&&typeof seineSigned==='function'&&seineSigned(d)) return 'seine';   // signed on for a seine period that day
  return null;
}
// every one of these parties to one of your guides (two parties at the same hour need two guides), or null
function fishHandPlan(trips){
  if(!trips.length||typeof canHand!=='function'||typeof staffLane!=='function'||typeof bizAssign!=='function') return null;
  const done=[];let ok=true;
  for(const b of trips){const g=canHand(b)?staffLane(b.d,b.type,null,b):null;if(g==null){ok=false;break}done.push([b,g,b.asst,b.g]);b.asst=true;b.g=g}
  done.forEach(([b,,a,g0])=>{b.asst=a;if(g0===undefined)delete b.g;else b.g=g0});
  return ok?done.map(([b,g])=>[b,g]):null;
}
const fishWho=trips=>trips.map(b=>'the '+b.who).join(' and ');
function fishHand(plan){plan.forEach(([b,g])=>bizAssign(b.id,g))}
function fishCancel(trips,why){
  trips.forEach(b=>{b.status='cancelled';S.stats.cancelled++;adj('rep',-FISH_CANCEL_REP)});
  if(trips.length) say(`📵 You call ${fishWho(trips)} to cancel: ${why}. You refund the deposit${trips.length>1?'s':''}.`);
}
// a booked party in the way: the one choice, the same for every module. o: {ic, d, what (‘fish the opener’), why (for the call),
// go() (do it), keep: {l, s, fn}}. No parties: go straight on.
function fishTripsChoice(o){
  const trips=todays(o.d).filter(b=>!(S.trip&&S.trip.id===b.id));
  if(!trips.length) return o.go();
  const hand=fishHandPlan(trips),names=hand?hand.map(([,g])=>staffName(g)).filter((x,i,a)=>a.indexOf(x)===i).join(' and '):'';
  const list=trips.map(b=>`${TRIPS[b.type].ic} the <b>${b.who}</b> (${b.n}), ${fmt(TRIPS[b.type].start)}, ${$(payOf(b))}`).join('<br>');
  modal(`${o.ic} You’re booked today`,`<p>You can’t guide and ${o.what} the same day:</p><p>${list}</p><p style="font-size:13px;color:var(--mute)">Cancelling refunds the deposit, and the party remembers it.</p>`,[
    ...(hand?[{l:`Hand ${trips.length>1?'them':`the ${trips[0].who}`} to ${names}, and go`,s:'Your guides take the parties. You’re paid less for those trips.',fn:()=>{fishHand(hand);o.go()}}]:[]),
    {l:`Cancel ${trips.length>1?`all ${trips.length} trips`:'the trip'}, and go`,s:`Reputation −${FISH_CANCEL_REP*trips.length}. They’ll find another guide.`,fn:()=>{fishCancel(trips,o.why);o.go()}},
    {l:o.keep.l,s:o.keep.s,fn:o.keep.fn||(()=>{})}]);
}

// ---- the Bookings tab: the modules' sections together, above the season's days ----
// FISH_BOOK: {id, order, view()} (each view returns its HTML or ''); FISH_TODAY: {id, order, today()} → a short line about today, or ''
var FISH_BOOK=[],FISH_TODAY=[];
function fishBookView(){
  const parts=FISH_BOOK.slice().sort((a,b)=>a.order-b.order).map(x=>{try{return x.view()||''}catch(e){return ''}}).filter(Boolean);
  if(!parts.length) return '';
  const d=day(),now=FISH_TODAY.slice().sort((a,b)=>a.order-b.order).map(x=>{try{return x.today()||''}catch(e){return ''}}).filter(Boolean);
  const taken=S.fish&&S.fish.today&&S.fish.today.d===d?FISH_WHAT[S.fish.today.id]:'';
  const top=now.length?`<div class="todo"><span class="ck" aria-hidden="true">⚓</span><div><b>Commercial today</b><span>${now.join(' · ')}${taken?`<br>${taken}`:now.length>1?'<br>One a day: whichever you start takes the day.':''}${todays(d).length?`<br><span style="color:var(--warn)">You have ${todays(d).length} trip${todays(d).length>1?'s':''} booked today.</span>`:''}</span></div></div>`:'';
  return top+parts.join('');
}
{const bt=EXTRA_TABS.find(t=>t.k==='book');if(bt){const v0=bt.view;bt.view=()=>{const h=v0();if(S.winter) return h;let x='';try{x=fishBookView()}catch(e){x=''}if(!x)return h;
  const i=h.indexOf('<div class="sect">Season ');return i<0?h+x:h.slice(0,i)+x+h.slice(i)}}}

// ---- your own catch to your own buyer (the delivery contract) ----
// dl: {species, lbs, area, day, value (what an outside buyer paid for it), share (the part of the fish ticket that reaches you),
// parts: [{species, lbs, value}] (a mixed catch)}. Returns null (an outside buyer took it) or {diff (dollars more, or less, to you), lines}.
function fishDeliver(dl){
  if(!dl||!(dl.lbs>0)||typeof tenderRoute!=='function'||typeof tenderBuyerIn!=='function'||!tenderBuyerIn(dl.area)) return null;
  const parts=Array.isArray(dl.parts)&&dl.parts.length?dl.parts:[{species:dl.species,lbs:dl.lbs,value:dl.value}],sh=Math.max(0,Math.min(1,+dl.share||0)),lines=[];
  let diff=0,value=0;
  parts.forEach(p=>{if(!(p.lbs>0))return;const r=tenderRoute({species:p.species,lbs:p.lbs,area:dl.area,day:dl.day});if(!r)return;value+=r.value;diff+=(r.value-(+p.value||0))*sh;lines.push(r.line)});
  if(!lines.length) return null;
  diff=Math.round(diff);
  lines.push(diff?`💵 At your own price instead of the outside buyer’s: <b>${diff<0?'−':'+'}${$(Math.abs(diff))}</b> to you${sh<1?' (your part of the ticket)':''}. Your business keeps its margin.`:'💵 Your own price matches the outside buyer’s. Your business keeps its margin.');
  return {diff,value,lines};
}
