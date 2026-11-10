// ============================================================
//  GUIDE MASTER, part 3: running a trip.
//  Enforcement (cite / violate), the trip runner (a chain of decision pop-ups),
//  fishing spots and the dilemmas ("steps"). Rules follow the 2026 Kenai summary in regsView() (20-world.js).
// ============================================================

// ---- enforcement ----
const COPS=['an Alaska Wildlife Trooper','a State Parks ranger in a jet sled','an ADF&G enforcement officer at the launch'];
const NOAA='a NOAA Fisheries enforcement officer at the harbor';
function cite(what,fine,minor,notes,who){
  who=who||pick(COPS);let line;
  if(minor&&S.warns<1){S.warns++;line=`⚠️ ${who} writes you a warning for ${what}.`}
  else{S.cites++;S.citeLog.push(day());S.stats.citesTotal=(S.stats.citesTotal||0)+1;money(-fine);S.stats.fines+=fine;adj('rep',-6);
    line=`🚨 ${who} cites you for ${what}: ${$(fine)} fine. That’s ${S.cites} active citation${S.cites>1?'s':''} of 3 before State Parks pulls your Kenai River guide permit. (Citations drop off after the next season.)`}
  showTile('🚨',minor&&line.startsWith('⚠️')?'Warning':'Citation',what,'bad');
  if(notes) notes.push(line); else say(line);
}
function violate(notes,{p,fine,what,minor,who}){
  S.stats.viol++;
  if(Math.random()<p*DF().bad){cite(what,fine,minor,notes,who);return true}
  if(Math.random()<.3){adj('rep',-2);const l='👀 Another guide saw it. Word travels fast on the Kenai.';if(notes)notes.push(l);else say(l)}
  return false;
}

// ---- spots ----
const SPOTS={
  reds:[
    {l:'Slip into the seams below Big Eddy at first light',s:'Classic sockeye water. Elbow-to-elbow boats by eight.',q:.08,h:0},
    {l:'Run up to the gravel bars near Swiftwater Park',s:'Less pressure, fewer fish, happier clients.',q:.02,h:3},
    {l:'Drop them on the empty bank by the “Habitat restoration: closed to fishing” sign',s:'Nobody’s there, and the reds hug that bank.',q:.15,h:0,viol:{p:.4,fine:300,what:'fishing a bank closed to protect riparian habitat'}},
    {l:'Use the public elevated walkway at Centennial',s:'Legal, easy footing, full-contact combat fishing.',q:0,h:4}],
  silver:[
    {l:'Back-troll single-hook plugs through the Pillars',s:'Slow and steady down the deep slots.',q:.06,h:0},
    {l:'Drift spinners past Eagle Rock',s:'Early silvers stage in the soft water.',q:.04,h:0},
    {l:'Work the Moose Range Meadows bend',s:'Pretty, quiet, a little thin on fish.',q:.02,h:2}],
  trout:[
    {l:'Beads below the Russian River confluence',s:'Rainbows stack behind spawning reds. So do anglers. So do bears.',q:.1,h:0,add:['flyonly','chop']},
    {l:'Swing streamers through the Sportsman’s Landing riffles',s:'Fewer people, fun grabs.',q:.04,h:0},
    {l:'Push on through to Skilak Lake',s:'Big water, big fish, and Skilak’s famous afternoon wind.',q:.12,h:0,risk:{p:.35,txt:'💨 The Skilak wind kicks up four-foot waves on the crossing. Everyone is soaked and nobody is smiling.',h:-10,boat:-10,energy:-8}}],
  halibut:[
    {l:'Fish the mouth of Kachemak Bay at slack tide',s:'Short run, easy ride. Cook Inlet tides rule everything.',q:.03,h:0},
    {l:'Run to the flats off Anchor Point',s:'Solid “chicken” halibut and the odd barn door.',q:.06,h:0},
    {l:'Make the long run toward the Barren Islands',s:'The big fish are out there. So is the weather.',q:.14,h:0,risk:{p:.3,txt:'🌊 A small-craft advisory comes up on the radio. Rips at the tide change, green water over the bow, four seasick clients.',h:-15,boat:-12,energy:0}}],
};

// ---- dilemmas ----
// Each returns {t:title, b:body html, o:[{l, s, fn(b,t)}]}. After any option the runner moves to the next step.
const O=(l,s,fn)=>({l,s,fn});
const STEP={
  issue_sunmon:(b)=>({t:`🚫 It’s ${dayName(b.d)}`,b:`<p>From May 1 to July 31, sport fishing from a guide vessel on the Kenai downstream of the Skilak Lake outlet is <b>closed on Sundays and Mondays</b>. The ${b.who} are standing at the launch anyway, rods in hand.</p>`,o:[
    O('Call it off and refund them','Legal. Rep −4, no pay.',(b,t)=>{adj('rep',-4);t.abort=true;tripCancel(b,`🚫 You refund the ${b.who} and explain the rule. They grumble, but they get it.`)}),
    O('Run it anyway. It’s one day.','Full pay if nobody notices.',(b,t)=>violate(t.notes,{p:.55,fine:750,what:'fishing from a guide vessel on a closed day'}))]}),
  issue_overload:(b)=>{const mx=TRIPS[b.type].max;return {t:'👥 Too many for the boat',b:`<p>You booked ${b.n}. In July, below Skilak, a guide boat may hold no more than <b>5 people while fishing, guide included</b>${b.type==='reds'?', and you can carry 5 clients plus yourself only if they all fish from shore':''}. KRSMA caps any motorboat at 6 aboard.</p>`,o:[
    O('Leave the extras fishing from shore at Centennial','Legal. They’re less thrilled.',(b,t)=>{t.happy-=6;t.notes.push(`🏞️ ${b.n-mx} of the ${b.who} fish the Centennial walkway instead.`)}),
    O(`Refund the extras and take ${mx}`,'Legal. Less pay.',(b,t)=>{t.happy-=3;b.n=mx;t.notes.push(`💵 You refund the extra anglers and run with ${mx}.`)}),
    O('Squeeze everyone in','Full pay, a very full boat.',(b,t)=>violate(t.notes,{p:.4,fine:400,what:'too many people in a guide boat'}))]}},
  five:(b)=>({t:'👥 Five clients in July',b:'<p>Below Skilak in July you may carry 5 clients plus yourself <b>only to fish from shore</b>. Fishing from the boat, the limit is 5 people including you.</p>',o:[
    O('Everyone fishes from the bank','Legal. A little slower.',(b,t)=>{t.shore=true;t.q-=.03;t.notes.push('🏞️ You ferry all five to a gravel bar and they flip from shore.')}),
    O('Let them fish from the boat on the drift','Better catch.',(b,t)=>{t.q+=.05;violate(t.notes,{p:.35,fine:400,what:'too many people fishing from a guide vessel in July',minor:true})})]}),
  license:(b)=>({t:'🪪 Somebody forgot a license',b:`<p>One of the ${b.who} never bought an Alaska sport fishing license. Every angler 16 and older needs one, and it goes in your logbook.</p>`,o:[
    O('Have him buy one on his phone','ADF&G online store. 20 minutes at the launch.',(b,t)=>{t.happy-=2;t.notes.push('📱 License bought at the launch, number written in your logbook.')}),
    O('He can ride along but not fish','Legal. He sulks.',(b,t)=>{t.nofish++;t.happy-=8}),
    O('Let it slide. Who’s checking?','Everybody fishes.',(b,t)=>violate(t.notes,{p:.3,fine:300,what:'guiding an unlicensed angler'}))]}),
  expired:(b)=>({t:'⛑️ Your first-aid card expired',b:'<p>A current first-aid and CPR certification is a condition of your guide license. As of today yours is expired.</p>',o:[
    O('Cancel and refund','Legal. Rep −6.',(b,t)=>{adj('rep',-6);t.abort=true;tripCancel(b,`⛑️ You cancel on the ${b.who}. Get to the Tuesday/Thursday class in Soldotna.`)}),
    O('Run it anyway','Hope nobody asks for your card.',(b,t)=>violate(t.notes,{p:.3,fine:500,what:'guiding without a current first-aid certification'}))]}),
  spot:(b)=>{const T=TRIPS[b.type];return {t:`${T.ic} Where to, Captain?`,b:`<p>${T.long}</p><p>The ${b.who} are rigged and ready. Where do you take them?</p>`,o:SPOTS[b.type].map(sp=>O(sp.l,sp.s,(b,t)=>{
    t.q+=sp.q;t.happy+=sp.h||0;t.notes.push(`📍 ${sp.l}.`);
    if(sp.viol) violate(t.notes,sp.viol);
    if(sp.risk&&Math.random()<sp.risk.p*windRisk()){t.notes.push(sp.risk.txt);t.happy+=sp.risk.h;adj('boat',sp.risk.boat||0);adj('energy',sp.risk.energy||0)}
    if(sp.add) t.steps.splice(t.step+1,0,...sp.add.filter(x=>!t.steps.includes(x)));}))}},
  beer:(b)=>({t:'🍺 Cooler’s open',b:`<p>It’s barely 7 AM and the ${b.who} crack the cooler. “Have one, Captain {{name}}!”</p>`,o:[
    O('Politely decline: you’re running the boat','Legal.',()=>{}),
    O('Ask them to keep it closed till we’re off the water','Safer boat, quieter clients.',(b,t)=>{t.happy-=4}),
    O('Have just one, to be social','They love you for it.',(b,t)=>{t.happy+=4;violate(t.notes,{p:.25,fine:1000,what:'operating a vessel after drinking (BUI)'})})]}),
  king:(b)=>{const k=kingRule(),head=`<p>A chrome king, easily 50 pounds, rolls beside the boat on a sockeye rig.</p><p>👑 <b>${REG().year}:</b> ${kingRuleTxt()}</p><p>Somewhere, Les Anderson’s 97-pounder is smiling.</p>`;
    if(k==='open') return {t:'👑 Fish on. A big one.',b:head,o:[
      O('Net it, keep it and record it on the harvest record','Legal: kings are open this year.',(b,t)=>{t.happy+=12;t.kept++;S.stats.legalKings=(S.stats.legalKings||0)+1;t.notes.push('👑 A legal Kenai king, recorded on the client’s harvest record before it hits the cooler. He’s calling his whole family.')}),
      O('Release it to fight another day','Legal, and generous.',(b,t)=>{t.happy+=5;S.stats.kings++}),
      O('Keep it, skip the harvest record','Paperwork is for later.',(b,t)=>{t.happy+=12;t.kept++;violate(t.notes,{p:.3,fine:200,what:'not recording a king salmon on a harvest record',minor:true})})]};
    return {t:'👑 Fish on. A big one.',b:head,o:[
      O('Release it without lifting it from the water','Legal. A story they’ll tell forever.',(b,t)=>{t.happy+=k==='cr'?6:3;S.stats.kings++;t.notes.push('👑 You slip the hook with the king still in the water. It holds a second, then melts into the current.')}),
      O('Lift it for one quick photo','The photo of a lifetime.',(b,t)=>{t.happy+=8;violate(t.notes,{p:.3,fine:300,what:'removing a king salmon from the water',minor:true})}),
      O('Bonk it. Once in a lifetime.','They’d pay double.',(b,t)=>{t.happy+=10;adj('rep',-8);t.kept++;t.notes.push('📵 Every boat on the drift watched you net that king.');violate(t.notes,{p:.6,fine:1500,what:'keeping a king salmon when kings can’t be kept'})})]}},
  snag:(b)=>({t:'🪝 Hooked in the back',b:'<p>A sockeye comes in hooked by the dorsal fin. “It counts, right?” In fresh water, a fish hooked anywhere but the mouth must be released immediately.</p>',o:[
    O('Release it','Legal.',(b,t)=>{t.happy-=1}),
    O('Keep it. Close enough.','One more for the cooler.',(b,t)=>{t.kept++;violate(t.notes,{p:.25,fine:200,what:'keeping a foul-hooked sockeye',minor:true})})]}),
  over:(b)=>({t:'🐟 Limited out, wants more',b:`<p>One of the ${b.who} has his ${S.limit} reds and wants to keep catching “for his wife back home.” Bag limits are per person, and nobody can catch someone else’s.</p>`,o:[
    O('He’s done keeping fish','Legal.',(b,t)=>{t.happy-=2}),
    O('Keep a few extra for his wife','Happy client.',(b,t)=>{t.kept+=2;t.happy+=3;violate(t.notes,{p:.3,fine:400,what:'exceeding the bag limit'})})]}),
  guide_fish:(b)=>({t:'🎣 “Show us how it’s done!”',b:'<p>Slow stretch. The clients want you to grab a rod. A guide may not sport fish while clients are present.</p>',o:[
    O('Coach them from the oars','Legal. You get better at teaching.',(b,t)=>{S.skill++;t.notes.push('🧑‍🏫 You fix their drift and their hooksets. Next pass, two fish on.')}),
    O('Fish a rod yourself for a bit','You’re better at this than they are.',(b,t)=>{t.q+=.06;violate(t.notes,{p:.25,fine:250,what:'sport fishing while guiding clients',minor:true})})]}),
  extra_rod:(b)=>({t:'🎣 “Can we run extra rods?”',b:'<p>The clients want a couple of extra plugs out to cover more water. The rods in the water may not outnumber the clients aboard.</p>',o:[
    O('One rod per client','Legal.',()=>{}),
    O('Put out two extra rods','More water covered.',(b,t)=>{t.q+=.05;violate(t.notes,{p:.3,fine:250,what:'more rods than clients on a guide vessel',minor:true})})]}),
  bait:(b)=>({t:'🥚 The silvers won’t commit',b:'<p>Fish are rolling, but they’re sniffing your lures and turning away. The boat next to you is back-bouncing cured roe. Below Skilak, through Aug 15, the emergency order allows <b>one unbaited, single-hook, artificial lure</b>.</p>',o:[
    O('Stick with single-hook lures','Legal. Patience.',()=>{}),
    O('Switch to cured roe','Silvers love eggs.',(b,t)=>{t.q+=.12;violate(t.notes,{p:.35,fine:300,what:'using bait under the emergency order'})}),
    O('Tie on a treble-hook spinner','More hookups.',(b,t)=>{t.q+=.06;violate(t.notes,{p:.25,fine:200,what:'fishing a treble hook under the emergency order',minor:true})})]}),
  sixpm:(b)=>({t:'🕕 5:40 PM, and the bite turns on',b:'<p>The tide pushes in fresh silvers and every rod bends at once. Guide-vessel fishing below Skilak is <b>6 AM to 6 PM</b> only through July 31.</p>',o:[
    O('Lines up at 6:00 sharp','Legal. Groans all around.',(b,t)=>{t.happy-=3}),
    O('Fish till 6:30','Ride the bite.',(b,t)=>{t.q+=.1;violate(t.notes,{p:.4,fine:400,what:'guide-vessel fishing after 6 PM'})})]}),
  motor:(b)=>({t:'⚙️ The jet sucks up gravel',b:'<p>The jet intake grabs a mouthful of rocks on a shallow bar and the motor starts to cavitate.</p>',o:[
    O('Beach it and clear the intake','30 minutes lost.',(b,t)=>{t.q-=.04;adj('boat',-5)}),
    O('Limp on','The impeller will hate you.',()=>{adj('boat',-15)})]}),
  anchor:(b)=>({t:'⚓ The best seam',b:'<p>The fish are holding right in the middle of the drift channel. KRSMA rules: don’t anchor in a way that blocks the primary traffic or drift-fishing channel.</p>',o:[
    O('Anchor on the edge of the seam','Legal.',()=>{}),
    O('Drop anchor mid-channel','Right on the fish. Drift boats must go around.',(b,t)=>{t.q+=.05;violate(t.notes,{p:.3,fine:200,what:'anchoring in the drift channel',minor:true})})]}),
  combat:(b)=>({t:'🥊 Combat fishing',b:'<p>A bank angler wades in right below your clients (“low-holing”) and tangles three lines at once.</p>',o:[
    O('Share the water and untangle with a smile','The Kenai is everybody’s river.',(b,t)=>{t.happy+=2;adj('rep',1)}),
    O('Tell him off','Satisfying for about ten seconds.',(b,t)=>{adj('rep',-3);t.notes.push('📱 Someone filmed it. It’s on a Kenai fishing forum by lunch.')})]}),
  photo:(b)=>({t:'🌈 A 26-inch leopard rainbow',b:'<p>The fish of the trip. Upper Kenai rainbows are catch-and-release, and they’re best kept wet.</p>',o:[
    O('Photo with the fish in the water','Legal, and the right way.',(b,t)=>{t.happy+=6}),
    O('Drag it up on the gravel for a hero shot','Better light.',(b,t)=>{t.happy+=7;if(Math.random()<.3){adj('rep',-4);t.notes.push('📸 The gravel-bar photo gets shared, and the comments are brutal.')}})]}),
  bear:(b)=>({t:'🐻 Sow and two cubs',b:'<p>A brown bear sow and two cubs are working a sockeye carcass on the gravel bar ahead. Bear spray is on your hip.</p>',o:[
    O('Give them the bar and wait','40 minutes. Unforgettable.',(b,t)=>{t.q-=.04;t.happy+=3;S.stats.bear++;t.notes.push('🐻 You hold in an eddy and watch the cubs wrestle. Nobody speaks for ten minutes.')}),
    O('Drift past quietly mid-river','Calm and wide.',()=>{}),
    O('Beach close for photos','Closer is better, right?',(b,t)=>{if(Math.random()<.35){t.happy-=15;adj('rep',-5);adj('energy',-10);t.notes.push('🐻 The sow bluff-charges to the water’s edge. You row hard. Someone cries.')}else t.happy+=4})]}),
  flyonly:(b)=>({t:'🪰 Fly-fishing only',b:'<p>At the Russian River confluence one client wants to throw a spinner. This water is <b>fly-fishing only, June 11 to August 20</b>.</p>',o:[
    O('Hand him a fly rod','Legal.',()=>{}),
    O('Let him spin','He’s paying.',(b,t)=>violate(t.notes,{p:.3,fine:150,what:'spin fishing in fly-only water',minor:true}))]}),
  chop:(b)=>({t:'🔪 Cleaning the reds',b:'<p>The clients kept a few reds at the confluence. Carcasses draw bears to the bank. Take fish out whole, or fillet at the cleaning tables and <b>stop, chop and throw</b> the carcasses into deep, fast water.</p>',o:[
    O('Stop, chop and throw','Legal, bear-smart.',()=>{S.stats.chop++}),
    O('Leave the carcasses on the bank','Saves 20 minutes.',(b,t)=>{adj('rep',-3);violate(t.notes,{p:.3,fine:200,what:'leaving fish waste on the bank',minor:true})})]}),
  tuewed:(b)=>({t:`⚓ It’s ${dayName(b.d)}`,b:`<p>In Area 3A this summer, charter anglers <b>can’t keep halibut on ${halDaysTxt()}</b> (early June to late August). The clients flew in for halibut.</p>`,o:[
    O('Target lingcod and rockfish, release the halibut','Legal. Disappointed faces.',(b,t)=>{t.happy-=8}),
    O('Keep a couple of halibut anyway','Coolers full.',(b,t)=>{t.happy+=6;t.kept+=2;violate(t.notes,{p:.45,fine:1500,what:'keeping halibut on a closed charter day',who:NOAA})})]}),
  size27:(b)=>({t:'📏 The second fish',b:`<p>A client’s second halibut tapes ${halSize()+7} inches. Charter rules this year: one fish of any size, and <b>the second must be ${halSize()} inches or less</b>.</p>`,o:[
    O('Release it','Legal.',(b,t)=>{t.happy-=2}),
    O('Keep it','It’s only 7 inches over.',(b,t)=>{t.kept++;violate(t.notes,{p:.35,fine:800,what:'keeping an oversize second halibut',who:NOAA})})]}),
  crew:(b)=>({t:'🧑‍✈️ The deckhand’s request',b:'<p>Your deckhand wants to keep a halibut for his freezer. On a charter, the captain and crew don’t keep halibut.</p>',o:[
    O('No','Legal.',()=>{}),
    O('Sure, one fish','Keeps the crew happy.',(b,t)=>violate(t.notes,{p:.25,fine:500,what:'crew retaining halibut on a charter',minor:true,who:NOAA}))]}),
};
const POOL={reds:['king','snag','over','guide_fish','anchor','combat','motor'],silver:['bait','king','extra_rod','guide_fish','motor'],trout:['bear','photo','combat','guide_fish'],halibut:['size27','crew']};

// ---- the runner ----
function tripStart(b){
  const T=TRIPS[b.type],late=Math.max(0,tod()-T.start),t={id:b.id,late,q:0,happy:0,notes:[],step:0,steps:[],shore:false,nofish:0,kept:0,abort:false};
  if(late){t.happy-=late/3;t.notes.push(`⏰ You rolled in ${late} minutes late. The ${b.who} noticed.`)}
  const iss=issueOf(b);if(iss) t.steps.push('issue_'+iss);
  if(b.type==='reds'&&b.n===5) t.steps.push('five');
  if(b.quirk.includes('nolicense')) t.steps.push('license');
  if(S.cred.fa<day()) t.steps.push('expired');
  t.steps.push('spot');
  const want=S.diff==='hard'?3:2,beats=[],q=b.quirk;
  if(q.includes('drinker')) beats.push('beer');
  if(q.includes('kingfan')&&(b.type==='reds'||b.type==='silver')) beats.push('king');
  if(q.includes('photo')&&b.type==='trout') beats.push('photo');
  if(b.type==='halibut'&&halClosed(b.d)) beats.push('tuewed');
  if(S.boat<25&&TRIPS[b.type].fuel){beats.push('motor');t.q-=.08;t.notes.push('🔧 The neglected jet sled runs rough all day. Service the boats at the shop.')}
  if(q.includes('promised')){t.happy-=15;t.notes.push('👑 They were “promised” a shot at a king. There was never going to be one: the fishery is closed.')}
  const pool=POOL[b.type].filter(x=>!beats.includes(x)&&!(x==='bait'&&!noBait())&&!(x==='size27'&&halClosed(b.d)));
  while(beats.length<want&&pool.length) beats.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  t.steps.push(...beats.slice(0,Math.max(want,beats.length)));
  if(b.type==='silver') t.steps.push('sixpm');
  S.trip=t;sfx('whoosh');tripNext();
}
function tripNext(){
  const t=S.trip;if(!t) return;
  const b=bk(t.id);if(!b||b.status!=='booked'){S.trip=null;return}
  if(t.step>=t.steps.length) return tripEnd(b,t);
  const f=STEP[t.steps[t.step]];if(!f){t.step++;return tripNext()}
  const v=f(b,t),T=TRIPS[b.type];
  modal(v.t,`<p class="small-note" style="color:var(--mute);margin:0 0 6px">${T.ic} ${T.n} · ${b.who}</p>${v.b}`,v.o.map(o=>({l:o.l,s:o.s,fn:()=>{
    const tt=S.trip;if(!tt) return;const bb=bk(tt.id);if(!bb) {S.trip=null;return}
    o.fn&&o.fn(bb,tt);
    if(S.trip&&!tt.abort){tt.step++;tripNext()}}})));
}
function tripCancel(b,note){b.status='cancelled';S.stats.cancelled++;S.trip=null;if(note)say(note)}
function tripEnd(b,t){
  const T=TRIPS[b.type],d=day(),r=Math.random;
  let q=.5+t.q+runFactor(b.type)+(WX[S.wx[d]||'sun']||WX.sun).q+(S.prep===d?.08:0)+(S.scout>=d-1&&T.loc==='lower'?.05:0)
    +upQ(b.type)+(S.gear>0?0:-.15)+(S.boat<40?-.1:0)+(S.energy<30?-.1:0)+Math.min(.1,S.skill*.01)+(r()-.5)*.24;
  q=clamp(q,.05,1);
  const fishers=Math.max(0,b.n-t.nofish);let fish=0,frac=0,line='',limits=0;
  if(b.type==='reds'||b.type==='silver'){
    const lim=b.type==='reds'?S.limit:2,nm=b.type==='reds'?'red':'silver';
    for(let i=0;i<fishers;i++){const c=clamp(Math.round(lim*q+(r()-.5)*1.6),0,lim);fish+=c;if(c===lim)limits++}
    frac=fishers?fish/(lim*fishers):0;
    if(fishers&&limits===fishers){S.stats.limits++;t.happy+=5}
    line=`${fish} ${nm}${fish===1?'':'s'}${limits?`, ${limits} limit${limits>1?'s':''}`:''}`;
  }else if(b.type==='trout'){
    fish=Math.round(fishers*(2+q*8));frac=q;line=`${fish} trout landed & released`;
  }else{
    frac=q;
    if(halClosed(b.d)){const rk=Math.round(fishers*(1+q*3));line=`${rk} rockfish & lingcod, halibut released`}
    else{for(let i=0;i<fishers;i++)fish+=clamp(Math.round(2*q+(r()-.5)*1.2),0,2);S.stats.halibut+=fish;line=`${fish} halibut`}
  }
  fish+=t.kept;
  const happy=45+frac*45+t.happy+upH(b.type),dRep=clamp(Math.round((happy-60)/5),-12,10);
  const pay=payOf(b),base=b.type==='halibut'&&!S.up.chp?1200:pay,tip=Math.round(base*clamp((happy-50)/250,0,.2));
  const costs=T.fuel+(T.loc==='lower'?10:0);
  S.gear=Math.max(0,S.gear-1);
  pass(T.len);adj('energy',-T.energy);adj('boat',-Math.round((3+Math.floor(r()*4))*(S.up.motor?.5:1)));adj('rep',dRep);
  money(pay+tip-costs);
  const st=S.stats;st.trips++;st.clients+=b.n;st.fish+=fish;st.earned+=pay;st.tips+=tip;st.spent+=costs;
  S.unlogged++;S.skill++;
  b.status='done';b.res={happy:Math.round(happy),fish,line};S.trip=null;
  say(`${T.ic} ${T.n} with the ${b.who}: ${line}. Paid ${$(pay)} + ${$(tip)} tip.`);
  const mood=happy>=75?'😁 They’re already asking about next July.':happy>=55?'🙂 Solid day. Handshakes at the trailer.':happy>=40?'😐 Polite thanks, small tip.':'😠 Tight-lipped goodbyes. Expect a rough review online.';
  modal(`${T.ic} Back at the dock`,`${t.notes.map(n=>`<p>${n}</p>`).join('')}
    <p><b>Catch:</b> ${line}${t.kept?` (${t.kept} kept on the sly)`:''}</p>
    <p><b>Pay:</b> ${$(pay)}${b.type==='halibut'&&!S.up.chp?' day rate':''} · <b>Tip:</b> ${$(tip)} · <b>Costs:</b> ${$(costs)}</p>
    <p>${mood} Rep ${dRep>=0?'+':'−'}${Math.abs(dRep)}.</p>
    <p style="font-size:13px;color:var(--mute)">📓 Log it in your ADF&amp;G logbook before bed.</p>`,[{l:'Head in',fn:()=>{}}]);
  sfx(happy>=50?'good':'bad');
}
