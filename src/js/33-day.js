// ============================================================
//  GUIDE MASTER, part 3b (1.13.0): a day on the water.
//  · A trip is a few beats inside the one trip sheet (22-trips.js): the launch (the spot), then two or three calls through the day
//    (stay, move, switch tactics, shore lunch, call it early). Fish land between beats, from the same model as before (q, the run,
//    weather, the spot's fit, your skill) split across the stretches of the day, so reading the tide, the traffic and the wind pays.
//  · Every party has one or two traits (what they came for). Happiness and the tip follow how well the day matched them, and
//    they leave a short written review (S.reviews: {day, who, type, stars, text}).
//  · Judgment-call dilemmas (no rule to break, or a rule that costs more or less by party) live at the bottom of this file.
// ============================================================

// ---- clients with goals ----
const ALLT=['reds','silver','trout','halibut'];
const TRAITS={
  meat:   {ic:'🥩',n:'Meat fishers',  want:'a full cooler to fly home',              types:['reds','silver','halibut']},
  trophy: {ic:'🏆',n:'Trophy hunters',want:'one big fish, not a pile of small ones',  types:ALLT},
  kids:   {ic:'🧒',n:'Kids aboard',   want:'steady action and an early lunch',       types:ALLT},
  photo:  {ic:'📸',n:'Photographers', want:'scenery, wildlife and the shot',         types:ALLT},
  fly:    {ic:'🪰',n:'Fly purists',   want:'fish on a fly, and no bait',             types:['trout','silver']},
  first:  {ic:'🌱',n:'First-timers',  want:'patient coaching and easy water',        types:ALLT},
  seasick:{ic:'🤢',n:'Seasick-prone', want:'calm water and a short run',             types:['halibut']},
};
const TRAIT_HINT=[
  ['kids',/kid|grandkid|grandson|Scout|sons\b|Garza|three generations|graduation|family reunion|Lopez family|Chen and Rivera/i],
  ['photo',/photo|YouTuber|artist|astronomy|book club|anniversary|newlywed|honeymoon|Germany|Tokyo|Swiss|Australian/i],
  ['fly',/fly/i],
  ['meat',/crew|cannery|pipeline|trucking|farm|Kowalski|oilfield|hockey|bartender|Coast Guard|Nguyen|mail carriers|husbands/i],
  ['trophy',/Navy|Marine|law-firm|startup|bachelor|college buddies|doctors|firefighters|brothers|hunter-ed|paramedics/i],
  ['first',/first|book club|teachers|retired couple|mother and son|newlyweds|night-shift|dentist|sisters/i],
];
const traitOK=(k,type)=>!!(TRAITS[k]&&TRAITS[k].types.includes(type))&&!(k==='meat'&&type==='king'&&kingRule()!=='open');   // 1.14.0: no meat fishers on a catch-and-release king trip
// one or two traits for a party on a trip type (hinted by who they are and their quirks, then chance)
function traitsFor(o){
  const type=o.type||'reds',r=Math.random,tr=[],q=o.quirk||[];
  const add=k=>{if(k&&traitOK(k,type)&&!tr.includes(k)&&tr.length<2)tr.push(k)};
  if(q.includes('kid'))add('kids');if(q.includes('kingfan'))add('trophy');if(q.includes('photo'))add('photo');if(q.includes('first'))add('first');
  TRAIT_HINT.forEach(([k,re])=>{if(re.test(o.who||'')&&r()<.75)add(k)});
  if(type==='halibut'&&r()<.3)add('seasick');
  const pool=()=>Object.keys(TRAITS).filter(k=>traitOK(k,type)&&!tr.includes(k)&&!(k==='trophy'&&(tr.includes('kids')||type==='reds'))&&!(k==='kids'&&tr.includes('trophy')));
  if(!tr.length) add(pick(pool()));
  if(tr.length<2&&r()<.3) add(pick(pool()));
  return tr;
}
// a booking's traits, fitted to its trip type (regulars keep theirs where they still make sense)
function fitTraits(b){
  const tr=(b.tr||[]).filter(k=>traitOK(k,b.type));
  return tr.length?tr:traitsFor(b);
}
const hasT=(b,k)=>!!(b&&b.tr&&b.tr.includes(k));
const tv=(b,m,d)=>{for(const k of (b&&b.tr)||[])if(k in m)return m[k];return d};   // a party-dependent number: the first trait that has one
const traitTxt=(tr,long)=>(tr||[]).filter(k=>TRAITS[k]).map(k=>`${TRAITS[k].ic} ${TRAITS[k].n}${long?`: ${TRAITS[k].want}`:''}`).join(long?' · ':', ');
const traitIcons=tr=>(tr||[]).filter(k=>TRAITS[k]).map(k=>TRAITS[k].ic).join('');
const cap1=s=>s.charAt(0).toUpperCase()+s.slice(1);
const hrsLeft=m=>m<=0?'no time':`${Math.floor(m/60)?Math.floor(m/60)+' h':''}${m%60?`${Math.floor(m/60)?' ':''}${m%60} min`:''}`;

// ---- the beats of a day ----
// at: minutes after the trip's start when each beat begins (the first is the launch: the spot choice). tac: the two tactics.
const BEATS={
  reds:   {at:[0,120,240],     nm:['Launch','The first drift','The midday call'],      tac:['flip','bank']},
  silver: {at:[0,100,200],     nm:['Launch','Mid-afternoon','The evening bite'],       tac:['troll','drift']},
  trout:  {at:[0,160,320],     nm:['The upper river','The middle river','The lower river'],tac:['beads','streamers']},
  halibut:{at:[0,150,330,480], nm:['The run out','Slack tide','The turn','The run home'],tac:['anchor','jig']},
};
const TAC={
  flip:     {n:'Flip the seams from the sled',          sh:'flipping from the sled'},
  bank:     {n:'Beach the sled and fish a gravel bar',  sh:'fishing from the bank'},
  troll:    {n:'Back-troll plugs down the slots',       sh:'back-trolling plugs'},
  drift:    {n:'Drift spinners and swing flies',        sh:'drifting spinners and flies'},
  beads:    {n:'Drift beads under an indicator',        sh:'drifting beads'},
  streamers:{n:'Swing and strip streamers',             sh:'swinging streamers'},
  anchor:   {n:'Anchor up and set out a chum bag',      sh:'anchored on a chum slick'},
  jig:      {n:'Drift the bottom with jigs',            sh:'drifting jigs'},
};
// moving between spots: minutes off the water and extra gallons (trout floats only go downstream)
const MOVE={reds:[[0,12,0,8],[12,0,0,15],[0,0,0,0],[8,15,0,0]],silver:[[0,8,20],[8,0,20],[20,20,0]],trout:[[0,15,30],[0,0,20],[0,0,0]],halibut:[[0,20,45],[20,0,35],[45,35,0]]};
const MOVE_GAL={reds:[[0,3,0,1],[3,0,0,3],[0,0,0,0],[1,3,0,0]],silver:[[0,1,4],[1,0,4],[4,4,0]],trout:[[0,0,0],[0,0,0],[0,0,0]],halibut:[[0,8,25],[8,0,18],[25,18,0]]};
const BEAT_Q=.3, LUNCH_MIN=30, GOAL_H=9, GOAL_MID=4;   // GOAL_MID: a day out with a guide who listens is worth something by itself (keeps an average day where it was before 1.13)
const canMove=(type,a,b)=>a!==b&&!(SPOTS[type][b]&&SPOTS[type][b].viol)&&(type!=='trout'||b>a);

function segWin(b,k){const T=TRIPS[b.type],A=BEATS[b.type].at,a=A[k]||0,e=k+1<A.length?A[k+1]:T.len;return {t0:b.d*1440+T.start+a,m0:T.start+a,len:e-a}}
const windAt=(d,m)=>wxOf(d).wind*(.7+.6*clamp((m-600)/360,0,1));     // the wind builds through the afternoon
function traffic(type,i,m){                                           // 0 (empty) .. 1 (elbow to elbow)
  if(type==='reds') return [m>=470&&m<900?1:.35,.2,0,.8][i]||0;
  if(type==='silver') return [.5,m>=900?.8:.5,.1][i]||0;
  if(type==='trout') return [m>=540&&m<900?.9:.4,.35,.1][i]||0;
  if(type==='king') return [m<540?.6:.4,.25,.45][i]||0;            // 1.14.0: June kings (34-summer.js)
  return [.45,.3,.1][i]||0;
}
const trafWord=x=>x>=.85?'elbow-to-elbow boats':x>=.55?'busy':x>=.3?'a few boats':'nearly empty';
// what a stretch of the day does to a spot and a tactic: signed readings with the reason for each sign (R from 23-fish.js)
function segTerms(b,k,i,tac){
  const type=b.type,d=b.d,w=segWin(b,k),mid=w.t0+w.len/2,mm=w.m0+w.len/2,x=tide(mid),slack=1-Math.abs(x.rate),flood=x.rate>.25,ebb=x.rate<-.25;
  const c=spotConds(type,d),windy=clamp((windAt(d,mm)-9)/8,0,1.5),tr=traffic(type,i,w.m0+30),out=[];
  out.push(R(-(tr-.5)*(tac==='bank'?.3:.9),'quiet water, nobody on the drift','boats stacked up on the drift'));
  if(type==='reds'){
    if(i===0||i===3) out.push(R(flood?(i===0?.5:.25):ebb?-.2:0,'fresh reds push in on the flood','the ebb slows the push of fresh fish'));
    if(i===1) out.push(R(-.4*windy,'','wind on the long run upriver'));
    out.push(tac==='bank'?R(-.1+.25*Math.max(0,c.cloud),'overcast keeps reds tight to the bank','you give up the middle seams'):R(.3*c.run,'a strong run fills the seams','a thin run leaves the seams empty'));
  }else if(type==='silver'){
    if(i<2) out.push(R(flood?.5:ebb?-.25:0,'the flood pushes fresh silvers in','the ebb leaves the slots empty'));
    if(k===BEATS.silver.at.length-1) out.push(R(.15,'silvers turn on toward evening',''));
    out.push(tac==='troll'?R(.4*c.lvl-.5*windy,'big water fills the deep slots','wind and low water make back-trolling hard'):R(.5*c.trend+.3*c.cloud,'clearing water and soft light for spinners','rising water and bright sun put them off spinners'));
  }else if(type==='king'){
    if(i===0) out.push(R(flood?.45:ebb?-.2:0,'fresh kings push in on the flood','the ebb slows the push of fresh kings'));
    if(i===1) out.push(R(-.4*windy,'','wind on the long run upriver'));
    if(k===0) out.push(R(.15,'kings move at first light',''));
    out.push(tac==='troll'?R(.45*c.lvl-.4*windy,'high, cold water holds kings in the deep slots for a plug','low water or wind make back-trolling hard'):R(.4*c.cloud+.4*c.trend,'soft light and clearing water for back-bounced spin-n-glos','bright sun and rising water put them off'));
  }else if(type==='trout'){
    if(i===2) out.push(R(windy>.2?-.9*windy:.3,'a glassy lake','Skilak’s afternoon wind'));
    out.push(tac==='beads'?R(.8*c.sock-.4*Math.max(0,c.lvl),'spawning reds have the rainbows on the egg bite','no egg bite yet, or milky water hides the beads'):R(.45*c.cloud+.25*Math.max(0,c.lvl)+(mm>=600&&mm<840?-.1:.1),'overcast and color bring rainbows up for streamers','bright midday sun keeps them down'));
  }else{
    out.push(tac==='anchor'?R(1.1*(slack-.5),'slack tide holds the chum slick on the bottom','a running tide drags the slick away'):R(.6*(.5-slack)-.4*windy,'a moving tide makes a good drift','slack water or wind make a poor drift'));
    out.push(i===0?R(.1,'sheltered water',''):R(-(i===1?.4:.8)*windy,'','chop out in the open'));
  }
  return out;
}
// where the fish are this stretch: a shift no forecast shows, but the radio chatter and your own eyes do (fish rolling, a drift gone quiet)
const segNoise=(b,k,i,tac)=>(hz(b.d*3+k,(TYPE_IX[b.type]||0)*5+i,1)-.5)*1.6+(hz(b.d*5+k,(TYPE_IX[b.type]||0)*7+i,BEATS[b.type].tac.indexOf(tac)+2)-.5)*.3;
// how this stretch's water compares with a typical July trip (the old whole-trip runFactor, one stretch at a time)
function segRun(b,k){const [sp,loc,center]=TRIP_SP[b.type]||TRIP_SP.reds,w=segWin(b,k);return clamp((avgOdds(sp,loc,w.t0,w.len)/center-1)*.15,-.15,.15)}
// the trip's base quality before the water: weather, prep, upgrades, camping, gear, boat, energy and skill (as tripEnd always had)
function tripQ0(b,t){
  const d=b.d;
  return .5+(WX[S.wx[d]||'sun']||WX.sun).q+(S.prep===d?.08:0)+(scoutedFor(b.type,d)?.05:0)+upQ(b.type)+campQ()+(S.gear>0?0:-.15)+(S.boat<40&&!t.loan?-.1:0)+(S.energy<30?-.1:0)+skillQ();
}
const craftB=()=>.5+.5*DF().craft;
function segQ(b,t,k,i,tac){
  const bt=t.bt;i=i??bt.spot;tac=tac||bt.tac;
  const sp=SPOTS[b.type][i]||{},fit=spotFit(b.type,i,b.d,true),terms=segTerms(b,k,i,tac).reduce((a,x)=>a+x[0],0)+segNoise(b,k,i,tac);
  return tripQ0(b,t)+t.q+(sp.q||0)+segRun(b,k)+(fit?fit.f*SPOT_Q*DF().craft:0)+terms*BEAT_Q*craftB()+(t.nz||0);
}
// what a guide can read for spot i and tactic tac in stretch k: the conditions (the scouted read when you scouted), and
// for the water you are already fishing, the bite so far. Returns {q, f, why}.
function beatRead(b,t,k,i,tac,ahead){
  const bt=t.bt,hint=spotHint(b.type,b.d),known=i===bt.spot&&bt.segs.some(Boolean);
  const fit=spotFit(b.type,i,b.d,known||hint==='exact'),terms=segTerms(b,k,i,tac).concat(ahead?[]:[R(segNoise(b,k,i,tac)*.8,'the radio says fish are moving through','the radio says it has gone quiet there')]),sum=terms.reduce((a,x)=>a+x[0],0),sp=SPOTS[b.type][i]||{};
  const f=(fit?fit.f:0)+sum,top=terms.concat(fit&&fit.why?[[fit.f,fit.why]]:[]).reduce((m,x)=>Math.abs(x[0])>Math.abs(m[0])&&x[1]?x:m,[0,'']);
  return {q:(sp.q||0)+(fit?fit.f*SPOT_Q*DF().craft:0)+sum*BEAT_Q*craftB(),f,why:top[1]};
}
const readWord=f=>f>=.5?'Hot':f>=.15?'Good':f>-.2?'Fair':'Poor';

// ---- landing the fish of a stretch ----
const NUM=['No','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve'];
const numW=n=>n<NUM.length?NUM[n]:String(n);
const lc1=s=>s.charAt(0).toLowerCase()+s.slice(1);
const fishersOf=(b,t)=>Math.max(0,b.n-(t.nofish||0));
const limOf=b=>b.type==='reds'?S.limit:2;
const bagged=b=>b.type==='reds'||b.type==='silver'||(b.type==='halibut'&&!halClosed(b.d));
function landSeg(b,t,k){
  const bt=t.bt;if(!bt||k>=bt.K||bt.segs[k]) return null;
  const T=TRIPS[b.type],w=segWin(b,k),r=Math.random,fishers=fishersOf(b,t),sp=SPOTS[b.type][bt.spot]||{};
  const eff=clamp(1-(bt.mv[k]||0)/w.len,0,1),wt=w.len/T.len*eff;
  const q=clamp(segQ(b,t,k)*(k===bt.k&&bt.tow?bt.tow:1),.05,1.15);
  const sg={k,spot:bt.spot,tac:bt.tac,q:Math.round(q*100)/100,w:Math.round(wt*1000)/1000,n:0,lost:0,big:0,rough:0,shot:0};
  if(bagged(b)){
    const lim=limOf(b);bt.ang=(bt.ang||[]).slice(0,fishers);while(bt.ang.length<fishers)bt.ang.push(0);
    const room=fishers*lim-bt.box,e=fishers*lim*q*wt*.91;
    const n=clamp(Math.floor(e*(1+(r()-.5)*.4)+r()),0,room);
    for(let j=0;j<n;j++){let m=0;for(let a=1;a<fishers;a++)if(bt.ang[a]<bt.ang[m])m=a;bt.ang[m]++}   // you rotate the rods: fish go to whoever is shortest
    bt.box+=n;sg.n=n;sg.lost=n>0&&r()<.45?1+(r()<.25?1:0):0;
  }else if(b.type==='king') weekCatchSeg(b,t,sg,q,wt,fishers);   // 34-summer.js (1.14.0): kings landed this stretch, from the early run's timing (segRun)
  else if(b.type==='trout'){sg.n=Math.max(0,Math.round(fishers*(2+q*8)*wt+(r()-.5)*2));bt.box+=sg.n}
  else{sg.n=Math.max(0,Math.round(fishers*(1+q*3)*wt+(r()-.5)));bt.box+=sg.n}         // a closed halibut day: rockfish and lingcod
  const mm=w.m0+w.len/2,wind=windAt(b.d,mm);
  if(b.type==='king') sg.big=sg.n>0?1:0;   // every king is the fish of the trip
  else if(fishers&&!(b.type==='halibut'&&halClosed(b.d))&&r()<(.04+(sp.big||0)+({streamers:.1,anchor:.08,troll:.04}[bt.tac]||0))*q*wt*2.2) sg.big=1;
  if(b.type==='halibut'&&(wind>13&&(bt.spot>=1||bt.tac==='anchor'))) sg.rough=1;
  if(b.type==='trout'&&bt.spot===2&&wind>12) sg.rough=1;
  if(r()<(sp.scenic?.45:.12)*((S.wx[b.d]||'sun')==='rain'?.5:1)+(bt.lunch===k?.25:0)) sg.shot=1;
  bt.segs[k]=sg;
  sg.line=landLine(b,sg);if(sg.big&&b.type!=='king')sg.line+=' '+bigLine(b);if(sg.rough)sg.line+=b.type==='halibut'?' 🌊 It’s getting lumpy out here.':' 💨 Whitecaps on the lake.';
  t.notes.push(`${fmt(w.m0+w.len)} · ${sg.line}`);
  return sg;
}
function landLine(b,sg){
  const n=sg.n;
  if(b.type==='reds'||b.type==='silver'){const nm=b.type==='reds'?'red':'silver';
    return '🐟 '+(n?`${numW(n)} ${nm}${n>1?'s':''} in the box${sg.lost?`, ${lc1(numW(sg.lost))} lost at the net`:''}.`:pick([`Not a ${nm} this stretch.`,`Nothing in the box. The ${nm}s are somewhere else.`]))}
  if(b.type==='king') return kingSegLine(sg);
  if(b.type==='trout') return '🌈 '+(n?`${numW(n)} rainbow${n>1?'s':''} and Dollies to hand and released.`:'Not a touch. The trout have lockjaw.');
  if(halClosed(b.d)) return `🐟 ${numW(n)} rockfish and lingcod; the halibut go back today.`;
  return '⚓ '+(n?`${numW(n)} halibut in the fish box${sg.lost?`, ${lc1(numW(sg.lost))} spat the hook at the rail`:''}.`:'Bait soaks, nothing bites. The halibut aren’t here.');
}
function bigLine(b){
  const r=Math.random;
  if(b.type==='reds') return `🏆 A ${9+Math.floor(r()*3)}-pound buck sockeye, the fish of the day.`;
  if(b.type==='silver') return `🏆 A ${13+Math.floor(r()*5)}-pound chrome silver.`;
  if(b.type==='trout') return `🏆 A ${27+Math.floor(r()*6)}-inch leopard rainbow, photographed in the water.`;
  return `🏆 A ${80+Math.floor(r()*110)}-pound halibut comes over the rail.`;
}
const biteWord=q=>q>=.85?'hot':q>=.65?'steady':q>=.45?'slow':'dead';
function biteTxt(b,t){
  const bt=t.bt,segs=bt.segs.filter(Boolean);if(!segs.length) return '';
  const last=segs[segs.length-1],fishers=fishersOf(b,t),n=bt.box;
  const tally=b.type==='king'?kingTally(t):bagged(b)?`${n} of ${fishers*limOf(b)} in the box (the limit for ${fishers})`:b.type==='trout'?`${n} trout to hand so far`:`${n} rockfish and lingcod so far`;
  return `So far: ${tally}. The bite at ${SPOTS[b.type][last.spot].sh} was ${biteWord(last.q)}.`;
}
// the radio and your own eyes: where the fish are moving this stretch
function radioTxt(b,t,k){
  const sp=SPOTS[b.type],cur=t.bt.spot,nz=i=>segNoise(b,k,i,sp[i].tac);
  const others=sp.map((x,i)=>i).filter(i=>i!==cur&&!sp[i].viol),hot=others.reduce((a,i)=>a<0||nz(i)>nz(a)?i:a,-1),here=nz(cur);
  const a=here>.15?`Fish rolling on ${sp[cur].sh}.`:here<-.15?`It has gone quiet on ${sp[cur].sh}.`:`Nothing special showing on ${sp[cur].sh}.`;
  const o=hot>=0&&nz(hot)>.15?` On the radio: ${b.type==='halibut'?'boats getting bit':'fish moving'} at ${sp[hot].sh} right now.`:hot>=0&&nz(hot)<-.15?' The radio is quiet everywhere.':'';
  return a+o;
}
// the conditions a guide looks at before a call
function condHTML(b,t,k){
  const T=TRIPS[b.type],d=b.d,m=T.start+BEATS[b.type].at[k],abs=d*1440+m,w=wxOf(d),bt=t.bt,sp=SPOTS[b.type][bt.spot]||SPOTS[b.type][0],end=T.start+T.len,L=[],wk=WX[S.wx[d]||'sun']||WX.sun;
  if(T.below&&guideDaysRule(d)) L.push(`🕐 ${fmt(m)}. Guide boats below Skilak fish 6 AM to 6 PM: ${hrsLeft(Math.min(1080,end)-m)} left on this trip.`);
  else if(T.below) L.push(`🕐 ${fmt(m)}. Back at the launch by ${fmt(end)}: ${hrsLeft(end-m)} left.`);
  else L.push(`🕐 ${fmt(m)}. ${b.type==='halibut'?'Back at Homer Harbor':'At the Jim’s Landing take-out'} by ${fmt(end)}: ${hrsLeft(end-m)} left.`);
  if(b.type!=='trout'){const nx=tideTable(d).find(x=>x.m>m);L.push(`🌊 Tide ${tideNow(abs)}${nx?`; ${nx.hi?'high':'low'} water at ${fmt(nx.m)}`:''}.`)}
  else L.push(`💧 River ${waterTxt(w)}.`);
  if(b.type==='reds'||b.type==='silver'){const y=S.run&&S.run[d-1];L.push(`📊 Sonar: ${y?`${grp(y)} sockeye past river mile 19 yesterday`:'no count posted yet'}.`)}
  L.push(`🚤 ${cap1(sp.sh)}: ${trafWord(traffic(b.type,bt.spot,m+30))}.`);
  L.push(`💨 ${w.dir} wind ${Math.round(windAt(d,m+60))} mph${m<720&&w.wind>=9?', building this afternoon':''}. ${wk.ic} ${wk.n}.`);
  if(k>0){const bs=biteTxt(b,t);if(bs)L.push(`🎣 ${bs}`)}
  L.push(`📻 ${radioTxt(b,t,k)}`);
  if(b.tr&&b.tr.length) L.push(`🎯 The ${b.who}: ${traitTxt(b.tr,true)}.`);
  return `<ul class="conds" aria-label="Conditions" style="list-style:none;margin:6px 0;padding:0;font-size:13px;line-height:1.45">${L.map(x=>`<li>${x}</li>`).join('')}</ul>`;
}

// ---- the moves at a beat ----
// value hints (v) are for the bots: catch in happiness points (a full day at q 1 is about 45) plus what the party wants.
function traitMoveV(b,t,k,mv){
  const sp=SPOTS[b.type][mv.i]||{},last=k>=t.bt.K-1;let v=0;
  if(mv.tac==='bank'){v+=tv(b,{kids:2,first:2},0)}
  if(mv.tac==='streamers'||mv.tac==='drift') v+=hasT(b,'fly')?3:0;
  if(mv.tac==='beads'||mv.tac==='troll') v-=hasT(b,'fly')?3:0;
  if(sp.easy) v+=hasT(b,'first')?2:0;
  if(sp.hard) v-=tv(b,{first:3,seasick:4},0);
  if(sp.scenic) v+=hasT(b,'photo')?3:0;
  if(sp.big) v+=hasT(b,'trophy')?sp.big*30:0;
  if(b.type==='halibut'&&mv.i>=1&&windAt(b.d,segWin(b,k).m0+60)>12) v-=hasT(b,'seasick')?5:1;
  if(mv.lunch) v+=1+tv(b,{kids:5,first:2,photo:2,meat:-2,trophy:-1},0);
  if(mv.early) v+=tv(b,{kids:3,seasick:windAt(b.d,segWin(b,k).m0+60)>12?6:1,first:1,meat:-6,trophy:-4},-3);
  return v;
}
function beatMoves(b,t,k){
  const bt=t.bt,type=b.type,sp=SPOTS[type],cur=bt.spot,tac=bt.tac,B=BEATS[type],last=k>=bt.K-1,w=segWin(b,k),wt=w.len/TRIPS[type].len,o=[];
  const val=(i,tc,mins,gal)=>{const rd=beatRead(b,t,k,i,tc);return {rd,v:45*(rd.q+.7)*wt*clamp(1-mins/w.len,0,1)-gal*.25}};
  const rdTxt=rd=>`${readWord(rd.f)}${rd.why?`: ${rd.why}`:''}`;
  const stay=val(cur,tac,0,0),other=B.tac.find(x=>x!==tac),sw=val(cur,other,5,0);
  o.push(Object.assign(O(`Stay on ${sp[cur].sh}`,`${rdTxt(stay.rd)}. Keep ${TAC[tac].sh}; no time lost.`,(b,t)=>beatGo(b,t,k,{i:cur,tac})),{v:stay.v+traitMoveV(b,t,k,{i:cur,tac})}));
  o.push(Object.assign(O(`${TAC[other].n}`,`${rdTxt(sw.rd)}. 5 minutes to re-rig.`,(b,t)=>beatGo(b,t,k,{i:cur,tac:other,mins:5})),{v:sw.v+traitMoveV(b,t,k,{i:cur,tac:other})}));
  const moves=sp.map((s,i)=>i).filter(i=>canMove(type,cur,i)&&!(bt.short&&i===2&&type==='halibut')).map(i=>{const mins=MOVE[type][cur][i],gal=MOVE_GAL[type][cur][i],tc=sp[i].tac,x=val(i,tc,mins,gal);return {i,mins,gal,tc,x}}).sort((a,c)=>c.x.v-a.x.v);
  const mvOpt=m=>Object.assign(O(`${type==='trout'?'Drift on down to':'Run to'} ${sp[m.i].sh}`,`${rdTxt(m.x.rd)}. ${m.mins} minutes${m.gal?` and about ${m.gal} gallons`:''} to get there.`,(b,t)=>beatGo(b,t,k,{i:m.i,tac:m.tc,mins:m.mins,gal:m.gal})),{v:m.x.v+traitMoveV(b,t,k,{i:m.i,tac:m.tc})});
  if(moves[0]) o.push(mvOpt(moves[0]));
  const left=TRIPS[type].len-B.at[k];
  if(last) o.push(Object.assign(O(type==='halibut'?'Run home early, ahead of the wind':'Call it a day and head in',`Skip the last ${hrsLeft(left)}: fewer fish, a rested guide. ${tv(b,{kids:'The kids are fading anyway.',seasick:'The green faces will thank you.',meat:'They came for a full cooler.',trophy:'They came for one more shot at a big one.'},'Some parties like a short day; most want every minute.')}`,(b,t)=>beatEarly(b,t,k)),{v:traitMoveV(b,t,k,{i:cur,tac,early:true})}));
  else if(bt.lunch<0) o.push(Object.assign(O(type==='halibut'?'Shut down in the lee for lunch':'Pull onto a gravel bar for shore lunch',`${LUNCH_MIN} minutes off the water. A break, a stretch and a meal. ${tv(b,{kids:'Kids live for this.',meat:'Meat fishers would rather keep fishing.',photo:'Good light for photos.',first:'Time to answer their questions.'},'')}`,(b,t)=>beatGo(b,t,k,{i:cur,tac,mins:LUNCH_MIN,lunch:true})),{v:val(cur,tac,LUNCH_MIN,0).v+traitMoveV(b,t,k,{i:cur,tac,lunch:true})}));
  else if(moves[1]) o.push(mvOpt(moves[1]));
  return o;
}
function beatGo(b,t,k,mv){
  const bt=t.bt,sp=SPOTS[b.type][mv.i];
  if(mv.i!==bt.spot){t.fuelx=(t.fuelx||0)+(mv.gal||0);t.notes.push(`📍 ${fmt(segWin(b,k).m0)}: ${b.type==='trout'?'you drift on to':'you run to'} ${sp.sh}.`);
    if(sp.risk&&Math.random()<sp.risk.p*windRisk()*.7){t.notes.push(sp.risk.txt);t.happy+=sp.risk.h;adj('boat',sp.risk.boat||0);adj('energy',sp.risk.energy||0)}}
  else if(mv.tac!==bt.tac) t.notes.push(`🎣 ${fmt(segWin(b,k).m0)}: you switch to ${TAC[mv.tac].sh}.`);
  bt.spot=mv.i;bt.tac=mv.tac;bt.k=k;bt.mv[k]=(bt.mv[k]||0)+(mv.mins||0);
  if(mv.lunch){bt.lunch=k;adj('energy',4);t.happy+=1;t.notes.push(b.type==='halibut'?'🥪 Engines off in the lee for lunch. The gulls get the crusts.':'🔥 Shore lunch on a gravel bar. Everybody stretches their legs.')}
}
// call it early: no more stretches, no more steps
function beatEarly(b,t,k,mid){
  const bt=t.bt;bt.k=k;
  if(mid){const w=segWin(b,k);bt.mv[k]=(bt.mv[k]||0)+Math.round(w.len/2);landSeg(b,t,k);k++}
  bt.early=k;t.step=t.steps.length-1;
  t.notes.push(`🏁 ${fmt(k<bt.K?segWin(b,k).m0:TRIPS[b.type].start+TRIPS[b.type].len)}: you call it a day and head in.`);
}
STEP.beat=(b,t)=>{
  const bt=t.bt,T=TRIPS[b.type],B=BEATS[b.type];
  if(!bt||bt.k+1>=bt.K) return {t:`${T.ic} On the water`,b:'<p>The day rolls on.</p>',o:[O('Carry on','',()=>{})],fixed:true};
  const k=bt.k+1,sg=landSeg(b,t,bt.k),m=T.start+B.at[k];
  const land=sg?`<p class="land" style="margin:0 0 6px"><b>${fmt(m)}</b> · ${sg.line}</p>`:'';
  return {t:`${T.ic} ${B.nm[k]}`,b:`${land}${condHTML(b,t,k)}<p style="margin:6px 0 0">Fishing ${SPOTS[b.type][bt.spot].sh}, ${TAC[bt.tac].sh}. Your call, Captain.</p>`,o:beatMoves(b,t,k),fixed:true};
};
// the whole-trip catch, after the last stretch lands (tripEnd)
function beatCatch(b,t,towRatio){
  const bt=t.bt;if(towRatio!=null)bt.tow=towRatio;
  if(bt.early===false||bt.early==null) for(let k=bt.k;k<bt.K;k++){if(k>bt.k)bt.k=k;landSeg(b,t,k)}
  const segs=bt.segs.filter(Boolean),fishers=fishersOf(b,t),T=TRIPS[b.type];
  const qw=segs.reduce((a,s)=>a+s.q*s.w,0);
  let frac,limits=0,line;const fish=bt.box;
  if(bagged(b)){const lim=limOf(b);limits=(bt.ang||[]).filter(a=>a>=lim).length;frac=fishers?fish/(lim*fishers):0;
    const nm=b.type==='reds'?'red':b.type==='silver'?'silver':'halibut';line=`${fish} ${nm}${fish===1||nm==='halibut'?'':'s'}${limits?`, ${limits} limit${limits>1?'s':''}`:''}`}
  else if(b.type==='king'){const kc=weekCatchEnd(b,t,qw,fishers);frac=kc.frac;limits=kc.limits;line=kc.line}
  else if(b.type==='trout'){frac=clamp(qw,0,1);line=`${fish} trout landed & released`}
  else{frac=clamp(qw,0,1);line=`${fish} rockfish & lingcod, halibut released`}
  const A=BEATS[b.type].at,fished=bt.early!=null&&bt.early!==false&&bt.early<bt.K?A[bt.early]:bt.K<A.length?A[bt.K]:T.len;
  return {fish,frac,limits,line,fishers,fished,big:segs.some(s=>s.big)};
}

// ---- what the party came for ----
// each trait scores the day from about -1 (missed it) to +1 (nailed it); GOAL_H happiness per point
function goalOf(b,t,c){
  const bt=t.bt,g=t.g||{},segs=bt?bt.segs.filter(Boolean):[],sp=SPOTS[b.type]||[],out={h:S.diff==='hard'?GOAL_MID-1.5:GOAL_MID,good:[],bad:[]},n=Math.max(1,segs.length);
  const rough=segs.filter(s=>s.rough).length+(g.rough||0),early=bt&&bt.early!=null&&bt.early!==false;
  const slow=segs.filter(s=>(s.n+(s.dol||0)*.5)/Math.max(1,c.fishers)<(b.type==='trout'?1.2:.4)).length;
  const lunchEarly=(bt&&bt.lunch>=0&&bt.lunch<bt.K-1)||g.lunch;
  const easy=segs.filter(s=>(sp[s.spot]&&sp[s.spot].easy)||s.tac==='bank').length,hard=segs.filter(s=>sp[s.spot]&&sp[s.spot].hard).length;
  const flyN=segs.filter(s=>s.tac==='streamers'||s.tac==='drift').length,beadN=segs.filter(s=>s.tac==='beads'||s.tac==='troll').length;
  const all=c.fishers>0&&c.limits===c.fishers;
  for(const k of b.tr||[]){let v=0;
    if(k==='meat') v=(c.frac-.75)*2.5+(all?.4:0)-(early&&!all?.5:0)-(g.release||0)*.3;
    else if(k==='trophy') v=(c.big||g.big?1:b.type==='reds'&&t.steps.includes('king')?.1:-.5)+(g.release?-.3:0);
    else if(k==='kids') v=.3-slow*.3+(lunchEarly?.5:-.2)+(early?.2:0)+segs.filter(s=>s.tac==='bank').length*.1+(g.kid||0);
    else if(k==='photo') v=(g.shot||segs.some(s=>s.shot)?.6:-.5)+(segs.some(s=>sp[s.spot]&&sp[s.spot].scenic)?.2:0);
    else if(k==='fly') v=(flyN-beadN)/n*.9-(g.bait?1:0)+(g.fly||0);
    else if(k==='first') v=easy/n*.6-hard/n*.8+(g.coach?.5:0)+(c.fish>0?0:-.6)+(lunchEarly?.2:0);
    else if(k==='seasick') v=.3-rough*.5+(early&&rough?.3:0)+(bt&&bt.short?.3:0);
    v=clamp(v,-1.2,1.2);out.h+=v*GOAL_H;if(v>=.25)out.good.push(k);else if(v<=-.25)out.bad.push(k);
  }
  out.h-=rough*2;
  return out;
}

// ---- reviews ----
const REV_OPEN={5:['Best day of our whole Alaska trip.','Five stars, no question.','We’re already planning next summer.'],4:['A really good day on the water.','Great day, great guide.','We’d book again.'],
  3:['A decent day on the water.','It was fine. Not magic, but fine.','Some good, some not.'],2:['Not the day we hoped for.','Disappointing, honestly.','We expected more for the money.'],1:['Save your money.','The low point of our trip.','Never again.']};
const REV_T={
  meat:[['We flew home with a box full of fillets.','Coolers full. That’s what we came for.'],['We came for fish to take home and didn’t get many.','The cooler was light for what we paid.']],
  trophy:[['We finally got the big one, and the photo is already on the fridge.','One real trophy, and that’s all we wanted.'],['No big fish, and that was the whole point for us.','Lots of small ones. We wanted one monster.']],
  kids:[['The kids had fish on all day, and lunch on the gravel bar was their favorite part.','Patient with our kids, kept them busy and fed.'],['The kids were bored stiff by mid-morning.','Long slow stretches are hard with kids.']],
  photo:[['The photos are unreal.','We got the shot. The scenery alone was worth it.'],['Not much to photograph but other boats.','We hoped for more scenery and wildlife.']],
  fly:[['Every fish on a fly, the way it should be.','Finally, a guide who respects fly fishing.'],['Bobbers and beads all day. Not our kind of fishing.','We came to fly fish and mostly didn’t.']],
  first:[['We’d never fished before, and Captain {{name}} coached us like pros.','Total beginners, and we never felt lost.'],['Nobody really showed us what to do.','Hard water for first-timers.']],
  seasick:[['Calm water and nobody got sick. A miracle.','Smart call on the weather; nobody turned green.'],['Half of us were green by nine.','Too rough for us. We spent the day at the rail.']],
};
const starsOf=h=>h>=88?5:h>=74?4:h>=58?3:h>=42?2:1;
function reviewOf(b,t,happy,c,goal){
  const st=starsOf(happy),parts=[pick(REV_OPEN[st])];
  goal.good.slice(0,1).forEach(k=>parts.push(pick(REV_T[k][0])));
  goal.bad.slice(0,1).forEach(k=>parts.push(pick(REV_T[k][1])));
  if(parts.length<3){const n=c.fish;parts.push(b.type==='king'?((b.kings||0)?`${numW(b.kings)} king${b.kings>1?'s':''} to the boat. In June!`:'Not a king all morning, but we saw them roll.'):b.type==='trout'?(n?`We caught and released ${n} trout.`:'Not a single trout.'):bagged(b)?(c.limits&&c.limits===c.fishers?'Everybody limited.':n?`We took home ${n} fish.`:'We didn’t catch a thing.'):'Rockfish and lingcod only, since halibut were closed that day.')}
  if(t.notes.some(n=>n.startsWith('🚨'))) parts.push('Watching our guide get a ticket was not the highlight.');
  else if(t.notes.some(n=>/🐻|🐋/.test(n))&&st>=3) parts.push('And the wildlife!');
  return {stars:st,text:withName(parts.join(' '))};
}
function addReview(b,t,happy,c,goal){
  const r=reviewOf(b,t,happy,c,goal),rec={day:b.d,who:b.who,type:b.type,stars:r.stars,text:r.text};
  S.reviews=S.reviews||[];S.reviews.push(rec);if(S.reviews.length>300)S.reviews.splice(0,S.reviews.length-300);
  return rec;
}
const reviewHTML=(rv,b)=>`<div class="review" style="border-left:3px solid var(--mute);padding:4px 10px;margin:8px 0"><b aria-label="${rv.stars} of 5 stars">${'★'.repeat(rv.stars)}${'☆'.repeat(5-rv.stars)}</b> <i>“${rv.text}”</i><br><span style="font-size:12.5px;color:var(--mute)">— the ${b.who}, ${b.from}</span></div>`;

// ---- judgment calls: no rule to break, or one whose cost depends on the party and the water ----
const G=t=>t.g||(t.g={});
const offWater=(t,m)=>{if(t.bt){t.bt.mv[t.bt.k]=(t.bt.mv[t.bt.k]||0)+m}else lose(t,m)};   // minutes taken out of this stretch's fishing
const biteNow=(b,t)=>t.bt?segQ(b,t,t.bt.k):.65;
const isCouple=b=>b.n===2||/couple|newlywed|honeymoon|anniversary/i.test(b.who||'');
const isOld=b=>/retired|grand|veteran|nurses|dentist|three generations|mail carriers|Ray/i.test(b.who||'');
function forecastOf(d){const w=wxOf(d),fc=Math.max(5,Math.round(w.wind+(hz(d,9,1)-.5)*8));return {lo:Math.max(5,fc-5),hi:fc+8,fc}}
Object.assign(STEP,{
  golook:(b,t)=>{const f=forecastOf(b.d),w=wxOf(b.d),sick=hasT(b,'seasick'),sca=f.hi>=22,fare=payOf(b);
    return {t:'📻 The marine forecast',b:`<p>Before anyone steps aboard, you listen to the NOAA weather radio for Kachemak Bay and lower Cook Inlet: <b>southwest ${Math.round(f.lo*.87)} to ${Math.round(f.hi*.87)} knots this afternoon${sca?', small-craft advisory possible':''}</b>. Forecasts out here miss both ways.</p><p>The ${b.who} are on the dock with their coffee.${sick?' Two of them already look pale.':''}</p>`,o:[
      Object.assign(O('Go, and fish the whole day','Full day, full fare. If the wind comes early, it’s a long ride home.',(b,t)=>{G(t).go='full'}),{v:-(f.fc>=14?(sick?14:5):1)}),
      Object.assign(O('Go, but stay close and run in early','The mouth of the bay and the flats only, back by 2 PM. Less fishing, a calmer ride.',(b,t)=>{G(t).go='short';if(t.bt){t.bt.short=true;t.bt.K=3;const i=t.steps.lastIndexOf('beat');if(i>t.step)t.steps.splice(i,1)}t.happy-=tv(b,{trophy:5,meat:4,seasick:-3},2)}),{v:-6+(f.fc>=14?(sick?10:3):0)}),
      Object.assign(O('Call it off and refund them',`No ${S.up.chp?'fares':'day rate'} (${$(fare)}). If the wind comes, they’ll thank you; if it doesn’t, they won’t.`,(b,t)=>{t.abort=true;const bad=w.wind>=16;adj('rep',bad?1:-3);tripCancel(b,bad?`📻 You call it off. By noon the advisory is up and whitecaps march across the bay. The ${b.who} buy you a beer that night.`:`📻 You call it off. The bay lies flat calm all day, and the ${b.who} notice.`)}),{v:-fare/25+(f.fc>=17?(sick?14:6):-4)})]};
  },
  hookhand:(b,t)=>{const fa=S.cred.fa>=day(),far=b.type==='trout'||b.type==='halibut';
    return {t:'🪝 A hook in the hand',b:`<p>A backcast goes wrong and a client has a ${b.type==='halibut'?'circle hook':b.type==='trout'?'streamer hook':'single hook'} buried past the barb in the meat of his hand. He’s pale but joking about it.${fa?' Your first-aid card is current.':' Your first-aid card has lapsed, and so has your practice.'}</p>`,o:[
      Object.assign(O('Push it through, snip the barb, clean and bandage it',fa?'15 minutes. You’ve done this before.':'15 minutes, if it goes well.',(b,t)=>{offWater(t,15);if(fa||Math.random()<.6){t.happy+=hasT(b,'first')?2:0;t.notes.push('🩹 Through, snip, out. Antiseptic and a bandage, and he’s fishing again in fifteen minutes.')}else{t.happy-=8;adj('rep',-2);t.notes.push('🩹 It takes three tries and a lot of swearing. He fishes the rest of the day with his hand in his lap.')}}),{v:fa?0:-4}),
      Object.assign(O(far?'Head for the take-out and get him to a clinic':'Run him to the hospital in Soldotna',far?'The day ends here for everyone. Most people are grateful; some came a long way to fish.':'An hour off the water for everyone. The hospital is minutes from the river.',(b,t)=>{
        if(far&&t.bt){beatEarly(b,t,t.bt.k,true);t.happy+=tv(b,{first:3,kids:1,meat:-8,trophy:-8},-2)}else{offWater(t,60);t.happy+=tv(b,{first:2,kids:0,meat:-5,trophy:-5},-1)}
        adj('rep',1);t.notes.push('🏥 The doctor has the hook out in five minutes and keeps it as a souvenir. “Good call bringing him in.”')}),{v:far?-16:-6}),
      Object.assign(O('Tape it up: he wants to keep fishing','No time lost. If it gets infected, it’s your name in the review.',(b,t)=>{if(Math.random()<.3){t.happy-=7;adj('rep',-3);t.notes.push('🩸 By afternoon his hand is swollen and red. He heads for urgent care, and the review mentions it.')}else{t.happy-=1;t.notes.push('🩹 Duct tape and grit. He lands two more fish with the hook still in.')}}),{v:-3})]};
  },
  boredkid:(b,t)=>{const bite=biteNow(b,t),hot=bite>=.7;
    return {t:'🧒 “How much longer?”',b:`<p>The youngest of the ${b.who} has stopped fishing, eaten every snack aboard and started asking how much longer. ${hot?'The bite is decent right now.':'The bite is slow.'}</p>`,o:[
      Object.assign(O('Put him on the next fish','The rod goes to him the second anything bites.',(b,t)=>{if(hot||Math.random()<.3){t.happy+=3;(G(t).kid=(G(t).kid||0)+.4);t.notes.push('🧒 Two minutes later the rod bends double and he lands it himself, yelling the whole time.')}else{t.happy-=6;t.notes.push('🧒 Nothing bites. He holds the rod for ten minutes and hands it back.')}}),{v:hot?3:-5}),
      Object.assign(O('Early shore lunch and rock skipping',`${LUNCH_MIN} minutes off the water. Kids reset fast.`,(b,t)=>{offWater(t,LUNCH_MIN);G(t).lunch=1;if(t.bt&&t.bt.lunch<0)t.bt.lunch=t.bt.k;t.happy+=1;t.notes.push('🪨 Shore lunch and a rock-skipping contest. The kid wins, and he’s back in the boat grinning.')}),{v:hot?-3:2}),
      Object.assign(O('Give him a job: net man and fish counter','He takes it very seriously.',(b,t)=>{t.happy-=1;G(t).kid=(G(t).kid||0)+.2}),{v:0})]};
  },
  rival:(b,t)=>{const bt=t.bt,cur=bt?bt.spot:0,sp=SPOTS[b.type],bite=biteNow(b,t),alts=sp.map((s,i)=>i).filter(i=>canMove(b.type,cur,i)),alt=!alts.length?cur:bt?alts.reduce((a,i)=>(beatRead(b,t,bt.k,i,sp[i].tac).f>beatRead(b,t,bt.k,a,sp[a].tac).f?i:a),alts[0]):alts[0],mins=MOVE[b.type][cur][alt]||15,gal=MOVE_GAL[b.type][cur][alt]||0;
    return {t:'🚤 Somebody drops in on your drift',b:`<p>Another guide boat slides in thirty feet upstream of you on ${sp[cur].sh} and starts fishing your seam. His clients are already casting over your lines.</p>`,o:[
      Object.assign(O('Hold your line and keep fishing',bite>=.7?'You were here first, and the fish are here.':'You were here first, but it isn’t much of a bite.',(b,t)=>{t.q-=.03;t.happy-=3;if(Math.random()<.3){adj('rep',-1);t.notes.push('📻 He complains about you on the radio all morning.')}}),{v:bite>=.7?2:-3}),
      Object.assign(O(`Give him the water and run to ${sp[alt].sh}`,`${mins} minutes${gal?` and ${gal} gallons`:''}. Calmer, and the fish there are anybody’s guess.`,(b,t)=>{if(t.bt)beatGo(b,t,t.bt.k,{i:alt,tac:sp[alt].tac,mins,gal});t.happy-=1}),{v:bite>=.7?-4:2}),
      Object.assign(O('Raise him on the radio and work out a rotation','10 minutes of diplomacy and you share the seam.',(b,t)=>{offWater(t,10);t.q-=.01;t.happy+=tv(b,{meat:-4,trophy:-4},-2)}),{v:tv(b,{meat:-4,trophy:-4},-2)})]};
  },
  couple:(b,t)=>{const bite=biteNow(b,t),hot=bite>=.7;
    return {t:'💬 Trouble in the bow',b:`<p>Two of the ${b.who} have been sniping at each other since the launch: who tangled whose line, who booked this trip, who forgot the sunscreen. It’s getting loud.</p>`,o:[
      Object.assign(O('Split them bow and stern and keep the rods busy',hot?'The bite is on: a fish fixes most things.':'With a slow bite, they’ll just stew.',(b,t)=>{if(hot||Math.random()<.3){t.happy+=1;t.notes.push('🎣 A double hookup, bow and stern. By the time both fish are in the net, they’re laughing.')}else{t.happy-=6;t.notes.push('😶 A long, quiet stretch with your back to both of them.')}}),{v:hot?1:-5}),
      Object.assign(O('Pull over for a shore break','25 minutes off the water to stretch and cool off.',(b,t)=>{offWater(t,25);t.happy-=1;t.notes.push('🌲 A walk up the gravel bar, a snack, and a truce.')}),{v:-3}),
      Object.assign(O('Stay out of it and fish','Not your circus.',(b,t)=>{if(Math.random()<.5){t.happy-=1}else{t.happy-=7;t.notes.push('💬 It boils over at lunch. You hear all about it.')}}),{v:-4})]};
  },
  exhausted:(b,t)=>{const old=isOld(b);
    return {t:'🥵 “I’m fine. Keep going.”',b:`<p>One of the ${b.who}${old?', the oldest of them,':''} is gray in the face and wobbly on his feet, but he won’t hear of stopping: “I flew three thousand miles for this.”</p>`,o:[
      Object.assign(O('Keep fishing: it’s his trip','He gets every minute he paid for.',(b,t)=>{t.q+=.02;if(Math.random()<(old?.35:.2)){t.happy-=9;adj('rep',-2);t.notes.push('🥵 He sits down hard on the gravel bar and doesn’t get up for a while. Everybody is scared, and the day is done.')}else{t.happy-=1;t.notes.push('💪 He grits it out and lands one more.')}}),{v:old?-4:-1}),
      Object.assign(O('Shade, water and one last easy drift','20 minutes in the shade first.',(b,t)=>{offWater(t,20);t.happy-=1;adj('energy',2);t.notes.push('🧃 Water, shade and a sandwich, then one easy drift. He’s pink again by the end.')}),{v:-2}),
      Object.assign(O('Call it for the day','Everyone heads in now.',(b,t)=>{if(t.bt)beatEarly(b,t,t.bt.k,true);t.happy+=tv(b,{kids:1,first:0,meat:-7,trophy:-6},-3)}),{v:tv(b,{kids:-2,meat:-12,trophy:-10},-7)})]};
  },
  friend:(b,t)=>{const bite=biteNow(b,t),hot=bite>=.75;
    return {t:'📻 Dale’s boat is skunked',b:`<p>Your old friend Dale comes on the radio, quiet: his clients haven’t had a bite all ${b.type==='silver'?'afternoon':'day'} and he’s running out of ideas. ${hot?'You’re sitting on a good bite.':'Your own bite is just okay.'}</p>`,o:[
      Object.assign(O('Wave him onto your water','It costs your clients a little room; he won’t forget it.',(b,t)=>{t.q-=hot?.05:.02;adj('rep',2);t.happy+=tv(b,{meat:-4,trophy:-3,first:0,photo:0},-1);S.stats.shared=(S.stats.shared||0)+1;t.notes.push('🤝 Dale slides in below you and his clients hook up on the first drift. He owes you one.')}),{v:hot?-2:1}),
      Object.assign(O('Radio him your second-best spot','Free, and it helps.',(b,t)=>{adj('rep',1);t.notes.push('📻 Dale goes quiet on the radio. An hour later: “Thanks, friend.”')}),{v:1}),
      Object.assign(O('Keep it to yourself','Your clients, your fish.',(b,t)=>{if(Math.random()<.3){adj('rep',-1);t.notes.push('📻 Dale sees the bent rods from across the river.')}}),{v:hot?1:-1})]};
  },
  scenic:(b,t)=>{const what=b.type==='halibut'?'A pod of Dall’s porpoises rides the bow wave, with the glaciers of Kachemak Bay behind':b.type==='trout'?'A bald eagle lands on a snag twenty yards off, the turquoise river behind it':'A bald eagle drops onto a gravel bar with a sockeye in its talons';
    return {t:'🦅 The shot',b:`<p>${what}. The light is perfect.${hasT(b,'photo')?' Every camera in the boat comes out.':''}</p>`,o:[
      Object.assign(O('Hold the boat steady for the shot','15 minutes off the fish.',(b,t)=>{offWater(t,15);G(t).shot=1;t.happy+=tv(b,{photo:4,kids:1,meat:-4,trophy:-3},0);t.notes.push('📸 You hold the boat in the slack water while the cameras click. It’s the picture of the trip.')}),{v:tv(b,{photo:6,kids:0,meat:-6,trophy:-4},-2)}),
      Object.assign(O('Point it out and keep fishing','The fish are biting, and the eagle will be there.',(b,t)=>{if(Math.random()<.3)G(t).shot=1;t.happy+=tv(b,{photo:-4},0)}),{v:tv(b,{photo:-5,meat:0},0)})]};
  },
  fog:(b,t)=>({t:'🌫️ Fog off the inlet',b:'<p>A fog bank rolls in off Cook Inlet and swallows the boat. You can’t see the bow rail. Radar and GPS work fine. Other boats are out here somewhere.</p>',o:[
    Object.assign(O('Slow to a crawl on radar, sounding the horn','30 minutes lost, and nobody gets hurt.',(b,t)=>{offWater(t,30);t.notes.push('🌫️ You creep along at five knots, horn every two minutes, until it thins.')}),{v:-2}),
    Object.assign(O('Shut down and fish where you are until it lifts','The bite here is what it is.',(b,t)=>{t.q-=.03;t.happy-=2}),{v:-3}),
    Object.assign(O('Run at cruising speed: you know these waters','No time lost. The rules say safe speed in fog.',(b,t)=>{t.q+=.02;if(Math.random()<.15){t.happy-=12;adj('boat',-8);t.notes.push('😱 A gillnetter looms out of the fog at fifty yards. You miss by a boat length. Nobody talks for an hour.')}violate(t.notes,{p:.15,fine:500,what:'running at an unsafe speed in fog',minor:true,who:'a Coast Guard boarding team'})},1),{v:1})]}),
  lostrod:(b,t)=>({t:'🎣 Overboard',b:`<p>One of the ${b.who} sets the hook so hard the rod flies out of his hands and over the side. Your rod, your reel: about ${$(165)} worth. He is mortified.</p>`,o:[
    Object.assign(O('Laugh it off: it happens',`You eat the ${$(165)}, and he loves you for it.`,(b,t)=>{fx(t,-165,'Rod and reel lost overboard');t.happy+=tv(b,{first:3,kids:2},1)}),{v:-3}),
    Object.assign(O('Ask him to cover it','Fair, and awkward.',(b,t)=>{t.happy+=tv(b,{first:-7,kids:-3,meat:-2},-4);t.notes.push('💵 He pays for the rod. The next hour is quiet.')}),{v:tv(b,{first:-7,kids:-3},-4)+4}),
    Object.assign(O('Fish for it with a heavy weighted hook','20 minutes; maybe you snag the line.',(b,t)=>{offWater(t,20);if(Math.random()<.4){t.happy+=1;t.notes.push('🪝 Third pass, you hook the line and hand-line the whole outfit back up, fish still on it. The boat goes wild.')}else{fx(t,-165,'Rod and reel lost overboard');t.happy-=2;t.notes.push('🪝 Twenty minutes of dragging the bottom. It’s gone.')}}),{v:-2})]}),
});

