// ============================================================
//  GUIDE MASTER, part 9: grow the business (the outfit).
//  From the third off-season on you can hire up to three guides and buy up to two more boats. Your guides take parties on days
//  you're booked (or that you hand them), and their trips run off-screen: the morning report says how each one went.
//
//  State: S.biz (bizBase()). Staff trips are bookings with b.asst=true and b.g=<guide id>, so the rest of the game treats them the
//  way it treats the assistant guide's trips (not on your to-do, never a no-show for you); the old assistant-guide upgrade
//  (24-career.js) keeps its own lane (b.asst without b.g) and works as before.
//
//  Hooks: this file wraps a few functions instead of editing them, and does nothing (and draws no random numbers) until you hire
//  someone or buy a boat, so a game without an outfit plays exactly as before:
//    conflicts()         a guide's lane and the boats he needs        makeRequest() / requestOpts()  calls for your guides
//    genSeasonBookings() July bookings for your guides                 asstSettle()   a staff trip resolves at night (onNight)
//    onMorning()/onNight() supervision, boat costs, a guide walking off   startSeason()  growth, morale, quitting, winter costs
//    restOfSeason()      the guides' share of June, August, September    endRows()      an end-screen row
//  Edited elsewhere (one line each): the winter planner's button (24-career.js), the Bookings line (20-world.js), schema 9 (21-story.js).
//  1.16.0 (on top of 1.13–1.15): staff trips follow the played weeks (staffTypes: June kings run on a sled, September rainbows), the party's
//  traits are met or missed by the guide's skill and reliability (staffFit), and each staff trip writes a review naming the guide
//  (staffReview). Those reviews live in S.biz.reviews, NOT S.reviews: your star rating, its milestones, goals and the trophy wall are about
//  the trips you guide yourself (the Outfit page shows each guide's stars). Staff stay off magazine, lodge and big-day bookings.
// ============================================================
const BIZ_UNLOCK=2;                                     // seasons played before you can grow (the third off-season)
const BIZ_REP=[55,65,75];                               // reputation needed for the 1st, 2nd and 3rd guide
const BIZ_MAX_BOATS=2;                                  // boats you can add to your sled and drift boat
const BIZ_BOATS={
  sled:{n:'Used 20-ft welded jet sled, 50 hp & trailer',ic:'🚤',cost:26000,win:1500,d:'A second boat for the lower river: two sockeye or silver parties at once.'},
  drift:{n:'New drift boat & trailer',ic:'🛶',cost:9500,win:600,d:'A second drift boat: two upper-river trout floats at once.'},
};
const BIZ_BOAT_NIGHT=20,BIZ_DEPREC=.12,BIZ_SELL=.85;   // per July night; value lost per winter; resale (a boat's winter bill, `win`: storage, insurance, registration, service)
const BIZ_GUIDE_WINTER=1900;                            // license renewals, insurance rider, workers' comp, drug-testing consortium
const BIZ_TRIP_COST=110;                                 // per staff trip: boat wear, tackle, client water and snacks, the shuttle
const BIZ_SUPERVISE=4;                                  // your energy per staff trip that day (calls, rigging, checking in)
const BIZ_DEMAND=[.5,.24,.08];                         // share of open July days the 1st, 2nd and 3rd guide fill at a good reputation
const BIZ_REQ_P=.35;
const BIZ_VIOL_K=2.2;                                  // how often a guide cuts a corner: BIZ_VIOL_K × (1 − reliability)² per trip                                    // chance a call is for one of your guides (when one is free)
const BIZ_REST=.9;                                     // a guide's June/August/September trips per July trip
const BIZ_RAISE=25,BIZ_SEVER=2;                         // a raise per trip; severance in trips' wages
const BIZ_ONBOARD=[['🪪 ADF&G sport fishing guide license & business-license rider',200],['🏞️ Kenai River Guide Academy & State Parks guide permit',350],['🧪 Drug-testing consortium enrollment',100],['⛑️ First aid/CPR card',95]];
const BIZ_USCG=['⚓ USCG OUPV (six-pack) course, exam, physical & TWIC card',1400];
const marketWage=sk=>Math.round(150+2.4*sk);             // what a guide of this skill expects per trip
// ---- state ----
function bizBase(){return {v:1,on:false,staff:[],boats:[],nid:1,pool:{s:-1,c:[]},past:[],tot:{trips:0,net:0,cites:0,hired:0},lines:[],reviews:[]}}
const _newState=newState;
newState=function(){return Object.assign(_newState(),{biz:bizBase()})};
const BZ=()=>{if(!S.biz||typeof S.biz!=='object')S.biz=bizBase();return fillDefaults(S.biz,bizBase())};
const bizOn=()=>!!(S&&S.biz&&S.biz.on);
const staffN=()=>S&&S.biz?S.biz.staff.length:0;
const bizActive=()=>!!(S&&S.biz&&(S.biz.staff.length||S.biz.boats.length));   // anything to run: until then nothing here draws a random number
const guideOf=id=>S.biz?S.biz.staff.find(g=>g.id===id):null;
const staffName=id=>{const g=guideOf(id);if(g)return g.name.split(' ')[0];const p=S.biz&&S.biz.past.find(x=>x.id===id);return p?p.name.split(' ')[0]:'a hired guide'};
const guideCap=()=>BIZ_REP.filter(r=>S.rep>=r).length;
// ---- boats and lanes ----
const boatKind=type=>type==='reds'||type==='silver'||type==='king'?'sled':type==='trout'?'drift':null;   // June kings go on a sled too
// 1.16.0: what a guide of yours can be booked for on day d: the played week's water (34-summer.js weekAsstTypes: July sockeye and trout,
// silvers in the second July week, June kings and rainbows, August silvers, September rainbows and silvers). Never halibut.
const staffTypes=d=>(typeof weekAsstTypes==='function'?weekAsstTypes(d):['reds','reds','trout']).filter(t=>t!=='halibut'&&TRIPS[t]);
const boatsOf=k=>(k==='sled'?1+(S.up&&S.up.asst?1:0):k==='drift'?1:0)+(S.biz?S.biz.boats.filter(b=>b.kind===k).length:0);
function overlaps(b,d,type){const T=TRIPS[type],a=[T.start,T.start+T.len],B=SLOT(b),gap=TRIPS[b.type].loc===T.loc?30:travelMins(TRIPS[b.type].loc,T.loc)+20;return b.d===d&&b.status==='booked'&&a[0]<B[1]+gap&&B[0]<a[1]+gap}
const laneBusy=(d,type,pred)=>S.book.some(b=>pred(b)&&overlaps(b,d,type));
// a boat of the right kind is free for a party of this type on day d (skip: a booking that is moving lanes and keeps its boat)
function boatFree(d,type,skip){const k=boatKind(type);if(!k)return false;
  const T=TRIPS[type],a=[T.start,T.start+T.len];
  return S.book.filter(b=>b!==skip&&b.d===d&&b.status==='booked'&&boatKind(b.type)===k&&a[0]<SLOT(b)[1]+30&&SLOT(b)[0]<a[1]+30).length<boatsOf(k)}
// the first of your guides who is free for this party (with a boat), or null
function staffLane(d,type,prefer,skip){
  if(!staffN()||!boatKind(type)||!boatFree(d,type,skip)) return null;
  const gs=S.biz.staff.slice().sort((x,y)=>(y.id===prefer)-(x.id===prefer));
  const g=gs.find(g=>!laneBusy(d,type,b=>b!==skip&&b.g===g.id));return g?g.id:null}
// lanes: falsy = you, true = the old assistant guide, a number = that hired guide
const _conflicts=conflicts;
conflicts=function(d,type,asst){
  if(typeof asst==='number') return laneBusy(d,type,b=>b.g===asst)||!boatFree(d,type);
  if(asst) return laneBusy(d,type,b=>b.asst&&b.g==null);
  return _conflicts(d,type,asst)||(bizActive()&&!!boatKind(type)&&!boatFree(d,type));   // your own boat may be out with a guide
};
// ---- the people ----
const BIZ_NAMES=['Jenna Kowalczyk','Marcus Hale','Dale “Skeeter” Hutchins','Rosa Alvarez','Tyler Nakamura','Ivy Petrov','Ben Okafor','Katie Swanson','Luke Demski','Hannah Moore','Eli Brandt','Sam Whitfield','Mia Fjelstad','Cody Pruitt','Nora Ahsoak','Joe Turner','Grace Lindqvist','Rob Haskins','Annie Castillo','Walt Jensen','Priya Raman','Gus Molina','Tess Harmon','Andy Kuzmin'];
const BIZ_KINDS={
  vet:  {sk:[66,82],rel:[.93,.97],pay:1.06,uscg:1,lines:['Twenty Julys on the Kenai. Doesn’t say much until the reds show up.','Ran drift boats on the upper river before you were born. Still the first one at the launch.','Former Coast Guard. Life jackets zipped before the motor starts.']},
  steady:{sk:[50,64],rel:[.9,.95],pay:1,uscg:.6,lines:['Grew up in Sterling. Knows every bank closure by heart.','Teaches high-school biology all winter. Clients love the sockeye life-cycle talk.','Quiet, careful, and the logbook is always done before dinner.']},
  hot:  {sk:[62,78],rel:[.72,.82],pay:.82,uscg:.7,lines:['Puts clients on fish like nobody else. Paperwork is “a winter thing.”','Has a big following online. Has a few stories the troopers tell, too.','Fast boat, fast talker, fast to cut a corner when the bite is on.']},
  green:{sk:[32,46],rel:[.84,.91],pay:.95,uscg:.2,lines:['Fresh out of the Guide Academy. Eager, early, and asks good questions.','Deckhanded in Homer two summers. Wants a river boat of their own someday.','Nervous on the radio, great with kids. Learns something every trip.']},
};
function bizRng(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296}}
// three applicants each off-season, from a generator seeded by the save (not Math.random: looking doesn't change your luck)
function bizApplicants(){
  const Z=BZ(),s=S.winter?S.winter.s:seasonOf(day());
  if(Z.pool.s===s) return Z.pool.c;
  const seed=s*7919+(S.nextId||1)*131+((S.name||'').length*17)+Math.round(Math.abs(S.cum||0)%9973),r=bizRng(seed),used=new Set(Z.staff.concat(Z.past).map(g=>g.name));
  const kinds=['vet','steady','hot','green'],c=[],take=a=>a[Math.floor(r()*a.length)];
  const order=[take(['steady','vet']),take(['hot','green']),take(kinds)];
  for(const k of order){const K=BIZ_KINDS[k],names=BIZ_NAMES.filter(n=>!used.has(n)&&!c.some(x=>x.name===n)),name=take(names.length?names:BIZ_NAMES);
    const sk=Math.round(K.sk[0]+r()*(K.sk[1]-K.sk[0])),rel=Math.round((K.rel[0]+r()*(K.rel[1]-K.rel[0]))*100)/100,wage=Math.round(marketWage(sk)*K.pay*(.95+r()*.1)/5)*5;
    c.push({name,kind:k,skill:sk,rel,wage,uscg:r()<K.uscg,line:take(K.lines)})}
  Z.pool={s,c};return c;
}
const onboardCost=a=>Math.round((BIZ_ONBOARD.reduce((t,x)=>t+x[1],0)+(a.uscg?0:BIZ_USCG[1]))*DF().cost);
const relWord=r=>r>=.93?'very reliable':r>=.88?'reliable':r>=.82?'mostly reliable':'careless with the rules';
const skillWord=k=>k>=75?'expert':k>=60?'skilled':k>=45?'capable':'green';
const moodWord=m=>m>=75?'happy':m>=55?'content':m>=40?'grumbling':m>=25?'unhappy':'ready to quit';
function hireWhy(a){
  if(!S.winter) return 'Hire in the off-season (licenses and the Guide Academy take the winter)';
  if(staffN()>=guideCap()) return staffN()>=3?'Three guides is the most you can run':`Guide ${staffN()+1} needs Rep ${BIZ_REP[staffN()]}`;
  if(S.money<onboardCost(a)) return 'Can’t afford the onboarding';
  return null}
function bizHire(i){
  const Z=BZ(),a=bizApplicants()[i];if(!a||hireWhy(a))return false;
  const c=onboardCost(a);money(-c);S.stats.spent+=c;
  const g=Object.assign({id:Z.nid++,hired:S.winter?S.winter.s:seasonOf(day()),seasons:0,mood:70,streak:0,last:-9,sn:bizLedger(),tot:{trips:0,net:0,cites:0}},a,{uscg:true});
  Z.staff.push(g);Z.pool.c=Z.pool.c.filter(x=>x!==a);Z.tot.hired++;
  sfx('good');say(`🧑‍🤝‍🧑 You hire <b>${g.name}</b> at ${$(g.wage)} a trip. Onboarding: ${$(c)} for ${a.uscg?'the guide license, Guide Academy, permit, drug testing and a first-aid card':'the guide license, Guide Academy, permit, drug testing, a first-aid card and a Coast Guard six-pack license'}.`);
  return true}
const bizLedger=()=>({trips:0,fares:0,wages:0,costs:0,net:0,cites:0,hap:0,stars:0});
// ---- what happens to their bookings when a guide leaves ----
function bizOrphans(id,notes){
  const out=[];
  S.book.filter(b=>b.g===id&&b.status==='booked'&&b.d>=day()).forEach(b=>{
    const g2=staffLane(b.d,b.type,null,b);
    if(g2!=null){b.g=g2;out.push(`${staffName(g2)} takes over the ${TRIPS[b.type].n.toLowerCase()} with the ${b.who} (${dlabel(b.d)}).`);return}
    b.asst=false;delete b.g;
    if(youFree(b)&&!illegalDay(b.type,b.d)){out.push(`You’ll run the ${TRIPS[b.type].n.toLowerCase()} with the ${b.who} yourself (${dlabel(b.d)}).`);return}
    b.status='cancelled';S.stats.cancelled++;adj('rep',-2);out.push(`Nobody can take the ${b.who} on ${dlabel(b.d)}: you call to cancel and refund their deposit.`)});
  out.forEach(l=>notes?notes.push('🧑‍🤝‍🧑 '+l):say('🧑‍🤝‍🧑 '+l));
}
function bizLeave(g,why){
  const Z=BZ();Z.staff=Z.staff.filter(x=>x!==g);
  Z.past.push({id:g.id,name:g.name,why,trips:g.tot.trips+g.sn.trips,net:g.tot.net+g.sn.net,cites:g.tot.cites+g.sn.cites});
}
function bizFire(id){
  const g=guideOf(id);if(!g)return false;
  const pay=Math.round(BIZ_SEVER*g.wage);money(-pay);S.stats.spent+=pay;
  bizLeave(g,'let go');say(`🧑‍🤝‍🧑 You let ${g.name} go, with ${$(pay)} of severance.`);bizOrphans(id);sfx('info');return true}
function bizRaise(id){const g=guideOf(id);if(!g)return false;g.wage+=BIZ_RAISE;g.mood=Math.min(100,g.mood+12);say(`🧑‍🤝‍🧑 ${g.name} gets a raise: ${$(g.wage)} a trip. “Appreciate it, boss.”`);sfx('good');return true}
// ---- boats ----
function boatWhy(k){
  if(!S.winter) return 'Boat dealers deal in the off-season';
  if(BZ().boats.length>=BIZ_MAX_BOATS) return 'Two extra boats is all the trailer space you have';
  if(S.money<BIZ_BOATS[k].cost) return 'Can’t afford it';
  return null}
function bizBuyBoat(k){
  if(!BIZ_BOATS[k]||boatWhy(k))return false;const Z=BZ(),B=BIZ_BOATS[k],c=B.cost;
  money(-c);S.stats.spent+=c;S.up.value+=c;Z.boats.push({id:Z.nid++,kind:k,val:c,bought:S.winter.s});
  sfx('good');say(`${B.ic} You buy a ${B.n.charAt(0).toLowerCase()+B.n.slice(1)} (${$(c)}). Registration, decals and the State Parks boat number come with it.`);return true}
function bizSellBoat(id){
  const Z=BZ(),b=Z.boats.find(x=>x.id===id);if(!b||!S.winter)return false;
  const p=Math.round(b.val*BIZ_SELL);money(p);S.up.value=Math.max(0,S.up.value-b.val);Z.boats=Z.boats.filter(x=>x!==b);
  say(`${BIZ_BOATS[b.kind].ic} You sell the ${b.kind==='sled'?'second jet sled':'extra drift boat'} for ${$(p)}.`);return true}
// ---- handing a party to a guide (and taking it back) ----
const canHand=b=>b&&b.status==='booked'&&!b.asst&&!b.arc&&!b.big&&!b.feat&&!b.lodge&&b.type!=='halibut'&&(b.d>day()||(b.d===day()&&tod()<TRIPS[b.type].start-60))&&!(S.trip&&S.trip.id===b.id);
function bizAssign(id,gid){
  const b=bk(id);if(!canHand(b)||!guideOf(gid))return false;
  if(laneBusy(b.d,b.type,x=>x!==b&&x.g===gid)||!boatFree(b.d,b.type,b)) return false;
  b.asst=true;b.g=gid;say(`🧑‍🤝‍🧑 ${staffName(gid)} will take the ${b.who} on their ${TRIPS[b.type].n.toLowerCase()}, ${dlong(b.d)}.`);return true}
function bizTakeBack(id){
  const b=bk(id);if(!b||b.g==null||b.status!=='booked'||b.d<day()||(b.d===day()&&tod()>=TRIPS[b.type].start-60))return false;
  if(!youFree(b)) return false;
  b.asst=false;delete b.g;
  say(`🛶 You’ll run the ${TRIPS[b.type].n.toLowerCase()} with the ${b.who} yourself after all.`);return true}
// you could run this party yourself: no trip of yours in the way, and a boat for it (the party keeps the boat it had)
const youFree=b=>!laneBusy(b.d,b.type,x=>x!==b&&!x.asst)&&(!boatKind(b.type)||boatFree(b.d,b.type,b))
window.bizAct=(k,a,b)=>{const f={hire:()=>bizHire(a),fire:()=>bizFire(a),raise:()=>bizRaise(a),boat:()=>bizBuyBoat(a),sell:()=>bizSellBoat(a),hand:()=>bizAssign(a,b),back:()=>bizTakeBack(a)}[k];if(f){f();sfx('tap');render()}};

// ---- July bookings and calls for your guides ----
const _genSeasonBookings=genSeasonBookings;
genSeasonBookings=function(s){
  const out=_genSeasonBookings(s);
  if(!staffN()) return out;
  const base=s*SEASON,r=Math.random,p0=clamp((.35+S.rep/200+(S.up.web===s?.15:0))*rateDemand()*DF().book*(typeof starBook==='function'?starBook():1),.12,.95);   // a rating under ★2.5 (39-stars.js) slows your guides' bookings too
  S.biz.staff.forEach((g,k)=>{const pk=p0*BIZ_DEMAND[Math.min(k,2)]*(.85+g.skill/400);
    for(let i=1;i<SEASON;i++){const d=base+i;if(r()>pk)continue;
      const types=staffTypes(d).filter(t=>!illegalDay(t,d)&&!laneBusy(d,t,b=>b.g===g.id)&&boatFree(d,t));
      if(!types.length)continue;const t=pick(types),p=pick(PARTIES);
      addBooking({d,type:t,n:t==='trout'?pick([2,3]):pick([2,3,4]),who:p.who,from:p.from,res:!!p.res,quirk:[],asst:true,g:g.id})}});
  return out;
};
const _makeRequest=makeRequest;
makeRequest=function(){            // a call for one of your guides comes on top of the usual one (it waits in the Bookings tab)
  const r=_makeRequest();
  if(staffN()&&!S.winter&&Math.random()<BIZ_REQ_P){const x=staffRequest();if(x)queueRequest(x,true)}
  return r;
};
function staffRequest(){
  const d0=day()+1,end=seasonFirst()+SEASON;if(d0>=end)return null;const span=Math.min(6,end-d0);
  for(let i=0;i<8;i++){const d=d0+Math.floor(Math.random()*span),type=pick(staffTypes(d));
    if(illegalDay(type,d))continue;const g=staffLane(d,type);if(g==null)continue;
    const p=pick(PARTIES),n=type==='trout'?pick([2,3]):pick([2,3,4]);
    return {kind:'trip',staff:true,g,asst:true,d,type,n,who:p.who,from:p.from,res:!!p.res,quirk:[]}}
  return null}
const _requestOpts=requestOpts;
requestOpts=function(r){
  if(!r||!r.staff) return _requestOpts(r);
  const T=TRIPS[r.type],g=staffLane(r.d,r.type,r.g),G=g!=null?guideOf(g):null,fare=payOf({type:r.type,n:r.n});
  const who=`The <b>${r.who}</b> (${r.from}${r.res?', Alaska residents':''})`;
  const body=`<p>${who} would like a <b>${T.ic} ${T.n}</b> on <b>${dlong(r.d)}</b> at ${fmt(T.start)} for <b>${r.n}</b>.</p><p style="font-size:13px;color:var(--mute)">🧑‍🤝‍🧑 ${G?`${G.name} is free then and would guide them: the fare is ${$(fare)}, ${G.name.split(' ')[0]} gets ${$(G.wage)} and the tips, and fuel, fees and wear come out of your end.`:'Every guide and boat you have is busy then.'}</p>`;
  return {body,opts:[
    {l:G?`Book it with ${G.name.split(' ')[0]} — ${$(fare)}`:'Nobody free to take it',dis:!G,fn:()=>{if(!G)return;const b=addBooking({d:r.d,type:r.type,n:r.n,who:r.who,from:r.from,res:r.res,quirk:r.quirk||[],asst:true,g:G.id});sfx('good');say(`📅 Booked for ${G.name.split(' ')[0]}: ${T.ic} ${T.n}, ${dlong(b.d)} at ${fmt(T.start)}, the ${b.who} (${b.n}).`)}},
    {l:'Decline politely',fn:()=>say('📞 You pass on that one.')}]};
};

// ---- a staff trip, settled at night ----
const BIZ_VIOL={
  reds:[{what:'six people aboard a guide boat below Skilak in July',fine:300,jul:1},{what:'a snagged sockeye kept in the cooler',fine:250},{what:'the guide fishing alongside clients',fine:300},{what:'logbook entries not filled out',fine:250,minor:true},{what:'a client fishing without a license',fine:200,minor:true}],
  silver:[{what:'fishing below Skilak after 6 PM',fine:300,jul:1},{what:'the guide fishing alongside clients',fine:300},{what:'logbook entries not filled out',fine:250,minor:true}],
  king:[{what:'a king lifted out of the water on a catch-and-release day',fine:300,cr:1},{what:'the guide fishing alongside clients',fine:300},{what:'logbook entries not filled out',fine:250,minor:true}],
  trout:[{what:'bait on the fly-only water at the Russian River confluence',fine:250},{what:'a rainbow trout lifted out of the water for photos',fine:150,minor:true},{what:'logbook entries not filled out',fine:250,minor:true}],
};
const _asstSettle=asstSettle;
asstSettle=function(b,notes){
  if(b.g==null) return _asstSettle(b,notes);
  let g=guideOf(b.g);
  if(!g){const g2=staffLane(b.d,b.type,null,b);g=g2!=null?guideOf(g2):null;if(g)b.g=g.id}
  if(!g){b.status='cancelled';S.stats.cancelled++;adj('rep',-3);notes.push(`🧑‍🤝‍🧑 Nobody was there to guide the ${b.who}. You refund them in full.`);return}
  bizSettle(b,g,notes);
};
function bizSettle(b,g,notes){
  const T=TRIPS[b.type],r=Math.random,fare=payOf(b),first=g.name.split(' ')[0],sn=g.sn;
  const busy=S.book.some(x=>x.d===b.d&&!x.asst&&x.status==='done'),tired=g.streak>=3;
  let happy=50+g.skill*.35+(r()-.5)*24+DF().mood+(b.quirk.includes('promised')?-15:0)-(tired?6:0),refund=0,repair=0,line='';
  // a careless guide cuts corners far more often than a reliable one ((1−rel)², so 0.77 → 12% of trips, 0.93 → 1%); lateness and mishaps go with (1−rel)
  const sup=(busy?1:.7)*(tired?1.4:1),pV=BIZ_VIOL_K*(1-g.rel)**2*sup,pO=(1-g.rel)*.9*sup,u=r();
  if(u<pV+pO){const k=u<pV?0:r()*.6+.4;
    if(k<.4){const v=pick((BIZ_VIOL[b.type]||BIZ_VIOL.reds).filter(v=>(!v.jul||guideDaysRule(b.d))&&(!v.cr||kingRule()!=='open')));
      if(r()<.5*DF().enforce){
        const st=window.showTile;window.showTile=()=>{};const c0=S.stats.citesTotal||0;
        try{cite(v.what,v.fine,!!v.minor,notes,`${pick(COPS)} checking ${first}’s boat`)}finally{window.showTile=st}
        if((S.stats.citesTotal||0)>c0){sn.cites++;S.biz.tot.cites++;S.stats.viol++;S.stats.staffCites=(S.stats.staffCites||0)+1;
          notes.push(`⚖️ It’s your business on the decal and the permit, so ${first}’s citation goes on <b>your</b> record.`);g.mood-=5}
        else line=` ${first} got a warning, on your boat’s record.`;
      }else if(r()<.3){S.wom=(S.wom||0)-2;line=` Another guide saw ${first} cutting a corner (${v.what}) and it’s all over the river.`}
    }else if(k<.75){happy-=18;refund=Math.round(fare*.25);line=` ${first} was late to the launch: the clients waited an hour and you refunded ${$(refund)}.`}
    else{happy-=12;repair=Math.round((250+r()*350)*DF().cost);line=` A rock in the riffle took a bite out of the ${boatKind(b.type)==='drift'?'drift boat':'jet unit'}: ${$(repair)} to fix.`}
  }
  const lim=b.type==='reds'?S.limit:b.type==='silver'?2:b.type==='king'?1:0,catchF=clamp(.35+g.skill/220+(r()-.5)*.3,.1,1);
  const fish=b.type==='trout'?Math.round(b.n*(3+catchF*8)):b.type==='king'?Math.round(b.n*catchF*.45):Math.round(b.n*lim*catchF);
  const fit=staffFit(b,g,catchF,fish);happy+=fit.h;
  happy=clamp(Math.round(happy),5,100);
  const fuel=T.fuel?Math.round(bn(b.type)*fuelPrice('kenai')):0,costs=fuel+(T.loc==='lower'?LAUNCH_FEE:0)+Math.round(BIZ_TRIP_COST*DF().cost);
  const net=Math.round(fare-refund-g.wage-costs-repair);
  money(net);S.stats.spent+=g.wage+costs+repair;
  adj('rep',happy>=80?1:happy<45?-3:0);
  const st=S.stats;st.hapSum=(st.hapSum||0)+clamp(happy-DF().mood+RATE_MOOD*rateSteps()*.7,0,110);st.hapN=(st.hapN||0)+1;   // your guides' days are part of how the season went
  st.staffTrips=(st.staffTrips||0)+1;st.staffNet=(st.staffNet||0)+net;st.staffFares=(st.staffFares||0)+fare-refund;
  sn.trips++;sn.fares+=fare-refund;sn.wages+=g.wage;sn.costs+=costs+repair;sn.net+=net;sn.hap+=happy;S.biz.tot.trips++;S.biz.tot.net+=net;
  g.streak=g.last===b.d-1||g.last===b.d?g.streak+(g.last===b.d?0:1):1;g.last=b.d;if(tired)g.mood-=3;
  const rv=staffReview(b,g,happy,fish,fit);
  b.status='done';b.out={happy,fish,line:`run by ${first}`,fare,refund,net,g:g.id,stars:rv.stars};
  const mood=happy>=80?'thrilled':happy>=65?'happy':happy>=45?'so-so':'unhappy';
  notes.push(`🧑‍🤝‍🧑 <b>${first}</b>’s ${T.ic} ${T.n.toLowerCase()} with the ${b.who}: ${fish} ${b.type==='trout'?'fish to the net':b.type==='king'?(kingRule()==='open'?`king${fish===1?'':'s'} kept`:`king${fish===1?'':'s'} released`):'fish in the box'}, clients ${mood}.${line} After ${first}’s ${$(g.wage)}, fuel, fees and wear: <b>${net<0?'−':''}${$(Math.abs(net))}</b>. <span aria-label="${rv.stars} of 5 stars">${'★'.repeat(rv.stars)}${'☆'.repeat(5-rv.stars)}</span> <i>“${rv.text}”</i>`);
}
// 1.16.0: a staff trip uses the 1.13 party model where it is cheap. Each trait the party came for is met (or not) by the guide's skill,
// reliability and the day's catch, without beats: v in −1..1 per trait, worth GOAL_H happiness like a trip of your own.
function staffFit(b,g,catchF,fish){
  const out={h:0,good:[],bad:[]},sk=(g.skill-55)/40,rel=(g.rel-.86)*8,H=typeof GOAL_H==='number'?GOAL_H:9;
  for(const k of b.tr||[]){let v=0;
    if(k==='meat') v=(catchF-.6)*2.5;
    else if(k==='trophy') v=sk*.8+(b.type==='king'&&fish?.4:-.2);
    else if(k==='kids') v=.2+rel*.4+(b.type==='trout'?.2:0)-(catchF<.45?.4:0);
    else if(k==='photo') v=.1+(b.type==='trout'||b.type==='king'?.3:0)+sk*.2;
    else if(k==='fly') v=b.type==='trout'||b.type==='silver'?sk*.6+.1:-.4;
    else if(k==='first') v=rel*.5+(g.kind==='green'||g.kind==='steady'?.3:0)-(g.kind==='hot'?.3:0);
    v=clamp(v,-1.2,1.2);out.h+=v*H*.8;if(v>=.25)out.good.push(k);else if(v<=-.25)out.bad.push(k);
  }
  return out;
}
// The party's review names your guide, not you ("Ask for Jenna"). Kept in S.biz.reviews, NOT in S.reviews: your star rating (39-stars.js),
// its milestones, the lodge, goals and the trophy wall are about the trips you guide yourself. The Outfit page shows each guide's stars.
function staffReview(b,g,happy,fish,fit){
  const first=g.name.split(' ')[0],st=starsOf(happy),parts=[pick(REV_OPEN[st])];
  fit.good.slice(0,1).forEach(k=>REV_T[k]&&parts.push(pick(REV_T[k][0])));
  fit.bad.slice(0,1).forEach(k=>REV_T[k]&&parts.push(pick(REV_T[k][1])));
  if(parts.length<3) parts.push(b.type==='trout'?(fish?`We caught and released ${fish} trout.`:'Not a single trout.'):b.type==='king'?(fish?`${numW(fish)} king${fish>1?'s':''} to the boat.`:'Not a king all morning.'):fish?`We took home ${fish} fish.`:'We didn’t catch a thing.');
  if(st>=4) parts.push(`Ask for ${first}.`);
  const text=parts.join(' ').replace(/Captain \{\{name\}\}|\{\{name\}\}/g,first),rec={day:b.d,who:b.who,type:b.type,stars:st,text,g:g.id,guide:first};
  const Z=BZ();(Z.reviews=Z.reviews||[]).push(rec);if(Z.reviews.length>60)Z.reviews.splice(0,Z.reviews.length-60);
  g.sn.stars=(g.sn.stars||0)+st;
  return rec;
}
// ---- the day around it ----
const _onMorning=onMorning;
onMorning=function(d){
  _onMorning(d);
  if(!bizActive()||S.winter) return;
  const n=S.book.filter(b=>b.d===d&&b.g!=null&&b.status==='booked').length;
  if(n){adj('energy',-BIZ_SUPERVISE*n);say(`🧑‍🤝‍🧑 Your guides have ${n} part${n>1?'ies':'y'} out today: ${S.book.filter(b=>b.d===d&&b.g!=null&&b.status==='booked').map(b=>`${staffName(b.g)} with the ${b.who} (${TRIPS[b.type].ic} ${fmt(TRIPS[b.type].start)})`).join(', ')}. A few calls and some rigging first: energy −${BIZ_SUPERVISE*n}.`)}
};
const _onNight=onNight;
onNight=function(where,notes,d){
  _onNight(where,notes,d);
  if(!bizActive()) return;
  const nb=S.biz.boats.length;
  if(nb){const c=Math.round(BIZ_BOAT_NIGHT*nb*DF().cost);money(-c);S.stats.spent+=c;S.biz.boatNight=(S.biz.boatNight||0)+c}
  // a guide who has had enough can walk off mid-season
  S.biz.staff.slice().forEach(g=>{if(g.mood<20&&Math.random()<.25){bizLeave(g,'quit');notes.push(`🧑‍🤝‍🧑 <b>${g.name}</b> quits: “I’m done. Find somebody else.”`);bizOrphans(g.id,notes)}});
};
// ---- the off-season: growth, morale, quitting, winter costs ----
const _startSeason=startSeason;
startSeason=function(s){
  _startSeason(s);
  const Z=BZ(),lines=[];
  if(!Z.on&&S.seasons.length>=BIZ_UNLOCK){Z.on=true;lines.push('🧑‍🤝‍🧑 <b>New: grow the business.</b> You can hire guides and add boats this winter, if you want to. Look in <b>Your outfit</b> below or the outfit view on the 📅 Bookings tab.')}
  Z.staff.slice().forEach(g=>{
    const t=g.sn.trips,mk=marketWage(g.skill),ratio=g.wage/mk;
    g.mood+=ratio>=1?8:-Math.round((1-ratio)*70);
    if(t>10)g.mood-=(t-10)*3;if(t<2)g.mood-=6;
    g.mood=clamp(Math.round(g.mood),0,100);
    const grow=Math.min(9,3+Math.round(t*.4));g.skill=Math.min(95,g.skill+grow);if(t>=4)g.rel=Math.min(.98,Math.round((g.rel+.01)*100)/100);
    g.seasons++;g.tot.trips+=t;g.tot.net+=g.sn.net;g.tot.cites+=g.sn.cites;(g.hist=g.hist||[]).push({s:s-1,trips:t,net:g.sn.net});g.sn=bizLedger();g.streak=0;
    const want=marketWage(g.skill);
    if(g.mood<35&&Math.random()<.45+(35-g.mood)/50){bizLeave(g,'quit');lines.push(`🧑‍🤝‍🧑 <b>${g.name}</b> won’t be back: ${ratio<.95?`another outfit offered ${$(want)} a trip`:'too many trips, too few days off'}.`);return}
    lines.push(`🧑‍🤝‍🧑 ${g.name}: ${t} trips last season, skill now ${g.skill}${grow?` (+${grow})`:''}, ${moodWord(g.mood)}${g.wage<want?`; a guide this good gets about ${$(want)} a trip now`:''}.`)});
  let bill=0;
  if(Z.staff.length) bill+=Math.round(BIZ_GUIDE_WINTER*DF().cost)*Z.staff.length;
  Z.boats.forEach(b=>{bill+=Math.round(BIZ_BOATS[b.kind].win*DF().cost);const drop=Math.round(b.val*BIZ_DEPREC);b.val-=drop;S.up.value=Math.max(0,S.up.value-drop)});
  if(bill){money(-bill);S.stats.spent+=bill;lines.push(`🧑‍🤝‍🧑 Outfit winter bills <b>${$(bill)}</b>: ${Z.staff.length?`${Z.staff.length} guide${Z.staff.length>1?'s’':'’s'} license renewals, insurance and drug testing`:''}${Z.staff.length&&Z.boats.length?'; ':''}${Z.boats.length?`storage, insurance and service for ${Z.boats.length} extra boat${Z.boats.length>1?'s':''}`:''}.`)}
  Z.lines=lines.slice();
  if(S.winter&&lines.length) S.winter.sup=(S.winter.sup||[]).concat(lines);
};
// the rest of the summer: your guides run trips in June, August and September too
const _restOfSeason=restOfSeason;
restOfSeason=function(p){
  const R=_restOfSeason(p);
  if(!p||!S.biz||!S.biz.staff.length) return R;
  let trips=0,gross=0,costs=0;
  S.biz.staff.forEach(g=>{const t=g.sn.trips;if(!t)return;const n=Math.round(t*BIZ_REST*clamp(S.rep/70,.5,1.25)*DF().book);
    trips+=n;gross+=Math.round(n*g.sn.fares/t);costs+=Math.round(n*(g.sn.wages+g.sn.costs)/t)});
  return Object.assign({},R,{gross:R.gross+gross,costs:R.costs+costs,net:R.net+gross-costs,staff:trips});
};
const _endRows=endRows;
endRows=function(){
  const rows=_endRows();const Z=S.biz;
  if(Z&&(Z.tot.hired||Z.boats.length)) rows.push(['Your outfit',`${Z.tot.hired} guide${Z.tot.hired===1?'':'s'} hired, ${Z.tot.trips} staff trips, ${$(Z.tot.net)} net to you${Z.tot.cites?`, ${Z.tot.cites} citation${Z.tot.cites>1?'s':''} on their trips`:''}${Z.boats.length?`; ${Z.boats.length} extra boat${Z.boats.length>1?'s':''}`:''}`]);
  return rows;
};

// ---- the winter planner: one sheet for the outfit ----
function bizWinterBtns(){
  if(!bizOn()) return [];
  const n=staffN(),nb=S.biz.boats.length;
  return [{l:'🧑‍🤝‍🧑 Your outfit: guides & boats',s:n||nb?`${n} guide${n===1?'':'s'}, ${nb} extra boat${nb===1?'':'s'}. Hire, give raises, buy or sell boats.`:'Optional: hire a guide or add a boat. More trips, more bills, more risk.',fn:()=>bizWinterModal()}];
}
function bizWinterModal(){
  const back={l:'Done',s:'Back to the off-season summary.',fn:()=>setTimeout(winterModal,0)},again=f=>()=>{f();setTimeout(bizWinterModal,0)};
  const o=[];
  bizApplicants().forEach((a,i)=>{const why=hireWhy(a),c=onboardCost(a);
    o.push({l:`Hire ${a.name} — ${$(a.wage)}/trip`,s:`${why?why+'. ':''}${skillWord(a.skill)} (skill ${a.skill}), ${relWord(a.rel)}. ${a.line} Onboarding ${$(c)}${a.uscg?' (already holds a six-pack license)':' (includes a Coast Guard six-pack license)'}.`,dis:!!why,fn:again(()=>bizHire(i))})});
  S.biz.staff.forEach(g=>{const want=marketWage(g.skill);
    o.push({l:`Give ${g.name.split(' ')[0]} a raise — +${$(BIZ_RAISE)}/trip`,s:`Now ${$(g.wage)} a trip; a guide of skill ${g.skill} expects about ${$(want)}. ${g.name.split(' ')[0]} is ${moodWord(g.mood)}.`,fn:again(()=>bizRaise(g.id))});
    o.push({l:`Let ${g.name.split(' ')[0]} go`,s:`Severance ${$(BIZ_SEVER*g.wage)}.`,fn:again(()=>bizFire(g.id))})});
  Object.keys(BIZ_BOATS).forEach(k=>{const B=BIZ_BOATS[k],why=boatWhy(k);o.push({l:`${B.ic} Buy: ${B.n} — ${$(B.cost)}`,s:`${why?why+'. ':''}${B.d} About ${$(B.win)} a winter and ${$(BIZ_BOAT_NIGHT)} a guiding night to keep; loses about 12% of its value a year.`,dis:!!why,fn:again(()=>bizBuyBoat(k))})});
  S.biz.boats.forEach(b=>o.push({l:`Sell the ${b.kind==='sled'?'second jet sled':'extra drift boat'} — ${$(Math.round(b.val*BIZ_SELL))}`,s:'Back to the boats you started with.',fn:again(()=>bizSellBoat(b.id))}));
  o.push(back);
  modal(`🧑‍🤝‍🧑 Your outfit · cash ${$(Math.round(S.money))}`,`<p style="font-size:13px">${bizStaffSummary()}</p><p style="font-size:13px;color:var(--mute)">${BIZ_HOW}</p>`,o);
}
const BIZ_HOW='Each guide you hire needs their own ADF&G guide license, the Kenai River Guide Academy and a State Parks guide permit, a first-aid/CPR card, drug testing and a Coast Guard six-pack license to run a powerboat: onboarding is paid when you hire, renewals every winter. Guides take parties on days you’re booked and are paid by the trip (tips are theirs). They get better every season and expect raises; overworked or underpaid, they quit. Their citations go on <b>your</b> record.';
function bizStaffSummary(){
  const Z=BZ(),n=Z.staff.length;
  return `Rep ${S.rep}: up to ${guideCap()} guide${guideCap()===1?'':'s'} (Rep ${BIZ_REP.join(' / ')}). Staff: ${n?Z.staff.map(g=>`<b>${g.name}</b> (skill ${g.skill}, ${relWord(g.rel)}, ${$(g.wage)}/trip, ${moodWord(g.mood)})`).join(', '):'none yet'}. Boats: your jet sled and drift boat${S.up.asst?', your assistant’s sled':''}${Z.boats.length?', '+Z.boats.map(b=>b.kind==='sled'?'a second jet sled':'a second drift boat').join(', '):''}.`;
}

// ---- the Outfit view: a second page of the 📅 Bookings tab ----
let OUTFIT_VIEW=false;
window.bizView=v=>{OUTFIT_VIEW=!!v;render()};
{const bt=EXTRA_TABS.find(t=>t.k==='book');if(bt){const v0=bt.view;bt.view=()=>{
  if(!bizOn()) return v0();
  const seg=`<div role="group" aria-label="Bookings or outfit" style="display:flex;gap:6px;margin:4px 0 8px">${[['📅 Schedule',false],['🧑‍🤝‍🧑 Outfit',true]].map(([l,v])=>`<button class="chip" aria-pressed="${OUTFIT_VIEW===v}" onclick="bizView(${v})" style="flex:1;padding:8px;font-weight:700;${OUTFIT_VIEW===v?'background:var(--brand);color:#fff':''}">${l}</button>`).join('')}</div>`;
  return seg+(OUTFIT_VIEW?outfitView():v0())}}}
// a guide's reviews: this season's average and the latest line (their reviews don't count toward your own rating)
function staffStarsTxt(g){const rv=(S.biz.reviews||[]).filter(r=>r.g===g.id),last=rv[rv.length-1],sn=g.sn;
  return rv.length?` Reviews: ${sn.trips?`★${(sn.stars/sn.trips).toFixed(1)} this season`:`★${(rv.reduce((a,r)=>a+r.stars,0)/rv.length).toFixed(1)} lately`}; last: <i>“${last.text}”</i> (the ${last.who})`:''}
function outfitView(){
  const Z=BZ(),d0=day(),end=S.winter?d0:Math.min(seasonFirst()+SEASON,d0+7),btn=(l,k,a,b,aria)=>`<button class="chip"${aria?` aria-label="${esc(aria)}"`:''} onclick="bizAct('${k}',${a}${b!=null?','+b:''})">${l}</button>`;
  const row=(ic,h,s,extra)=>`<div class="todo"><span class="ck" aria-hidden="true">${ic}</span><div><b>${h}</b><span>${s}</span>${extra?`<div class="chips" style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">${extra}</div>`:''}</div></div>`;
  const sn=Z.staff.reduce((a,g)=>a+g.sn.net,0);
  let h=`<div class="sect">🧑‍🤝‍🧑 Your outfit${Z.staff.length?` · this season ${sn<0?'−':''}${$(Math.abs(sn))} net from your guides`:''}</div>`;
  if(!Z.staff.length) h+=row('🧑‍🤝‍🧑','No guides yet',S.winter?'Hire one from the off-season planner (❄️ Plan the off-season → Your outfit).':'Guides are hired in the off-season. Next winter, look in the off-season planner.');
  Z.staff.forEach(g=>{const f=g.name.split(' ')[0],want=marketWage(g.skill),s=g.sn;
    h+=row('🧑',`${g.name} · ${$(g.wage)}/trip`,`<i>${g.line}</i><br>Skill ${g.skill} (${skillWord(g.skill)}), ${relWord(g.rel)}, ${moodWord(g.mood)}. ${g.wage<want?`Expects about ${$(want)} a trip. `:''}${g.seasons?`${g.seasons} season${g.seasons>1?'s':''} with you. `:'New this year. '}${staffStarsTxt(g)}<br>This season: ${s.trips} trip${s.trips===1?'':'s'}, fares ${$(s.fares)}, wages ${$(s.wages)}, costs ${$(s.costs)}, net ${s.net<0?'−':''}${$(Math.abs(s.net))}${s.cites?`, ${s.cites} citation${s.cites>1?'s':''}`:''}.`,
      btn(`Raise +${$(BIZ_RAISE)}`,'raise',g.id,null,`Give ${g.name} a raise of ${$(BIZ_RAISE)} a trip`)+btn(`Let ${f} go (${$(BIZ_SEVER*g.wage)})`,'fire',g.id))});
  h+=`<div class="sect">🚤 Boats</div>`+row('🚤','Your jet sled & drift boat',`Condition ${S.boat}.${S.up.asst?' Plus your assistant guide’s sled.':''} A guide can use whichever boat you’re not using.`);
  Z.boats.forEach(b=>h+=row(BIZ_BOATS[b.kind].ic,b.kind==='sled'?'Second jet sled':'Second drift boat',`Worth about ${$(b.val)}. ${$(BIZ_BOAT_NIGHT)} a guiding night and ${$(BIZ_BOATS[b.kind].win)} a winter to keep.`,S.winter?btn(`Sell (${$(Math.round(b.val*BIZ_SELL))})`,'sell',b.id):''));
  if(!S.winter){
    h+=`<p class="small-note" style="font-size:12.5px;color:var(--mute);margin:2px 2px 0">A guide’s parties review the guide (“Ask for Jenna”): those stars show here and don’t count toward your own ★ rating.</p>`;
    h+=`<div class="sect">📋 Assignments · ${dlabel(d0)}–${dlabel(end-1)}</div>`;let any=false;
    for(let d=d0;d<end;d++) S.book.filter(b=>b.d===d&&b.status==='booked'&&b.type!=='halibut'&&(b.g!=null||!b.asst)).forEach(b=>{any=true;const T=TRIPS[b.type];
      const tr=b.tr&&b.tr.length?` <span title="${traitTxt(b.tr)}" aria-label="${traitTxt(b.tr)}">${traitIcons(b.tr)}</span>`:'',big=b.big?` 🎯 ${b.big.txt}.`:'';
      if(b.g!=null){const back=b.d>d0||tod()<T.start-60;h+=row(T.ic,`${dlabel(d)} · ${staffName(b.g)}: ${T.n}`,`The ${b.who} (${b.n})${tr}, ${fmt(T.start)}, ${L[T.loc].name}.`,back&&youFree(b)?btn('Take it yourself','back',b.id,null,`Run the ${b.who}’s trip on ${dlabel(d)} yourself`):'');return}
      const hs=canHand(b)?Z.staff.filter(g=>!laneBusy(b.d,b.type,x=>x!==b&&x.g===g.id)&&boatFree(b.d,b.type,b)):[];
      h+=row(T.ic,`${dlabel(d)} · You: ${T.n}`,`The ${b.who} (${b.n})${tr}, ${fmt(T.start)}, ${L[T.loc].name}.${big}${b.arc?' A family that books you, not your outfit.':''}`,hs.map(g=>btn(`Hand to ${g.name.split(' ')[0]}`,'hand',b.id,g.id,`Hand the ${b.who}’s ${T.n.toLowerCase()} on ${dlabel(d)} to ${g.name}`)).join(''))});
    if(!any) h+=row('📋','Nothing booked','No trips in the next few days.');
  }
  if(Z.past.length) h+=`<div class="sect">Former staff</div>`+Z.past.map(p=>row('👋',p.name,`${p.why==='quit'?'Quit':'Let go'} after ${p.trips} trips, ${p.net<0?'−':''}${$(Math.abs(p.net))} net${p.cites?`, ${p.cites} citation${p.cites>1?'s':''}`:''}.`)).join('');
  return h+`<div class="rules">${BIZ_HOW} A staff trip costs you the guide’s wage, fuel, fees and about ${$(BIZ_TRIP_COST)} of wear and tackle, and each one that day takes ${BIZ_SUPERVISE} of your energy.</div>`;
}
TIPS.push({id:'outfit',when:()=>bizOn()&&!!S.winter,t:'🧑‍🤝‍🧑 You can grow the business now: hire a guide, add a boat. It’s optional. Guides cost wages and licenses, need boats and bookings, and their citations land on your record.'});
