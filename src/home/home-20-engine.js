// ============================================================
//  CABIN UPKEEP, part 2: the engine.
//  Pure functions over a state object this module owns. The host hands in a ticket (the player's numbers and the season) and
//  gets a report back (cash, energy, minutes or free days, a new state, lines to show). Nothing here touches the host game.
//
//    CabinUpkeep.newState()                       a fresh state
//    CabinUpkeep.normState(x)                     fill in anything an older state is missing
//    CabinUpkeep.jobs(ticket, {all})              the jobs due now, at most MAX_DUE (events first, then by priority)
//    CabinUpkeep.resolve(ticket, jobId, optId)    do a job one of three ways: 'diy', 'pay' or 'skip'  → report
//    CabinUpkeep.daily(ticket)                    a July morning: drift, a bear, the garden harvest, a reminder  → report
//    CabinUpkeep.rollWinter(ticket) / rollSpring  the off-season: cold snap and snow become prompts in the queue; the rest happens  → report
//    CabinUpkeep.genOdds(ticket) / genFailed      will the generator start in an outage?
//    CabinUpkeep.processing(ticket)               a finished trip's fish at the station: a fee, or a spoiled batch  → report
//    CabinUpkeep.shop(ticket) / buy(ticket, id)   the things you buy once
// ============================================================
(function(C){
  'use strict';
  const D=C.data,U=C.util,{clamp,copy,n0,$}=U;
  const $c=(t,x)=>Math.round(x*t.costMult);

  // Tuning: how likely and how costly. Everything is scaled by the cabin's condition and the difficulty.
  const T=D.T={
    drift:.5,winterDrift:8,                       // condition lost a July day / a whole off-season
    coldP:.6,snowP:.75,                           // a cold snap, a heavy snow, in a winter
    freezeBase:.36,burstShare:.35,                // pipes: chance a snap freezes them untreated; share that burst
    roofP:[.3,.5,.7],collapseP:.14,             // ice dam or leak by snow depth when you skip; a shed or porch roof
    fireP:.12,coP:.03,coBase:.006,quakeP:.03,    // chimney fire, carbon monoxide (with a stove or a generator; without), a damaging quake
    breakupP:.7,wellBase:.01,wellYear:.025,septicBase:.03,septicYear:.04,
    bearBase:.004,bearFish:.012,bearOver:5,       // a bear in the yard: per day, with fish at home, if the bins are overdue
    harvest:8,moosePct:.55,                       // meals from a garden, chance a moose eats an unfenced one
    fee:4,optIn:.55,spoilBad:.3,spoilMid:.12,spoilOk:.02,
  };
  C.RUSH=520;

  // ---- the state ----
  C.newState=function(){return {v:1,cond:80,y:0,rolled:-1,sprung:-1,
    heat:{oil:1,stove:0},tape:0,skirt:0,strap:0,detect:0,bin:0,fence:0,proc:0,chill:0,sweepSkips:0,bearY:-1,rem:-1,skipAbs:-99,
    did:{sweep:-1,oil:-1,wood:-1,detest:-1,breakup:-1,well:0,septic:-1,bins:-99,genoil:-1,genrun:-1,stdef:-1},skip:{},
    garden:{y:-1},station:{tidy:100},queue:[],
    tot:{diy:0,pay:0,skip:0,events:0,lost:0,fees:0,spoiled:0,harvest:0,moose:0,bears:0}}};
  C.normState=function(x){
    const d=C.newState();if(!x||typeof x!=='object')return d;
    for(const k of Object.keys(d)){
      if(x[k]===undefined||x[k]===null)x[k]=copy(d[k]);
      else if(d[k]&&typeof d[k]==='object'&&!Array.isArray(d[k])){for(const j of Object.keys(d[k]))if(x[k][j]===undefined)x[k][j]=copy(d[k][j])}
    }
    if(!Array.isArray(x.queue))x.queue=[];
    x.cond=clamp(n0(x.cond,80),0,100);
    return x;
  };

  // ---- the ticket ----
  C.normTicket=function(t){
    t=t||{};
    const ph=['summer','fall','spring'].includes(t.phase)?t.phase:'summer';
    const g=t.gen||{};
    return {
      v:C.SCHEMA,state:C.normState(copy(t.state||null)),phase:ph,
      y:n0(t.season,0),sday:n0(t.sday,0),abs:n0(t.abs,0),                 // the season (July) this year belongs to, the day of it, a running day count
      cash:n0(t.cash,0),energy:clamp(n0(t.energy,70),0,100),rep:clamp(n0(t.rep,50),0,100),
      daysLeft:Math.max(0,n0(t.daysLeft,0)),atHome:t.atHome!==false,       // free winter days left (shared with winter camping); at the cabin in July
      costMult:n0(t.costMult,1),bad:Math.sqrt(Math.max(.1,n0(t.bad,1))),   // bad luck, softened: a 1.5 difficulty makes the cabin about 1.22 times as unlucky
                              // the difficulty's multipliers for prices and bad luck
      gen:{owned:!!g.owned,gas:g.gas==='stale'?'stale':'ok'},homeFuel:n0(t.homeFuel,0),
      outage:t.outage&&typeof t.outage==='object'?{h:n0(t.outage.h,0),gen:!!t.outage.gen}:null,   // this winter's power outage, if there was one
      recentFish:n0(t.recentFish,0),fish:n0(t.fish,0),clients:n0(t.clients,0),
    };
  };

  // risk multiplier from the cabin's condition: 0.7 in perfect shape up to 1.6 when it is falling apart
  const cm=s=>.7+.9*(1-s.cond/100);
  C.risk=s=>Math.round(cm(s)*100)/100;

  // ---- reports ----
  function newOut(){return {costs:{},cash:0,spent:0,earned:0,energy:0,rep:0,wom:0,minutes:0,days:0,daysLost:0,fuel:0,fresh:0,meals:0,lines:[],tiles:[],done:[],sev:0,remind:''}}
  function line(out,txt){out.lines.push(txt)}
  function cost(out,x,id){x=Math.round(x);out.cash-=x;out.spent+=x;if(id)out.costs[id]=(out.costs[id]||0)+x}
  function report(s,out){
    s.cond=clamp(Math.round(s.cond*10)/10,0,100);
    return {v:C.SCHEMA,state:s,cashDelta:out.cash,spent:out.spent,earned:out.earned,energyDelta:out.energy,repDelta:out.rep,womDelta:out.wom,minutes:out.minutes,
      daysUsed:out.days,daysLost:out.daysLost,homeFuel:out.fuel,freshLost:out.fresh,foodMeals:out.meals,lines:out.lines,tiles:out.tiles,done:out.done,severity:out.sev,remind:out.remind,cond:s.cond,costs:out.costs}}

  // ---- the three ways ----
  const dayTxt=n=>n<=0?'a few hours':n===1?'1 day':n+' days';
  const costTxt=(o,phase)=>o.cash?$(o.cash):'Free';
  function optList(job,s,t){
    const cfg=job.o(s,t),summer=t.phase==='summer',out=[];
    const d=cfg.diy;
    let dis='',why='',days=summer?0:d.days,e=d.e;
    if(job.kind==='event'&&!summer&&days>t.daysLeft){days=0;e=Math.round(e*1.6)}       // a storm job squeezed into the evenings
    if(summer&&!t.atHome){dis=true;why='You are away from the cabin.'}
    else if(!summer&&days>t.daysLeft){dis=true;why='Not enough free days left this winter.'}
    else if(t.energy-e<12){dis=true;why='Too tired for it right now.'}
    else if(t.cash<d.cash){dis=true;why='Not enough cash.'}
    else if(d.dis){dis=true;why=d.dis}
    out.push({id:'diy',l:'Do it yourself',s:`${d.s} ${summer?d.min+' min':dayTxt(days)} · energy −${e}`,cash:d.cash,min:summer?d.min:0,days,energy:e,gas:d.gas||0,dis:!!dis,why});
    const p=cfg.pay,pdis=t.cash<p.cash;
    out.push({id:'pay',l:'Pay someone',s:p.s,cash:p.cash,min:0,days:0,energy:0,dis:pdis,why:pdis?'Not enough cash.':''});
    out.push({id:'skip',l:'Skip it',s:cfg.skip.s,cash:0,min:0,days:0,energy:0,dis:false,why:''});
    return out;
  }
  function describe(job,s,t){return {id:job.id,ic:job.ic,kind:job.kind||'task',title:job.title(s,t),why:job.why(s,t),risk:job.risk(s,t),opts:optList(job,s,t),phase:t.phase,cond:job.cond}}

  // ---- storm jobs (the queue): a cold snap and a heavy snow ----
  const QJ={
    cold:{id:'cold',ic:'🥶',kind:'event',pr:0,cond:2,
      title:(s,t,q)=>`Cold snap tonight: ${['−10','−25','−35'][q.sev-1]}°F`,
      why:()=>'Water lines freeze first where the wind gets under the floor. Dripping the taps keeps water moving, and opening the cabinet doors lets the heat in.',
      risk:()=>'Skip it and an unprotected line can freeze or burst.',
      o:(s,t)=>({diy:{cash:0,days:0,min:20,e:3,s:'Drip the taps, open the cabinet doors, check the crawlspace at 2 AM.'},pay:{cash:$c(t,45),s:'The neighbor looks in overnight and runs the taps.'},skip:{s:'Go to bed and hope.'}})},
    snow:{id:'snow',ic:'🌨️',kind:'event',pr:1,cond:2,
      title:(s,t,q)=>`${['Heavy','A foot and more of','Two feet of'][q.depth-1]} snow on the roof and driveway`,
      why:()=>'Wet snow loads a roof and ice dams leak, and a plowed-in driveway keeps you from town and from work.',
      risk:()=>'Skip it and the roof can leak and you are plowed in for a day or two.',
      o:(s,t)=>({diy:{cash:0,days:1,min:240,e:16,s:'Rake the roof, then plow or shovel the drive.'},pay:{cash:$c(t,320),s:'A neighbor plows and a roof shoveler rakes.'},skip:{s:'Wait for it to melt.'}})},
  };

  // ---- which jobs are due ----
  function inPhase(j,t){return j.ph==='*'||j.ph.includes(t.phase)}
  function dueJobs(s,t){
    const q=s.queue.map(e=>Object.assign({q:e},QJ[e.id])).filter(j=>j.id);
    const tasks=D.JOBS.filter(j=>inPhase(j,t)&&(j.id==='bins'||s.skip[j.id]!==t.y)&&j.due(s,t)).sort((a,b)=>a.pr-b.pr);
    return q.concat(tasks);
  }
  C.jobs=function(t,o){
    t=C.normTicket(t);const s=t.state,list=dueJobs(s,t);
    const all=list.map(j=>describe(j.q?Object.assign({},j,{title:()=>j.title(s,t,j.q)}):j,s,t));
    return o&&o.all?all:all.slice(0,C.MAX_DUE);
  };
  C.dueCount=t=>{t=C.normTicket(t);return dueJobs(t.state,t).length};

  // ---- doing a job ----
  C.resolve=function(t0,jobId,optId,o){
    const t=C.normTicket(t0),s=t.state,r=(o&&o.rand)||Math.random,out=newOut();
    const list=dueJobs(s,t),j=list.find(x=>x.id===jobId);
    if(!j)return null;
    const jd=describe(j.q?Object.assign({},j,{title:()=>j.title(s,t,j.q)}):j,s,t),opt=jd.opts.find(x=>x.id===optId);
    if(!opt||opt.dis)return null;
    out.cash-=opt.cash;out.spent+=opt.cash;out.energy-=opt.energy;if(opt.cash)out.costs['job:'+optId]=(out.costs['job:'+optId]||0)+opt.cash;
    if(t.phase==='summer')out.minutes+=opt.min;else out.days+=opt.days;
    if(opt.gas)out.fuel+=opt.gas;
    const y=t.y,mark=j.id==='bins'?t.abs:y;
    s.tot[optId]++;
    if(j.kind==='event'){
      s.queue=s.queue.filter(e=>e!==j.q&&!(e.id===j.q.id));
      (j.id==='cold'?coldOutcome:snowOutcome)(s,t,optId,r,out,j.q);
      if(optId!=='skip')s.cond+=j.cond;
    }else{
      if(optId==='skip'){
        if(j.id==='bins')s.skipAbs=t.abs;else s.skip[j.id]=y;
        line(out,`⏭️ ${jd.title} skipped. ${jd.risk}`);
      }else{
        const f=D.FX[j.id];if(f)f(s,t,optId,out);
        if(j.id!=='septic'||optId==='pay')s.did[j.id]=mark;
        s.cond+=j.cond*(optId==='diy'?1:1);
        out.done.push(j.id);
        line(out,`${j.ic} ${DONE_TXT(j,optId,opt)}`);
      }
    }
    return report(s,out);
  };
  const DONE_TXT=(j,optId,opt)=>`${j.title({},{})} ${optId==='diy'?'done by your own hands':'taken care of'}${opt.cash?` (${$(opt.cash)})`:''}.`;
  // what finishing a job changes beyond its did-mark
  D.FX={
    sweep:(s)=>{s.sweepSkips=0},
    tape:(s)=>{s.tape=1},skirt:(s)=>{s.skirt=1},strap:(s)=>{s.strap=1},detect:(s)=>{s.detect=1},fence:(s)=>{s.fence=1},
    garden:(s,t)=>{s.garden.y=t.y},
    septic:(s,t,o)=>{if(o==='diy')s.did.septic=Math.max(s.did.septic,t.y-2)},
    stclean:(s,t,o)=>{s.station.tidy=Math.min(100,s.station.tidy+(o==='pay'?70:55))},
  };

  // ---- a cold snap: heat, pipes and drips ----
  function coldOutcome(s,t,optId,r,out,q){
    const m=cm(s)*t.bad,sev=q.sev,y=t.y;
    const oilOk=!!s.heat.oil&&s.did.oil===y,woodOk=!!s.heat.stove&&s.did.wood===y,heatOk=oilOk||woodOk;
    const drip=optId==='skip'?1:.35;
    line(out,`🥶 A cold snap pushes the thermometer to ${['−10','−25','−35'][sev-1]}°F.`);
    let cold=false;
    if(!heatOk){
      cold=true;cost(out,$c(t,C.RUSH),'rush');out.energy-=8;s.cond-=4;
      line(out,`🛢️ The tank runs dry in the middle of the night and the furnace quits. A rush delivery at dawn costs ${$($c(t,C.RUSH))} and the cabin is down to 40°F before it warms up.`);
    }else if(woodOk&&!oilOk)line(out,'🔥 The wood stove carries the cabin through the cold, the way it should.');
    else line(out,'🔥 The heat holds. Nice and warm inside.');
    if(s.chill){cold=true}
    let pf=T.freezeBase*[.5,1,1.6][sev-1]*(s.tape?.12:1)*(s.skirt?.55:1)*drip*(cold?2.5:1)*(s.chill?1.6:1)*m;
    pf=clamp(pf,0,.9);
    if(r()<pf){
      const burst=r()<clamp(T.burstShare*(s.tape?.45:1)*(cold?1.4:1),0,.8);
      out.sev=2;
      if(burst){cost(out,$c(t,2200),'burst');out.daysLost+=3;s.cond-=12;out.fresh=1;
        line(out,`💦 A pipe under the floor bursts. Water everywhere until you find the shutoff. The plumber and the cleanup come to ${$($c(t,2200))}, it takes about three days to dry out, and the fridge food is a loss.`)}
      else{cost(out,$c(t,380),'frozen');out.daysLost+=1;s.cond-=4;if(cold)out.fresh=1;
        line(out,`🧊 The kitchen line freezes solid. A plumber thaws it for ${$($c(t,380))} and it eats a day.${cold?' The fridge got cold enough to ruin the fresh food.':''}`)}
    }else line(out,optId==='skip'?'😮‍💨 The pipes hold, this time.':'🚰 The pipes hold. The dripping taps did their job.');
    s.chill=0;s.tot.events++;
  }

  // ---- heavy snow: roof and driveway ----
  function snowOutcome(s,t,optId,r,out,q){
    const m=cm(s)*t.bad,d=q.depth,safe=optId!=='skip';
    if(safe)line(out,optId==='diy'?'⛏️ You rake the roof and plow the drive. Your back files a complaint.':'🚜 The neighbor plows the drive and a roofer rakes the snow off the roof.');
    const pl=T.roofP[d-1]*(safe?.1:1)*m;
    if(r()<pl){const c=$c(t,1200*(1+.4*(d-1)));cost(out,c,'icedam');s.cond-=8;out.sev=2;
      line(out,`💧 Snow melts and refreezes at the eaves. An ice dam lets water in and the ceiling stains. Repairs come to ${$(c)}.`)}
    else if(!safe&&d===3&&r()<T.collapseP*m){const c=$c(t,2600);cost(out,c,'collapse');s.cond-=14;out.daysLost+=1;out.sev=2;
      line(out,`🏚️ The shed roof gives way under two feet of wet snow. Cleanup and a new roof run ${$(c)}, and a day.`)}
    else if(!safe)line(out,'🏠 The roof carries it. You were lucky.');
    if(!safe){out.daysLost+=d;line(out,`🚧 The plow doesn’t come for a while. You’re snowed in for ${d===1?'a day':d===2?'two days':'three days'}: a winter job slips or a trip gets pushed.`)}
    s.tot.events++;
  }

  // ---- the off-season: winter ----
  C.rollWinter=function(t0,o){
    const t=C.normTicket(t0),s=t.state,r=(o&&o.rand)||Math.random,out=newOut(),y=t.y,m=cm(s)*t.bad;
    if(s.rolled===y)return report(s,out);
    s.rolled=y;s.cond-=T.winterDrift;s.queue=[];
    const oilOk=!!s.heat.oil&&s.did.oil===y,woodOk=!!s.heat.stove&&s.did.wood===y,heatOk=oilOk||woodOk;
    // outage: a long one with no generator and no stove leaves the cabin cold
    const O=t.outage;
    if(O&&O.h>=12&&!O.gen&&!woodOk){s.chill=1;line(out,'🥶 The power was out long enough for the cabin to go cold: the furnace blower needs electricity. A wood stove or a generator would have kept it warm.')}
    const coldNow=r()<T.coldP,snowNow=r()<T.snowP;
    if(coldNow)s.queue.push({id:'cold',sev:1+(r()<.5?1:0)+(r()<.2?1:0)});
    if(snowNow)s.queue.push({id:'snow',depth:1+(r()<.5?1:0)+(r()<.25?1:0)});
    if(!heatOk&&!coldNow){const c=$c(t,260*1.2);cost(out,c,'late');line(out,`🛢️ You never topped up the tank, so you order a delivery in January at a worse price: ${$(c)}.`)}
    // a chimney fire
    if(s.heat.stove&&s.did.sweep!==y){
      const p=clamp(T.fireP*(1+.8*Math.min(2,s.sweepSkips))*m,0,.5);s.sweepSkips++;
      if(r()<p){const c=$c(t,s.detect?500:700);cost(out,c,'fire');out.energy-=10;s.cond-=12;out.sev=2;s.tot.events++;
        line(out,`🔥 A roar in the stovepipe: creosote has caught. You shut the damper, get everyone out and the volunteer fire department checks the chimney. A new liner and cleanup run ${$(c)}.${s.detect?' The smoke alarm gave you the head start.':''}`)}
    }
    // carbon monoxide
    const heatsWithFire=!!s.heat.stove||t.gen.owned;
    const pco=(heatsWithFire?T.coP:T.coBase)*m;
    if(r()<pco){
      if(s.detect){const c=$c(t,60);cost(out,c,'co');s.tot.events++;line(out,`🚨 The CO alarm goes off in the night. You open the doors, get out and find a blocked flue cap. ${$(c)} for a new cap, and thanks to the alarm, nobody gets hurt.`)}
      else{const c=$c(t,950);cost(out,c,'co');out.daysLost+=2;out.energy-=20;out.sev=2;s.tot.events++;
        line(out,`☠️ You wake with a pounding headache and nausea. It is carbon monoxide from a blocked flue. The ER visit comes to ${$(c)} and a couple of days to recover. Alarms would have caught it; they are cheap.`)}
    }
    return report(s,out);
  };

  // ---- the off-season: spring ----
  C.rollSpring=function(t0,o){
    const t=C.normTicket(t0),s=t.state,r=(o&&o.rand)||Math.random,out=newOut(),y=t.y,m=cm(s)*t.bad;
    if(s.sprung===y)return report(s,out);
    s.sprung=y;
    // breakup
    if(s.did.breakup!==y&&r()<clamp(T.breakupP*m,0,.95)){
      if(r()<.6){const c=$c(t,260);cost(out,c,'stuck');out.energy-=6;s.tot.events++;out.sev=1;line(out,`🚧 Breakup. The driveway is soup and the truck sinks to the axles on the first morning. A tow costs ${$(c)}.`)}
      else{const c=$c(t,900);cost(out,c,'heave');s.cond-=6;s.tot.events++;out.sev=2;line(out,`🚧 Frost heaves shift a skirting panel and a post settles. The back door sticks. A carpenter sets it right for ${$(c)}.`)}
    }
    // the well
    const wy=Math.max(0,y-s.did.well);
    if(r()<clamp(s.did.well===y?.003:T.wellBase+T.wellYear*Math.max(0,wy-1),0,.2)*m){
      const c=$c(t,1200);cost(out,c,'well');out.daysLost+=3;out.energy-=10;s.cond-=10;s.tot.events++;out.sev=2;
      line(out,`💧 The water turns cloudy, then the pump quits. Many homes around Soldotna rely on a well, and yours needs a new pump and treatment: ${$(c)}, and three days with the house barely usable.`)}
    // septic
    const over=y-s.did.septic-3;
    if(r()<clamp(over<0?.002:T.septicBase+T.septicYear*over,0,.3)*m){
      const c=$c(t,1800);cost(out,c,'septic');out.daysLost+=2;s.cond-=10;s.tot.events++;out.sev=2;
      line(out,`🚽 The septic tank backs up into the house. An emergency pump-out and a cleaned drain field come to ${$(c)}, and the house is unusable for a couple of days.`)}
    // an earthquake
    if(r()<T.quakeP*t.bad){
      if(s.strap){line(out,'🌎 A magnitude 6 quake rattles the cabin, felt across the Kenai. Dishes jump, but the strapped water heater and the anchored shelves stay put.')}
      else{const c=$c(t,1100);cost(out,c,'quake');out.daysLost+=1;s.cond-=15;s.tot.events++;out.sev=2;
        line(out,`🌎 A magnitude 6 earthquake, felt across the Kenai (like the big 2018 Anchorage quake). The water heater tips, a shelf comes down and the kitchen is a mess: ${$(c)} to fix, and a day.`)}
    }
    s.skip={};
    return report(s,out);
  };

  // ---- a July morning ----
  C.daily=function(t0,o){
    const t=C.normTicket(t0),s=t.state,r=(o&&o.rand)||Math.random,out=newOut(),y=t.y,m=cm(s)*t.bad;
    s.cond-=T.drift;
    // a bear: more likely with fish at home and bins overdue; once a summer
    if(s.bearY!==y&&t.sday>=1){
      const over=t.abs-s.did.bins>=T.bearOver;
      let p=(T.bearBase+(t.recentFish>0?T.bearFish:0))*(over?(s.bin?3:4):s.bin?.4:1)*m;
      if(r()<clamp(p,0,.5)){
        s.bearY=y;s.tot.bears++;s.tot.events++;const k=r();
        if(k<.45){const c=$c(t,120+Math.round(r()*280));cost(out,c,'bear');s.cond-=5;out.sev=1;line(out,`🐻 A black bear gets into the garbage and the fish scraps overnight. Torn bags, a dented bin and a mess all over the yard: ${$(c)} to clean and repair.`)}
        else if(k<.8){const c=$c(t,60);cost(out,c,'bear');out.minutes+=45;out.energy-=4;out.sev=1;line(out,`🐻 You wake to a bear snorting around the yard. It takes 45 minutes and a lot of banging pots before it leaves, and ${$(c)} of cleanup.`)}
        else{out.rep-=2;out.sev=1;line(out,'🐻 A bear gets into your garbage and a Fish and Game officer stops by to talk about attractants. Feeding bears, even by accident with trash, can mean a warning or a fine. You get a warning, and the neighbors hear about it. Rep −2.')}
      }
    }
    // the garden: harvest on day 10
    if(t.sday===10&&s.garden.y===y){
      const eaten=!s.fence&&r()<T.moosePct;
      if(eaten){s.tot.moose++;out.meals+=2;out.sev=1;line(out,'🫎 A cow moose and her calf stroll through the garden at dawn. They eat the kale, the carrots and half the potatoes, and leave tracks like dinner plates. You get a couple of meals out of what is left.')}
      else{out.meals+=T.harvest;s.tot.harvest+=T.harvest;line(out,`🥬 The garden comes in: potatoes, kale and carrots. ${T.harvest} meals for the kitchen.`)}
    }
    // one gentle reminder a day
    if(s.rem!==t.abs){
      const due=dueJobs(s,Object.assign({},t,{state:s}));
      if(due.length){s.rem=t.abs;const j=due[0],n=due.length;out.remind=`${j.ic} ${j.title(s,t,j.q)}${n>1?` (and ${n-1} more)`:''}. Home tab.`}
    }
    return report(s,out);
  };

  // ---- the generator ----
  C.genOdds=function(t0){
    const t=C.normTicket(t0),s=t.state,y=t.y,why=[];
    if(!t.gen.owned)return {p:0,why};
    let p=.03;
    if(s.did.genoil!==y){p+=.12;why.push('the oil was never changed')}
    if(s.did.genrun!==y){p+=.12;why.push('it was never run under load')}
    if(t.gen.gas==='stale'){p+=.18;why.push('stale gas is still in the cans')}
    return {p:clamp(p*cm(s)/1,0,.55),why};
  };
  // the generator would not start: the shop gets it going (oil, carburetor), and it is in shape afterwards
  C.genFailed=function(t0,o){
    const t=C.normTicket(t0),s=t.state,out=newOut(),c=$c(t,85);
    cost(out,c,'gen');s.did.genoil=t.y;s.did.genrun=t.y;s.tot.events++;out.sev=1;
    const why=C.genOdds(t0).why;
    line(out,`🔧 The generator coughs and dies${why.length?` (${why.join(', ')})`:''}. You get it running later with a fresh carburetor clean, oil and a new plug: ${$(c)}. Next time, service it before the power goes out.`);
    return report(s,out);
  };
  // a new generator is in shape
  C.noteGen=function(t0){const t=C.normTicket(t0),s=t.state;s.did.genoil=t.y;s.did.genrun=t.y;return report(s,newOut())};

  // ---- the fish processing station ----
  C.processing=function(t0,o){
    const t=C.normTicket(t0),s=t.state,r=(o&&o.rand)||Math.random,out=newOut();
    if(!s.proc||t.fish<=0||t.clients<=0)return report(s,out);
    const st=s.station,y=t.y;
    const spoilP=(st.tidy<30?T.spoilBad:st.tidy<55?T.spoilMid:T.spoilOk)+(s.did.stdef===y?0:.05);
    const fish=Math.min(t.fish,t.clients*3),fee=Math.round(fish*T.fee*T.optIn*t.costMult);
    st.tidy=Math.max(0,st.tidy-6);
    if(r()<spoilP){
      out.wom-=1;out.rep-=1;s.tot.spoiled++;out.sev=1;
      line(out,'🐟 A bag of fillets goes into the wrong cooler, or the sealer didn’t seal. By the time the clients unpack it at home, it’s off. You refund the fee and they tell their friends.');
    }else{
      out.earned+=fee;out.cash+=fee;out.energy-=2;s.tot.fees+=fee;
      line(out,`🐟 Fillet, vacuum-seal and freeze: ${fish>1?'a few of':''} the clients’ fish go home flat-packed. ${$(fee)} in processing fees.`);
    }
    if(st.tidy<55)line(out,'🧽 The fish table could use a scrub.');
    return report(s,out);
  };

  // ---- the shop ----
  C.shop=function(t0){
    const t=C.normTicket(t0),s=t.state;
    return D.SHOP.map(i=>{const c=$c(t,i.cost),has=i.has(s);return {id:i.id,ic:i.ic,n:i.n,d:i.d,cost:c,has,dis:has||t.cash<c,why:has?'Done':t.cash<c?'Not enough cash':''}});
  };
  C.buy=function(t0,id){
    const t=C.normTicket(t0),s=t.state,out=newOut(),it=C.shop(t0).find(x=>x.id===id);
    if(!it||it.dis)return null;
    cost(out,it.cost);
    if(id==='stove'){s.heat.stove=1;s.cond+=3}
    if(id==='station'){s.proc=1;s.station.tidy=100;s.did.stdef=t.y}
    if(id==='bin'){s.bin=1;s.cond+=1}
    line(out,`${it.ic} ${it.n}: ${$(it.cost)}.`);
    return report(s,out);
  };

  // ---- what the Home tab shows ----
  C.status=function(t0){
    const t=C.normTicket(t0),s=t.state,rows=[];
    const heat=[s.heat.oil?'furnace (heating oil or propane)':'',s.heat.stove?'wood stove':''].filter(Boolean).join(' and ');
    rows.push(['🔥 Heat',heat]);
    const prot=[s.tape?'heat tape':'',s.skirt?'skirted crawlspace':''].filter(Boolean);
    rows.push(['🚰 Freeze-proofing',prot.length?prot.join(', '):'none yet']);
    rows.push(['🚨 Detectors',s.detect?'fitted':'none']);
    if(t.gen.owned)rows.push(['🔌 Generator',C.genOdds(t).p<=.1?'serviced':'overdue for service']);
    if(s.proc)rows.push(['🐟 Fish station',`tidiness ${Math.round(s.station.tidy)}%`]);
    if(s.garden.y===t.y)rows.push(['🥬 Garden',s.fence?'fenced':'unfenced']);
    return rows;
  };
})(CabinUpkeep);
