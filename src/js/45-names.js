// ============================================================
//  GUIDE MASTER, part 19: names for your cabin and your boats.
//  The cabin carries the player's name ("Krazow’s Cabin": always ’s, so "James’s Cabin"; "Your Cabin" with no name picked). It is
//  worked out when shown, so renaming yourself in Settings renames the cabin everywhere.
//  The boats carry the names the player gives them: your jet sled and drift boat (S.names.sled, .drift), the assistant guide's sled
//  (S.names.asst) and the outfit's extra boats (S.biz.boats[].name, 36-business.js). The buddy's loaner has a fixed name. A boat
//  without a name reads as before ("the jet sled"). Names are given in sheets the player opens: "✏️ Name your boats" at the
//  Shop & Cabin, after buying a new sled or drift boat (24-career.js upgradeModal), and the ✏️ chips on the Outfit page. An extra
//  outfit boat comes with a suggested name. No pop-up at the start of a game.
//
//  Save state: S.names {sled, drift, asst} ('' until named; old saves get the empty names from fillDefaults, no schema bump) and
//  S.biz.boats[].name. Suggestions come from a hash of the save, never Math.random(), so naming a boat doesn't change anyone's luck.
// ============================================================
const BOAT_NAME_MAX=24;
const LOANER_NAME='Rust Bucket II';   // the buddy's loaner: nobody asks what happened to the first one
const BOAT_IDEAS={
  sled:['Reel Therapy','Sockeye Express','Kenai Rocket','Silver Bullet','Jet Lag','Tight Lines','Midnight Sun','Skilak Stinger','Red Rover','Knot Working','Sterling Silver','Cook Inlet Comet','Bear Necessity','Fish Tales','Funny Riffle','Northern Exposure'],
  drift:['Lazy Oar','Rainbow Chaser','Easy Eddy','Driftwood','Riffle Rose','Slow Water','Bead Bandit','Fly By','Upper Kenai Queen','Willow','Oarsome','Spruce Goose','Cooper Kettle','Dolly Varden'],
};
const BOAT_KINDS={sled:{n:'jet sled',ic:'🚤'},drift:{n:'drift boat',ic:'🛶'}};

// ---- the cabin ----
function cabinName(){
  const n=String(typeof currentName==='function'?currentName():'').replace(/\s+/g,' ').trim().slice(0,20);
  return !n||n===GAME.defaultName?'Your Cabin':`${n}’s Cabin`;
}

// ---- state ----
const _newStateNames=newState;
newState=function(){return Object.assign(_newStateNames(),{names:{sled:'',drift:'',asst:''}})};
const NAMES=()=>{if(!S.names||typeof S.names!=='object')S.names={};return fillDefaults(S.names,{sled:'',drift:'',asst:''})};

// ---- cleaning a name: no HTML, no braces, 24 characters, letters first ----
function cleanBoatName(raw){
  const n=String(raw==null?'':raw).replace(/<[^>]*>/g,'').replace(/[\u0000-\u001f\u007f]/g,'').replace(/\s+/g,' ').trim();
  if(!n) return {err:'Give her a name (or keep the one she has).'};
  if([...n].length>BOAT_NAME_MAX) return {err:`Keep it to ${BOAT_NAME_MAX} characters or fewer.`};
  if(!/^[\p{L}\p{N}][\p{L}\p{N} '’.,!?#&\-]*$/u.test(n)) return {err:'Letters, numbers, spaces and simple punctuation only.'};
  return {name:n};
}

// ---- your boats, by key: 'sled', 'drift', 'asst' (the assistant guide's sled), 'b<id>' (an outfit boat) ----
function boatEntries(){
  if(!S) return [];
  const N=NAMES(),out=[{key:'sled',kind:'sled',label:'Your jet sled',name:N.sled},{key:'drift',kind:'drift',label:'Your drift boat',name:N.drift}];
  if(S.up&&S.up.asst) out.push({key:'asst',kind:'sled',label:'Your assistant’s sled',name:N.asst});
  (S.biz&&Array.isArray(S.biz.boats)?S.biz.boats:[]).forEach(b=>out.push({key:'b'+b.id,kind:b.kind==='drift'?'drift':'sled',label:b.kind==='drift'?'Your second drift boat':'Your second jet sled',name:b.name||'',boat:b}));
  return out;
}
const boatEntry=key=>boatEntries().find(e=>e.key===key)||null;
function boatNm(key){
  if(!S||!key) return '';
  if(key==='loaner') return LOANER_NAME;
  const e=boatEntry(key);return e&&e.name?e.name:'';
}
// the name in italics, or '' (HTML-safe)
const bName=key=>{const n=boatNm(key);return n?`<i>${esc(n)}</i>`:''};
// "the jet sled <i>Reel Therapy</i>", or just "the jet sled"
const boatRef=(key,generic)=>{const n=bName(key);return n?`${generic} ${n}`:generic};
// "<i>Reel Therapy</i>’s jet unit", or the fallback ("the jet unit")
const ofBoat=(key,part,fallback)=>{const n=bName(key);return n?`${n}’s ${part}`:fallback};
// your two boats together: "<i>A</i> and <i>B</i>", or '' when neither has a name
function boatsBoth(){const a=bName('sled'),b=bName('drift');return a&&b?`${a} and ${b}`:a?`${a} and the drift boat`:b?`The jet sled and ${b}`:''}
function setBoatName(key,name){
  const e=boatEntry(key);if(!e) return false;
  const n=uniqueBoatName(name,key);
  if(e.boat) e.boat.name=n;else NAMES()[key]=n;
  return n;
}
// unique-ish: a name another of your boats (or the loaner) already has gets a II, III…
function uniqueBoatName(name,key){
  const taken=new Set(boatEntries().filter(e=>e.key!==key&&e.name).map(e=>e.name.toLowerCase()).concat([LOANER_NAME.toLowerCase()]));
  if(!taken.has(name.toLowerCase())) return name;
  const R=['II','III','IV','V','VI','VII','VIII','IX','X'];
  for(const r of R){const base=name.slice(0,BOAT_NAME_MAX-r.length-1).trim(),n=`${base} ${r}`;if(!taken.has(n.toLowerCase()))return n}
  return name;
}
// a suggestion for this boat (the k-th one): from the save, not Math.random()
function nameHash(str){let h=0x811c9dc5;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}return h>>>0}
function boatIdea(kind,k,key){
  const used=new Set(boatEntries().filter(e=>e.key!==key&&e.name).map(e=>e.name.toLowerCase()));
  const list=BOAT_IDEAS[kind==='drift'?'drift':'sled'],free=list.filter(n=>!used.has(n.toLowerCase())),L2=free.length?free:list;
  return L2[(nameHash(`${S&&S.name||''}|${key||kind}|${S&&S.years||0}`)+(k||0))%L2.length];
}

// ---- which boat a trip runs on ----
// yours: the sled (sockeye, silvers, June kings) or the drift boat (trout floats); the loaner on a day you rented it; none for halibut
// (the charter boat). A staff trip takes the extra boats in order (the outfit's, then the assistant's sled), then whichever of yours is free.
function tripBoatKey(b){
  if(!b||!S) return null;
  const k=b.type==='trout'?'drift':b.type==='halibut'?null:'sled';
  if(!k) return null;
  if(b.asst) return staffBoatKey(b,k);
  return typeof loanerToday==='function'&&loanerToday()&&b.d===S.cur?'loaner':k;
}
function staffBoatKey(b,k){
  const extra=(S.biz&&Array.isArray(S.biz.boats)?S.biz.boats:[]).filter(x=>(x.kind==='drift'?'drift':'sled')===k).map(x=>'b'+x.id);
  if(k==='sled'&&S.up&&S.up.asst){if(b.g==null)extra.unshift('asst');else extra.push('asst')}
  const same=S.book.filter(x=>x.d===b.d&&x.asst&&x.status!=='cancelled'&&(x.type==='trout'?'drift':x.type==='halibut'?null:'sled')===k).sort((x,y)=>x.id-y.id);
  const i=same.indexOf(b);
  return i>=0&&i<extra.length?extra[i]:k;
}
const tripBoatGeneric=b=>b.type==='trout'?'drift boat':b.type==='halibut'?'charter boat':'jet sled';
// the sled you're running today: yours, or the loaner
const sledKey=()=>S&&typeof loanerToday==='function'&&loanerToday()?'loaner':'sled';
// "Back at the dock" (22-trips.js): the named boat goes back on the trailer
function dockBoatLine(b){const key=tripBoatKey(b);return key&&boatNm(key)?`<p class="small-note" style="color:var(--mute)">⚓ ${bName(key)} goes back on the trailer.</p>`:''}
// "the jet sled <i>Reel Therapy</i>" for this trip (the loaner: "the loaner <i>Rust Bucket II</i>")
function tripBoatRef(b){const key=tripBoatKey(b);return key==='loaner'?`the loaner ${bName('loaner')}`:boatRef(key,'the '+tripBoatGeneric(b))}

// ---- the naming sheets ----
let BNV='';
window.boatNameInput=v=>{BNV=v};
// o: {value, err, k (which suggestion), intro}
function boatNameModal(key,then,o){
  o=o||{};const e=boatEntry(key),back=()=>{if(then)setTimeout(then,0)};
  if(!e){back();return}
  BNV=o.value!=null?o.value:(e.name&&!o.k?e.name:boatIdea(e.kind,o.k||0,key));
  const what=e.label.replace(/^Your /,'your ');
  modal(`${BOAT_KINDS[e.kind].ic} ${e.name?'Rename':'Name'} ${what}`,`<p>${o.intro||(e.name?`She’s <i>${esc(e.name)}</i> now. Every guide on the river knows a boat by her name.`:'Every guide on the river knows a boat by her name. Type one, or take the idea below.')}</p>
    <input class="nm-in" id="bnIn" maxlength="${BOAT_NAME_MAX}" autocomplete="off" aria-label="A name for ${esc(what)}" value="${esc(BNV)}" oninput="boatNameInput(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();MBTN(0)}">
    ${o.err?`<div style="color:var(--bad);font-size:13px;margin-top:6px">${esc(o.err)}</div>`:`<div style="color:var(--mute);font-size:12px;margin-top:6px">Up to ${BOAT_NAME_MAX} characters. You can rename her later.</div>`}`,
    [{l:'Save the name',fn:()=>{const r=cleanBoatName(BNV);if(r.err)return setTimeout(()=>boatNameModal(key,then,Object.assign({},o,{value:BNV,err:r.err})),0);
        const old=e.name,n=setBoatName(key,r.name);
        if(n&&n!==old)say(old?`✏️ ${e.label} <i>${esc(old)}</i> is <i>${esc(n)}</i> now. New decals on the bow.`:`✏️ ${e.label} is <i>${esc(n)}</i> now. Fresh letters on the bow.`);
        back()}},
     {l:'🎲 Another idea',s:'A different suggestion.',fn:()=>setTimeout(()=>boatNameModal(key,then,Object.assign({},o,{k:(o.k||0)+1,value:null,err:null})),0)},
     {l:e.name?'Keep the name':'Not now',fn:back}]);
  setTimeout(()=>{const i=document.getElementById('bnIn');if(i){i.focus();i.select()}},60);
}
window.boatNameModal=boatNameModal;
// every boat you have, one button each
function boatNamesModal(back){
  const again=()=>boatNamesModal(back);
  modal('✏️ Your boats’ names',`<p style="font-size:13px;color:var(--mute)">Name or rename any of them. The names show on your trips, at the dock, in the shop and on the end screen.</p>`,
    boatEntries().map(e=>({l:`${BOAT_KINDS[e.kind].ic} ${e.label}: ${e.name?`<i>${esc(e.name)}</i>`:'no name yet'}`,s:e.name?'Rename her.':'Give her a name.',fn:()=>setTimeout(()=>boatNameModal(e.key,again),0)}))
      .concat([{l:'Done',fn:()=>{if(back)setTimeout(back,0)}}]));
}
window.boatNamesModal=boatNamesModal;
// after buying a new sled, drift boat or the assistant's sled in the off-season planner (24-career.js): name it, then back to the planner
function boatAfterBuy(id,then){
  const key=id==='sled'||id==='drift'||id==='asst'?id:null;
  if(!key||!S||!S.up||!S.up[id]){if(then)then();return}
  const e=boatEntry(key);
  boatNameModal(key,then,{intro:e&&e.name?`A new boat. Keep the name <i>${esc(e.name)}</i>, or give her a new one.`:'A new boat deserves a name. Type one, or take the idea below.'});
}
// the Shop & Cabin's button (no time, no money)
function boatNameAction(){
  const un=['sled','drift'].filter(k=>!boatNm(k));
  return {ic:'✏️',l:un.length===2?'Name your boats':un.length?`Name your ${BOAT_KINDS[un[0]].n}`:'Boat names',
    s:un.length?`Free, a minute. ${un.length===2?'Your jet sled and drift boat have':`Your ${BOAT_KINDS[un[0]].n} has`} no name yet.`:`${boatsBoth()}. Rename one any time.`,
    cat:'work',fn:()=>boatNamesModal()};
}
{const _actionsHere=actionsHere;
  actionsHere=function(){const a=_actionsHere();if(S&&!S.winter&&!S.trip&&S.loc==='shop')a.push(boatNameAction());return a};}

// ---- an outfit boat comes with a suggested name ----
{const _bizBuyBoat=bizBuyBoat;
  bizBuyBoat=function(k){
    const ok=_bizBuyBoat(k);
    if(ok){const b=S.biz.boats[S.biz.boats.length-1];if(b&&!b.name){b.name=uniqueBoatName(boatIdea(k,0,'b'+b.id),'b'+b.id);say(`✏️ You letter <i>${esc(b.name)}</i> on her bow. Rename her on the Outfit page if you like.`)}}
    return ok};}

// ---- the end screen ----
function boatsEndText(){
  const named=boatEntries().filter(e=>e.name);
  return named.length?named.map(e=>`<i>${esc(e.name)}</i> (${e.label.replace(/^Your /,'')})`).join(', '):'';
}
{const _endRows=endRows;
  endRows=function(){
    const rows=_endRows(),c=rows.find(r=>r[0]==='The cabin');
    if(c) c[0]=esc(cabinName());
    const bt=boatsEndText();if(bt) rows.push(['Your boats',bt]);
    return rows};}

// ---- Help: the cabin's section carries its name ----
{const h=typeof HELP!=='undefined'&&HELP.find(x=>x[3]==='cabin');if(h)Object.defineProperty(h,1,{get:()=>cabinName(),enumerable:true,configurable:true})}
