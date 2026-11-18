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
  if(minor&&S.warns<1){S.warns++;S.stats.warnsTotal=(S.stats.warnsTotal||0)+1;line=`⚠️ ${who} writes you a warning for ${what}. One warning a season; the next one costs money.`}
  else{fine=Math.round(fine*DF().fine*(1+DF().esc*S.cites));S.cites++;S.citeLog.push(day());S.stats.citesTotal=(S.stats.citesTotal||0)+1;money(-fine);S.stats.fines+=fine;adj('rep',-6);
    line=`🚨 ${who} cites you for ${what}: ${$(fine)} fine. That’s ${S.cites} active citation${S.cites>1?'s':''} of 3 before State Parks pulls your Kenai River guide permit.${S.cites>1?' Repeat offenders pay more for every citation on the record.':''} (Citations drop off after the next season.) Citations are public record, and clients look their guide up: fewer bookings for the rest of the summer.`}
  showTile('🚨',minor&&line.startsWith('⚠️')?'Warning':'Citation',what,'bad');
  if(notes) notes.push(line); else say(line);
  if(line.startsWith('🚨')) citeCancel(notes);
}
// ---- (1.8.1) a habit gets noticed ----
// Breaking a rule can pay on the day, but over a season it catches up with you:
//  · every rule you break this July makes the next one likelier to be caught (troopers and other guides learn your boat);
//  · a guide who sees it tells the others (word of mouth, so fewer off-season bookings);
//  · a citation is public record: it can cost a booked July party, and each one trims the rest of the summer's bookings (25-fuel.js).
const HEAT_P=.15, SEEN_WOM=4, CITE_CANCEL=.85, CITE_REST=.08;
const heat=()=>Math.max(0,((S.stats&&S.stats.viol)||0)-((S.st0&&S.st0.viol)||0));   // rules broken this season (resets each winter)
function citeCancel(notes){
  if(!S.book||Math.random()>=CITE_CANCEL) return;
  const end=seasonFirst()+SEASON,bs=S.book.filter(b=>b.d>day()&&b.d<end&&b.status==='booked');if(!bs.length) return;
  const b=pick(bs);b.status='cancelled';S.stats.cancelled++;S.stats.citeCancels=(S.stats.citeCancels||0)+1;
  const l=`📵 The ${b.who} look you up, find the citation and cancel their ${dlabel(b.d)} ${TRIPS[b.type].n}. They want the deposit back, and you give it.`;
  if(notes) notes.push(l); else say(l);
}
function violate(notes,{p,fine,what,minor,who}){
  const h=heat();S.stats.viol++;
  if(Math.random()<Math.min(.95,p*DF().enforce*(1+HEAT_P*h))){cite(what,fine,minor,notes,who);return true}
  if(Math.random()<.3){adj('rep',-2);S.wom=(S.wom||0)-SEEN_WOM;const l='👀 Another guide saw it. Word travels fast on the Kenai: fewer off-season bookings, and the troopers hear about it too.';if(notes)notes.push(l);else say(l)}
  return false;
}

// ---- spots ----
const SPOTS={
  reds:[
    {l:'Slip into the seams below Big Eddy at first light',s:'Classic sockeye water. Elbow-to-elbow boats by eight.',q:.08,h:0,sh:'the Big Eddy seams',tac:'flip',big:.08},
    {l:'Run up to the gravel bars near Swiftwater Park',s:'Less pressure, fewer fish, happier clients. A longer run: more fuel.',q:.02,h:3,fuel:3,sh:'the Swiftwater gravel bars',tac:'flip',scenic:1,big:.15},
    {l:'Drop them on the empty bank by the “Habitat restoration: closed to fishing” sign',s:'Nobody’s there, and the reds hug that bank.',q:.15,h:0,viol:{p:.4,fine:300,what:'fishing a bank closed to protect riparian habitat'},sh:'the closed bank',tac:'bank'},
    {l:'Use the public elevated walkway at Centennial',s:'Legal, easy footing, full-contact combat fishing.',q:0,h:4,sh:'the Centennial walkway',tac:'bank',easy:1,big:.04}],
  silver:[
    {l:'Back-troll single-hook plugs through the Pillars',s:'Slow and steady down the deep slots.',q:.06,h:0,sh:'the Pillars',tac:'troll',big:.06},
    {l:'Drift spinners past Eagle Rock',s:'Early silvers stage in the soft water.',q:.04,h:0,sh:'Eagle Rock',tac:'drift',easy:1,big:.04},
    {l:'Work the Moose Range Meadows bend',s:'Pretty, quiet, a little thin on fish. A long run upriver: more fuel.',q:.02,h:2,fuel:4,sh:'Moose Range Meadows',tac:'troll',scenic:1,big:.08}],
  trout:[
    {l:'Beads below the Russian River confluence',s:'Rainbows stack behind spawning reds. So do anglers. So do bears.',q:.1,h:0,add:['flyonly','chop'],sh:'the Russian River confluence',tac:'beads',big:.08},
    {l:'Swing streamers through the Sportsman’s Landing riffles',s:'Fewer people, fun grabs.',q:.04,h:0,sh:'the Sportsman’s Landing riffles',tac:'streamers',easy:1,scenic:1,big:.06},
    {l:'Push on through to Skilak Lake',s:'Big water, big fish, and Skilak’s famous afternoon wind.',q:.12,h:0,risk:{p:.35,txt:'💨 The Skilak wind kicks up four-foot waves on the crossing. Everyone is soaked and nobody is smiling.',h:-10,boat:-10,energy:-8},sh:'Skilak Lake',tac:'streamers',scenic:1,hard:1,big:.18}],
  halibut:[
    {l:'Fish the mouth of Kachemak Bay at slack tide',s:'Short run, easy ride. Cook Inlet tides rule everything.',q:.03,h:0,sh:'the mouth of Kachemak Bay',tac:'anchor',easy:1,scenic:1,big:.06},
    {l:'Run to the flats off Anchor Point',s:'Solid “chicken” halibut and the odd barn door.',q:.06,h:0,sh:'the Anchor Point flats',tac:'jig',big:.1},
    {l:'Make the long run toward the Barren Islands',s:'The big fish are out there. So is the weather. Burns ~25 more gallons.',q:.14,fuel:25,h:0,risk:{p:.3,txt:'🌊 A small-craft advisory comes up on the radio. Rips at the tide change, green water over the bow, four seasick clients.',h:-15,boat:-12,energy:0},sh:'the Barren Islands',tac:'anchor',scenic:1,hard:1,big:.25}],
};

// ---- dilemmas ----
// Each returns {t:title, b:body html, o:[{l, s, fn(b,t), legal}]}. After any option the runner moves to the next step.
// O(label, subtitle, fn, ill): pass ill=true for an option that breaks a rule. The runner shuffles the options, styles none as
// the primary button, and puts legal:true/false on each (data-legal on the button) so tests and bots can find the legal ones.
// Every legal choice costs something real (time, fish, a smaller tip or cash); every illegal one pays something real, if nobody's watching.
const O=(l,s,fn,ill)=>({l,s,fn,legal:!ill});
const fx=(t,amt,why)=>{(t.x=t.x||[]).push([why,amt])};      // a side deal on this trip: +cash in your pocket, −cash out of it
const lose=(t,m)=>{t.lost=(t.lost||0)+m};                    // minutes lost on the water
const perHead=b=>Math.round(payOf(b)/Math.max(1,b.n));
const STEP={
  issue_sunmon:(b)=>({t:`🚫 It’s ${dayName(b.d)}`,b:`<p>From May 1 to July 31, sport fishing from a guide vessel on the Kenai downstream of the Skilak Lake outlet is <b>closed on Sundays and Mondays</b>. The ${b.who} are standing at the launch anyway, rods in hand.</p>`,o:[
    O('Call it off and refund them','No fare, rep −4.',(b,t)=>{adj('rep',-4);t.abort=true;tripCancel(b,`🚫 You refund the ${b.who} and explain the rule. They grumble, but they get it.`)}),
    O('Run it anyway. It’s one day.','Keep the full fare. Somebody is usually watching.',(b,t)=>violate(t.notes,{p:.6,fine:1000,what:'fishing from a guide vessel on a closed day'}),1)]}),
  issue_overload:(b)=>{const mx=TRIPS[b.type].max;return {t:'👥 Too many for the boat',b:`<p>You booked ${b.n}. In July, below Skilak, a guide boat may hold no more than <b>5 people while fishing, guide included</b>${b.type==='reds'?', and you can carry 5 clients plus yourself only if they all fish from shore':''}. KRSMA caps any motorboat at 6 aboard.</p>`,o:[
    O('Leave the extras fishing from shore at Centennial','Costs you 30 minutes of ferrying, $30 of apology coffee and some goodwill.',(b,t)=>{t.happy-=6;lose(t,30);fx(t,-30,'Coffee and donuts for the shore group');t.notes.push(`🏞️ ${b.n-mx} of the ${b.who} fish the Centennial walkway instead.`)}),
    O(`Refund the extras and take ${mx}`,'You give back their fares.',(b,t)=>{t.happy-=3;b.n=mx;t.notes.push(`💵 You refund the extra anglers and run with ${mx}.`)}),
    O('Squeeze everyone in','Full fare plus a $75 tip from a very full boat.',(b,t)=>{fx(t,75,'Tip from the squeezed-in party');violate(t.notes,{p:.4,fine:400,what:'too many people in a guide boat'})},1)]}},
  five:(b)=>({t:'👥 Five clients in July',b:'<p>Below Skilak in July you may carry 5 clients plus yourself <b>only to fish from shore</b>. Fishing from the boat, the limit is 5 people including you.</p>',o:[
    O('Everyone fishes from the bank','Slower: fewer fish and 30 more minutes ferrying.',(b,t)=>{t.shore=true;t.q-=.04;lose(t,30);t.notes.push('🏞️ You ferry all five to a gravel bar and they flip from shore.')}),
    O('Let them fish from the boat on the drift','Better catch and a $60 tip.',(b,t)=>{t.q+=.05;fx(t,60,'Tip for the better drift');violate(t.notes,{p:.35,fine:400,what:'too many people fishing from a guide vessel in July',minor:true})},1)]}),
  license:(b)=>({t:'🪪 Somebody forgot a license',b:`<p>One of the ${b.who} never bought an Alaska sport fishing license. Every angler 16 and older needs one, and it goes in your logbook.</p>`,o:[
    O('Have him buy one on his phone','ADF&G online store: 20 minutes at the launch and a grumpy start.',(b,t)=>{t.happy-=4;lose(t,20);t.notes.push('📱 License bought at the launch, number written in your logbook.')}),
    O('He can ride along but not fish','You refund half his fare. He sulks.',(b,t)=>{t.nofish++;t.happy-=8;fx(t,-Math.round(perHead(b)/2),'Half his fare refunded')}),
    O('Let it slide. Who’s checking?','Everybody fishes, and he slips you $50.',(b,t)=>{fx(t,50,'Cash from the unlicensed angler');violate(t.notes,{p:.3,fine:300,what:'guiding an unlicensed angler'})},1)]}),
  expired:(b)=>({t:'⛑️ Your first-aid card expired',b:'<p>A current first-aid and CPR certification is a condition of your guide license. As of today yours is expired.</p>',o:[
    O('Cancel and refund','No fare, rep −6.',(b,t)=>{adj('rep',-6);t.abort=true;tripCancel(b,`⛑️ You cancel on the ${b.who}. Get to the Monday, Tuesday or Thursday class in Soldotna.`)}),
    O('Run it anyway','Full fare. Hope nobody asks for your card.',(b,t)=>violate(t.notes,{p:.3,fine:500,what:'guiding without a current first-aid certification'}),1)]}),
  spot:(b,t)=>{t=t||S.trip||{};const T=TRIPS[b.type],hint=spotHint(b.type),d=day();return {t:`${T.ic} Where to, Captain?`,b:`<p>${T.long}</p><p>The ${b.who} are rigged and ready. Where do you take them?</p>${hint?`<p class="small-note" style="font-size:12.5px;color:var(--mute);margin:0">${hint==='exact'?'🔭 You scouted the water: the reads below are exact.':'🐟 From the Fish tab: a read from today’s water, wind, run and tide.'}</p>`:'<p class="small-note" style="font-size:12.5px;color:var(--mute);margin:0">💡 Spots fish differently with the water, wind and run. Check the 🐟 Fish tab or scout the river first.</p>'}${t.bt?condHTML(b,t,0):''}`,o:SPOTS[b.type].map((sp,i)=>{
    const read=hint?spotFit(b.type,i,d,hint==='exact'):null,pre=read?`${hint==='exact'?'🔭':'🐟'} ${spotWord(read.f)}${read.why?`: ${read.why}`:''}. `:'';
    const op=O(sp.l,pre+sp.s,(b,t)=>{
    const fit=spotFit(b.type,i,d,true);
    if(t.bt){t.bt.spot=i;t.bt.tac=sp.tac;t.bt.k=0}else t.q+=sp.q+(fit?fit.f*SPOT_Q*DF().craft:0);
    t.happy+=sp.h||0;t.fuelx=(t.fuelx||0)+(sp.fuel||0);t.notes.push(`📍 ${sp.l}.`);
    if(fit&&Math.abs(fit.f)>=.3)t.notes.push(fit.f>0?`🎯 ${fit.why?fit.why.charAt(0).toUpperCase()+fit.why.slice(1):'The water suits it'}: the fish are there.`:`🌫️ ${fit.why?fit.why.charAt(0).toUpperCase()+fit.why.slice(1):'The water is wrong for it'}: it fishes slowly today.`);
    if(sp.viol){fx(t,60,'Tip for the empty water');violate(t.notes,sp.viol)}
    if(sp.risk&&Math.random()<sp.risk.p*windRisk()){t.notes.push(sp.risk.txt);t.happy+=sp.risk.h;adj('boat',sp.risk.boat||0);adj('energy',sp.risk.energy||0)}
    if(sp.add) t.steps.splice(t.step+1,0,...sp.add.filter(x=>!t.steps.includes(x)));},!!sp.viol);
    if(t.bt){let ev=0;for(let k=0;k<t.bt.K;k++)ev+=45*(beatRead(b,t,k,i,sp.tac,k>0).q+.7)*segWin(b,k).len/TRIPS[b.type].len;op.v=ev+traitMoveV(b,t,0,{i,tac:sp.tac})+(sp.h||0)-(sp.fuel||0)*.25-(sp.viol?99:0)-(sp.risk?sp.risk.p*windRisk()*12:0);
      if(t.bt.short&&b.type==='halibut'&&i===2){op.dis=true;op.s='You promised to stay close today.'}}
    return op})}},
  beer:(b)=>({t:'🍺 Cooler’s open',b:`<p>It’s barely 7 AM and the ${b.who} crack the cooler. “Have one, Captain {{name}}!”</p>`,o:[
    O('Politely decline: you’re running the boat','They tease you about it all morning.',(b,t)=>{t.happy-=3}),
    O('Ask them to keep it closed till we’re off the water','Safer boat, quieter clients.',(b,t)=>{t.happy-=5}),
    O('Have just one, to be social','They love you for it and tip $40 more.',(b,t)=>{t.happy+=4;fx(t,40,'Tip from the good-time crowd');violate(t.notes,{p:.25,fine:1000,what:'operating a vessel after drinking (BUI)'})},1)]}),
  king:(b)=>{const k=kingRule(),head=`<p>A chrome king, easily 50 pounds, rolls beside the boat on a sockeye rig.</p><p>👑 <b>${REG().year}:</b> ${kingRuleTxt()}</p><p>Somewhere, Les Anderson’s 97-pounder is smiling.</p>`;
    if(k==='open') return {t:'👑 Fish on. A big one.',b:head,o:[
      O('Net it, keep it and record it on the harvest record','The family calls everyone. 15 minutes of paperwork and photos.',(b,t)=>{t.happy+=12+tv(b,{trophy:6,meat:3},0);G(t).big=1;t.kept++;lose(t,15);S.stats.legalKings=(S.stats.legalKings||0)+1;t.notes.push('👑 A legal Kenai king, recorded on the client’s harvest record before it hits the cooler. He’s calling his whole family.')}),
      O('Release it to fight another day',tv(b,{trophy:'They came for exactly this fish. Letting it go will sting.',photo:'A great in-the-water photo, but a smaller tip.'},'A generous gesture, but a smaller tip.'),(b,t)=>{t.happy+=2+tv(b,{trophy:-7,photo:3},0);if(hasT(b,'trophy'))G(t).release=1;S.stats.kings++}),
      O('Keep it, skip the harvest record','Saves the paperwork; he tips $40 for the hurry.',(b,t)=>{t.happy+=12;t.kept++;fx(t,40,'Tip for skipping the paperwork');violate(t.notes,{p:.3,fine:200,what:'not recording a king salmon on a harvest record',minor:true})},1)]};
    return {t:'👑 Fish on. A big one.',b:head,o:[
      O('Release it without lifting it from the water',tv(b,{trophy:'They came for a fish like this. Watching it swim away will hurt.',photo:'An in-the-water shot is still a great shot.',kids:'The kids will talk about it for a year.'},'A story they’ll tell forever, but no photo.'),(b,t)=>{t.happy+=(k==='cr'?4:1)+tv(b,{trophy:-6,photo:5,kids:3},0);if(hasT(b,'trophy'))G(t).release=1;else G(t).shot=1;S.stats.kings++;t.notes.push('👑 You slip the hook with the king still in the water. It holds a second, then melts into the current.')}),
      O('Lift it for one quick photo','The photo of a lifetime: the client slips you $100.',(b,t)=>{t.happy+=8;fx(t,100,'Cash for the king photo');violate(t.notes,{p:.3,fine:300,what:'removing a king salmon from the water',minor:true})},1),
      O('Bonk it. Once in a lifetime.','They’d pay double: $250 in your hand.',(b,t)=>{t.happy+=10;adj('rep',-8);t.kept++;fx(t,250,'Cash from the client who kept the king');t.notes.push('📵 Every boat on the drift watched you net that king.');violate(t.notes,{p:.6,fine:1500,what:'keeping a king salmon when kings can’t be kept'})},1)]}},
  snag:(b)=>({t:'🪝 Hooked in the back',b:'<p>A sockeye comes in hooked by the dorsal fin. “It counts, right?” In fresh water, a fish hooked anywhere but the mouth must be released immediately.</p>',o:[
    O('Release it',tv(b,{meat:'The cooler stays a fish short, and they count every fish.',first:'They’re just glad to learn the rule.',fly:'They’d release it anyway.'},'The cooler stays a fish short.'),(b,t)=>{t.happy-=tv(b,{meat:6,first:0,fly:-1,kids:1},3)}),
    O('Keep it. Close enough.','One more for the cooler and a $30 tip.',(b,t)=>{t.kept++;fx(t,30,'Tip for the extra fish');violate(t.notes,{p:.25,fine:200,what:'keeping a foul-hooked sockeye',minor:true})},1)]}),
  over:(b)=>({t:'🐟 Limited out, wants more',b:`<p>One of the ${b.who} has his ${S.limit} reds and wants to keep catching “for his wife back home.” Bag limits are per person, and nobody can catch someone else’s.</p>`,o:[
    O('He’s done keeping fish',tv(b,{meat:'He came for fish to take home. He sulks hard.',photo:'He shrugs and goes back to his camera.'},'He sulks the rest of the day.'),(b,t)=>{t.happy-=tv(b,{meat:8,photo:2,first:2},5)}),
    O('Keep a few extra for his wife','Happy client and a $60 tip.',(b,t)=>{t.kept+=2;t.happy+=3;fx(t,60,'Tip for the extra fish');violate(t.notes,{p:.3,fine:400,what:'exceeding the bag limit'})},1)]}),
  guide_fish:(b)=>({t:'🎣 “Show us how it’s done!”',b:'<p>Slow stretch. The clients want you to grab a rod. A guide may not sport fish while clients are present.</p>',o:[
    O('Coach them from the oars',tv(b,{first:'Beginners soak this up.',kids:'The kids want to do it themselves anyway.'},'You get better at teaching, but it’s tiring.'),(b,t)=>{S.skill++;adj('energy',-4);t.happy+=tv(b,{first:6,kids:3},0);if(hasT(b,'first'))G(t).coach=1;t.notes.push('🧑‍🏫 You fix their drift and their hooksets. Next pass, two fish on.')}),
    O('Fish a rod yourself for a bit','You hook a beauty and they tip $50 for the show.',(b,t)=>{t.q+=.06;fx(t,50,'Tip for the show');violate(t.notes,{p:.25,fine:250,what:'sport fishing while guiding clients',minor:true})},1)]}),
  extra_rod:(b)=>({t:'🎣 “Can we run extra rods?”',b:'<p>The clients want a couple of extra plugs out to cover more water. The rods in the water may not outnumber the clients aboard.</p>',o:[
    O('One rod per client',tv(b,{kids:'The kids don’t care how many rods are out.',first:'Beginners have their hands full with one rod.',meat:'Fewer fish, and the meat fishers notice.'},'Fewer fish, and a few sighs.'),(b,t)=>{t.happy-=tv(b,{kids:0,first:0,meat:5,trophy:4},3)}),
    O('Put out two extra rods','More water covered and a $40 tip.',(b,t)=>{t.q+=.05;fx(t,40,'Tip for the extra rods');violate(t.notes,{p:.3,fine:250,what:'more rods than clients on a guide vessel',minor:true})},1)]}),
  bait:(b)=>({t:'🥚 The silvers won’t commit',b:'<p>Fish are rolling, but they’re sniffing your lures and turning away. The boat next to you is back-bouncing cured roe. Below Skilak, through Aug 15, the emergency order allows <b>one unbaited, single-hook, artificial lure</b>.</p>',o:[
    O('Stick with single-hook lures',tv(b,{fly:'They’d rather swing flies anyway.',meat:'A slower bite, and they came for a full cooler.'},'Patience, and a slower bite.'),(b,t)=>{t.q-=.03;t.happy-=tv(b,{fly:-2,meat:5},3);if(hasT(b,'fly'))G(t).fly=(G(t).fly||0)+.2}),
    O('Switch to cured roe',hasT(b,'fly')?'Silvers love eggs. These clients think bait is cheating.':'Silvers love eggs: a full limit is worth a $70 tip.',(b,t)=>{t.q+=.12;if(hasT(b,'fly')){G(t).bait=1;t.happy-=8;t.notes.push('🪰 “Bait? We came to fly fish.” They fish the roe with their arms crossed.')}else fx(t,70,'Tip for the limit of silvers');violate(t.notes,{p:.35,fine:300,what:'using bait under the emergency order'})},1),
    O('Tie on a treble-hook spinner','More hookups and a $40 tip.',(b,t)=>{t.q+=.06;fx(t,40,'Tip for the hookups');violate(t.notes,{p:.25,fine:200,what:'fishing a treble hook under the emergency order',minor:true})},1)]}),
  sixpm:(b)=>({t:'🕕 5:40 PM, and the bite turns on',b:'<p>The tide pushes in fresh silvers and every rod bends at once. Guide-vessel fishing below Skilak is <b>6 AM to 6 PM</b> only through July 31.</p>',o:[
    O('Lines up at 6:00 sharp',tv(b,{kids:'The kids are fading anyway.',meat:'With fish biting? The meat fishers groan loudest.',trophy:'The big one could be the next cast. They groan.'},'Groans all around and a smaller tip.'),(b,t)=>{t.happy-=tv(b,{kids:0,meat:8,trophy:7,first:2},5)}),
    O('Fish till 6:30','Ride the bite: they tip $70.',(b,t)=>{t.q+=.1;fx(t,70,'Tip for the evening bite');violate(t.notes,{p:.4,fine:400,what:'guide-vessel fishing after 6 PM'})},1)]}),
  motor:(b)=>({t:'⚙️ The jet sucks up gravel',b:'<p>The jet intake grabs a mouthful of rocks on a shallow bar and the motor starts to cavitate.</p>',o:[
    O('Beach it and clear the intake','30 minutes lost and fewer fish.',(b,t)=>{t.q-=.04;lose(t,30);adj('boat',-5)}),
    O('Limp on','The impeller will hate you: boat −15.',(b,t)=>{t.happy-=2;adj('boat',-15)})]}),
  anchor:(b)=>({t:'⚓ The best seam',b:'<p>The fish are holding right in the middle of the drift channel. KRSMA rules: don’t anchor in a way that blocks the primary traffic or drift-fishing channel.</p>',o:[
    O('Anchor on the edge of the seam','Fewer bites.',(b,t)=>{t.q-=.02;t.happy-=2}),
    O('Drop anchor mid-channel','Right on the fish. Drift boats must go around. $30 tip.',(b,t)=>{t.q+=.05;fx(t,30,'Tip for the hot seam');violate(t.notes,{p:.3,fine:200,what:'anchoring in the drift channel',minor:true})},1)]}),
  combat:(b)=>({t:'🥊 Combat fishing',b:'<p>A bank angler wades in right below your clients (“low-holing”) and tangles three lines at once.</p>',o:[
    O('Share the water and untangle with a smile','The Kenai is everybody’s river.',(b,t)=>{t.happy+=2;adj('rep',1)}),
    O('Tell him off','Satisfying for about ten seconds.',(b,t)=>{adj('rep',-3);t.notes.push('📱 Someone filmed it. It’s on a Kenai fishing forum by lunch.')})]}),
  photo:(b)=>({t:'🌈 A 26-inch leopard rainbow',b:'<p>The fish of the trip. Upper Kenai rainbows are catch-and-release, and they’re best kept wet.</p>',o:[
    O('Photo with the fish in the water',tv(b,{photo:'The right way, and the light on the water is perfect.'},'The right way.'),(b,t)=>{t.happy+=tv(b,{photo:9},6);G(t).shot=1;G(t).big=1}),
    O('Drag it up on the gravel for a hero shot','Better light.',(b,t)=>{t.happy+=7;G(t).big=1;if(Math.random()<.3){adj('rep',-4);t.notes.push('📸 The gravel-bar photo gets shared, and the comments are brutal.')}})]}),
  bear:(b)=>({t:'🐻 Sow and two cubs',b:'<p>A brown bear sow and two cubs are working a sockeye carcass on the gravel bar ahead. Bear spray is on your hip.</p>',o:[
    O('Give them the bar and wait',tv(b,{photo:'40 minutes, and the photos of a lifetime.',kids:'40 minutes. The kids will never forget it.',meat:'40 minutes not fishing.'},'40 minutes. Unforgettable.'),(b,t)=>{t.q-=.04;t.happy+=tv(b,{photo:7,kids:5,meat:-2},3);G(t).shot=1;lose(t,40);S.stats.bear++;t.notes.push('🐻 You hold in an eddy and watch the cubs wrestle. Nobody speaks for ten minutes.')}),
    O('Drift past quietly mid-river','Calm and wide.',()=>{}),
    O('Beach close for photos','Closer is better, right?',(b,t)=>{if(Math.random()<.35){t.happy-=15;adj('rep',-5);adj('energy',-10);t.notes.push('🐻 The sow bluff-charges to the water’s edge. You row hard. Someone cries.')}else t.happy+=4})]}),
  flyonly:(b)=>({t:'🪰 Fly-fishing only',b:'<p>At the Russian River confluence one client wants to throw a spinner. This water is <b>fly-fishing only, June 11 to August 20</b>.</p>',o:[
    O('Hand him a fly rod',tv(b,{fly:'The rest of the boat cheers.',first:'A beginner with a fly rod: it will be a long morning.'},'He tangles it twice and sulks.'),(b,t)=>{t.happy+=tv(b,{fly:3,first:-6},-4)}),
    O('Let him spin','He’s paying, and he tips $30 extra.',(b,t)=>{fx(t,30,'Tip from the spin fisherman');violate(t.notes,{p:.3,fine:150,what:'spin fishing in fly-only water',minor:true})},1)]}),
  chop:(b)=>({t:'🔪 Cleaning the reds',b:'<p>The clients kept a few reds at the confluence. Carcasses draw bears to the bank. Take fish out whole, or fillet at the cleaning tables and <b>stop, chop and throw</b> the carcasses into deep, fast water.</p>',o:[
    O('Stop, chop and throw','Bear-smart, but it costs 20 minutes.',(b,t)=>{lose(t,20);S.stats.chop++}),
    O('Leave the carcasses on the bank','Saves 20 minutes.',(b,t)=>{adj('rep',-3);violate(t.notes,{p:.3,fine:200,what:'leaving fish waste on the bank',minor:true})},1)]}),
  tuewed:(b)=>({t:`⚓ It’s ${dayName(b.d)}`,b:`<p>In Area 3A this summer, charter anglers <b>can’t keep halibut on ${halDaysTxt()}</b> (early June to late August). The clients flew in for halibut.</p>`,o:[
    O('Target lingcod and rockfish, release the halibut',tv(b,{meat:'They came for halibut fillets. Hard faces, and a discount for the day.',photo:'The glaciers don’t care what you catch. A discount for the day.',kids:'The kids like rockfish just fine. A discount for the day.'},'Disappointed faces and a discount for the day.'),(b,t)=>{t.happy-=tv(b,{photo:3,first:3,kids:3,meat:12},8);fx(t,-Math.round(payOf(b)*.1),'Discount for the halibut-less day')}),
    O('Keep a couple of halibut anyway','Coolers full and a $120 tip.',(b,t)=>{t.happy+=6;t.kept+=2;fx(t,120,'Tip for the full coolers');violate(t.notes,{p:.45,fine:1500,what:'keeping halibut on a closed charter day',who:NOAA})},1)]}),
  size27:(b)=>({t:'📏 The second fish',b:`<p>A client’s second halibut tapes ${halSize()+7} inches. Charter rules this year: one fish of any size, and <b>the second must be ${halSize()} inches or less</b>.</p>`,o:[
    O('Release it',tv(b,{meat:'That’s a lot of fillets going back over the side.'},'A sad goodbye to a big fish.'),(b,t)=>{t.happy-=tv(b,{meat:7,trophy:1,photo:1},4)}),
    O('Keep it','It’s only 7 inches over. $60 tip.',(b,t)=>{t.kept++;fx(t,60,'Tip for the big halibut');violate(t.notes,{p:.35,fine:800,what:'keeping an oversize second halibut',who:NOAA})},1)]}),
  crew:(b)=>({t:'🧑‍✈️ The deckhand’s request',b:'<p>Your deckhand wants to keep a halibut for his freezer. On a charter, the captain and crew don’t keep halibut.</p>',o:[
    O('No','You buy him lunch to smooth it over.',(b,t)=>{fx(t,-25,'Lunch for the sulking deckhand')}),
    O('Sure, one fish','He fuels the boat for you: $40.',(b,t)=>{fx(t,40,'Deckhand covers the fuel');violate(t.notes,{p:.25,fine:500,what:'crew retaining halibut on a charter',minor:true,who:NOAA})},1)]}),
};
const POOL={reds:['king','snag','over','guide_fish','anchor','combat','motor','rescue','ownrods','trespass','hookhand','rival','friend','lostrod'],silver:['bait','king','extra_rod','guide_fish','motor','rescue','ownrods','hookhand','rival','friend','lostrod'],trout:['bear','photo','combat','guide_fish','rescue','trespass','hookhand','lostrod','scenic'],halibut:['size27','crew','whale','seasick','hookhand','friend','fog']};
// 1.13.0: judgment calls that come with the party (33-day.js): tried before the random pool
const partyDils=b=>[hasT(b,'kids')&&'boredkid',hasT(b,'photo')&&'scenic',hasT(b,'seasick')&&b.type==='halibut'&&'seasick',isCouple(b)&&'couple',isOld(b)&&'exhausted'].filter(Boolean);
// ---- how often a dilemma may come up ----
// No dilemma more than DIL_MAX times in one season (random picks and quirk beats alike; rule-forced ones like the closed halibut day are exempt),
// and the king dilemma shows up less when kings can't be kept: it's still the story of the Kenai, but not every other trip.
const DIL_MAX=2,KING_ODDS={closed:.3,cr:.55,open:1};
const dilN=k=>S.dil&&S.dil.s===seasonOf(day())?(S.dil.n[k]||0):0;
const dilUse=k=>{const s=seasonOf(day());if(!S.dil||S.dil.s!==s)S.dil={s,n:{}};S.dil.n[k]=(S.dil.n[k]||0)+1};
const dilOK=k=>dilN(k)<DIL_MAX&&(k!=='king'||Math.random()<KING_ODDS[kingRule()]);

// ---- the runner ----
function tripStart(b){
  if(noBoat()&&b.type!=='halibut'){say('🔧 The boat is out of service. Get a major repair at the shop, patch it or rent a loaner first.');return}
  const T=TRIPS[b.type],late=Math.max(0,tod()-T.start),t={id:b.id,late,boat0:S.boat,loan:loanerToday()&&b.type!=='halibut',q:0,happy:0,notes:[],step:0,steps:[],shore:false,nofish:0,kept:0,abort:false,x:[],lost:0};
  // 1.13.0: the day in stretches (33-day.js): bt is where you are and what has landed; g, what the party's goals have seen; nz, the day's luck
  if(!b.tr) b.tr=fitTraits(b);
  t.bt={k:0,K:BEATS[b.type].at.length,spot:0,tac:SPOTS[b.type][0].tac,segs:[],mv:[],ang:null,box:0,lunch:-1,early:false};t.g={};t.nz=Math.round((Math.random()-.5)*.24*1000)/1000;
  if(late){t.happy-=late/3;t.notes.push(`⏰ You rolled in ${late} minutes late. The ${b.who} noticed.`)}
  // tackle and boat condition shape the day before you even leave the dock
  if(S.gear<=0){t.happy-=3;t.notes.push('🪱 You’re out of tackle. The clients fish with whatever is left in the bottom of the box, and they notice.')}
  if(t.loan){t.happy-=6;t.notes.push('🤝 You run the trip on a borrowed rig. It is tired and the clients can tell.')}
  t.happy+=clamp(Math.round((S.boat-65)/7),-3,4);   // a well-kept boat pleases clients; a tired one shows
  hungerTrip(t);                                           // 31-supplies.js: a hungry guide is a grumpy guide
  if(!t.loan&&S.boat<70&&b.type!=='halibut'&&Math.random()<(70-S.boat)/90){
    const m=60+Math.floor(Math.random()*60);lose(t,m);t.happy-=12;fx(t,-Math.round(payOf(b)*.15),'Breakdown credit');fx(t,-rp(80),'Roadside repair');adj('boat',8);
    t.notes.push(`🔧 Worn-out gear lets you down: ${b.type==='trout'?'an oarlock snaps and the trailer bearing howls':'the jet sled quits on the way out'} and you lose ${m} minutes. You credit the ${b.who} 15% of the fare and pay ${$(rp(80))} for a quick fix. Service the boats at the shop.`);
  }
  if(fuelShort(b)) t.steps.push('fuel');                 // 25-fuel.js
  const iss=issueOf(b);if(iss) t.steps.push('issue_'+iss);
  if(b.type==='reds'&&b.n===5) t.steps.push('five');
  if(b.quirk.includes('nolicense')) t.steps.push('license');
  if(S.cred.fa<day()) t.steps.push('expired');
  const golook=b.type==='halibut'&&forecastOf(b.d).fc>=11&&!t.steps.some(x=>x.startsWith('issue_'));
  if(golook) t.steps.push('golook');                     // 33-day.js: the go/no-go weather call on the dock
  t.steps.push('pack','spot');                            // 31-supplies.js: pack the cooler, then pick the spot
  regTripStart(b,t);                                      // 30-stories.js: returning parties remember last time
  memTripStart(b,t);                                      // 37-memories.js: the mentor climbs aboard (38-mentor.js), a lodge guest's referral fee
  if(b.tr&&b.tr.length) t.notes.push(`🎯 The ${b.who}: ${traitTxt(b.tr,true)}.`);
  const want=2-(golook?1:0),beats=[],q=b.quirk;
  if(b.arc==='garza'&&S.arcs.garza.st>=1&&S.arcs.garza.st<=3) beats.push('arc_garza');
  if(q.includes('drinker')&&dilOK('beer')) beats.push('beer');
  if(q.includes('kingfan')&&(b.type==='reds'||b.type==='silver')&&dilN('king')<DIL_MAX) beats.push('king');
  if(q.includes('photo')&&b.type==='trout'&&dilOK('photo')) beats.push('photo');
  if(q.includes('kid')&&b.type!=='halibut'&&dilOK('pfd')) beats.push('pfd');
  if(b.type==='halibut'&&halClosed(b.d)) beats.push('tuewed');
  if(S.boat<25&&!t.loan&&TRIPS[b.type].fuel){beats.push('motor');t.q-=.08;t.notes.push('🔧 The neglected jet sled runs rough all day. Service the boats at the shop.')}
  if(q.includes('promised')){t.happy-=15;t.notes.push('👑 They were “promised” a shot at a king. There was never going to be one: the fishery is closed.')}
  const pd=partyDils(b).filter(x=>!beats.includes(x)&&dilOK(x));
  while(beats.length<want&&pd.length) beats.push(pd.splice(Math.floor(Math.random()*pd.length),1)[0]);
  const pool=POOL[b.type].filter(x=>!beats.includes(x)&&!(x==='bait'&&!noBait())&&!(x==='ownrods'&&!noBait())&&!(x==='size27'&&halClosed(b.d))&&dilOK(x));
  while(beats.length<want&&pool.length) beats.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  const dl=beats.slice(0,Math.max(want,beats.length)),K=t.bt.K,slots=Array.from({length:K},()=>[]);
  dl.forEach(k=>{if(k!=='arc_garza')dilUse(k)});
  // the dilemmas fall between the beats of the day: early and late, so the day turns
  dl.forEach((k,i)=>slots[Math.min(K-1,Math.round(i*K/Math.max(1,dl.length)))].push(k));
  slots.forEach((sl,i)=>{if(i>0)t.steps.push('beat');t.steps.push(...sl)});
  if(b.type==='silver') t.steps.push('sixpm');
  S.trip=t;sfx('whoosh');tripNext();
}
// ---- one pop-up per trip ----
// By default a trip is ONE bottom sheet: the decisions (the cooler and the spot together, then each dilemma) and the result swap in place
// (modalSwap, 02-kit.js) instead of opening a new pop-up each time. Settings → "Show every trip step" brings back one pop-up per step.
// Every decision keeps its options and its legal/illegal flags; only the extra sheets are gone.
let PACK=null;                                   // the cooler choices shown with the spot (window.packSel picks one)
window.packSel=i=>{if(!PACK||!PACK.o[i])return;PACK.sel=i;document.querySelectorAll('#mbg .packopt').forEach((e,k)=>{e.classList.toggle('on',k===i);e.setAttribute('aria-pressed',k===i?'true':'false')})};
window.tripPack=()=>PACK;
function packHTML(pv){
  return `<div class="packbox"><b>🧺 The cooler</b>${pv.b}<div role="group" aria-label="What to pack">${pv.o.map((o,i)=>`<button type="button" class="packopt${i===0?' on':''}" aria-pressed="${i===0}" onclick="packSel(${i})"><b>${o.l}</b><span>${o.s}</span></button>`).join('')}</div></div>`;
}
function tripNext(){
  const t=S.trip;if(!t) return;
  const b=bk(t.id);if(!b||b.status!=='booked'){S.trip=null;return}
  if(t.step>=t.steps.length) return tripEnd(b,t);
  const key=t.steps[t.step],f=STEP[key];if(!f){t.step++;return tripNext()}
  const sheet=!prefs().tripSteps,T=TRIPS[b.type];
  const packed=sheet&&key==='pack'&&t.steps[t.step+1]==='spot'&&STEP.spot;   // the cooler rides along with the spot choice
  const pv=packed?f(b,t):null,v=packed?STEP.spot(b,t):f(b,t);
  PACK=packed?{o:pv.o,sel:0}:null;window.TRIPV=v;
  const opts=v.o.map((o,k)=>({o,k}));
  if(!v.fixed)for(let i=opts.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[opts[i],opts[j]]=[opts[j],opts[i]]}   // shuffled every showing
  const hot=v.o.some(o=>o.legal===false)&&heat()>0?`<p class="small-note heat-note">🚔 You’ve broken ${heat()===1?'a rule':`${heat()} rules`} this season. The troopers and the other guides know your boat now: the odds of getting caught go up with every one.</p>`:'';
  const left=t.steps.slice(t.step).filter(x=>x!=='pack').length,done=t.steps.slice(0,t.step).filter(x=>x!=='pack').length;
  const prog=sheet?` · ${done+1} of ${done+left}`:'';
  const open=sheet&&!t.shown?`<p class="small-note" style="margin:0 0 6px">You load the ${b.who} into the ${b.type==='trout'?'drift boat':b.type==='halibut'?'charter boat':'jet sled'} at ${L[T.loc].name} and push off at ${fmt(S.t)}.</p>`:'';
  t.shown=true;
  const mm=memSheet(b,t,key);                              // 37-memories.js: a catch moment on top, the mentor's line below
  modalSwap(v.t,`<p class="small-note" style="color:var(--mute);margin:0 0 6px">${T.ic} ${T.n} · ${b.who}${prog}</p>${open}${mm.top}${v.b}${packed?packHTML(pv):''}${hot}${mm.foot}`,opts.map(({o,k})=>({l:o.l,s:o.s,legal:o.legal!==false,dis:!!o.dis,np:true,k,stay:sheet,fn:()=>{
    const tt=S.trip;if(!tt) return;const bb=bk(tt.id);if(!bb) {S.trip=null;return}
    if(packed){const po=pv.o[PACK?PACK.sel:0];po&&po.fn&&po.fn(bb,tt);tt.step++;PACK=null}
    const q0=tt.q;o.fn&&o.fn(bb,tt);
    // a dilemma's effect on the catch counts for the whole day, even when it comes up late in it (the stretches already landed can't change)
    if(tt.bt&&key!=='beat'&&key!=='spot'&&key!=='pack'&&tt.q!==q0){const A=BEATS[bb.type].at,T2=TRIPS[bb.type],W=A.slice(tt.bt.k).reduce((a,x,i)=>a+((tt.bt.k+i+1<A.length?A[tt.bt.k+i+1]:T2.len)-x),0)/T2.len;if(W>0&&W<.999)tt.q+=(tt.q-q0)*(Math.min(3,1/W)-1)}
    if(S.trip&&!tt.abort){tt.step++;tripNext()}}})));
}
// index of the first legal button in the open modal (0 when the buttons aren't dilemma options); for tests and bots
window.legalBtn=()=>{const i=MB.findIndex(b=>b.legal===true&&!b.dis);return i<0?0:i};
function tripCancel(b,note){b.status='cancelled';S.stats.cancelled++;S.trip=null;if(note)say(note)}
function tripEnd(b,t){
  const T=TRIPS[b.type],d=day(),r=Math.random;
  const BT=t.bt&&t.bt.segs?t.bt:null;let towR=null;      // BT: a 1.13.0 trip run in stretches (33-day.js); without it, the old one-number day
  let q=BT?.5:.5+t.q+runFactor(b.type)+(WX[S.wx[d]||'sun']||WX.sun).q+(S.prep===d?.08:0)+(scoutedFor(b.type,d)?.05:0)
    +upQ(b.type)+campQ()+(S.gear>0?0:-.15)+(S.boat<40&&!t.loan?-.1:0)+(S.energy<30?-.1:0)+skillQ()+(r()-.5)*.24;
  q=clamp(q,.05,1);
  // fuel: burn from the tank; run dry and the trip ends with a Coast Guard tow
  const ft=tripFuel(b);let towed=false;
  if(ft){const gal=Math.round((ft.gal+(t.fuelx||0)*(ft.tank==='fuel'?fuelMult():1)+(r()-.3)*3*(ft.tank==='fuel'?fuelMult():1))*(1+Math.max(0,wxOf(d).wind-12)/40)*10)/10;
    if(S[ft.tank]>=gal) S[ft.tank]=Math.round((S[ft.tank]-gal)*10)/10;
    else{towR=Math.max(.2,S[ft.tank]/gal);q*=towR;t.happy-=25;towed=true;if(ft.tank==='fuel')towIn(t.notes);else{S.hfuel=0;S.stats.tows=(S.stats.tows||0)+1;money(-HARBOR_TOW);adj('rep',-4);const tp=fillUp('hfuel','homer',TOW_FILL*3);t.notes.push('🛟 The charter boat runs dry off Anchor Point. The Coast Guard tows you into Homer Harbor and the harbormaster brings you to the fuel dock: '+$(HARBOR_TOW)+'.'+(tp?` You fill the tank: ${tp.gal.toFixed(0)} gallons, ${$(Math.round(tp.cost))}.`:''))}}}
  const fishers=Math.max(0,b.n-t.nofish);let fish=0,frac=0,line='',limits=0,C=null;
  if(BT){C=beatCatch(b,t,towR);fish=C.fish;frac=C.frac;limits=C.limits;line=C.line;
    if(bagged(b)&&fishers&&limits===fishers){S.stats.limits++;t.happy+=5}
    if(b.type==='halibut'&&!halClosed(b.d))S.stats.halibut+=fish}
  else if(b.type==='reds'||b.type==='silver'){
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
  homeProcessing(b,fish,t);                              // 32-home.js: the fish processing station
  // ---- what the day was worth ----
  // The booked fare is the base. A good day (fish, happy clients, a clean boat and tackle) earns bigger tips and word of mouth;
  // a bad one (skunked, out of tackle, a breakdown, grumpy clients) means a partial refund and a bad review.
  const goal=BT?goalOf(b,t,Object.assign({},C,{fish:fish-t.kept})):{h:0,good:[],bad:[]};   // 33-day.js: what the party came for
  const happy=45+frac*45+t.happy+goal.h+upH(b.type)+DF().mood-RATE_MOOD*rateSteps();
  const fare=towed?Math.round(payOf(b)*.5):payOf(b),base=b.type==='halibut'&&!S.up.chp?1200:fare;
  const tip=Math.round(base*clamp((happy-60)/100,0,.3)*memTipK());   // 39-stars.js: a top-rated guide's parties tip more
  const skunk=fishers>0&&fish-t.kept<=0&&b.type!=='trout'&&!(b.type==='halibut'&&halClosed(b.d));
  const refundPct=clamp((42-happy)/200,0,.25)+(skunk?.05:0),refund=Math.round(fare*refundPct);
  const xs=(t.x||[]),xnet=xs.reduce((a,[,v])=>a+v,0),xpos=xs.reduce((a,[,v])=>a+Math.max(0,v),0),xneg=xs.reduce((a,[,v])=>a+Math.min(0,v),0);
  let dRep=clamp(Math.round((happy-50)/8),-6,8);const review=happy<35;if(review) dRep-=2;
  S.wom=(S.wom||0)+(happy>=96?2:happy>=88?1:happy<30?-2:happy<40?-1:0);
  const costs=T.loc==='lower'&&!S.up.dock?LAUNCH_FEE:0;
  if(r()<.07&&b.type!=='halibut'){money(-165);S.stats.spent+=165;t.notes.push('🎣 A client high-sticks a rod into the gunwale. Snap. $165 for a new rod and reel.')}
  S.gear=Math.max(0,S.gear-1);
  const lost=t.lost||0,short=BT&&C.fished<T.len?T.len-C.fished-30:0;   // called it early: back sooner, a little less tired
  pass((towed?T.len+120:T.len-sledTimeSaved(b.type))+lost-Math.max(0,short));if(short>0)adj('energy',Math.round(T.energy*short/T.len*.6));if(towed&&ft.tank==='fuel')S.loc='harbor';adj('energy',-T.energy+(sledTimeSaved(b.type)?3:0)-Math.round(lost/20));if(!t.loan)adj('boat',-Math.round((3+Math.floor(r()*4))*(S.up.motor?.5:1)*DF().wear));adj('rep',dRep);
  if(noBoat()&&b.type!=='halibut')t.notes.push('🔧 The boat is out of service: you can’t launch again until a major repair, an emergency patch or a loaner.');
  else if(t.boat0!=null&&!t.loan)boatWatch(t.boat0);
  money(fare-refund+tip+xnet-costs);
  const st=S.stats;st.hapSum=(st.hapSum||0)+clamp(happy-DF().mood+RATE_MOOD*rateSteps()*.7,0,110);st.hapN=(st.hapN||0)+1;st.tipSum=(st.tipSum||0)+tip;   // the season’s quality (24-career, 25-fuel): relative to the difficulty’s client mood
  st.trips++;st.clients+=b.n;st.fish+=fish;st.earned+=fare-refund;st.tips+=tip+xpos;st.spent+=costs-xneg;
  S.unlogged++;S.skill++;
  const net=fare-refund+tip+xnet-costs;
  const rv=addReview(b,t,happy,C||{fish:fish-t.kept,frac,limits,fishers},goal);  // 33-day.js: their review, in their words
  b.status='done';b.out={happy:Math.round(happy),fish,line,fare,refund,tip,net,stars:rv.stars};S.trip=null;
  storyAfterTrip(b,happy,t.notes);                      // 30-stories.js: returning parties, story arcs
  const mem=memDock(b,t,{C,rv,happy,fish});              // 37-memories.js: records, firsts, the catch card, the rating's milestones, the mentor's last word
  say(`${T.ic} ${T.n} with the ${b.who}: ${line}. Paid ${$(fare-refund)} + ${$(tip+xpos)} in tips.`);
  const mood=happy>=82?'😁 They’re already asking about next July. Word of mouth will bring you more bookings.':happy>=65?'🙂 Solid day. Handshakes at the trailer.':happy>=45?'😐 Polite thanks, small tip.':review?'😠 Tight-lipped goodbyes and a one-star review. Word gets around the Kenai.':'😕 They leave a little deflated.';
  const row=(l,v)=>`<br>${l}: <b>${v>=0?'':'−'}${$(Math.abs(v))}</b>`;
  const why=[];if(skunk)why.push('skunked');if(S.gear<=0&&t.notes.some(n=>n.startsWith('🪱')))why.push('no tackle');if(refund&&happy<42)why.push('unhappy clients');
  modalSwap(`${T.ic} Back at the dock`,`${mem.top}${t.notes.map(n=>`<p>${n}</p>`).join('')}
    <p><b>Catch:</b> ${line}${t.kept?` (${t.kept} kept on the sly)`:''}${lost?` · ${lost} minutes lost`:''}</p>
    ${towed?'<p>🛟 <b>Towed in.</b> Half the fare refunded.</p>':''}<p><b>The pay:</b>${row(`Booked fare${b.type==='halibut'&&!S.up.chp?' (day rate)':''}`,fare)}${refund?row(`Refund${why.length?` (${why.join(', ')})`:''}`,-refund):''}${row('Tip',tip)}${xs.map(([l,v])=>row(l,v)).join('')}${costs?row('Launch fee',-costs):''}<br><b>Net: ${net<0?'−':''}${$(Math.abs(net))}</b></p>
    <p>${mood} Rep ${dRep>=0?'+':'−'}${Math.abs(dRep)}.</p>${reviewHTML(rv,b)}${mem.html}
    <p style="font-size:13px;color:var(--mute)">📓 Log it in your ADF&amp;G logbook before bed.</p>`,[{l:'Head in',fn:()=>{}}].concat(b.card?[{l:'Hand them your card and ask them back',s:'10 minutes. After a day like this, most say yes.',fn:()=>regCard(b)}]:[]));
  sfx(happy>=50?'good':'bad');
}
