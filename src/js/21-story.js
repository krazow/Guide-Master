// ============================================================
//  GUIDE MASTER, part 2: what happens. Title, lifecycle hooks, booking requests, dipnetting,
//  enforcement checks, random events, tips, goals, achievements, scoring and save migrations.
//  The trip runner (tripStart, tripNext, violate, cite…) lives in 22-trips.js.
// ============================================================

// ---- local lore (sprinkled into mornings, the diner and guide gossip) ----
const LORE=[
  'The Kenai runs milky turquoise because of glacial flour: rock ground to powder by the glaciers upstream.',
  'In May 1985, Les Anderson of Soldotna landed a 97 lb 4 oz king on the Kenai. It’s still the world record.',
  'The Dena’ina name for the river is Kahtnu, and the Kenaitze people have fished it for thousands of years.',
  'The Legislature created the Kenai River Special Management Area in 1984. That’s why outboards here top out at 50 horsepower.',
  'ADF&G counts the sockeye with sonar at river mile 19. Guides refresh that number like it’s the stock market.',
  'At the Russian River confluence anglers stand elbow to elbow. Folks call it combat fishing, and they aren’t joking.',
  'Skilak Lake can go from glass to four-foot whitecaps in twenty minutes when the wind comes down off the glaciers.',
  'The Sterling Highway dead-ends on the Homer Spit, which is why Homer calls itself the End of the Road.',
  'Cook Inlet has some of the biggest tides on Earth. Its mudflats can trap a boot, or a person, as the water comes back.',
  'Locals call the mosquito Alaska’s state bird. This week they’re flying in formation.',
  'To get a Kenai River guide permit you finish the Kenai River Guide Academy and join a random drug-testing program.',
  'The Kenai gets two sockeye runs: an early run in June, mostly bound for the Russian River, and the huge late run in July.',
  'Pink salmon run in even years here: in even Augusts the humpies flood the river.',
  'In July the sun barely sets on the Kenai. You can tie leaders on the porch at 11 PM without a headlamp.',
];

// ---- booking-request parties ----
const PARTIES=[
  {who:'Kowalskis',from:'Wisconsin'},{who:'Oregon firefighters',from:'Oregon'},{who:'retired dentist and his grandson',from:'Iowa'},
  {who:'family of Vermont teachers',from:'Vermont'},{who:'college buddies',from:'Colorado'},{who:'Chicago law-firm outing',from:'Chicago'},
  {who:'anniversary couple',from:'Tennessee'},{who:'Navy vet and his brothers',from:'Virginia'},{who:'Austin startup team',from:'Austin'},
  {who:'Nguyens',from:'Anchorage',res:true},{who:'pipeline crew on rotation',from:'Kenai',res:true},{who:'cousins from Germany',from:'Bavaria'},
  {who:'Montana fly-shop crew',from:'Montana'},{who:'mother-and-daughter team',from:'Arizona'},{who:'Juneau bartenders',from:'Juneau',res:true},
];

// ---- title screen ----
const TITLE={
  start:'Start your guiding career 🛶',
  intro:'You’re a licensed Kenai River guide working out of Soldotna, Alaska. Every July is the peak of the late sockeye run: two weeks of 4 AM alarms, full boats, bears, troopers and a rulebook thicker than your waders. Choose a 2-, 5- or 10-year career.',
  bullets:['Each season: two weeks of July guiding. Between seasons: bills, upgrades, new rules and new bookings.','Show up for every booked trip: sockeye, silvers, trout floats and a Homer halibut charter.','Know the regs. Kenai kings are closed in 2026 (later years may differ), and guide boats don’t fish below Skilak on Sundays or Mondays.','Keep your logbook, your first-aid card and your record clean. Three citations and your permit is gone.','Keep clients happy, the boat running and yourself awake.'],
  note:'Regulations simplified from 2026 ADF&G, State Parks and NOAA rules. Always check the current regs.',
  art:()=>`<svg viewBox="0 0 480 250" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%" aria-hidden="true"><defs><linearGradient id="ts" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fb9cf"/><stop offset="1" stop-color="#f0dcc0"/></linearGradient></defs><rect width="480" height="250" fill="url(#ts)"/>
    <circle cx="390" cy="52" r="22" fill="#fbeaa8"/>
    <g transform="translate(0,60)">${mtns(false)}${forest([16,40,66,92,370,396,424,452],false)}<rect y="140" width="480" height="60" fill="#4e7a4a"/>${river(false,134)}${drift(190,152)}${angler(216,143,'#c0392b')}${angler(246,143,'#2c6e9e')}</g>
    <g class="bob"><text x="240" y="238" text-anchor="middle" font-size="30">🎣</text></g></svg>`,
};

// ---- lifecycle hooks ----
function onNewGame(){
  S.reg=genRegs(0);S.cum=650000;rollDay(0);
  const seed=[
    [1,'reds',4,'Hendersons','Ohio',0,['first']],[2,'reds',3,'Seattle software engineers','Seattle',0,['drinker']],
    [3,'reds',5,'Garza family','Texas',0,['kid']],[4,'reds',2,'retired couple','Minnesota',0,['nolicense']],
    [5,'reds',4,'Wasilla nurses and their husbands','Wasilla',1,['kingfan']],[6,'halibut',6,'oil-company crew','Anchorage',1,[]],
    [7,'trout',3,'Denver fly-fishing club','Colorado',0,['photo']],[8,'reds',4,'bachelor party','Arizona',0,['drinker']],
    [8,'silver',3,'dad and his two sons','Michigan',0,[]],[9,'reds',4,'church group','Kansas',0,[]],
    [10,'silver',4,'fishing YouTuber and his crew','Florida',0,['photo','kingfan']],[11,'reds',4,'California doctors','California',0,['nolicense']],
    [11,'silver',2,'honeymooners','Georgia',0,[]],[12,'reds',4,'Fairbanks family','Fairbanks',1,['kid']],
    [13,'trout',2,'Guide Academy classmates','Kenai',1,[]]];
  seed.forEach(([d,type,n,who,from,res,quirk])=>addBooking({d,type,n,who,from,res:!!res,quirk}));
  say(`${dlong(0)}, ${fmt(S.t)}. ${WX[S.wx[0]].ic} ${WX[S.wx[0]].n}. Monday: guide boats can’t fish the Kenai below Skilak Lake today, so it’s a shop day. Your first trip is tomorrow at ${fmt(TRIPS.reds.start)}.`);
  modal('🛶 Welcome to the Kenai',`<p>You’re a licensed sport fishing guide out of <b>Soldotna</b>, with a jet sled, a drift boat and <b>${S.book.length} trips</b> booked over the next two weeks: the peak of the late sockeye run.</p>
    <p>📆 This is season 1 of a <b>${S.years}-year career</b>. Each July you guide two weeks; each winter you pay the bills, plan upgrades and see what the new season’s rules and runs look like.</p>
    <p>👑 <b>Kenai kings are closed in 2026</b> by emergency order. Not even catch-and-release.</p>
    <p>⛽ The sled has <b>${S.fuel} gallons</b> in a ${SLED_TANK()}-gallon tank. The only fuel dock is at <b>Kenai Harbor</b>. Run dry and the Coast Guard tows you in.</p>
    <p>⛑️ Your <b>first-aid/CPR card expires Wednesday night</b> (a new one lasts two years). There’s a class at the clinic in Soldotna <b>Monday, Tuesday and Thursday, 1–4 PM</b> (join by 1:30).</p>
    <p>Check the <b>📅 Bookings</b> tab for your schedule and the <b>📖 Regs</b> tab for the rules you guide by.</p>`,[{l:'Grab the coffee and go',fn:()=>{}}]);
}
function onMorning(d){
  if(d===0) return;
  const sd=sday(d),newSeason=sd===0;
  if(newSeason) startSeason(seasonOf(d));               // 24-career.js: bills, new rules, forecast, upgrades
  rollDay(d);
  const w=WX[S.wx[d]];
  say(newSeason?`❄️➡️☀️ <b>${dlongY(d)}</b>, ${fmt(S.t)}. Season ${seasonOf(d)+1} of ${S.years}. ${w.ic} ${w.n}. Plan the off-season to open this year’s bookings.`:`${dlong(d)}, ${fmt(S.t)}. ${w.ic} ${w.n}.${Math.random()<.4?' '+pick(LORE):''}`);
  if(newSeason) return;
  const t=todays(d);
  if(t.length) say('🛶 Today: '+t.map(b=>`${TRIPS[b.type].ic} ${TRIPS[b.type].n} at ${fmt(TRIPS[b.type].start)}, ${L[TRIPS[b.type].loc].name} (the ${b.who}, ${b.n})`).join(' · '));
  else say('🛶 No trips booked today. Service the boat, return calls, or go fill the freezer.');
  if(isSunMon(d)) say(`🚫 ${dayName(d)}: no fishing from guide boats on the Kenai below Skilak Lake through July 31.`);
  const strong=REG().mult.sockeye>=.85;
  if(!strong&&S.limit===3&&REG().mult.sockeye<.7&&sd>=5){
    S.limit=2;S.eo.push('Kenai River sockeye limit cut to 2 per day, 4 in possession');
    say('📣 <b>Emergency order:</b> the late run is tracking below its goal. ADF&G cuts the Kenai sockeye limit to <b>2 per day</b>.');
    showTile('📣','Sockeye limit cut to 2','ADF&G emergency order','bad');
  }
  if(strong&&S.limit===3&&(S.cum>1200000*REG().mult.sockeye||sd>=8)){
    S.limit=6;S.eo.push('Kenai River sockeye limit raised to 6 per day, 12 in possession');
    say('📣 <b>Emergency order:</b> with the late run past its escapement goal, ADF&G raises the Kenai sockeye limit to <b>6 per day, 12 in possession</b>.');
    showTile('📣','Sockeye limit raised to 6','ADF&G emergency order','good');
  }
  if(strong&&sd===10&&!S.eo.some(e=>/Russian/.test(e))){
    S.eo.push('Russian River & upper Kenai sockeye limit 6 per day, 12 in possession');
    say('📣 <b>Emergency order:</b> the Russian River and a stretch of the upper Kenai go to 6 sockeye a day, too.');
  }
}
function onNight(where,notes,d){
  if(S.trip){S.trip=null;notes.push('🛶 You never finished the trip. The party drove off without paying.')}
  if(where==='collapsed'){S.loc='shop';notes.push('😵 You were up past midnight and fell asleep in the truck at the shop.')}
  money(-overhead());S.stats.spent+=overhead();notes.push(`💸 Boat payment, insurance and groceries: ${$(overhead())}.`);
  S.book.filter(b=>b.d===d&&b.status==='booked').forEach(b=>{b.status='noshow';adj('rep',-15);S.stats.noshow++;
    notes.push(`😠 You never showed for the ${b.who}. They posted a one-star review from the parking lot.`)});
  if(S.unlogged){S.overdue+=S.unlogged;notes.push(`📓 ${S.unlogged} logbook entr${S.unlogged>1?'ies are':'y is'} now overdue. Write ${S.unlogged>1?'them':'it'} up before a trooper asks.`);S.unlogged=0}
  adj('energy',(where==='home'?60:30)/(where==='collapsed'?2:1));
  if(d===S.cred.fa) notes.push('⛑️ Your first-aid/CPR card expired at midnight. You can’t legally guide until you renew it.');
  if(S.energy<15) notes.push('🥱 You’re running on fumes.');
}
function onTime(min){if(min>0)adj('energy',-min/50)}
function onArrive(dest){S.visited[dest]=true}
function daySummary(d){const n=S.book.filter(b=>b.d===d&&b.status==='done').length;return [`⭐ ${S.rep}`,`⚡ ${S.energy}`,`🛶 ${n} trip${n===1?'':'s'}`]}

// ---- losing ----
const LOSSES={
  permit:['Permit pulled','Three citations. Alaska State Parks suspends your Kenai River guide permit. The sled goes up for sale on the community board.'],
  reviews:['Nobody’s booking','Your reviews sank below the waterline. The phone stopped ringing, so you take a job on the slime line in Kenai.'],
  broke:['Repossessed','The bank tows the jet sled out of your yard. You can always deckhand in Homer.'],
};
function checkLoss(){if(S.cites>=3)return 'permit';if(S.rep<=0)return 'reviews';if(S.money<-2000)return 'broke';return null}

// ---- booking requests ----
// Is a trip of this type on day d against the rules? (guide boats below Skilak Sun/Mon; charter halibut can't be kept on closed days)
const illegalDay=(type,d)=>!!(TRIPS[type].below&&isSunMon(d))||(type==='halibut'&&halClosed(d));
function makeRequest(){
  const d0=day()+1,end=seasonFirst()+SEASON;if(d0>=end||S.winter) return null;
  const s=seasonOf(day()),span=Math.min(6,end-d0);
  // the dipnet "guests" scam: rolled once per call, and at most one per season
  if(S.dipnetAsk!==s&&Math.random()<.12){
    const p=pick(PARTIES.filter(x=>!x.res));S.dipnetAsk=s;
    return {kind:'dipnet',d:d0+Math.floor(Math.random()*span),n:2+Math.floor(Math.random()*3),who:p.who,from:p.from,res:false};
  }
  const roll=()=>{const d=d0+Math.floor(Math.random()*span),types=['reds','reds','reds','reds','trout','trout','halibut'].concat(sday(d)>=8?['silver','silver']:[]);return {d,type:pick(types)}};
  for(let i=0;i<24;i++){
    let {d,type}=roll();
    if(illegalDay(type,d)) ({d,type}=roll());             // re-roll an illegal date once; the second pick stands, so some illegal requests still teach the lesson
    const p=pick(PARTIES),kind=Math.random()<.22&&type==='reds'?'king':'trip';
    const nr={reds:[2,6],silver:[2,5],trout:[2,4],halibut:[4,6]}[type],n=nr[0]+Math.floor(Math.random()*(nr[1]-nr[0]+1));
    if(conflicts(d,type)) continue;
    return {kind,d,type,n,who:p.who,from:p.from,res:!!p.res,quirk:Math.random()<.25?[pick(['drinker','nolicense','photo','kid'])]:[]};
  }
  return null;
}
// What's wrong with the requested date, as a modal line ('' when nothing)
function requestWarn(r){
  const T=TRIPS[r.type],iss=issueOf({type:r.type,d:r.d,n:r.n}),w=[];
  if(iss==='sunmon') w.push(`🚫 ${dayName(r.d)}: guide boats can’t fish below Skilak Lake (May 1–Jul 31)`);
  if(iss==='overload') w.push(`🚫 ${T.n}s are limited to ${r.type==='silver'?4:5} anglers on a guide boat`);
  if(r.type==='halibut'&&halClosed(r.d)) w.push(`⚓ ${dayName(r.d)}: charter anglers can’t keep halibut today (${halDaysTxt()})`);
  if(faDue(r.d)&&faClassDay(r.d)&&T.start<960&&T.start+T.len>780) w.push(`⛑️ This runs into the 1–4 PM first-aid class on ${dayName(r.d)}, and your card is still due`);
  return w.map(x=>`<p style="font-size:13px;color:var(--warn)">${x}</p>`).join('');
}
// nearest later day in the same season that is legal and free (null if none). Only date problems are fixed by moving the date.
function nextLegalDay(r){
  const end=seasonFirst(seasonOf(r.d))+SEASON;
  for(let d=r.d+1;d<end;d++) if(!illegalDay(r.type,d)&&!conflicts(d,r.type)) return d;
  return null;
}
function requestModal(r){
  const who=`The <b>${r.who}</b> (${r.from}${r.res?', Alaska residents':''})`;
  if(r.kind==='dipnet'){
    modal('📞 Booking request',`<p>${who}, ${r.n} people, want you to take them <b>dipnetting at the mouth of the Kenai</b> on ${dlong(r.d)}. “We’ll pay whatever. We saw it on YouTube.”</p>`,[
      {l:'Explain it’s Alaska residents only',s:'Offer a sockeye trip some other time.',fn:()=>{adj('rep',1);say('📞 You explain the personal-use dipnet fishery is for Alaska residents only. They’re disappointed but say they’ll book a sockeye trip next summer.')}},
      {l:`Take them as your “guests” — ${$(150*r.n)}`,s:'Cash up front.',fn:()=>{money(150*r.n);S.stats.earned+=150*r.n;say('🥅 You pocket the cash and hand nonresidents dipnets on the beach.');violate(null,{p:.35,fine:500,what:'helping nonresidents in the personal-use fishery'})}}]);
    return;
  }
  const T=TRIPS[r.type],price=T.gig?`day rate ${$(T.gig)}`:`${$(T.price)} × ${r.n} = ${$(T.price*r.n)}`;
  const book=(n,q,d)=>{const b=addBooking({d:d??r.d,type:r.type,n,who:r.who,from:r.from,res:r.res,quirk:q||r.quirk});sfx('good');say(`📅 Booked: ${T.ic} ${T.n}, ${dlong(b.d)} at ${fmt(T.start)}, the ${b.who} (${b.n}).`)};
  if(r.kind==='king'){
    modal('📞 Booking request',`<p>${who}, ${r.n} anglers, ${dlong(r.d)}: “We want a <b>Kenai king</b>. A big one. Like the world record.”</p>${requestWarn(r)}`,[
      ...(kingRule()==='open'?[{l:'Book it: kings are open this year',s:`1 per day, 20 in. or longer. ${$(payOf({type:'reds',n:r.n}))}.`,fn:()=>book(r.n,['kingfan'])}]:[
      {l:`Tell them straight: kings are ${kingRule()==='cr'?'catch-and-release only':'closed'}`,s:`Book a sockeye trip instead: ${$(payOf({type:'reds',n:r.n}))}.`,fn:()=>book(r.n,['kingfan'])},
      {l:'Promise you’ll “see what we can do”',s:`Book it: ${$(payOf({type:'reds',n:r.n}))}.`,fn:()=>book(r.n,['kingfan','promised'])}]),
      {l:'Decline politely',fn:()=>say('📞 You pass. They’ll find somebody.')}]);
    return;
  }
  const o=[],warn=requestWarn(r),alt=illegalDay(r.type,r.d)?nextLegalDay(r):null,bn=r.type==='trout'&&r.n>3?3:r.n;
  const bad=illegalDay(r.type,r.d);
  if(r.type==='trout'&&r.n>3) o.push({l:'Book 3 (drift boat seats three)',s:`${$(payOf({type:'trout',n:3}))}. One of them stays at the lodge.`,fn:()=>book(3)});
  else o.push({l:`${bad?'Book it anyway':'Book it'} — ${$(payOf({type:r.type,n:r.n}))}`,s:bad?'You’ll face the rules on the water.':'',fn:()=>book(r.n)});
  if(bad&&alt!=null) o.splice(0,0,{l:`Offer ${dlong(alt)} instead`,s:`Same party, ${fmt(T.start)}. ${$(payOf({type:r.type,n:bn}))}.`,fn:()=>book(bn,null,alt)});
  o.push({l:'Decline politely',fn:()=>say('📞 You pass on that one.')});
  modal('📞 Booking request',`<p>${who} would like a <b>${T.ic} ${T.n}</b> on <b>${dlong(r.d)}</b> at ${fmt(T.start)} for <b>${r.n}</b>.</p>${warn}<p style="font-size:13px;color:var(--mute)">${T.long} ${price}.</p>`,o);
}

// ---- dipnetting (you're an Alaska resident) ----
function dipnetModal(){
  const d=day(),o=avgOdds('sockeye','kbeach',S.t,180),n=clamp(Math.round((2+13*o)*(.7+Math.random()*.6)),1,Math.max(1,25-S.pu));
  S.dipnet[d]=true;
  modal('🥅 Dipnetting at the mouth',`<p>Three hours in chest waders at the mouth of the Kenai, a five-foot hoop net and a few hundred of your neighbors. You bonk <b>${n} reds</b>.</p><p style="font-size:13px">🌊 Tide: ${tideNow()}. Reds ride the incoming tide in; ${o>.75?'you timed it right.':o>.45?'decent timing.':'next time, come on the flood tide.'}</p><p style="font-size:13px;color:var(--mute)">Personal use is for Alaska residents only. Household limit: 25. Before you leave the beach, clip both tips of each fish’s tail and record it on your permit.</p>`,[
    {l:'Clip both tail tips & record them on your permit',s:'10 more minutes.',fn:()=>{pass(190);S.freezer+=n;S.pu+=n;adj('energy',-10);say(`🥅 ${n} reds clipped, recorded and iced. Freezer: ${S.freezer}/25.`)}},
    {l:'Skip the paperwork, beat the traffic',fn:()=>{pass(180);S.freezer+=n;S.pu+=n;adj('energy',-10);say(`🥅 You toss ${n} reds in the cooler and hit the road.`);violate(null,{p:.3,fine:150,minor:true,what:'unmarked, unrecorded personal-use salmon'})}}]);
}

// ---- enforcement: boat & credential checks ----
function credCheck(){
  const who=pick(['An Alaska Wildlife Trooper','A State Parks ranger','A pair of troopers in a patrol boat']);
  let bad=false;
  if(S.cred.fa<day()&&todays().length){bad=true;say(`👮 ${who} asks for your guide license, USCG card and first-aid card. The first-aid card is expired.`);cite('guiding without a current first-aid card',500,false,null)}
  if(S.overdue>0){bad=true;say(`👮 ${who} flips through your ADF&G logbook and finds blank days.`);cite('logbook entries not filled out',250,true,null)}
  if(!bad){S.stats.checks++;adj('rep',1);say(`👮 ${who} checks your licenses, decals, life jackets, fire extinguisher and logbook. “Clean boat. Have a good one.”`)}
}

// ---- random events ----
defEvent({id:'call_request',hook:'wake',tile:['📞','Booking request','info'],chance:.5,cond:()=>!S.winter&&sday(day())<12,
  run:()=>{const r=makeRequest();if(r)requestModal(r);else say('📞 A missed call from an unknown number. No voicemail.')}});
defEvent({id:'trooper_check',hook:'arrive',tile:['👮','Boat check','warn'],chance:.22,bad:true,cooldown:2,cond:c=>['lower','cooper','homer'].includes(c.at),
  run:()=>credCheck()});
defEvent({id:'moose',hook:'travel',tile:['🫎','Moose on the highway','info'],chance:.1,cooldown:2,
  run:()=>{pass(10);say('🫎 A cow moose and her calf amble across the Sterling Highway. Everybody stops. +10 minutes.')}});
defEvent({id:'traffic',hook:'travel',tile:['🚗','Weekend traffic','bad'],chance:.4,cond:c=>[4,5].includes(day()%7)&&(['cooper','homer'].includes(c.to)||['cooper','homer'].includes(c.from)),
  run:()=>{pass(20);say('🚗 Half of Anchorage is headed down the Sterling Highway with dipnets on the roof. +20 minutes.')}});
defEvent({id:'flat',hook:'travel',tile:['🛞','Flat trailer tire','bad'],chance:.05,bad:true,max:2,
  run:()=>{money(-60);S.stats.spent+=60;pass(30);say('🛞 A trailer tire lets go on the highway shoulder. Spare, jack, mosquitoes. −$60, +30 minutes.')}});
defEvent({id:'midnight_sun',hook:'night',tile:['🌞','Midnight sun','bad'],chance:.15,cond:c=>c.where==='home',
  run:()=>{adj('energy',-8);say('🌞 It’s 1 AM and still light enough to read. You stare at the ceiling. Energy −8.')}});
defEvent({id:'mosquitoes',hook:'arrive',tile:['🦟','Mosquitoes','bad'],chance:.2,cond:c=>['cooper','kbeach'].includes(c.at),
  run:()=>{adj('energy',-2);say('🦟 The state bird is out in force. You should’ve worn the head net.')}});
defEvent({id:'cancel',hook:'wake',tile:['📵','Cancellation','bad'],chance:.08,bad:true,max:2,cond:()=>S.book.some(b=>b.d>day()&&b.status==='booked'),
  run:()=>{const b=pick(S.book.filter(x=>x.d>day()&&x.status==='booked')),keep=Math.round(payOf(b)*.25);b.status='cancelled';S.stats.cancelled++;money(keep);S.stats.earned+=keep;
    say(`📵 The ${b.who} cancel their ${dlabel(b.d)} ${TRIPS[b.type].n}: a missed connection in Seattle. You keep the ${$(keep)} deposit.`)}});
defEvent({id:'gossip',hook:'arrive',tile:['🗣️','Guide gossip','info'],chance:.2,cond:c=>['shop','town'].includes(c.at),
  run:()=>{S.skill++;say('🗣️ An old-timer guide leans on your tailgate. “'+pick(LORE)+'”')}});
defEvent({id:'bear_bin',hook:'night',tile:['🐻','Bear in the bin','bad'],chance:.08,max:1,
  run:()=>{money(-40);S.stats.spent+=40;say('🐻 A black bear tore open the fish-waste bin behind the shop. −$40 for a bear-proof lid. Lesson learned.')}});
defEvent({id:'good_review',hook:'night',tile:['⭐','Five-star review','good'],chance:.5,cond:()=>S.book.some(b=>b.d===day()&&b.status==='done'&&b.out&&b.out.happy>=80),
  run:()=>{adj('rep',3);say('⭐ A glowing review goes up: “Best day of our whole Alaska trip. Ask for {{name}}.”')}});

// ---- tips ----
const TIPS=[
  {id:'welcome',when:()=>day()===0&&S.loc==='shop',t:'👋 Welcome, {{name}}! Monday is a shop day. Rig tomorrow’s gear, return calls, and check the <b>📅 Bookings</b> tab.'},
  {id:'firstaid',when:()=>faUrgent(),t:'⛑️ Your first-aid card expires <b>this week</b>. The class is in <b>Soldotna</b>, Mon, Tue & Thu 1–4 PM (join by 1:30). Guiding without a current card can get you cited.'},
  {id:'fuel',when:()=>S.fuel<BURN.reds+2,t:'⛽ The sled is low. The only fuel is the <b>Kenai Harbor</b> fuel dock at the river mouth, 6 AM–10 PM. A sockeye trip burns about 9 gallons.'},
  {id:'launch',when:()=>todays().some(b=>TRIPS[b.type].loc!==S.loc),t:'🛶 Trips launch from a set spot. Use <b>🧭 Go somewhere</b> and be there before the launch time.'},
  {id:'logbook',when:()=>S.unlogged>0,t:'📓 Every guided trip needs an ADF&G logbook entry. Fill it out at the shop <b>before bed</b>.'},
  {id:'gear',when:()=>S.gear<=1,t:'🪱 You’re low on tackle. Restock in <b>Soldotna</b>, or the next trip suffers.'},
  {id:'sunmon',when:()=>isSunMon(day()),t:'🚫 No fishing from guide boats below Skilak today. The upper river, Homer and the dipnet beach are still open.'},
  {id:'career',when:()=>sday(day())===0&&day()>0&&!S.winter,t:'📆 New season, new rules. Check the <b>Regs</b> tab for this year’s king status and halibut rules, and the <b>Fish</b> tab for the run forecast.'},
  {id:'regs',when:()=>day()>=1,t:'📖 The <b>Regs</b> tab has your credentials, the sonar count and every rule you guide by.'},
];

// ---- To-do tab ----
function todoItems(){
  const d=day(),m=tod(),it=[];
  S.book.filter(b=>b.d===d).forEach(b=>{const T=TRIPS[b.type];
    it.push({l:`${T.ic} ${T.n}: ${b.who}`,s:`${fmt(T.start)}, ${L[T.loc].name}`,ok:b.status==='done',fail:b.status==='noshow'||b.status==='cancelled',urgent:b.status==='booked'&&m>=T.start-120})});
  if(faDue(d)) it.push({l:'Renew your first-aid card',s:'Soldotna clinic, Mon, Tue & Thu 1–4 PM (join by 1:30), $95.',ok:false,urgent:faUrgent(d)||S.cred.fa<d});
  it.push({l:'Keep your logbook current',s:S.unlogged+S.overdue?`${S.unlogged+S.overdue} trip${S.unlogged+S.overdue>1?'s':''} to write up.`:'All caught up.',ok:!(S.unlogged+S.overdue),urgent:S.overdue>0});
  it.push({l:'Keep a clean record',s:`${S.cites} citation${S.cites===1?'':'s'}, ${S.warns} warning${S.warns===1?'':'s'}. Three citations and your permit is gone.`,ok:S.cites===0,urgent:S.cites>=2});
  it.push({l:'Optional: fill the freezer with 25 dipnet reds',s:`${S.freezer}/25. Kenai City Beach, 6 AM–11 PM.`,ok:S.freezer>=25});
  return it;
}
const RULES_HTML='<p>Guide every July of a 2-, 5- or 10-year career. You lose if you get 3 active citations (permit pulled; citations drop off after the next season), your reputation hits 0, or you fall $2,000 in debt.</p><p>Score: net cash + three quarters of the value of boats and permits you bought + reputation ×15 + 60 per trip − 400 per citation + 2 per freezer fish, plus 300 a season for a career without a violation. The grade is per season, so careers of any length compare: A at 66,000 a season, B 57,000, C 45,000, D 28,000.</p><p>Difficulty gives no score bonus. It changes the game instead: <b>Rookie</b> has fewer patrols, gentler fines, cheaper fuel and bills, friendlier clients and a bit more off-month work; <b>Licensed</b> is the baseline; <b>Combat</b> has more patrols, fines that climb with every citation, dearer fuel, bills and repairs, pickier clients, less off-month work and more bad luck. The same play grades about a step lower on Combat and a step higher on Rookie.</p>';

// ---- achievements ----
const ACH=[
  {id:'first_trip',ic:'🛶',n:'Off the Bank',d:'Finish your first guided trip.',test:()=>S.stats.trips>0},
  {id:'clean_boat',ic:'🧼',n:'Clean Boat',d:'Finish a career without a single violation.',test:c=>c.end&&!c.lost&&S.stats.viol===0},
  {id:'limit_out',ic:'🐟',n:'Limit Out',d:'Every client limits on a trip.',test:()=>S.stats.limits>0},
  {id:'let_him_go',ic:'👑',n:'Let Him Go',d:'Release a king the right way: in the water.',test:()=>S.stats.kings>0},
  {id:'stop_chop',ic:'🔪',n:'Stop, Chop & Throw',d:'Dispose of fish waste the bear-smart way.',test:()=>S.stats.chop>0},
  {id:'freezer',ic:'🧊',n:'Full Freezer',d:'Dipnet 25 reds for your household.',test:()=>S.freezer>=25},
  {id:'end_of_road',ic:'⚓',n:'End of the Road',d:'Captain the Homer halibut charter.',test:()=>S.stats.halibut>0||S.book.some(b=>b.type==='halibut'&&b.status==='done')},
  {id:'five_star',ic:'⭐',n:'Five-Star Guide',d:'Reach 90 reputation.',test:()=>S.rep>=90},
  {id:'combat_season',ic:'💪',n:'Combat Season',d:'Finish 12 trips.',test:()=>S.stats.trips>=12},
  {id:'veteran',ic:'🎖️',n:'Kenai Veteran',d:'Finish a 5-year career.',test:c=>c.end&&!c.lost&&S.years>=5},
  {id:'lifer',ic:'🏔️',n:'River Lifer',d:'Finish a 10-year career.',test:c=>c.end&&!c.lost&&S.years>=10},
  {id:'own_six_pack',ic:'⚓',n:'Your Own Six-Pack',d:'Buy a Charter Halibut Permit and run your own Homer charters.',test:()=>!!(S.up&&S.up.chp)},
  {id:'legal_king',ic:'👑',n:'A Legal King',d:'Put a client on a legal Kenai king in a year kings are open.',test:()=>(S.stats.legalKings||0)>0},
  {id:'bear_aware',ic:'🐻',n:'Bear Aware',d:'Give a brown bear the gravel bar.',test:()=>S.stats.bear>0},
  {id:'happy_camper',ic:'🏕️',n:'Happy Camper',d:'Camp 7 nights in total during winters.',test:()=>(S.stats.campNights||0)>=7},
  {id:'wild_kenai',ic:'🦌',n:'Wild Kenai',d:'See 5 different wildlife encounters while camping.',test:()=>Object.keys(S.stats.seen||{}).length>=5},
];

// ---- scoring and the end screen ----
const FINISH_TEXT={h1:'{{name}}, that’s a wrap on your career',sub:()=>`${S.years} Julys on the Kenai, ${yearOf(0)}–${yearOf(day())}. The river keeps running; somebody else gets your seams now.`};
function curSeason(){const s=S.stats,o=S.st0||{};return {year:yearOf(day()),trips:s.trips-(o.trips||0),fares:s.earned-(o.earned||0),earned:(s.earned+s.tips)-((o.earned||0)+(o.tips||0))}}
function scoreOf(){return Math.round((S.money-DF().money)+restOfSeason(curSeason()).net+(S.up?S.up.value:0)*.75+S.rep*15+S.stats.trips*60-(S.stats.citesTotal||S.cites)*400+S.freezer*2+(S.stats.viol===0?300*S.years:0))}
const GRADE_CUTS=[66000,57000,45000,28000];            // A, B, C, D: score per season, the same on every difficulty
function gradeOf(sc){
  sc=sc/(S.years||1);                                   // graded per season, so careers of any length compare
  if(sc>=GRADE_CUTS[0]) return ['A','Guide Master','Other guides watch where you anchor (legally).'];
  if(sc>=GRADE_CUTS[1])  return ['B','River Rat','You know every seam from Big Eddy to the Russian.'];
  if(sc>=GRADE_CUTS[2])  return ['C','Seasonal Hand','Booked, tired and still mostly dry.'];
  if(sc>=GRADE_CUTS[3])  return ['D','Greenhorn','You learned the regs the expensive way.'];
  return ['F','Hang Up the Waders','Maybe the slime line is hiring.'];
}
function endRows(){
  const s=S.stats;
  const last=curSeason();last.rest=restOfSeason(last);
  const yrs=S.seasons.concat([last]).map(x=>`${x.year}: ${x.trips}${x.rest&&x.rest.trips?` + ${x.rest.trips}`:''} trips, ${$(x.earned+(x.rest?x.rest.net:0))}`).join('<br>');
  return [['Difficulty',`${DF().ic} ${DF().n}: ${DF().enforce<1?'fewer patrols, cheaper bills':DF().enforce>1?'more patrols, dearer bills, pickier clients':'standard patrols and bills'}; no score bonus`],['Career',`${S.years} seasons`],['Season by season',yrs],['Cash',$(Math.round(S.money))],['Net over the career',$(Math.round(S.money-DF().money))],['Boats & permits bought',S.up&&S.up.value?$(S.up.value):'none'],['Trips / clients',`${s.trips} / ${s.clients}`],
    ['Fish landed',s.fish],['Trips where everyone limited',s.limits],['Tips',$(s.tips)],['Reputation',S.rep],
    ['Record',`${s.citesTotal||0} citation${(s.citesTotal||0)===1?'':'s'}, ${S.warns} warning${S.warns===1?'':'s'}, ${$(s.fines)} in fines`],
    ['Fuel',`${Math.round(s.fuelGal||0)} gal, ${$(Math.round(s.fuelCost||0))}`],['Coast Guard tows',s.tows||0],['Winter camping',`${s.campNights||0} night${(s.campNights||0)===1?'':'s'}, ${s.encounters||0} wildlife encounter${(s.encounters||0)===1?'':'s'}`],['Kings released',s.kings],['Freezer',`${S.freezer} reds`],['Boat checks passed',s.checks]];
}

// ---- save migrations ----
const MIGRATIONS=[
  // schema 2 (1.5.1): the trip result lives in b.out; b.res is only the Alaska-resident flag again
  {to:2,run:x=>{(x.book||[]).forEach(b=>{if(b.res&&typeof b.res==='object'){b.out=b.res;b.res=false}else if(typeof b.res!=='boolean')b.res=!!b.res})}},
];
