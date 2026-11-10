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

// ---- off-season upgrades ----
const UPGRADES=[
  {id:'motor',ic:'⚙️',n:'Repower: a new 50 hp jet outboard',cost:13500,once:true,d:'Boat back to 100, wear on it halved, better on gas. Still 50 hp: the most the Kenai allows.'},
  {id:'sled',ic:'🚤',n:'New 20-ft welded jet sled, motor & trailer',cost:52000,once:true,d:'Drier, faster, roomier, with a 40-gallon tank. Sockeye and silver trips go better (+catch, +happiness).'},
  {id:'drift',ic:'🛶',n:'New drift boat & trailer',cost:12500,once:true,d:'Upper Kenai floats go better (+catch, +happiness).'},
  {id:'web',ic:'🌐',n:'Website refresh + Anchorage sport-show booth',cost:2200,d:'More bookings this season.'},
  {id:'course',ic:'🧯',n:'Winter course: swiftwater rescue & fly casting',cost:750,d:'Skill +4. One per winter.'},
  {id:'rates',ic:'💲',n:'Raise your rates 10%',cost:0,d:'Needs Rep 65+. Pays more per trip; a few fewer bookings. Up to +30%.'},
  {id:'chp',ic:'⚓',n:'Buy a Charter Halibut Permit + used 28-ft six-pack boat',cost:165000,once:true,d:'Run your own Homer halibut charters ($350 a head, ~45 gal of fuel a day) instead of captaining for a buddy, with more halibut bookings.'},
];
function upOK(u){const U=S.up,s=seasonOf(day());
  if(u.once&&U[u.id]) return 'Done';
  if(u.id==='web'&&U.web===s) return 'Done this winter';
  if(u.id==='course'&&U.course===s) return 'Done this winter';
  if(u.id==='rates'){if(U.rate>=1.3)return 'Maxed out';if(S.rep<65)return 'Needs Rep 65';}
  if(S.money<u.cost) return 'Can’t afford it';
  return null}
function buyUp(u){const U=S.up,s=seasonOf(day());money(-u.cost);S.stats.spent+=u.cost;
  if(u.id==='motor'){U.motor=true;S.boat=100;U.value+=u.cost}
  if(u.id==='sled'){U.sled=true;U.value+=u.cost}
  if(u.id==='drift'){U.drift=true;U.value+=u.cost}
  if(u.id==='chp'){U.chp=true;U.value+=u.cost}
  if(u.id==='web')U.web=s;
  if(u.id==='course'){U.course=s;S.skill+=4}
  if(u.id==='rates')U.rate=Math.round((U.rate+.1)*10)/10;
  sfx('good');say(`${u.ic} ${u.n}${u.cost?` (${$(u.cost)})`:''}.`)}
// effects used by the trip engine and payOf()
const upQ=type=>(S.up.sled&&(type==='reds'||type==='silver')?.05:0)+(S.up.drift&&type==='trout'?.05:0);
const upH=type=>(S.up.sled&&(type==='reds'||type==='silver')?3:0)+(S.up.drift&&type==='trout'?4:0);

// ---- season rollover: runs on the first morning of each new season (from onMorning) ----
const WINTER_COST=[['🏠 Living costs, Oct–May (after your winter job)',1800],['🪪 Guide & business licenses, KRSMA permit, vessel decals',650],['🛡️ Liability insurance & drug-testing consortium',1950]];
function startSeason(s){
  const st=S.stats,o=S.st0||{},yr=2025+s,prev={year:yr,trips:st.trips-(o.trips||0),fares:st.earned-(o.earned||0),earned:(st.earned-(o.earned||0))+(st.tips-(o.tips||0)),fines:st.fines-(o.fines||0),rep:S.rep,cites:(st.citesTotal||0)-(o.citesTotal||0)};
  const rest=restOfSeason(prev);prev.rest=rest;money(rest.net);st.earned+=rest.gross;st.spent+=rest.costs;st.restTrips=(st.restTrips||0)+rest.trips;
  adj('boat',-Math.round(rest.trips*(S.up.motor?.2:.4)));driftFuelPrices();
  S.seasons.push(prev);S.st0=JSON.parse(JSON.stringify(st));
  const bill=WINTER_COST.reduce((a,[,c])=>a+c,0);money(-bill);st.spent+=bill;
  S.reg=genRegs(s);S.limit=3;S.eo=[];S.cum=Math.round(650000*S.reg.mult.sockeye);
  S.prep=-1;S.scout=-1;S.trip=null;S.unlogged=0;S.overdue=0;S.energy=90;
  adj('boat',S.up.motor?-5:-12);S.rep=Math.round(50+(S.rep-50)*.85);
  const before=S.cites;S.cites=S.citeLog.filter(x=>seasonOf(x)>=s-1).length;
  S.winter={s,bill,expired:before-S.cites};
  setTimeout(()=>{if(S&&S.winter&&!S.over)winterModal()},0);   // after the night summary
}
function winterModal(){
  const W=S.winter;if(!W)return;const s=W.s,p=S.seasons[S.seasons.length-1]||{};
  const fa=S.cred.fa<seasonFirst(s)?`<b style="color:var(--bad)">expired</b> (${dlongY(S.cred.fa)}). Renew it in Soldotna (Tue/Thu, 1–4 PM) before you guide`:S.cred.fa<seasonFirst(s)+SEASON?`<b style="color:var(--bad)">expires ${dlong(S.cred.fa)}</b>: renew it in Soldotna (Tue/Thu)`:`good through ${dlongY(S.cred.fa)}`;
  modal(`❄️ Off-season · ${2025+s} → ${2026+s}`,`
    <p><b>${p.year} in review:</b> ${p.trips} trips in the July peak, ${$(p.earned||0)} in fares and tips${p.fines?`, ${$(p.fines)} in fines`:''}. Rep ${p.rep}.</p>${p.rest&&p.rest.trips?`<p>📆 <b>The rest of ${p.year}</b> (June, August, September): ${p.rest.trips} more trips booked off your reputation: ${$(p.rest.gross)} in fares, ${$(p.rest.costs)} for fuel, launches and tackle. <b>Net ${$(p.rest.net)}.</b></p>`:''}
    <p>${WINTER_COST.map(([n,c])=>`${n}: <b>${$(c)}</b>`).join('<br>')}<br>Total: <b>${$(W.bill)}</b>. Cash now ${$(Math.round(S.money))}.</p>
    <p>📣 <b>${2026+s} season:</b> ${REG().fc}<br>⚓ Charter halibut: 2 a day, the second ${halSize()} inches or less; no retention on ${halDaysTxt()}.<br>⛽ Kenai Harbor fuel: ${$(fuelPrice('kenai',seasonFirst(s)))}/gal this year.<br>${evenYear(seasonFirst(s))?'🩷 Even year: pinks arrive in August.':'Odd year: hardly any pinks.'}</p>
    <p>⛑️ First-aid card: ${fa}.${W.expired>0?`<br>⚖️ ${W.expired} old citation${W.expired>1?'s':''} dropped off your record.`:''}${S.cites?`<br>⚖️ Active citations: ${S.cites}/3.`:''}</p>
    <p style="font-size:13px;color:var(--mute)">Season ${s+1} of ${S.years}. Bookings fill once you’ve made your off-season plans.</p>`,[
    {l:'🛠️ Upgrades & business',s:'Boats, marketing, rates, a Homer charter permit.',fn:()=>upgradeModal()},
    {l:'🏕️ Go winter camping',s:campUsed()?'You’ve already been camping this winter.':'Pick a place within 100 miles and a number of nights. Wildlife, quiet and a little cash.',dis:campUsed(),fn:()=>campModal()},
    {l:`🛶 Open bookings for ${2026+s}`,s:'Start the season.',fn:()=>finishWinter()}]);
}
function upgradeModal(){
  modal(`🛠️ Off-season plans · cash ${$(Math.round(S.money))}`,`<p style="font-size:13px;color:var(--mute)">Rates now ×${S.up.rate.toFixed(1)}. Rep ${S.rep}.</p>`,
    UPGRADES.map(u=>{const why=upOK(u);return {l:`${u.ic} ${u.n}${u.cost?` — ${$(u.cost)}`:''}`,s:why?`${why}. ${u.d}`:u.d,dis:!!why,fn:()=>{buyUp(u);setTimeout(upgradeModal,0)}}})
      .concat([{l:'Done',s:'Back to the off-season summary.',fn:()=>setTimeout(winterModal,0)}]));
}
function finishWinter(){
  const s=S.winter.s;S.winter=null;genSeasonBookings(s);
  const n=S.book.filter(b=>seasonOf(b.d)===s).length;
  say(`📅 ${2026+s} bookings are in: <b>${n} trips</b> for the season. ${REG().fc}`);
  showTile('📅',`${n} trips booked`,`Season ${s+1} of ${S.years}`,'good');
}
function genSeasonBookings(s){
  const base=s*SEASON,web=S.up.web===s?.15:0,rate=(S.up.rate-1)*.5,r=Math.random;
  const p0=clamp(.35+S.rep/200+web-rate,.15,.95);
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
  if(!S.up.chp){const d=base+pick([6,13]);if(!S.book.some(b=>b.d===d&&b.status==='booked')){const p=party();addBooking({d,type:'halibut',n:6,who:p.who,from:p.from,res:!!p.res,quirk:[]})}}
}

// ---- picking a career length (new-game chain: name → difficulty → career) ----
function careerModal(then){
  const cur=prefs().years||2;
  modal('📆 How long a career?','<p>Each year you guide the two-week July peak. In between: off-season bills, upgrades, rule changes and new bookings.</p>',
    [2,5,10].map(k=>({l:`${CAREERS[k].ic} ${CAREERS[k].n}${k===cur?' (last time)':''}`,s:CAREERS[k].d,fn:()=>{setPref('years',k);then(k)}})));
}
window.startNewGame=()=>{const go=k=>{newGame(k);render()};const pickDiff=()=>diffModal(k=>careerModal(()=>go(k)));if(!profileName())nameModal({first:true,then:pickDiff});else pickDiff()};
