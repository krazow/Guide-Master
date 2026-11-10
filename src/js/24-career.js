// ============================================================
//  GUIDE MASTER, part 5: the career.
//  A career is 2, 5 or 10 seasons. Each season you play the two-week July peak
//  (Monday to Sunday, starting on the Monday nearest July 13); the rest of the year is the off-season:
//  a recap, license and permit renewals, next year's forecast and rule changes, upgrades and new bookings.
//
//  Day indexes stay continuous across seasons (S.cur 0..14×years−1), so the engine needs no changes
//  beyond GAME.days (a getter in 00-game.js) and the HUD hook hudDay().
// ============================================================
const SEASON=14;
const CAREERS={2:{n:'2-year career',ic:'🎣',d:'Two Julys on the Kenai. A taste of the guiding life.'},
  5:{n:'5-year career',ic:'🛶',d:'Build a business: upgrade boats, raise your rates, ride out good runs and bad.'},
  10:{n:'10-year career',ic:'🏔️',d:'A decade on the river. King closures come and go, permits expire, the river changes.'}};
const seasonOf=d=>Math.floor(d/SEASON);
const sday=d=>d-seasonOf(d)*SEASON;                         // day within the season, 0 = Monday
const yearOf=d=>2026+seasonOf(d);
const seasonFirst=(s=seasonOf(day()))=>s*SEASON;
const isLastSeason=(d=day())=>seasonOf(d)>=S.years-1;
// the Monday nearest July 13 of a year, as a UTC date
function seasonStartUTC(y){const t=Date.UTC(y,6,13),w=new Date(t).getUTCDay();let off=(1-w+7)%7;if(off>3)off-=7;return t+off*864e5}
const dateOf=d=>new Date(seasonStartUTC(yearOf(d))+sday(d)*864e5);
const MONTH=['January','February','March','April','May','June','July','August','September','October','November','December'];
const dlabel=d=>{const x=dateOf(d);return `${dayName(d).slice(0,3)} ${MONTH[x.getUTCMonth()].slice(0,3)} ${x.getUTCDate()}`};
const dlong=d=>{const x=dateOf(d);return `${dayName(d)}, ${MONTH[x.getUTCMonth()]} ${x.getUTCDate()}`};
const dlongY=d=>`${dlong(d)}, ${yearOf(d)}`;
const isSunMon=d=>{const w=((d%7)+7)%7;return w===6||w===0};   // DAYS starts on Monday; seasons are whole weeks
function doyOf(d){const x=dateOf(d);return Math.round((x-Date.UTC(x.getUTCFullYear(),0,1))/864e5)+1}
const evenYear=d=>yearOf(d)%2===0;
function hudDay(d){return `Season ${seasonOf(d)+1}/${S.years} · ${dlabel(d)}, ${yearOf(d)}`}

// ---- the rules and the runs change every season ----
// Season 1 is 2026 as it really is. Later seasons are invented: forecasts vary, kings may reopen,
// halibut charter rules shift with the allocation. (A game, not a prediction.)
function genRegs(s){
  if(s===0) return {year:2026,king:'closed',hal:{size:27,closed:[1,2]},mult:{sockeye:1,coho:1,king:1},shift:0,
    fc:'Late-run sockeye forecast: about average. Kenai kings: closed all season (stock of concern).'};
  const r=Math.random,sock=Math.round((.6+r()*.8)*100)/100,coho=Math.round((.6+r()*.8)*100)/100;
  const kr=r(),king=kr<.45?'closed':kr<.75?'cr':'open';
  const hal={size:pick([26,27,28,30,32]),closed:pick([[1,2],[1,2],[2],[1],[]])};
  const w=x=>x>=1.2?'strong':x>=.95?'about average':x>=.75?'below average':'weak';
  return {year:2026+s,king,hal,mult:{sockeye:sock,coho,king:king==='open'?1.6:king==='cr'?1:.8},shift:Math.round((r()-.5)*8),
    fc:`Late-run sockeye forecast: ${w(sock)}. Coho: ${w(coho)}. Kenai kings: ${{closed:'closed all season',cr:'catch-and-release only',open:'open: 1 per day, 20 inches or longer'}[king]}.`};
}
const REG=()=>S.reg||genRegs(0);
const kingRule=()=>REG().king;                              // 'closed' | 'cr' (catch-and-release) | 'open'
const noBait=()=>REG().king!=='open';                        // single-hook, no-bait EO rides along with king restrictions
const halSize=()=>REG().hal.size;
const halClosed=d=>REG().hal.closed.includes(((d%7)+7)%7);
const halDaysTxt=()=>{const c=REG().hal.closed;return c.length?c.map(i=>DAYS[i]+'s').join(' and '):'none this year'};
function kingRuleTxt(){return {closed:`Closed in ${REG().year} by emergency order, including catch-and-release. A king hooked by accident is released right away, without lifting it from the water.`,
  cr:`Catch-and-release only in ${REG().year}. Kings may not be kept, and big kings may not be removed from the water.`,
  open:`Open in ${REG().year}: 1 per day, 20 inches or longer, recorded on your harvest record right away.`}[kingRule()]}
function gearRuleTxt(){return noBait()?'Below Skilak, Jun 20–Aug 15: one unbaited, single-hook artificial lure. No bait, no treble hooks.':'Bait and multiple hooks allowed below Skilak this year (kings are open). Single hooks still kinder to release fish.'}
// first-aid/CPR: a card lasts two years
const faDue=(d=day())=>S.cred.fa<(seasonOf(d)+1)*SEASON;     // expires before this season ends
const faRenewTo=(d=day())=>(seasonOf(d)+2)*SEASON+2;         // the Wednesday of the season two years on
// Classes: Monday, Tuesday and Thursday, 1:00-4:00 PM at the Soldotna clinic; you can join up to 1:30 PM (late arrivals still sit the 3 hours)
const faClassDay=d=>[0,1,3].includes(sday(d));
const faJoinable=m=>m>=780&&m<=810;
// the card runs out this season and today is on or before the expiry day, from the Monday of that week
const faUrgent=(d=day())=>faDue(d)&&S.cred.fa>=d&&d>=S.cred.fa-(((S.cred.fa%7)+7)%7);
const FA_CLASS_TXT='Mon/Tue/Thu 1 PM at the Soldotna clinic';

// ---- off-season upgrades ----
const UPGRADES=[
  {id:'motor',ic:'⚙️',n:'Repower: a new 50 hp jet outboard',cost:13500,once:true,d:'Boat back to 100, wear on it halved, and about 20% less gas on every run. Still 50 hp: the most the Kenai allows.'},
  {id:'sled',ic:'🚤',n:'New 20-ft welded jet sled, motor & trailer',cost:52000,once:true,d:'Drier and faster: sockeye and silver trips finish 30 minutes sooner (a little less tiring), the fuel run takes 45 minutes instead of 65, and you get a 40-gallon tank and a better catch and happier clients. The July five-person limit doesn’t change.'},
  {id:'drift',ic:'🛶',n:'New drift boat & trailer',cost:12500,once:true,d:'Upper Kenai floats go better (+catch, +happiness).'},
  {id:'web',ic:'🌐',n:'Website refresh + Anchorage sport-show booth',cost:2200,d:'More bookings this season.'},
  {id:'course',ic:'🧯',n:'Winter course: swiftwater rescue & fly casting',cost:750,d:'Skill +4. One per winter.'},
  {id:'rates',ic:'💲',n:'Raise your rates 10%',cost:0,d:'Pays 10% more per trip, but bookings drop (about 8% fewer trips a step, in July and the rest of the summer) and clients expect more: tips shrink unless the day goes well. Each step needs more reputation (65, 70, 75). Up to +30%.'},
  {id:'asst',ic:'🧑‍🤝‍🧑',n:'Hire an assistant guide (second sled, decals, training)',cost:32000,once:true,d:'A used second sled and trailer, decals, permit and training for an assistant guide. When you are booked, a second party can take the same slot with your assistant: you keep 60% of the fare and tips, they cost fuel and a $3,000 winter overhead, and their day can go wrong (a refund, a fine, your name on the decal). Needs Rep 70 and two seasons under your belt.'},
  {id:'lodge',ic:'🏡',n:'Build four riverside guest cabins',cost:95000,once:true,d:'Four cabins on a Soldotna river lot, rented at about $225 a night over the summer, and their guests book trips: roughly +$12,000 a year at a top reputation after cleaning, staff, utilities and a $5,500 winter bill (much less if your rep is poor), and 10% more off-month trips. Needs Rep 60 and three seasons behind you.'},
  {id:'dock',ic:'⚓',n:'Buy a riverfront lot with a private launch and fuel dock',cost:240000,once:true,d:'Your own ramp and pump on the Kenai: no $15 launch fees, no trips to Kenai Harbor (fill up at your dock for about $0.85 a gallon less), clients love the quiet put-in (+3 happiness on sockeye and silver trips) and about 8% more bookings. Needs Rep 70 and four seasons behind you.'},
  {id:'chp',ic:'⚓',n:'Buy a Charter Halibut Permit + used 28-ft six-pack boat',cost:165000,once:true,d:'Run your own Homer halibut charters ($350 a head, ~45 gal of fuel a day) instead of captaining for a buddy, with more halibut bookings.'},
];
function upOK(u){const U=S.up,s=seasonOf(day());
  if(u.once&&U[u.id]) return 'Done';
  if(u.id==='web'&&U.web===s) return 'Done this winter';
  if(u.id==='course'&&U.course===s) return 'Done this winter';
  if(u.id==='rates'){if(U.rate>=1.3)return 'Maxed out';const need=rateRep();if(S.rep<need)return `Needs Rep ${need}`}
  if(u.id==='asst'){if(S.rep<70)return 'Needs Rep 70';if(S.seasons.length<2)return 'Needs two seasons first'}
  if(u.id==='lodge'){if(S.rep<60)return 'Needs Rep 60';if(S.seasons.length<3)return 'Needs three seasons first'}
  if(u.id==='dock'){if(S.rep<70)return 'Needs Rep 70';if(S.seasons.length<4)return 'Needs four seasons first'}
  if(S.money<u.cost) return 'Can’t afford it';
  return null}
function buyUp(u){const U=S.up,s=seasonOf(day());money(-u.cost);S.stats.spent+=u.cost;
  if(u.id==='motor'){U.motor=true;S.boat=100;U.value+=u.cost}
  if(u.id==='sled'){U.sled=true;U.value+=u.cost}
  if(u.id==='drift'){U.drift=true;U.value+=u.cost}
  if(u.id==='chp'){U.chp=true;U.value+=u.cost}
  if(u.id==='asst'||u.id==='lodge'||u.id==='dock'){U[u.id]=true;U.value+=u.cost}
  if(u.id==='web')U.web=s;
  if(u.id==='course'){U.course=s;S.skill+=4}
  if(u.id==='rates')U.rate=Math.round((U.rate+.1)*10)/10;
  sfx('good');say(`${u.ic} ${u.n}${u.cost?` (${$(u.cost)})`:''}.`)}
// Rates: each +10% step costs something. Bookings fall with price (RATE_BOOK per step, in July and across the rest of the
// summer), clients expect more (RATE_MOOD happiness per step: smaller tips on an average day) and the next step needs more rep.
const RATE_BOOK=.08,RATE_MOOD=3;
const rateSteps=()=>Math.round((((S.up&&S.up.rate)||1)-1)*10);
const rateRep=()=>65+5*rateSteps();                          // rep needed to buy the NEXT step
const rateDemand=()=>Math.max(.4,1-RATE_BOOK*rateSteps());   // share of bookings that survive the price
// effects used by the trip engine and payOf()
const upQ=type=>(S.up.sled&&(type==='reds'||type==='silver')?.05:0)+(S.up.drift&&type==='trout'?.05:0);
const upH=type=>(S.up.sled&&(type==='reds'||type==='silver')?3:0)+(S.up.drift&&type==='trout'?4:0)+(S.up.dock&&(type==='reds'||type==='silver')?3:0);

// ---- season rollover: runs on the first morning of each new season (from onMorning) ----
const WINTER_COST=[['🏠 Living costs, Oct–May (after your winter job)',1800],['🪪 Guide & business licenses, KRSMA permit, vessel decals',650],['🛡️ Liability insurance & drug-testing consortium',1950]];
const winterCosts=()=>WINTER_COST.concat(S.up&&S.up.asst?[['🧑‍🤝‍🧑 Assistant guide: license, decals, insurance, drug-testing',3000]]:[],S.up&&S.up.lodge?[['🏡 Cabins: property tax, insurance and winterizing',5500]]:[]).map(([n,c])=>[n,Math.round(c*DF().cost)]);

// ---- late-career money sinks (2026 Alaska prices, approximate) ----
// A boat that has worn down to 0 is out of service until you pay for a major repair (a jet-unit rebuild or a new drift-boat floor).
const MAJOR_REPAIR=2400;
const boatDown=()=>S.boat<=0;
// Never servicing the boats costs you, but it doesn't end the career: warnings as it wears, an emergency patch and a loaner for a day.
const PATCH_COST=600,PATCH_TO=25,PATCH_MAX=10,LOANER_COST=600;   // patch: only when the boat is at 10 or less; a loaner runs every trip today
const noBoat=()=>S.boat<=0&&S.loaner!==S.cur;                 // out of service, with no loaner rented today
const loanerToday=()=>S.boat<=0&&S.loaner===S.cur;
const canPatch=()=>S.boat<=PATCH_MAX;
const boatTier=b=>b<=0?4:b<=10?3:b<=20?2:b<=40?1:0;             // 0 fine, 1 (≤40), 2 (≤20), 3 (≤10), 4 out of service
const BOAT_WARN=['','🔧 Boat condition is down to {b}. Breakdowns get likely and clients notice. Service it at the shop when you can.','🔧 Boat condition {b}: the sled runs rough and breaks down often. Service it soon; a few more trips and it is out of service.','🔧 Boat condition {b}: one or two more trips and it is out of service. Service it now, or an emergency patch will hold it a day or two.','🔧 Your boat is out of service. Pay for a major repair, or patch it up or rent a loaner to keep today’s trip.'];
// An emergency patch holds for two days, then it gives out and the boat falls back to where it was.
function patchExpire(d){const P=S.patch;if(!P||d<P.d+2)return;S.patch=null;if(S.boat<=PATCH_TO&&S.boat>P.base){S.boat=P.base;say(`🩹 The emergency patch gives out overnight: the boat is back at ${S.boat}.`);}}
function boatWatch(prev){const k=boatTier(S.boat);if(k>boatTier(prev)&&k>=1&&k<=3)showTile('🔧','Boat condition '+S.boat,BOAT_WARN[k].replace('{b}',S.boat).replace(/^🔧 /,''),'warn')}
const sledTimeSaved=type=>S.up&&S.up.sled&&(type==='reds'||type==='silver')?30:0;
// The cabins: about $225 a night, ~4 cabins, ~45 rented nights over the summer, minus cleaning, linens, staff and utilities.
function lodgeSeason(){const f=DF().book*clamp(S.rep/70,.5,1.25);return {gross:Math.round(30000*f),costs:Math.round(20000*DF().cost)}}
// The assistant guide's day. His trips fill the slot you're already booked in; he keeps 40% of fare and tips.
const ASST_CUT=.4;
function asstSettle(b,notes){
  const T=TRIPS[b.type],r=Math.random,fare=payOf(b);
  const bad=r()<.12+(S.boat<40?.08:0)+(S.rep<50?.05:0);
  let refund=0,fine=0,dRep=0,line;
  if(bad){
    if(r()<.5){refund=Math.round(fare*.25);dRep=-4;line=`your assistant’s ${T.n.toLowerCase()} with the ${b.who} goes badly: the fish don’t bite and the clients want money back (${$(refund)} refunded).`}
    else{fine=Math.round(300*DF().fine);dRep=-5;line=`a trooper writes your assistant a ticket on the ${b.who}’s ${T.n.toLowerCase()} (${$(fine)}). It’s your name on the decal.`}
  }else line=`your assistant runs the ${b.who}’s ${T.n.toLowerCase()} and it goes well.`;
  const tip=bad?0:Math.round(fare*(.08+r()*.1)),costs=(T.fuel?Math.round(bn(b.type)*fuelPrice('kenai')):0)+(T.loc==='lower'?LAUNCH_FEE:0)+25;
  const mine=Math.round((fare-refund+tip)*(1-ASST_CUT))-fine-costs;
  money(mine);S.stats.spent+=fine+costs;S.stats.fines+=fine;adj('rep',bad?dRep:1);
  S.stats.asstTrips=(S.stats.asstTrips||0)+1;S.stats.asstNet=(S.stats.asstNet||0)+mine;
  b.status='done';b.out={happy:bad?35:70,fish:0,line:'run by your assistant',fare,refund,tip,net:mine};
  notes.push(`🧑‍🤝‍🧑 ${line.charAt(0).toUpperCase()+line.slice(1)} Your share, after his cut, fuel and fees: <b>${mine<0?'−':''}${$(Math.abs(mine))}</b>.`);
}
function startSeason(s){
  const st=S.stats,o=S.st0||{},yr=2025+s,prev={year:yr,trips:st.trips-(o.trips||0),fares:st.earned-(o.earned||0),earned:(st.earned-(o.earned||0))+(st.tips-(o.tips||0)),fines:st.fines-(o.fines||0),rep:S.rep,cites:(st.citesTotal||0)-(o.citesTotal||0),wom:S.wom||0};
  const rest=restOfSeason(prev);prev.rest=rest;money(rest.net);st.earned+=rest.gross;st.spent+=rest.costs;st.restTrips=(st.restTrips||0)+rest.trips;
  const boat0=S.boat;adj('boat',-Math.round(rest.trips*(S.up.motor?.2:.4)));driftFuelPrices();
  S.seasons.push(prev);S.st0=JSON.parse(JSON.stringify(st));
  const bill=winterCosts().reduce((a,[,c])=>a+c,0);money(-bill);st.spent+=bill;
  S.reg=genRegs(s);S.loaner=-1;S.patch=null;S.limit=3;S.eo=[];S.cum=Math.round(650000*S.reg.mult.sockeye);
  S.wom=0;S.warns=0;S.prep=-1;S.scout=-1;S.trip=null;S.unlogged=0;S.overdue=0;S.energy=90;
  adj('boat',S.up.motor?-5:-12);S.boat=Math.max(S.boat,Math.min(boat0,10));   // winter wear never takes a boat out of service on its own
  S.rep=Math.round(50+(S.rep-50)*.85);
  const before=S.cites;S.cites=S.citeLog.filter(x=>seasonOf(x)>=s-1).length;
  S.winter={s,bill,expired:before-S.cites};
  setTimeout(()=>{if(S&&S.winter&&!S.over)winterModal()},0);   // after the night summary
}
function winterModal(){
  const W=S.winter;if(!W)return;const s=W.s,p=S.seasons[S.seasons.length-1]||{};
  const fa=S.cred.fa<seasonFirst(s)?`<b style="color:var(--bad)">expired</b> (${dlongY(S.cred.fa)}). Renew it in Soldotna (Mon, Tue or Thu, 1–4 PM) before you guide`:S.cred.fa<seasonFirst(s)+SEASON?`<b style="color:var(--bad)">expires ${dlong(S.cred.fa)}</b>: renew it in Soldotna (Mon, Tue or Thu)`:`good through ${dlongY(S.cred.fa)}`;
  modal(`❄️ Off-season · ${2025+s} → ${2026+s}`,`
    <p><b>${p.year} in review:</b> ${p.trips} trips in the July peak, ${$(p.earned||0)} in fares and tips${p.fines?`, ${$(p.fines)} in fines`:''}. Rep ${p.rep}.</p>${p.rest&&p.rest.trips?`<p>📆 <b>The rest of ${p.year}</b> (June, August, September): ${p.rest.trips} more trips booked off your reputation: ${$(p.rest.gross)} in fares, ${$(p.rest.costs)} for fuel, launches and tackle. <b>Net ${$(p.rest.net)}.</b></p>`:''}
    <p>${winterCosts().map(([n,c])=>`${n}: <b>${$(c)}</b>`).join('<br>')}<br>Total: <b>${$(W.bill)}</b>. Cash now ${$(Math.round(S.money))}.</p>
    <p>📣 <b>${2026+s} season:</b> ${REG().fc}<br>⚓ Charter halibut: 2 a day, the second ${halSize()} inches or less; no retention on ${halDaysTxt()}.<br>⛽ Kenai Harbor fuel: ${$(fuelPrice('kenai',seasonFirst(s)))}/gal this year.<br>${evenYear(seasonFirst(s))?'🩷 Even year: pinks arrive in August.':'Odd year: hardly any pinks.'}</p>
    <p>⛑️ First-aid card: ${fa}.${W.expired>0?`<br>⚖️ ${W.expired} old citation${W.expired>1?'s':''} dropped off your record.`:''}${S.cites?`<br>⚖️ Active citations: ${S.cites}/3.`:''}</p>
    <p style="font-size:13px;color:var(--mute)">Season ${s+1} of ${S.years}. Bookings fill once you’ve made your off-season plans.</p>`,[
    {l:'🛠️ Upgrades & business',s:'Boats, marketing, rates, a Homer charter permit.',fn:()=>upgradeModal()},
    {l:'🏕️ Go winter camping',s:campUsed()?'You’ve already been camping this winter.':'Pick a place within 100 miles and a number of nights. Wildlife and quiet rest, and a bad night can cost a little cash.',dis:campUsed(),fn:()=>campModal()},
    {l:`🛶 Open bookings for ${2026+s}`,s:'Start the season.',fn:()=>finishWinter()}]);
}
function upgradeModal(){
  modal(`🛠️ Off-season plans · cash ${$(Math.round(S.money))}`,`<p style="font-size:13px;color:var(--mute)">Rates now ×${S.up.rate.toFixed(1)}. Rep ${S.rep}.</p>`,
    UPGRADES.map(u=>{const why=upOK(u);return {l:`${u.ic} ${u.n}${u.cost?` — ${$(u.cost)}`:''}`,s:why?`${why}. ${u.d}`:u.d,dis:!!why,fn:()=>{buyUp(u);setTimeout(upgradeModal,0)}}})
      .concat([{l:'Done',s:'Back to the off-season summary.',fn:()=>setTimeout(winterModal,0)}]));
}
function finishWinter(){
  const s=S.winter.s;S.winter=null;const reg=genSeasonBookings(s);
  const n=S.book.filter(b=>seasonOf(b.d)===s).length;
  say(`📅 ${2026+s} bookings are in: <b>${n} trips</b> for the season. ${REG().fc}${reg.length?'<br>'+reg.join('<br>'):''}`);
  showTile('📅',`${n} trips booked`,`Season ${s+1} of ${S.years}`,'good');
}
function genSeasonBookings(s){
  const base=s*SEASON,web=S.up.web===s?.15:0,r=Math.random;
  const p0=clamp((.35+S.rep/200+web+(S.arcs.rival.ally?.03:0))*rateDemand()*(S.up.dock?1.08:1),.12,.95);
  const q=()=>r()<.3?[pick(['drinker','nolicense','kingfan','photo','kid'])]:[];
  const party=()=>pick(PARTIES);
  for(let i=0;i<SEASON;i++){const d=base+i,w=i%7;
    if(w>=1&&w<=5){
      if(r()<p0){const p=party();addBooking({d,type:'reds',n:pick([2,3,4,4,4,5]),who:p.who,from:p.from,res:!!p.res,quirk:q()})}
      if(i>=7&&r()<p0*.6*REG().mult.coho){const p=party();addBooking({d,type:'silver',n:pick([2,3,4]),who:p.who,from:p.from,res:!!p.res,quirk:q()})}
    }else{
      if(S.up.chp&&r()<p0*.8){const p=party();addBooking({d,type:'halibut',n:pick([4,5,6]),who:p.who,from:p.from,res:!!p.res,quirk:q()})}
      else if(r()<p0*.7){const p=party();addBooking({d,type:'trout',n:pick([2,3,3]),who:p.who,from:p.from,res:!!p.res,quirk:q()})}
    }
  }
  const regLines=regsRebook(base,r);                      // 30-stories.js: returning parties
  if(S.up.asst) for(let i=1;i<SEASON;i++){const d=base+i,w=i%7;           // your assistant takes a second party when you are booked
    if(w<1||w>5||r()>p0*.9) continue;
    const types=['reds','reds','trout'].concat(i>=7?['silver']:[]).filter(t=>conflicts(d,t)&&!conflicts(d,t,true));
    if(!types.length) continue;const type=pick(types),p=party();
    addBooking({d,type,n:type==='trout'?pick([2,3]):pick([2,3,4]),who:p.who,from:p.from,res:!!p.res,quirk:[],asst:true})}
  if(!S.up.chp){const d=base+pick([6,13]);if(!S.book.some(b=>b.d===d&&b.status==='booked')){const p=party();addBooking({d,type:'halibut',n:6,who:p.who,from:p.from,res:!!p.res,quirk:[]})}}
  return regLines;
}

// ---- picking a career length (new-game chain: name → difficulty → career) ----
function careerModal(then){
  const cur=prefs().years||2;
  modal('📆 How long a career?','<p>Each year you guide the two-week July peak. In between: off-season bills, upgrades, rule changes and new bookings.</p>',
    [2,5,10].map(k=>({l:`${CAREERS[k].ic} ${CAREERS[k].n}${k===cur?' (last time)':''}`,s:CAREERS[k].d,fn:()=>{setPref('years',k);then(k)}})));
}
window.startNewGame=()=>{const go=k=>{newGame(k);render()};const pickDiff=()=>diffModal(k=>careerModal(()=>go(k)));if(!profileName())nameModal({first:true,then:pickDiff});else pickDiff()};
