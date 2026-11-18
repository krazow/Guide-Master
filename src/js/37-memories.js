// ============================================================
//  GUIDE MASTER, part 7 (1.15): memories. The trophy wall, firsts, standout clients, postcards, and the catch moments.
//  · Every stretch of a trip that lands fish leaves a "best fish" with a size (a seeded hash, so it never touches Math.random):
//    the biggest per species goes on the trophy wall (S.mem.rec). Trophies (the day's big fish), kings at the boat, barn-door
//    halibut (100 lb and up), limit-outs and the first fish of a species get a short moment inside the trip sheet
//    (≤1.5 s, none with reduced motion; an optional chime, off by default) and a catch card at the dock you can save as a PNG.
//  · Firsts (S.mem.firsts): the first king, barn door, limit-out, five-star review and first fish of each species.
//  · Postcards: at the start of a new season, one or two past clients with a good day behind them write in (the morning report).
//  · The trophy wall lives in the 📜 Log tab (a switch at the top): records, firsts, standout clients, postcards, the rating.
//  Hooks: tripNext (memSheet), tripStart (memTripStart), tripEnd (memDock), startSeason (memSeasonStart), finishWinter (memSeasonOpen).
//  The star rating and its milestones live in 39-stars.js; the mentor's ride-along in 38-mentor.js.
// ============================================================

// ---- the save's memories (S.mem). Created on first use, so a new game and an old save (MIGRATIONS to:8) both get one. ----
// mentor: 'due' on a new career (no trips yet), 'riding' while he is aboard, 'done' or 'skipped' after (Help → ride again sets 'due')
function memBase(x){x=x||S;return {v:1,rec:{},firsts:{},trips:[],cards:[],cardS:-1,mentor:x&&x.stats&&x.stats.trips>0?'done':'due',feat:null,lodge:null,top:false}}
function MEM(){if(!S.mem||typeof S.mem!=='object')S.mem=memBase();return fillDefaults(S.mem,memBase())}
// a seeded number in [0,1) from a few integers: sizes and postcard picks never consume Math.random (seeded tests and the simulator stay put)
const memU=(a,b,c)=>{const x=Math.sin(a*12.9898+b*78.233+(c||0)*37.719+1.618)*43758.5453;return x-Math.floor(x)};

// ---- species and sizes ----
// lo–hi: the range of an ordinary good fish; a trophy (the stretch's big fish in 33-day.js) is above hi. Kings and barn doors are trophies too.
const FISH_SZ={
  sockeye:{n:'Sockeye',pl:'sockeye',ic:'🐟',u:'lb',lo:5,hi:9,half:true},
  silver: {n:'Silver salmon',pl:'silvers',ic:'🎣',u:'lb',lo:8,hi:13,half:true},
  rainbow:{n:'Rainbow trout',pl:'rainbows',ic:'🌈',u:'in',lo:16,hi:26},
  halibut:{n:'Halibut',pl:'halibut',ic:'⚓',u:'lb',lo:15,hi:60},
  king:   {n:'King salmon',pl:'kings',ic:'👑',u:'lb',lo:20,hi:60},
};
const SP_ORDER=['king','sockeye','silver','rainbow','halibut'];
const BARN=100;   // a "barn door" halibut
// the species a trip type lands (trip types added by other features map by name)
function speciesOf(type){
  const m={reds:'sockeye',silver:'silver',trout:'rainbow',halibut:'halibut'};
  if(m[type]) return m[type];
  const s=String(type||'');
  return /king/i.test(s)?'king':/silver|coho/i.test(s)?'silver':/trout|rainbow/i.test(s)?'rainbow':/halibut/i.test(s)?'halibut':/red|sock/i.test(s)?'sockeye':null;
}
const szTxt=(sp,z)=>{const S2=FISH_SZ[sp];if(!S2)return '';return S2.u==='in'?`${Math.round(z)}-inch`:`${S2.half&&z%1?z.toFixed(1):Math.round(z)}-pound`};
const szShort=(sp,z)=>{const S2=FISH_SZ[sp];return S2.u==='in'?`${Math.round(z)} in`:`${S2.half&&z%1?z.toFixed(1):Math.round(z)} lb`};
// the best fish of a stretch: the trophy's own size when there was one (read off the 🏆 line), else the best of n ordinary fish
function segSize(b,sg,sp){
  const X=FISH_SZ[sp];if(!X||!sg||!(sg.n>0)) return null;
  if(sp==='king'&&!/🏆 A \d/.test(sg.line||'')){const u=memU((b.id||1)*5+sg.k,b.d,sg.n+3);return {z:Math.round(22+Math.pow(u,1.6)*50),big:true}}   // a June king trip: every king is the fish of the trip, 22–72 lb (most 25–45)
  if(sg.big){const m=/🏆 A (\d+)-(?:pound|inch)/.exec(sg.line||'');return {z:m?+m[1]:Math.round(X.hi*1.15),big:true}}
  const u=memU((b.id||1)*7+sg.k,b.d,sg.n),x=Math.pow(u,1/Math.max(1,Math.min(sg.n,8)));
  let z=X.lo+(X.hi-X.lo)*(sp==='halibut'?x*x:x)*.98;
  z=X.half?Math.round(z*2)/2:Math.round(z);
  return {z:Math.min(z,X.hi-(X.half?.5:1)),big:false};
}
const isTrophy=(sp,z,big)=>!!big||sp==='king'||(sp==='halibut'&&z>=BARN);

// ---- what a trip has landed so far, and what is worth a moment ----
// t.mm: {segs:[k already counted], best:{sp,z,big}, ev:[pending moment events], lim:bool, king:bool, shown:[...]}
const mmOf=t=>t.mm||(t.mm={segs:[],best:null,ev:[],lim:false,king:false,said:[]});
function memNote(b,t,sp,z,big,why){
  const M=MEM(),mm=mmOf(t),X=FISH_SZ[sp];if(!X||!(z>0)) return;
  const rank=(s2,z2,b2)=>(s2==='king'?3:isTrophy(s2,z2,b2)?2:1)*1000+z2/FISH_SZ[s2].hi*100;
  if(!mm.best||rank(sp,z,big)>rank(mm.best.sp,mm.best.z,mm.best.big))mm.best={sp,z,big};
  const rec=M.rec[sp],year=yearOf(b.d),isNew=!rec||z>rec.z;
  if(isNew){M.rec[sp]={z,who:b.who,from:b.from,d:b.d,year,type:b.type,id:b.id};if(rec&&rec.id!==b.id)mm.ev.push({k:'record',sp,z,old:rec.z})}   // a personal best over an earlier trip's fish
  if(!M.firsts['sp_'+sp]){memFirst('sp_'+sp,b,`${X.ic} First ${X.n.toLowerCase()}: a ${szTxt(sp,z)} fish for the ${b.who}`);mm.ev.push({k:'first',sp,z})}
  // one king moment a trip: a June king trip lands several over its stretches (and the king dilemma can add one); the rest ride on the record
  if(sp==='king'){if(!mm.kingEv){mm.kingEv=1;mm.ev.push({k:'king',sp,z})}if(!M.firsts.king)memFirst('king',b,`👑 First king: about ${Math.round(z)} pounds, ${why||'at the boat'} with the ${b.who}`)}
  else if(sp==='halibut'&&z>=BARN){mm.ev.push({k:'barn',sp,z});if(!M.firsts.barn)memFirst('barn',b,`🚪 First barn door: a ${Math.round(z)}-pound halibut for the ${b.who}`)}
  else if(big) mm.ev.push({k:'trophy',sp,z});
}
function memFirst(k,b,txt){const M=MEM();if(M.firsts[k])return false;M.firsts[k]={d:b?b.d:day(),year:yearOf(b?b.d:day()),who:b?b.who:'',txt};return true}
// count every stretch that has landed since we last looked, the king at the boat, the leopard rainbow, and the limit
function memScan(b,t,key){
  const mm=mmOf(t),sp=speciesOf(b.type),bt=t.bt;
  if(bt&&bt.segs) bt.segs.forEach(sg=>{if(!sg||mm.segs.includes(sg.k))return;mm.segs.push(sg.k);
    if(b.type==='halibut'&&halClosed(b.d))return;                 // rockfish and lingcod: no halibut record
    const s=segSize(b,sg,sp);if(s)memNote(b,t,sp,s.z,s.big)});
  if(key==='king'&&!mm.king){mm.king=true;memNote(b,t,'king',Math.round(44+memU(b.id||1,b.d,3)*20),true,'at the boat')}
  if(key==='photo'&&!mm.leo){mm.leo=true;memNote(b,t,'rainbow',26,false)}
  if(bt&&bagged(b)&&!mm.lim){const f=fishersOf(b,t);if(f>0&&bt.box>=f*limOf(b)){mm.lim=true;mm.ev.push({k:'limit',sp,n:bt.box});if(!MEM().firsts.limit)memFirst('limit',b,`🧊 First limit-out: every one of the ${b.who} limited`)}}
}

// ---- the moment: a short burst inside the trip sheet ----
const MM_RANK={king:6,barn:5,trophy:4,limit:3,first:2,record:1};
const MM_GO=['king','barn','trophy','limit','first'];       // what earns a moment (a personal best alone rides along as a tag)
function momentOf(ev){
  if(!ev.some(e=>MM_GO.includes(e.k))) return null;
  const top=ev.slice().sort((a,c)=>MM_RANK[c.k]-MM_RANK[a.k])[0],X=FISH_SZ[top.sp]||FISH_SZ.sockeye,more=[...new Set(ev.map(e=>e.k))].filter(k=>k!==top.k);
  const head={king:'👑 King at the boat!',barn:'🚪 Barn door!',trophy:'🏆 Trophy!',limit:'🧊 Limit out!',record:'📏 New personal best!',first:`${X.ic} First ${X.n.toLowerCase()}!`}[top.k];
  const sub={king:`About ${Math.round(top.z)} pounds of chrome.`,barn:`A ${Math.round(top.z)}-pound halibut over the rail.`,trophy:`A ${szTxt(top.sp,top.z)} ${X.n.toLowerCase()}.`,limit:`Every rod in the boat has its limit: ${top.n} ${X.pl} in the box.`,
    record:`A ${szTxt(top.sp,top.z)} ${X.n.toLowerCase()}, your biggest yet.`,first:`A ${szTxt(top.sp,top.z)} fish. The first one goes on the wall.`}[top.k];
  const tags=more.map(k=>({record:'📏 personal best',first:'✨ a first',limit:'🧊 limit out',trophy:'🏆 trophy',barn:'🚪 barn door',king:'👑 king'}[k])).filter(Boolean);
  return {k:top.k,head,sub:sub+(tags.length?` Also: ${tags.join(', ')}.`:''),ic:top.k==='king'?'👑':top.k==='limit'?'🧊':X.ic};
}
function momentHTML(m){
  if(!m) return '';
  return `<div class="gm-moment gm-${m.k}" role="status"><svg class="gm-jump" viewBox="0 0 120 60" aria-hidden="true"><path class="gm-arc" d="M8 52 Q60 -14 112 52" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 5" opacity=".45"/><g class="gm-fishg"><path d="M0 0 q14 -9 28 0 q-14 9 -28 0z M26 0 l9 -7 v14z" fill="currentColor"/><circle cx="7" cy="-1.5" r="1.6" fill="#fff"/></g><g class="gm-spark" fill="#f4c542"><circle cx="20" cy="14" r="2.5"/><circle cx="96" cy="12" r="2"/><circle cx="60" cy="4" r="2.5"/><circle cx="80" cy="28" r="1.8"/><circle cx="38" cy="30" r="1.8"/></g></svg><div class="gm-mt"><b>${m.head}</b><span>${m.sub}</span></div></div>`;
}
// the optional chime: off by default (⚙️ Settings → Catch chime), a three-note bell, no audio files
function memChime(){if(!prefs().chime)return;try{[[880,0],[1175,.09],[1568,.18]].forEach(([f,w])=>tone(f,.45,'sine',.07,w));tone(2349,.5,'sine',.025,.2)}catch(e){}}
// called by tripNext (22-trips.js) for every view of the trip sheet: {top, foot} html (the moment, then the mentor's line)
function memSheet(b,t,key){
  let top='';
  try{memScan(b,t,key);const mm=mmOf(t);if(mm.ev.length){const m=momentOf(mm.ev);mm.said.push(...mm.ev.map(e=>e.k));mm.ev=[];top=momentHTML(m);if(m)memChime()}}catch(e){}
  const foot=typeof mentorLine==='function'?mentorLine(b,t,key):'';
  return {top,foot};
}
// tripStart (22-trips.js): the mentor climbs aboard, a lodge guest's referral fee
function memTripStart(b,t){
  if(typeof mentorBoard==='function') mentorBoard(b,t);
  if(b.lodge&&typeof starsTripStart==='function') starsTripStart(b,t);
}

// ---- the dock: the last stretches, the review's firsts, the card ----
// tripEnd (22-trips.js) calls this after the review is written. info: {C, rv, happy, fish}. Returns {top, html} for the dock sheet:
// the moment goes on top, the catch card, the rating's news and the mentor's last word below the review.
function memDock(b,t,info){
  const M=MEM(),mm=mmOf(t),C=info.C,rv=info.rv,sp=speciesOf(b.type);let html='',top='';
  try{
    memScan(b,t,'dock');
    if(C&&bagged(b)&&C.fishers>0&&C.limits===C.fishers&&!mm.lim){mm.lim=true;mm.ev.push({k:'limit',sp,n:C.fish});memFirst('limit',b,`🧊 First limit-out: every one of the ${b.who} limited`)}
    if(rv&&rv.stars===5) memFirst('five',b,`⭐ First five-star review, from the ${b.who}: “${rv.text.split('. ')[0].replace(/\.$/,'')}.”`);
    memFirst('trip',b,`🛶 First guided trip: the ${b.who}, ${b.from}`);
    // remember the trip (postcards, standout clients): the last 60
    const best=mm.best;M.trips.push({d:b.d,who:b.who,from:b.from,type:b.type,stars:rv?rv.stars:0,best:best?[best.sp,best.z]:null,tr:(b.tr||[]).slice(0,2),lim:!!mm.lim});
    if(M.trips.length>60)M.trips.splice(0,M.trips.length-60);
    const m=momentOf(mm.ev),said=mm.said.concat(mm.ev.map(e=>e.k));mm.ev=[];
    if(m){top=momentHTML(m);memChime()}
    if(said.some(k=>MM_GO.includes(k))&&best) html+=cardHTML(b,info,best,said);
  }catch(e){}
  if(typeof starsAfterTrip==='function') html+=starsAfterTrip(b,t,info);
  if(typeof mentorDock==='function') html+=mentorDock(b,t);
  return {top,html};
}

// ---- the catch card: a shareable-looking card in the dock summary, and a PNG of it ----
let CARD=null;
function cardData(b,info,best,said){
  const X=FISH_SZ[best.sp],T=TRIPS[b.type]||{n:'Trip',ic:'🎣'};
  const badges=[...new Set(said)].map(k=>({king:'👑 King',barn:'🚪 Barn door',trophy:'🏆 Trophy',limit:'🧊 Limit out',record:'📏 Personal best',first:'✨ First'}[k])).filter(Boolean);
  return {title:`${szShort(best.sp,best.z)} ${X.n.toLowerCase()}`,ic:X.ic,trip:`${T.n} · the ${b.who}`,when:`${dlong(b.d)}, ${yearOf(b.d)}`,catch:(info.C&&info.C.line)||'',stars:info.rv?info.rv.stars:0,badges,guide:currentName()};
}
function cardHTML(b,info,best,said){
  const c=cardData(b,info,best,said);CARD=c;
  return `<figure class="gm-card" aria-label="Catch card: ${esc(c.title)}"><div class="gm-c-top"><span>GUIDE MASTER · KENAI RIVER</span><span>${c.when}</span></div>
    <div class="gm-c-main"><span class="gm-c-ic" aria-hidden="true">${c.ic}</span><div><b>${c.title}</b><span>${esc(c.trip)}</span></div></div>
    <div class="gm-c-row">${c.badges.map(x=>`<i>${x}</i>`).join('')}</div>
    <div class="gm-c-foot"><span>${c.catch}</span><span aria-label="${c.stars} of 5 stars">${'★'.repeat(c.stars)}${'☆'.repeat(5-c.stars)}</span></div>
    <figcaption>Guided by Captain {{name}}</figcaption></figure>
    <button type="button" class="gm-save" onclick="cardSave()">💾 Save the card as an image</button>`;
}
// draws the card on a canvas and downloads it (no network, no libraries)
function cardPNG(c){
  c=c||CARD;if(!c) return null;
  const W=720,H=405,cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');if(!g) return null;
  const gr=g.createLinearGradient(0,0,W,H);gr.addColorStop(0,'#14524f');gr.addColorStop(1,'#2b8a84');g.fillStyle=gr;g.fillRect(0,0,W,H);
  g.fillStyle='rgba(255,255,255,.08)';g.beginPath();g.moveTo(0,330);g.quadraticCurveTo(240,300,480,335);g.quadraticCurveTo(600,350,720,320);g.lineTo(720,405);g.lineTo(0,405);g.fill();
  const F='system-ui,-apple-system,Segoe UI,Roboto,sans-serif';g.fillStyle='#d7efe9';g.font=`600 18px ${F}`;g.fillText('GUIDE MASTER · KENAI RIVER',36,48);
  g.textAlign='right';g.fillText(c.when,W-36,48);g.textAlign='left';
  g.font=`88px ${F}`;g.fillText(c.ic,36,170);
  g.fillStyle='#fff';g.font=`700 46px ${F}`;g.fillText(c.title,150,140);g.font=`22px ${F}`;g.fillStyle='#d7efe9';g.fillText(c.trip.slice(0,52),150,178);
  let x=36;g.font=`600 20px ${F}`;c.badges.forEach(bd=>{const w=g.measureText(bd).width+28;g.fillStyle='rgba(255,255,255,.16)';g.fillRect(x,214,w,38);g.fillStyle='#fff';g.fillText(bd,x+14,240);x+=w+10});
  g.font=`20px ${F}`;g.fillStyle='#d7efe9';g.fillText(String(c.catch).replace(/<[^>]+>/g,'').slice(0,60),36,300);
  g.fillStyle='#f4c542';g.font=`30px ${F}`;g.textAlign='right';g.fillText('★'.repeat(c.stars)+'☆'.repeat(5-c.stars),W-36,300);g.textAlign='left';
  g.fillStyle='#fff';g.font=`italic 20px ${F}`;g.fillText('Guided by Captain '+c.guide,36,372);
  try{return cv.toDataURL('image/png')}catch(e){return null}
}
window.cardSave=()=>{const u=cardPNG();if(!u)return;const a=document.createElement('a');a.href=u;a.download=`guide-master-${(CARD.title||'catch').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.png`;document.body.appendChild(a);a.click();a.remove()};
window.cardPNG=cardPNG;

// ---- postcards: next season, a past client or two writes in (the morning report on the season's first day) ----
const POST={
  best:['“That {fish} is still the story at every barbecue. Same week next summer?”','“The picture of the {fish} is on the fridge, right next to the grandkids.”','“We had the {fish} mounted. The taxidermist asked who our guide was.”'],
  kids:['“The kids still talk about lunch on the gravel bar. They’ve drawn you a picture of the river.”','“Our youngest wants to be a fishing guide now. Thanks a lot.”'],
  photo:['“We framed the shot from the river. Every guest asks where it was taken.”','“The photos made the family calendar: a whole month of the Kenai.”'],
  first:['“We bought rods this winter and practiced in the park. We’re ready for round two.”'],
  meat:['“The last of the fillets went on the grill last week. We need a refill.”'],
  any:['“Still thinking about that morning on the river. Save us a date.”','“Best day of our trip, and we saw a lot of Alaska. Tell the river hi.”','“The bumper sticker says KENAI. The neighbors are jealous.”'],
};
function postcardsFor(s){
  const M=MEM(),past=M.trips.filter(x=>seasonOf(x.d)<s&&x.stars>=4&&!M.cards.some(c=>c.who===x.who));
  if(!past.length) return [];
  const seen=new Set(),pool=past.slice().reverse().filter(x=>!seen.has(x.who)&&seen.add(x.who));
  pool.sort((a,c)=>(c.stars-a.stars)||(c.best&&isTrophy(c.best[0],c.best[1])?1:0)-(a.best&&isTrophy(a.best[0],a.best[1])?1:0)||c.d-a.d);
  const n=pool.length>=2&&pool[1].stars>=5?2:1,out=[];
  for(const x of pool.slice(0,n)){
    const tr=x.tr||[],key=x.best&&(isTrophy(x.best[0],x.best[1])||x.best[0]==='king')?'best':tr.find(k=>POST[k])||'any';
    const list=POST[key],line=list[Math.floor(memU(x.d,s,x.who.length)*list.length)];
    const fish=x.best?`${szTxt(x.best[0],x.best[1])} ${FISH_SZ[x.best[0]].n.toLowerCase()}`:'fish';
    out.push({s,who:x.who,from:x.from,txt:line.replace('{fish}',fish)});
  }
  return out;
}
// startSeason (24-career.js), inside the morning report: postcards, then the star milestones of last season (39-stars.js)
function memSeasonStart(s){
  const M=MEM();
  if(M.cardS!==s&&s>=1){M.cardS=s;const ps=postcardsFor(s);ps.forEach(p=>{M.cards.push(p);digestLine(`📬 <b>A postcard from the ${p.who}</b> (${p.from}): ${p.txt}`)});if(M.cards.length>40)M.cards.splice(0,M.cards.length-40)}
  if(typeof starsSeasonStart==='function') starsSeasonStart(s);
}
// finishWinter (24-career.js): this season's bookings are in. Returns lines for the bookings note.
function memSeasonOpen(s){return typeof starsSeasonOpen==='function'?starsSeasonOpen(s):[]}

// ---- the trophy wall (📜 Log tab → 🏆 Trophy wall) ----
let LOGSUB='log';
window.logSub=k=>{LOGSUB=k;render();const b=document.querySelector(`.gm-seg button[data-k="${k}"]`);b&&b.focus({preventScroll:true})};
function wallSwitch(){return `<div class="gm-seg" role="group" aria-label="Log or trophy wall">${[['log','📜 Log'],['wall','🏆 Trophy wall']].map(([k,l])=>`<button type="button" data-k="${k}" aria-pressed="${LOGSUB===k}" class="${LOGSUB===k?'on':''}" onclick="logSub('${k}')">${l}</button>`).join('')}</div>`}
function wallView(){
  const M=MEM(),row=(ic,b,s)=>`<div class="todo"><span class="ck" aria-hidden="true">${ic}</span><div><b>${b}</b><span>${s}</span></div></div>`;
  let h='<div class="sect">🏆 Biggest fish</div>';
  const recs=SP_ORDER.filter(sp=>M.rec[sp]);
  h+=recs.length?recs.map(sp=>{const r=M.rec[sp],X=FISH_SZ[sp];return row(X.ic,`${X.n}: ${szShort(sp,r.z)}${isTrophy(sp,r.z)&&sp==='halibut'?' · barn door':''}`,`The ${esc(r.who)}${r.from?`, ${esc(r.from)}`:''} · ${dlabel(r.d)}, ${r.year}`)}).join(''):'<p class="prio-empty">Nothing on the wall yet. Your first fish goes here.</p>';
  const F=[['trip','🛶'],['sp_sockeye','🐟'],['sp_silver','🎣'],['sp_rainbow','🌈'],['sp_halibut','⚓'],['king','👑'],['barn','🚪'],['limit','🧊'],['five','⭐']];
  const fs=F.filter(([k])=>M.firsts[k]);
  h+='<div class="sect">✨ Firsts</div>'+(fs.length?fs.map(([k,ic])=>{const f=M.firsts[k];return row(ic,f.txt.replace(/^\S+\s/,''),`${dlabel(f.d)}, ${f.year}`)}).join(''):'<p class="prio-empty">Your firsts: first king, first barn door, first limit-out, first five-star review.</p>');
  const todo=F.filter(([k])=>!M.firsts[k]&&['king','barn','limit','five'].includes(k)).map(([k,ic])=>`${ic} ${{king:'a king',barn:'a barn-door halibut (100 lb+)',limit:'a limit-out',five:'a five-star review'}[k]}`);
  if(todo.length&&fs.length) h+=`<p class="small-note" style="font-size:12.5px;color:var(--mute);margin:2px 2px 0">Still to come: ${todo.join(' · ')}.</p>`;
  const five=(S.reviews||[]).filter(r=>r.stars===5).slice(-3).reverse(),regs=(S.regs||[]).filter(g=>(g.trips||1)>=2).sort((a,c)=>(c.trips||1)-(a.trips||1)).slice(0,3);
  h+='<div class="sect">⭐ Standout clients</div>';
  h+=five.length||regs.length?five.map(r=>row('★',`The ${esc(r.who)} · ${'★'.repeat(5)}`,`“${r.text}” · ${dlabel(r.day)}, ${yearOf(r.day)}`)).join('')+regs.map(g=>row('🔁',`The ${esc(g.who)}: ${g.trips} seasons with you`,`${esc(g.from)} · regulars`)).join(''):'<p class="prio-empty">Five-star reviews and regulars who keep coming back show up here.</p>';
  if(M.cards.length) h+='<div class="sect">📬 Postcards</div>'+M.cards.slice(-4).reverse().map(c=>row('📬',`The ${esc(c.who)}, ${esc(c.from)}`,`${c.txt} · spring ${2026+c.s}`)).join('');
  if(typeof starsWall==='function') h+=starsWall();
  return h;
}

// ---- styles (kept here, with the feature: injected once) ----
(function(){
  if(typeof document==='undefined'||document.getElementById('gm-mem-css')) return;
  const st=document.createElement('style');st.id='gm-mem-css';st.textContent=`
.gm-moment{display:flex;align-items:center;gap:10px;margin:0 0 8px;padding:8px 10px;border-radius:12px;background:linear-gradient(90deg,#fff6d8,#e9f6f2);border:1.5px solid #f0d27a;color:#14524f;animation:gmPop .5s cubic-bezier(.2,1.4,.4,1) both}
.gm-moment .gm-jump{flex:none;width:72px;height:36px;color:#2b8a84;overflow:visible}
.gm-moment .gm-fishg{offset-path:path('M8 52 Q60 -14 112 52');offset-rotate:auto;animation:gmJump 1.2s ease-in-out both}
.gm-moment .gm-spark circle{opacity:0;animation:gmSpark 1.1s ease-out .25s both}
.gm-moment .gm-mt b{display:block;font-size:16px}.gm-moment .gm-mt span{display:block;font-size:13px;color:var(--ink)}
@keyframes gmPop{0%{transform:scale(.7);opacity:0}70%{transform:scale(1.04);opacity:1}100%{transform:scale(1)}}
@keyframes gmJump{0%{offset-distance:0%}100%{offset-distance:100%}}
@keyframes gmSpark{0%{opacity:0;transform:scale(.2)}40%{opacity:1;transform:scale(1.3)}100%{opacity:0;transform:scale(.6)}}
@media (prefers-reduced-motion:reduce){.gm-moment,.gm-moment *{animation:none!important}.gm-moment .gm-fishg{offset-distance:50%}.gm-moment .gm-spark circle{opacity:1}}
html.rm .gm-moment .gm-fishg{offset-distance:50%}html.rm .gm-moment .gm-spark circle{opacity:1}
.gm-card{margin:10px 0 6px;padding:12px 14px 10px;border-radius:14px;color:#fff;background:linear-gradient(135deg,#14524f,#2b8a84);box-shadow:0 2px 10px rgba(0,0,0,.18)}
.gm-card .gm-c-top{display:flex;justify-content:space-between;gap:8px;font-size:10.5px;letter-spacing:.8px;opacity:.85;font-weight:700}
.gm-card .gm-c-main{display:flex;align-items:center;gap:12px;margin:8px 0}.gm-card .gm-c-ic{font-size:40px;line-height:1}
.gm-card .gm-c-main b{display:block;font-size:22px;line-height:1.15}.gm-card .gm-c-main span{display:block;font-size:13px;opacity:.9}
.gm-card .gm-c-row{display:flex;flex-wrap:wrap;gap:6px}.gm-card .gm-c-row i{font-style:normal;font-size:12px;font-weight:700;background:rgba(255,255,255,.18);border-radius:999px;padding:3px 9px}
.gm-card .gm-c-foot{display:flex;justify-content:space-between;gap:8px;margin-top:8px;font-size:12.5px}.gm-card .gm-c-foot span:last-child{color:#f4c542;font-size:16px;white-space:nowrap}
.gm-card figcaption{font-size:12px;font-style:italic;opacity:.85;margin-top:4px}
.gm-save,.gm-skip{min-height:44px;padding:8px 14px;border-radius:10px;border:1.5px solid var(--line);background:#fff;color:var(--ink);font:inherit;font-size:14px;font-weight:700;cursor:pointer}
.gm-save{width:100%;margin:0 0 6px}
.gm-seg{display:flex;gap:6px;margin:4px 0 8px}.gm-seg button{flex:1;min-height:44px;border-radius:10px;border:1.5px solid var(--line);background:#fff;color:var(--ink);font:inherit;font-weight:700;font-size:14px}
.gm-seg button.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.gm-mentor{display:flex;gap:10px;align-items:flex-start;margin:8px 0 2px;padding:9px 10px;border-radius:12px;background:#f3ecdc;border-left:4px solid #8a6b48;font-size:13.5px;line-height:1.45}
.gm-mentor .gm-who{flex:none;font-size:26px;line-height:1}.gm-mentor p{margin:0 0 6px}.gm-mentor b{color:#5b4329}
.gm-stars-ms{font-size:13px;line-height:1.5}.gm-ms{display:flex;gap:8px;align-items:baseline;padding:3px 0}.gm-ms .ok{color:var(--good);font-weight:700}
html.hc .gm-mentor{background:#fff;border-left-color:#000}html.hc .gm-card{background:#0d3634}`;
  (document.head||document.documentElement).appendChild(st);
})();
