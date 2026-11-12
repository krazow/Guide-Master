// Injected into the page. Runs bots against the real game code. Nothing in the repo is modified.
(function(){
const NOOP=()=>{};
window.M=null; window.LASTREQ=null;
function rng(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

const STYLES={
 bytb:    {dil:'first',refuel:true,log:true,fa:true,up:'sensible',camp:true,calls:'idle',service:true},
 ruler:   {dil:'last',refuel:true,log:true,fa:true,up:'sensible',camp:true,calls:'idle',service:true,ruler:true},
 careless:{dil:'first',refuel:false,log:false,fa:false,expiredRun:true,up:'sensible',camp:true,calls:'idle',service:false},
 passive: {dil:'first',refuel:true,log:true,fa:true,up:'none',camp:false,calls:'idle',service:true},
 phone:   {dil:'first',refuel:true,log:true,fa:true,up:'sensible',camp:true,calls:'daily',service:true},
 opport:  {dil:'first',refuel:true,log:true,fa:true,up:'sensible',camp:true,calls:'daily',service:true,opport:true},
 opportx: {dil:'first',refuel:true,log:true,fa:true,up:'sensible',camp:true,calls:'daily',service:true,opport:true,unguarded:true},
 nofuel:  {dil:'first',refuel:false,log:true,fa:true,up:'sensible',camp:true,calls:'idle',service:true},
 nolog:   {dil:'first',refuel:true,log:false,fa:true,up:'sensible',camp:true,calls:'idle',service:true},
 nofacancel:{dil:'first',refuel:true,log:true,fa:false,up:'sensible',camp:true,calls:'idle',service:true},
 nofarun: {dil:'first',refuel:true,log:true,fa:false,expiredRun:true,up:'sensible',camp:true,calls:'idle',service:true},
 nogear:  {dil:'first',refuel:true,log:true,fa:true,up:'sensible',camp:true,calls:'idle',service:true,nogear:true},
 noservice:{dil:'first',refuel:true,log:true,fa:true,up:'sensible',camp:true,calls:'idle',service:false,nonap:true},
 expert:  {dil:'first',refuel:true,log:true,fa:true,up:'sensible',camp:false,calls:'daily',service:true,declineIllegal:true,spot:'best'},
};
STYLES.skilled=Object.assign({},STYLES.expert,{camp:true,spot:'fit',scout:true,look:true,card:true,up:'skilled',svc:60,food:'smart',haul:true,stab:true});
STYLES.food=  Object.assign({},STYLES.bytb,{food:'smart',haul:true,stab:true});
STYLES.foodgen1=Object.assign({},STYLES.bytb,{food:'smart',haul:true,stab:true,gen:1});
STYLES.foodgen2=Object.assign({},STYLES.bytb,{food:'smart',haul:true,stab:true,gen:2});
STYLES.foodnostab=Object.assign({},STYLES.bytb,{food:'smart',haul:true,stab:false});
STYLES.hungry=Object.assign({},STYLES.bytb,{food:'skip'});
STYLES.naive=Object.assign({},STYLES.bytb);
for(const k of ['ruler','passive','phone','opport','expert']) STYLES[k]=Object.assign({},STYLES[k],{food:'smart',haul:true,stab:true});
STYLES.ignores=STYLES.hungry;
for(const k of Object.keys(STYLES).slice()){STYLES[k+'_c']=Object.assign({},STYLES[k],{home:'careful'});STYLES[k+'_p']=Object.assign({},STYLES[k],{home:'payall'});STYLES[k+'_n']=Object.assign({},STYLES[k],{home:'neglect'})}

const UPPOL={ // upgrade policies (for A/B)
 skilled:['course','web','motor','drift','sled','chp'], none:[], sensible:['course','web','rates','motor','drift','sled','chp'],
 ratesonly:['rates'],webonly:['web'],motoronly:['motor'],sledonly:['sled'],driftonly:['drift'],courseonly:['course'],
 sensnorates:['course','web','motor','drift','sled','chp'],sens2:['course','web','rates','motor','drift','sled','asst','lodge','dock','chp'],sens2nr:['course','web','motor','drift','sled','asst','lodge','dock','chp'],sensnoasst:['course','web','rates','motor','drift','sled','chp'],chp:['chp','rates','web'], rateweb:['rates','web']
};

window.simSetup=function(){
  window.render=NOOP;window.transition=(ic,c,c2,done)=>done&&done();window.sfx=NOOP;window.buzz=NOOP;
  window.showTile=(ic,t,s,k)=>{if(!M)return;const key=t;M.tiles[key]=(M.tiles[key]||0)+1};
  for(const k of Object.keys(STEP)){const o=STEP[k];STEP[k]=function(b,t){if(M)M.steps[k]=(M.steps[k]||0)+1;return o.call(this,b,t)}}
  const oReq=window.requestModal;window.requestModal=function(r){LASTREQ=r;if(M)M.req[r.kind]=(M.req[r.kind]||0)+1;return oReq(r)};
  const oc=window.cite;window.cite=function(what,fine,minor,notes,who){if(M){const w=(minor&&S.warns<1)?'WARN: '+what:what;M.citeWhy[w]=(M.citeWhy[w]||0)+1}return oc(what,fine,minor,notes,who)};
  const ov=window.violate;window.violate=function(notes,o){if(M){M.viols[o.what]=(M.viols[o.what]||0)+1}return ov(notes,o)};
  if(typeof homeApply==='function'){const oHA=window.homeApply;window.homeApply=function(rep,q){if(M&&rep){const h=M.hc=M.hc||{cash:0,energy:0,days:0,lost:0,rep:0,min:0,events:0};h.cash+=rep.cashDelta||0;h.energy+=rep.energyDelta||0;h.days+=rep.daysUsed||0;h.lost+=rep.daysLost||0;h.rep+=rep.repDelta||0;h.min+=rep.minutes||0;if(rep.severity>0)h.events++}return oHA(rep,q)}}
  const oGO=window.gameOver;window.gameOver=function(w){if(M){M.loss=w;M.lossDay=S.cur}return oGO(w)};
};

function opts(){return MB.map(o=>o.l)}
function chooseTrip(cfg){
  const key=S.trip.steps[S.trip.step],n=MB.length,b=bk(S.trip.id);
  if(key==='pack'){
    const find=re=>{const o=MB.find(x=>re.test(x.l));return o?o.k:null};
    if(cfg.food==='skip') return find(/Skip food/);
    if(cfg.food==='smart'){const long=TRIPS[b.type].len>=480;
      if(long){const k=find(/salmon/);if(k!=null)return k;const k2=find(/lunch kit/);if(k2!=null)return k2;const k3=find(/snack/);if(k3!=null)return k3}
      return 0}
    return 0}
  if(key==='fuel') return cfg.refuel?0:1;
  if(key==='expired') return cfg.expiredRun?1:0;
  if(key==='spot'){
    const sp=SPOTS[b.type];
    if(cfg.ruler){const i=sp.findIndex(x=>x.viol);return i>=0?i:0}
    if(cfg.spot==='fit'&&typeof spotHint!=='function')return 0;
    if(cfg.spot==='fit'){const d=S.cur,hint=spotHint(b.type);let best=-9,bi=0;SPOTS[b.type].forEach((sp,i)=>{if(sp.viol)return;const r=spotFit(b.type,i,d,hint==='exact');const v=sp.q+(r?r.f*SPOT_Q:0)+(sp.h||0)*.012;if(v>best){best=v;bi=i}});return bi}
    if(cfg.spot==='best'){return b.type==='halibut'?1:0}
    return 0;
  }
  if(cfg.opport){const OPP={issue_sunmon:1,five:1,license:2,king:1,snag:1,over:1,guide_fish:1,extra_rod:1,bait:1,sixpm:1,anchor:1,flyonly:1,chop:1,crew:1};
    if(cfg.unguarded){const LOW={five:1,king:1,snag:1,guide_fish:1,extra_rod:1,bait:2,anchor:1,flyonly:1,chop:1,crew:1};if(key in LOW&&Math.random()<(cfg.oppP==null?.3:cfg.oppP))return key==='king'?(kingRule()==='open'?2:1):Math.min(n-1,LOW[key]);return 0}
    if(S.cites<2&&key in OPP) return key==='king'?(kingRule()==='open'?2:1):Math.min(n-1,OPP[key]);return 0}
  if(cfg.dil==='last') return n-1;
  return 0;
}
function chooseReq(cfg){
  const r=LASTREQ,l0=MB[0].l;
  if(cfg.fa&&r&&r.type&&faDue(r.d)&&sday(r.d)===1&&(r.type==='trout'||r.type==='halibut')) return MB.length-1;
  const kind=/Alaska residents only/.test(l0)?'dipnet':/straight|kings are open/.test(l0)?'king':'trip';
  if(cfg.declineIllegal&&r&&r.kind!=='dipnet'&&r.type!=='halibut'&&TRIPS[r.type].below&&isSunMon(r.d)) return MB.length-1;
  if(cfg.ruler){if(kind==='dipnet')return 1;if(kind==='king')return 1;}
  return 0;
}
function resolve(cfg){
  let g=0;
  while(document.getElementById('mbg')&&g++<300){
    const title=document.querySelector('#mbg h2').textContent;let i=0;
    if(S.trip&&S.trip.steps[S.trip.step]&&!/Back at the dock/.test(title)){i=chooseTrip(cfg);const j=MB.findIndex(x=>x.k===i);if(j>=0)i=j}
    else if(/Booking request/.test(title)) i=chooseReq(cfg);
    else if(/Back at the dock/.test(title)&&cfg.card&&MB.length>1) i=1;
    MBTN(i);
    if(S.over) return;
  }
}
function act(cfg,re){
  const a=actionsHere().find(x=>re.test(x.l)&&!x.dis);if(!a)return false;
  uiNarr=[];a.fn();afterAction();if(!S.over)resolve(cfg);return true;
}
const mins=()=>tod();
function waitTo(m){if(tod()<m)pass(m-tod())}
function sledNeeded(d){return S.book.filter(b=>b.d===d&&b.status==='booked'&&(b.type==='reds'||b.type==='silver')).reduce((a,b)=>a+BURN[b.type],0)}

function playDay(cfg){
  const d=S.cur;const alive=()=>!S.over&&S.cur===d&&!S.winter;
  resolve(cfg);if(!alive())return;
  if(cfg.look) fishView();
  if(S.boat<=0&&cfg.service){act(cfg,/Major repair/);if(!alive())return}
  M.energySum+=S.energy;M.energyN++;if(S.energy<30)M.lowEnergyDays++;
  const trips=todays(d).sort((a,b)=>SLOT(a)[0]-SLOT(b)[0]);
  const first=trips[0];
  // first-aid class (Tuesday)
  const sdn=sday(d);const clash=trips.some(b=>SLOT(b)[1]>775&&SLOT(b)[0]<980);
  const needFA=cfg.fa&&faDue(d)&&!clash&&S.money>=95&&(sdn===1||(S.cred.fa<d&&[3,8,10].includes(sdn)));
  // morning chores if time
  const firstGo=first?TRIPS[first.type].start-60-travelMins('shop',TRIPS[first.type].loc):1200;
  if(cfg.service&&S.boat<(cfg.svc?cfg.svc-10:45)&&firstGo-tod()>=200&&S.money>400){act(cfg,/Service the boats yourself/);if(!alive())return}
  if(cfg.calls==='daily'||(cfg.calls==='idle'&&!trips.length)){ if(!S.calls[d]&&firstGo-tod()>=40){act(cfg,/Return calls/);if(!alive())return} }
  // trips
  for(const b of trips){
    if(b.status!=='booked')continue;
    const T=TRIPS[b.type];
    if(S.loc!==T.loc){const tm=travelMins(S.loc,T.loc);const leave=T.start-60-tm;if(tod()<leave)pass(leave-tod());go(T.loc);resolve(cfg);if(!alive())return}
    waitTo(T.start-60);
    if(b.status!=='booked')continue;
    const before=S.stats.tows||0,m0=S.money;
    // the launch action
    const a=actionsHere().find(x=>x.cls==='primary'&&x.cat==='trip'&&!x.dis);
    if(!a){M.noLaunch=(M.noLaunch||0)+1;continue}
    a.fn();resolve(cfg);afterAction();if(S.over)return;resolve(cfg);
    if(b.status==='done'){const k=M.tt[b.type]=M.tt[b.type]||{n:0,pay:0,happy:0,fish:0,towed:0,money:0};k.n++;k.pay+=payOf(b);k.happy+=b.out.happy;k.fish+=b.out.fish;k.money+=S.money-m0;if((S.stats.tows||0)>before)k.towed++}
    if(!alive())return;
  }
  // scout the river this afternoon for tomorrow's lower-river trips
  if(cfg.scout&&alive()&&S.loc==='lower'&&S.scout!==d&&tod()<1100&&S.book.some(b=>b.d===d+1&&b.status==='booked'&&TRIPS[b.type].loc==='lower')&&S.fuel>=sledNeeded(d+1)+sledNeeded(d)+bn('scout')+3&&!isSunMon(d)){act(cfg,/Scout the river/);if(!alive())return}
  // FA class
  if(needFA&&alive()){
    if(S.loc!=='town'){go('town');resolve(cfg);if(!alive())return}
    if(tod()<780)pass(780-tod());
    if(tod()<=800) act(cfg,/First aid/);
    if(!alive())return;
  }
  // fuel from home cans first
  if(cfg.haul&&S.loc==='shop'&&S.fuel<sledNeeded(d+1)+sledNeeded(d)+4&&fuelFresh()>=1){act(cfg,/Fuel the sled from your home cans/)}
  // refuel
  const tomorrow=sledNeeded(d+1)+sledNeeded(d);
  if(cfg.refuel&&tomorrow>0&&S.fuel<sledNeeded(d+1)+4&&tod()<1250&&S.money>100){
    go('harbor');resolve(cfg);if(!alive())return;act(cfg,/Fill the jet sled/);if(!alive())return;
    if(cfg.haul&&fuelRoom()>=5&&S.money>400){act(cfg,/Haul fuel home: fill the cans/);if(!alive())return}
  }
  // groceries and client lunch kits
  if(cfg.food==='smart'&&tod()<1150&&S.money>250&&(groceryMeals()<12||(S.food.kits<6&&S.book.some(b=>b.d>d&&b.d<=d+4&&b.status==='booked'&&TRIPS[b.type].len>=480)))){
    if(S.loc!=='town'){go('town');resolve(cfg);if(!alive())return}
    if(groceryMeals()<12){act(cfg,/Stock up/);if(!alive())return}
    if(S.food.kits<6&&S.book.some(b=>b.d>d&&b.d<=d+4&&b.status==='booked'&&TRIPS[b.type].len>=480)){act(cfg,/Lunch kits/);if(!alive())return}
  }
  // tackle
  if(!cfg.nogear&&S.gear<=1&&S.money>130&&tod()<1250&&S.book.some(b=>b.d>d&&b.d<=d+3&&b.status==='booked')){
    if(S.loc!=='town'){go('town');resolve(cfg);if(!alive())return}
    act(cfg,/Restock tackle/);if(!alive())return;
  }
  if(S.loc!=='shop'){go('shop');resolve(cfg);if(!alive())return}
  if(cfg.calls==='daily'&&!S.calls[d]&&tod()<1200){act(cfg,/Return calls/);if(!alive())return}
  if(cfg.log&&S.unlogged+S.overdue){act(cfg,/logbook/);if(!alive())return}
  if(!cfg.nogear&&S.prep!==d+1&&S.gear>0&&tod()<1180&&S.book.some(b=>b.d===d+1&&b.status==='booked')){act(cfg,/Rig tomorrow/);if(!alive())return}
  if(cfg.service&&S.boat<(cfg.svc||55)&&tod()<1000&&S.money>400){act(cfg,/Service the boats yourself/);if(!alive())return}
  // nap if tired and early
  let g=0;while(S.energy<40&&tod()<1100&&g++<4){act(cfg,/Nap/);if(!alive())return}
  M.boatSum+=S.boat;M.boatMin=Math.min(M.boatMin==null?100:M.boatMin,S.boat);M.boat0=(M.boat0||0)+(S.boat<=0?1:0);
  const dn=S.book.filter(b=>b.d===d&&b.status==='done').length;(M.dayHist=M.dayHist||{})[dn]=((M.dayHist||{})[dn]||0)+1;M.minMoney=Math.min(M.minMoney==null?1e9:M.minMoney,S.money);
  if(cfg.stab&&sday(d)>=12&&S.home.gal>0&&!isLastSeason(d)){act(cfg,/stabilizer/)}
  if(cfg.home&&typeof homeBot==='function'&&S.loc==='shop'&&tod()<1180&&!S.trip){homeBot(cfg.home,{rand:M.crng})}
  endDay('home');
}

function winterPlay(cfg){
  const W=S.winter;if(!W)return;
  const s=W.s,snap={season:s,money:Math.round(S.money),rep:S.rep,boat:S.boat,energy:S.energy,bill:W.bill,cites:S.cites,fuelPrice:S.fuelBase.kenai};
  M.winters.push(snap);
  const pol=UPPOL[cfg.upPol||cfg.up]||[];
  // buy
  if(pol.length){
    const reserve=cfg.reserve!=null?cfg.reserve:3000;
    let again=true,guard=0;
    while(again&&guard++<8){again=false;
      for(const id of pol){const u=UPGRADES.find(x=>x.id===id);if(upOK(u))continue;
        if(u.cost&&S.money<u.cost+reserve)continue; if(u.cost===0&&false)continue;
        if(id==='web'&&S.money<reserve+2200)continue;
        buyUp(u);M.bought.push({s,id,money:Math.round(S.money)});again=true;break}}
  }
  if(cfg.gen&&!S.home.gen&&S.money>GENS[cfg.gen].cost+GENS[cfg.gen].install+8000){buyHome('gen'+cfg.gen);M.bought.push({s,id:'gen'+cfg.gen,money:Math.round(S.money)})}
  if(S.home.stale>0&&cfg.haul){spend(STALE_FEE);S.home.stale=0}
  if(cfg.home&&typeof homeBotWinter==='function'){const m0=S.money;homeBotWinter(cfg.home,{rand:M.crng});(M.homeWinter=M.homeWinter||[]).push(Math.round(S.money-m0))}
  // note upgrade affordability
  snap.afford=UPGRADES.filter(u=>u.cost&&S.money>=u.cost).map(u=>u.id);
  // camp
  if(cfg.camp&&S.winter){const m0=S.money,e0=S.energy,r0=S.rep;const rep=campBot(Object.assign({},cfg.campOpts||{},{rand:M.crng}));if(rep&&(rep.tripsTaken||rep.gigs.length))M.camp.push({s,trips:rep.tripsTaken,gigs:rep.gigs.length,nights:rep.nights,dM:Math.round(S.money-m0),dE:S.energy-e0,dR:S.rep-r0,fish:rep.foodFish,tk:rep.tackleCredit,q:rep.firstTripBoost,bk:rep.bookingBoost})}
  closeModals();
  finishWinter();
}

window.runCareer=async function(o){
  const {style,diff,years,seed}=o;const cfg=Object.assign({},STYLES[style],o.over||{});
  window._rf0=window._rf0||window.runFactor;window.runFactor=cfg.rf!=null?(()=>cfg.rf):window._rf0;
  const r=rng(seed);Math.random=r;
  try{localStorage.clear()}catch(e){}
  setPref('years',years);
  const crng=rng(seed*7919+13);
  M={crng,style,diff,years,seed,citeWhy:{},viols:{},tiles:{},steps:{},req:{},tt:{},winters:[],bought:[],camp:[],energySum:0,energyN:0,lowEnergyDays:0,boatSum:0,loss:null,errors:[]};
  let guard=0;
  try{
    newGame(diff);resolve(cfg);
    while(!S.over&&guard++<5000){
      if(S.winter){winterPlay(cfg);resolve(cfg);continue}
      playDay(cfg);
      await new Promise(r=>setTimeout(r,0));
      if(S.over)break;
      if(S.winter){closeModals()}
      else resolve(cfg);
    }
  }catch(e){M.errors.push(String(e&&e.stack||e).slice(0,400))}
  // results
  const sc=Math.round(scoreOf()*(DF().score||1));const g=M.loss?'F':gradeOf(sc)[0];
  const last=curSeason();last.rest=restOfSeason(last);
  M.score=sc;M.grade=g;M.parts=scoreParts();M.finished=!M.loss&&S.over;M.over=S.over;M.day=S.cur;
  M.money=Math.round(S.money);M.rep=S.rep;M.stats=JSON.parse(JSON.stringify(S.stats));M.seasons=S.seasons.map(x=>({trips:x.trips,fares:x.fares,earned:x.earned,fines:x.fines,rep:x.rep,cites:x.cites,rest:x.rest}));M.seasons.push({trips:last.trips,fares:last.fares,earned:last.earned,rep:S.rep,rest:last.rest});
  M.arcs=JSON.parse(JSON.stringify(S.arcs||{}));M.regN=(S.regs||[]).length;M.regTrips=S.book.filter(b=>b.reg&&b.status==='done').length;M.regBooked=S.book.filter(b=>b.reg).length;M.partiesN=new Set(S.book.map(b=>b.who)).size;M.tripsDone=S.book.filter(b=>b.status==='done').length;M.dilMax=0;
  M.cabin=S.cabin?JSON.parse(JSON.stringify(S.cabin)):null;M.up=JSON.parse(JSON.stringify(S.up));M.home=JSON.parse(JSON.stringify(S.home));M.foodDays=foodDays();M.freezerEnd=S.freezer;M.cites=S.cites;M.ev=S.ev.count;M.achievements=S.achGame;M.warns=S.warns;
  M.boatAvg=M.boatSum/Math.max(1,M.energyN);
  const out=M;M=null;return out;
};
window.simInternals={playDay,resolve,winterPlay,STYLES,initM:(o)=>{window.M={style:o.style,diff:o.diff,years:o.years,seed:o.seed,citeWhy:{},viols:{},tiles:{},steps:{},req:{},tt:{},winters:[],bought:[],camp:[],energySum:0,energyN:0,lowEnergyDays:0,boatSum:0,loss:null,errors:[]}}};window.STYLES=STYLES;window.UPPOL=UPPOL;
})();
