// ---------------- the game loop ----------------
// Time only moves when the player does something. An action calls pass(minutes); travel calls go(dest);
// sleeping calls endDay(where). After every tap the engine checks for a loss and for staying up past midnight.
//
// Your content (20-world.js, 21-story.js) provides these functions:
//   newState()            the game-specific part of S (stats, inventory…)
//   onNewGame()           intro narration / welcome modal
//   onMorning(d)          start of each day
//   onNight(where,notes,d)  end of each day: eat, pay, recover… push lines to notes for the night summary
//   onTime(min)           (optional) runs every time minutes pass: hunger, timers, deliveries
//   onArrive(dest,from)   (optional) after travel
//   travelMins(from,to)   minutes between two places
//   checkLoss()           return a LOSSES key to end the game, or null

// The engine's half of S. Content fields from newState() are merged on top.
function baseState(){
  return Object.assign({name:profileName()||GAME.defaultName,diff:'normal',t:GAME.wake,cur:0,loc:GAME.startLoc,alarm:GAME.wake,
    log:[],prios:[],tips:{seen:[]},over:false,daily:null,achGame:[],stats:{},
    ev:{last:{},count:{},history:[],force:[],flags:{}}},newState());
}
function newGame(diff){
  clearTiles();closeModals();
  S=baseState();S.diff=DIFFS[diff]?diff:'normal';
  if(typeof DF().money==='number'&&'money' in S) S.money=DF().money;
  uiNarr=[];tab='act';
  onNewGame();
  startDay();
}
// Let time pass. Content actions call this: pass(60) is one hour.
function pass(min){min=Math.max(0,Math.round(min||0));S.t+=min;if(typeof onTime==='function')onTime(min)}
// Runs after every player action (the ACT dispatcher calls it).
function afterAction(){
  if(!S||S.over) return;
  const loss=checkLoss();if(loss) return gameOver(loss);
  if(S.t>=(S.cur+1)*1440-1){S.t=(S.cur+1)*1440-1;endDay('collapsed')} // stayed up all night
}
function startDay(){
  const d=day();
  S.daily={money:S.money,ev:S.ev.history.length,day:d};
  onMorning(d);
  fireHook('wake',{});
}
function dayCard(d){
  const D=S.daily;if(!D||D.day!==d) return '';
  const dm=Math.round(S.money-D.money);
  const evs=S.ev.history.slice(D.ev).map(h=>{const e=EV.find(x=>x.id===h.id);return e&&e.tile?e.tile[0]:'📍'});
  const parts=['money' in S?`💵 ${dm>=0?'+':'−'}$${Math.abs(dm)}`:'',...(typeof daySummary==='function'?daySummary(d):[])].filter(Boolean);
  return `<div class="today"><b>${dayName(d)} in review</b>${parts.join(' · ')}${evs.length?`<br>Events: ${evs.join(' ')}`:''}</div>`;
}
// End the day. where: 'home' (went to bed), 'collapsed' (stayed up past midnight), or any string your content uses.
function endDay(where){
  if(!S||S.over) return;
  const d=day(),notes=[];
  closeModals();
  onNight(where,notes,d);
  fireHook('night',{where,notes});
  const card=dayCard(d);
  achCheck({night:true,where});
  if(S.over) return;
  const loss=checkLoss();if(loss) return gameOver(loss);
  if(d+1>=GAME.days) return finish();
  S.cur=d+1;S.t=S.cur*1440+S.alarm;uiNarr=[];
  // One MORNING REPORT replaces the night summary and the pop-ups the new morning would have opened: what happened overnight,
  // events, reminders, and any booking request (which waits in the Bookings tab). Decisions that need an answer queue behind it.
  const night=card+notes.map(n=>`<p>${n}</p>`).join('');
  DIGEST={night,items:[],lines:[],held:[],open:false,from:d};
  startDay();
  const D=DIGEST;DIGEST=null;
  morningReport(D,d);
  render();
}
function digestLine(l){if(DIGEST)DIGEST.lines.push(l)}
function morningReport(D,d){
  D.open=true;
  const seen=new Set(),sec=(h,b)=>b?`<div class="sect">${h}</div>${b}`:'';
  const items=D.items.filter(it=>{const k=it.title+'|'+(it.lines||[]).join('|');if(it.title==='Booking request'||seen.has(k))return false;seen.add(k);return true});
  const ev=items.map(it=>`<div class="dig"><span class="di" aria-hidden="true">${it.ic}</span><div><b>${it.title}</b>${(it.lines||[]).map(l=>`<p>${l}</p>`).join('')}</div></div>`).join('');
  const rq=(S.reqs||[]).length;
  const lines=D.lines.map(l=>`<p>${l}</p>`).join('');
  const body=`<div class="digest">${sec(`🌙 ${dayName(d)} night`,D.night)}${sec('☀️ This morning',ev+lines)}${rq?`<div class="dig"><span class="di" aria-hidden="true">📞</span><div><b>${rq} booking request${rq>1?'s':''} waiting</b><p>${(S.reqs||[]).map(q=>`The ${q.r.who}: ${reqKey(q.r)}, ${dlabel(q.r.d)}`).join('<br>')}</p></div></div>`:''}</div>`;
  modal(`☀️ Morning report · ${dayName(S.cur)}`,body,[{l:`☀️ Wake up: ${dayName(S.cur)}, ${fmt(S.t)}`,fn:()=>{}},...(rq?[{l:`📞 Review requests in Bookings`,s:'They wait a day or two.',fn:()=>setTab('book')}]:[])]);
  sfx('info');
  D.held.forEach(q=>modal(...q));
}
// Travel. Long trips get the full-screen transition.
function go(dest){
  if(!L[dest]||dest===S.loc) return;
  const from=S.loc,m=travelMins(from,dest);
  const arrive=()=>{
    pass(m);S.loc=dest;uiNarr=[];
    say(`${L[dest].ic} You get to ${L[dest].name}${m?` (${m} min)`:''}.`);
    fireHook('travel',{from,to:dest,sub:`On the way to ${L[dest].name}`});
    fireHook('arrive',{at:dest,from,sub:`At ${L[dest].name}`});
    if(typeof onArrive==='function') onArrive(dest,from);
    afterAction();if(S&&!S.over)render();
  };
  if(m>=GAME.travelAnim) transition(L[dest].ic,`Heading to ${L[dest].name}`,`${m} minutes`,arrive); else arrive();
}
