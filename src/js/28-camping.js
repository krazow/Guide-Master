// ============================================================
//  GUIDE MASTER, part 9: winter camping (the adapter).
//  The camping game itself lives in src/camp/ (the KenaiCamp engine, which knows nothing about this game). This file is the
//  thin bridge: it builds the engine's trip ticket from the save (S), gives it a host adapter made of our own pop-ups, and
//  applies the trip report back to S. In the off-season ("S.winter" pending) the player has WINTER_DAYS free days to spend on
//  up to three camping trips and some winter work. Nothing here moves the game clock (S.t, S.cur).
//
//  Save state: S.camp = {v:2, s (winter these counters belong to), days, trips, gigs, gigsDone, gear (owned gear ids), lic (the
//  calendar year of the last fishing license), boost {s,q,book} (next season's bonus), hint, ach, noTrace, tot {…}}.
//  S.stats.campNights / encounters / seen keep counting as before (the end screen and the old achievements read them).
// ============================================================
const CAMP_MAX_TACKLE=12;
const CAMP_FISH_PER_RED=3;   // stocked trout and char are small: about three of them make the meals of one red salmon in the freezer
function campBase(){return {v:2,s:-1,days:0,trips:0,gigs:0,gigsDone:[],gear:[],lic:0,boost:{s:-1,q:0,book:0},hint:null,ach:[],noTrace:0,tot:{trips:0,nights:0,fish:0,tackle:0,gigs:0,spent:0,net:0}}}
const campGas=()=>Math.round(Math.max(4.5,((S.fuelBase&&S.fuelBase.kenai)||6.19)-.85)*100)/100;   // Peninsula pump gas ≈ marine dock price − the marine premium
// this winter's counters (they restart when a new off-season begins)
function campW(){
  const C=S.camp&&S.camp.v===2?S.camp:(S.camp=campBase());
  if(S.winter&&C.s!==S.winter.s){C.s=S.winter.s;C.days=0;C.trips=0;C.gigs=0;C.gigsDone=[]}
  return C;
}
const campDaysLeft=()=>S.winter?Math.max(0,KenaiCamp.data.WINTER_DAYS-campW().days):0;
const campTripsLeft=()=>S.winter?Math.max(0,KenaiCamp.data.MAX_TRIPS-campW().trips):0;
// is there anything left to do this winter? (the pop-up can still be opened to see the log or buy a shelter)
const campUsed=()=>!S.winter||campDaysLeft()<=0||(campTripsLeft()<=0&&campW().gigs>=KenaiCamp.data.MAX_GIGS);
// effects on next season's trips and bookings (used by 22-trips.js and genSeasonBookings in 24-career.js)
function campQ(){
  const C=S.camp;if(!C||!C.boost||C.boost.s<0||C.boost.s!==seasonOf(day())) return 0;
  return S.stats.trips-((S.st0&&S.st0.trips)||0)<3?C.boost.q:0;
}
const campBook=s=>{const C=S.camp;return C&&C.boost&&C.boost.s===s?C.boost.book:0};

function campTicket(){
  const C=campW(),A=S.arcs&&S.arcs.rival,W=S.winter;
  return {
    mode:'guide',year:2025+W.s,cash:Math.round(S.money),energy:S.energy,rep:S.rep,skill:S.skill,
    gas:campGas(),mpg:15,costMult:DF().cost,
    gear:C.gear.slice(),licYear:C.lic,food:{meals:foodMeals(),freezerRoom:Math.max(0,fishCap()-S.freezer)*CAMP_FISH_PER_RED},
    regulars:S.regs.map(g=>({id:g.who,name:'the '+g.who,mood:g.last?g.last.h:60})),
    rival:A&&A.st>=2?{id:'rival',name:'Dale Voss',mood:A.mood||0}:null,guideFriend:true,
    daysLeft:campDaysLeft(),tripsLeft:campTripsLeft(),gigsLeft:Math.max(0,KenaiCamp.data.MAX_GIGS-C.gigs),gigsDone:C.gigsDone.slice(),
    seen:Object.assign({},S.stats.seen),ach:C.ach.slice(),noTraceTrips:C.noTrace,
  };
}
// the trip report goes back into the save
function campApply(rep){
  const C=campW(),st=S.stats,W=S.winter;
  money(rep.cashDelta);st.spent+=rep.spent;
  S.energy=clamp(S.energy+rep.energyDelta,Math.min(S.energy,40),100);
  if(rep.repDelta)adj('rep',rep.repDelta);
  S.skill+=rep.skillDelta;S.wom=(S.wom||0)+rep.womDelta;
  // Stocked trout and char are eaten fresh over the winter; they do not keep. They only spare the pantry you already stocked (a
  // careful kitchen), so a guide who never buys food gets nothing for it. (Before 1.11.0 they went into the freezer as reds' worth of meals.)
  rep.pantrySaved=0;
  if(rep.foodFish&&S.food.pan>=MEALS){rep.pantrySaved=Math.min(Math.round(rep.foodFish/CAMP_FISH_PER_RED)*FISH_MEALS,PANTRY_CAP-S.food.pan);S.food.pan+=rep.pantrySaved}
  if(rep.tackleCredit)S.gear=Math.min(Math.max(S.gear,CAMP_MAX_TACKLE),S.gear+rep.tackleCredit);
  if(rep.firstTripBoost||rep.bookingBoost){
    const B=C.boost.s===W.s?C.boost:(C.boost={s:W.s,q:0,book:0});
    B.q=Math.round(Math.min(KenaiCamp.data.MAX_FIRST,B.q+rep.firstTripBoost)*1000)/1000;B.book=Math.round(Math.min(KenaiCamp.data.MAX_BOOK,B.book+rep.bookingBoost)*1000)/1000;
  }
  if(rep.scout){const sh=(S.reg&&S.reg.shift)||0;
    C.hint={s:W.s,txt:rep.scout.areas.includes('kasilof')&&!rep.scout.areas.includes('upper')?'Kasilof anglers':'upper-river guides',
      run:sh>=2?`the late run should come about ${sh} days later than usual`:sh<=-2?`the late run should come about ${-sh} days earlier than usual`:'the late run should arrive about when it normally does'}}
  rep.relations.forEach(x=>{
    if(x.kind==='regular'){const g=S.regs.find(y=>y.who===x.id);if(g&&g.last){g.last.h=clamp(g.last.h+x.delta*5,0,100);if(x.delta>=2)g.miss=0}}
    else if(x.kind==='rival'&&S.arcs&&S.arcs.rival){const A=S.arcs.rival;if(x.delta>=2)A.mood=1;else if(x.delta<=-2)A.mood=-1}
  });
  st.seen=st.seen||{};Object.keys(rep.speciesSeen).forEach(id=>{st.seen[id]=(st.seen[id]||0)+rep.speciesSeen[id]});
  st.encounters=(st.encounters||0)+rep.encounters;st.campNights=(st.campNights||0)+rep.nights;
  rep.gearBought.forEach(g=>{if(!C.gear.includes(g))C.gear.push(g)});if(rep.license)C.lic=Math.max(C.lic,rep.license.year);
  rep.achievements.forEach(a=>{if(!C.ach.includes(a))C.ach.push(a)});C.noTrace+=rep.noTraceTrips;
  if(rep.trips&&rep.trips.length){const L=rep.trips[rep.trips.length-1],mo=KenaiCamp.data.month(L.month);if(mo)C.lastMon={s:W.s,name:mo.n,year:KenaiCamp.data.calYear(mo,2025+W.s)}}
  C.days+=rep.daysUsed;C.trips+=rep.tripsTaken;C.gigs+=rep.gigs.length;C.gigsDone=C.gigsDone.concat(rep.gigs);
  const T=C.tot;T.trips+=rep.tripsTaken;T.nights+=rep.nights;T.fish+=rep.foodFish;T.tackle+=rep.tackleCredit;T.gigs+=rep.gigs.length;T.spent+=rep.spent;T.net+=rep.cashDelta;
  return rep;
}
// what the wrap-up says about next season
function campWrapHtml(rep){
  const f=n=>n>0?'+'+n:String(n),L=[];
  L.push(`${rep.tripsTaken} camping trip${rep.tripsTaken===1?'':'s'}, ${rep.nights} night${rep.nights===1?'':'s'}${rep.gigs.length?`, ${rep.gigs.length} winter job${rep.gigs.length===1?'':'s'}`:''}.`);
  L.push(`Cash ${rep.cashDelta<0?'−':'+'}${$(Math.abs(Math.round(rep.cashDelta)))} · Energy ${f(rep.energyDelta)} · Rep ${f(rep.repDelta)}${rep.skillDelta?` · Skill ${f(rep.skillDelta)}`:''}.`);
  if(rep.foodFish)L.push(`🐟 ${rep.foodFish} stocked fish, eaten fresh at the cabin and over the camp stove. ${rep.pantrySaved>0?`They spared ${rep.pantrySaved} meals in your pantry.`:'They don’t keep, and with no pantry stocked there is nothing to spare.'}`);
  if(rep.tackleCredit)L.push(`🪶 Tackle +${rep.tackleCredit}: that many trips’ worth of flies and leaders you won’t have to buy.`);
  if(rep.firstTripBoost)L.push(`🎯 Better first trips in July (about ${Math.round(rep.firstTripBoost*100)}% more catch on your first three trips).`);
  if(rep.bookingBoost)L.push(`📅 A few more bookings next season.`);
  if(rep.scout)L.push(`🔭 Talking with ${campW().hint.txt}, you hear that ${campW().hint.run}.`);
  rep.relations.forEach(x=>L.push(`🤝 ${x.name.charAt(0).toUpperCase()+x.name.slice(1)}: ${x.delta>=2?'a good trip together':x.delta<0?'a rough night together':'a quiet trip'}.`));
  if(rep.newSpecies.length)L.push(`📖 ${rep.newSpecies.length} new animal${rep.newSpecies.length>1?'s':''} in your camping log.`);
  rep.achievements.forEach(a=>{const x=KenaiCamp.data.ACH.find(y=>y.id===a);if(x)L.push(`${x.ic} <b>${x.n}</b>: ${x.d}`)});
  return L.map(x=>`<p>${x}</p>`).join('');
}
function campWrap(rep){
  if(!rep.tripsTaken&&!rep.gigs.length&&!rep.gearBought.length&&!rep.license) return setTimeout(winterModal,0);
  sfx(rep.encounters?'good':'click');
  modal('🏕️ What camping did',campWrapHtml(rep),[{l:'Back to the off-season',fn:()=>setTimeout(winterModal,0)}]);
}
// the player's entry point (from the off-season summary)
function campModal(){
  if(!S.winter) return;
  if(cabin().rolled!==S.winter.s) return homeBeforeCamping(()=>campModal());   // the winter's first storm lands before the free days are spent
  campW();
  KenaiCamp.start({mode:'guide',ticket:campTicket(),host:{
    show:(title,html,btns,lock)=>modal(title,html,btns,lock),
    toast:msg=>showTile('🏕️',msg,'','info'),
    rand:()=>Math.random(),now:()=>Date.now(),
    onFinish:rep=>{campApply(rep);campWrap(rep)},
  }});
}
// bots and tests: play a whole winter's camping with the engine's headless policy and apply the report
function campBot(opts){
  if(!S.winter) return null;homeRollWinterSync();homeAnswerStorms();campW();
  const r=KenaiCamp.sim({ticket:campTicket(),rand:(opts&&opts.rand)||(()=>Math.random()),policy:(opts&&opts.policy)||'thoughtful',opts});
  campApply(r.report);return r.report;
}
const campHintLine=()=>{const C=S.camp;return C&&C.hint&&S.winter&&C.hint.s===S.winter.s?`🔭 ${C.hint.run.charAt(0).toUpperCase()+C.hint.run.slice(1)}.`:''};
// the end screen: one row
function campEndText(){
  const C=S.camp&&S.camp.v===2?S.camp:campBase(),s=S.stats,seen=Object.keys(s.seen||{}).filter(id=>KenaiCamp.data.ALL.includes(id)).length,T=C.tot;
  if(!s.campNights&&!T.trips&&!T.gigs&&!C.gear.length) return 'none';
  const net=Math.round(T.net);
  return `${s.campNights||0} night${(s.campNights||0)===1?'':'s'} over ${T.trips} trip${T.trips===1?'':'s'}, ${s.encounters||0} wildlife encounter${(s.encounters||0)===1?'':'s'}, ${seen} of ${KenaiCamp.data.ALL.length} animals logged<br><span style="color:var(--mute)">${T.fish} fish in the freezer, ${T.tackle} tackle credits, ${T.gigs} winter job${T.gigs===1?'':'s'}; trips and jobs ${net<0?'cost':'earned'} ${$(Math.abs(net))} net${C.ach.length?'; '+C.ach.map(a=>(KenaiCamp.data.ACH.find(x=>x.id===a)||{n:a}).n).join(', '):''}</span>`;
}
