// ============================================================
//  GUIDE MASTER, part 6: fuel, towing and what things cost.
//  The jet sled burns gas from its own tank, and the only place to fill it is a harbor fuel dock:
//  Kenai Harbor (City Dock, at the river mouth) for the sled, Homer Harbor for your own charter boat.
//  Run dry and the Coast Guard tows you in; the harbor charges to bring you alongside the fuel dock.
//
//  Prices (2026, approximate): Kenai Peninsula pump gas ran about $5.14–5.55/gal in 2026; marine fuel docks
//  charge a premium, so the game starts the Kenai dock at $6.19 and Homer at $6.45 and lets them drift
//  each season. Harbor towing uses Homer's tariff rate ($102 per hour). A dealer 100-hour outboard service
//  is about $250–400 in the lower 48; more in Alaska.
// ============================================================
const SLED_TANK=()=>S.up&&S.up.sled?40:30;          // gallons
const CHARTER_TANK=100;
const LAUNCH_FEE=15;                                // Soldotna city launch, per motorized launch
const HARBOR_TOW=102;                               // harbor assist to the fuel dock (Homer tariff: $102 / hour)
const BURN={reds:9,silver:11,scout:4,soloHour:3,charter:45};   // gallons, typical
// A new 50 hp jet outboard (the repower upgrade) burns about 20% less than the tired old one. The charter boat is another boat.
const fuelMult=()=>S.up&&S.up.motor?.8:1;
const bn=k=>Math.round(BURN[k]*(k==='charter'?1:fuelMult())*10)/10;
L.harbor={name:'Kenai Harbor',ic:'⛽',desc:'Kenai City Dock at the river mouth: fuel dock, boat ramp and harbormaster',hours:()=>[360,1320],
  art:({night})=>`<rect y="96" width="480" height="44" fill="${night?'#1f3b48':'#5f9fb1'}"/><polygon points="320,96 380,66 420,78 480,70 480,96" fill="${K.mtn(night)}"/><rect x="40" y="104" width="230" height="10" fill="#7a5a3a"/>${[50,90,130,170,210,250].map(x=>`<rect x="${x}" y="114" width="4" height="26" fill="#5a4028"/>`).join('')}<rect x="120" y="76" width="22" height="28" rx="3" fill="#c0392b"/><rect x="124" y="81" width="14" height="8" fill="#f4f7f8"/><path d="M142 90 q12 2 10 14" stroke="#222" stroke-width="2" fill="none"/>${sled(160,134)}<path d="M300 132 h90 l12 -14 h-110 z" fill="#f2f2f2"/><rect x="330" y="104" width="34" height="14" fill="#3d4a50"/>${gull(420,40)}${gull(445,30)}`};
Object.assign(TRAVEL,{'harbor|shop':25,'harbor|town':22,'harbor|lower':25,'harbor|kbeach':5,'harbor|cooper':82,'harbor|homer':92});
STATS.splice(4,0,{l:'Fuel',v:()=>`${Math.round(S.fuel)}g`,m:()=>S.fuel/SLED_TANK()*100,warn:()=>S.fuel<bn('reds'),title:'Gallons in the jet sled. Fill up only at the Kenai Harbor fuel dock.'});

// ---- prices ----
function fuelPrice(where,d=day()){const b=where==='dock'?(S.fuelBase||{kenai:6.19}).kenai-.85:(S.fuelBase||{kenai:6.19,homer:6.45})[where];const wob=Math.sin(d*1.7)*.05;return Math.round((b+wob)*DF().cost*100)/100}
const TOW_FILL=12;                                   // gallons the harbormaster sells after a tow (a full tank is your own trip to the dock)
function fillUp(tank,where,max){
  const cap=tank==='fuel'?SLED_TANK():CHARTER_TANK,p=fuelPrice(where),want=Math.max(0,Math.min(max||cap,cap)-S[tank]);
  const gal=Math.max(0,Math.min(want,Math.floor(S.money/p*10)/10)),cost=Math.round(gal*p*100)/100;
  if(gal<=0) return 0;
  S[tank]=Math.round((S[tank]+gal)*10)/10;money(-cost);S.stats.spent+=cost;S.stats.fuelGal=(S.stats.fuelGal||0)+gal;S.stats.fuelCost=(S.stats.fuelCost||0)+cost;
  return {gal,cost,p};
}
// ---- running dry ----
// Called when a burn can't be covered. notes: trip notes (or null → say). Returns the tow cost.
function towIn(notes){
  S.fuel=0;S.stats.tows=(S.stats.tows||0)+1;
  const lines=['🛟 The motor coughs, catches, and dies. Empty tank. You drop the anchor out of the channel and make the call on VHF 16.',
    '🚤 The Coast Guard comes up the river, takes your towline and brings you down to Kenai Harbor. Nobody on the Kenai will let you forget it.',
    `⚓ The harbormaster brings you alongside the fuel dock: ${$(HARBOR_TOW)} harbor assist.`];
  money(-HARBOR_TOW);S.stats.spent+=HARBOR_TOW;adj('rep',-4);adj('energy',-8);
  const top=fillUp('fuel','kenai',TOW_FILL);                      // alongside the fuel dock: the harbormaster sells you enough to get going again
  if(top)lines.push(`⛽ The harbormaster sells you ${top.gal.toFixed(1)} gallons to get going again: ${$(Math.round(top.cost))}.`);
  (notes?(l=>notes.push(l)):say)(lines.join(' '));
  if(Math.random()<.3) cite('an expired flare kit found during the Coast Guard boarding',100,true,notes,'The Coast Guard boarding officer');
  showTile('🛟','Towed in','Out of fuel','bad');
  return HARBOR_TOW;
}
// Burn gallons from the sled for a solo outing. Returns the fraction of the outing you got (1 = all).
function burnSolo(gal,notes){
  if(S.fuel>=gal){S.fuel=Math.round((S.fuel-gal)*10)/10;return 1}
  const f=S.fuel/gal;towIn(notes);pass(120);S.loc='harbor';return f;
}
// What a booked trip will burn, and from which tank (null = no fuel needed)
function tripFuel(b){
  if(b.type==='reds'||b.type==='silver') return {tank:'fuel',gal:bn(b.type),where:'kenai'};
  if(b.type==='halibut'&&S.up&&S.up.chp) return {tank:'hfuel',gal:BURN.charter,where:'homer'};
  return null;
}
// Wind over 12 kt burns more (the same factor tripEnd uses). For a day we haven't seen yet, guess from the forecast kind.
const windKt=d=>{const w=S.wxd&&S.wxd[d];if(w)return w.wind;return {sun:6.5,cloud:8.5,rain:12,wind:23}[(S.wx||[])[d]||'sun']||8};
const windFuel=d=>1+Math.max(0,windKt(d)-12)/40;
// What a trip is likely to burn, planned for the longest run you could pick: base burn + the longest run's extra + the usual scatter, times the wind.
// (The charter's Barren Islands run is a flagged choice of its own, so it isn't counted in the charter's check.)
function expectBurn(b,d){const f=tripFuel(b);if(!f)return 0;d=d!=null?d:(b.d!=null?b.d:day());
  const sled=f.tank==='fuel',longest=sled?Math.max(0,...(SPOTS[b.type]||[]).map(s=>s.fuel||0))*fuelMult():0;
  return Math.round((f.gal+longest+1.5*(sled?fuelMult():1))*windFuel(d)*10)/10}
const fuelShort=b=>{const f=tripFuel(b);return !!f&&S[f.tank]<expectBurn(b)};
// Tomorrow (and what's left of today): will the sled's tank cover the sled trips that are booked?
function fuelPlan(){const d=day(),own=x=>x.status==='booked'&&!x.asst&&tripFuel(x)&&tripFuel(x).tank==='fuel';
  const trips=S.book.filter(x=>(x.d===d||x.d===d+1)&&own(x)&&!(x.d===d&&tod()>TRIPS[x.type].start));
  const need=Math.round(trips.reduce((a,x)=>a+expectBurn(x),0)*10)/10;return {need,have:Math.round(S.fuel),short:need>S.fuel&&trips.length>0,n:trips.length,tomorrow:trips.some(x=>x.d===d+1)}}
// STEP for the trip engine: the tank is low at launch
STEP.fuel=(b,t)=>{const f=tripFuel(b),have=S[f.tank],p=fuelPrice(f.where),cap=f.tank==='fuel'?SLED_TANK():CHARTER_TANK,est=Math.round((cap-have)*p),need=expectBurn(b),typical=f.gal;
  const kenai=f.where==='kenai',own=kenai&&S.up.dock,wind=windKt(day()),runMins=own?10:kenai?(S.up.sled?45:65):20;
  // the harbor fuel dock keeps hours (6 AM–10 PM): arrive early and you wait for it to open; after closing there is no fuel
  const hr=kenai&&!own?L.harbor.hours(day()):null,arr=tod()+Math.round(runMins/2),wait=hr&&arr<hr[0]?hr[0]-arr:0,closed=!!hr&&arr+wait>=hr[1];
  const why=[wind>12?`${wind} kt of wind`:'',f.tank==='fuel'?'a long run to a far bar':''].filter(Boolean).join(' or ');
  return {t:'⛽ Low on fuel',b:`${t&&t.riskAsk?`<p style="background:#fbe3dc;border-radius:8px;padding:8px 10px"><b>⚠️ Think twice about running low.</b> If the tank runs dry out there, the Coast Guard tows you in: the trip is cut short and the fare halved, you pay a $${HARBOR_TOW} harbor assist, lose 4 rep and the clients leave a bad review, and the boarding can turn up a ticket. Every trip on fumes risks it.</p>`:''}<p>The gauge reads <b>${Math.round(have)} gallons</b>. A ${TRIPS[b.type].n.toLowerCase()} usually burns about <b>${typical}</b>, and up to about <b>${Math.round(need)}</b> with ${why||'the usual scatter'}. The only fuel is at the ${kenai?'Kenai Harbor':'Homer Harbor'} fuel dock (${$(p)}/gal${hr?`, open ${fmt(hr[0])}–${fmt(hr[1])}`:''}).</p>`,o:[
    Object.assign(O(own?'Top off at your own riverfront pump':kenai?(wait?`Send them for coffee; the fuel dock opens at ${fmt(hr[0])}, then fill up`:'Send them for coffee; trailer the sled to Kenai Harbor and fill up'):'Top off at the Homer Harbor fuel dock',closed?`Kenai Harbor’s fuel dock is closed (open ${fmt(hr[0])}–${fmt(hr[1])}).`:own?`10 minutes and ~${$(Math.round((cap-have)*fuelPrice('dock')))}.`:kenai?`About ${runMins+wait} minutes${wait?' (the dock isn’t open yet)':''} and ~${$(est)}. They won’t love waiting.`:`20 minutes and ~${$(est)}.`,(b,t)=>{
      const r=fillUp(f.tank,own?'dock':f.where);pass((own?10:kenai?runMins:20)+wait);t.happy-=own?0:kenai?8+(wait?3:0):2;
      t.notes.push(r?`⛽ ${r.gal.toFixed(1)} gallons at ${$(r.p)}: ${$(Math.round(r.cost))}. ${kenai?'The clients have opinions about the long coffee break.':''}`:'⛽ You can’t afford fuel. You go with what’s in the tank.')}),{dis:closed}),
    O(t&&t.riskAsk?`Risk it anyway: ${Math.round(have)} gallons`:`Risk it: ${Math.round(have)} gallons should do`,`If it doesn’t, the Coast Guard tows you in and the trip is cut short. You need about ${Math.round(need)} to be safe.`,(b,t)=>{
      if(!S.riskWarned){S.riskWarned=true;t.riskAsk=true;t.step--}})]};   // the first time ever, ask again with the consequences spelled out
};

// ---- the fuel dock ----
function harborActions(a){
  if(S.loc==='harbor'){
    const open=isOpen('harbor'),cap=SLED_TANK(),p=fuelPrice('kenai'),gal=Math.max(0,cap-S.fuel);
    a.push({ic:'⛽',l:`Fill the jet sled — ${gal.toFixed(1)} gal × ${$(p)} = ${$(Math.round(gal*p))}`,s:`${Math.round(S.fuel)}/${cap} gallons now. Fuel dock open 6 AM–10 PM.`,cat:'work',cls:S.fuel<bn('reds')+2?'primary':'',dis:!open||gal<1||S.money<p,
      fn:()=>{const r=fillUp('fuel','kenai');pass(15);say(`⛽ ${r.gal.toFixed(1)} gallons of marine gas at ${$(r.p)}: ${$(Math.round(r.cost))}. Tank full (${Math.round(S.fuel)} gal).`)}});
    a.push({ic:'🦅',l:'Watch the eagles work the dock',s:'20 min. Energy +3.',cat:'rest',fn:()=>{pass(20);adj('energy',3);say('🦅 A dozen bald eagles squabble over fish scraps on the pilings while the tide drops out of the harbor.')}});
  }
  if(S.loc==='shop'&&S.up&&S.up.dock){
    const cap=SLED_TANK(),p=fuelPrice('dock'),gal=Math.max(0,cap-S.fuel);
    a.push({ic:'⛽',l:`Fill the sled at your own dock — ${gal.toFixed(1)} gal × ${$(p)} = ${$(Math.round(gal*p))}`,s:`${Math.round(S.fuel)}/${cap} gallons now. Your riverfront pump: no trip to the harbor.`,cat:'work',cls:S.fuel<bn('reds')+2?'primary':'',dis:gal<1||S.money<p,
      fn:()=>{const r=fillUp('fuel','dock');pass(10);say(`⛽ ${r.gal.toFixed(1)} gallons from your own pump at ${$(r.p)}: ${$(Math.round(r.cost))}. Tank full (${Math.round(S.fuel)} gal).`)}});
  }
  if(S.loc==='homer'&&S.up&&S.up.chp){
    const p=fuelPrice('homer'),gal=Math.max(0,CHARTER_TANK-S.hfuel);
    a.push({ic:'⛽',l:`Fuel the charter boat — ${gal.toFixed(0)} gal × ${$(p)} = ${$(Math.round(gal*p))}`,s:`${Math.round(S.hfuel)}/${CHARTER_TANK} gal. A day on Cook Inlet burns ~${BURN.charter}.`,cat:'work',cls:S.hfuel<BURN.charter+5?'primary':'',dis:gal<1||S.money<p,
      fn:()=>{const r=fillUp('hfuel','homer');pass(20);say(`⛽ ${r.gal.toFixed(0)} gallons at the Homer Harbor fuel dock: ${$(Math.round(r.cost))}.`)}});
  }
}

// ---- the rest of the summer (June, August, September), settled in the off-season ----
// You play the two-week July peak; the rest of your season is booked off your reputation.
function restOfSeason(p){
  if(!p||!p.trips) return {trips:0,gross:0,costs:0,net:0};
  const trips=Math.round(p.trips*2.4*DF().book*clamp(S.rep/70,.5,1.25)*(1+clamp((p.wom||0)*.005,-.06,.08))*rateDemand()*(S.up&&S.up.lodge?1.1:1)*(S.up&&S.up.dock?1.08:1)),fare=p.fares/p.trips;
  let gross=Math.round(trips*fare),costs=Math.round(trips*(bn('reds')*fuelPrice('kenai')+LAUNCH_FEE+30));
  if(S.up&&S.up.asst){const x=Math.round(trips*.2);gross+=Math.round(x*fare*(1-ASST_CUT));costs+=Math.round(x*(bn('reds')*fuelPrice('kenai')+LAUNCH_FEE+30))}   // the assistant covers the off-month overflow
  if(S.up&&S.up.lodge){const l=lodgeSeason();gross+=l.gross;costs+=l.costs}
  return {trips,gross,costs,net:gross-costs};
}
function driftFuelPrices(){const r=Math.random;S.fuelBase=S.fuelBase||{kenai:6.19,homer:6.45};
  const f=1+(r()-.4)*.12;S.fuelBase.kenai=Math.round(S.fuelBase.kenai*f*100)/100;S.fuelBase.homer=Math.round(S.fuelBase.homer*f*100)/100}
