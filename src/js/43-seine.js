// ============================================================
//  GUIDE MASTER, part 13: purse seining out of Homer (the adapter).
//  The seining itself lives in src/seine/ (the Seine module, which knows nothing about this game). This file is the thin bridge:
//  it builds the module's tickets from the save (S), gives it a host made of our own pop-ups, and applies each report back to S.
//
//  How it fits: from the 2nd off-season on, the planner's "⚓ Commercial & crab" sheet has "⚓ Purse seining out of Homer": crew on a
//  seiner for a share, or (after a few openers) run a chartered boat on an emergency transfer or your own permit. ADF&G's openers
//  (Monday, Wednesday and Friday from mid-June; after July only in a fair pink year) show a few days ahead in the morning report and
//  at the top of 📅 Bookings, where you sign on or pass, one by one. An opener is a whole day: a booked trip that day is your real
//  choice (hand it to one of your guides, cancel it, or pass on the opener). On the day, "⚓ Seine opener" on the Here tab takes you
//  to Homer harbor (be there by 6 AM; or drive down the night before and sleep aboard) and plays the opener.
//
//  Save state: S.fish.seine = {v, st (the module's own state, opaque here), s (the season the openers belong to), ops: [{d, md, dow,
//  run, ann, ans: null|'yes'|'no', done, res}]}. Defaults through newState/fillDefaults: no schema bump, old saves load as they are.
//  Nothing here draws a random number until a plan is chosen, so a game that never seines plays exactly as before.
// ============================================================
const SEINE_UNLOCK=2;            // seasons played before the planner offers it (the 2nd off-season)
const SEINE_NOTICE=3;            // days ahead an opener shows (ADF&G announces the week's periods a few days ahead)
const SEINE_MEET=360;            // 6:00 AM at Homer harbor
const SEINE_WAIT=30;             // a skipper waits this long for a crewman, then leaves
const seineBase=()=>({v:1,st:Seine.newState(),s:-1,ops:[]});
{const _ns=newState;newState=function(){const x=_ns();x.fish=x.fish&&typeof x.fish==='object'?x.fish:{};x.fish.seine=seineBase();return x}}
function SN(){
  if(!S.fish||typeof S.fish!=='object'||Array.isArray(S.fish))S.fish={};
  if(!S.fish.seine||typeof S.fish.seine!=='object')S.fish.seine=seineBase();
  const F=fillDefaults(S.fish.seine,seineBase());F.st=Seine.normState(F.st);if(!Array.isArray(F.ops))F.ops=[];return F;
}
const seineUnlocked=()=>!!(S&&Array.isArray(S.seasons)&&S.seasons.length>=SEINE_UNLOCK);
const seinePlan=s=>{if(!S||!S.fish||!S.fish.seine)return null;const P=S.fish.seine.st&&S.fish.seine.st.plan;return P&&P.s===s&&P.role!=='none'?P:null};
const seineOn=()=>!!(S&&!S.winter&&seinePlan(seasonOf(day())));
const seineOp=d=>S&&S.fish&&S.fish.seine&&S.fish.seine.s===seasonOf(d)?(S.fish.seine.ops||[]).find(o=>o.d===d):null;
const seineSigned=d=>{const o=seineOp(d);return !!(o&&o.ans==='yes'&&!o.done)};
const seineDiesel=()=>Math.round(Math.max(4,((S.fuelBase&&S.fuelBase.homer)||6.45)-.75)*100)/100;   // marine diesel at the Homer fuel dock (an estimate off the gas price)
const seineYear=d=>dateOf(d).getUTCFullYear();

// ---- the winter: a section of the shared "⚓ Commercial & crab" sheet (41b-fishhub.js), from the 2nd off-season ----
FISH_HUB.push({id:'seine',order:2,ic:'🎣',l:'Purse seining out of Homer',short:'salmon seining out of Homer',on:()=>seineUnlocked(),
  s:()=>{const P=seinePlan(S.winter.s);return P?(P.role==='crew'?`You’ll crew on the ${Seine.captain(2026+S.winter.s,SN().st).boat} this summer.`:`You’ll run the ${Seine.data.OWN_BOAT} this summer.`):'Crew on a salmon seiner for a share of each opener, or later run your own boat.'},
  open:back=>seineWinterModal(back)});
function seineWinterTicket(){const s=S.winter.s;return {state:SN().st,season:s,year:2026+s,cash:Math.round(S.money),costMult:DF().cost,rep:S.rep}}
function seinePlanApply(r){
  const F=SN();F.st=r.state;
  if(r.cashDelta){money(r.cashDelta);if(r.spent)S.stats.spent+=r.spent}
  r.lines.forEach(l=>say(l));
}
function seineWinterModal(back){
  if(!S.winter) return;
  Seine.ui.plan({show:(t,h,b,lock)=>modal(t,(typeof artOn==='function'&&artOn()?artSlot('event',()=>fishArtCtx('dawn_set','seine'),{deco:true,key:'seine-plan'}):'')+h,b,lock),ticket:seineWinterTicket,apply:seinePlanApply},back||(()=>winterModal()));
}
// a permit you own counts like a boat on the end screen: nine tenths of what you paid
{const _sp=scoreParts;scoreParts=function(){const P=_sp();const F=S&&S.fish&&S.fish.seine;if(F&&F.st&&F.st.permit&&F.st.permitPaid)P.splice(3,0,['Seine permit',Math.round(F.st.permitPaid*.9),'nine tenths of what you paid']);return P}}

// ---- the season: openers on the calendar ----
function seineSchedule(s){
  const F=SN(),P=seinePlan(s);if(!P){F.s=s;F.ops=[];return}
  const days=[];for(let i=1;i<SEASON;i++){const d=s*SEASON+i;days.push({d,md:mdOf(d),dow:sday(d)%7})}
  F.s=s;F.ops=Seine.schedule({year:2026+s,days}).map(o=>({d:o.d,md:o.md,dow:o.dow,run:o.run,eo:o.eo,closed:false,ans:null,done:false,res:null}));
}
// ADF&G's regular schedule is known when the bookings open; a period it holds closed is announced a few days ahead (the morning report)
function seineAnnounce(quiet){
  const F=SN(),d=day(),P=seinePlan(seasonOf(d));if(!P||F.s!==seasonOf(d))return;
  F.ops.filter(o=>o.eo&&!o.closed&&o.d>=d&&o.d<=d+SEINE_NOTICE).forEach(o=>{o.closed=true;o.done=true;
    const l=`📣 <b>ADF&G:</b> the Southern District seine period on ${dlong(o.d)} is closed by emergency order, to let more fish into the lakes and streams.${o.ans==='yes'?' You’re free that day.':''}`;
    say(l);if(!quiet)digestLine(l)});
  if(!quiet){const w=F.ops.filter(o=>!o.ans&&!o.done&&o.d>d&&o.d<=d+2);if(w.length)digestLine(`⚓ Seine opener${w.length>1?'s':''} ${w.map(o=>dlabel(o.d)).join(' and ')}: sign on or pass in 📅 Bookings.`)}
}
function seineSeasonLine(s){
  const F=SN(),P=seinePlan(s),n=F.ops.length;if(!P)return;
  const l=n?`⚓ <b>Seining:</b> the Southern District seine schedule has ${n} period${n>1?'s':''} in your weeks (Monday, Wednesday and Friday, 6 AM to 10 PM). Sign on for the ones you want in 📅 Bookings: a day you sign on for is off the river. ${Seine.year(2026+s).txt}`:`⚓ <b>Seining:</b> no seine periods fall in your weeks this summer. ${Seine.year(2026+s).txt}`;
  say(l);
}
{const _fw=finishWinter;finishWinter=function(){const s=S.winter&&S.winter.s;_fw.apply(this,arguments);if(s!=null&&seinePlan(s)){seineSchedule(s);seineAnnounce(true);seineSeasonLine(s)}}}
{const _om=onMorning;onMorning=function(d){_om(d);if(!S.winter&&seinePlan(seasonOf(d))){
  const F=SN();if(F.s!==seasonOf(d))seineSchedule(seasonOf(d));
  seineAnnounce();
  const o=seineOp(d);if(o&&o.ans==='yes'&&!o.done)digestLine(`⚓ <b>Seine opener today.</b> ${S.loc==='homer'?'You’re aboard in Homer harbor.':`Be at Homer harbor by ${fmt(SEINE_MEET)} (${travelMins(S.loc,'homer')} min from here).`}`);
  const t=seineOp(d+1);if(t&&t.ans==='yes'&&!t.done)digestLine(`⚓ Tomorrow’s seine opener: be at Homer harbor by ${fmt(SEINE_MEET)}. Set the alarm early, or drive down tonight and sleep aboard.`);
}}}
// your own lane is taken on a day you signed on for (requests and moves look elsewhere)
{const _cf=conflicts;conflicts=function(d,type,asst){return _cf(d,type,asst)||(!asst&&seineSigned(d))}}

// ---- answering an opener (📅 Bookings) ----
const seineMine=d=>S.book.filter(b=>b.d===d&&b.status==='booked'&&!b.asst);
function seineOpts(o){
  const F=SN(),P=seinePlan(seasonOf(o.d)),crew=P&&P.role==='crew',trips=seineMine(o.d),opts=[];
  const word=crew?'Sign on':'Run it';
  if(o.closed) return opts;
  const taken=o.ans!=='yes'&&fishTaken(o.d,'seine');if(taken){opts.push({l:'Pass on this one',s:FISH_WHAT[taken],fn:()=>{o.ans='no';say(`⚓ You pass on the ${dlabel(o.d)} opener.`)}});return opts}
  if(o.ans==='yes'){opts.push({l:'Back out',s:crew?'The skipper finds somebody else, and remembers.':'The crew loses a day’s pay.',fn:()=>{o.ans='no';if(crew){const c=Seine.captain(seineYear(o.d),F.st).i;F.st.respect[c]=(F.st.respect[c]||0)-1}say(`⚓ You back out of the ${dlabel(o.d)} opener.`)}});return opts}
  if(!trips.length) opts.push({l:`${word} — ${dlabel(o.d)}`,s:crew?`A crew share. A long day: ${fmt(SEINE_MEET)} at the harbor, back after 10 PM.`:'Your boat, your call. A long day.',fn:()=>{o.ans='yes';say(`⚓ You’re on for the ${dlabel(o.d)} opener.`)}});
  else{
    const hand=fishHandPlan(trips);   // 41b-fishhub.js: the same choice as every commercial day
    if(hand) opts.push({l:`${word}, and hand ${trips.length>1?'your trips':`the ${trips[0].who}`} to ${hand.map(([,g])=>staffName(g)).filter((x,i,a)=>a.indexOf(x)===i).join(' and ')}`,s:'Your guides run the day. You’re paid less for those trips.',fn:()=>{fishHand(hand);o.ans='yes';say(`⚓ You’re on for the ${dlabel(o.d)} opener.`)}});
    opts.push({l:`${word}, and cancel ${trips.length>1?`${trips.length} trips`:`the ${trips[0].who}`}`,s:`You refund the deposit${trips.length>1?'s':''}. Reputation −${FISH_CANCEL_REP*trips.length}.`,fn:()=>{fishCancel(trips,`a seine opener on ${dlabel(o.d)}`);o.ans='yes';say(`⚓ You’re on for the ${dlabel(o.d)} opener.`)}});
  }
  opts.push({l:'Pass on this one',s:trips.length?'Guide your booked trip.':'',fn:()=>{o.ans='no';say(`⚓ You pass on the ${dlabel(o.d)} opener.`)}});
  return opts;
}
window.seineAns=(d,k)=>{const o=seineOp(d);if(!o||o.done||o.d<day()||(o.d===day()&&tod()>=SEINE_MEET))return;const x=seineOpts(o)[k];if(!x||x.dis)return;x.fn();sfx('tap');render()};
function seineView(){
  if(!seineOn()) return '';
  const F=SN(),d=day(),P=seinePlan(seasonOf(d)),up=F.ops.filter(o=>!o.done&&(o.d>d||o.d===d&&tod()<SEINE_MEET+60)),past=F.ops.filter(o=>o.done&&o.res);
  let h=`<div class="sect">⚓ Seine openers · ${P.role==='crew'?`crew on the ${Seine.captain(2026+seasonOf(d),F.st).boat}`:`the ${Seine.data.OWN_BOAT}`}</div>`;
  if(!up.length) h+=`<div class="todo"><span class="ck" aria-hidden="true">📣</span><div><b>No more seine periods in your weeks</b><span>The Southern District runs Monday, Wednesday and Friday from mid-June; after July only in a fair pink year.</span></div></div>`;
  else h+=`<p class="small-note" style="font-size:12px;color:var(--mute)">ADF&G’s regular schedule. It can hold a period closed with a few days’ notice.</p>`;
  up.forEach(o=>{const trips=seineMine(o.d),stt=o.ans==='yes'?'✅ You’re on':o.ans==='no'?'You passed':'Waiting for your answer';
    h+=`<div class="req"><div class="rb"><p><b>⚓ ${dlong(o.d)}</b>, 6 AM to 10 PM · ${o.run}. <b>${stt}</b>.</p>${trips.length&&o.ans!=='no'?`<p style="font-size:13px;color:var(--warn)">You’re booked that day: ${trips.map(b=>`${TRIPS[b.type].ic} the ${b.who}, ${fmt(TRIPS[b.type].start)}`).join('; ')}.</p>`:''}</div>${o.ans==='no'?'':seineOpts(o).map((x,k)=>`<button class="act" onclick="seineAns(${o.d},${k})"><span class="tx"><b>${x.l}</b>${x.s?'<span>'+x.s+'</span>':''}</span></button>`).join('')}</div>`});
  if(past.length) h+=`<p class="small-note" style="font-size:12px;color:var(--mute)">This season: ${past.map(o=>`${dlabel(o.d)} ${o.res.missed?'missed the boat':o.res.stayed?'stayed in':`${grp(o.res.lbs)} lb, ${o.res.cash<0?'−':''}${$(Math.abs(o.res.cash))}`}`).join(' · ')}.</p>`;
  return h;
}
FISH_BOOK.push({id:'seine',order:2,view:()=>seineView()});
FISH_TODAY.push({id:'seine',order:2,today:()=>{if(!seineOn())return '';const o=seineOp(day());return o&&!o.closed?(o.ans==='yes'?`⚓ seine opener, Homer harbor by ${fmt(SEINE_MEET)}${o.done?' ✅':''}`:o.ans==='no'?'':'⚓ a seine period (not signed on)'):''}});
const seineDot=()=>{if(!seineOn())return false;const d=day();return SN().ops.some(o=>!o.ans&&!o.done&&o.d>d&&o.d<=d+2)};

// ---- the day ----
function seineTicket(o,late){
  const F=SN(),P=seinePlan(seasonOf(o.d)),d=o.d;
  return {role:P.role,route:P.route,state:F.st,md:o.md,dow:o.dow,year:seineYear(d),season:seasonOf(d),wind:windKt(d),sky:S.wx[d]||'cloud',
    cash:Math.round(S.money),energy:S.energy,costMult:DF().cost,bad:DF().bad,late,diesel:seineDiesel(),dayTxt:dlong(d),d};
}
const SEINE_FLOOR=-1500;         // the opener's bills never take cash below this (the boat owner carries you to the next fish ticket)
function seineApply(rep,o){
  const F=SN();F.st=rep.state;
  let c=Math.round(rep.cashDelta||0);
  if(c<0){const ok=Math.max(0,S.money-SEINE_FLOOR);if(-c>ok){say('🤝 The boat owner carries the rest of the bill until your next fish ticket.');c=-ok}}
  money(c);
  if(c<0)S.stats.spent+=-c;
  (rep.fines||[]).forEach(f=>{S.stats.fines+=f.fine;S.stats.viol=(S.stats.viol||0)+1});
  if(rep.energyDelta)adj('energy',rep.energyDelta);
  if(rep.repDelta)adj('rep',rep.repDelta);
  if(rep.fished&&rep.role==='crew'&&rep.fish.sockeye>20)addFish(Math.min(3,Math.floor(rep.fish.sockeye/200)+1));   // a few sockeye home for the freezer
  if(rep.cancels>0){const b=S.book.filter(x=>x.d===o.d+1&&x.status==='booked'&&!x.asst)[0];if(b){b.status='cancelled';S.stats.cancelled++;say(`📵 With your wrist in a splint you can’t run the ${b.who}’s ${TRIPS[b.type].n.toLowerCase()} tomorrow. You call them and refund the deposit.`)}}
  // your own tender or plant in Kachemak Bay buys the catch at your own price (41b-fishhub.js, 46-tender.js)
  const rt=rep.delivery?fishDeliver(rep.delivery):null;
  if(rt){money(rt.diff);c+=rt.diff;rep.routed=rt;rt.lines.forEach(l=>say(l))}
  o.done=true;o.res={cash:c,lbs:rep.lbs,gross:rep.gross,missed:rep.missed,stayed:rep.stayed,role:rep.role,events:rep.events.map(e=>e.id)};
  const T=S.stats.seine=S.stats.seine||{ops:0,cash:0,lbs:0};if(!rep.missed&&!rep.stayed)T.ops++;T.cash+=c;T.lbs+=rep.lbs;
  if(rep.end>tod())pass(rep.end-tod());
  return rep;
}
// illustrations: the module reports what happened as events (Seine.data.EVENTS); the worst one that has a picture shows
function seineArt(evs){if(typeof artOn!=='function'||!artOn()||!evs||!evs.length)return '';return artFirst(evs.map((e,i)=>({e,i})).sort((a,b)=>(b.e.sev||0)-(a.e.sev||0)||a.i-b.i).map(x=>()=>artSlot('event',()=>fishArtCtx(x.e.id,'seine'),{deco:true})))}
let SEINE_RUN=null;
function seineStart(o){
  const late=Math.max(0,tod()-SEINE_MEET);
  SEINE_RUN=Seine.start({ticket:seineTicket(o,late),host:{
    show:(t,h,b,lock,meta)=>modal(t,seineArt(meta&&meta.events)+h,b,lock),
    rand:()=>Math.random(),
    onFinish:rep=>{SEINE_RUN=null;seineApply(rep,o);seineAfter(rep)},
  }});
}
// the long day is over: sleep aboard in the harbor, or drive home if there's time
function seineAfter(rep){
  const m=travelMins('homer','shop'),home=tod()+m<1430;
  render();
  modal('🌙 Back in Homer harbor',`${rep.routed?rep.routed.lines.map(l=>`<p>${l}</p>`).join(''):''}<p>${rep.missed?'The day is yours after all.':rep.stayed?'The wind howls in the rigging all day.':'The tender’s lights fade behind the Spit. Hose down the deck, coil the lines, eat something.'} It’s ${fmt(S.t)}.</p>`,
    [{l:'Sleep aboard in the harbor',s:'A bunk on the boat. You wake up in Homer, not quite rested.',fn:()=>endDay('aboard')},
     ...(home?[{l:`Drive home to Soldotna — ${m} min`,s:'Your own bed, a late night.',fn:()=>{pass(m);S.loc='shop';say('🚗 You drive home up the Sterling Highway, windows down to stay awake.');endDay('home')}}]:[]),
     ...(rep.missed||rep.stayed?[{l:'Stay up and make something of the day',s:'You’re in Homer.',fn:()=>{}}]:[])],true);
}
function seineGo(o){
  fishClaim(o.d,'seine');
  const go2=()=>{say(`⚓ ${seinePlan(seasonOf(o.d)).role==='crew'?`You walk down the ramp to the ${Seine.captain(seineYear(o.d),SN().st).boat}’s slip`:`You walk down to the ${Seine.data.OWN_BOAT}`} at ${fmt(S.t)}.`);seineStart(o)};
  if(S.loc==='homer') return go2();
  const m=travelMins(S.loc,'homer');
  transition('⚓','Heading to Homer harbor',`${m} minutes`,()=>{pass(m);S.loc='homer';go2()});
}
{const _ah=actionsHere;actionsHere=function(){
  const a=_ah();if(!seineOn()||S.trip||SEINE_RUN)return a;
  const d=day(),o=seineOp(d),m=tod(),P=seinePlan(seasonOf(d));
  if(o&&o.ans==='yes'&&!o.done){
    const tm=S.loc==='homer'?0:travelMins(S.loc,'homer'),arr=m+tm,late=arr-SEINE_MEET,crew=P.role==='crew';
    if(m<16*60&&!fishTaken(d,'seine')) a.unshift({ic:'⚓',l:crew?`Seine opener: meet the ${Seine.captain(seineYear(d),SN().st).boat} at Homer harbor`:`Seine opener: run the ${Seine.data.OWN_BOAT} from Homer harbor`,
      s:`${S.loc==='homer'?'You’re in Homer.':`${tm} min to Homer.`} ${late>0?(crew&&late>SEINE_WAIT?'The boat leaves without you after 6:30.':`You’ll be ${late} min late.`):`On time for ${fmt(SEINE_MEET)}.`} A long day: back after 10 PM.`,cat:'comm',cls:'primary',fn:()=>seineGo(o)});
  }
  const t=seineOp(d+1);
  if(t&&t.ans==='yes'&&!t.done&&S.loc==='shop'&&m>=17*60&&m+travelMins('shop','homer')<1430)
    a.push({ic:'🛏️',l:'Drive to Homer tonight and sleep aboard',s:`${travelMins('shop','homer')} min. A bunk on the boat, so you’re there for tomorrow’s ${fmt(SEINE_MEET)} start. Less rest than your own bed.`,cat:'rest',fn:()=>{const tm=travelMins('shop','homer');transition('⚓','Heading to Homer harbor',`${tm} minutes`,()=>{pass(tm);S.loc='homer';say('⚓ You drive down to Homer and crawl into a bunk on the boat.');endDay('aboard')})}});
  if(S.loc==='homer'&&m>=18*60&&!(o&&o.ans==='yes'&&!o.done)) a.push({ic:'🛏️',l:'Sleep aboard in the harbor',s:'A bunk on the boat. You wake up in Homer.',cat:'rest',fn:()=>endDay('aboard')});
  return a}}
// a night in a bunk: less rest than home; a missed opener counts against you
{const _on=onNight;onNight=function(where,notes,d){
  _on(where,notes,d);
  if(where==='aboard'){adj('energy',15);notes.push('⚓ You sleep in a bunk on the boat in Homer harbor, gulls on the wheelhouse roof.')}
  const o=seineOp(d);
  if(o&&o.ans==='yes'&&!o.done){const F=SN(),P=seinePlan(seasonOf(d));o.done=true;o.res={cash:0,lbs:0,gross:0,missed:true,stayed:false,role:P?P.role:'crew',events:['missed_boat']};F.st.tot.missed++;
    if(P&&P.role==='crew'){const c=Seine.captain(seineYear(d),F.st).i;F.st.respect[c]=(F.st.respect[c]||0)-2;notes.push(`⚓ You never showed for the opener. ${Seine.captain(seineYear(d),F.st).name.split(' ')[0]} fished short-handed and won’t forget it.`)}
    else notes.push(`⚓ You never showed for the opener. The ${Seine.data.OWN_BOAT} stayed tied up and the crew lost a day’s pay.`)}
}}
// the to-do list and a reminder in the alert bar
{const _ti=todoItems;todoItems=function(){const it=_ti();if(!seineOn())return it;const d=day(),o=seineOp(d);
  if(o&&o.ans==='yes')it.unshift({l:'⚓ Seine opener',s:`Homer harbor, ${fmt(SEINE_MEET)}. A long day.`,ok:o.done&&!(o.res&&o.res.missed),fail:!!(o.res&&o.res.missed),urgent:!o.done&&tod()>=SEINE_MEET-120});
  if(seineDot())it.push({l:'Answer the seine openers',s:'📅 Bookings: sign on or pass.',ok:false,urgent:SN().ops.some(o=>!o.ans&&!o.done&&o.d===d+1)});
  return it}}
// the Regs tab: a row while you seine
{const _wr=weekRegRows;weekRegRows=function(){const r=_wr();if(!seineOn())return r;r.push(['⚓ Commercial seining (Lower Cook Inlet)','Southern District purse seine periods: Monday, Wednesday and Friday, 6 AM to 10 PM, from mid-June, by ADF&G announcement; after July only when the wild pink escapement allows. The hatchery special harvest areas are closed to the fleet, and no commercial salmon fishing within 500 yards of a salmon stream’s mouth. Crew need a commercial crewmember license; the skipper holds the permit card. Survival suits for everyone aboard.']);return r}}
// the end screen: one row
{const _er=endRows;endRows=function(){const r=_er();const F=S.fish&&S.fish.seine;if(!F||!F.st||!F.st.openers&&!F.st.tot.missed&&!F.st.permit)return r;const t=F.st.tot,T=S.stats.seine||{ops:0,cash:0};
  r.push(['Purse seining',`${F.st.openers} opener${F.st.openers===1?'':'s'} (${F.st.crewOps} as crew, ${F.st.skipOps} as skipper), ${grp(t.lbs)} lb delivered, ${t.fish.sockeye} sockeye and ${t.fish.pink} pinks; ${T.cash<0?'−':''}${$(Math.abs(Math.round(T.cash)))} net to you${t.water?`; ${t.water} water hauls`:''}${t.injuries?`; ${t.injuries} injur${t.injuries===1?'y':'ies'}`:''}${F.st.permit?'; you own a seine permit':''}`]);return r}}

// ---- bots and tests: a sensible policy (tools/sim style `seine`) ----
// winter: crew from the 2nd off-season; run your own on an emergency transfer once you've crewed enough and have a cushion.
function seineBotWinter(pol){
  if(!S.winter||!seineUnlocked())return null;
  const t=seineWinterTicket(),o=Seine.planOptions(t),id=pol==='crew'?'crew':(o.find(x=>x.id==='skip:transfer'&&!x.dis)&&S.money>8000?'skip:transfer':'crew');
  const x=o.find(y=>y.id===id);if(!x||x.dis||x.on)return null;const r=Seine.plan(t,id);if(r)seinePlanApply(r);return r;
}
// a day: answer what's announced (sign on only when it costs no booked trip), then work today's opener
// mode 'all' signs on for every opener and cancels the booked trips in the way (to measure what that costs)
function seineBotAnswer(mode){if(!seineOn())return;const d=day();SN().ops.filter(o=>!o.ans&&o.d>=d&&!o.done).forEach(o=>{if(o.d===d&&tod()>SEINE_MEET-90)return;
  const trips=seineMine(o.d);if(!trips.length){o.ans='yes';return}
  if(mode!=='all'){o.ans='no';return}
  const k=seineOpts(o).findIndex(x=>/cancel/.test(x.l));if(k>=0)seineOpts(o)[k].fn();else o.ans='no'})}
function seineBotDay(opts){
  seineBotAnswer(opts&&opts.mode);
  const d=day(),o=seineOp(d);if(!o||o.ans!=='yes'||o.done)return false;
  if(fishTaken(d,'seine')){o.ans='no';return false}
  fishClaim(d,'seine');
  if(S.loc!=='homer'){const m=travelMins(S.loc,'homer');pass(m);S.loc='homer'}
  const r=Seine.sim({ticket:seineTicket(o,Math.max(0,tod()-SEINE_MEET)),rand:(opts&&opts.rand)||(()=>Math.random()),policy:(opts&&opts.policy)||'careful'});
  seineApply(r.report,o);
  const m=travelMins('homer','shop');if(tod()+m<1430){pass(m);S.loc='shop';endDay('home')}else endDay('aboard');
  return true;
}
// the evening before an opener: set the alarm early (4:00 AM gets you to Homer by 5:30)
function seineBotEvening(){const t=seineOp(day()+1);if(t&&t.ans==='yes'&&!t.done){S.seineAlarm=S.seineAlarm||S.alarm;S.alarm=240}else if(S.seineAlarm){S.alarm=S.seineAlarm;delete S.seineAlarm}}
window.seineBotWinter=seineBotWinter;window.seineBotDay=seineBotDay;window.seineBotEvening=seineBotEvening;window.seineBotAnswer=seineBotAnswer;
