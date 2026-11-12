// ============================================================
//  GUIDE MASTER, part 10: the cabin (the adapter).
//  Keeping up the cabin lives in src/home/ (the CabinUpkeep module, which knows nothing about this game). This file is the thin
//  bridge: it builds the module's ticket from the save (S), gives it a host made of our own pop-ups, and applies each report back
//  to S: cash, energy, rep, minutes in July, free days in the off-season (shared with winter camping), food and fuel.
//
//  Save state: S.cabin is the module's own state (it is opaque here); S.homeAsk is the last winter the player was reminded about
//  spring jobs; S.winOut is this winter's power outage (31-supplies.js), which the module reads.
//  The year of the cabin: the July of season s, and the winter before it, are one cycle s. Fall jobs come before the winter's storms
//  roll (they open the winter report, or the moment you leave for camping), spring jobs after, and spring happens as the bookings open.
// ============================================================
const HOME_DAY_VALUE=90;   // dollars a lost free winter day costs when none are left: the winter job that slipped
const cabin=()=>S.cabin=CabinUpkeep.normState(S.cabin);
const homeSeason=()=>S.winter?S.winter.s:seasonOf(day());
const homePhase=()=>S.winter?(cabin().rolled===S.winter.s?'spring':'fall'):'summer';
function homeRecentFish(){const d=day();return S.book.filter(b=>b.status==='done'&&b.d>d-4&&b.d<=d&&b.type!=='trout'&&b.out&&b.out.fish>0).length}
function homeTicket(o){
  const w=!!S.winter;
  return Object.assign({
    state:cabin(),phase:homePhase(),season:homeSeason(),sday:w?0:sday(day()),abs:day(),
    cash:Math.round(S.money),energy:S.energy,rep:S.rep,daysLeft:w?campDaysLeft():0,atHome:S.loc==='shop'&&!S.trip,
    costMult:DF().cost,bad:DF().bad,
    gen:{owned:!!genOf(),gas:S.home.stale>0?'stale':'ok'},homeFuel:fuelFresh(),outage:w?(S.winOut||null):null,recentFish:homeRecentFish(),
  },o||{});
}
// lost free days come out of the winter budget; with none left, the winter work that slipped costs money
function homeDays(used,lost){
  if(!S.winter||(used<=0&&lost<=0)) return;
  campW();const left=campDaysLeft(),want=used+lost,take=Math.min(left,want);
  S.camp.days+=take;
  const unmet=want-take;
  if(unmet>0){const c=-homeCharge(-Math.round(HOME_DAY_VALUE*unmet*DF().cost));money(-c);S.stats.spent+=c;say(`💸 No free days are left this winter, so ${unmet} day${unmet>1?'s':''} of lost winter work comes out of your pocket: ${$(c)}.`)}
}
// Home trouble never takes cash below this: the plumber and the neighbors let you carry the rest, so it can't end a career
const HOME_FLOOR=-1200;
function homeCharge(delta){
  if(delta>=0) return delta;
  const ok=Math.max(0,S.money-HOME_FLOOR),pay=Math.min(-delta,ok);
  return -pay;
}
// a party that cannot reach or stay at the cabin cancels: the soonest booked trips from d0 to d1, and the deposit goes back
function homeCancel(n,d0,d1){
  if(!(n>0)||!S.book) return;
  const bs=S.book.filter(b=>b.status==='booked'&&b.d>=d0&&b.d<=d1);
  for(let i=0;i<n&&i<bs.length;i++){
    const b=bs[i];b.status='cancelled';S.stats.cancelled++;
    say(`📵 The ${b.who} cancel their ${dlabel(b.d)} ${TRIPS[b.type].n}: they heard about the trouble at your place. You refund the deposit.`);
  }
}
// spring trouble waits for the bookings: when the season opens, the first days' parties cancel
function homeSeasonOpens(s){const n=S.homeCancel||0;S.homeCancel=0;homeCancel(n,seasonFirst(s),seasonFirst(s)+3)}
function homeApply(rep,quiet){
  if(!rep) return rep;
  S.cabin=rep.state;
  const c=homeCharge(rep.cashDelta||0),waived=c-(rep.cashDelta||0);
  if(c) money(c);
  S.stats.spent+=Math.max(0,(rep.spent||0)-waived);
  if(waived>0) say('🤝 You can’t cover all of it, so the plumber and the neighbors let you carry the rest. Nobody repossesses a cabin over it.');
  if(rep.energyDelta) adj('energy',rep.energyDelta);
  if(rep.repDelta) adj('rep',rep.repDelta);
  if(rep.womDelta) S.wom=(S.wom||0)+rep.womDelta;
  if(rep.homeFuel) takeHomeFuel(rep.homeFuel);
  if(rep.freshLost&&S.food.fri>0){S.food.fri=0}
  if(rep.foodMeals>0){if(S.food.fri<=0)S.food.fd=day();S.food.fri=Math.min(FRIDGE_CAP,S.food.fri+rep.foodMeals)}
  homeDays(rep.daysUsed,rep.daysLost);
  if(rep.cancels>0){if(S.winter)S.homeCancel=(S.homeCancel||0)+rep.cancels;else homeCancel(rep.cancels,day(),day()+2)}
  if(rep.minutes>0&&!S.winter) pass(rep.minutes);
  if(!quiet) rep.lines.forEach(l=>say(l));
  return rep;
}
const homeHost=()=>({show:(t,h,b,lock)=>modalSwap(t,h,b,lock),ticket:()=>homeTicket(),apply:r=>homeApply(r),rand:()=>Math.random()});
const homeBotHost=()=>({ticket:()=>homeTicket(),apply:r=>homeApply(r,true)});

// ---- generator: will it start in an outage? (called from outage() in 31-supplies.js) ----
function homeGenCheck(winter){
  const t=homeTicket({season:seasonOf(day())-(winter?1:0)}),o=CabinUpkeep.genOdds(t);
  if(!(o.p>0)||Math.random()>=o.p) return null;
  const rep=homeApply(CabinUpkeep.genFailed(t),true);
  return rep.lines[0];
}
// a generator you just bought is in shape
function homeNewGen(){homeApply(CabinUpkeep.noteGen(homeTicket()),true)}

// ---- July: a morning, the fish station ----
function homeMorning(){
  if(S.winter||S.over) return;
  const rep=CabinUpkeep.daily(homeTicket());
  homeApply(rep);
  if(rep.severity>0) showTile('🏠','Trouble at the cabin',rep.lines[0].replace(/<[^>]+>/g,'').slice(0,80),'bad');
  else if(rep.remind) showTile('🏠','Cabin job',rep.remind,'info');
}
// after a trip: the clients' fish (22-trips.js tripEnd): a fee, or a spoiled batch
function homeProcessing(b,fish,t){
  if(!cabin().proc||b.type==='trout'||fish<=0) return;
  const rep=CabinUpkeep.processing(homeTicket({fish,clients:b.n}));
  S.cabin=rep.state;
  if(rep.earned>0)(t.x=t.x||[]).push(['Fish processing fees',rep.earned]);
  if(rep.energyDelta) adj('energy',rep.energyDelta);
  if(rep.womDelta) S.wom=(S.wom||0)+rep.womDelta;
  if(rep.repDelta) adj('rep',rep.repDelta);
  rep.lines.forEach(l=>t.notes.push(l));
}

// ---- the off-season ----
// Fall jobs, then the winter's storms roll (once), then spring jobs; spring itself happens as bookings open.
function homeRollWinterSync(){
  if(!S.winter||cabin().rolled===S.winter.s) return null;
  return homeApply(CabinUpkeep.rollWinter(homeTicket()),true);
}
function homeRollWinter(then){
  const w=S.winter;if(!w||cabin().rolled===w.s){if(then)then();return}
  const rep=homeApply(CabinUpkeep.rollWinter(homeTicket()),true);
  rep.lines.forEach(l=>say(l));
  CabinUpkeep.ui.scenes(homeHost(),rep,()=>{render();if(then)then()});
}
// answer whatever storm prompts are left with the top button (a bot, or a game left mid-prompt)
function homeAnswerStorms(){CabinUpkeep.autoplay(homeBotHost(),{policy:(j)=>j.kind==='event'?CabinUpkeep.policies.first(j):null})}
// leaving the off-season (finishWinter in 24-career.js): spring happens
function homeFinishWinter(){
  if(!S.winter) return;
  homeRollWinterSync();homeAnswerStorms();
  const rep=homeApply(CabinUpkeep.rollSpring(homeTicket()),true);
  if(rep.lines.length){rep.lines.forEach(l=>say(l));CabinUpkeep.ui.report(homeHost(),'🏠 Spring at the cabin',rep)}
}
// the winter pop-up's own buttons
function homeWinterModal(){
  const t=homeTicket(),jobs=CabinUpkeep.jobs(t),more=CabinUpkeep.dueCount(t)-jobs.length,ph=t.phase;
  if(ph==='spring'){
    CabinUpkeep.ui.batch(homeHost(),{title:'🏠 Spring breakup at the cabin',intro:`Condition ${Math.round(cabin().cond)}/100. Cash ${$(t.cash)}. ${t.daysLeft} free day${t.daysLeft===1?'':'s'} left, shared with camping and winter work.`,
      extra:[{l:'🏪 Home upgrades',s:'A wood stove, a fish processing station, a bear-resistant bin.',fn:()=>setTimeout(()=>CabinUpkeep.ui.shop(homeHost(),homeWinterModal),0)},{l:'Back to the off-season',fn:()=>setTimeout(winterModal,0)}]});
    return;
  }
  modal(ph==='fall'?'🏠 Get the cabin ready for winter':'🏠 Spring breakup at the cabin',
    `<p style="font-size:13px;color:var(--mute)">Condition ${Math.round(cabin().cond)}/100. Cash ${$(t.cash)}. ${t.daysLeft} free day${t.daysLeft===1?'':'s'} left this winter, shared with camping and winter work. ${ph==='fall'?'The first cold snap and the first big snow come when you leave for camping or open bookings.':'Last winter’s storms are behind you; breakup comes next.'}</p>${jobs.length?'':'<p>Nothing is due right now.</p>'}${more>0?`<p style="font-size:12.5px;color:var(--mute)">${more} more job${more>1?'s':''} after these.</p>`:''}`,
    jobs.map(j=>({l:`${j.ic} ${j.title}`,s:`${j.why} ${j.risk}`,fn:()=>setTimeout(()=>CabinUpkeep.ui.open(homeHost(),j.id,()=>homeWinterModal()),0)}))
      .concat([{l:'🏪 Home upgrades',s:'A wood stove, a fish processing station, a bear-resistant bin.',fn:()=>setTimeout(()=>CabinUpkeep.ui.shop(homeHost(),homeWinterModal),0)},{l:'Back to the off-season',fn:()=>setTimeout(winterModal,0)}]));
}
const cabinWinterBlurb=()=>{const ph=homePhase();return ph==='fall'?'Fall jobs before the cold: heat, pipes, detectors. Storms come when you leave for camping or open bookings.':'Spring breakup: the driveway, the foundation, the well and septic.'};
const homeWinterLabel=()=>{const n=CabinUpkeep.dueCount(homeTicket());return n?`${n} job${n>1?'s':''} due`:'all set'};
// "Open bookings": the winter's storms first, then a nudge about spring jobs, then the season
function homeOpenGate(go){
  const w=S.winter;if(!w){go();return}
  if(cabin().rolled!==w.s){homeRollWinter(()=>setTimeout(winterModal,0));return}
  const n=CabinUpkeep.dueCount(homeTicket());
  if(n&&S.homeAsk!==w.s){S.homeAsk=w.s;
    CabinUpkeep.ui.batch(homeHost(),{title:'🏠 Spring jobs are due',intro:'Breakup is coming. Do them yourself, pay someone, or skip them and take your chances.',extra:[{l:'Open bookings',fn:go}]});return}
  go();
}
// camping starts: the first storm has to land before the free days are spent
function homeBeforeCamping(go){if(S.winter&&cabin().rolled!==S.winter.s)homeRollWinter(go);else go()}

// ---- bots and tests ----
function homeBot(policy,o){return CabinUpkeep.autoplay(homeBotHost(),{policy:policy||'careful',rand:o&&o.rand})}
function homeBotWinter(policy,o){homeBot(policy,o);homeRollWinterSync();return homeBot(policy,o)}
window.homeBot=homeBot;window.homeBotWinter=homeBotWinter;

// ---- the Home tab, the HUD and the tab dot ----
const homeDot=()=>{try{return !S.winter&&CabinUpkeep.dueCount(homeTicket())>0}catch(e){return false}};
function homeView(){return CabinUpkeep.ui.tab(homeTicket())}
EXTRA_TABS.splice(2,0,{k:'home',ic:'🏠',l:'Home',view:homeView});
document.addEventListener('click',e=>{
  const b=e.target&&e.target.closest?e.target.closest('[data-cab]'):null;
  if(!b||!S||S.over) return;
  if(b.dataset.cab==='job') CabinUpkeep.ui.open(homeHost(),b.dataset.id,()=>{afterAction();if(S&&!S.over)render()});
  else if(b.dataset.cab==='shop') CabinUpkeep.ui.shop(homeHost(),()=>render());
});
function homeTags(){
  const t=[];
  if(cabin().cond<40&&S.loc==='shop') t.push('<span class="tag bad">🏠 cabin run down</span>');
  return t;
}
function homeEndText(){
  const T=cabin().tot,n=T.diy+T.pay+T.skip;
  return `${T.diy} job${T.diy===1?'':'s'} done yourself, ${T.pay} paid, ${T.skip} skipped; ${T.events} mishap${T.events===1?'':'s'}<br><span style="color:var(--mute)">cabin condition ${Math.round(cabin().cond)}/100${T.fees?`, ${$(T.fees)} in fish processing fees`:''}${T.harvest?`, ${T.harvest} meals from the garden`:''}</span>`;
}
TIPS.push({id:'cabin',when:()=>day()>=2&&!S.winter&&CabinUpkeep.dueCount(homeTicket())>0,t:'🏠 The cabin needs a little upkeep now and then. Open the <b>Home</b> tab: each job can be done yourself, paid for, or skipped (at a risk). Never more than two at a time.'});
