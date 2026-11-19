// ============================================================
//  GUIDE MASTER: fish buying & processing (the adapter).
//  The business itself lives in src/tender/ (the Tender module, which knows nothing about this game). This file is the thin bridge:
//  it builds the module's ticket from the save (S), gives it a host made of our own pop-ups, and applies each report back to S.
//
//  Save state: S.fish.tender is the module's own state (opaque here; created on first use, so old saves load as they are).
//  The year: the off-season planner (from TENDER_UNLOCK seasons played) charters or buys tenders and a plant; when bookings open the
//  season opens (upkeep and crew are paid, the market and the opener calendar are set); on a played opener day your skipper runs the
//  tender unless you take her out yourself (a day choice on the Here tab); the next off-season settles the openers you didn't play,
//  the plant's season, the fall charter, depreciation and the loan payment.
//  Guardrail: the module never takes cash below Tender.FLOOR (a forced sale and a write-off cover the rest), so it can't end a career.
//  Nothing here draws a random number or changes a thing until you charter or buy something: a game without the business plays as before.
//
//  Hooks (wrapped, not edited): startSeason (the fall settlement), finishWinter (the season opens), onMorning (the opener notice, the
//  plant's call), onNight (the skipper's opener), actionsHere (run the tender yourself), bizWinterBtns (the planner button),
//  scoreParts and endRows (assets, the loan, the rest of the summer), the Bookings tab (the business at a glance).
//  For the other commercial modules (gillnet, seine, crab): tenderRoute({species, lbs, area, day}) sells your own catch to your own
//  buyer when you have one in that water (it returns null otherwise, and the delivery goes to an outside buyer as before).
// ============================================================
const TENDER_UNLOCK=Tender.data.K.UNLOCK;                // seasons played before the business opens: the off-season after commercial fishing does
const TENDER_SELF_BY=480;                                // run the tender yourself only if you start by 8:00 AM (the openers run 7 AM to 7 PM)
const TENDER_CANCEL_REP=5;                               // reputation a party costs you when you cancel on them for an opener
function tenderSeed(){return Tender.util.hash(S.name||'',S.nextId||0,S.years||0,(S.seasons||[]).length)}
function TND(){S.fish=S.fish||{};if(!S.fish.tender||typeof S.fish.tender!=='object')S.fish.tender=Tender.newState(tenderSeed());else Tender.normState(S.fish.tender);return S.fish.tender}
const tenderHas=()=>!!(S&&S.fish&&S.fish.tender&&(Tender.active(S.fish.tender)||S.fish.tender.loan||S.fish.tender.season));
const tenderOn=()=>!!(S&&S.seasons&&S.seasons.length>=TENDER_UNLOCK)||tenderHas();
function tenderTicket(o){
  const w=!!S.winter,d=day(),s=w?S.winter.s:seasonOf(d),R=REG();
  return Object.assign({state:TND(),phase:w?'winter':'summer',s,year:2026+s,cash:Math.round(S.money),floor:Tender.FLOOR,rep:S.rep,energy:S.energy,costMult:DF().cost,
    diesel:Math.max(3,Math.round(((S.fuelBase&&S.fuelBase.kenai)||6.19)*.85*100)/100),daysLeft:w?campDaysLeft():0,seasonsLeft:S.years-s,md:w?0:mdOf(d),
    run:{sockeye:R.mult.sockeye,coho:R.mult.coho,pinkEven:(2026+s)%2===0,king:R.king},wind:w?null:wxOf(d).wind},o||{});
}
function tenderApply(rep,quiet){
  if(!rep) return rep;
  S.fish.tender=rep.state;
  const c=Math.round(rep.cashDelta||0);
  if(c) money(c);
  S.stats.tenderNet=(S.stats.tenderNet||0)+c;
  if(rep.energyDelta) adj('energy',rep.energyDelta);
  if(rep.repDelta) adj('rep',rep.repDelta);
  if(rep.daysUsed>0) homeDays(rep.daysUsed,0);         // 32-home.js: free winter days, shared with camping and the cabin
  if(rep.forced) S.stats.tenderForced=(S.stats.tenderForced||0)+1;
  if(!quiet) rep.lines.forEach(l=>say(l));
  return rep;
}
// ---- illustrations (40-art.js): the module reports events [{id, sev}] (Tender.EVENTS); the worst one with a picture wins ----
function tenderArt(evs){if(typeof artOn!=='function'||!artOn()||!evs||!evs.length)return '';return artFirst(evs.slice().sort((a,b)=>(b.sev||0)-(a.sev||0)).map(e=>()=>artSlot('event',()=>artEventCtx(e.id,'tender'),{deco:true})))}
const tenderHost=()=>({show:(t,h,b,lock,meta)=>modalSwap(t,tenderArt(meta&&meta.events)+h,b,lock),ticket:()=>tenderTicket(),apply:r=>tenderApply(r),rand:()=>Math.random()});
const tenderBotHost=()=>({ticket:()=>tenderTicket(),apply:r=>tenderApply(r,true)});

// ---- the off-season ----
const _tenderBizBtns=bizWinterBtns;
bizWinterBtns=function(){
  const out=_tenderBizBtns();
  if(!tenderOn()||!S.winter) return out;
  const st=TND(),has=Tender.active(st);
  return out.concat([{l:'⚓ Fish buying & processing',s:has?`${st.tenders.length} tender${st.tenders.length===1?'':'s'}${st.plant?', your '+st.plant.name:''}${st.loan?`, ${$(st.loan.bal)} owed`:''}.`:'Optional: charter a tender and buy fish from the commercial fleet, then a plant. Big money both ways.',fn:()=>Tender.ui.planner(tenderHost(),()=>setTimeout(winterModal,0))}]);
};
// the fall: what you didn't play, the plant's season, the winter's bills (into the off-season summary, no pop-up of its own)
const _tenderStart=startSeason;
startSeason=function(s){
  const prev=S.reg;
  _tenderStart(s);
  const lines=[];
  if(S.fish&&S.fish.tender&&(S.fish.tender.season||Tender.active(S.fish.tender)||S.fish.tender.loan)){
    const R=prev||REG(),t=tenderTicket({run:{sockeye:R.mult.sockeye,coho:R.mult.coho,pinkEven:(2025+s)%2===0,king:R.king}});
    const rep=tenderApply(Tender.closeSeason(t),true);lines.push(...rep.lines);S.fish.tender.events=rep.events;
  }
  if(S.seasons.length===TENDER_UNLOCK&&!(S.fish&&S.fish.tender&&S.fish.tender.told)){TND().told=true;
    lines.push('⚓ <b>New: fish buying & processing.</b> The commercial fleet needs buyers. Charter a tender, then maybe a plant, from <b>⚓ Fish buying & processing</b> below. Optional, and risky.')}
  if(lines.length&&S.winter){S.winter.sup=(S.winter.sup||[]).concat(lines);lines.forEach(l=>say(l))}
};
// spring: the season opens with the bookings
const _tenderFinish=finishWinter;
finishWinter=function(){
  if(S.winter&&tenderHas()){const rep=tenderApply(Tender.openSeason(tenderTicket()),true);rep.lines.forEach(l=>say(l))}
  _tenderFinish();
  tenderNotice();   // the season's first morning can be an opener
};

// ---- the summer ----
const tenderToday=()=>{if(!S||S.winter||!S.fish||!S.fish.tender||!S.fish.tender.season)return null;try{return Tender.openerToday(tenderTicket())}catch(e){return null}};
const _tenderMorning=onMorning;
onMorning=function(d){
  _tenderMorning(d);
  if(S.winter||!S.fish||!S.fish.tender||!S.fish.tender.season) return;
  const st=S.fish.tender;
  if(st.plant){const rep=tenderApply(Tender.plantDay(tenderTicket()),true);if(rep.energyDelta)say(`🏭 A call with the plant manager before coffee: energy ${rep.energyDelta}.`)}
  tenderNotice();
};
function tenderNotice(){
  const op=tenderToday();if(!op) return;
  const A=Tender.data.AREAS,l=`⚓ <b>Opener today</b>, ${op.tenders.map(x=>A[x.area].short).join(' and ')}: your skipper takes the ${op.tenders.map(x=>x.name).join(' and the ')} out unless you run ${op.tenders.length>1?'one':'her'} yourself (Here tab, by ${fmt(TENDER_SELF_BY)}).`;
  say(l);digestLine(l);
}
const _tenderNight=onNight;
onNight=function(where,notes,d){
  _tenderNight(where,notes,d);
  if(!S.fish||!S.fish.tender||!S.fish.tender.season) return;
  if(tenderToday()){const rep=tenderApply(Tender.opener(tenderTicket(),{self:false}),true);rep.lines.forEach(l=>notes.push(l))}
};
// run the tender yourself: a day choice. Your own parties today come first: cancel them, hand them to a guide, or leave the opener to the skipper.
function tenderConflicts(){return todays(day()).filter(b=>!(S.trip&&S.trip.id===b.id))}
function tenderSelf(){
  const bs=tenderConflicts();
  if(bs.length){const b=bs[0],T=TRIPS[b.type],g=typeof canHand==='function'&&canHand(b)&&typeof staffLane==='function'?staffLane(b.d,b.type,null,b):null;
    modal('⚓ You’re booked today',`<p>The ${b.who} (${b.n}) have a ${T.ic} ${T.n.toLowerCase()} with you at ${fmt(T.start)}. Running the tender takes the whole day.</p>`,[
      ...(g!=null?[{l:`Hand them to ${staffName(g)}`,s:'Your guide takes the party; you take the tender.',fn:()=>{bizAssign(b.id,g);tenderSelf()}}]:[]),
      {l:`Cancel on the ${b.who}`,s:`Refund the deposit; reputation −${TENDER_CANCEL_REP}.`,fn:()=>{b.status='cancelled';S.stats.cancelled++;adj('rep',-TENDER_CANCEL_REP);say(`📵 You call the ${b.who} to cancel their ${T.n.toLowerCase()}: the fleet is fishing and your tender needs you. You refund the deposit.`);tenderSelf()}},
      {l:'Let the skipper run the opener',s:'Keep your party.',fn:()=>{}}]);
    return}
  Tender.ui.opener(tenderHost(),rep=>{
    if(!rep) return;
    const end=day()*1440+20*60+30;if(S.t<end)S.t=end;S.loc='shop';   // home by 8:30 PM, after the run to the plant
    sfx(rep.cashDelta>=0?'good':'bad');afterAction();
  });
}
window.tenderSelf=tenderSelf;
const _tenderActions=actionsHere;
actionsHere=function(){
  const a=_tenderActions();
  if(S.winter||S.trip||S.loc!=='shop') return a;
  const op=tenderToday();if(!op) return a;
  const late=tod()>TENDER_SELF_BY,bs=tenderConflicts();
  a.push({ic:'⚓',l:`Run your tender on today’s opener`,s:late?`The boats set at 7 AM: too late to run her yourself today. Your skipper has her.`:`The whole day: you post the price, pick the fish and make the run to the plant. Saves the skipper’s wage; energy −${Tender.data.K.SELF_ENERGY}.${bs.length?` You have ${bs.length} part${bs.length>1?'ies':'y'} booked today.`:''}`,cat:'work',dis:late,fn:()=>tenderSelf()});
  return a;
};

// ---- your own catch from the other commercial modules ----
// tenderRoute({species, lbs, area, day}): null when you have no buyer in that water; otherwise your buyer takes it at your posted price:
// {price, value, line}. The caller pays the player value (the business pays it and keeps the margin in its season's books).
function tenderRoute(dl){
  if(!dl||!S||!S.fish||!S.fish.tender) return null;
  const t=tenderTicket();if(!Tender.buyerIn(t,dl.area)) return null;
  const rep=Tender.route(t,dl);if(!rep.routed) return null;
  S.fish.tender=rep.state;
  return {price:rep.price,value:rep.value,area:rep.area,species:rep.species,line:rep.lines[0]};
}
window.tenderRoute=tenderRoute;
window.tenderBuyerIn=area=>!!(S&&S.fish&&S.fish.tender&&Tender.buyerIn(tenderTicket(),area));

// ---- score and the end screen ----
const _tenderParts=scoreParts;
scoreParts=function(){
  const P=_tenderParts();
  if(!tenderHas()) return P;
  const st=S.fish.tender,v=Tender.value(st),debt=Tender.debt(st),K=Tender.data.K;
  let est=0;if(st.season&&!S.winter){try{est=Tender.estimate(tenderTicket())}catch(e){est=0}}
  if(v) P.push(['Tenders & plant',Math.round(v*K.SCORE),`${Math.round(K.SCORE*10)} tenths of what they’re worth now`]);
  if(est) P.push(['Fish business, rest of summer',est,'estimated: the openers and the plant settle in the fall']);
  if(debt) P.push(['Bank loan',-debt,'what you still owe']);
  return P;
};
const _tenderEnd=endRows;
endRows=function(){
  const rows=_tenderEnd(),st=S.fish&&S.fish.tender;
  if(st&&(st.tot.seasons||Tender.active(st))) rows.push(['Fish business',`${st.tot.seasons} season${st.tot.seasons===1?'':'s'}, ${grp(Math.round(st.tot.lbs))} lb bought over the rail, ${$(Math.round(st.tot.net))} net${st.tot.forced?', sold off once at the dock auction':''}${st.loan?`; ${$(st.loan.bal)} still owed`:''}`]);
  return rows;
};
// ---- the Bookings tab: the business at a glance, during the season ----
{const bt=EXTRA_TABS.find(t=>t.k==='book');if(bt){const v0=bt.view;bt.view=()=>{
  const h=v0();if(S.winter||!S.fish||!S.fish.tender||!S.fish.tender.season) return h;
  try{return h+Tender.ui.tab(tenderTicket())}catch(e){return h}}}}
// ---- bots and tests ----
function tenderBot(policy){return Tender.autoplay(tenderBotHost(),{policy:policy||'processor'})}
window.tenderBot=tenderBot;window.TND=TND;window.tenderTicket=tenderTicket;window.tenderApply=tenderApply;
TIPS.push({id:'tender',when:()=>!!S.winter&&tenderOn()&&!tenderHas(),t:'⚓ The commercial fleet needs buyers. In <b>⚓ Fish buying & processing</b> you can charter a tender for a season and buy fish over the rail. Optional, and it can lose money.'});
