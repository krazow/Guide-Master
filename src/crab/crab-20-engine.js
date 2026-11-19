// ============================================================
//  CRAB, part 2: the engine. Pure functions of a ticket (and a random source) that return reports, and the deckhand job's
//  little state machine. Nothing here touches a screen.
//    Crab.newState() / normState(x) / normTicket(t)
//    Crab.prep(ticket, {rand})            this year's openings rolled into the state (idempotent): returns the state
//    Crab.potOptions(ticket)              the summer choices at Homer: set the pot, pull it, or deal with crab in the cooler
//    Crab.setPot / pullPot(ticket, {rand}) → report;  Crab.useCrab(ticket, 'freezer' | 'feed') → report
//    Crab.winterOptions(ticket)           the winter choices: buy a pot, a Tanner day in the bay, a deckhand job out west
//    Crab.buyKit(ticket) → report;  Crab.tannerDay(ticket, {rand}) → report
//    Crab.job(ticket, {rand})             the deckhand job: {phase, done, view(), choose(id), report()}
//    Crab.status(ticket)                  rows for a status line: [label, value]
// ============================================================
(function(C){
  'use strict';
  const U=C.util,D=C.data,{$,clamp,copy,n0,plural}=U;

  C.newState=()=>({v:1,gear:false,gear2:false,pot:null,hold:null,open:{},jobs:0,invite:false,tanner:{},tot:{sets:0,pulls:0,crab:0,meals:0,feeds:0,lost:0,tanner:0,jobs:0,jobNet:0,earned:0,spent:0,injuries:0,unpaid:0,hireFail:0}});
  C.normState=function(x){
    const b=C.newState();if(!x||typeof x!=='object'||x.v!==1)return b;
    const s=Object.assign(b,copy(x));s.tot=Object.assign(C.newState().tot,s.tot||{});
    if(!s.open||typeof s.open!=='object')s.open={};if(!s.tanner||typeof s.tanner!=='object')s.tanner={};
    s.jobs=n0(s.jobs,0);s.gear=!!s.gear;s.gear2=!!s.gear2;s.invite=!!s.invite;
    if(s.pot&&!(typeof s.pot.d==='number'))s.pot=null;if(s.hold&&!(s.hold.n>0))s.hold=null;
    return s;
  };
  C.normTicket=function(t){
    t=Object.assign({phase:'summer',year:2027,season:0,day:0,tod:720,freeMin:1e4,atHomer:false,cash:0,energy:80,rep:50,skill:20,costMult:1,ownBoat:false,daysLeft:0,freezerRoom:999},t||{});
    t.state=C.normState(t.state);return t;
  };
  const rnd=o=>o&&typeof o.rand==='function'?o.rand:Math.random;
  function rep0(t){return {state:copy(t.state),cashDelta:0,spent:0,earned:0,energyDelta:0,repDelta:0,womDelta:0,skillDelta:0,minutes:0,daysUsed:0,meals:0,sore:0,lines:[],events:[],severity:0}}
  const price=(t,x)=>Math.round(x*t.costMult);
  function pay(r,t,x){const c=price(t,x);r.cashDelta-=c;r.spent+=c;r.state.tot.spent+=c;return c}
  const ev=(r,id,sev)=>r.events.push({id,sev:sev||0});

  // ---- this year's openings (rolled once, kept in the state) ----
  function roll(s,t,r){
    const y=t.year;
    if(t.phase==='summer'&&s.open['d'+y]==null) s.open['d'+y]=r()<D.POT.pOpen;
    if(t.phase==='winter'){
      if(s.open['t'+y]==null){const o=r()<D.TANNER.pOpen;s.open['t'+y]=o?D.TANNER.limits[Math.floor(r()*D.TANNER.limits.length)%D.TANNER.limits.length]:0}
      if(s.open['o'+y]==null){let x=r(),k='fair';for(const [id,p] of D.JOB.outlook){if(x<p){k=id;break}x-=p}s.open['o'+y]=k}
    }
    return s;
  }
  C.prep=function(t0,o){const t=C.normTicket(t0);return roll(t.state,t,rnd(o))};
  const dungOpen=t=>t.state.open['d'+t.year];        // true, false, or undefined (not rolled yet: treated as open)
  const tannerLimit=t=>t.state.open['t'+t.year];      // 0 closed, else the permit's limit
  const outlook=t=>t.state.open['o'+t.year]||'fair';
  C.isOpen=(t0,kind)=>{const t=C.normTicket(t0);return kind==='tanner'?tannerLimit(t)>0:dungOpen(t)!==false};

  // ---- summer: the Dungeness pot ----
  const boatTxt=t=>t.ownBoat?`your own boat, about ${$(price(t,D.POT.ownFuel))} in gas`:`a buddy’s skiff and its gas, ${$(price(t,D.POT.skiff))}`;
  function timeWhy(t,need){
    if(!t.atHomer) return 'Only from the Homer Spit.';
    if(t.tod<D.POT.afternoon) return 'Mornings are for guiding. Come back on a free afternoon.';
    if(t.tod>D.POT.late) return 'Too late to run across the bay tonight.';
    if(t.freeMin<need) return 'Not enough time before your next trip.';
    if(t.energy<15) return 'Too tired to run a boat across the bay.';
    return '';
  }
  C.potOptions=function(t0){
    const t=C.normTicket(t0),s=t.state,P=D.POT,o=[];
    if(!s.gear&&!s.pot&&!s.hold) return o;
    if(s.hold){o.push({id:'cooler',ic:'🦀',l:`Crab in the cooler: ${plural(s.hold.n,'crab')}`,s:'Into the freezer, or a crab feed. Never for sale.',dis:false,why:''});return o}
    if(s.pot&&!s.pot.lost){
      const soak=t.day-s.pot.d,why=soak<1?'Let it soak overnight. Pull it on your next free afternoon in Homer.':timeWhy(t,P.pullMin);
      o.push({id:'pull',ic:'🦀',l:`Pull your crab pot (${soak<1?'set today':plural(soak,'day')+' soaking'})`,s:why||`${P.pullMin} min across the bay and back on ${boatTxt(t)}. Measure, sort, rebait at home.`,dis:!!why,why});
      return o;
    }
    const closed=dungOpen(t)===false,why=closed?`The Dungeness subsistence fishery isn’t open in ${t.year}. Check with Fish and Game in Homer next year.`:timeWhy(t,P.setMin);
    o.push({id:'set',ic:'🦀',l:closed?'Crab pot: closed this year':'Set a crab pot in Kachemak Bay',s:why||`${P.setMin} min. Your free subsistence permit, ${$(price(t,P.bait))} in bait and ${boatTxt(t)}. Pull it on your next free afternoon here.`,dis:!!why,why});
    return o;
  };
  C.setPot=function(t0,o){
    const t=C.normTicket(t0),r=rep0(t),P=D.POT,s=r.state;roll(s,t,rnd(o));
    const op=C.potOptions(Object.assign({},t,{state:s})).find(x=>x.id==='set');
    if(!op||op.dis){r.lines.push(op?op.why:'You have no pot to set.');return r}
    pay(r,t,P.bait);pay(r,t,t.ownBoat?P.ownFuel:P.skiff);
    s.pot={d:t.day,year:t.year};s.tot.sets++;r.minutes=P.setMin;r.energyDelta=-P.setEnergy;ev(r,'pot_set');
    r.lines.push(`🦀 You run across Kachemak Bay to the subsistence waters off Seldovia, bait the pot with herring and a salmon head, and drop it in 60 feet of water. The buoy carries your name and address, as the permit asks. The rot cord in the door means a lost pot stops fishing on its own.`);
    return r;
  };
  C.pullPot=function(t0,o){
    const t=C.normTicket(t0),r=rep0(t),P=D.POT,s=r.state,rand=rnd(o);
    const op=C.potOptions(t).find(x=>x.id==='pull');
    if(!op||op.dis){r.lines.push(op?op.why:'You have no pot in the water.');return r}
    const soak=t.day-s.pot.d;
    pay(r,t,t.ownBoat?P.ownFuel:P.skiff);r.minutes=P.pullMin;r.energyDelta=-P.pullEnergy;s.tot.pulls++;
    const pLost=P.lostBase+Math.max(0,soak-3)*P.lostPerDay;
    s.pot=null;
    if(rand()<pLost){
      s.gear=false;s.tot.lost++;r.severity=1;ev(r,'pot_lost',1);
      r.lines.push(`🌊 You search the GPS mark for an hour. No buoy. ${soak>3?'Left out too long, ':''}a prop or a big tide took the line. The rot cord will open the door so the pot stops fishing, but it’s gone: a new one is ${$(price(t,P.kit))}.`);
      return r;
    }
    const mean=P.mean[Math.min(soak,P.mean.length-1)],n=clamp(Math.round(mean+(rand()-.5)*3.2),0,7);
    const shorts=Math.floor(rand()*4),hens=Math.floor(rand()*3);
    ev(r,'pot_pull');
    r.lines.push(`🦀 The pot comes up streaming kelp. ${n?`${plural(n,'legal male')} at ${P.minWidth} inches or better across the shell`:'Nothing legal in it'}${shorts||hens?`; ${[shorts?plural(shorts,'short'):'',hens?plural(hens,'female'):''].filter(Boolean).join(' and ')} go back over the side, gently`:''}. ${soak>4?'The bait is long gone: a shorter soak fishes better.':''}`);
    if(n) s.hold={n,kind:'dung'};
    return r;
  };
  // crab in the cooler: the freezer (meals) or a crab feed (goodwill); sale is never an option
  C.useCrab=function(t0,how){
    const t=C.normTicket(t0),r=rep0(t),s=r.state,h=s.hold;
    if(!h){r.lines.push('Your cooler is empty.');return r}
    s.hold=null;s.tot.crab+=h.n;
    if(how==='feed'){
      const F=D.FEED,big=h.n>=F.minCrab;r.repDelta=big?F.rep:0;r.womDelta=big?F.wom:1;r.energyDelta=F.energy;s.tot.feeds++;ev(r,'crab_feed');
      r.lines.push(`🍽️ A pot of boiling water, melted butter and newspaper on the table: ${h.n} ${h.kind==='tanner'?'Tanner crab':'Dungeness'} for the dock crowd and a party you guided. Word gets around${big?', and people remember who fed them':''}.`);
    }else{
      const meals=h.n*D.MEALS_PER_CRAB,put=Math.min(meals,Math.max(0,t.freezerRoom));r.meals=put;s.tot.meals+=put;
      r.lines.push(`🧊 You cook, crack and pick ${plural(h.n,'crab')}, then vacuum-seal the meat: ${plural(put,'meal')} in the freezer${put<meals?`; the freezer is full, so ${plural(meals-put,'meal')} go to the neighbors`:''}.`);
    }
    return r;
  };

  // ---- winter: a pot, a Tanner day, the deckhand job ----
  C.winterOptions=function(t0){
    const t=C.normTicket(t0),s=t.state,T=D.TANNER,J=D.JOB,o=[],lim=tannerLimit(t),done=s.tanner[t.year]||0;
    if(s.hold) o.push({id:'cooler',ic:'🦀',l:`Crab in the cooler: ${plural(s.hold.n,'crab')}`,s:'Into the freezer, or a crab feed. Never for sale.',dis:false,why:''});
    o.push({id:'kit',ic:'🪤',l:s.gear?'You own a crab pot':`Buy a crab pot, buoy and line — ${$(price(t,D.POT.kit))}`,s:s.gear?'Marked with your name and address, rot cord in the door. Ready for Homer.':'For a Dungeness pot on free afternoons in Homer next summer, and a Tanner pot in the bay in winters it opens.',dis:s.gear||t.cash<price(t,D.POT.kit),why:s.gear?'owned':t.cash<price(t,D.POT.kit)?'Not enough cash.':''});
    const tWhy=!lim?`Closed this winter: the survey found too few legal males in Kachemak Bay.`:!s.gear?'You need a pot first.':t.daysLeft<T.days?'No free days left.':done>=2?'Twice is plenty this winter.':s.hold?'Deal with the crab in your cooler first.':'';
    o.push({id:'tanner',ic:'❄️',l:lim?`Tanner pot in Kachemak Bay (${plural(T.days,'free day')})`:'Tanner crab: closed this winter',s:tWhy||`Open this winter by permit: males only, ${T.minWidth} inches across with the spines, ${lim} a day. ${$(price(t,T.bait+T.skiff))} for bait and a skiff. Cold spray, short light.`,dis:!!tWhy,why:tWhy});
    const jWhy=t.daysLeft<J.days?`It takes ${J.days} free days; you have ${t.daysLeft}.`:t.cash<price(t,J.air)?'You can’t cover the airfare.':'';
    o.push({id:'job',ic:'⚓',l:`Crew on a crab boat out west (${J.days} free days)`,s:jWhy||`${D.OUTLOOK[outlook(t)]} A greenhorn gets a part share. Good money, real risk.`,dis:!!jWhy,why:jWhy});
    return o;
  };
  C.buyKit=function(t0){
    const t=C.normTicket(t0),r=rep0(t),s=r.state;
    if(s.gear){r.lines.push('You already own a pot.');return r}
    pay(r,t,D.POT.kit);s.gear=true;
    r.lines.push(`🪤 A Dungeness pot with two escape rings, a buoy and a coil of sinking line. You paint your name and address on the buoy and tie in a fresh rot cord. The subsistence permit itself is free from Fish and Game.`);
    return r;
  };
  C.tannerDay=function(t0,o){
    const t=C.normTicket(t0),r=rep0(t),s=r.state,T=D.TANNER,rand=rnd(o);roll(s,t,rand);
    const op=C.winterOptions(Object.assign({},t,{state:s})).find(x=>x.id==='tanner');
    if(op.dis){r.lines.push(op.why);if(!tannerLimit(Object.assign({},t,{state:s})))ev(r,'tanner_closed');return r}
    const lim=s.open['t'+t.year];
    pay(r,t,T.bait+T.skiff);r.daysUsed=T.days;r.energyDelta=-T.energy;s.tanner[t.year]=(s.tanner[t.year]||0)+1;s.tot.tanner++;
    if(rand()<.05){s.gear=false;s.tot.lost++;r.severity=1;ev(r,'pot_lost',1);
      r.lines.push(`🌊 Ice fog, a big tide and a long search. The buoy never shows. The pot is gone (a new one is ${$(price(t,D.POT.kit))}).`);return r}
    const n=clamp(Math.round(rand()*(lim+1)-.2),0,lim),shorts=1+Math.floor(rand()*4);
    ev(r,'tanner_measure');
    r.lines.push(`❄️ Spray freezes on the skiff’s rail. You haul the pot by hand and measure each crab with a gauge across the widest part of the shell, spines included: ${n?`${plural(n,'legal male')} (the permit allows ${lim} a day)`:'nothing legal'}; ${plural(shorts,'short')} and every female go back. Only whole crab come off the boat, and you write the catch on your permit before you leave the harbor.`);
    if(n) s.hold={n,kind:'tanner'};
    return r;
  };

  // ---- the deckhand job ----
  C.job=function(t0,o){
    const t=C.normTicket(t0),rand=rnd(o),J=D.JOB,r=rep0(t),s=r.state;roll(s,t,rand);
    const out=s.open['o'+t.year]||'fair';
    const j={phase:'intro',done:false,skipper:null,mood:0,inj:0,catchX:1,how:null,flew:false,hand:J.hand[Math.min(s.jobs,J.hand.length-1)],res:null};
    const sk=()=>J.skipper[j.skipper];
    function hire(how){
      j.how=how;
      if(how==='friend'){
        if(s.invite){j.skipper='solid';return true}
        const p=(J.hire.friend.base+t.rep*J.hire.friend.rep)*({good:1.1,fair:.9,thin:.6}[out]);
        if(rand()<p){j.skipper=rand()<.8?'solid':'rough';return true}return false;
      }
      if(how==='docks'){
        if(rand()<J.hire.docks[out]+t.rep*.002){const x=rand();j.skipper=x<.55?'solid':x<.9?'rough':'shady';return true}return false;
      }
      j.skipper=rand()<.5?'shady':'rough';return true;   // the boat nobody wants
    }
    function fly(nights){if(!j.flew){pay(r,t,J.air);j.flew=true}if(nights)pay(r,t,J.lodging*nights)}
    function finish(){
      const R=j.res={},out2=out;
      let full=J.share[out2]*(.8+.4*rand())*j.catchX;
      R.closed=rand()<J.pClose[out2];if(R.closed){full*=J.closeCut;ev(r,'job_closed',1)}
      let gross=full*j.hand;
      if(j.mood<=-2){gross*=.9;R.docked=true}
      const p=clamp(J.injury.base+j.inj+(t.energy<40?.03:0),.01,.3);
      R.hurt=rand()<p?(rand()<J.injury.pMajor?'major':'minor'):null;
      if(R.hurt){const I=J.injury[R.hurt];pay(r,t,I.cash);r.sore=I.sore;if(I.cut)gross*=I.cut;s.tot.injuries++;r.severity=Math.max(r.severity,R.hurt==='major'?2:1);ev(r,'job_injury',R.hurt==='major'?2:1)}
      R.gross=Math.round(gross);
      R.unpaid=rand()<sk().noPay;R.paid=Math.round(R.unpaid?gross*J.paidPart:gross);
      if(R.unpaid){s.tot.unpaid++;r.severity=Math.max(r.severity,1);ev(r,'job_not_paid',1)}
      r.cashDelta+=R.paid;r.earned+=R.paid;s.tot.earned+=R.paid;ev(r,'job_payout');
      r.energyDelta+=J.energy;r.skillDelta+=1;
      s.jobs++;s.tot.jobs++;s.invite=j.mood>=2&&j.skipper!=='shady'&&!R.unpaid;
      s.tot.jobNet+=r.cashDelta;
      j.phase='pay';
    }
    const S0={
      intro:()=>({title:'⚓ Crew on a crab boat out west',html:`<p>${D.OUTLOOK[out]}</p><p>It takes ${plural(J.days,'free day')} of your winter. You fly to Dutch Harbor on your own dime, buy a commercial crewmember license, and fish for a share of the boat’s catch, not a wage. A greenhorn gets a part share; ${s.jobs?`you’ve done this before, so you’d get ${Math.round(j.hand*100)}% of a full share.`:'yours would be half.'}</p><p style="font-size:13px;opacity:.8">${U.pick(D.LORE,rand)}</p>`,
        buttons:[
          {id:'friend',l:s.invite?'Call last winter’s skipper':'Call a skipper a Homer buddy fished with',s:s.invite?'He said to come back. A bunk is waiting.':'If he has a bunk, you fly out already hired. Your reputation helps.'},
          {id:'docks',l:'Fly out and walk the docks in Dutch Harbor',s:`About ${$(price(t,J.air))} in airfare and ${$(price(t,J.lodging))} a night in Unalaska while you knock on wheelhouse doors. ${out==='good'?'Good odds this winter.':out==='fair'?'Fair odds.':'Poor odds this winter.'}`},
          {id:'anyboat',l:'Take the bunk on the boat nobody wants',s:'Always hiring. Ask around the bar why.'},
          {id:'no',l:'Not this winter',s:'Nothing spent.'}]}),
      nohire:()=>({title:'⚓ No bunk yet',html:`<p>${j.how==='friend'?'Your buddy’s skipper has a full crew this winter. “Try the docks,” he says.':'Two days of knocking on wheelhouse doors. Every skipper wants someone who has done it before.'}</p>`,
        buttons:(j.how==='friend'?[{id:'docks',l:'Fly out and walk the docks anyway',s:`About ${$(price(t,J.air))} and a night or two in Unalaska.`}]:[]).concat([
          {id:'anyboat',l:'Take the bunk on the boat nobody wants',s:'There is always one. Ask around the bar why.'},
          {id:'home',l:j.flew?'Fly home':'Forget it this winter',s:j.flew?`You lose ${plural(J.failDays,'free day')} and the airfare.`:'Nothing spent.'}])}),
      hired:()=>({title:'⚓ Hired: a bunk on a crab boat',html:`<p>You sign on with ${sk().n}${j.how==='anyboat'?'. The last greenhorn left mid-trip; nobody says why':''}. ${j.hand<.75?'Greenhorn: half a share, the worst bunk, and every dirty job on deck.':`${Math.round(j.hand*100)}% of a full share this time.`}</p><p>Before you sail: the commercial crewmember license (${$(price(t,J.license))})${s.gear2?'':`, and rain gear, boots and gloves (${$(price(t,J.gear))})`}.</p>`,
        buttons:[{id:'sail',l:'Buy the license, gear up and sail',s:`${plural(J.days,'free day')} of your winter.`},{id:'home',l:'Back out and fly home',s:`You lose ${plural(J.failDays,'free day')} and the airfare.`}]}),
      drill:()=>({title:'🦺 Survival-suit drill on deck',html:`<p>Before the first string, the engineer runs the drill the Coast Guard expects: abandon ship, fire, man overboard. Then the immersion suits come out of their bags. “Under a minute,” he says. “The water out here is 38 degrees.”</p>`,
        buttons:[{id:'practice',l:'Practice until you’re zipped and hooded in under a minute',s:'Tired arms. You’ll know the suit in the dark.'},{id:'motions',l:'Go through the motions',s:'You’ve seen it done. How hard can it be?'}]}),
      storm:()=>({title:'🌊 Setting and hauling in a storm',html:`<p>Thirty knots and building. The pots weigh 700 pounds and swing on the crane as the deck rolls. Bait, launch, coil, haul, dump, sort, stack: twenty hours a day.</p>`,
        buttons:[{id:'pace',l:'Keep up with the deckhands, every pot',s:'More pots fished, and the skipper notices. Easier to get hurt.'},{id:'steady',l:'Work steady and watch the swinging pot',s:'Never stand between a pot and the rail.'},{id:'warm',l:'Ask to go below and warm up',s:'Safer. The crew remembers.'}]}),
      sort:()=>({title:'🦀 The sorting table',html:`<p>A pot spills onto the table: legal males into the tank, females and small males back over the side, fast, before they chill. The processor docks the boat for dead crab.</p>`,
        buttons:[{id:'careful',l:'Sort carefully, one crab at a time',s:'Fewer dead in the tank.'},{id:'fast',l:'Sort fast and keep up',s:'The deck boss likes speed. Mistakes happen.'}]}),
      ice:()=>({title:'🧊 Ice on the rails',html:`<p>Freezing spray all night. By morning the rails, the crane and the wheelhouse wear inches of ice, and the boat rolls slow and heavy.</p>`,
        buttons:[{id:'chip',l:'Grab a bat and beat ice with everyone',s:'Hours of it, in the wind. Exhausting.'},{id:'stack',l:'Keep working the pot stack',s:'Someone else will get the ice.'}]}),
      pay:()=>{const R=j.res,L=[];
        L.push(`<p>${R.closed?'The boat’s quota came in early (or the season closed on it): a short trip. ':''}Your ${j.hand<.75?'greenhorn ':''}share comes to <b>${$(R.gross)}</b>${R.docked?', after the skipper docks your share for the grub bill and the attitude':''}.</p>`);
        if(R.hurt==='minor') L.push(`<p>🩹 A pot pinned your hand against the rail: a sprain, a clinic visit (${$(price(t,J.injury.minor.cash))} after the boat’s insurance) and a sore few mornings when the season opens.</p>`);
        if(R.hurt==='major') L.push(`<p>🚑 A swinging pot caught you across the ribs. They put you ashore early: ${$(price(t,J.injury.major.cash))} in bills after the insurance, less of a share, and a slow start to the season.</p>`);
        if(R.unpaid) L.push(`<p>💸 The settlement never comes in full. ${$(R.paid)} lands in your account with a promise about the rest. Fishermen have liens for unpaid wages, but lawyers cost money too.</p>`);
        else L.push(`<p>💵 The settlement clears: <b>${$(R.paid)}</b>.</p>`);
        L.push(`<p>Trip net, after airfare, license${s.gear2?'':', gear'} and bills: <b>${r.cashDelta<0?'−':''}${$(Math.abs(r.cashDelta))}</b>.${s.invite?' The skipper shakes your hand: “Come back next winter.”':''}</p>`);
        return {title:'💵 Settlement day',html:L.join(''),buttons:[{id:'done',l:'Fly home',s:'Back to the off-season.'}]}},
    };
    const EVT={drill:'suit_drill',storm:'hauling',sort:'sorting',ice:'heavy_seas_ice',hired:'job_hired',pay:'job_payout'};
    const sess={
      get phase(){return j.phase},get done(){return j.done},state:j,
      view(){const v=S0[j.phase]();v.meta={phase:j.phase,events:EVT[j.phase]?[{id:j.phase==='hired'&&j.hand<.75?'job_greenhorn':EVT[j.phase],sev:0}]:[]};if(j.phase==='pay')v.meta.events=r.events.slice();return v},
      choose(id){
        const v=S0[j.phase]();if(!v.buttons.some(b=>b.id===id&&!b.dis))return false;
        switch(j.phase){
          case 'intro': case 'nohire':
            if(id==='no'){j.done=true;break}
            if(id==='home'){if(j.flew){r.daysUsed=J.failDays;s.tot.hireFail++;r.lines.push(`✈️ You fly home with nothing but a story and a lighter wallet.`)}j.done=true;break}
            if(id==='docks'){fly(1+(rand()<.5?1:0))}
            if(id==='anyboat'){fly(0)}
            if(hire(id)){if(id==='friend')fly(0);j.phase='hired';ev(r,'job_hired')}else j.phase='nohire';
            break;
          case 'hired':
            if(id==='home'){r.daysUsed=J.failDays;s.tot.hireFail++;r.lines.push('✈️ You back out at the dock and fly home.');j.done=true;break}
            pay(r,t,J.license);if(!s.gear2){pay(r,t,J.gear);s.gear2=true}r.daysUsed=J.days;j.phase='drill';break;
          case 'drill': if(id==='practice'){j.inj-=.03;j.mood+=1}ev(r,'suit_drill');j.phase='storm';break;
          case 'storm': if(id==='pace'){j.catchX*=1.08;j.inj+=.06;j.mood+=1}else if(id==='warm'){j.catchX*=.95;j.inj-=.02;j.mood-=1}ev(r,'hauling');j.phase='sort';break;
          case 'sort': if(id==='careful'){j.catchX*=1.03;j.mood+=1}else if(rand()<.35){j.mood-=1}ev(r,'sorting');j.phase='ice';break;
          case 'ice': if(id==='chip'){j.mood+=1;r.energyDelta-=5}else{j.mood-=2;j.inj+=.04}ev(r,'heavy_seas_ice',1);finish();break;
          case 'pay': j.done=true;
            r.lines.unshift(`⚓ A crab trip out west: ${$(j.res.paid)} paid${j.res.unpaid?' (the rest is promised)':''}, ${r.cashDelta<0?'a loss of '+$(-r.cashDelta):$(r.cashDelta)+' net'} after airfare, license and bills.${j.res.hurt?' You come home hurt.':''}`);break;
        }
        return true;
      },
      report(){return r},
    };
    return sess;
  };

  C.status=function(t0){
    const t=C.normTicket(t0),s=t.state,T=s.tot,rows=[];
    rows.push(['Crab pot',s.pot?'soaking in Kachemak Bay':s.gear?'at home, ready':'none']);
    if(T.crab) rows.push(['Crab kept',String(T.crab)]);
    if(T.jobs) rows.push(['Crab trips out west',`${T.jobs}, ${T.jobNet<0?'−':''}${$(Math.abs(T.jobNet))} net`]);
    return rows;
  };
})(Crab);
