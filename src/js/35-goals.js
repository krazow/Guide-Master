// ============================================================
//  GUIDE MASTER, part 13 (1.14.0): season goals and big days.
//  Season goals: three a season, picked to fit the weeks you guide, shown in the 📅 Bookings tab. A goal you reach is ticked
//  off in the morning report; the rewards (word of mouth, reputation or a bonus) are paid on the season's last night, with one
//  summary line there and in the off-season summary. No pop-ups.
//  Big days: now and then a booking request comes with a target ("a 30-pound halibut for Dad's 70th", "her first king") and a
//  bonus if you get it. They ride the normal request flow: the Bookings tab and the morning report.
//  Goals are chosen with hz() (a hash, 23-fish.js), so they use no random numbers and the rest of the game rolls as before.
//  Party traits and reviews from 1.13 (b.tr, b.out.stars) feed the five-star and kids goals; an older booking without them falls back
//  to its quirks and happiness.
// ============================================================
const stDelta=k=>((S.stats&&S.stats[k])||0)-((S.st0&&S.st0[k])||0);       // this season so far (S.st0 is the season-start snapshot)
const seasonDone=s=>S.book.filter(b=>seasonOf(b.d)===s&&b.status==='done'&&!b.asst);
const hasKids=b=>(b.quirk||[]).includes('kid')||[].concat(b.tr||[],b.traits||[],b.trait||[]).some(x=>/kid|child/i.test(String(x&&(x.id||x.k)||x)))||/kids|grandkids|grandson|granddaughter/i.test(b.who||'');
const fiveStar=b=>!!b.out&&(typeof b.out.stars==='number'?b.out.stars>=5:b.out.happy>=82);
const hasWeek=(s,ids)=>weeksOf(s).some(x=>ids.includes(x));
// k(s): the target; p(s): progress (a number, or for the season-long goals true/false so far); end: only settled on the last night
const GOALS={
  limits:{ic:'🐟',n:k=>`${k} limit-outs`,s:'Trips where every client goes home with a limit.',k:()=>3,p:()=>stDelta('limits'),ok:s=>hasWeek(s,['jul1','jul2','aug','sep']),r:{wom:2}},
  fivestar:{ic:'⭐',n:k=>`${k} five-star days`,s:'Trips the clients would rate five stars.',k:()=>4,p:s=>seasonDone(s).filter(fiveStar).length,ok:()=>true,r:{cash:400}},
  clean:{ic:'⚖️',n:()=>'A clean season',s:'No citations and no warnings, all season.',end:true,p:()=>stDelta('citesTotal')===0&&stDelta('warnsTotal')===0,ok:()=>true,r:{rep:3}},
  logbook:{ic:'📓',n:()=>'Logbook never overdue',s:'Write up every trip before bed, all season.',end:true,p:()=>!(S.goals&&S.goals.fail&&S.goals.fail.logbook),ok:()=>true,r:{rep:2}},
  halibut:{ic:'⚓',n:k=>`${k} Homer halibut charters`,s:'Run them yourself, out of Homer.',k:()=>S.up&&S.up.chp?3:2,p:s=>seasonDone(s).filter(b=>b.type==='halibut').length,ok:()=>true,r:{cash:300}},
  kingrel:{ic:'👑',n:()=>'A king released the right way',s:'In the water, no lift for the photo.',k:()=>1,p:()=>stDelta('kings'),ok:s=>kingRule()!=='open'&&(hasWeek(s,['june'])&&kingRule()==='cr'||hasWeek(s,['jul1','jul2'])),r:{rep:2}},
  kids:{ic:'👨‍👩‍👧',n:()=>'A family with kids rates you five stars',s:'Patience, snacks and life jackets that fit.',k:()=>1,p:s=>seasonDone(s).filter(b=>hasKids(b)&&fiveStar(b)).length,ok:()=>true,r:{wom:2}},
  regular:{ic:'🤝',n:()=>'Win a new regular',s:'A party that wants you back next year.',k:()=>1,p:s=>(S.regs||[]).filter(g=>g.last&&g.last.s===s&&(g.trips||1)===1).length,ok:()=>true,r:{wom:2}},
  bigday:{ic:'🎯',n:()=>'Land a big-day target',s:'A request with a target, met on the water. Return calls to hear about them.',k:()=>1,p:()=>stDelta('bigHit'),ok:()=>true,r:{cash:300}},
  trout:{ic:'🌈',n:k=>`${k} rainbows on the upper river`,s:'Landed and released on your trout floats.',k:s=>hasWeek(s,['sep'])?60:40,p:s=>seasonDone(s).filter(b=>b.type==='trout').reduce((a,b)=>a+(b.out.fish||0),0),ok:()=>true,r:{cash:250}},
};
const GOAL_N=3;
const goalSalt=()=>{const w=S.wxd&&S.wxd[0];return w?(w.temp||0)*7+(w.wind||0):3};
// this season's goals (made the first time anyone asks, from a hash of the season and the game, so no random numbers are used)
function goalsFor(s){
  if(S.goals&&S.goals.s===s&&Array.isArray(S.goals.list)) return S.goals;
  const salt=goalSalt(),ids=Object.keys(GOALS).filter(id=>{try{return GOALS[id].ok(s)}catch(e){return false}}).map((id,i)=>[id,hz(s+1,salt,i*13+7)]).sort((a,b)=>a[1]-b[1]).map(x=>x[0]);
  // at most one of the two "all season" goals
  const pickd=[];for(const id of ids){if(pickd.length>=GOAL_N)break;if(GOALS[id].end&&pickd.some(x=>GOALS[x].end))continue;pickd.push(id)}
  S.goals={s,list:pickd.map(id=>({id,k:GOALS[id].k?GOALS[id].k(s):1})),met:{},fail:{},paid:false};
  return S.goals;
}
const goalName=g=>{const G=GOALS[g.id];return G?G.n(g.k):g.id};
const rewardTxt=r=>[r.cash?`${$(r.cash)} bonus`:'',r.rep?`rep +${r.rep}`:'',r.wom?'word of mouth (more bookings for the rest of the summer)':''].filter(Boolean).join(', ');
function goalState(g,s){const G=GOALS[g.id];if(!G)return {v:0,met:false};let v;try{v=G.p(s)}catch(e){v=0}
  if(G.end) return {v,met:!!v,txt:v?'so far, so good':'missed'};
  return {v,met:v>=g.k,txt:`${Math.min(v,g.k)}/${g.k}`};}
// each night: tick off what was reached today, note a broken logbook, and on the season's last night settle up
function goalsNight(notes,d){
  if(S.winter||S.over) return;
  const s=seasonOf(d),G=goalsFor(s);if(G.paid) return;
  if(S.overdue>0) G.fail.logbook=true;
  G.list.forEach(g=>{const D=GOALS[g.id];if(!D||D.end||G.met[g.id])return;if(goalState(g,s).met){G.met[g.id]=true;notes.push(`🎯 Season goal reached: <b>${D.ic} ${goalName(g)}</b>. Reward on the season’s last night: ${rewardTxt(D.r)}.`)}});
  if(sday(d)!==SEASON-1) return;
  let cash=0,rep=0,wom=0,n=0;
  G.list.forEach(g=>{const D=GOALS[g.id];if(!D)return;const st=goalState(g,s);if(D.end)G.met[g.id]=st.met;if(!G.met[g.id])return;n++;cash+=D.r.cash||0;rep+=D.r.rep||0;wom+=D.r.wom||0});
  if(cash){money(cash);S.stats.goalCash=(S.stats.goalCash||0)+cash}
  if(rep)adj('rep',rep);if(wom)S.wom=(S.wom||0)+wom;
  G.paid=true;S.goalLog=S.goalLog||[];S.goalLog.push({s,n,of:G.list.length,cash,rep,wom,ids:G.list.map(g=>g.id)});
  notes.push(`🎯 <b>Season goals: ${n} of ${G.list.length} met</b>${n?`: ${[cash?`${$(cash)} in bonuses`:'',rep?`rep +${rep}`:'',wom?'more word of mouth':''].filter(Boolean).join(', ')}`:'. Next year.'}`);
}
{const _onNight=onNight;onNight=function(where,notes,d){_onNight(where,notes,d);goalsNight(notes,d)}}
// 📅 Bookings tab
function goalsView(){
  if(!S||S.over) return '';
  const s=seasonOf(seasonFirst()),G=goalsFor(s);
  return `<div class="sect">🎯 Season goals · ${2026+s}</div>`+G.list.map(g=>{const D=GOALS[g.id];if(!D)return '';const st=goalState(g,s),met=G.met[g.id]||(!D.end&&st.met),miss=D.end&&!st.v;
    return `<div class="todo goal"><span class="ck" aria-hidden="true">${met&&!D.end?'✅':miss?'❌':'🎯'}</span><div><b>${D.ic} ${goalName(g)}</b><span>${D.s} ${D.end?(miss?'Missed this year.':'So far, so good.'):`${st.txt}${met?' · reached':''}`} · Reward: ${rewardTxt(D.r)}.</span></div></div>`}).join('');
}
function goalsWinterLine(s){const L=(S.goalLog||[]).find(x=>x.s===s);if(!L)return '';
  return `<p>🎯 <b>Season goals:</b> ${L.n} of ${L.of} met${L.n?` (${[L.cash?$(L.cash):'',L.rep?`rep +${L.rep}`:'',L.wom?'word of mouth':''].filter(Boolean).join(', ')})`:''}.</p>`}
{const _endRows=endRows;endRows=function(){const r=_endRows(),L=S.goalLog||[];if(L.length)r.push(['Season goals',`${L.reduce((a,x)=>a+x.n,0)} of ${L.reduce((a,x)=>a+x.of,0)} met${S.stats.bigHit?` · ${S.stats.bigHit} big-day target${S.stats.bigHit>1?'s':''} hit (${$(S.stats.bigPaid||0)})`:''}`]);return r}}

// ---- big days: requests with a target ----
const BIG={
  halibut:[{k:'hal30',txt:'a 30-pound halibut for Dad’s 70th',bonus:300},{k:'halwall',txt:'a halibut bigger than the one on Grandpa’s wall',bonus:300}],
  king:[{k:'first',txt:'her first king',bonus:250},{k:'photo',txt:'one king for the family album',bonus:250}],
  reds:[{k:'freezer',txt:'a limit for everyone: the freezer back home is empty',bonus:200}],
  silver:[{k:'smoker',txt:'a limit of silvers for the smoker back home',bonus:200}],
  trout:[{k:'leopard',txt:'a 25-inch leopard rainbow, photographed wet',bonus:200}],
};
const BIG_P=.2;
{const _makeRequest=makeRequest;
  makeRequest=function(){const r=_makeRequest();
    if(r&&r.kind==='trip'&&!r.asst&&BIG[r.type]&&!(r.type==='halibut'&&halClosed(r.d))&&hz(r.d,(S.reqN||0)+(S.t%997),11)<BIG_P){
      const L=BIG[r.type],x=L[Math.floor(hz(r.d,S.reqN||0,12)*L.length)%L.length];r.big={k:x.k,txt:x.txt,bonus:x.bonus}}
    return r};}
function bigReqLine(r){return r&&r.big?`<p class="small-note" style="font-size:13px">🎯 <b>A big day:</b> they want ${r.big.txt}. They’ll add a <b>${$(r.big.bonus)} bonus</b> if you get it.</p>`:''}
function bigMet(b){const o=b.out||{},n=Math.max(1,b.n);
  switch(b.big.k){
    case 'hal30':case 'halwall':return !halClosed(b.d)&&o.fish>=Math.ceil(n*1.2);
    case 'first':case 'photo':return (b.kings||0)>=1;
    case 'freezer':return o.fish>=n*Math.min(3,S.limit);
    case 'smoker':return o.fish>=2*n;
    case 'leopard':return o.fish>=n*7&&o.happy>=65;
  }return false}
function bigAfterTrip(b,notes){
  if(!b.big||b.big.done!=null) return;
  const ok=bigMet(b);b.big.done=ok;
  if(ok){money(b.big.bonus);S.stats.bigHit=(S.stats.bigHit||0)+1;S.stats.bigPaid=(S.stats.bigPaid||0)+b.big.bonus;if(b.out)b.out.net+=b.big.bonus;
    notes.push(`🎯 They came for ${b.big.txt}, and they got it. A <b>${$(b.big.bonus)} bonus</b> on top of the tip.`)}
  else notes.push(`🎯 They came for ${b.big.txt}. Not today; they shake your hand anyway.`);
}
{const _sat=storyAfterTrip;storyAfterTrip=function(b,happy,notes){_sat(b,happy,notes);bigAfterTrip(b,notes)}}
HELP.splice(3,0,['🏅','Season goals & big days','Each season has three goals, in the <strong>📅 Bookings</strong> tab: limit-outs, five-star days, a clean record, Homer charters and more. The morning report tells you when you reach one, and the rewards (a bonus, reputation or word of mouth) come on the season’s last night. Some booking requests come with a target, like <em>a 30-pound halibut for Dad’s 70th</em>: get it and they add a bonus.']);
