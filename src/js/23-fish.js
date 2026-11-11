// ============================================================
//  GUIDE MASTER, part 4: the fish.
//  Run timing for each species by date, daily weather and river level, Cook Inlet tides
//  and time-of-day bites. These drive trip quality, the sonar count, dipnetting and
//  "Take the boat out" (solo fishing when the boat isn't booked).
//
//  Run timing is a simplified model of typical Kenai returns, not a forecast:
//    late-run sockeye: enter mid-July, peak at the sonar around Jul 20–25, reach the upper river ~2 weeks later
//    coho: first fish late July, peak mid-August        pinks: even years only, peak early-to-mid August
//    late-run kings: peak late July (closed in 2026; later seasons vary)     rainbows/Dollies: resident, better as sockeye spawn
//    halibut: on the shallower summer grounds from late spring through September
// ============================================================
// doyOf(d), evenYear(d), seasonOf(d): 24-career.js. Each season's REG().mult/shift scale and move the runs.
const gauss=(x,c,s)=>Math.exp(-Math.pow((x-c)/s,2)/2);

// loc: where it can be fished and how good that water is for it (0–1). lag: days behind the sonar at river mile 19.
const SPECIES={
  sockeye:{n:'Sockeye',ic:'🐟',keep:true,lim:()=>S.limit,rate:1.2,loc:{lower:1,cooper:.6,kbeach:1},lag:{cooper:12},
           curve:x=>.08+.92*gauss(x,202,7)+.25*gauss(x,176,8),note:'Late run peaks at the sonar around Jul 20–25.'},
  coho:   {n:'Coho (silvers)',ic:'🎣',keep:true,lim:()=>2,rate:.6,loc:{lower:1,cooper:.15},lag:{cooper:20},
           curve:x=>gauss(x,228,12),note:'First silvers in late July; the run peaks mid-August.'},
  pink:   {n:'Pinks (humpies)',ic:'🩷',keep:true,lim:()=>6,rate:1.6,loc:{lower:1},
           curve:x=>gauss(x,222,7),note:'Even years only: in even Augusts the river floods with them.'},
  king:   {n:'King',ic:'👑',closed:true,lim:()=>1,rate:.15,loc:{lower:1,cooper:.2},
           curve:x=>.35*gauss(x,205,9),note:'Late run peaks in late July. Open, catch-and-release or closed, year to year: see Regs.'},
  trout:  {n:'Rainbow trout',ic:'🌈',cr:true,rate:2.4,loc:{cooper:1,lower:.3},
           curve:x=>.45+.4*gauss(x,225,15),note:'Resident fish. Get better as the sockeye spawn and the bead bite starts.'},
  dolly:  {n:'Dolly Varden',ic:'🐠',cr:true,rate:2,loc:{cooper:.85,lower:.3},
           curve:x=>.4+.4*gauss(x,220,15),note:'Follow the salmon; eat eggs and flesh.'},
  halibut:{n:'Halibut',ic:'🫓',keep:true,lim:()=>2,rate:.9,loc:{homer:1},
           curve:x=>.55+.35*gauss(x,196,35),note:'On the summer grounds. Fish the slack tide.'},
};

// ---- weather: generated each morning by rollDay() ----
function rollWeather(d){
  const k=S.wx[d]||'sun',r=(a,b)=>a+Math.random()*(b-a);
  const w={temp:Math.round({sun:r(66,76),cloud:r(57,65),rain:r(51,58),wind:r(56,64)}[k]),
    wind:Math.round({sun:r(3,10),cloud:r(5,12),rain:r(8,16),wind:r(18,28)}[k]),
    dir:pick(['N','NE','SE','S','SW','W','NW']),rain:k==='rain'?Math.round(r(.3,.9)*10)/10:0};
  // the Kenai is glacial: hot days melt ice and raise it, rain raises it, then it recedes
  const before=S.water??.5;
  S.water=clamp(before+w.rain*.35+(w.temp>=68?.06:0)-.07,.1,1);
  w.dw=Math.round((S.water-before)*100)/100;w.level=S.water;
  S.wxd[d]=w;
}
const wxOf=d=>S.wxd[d]||{temp:62,wind:8,dir:'SW',rain:0,dw:0,level:.5};
const waterTxt=w=>`${w.level>.75?'high':w.level<.3?'low':'normal'}, ${w.dw>.05?'rising':w.dw<-.04?'dropping':'steady'}`;
function windRisk(d=day()){return clamp(wxOf(d).wind/12,.5,2.2)}   // scales Skilak / Cook Inlet weather risks

// ---- tides at the mouth of the Kenai (semi-diurnal, spring/neap cycle). Heights in feet, roughly MLLW. ----
function tide(t){
  const amp=8+3.5*Math.cos(2*Math.PI*(t/1440)/14.77);
  const ph=2*Math.PI*(t-210)/745;
  return {h:10.5+amp*Math.cos(ph),rate:-Math.sin(ph),amp};
}
function tideTable(d=day()){
  const out=[];let p=tide(d*1440-5).h,c=tide(d*1440).h;
  for(let m=5;m<=1440;m+=5){const n=tide(d*1440+m).h;
    if(c>p&&c>=n) out.push({hi:true,m:m-5,h:c});else if(c<p&&c<=n) out.push({hi:false,m:m-5,h:c});p=c;c=n}
  return out;
}
const tideNow=(t=S.t)=>{const x=tide(t);return `${x.rate>.25?'flooding (incoming)':x.rate<-.25?'ebbing (outgoing)':x.h>14?'high slack':'low slack'}, ${x.h.toFixed(1)} ft`};

// ---- how good the fishing is: species × place × moment ----
function todFactor(sp,loc,t){
  const m=((t%1440)+1440)%1440,x=tide(t);
  if(loc==='kbeach') return .7+.35*(x.h-10.5+x.amp)/(2*x.amp)+(x.rate>0?.15:0);       // reds ride the incoming tide
  if(sp==='halibut') return 1.15-.35*Math.abs(x.rate);                               // slack tide
  const dawn=m>=300&&m<540,eve=m>=1080&&m<1320,night=m<300||m>=1320;
  if(sp==='sockeye') return dawn?1.15:eve?1.05:night?.8:.9;                           // midday sun + crowds
  if(sp==='coho'||sp==='king') return dawn?1.2:eve?1.05:night?.7:.85;
  if(sp==='trout'||sp==='dolly') return dawn||eve?1.1:.95;
  return 1;
}
function wxFactor(sp,loc,d){
  const w=wxOf(d),k=S.wx[d]||'sun';let f=1;
  if(loc==='lower'&&(sp==='sockeye'||sp==='pink')) f*=w.dw>.08?.88:1;                  // rising, dirty water scatters reds
  if(sp==='coho') f*=k==='rain'?1.08:1;                                              // fresh water pushes silvers in
  if(sp==='trout'||sp==='dolly') f*=(k==='cloud'||k==='rain'?1.08:k==='sun'?.94:1)*(w.level>.75?.88:1);
  if(sp==='halibut') f*=w.wind>18?.6:w.wind>12?.85:1;
  return f;
}
// this season's run size and timing for a species on a day (before place and daily noise)
function runCurve(sp,x,d){
  const R=REG(),m=R.mult[sp]??1,sh=(sp==='sockeye'||sp==='coho')?R.shift:0;
  return SPECIES[sp].curve(x-sh)*(sp==='pink'?(evenYear(d)?1:.05):1)*(sp==='sockeye'||sp==='coho'||sp==='king'?m:1);
}
function abundance(sp,loc,d=day()){
  const S_=SPECIES[sp],lw=S_&&S_.loc[loc];if(!lw)return 0;
  const lag=(S_.lag&&S_.lag[loc])||0,nz=(S.noise[d]&&S.noise[d][sp])||1;
  return clamp(runCurve(sp,doyOf(d)-lag,d)*nz*lw,0,1.3);
}
function fishOdds(sp,loc,t=S.t){const d=Math.floor(t/1440);return clamp(abundance(sp,loc,d)*todFactor(sp,loc,t)*wxFactor(sp,loc,d),0,1.4)}
function avgOdds(sp,loc,t0,mins){let s=0,n=0;for(let m=0;m<=mins;m+=30){s+=fishOdds(sp,loc,t0+m);n++}return s/n}

// runFactor() (used by trips): how this trip's water compares to a typical July trip
const TRIP_SP={reds:['sockeye','lower',.6],silver:['coho','lower',.15],trout:['trout','cooper',.6],halibut:['halibut','homer',.75]};
function runFactor(type,d=day()){
  const [sp,loc,center]=TRIP_SP[type]||TRIP_SP.reds,T=TRIPS[type];
  return clamp((avgOdds(sp,loc,d*1440+T.start,T.len)/center-1)*.15,-.15,.15);
}
// daily run noise + sonar count; called from rollDay()
function rollRun(d){
  const nz={};Object.keys(SPECIES).forEach(k=>nz[k]=Math.round((.7+Math.random()*.6)*100)/100);
  S.noise[d]=nz;
  return Math.round(runCurve('sockeye',doyOf(d),d)*nz.sockeye*230000/10)*10+Math.floor(Math.random()*10);
}

// ---- where to fish today (1.8.0): each spot answers to the day's water, wind, run and tide ----
// The spots in SPOTS (22-trips.js) are not equally good every day. SPOT_FIT[type][i] returns the day's reasons for spot i (value, text);
// they sum to a fit between -1 and 1 and move the catch by SPOT_Q per point. Scouting adds the day's hidden local noise (exact);
// the Fish tab shows the reasons from the conditions alone. Nothing is hidden from a player who looks: the buttons carry the hint.
const SPOT_Q=.15;
const TYPE_IX={reds:1,silver:2,trout:3,halibut:4};
const hz=(a,b,c)=>{const x=Math.sin(a*127.1+b*311.7+c*74.7)*43758.5453;return x-Math.floor(x)};
// today's conditions as signed readings (about -1 to +1, centred on a typical July day)
function spotConds(type,d=day()){
  const T=TRIPS[type],[sp,loc]=TRIP_SP[type]||TRIP_SP.reds,w=wxOf(d),k=S.wx[d]||'sun',n=(x,c,r)=>clamp((x-c)/r,-1,1);
  return {run:n(abundance(sp,loc,d),sp==='coho'?.09:.78,sp==='coho'?.12:.4),sock:n(abundance('sockeye','cooper',d),.22,.15),calm:n(w.wind,9,-6),lvl:n(w.level,.28,.3),
    trend:w.dw>.04?-.8:w.dw<-.05?.3:0,cloud:k==='cloud'||k==='rain'?.7:k==='sun'?-.7:0,slack:n(1-Math.abs(tide(d*1440+T.start+T.len/2).rate),.3,.35)};
}
const R=(v,up,down)=>[v,v>=0?up:down];     // a reading times its weight, with the reason for each sign
const SPOT_FIT={           // same order as SPOTS in 22-trips.js; null = no read (the closed-bank spot)
  reds:[
    c=>[R(.6*c.run,'a strong run stacks the seams','a thin run leaves the seams empty'),R(c.trend,'falling, clearing water holds reds in the seams','rising, dirty water scatters the seams')],
    c=>[R(.6*c.lvl,'high water pushes reds onto the gravel bars','low water leaves the bars dry'),R(.3*c.calm,'a calm run upriver','wind makes the long run rough')],
    null,
    c=>[R(.5*c.cloud,'overcast keeps the reds on the bank edge','bright sun pushes them to deep water'),R(-.3*c.run,'a thin run slides along the bank shallows','a big run crowds the walkway')]],
  silver:[
    c=>[R(.6*c.lvl,'big water fills the deep slots','low water empties the deep slots'),R(.3*c.calm,'easy trolling','wind makes trolling rough')],
    c=>[R(c.trend,'falling water parks silvers in the soft water','rising water drives silvers out of the soft water'),R(.4*c.cloud,'overcast helps','bright sun puts them down')],
    c=>[R(.6*c.run,'enough silvers to spread upriver','too few silvers to bother going this far'),R(.3*c.calm,'a calm run upriver','wind on the long run')]],
  trout:[
    c=>[R(.5*c.sock,'spawning reds have the rainbows on the egg bite','few spawning reds yet, so no egg bite'),R(-.4*c.lvl,'clear water shows the beads','milky, high water hides the beads'),R(.2*c.cloud,'overcast helps','bright sun')],
    c=>[R(c.trend===0?.4:-.3,'steady water fishes the riffles well','a changing river puts the fish down'),R(.3*c.cloud,'overcast helps','bright sun')],
    c=>[R(.8*c.calm,'a calm lake','whitecaps on Skilak')]],
  halibut:[
    c=>[R(.6*c.slack,'slack tide at the mouth','running tide at the mouth'),R(-.2*c.calm,'sheltered water','')],
    c=>[R(.6*c.calm,'light wind on the flats','chop on the flats'),R(.3*c.slack,'slack tide','running tide')],
    c=>[R(.9*c.calm,'calm seas out to the Barrens','chop out toward the Barren Islands')]],
};
// fit of spot i of a trip type on day d: {f, why}; exact adds the day's local noise (what scouting shows), otherwise conditions only
function spotFit(type,i,d=day(),exact=true){
  const fn=(SPOT_FIT[type]||[])[i];if(!fn) return null;
  const terms=fn(spotConds(type,d)),sum=terms.reduce((a,x)=>a+x[0],0),nz=exact?(hz(d,TYPE_IX[type]||0,i)-.5)*.7:0;
  const top=terms.reduce((m,x)=>Math.abs(x[0])>Math.abs(m[0])?x:m,[0,'']);
  return {f:clamp(sum+nz,-1,1),why:top[0]?top[1]:''};
}
const spotWord=f=>f>=.45?'Hot':f>=.15?'Good':f>-.15?'Fair':'Poor';
// did you scout where this trip goes (today or yesterday)?
const scoutedFor=(type,d=day())=>{const loc=TRIPS[type].loc;return loc==='lower'?S.scout>=d-1:!!(S.scoutAt&&S.scoutAt[loc]>=d-1)};
// what the player knows when picking a spot: 'exact' (scouted), 'tab' (looked at the Fish tab today) or null
const spotHint=(type,d=day())=>scoutedFor(type,d)?'exact':S.look===d?'tab':null;
const spotsToday=d=>{const t=[...new Set(todays(d).map(b=>b.type))];return t.length?t:['reds']};

// ---- 🚤 Take the boat out: booking-aware ----
// Returns the action for the Here tab at the lower launch or Cooper Landing (null elsewhere).
function boatAction(){
  if(S.loc!=='lower'&&S.loc!=='cooper') return null;
  const d=day(),m=tod(),boat=S.loc==='lower'?'jet sled':'drift boat';
  if(boatDown()) return {ic:'🚤',l:`Take the ${boat} out`,s:'Out of service at condition 0. Get a major repair at the shop first.',cat:'fish',dis:true,fn:()=>{}};
  const pend=todays(d).map(b=>({b,T:TRIPS[b.type]})).filter(x=>m<=x.T.start+90).sort((a,b)=>a.T.start-b.T.start)[0];
  let max=Math.max(0,(S.loc==='lower'?1080:1320)-m),why='';
  if(pend){
    const {b,T}=pend,here=T.loc===S.loc;
    if(here&&m>=T.start-60) return {ic:'🚤',l:'Take the boat out',s:`It’s booked: the ${b.who} are on the dock. Launch their trip instead.`,cat:'fish',dis:true,fn:()=>{}};
    const free=T.start-60-m-(here?0:travelMins(S.loc,T.loc));
    max=Math.min(max,free);why=` Back by ${fmt(T.start-60-(here?0:travelMins(S.loc,T.loc)))} for the ${b.who}.`;
  }
  if(max<120) return {ic:'🚤',l:'Take the boat out',s:pend?`Not enough time before your ${TRIPS[pend.b.type].n} with the ${pend.b.who} at ${fmt(pend.T.start)}.`:S.loc==='lower'?'Guide-vessel fishing below Skilak ends at 6 PM.':'Too late in the day to float.',cat:'fish',dis:true,fn:()=>{}};
  return {ic:'🚤',l:`Take the ${boat} out`,s:`No clients: fish for your freezer and scout the water. Up to ${Math.floor(max/60)} h.${why}${S.loc==='lower'?` Tank: ${Math.round(S.fuel)} gal (~${bn('soloHour')}/hour).`:''}`,cat:'fish',fn:()=>boatOut(max)};
}
function boatOut(max){
  const d=day(),m=tod(),loc=S.loc;
  if(loc==='lower'){
    if(isSunMon(d)) return modal('🚫 Your sled is a registered guide vessel',`<p>From May 1 to July 31, nobody may sport fish from a <b>registered guide vessel</b> on the Kenai below Skilak Lake on Sundays or Mondays, with or without clients. Today is ${dayName(d)}.</p><p style="font-size:13px;color:var(--mute)">You can still fish from the bank, or float the upper river from Cooper Landing.</p>`,[
      {l:'Fish from the bank instead',s:'The Flip for reds action, right here.',fn:()=>{}},
      {l:'Run it anyway. You’re alone; who’d know?',s:'Everyone on the Kenai knows your boat number.',fn:()=>{violate(null,{p:.45,fine:400,what:'fishing from a registered guide vessel on a closed day'});boatSpecies(max,true)}}]);
    if(m<360) return modal('⏰ Too early',`<p>Fishing from a registered guide vessel below Skilak is 6 AM–6 PM through July 31. It’s ${fmt(S.t)}.</p>`,[{l:'Wait at the launch until 6:00',s:`${360-m} min.`,fn:()=>{pass(360-m);boatSpecies(Math.min(max,1080-360))}},{l:'Never mind',fn:()=>{}}]);
  }
  boatSpecies(max);
}
function boatSpecies(max,illegal){
  const loc=S.loc,t=S.t,list=Object.keys(SPECIES).filter(k=>SPECIES[k].loc[loc]);
  const bar=o=>`<span style="display:inline-block;width:60px;height:7px;border-radius:4px;background:var(--line);vertical-align:middle;margin-right:6px"><i style="display:block;height:7px;border-radius:4px;width:${Math.round(clamp(o,0,1)*100)}%;background:${o>.6?'#2f7d4f':o>.3?'#c98a12':'#b8402a'}"></i></span>`;
  const w=wxOf(day()),k=WX[S.wx[day()]||'sun'];
  modal(`${loc==='lower'?'🚤 Lower Kenai':'🛶 Upper Kenai float'}: what are you after?`,
    `<p style="font-size:13px;color:var(--mute)">${k.ic} ${w.temp}°F, wind ${w.dir} ${w.wind} kt · river ${waterTxt(w)}${loc==='lower'?' · one unbaited, single-hook lure (EO)':' · rainbows catch-and-release'}</p>`,
    list.map(sp=>{const S_=SPECIES[sp],o=avgOdds(sp,loc,t,120);
      const shut=S_.closed&&kingRule()!=='open';return {l:`${S_.ic} ${S_.n}${S_.closed?` (${{closed:'closed',cr:'catch-and-release',open:'open'}[kingRule()]})`:''}`,s:shut?`You can’t target kings this year. ${S_.note}`:`${bar(o)}${o>.75?'Hot':o>.45?'Fair':o>.2?'Slow':S_.cr?(S_.loc[loc]<.5?'Few in this stretch: better on the upper river':'Tough today'):'Hardly any yet'}. ${S_.note}`,dis:shut,fn:()=>boatHours(sp,max,illegal)}}).concat([{l:'Never mind',fn:()=>{}}]));
}
function boatHours(sp,max,illegal){
  const opts=[2,4,6].filter(h=>h*60<=max);
  modal(`${SPECIES[sp].ic} How long?`,`<p>${S.loc==='lower'?`About ${bn('soloHour')} gallons an hour from your tank (${Math.round(S.fuel)} gal), plus the ${$(LAUNCH_FEE)} launch fee. Run dry and the Coast Guard tows you in.`:`Drift boat, no motor on this stretch. Shuttle back from Jim’s Landing: ${$(35)}.`} You’ll learn where fish are holding for your next trips.</p>`,
    opts.map(h=>({l:`${h} hours`,s:`Back at ${fmt(S.t+h*60+20)}.`,fn:()=>boatFish(sp,h,illegal)})).concat([{l:'Never mind',fn:()=>{}}]));
}
function boatFish(sp,h,illegal){
  const loc=S.loc,t0=S.t,S_=SPECIES[sp],cost=loc==='lower'?LAUNCH_FEE:35;
  spend(cost);const got=loc==='lower'?burnSolo(bn('soloHour')*h):1;const o=avgOdds(sp,loc,t0,h*60)*got;if(got<1)h=Math.max(1,Math.round(h*got));else pass(h*60+20);adj('energy',-4*h);adj('boat',loc==='lower'?-2:-1);
  S.skill+=2;if(loc==='lower')S.scout=day();else{S.scoutAt=S.scoutAt||{};S.scoutAt[loc]=day()}S.solo[day()]=(S.solo[day()]||0)+1;
  const lines=[],rnd=()=>.6+Math.random()*.8;
  let n=Math.round(o*S_.rate*h*rnd());
  if(sp==='king'){n=Math.min(1,n);if(n){addFish(1);S.stats.legalKings=(S.stats.legalKings||0)+1;lines.push('👑 A legal king, recorded on your harvest record. Kings are open this year.')}else lines.push('👑 No king today. They’re the fish of ten thousand casts.')}
  else if(S_.keep){const lim=S_.lim(),room=sp==='halibut'?lim:Math.max(0,lim);n=Math.min(n,room);if(n>=lim)lines.push(`🎯 Limit: ${lim}. Bag limits are per day, so you reel up and run home.`);
    if(n){n=addFish(n);lines.push(`🧊 ${n} ${S_.n.toLowerCase()} for the freezer, every one hooked in the mouth.`)}else lines.push(`😶 ${h} hours and no ${S_.n.toLowerCase()} kept. ${o<.3?'The run isn’t here yet.':'Some days are like that.'}`)}
  else{lines.push(n?`${S_.ic} ${n} ${S_.n.toLowerCase()} to hand, photographed wet and released.`:`${S_.ic} Nothing to hand. Pretty river, though.`)}
  // incidental king hookups (closed: release in the water)
  const kings=sp!=='king'&&kingRule()!=='open'&&loc==='lower'&&Math.random()<avgOdds('king',loc,t0,h*60)*.25*h?1:0;
  if(kings){S.stats.kings++;lines.push('👑 A bright king smashes your lure. Kings are closed: you slip the hook without lifting it from the water and watch it swim off.')}
  // what you learned
  const best=Object.keys(SPECIES).filter(k=>SPECIES[k].loc[loc]&&!SPECIES[k].closed).map(k=>[k,avgOdds(k,loc,(day()+1)*1440+360,360)]).sort((a,b)=>b[1]-a[1])[0];
  if(best) lines.push(`🔭 Scouting note: tomorrow morning looks best for ${SPECIES[best[0]].n.toLowerCase()} here. Your next trip gets a boost.`);
  if(illegal) lines.push('🚫 You fished from a guide vessel on a closed day.');
  say(`${loc==='lower'?'🚤':'🛶'} ${h} hours on the ${loc==='lower'?'lower Kenai':'upper Kenai'}. `+lines.join(' '));
  sfx(n?'good':'info');
}

// ---- 🐟 Fish tab: conditions, tides, odds by place, run timing ----
function fishView(){
  const d=day();S.look=d;const w=wxOf(d),k=WX[S.wx[d]||'sun'],tt=tideTable(d);
  const row=(a,b)=>`<div class="kv" style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line);font-size:14px"><span>${a}</span><b style="text-align:right">${b}</b></div>`;
  let h=`<div class="sect">Today · ${dlong(d)}</div>`+row('Weather',`${k.ic} ${k.n}, ${w.temp}°F`)+row('Wind',`${w.dir} ${w.wind} kt${w.wind>18?' · small-craft advisory on Cook Inlet':''}`)+
    row('Rain',w.rain?`${w.rain} in`:'none')+row('Kenai River',waterTxt(w)+(w.level>.75?' · milky, fast':''))+row('Tide at the mouth now',tideNow())+
    row('Tides today',tt.map(x=>`${x.hi?'▲':'▼'} ${fmt(x.m)} ${x.h.toFixed(1)}′`).join(' · '));
  const places=[['lower','🚤 Lower Kenai'],['cooper','🏔️ Upper Kenai'],['kbeach','🥅 Kenai mouth (dipnet)'],['homer','⚓ Kachemak Bay']];
  h+=`<div class="sect">Odds right now</div>`;
  places.forEach(([loc,n])=>{const sp=Object.keys(SPECIES).filter(x=>SPECIES[x].loc[loc]);
    h+=`<div class="todo"><span class="ck">${n.split(' ')[0]}</span><div style="flex:1"><b>${n.slice(n.indexOf(' ')+1)}</b>${sp.map(x=>{const o=fishOdds(x,loc);return `<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--mute);margin-top:3px"><span style="width:118px">${SPECIES[x].ic} ${SPECIES[x].n}</span><span style="flex:1;height:7px;background:var(--line);border-radius:4px"><i style="display:block;height:7px;border-radius:4px;width:${Math.round(clamp(o,0,1)*100)}%;background:${SPECIES[x].closed&&kingRule()!=='open'?'#9aa':o>.6?'#2f7d4f':o>.3?'#c98a12':'#b8402a'}"></i></span></div>`}).join('')}</div></div>`});
  h+=`<div class="sect">Where to fish today</div><div class="rules" style="margin:0 0 8px;font-size:12.5px">${spotsToday(d).map(ty=>{const T=TRIPS[ty];return `${T.ic} <b>${T.n}</b>${scoutedFor(ty,d)?' (you scouted it: spot buttons show the exact read)':''}<br>${SPOTS[ty].map((sp,i)=>{const f=spotFit(ty,i,d,false);return f?`&nbsp;${f.f>=.15?'🟢':f.f>-.15?'🟡':'🔴'} ${sp.l.replace(/ at first light$/,'')}: <b>${spotWord(f.f)}</b>${f.why?`, ${f.why}`:''}`:''}).filter(Boolean).join('<br>')}`}).join('<br>')}<br><span style="color:var(--mute)">A read from today’s water, wind, run and tide. Scouting the river adds what the fish are doing right now.</span></div>`;
  h+=`<div class="sect">Run timing on the Kenai · ${yearOf(d)}</div><div class="rules" style="margin:0 0 8px">📣 ${REG().fc} ${evenYear(d)?'Even year: pinks coming.':'Odd year: few pinks.'}</div>${runChart(d)}<div class="rules" style="font-size:12.5px">${['sockeye','coho','pink','king','trout'].map(x=>`${SPECIES[x].ic} <b>${SPECIES[x].n}</b>: ${SPECIES[x].note}`).join('<br>')}<br>⏱️ Reds bite best at first light and in the long July evenings; at the mouth they ride the incoming tide. Halibut bite at slack water. Rain and glacial melt raise the river; rising, dirty water scatters the reds.<br><span style="color:var(--mute)">A simplified model of typical run timing, not a forecast.</span></div>`;
  return h;
}
function runChart(d){
  const x0=166,x1=258,W=440,H=130,X=x=>20+(x-x0)/(x1-x0)*(W-30),Y=v=>H-18-v*(H-34);
  const series=[['sockeye','#c0392b',x=>runCurve('sockeye',x,d)/1.4],['coho','#2c6e9e',x=>runCurve('coho',x,d)/1.4],['pink','#d36ba6',x=>runCurve('pink',x,d)],['king','#7a7a7a',x=>runCurve('king',x,d)/.35*.4]],w0=doyOf(seasonFirst(seasonOf(d)));
  const path=f=>{let p='';for(let x=x0;x<=x1;x+=2)p+=(p?'L':'M')+X(x).toFixed(1)+' '+Y(clamp(f(x),0,1)).toFixed(1);return p};
  const months=[[166,'Jun 15'],[182,'Jul 1'],[213,'Aug 1'],[244,'Sep 1']];
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;background:#fff;border:1px solid var(--line);border-radius:10px" role="img" aria-label="Run timing chart">
    <rect x="${X(w0)}" y="8" width="${X(w0+13)-X(w0)}" height="${H-26}" fill="#1f5d63" opacity=".08"/><text x="${X(w0+6.5)}" y="18" text-anchor="middle" font-size="9" fill="#1f5d63" font-family="DM Sans">your 2 weeks · ${yearOf(d)}</text>
    <line x1="${X(doyOf(d))}" x2="${X(doyOf(d))}" y1="8" y2="${H-18}" stroke="#e3642e" stroke-width="2"/>
    ${months.map(([x,l])=>`<line x1="${X(x)}" x2="${X(x)}" y1="${H-18}" y2="${H-14}" stroke="#999"/><text x="${X(x)}" y="${H-4}" text-anchor="middle" font-size="9" fill="#6b7478" font-family="DM Sans">${l}</text>`).join('')}
    <line x1="20" x2="${W-10}" y1="${H-18}" y2="${H-18}" stroke="#ccc"/>
    ${series.map(([n,c,f])=>`<path d="${path(f)}" fill="none" stroke="${c}" stroke-width="2"${n==='king'?' stroke-dasharray="4 3"':''}/>`).join('')}
  </svg><div style="display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11.5px;color:var(--mute);margin:6px 2px 0">${series.map(([n,c])=>`<span><i style="display:inline-block;width:12px;height:3px;background:${c};vertical-align:middle;margin-right:4px"></i>${SPECIES[n].n}</span>`).join('')}<span><i style="display:inline-block;width:2px;height:10px;background:#e3642e;vertical-align:middle;margin-right:4px"></i>today</span></div>`;
}
EXTRA_TABS.splice(1,0,{k:'fish',ic:'🐟',l:'Fish',view:()=>fishView()});
