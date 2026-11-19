// ============================================================
//  GUIDE MASTER: crabbing (the adapter).
//  Crabbing lives in src/crab/ (the Crab module, which knows nothing about this game). This file is the thin bridge: it builds the
//  module's ticket from the save (S), gives it a host made of our own pop-ups, and applies each report back to S: cash, energy, rep,
//  word of mouth, minutes in the summer, free days in the off-season (shared with camping, the cabin and winter work), crab meat
//  in the freezer, and a sore start to the season after an injury out west.
//
//  Unlock: the "⚓ Commercial & crab" sheet in the off-season planner, from the second off-season (CRAB_UNLOCK seasons played).
//  Buy a pot there and a free afternoon in Homer gets a "set a crab pot" action; Tanner days and the deckhand job are on the sheet.
//  Nothing here draws a random number or changes anything until the player opens that sheet, so a game that never crabs plays as before.
//
//  Save state: S.fish.crab is the module's own state (opaque here, Crab.normState fills in an older one); S.fish.crab.host holds
//  this file's own bits: {sore: {s, n}} (mornings of season s that start sore). Old saves have no S.fish: it is made on first use.
//  The "Commercial & crab" sheet, the one-a-day rule and the delivery contract are shared: src/js/41b-fishhub.js.
// ============================================================
const CRAB_UNLOCK=2;          // seasons played before the sheet shows (the second off-season)
const CRAB_SORE=8;            // energy a sore morning costs after an injury on a crab boat
const crabOn=()=>!!(S&&S.fish&&S.fish.crab);
function crabS(){S.fish=S.fish&&typeof S.fish==='object'?S.fish:{};const c=S.fish.crab=Crab.normState(S.fish.crab);if(!c.host||typeof c.host!=='object')c.host={sore:null};return c}
const crabUnlocked=()=>!!(S&&S.seasons&&S.seasons.length>=CRAB_UNLOCK);
// minutes before you must leave Homer for your next booked trip today (a free afternoon is one with room for the run across the bay)
function crabFreeMin(){
  const d=day(),m=tod();let free=1e4;
  todays(d).forEach(b=>{const T=TRIPS[b.type],leave=T.start-60-travelMins('homer',T.loc)-m;if(T.start+T.len>m&&leave>-1)free=Math.min(free,leave)});
  return free;
}
function crabTicket(o){
  const w=!!S.winter;
  return Object.assign({
    state:crabS(),phase:w?'winter':'summer',year:w?2025+S.winter.s:2026+seasonOf(day()),season:w?S.winter.s:seasonOf(day()),day:day(),tod:w?720:tod(),
    freeMin:w?1e4:crabFreeMin(),atHomer:!w&&S.loc==='homer'&&!S.trip,cash:Math.round(S.money),energy:S.energy,rep:S.rep,skill:S.skill,
    costMult:DF().cost,ownBoat:!!(S.up&&S.up.chp),daysLeft:w?campDaysLeft():0,freezerRoom:Math.max(0,fishCap()-S.freezer)*FISH_MEALS,
  },o||{});
}
// this year's openings (a few random numbers): only once the player is crabbing
function crabPrep(){const c=crabS(),h=c.host;S.fish.crab=Crab.prep(crabTicket());S.fish.crab.host=h;return S.fish.crab}
function crabApply(rep,quiet){
  if(!rep) return rep;
  const h=crabS().host;S.fish.crab=rep.state;S.fish.crab.host=h;
  if(rep.cashDelta) money(rep.cashDelta);
  S.stats.spent+=rep.spent||0;
  if(rep.energyDelta){if(S.winter)S.energy=clamp(S.energy+rep.energyDelta,Math.min(S.energy,40),100);else adj('energy',rep.energyDelta)}
  if(rep.repDelta) adj('rep',rep.repDelta);
  if(rep.womDelta) S.wom=(S.wom||0)+rep.womDelta;
  if(rep.skillDelta) S.skill+=rep.skillDelta;
  if(rep.meals>0){const fish=Math.floor(rep.meals/FISH_MEALS),rest=rep.meals-fish*FISH_MEALS;if(fish)addFish(fish);if(rest)S.food.pan=Math.min(PANTRY_CAP,S.food.pan+rest)}
  if(rep.daysUsed>0&&S.winter){campW();S.camp.days=Math.min(KenaiCamp.data.WINTER_DAYS,S.camp.days+rep.daysUsed)}
  if(rep.sore>0&&S.winter) h.sore={s:S.winter.s,n:rep.sore};
  if(rep.minutes>0&&!S.winter) pass(rep.minutes);
  // the boat's crab to your own floating processor out west, at your own price (41b-fishhub.js, 46-tender.js)
  const rt=rep.delivery?fishDeliver(rep.delivery):null;
  if(rt){money(rt.diff);rep.cashDelta=(rep.cashDelta||0)+rt.diff;rep.routed=rt;rep.lines=rep.lines.concat(rt.lines)}
  if(!quiet) rep.lines.forEach(l=>say(l));
  return rep;
}
// illustrations (40-art.js): the module reports what happened as events [{id, sev}] (Crab.data.EVENTS); the worst one with a picture wins
function crabArt(evs){if(!artOn()||!evs||!evs.length)return '';return artFirst(evs.map((e,i)=>({e,i})).sort((a,b)=>(b.e.sev||0)-(a.e.sev||0)||b.i-a.i).map(x=>()=>artSlot('event',()=>artEventCtx(x.e.id,'crab'),{deco:true})))}
const crabHost=()=>({show:(t,h,b,lock,meta)=>modal(t,crabArt(meta&&meta.events)+h,b,lock),ticket:()=>crabTicket(),apply:r=>crabApply(r),rand:()=>Math.random()});

// ---- summer: the Homer actions ----
const _crabActionsHere=actionsHere;
actionsHere=function(){
  const a=_crabActionsHere();
  if(!crabOn()||S.winter||S.trip||S.loc!=='homer') return a;
  const c=crabS();if(!c.gear&&!c.pot&&!c.hold) return a;
  if(!c.open||c.open['d'+(2026+seasonOf(day()))]==null) crabPrep();
  Crab.potOptions(crabTicket()).forEach(o=>a.push({ic:o.ic,l:o.l,s:o.s,cat:'fish',dis:o.dis,fn:()=>Crab.ui.pot(crabHost(),o.id,()=>{afterAction()})}));
  return a;
};
// the morning: a pot soaking in the bay; a sore start after an injury out west
const _crabOnMorning=onMorning;
onMorning=function(d){
  _crabOnMorning(d);
  if(!crabOn()||S.winter||S.over) return;
  const c=crabS(),h=c.host;
  if(h.sore&&h.sore.s===seasonOf(d)&&h.sore.n>0){h.sore.n--;adj('energy',-CRAB_SORE);const l=`🩹 Your ribs and hands still remember the crab boat: a stiff, sore morning (energy −${CRAB_SORE}).`;say(l);digestLine(l)}
  if(c.pot&&d-c.pot.d>=2){const l=`🦀 Your crab pot has soaked ${d-c.pot.d} days in Kachemak Bay. Pull it on a free afternoon in Homer; a long soak loses bait, and sometimes the pot.`;say(l);digestLine(l)}
};
// the season ends: a pot left in the water, crab left in the cooler
const _crabStartSeason=startSeason;
startSeason=function(s){
  if(crabOn()){const c=crabS();
    if(c.pot){c.pot=null;say('🦀 You never pulled your crab pot. A Homer buddy hauls it for you at the end of the summer and drops it on your porch, crab gone. Never leave a pot soaking.')}
    if(c.hold){const n=c.hold.n;crabApply(Crab.useCrab(crabTicket({phase:'summer'}),'freezer'),true);say(`🦀 The ${n} crab in your cooler go into the freezer.`)}}
  _crabStartSeason(s);
};

// ---- the off-season: a section of the shared "⚓ Commercial & crab" sheet (41b-fishhub.js), from the second off-season ----
FISH_HUB.push({id:'crab',order:3,ic:'🦀',l:'Crabbing',short:'crab pots and a crab boat',on:()=>crabUnlocked(),
  s:()=>`${crabS().gear?'Your pot, for Homer afternoons':'A pot for Homer afternoons'} and winter Tanner days; a deckhand job on a Bering Sea crab boat (${Crab.data.JOB.days} free days).`,
  open:back=>{if(cabin().rolled!==S.winter.s)return homeBeforeCamping(()=>FISH_HUB.find(x=>x.id==='crab').open(back));   // the winter's first storm lands before free days are spent
    crabPrep();Crab.ui.winter(crabHost(),()=>setTimeout(back,0))}});

// ---- bots and tests ----
// the winter: buy a pot, a Tanner day when the bay is open, the deckhand job when the days and cash allow (policy: Crab.policies)
function crabBotWinter(o){
  o=o||{};if(!S.winter||!crabUnlocked()) return null;
  const rand=o.rand||(()=>Math.random()),out=[];homeRollWinterSync();homeAnswerStorms();crabPrep();
  const run=(r,q)=>{crabApply(r,true);out.push(r);return r};
  if(!crabS().gear&&S.money>(o.kitCash||3000)) run(Crab.buyKit(crabTicket()));
  if(o.job!==false&&campDaysLeft()>=Crab.data.JOB.days&&S.money>(o.jobCash||1500)&&(!o.jobIf||o.jobIf())) run(Crab.autoJob(crabTicket(),{rand,policy:o.policy||'careful'}).report);
  const op=Crab.winterOptions(crabTicket()).find(x=>x.id==='tanner');
  if(o.tanner!==false&&op&&!op.dis&&campDaysLeft()>=(o.keepDays||0)+1){run(Crab.tannerDay(crabTicket(),{rand}));if(crabS().hold)run(Crab.useCrab(crabTicket(),o.use||'freezer'))}
  return out;
}
// the summer, at Homer: pull a soaking pot, set one, empty the cooler
function crabBotSummer(o){
  o=o||{};if(!crabOn()||S.winter||S.loc!=='homer'||S.trip) return [];
  const c=crabS();if(!c.gear&&!c.pot&&!c.hold) return [];
  if(c.open['d'+(2026+seasonOf(day()))]==null) crabPrep();
  return Crab.autoSummer(crabTicket(),{rand:o.rand,use:o.use,next:r=>{crabApply(r,true);return crabTicket()}});
}
window.crabBotWinter=crabBotWinter;window.crabBotSummer=crabBotSummer;

// ---- the end screen: one row ----
const _crabEndRows=endRows;
endRows=function(){
  const rows=_crabEndRows();if(!crabOn()) return rows;const T=crabS().tot;
  if(T.sets||T.tanner||T.jobs||T.hireFail) rows.push(['Crabbing',`${T.crab} crab kept from ${T.pulls+T.tanner} pull${T.pulls+T.tanner===1?'':'s'}${T.feeds?`, ${T.feeds} crab feed${T.feeds>1?'s':''}`:''}${T.jobs?`; ${T.jobs} trip${T.jobs>1?'s':''} on a crab boat out west, ${T.jobNet<0?'−':''}${$(Math.abs(T.jobNet))} net${T.injuries?`, hurt ${T.injuries}×`:''}${T.unpaid?`, short-paid ${T.unpaid}×`:''}`:''}`]);
  return rows;
};
