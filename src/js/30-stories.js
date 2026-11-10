// ============================================================
//  GUIDE MASTER, part 9: more to find on the river.
//  1. Returning parties: a party that has a great day may become a regular. It rebooks next July in proportion to how
//     the last trip went and remembers it when it comes back (S.regs).
//  2. Six more dilemmas from real Kenai guiding (life jackets for kids, whales off Homer, a capsized paddler, a client's own
//     treble hooks, posted private banks, seasick charter clients). Same rules as the others: the legal option costs something,
//     the rule-breaking one pays cash if nobody's watching.
//  3. Three story arcs that run across seasons (S.arcs): a rival guide, a returning family and a seat on the local fish and game
//     advisory committee.
//  Rules cited here are real: Alaska requires kids 12 and under to wear a life jacket on boats under 26 feet while underway;
//  vessels are to stay 100 yards from humpback whales in Alaska waters; riverbed below the ordinary high-water line is state land
//  while the uplands are often private; local advisory committees send proposals to the Alaska Board of Fisheries.
// ============================================================

// ---- returning parties ----
const ORD=['','first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'];
function regAfterTrip(b,happy,notes){
  const h=Math.round(happy),s=seasonOf(day());let g=S.regs.find(x=>x.who===b.who);
  const arc=b.arc==='garza';
  if(g){
    g.last={h,s};g.trips=(g.trips||1)+1;
    if(h>=88) notes.push(`⭐ The ${b.who} are already talking about July ${yearOf(day())+1}.`);
  }else{
    const join=arc?h>=60:(h>=75&&S.regs.length<10&&Math.random()<.4);
    if(join){S.regs.push({who:b.who,from:b.from,res:!!b.res,type:b.type==='halibut'?'reds':b.type,n:Math.min(b.n,b.type==='trout'?3:b.type==='silver'?4:5),trips:1,last:{h,s},arc:arc?'garza':null});
      if(arc)S.arcs.garza.st=1;
      notes.push(`⭐ The ${b.who} slip you a card with their number: “Same time next July?” If you treat them right, they will be back.`)}
    else if(arc)S.arcs.garza.st=-1;
  }
}
// next season's bookings from the regulars; returns report lines for the off-season
function regsRebook(base,r){
  const lines=[];
  S.regs.slice().forEach(g=>{
    const h=g.last?g.last.h:0,p=h>=88?.95:h>=75?.85:h>=60?.55:h>=45?.25:0,type=g.type;
    if(r()<p){
      for(let k=0;k<12;k++){
        const i=1+Math.floor(r()*13),w=i%7;
        if(w<1||w>5||(type==='silver'&&i<7)) continue;
        const d=base+i;if(conflicts(d,type)) continue;
        const n=Math.min(g.n+(h>=88&&g.n<(type==='trout'?3:type==='silver'?4:5)?1:0),type==='trout'?3:type==='silver'?4:5);
        addBooking({d,type,n,who:g.who,from:g.from,res:g.res,quirk:[],reg:true,arc:g.arc||undefined});g.miss=0;
        lines.push(`⭐ The ${g.who} (${g.from}) are back for their ${ORD[Math.min(10,(g.trips||1)+1)]} July${h>=88?': last time was a five-star day':''}.`);break}
    }else{
      g.miss=(g.miss||0)+1;
      if(h<45||g.miss>=2){S.regs=S.regs.filter(x=>x!==g);if(g.arc==='garza')S.arcs.garza.st=-1;lines.push(`🪧 The ${g.who} didn’t rebook${h<45?': last year’s trip left a bad taste':''}.`)}
    }
  });
  return lines;
}
// at launch: they remember last time
function regTripStart(b,t){
  const g=b.reg&&S.regs.find(x=>x.who===b.who);if(!g||!g.last) return;
  const h=g.last.h,nth=ORD[Math.min(10,(g.trips||1)+1)];
  if(h>=88){t.happy+=5;t.notes.push(`⭐ The ${b.who} are back for their ${nth} July. They’ve talked about last year’s day all winter and trust you with this one.`)}
  else if(h>=75){t.happy+=3;t.notes.push(`⭐ The ${b.who} are back for their ${nth} July and glad to see you.`)}
  else if(h<62){t.happy-=4;t.notes.push(`😬 The ${b.who} came back, but they remember last year’s rough day. They’re watching.`)}
}
// after a trip: returning parties and arcs
function storyAfterTrip(b,happy,notes){
  regAfterTrip(b,happy,notes);
  if(b.arc==='garza'&&b.reg){const A=S.arcs.garza;if(A.st>=1&&A.st<=3){A.st++;if(A.st===4)say('👨‍👩‍👦 The Garzas’ fourth July. Some families become part of the river.')}}
}

// ---- six more dilemmas ----
Object.assign(STEP,{
  pfd:(b)=>({t:'🦺 The life jacket',b:'<p>The 9-year-old in the party is hot and fussing about the life jacket. Alaska requires children 12 and under to wear one on a boat under 26 feet while it is underway.</p>',o:[
    O('Keep it on; pull in for a snack and a break','10 minutes and a sulky kid.',(b,t)=>{lose(t,10);t.happy-=3}),
    O('Loosen the straps a notch and keep going','Still on, still legal, and a little grumbling.',(b,t)=>{t.happy-=2}),
    O('Let him take it off “just for a minute”','His dad slips you $40 and the kid beams.',(b,t)=>{fx(t,40,'Tip from the grateful dad');violate(t.notes,{p:.25,fine:200,what:'a child without a life jacket on a boat under 26 feet',minor:true})},1)]}),
  whale:(b)=>({t:'🐋 A humpback off the bow',b:'<p>A humpback blows a hundred yards off the bow and the whole boat goes quiet. In Alaska waters vessels are to stay <b>100 yards</b> from humpback whales.</p>',o:[
    O('Idle down and let it come to you','You drift for 20 minutes and nobody minds.',(b,t)=>{lose(t,20);t.q-=.03;t.happy+=6}),
    O('Motor in for the photo','Everybody has their phones out and a client tips $80.',(b,t)=>{t.happy+=6;fx(t,80,'Tip for the whale photos');violate(t.notes,{p:.3,fine:1000,what:'approaching a humpback whale closer than 100 yards',who:NOAA})},1)]}),
  rescue:(b)=>({t:'🛟 A capsized paddler',b:'<p>Rounding the bend you see a rafter’s dry bag floating by, then the raft itself, upside down, with its owner clinging to a root wad.</p>',o:[
    O('Drop everything, pull him aboard and run him to shore','40 minutes lost and a little water in the boat.',(b,t)=>{lose(t,40);adj('boat',-2);adj('rep',4);t.happy+=3;t.notes.push('🛟 You pull him in shivering, wrap him in a rain jacket and get him to the ramp. By evening the story is all over the Kenai.')}),
    O('Call it in on VHF 16 and stand by','15 minutes and a lot of awkward silence.',(b,t)=>{lose(t,15);adj('rep',1);t.happy-=2;t.notes.push('📻 The Coast Guard and a local sled get there in minutes. He’s fine.')})]}),
  ownrods:(b)=>({t:'🎣 “We brought our own spinners”',b:`<p>The ${b.who} unpack a tackle bag of big-box-store spinners, every one with treble hooks. Below Skilak through Aug 15 the emergency order allows <b>one unbaited, single-hook artificial lure</b>.</p>`,o:[
    O('Swap in single-hook lures from your box','15 minutes and some muttering.',(b,t)=>{lose(t,15);t.q-=.02;t.happy-=2}),
    O('Let them fish what they brought','More hookups and a $35 tip.',(b,t)=>{t.q+=.04;fx(t,35,'Tip for the hookups');violate(t.notes,{p:.25,fine:200,what:'fishing treble hooks under the emergency order',minor:true})},1)]}),
  trespass:(b)=>({t:'🚧 The perfect gravel bar',b:'<p>The best-looking bank is a mowed lawn above the high-water line, with a “Private property” sign. The riverbed below the ordinary high-water line is state land, but the uplands are somebody’s, and public access is limited to the designated spots.</p>',o:[
    O('Stay below the high-water line or use the public access','A longer walk and a smaller bite.',(b,t)=>{lose(t,15);t.q-=.02}),
    O('Land on the lawn; the owner’s not home','A great spot and a $40 tip.',(b,t)=>{t.q+=.04;fx(t,40,'Tip for the secret spot');violate(t.notes,{p:.2,fine:150,what:'trespassing on a posted private bank',minor:true})},1)]}),
  seasick:(b)=>({t:'🤢 Green faces on deck',b:'<p>The swell is up and three of the passengers are hanging over the rail. The tide is running against a rising wind.</p>',o:[
    O('Run for the lee of the Spit and fish the slack','40 minutes lost and fewer fish.',(b,t)=>{lose(t,40);t.q-=.03;t.happy-=2}),
    O('Push on: they’ll feel better when a fish bites','They don’t, and they say so.',(b,t)=>{t.happy-=9;adj('energy',-4)})]}),
  arc_garza:(b)=>{const st=S.arcs.garza.st;
    if(st===1) return {t:'👦 Mateo’s big fish',b:`<p>The Garzas are back for their second July. Mateo, now 11, has a bent rod and a look of fierce concentration. “I’ll do it myself!”</p>`,o:[
      O('Coach him through it, hand off the rod when he asks','It takes 20 minutes, and you’ll remember his face.',(b,t)=>{lose(t,20);t.happy+=8;S.skill++;t.notes.push('🎣 Mateo lands his first red on his own. His mother cries a little. His father films the whole thing.')}),
      O('Take the rod and net it quick','The fish is in the boat, and he is a little crushed.',(b,t)=>{t.happy-=3;t.notes.push('🎣 The fish comes in fast. Mateo says it’s fine.')})]};
    if(st===2) return {t:'🧓 Grandpa Ray’s first July',b:'<p>The Garzas have brought Mateo’s grandfather, Ray, 78, on his first Alaska trip. He wants to stand in the bow “like the guides on TV.”</p>',o:[
      O('Give him the seat with the armrests and a short rod','Safe, slower, and he pretends not to mind.',(b,t)=>{t.happy-=2;t.notes.push('🧓 Ray hooks a big red from the cushioned seat and tells everyone at the dock about it for twenty minutes.')}),
      O('Let him stand in the bow, life jacket buckled, hand on the rail','A gamble with a great payoff, and a fall would be bad.',(b,t)=>{if(Math.random()<.25){t.happy-=10;adj('rep',-3);adj('boat',-3);t.notes.push('🌊 A wake from a passing boat rocks the bow and Ray sits down hard. He’s fine, but the family is shaken.')}else{t.happy+=9;t.notes.push('🧓 Ray stands in the bow with his chin up. The whole boat cheers when the fish takes.')}})]};
    return {t:'🧑 “Can I work for you?”',b:'<p>Mateo, 14 now, has asked his parents to let him spend next summer guiding. He wants to know if you’ll teach him. The Garzas look on, hoping.</p>',o:[
      O('Tell him to finish school, then take the Guide Academy and the USCG license at 18-plus','Honest advice and a smaller tip today.',(b,t)=>{t.happy+=2;adj('rep',3);S.skill++;t.notes.push('🎓 “Come see me when you’ve got the paperwork,” you say. Mateo nods very seriously.')}),
      O('Let him run the sled for a stretch “to see what it’s like”','He grins ear to ear and his dad tips $100.',(b,t)=>{t.happy+=8;fx(t,100,'Tip from the delighted dad');violate(t.notes,{p:.3,fine:600,what:'an unlicensed person operating a guide vessel'})},1)]};
  },
});

// ---- story arcs ----
// One arc scene at most per morning, and each arc at most once a season, from the second season on.
const arcFree=a=>!S.winter&&S.arcs.day!==day()&&seasonOf(day())>=1&&sday(day())>=2&&sday(day())<=11&&a.s!==seasonOf(day());
const arcDone=a=>{a.s=seasonOf(day());S.arcs.day=day()};
defEvent({id:'arc_rival',hook:'wake',tile:['🚤','A rival on your seam','info'],chance:.4,cond:()=>{const A=S.arcs.rival;return arcFree(A)&&(A.st===0&&S.rep>=55||A.st===2||A.st===3)},
  run:()=>{const A=S.arcs.rival;arcDone(A);
    if(A.st===0) return modal('🚤 A new outfit on the river',`<p>A new outfit, Voss Guide Service, has put a second sled in at Centennial and its owner, <b>Dale Voss</b>, has started parking on the seam you’ve worked for years. He tips his cap. He doesn’t move.</p>`,[
      {l:'Wave, share the water and trade spot reports',s:'Rep +1.',fn:()=>{A.st=2;A.mood=1;adj('rep',1);say('🤝 You nod, then wave him in. By lunch you’re trading notes over the VHF.')}},
      {l:'Hold your seam and make him earn it',s:'Rep −2. You were here first.',fn:()=>{A.st=2;A.mood=-1;adj('rep',-2);say('😤 You nose in and fish the seam hard. Dale says nothing, and you can feel it.')}}]);
    if(A.st===2&&A.mood>0) return modal('📞 Dale calls',`<p>Dale Voss is overbooked this week and has a party he can’t take. “Thought of you first. You’d do the same.”</p>`,[
      {l:'Take the party',s:'A free booking, and he’ll owe you.',fn:()=>{A.st=3;adj('rep',1);let dd=null;for(let d=seasonFirst()+3;d<seasonFirst()+SEASON&&dd==null;d++)if(!isSunMon(d)&&!conflicts(d,'reds')&&d>day())dd=d;
        if(dd!=null){addBooking({d:dd,type:'reds',n:4,who:'party Dale sent over',from:'Oregon',res:false,quirk:[]});say(`📅 Booked: a party Dale sent over, ${dlong(dd)}.`)}else say('📞 You’d like to, but your calendar’s full.')}},
      {l:'Pass politely',s:'Keep your calendar clear.',fn:()=>{A.st=3;say('📞 You tell Dale thanks, but no. He says he understands.')}}]);
    if(A.st===2) return modal('📱 A thread about you',`<p>Somebody forwards you a river-forum thread: Voss Guide Service is telling people your seam is overcrowded and your prices are high.</p>`,[
      {l:'Let your logbook speak for itself',s:'Rep −1 and a tight jaw.',fn:()=>{A.st=3;adj('rep',-1);say('📓 You keep fishing and keep your mouth shut. It’s not easy.')}},
      {l:'Reply politely with your own season’s numbers',s:'30 minutes. Energy −4, rep +1.',fn:()=>{A.st=3;pass(30);adj('energy',-4);adj('rep',1);say('📱 You post your trip counts and your last three reviews. No drama. It works, mostly.')}}]);
    // st 3: the finale, a call for help
    return modal('🛟 Dale’s sled has quit',`<p>Dale Voss’s sled has quit in the middle of the channel with a full party aboard. His radio crackles: “Anybody close?” You are.</p>`,[
      {l:'Tow him in',s:'Energy −8, boat −3, rep +4. Whatever you two were, you’re something else now.',fn:()=>{A.st=4;A.ally=true;adj('energy',-8);adj('boat',-3);adj('rep',4);say('🛟 You throw him a line and tow the whole rig to the ramp. Dale shakes your hand with both of his. “I owe you one.”')}},
      {l:'Radio the Coast Guard and keep moving',s:'Quick and cold.',fn:()=>{A.st=4;say('📻 You relay his call and keep your clients on the water. Dale gets in fine. He doesn’t wave.')}}]);
  }});
defEvent({id:'arc_board',hook:'wake',tile:['🏛️','A seat at the table','info'],chance:.35,cond:()=>{const A=S.arcs.board;return arcFree(A)&&(A.st===0&&S.rep>=70||A.st===1||A.st===2&&!todays(day()).length)},   // the hearing is a daytime, three-hour trip to the Board: it only comes on a day with no trips booked, so it never costs you a no-show
  run:()=>{const A=S.arcs.board;arcDone(A);
    if(A.st===0) return modal('🏛️ A seat on the advisory committee',`<p>The Kenai/Soldotna Fish and Game Advisory Committee has an open seat and somebody put your name forward. Advisory committees take local input and send proposals to the Alaska Board of Fisheries. The evening meetings are long.</p>`,[
      {l:'Take the seat',s:'Energy −8, skill +1.',fn:()=>{A.st=1;adj('energy',-8);S.skill++;say('🏛️ You’re sworn in at the Soldotna sportsmen’s hall. The coffee is terrible and the room is full of people who care.')}},
      {l:'Decline politely',s:'Nobody will ask again.',fn:()=>{A.st=-1;say('🏛️ You thank them and say you’re too busy. They understand. They also don’t ask again.')}}]);
    if(A.st===1) return modal('🏛️ The committee splits',`<p>The committee is split on a proposal to the Board of Fisheries about the late-run sockeye escapement goal. Some members want a more cautious goal for the river, others want more room for harvest. You hold a vote.</p>`,[
      {l:'Back the more cautious goal',s:'Rep +3. A few guides grumble.',fn:()=>{A.st=2;adj('rep',3);S.wom=(S.wom||0)-1;say('🗳️ You vote with the biologists’ cautious numbers. Some guides take it personally. Many more thank you.')}},
      {l:'Back more room for harvest',s:'Rep −2, but the guides’ association sends $250.',fn:()=>{A.st=2;adj('rep',-2);money(250);say('🗳️ You side with the harvest. The association sends a thank-you check, and a few biologists stop returning your calls.')}},
      {l:'Abstain',s:'Nothing gained, nothing lost.',fn:()=>{A.st=2;say('🗳️ You abstain. Nobody is thrilled.')}}]);
    return modal('🏛️ Board of Fisheries meeting',`<p>The Board of Fisheries meets and your committee’s proposal is up. They want somebody from the river to testify. You have a free day.</p>`,[
      {l:'Testify with your logbook data',s:'Three hours and $120 for the trip (a day with no trips booked). Rep +5, skill +2.',fn:()=>{A.st=3;pass(180);money(-120);S.stats.spent+=120;adj('rep',5);S.skill+=2;say('🎤 Three minutes at the microphone, your own numbers on the screen. Afterward a biologist asks for a copy.')}},
      {l:'Send a written comment',s:'Rep +1.',fn:()=>{A.st=3;adj('rep',1);say('📄 You send your comment by email. It goes into the record.')}}]);
  }});
