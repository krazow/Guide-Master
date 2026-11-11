// ============================================================
//  GUIDE MASTER, part 1: the world.
//  A 2-, 5- or 10-year career running a guide business out of Soldotna, Alaska; each year you play the two-week July peak
//  (season 1 is Mon Jul 13 – Sun Jul 26, 2026).
//  Places, trip types, bookings, actions, scenery and the two extra tabs (Bookings, Regs).
//
//  The regulations in this game are a simplified summary of the real 2026 rules for the Kenai
//  (ADF&G, Alaska State Parks/KRSMA, NOAA for halibut). They change every season and by emergency order:
//  the in-game Regs tab says so too.
// ============================================================

// ---- calendar: seasons, dates and rule-of-the-year helpers live in 24-career.js ----
const OVERHEAD=57, overhead=()=>Math.round(OVERHEAD*DF().cost), rp=c=>Math.round(c*DF().cost);                                       // boat payment, insurance, utilities: every night (groceries moved to 31-supplies.js in 1.7.0: $75 → $57, so food isn't paid twice)

// ---- the game-specific part of the save ----
function newState(){
  return {years:(typeof prefs==='function'&&prefs().years)||2,reg:null,up:{rate:1,value:0},citeLog:[],seasons:[],st0:null,winter:null,
    fuel:18,hfuel:0,fuelBase:{kenai:6.19,homer:6.45},
    money:1500,rep:50,energy:90,boat:85,loaner:-1,patch:null,riskWarned:false,cites:0,warns:0,
    dipnetAsk:-1,         // season index of the last dipnet-scam request (at most one per season)
    cred:{fa:2},            // first-aid/CPR card valid through the end of this day index (Wed Jul 15)
    gear:3,                 // trips' worth of beads, flies, leader and lures
    prep:-1,                // day index the gear is rigged for
    scout:-1,               // day index you scouted the lower river
    scoutAt:{},look:-1,     // day index you scouted the upper river / Homer; the day you last read the Fish tab (spot hints, 23-fish.js)
    unlogged:0,overdue:0,   // ADF&G logbook trips not yet written up / written up late
    book:[],nextId:1,trip:null,
    regs:[],                // returning parties (30-stories.js): who they are and how their last trip went
    arcs:{rival:{st:0,s:-1,mood:0},garza:{st:0},board:{st:0,s:-1},day:-1},   // multi-season story arcs
    dil:{s:-1,n:{}},        // dilemmas shown this season, by key (no dilemma more than twice a season)

    calls:{},diner:{},report:{},office:{},dipnet:{},walks:{},
    run:[],cum:0,limit:3,eo:[],wx:[],wxd:[],noise:[],water:.5,solo:{},pu:0,
    freezer:0,skill:20,
    cabin:CabinUpkeep.newState(),homeAsk:-1,winOut:null,   // 32-home.js: the cabin's upkeep (src/home/), the last winter its spring jobs were mentioned, this winter's outage
    home:{cans:3,tank:0,gal:10,tgal:0,stale:0,gen:0,frz:0},   // 31-supplies.js: fuel storage (gallons: untreated, stabilized, stale), generator type, big freezer
    food:{pan:24,fri:6,fd:0,fm:0,kits:0},ate:{d:-1,n:0},hungry:0,power:null,   // meals in the pantry and fridge, the day the fridge was stocked, meals left of a thawed red, client lunch kits; meals eaten away today; today's outage
    visited:{shop:true},
    stats:{trips:0,clients:0,fish:0,limits:0,earned:0,spent:0,tips:0,viol:0,fines:0,kings:0,chop:0,bear:0,noshow:0,halibut:0,checks:0,cancelled:0,tows:0,fuelGal:0,fuelCost:0,campNights:0,encounters:0,seen:{}},camp:campBase()};
}

// ---- HUD ----
const STATS=[
  {l:'Cash',  v:()=>$k(Math.round(S.money)),warn:()=>S.money<0,get title(){return 'Cash: '+$(Math.round(S.money))}},
  {l:'Rep',   v:()=>S.rep,m:()=>S.rep,warn:()=>S.rep<20,title:'Reputation: reviews and word of mouth. At 0, nobody books you.'},
  {l:'Energy',v:()=>S.energy,m:()=>S.energy},
  {l:'Boat',  v:()=>S.boat,m:()=>S.boat,warn:()=>S.boat<20,title:'Your jet sled and drift boat. Below 40 they break down more; at 0 they are out of service until a major repair (or an emergency patch or a loaner).'},
  {l:'Record',v:()=>S.cites?`${S.cites}/3`:'Clean',warn:()=>S.cites>0,title:'Citations. Three and State Parks pulls your Kenai River guide permit.'},
];

// ---- scenery ----
// July in Soldotna: the sun is up around 5 AM and sets after 11 PM.
const SCENE={sun:[300,1380],skyDay:['#8fb9cf','#e4eee9'],skyDusk:['#5f6f96','#f0b98a'],skyNight:['#0c1a2a','#1f3448'],ground:'#4e7a4a',groundNight:'#1d2e22'};
const K={sp:n=>n?'#0e2219':'#1f4a35',sp2:n=>n?'#13291f':'#2c5e43',riv:n=>n?'#1b4b52':'#4cc0bd',riv2:n=>n?'#2a6066':'#8fe0d9',mtn:n=>n?'#22313a':'#71889a',mtn2:n=>n?'#2b3b44':'#8ea3b2'};
const win=n=>n?'#f7d77a':'#cfe0e6';
const spruce=(x,h,n,c)=>{const b=140,w=h*.32;return `<g fill="${c||K.sp(n)}"><polygon points="${x-w},${b} ${x},${b-h*.55} ${x+w},${b}"/><polygon points="${x-w*.8},${b-h*.3} ${x},${b-h*.8} ${x+w*.8},${b-h*.3}"/><polygon points="${x-w*.55},${b-h*.6} ${x},${b-h} ${x+w*.55},${b-h*.6}"/></g>`};
const forest=(xs,n)=>xs.map((x,i)=>spruce(x,34+((x*7)%26),n,i%2?K.sp2(n):K.sp(n))).join('');
const mtns=n=>`<polygon points="0,112 55,62 100,92 165,38 230,98 295,52 350,90 415,44 480,96 480,140 0,140" fill="${K.mtn(n)}"/>
  <polygon points="0,124 80,96 150,118 230,86 320,120 400,92 480,118 480,140 0,140" fill="${K.mtn2(n)}"/>
  ${[[55,62],[165,38],[295,52],[415,44]].map(([x,y])=>`<polygon points="${x-11},${y+12} ${x},${y} ${x+11},${y+12} ${x+4},${y+9} ${x},${y+13} ${x-4},${y+9}" fill="#f4f7f8" opacity="${n?.35:.95}"/>`).join('')}`;
const river=(n,y=128)=>`<path d="M0 ${y} Q120 ${y-8} 240 ${y+2} T480 ${y-2} L480 ${y+26} Q360 ${y+30} 240 ${y+22} T0 ${y+26} Z" fill="${K.riv(n)}"/><path d="M40 ${y+10} q30 -4 60 0 M220 ${y+14} q30 -4 60 0 M360 ${y+8} q30 -4 60 0" stroke="${K.riv2(n)}" stroke-width="2" fill="none" opacity=".7"/>`;
const sled=(x,y)=>`<path d="M${x} ${y} h78 l10 -13 h-92 z" fill="#a9b4ba"/><rect x="${x+30}" y="${y-24}" width="18" height="12" fill="#3d4a50"/><rect x="${x+2}" y="${y-18}" width="8" height="5" fill="#2b3338"/>`;
const drift=(x,y)=>`<path d="M${x} ${y} q38 12 78 0 l-9 -11 h-60 z" fill="#c9965a"/><path d="M${x+18} ${y-8} l-18 -10 M${x+60} ${y-8} l18 -10" stroke="#6b4a2a" stroke-width="2.5"/>`;
const angler=(x,y,c)=>`<circle cx="${x}" cy="${y-16}" r="4" fill="#e8c9a0"/><rect x="${x-4}" y="${y-12}" width="8" height="12" rx="2" fill="${c||'#c0392b'}"/><path d="M${x+3} ${y-10} l22 -22" stroke="#333" stroke-width="1.2"/><path d="M${x+25} ${y-32} q4 14 -2 30" stroke="#999" stroke-width=".6" fill="none"/>`;
const bearArt=(x,y,s=1)=>`<g transform="translate(${x},${y}) scale(${s})"><ellipse cx="0" cy="-12" rx="20" ry="12" fill="#5a3b22"/><circle cx="18" cy="-18" r="8" fill="#5a3b22"/><circle cx="21" cy="-25" r="3" fill="#5a3b22"/><rect x="-14" y="-4" width="6" height="8" fill="#4a3019"/><rect x="8" y="-4" width="6" height="8" fill="#4a3019"/><circle cx="23" cy="-18" r="1.4" fill="#111"/></g>`;
const gull=(x,y)=>`<path d="M${x} ${y} q5 -5 10 0 q5 -5 10 0" stroke="#fff" stroke-width="1.6" fill="none"/>`;

// ---- places ----
const L={
  shop:{name:'Shop & Cabin',ic:'🏠',desc:'Soldotna. Your cabin, the gear shop and both boats on trailers',
    art:({night})=>`${mtns(night)}${forest([18,44,420,452],night)}<rect x="150" y="84" width="120" height="56" fill="#7a5236"/><polygon points="140,86 210,56 280,86" fill="#3f2a1d"/>${[0,1].map(i=>`<rect x="${166+i*64}" y="98" width="22" height="16" fill="${win(night)}"/>`).join('')}<rect x="200" y="110" width="20" height="30" fill="#3f2a1d"/><rect x="290" y="104" width="86" height="36" fill="#596a72"/><text x="333" y="126" text-anchor="middle" font-size="10" font-weight="700" font-family="DM Sans" fill="#e9eef0">GEAR SHOP</text>${sled(300,158)}<circle cx="312" cy="160" r="5" fill="#222"/><circle cx="370" cy="160" r="5" fill="#222"/>`},
  town:{name:'Soldotna',ic:'🏪',desc:'Sterling Highway: tackle shop, the ADF&G office, the diner and the clinic',hours:()=>[300,1320],
    art:({night})=>`${mtns(night)}${[['TACKLE','#2f5d4a',40],['ADF&G','#285a7a',150],['DINER','#9a3b2a',260],['CLINIC','#6b6f74',370]].map(([t,c,x])=>`<rect x="${x}" y="88" width="96" height="52" fill="#d8ccb2"/><rect x="${x-4}" y="80" width="104" height="12" fill="${c}"/><text x="${x+48}" y="90" text-anchor="middle" font-size="9" font-weight="700" font-family="DM Sans" fill="#fff">${t}</text><rect x="${x+12}" y="100" width="30" height="20" fill="${win(night)}"/><rect x="${x+58}" y="110" width="20" height="30" fill="#4a3a2a"/>`).join('')}`},
  lower:{name:'Lower Kenai launch',ic:'🚤',desc:'Centennial Park boat launch, Soldotna. Power boats 50 hp max',
    art:({night})=>`${mtns(night)}${forest([20,46,72,400,430,458],night)}${river(night)}${sled(150,138)}${angler(178,128,'#2c6e9e')}${angler(204,128,'#c0392b')}<rect x="300" y="128" width="90" height="5" fill="#8a6b48"/>${[310,330,350,370].map(x=>`<rect x="${x}" y="133" width="3" height="16" fill="#6b4f33"/>`).join('')}${angler(320,128,'#e6a21a')}${angler(350,128,'#6b8e23')}${angler(380,128,'#8e44ad')}`},
  cooper:{name:'Cooper Landing',ic:'🏔️',desc:'Upper Kenai put-in near the Russian River. Drift boats only on this stretch',
    art:({night})=>`${mtns(night)}${forest([14,36,60,84,380,404,430,456],night)}${river(night,124)}${drift(170,140)}${angler(196,131,'#2c6e9e')}${angler(226,131,'#c0392b')}${bearArt(360,126,.8)}`},
  kbeach:{name:'Kenai City Beach',ic:'🌊',desc:'Mouth of the Kenai: the residents-only dipnet fishery, Jul 10–31',
    art:({night})=>`<rect y="96" width="480" height="44" fill="${night?'#1f3b48':'#5f9fb1'}"/><polygon points="0,96 60,84 140,90 200,96" fill="${K.mtn(night)}"/><polygon points="320,96 380,70 420,80 480,72 480,96" fill="${K.mtn(night)}"/><path d="M0 136 h480 v4 h-480z" fill="#c9b78f"/>${[60,110,160,215,270,330,390,440].map((x,i)=>`<path d="M${x} 132 l${i%2?14:-14} -34" stroke="#555" stroke-width="2"/><ellipse cx="${x+(i%2?16:-16)}" cy="96" rx="8" ry="5" fill="none" stroke="#333" stroke-width="1.5"/><circle cx="${x}" cy="114" r="4" fill="#e8c9a0"/><rect x="${x-4}" y="118" width="8" height="16" rx="2" fill="${['#c0392b','#2c6e9e','#e6a21a','#6b8e23'][i%4]}"/>`).join('')}${gull(300,40)}${gull(330,52)}`},
  homer:{name:'Homer Spit',ic:'⚓',desc:'The End of the Road: the harbor, charter boats and Kachemak Bay',
    art:({night})=>`<rect y="92" width="480" height="48" fill="${night?'#183447':'#4c8fb0'}"/><polygon points="0,92 70,46 130,74 200,36 270,70 340,40 420,72 480,52 480,92" fill="${K.mtn(night)}"/>${[[70,46],[200,36],[340,40]].map(([x,y])=>`<polygon points="${x-12},${y+12} ${x},${y} ${x+12},${y+12}" fill="#f4f7f8" opacity="${night?.35:.95}"/>`).join('')}<path d="M0 134 h480 v6 h-480z" fill="#b6a37f"/><path d="M160 126 h110 l12 -12 h-132 z" fill="#f2f2f2"/><rect x="190" y="98" width="40" height="16" fill="#3d4a50"/><path d="M210 98 v-22" stroke="#555" stroke-width="2"/>${gull(60,30)}${gull(90,22)}${gull(400,34)}`},
};
const TRAVEL={'shop|town':10,'shop|lower':10,'town|lower':8,'shop|cooper':60,'town|cooper':60,'lower|cooper':62,'shop|kbeach':20,'town|kbeach':20,'lower|kbeach':22,'cooper|kbeach':78,
  'shop|homer':85,'town|homer':85,'lower|homer':88,'kbeach|homer':90,'cooper|homer':140};
function travelMins(a,b){return TRAVEL[a+'|'+b]??TRAVEL[b+'|'+a]??30}

// ---- trip types ----
// below: fishing from a guide vessel downstream of the Skilak Lake outlet (Sun/Mon closures, 6 AM–6 PM, 5-person July cap)
const TRIPS={
  reds:  {n:'Sockeye trip',ic:'🐟',loc:'lower',start:360,len:360,price:275,max:5,below:true,fuel:9,energy:28,
          long:'Lower Kenai sockeye: run the jet sled to the reds and work the seams and bank spots.'},
  silver:{n:'Early silver trip',ic:'🎣',loc:'lower',start:780,len:300,price:300,max:4,below:true,fuel:11,energy:26,
          long:'Lower Kenai back-trolling for the first coho of the year. Ends at 6 PM sharp.'},
  trout: {n:'Upper Kenai trout float',ic:'🌈',loc:'cooper',start:420,len:480,price:375,max:3,below:false,fuel:0,energy:32,
          long:'Drift boat from Cooper Landing to Jim’s Landing: catch-and-release rainbows and Dolly Varden.'},
  halibut:{n:'Homer halibut charter',ic:'⚓',loc:'homer',start:360,len:600,price:0,gig:450,max:6,below:false,fuel:0,energy:36,
          long:'Captain a six-pack charter out of Homer for a buddy’s outfit. He holds the Charter Halibut Permit; you hold the six-pack license.'},
};
const SLOT=b=>{const T=TRIPS[b.type];return [T.start,T.start+T.len]};
const bk=id=>S.book.find(b=>b.id===id);
const todays=(d=day())=>S.book.filter(b=>b.d===d&&b.status==='booked'&&!b.asst);   // your own trips (an assistant's are b.asst)
function conflicts(d,type,asst){           // asst: is the slot free for the assistant guide (his trips only clash with each other)
  const T=TRIPS[type],a=[T.start,T.start+T.len];
  return S.book.some(b=>{if(b.d!==d||b.status!=='booked'||!!b.asst!==!!asst)return false;const B=SLOT(b),gap=TRIPS[b.type].loc===T.loc?30:travelMins(TRIPS[b.type].loc,T.loc)+20;
    return a[0]<B[1]+gap&&B[0]<a[1]+gap});
}
// What's wrong with a booking under the rules (null = nothing)
function issueOf(b){
  const T=TRIPS[b.type];
  if(T.below&&isSunMon(b.d)) return 'sunmon';
  if(b.type==='silver'&&b.n>4) return 'overload';
  if(b.type==='reds'&&b.n>5) return 'overload';
  return null;
}
function addBooking(o){const b=Object.assign({id:S.nextId++,status:'booked',quirk:[]},o);S.book.push(b);S.book.sort((x,y)=>x.d-y.d||SLOT(x)[0]-SLOT(y)[0]);return b}
const partyLine=b=>`The ${b.who} (${b.from}${b.res?', Alaska residents':''}) · ${b.n} ${b.type==='halibut'?'passengers':'clients'}`;
const payOf=b=>b.type==='halibut'?(S.up&&S.up.chp?Math.round(350*b.n*S.up.rate):TRIPS.halibut.gig):Math.round(TRIPS[b.type].price*b.n*((S.up&&S.up.rate)||1));

// ---- actions ----
const ACT_CATS={trip:'🛶 Today’s trips',work:'🧰 Business & boat',town:'🏪 Around town',fish:'🐟 On the water',rest:'🛏️ Rest'};
function canAfford(c){return S.money>=c}
function spend(c,what){money(-c);S.stats.spent+=c}
function actionsHere(){
  const d=day(),m=tod(),a=[];
  if(S.winter) return [{ic:'❄️',l:'Plan the off-season',s:'Bills, forecast, upgrades. Bookings open when you’re done.',cat:'trip',cls:'primary',fn:()=>winterModal()}];
  if(S.trip){const tb=bk(S.trip.id)||{type:'reds'};return [{ic:'🛶',l:'Back to your trip',s:`${TRIPS[tb.type].n} in progress`,cat:'trip',cls:'primary',fn:()=>tripNext()},coffeeAction(tb.type==='trout')]}
  // today's trips that launch from here
  todays(d).filter(b=>TRIPS[b.type].loc===S.loc).forEach(b=>{
    const T=TRIPS[b.type],late=m-T.start;
    if(m<T.start-60) a.push({ic:T.ic,l:`${T.n}: launch at ${fmt(T.start)}`,s:`${partyLine(b)}. The party shows up an hour before.`,cat:'trip',dis:true,fn:()=>{}});
    else if(noBoat()&&b.type!=='halibut'&&late<=90) a.push({ic:'🔧',l:`Your ${b.type==='trout'?'drift boat':'jet sled'} is out of service`,s:`Condition 0. The ${b.who} are waiting. Patch it (${$(rp(PATCH_COST))}), rent a loaner (${$(rp(LOANER_COST))}) or get a major repair at the shop (${$(rp(MAJOR_REPAIR))}, 4 hours).`,cat:'trip',dis:true,fn:()=>{}});
    else if(late<=90) a.push({ic:T.ic,l:`Meet the ${b.who} and launch`,s:`${partyLine(b)}. ${late>0?`You’re ${late} min late.`:`On time for ${fmt(T.start)}.`} ${b.type==='halibut'&&!S.up.chp?`Day rate ${$(payOf(b))} + tips`:`${$(payOf(b))} + tips`}.`,cat:'trip',cls:'primary',fn:()=>tripStart(b)});
    else a.push({ic:'😠',l:`The ${b.who} gave up on you`,s:'They waited 90 minutes, then left. Expect a review.',cat:'trip',dis:true,fn:()=>{}});
  });
  if(S.loc==='shop'){
    a.push({ic:'🛏️',l:'Go to bed',s:`Ends the day. Overhead ${$(overhead())} tonight. Alarm ${fmt(S.alarm)}. The sun won’t fully set.${fuelPlan().short&&fuelPlan().tomorrow?` ⛽ The sled has ${fuelPlan().have} gal; tomorrow needs about ${fuelPlan().need}.`:''}`,cat:'rest',cls:m>=1260?'primary':'',fn:()=>endDay('home')});
    a.push({ic:'😴',l:'Nap for an hour',s:'Energy +10.',cat:'rest',fn:()=>{pass(60);adj('energy',10);say('😴 Blackout curtains, earplugs, one glorious hour.')}});
    const logs=S.unlogged+S.overdue;
    if(logs) a.push({ic:'📓',l:`Fill out your ADF&G logbook (${logs} trip${logs>1?'s':''})`,s:`${logs*10} min. Every guided trip gets an entry: anglers, licenses, hours, fish kept and released.`,cat:'work',cls:'primary',fn:()=>{pass(logs*10);say(`📓 You write up ${logs} trip${logs>1?'s':''}: license numbers, hours fished, sockeye kept, kings released.${S.overdue?' A day late, but done.':''}`);S.unlogged=0;S.overdue=0}});
    if(S.prep!==d+1&&d+1<GAME.days) a.push({ic:'🪝',l:'Rig tomorrow’s gear',s:S.gear?'45 min. Tie leaders, sharpen hooks, stage the coolers. Better trip tomorrow.':'You’re out of tackle. Restock in Soldotna first.',cat:'work',dis:!S.gear,fn:()=>{pass(45);S.prep=d+1;say('🪝 Leaders tied, hooks sharp, coolers iced, life jackets counted. Tomorrow-you says thanks.')}});
    if(boatDown()) a.push({ic:'🛠️',l:`Major repair — ${$(rp(MAJOR_REPAIR))}`,s:'Out of service at condition 0: rebuild the jet unit and replace the drift-boat floor and oarlocks. 4 hours; boat back to 50. The dealer puts it on your account if you’re short.',cat:'work',cls:'primary',fn:()=>{spend(rp(MAJOR_REPAIR));pass(240);S.boat=50;adj('energy',-8);say(`🛠️ The dealer rebuilds the jet unit and you replace the drift-boat floor: ${$(rp(MAJOR_REPAIR))}. Back in service at 50.`)}});
    a.push({ic:'🔧',l:`Service the boats yourself — ${$(rp(165))} in parts`,s:boatDown()?'Out of service: it needs a major repair first.':'3 hours. Boat +20: oil and filter, plugs, water-pump impeller, jet intake, trailer bearings, oarlocks.',cat:'work',dis:boatDown()||S.boat>=95||!canAfford(rp(165)),fn:()=>{spend(rp(165));pass(180);adj('boat',20);adj('energy',-6);say('🔧 Oil, filters, plugs, a new water-pump impeller, a cleaned-out jet intake and greased bearings. Grease to the elbows; she purrs.')}});
    a.push({ic:'🏪',l:`Dealer 100-hour service — ${$(rp(525))}`,s:boatDown()?'Out of service: it needs a major repair first.':'1 hour to drop off and pick up. Boat +40. Alaska shop rates.',cat:'work',dis:boatDown()||S.boat>=95||!canAfford(rp(525)),fn:()=>{spend(rp(525));pass(60);adj('boat',40);say('🏪 The Soldotna dealer does the 100-hour service, shims the jet impeller and finds a cracked fuel line. Money well spent.')}});
    boatRescueActions(a);
    if(!S.calls[d]) a.push({ic:'📞',l:'Return calls & emails',s:'30 min. Once a day. Booking requests come in.',cat:'work',fn:()=>{pass(30);S.calls[d]=true;const r=makeRequest();if(r)requestModal(r);else say('📞 Voicemails: two spam, one dentist, no bookings.')}});
    a.push({ic:'📊',l:'Check the ADF&G sonar count',s:'5 min. How many sockeye passed river mile 19 yesterday.',cat:'work',fn:()=>{pass(5);sonarSay()}});
    a.push({ic:'⏰',l:`Alarm: ${fmt(S.alarm)}`,s:'Tap to cycle 4:00 → 4:30 → 5:00 → 5:30 → 6:00.',cat:'rest',fn:()=>{const o=[240,270,300,330,360];S.alarm=o[(o.indexOf(S.alarm)+1)%o.length];say(`⏰ Alarm set for ${fmt(S.alarm)}.`)}});
  }
  if(S.loc==='town'){
    const open=isOpen('town');
    a.push({ic:'🪱',l:'Restock tackle — $120',s:`Beads, flies, single-hook lures, leader. Gear +4 trips (you have ${S.gear}).`,cat:'town',cls:S.gear<=1?'primary':'',dis:!open||!canAfford(120),fn:()=>{spend(120);S.gear+=4;pass(30);say('🪱 Pegged beads in six shades of “egg,” Russian River flies, single-hook spinners. No trebles: the emergency order says one unbaited, single-hook lure below Skilak.')}});
    const faDay=faClassDay(d),cls=faJoinable(m);
    if(faDue(d)&&faDay&&m<780&&open) a.push({ic:'⏳',l:'Wait at the clinic until 1:00 PM',s:`${780-m} min. Today’s first-aid class starts at 1:00.`,cat:'town',fn:()=>{pass(780-tod());say('⏳ You sit in the clinic waiting room with a stale coffee and a poster about tourniquets until the instructor unlocks the door.')}});
    if(faDue(d)) a.push({ic:'⛑️',l:'First aid & CPR class — $95',s:faDay?(m<780?`Today 1:00–4:00 PM at the clinic. You can join until 1:30.`:m<=810?'Open for late arrivals until 1:30. 3 hours. Renews your card for two years.':'Today’s class already started.'):'Only Monday, Tuesday and Thursday, 1:00–4:00 PM.',cat:'town',cls:faDay&&cls&&S.cred.fa<=d+1?'primary':'',dis:!faDay||!cls||!canAfford(95),
      fn:()=>{spend(95);pass(180);S.cred.fa=faRenewTo(d);adj('energy',-6);say('⛑️ Three hours of chest compressions on a rubber torso named Rescue Randy. New card in your wallet, good for two years: guiding legally requires a current one.')}});
    if(!S.diner[d]) a.push({ic:'🍳',l:'Eat at the diner — $22',s:'40 min. Energy +12. Guides trade gossip at the counter.',cat:'town',dis:!open||!canAfford(22),fn:()=>{spend(22);S.diner[d]=true;ateAdd(1);pass(40);adj('energy',12);say('🍳 Reindeer sausage, eggs and hash browns. '+pick(LORE))}});
    if(!S.office[d]) a.push({ic:'🏛️',l:'Stop by the ADF&G office',s:'20 min. Read the emergency orders posted on the board.',cat:'town',dis:!open,fn:()=>{pass(20);S.office[d]=true;S.skill++;say(`🏛️ The EO board: ${S.eo.length?S.eo.map(e=>'<b>'+e+'</b>').join(' · '):`<b>Kenai kings: ${kingRuleTxt()}</b>`} The tech at the counter says the sonar count is ${S.run[d-1]?grp(S.run[d-1]):'climbing'}.`)}});
    if(!S.report[d]) a.push({ic:'📸',l:'Post a fishing report & photos',s:'30 min. Once a day. Rep +2 after a good trip.',cat:'town',fn:()=>{pass(30);S.report[d]=true;const good=S.book.some(b=>b.d===d&&b.status==='done'&&b.out&&b.out.happy>=60);if(good){adj('rep',2);say('📸 Grip-and-grin photos (all legal fish, all kept wet when they had to be). The likes roll in.')}else say('📸 You post a moody river photo. Three likes, one from your mom.')}});
  }
  if(S.loc==='lower'||S.loc==='cooper'){boatRescueActions(a);const ba=boatAction();if(ba)a.push(ba)}
  if(S.loc==='lower'){
    if(S.scout!==d) a.push({ic:'🔭',l:`Scout the river — ~${bn('scout')} gal`,s:`1 hour. See where the reds are holding: better trips today and tomorrow, and the spot buttons show an exact read. Tank: ${Math.round(S.fuel)} gal.`,cat:'fish',fn:()=>{if(burnSolo(bn('scout'))<1)return;pass(60);S.scout=d;S.skill++;adj('energy',-4);say(`🔭 You run up past the Sterling Highway bridge and back. ${S.run[Math.max(0,d-1)]>90000?'Reds are stacked in the soft water along the inside bends.':'Pods of reds, but they’re moving through fast.'}`)}});
    a.push({ic:'🐟',l:'Flip for reds yourself from the bank',s:'1 hour. You’re off the clock, so it’s legal. Freezer fish.',cat:'fish',dis:todays(d).length&&m<TRIPS.reds.start+TRIPS.reds.len,fn:()=>{pass(60);adj('energy',-5);const n=addFish(Math.min(S.limit,Math.max(0,Math.round(Math.random()*S.limit+.3))));say(n?`🐟 Shoulder to shoulder at the walkway, you flip ${n} red${n>1?'s':''} into the net. Hooked in the mouth, every one.`:'🐟 An hour of “flipping” and nothing but a sore wrist. Combat fishing is humbling.')}});
  }
  if(S.loc==='cooper'){
    if(!S.walks[d]) a.push({ic:'🥾',l:'Hike to the Russian River Falls',s:'2 hours. Watch sockeye jump the falls. Energy +8 (it’s good for the soul).',cat:'rest',fn:()=>{pass(120);S.walks[d]=true;adj('energy',8);say('🥾 Two miles of trail to the falls. Reds hurl themselves up the white water while a brown bear fishes the lip below. Bear spray on your hip the whole way.')}});
  }
  if(S.loc==='kbeach'){
    const ok=m>=360&&m<=1200;
    if(!S.dipnet[d]) a.push({ic:'🥅',l:'Dipnet for your freezer',s:ok?`3 hours. Alaska residents only. Household limit 25 (${S.pu} so far). Tide: ${tideNow()}.`:'Dipnetting is open 6 AM–11 PM.',cat:'fish',dis:!ok||S.pu>=25,fn:()=>dipnetModal()});
    a.push({ic:'🌊',l:'Watch the tide come in',s:'30 min. Energy +4.',cat:'rest',fn:()=>{pass(30);adj('energy',4);say('🌊 Cook Inlet has some of the biggest tides on Earth. The mud flats vanish while you watch. Don’t walk out on them: the silt grabs boots.')}});
  }
  if(S.loc==='homer'){
    a.push({ic:'🍟',l:'Fish & chips on the Spit — $20',s:'40 min. Energy +10.',cat:'rest',dis:!canAfford(20),fn:()=>{spend(20);ateAdd(1);pass(40);adj('energy',10);say('🍟 Halibut and chips at a picnic table, eagles on every light pole. Homer calls itself the Halibut Fishing Capital of the World.')}});
  }
  a.push(coffeeAction(S.loc==='cooper'));
  a.push({ic:'⏳',l:'Wait until…',s:'Skip ahead: the next launch, the 1 PM first-aid class, or 30 or 60 minutes.',cat:'rest',fn:()=>waitModal()});
  harborActions(a);
  suppliesActions(a);
  return a;
}

// A boat that is nearly dead or out of service: an emergency patch (to 25 for a day or two) or a loaner for the day, at the shop or a launch.
function boatRescueActions(a){
  const d=day(),trips=todays(d).some(b=>b.type!=='halibut');
  if(canPatch()) a.push({ic:'🩹',l:`Emergency patch — ${$(rp(PATCH_COST))}`,s:`1 hour of epoxy, hose clamps and a borrowed impeller: boat back to ${PATCH_TO}. It still breaks down a lot. The patch gives out after two days. A service or major repair is the real fix.`,cat:'work',dis:!canAfford(rp(PATCH_COST)),
    fn:()=>{spend(rp(PATCH_COST));pass(60);S.patch={d,base:S.boat};S.boat=Math.max(S.boat,PATCH_TO);adj('energy',-3);say(`🩹 Epoxy, hose clamps and a borrowed impeller: ${$(rp(PATCH_COST))}. The boat is back at ${S.boat}, for a day or two. It won’t hold long.`)}});
  if(boatDown()&&S.loaner!==d&&trips) a.push({ic:'🤝',l:`Rent a loaner sled and drift boat — ${$(rp(LOANER_COST))} for today`,s:'A buddy’s old rig for the day, so today’s booked trips can run. The clients notice it is tired. Your own boat still needs the major repair.',cat:'work',dis:!canAfford(rp(LOANER_COST)),
    fn:()=>{spend(rp(LOANER_COST));S.loaner=d;say(`🤝 You borrow a buddy’s old jet sled and drift boat for the day: ${$(rp(LOANER_COST))}. Your own boat is still out of service.`)}});
}
// ⏳ Wait until…: choices that make sense right now (a launch you're at, the time to leave for one, today's first-aid class, +30/+60 min).
function waitChoices(){
  const d=day(),m=tod(),end=(d+1)*1440-1-d*1440,o=[];          // minutes into today; waiting can't run past midnight
  todays(d).sort((x,y)=>TRIPS[x.type].start-TRIPS[y.type].start).forEach(b=>{
    const T=TRIPS[b.type],meet=T.start-60;
    if(T.loc===S.loc){if(m<meet)o.push({at:meet,l:`Until the ${b.who} show up: ${fmt(meet)}`,s:`Next launch: ${T.n}, ${fmt(T.start)}. ${meet-m} min.`,say:`⏳ You wait at ${L[S.loc].name} until the ${b.who} pull in.`})}
    else{const leave=meet-travelMins(S.loc,T.loc);if(m<leave)o.push({at:leave,l:`Until it’s time to leave for the ${T.n.toLowerCase()}: ${fmt(leave)}`,s:`${L[T.loc].name} is ${travelMins(S.loc,T.loc)} min away. ${leave-m} min.`,say:`⏳ You kill time until it’s time to head for ${L[T.loc].name}.`})}
  });
  if(faDue(d)&&faClassDay(d)&&m<780) o.push({at:780,l:'Until the 1:00 PM first-aid class',s:`The Soldotna clinic doors open at 1:00. ${780-m} min.`,say:'⏳ You wait for the 1:00 first-aid class.'});
  [30,60].forEach(x=>o.push({at:m+x,l:`${x} more minutes`,s:`Until ${fmt(S.t+x)}.`,say:`⏳ You wait ${x} minutes.`}));
  return o.filter(x=>x.at>m&&x.at<=end).sort((x,y)=>x.at-y.at).filter((x,i,a)=>i===0||x.at!==a[i-1].at);
}
function waitModal(){
  const o=waitChoices();
  modal('⏳ Wait until…',`<p style="font-size:13px;color:var(--mute)">Time passes, you get a little tired, and nothing else happens. It’s ${fmt(S.t)}.</p>`,
    o.map(x=>({l:x.l,s:x.s,fn:()=>{pass(x.at-tod());say(x.say)}})).concat([{l:'Never mind',fn:()=>{}}]));
}
window.waitChoices=waitChoices;

// ☕ Optional coffee break: 5 minutes on the clock, anywhere except the drift boat (Cooper Landing / a trout float).
function coffeeAction(onDrift){
  return {ic:'☕',l:'Grab a cup of coffee, it will take 5 minutes',s:onDrift?'Not on the drift boat: both hands are on the oars and there’s nowhere to set a cup.':'Optional. Adds 5 minutes to the clock.',cat:'rest',dis:onDrift,
    fn:()=>{pass(5);say(pick(['☕ Thermos coffee, black, steaming in the cold river air. Five minutes well spent.','☕ You pour a cup and watch the river slide by for five minutes.','☕ A quick cup. The world sharpens a little.']))}};
}

// ---- small extras on the Here tab ----
function statusTags(){
  const t=[],d=day();
  {const w=wxOf(d);t.push(`<span class="tag">${WX[S.wx[d]||'sun'].ic} ${WX[S.wx[d]||'sun'].n} ${w.temp}°F · 💨 ${w.wind} kt</span>`)}
  if(['lower','kbeach','homer'].includes(S.loc)) t.push(`<span class="tag">🌊 ${tideNow()}</span>`);
  if(S.loc==='lower'||S.loc==='cooper') t.push(`<span class="tag">🏞️ river ${waterTxt(wxOf(d))}</span>`);
  if(isSunMon(d)) t.push('<span class="tag bad">🚫 no guide-boat fishing below Skilak</span>');
  if(halClosed(d)) t.push('<span class="tag">⚓ no charter halibut retention</span>');
  if(S.boat<=40) t.push(`<span class="tag ${S.boat<=20?'bad':''}">🔧 boat ${S.boat}${S.boat<=0?(S.loaner===d?' (loaner today)':' (out of service)'):''}</span>`);
  t.push(`<span class="tag ${S.gear<1?'bad':''}">🪱 tackle ×${S.gear}</span>`);
  t.push(`<span class="tag ${S.fuel<bn('reds')?'bad':''}">⛽ ${Math.round(S.fuel)}/${SLED_TANK()} gal</span>`);
  if(S.unlogged+S.overdue) t.push(`<span class="tag ${S.overdue?'bad':''}">📓 ${S.unlogged+S.overdue} to log</span>`);
  if(S.cred.fa<d) t.push('<span class="tag bad">⛑️ first-aid card expired</span>');
  if(S.energy<25) t.push('<span class="tag bad">🥱 running on fumes</span>');
  if(heat()>=2) t.push(`<span class="tag bad">🚔 troopers know your boat (${heat()} rules broken)</span>`);
  if(S.freezer) t.push(`<span class="tag">🧊 ${S.freezer} reds in the freezer</span>`);
  t.push(...suppliesTags());
  t.push(...homeTags());
  return t;
}
function alertBar(){
  const d=day(),m=tod();
  if(noBoat()&&todays(d).some(b=>b.type!=='halibut')) return {t:`🔧 Your boat is out of service (condition 0). A major repair at the shop (${$(rp(MAJOR_REPAIR))}), an emergency patch (${$(rp(PATCH_COST))}) or a loaner (${$(rp(LOANER_COST))}) gets today’s trip on the water.`};
  if(S.boat>0&&S.boat<=10) return {t:BOAT_WARN[3].replace('{b}',S.boat)};
  for(const b of todays(d)){const T=TRIPS[b.type];
    if(m>T.start&&m<=T.start+90&&S.loc!==T.loc) return {t:`⏰ The ${b.who} are waiting at ${L[T.loc].name} (launch was ${fmt(T.start)}).`};
    if(m>=T.start-120&&m<=T.start&&S.loc!==T.loc) return {t:`🛶 ${T.n} launches at ${fmt(T.start)} from ${L[T.loc].name}: ${travelMins(S.loc,T.loc)} min away.`,kind:'info'};}
  {const low=todays(d).find(b=>tripFuel(b)&&tripFuel(b).tank==='fuel'&&fuelShort(b));if(low&&m<TRIPS[low.type].start)return {t:`⛽ ${Math.round(S.fuel)} gallons in the sled; your ${TRIPS[low.type].n.toLowerCase()} burns ~${tripFuel(low).gal} and up to ~${Math.round(expectBurn(low))} with wind or a long run. Fuel dock: Kenai Harbor, ${hoursTxt('harbor').replace('Open ','')}.${homeFuelHint()}`}}
  {const fp=fuelPlan();if(fp.short&&fp.tomorrow&&m>=1020)return {t:`⛽ Fuel for tomorrow: ${fp.need} gallons likely needed, ${fp.have} in the sled. ${m<1320?`Kenai Harbor’s fuel dock is open until ${fmt(1320)}.`:`Kenai Harbor’s fuel dock opens at ${fmt(360)}.`}${homeFuelHint()}`}}
  {const sa=suppliesAlert();if(sa)return sa}
  if(S.boat>10&&S.boat<=40&&todays(d).some(b=>b.type!=='halibut')) return {t:BOAT_WARN[S.boat<=20?2:1].replace('{b}',S.boat),kind:S.boat<=20?'':'info'};
  if(faUrgent(d)) return {t:`⛑️ First-aid card expires ${dayName(S.cred.fa)} night: classes ${FA_CLASS_TXT}`,kind:'info'};
  return null;
}

// ---- extra tabs ----
const EXTRA_TABS=[
  {k:'book',ic:'📅',l:'Bookings',view:()=>{
    const s0=seasonFirst();let h=`<div class="sect">Season ${seasonOf(s0)+1} of ${S.years} · ${dlabel(s0)}–${dlabel(s0+SEASON-1)}, ${yearOf(s0)}</div>`;
    for(let d=s0;d<s0+SEASON;d++){
      const bs=S.book.filter(b=>b.d===d),rules=[isSunMon(d)?'🚫 guide boats off below Skilak':'',halClosed(d)?'⚓ no charter halibut kept':''].filter(Boolean).join(' · ');
      const lines=bs.map(b=>{const T=TRIPS[b.type],st={booked:d<day()?'—':'',done:'✅',noshow:'❌ no-show',cancelled:'🚫 cancelled'}[b.status]||'';
        return `${T.ic} <b>${fmt(T.start)}</b> ${T.n} · ${b.who}, ${b.n} ${b.reg?'⭐ ':''}${b.asst?'🧑‍🤝‍🧑 (assistant) ':''}${st}${b.out?` · ${b.out.line}`:''}`}).join('<br>');
      h+=`<div class="todo"><span class="ck">${d<day()?'✔️':d===day()?'👉':'·'}</span><div><b>${dlong(d)}</b><span>${lines||'<i>Open day</i>'}${rules?`<br><span style="color:var(--warn)">${rules}</span>`:''}</span></div></div>`;
    }
    return h+`<div class="rules">Trips: 💲 rates ×${S.up.rate.toFixed(1)} · 🐟 sockeye ${$(Math.round(TRIPS.reds.price*S.up.rate))}/angler (6 AM, lower river) · 🎣 silvers ${$(Math.round(TRIPS.silver.price*S.up.rate))}/angler (1 PM, lower river) · 🌈 trout float ${$(Math.round(TRIPS.trout.price*S.up.rate))}/angler (7 AM, Cooper Landing, 3 max) · ⚓ halibut ${S.up.chp?`${$(Math.round(350*S.up.rate))}/passenger on your own boat`:`day rate ${$(TRIPS.halibut.gig)}`} (6 AM, Homer). New requests come in by phone: <b>📞 Return calls</b> at the shop.</div>`}},
  {k:'regs',ic:'📖',l:'Regs',view:()=>regsView()},
];
function regsView(){
  const d=day(),fa=S.cred.fa<d?'<b style="color:var(--bad)">EXPIRED</b>':faDue(d)?`expires ${dlong(S.cred.fa)} at midnight`:`good through ${dlongY(S.cred.fa)}`;
  const cred=[['🪪','ADF&G sport fishing guide license + business license','current'],['⚓','USCG OUPV (“six-pack”) captain’s license','current'],['🏞️','Alaska State Parks Kenai River guide permit (KRSMA) + 3-digit boat number','current'],['🏷️','ADF&G guide-vessel decal on both sides of the boat','current'],['⛑️','First aid & CPR card',fa],['📓','ADF&G freshwater guide logbook',S.overdue?`<b style="color:var(--bad)">${S.overdue} entr${S.overdue>1?'ies':'y'} overdue</b>`:S.unlogged?`${S.unlogged} to fill in tonight`:'up to date'],['🧪','Random drug-testing program','enrolled']];
  const R=[
    ['👑 Kenai kings',kingRuleTxt()],
    ['🪝 Gear below Skilak',gearRuleTxt()],
    ['📆 Guide-boat days','May 1–Jul 31, downstream of the Skilak Lake outlet: no fishing from a guide vessel on Sundays or Mondays (Memorial Day excepted), and only 6 AM–6 PM on other days.'],
    ['👥 Boat limits','July, below Skilak: no more than 5 people in a guide boat while fishing, guide included. You may carry 5 clients + yourself only if they all fish from shore. KRSMA: 6 people max on any motorboat, 50 hp max.'],
    ['🙅 Guides don’t fish','A guide may not sport fish while clients are present. Rods in the water can’t outnumber clients aboard.'],
    ['🐟 Sockeye',`Kenai limit ${S.limit} per day${S.limit>3?' (raised by emergency order)':''}. Must be hooked in the mouth: snagged fish go back immediately. Limits are per person and can’t be caught for someone else.`],
    ['🌿 Banks','Many Kenai banks are closed to fishing in July and August to protect riparian habitat. Use public access points and the elevated walkways.'],
    ['⚓ KRSMA','Don’t anchor in the primary traffic or drift-fishing channel.'],
    ['🎣 Coho','2 per day on the Kenai. Same single-hook, no-bait rule below Skilak through Aug 15.'],
    ['🌈 Upper river','Rainbow trout are catch-and-release: keep them wet. Russian River confluence: fly-fishing only Jun 11–Aug 20. Take carcasses out or stop, chop and throw them into fast water. Bears.'],
    ['🥅 Dipnetting','Kenai personal-use fishery, Jul 10–31, 6 AM–11 PM: Alaska residents only. Household limit 25 (+10 per extra member). Clip both tail tips and record each fish on your permit before you leave the beach.'],
    [`⚓ Charter halibut (Area 3A, ${REG().year})`,`2 per day: one any size, one ${halSize()} inches or less. No charter retention on ${halDaysTxt()} through late August. One charter trip per day. Captain and crew don’t keep halibut on a charter.`],
    ['🍺 Boating','Operating a boat under the influence (BUI) is a crime. You’re the captain all day.'],
  ];
  return `<div class="sect">Credentials</div>${cred.map(([i,n,s])=>`<div class="todo"><span class="ck">${i}</span><div><b>${n}</b><span>${s}</span></div></div>`).join('')}
  <div class="sect">River conditions</div><div class="rules">📊 Kenai sockeye sonar (river mile 19): ${S.run[d-1]?`<b>${grp(S.run[d-1])}</b> yesterday · `:''}<b>${grp(S.cum)}</b> this season.<br>${S.eo.length?'📣 '+S.eo.join('<br>📣 '):'📣 No new emergency orders this week.'}<br>🐟 Run timing, weather, tides and odds: see the <b>Fish</b> tab.</div>
  <div class="sect">The rules you guide by · ${REG().year}</div><div class="rules" style="margin:0 0 6px">📣 ${REG().fc}</div>${R.map(([n,s])=>`<div class="todo"><span class="ck">•</span><div><b>${n}</b><span>${s}</span></div></div>`).join('')}
  <div class="rules" style="font-size:12px">Season 1 follows a simplified summary of the real 2026 rules from ADF&G, Alaska State Parks and NOAA; later seasons invent plausible changes (king status, forecasts, halibut rules). For a game. Real regulations change by emergency order, sometimes overnight. Before you fish, check the current regulations and emergency orders at adfg.alaska.gov.</div>`;
}

// ---- weather & the run ----
const WX={sun:{n:'Bluebird day',ic:'☀️',q:.03},cloud:{n:'Overcast',ic:'☁️',q:.04},rain:{n:'Steady rain',ic:'🌧️',q:-.02},wind:{n:'Windy',ic:'💨',q:-.04}};
function rollDay(d){
  S.wx[d]=pick(['sun','sun','cloud','cloud','rain','wind']);
  rollWeather(d);                                        // temperature, wind, rain, river level (23-fish.js)
  const n=rollRun(d);                                    // run-timing model → today's sockeye past the sonar
  S.run[d]=n;S.cum+=n;
}
function sonarSay(){const d=day(),y=S.run[d-1];say(y?`📊 Kenai sonar: <b>${grp(y)}</b> sockeye passed river mile 19 yesterday; <b>${grp(S.cum)}</b> for the season. ${y>150000?'The river is paved with reds.':y>90000?'Solid push of fish.':'Slow. The commercial setnetters may be catching them first.'}`:`📊 Season count so far: <b>${grp(S.cum)}</b> sockeye past the sonar.`)}
