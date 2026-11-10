// ---------------- random events ----------------
// defEvent({
//   id:'found_cash',             unique id (saved in S.ev, so don't rename casually: see MIGRATIONS)
//   hook:'arrive',               when it can fire: 'wake' | 'arrive' | 'travel' | 'night' | any name you fireHook() yourself
//                                (or an array of hooks)
//   tile:['💵','Found $20','good'],  icon, title, kind for the toast
//   chance:0.1,                  0–1, or a function (ctx)=>number
//   bad:true,                    scale chance by the difficulty's "bad" multiplier
//   cond:ctx=>S.loc==='park',    must be true to fire
//   cooldown:2,                  days before it can fire again
//   max:1,                       times per game
//   priority:0,                  higher runs first
//   run:ctx=>{ money(20); say('…'); return {stop:true} }  return {stop:true} to stop later events on this hook
// })
// chain('id') forces an event to fire the next time its hook runs (one event can set up another).
const EV=[];
function defEvent(e){EV.push(Object.assign({chance:0,priority:0,cooldown:0,max:99},e))}
let EV_RUNNING=null;
function chain(id,cause){if(!S.ev.force.includes(id))S.ev.force.push(id);S.ev.cause=S.ev.cause||{};S.ev.cause[id]=cause||EV_RUNNING||null}
window.forceEvent=id=>chain(id);
const HOOK_SCALE={wake:0.85}; // chance that a hook call lets any event through at all (15% of mornings stay quiet)
const HOOK_SUB={wake:'This morning',night:'Overnight'};
function fireHook(hook,ctx={}){
  ctx.hook=hook;let res=null;const popItems=[];
  const scale=HOOK_SCALE[hook]??1,open=scale>=1||Math.random()<scale;
  const list=EV.filter(e=>e.hook===hook||(Array.isArray(e.hook)&&e.hook.includes(hook))).sort((a,b)=>b.priority-a.priority);
  for(const e of list){
    const forced=S.ev.force.includes(e.id);
    if(e.cond){let ok=false;try{ok=e.cond(ctx)}catch(err){ok=false}if(!ok)continue}
    if(!open&&!forced) continue;
    if(!forced){
      if((S.ev.count[e.id]||0)>=e.max) continue;
      if(S.ev.last[e.id]!=null&&day()-S.ev.last[e.id]<e.cooldown) continue;
      const p=(typeof e.chance==='function'?e.chance(ctx):e.chance)*(e.bad?DF().bad:1);
      if(!(Math.random()<p)) continue;
    } else S.ev.force=S.ev.force.filter(x=>x!==e.id);
    S.ev.last[e.id]=day();S.ev.count[e.id]=(S.ev.count[e.id]||0)+1;S.ev.history.push({id:e.id,t:S.t});
    const nBefore=uiNarr.length,mBefore=MQ.length+(document.getElementById('mbg')?1:0);
    EV_RUNNING=e.id;let r;try{r=e.run(ctx)||{}}finally{EV_RUNNING=null}
    // events that didn't open their own modal get collected into one OK pop-up per hook call
    const ownModal=MQ.length+(document.getElementById('mbg')?1:0)!==mBefore;
    if(!ownModal) popItems.push({e,lines:uiNarr.slice(nBefore)});
    const [ic,title,kind]=e.tile||['📍',e.id.replace(/_/g,' '),'info'];
    const dup=ownModal||hook==='night'||popupsOn();   // the event's own modal, the night summary or the OK pop-up already tells the player
    const cause=S.ev.cause&&S.ev.cause[e.id],ce=cause&&EV.find(x=>x.id===cause);
    if(!dup)showTile(ic,title,ce?`Because of: ${ce.tile?ce.tile[1]:cause}`:(ctx.sub||HOOK_SUB[hook]||''),kind,hook==='night'?`${dayName(day()).slice(0,3)} night`:null);
    if(S.ev.cause)delete S.ev.cause[e.id];
    if(ctx.notes) ctx.notes.push(...uiNarr.slice(nBefore));
    if(r.stop){res=r;break}
    res=res||r;
  }
  eventPopup(hook,popItems);
  return res;
}
// ---- OK pop-up for events (on by default; Settings → Event pop-ups) ----
const POPUP_KEY=KEY('popups');
function popupsOn(){try{return localStorage.getItem(POPUP_KEY)!=='off'}catch(e){return true}}
function eventPopup(hook,items){
  if(!items.length||hook==='night'||!popupsOn()||!S||S.over) return; // night events go in the "Good night" summary
  const meta=e=>e.tile||['📍',e.id.replace(/_/g,' ')];
  const body=items.map(it=>{const m=meta(it.e);const txt=it.lines.map(l=>`<p style="margin:4px 0 0">${l}</p>`).join('');
    return items.length>1?`<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)"><span style="font-size:24px">${m[0]}</span><div><b>${m[1]}</b>${txt}</div></div>`:txt}).join('');
  const one=items.length===1?meta(items[0].e):null;
  modal(one?`${one[0]} ${one[1]}`:'📍 Meanwhile…',body||'<p></p>',[{l:'OK',fn:()=>{}}]);
}
