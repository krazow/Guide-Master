// ============================================================
//  GUIDE MASTER, part 14: commercial gillnetting (the adapter).
//  The fishery itself lives in src/gillnet/ (the Gillnet engine, which knows nothing about this game). This file is the thin
//  bridge: the off-season plan (crew on a setnet site or a drift boat, lease a site or a permit and boat, or own a drift permit
//  and boat), the season's openers on the played days, the opener as a day choice (a sheet the player opens from 🧭 Here,
//  never a pop-up of its own), the report applied back to S, and the rest of the summer's openers settled with the guiding.
//
//  State: S.fish.gillnet (gnBase()): {on, plan {s, id, kind, role, paid}, xp {set, drift} openers worked, did {role id: seasons},
//  suit, own {val, s, exam} | null, sched {s, kind, days {d: opener}, reopen, price}, done {d: result}, sn (this season's ledger), tot}.
//  Defaults only (newState is wrapped, and migrate() fills what an old save lacks): no save-schema bump.
//  Nothing here draws a random number until the player plans a summer of gillnetting, so a game without it plays as before.
//  Hooks (wrapped, not edited): newState, startSeason, finishWinter, onMorning, onNight, actionsHere, restOfSeason, endRows,
//  todoItems, artMorning and the Bookings tab. Edited elsewhere (one line): the off-season planner's button (24-career.js),
//  and the Help section (26-help.js).
// ============================================================
const GN=Gillnet.data;
function gnBase(){return {v:1,on:false,plan:null,xp:{set:0,drift:0},did:{},suit:false,own:null,sched:null,done:{},sn:null,
  tot:{openers:0,fish:0,gross:0,net:0,cites:0,seine:0,partner:0,rest:0},mood:{set:60,drift:60},skip:{set:'',drift:''}}}
{const _newState=newState;newState=function(){const o=_newState();o.fish=Object.assign({},o.fish&&typeof o.fish==='object'?o.fish:{},{gillnet:gnBase()});return o}}
const GNS=()=>{if(!S.fish||typeof S.fish!=='object'||Array.isArray(S.fish))S.fish={};const g=S.fish.gillnet;
  if(!g||typeof g!=='object'||Array.isArray(g))S.fish.gillnet=gnBase();else fillDefaults(g,gnBase());return S.fish.gillnet};
// unlocked from the second off-season (an older save already that far along unlocks the first time it is asked)
const gnOn=()=>{const g=S&&S.fish&&S.fish.gillnet;if(!g)return false;if(!g.on&&Array.isArray(S.seasons)&&S.seasons.length>=GN.UNLOCK)g.on=true;return !!g.on};
const gnSeason=()=>S.winter?S.winter.s:seasonOf(day());
// this season's plan (null when there is none)
const gnPlan=(s=gnSeason())=>{const g=S&&S.fish&&S.fish.gillnet,p=g&&g.plan;return p&&p.s===s?p:null};
const gnSched=(s=seasonOf(day()))=>{const g=S&&S.fish&&S.fish.gillnet,x=g&&g.sched;return x&&x.s===s?x:null};
const gnDay=(d=day())=>{const x=gnSched(seasonOf(d));return x?x.days[d]||null:null};
const gnKind=k=>k==='set'?'setnet':'drift';
const gnIc=k=>k==='set'?'🪢':'🚤';
const gnFuel=()=>Math.round(fuelPrice('kenai')*100)/100;
const gnHours=o=>`${fmt(o.hours[0])}–${fmt(o.hours[1])}`;
function gnSkipper(kind){const g=GNS();if(!g.skip[kind])g.skip[kind]=GN.SKIPPERS[kind][(seasonOf(day())+(S.name||'').length)%GN.SKIPPERS[kind].length];return g.skip[kind]}

// ---- unlock, the season's bills, the season's ledger ----
const _gnStartSeason=startSeason;
startSeason=function(s){
  _gnStartSeason(s);
  const g=GNS(),lines=[];
  if(!g.on&&S.seasons.length>=GN.UNLOCK){g.on=true;lines.push('🎣 <b>New: commercial fishing.</b> You can crew or lease on a Cook Inlet setnet site or drift boat this summer, if you want to. Look in <b>Commercial & crab</b> below.')}
  // last summer: what your own openers and the rest of the summer brought (settled in restOfSeason, at the season's end)
  const sn=g.sn;
  if(sn&&sn.s===s-1&&(sn.openers||sn.partner||sn.rest||sn.up||sn.seine)){
    g.tot.rest+=sn.rest;g.tot.net+=sn.rest;const all=sn.net+sn.pnet+sn.snet+sn.rest-sn.up,m=v=>`${v<0?'−':''}${$(Math.abs(Math.round(v)))}`;
    lines.push(`🎣 Gillnetting, ${2025+s}: ${sn.openers} opener${sn.openers===1?'':'s'} fished (${m(sn.net)})${sn.partner?`, ${sn.partner} fished for you while you guided (${m(sn.pnet)})`:''}${sn.seine?`, ${sn.seine} beach seine day${sn.seine>1?'s':''} (${m(sn.snet)})`:''}${sn.rest?`, the rest of the summer ${m(sn.rest)}`:''}${sn.up?`, ${m(-sn.up)} up front`:''}: <b>${m(all)}</b> in all.`)}
  // an owned permit and boat: storage, insurance, haul-out and permit fees, and a year of wear on its value
  if(g.own){const bill=Math.round(GN.OWN.winter*DF().cost),drop=Math.round(g.own.val*GN.OWN.deprec);
    money(-bill);S.stats.spent+=bill;g.tot.net-=bill;g.own.val-=drop;S.up.value=Math.max(0,S.up.value-drop);
    lines.push(`🚤 Your drift permit and boat: ${$(bill)} for haul-out, storage, insurance and the permit card. It’s worth about ${$(g.own.val)} now.`)}
  g.done={};g.sn=gnLedger(s);
  if(g.own) g.plan={s,id:'drift:own',kind:'drift',role:'own',paid:0};
  if(lines.length&&S.winter) S.winter.sup=(S.winter.sup||[]).concat(lines);
};
// the season's openers come when the bookings open
const gnLedger=s=>({s,openers:0,net:0,gross:0,fish:0,partner:0,pnet:0,seine:0,snet:0,rest:0,up:0,cites:0});
const gnSn=(s=gnSeason())=>{const g=GNS();if(!g.sn||g.sn.s!==s)g.sn=gnLedger(s);else fillDefaults(g.sn,gnLedger(s));return g.sn};
const _gnFinishWinter=finishWinter;
finishWinter=function(){
  const s=S.winter?S.winter.s:null;
  _gnFinishWinter();
  if(s==null) return;const p=gnPlan(s);if(!p) return;
  gnMakeSched(s,p.kind);
  const x=gnSched(s),ds=Object.keys(x.days).map(Number).sort((a,b)=>a-b);
  say(`🎣 ${p.kind==='set'?'Setnet':'Drift'} periods in your weeks: ${ds.length?ds.map(d=>dlabel(d)).join(', '):'none (the fishery runs late June to mid-August)'}. ADF&G announces each one, open or closed, the morning before. See 📅 Bookings.`);
};
function gnMakeSched(s,kind){
  const g=GNS(),days=[];
  for(let d=s*SEASON;d<s*SEASON+SEASON;d++){const x=dateOf(d);days.push({d,md:mdOf(d),dow:x.getUTCDay()})}
  const x=Gillnet.schedule({kind,days,king:kingRule(),sock:REG().mult.sockeye},{rand:Math.random});
  x.s=s;x.price=Math.round((GN.PRICE.lo+Math.random()*(GN.PRICE.hi-GN.PRICE.lo))*100)/100;
  g.sched=x;return x;
}
// is an opener announced yet? (regular periods and extras are announced the morning before; a day you can see is known)
const gnKnown=(o,d)=>!!o&&day()>=o.ann;

// ---- the morning: today's opener and tomorrow's announcement, in the morning report ----
const _gnOnMorning=onMorning;
onMorning=function(d){
  _gnOnMorning(d);
  if(S.winter) return;const p=gnPlan(seasonOf(d)),x=gnSched(seasonOf(d));if(!p||!x) return;
  const o=x.days[d],t=x.days[d+1],K=gnKind(p.kind);
  if(o&&Gillnet.fishable(o)) gnNote(`${gnIc(p.kind)} <b>Today: ${K} opener</b>, ${gnHours(o)}, ${GN.ST[o.st]}. ${o.why} Start it from 🧭 Here before ${fmt(o.hours[0]+60)}.`,'gn_low_tide_site');
  else if(o&&o.seine&&p.kind==='set') gnNote(`🏖️ <b>The beach is closed for kings today.</b> A neighbor’s experimental beach seine could use a hand (🧭 Here).`,'gn_closed_morning');
  else if(o) gnNote(`🚫 <b>No ${K} opener today.</b> ${o.why}`,'gn_closed_morning');
  if(t&&seasonOf(d+1)===seasonOf(d)) gnNote(Gillnet.fishable(t)?`📣 ADF&G: tomorrow (${dayName(d+1)}) the ${K} fleet fishes ${GN.AREA[t.area]}, ${gnHours(t)}${t.st==='extra'?': an extra period':t.st==='reopen'?': reopened':t.st==='restricted'?', restricted':''}.`:`📣 ADF&G: no ${K} fishing tomorrow (${dayName(d+1)}). ${t.why}`);
};
function gnNote(l,ev){digestLine(l);if(ev&&DIGEST)(DIGEST.gn=DIGEST.gn||[]).push({id:ev,sev:ev==='gn_closed_morning'?1:0})}
// a picture for the morning report from the opener's news, when nothing else has one (40-art.js: from 'gillnet')
{const _am=artMorning;artMorning=function(D){const o=_am(D);if(o.top||!artOn()||!D.gn||!D.gn.length) return o;
  o.top=artFirst(D.gn.map(e=>()=>artSlot('event',()=>artEventCtx(e.id,'gillnet'),{deco:true,key:'morning'})));return o}}

// ---- the day: the opener is a choice on 🧭 Here ----
function gnTodayAction(){
  const d=day(),p=gnPlan(),o=gnDay(d),g=GNS();if(!p||!o||S.trip||S.winter) return null;
  const done=g.done[d];if(done) return null;
  if(fishTaken(d,'gillnet')) return null;   // 41b-fishhub.js: one commercial activity a day
  const m=tod(),last=o.hours[0]+60,trips=todays(d);
  if(Gillnet.fishable(o)){
    const R=GN.ROLES[p.id],who=p.role==='crew'?` with ${gnSkipper(p.kind)}`:'';
    const busy=trips.length?` You have ${trips.map(b=>`the ${b.who} at ${fmt(TRIPS[b.type].start)}`).join(' and ')}: you’d have to hand them off or cancel.`:'';
    if(m>last) return {ic:gnIc(p.kind),l:`The ${gnKind(p.kind)} opener started without you`,s:`It opened at ${fmt(o.hours[0])}. ${p.role==='crew'?`${gnSkipper(p.kind)} went short-handed.`:'Your partner is fishing it.'}`,cat:'comm',dis:true,fn:()=>{}};
    return {ic:gnIc(p.kind),l:`Work the ${gnKind(p.kind)} opener${who}`,s:`${R.ic} ${gnHours(o)}, ${GN.ST[o.st]}, ${p.kind==='set'?'the east-side beach':GN.AREA[o.area]}. A long day: back around ${fmt(GN[p.kind].end)}.${busy}`,cat:'comm',cls:trips.length?'':'primary',fn:()=>gnGo(d)};
  }
  if(o.seine&&p.kind==='set'&&m<=last) return {ic:'🏖️',l:'Help on the experimental beach seine',s:`The setnets are closed for kings. A day’s wage, about ${$(GN.SEINE_WAGE)}.${trips.length?' You have trips booked today.':''}`,cat:'comm',fn:()=>gnGo(d,true)};
  return null;
}
{const _ah=actionsHere;actionsHere=function(){const a=_ah();try{if(gnOn()&&!S.winter){const x=gnTodayAction();if(x)a.unshift(x)}}catch(e){}return a}}
// booked trips in the way: hand them to your guides, cancel them, or guide today instead (41b-fishhub.js, the same choice for every module)
function gnGo(d,seine){
  const p=gnPlan();
  fishTripsChoice({ic:seine?'🏖️':gnIc(p.kind),d,what:seine?'work the beach seine':'fish the opener',why:'a commercial opener',go:()=>gnStart(d,seine),
    keep:{l:'Guide today instead',s:seine?'The beach seine goes on without you.':p.role==='crew'?`${gnSkipper(p.kind)} fishes without you.`:'Your partner fishes the opener for you.'}});
}
function gnTicket(d,seine){
  const p=gnPlan(),o=gnDay(d),g=GNS(),w=wxOf(d),tt=tideTable(d);
  return {kind:p.kind,role:p.role,day:Object.assign({},o),seine:!!seine,run:clamp(abundance('sockeye','kbeach',d),.15,1.4),price:(gnSched()||{}).price||1.65,
    wind:w.wind,wx:S.wx[d]||'sun',tides:tt.map(x=>({m:x.m,h:Math.round(x.h*10)/10,hi:x.hi})),amp:Math.round(tide(d*1440+720).amp*10)/10,now:tod(),
    energy:S.energy,cash:Math.round(S.money),xp:g.xp[p.kind]||0,suit:!!g.suit,exam:!!(g.own&&g.own.exam===seasonOf(d)),king:kingRule(),costMult:DF().cost,fuel:gnFuel(),
    skipper:p.role==='crew'?gnSkipper(p.kind):'',d};
}
// the sheets: an illustration from the beat's events (the worst first), from 'gillnet'
function gnArt(evs){if(!artOn()||!evs||!evs.length)return '';return artFirst(evs.map((e,i)=>({e,i})).sort((a,b)=>(b.e.sev||0)-(a.e.sev||0)||a.i-b.i).map(x=>()=>artSlot('event',()=>artEventCtx(x.e.id,'gillnet'),{deco:true,key:'gillnet'})))}
// the summary sheet also says where the fish went when your own tender or plant bought them (fishDeliver, applied in gnApply first)
let GN_ROUTED=null;
const gnHost=d=>({show:(t,h,b,lock,meta)=>modal(t,gnArt(meta&&meta.events)+h+(meta&&meta.phase==='done'&&GN_ROUTED?GN_ROUTED.lines.map(l=>`<p>${l}</p>`).join(''):''),b,lock),rand:()=>Math.random(),onFinish:rep=>gnApply(rep,d)});
function gnStart(d,seine){if(!gnPlan()||!gnDay(d)||fishTaken(d,'gillnet'))return;GN_ROUTED=null;fishClaim(d,'gillnet');Gillnet.start({ticket:gnTicket(d,seine),host:gnHost(d)})}
// the report goes back into the save
function gnApply(rep,d){
  if(!rep) return rep;
  const g=GNS(),p=gnPlan(),K=p?p.kind:rep.kind,sn=gnSn(seasonOf(d));
  g.done[d]={skipped:!!rep.skipped,seine:!!rep.seine,fish:rep.fish,net:rep.cashDelta,gross:rep.gross};
  if(rep.lines) rep.lines.forEach(l=>say(l));
  if(rep.skipped){if(S.fish.today&&S.fish.today.d===d&&S.fish.today.id==='gillnet')S.fish.today=null;if(p&&p.role==='crew')g.mood[K]=clamp(g.mood[K]+(rep.mood||-8),0,100);return rep}
  // your own tender or plant buys the fish when it works these waters (41b-fishhub.js, 46-tender.js), at your own posted price
  const rt=GN_ROUTED=rep.delivery?fishDeliver(Object.assign({},rep.delivery,{day:d})):null;
  if(rt){rep.cashDelta+=rt.diff;rep.gross=Math.round(rep.gross-rep.delivery.value+rt.value);rep.routed=rt;g.done[d].net=rep.cashDelta;g.done[d].gross=rep.gross;rt.lines.forEach(l=>say(l))}
  money(rep.cashDelta);
  if(rep.cashDelta<0)S.stats.spent+=-rep.cashDelta;
  if(rep.energyDelta) adj('energy',rep.energyDelta);
  const room=Math.max(0,(d+1)*1440-2-S.t);if(rep.minutes>0)pass(Math.min(rep.minutes,room));
  S.loc='shop';
  (rep.cites||[]).forEach(c=>{const c0=S.stats.citesTotal||0;cite(c.what,c.fine,!!c.minor,null,c.who);if((S.stats.citesTotal||0)>c0){g.tot.cites++;sn.cites++}});
  if(rep.seine){g.tot.seine++;sn.seine++;sn.snet+=rep.cashDelta;g.tot.net+=rep.cashDelta}
  else{g.xp[K]=(g.xp[K]||0)+(rep.xp||0);sn.openers++;sn.net+=rep.cashDelta;sn.gross+=rep.gross;sn.fish+=rep.fish;
    g.tot.openers++;g.tot.fish+=rep.fish;g.tot.gross+=rep.gross;g.tot.net+=rep.cashDelta;
    if(p&&p.role==='crew')g.mood[K]=clamp(g.mood[K]+(rep.mood||0)-(rep.cites&&rep.cites.length?10:0),0,100)}
  S.stats.gnNet=(S.stats.gnNet||0)+rep.cashDelta;S.stats.gnOpeners=(S.stats.gnOpeners||0)+(rep.seine?0:1);
  sfx(rep.cashDelta>0?'good':'info');
  showTile(rep.seine?'🏖️':gnIc(K),rep.seine?'Beach seine day':`${rep.fish} sockeye`,`${rep.cashDelta<0?'−':'+'}${$(Math.abs(rep.cashDelta))} to you`,rep.cashDelta>=0?'good':'bad');
  return rep;
}
// ---- the night: an opener you guided through (or slept through) ----
const _gnOnNight=onNight;
onNight=function(where,notes,d){
  _gnOnNight(where,notes,d);
  if(S.winter||!gnOn()) return;
  const p=gnPlan(seasonOf(d)),o=gnDay(d),g=GNS();if(!p||!o||!Gillnet.fishable(o)) return;
  const r=g.done[d];if(r&&(!r.skipped||r.partner||p.role==='crew')) return;
  if(p.role==='crew'){g.done[d]={skipped:true,fish:0,net:0,gross:0};g.mood[p.kind]=clamp(g.mood[p.kind]-6,0,100);notes.push(`${gnIc(p.kind)} ${gnSkipper(p.kind)} fished today’s opener a hand short.`);return}
  const t=gnTicket(d);t.now=o.hours[0];
  const rep=Gillnet.partner(t,{rand:Math.random});
  money(rep.cashDelta);g.done[d]={skipped:true,partner:true,fish:rep.fish,net:rep.cashDelta,gross:rep.gross};
  const sn=gnSn(seasonOf(d));sn.partner++;sn.pnet+=rep.cashDelta;g.tot.partner++;g.tot.net+=rep.cashDelta;S.stats.gnNet=(S.stats.gnNet||0)+rep.cashDelta;
  rep.lines.forEach(l=>notes.push(l));
};

// ---- the rest of the summer (lease or own): your partner or a hired skipper fishes the openers you don't play ----
function gnRest(p){
  const g=S&&S.fish&&S.fish.gillnet;if(!p||!g||!g.plan) return null;
  const s=(p.year||0)-2026,pl=g.plan;if(pl.s!==s||pl.role==='crew') return null;
  const x=g.sched&&g.sched.s===s?g.sched:null,sn=g.sn&&g.sn.s===s?g.sn:{openers:0,net:0,gross:0,partner:0};
  const reg=x?Object.values(x.days).filter(o=>o.reg):[],seen=reg.length;
  const king=REG().king,open=x&&reg.length?reg.filter(o=>Gillnet.fishable(o)).length/reg.length:pl.kind==='set'?{open:1,cr:.9,closed:0}[king]:.95;
  const lateOpen=pl.kind==='set'&&king==='closed'&&x&&x.reopen?.35:0;
  return Gillnet.rest({kind:pl.kind,role:pl.role,played:sn.openers,net:sn.net,gross:sn.gross,open:Math.max(open,lateOpen),count:Math.max(0,GN.REST[pl.kind]-seen),
    sock:REG().mult.sockeye,price:x?x.price:1.65,costMult:DF().cost,fuel:gnFuel()});
}
const _gnRestOfSeason=restOfSeason;
restOfSeason=function(p){
  const R=_gnRestOfSeason(p);
  let x=null;try{x=gnRest(p)}catch(e){x=null}
  if(!x||!x.net&&!x.gross) return R;
  const g=GNS();if(g.sn&&g.sn.s===(p.year||0)-2026)g.sn.rest=x.net;
  return Object.assign({},R,{gross:R.gross+x.gross,costs:R.costs+x.costs,net:R.net+x.net,gill:x});
};
const _gnEndRows=endRows;
endRows=function(){const rows=_gnEndRows(),g=S.fish&&S.fish.gillnet;
  if(g&&(g.tot.openers||g.tot.seine||g.tot.partner||g.own)) rows.push(['Commercial fishing',`${g.tot.openers} opener${g.tot.openers===1?'':'s'} fished (${grp(g.tot.fish)} sockeye)${g.tot.partner?`, ${g.tot.partner} fished for you`:''}${g.tot.seine?`, ${g.tot.seine} beach seine day${g.tot.seine>1?'s':''}`:''}, ${g.tot.net<0?'−':''}${$(Math.abs(Math.round(g.tot.net)))} net${g.tot.cites?`, ${g.tot.cites} citation${g.tot.cites>1?'s':''}`:''}${g.own?'; your own drift permit and boat':''}`]);
  return rows};
// the To-do list: today's opener
{const _todo=todoItems;todoItems=function(){const it=_todo();try{const o=gnDay(),p=gnPlan();if(p&&o&&!S.winter&&(Gillnet.fishable(o)||o.seine&&p.kind==='set')){const r=GNS().done[day()];
  it.splice(0,0,{l:Gillnet.fishable(o)?`${gnIc(p.kind)} ${p.kind==='set'?'Setnet':'Drift'} opener, ${gnHours(o)}`:'🏖️ Beach seine day (optional)',s:Gillnet.fishable(o)?(p.role==='crew'?`Crew for ${gnSkipper(p.kind)}.`:'Fish it, or your partner fishes it for a share.'):'A neighbor’s test seine.',ok:!!(r&&!r.skipped),fail:!!(r&&r.skipped),urgent:!r&&Gillnet.fishable(o)&&tod()<=o.hours[0]+60})}}catch(e){}return it}}

// ---- the off-season planner: a section of the shared "⚓ Commercial & crab" sheet (41b-fishhub.js), from the second off-season ----
FISH_HUB.push({id:'gillnet',order:1,ic:'🪢',l:'Gillnetting: setnet or drift',short:'a setnet site or a drift boat',s:()=>gnPlanSum(),on:()=>!!(S&&Array.isArray(S.seasons)&&S.seasons.length>=GN.UNLOCK),
  open:back=>{gnOn();gnWinterModal(back)}});
function gnPlanSum(){const p=gnPlan(),g=GNS();if(!p) return g.own?'Your drift boat waits on the hard.':'Gillnetting: not this summer.';return `Gillnetting: ${GN.ROLES[p.id].l.toLowerCase()}.`}
function gnTk(){const g=GNS();return {cash:Math.round(S.money),costMult:DF().cost,xp:g.xp,did:g.did,own:g.own?{boat:true}:null,suit:g.suit,plan:gnPlan()?gnPlan().id:null}}
function gnSetPlan(id){
  const g=GNS(),s=gnSeason(),cur=gnPlan(s),R=GN.ROLES[id];
  if(cur){if(cur.paid){money(cur.paid);S.stats.spent-=cur.paid;gnSn(s).up-=cur.paid;g.tot.net+=cur.paid}if(g.did[cur.id])g.did[cur.id]--;g.plan=null}
  if(!id||!R) return true;
  const o=Gillnet.offers(gnTk()).find(x=>x.id===id);if(!o||o.dis){if(cur)gnSetPlan(cur.id);return false}
  money(-o.cost);S.stats.spent+=o.cost;gnSn(s).up+=o.cost;g.tot.net-=o.cost;g.plan={s,id,kind:R.kind,role:R.role,paid:o.cost};g.did[id]=(g.did[id]||0)+1;
  say(`${R.ic} ${R.l} this summer${o.cost?` (${$(o.cost)} up front)`:''}.`);sfx('good');return true;
}
function gnBuy(){const g=GNS(),c=Gillnet.buyCost(DF().cost);if(Gillnet.buyWhy(Object.assign(gnTk(),{cash:Math.round(S.money)})))return false;
  const cur=gnPlan();if(cur)gnSetPlan(null);
  money(-c);S.stats.spent+=c;S.up.value+=c;g.own={val:c,s:gnSeason(),exam:-1};g.plan={s:gnSeason(),id:'drift:own',kind:'drift',role:'own',paid:0};g.did['drift:own']=(g.did['drift:own']||0)+1;
  say(`⚓ You buy a Cook Inlet drift permit and a used 32-foot gillnetter (${$(c)}). The permit is yours; the boat needs a name.`);sfx('good');return true}
function gnSell(){const g=GNS();if(!g.own||!S.winter)return false;const v=Math.round(g.own.val*GN.OWN.sell);money(v);S.up.value=Math.max(0,S.up.value-g.own.val);g.own=null;
  const p=gnPlan();if(p&&p.role==='own')g.plan=null;say(`⚓ You sell the drift permit and boat for ${$(v)}.`);return true}
function gnSuit(){const g=GNS(),c=Math.round(GN.SUIT*DF().cost);if(g.suit||S.money<c)return false;money(-c);S.stats.spent+=c;g.suit=true;say(`🦺 A survival (immersion) suit in a bag with your name on it: ${$(c)}. Every boat in the inlet should have one for each person aboard.`);return true}
function gnExam(){const g=GNS();if(!g.own||!S.winter||g.own.exam===gnSeason()||campDaysLeft()<1)return false;campW();S.camp.days+=1;g.own.exam=gnSeason();
  say('⚓ A Coast Guard examiner walks your boat at the harbor: life raft, EPIRB, flares, survival suits, fire extinguishers. A free exam and a new decal. It took a free day.');return true}
window.gnAct=(k,a)=>{const f={plan:()=>gnSetPlan(a),buy:gnBuy,sell:gnSell,suit:gnSuit,exam:gnExam}[k];return f?f():false};
let GN_BACK=null;
function gnWinterModal(back){
  if(back)GN_BACK=back;
  const g=GNS(),s=gnSeason(),p=gnPlan(s),again=f=>()=>{f();setTimeout(gnWinterModal,0)},cm=DF().cost,sock=REG().mult.sockeye;
  const o=Gillnet.offers(gnTk()).filter(x=>!p||x.id!==p.id).map(x=>({l:`${x.ic} ${x.l}${x.cost?` — ${$(x.cost)}`:''}`,s:`${x.dis?x.why+'. ':''}${x.s} ${x.note||''}`,dis:x.dis,fn:again(()=>gnSetPlan(x.id))}));
  if(p) o.unshift({l:'No gillnetting this summer',s:p.paid?`Gets back the ${$(p.paid)} you paid.`:'Guiding only.',fn:again(()=>gnSetPlan(null))});
  if(!g.own){const why=Gillnet.buyWhy(Object.assign(gnTk(),{cash:Math.round(S.money)}));o.push({l:`⚓ Buy a drift permit and boat — ${$(Gillnet.buyCost(cm))}`,s:`${why?why+'. ':''}A limited-entry permit and a used 32-foot gillnetter. About ${$(Math.round(GN.OWN.winter*cm))} a winter to keep; worth a little less every year.`,dis:!!why,fn:again(gnBuy)})}
  else{o.push({l:`⚓ Sell the permit and boat — ${$(Math.round(g.own.val*GN.OWN.sell))}`,s:'Back to guiding only, or leasing.',fn:again(gnSell)});
    o.push({l:'⚓ Coast Guard dockside exam',s:g.own.exam===s?'Done this winter: the decal is on the cabin.':campDaysLeft()<1?'No free days left this winter.':'Free, and it takes one of your free days. Without a current decal a boarding can mean a ticket.',dis:g.own.exam===s||campDaysLeft()<1,fn:again(gnExam)})}
  if(!g.suit) o.push({l:`🦺 Buy a survival suit — ${$(Math.round(GN.SUIT*cm))}`,s:'An immersion suit for the cold inlet. Worth it on a drift boat in a blow.',dis:S.money<Math.round(GN.SUIT*cm),fn:again(gnSuit)});
  o.push({l:'Done',s:'Back to the off-season.',fn:()=>{const b=GN_BACK||(()=>setTimeout(winterModal,0));GN_BACK=null;b()}});
  const xp=`Openers worked: ${g.xp.set} setnet, ${g.xp.drift} drift.`;
  modal(`🎣 Gillnetting · cash ${$(Math.round(S.money))}`,`${artSlot('event',()=>artEventCtx('gn_low_tide_site','gillnet'),{deco:true,key:'gn-plan'})}<p style="font-size:13px"><b>This summer:</b> ${p?GN.ROLES[p.id].l:'guiding only'}. ${xp}</p>
    <p style="font-size:13px">🪢 <b>Setnets:</b> ${Gillnet.outlook('set',kingRule(),sock)}</p><p style="font-size:13px">🚤 <b>Drift boats:</b> ${Gillnet.outlook('drift',kingRule(),sock)}</p>
    <p style="font-size:13px;color:var(--mute)">${GN_HOW}</p>`,o);
}
const GN_HOW='Openers are regular periods on Mondays and Thursdays (and extra periods by emergency order) in the weeks you play. Each one is a day you fish instead of guiding: Mondays are free below Skilak in July, Thursdays may mean handing off or cancelling a party. Money paid up front is gone if the fishery closes. With a lease or your own boat, someone fishes the openers you don’t, for a share.';
TIPS.push({id:'gillnet',when:()=>gnOn()&&!!S.winter&&!gnPlan(),t:'🎣 You can try commercial fishing this summer: crew on a setnet site or a drift boat for a share, or lease one. It’s optional. Look in <b>Commercial & crab</b>.'});

// ---- the Bookings tab: this season's openers at the top ----
FISH_BOOK.push({id:'gillnet',order:1,view:()=>gnBookView()});
FISH_TODAY.push({id:'gillnet',order:1,today:()=>{const p=gnPlan(),o=gnDay(),r=GNS().done[day()];if(!p||!o||S.winter)return '';
  return Gillnet.fishable(o)?`${gnIc(p.kind)} ${p.kind==='set'?'setnet':'drift'} opener, ${gnHours(o)}${r?(r.skipped?(r.partner?' (fished for you)':' (missed)'):' ✅'):''}`:o.seine&&p.kind==='set'?'🏖️ a beach seine day':''}});
function gnBookView(){
  const p=gnPlan(),x=gnSched();if(!p||!x||S.winter) return '';
  const g=GNS(),ds=Object.keys(x.days).map(Number).sort((a,b)=>a-b);
  const rows=ds.map(d=>{const o=x.days[d],r=g.done[d],k=gnKnown(o,d)||d<=day();
    const st=!k?'scheduled: ADF&G announces it the morning before':Gillnet.fishable(o)?`${GN.ST[o.st]}, ${gnHours(o)}, ${p.kind==='set'?'the east-side beach':GN.AREA[o.area]}`:o.seine&&p.kind==='set'?'closed for kings · a beach seine day':'closed';
    const res=r?(r.skipped?(r.partner?` · fished for you: ${$(r.net)}`:' · missed'):` · ✅ ${r.fish} sockeye, ${r.net<0?'−':''}${$(Math.abs(r.net))}`):'';
    const clash=k&&Gillnet.fishable(o)&&!r&&d>=day()&&todays(d).length?` · <span style="color:var(--warn)">you have ${todays(d).length} trip${todays(d).length>1?'s':''} booked</span>`:'';
    return `<div class="todo"><span class="ck" aria-hidden="true">${d<day()?'✔️':d===day()?'👉':!k?'·':Gillnet.fishable(o)?gnIc(p.kind):'🚫'}</span><div><b>${dlong(d)}</b><span>${st}${res}${clash}</span></div></div>`}).join('');
  const sn=g.sn&&g.sn.s===seasonOf(day())?g.sn:null,so=sn?sn.net+sn.pnet+sn.snet:0;
  return `<div class="sect">🎣 ${p.kind==='set'?'Setnet':'Drift'} openers · ${GN.ROLES[p.id].l}${sn&&(sn.openers||sn.partner||sn.seine)?` · ${so<0?'−':''}${$(Math.abs(Math.round(so)))} so far`:''}</div>${rows||'<div class="todo"><span class="ck">·</span><div><b>No periods in your weeks</b><span>The fishery runs from late June to mid-August.</span></div></div>'}`;
}

// ---- bots (tools/sim) and tests: a sensible gillnetter ----
// winter: crew a drift boat the first summer it opens up, then lease a drift permit and boat once there's a cushion of cash;
// a setnet lease only in a year kings are open. Days: work an opener only when no trip of your own is booked; sit out a gale.
function gnBotWinter(o){
  o=o||{};if(!S.winter||!gnOn()) return null;const g=GNS(),k=kingRule();
  if(o.suit!==false&&!g.suit&&S.money>3000) gnSuit();
  const offers=Gillnet.offers(gnTk()),ok=id=>{const x=offers.find(y=>y.id===id);return x&&!x.dis};
  let id=o.role||null;
  if(!id){
    if(k==='open'&&ok('set:lease')&&S.money>(o.reserve||12000)) id='set:lease';
    else if(ok('drift:lease')&&S.money>(o.reserve||12000)) id='drift:lease';
    else id=(g.did['drift:crew']||0)<1?'drift:crew':k!=='closed'&&(g.did['set:crew']||0)<1?'set:crew':'drift:crew';
  }
  if(id==='none'){gnSetPlan(null);return null}
  gnSetPlan(id);return gnPlan();
}
function gnBotDay(o){
  o=o||{};const d=day(),p=gnPlan(),x=gnDay(d),g=GNS();if(!p||!x||g.done[d]||S.trip||S.winter) return null;
  const seine=!Gillnet.fishable(x)&&x.seine&&p.kind==='set';if(!Gillnet.fishable(x)&&!seine) return null;
  if(todays(d).length&&!o.cancel) return null;
  if(tod()>x.hours[0]+60||fishTaken(d,'gillnet')) return null;
  fishCancel(todays(d),'a commercial opener');fishClaim(d,'gillnet');
  const r=Gillnet.sim({ticket:gnTicket(d,seine),rand:Math.random,policy:o.policy||'sensible'}).report;
  return gnApply(r,d);
}
window.gnBot={winter:gnBotWinter,day:gnBotDay};
