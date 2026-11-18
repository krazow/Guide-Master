// ============================================================
//  GUIDE MASTER, part 12 (1.14.0): more of the summer.
//  A season is still two played weeks (14 day indexes, so careers keep their length), but from the second summer on you pick
//  WHICH two weeks of the summer you guide yourself: June kings on the lower river, the two July peak weeks (the default, and
//  season 1 always), August silvers or September rainbows on the upper river. Homer halibut runs all summer. The weeks you don't
//  play are still settled in the off-season by restOfSeason() (25-fuel.js), scaled by restWeeksX() so the summer's total doesn't
//  jump with the pick: a quieter week played means more of the busy summer is booked off your name.
//
//  Everything that knows the calendar follows the played week's real date: dateOf() (24-career.js) asks weekStartUTC() here;
//  the Sunday/Monday guide-boat closure and the 6 PM rule run May 1–Jul 31, the no-bait rule Jun 20–Aug 15 below Skilak,
//  the closed charter-halibut days early June to late August, dipnetting Jul 10–31; daylight and weather follow the month.
//
//  Hooks, so the trip engine (22-trips.js) stays as it is: weekTripStart(b,t) and weekCatch(b,t,q,fishers) are called from
//  tripStart/tripEnd; rollDay, rollWeather, addBooking, startSeason, newState and onNight are wrapped below.
//  Simplified, plausible Kenai facts: early-run kings peak in the river mid to late June (and have been closed or restricted in
//  recent years); coho peak mid-August; upper-river rainbows (open from Jun 11) feed on salmon eggs and flesh into the fall.
// ============================================================

// ---- the weeks ----
function mondayNear(y,m,dd){const t=Date.UTC(y,m,dd),w=new Date(t).getUTCDay();let off=(1-w+7)%7;if(off>3)off-=7;return t+off*864e5}
// at: [month (0-based), day] the week's Monday is nearest to. w: how busy the week is next to a July week (1), for restWeeksX().
// book: booking odds on the week's weekdays next to July's. main(d): the weekday trip; second: the afternoon trip on the same day.
const WEEKS={
  june:{ic:'👑',n:'June: early kings',at:[5,15],w:.8,book:1.1,main:()=>kingRule()==='closed'?'trout':'king',second:null,
    d:()=>kingRule()==='closed'?`Kenai kings are closed in ${REG().year}, so it’s upper-river rainbows (open from Jun 11) and Homer halibut. Long, light days.`:`Early-run kings on the lower river (${kingRule()==='cr'?'catch-and-release only':'open, 1 a day'}), upper-river rainbows (open from Jun 11) and Homer halibut. Long, light days and high, cold water.`},
  jul1:{ic:'🐟',n:'July peak, week 1',w:1,main:()=>'reds',second:null,
    d:()=>'The late sockeye run builds: sockeye trips, trout floats, Homer halibut and the dipnet beach. The busiest water of the year.'},
  jul2:{ic:'🐟',n:'July peak, week 2',w:1,main:()=>'reds',second:'silver',
    d:()=>'The late run peaks and the first silvers show: sockeye in the morning, silvers in the afternoon.'},
  aug:{ic:'🎣',n:'August: silvers',at:[7,17],w:.8,book:1.15,main:()=>'silver',second:null,
    d:()=>'Coho on the lower river (bait is legal again after Aug 15, and guide boats fish Sundays and Mondays), rainbows fattening behind the spawning reds, Homer halibut.'},
  sep:{ic:'🍂',n:'September: fall rainbows',at:[8,8],w:.75,book:1.1,main:d=>(((d%7)+7)%7)%2?'trout':'silver',second:null,
    d:()=>'Big upper-river rainbows on the egg and flesh bite, the last silvers down low and halibut before the charters haul out. Short days and frosty mornings.'},
};
const WEEK_ORDER=['june','jul1','jul2','aug','sep'],WEEK_DEF=['jul1','jul2'];
const WEEK_N={king:[2,3,4,4],trout:[2,3,3],silver:[2,3,4,4]};       // party sizes for each week's booked trips (reds keep their own)
function weekStartUTC(y,id){if(id==='jul2')return seasonStartUTC(y)+7*864e5;const W=WEEKS[id];return W&&W.at?mondayNear(y,W.at[0],W.at[1]):seasonStartUTC(y)}
// the two weeks of season s (index): a valid pick in calendar order, or the two July weeks
function weeksOf(s){const w=typeof S!=='undefined'&&S&&S.weeks&&S.weeks[s];return Array.isArray(w)&&w.length===2&&WEEKS[w[0]]&&WEEKS[w[1]]&&WEEK_ORDER.indexOf(w[0])<WEEK_ORDER.indexOf(w[1])?w:WEEK_DEF}
const weekIdOf=d=>weeksOf(seasonOf(d))[sday(d)<7?0:1];
const weekOf=d=>WEEKS[weekIdOf(d)];
const weekGap=s=>{const w=weeksOf(s);return !(w[0]==='jul1'&&w[1]==='jul2')};
const isJulyPick=s=>!weekGap(s);
// calendar rules by the played day's date (month*100+day: 715 is Jul 15)
const mdOf=d=>{const x=dateOf(d);return (x.getUTCMonth()+1)*100+x.getUTCDate()};
const guideDaysRule=d=>{const m=mdOf(d);return m>=501&&m<=731};        // Sun/Mon closure and 6 AM–6 PM for guide boats below Skilak
const baitRule=d=>{const m=mdOf(d);return m>=620&&m<=815};             // one unbaited single hook below Skilak (with kings restricted)
const halDaysRule=d=>mdOf(d)<=831;                                    // closed charter-halibut days: early June to late August
const dipOpen=d=>{const m=mdOf(d);return m>=710&&m<=731};             // the Kenai personal-use dipnet fishery
const lateSummer=()=>{try{return !!(S&&!S.winter&&mdOf(day())>=801)}catch(e){return false}};
const MON3=i=>MONTH[i].slice(0,3);
function weekRange(y,id){const t=weekStartUTC(y,id),a=new Date(t),b=new Date(t+6*864e5);return `${MON3(a.getUTCMonth())} ${a.getUTCDate()}–${a.getUTCMonth()===b.getUTCMonth()?'':MON3(b.getUTCMonth())+' '}${b.getUTCDate()}`}
function weeksLabel(s){const s0=s*SEASON;if(!weekGap(s))return `${dlabel(s0)}–${dlabel(s0+SEASON-1)}`;const y=2026+s;return weeksOf(s).map(id=>weekRange(y,id)).join(' & ')}
const weeksShort=s=>weeksOf(s).map(id=>`${WEEKS[id].ic} ${weekRange(2026+s,id)}`).join(' and ');

// ---- what each week books and offers ----
function weekReqTypes(d){
  const id=weekIdOf(d);
  if(id==='june') return kingRule()==='closed'?['trout','trout','trout','trout','halibut']:['king','king','king','trout','trout','halibut'];
  if(id==='aug') return ['silver','silver','silver','silver','trout','trout','halibut'];
  if(id==='sep') return ['trout','trout','trout','silver','silver','halibut'];
  return ['reds','reds','reds','reds','trout','trout','halibut'].concat(id==='jul2'&&sday(d)%7>=1?['silver','silver']:[]);
}
function weekAsstTypes(d){
  const id=weekIdOf(d);
  if(id==='june') return kingRule()==='closed'?['trout']:['king','trout'];
  if(id==='aug') return ['silver','trout'];
  if(id==='sep') return ['trout','silver'];
  return ['reds','reds','trout'].concat(id==='jul2'?['silver']:[]);
}
const WEEK_OK={june:['trout','halibut','king'],jul1:['reds','silver','trout','halibut'],jul2:['reds','silver','trout','halibut'],aug:['silver','trout','halibut'],sep:['silver','trout','halibut']};
// a trip type that this week's water doesn't offer, swapped for the one it does (a regular who fished sockeye comes back for silvers in August)
function weekType(type,d){
  const id=weekIdOf(d),ok=WEEK_OK[id].filter(t=>t!=='king'||kingRule()!=='closed');
  if(ok.includes(type)) return type;
  if(id==='june') return WEEKS.june.main(d);
  if(id==='aug'||id==='sep') return 'silver';
  return 'reds';
}
{const _addBooking=addBooking;
  addBooking=function(o){
    if(o&&TRIPS[o.type]&&typeof o.d==='number'){const t=weekType(o.type,o.d);
      if(t!==o.type){o=Object.assign({},o,{type:t,n:Math.min(o.n||2,TRIPS[t].max||6)});
        if(conflicts(o.d,t,!!o.asst)){const w0=o.d-sday(o.d)%7;let to=null;for(let d=w0+1;d<w0+6&&to==null;d++)if(d!==o.d&&!conflicts(d,t,!!o.asst)&&!illegalDay(t,d))to=d;
          if(to==null) return null;           // no room that week for the swapped trip: the party books elsewhere (callers that swap types ignore the result)
          o.d=to}}}
    return _addBooking(o)};}

// ---- June kings: a trip type of their own ----
TRIPS.king={n:'King trip',ic:'👑',loc:'lower',start:360,len:360,price:325,max:4,below:true,fuel:10,energy:28,
  long:'Lower Kenai early-run kings: back-troll plugs and back-bounce the deep slots for the fish of ten thousand casts.'};
BURN.king=10;
TRIP_SP.king=['king','lower',.27];TYPE_IX.king=5;
SPOTS.king=[
  {l:'Back-troll plugs through the deep slots below Beaver Creek',s:'Slow, deep water where early kings rest on their way up.',q:.06,h:0},
  {l:'Back-bounce the holes above the Sterling Highway bridge',s:'Big-fish water and a longer run: more fuel.',q:.08,h:0,fuel:3},
  {l:'Drift the soft edges near the Pillars',s:'Easy, pretty fishing, fewer fish.',q:.02,h:3}];
SPOT_FIT.king=[
  c=>[R(.6*c.run,'kings are moving through the slots','few kings in the river yet'),R(c.trend,'falling, clearing water settles them in the slots','rising, dirty water moves them on')],
  c=>[R(.6*c.lvl,'big water fills the deep holes','low water leaves the holes thin'),R(.3*c.calm,'a calm run upriver','wind on the long run')],
  c=>[R(.5*c.cloud,'overcast keeps them near the edges','bright sun pushes them deep'),R(.3*c.calm,'easy drifting','wind pushes the boat around')]];
POOL.king=['guide_fish','extra_rod','anchor','combat','motor','rescue','ownrods','bait'];
{const _tripFuel=tripFuel;tripFuel=b=>b&&b.type==='king'?{tank:'fuel',gal:bn('king'),where:'kenai'}:_tripFuel(b)}
{const k0=STEP.king;STEP.king=function(b,t){const v=k0.call(this,b,t);if(b&&b.type==='king'&&v&&v.b)v.b=v.b.replace('on a sockeye rig','on a back-trolled plug');return v}}
// the early run: a June bump on the king curve (nothing changes in July); rainbows fatten into September
{const k0=SPECIES.king.curve;SPECIES.king.curve=x=>k0(x)+(x<190?.3*gauss(x,170,9):0);
  SPECIES.king.note='Early run in June, late run peaks in late July. Open, catch-and-release or closed, year to year: see Regs.'}
{const t0=SPECIES.trout.curve;SPECIES.trout.curve=x=>t0(x)+(x>=213?.35*gauss(x,255,13):0);
  SPECIES.trout.note='Resident fish. Get better as the sockeye spawn and the bead bite starts, and best of all in September.'}
// silvers after July: no longer "early"
{const T=TRIPS.silver,n0=T.n,l0=T.long;
  Object.defineProperty(T,'n',{get(){return lateSummer()?'Silver trip':n0},configurable:true,enumerable:true});
  Object.defineProperty(T,'long',{get(){return lateSummer()?'Lower Kenai coho: back-troll plugs and drift roe or spinners through the slots as the silvers pour in.':l0},configurable:true,enumerable:true})}

// trip-engine hooks
function weekTripStart(b,t){
  if(!guideDaysRule(b.d)) t.steps=t.steps.filter(k=>k!=='sixpm');      // the 6 AM–6 PM guide-boat hours end with July
  if(b.type==='king'&&!t.steps.includes('king')&&dilN('king')<DIL_MAX){const i=t.steps.indexOf('spot');t.steps.splice(i<0?t.steps.length:i+1,0,'king');dilUse('king')}
}
function weekCatch(b,t,q,fishers){
  if(b.type!=='king') return null;
  const r=Math.random,open=kingRule()==='open';let landed=0;
  for(let i=0;i<fishers;i++) if(r()<clamp(.1+.5*q,.05,.65)) landed++;
  const dol=Math.round(fishers*(.5+q*2)*(.7+r()*.6));
  b.kings=landed;
  if(open)S.stats.legalKings=(S.stats.legalKings||0)+landed;else S.stats.kings+=landed;
  let limits=0;if(open&&fishers&&landed===fishers){S.stats.limits++;t.happy+=5;limits=landed}
  const frac=clamp(.3*q+.7*Math.min(1,landed/Math.max(1,fishers)*1.6),0,1);
  return {fish:landed+dol,frac,limits,line:`${landed} king${landed===1?'':'s'} ${open?'landed and kept':'landed and released in the water'}${dol?`, ${dol} Dolly Varden released`:''}`};
}

// ---- the calendar on screen ----
function weekHead(d){if(sday(d)%7)return '';const W=weekOf(d);return `<div class="sect" style="margin-top:6px">${W.ic} ${W.n} · ${dlabel(d)}–${dlabel(d+6)}</div>`}
function weekTripsTxt(){const s=seasonOf(day());if(!weeksOf(s).includes('june')||kingRule()==='closed')return '';return `· 👑 kings ${$(Math.round(TRIPS.king.price*S.up.rate))}/angler (6 AM, lower river, 4 max, June) `}
function weekBoxes(d,X,H){
  const s=seasonOf(d),y=yearOf(d),box=(a,n,t)=>`<rect x="${X(a)}" y="8" width="${X(a+n)-X(a)}" height="${H-26}" fill="#1f5d63" opacity=".08"/><text x="${X(a+n/2)}" y="18" text-anchor="middle" font-size="9" fill="#1f5d63" font-family="DM Sans">${t}</text>`;
  if(!weekGap(s)) return box(doyOf(s*SEASON),13,`your 2 weeks · ${y}`);
  return [0,7].map((k,i)=>box(doyOf(s*SEASON+k),6,`week ${i+1}`)).join('');
}
function sunsetTxt(){const m=mdOf(day());return m<801?'The sun won’t fully set.':m<901?'It gets properly dark around eleven now.':'Dark by nine, and frost by morning.'}
// Regs tab: what this week's date means
function weekRegRows(){
  const d=day(),W=weekOf(d),x=[];
  x.push(guideDaysRule(d)?'Sundays and Mondays: no fishing from guide boats below Skilak, and only 6 AM–6 PM on other days (through Jul 31).':'After Jul 31: guide boats may fish below Skilak on Sundays and Mondays, and the 6 AM–6 PM hours no longer apply.');
  x.push(baitRule(d)?'Jun 20–Aug 15 below Skilak: one unbaited, single-hook lure while kings are restricted.':REG().king==='open'?'Bait allowed below Skilak this year.':'Outside Jun 20–Aug 15: bait and treble hooks legal below Skilak again.');
  if(!halDaysRule(d))x.push('Charter halibut: the closed retention days are over for the year.');
  x.push(dipOpen(d)?'Dipnetting at the mouth is open (Jul 10–31).':'The dipnet fishery is closed (it runs Jul 10–31).');
  return [[`📆 This week · ${W.ic} ${W.n}, ${weekRange(yearOf(d),weekIdOf(d))}`,x.join(' ')]];
}
// daylight in Soldotna by month: [sunrise, sunset] in minutes
{const sun0=SCENE.sun;Object.defineProperty(SCENE,'sun',{get(){try{if(!S||S.winter)return sun0;const m=mdOf(day());return m<701?[265,1420]:m<801?sun0:m<901?[380,1310]:[430,1250]}catch(e){return sun0}},configurable:true,enumerable:true})}
// weather by month: June a little cooler than July, August cooler, September cold and wetter (no extra random numbers: hz() is a hash)
{const _rollWeather=rollWeather;
  rollWeather=function(d){
    const m=mdOf(d);
    if(m>=901&&S.wx[d]==='sun'&&hz(d,9,1)<.45) S.wx[d]=hz(d,9,2)<.5?'rain':'cloud';
    _rollWeather(d);
    const w=S.wxd[d],off=m<701?-3:m<801?0:m<901?-4:-12;
    if(w&&off) w.temp+=off;
  };}
{const e=EV.find(x=>x.id==='midnight_sun');if(e){const c0=e.cond;e.cond=c=>(!c0||c0(c))&&mdOf(day())<816}}
{const e=EV.find(x=>x.id==='traffic');if(e){const c0=e.cond;e.cond=c=>(!c0||c0(c))&&dipOpen(day())}}

// ---- moving between the weeks ----
// the sonar's season count at the start of each week (late run; June counts the early run), scaled by the year's run
const WEEK_CUM={june:20000,jul1:650000,jul2:1400000,aug:2300000,sep:2450000};
const weekCum=d=>Math.round(WEEK_CUM[weekIdOf(d)]*REG().mult.sockeye);
function weekJump(d){
  const wks=Math.max(1,Math.round((dateOf(d)-dateOf(d-1))/864e5/7)),W=weekOf(d),l=[];
  S.cum=Math.max(S.cum||0,weekCum(d));S.water=.5;S.limit=3;S.eo=[];S.scout=-1;S.energy=Math.max(S.energy,90);
  if(S.food&&S.food.fri>0){S.food.fri=0;l.push('You clear out the fridge: nothing in there survived the weeks between.')}
  const line=`📆 <b>${wks} weeks on: ${dlong(d)}.</b> ${W.ic} ${W.n}. The guiding in between counts in the rest of the summer, settled in the off-season. ${W.d()}${l.length?' '+l.join(' '):''}`;
  say(line);digestLine(line);
}
{const _rollDay=rollDay;
  rollDay=function(d){
    const sd=sday(d);
    if(sd===7&&weekGap(seasonOf(d))) weekJump(d);
    else if(sd===0&&weekIdOf(d)!=='jul1') S.cum=weekCum(d);
    _rollDay(d);
  };}

// ---- the rest of the summer, scaled by the pick ----
// July weeks count 1, others WEEKS[id].w. The summer is worth 2×(1+REST_X) July weeks; you played a+b of them.
function restWeeksX(p){
  const s=((p&&p.year)||2026)-2026,w=weeksOf(s);if(!weekGap(s)) return 1;
  const a=WEEKS[w[0]].w+WEEKS[w[1]].w;return (2*(1+REST_X)-a)/(REST_X*a);
}

// ---- picking the weeks (the off-season summary) ----
let WPICK=null;
function weeksWinterOpt(s){return {l:`📆 Your weeks for ${2026+s}: ${weeksShort(s)}`,s:'Pick the two weeks of the summer you guide yourself: June kings, the July peak, August silvers or September rainbows. The rest of the summer is booked off your name either way.',fn:()=>weeksModal(s)}}
function weeksModal(s){
  if(!WPICK||WPICK.s!==s) WPICK={s,w:weeksOf(s).slice()};
  const sel=WPICK.w,y=2026+s;
  modal(`📆 Your two weeks · ${y}`,`<p>You guide two weeks of the summer yourself; the rest is booked off your reputation and settled in the off-season. A quieter week played means more of the busy summer is booked for you, so the year comes out about even. Pick the water you want to work.</p><p style="font-size:13px;color:var(--mute)">${REG().fc} Tap a week to choose it (two in all), then Done.</p>`,
    WEEK_ORDER.map(id=>{const W=WEEKS[id],on=sel.includes(id);return {l:`${on?'✅ <span class="sr-only">Chosen: </span>':'⬜ <span class="sr-only">Not chosen: </span>'}${W.ic} ${W.n} · ${weekRange(y,id)}`,s:W.d(),np:true,fn:()=>{
      const i=sel.indexOf(id);if(i>=0)sel.splice(i,1);else{if(sel.length>=2)sel.shift();sel.push(id)}setTimeout(()=>weeksModal(s),0)}}}).concat([
      {l:sel.length===2?`Done: ${WEEK_ORDER.filter(x=>sel.includes(x)).map(x=>WEEKS[x].n).join(' and ')}`:'Pick two weeks',dis:sel.length!==2,fn:()=>{weeksSet(s,sel);setTimeout(winterModal,0)}}]));
}
function weeksSet(s,w){S.weeks=S.weeks||{};S.weeks[s]=WEEK_ORDER.filter(x=>w.includes(x)).slice(0,2);WPICK=null;
  if(S.weeks[s].length!==2) delete S.weeks[s];
  if(S.goals&&S.goals.s===s&&!Object.keys(S.goals.met||{}).length) S.goals=null;   // goals are picked to fit the weeks: pick again
  say(`📆 ${2026+s}: you’ll guide ${weeksShort(s)}.`)}
window.weeksSet=weeksSet;
// last year's pick carries over to the next summer until you change it
{const _startSeason=startSeason;startSeason=function(s){if(S.weeks&&!S.weeks[s]&&S.weeks[s-1])S.weeks[s]=S.weeks[s-1].slice();return _startSeason(s)}}
// the season's first morning was rolled before the pick: once the bookings open, set its sonar count and weather to the week's month
{const _finishWinter=finishWinter;finishWinter=function(){const s=S.winter&&S.winter.s;_finishWinter.apply(this,arguments);
  if(s==null||!weekGap(s)) return;const d=s*SEASON,W=weekOf(d),m=mdOf(d),w=S.wxd[d],off=m<701?-3:m<801?0:m<901?-4:-12;
  if(weekIdOf(d)!=='jul1')S.cum=weekCum(d);if(w&&off)w.temp+=off;
  say(`📆 ${dlongY(d)}: your first week this year, ${W.ic} ${W.n}. ${W.d()}`)}}
{const _newState=newState;newState=function(){return Object.assign(_newState(),{weeks:{},goals:null,goalLog:[]})}}
TITLE.bullets[0]='Each season: two weeks of guiding, the July peak to begin with, and from your second summer June kings, August silvers or September rainbows if you like. Between seasons: bills, upgrades, new rules and new bookings.';
HELP.splice(2,0,['📆','Your weeks of the summer','Season 1 is the two-week July peak. From the second summer on, the off-season summary lets you pick <strong>which two weeks</strong> you guide yourself: <strong>June kings</strong> (or rainbows and halibut when kings are closed), either <strong>July peak</strong> week, <strong>August silvers</strong> or <strong>September rainbows</strong>. Dates, rules, runs, daylight and the trips on offer follow the week. The weeks you don’t play are booked off your name and settled in the off-season, more of them when you play a quieter week, so the year comes out about even.']);
const EVM=EV.find(x=>x.id==='mosquitoes');if(EVM){const c0=EVM.cond;EVM.cond=c=>(!c0||c0(c))&&mdOf(day())<901}
