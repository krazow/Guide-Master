// ============================================================
//  GILLNET, part 2: the engine.
//  · schedule(o, {rand}): which of the played days are openers, and what ADF&G does with each (open, restricted, closed,
//    reopened, an extra period) for a fishery in a season, from the king situation and the sockeye run.
//  · outlook(kind, king, sock), offers(t): what the off-season planner shows.
//  · session(ticket, {rand}): one opener as a few beats (set → soak → pick → deliver on the beach; run out → drift line →
//    the tide → deliver on a boat), with view() / choose(id) / report(). A day on an experimental beach seine is a short session.
//  · rest(o) and partner(ticket, {rand}): the openers someone else fishes for you (the unplayed summer; a day you guided).
// ============================================================
(function(G){
  'use strict';
  const D=G.data,U=G.util,{clamp,$,hm}=U;

  // ---------- the season's openers ----------
  const DOW=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  // o: {kind:'set'|'drift', days:[{d, md (month*100+day), dow (0 Sunday)}], king:'closed'|'cr'|'open', sock (the run's size, 1 average)}
  G.schedule=function(o,opt){
    const rand=(opt&&opt.rand)||Math.random,K=D[o.kind],out={v:G.SCHEMA,kind:o.kind,days:{},reopen:null};
    if(!K) return out;
    const strong=o.sock>=1.1,weak=o.sock<.75;
    // a setnet season that starts closed for kings can reopen late if the sockeye flood in (August 2025 did): decided once
    if(o.kind==='set'&&o.king==='closed'&&o.sock>=1.15&&rand()<.45) out.reopen=718+Math.floor(rand()*10);
    (o.days||[]).slice().sort((a,b)=>a.d-b.d).forEach(x=>{
      if(!(x.md>=K.open&&x.md<=K.close)) return;
      const reg=x.dow===1||x.dow===4;
      let st,area=o.kind==='set'?'beach':'district',hours=K.hours.slice(),why;
      if(!reg){   // an extra period by emergency order: a strong run, mid-July on, never on a Sunday
        if(!strong||x.md<708||x.dow===0) return;
        if(o.kind==='set'&&o.king==='closed'&&!(out.reopen&&x.md>=out.reopen)) return;
        if(rand()>=(o.kind==='set'?.2:.12)) return;
        st='extra';area=o.kind==='set'?'beach':'corridor';hours=[420,1080];
        why=o.kind==='set'?'An extra period by emergency order: the sockeye run is strong and the Kasilof is filling up.':'An extra period by emergency order, in the corridor along the east-side beaches: the sockeye run is strong.';
      }else if(o.kind==='set'){
        if(o.king==='open'){st=rand()<.12?'restricted':'open'}
        else if(o.king==='cr'){st=rand()<(x.md>=720?.25:.08)?'open':'restricted'}
        else st=out.reopen&&x.md>=out.reopen?'reopen':'closed';
        if(st==='restricted') hours=[420,900];
        if(weak&&st!=='closed'&&rand()<.3){st='closed';why='Closed by emergency order: the sockeye run is tracking weak.'}
        why=why||{open:'A regular period: Mondays and Thursdays, 7 AM to 7 PM.',restricted:'Restricted to protect Kenai kings: one net within 600 feet of the high-tide line, 7 AM to 3 PM.',
          closed:'Closed under the Kenai king plan: no setnets on the east-side beach.',reopen:'Reopened by emergency order: the late-run kings reached their goal and the sockeye are pouring in.'}[st];
      }else{
        const r=rand();
        if(x.md>=801){area='west';st='open';why='Early August: the drift fleet fishes the west side of the inlet only. A long run across.'}
        else{
          if(o.king==='open') area=r<.65?'district':'corridor';
          else if(o.king==='cr') area=r<.35?'district':r<.75?'corridor':'area1';
          else area=r<.2?'district':r<.65?'corridor':'area1';
          st=area==='district'?'open':'restricted';
          why={district:'A regular period: Mondays and Thursdays, 7 AM to 7 PM, the whole Central District.',corridor:'Restricted to the corridor along the east-side beaches (the Expanded Kenai and Kasilof Sections).',
            area1:'Restricted to Drift Area 1, south of Kalgin Island, away from the Kenai kings.'}[area];
        }
        if(weak&&rand()<.3){st='closed';why='Closed by emergency order: the sockeye run is tracking weak.'}
      }
      const day={st,area,hours,why,reg,dow:DOW[x.dow],md:x.md,ann:x.d-1};
      if(o.kind==='set'&&st==='closed'&&o.king==='closed'&&reg&&rand()<.6) day.seine=true;   // a family's experimental beach seine fishes the closed beach
      out.days[x.d]=day;
    });
    return out;
  };
  G.fishable=day=>!!day&&day.st!=='closed';
  // fish on an opener next to a regular open period
  const ST_F={open:1,restricted:.45,reopen:1.15,extra:.85,closed:0};
  const AREA_F={beach:1,district:1,corridor:.9,area1:.75,west:.8};
  // (a drift period's restriction is where it may fish: the area does the work)
  G.openerFactor=day=>!day||day.st==='closed'?0:day.area==='beach'?(ST_F[day.st]||0):(day.st==='restricted'||day.st==='open'?1:ST_F[day.st]||0)*(AREA_F[day.area]||1);
  // what the winter planner says about a fishery this year
  G.outlook=function(kind,king,sock){
    const run=sock>=1.2?'a strong sockeye forecast':sock>=.95?'an average sockeye forecast':sock>=.75?'a below-average sockeye forecast':'a weak sockeye forecast';
    if(kind==='set') return {closed:`Kenai kings are closed, so the east-side setnets start the summer closed under the king plan. Only a huge sockeye run late in July could reopen them. With ${run}, it’s a gamble.`,
      cr:`Kenai kings are catch-and-release only, so most setnet periods are restricted: one net close to the beach, fewer hours. ${run.charAt(0).toUpperCase()+run.slice(1)}.`,
      open:`Kenai kings are open, so the setnets fish their regular periods, Mondays and Thursdays. ${run.charAt(0).toUpperCase()+run.slice(1)}.`}[king];
    return {closed:`Kenai kings are closed, so many drift periods are pushed into the corridor along the beaches or south to Area 1. ${run.charAt(0).toUpperCase()+run.slice(1)}.`,
      cr:`Kenai kings are catch-and-release only: some drift periods are restricted to the corridor or Area 1. ${run.charAt(0).toUpperCase()+run.slice(1)}.`,
      open:`Kenai kings are open: the drift fleet fishes most regular periods district-wide. ${run.charAt(0).toUpperCase()+run.slice(1)}.`}[king];
  };

  // ---------- the off-season planner ----------
  // t: {cash, costMult, xp:{set,drift} openers worked, did:{'set:crew':n seasons, ...}, own:{boat}, suit, plan (a role id or null)}
  G.offers=function(t){
    const cm=t.costMult||1,did=t.did||{},xp=t.xp||{},own=t.own&&t.own.boat,o=[];
    const crewed=k=>(did[k+':crew']||0)>=1||(xp[k]||0)>=3;
    const add=(id,cost,why,extra)=>{const R=D.ROLES[id];o.push(Object.assign({id,ic:R.ic,l:R.l,s:R.s,cost:Math.round(cost),dis:!!why,why:why||''},extra||{}))};
    add('set:crew',D.CREWLIC*cm,null,{note:`A ${Math.round(D.set.crew*100)}% share of what the site sells.`});
    add('set:lease',D.set.leaseUp*cm,!crewed('set')?'Crew a season on a site first (or work three setnet openers)':t.cash<D.set.leaseUp*cm?'Can’t afford it':null,
      {note:`${$(Math.round(D.set.leaseUp*cm))} up front for the site, skiff and nets; ${Math.round(D.set.permit*100)}% of sales to the permit holder and ${Math.round(D.set.hire*100)}% to your hand.`});
    add('drift:crew',D.CREWLIC*cm,null,{note:`A ${Math.round(D.drift.crew*100)}% crew share.`});
    if(!own) add('drift:lease',D.drift.leaseUp*cm,!crewed('drift')?'Deckhand a season first (or work three drift openers)':t.cash<D.drift.leaseUp*cm?'Can’t afford it':null,
      {note:`${$(Math.round(D.drift.leaseUp*cm))} up front; ${Math.round(D.drift.lease*100)}% of sales to the owner, ${Math.round(D.drift.deck*100)}% to your deckhand, fuel and ice on you.`});
    if(own) add('drift:own',0,null,{note:`No lease. ${Math.round(D.drift.deck*100)}% to your deckhand, fuel and ice on you.`});
    return o;
  };
  G.buyCost=cm=>Math.round((D.OWN.permit+D.OWN.boat)*(cm||1));
  G.buyWhy=t=>(t.own&&t.own.boat)?'You already own one':(t.did||{})['drift:lease']>=1||(t.did||{})['drift:own']>=1?(t.cash<G.buyCost(t.costMult)+5000?'Can’t afford it (and keep a little cash)':null):'Lease a drift permit and boat for a season first';

  // ---------- one opener ----------
  function normTicket(x){
    x=Object.assign({kind:'set',role:'crew',day:null,run:.8,price:1.7,wind:8,wx:'sun',tides:[],amp:9,now:330,energy:80,cash:0,xp:0,suit:false,exam:true,
      king:'closed',costMult:1,fuel:5.2,skipper:'',seine:false},x||{});
    if(!x.day) x.day={st:'open',area:x.kind==='set'?'beach':'district',hours:D[x.kind]?D[x.kind].hours.slice():[420,1140],why:''};
    return x;
  }
  G.normTicket=normTicket;
  // the tide's height at minute m of the day, from the day's highs and lows (cosine between them)
  function tideAt(T,m){
    const t=T.tides||[];if(!t.length) return 10;
    let a=null,b=null;for(const x of t){if(x.m<=m)a=x;else{b=x;break}}
    if(!a) return b.h;if(!b) return a.h;
    const f=(m-a.m)/(b.m-a.m);return a.h+(b.h-a.h)*(1-Math.cos(Math.PI*f))/2;
  }
  const nextTide=(T,m,hi)=>(T.tides||[]).find(x=>x.m>=m&&x.hi===hi)||null;
  G.tideAt=tideAt;

  G.session=function(ticket,opt){
    const T=normTicket(ticket),rand=(opt&&opt.rand)||Math.random,K=D[T.kind]||D.set;
    const crew=T.role==='crew',seine=!!T.seine;
    const S={phase:'brief',done:false,f:1,energy:K.energy,mins:0,price:T.price,lost:0,repair:0,extraFuel:0,lines:[],events:[],cites:[],flags:{},
      luck:.75+.5*rand(),mood:0,advice:{taken:0,asked:0}};
    const sev=(id,s)=>{if(!S.events.some(e=>e.id===id))S.events.push({id,sev:s||1})};
    const wind=T.wind,big=T.amp>=10,w=clamp(wind/12,.5,2.2),late=Math.max(0,T.now-T.day.hours[0]);
    const who=T.skipper||U.pick(rand,D.SKIPPERS[T.kind]||['the skipper']);
    const follow=clamp(.45+.06*(T.xp||0),.45,.9);
    const facts=()=>{const lo=nextTide(T,Math.max(300,T.day.hours[0]-60),false),hi=nextTide(T,Math.max(300,T.day.hours[0]-60),true);
      return `<p class="small-note" style="font-size:12.5px;color:var(--mute,#667)">🕖 ${hm(T.day.hours[0])}–${hm(T.day.hours[1])} · 🌊 ${big?'big tide':'small tide'}${lo?`, low water ${hm(lo.m)}`:''}${hi?`, high water ${hm(hi.m)}`:''} · 💨 ${wind} kt · 💵 about ${$(T.price)}/lb</p>`};
    // a beat's choice: a crew member advises; the skipper takes the advice or does it their own way (the first, safe button)
    function decide(id,ids){
      if(!crew) return id;
      S.advice.asked++;
      if(id===ids[0]||rand()<follow){S.advice.taken++;if(id!==ids[0])S.lines.push(`🗣️ ${who} goes with your call.`);return id}
      S.lines.push(`🗣️ ${who} hears you out and does it the usual way.`);return ids[0];
    }
    function seineView(){
      return {title:'🏖️ Experimental beach seine',html:`<p>The setnets stay on the bank this morning: the beach is closed for kings. A neighbor’s family is running an <b>experimental beach seine</b> off the same beach, a test permit that may only sell enough sockeye to cover its costs. They could use another pair of hands, for a day’s wage.</p><p>The seine sweeps the fish to the sand alive, so every king goes back in the water.</p>`,
        buttons:[{id:'careful',l:'Work the seine and release every king first',s:`A long, wet day. About ${$(D.SEINE_WAGE)}.`},{id:'quick',l:'Work the seine at their pace',s:`About ${$(D.SEINE_WAGE)}.`},{id:'skip',l:'Not today',s:'Back to the shop.'}]};
    }
    const V={
      brief(){
        if(seine) return seineView();
        const st=T.day,hard=wind>=D.SCA;
        const role=crew?`You’re crew for <b>${who}</b>: a ${Math.round(K.crew*100)}% share of the fish ticket.`:T.role==='own'?'Your boat, your permit.':T.kind==='set'?'Your leased site and nets.':'Your leased permit and boat.';
        const where=T.kind==='set'?'the site below the Kalifornsky bluffs':D.AREA[st.area];
        const body=`<p>${T.kind==='set'?'🪢':'🚤'} <b>${D.ST[st.st].charAt(0).toUpperCase()+D.ST[st.st].slice(1)}</b> · ${where}. ${st.why||''}</p><p>${role}${late>0?` You’re ${late} minutes late for the opening.`:''}</p>${hard?`<p style="color:var(--warn,#b60)">💨 A small-craft advisory: ${wind} knots on the inlet.${T.kind==='drift'&&!T.suit?' You have no survival suit aboard.':''}</p>`:''}${facts()}`;
        sev(T.kind==='set'?'gn_low_tide_site':'gn_tide_rip',1);
        return {title:T.kind==='set'?'🪢 Setnet opener':'🚤 Drift opener',html:body,buttons:[
          {id:'go',l:T.kind==='set'?'Head to the beach':'Run out of the Kenai River',s:T.kind==='set'?'Fifteen minutes to the site. A long day: back around 8:30 PM.':'Out over the bar at the mouth. Back around 9 PM.'},
          {id:'skip',l:hard?'Sit it out: the weather’s too much':'Sit this one out',s:crew?`${who} will be short a hand.`:'Nothing spent today.'}]};
      },
      set(){
        const lo=nextTide(T,T.day.hours[0]-60,false),good=lo&&lo.m<=T.day.hours[0]+150,hiNear=(nextTide(T,T.day.hours[0]-60,true)||{m:9999}).m<=T.day.hours[0]+90;
        S.flags.goodTide=good;S.flags.deep=hiNear;
        const ask=crew?`<p>${who} looks at you: “How do you want to set?”</p>`:'';
        const b=[{id:'all',l:T.day.st==='restricted'?'Set your one net the minute it opens':'Set all three nets the minute it opens',s:good?'Low water: you walk the running lines out across the sand. The flood brings the fish to you.':hiNear?'High water at the opening: you set from the skiff in deep, cold water. Hard work.':'Every minute of the period fishes.'},
          {id:'flood',l:'Wait for the flood and set on the rising water',s:'Easier on the back and the gear. You give up the first hour.'}];
        if(wind>=18) b.push({id:'hold',l:'Keep the outer net on the beach: too much chop',s:'Less fish, and no torn web.'});
        return {title:'🪢 Setting the nets',html:`<p>${good?`Low water at ${hm(lo.m)}. The beach runs out half a mile of wet sand, the buoys and running lines lie where you left them.`:hiNear?'The tide is high at the opening. The running lines are under ten feet of gray water.':'Mid-tide at the opening.'} ${wind>=18?`The wind is up, ${wind} knots out of the southwest.`:''}</p>${ask}${facts()}`,buttons:b};
      },
      soak(){
        const seals=rand()<.35,school=rand()<.4*T.run,kelp=wind>=14&&rand()<.35;S.flags.seals=seals;S.flags.school=school;S.flags.kelp=kelp;
        if(seals)sev('gn_seals',2);if(kelp)sev('gn_kelp',1);if(school)sev('gn_full_net',2);
        const ask=crew?`<p>${who}: “Pick now, or let them soak?”</p>`:'';
        return {title:'🌊 The flood',html:`<p>${school?'The corks are dancing: a school of sockeye is hitting the nets end to end.':'A steady trickle of fish in the nets.'} ${seals?'Two harbor seals are working the outer net, tearing fish out of the web.':''} ${kelp?'The wind is loading the web with kelp and drift.':''}</p>${ask}${facts()}`,
          buttons:[{id:'pick',l:'Run the skiff down the nets and pick now',s:'The fish stay fresh and the seals get less. More work.'},
            {id:'soak',l:'Let them soak to high water',s:'A bigger haul if the fish keep coming. Dead fish soften in the web.'}]};
      },
      pick(){
        const ask=crew?`<p>${who}: “How do you want to pick this one?”</p>`:'';
        const b=[{id:'fast',l:'Pick fast and fill the totes',s:'Done sooner.'},{id:'bleed',l:'Pick on the ebb, bleed every fish and slush-ice the totes',s:`About ${$(D.PRICE.bled)} a pound more at the tender. An hour more on your knees.`}];
        if(!crew) b.push({id:'late',l:`Leave the nets fishing past ${hm(T.day.hours[1])} while you pick the last fish`,s:'A few more fish. The troopers watch the beach at the close.'});
        return {title:'🐟 Picking on the ebb',html:`<p>The tide turns and falls away. ${S.flags.school?'The web is silver from end to end.':'The nets come up out of the water fish by fish.'} The period closes at ${hm(T.day.hours[1])}.</p>${ask}${facts()}`,buttons:b};
      },
      line(){
        const a=T.day.area,ask=crew?`<p>${who}: “Where would you set?”</p>`:'';
        const b=[];
        if(a==='district'||a==='corridor') b.push({id:'corridor',l:'Fish the corridor along the east-side beaches',s:a==='corridor'?'The only water open today. Every boat in the fleet is here.':'Close to home, crowded, and the fish are headed for the Kenai and Kasilof.'});
        if(a==='district') b.push({id:'rip',l:'Run out to the mid-inlet tide rip',s:'Fish and drift collect in the rips. A longer run and big water.'});
        if(a==='area1') b.push({id:'area1',l:'Run south to Area 1',s:'Twenty more miles of fuel each way.'});
        if(a==='west') b.push({id:'west',l:'Cross to the west side',s:'A long, wet crossing. Fewer boats over there.'});
        return {title:'🧭 Picking a drift',html:`<p>Out over the bar on the ebb, the inlet is the color of chocolate milk. ${D.AREA[a].charAt(0).toUpperCase()+D.AREA[a].slice(1)} is open. ${big?'A big tide today: the rips will run hard.':'A small tide: easy drifting.'}</p>${ask}${facts()}`,buttons:b};
      },
      set2(){
        const ask=crew?`<p>${who}: “Long drift or short sets?”</p>`:'';
        return {title:'🪝 Setting the net',html:`<p>${S.flags.where==='rip'?'A rip line of foam and drift logs stretches north as far as you can see. Fish are jumping along it.':'Boats every quarter mile, nets laid out across the tide.'} 150 fathoms of net on the reel.</p>${ask}${facts()}`,
          buttons:[{id:'short',l:'Short sets, pick often, stay off the line',s:'Fresher fish, a little more fuel, less trouble.'},{id:'long',l:'Lay out the whole net and drift a long way',s:'More fish if it holds together. The tide decides where you end up.'}]};
      },
      tide(){
        const restricted=T.day.area==='corridor'||T.day.area==='area1',ev=S.flags.ev=(()=>{
          if(restricted&&S.flags.drift==='long'&&rand()<(big?.55:.35)) return 'line';
          const r=rand();return r<.3*w*(S.flags.where==='rip'?1.4:1)?'torn':r<.55?'seals':r<.75&&S.flags.where==='corridor'?'corked':'school'})();
        const ask=crew?`<p>${who} looks at you.</p>`:'';
        const E={
          line:{id:'gn_corridor_line',sev:3,t:`The flood is setting your whole net toward the corridor line on the plotter. Past it is closed water.`,b:[{id:'pull',l:'Pick up now and re-set inside the line',s:'You lose some fish and some fuel.'},{id:'ride',l:'Let it ride a few more minutes',s:'The fish are hitting. The line is close.'}]},
          torn:{id:'gn_torn_net',sev:2,t:`The net wraps a drifting spruce log in the rip and tears a hole you could drive a skiff through.`,b:[{id:'mend',l:'Haul back and mend it on deck',s:'An hour of needle work. Fewer fish today, a smaller bill later.'},{id:'fish',l:'Keep fishing the torn net',s:'Fish slip through the hole, and it gets worse.'}]},
          seals:{id:'gn_seals',sev:2,t:`Sea lions and seals are cruising your corkline, picking fish out of the net.`,b:[{id:'haul',l:'Haul back early and move off them',s:'Fuel and time. They follow sometimes.'},{id:'leave',l:'Leave the net and hope they move on',s:'They might not.'}]},
          corked:{id:'gn_corked',sev:1,t:`Another boat lays its net right across the tide in front of yours: you’re corked.`,b:[{id:'move',l:'Pick up and find clear water',s:'Fuel and time.'},{id:'stay',l:'Stay and fish behind him',s:'His net gets the fish first.'}]},
          school:{id:'gn_full_net',sev:2,t:`The corks go under in a row: a school hits the net all at once.`,b:[{id:'pick',l:'Pick it now, before the fish die in the web',s:'Fresh fish and an aching back.'},{id:'soak',l:'Let it soak a while longer',s:'More fish, softer ones.'}]},
        }[ev];
        sev(E.id,E.sev);
        return {title:'🌊 The tide',html:`<p>${E.t}</p>${ask}${facts()}`,buttons:E.b};
      },
      deliver(){
        const ask=crew?`<p>${who}: “Tender, or run it in?”</p>`:'';
        if(T.kind==='set') return {title:'⚖️ Delivering',html:`<p>The totes are full. The tender is anchored off the beach, and the processor in Kenai pays a little more for well-kept fish.</p>${ask}${facts()}`,
          buttons:[{id:'tender',l:'Skiff the totes out to the tender',s:'Weighed on the tender, a fish ticket, done.'},{id:'dock',l:'Truck the totes to the processor dock in Kenai',s:`About ${$(D.PRICE.dock)} a pound more for iced fish. An hour more, and gas.`}]};
        const bar=tideAt(T,1230)<7;S.flags.bar=bar;
        return {title:'⚖️ Delivering',html:`<p>The period closes. A tender is working the fleet, and the dock in Kenai pays a little more if you can get over the bar.</p>${ask}${facts()}`,
          buttons:[{id:'tender',l:'Deliver to the tender on the grounds',s:'A line of boats, a sling, a fish ticket.'},{id:'river',l:'Run in to the Kenai dock on the evening tide',s:`About ${$(D.PRICE.dock)} a pound more. ${bar?'The tide will be low at the bar.':'Good water over the bar.'}`}]};
      },
      done(){return {title:'🎣 Opener over',html:sumHtml(),buttons:[{id:'close',l:'Back to the shop',s:''}]}},
    };
    const ORDER={set:['brief','set','soak','pick','deliver','done'],drift:['brief','line','set2','tide','deliver','done']};
    const next=()=>{const o=ORDER[T.kind];S.phase=o[o.indexOf(S.phase)+1]||'done';if(S.phase==='done')finish()};
    function finish(){
      if(S.R) return;
      const R=S.R={kind:T.kind,role:T.role,skipped:!!S.flags.skipped,seine:seine,fish:0,lbs:0,price:0,gross:0,share:0,costs:{lease:0,crew:0,fuel:0,ice:0,gas:0,repair:0},
        cashDelta:0,energyDelta:0,minutes:30,cites:[],events:S.events.slice(),lines:[],kings:0,xp:0,mood:0,quality:'plain',status:T.day.st,area:T.day.area};
      if(S.flags.skipped){R.lines.push(crew?`You call ${who}: you won’t make this one.`:'You sit this one out.');R.mood=crew?-8:0;R.energyDelta=0;if(wind>=D.SCA)sev('gn_stay_in',1);R.events=S.events.slice();return}
      if(seine){
        const wage=Math.round(D.SEINE_WAGE*(S.flags.careful?1:1));R.cashDelta=wage;R.share=wage;R.energyDelta=S.flags.careful?-26:-22;R.minutes=Math.max(60,(S.flags.careful?1170:1110)-T.now);R.xp=1;
        R.fish=Math.round(120*T.run*S.luck);R.kings=Math.max(0,Math.round(R.fish*.01+rand()*1.5));
        R.lines.push(`🏖️ The seine comes ashore ${R.fish>120?'heavy':'half full'}: about ${R.fish} sockeye to sell, ${R.kings?`${R.kings} king${R.kings>1?'s':''} slid back into the surf alive`:'not a king in it'}. Your day’s wage: <b>${$(wage)}</b>.`);
        if(S.flags.careful)R.lines.push('👑 You and the oldest daughter carry every king back to the water by hand. The ADF&G tech watching writes it all down.');
        sev('gn_beach_seine',2);R.events=S.events.slice();return;
      }
      const sk=T.role==='crew'?1:clamp(.9+.012*(T.xp||0),.9,1.08);
      const lateF=clamp(1-late/((T.day.hours[1]-T.day.hours[0])||720),.3,1);
      let fish=K.fish*T.run*G.openerFactor(T.day)*S.f*S.luck*sk*lateF;
      fish=Math.max(0,Math.round(fish*(1-S.lost)));
      R.fish=fish;R.lbs=Math.round(fish*D.LB);
      R.price=Math.round(Math.max(.8,S.price)*100)/100;
      R.quality=S.flags.bled?'bled':S.flags.soft?'soft':'plain';
      R.gross=Math.round(R.lbs*R.price);
      R.kings=fish?Math.round(fish*(T.king==='open'?.006:.003)*(.5+rand())):0;
      R.costs.repair=Math.round(S.repair*(T.costMult||1));
      const cm=T.costMult||1;
      if(crew){R.share=Math.round(R.gross*K.crew);R.cashDelta=R.share}
      else if(T.kind==='set'){R.costs.lease=Math.round(R.gross*K.permit);R.costs.crew=Math.round(R.gross*K.hire);R.costs.ice=Math.round(K.ice*cm);R.costs.gas=Math.round((K.gas+(S.flags.dock?25:0))*cm)}
      else{R.costs.lease=T.role==='lease'?Math.round(R.gross*K.lease):0;R.costs.crew=Math.round(R.gross*K.deck);R.costs.ice=Math.round(K.ice*cm);R.costs.fuel=Math.round((K.gal+S.extraFuel)*T.fuel)}
      if(!crew){const c=R.costs;R.cashDelta=R.gross-c.lease-c.crew-c.ice-c.gas-c.fuel-c.repair}
      else if(R.costs.repair){R.costs.repair=0}   // the skipper's net, the skipper's bill
      R.energyDelta=S.energy;R.minutes=Math.max(60,(K.end+S.mins)-T.now);R.xp=1;R.mood=crew?(S.advice.taken>=2?4:2)+(S.flags.hard?3:0):0;
      R.cites=S.cites.slice();R.events=S.events.slice();
      R.lines=S.lines.slice();
      R.lines.push(`⚖️ Fish ticket: <b>${fish} sockeye</b>, ${U.grp(R.lbs)} lb at ${$(R.price)}/lb${R.quality==='bled'?' (bled and iced)':R.quality==='soft'?' (some soft fish)':''} = <b>${$(R.gross)}</b>.${R.kings?` ${R.kings} king${R.kings>1?'s':''} in the nets, on the ticket.`:''}`);
      if(crew) R.lines.push(`🤝 Your ${Math.round(K.crew*100)}% crew share: <b>${$(R.share)}</b>.`);
      else{const c=R.costs,parts=[c.lease?`${T.kind==='set'?'permit holder':'boat owner'} ${$(c.lease)}`:'',c.crew?`${T.kind==='set'?'your hand':'your deckhand'} ${$(c.crew)}`:'',c.fuel?`fuel ${$(c.fuel)}`:'',c.ice?`ice ${$(c.ice)}`:'',c.gas?`gas ${$(c.gas)}`:'',c.repair?`net repair ${$(c.repair)}`:''].filter(Boolean);
        R.lines.push(`💵 After ${parts.join(', ')}: <b>${R.cashDelta<0?'−':''}${$(Math.abs(R.cashDelta))}</b> to you.`)}
      if(fish>=K.fish*1.1&&!S.events.some(e=>e.id==='gn_full_net'))R.events.push({id:'gn_full_net',sev:2});
      R.events.push({id:S.flags.dock||S.flags.river?'gn_dock':'gn_tender',sev:1});
    }
    function sumHtml(){const R=S.R;if(!R)return '';return R.lines.map(l=>`<p>${l}</p>`).join('')+(R.cites.length?'':'')+`<p class="small-note" style="font-size:12.5px;color:var(--mute,#667)">Energy ${R.energyDelta} · back at ${hm(T.now+R.minutes)}</p>`}
    // the choices
    const ON={
      brief(id){
        if(id==='skip'){S.flags.skipped=true;S.phase='done';finish();return}
        if(seine){S.flags.careful=id==='careful';S.phase='done';finish();return}
        next();
      },
      set(id,ids){id=decide(id,ids);
        if(id==='all'){S.f*=S.flags.goodTide?1.1:1;S.energy-=S.flags.deep?12:8;if(wind>=20&&rand()<.25*w){S.repair+=U.pick(rand,[350,450,600]);S.lost+=.05;S.lines.push('🪢 The chop rolls the outer net into a rope of web and kelp. It needs mending tonight.');sev('gn_torn_net',2)}
          else S.lines.push(S.flags.goodTide?'🪢 Out across the sand at low water, every net set by 7:20. The flood comes in to meet them.':'🪢 All three nets fishing from the opening bell.');S.flags.hard=true}
        else if(id==='flood'){S.f*=.86;S.energy-=4;S.lines.push('🪢 You set on the rising water. It costs the first hour.')}
        else{S.f*=.72;S.energy-=3;S.lines.push('🪢 The outer net stays on the beach. The inside nets fish the flood.')}
        next()},
      soak(id,ids){id=decide(id,ids);
        if(id==='pick'){S.energy-=8;S.mins+=0;if(S.flags.seals)S.lost+=.03;S.lines.push(`🛶 You run the skiff down the corkline and pick${S.flags.seals?', and the seals move off down the beach':''}.`);S.flags.hard=true}
        else{if(S.flags.school)S.f*=1.15;else S.f*=1.03;if(S.flags.seals){S.lost+=.18;S.lines.push('🦭 The seals have a feast in the outer net: torn heads and empty mesh.')}
          if(S.flags.kelp){S.repair+=200;S.lines.push('🌿 The web is loaded with kelp by high water. Hours of cleaning.')}
          S.flags.soft=true;S.price-=D.PRICE.soft;S.energy-=3}
        next()},
      pick(id,ids){id=decide(id,ids);
        if(id==='bleed'){S.flags.bled=true;S.price+=D.PRICE.bled;S.mins+=45;S.energy-=10;S.lines.push('🔪 Every fish bled and laid in slush ice. The tender’s quality bonus is yours.');if(S.flags.soft){S.price+=D.PRICE.soft*.5}}
        else if(id==='late'){S.f*=1.06;S.mins+=15;S.energy-=6;
          if(rand()<.4){const c=D.CITE.late;S.cites.push({what:c.what,fine:c.fine,minor:false,who:'an Alaska Wildlife Trooper watching the beach at the close'});S.lost+=.1;S.lines.push('🚨 A trooper is waiting on the bluff at the close, and your outer net is still fishing.');sev('gn_corridor_line',3)}
          else S.lines.push('⏱️ The last net comes out at 7:15. Nobody was watching. This time.')}
        else{S.energy-=6;S.lines.push('🐟 You pick fast and fill the totes.')}
        next()},
      line(id,ids){id=decide(id,ids);S.flags.where=id;
        if(id==='rip'){S.f*=big?1.25:1.15;S.extraFuel+=15;S.energy-=4}
        else if(id==='corridor'){S.f*=T.day.area==='corridor'?.95:1}
        else if(id==='area1'){S.f*=1;S.extraFuel+=25}
        else if(id==='west'){S.f*=1;S.extraFuel+=35;S.energy-=4}
        if(T.role==='own'&&!T.exam&&rand()<.25){const c=D.CITE.exam;S.cites.push({what:c.what,fine:c.fine,minor:true,who:'a Coast Guard boarding team'})}
        S.lines.push({rip:'🧭 You run out to the rip.',corridor:'🧭 You set in the corridor with the fleet.',area1:'🧭 South to Area 1.',west:'🧭 Across the inlet to the west side.'}[id]);
        if(wind>=20&&!T.suit&&rand()<.15){S.lost+=.15;S.energy-=12;S.lines.push('🌊 A steep sea fills the cockpit and the pumps run for twenty minutes. No survival suits aboard: nobody says a word until it’s over.');sev('gn_swamped',3)}
        else if(wind>=20&&rand()<.1){S.lost+=.08;S.energy-=6;S.lines.push('🌊 Green water over the stern in the tide rip. Everyone in survival suits is a comfort.');sev('gn_swamped',3)}
        next()},
      set2(id,ids){id=decide(id,ids);S.flags.drift=id;
        if(id==='long'){S.f*=1.15;S.energy-=6;S.lines.push('🪝 All 150 fathoms out, drifting with the tide.')}
        else{S.f*=.95;S.extraFuel+=8;S.energy-=8;S.flags.bledEasy=true;S.lines.push('🪝 Short sets and quick picks all day.');S.flags.hard=true}
        next()},
      tide(id,ids){id=decide(id,ids);const ev=S.flags.ev;
        if(ev==='line'){
          if(id==='ride'){S.f*=1.1;if(rand()<(big?.55:.4)){const c=D.CITE.line;S.cites.push({what:c.what,fine:c.fine,minor:false,who:'an Alaska Wildlife Trooper patrol vessel'});S.lost+=.25;S.lines.push('🚨 The trooper boat has been watching the line. Your net is across it: the catch from that set is seized.')}
            else S.lines.push('😬 You pick up just inside the line. Lucky.')}
          else{S.f*=.9;S.extraFuel+=5;S.lines.push('↩️ You pick up and re-set inside the line.')}}
        else if(ev==='torn'){
          if(id==='mend'){S.f*=.95;S.mins+=30;S.energy-=5;S.repair+=D.REPAIR[0];S.lines.push('🧵 An hour with the needle on a pitching deck. It holds.')}
          else{S.f*=.85;S.repair+=D.REPAIR[1];S.lines.push('🕳️ You fish the torn net. Fish pour out of the hole, and the tear runs.')}}
        else if(ev==='seals'){
          if(id==='haul'){S.extraFuel+=6;S.lost+=.03;S.lines.push('🦭 You haul back and move. They lose interest.')}
          else{S.lost+=.15;S.lines.push('🦭 The seals stay. A tenth of your fish are heads.')}}
        else if(ev==='corked'){
          if(id==='move'){S.extraFuel+=6;S.lines.push('↪️ You find clear water a mile north.')}
          else{S.f*=.85;S.lines.push('😤 You fish his leftovers.')}}
        else{
          if(id==='pick'){S.energy-=8;S.lines.push('🐟 A hundred fish over the roller, fresh and bright.');S.flags.hard=true}
          else{S.f*=1.12;S.flags.soft=true;S.price-=D.PRICE.soft;S.lines.push('🐟 You let it soak. The net comes up heavy, and some fish are soft.')}}
        next()},
      deliver(id,ids){id=decide(id,ids);
        if(T.kind==='set'){
          if(id==='dock'){S.flags.dock=true;S.price+=S.flags.bled?D.PRICE.dock:D.PRICE.dock*.3;S.mins+=60;S.energy-=3;S.lines.push('🚚 You truck the totes to the processor dock in Kenai.')}
          else S.lines.push('⚖️ The tender’s crane lifts the brailers aboard.');
        }else{
          if(id==='river'){S.flags.river=true;S.price+=(S.flags.bledEasy?D.PRICE.dock:D.PRICE.dock*.5);S.mins+=30;
            if(S.flags.bar){S.mins+=120;S.energy-=8;S.lines.push('⏳ The bar at the mouth is too shallow. You wait two hours outside for the flood, then deliver at the dock.');sev('gn_bar',2)}
            else S.lines.push('⚓ Over the bar on the flood and up to the processor dock in Kenai.')}
          else S.lines.push('⚖️ You raft up to the tender. Brailer by brailer, onto the scale.');
        }
        next()},
      done(){S.done=true},
    };
    const sess={
      get phase(){return S.phase},get done(){return S.done},state:S,ticket:T,
      view(){const v=V[S.phase]();v.meta={phase:S.phase,kind:T.kind,role:T.role,events:S.events.slice()};return v},
      choose(id){if(S.done)return false;const v=V[S.phase](),b=v.buttons.find(x=>x.id===id);if(!b||b.dis)return false;
        const ids=v.buttons.filter(x=>!x.dis).map(x=>x.id);ON[S.phase](id,ids);return true},
      report(){if(!S.R&&S.phase==='done')finish();return S.R?JSON.parse(JSON.stringify(S.R)):null},
    };
    // views draw randomness for their beat (seals, the tide's event): draw it once and keep the view stable
    const cache={};const V0=V;Object.keys(V0).forEach(k=>{const f=V0[k];V[k]=()=>{if(k!=='done'&&cache[k])return cache[k];const v=f();if(k!=='done')cache[k]=v;return v}});
    return sess;
  };

  // ---------- openers fished for you ----------
  // the rest of the summer (lease or own): your partner or a hired skipper fishes the openers you don't play; you keep REST.share of the net.
  // o: {kind, role, played (openers you fished), net (their total net), gross, open (fraction of the season's periods open, 0..1), count (periods you didn't play), sock, costMult}
  G.rest=function(o){
    const K=D[o.kind];if(!K||o.role==='crew') return {periods:0,gross:0,costs:0,net:0};
    const per=o.played>0?{net:o.net/o.played,gross:o.gross/o.played}:G.expect(o);
    const n=Math.round((o.count||0)*clamp(o.open==null?1:o.open,0,1));
    const gross=Math.round(per.gross*n*D.REST.share),net=Math.round(Math.min(per.net,per.gross)*n*D.REST.share);
    return {periods:n,gross,costs:gross-net,net};
  };
  // what an average opener sells and nets for a role (no decisions), for the rest of the summer when you fished none
  G.expect=function(o){const K=D[o.kind],fish=K.fish*.75*(o.sock||1),g=fish*D.LB*(o.price||1.65),cm=o.costMult||1;
    const net=o.kind==='set'?g*(1-K.permit-K.hire)-(K.ice+K.gas)*cm:g*(1-(o.role==='lease'?K.lease:0)-K.deck)-K.ice*cm-K.gal*(o.fuel||5.2);
    return {gross:Math.round(g),net:Math.round(net)}};
  // an opener you guided through instead (lease or own): your partner or hired skipper fishes it, and you keep REST.share
  G.partner=function(ticket,opt){
    const T=normTicket(ticket),rand=(opt&&opt.rand)||Math.random,K=D[T.kind];
    const R={kind:T.kind,role:T.role,partner:true,fish:0,lbs:0,price:T.price,gross:0,cashDelta:0,events:[{id:'gn_partner',sev:1}],lines:[],cites:[]};
    if(T.role==='crew'||!G.fishable(T.day)) return R;
    const fish=Math.round(K.fish*T.run*G.openerFactor(T.day)*(.75+.5*rand())*.9);
    const e=G.expect({kind:T.kind,role:T.role,sock:1,price:T.price,costMult:T.costMult,fuel:T.fuel}),per=e.gross?e.net/e.gross:.5;
    R.fish=fish;R.lbs=fish*D.LB;R.gross=Math.round(R.lbs*T.price);R.cashDelta=Math.round(R.gross*per*D.REST.share);
    R.lines.push(`${T.kind==='set'?'🪢 The family fished your site':'🚤 Your hired skipper ran the boat'} while you guided: ${fish} sockeye, ${$(R.gross)} on the ticket, <b>${$(R.cashDelta)}</b> to you after their share and the costs.`);
    return R;
  };
})(Gillnet);
