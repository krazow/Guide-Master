// ============================================================
//  TENDER & PROCESSOR, part 2: the engine.
//  Pure functions of a ticket (the host's numbers and this module's own state) that return a report. Nothing here keeps state
//  between calls: the host stores report.state and hands it back in the next ticket.
//
//  The year of the business:
//    winter      act(ticket, id, arg): charter or buy tenders, lease space or buy a plant, borrow, set prices, hire crew, upkeep
//    spring      openSeason(ticket): upkeep and crew are paid, the season's market, runs and opener calendar are set
//    summer      opener(ticket, choice): one opener played (by you or your skipper); route(ticket, delivery): your own catch;
//                plantDay(ticket): a played morning at the plant (a small energy cost, now and then an inspection)
//    fall        closeSeason(ticket): every opener you didn't play, the plant's season, fall charter, depreciation, the loan payment,
//                then the guardrail (a forced sale if the bills would take cash below Tender.FLOOR)
// ============================================================
(function(T){
  'use strict';
  const U=T.util,D=T.data,K=D.K,{clamp,$,c2,lb,gs,seeded,hash,doyOf,dowOf,mdTxt,n0,copy,payment}=U;
  const SP=['sockeye','coho','pink','chum'];
  const rnd=o=>o&&typeof o.rand==='function'?o.rand:Math.random;

  // ---- state ----
  T.newState=function(seed){return {v:1,seed:(seed>>>0)||1,nid:1,tenders:[],plant:null,loan:null,credit:-1,policy:{offset:0,care:'bled'},maint:'basic',
    crew:{s:-1,lvl:'full'},brep:50,yrs:0,season:null,last:null,hist:[],winterCrab:false,
    tot:{lbs:0,net:0,tenderNet:0,plantNet:0,seasons:0,forced:0,bought:0,sold:0,interest:0,inspect:0,fines:0}}};
  T.normState=function(x){
    const d=T.newState(x&&x.seed);if(!x||typeof x!=='object') return d;
    for(const k in d){if(x[k]===undefined)x[k]=copy(d[k])}
    for(const k in d.tot){if(typeof x.tot[k]!=='number')x.tot[k]=0}
    if(!x.policy||typeof x.policy!=='object')x.policy=copy(d.policy);
    if(!Array.isArray(x.tenders))x.tenders=[];if(!Array.isArray(x.hist))x.hist=[];
    return x;
  };
  // a ticket from the host: anything missing gets a default
  T.normTicket=function(t){
    t=Object.assign({phase:'winter',s:0,year:2026,cash:0,floor:T.FLOOR,wind:null,rep:50,energy:80,costMult:1,diesel:5,daysLeft:10,seasonsLeft:5,md:0,
      run:{sockeye:1,coho:1,pinkEven:true,king:'closed'}},t||{});
    t.state=T.normState(t.state);t.run=Object.assign({sockeye:1,coho:1,pinkEven:true,king:'closed'},t.run||{});
    return t;
  };
  const active=st=>st.tenders.length>0||!!st.plant;
  T.active=st=>active(T.normState(st));
  T.value=st=>{st=T.normState(st);return Math.round(st.tenders.filter(v=>v.kind!=='lease').reduce((a,v)=>a+v.val,0)+(st.plant&&st.plant.kind!=='space'?st.plant.val:0))};
  T.debt=st=>{st=T.normState(st);return st.loan?Math.round(st.loan.bal):0};
  const scale=t=>n0(t.costMult,1);

  // ---- markets: drawn from the save's own seed, so a forecast is fixed and looking costs nothing ----
  function levelPick(r,p){const u=r();return u<p[0]?0:u<p[0]+p[1]?1:2}
  T.market=function(st,s){
    const r=seeded(hash(st.seed,'mkt',s)),m={};
    for(const k of ['salmon','pink','crab']) m[k]=levelPick(r,D.MKT_P[k]);
    const g={};for(const sp of Object.keys(D.GOING)){const lv=m[D.MKT_OF[sp]];g[sp]=Math.round(D.GOING[sp][lv]*(.95+r()*.1)*100)/100}
    return {lv:m,going:g,lci:{sockeye:Math.round((.7+r()*.6)*100)/100,pink:Math.round((.6+r()*.8)*100)/100}};
  };
  // what the buyers say in the winter: right about 70% of the time, otherwise one step off
  T.forecast=function(t0){
    const t=T.normTicket(t0),st=t.state,M=T.market(st,t.s),r=seeded(hash(st.seed,'fc',t.s)),f={};
    for(const k of ['salmon','pink','crab']){const a=M.lv[k];f[k]=r()<.7?a:clamp(a+(r()<.5?-1:1),0,2)}
    const W=['soft','steady','strong'];
    const text=`Buyers talk of a <b>${W[f.salmon]}</b> salmon market${f.salmon===0?' (last year’s frozen fish still in the warehouses)':f.salmon===2?' (tight supply worldwide)':''}, a <b>${W[f.pink]}</b> market for pinks${f.pink===0?' (canned pinks piling up)':''} and a <b>${W[f.crab]}</b> crab market. Talk is talk: about one winter in three it’s wrong.`;
    return {lv:f,text};
  };
  const lvTxt=i=>['weak','normal','strong'][i];

  // ---- the calendar: opener days in each area ----
  T.calendar=function(year,area,run){
    const out=[];
    if(area==='uci'){for(let md=619;md<=815;md=U.mdAdd(year,md,1)){const w=dowOf(year,md);if(w===0||w===3||(w===2&&md>=710&&md<=731&&n0(run&&run.sockeye,1)>=1.15))out.push(md)}}
    else if(area==='lci'){for(let md=620;md<=820;md=U.mdAdd(year,md,1)){const w=dowOf(year,md);if(w===0||w===2||w===4)out.push(md)}}
    return out;
  };
  // how the runs scale each catch this season (the host's run strength drives Upper Cook Inlet; Lower Cook Inlet has its own luck)
  function runF(t,M,area){
    const r=t.run;
    if(area==='uci'){const drift=r.king==='closed'?.9:1;return {sockeye:n0(r.sockeye,1)*drift,coho:n0(r.coho,1),pink:r.pinkEven?1:.15,chum:1}}
    return {sockeye:M.lci.sockeye,pink:(r.pinkEven?1:.5)*M.lci.pink,chum:1,coho:1};
  }
  const essnF=k=>k==='open'?1:k==='cr'?.5:.15;     // the east-side setnets: closed most of the season when the Kenai kings are weak
  function pool(area,md,rf){const x=doyOf(md),o={};for(const sp of SP){const F=D.FLEET[area][sp]||0,Tm=D.TIMING[area][sp];o[sp]=F*gs(x,Tm[0],Tm[1])*n0(rf[sp],1)}return o}
  // a price a pound, scaled from the sockeye offset to each species' price
  const offSp=(off,sp,g)=>off*(g[sp]||1)/(g.sockeye||1.45);

  // ---- the season opens (spring): upkeep and crew are paid, the market and calendar are set ----
  T.openSeason=function(t0,o){
    const t=T.normTicket(t0),st=copy(t.state),rep=report(st),r=rnd(o);
    if(!active(st)){st.season=null;return rep}
    const M=T.market(st,t.s);
    // the floating processor's winter crab, out west
    if(st.plant&&st.plant.kind==='floater'&&st.winterCrab&&st.wcS!==t.s){st.wcS=t.s;wcSettle(t,st,rep,M,r)}
    // upkeep: owned tenders and the plant, by this winter's choice
    const mk=st.maint,mf={full:1.5,basic:1,skip:.45}[mk]||1,mc={full:25,basic:10,skip:-12}[mk]||0;let up=0;
    st.tenders.filter(v=>v.kind==='used').forEach(v=>{up+=D.VESSELS.used.upkeep*mf;v.cond=clamp(v.cond+mc,5,100)});
    if(st.plant&&st.plant.kind!=='space'){up+=D.PLANTS[st.plant.kind].fixed*.25*mf;st.plant.cond=clamp(st.plant.cond+mc,5,100)}
    up=Math.round(up*scale(t));st.pre=(st.pre||0)+up;
    if(up){rep.cashDelta-=up;rep.spent+=up;rep.lines.push(`🔧 Winter upkeep (${mk==='full'?'a full overhaul':mk==='basic'?'the basics':'skipped where you could'}): haul-out, surveys, insurance and moorage, ${$(up)}.`)}
    // the plant crew: hired in the winter (a free day), or an agency hires a lean one late
    if(st.plant){const P=D.PLANTS[st.plant.kind];
      if(st.crew.s!==t.s){st.crew={s:t.s,lvl:'lean',agency:true};const c=Math.round(P.crew*.7*D.FIX_CREW*(1+K.AGENCY)*scale(t));rep.cashDelta-=c;rep.spent+=c;st.pre=(st.pre||0)+c;
        rep.lines.push(`👷 Nobody hired a crew over the winter, so an agency rounds up a lean one late: ${$(c)} for travel, recruiting and bunks. The line will run short-handed.`)}
      if(st.plant.kind==='floater'&&st.plant.from&&st.plant.from!==st.plant.area){const c=Math.round(P.move*scale(t));rep.cashDelta-=c;rep.spent+=c;st.pre=(st.pre||0)+c;rep.lines.push(`🛳️ The floater is towed to ${D.AREAS[st.plant.area].n}: ${$(c)}.`)}
      st.plant.from=st.plant.area}
    st.season={s:t.s,year:t.year,lv:M.lv,going:M.going,lciRun:M.lci,run:copy(t.run),essn:essnF(t.run.king),
      cal:{uci:T.calendar(t.year,'uci',t.run),lci:T.calendar(t.year,'lci',t.run)},done:[],own:{uci:{},lci:{},west:{}},
      led:{n:0,lbs:0,paid:0,rev:0,fuel:0,crew:0,repair:0,net:0,lbsSp:{}},toPlant:{uci:{},lci:{}},events:[]};
    if(M.lv.pink===0) rep.events.push({id:'weak_market',sev:1});
    const g=M.going;rep.lines.push(`📈 This season’s going prices over the rail: sockeye ${c2(g.sockeye)}, silvers ${c2(g.coho)}, pinks ${c2(g.pink)}, chums ${c2(g.chum)} a pound (a ${lvTxt(M.lv.salmon)} salmon market, a ${lvTxt(M.lv.pink)} one for pinks).`);
    guard(t,st,rep);
    return rep;
  };
  function report(st){return {state:st,cashDelta:0,spent:0,earned:0,energyDelta:0,repDelta:0,daysUsed:0,minutes:0,lines:[],events:[],forced:false}}

  // ---- an opener: the tender at anchor, buying over the rail ----
  // choice: {offset (a sockeye price a pound over or under the going price), care 'bled'|'fast', run 'now'|'tide', self: you run it}
  T.openerToday=function(t0){
    const t=T.normTicket(t0),st=t.state,S0=st.season;if(!S0||S0.s!==t.s||!t.md) return null;
    const vs=st.tenders.filter(v=>S0.cal[v.area]&&S0.cal[v.area].includes(t.md)&&!S0.done.some(x=>x.md===t.md&&x.id===v.id));
    return vs.length?{md:t.md,tenders:vs.map(v=>({id:v.id,area:v.area,name:v.name}))}:null;
  };
  function oneOpener(t,st,v,md,ch,r,exp,rep){
    const S0=st.season,A=v.area,g=S0.going,rf=runF(t,{lci:S0.lciRun},A),P=pool(A,md,rf);
    const same=st.tenders.filter(x=>x.area===A).indexOf(v);   // a second tender in the same water sees fewer boats
    const off=clamp(n0(ch.offset,0),-.15,.2),self=!!ch.self,care=ch.care==='fast'?'fast':'bled',run=ch.run==='tide'?'tide':'now';
    const share=clamp(.42+3*off+(st.brep-50)/250-(care==='bled'?.05:0)+(self?.04:0),.06,.85)*(same>0?.7:1);
    // weather: a southwest blow keeps half the fleet in, and the tender rides it out at anchor (survival suits checked, an anchor watch)
    const wind=ch.wind!=null?n0(ch.wind,8):exp?8:(r()<.12?24+Math.round(r()*10):8),blow=wind>=K.BLOW;
    const noise=(exp?1:.65+r()*.7)*(blow?.6:1);
    const cap=(v.kind==='lease'?D.VESSELS.lease.hold:D.VESSELS.used.hold)*(A==='uci'?1.8:1.3);
    let lbsSp={},tot=0;for(const sp of SP){lbsSp[sp]=P[sp]*share*noise;tot+=lbsSp[sp]}
    let turned=0;if(tot>cap){const k=cap/tot;for(const sp of SP)lbsSp[sp]*=k;turned=tot-cap;tot=cap}
    for(const sp of SP)lbsSp[sp]=Math.round(lbsSp[sp]);tot=SP.reduce((a,sp)=>a+lbsSp[sp],0);
    let qi=clamp((care==='bled'?.8:.5)+(self?.1:0)+(v.cond-60)/400-(run==='tide'?.15:0),0,1);
    let paid=0,rev=0;
    for(const sp of SP){const L=lbsSp[sp];paid+=L*(g[sp]+offSp(off,sp,g));rev+=L*(g[sp]+K.SPREAD[sp]+K.QBONUS[sp]*qi)}
    const lines=[],events=[];let repair=0,rej=0;
    if(blow)lines.push(`💨 A blow out of the southwest, ${wind} knots: half the fleet stays in. ${self?'You':'The skipper'} double${self?'':'s'} the anchor watch and check${self?'':'s'} that every survival suit aboard fits.`);
    const pRej=(run==='tide'?.12:.03)+(v.cond<45?.12:0)+(care==='fast'?.04:0);
    if(!exp&&r()<pRej){const f=.3+r()*.3;rej=Math.round(tot*f);const lost=rev*f*.3;rev-=lost;qi=Math.min(qi,.3);
      lines.push(`🌡️ The plant’s quality checker probes a warm hold: ${lb(rej)} are downgraded to number twos (${$(lost)} less).`);events.push({id:'tender_reject',sev:1})}
    const pBrk=v.cond<40?.1:v.cond<60?.02:.008;
    if(!exp&&r()<pBrk){repair=Math.round((3000+r()*5000)*scale(t));const lost=rev*.15;rev-=lost;v.cond=clamp(v.cond-6,0,100);
      lines.push(`🔧 The RSW pump quits mid-afternoon: ${$(repair)} for a mechanic flown in from Anchorage, and part of the load goes soft (${$(lost)} less).`);events.push({id:'tender_breakdown',sev:2})}
    const fuel=Math.round(K.BURN[A]*n0(t.diesel,5)*(run==='now'?1:.8)),crew=Math.round((K.DECK*K.DECK_DAY+(self?0:K.SKIPPER))*scale(t));
    const net=Math.round(rev-paid-fuel-crew-repair);
    v.cond=clamp(v.cond-1.5,0,100);
    if(turned>0)st.brep=clamp(st.brep-1,0,100);else if(off>=.05)st.brep=clamp(st.brep+.5,0,100);
    // the load goes to your own plant when it's in the same water
    if(st.plant&&st.plant.area===A) for(const sp of SP) S0.toPlant[A][sp]=(S0.toPlant[A][sp]||0)+lbsSp[sp];
    const L=S0.led;L.n++;L.lbs+=tot;L.paid+=Math.round(paid);L.rev+=Math.round(rev);L.fuel+=fuel;L.crew+=crew;L.repair+=repair;L.net+=net;
    for(const sp of SP)L.lbsSp[sp]=(L.lbsSp[sp]||0)+lbsSp[sp];
    S0.done.push({md,id:v.id,lbs:tot,net,self,qi:Math.round(qi*100)/100});
    if(!events.length) events.push({id:tot>40000?'tender_pump':'tender_anchor',sev:0});
    if(rep){rep.events.push(...events)}
    return {md,area:A,lbs:tot,lbsSp,paid:Math.round(paid),rev:Math.round(rev),fuel,crew,repair,net,qi,turned:Math.round(turned),rej,lines,events,boats:Math.max(1,Math.round(tot/(A==='uci'?2600:5200))),off};
  }
  T.opener=function(t0,choice,o){
    const t=T.normTicket(t0),st=copy(t.state),rep=report(st),r=rnd(o),today=T.openerToday(Object.assign({},t,{state:st}));
    if(!today) return Object.assign(rep,{none:true});
    const ch=Object.assign({offset:st.policy.offset,care:st.policy.care,run:'now',self:false,wind:t.wind},choice||{});
    const res=[];
    today.tenders.forEach((x,i)=>{const v=st.tenders.find(y=>y.id===x.id);res.push(oneOpener(t,st,v,t.md,i===0?ch:Object.assign({},ch,{self:false}),r,false,rep))});
    let net=0;res.forEach(x=>{net+=x.net});
    rep.cashDelta+=net;rep.earned+=Math.max(0,net);rep.results=res;
    res.forEach((x,i)=>{
      const who=i===0&&ch.self?'You run':'Your skipper runs';
      rep.lines.push(`⚓ ${who} the ${st.tenders.find(v=>v.id===today.tenders[i].id).name} ${D.AREAS[x.area].where}: ${x.boats} boat${x.boats>1?'s':''} alongside, ${lb(x.lbs)} bought at ${c2(st.season.going.sockeye+x.off)} for sockeye. Delivered to the plant, after crew and fuel: <b>${$(x.net)}</b>.${x.turned?` You turn away ${lb(x.turned)}: the hold is full.`:''}`);
      rep.lines.push(...x.lines)});
    if(ch.self){rep.energyDelta-=K.SELF_ENERGY+(n0(ch.wind,8)>=K.BLOW?5:0)}
    if(net<0) rep.events.push({id:'tender_anchor',sev:1});
    guard(t,st,rep);
    return rep;
  };

  // ---- your own catch (gillnet, seine, crab modules): sold to your own buyer when you have one in that water ----
  const areaOf=a=>{a=String(a||'').toLowerCase();return /lci|lower|homer|kachemak|seldovia|kamishak/.test(a)?'lci':/west|bering|dutch|kodiak|adak|unalaska|bristol/.test(a)?'west':/uci|upper|cook|kenai|kasilof|central|nikiski|ninilchik/.test(a)?'uci':a};
  T.areaOf=areaOf;
  T.buyerIn=function(t0,area){
    const st=T.normState(t0&&t0.state),A=areaOf(area);
    if(A==='west') return !!(st.plant&&st.plant.kind==='floater'&&st.winterCrab);
    if(!st.season) return false;
    return st.tenders.some(v=>v.area===A)||!!(st.plant&&st.plant.area===A);
  };
  T.route=function(t0,delivery){
    const t=T.normTicket(t0),st=copy(t.state),rep=report(st),d=delivery||{},A=areaOf(d.area),sp=String(d.species||'sockeye').toLowerCase().replace(/^red.*|^sock.*/,'sockeye').replace(/^silver.*|^coho.*/,'coho').replace(/^pink.*|^humpy.*/,'pink').replace(/^chum.*|^dog.*/,'chum').replace(/.*crab.*/,'crab');
    const lbs=Math.max(0,Math.round(n0(d.lbs,0)));
    if(!T.buyerIn({state:st},A)||!lbs) return Object.assign(rep,{routed:false});
    const g=st.season?st.season.going:T.market(st,t.s).going,price=Math.round(((g[sp]||g.sockeye)+offSp(st.policy.offset,sp,g))*100)/100;
    if(A==='west'){st.wcOwn=(st.wcOwn||0)+lbs}
    else{const o=st.season.own[A];o[sp]=(o[sp]||0)+lbs}
    rep.routed=true;rep.price=price;rep.value=Math.round(price*lbs);rep.area=A;rep.species=sp;
    rep.lines.push(`🤝 ${lb(lbs)} of your own ${sp==='crab'?'crab':sp==='coho'?'silvers':sp} go to your own ${A==='west'?'floater':st.plant&&st.plant.area===A?st.plant.name:'tender'} at your posted ${c2(price)} a pound.`);
    return rep;
  };

  // ---- a played morning at the plant ----
  T.plantDay=function(t0,o){
    const t=T.normTicket(t0),st=copy(t.state),rep=report(st);
    if(!st.plant||!st.season) return rep;
    rep.energyDelta-=K.PLANT_ENERGY;
    return rep;
  };

  // ---- the plant's season ----
  function plantSeason(t,st,r,exp){
    const p=st.plant,P=D.PLANTS[p.kind],S0=st.season,A=p.area,g=S0.going,lv=S0.lv,mix=D.MIX[p.mix]?p.mix:'hg',out={lines:[],events:[]};
    const rf=runF(t,{lci:S0.lciRun},A);
    // the season's outside supply, split by species like the fleet's catch
    const tot={};let sum=0;S0.cal[A].forEach(md=>{const q=pool(A,md,rf);for(const sp of SP){tot[sp]=(tot[sp]||0)+q[sp];sum+=q[sp]}});
    let base=0;S0.cal[A].forEach(md=>{const q=pool(A,md,{sockeye:1,coho:1,pink:1,chum:1});for(const sp of SP)base+=q[sp]});   // an average season's pool, for scale
    const pull=clamp(1+4*st.policy.offset+(st.brep-50)/120,.4,1.6),noise=exp?1:.8+r()*.4;
    const outside={},dock={};for(const sp of SP){outside[sp]=base?D.OUTSIDE[p.kind]*(tot[sp]/base)*pull*noise:0;dock[sp]=0}
    if(A==='uci'){const sn=D.SETNET[p.kind]*S0.essn*n0(t.run.sockeye,1)*pull;dock.sockeye+=sn*.92;dock.coho+=sn*.05;dock.chum+=sn*.03}
    const own=S0.own[A]||{},fromT=S0.toPlant[A]||{};
    for(const sp of Object.keys(own)) dock[sp]=(dock[sp]||0)+own[sp];
    // capacity: crew, condition, the product, an inspection shutdown
    const crewF={full:1,lean:.75}[st.crew.s===S0.s?st.crew.lvl:'lean']||.75,condF=p.cond<40?.85:1,speed=mix==='fillet'?D.MIX_ADD.fillet.speed:1;
    let shut=0,fine=0,repair=0;
    const pIns=.06+.45*Math.pow(1-p.cond/100,1.5);
    if(!exp&&r()<pIns){shut=1+Math.floor(r()*3);fine=Math.round((2000+r()*14000)*(p.kind==='floater'?1.6:p.kind==='space'?.4:1)*scale(t));
      out.lines.push(`🧾 The state food-safety inspector writes up the plant (sanitation, a cold-chain log with gaps): ${$(fine)} and ${shut} day${shut>1?'s':''} shut down to fix it.`);out.events.push({id:'plant_inspect',sev:1})}
    else if(!exp) out.events.push({id:'plant_line',sev:0});
    const permit=p.kind==='space'?0:Math.round((p.kind==='floater'?6000:4000)*scale(t));
    if(!exp&&p.kind!=='space'&&p.cond<40&&r()<.3){const f=Math.round((10000+r()*20000)*scale(t));fine+=f;out.lines.push(`🚱 Fish waste piles up under the outfall: the wastewater discharge permit is violated and the fine is ${$(f)}.`);out.events.push({id:'plant_fine',sev:2})}
    const days=D.AREAS[A].days,cap=P.cap*Math.max(0,days*.62-shut)*crewF*condF*speed;
    let supT=0,supO=0,supD=0;for(const sp of SP){supT+=fromT[sp]||0;supO+=outside[sp];supD+=dock[sp]||0}
    const want=supT+supO+supD;let kO=1,kD=1,turned=0;
    if(want>cap){const room=Math.max(0,cap-supT-supD);if(supO>room){kO=supO?room/supO:0;turned+=supO-room}
      if(supT+supD>cap){kD=Math.max(0,(cap-supT)/Math.max(1,supD));turned+=supD*(1-kD)}}
    if(turned>cap*.05){st.brep=clamp(st.brep-3,0,100);out.lines.push(`🚫 At the peak the line can’t keep up: you turn away ${lb(turned)} and the fleet notices.`)}
    // margins a pound over the going price
    const L={lbs:0,gross:0,bySp:{}};
    const mOf=sp=>{let m=D.MARGIN[sp][lv[D.MKT_OF[sp]]];
      if(mix==='fresh'&&D.MIX_ADD.fresh[sp])m+=D.MIX_ADD.fresh[sp]*D.MIX_ADD.fresh.share;
      if(mix==='fillet'&&D.MIX_ADD.fillet[sp]!=null)m+=D.MIX_ADD.fillet[sp];
      if(mix==='can'&&D.MIX_ADD.can[sp])m=D.MIX_ADD.can[sp][lv[D.MKT_OF[sp]]];
      if(p.cond<35)m-=.03;
      return m};
    for(const sp of SP){const m=mOf(sp);
      const t1=(fromT[sp]||0)*(want>cap?1:1),o1=outside[sp]*kO,d1=(dock[sp]||0)*kD;
      const gsp=(t1+o1)*m+d1*(m+K.SPREAD[sp]-offSp(st.policy.offset,sp,g));
      L.lbs+=t1+o1+d1;L.gross+=gsp;L.bySp[sp]=Math.round(t1+o1+d1)}
    // crab sections from your own crab boats, in Homer
    if(A==='lci'&&own.crab){const m=D.MARGIN.crab[lv.crab]+K.SPREAD.crab-offSp(st.policy.offset,'crab',g);L.lbs+=own.crab;L.gross+=own.crab*m;L.bySp.crab=own.crab}
    if(!exp&&mix==='fresh'&&r()<.15){const lost=Math.round(L.lbs*D.MIX_ADD.fresh.share*.08*1.2);L.gross-=lost;out.lines.push(`☀️ A hot afternoon on the tarmac in Anchorage: a fresh shipment arrives soft and the buyer takes ${$(lost)} off.`)}
    if(!exp&&r()<.05+(p.cond<50?.1:0)){repair=Math.round((5000+r()*10000)*(p.kind==='floater'?2:p.kind==='space'?.5:1)*scale(t));const lost=Math.round(Math.max(0,L.gross)*.04);L.gross-=lost;
      out.lines.push(`🧊 A blast freezer’s compressor fails at the peak: ${$(repair)} to fix it and ${$(lost)} of product downgraded.`);out.events.push({id:'plant_freezer',sev:2})}
    const crewCost=0;   // paid when the crew is hired
    const fixed=Math.round((P.fixed*.75+(mix==='fresh'?D.FRESH_FIX[p.kind]:0))*scale(t)),energy=Math.round(D.ENERGY[p.kind]*n0(t.diesel,5)/5);
    p.cond=clamp(p.cond-10,0,100);
    const net=Math.round(L.gross-fixed-energy-permit-fine-repair-crewCost);
    out.lbs=Math.round(L.lbs);out.gross=Math.round(L.gross);out.fixed=fixed;out.energy=energy;out.permit=permit;out.fine=fine;out.repair=repair;out.net=net;out.bySp=L.bySp;out.shut=shut;out.turned=Math.round(turned);out.mix=mix;
    if(lv.pink===0&&(L.bySp.pink||0)>0)out.events.push({id:'weak_market',sev:1});
    if(p.kind==='floater')out.events.push({id:'floater_bay',sev:0});
    return out;
  }
  // the winter crab out west (a floating processor you send there)
  function wcSettle(t,st,rep,M,r){
    const lvl=M.lv.crab,vol=450000*(.6+r()*.8)+(st.wcOwn||0),m=D.MARGIN.crab[lvl],fixed=Math.round(170000*scale(t));
    let net=Math.round(vol*m-fixed),line=`🦀 The floater’s winter out west: ${lb(vol)} of crab into sections (a ${lvTxt(lvl)} crab market), after crew, fuel and the run out and back: <b>${$(net)}</b>.`;
    if(r()<.1){const c=Math.round(60000*scale(t));net-=c;line+=` Ice and a long blow cost two weeks and ${$(c)}.`}
    st.wcOwn=0;rep.cashDelta+=net;if(net>0)rep.earned+=net;else rep.spent-=net;rep.lines.push(line);rep.events.push({id:'crab_west',sev:net<0?1:0});
    st.tot.plantNet+=net;st.tot.net+=net;
  }

  // ---- the season closes (fall): what you didn't play, the plant, the winter's bills ----
  function settleRest(t,st,r,exp){
    const S0=st.season,res=[];
    st.tenders.forEach(v=>{(S0.cal[v.area]||[]).forEach(md=>{if(S0.done.some(x=>x.md===md&&x.id===v.id))return;
      res.push(oneOpener(t,st,v,md,{offset:st.policy.offset,care:st.policy.care,run:'now',self:false},r,exp,null))})});
    // your own catch sold through a tender when there's no plant in that water
    let ownNet=0;for(const A of ['uci','lci']){if(st.plant&&st.plant.area===A)continue;const o=S0.own[A]||{},g=S0.going;
      for(const sp of Object.keys(o)){if(sp==='crab')continue;ownNet+=o[sp]*(K.SPREAD[sp]+K.QBONUS[sp]*.7-offSp(st.policy.offset,sp,g))}}
    return {res,ownNet:Math.round(ownNet)};
  }
  T.closeSeason=function(t0,o){
    const t=T.normTicket(t0),st=copy(t.state),rep=report(st),r=rnd(o),S0=st.season;
    if(!S0){winterBills(t,st,rep,r);guard(t,st,rep);return rep}
    const played=S0.led.n,playedNet=S0.led.net,rest=settleRest(t,st,r,false);
    const restNet=rest.res.reduce((a,x)=>a+x.net,0)+rest.ownNet,restLbs=rest.res.reduce((a,x)=>a+x.lbs,0);
    const tFixed=Math.round(st.tenders.length*8000*scale(t));   // the tender crews' season: food, gear, protection & indemnity insurance
    const tNet=playedNet+restNet-tFixed;
    rep.cashDelta+=restNet-tFixed;
    const st1={s:S0.s,openers:S0.led.n,lbs:S0.led.lbs,tender:tNet,plant:0,winter:0,lv:S0.lv};
    if(st.tenders.length) rep.lines.push(`⚓ <b>Tendering, ${S0.year}:</b> ${S0.led.n} opener${S0.led.n===1?'':'s'} (${played} played), ${lb(S0.led.lbs)} bought. After the fish, fuel, crew, repairs and ${$(tFixed)} of season costs: <b>${$(tNet)}</b> (${$(playedNet)} came in on the days you played; ${$(restNet-tFixed)} settles now).`);
    rest.res.forEach(x=>rep.lines.push(...x.lines.map(l=>l.replace(/^(\S+) /,`$1 ${mdTxt(x.md)}: `))));
    rest.res.forEach(x=>rep.events.push(...x.events.filter(e=>e.sev>0)));
    if(st.plant){const ps=plantSeason(t,st,r,false);st1.plant=ps.net;rep.cashDelta+=ps.net;
      const sp=Object.keys(ps.bySp).filter(k=>ps.bySp[k]>0).map(k=>`${lb(ps.bySp[k])} ${k==='coho'?'silvers':k}`).join(', ');
      rep.lines.push(`${D.PLANTS[st.plant.kind].ic} <b>Your ${st.plant.name}, ${S0.year}:</b> ${lb(ps.lbs)} through the line as ${D.MIX[ps.mix].short} (${sp||'nothing'}). Margin on the fish ${$(ps.gross)}; plant costs ${$(ps.fixed)}, energy ${$(ps.energy)}${ps.permit?`, discharge permit ${$(ps.permit)}`:''}${ps.fine?`, fines ${$(ps.fine)}`:''}${ps.repair?`, repairs ${$(ps.repair)}`:''}: <b>${$(ps.net)}</b>.`);
      rep.lines.push(...ps.lines);rep.events.push(...ps.events);
      if(ps.fine)st.tot.fines+=ps.fine;if(ps.shut)st.tot.inspect++;st.tot.plantNet+=ps.net}
    st.tot.lbs+=S0.led.lbs;st.tot.tenderNet+=tNet;
    const wb=winterBills(t,st,rep,r);
    st1.winter=wb.fall-wb.int;st1.pre=Math.round(st.pre||0);st1.net=tNet+st1.plant+st1.winter-st1.pre;st.pre=0;
    st.tot.net+=st1.net;st.tot.seasons++;st.yrs++;
    st.last=st1;st.hist.push(st1);if(st.hist.length>12)st.hist.shift();
    st.season=null;
    if(rep.cashDelta>0)rep.earned+=rep.cashDelta;else rep.spent+=-rep.cashDelta;
    guard(t,st,rep);
    return rep;
  };
  // fall charter, depreciation, the end of charters and leases, the loan payment
  function winterBills(t,st,rep,r){
    const wb={fall:0,int:0};
    st.tenders.slice().forEach(v=>{
      if(v.kind==='lease'){st.tenders=st.tenders.filter(x=>x!==v);rep.lines.push(`⚓ The charter on the ${v.name} ends; she goes back to her owner.`);return}
      const V=D.VESSELS.used;
      if(v.cond>=45){const f=Math.round(V.fall*scale(t));rep.cashDelta+=f;wb.fall+=f;v.cond=clamp(v.cond-6,0,100);rep.lines.push(`🚢 A processor charters the ${v.name} for fall work: ${$(f)}.`)}
      const drop=Math.round(v.val*V.dep);v.val-=drop});
    if(st.plant){const p=st.plant;
      if(p.kind==='space'){rep.lines.push('🏚️ The lease on your line space ends with the season. Lease it again in the winter if you want it next year.');st.plant=null}
      else{const drop=Math.round(p.val*D.PLANTS[p.kind].dep);p.val-=drop}}
    if(st.loan&&st.loan.bal>0){const L=st.loan,int=Math.round(L.bal*L.rate),pay=Math.round(Math.min(L.bal+int,payment(L.bal,L.rate,Math.max(1,L.left))));
      L.bal=Math.max(0,Math.round(L.bal+int-pay));L.left=Math.max(0,L.left-1);rep.cashDelta-=pay;st.tot.interest+=int;wb.int=int;
      rep.lines.push(`🏦 Loan payment ${$(pay)} (${$(int)} of it interest). ${L.bal>0?`${$(L.bal)} left to pay.`:'The loan is paid off.'}`);
      if(L.bal<=0)st.loan=null}
    st.brep=Math.round(st.brep+(50-st.brep)*.2);
    return wb;
  }
  // ---- the guardrail: the business can fail and be sold off, but it never takes cash below the floor ----
  function guard(t,st,rep){
    const cash=n0(t.cash,0),room=Math.max(0,cash-n0(t.floor,T.FLOOR));
    if(rep.cashDelta>=-room) return;
    if(!active(st)&&!st.loan){rep.lines.push('🏦 The bank lets you carry the rest.');rep.cashDelta=-room;return}
    // first the bank carries the loss on the loan, as long as the boats and the plant cover it (and your credit is good)
    const short=-room-rep.cashDelta,cover=Math.round(T.value(st)*K.CARRY)-(st.loan?st.loan.bal:0);
    if(st.credit<=n0(t.s,0)&&cover>=short){borrow(t,st,short,rep,true);rep.cashDelta=-room;rep.carried=short;
      rep.lines.push(`🏦 The season’s bills are more than you can pay, so the bank adds ${$(short)} to your loan, against the boats and the plant.`);return}
    const sale=forcedSale(t,st);
    rep.cashDelta+=sale.net;rep.forced=true;rep.lines.push(...sale.lines);rep.events.push({id:'forced_sale',sev:2});
    if(rep.cashDelta<-room){const w=-room-rep.cashDelta;rep.cashDelta=-room;rep.lines.push(`🏦 The bank writes off the last ${$(w)}. Your credit is shot for a few years.`)}
  }
  function forcedSale(t,st){
    const lines=[];let got=0;
    st.tenders.forEach(v=>{if(v.kind==='used'){const p=Math.round(v.val*K.FIRE);got+=p;lines.push(`🔨 The ${v.name} goes at the dock auction for ${$(p)}.`)}});
    if(st.plant&&st.plant.kind!=='space'){const p=Math.round(st.plant.val*K.FIRE);got+=p;lines.push(`🔨 Your ${st.plant.name} sells to a bigger processor for ${$(p)}, a fraction of what it’s worth.`)}
    const owe=st.loan?st.loan.bal:0;
    lines.unshift(`🔨 <b>The business can’t pay its bills.</b> The bank calls the loan and everything is sold.`);
    if(owe)lines.push(`🏦 ${$(Math.min(owe,got))} of it goes to the bank.`);
    lines.push('Your guide business carries on: the river doesn’t care what happened at the plant.');
    st.tenders=[];st.plant=null;st.loan=null;st.season=st.season?Object.assign(st.season,{closed:true}):null;st.credit=n0(t.s,0)+K.NO_CREDIT;st.brep=40;st.tot.forced++;
    if(st.season)st.season=null;
    return {net:got-owe,lines};
  }
  // ---- the rest of this season as an estimate (no luck either way): for the score when a career ends mid-season ----
  T.estimate=function(t0){
    const t=T.normTicket(t0),st=copy(t.state);if(!st.season) return 0;
    const r=()=>.5,rest=settleRest(t,st,r,true);let net=rest.res.reduce((a,x)=>a+x.net,0)+rest.ownNet-st.tenders.length*8000*scale(t);
    if(st.plant)net+=plantSeason(t,st,r,true).net;
    return Math.round(net);
  };

  // ---- the winter: things you can do, and doing them ----
  const nameT=st=>{const n=['Northern Light','Kasilof Belle','Arctic Tern','Cape Ninilchik','Silver Spray','Inlet Queen'];return n[(st.nid+st.tenders.length)%n.length]};
  T.why=function(t0,id,arg){
    const t=T.normTicket(t0),st=t.state,a=arg||{};
    if(t.phase!=='winter') return 'Only in the off-season';
    const loanOK=()=>st.credit>t.s?'The bank won’t lend after the forced sale':t.rep<K.BUY_REP?`A loan needs reputation ${K.BUY_REP}`:null;
    // a purchase must leave the guide's working money, the floor, and the first season's crew and upkeep in the bank
    const keep=k=>n0(t.floor,T.FLOOR)+Math.round(reserve(k)*scale(t)),short=(pay,k)=>t.cash-pay<keep(k)?`Keep ${$(keep(k))} for your guiding${reserve(k)?' and the first season’s crew and upkeep':''}`:null;
    const buy=(price,k)=>{const c=Math.round(price*scale(t));if(a.loan){const w=loanOK();if(w)return w;if(t.cash<c*K.DOWN)return `Needs ${$(Math.round(c*K.DOWN))} down`;return short(Math.round(c*K.DOWN),k)}return t.cash<c?'Can’t afford it':short(c,k)};
    switch(id){
      case 'lease':if(st.tenders.length>=K.MAX_TENDERS)return `${K.MAX_TENDERS} tenders is all you can crew`;if(t.rep<K.LEASE_REP)return `Needs reputation ${K.LEASE_REP}`;if(t.cash<D.VESSELS.lease.cost*scale(t))return 'Can’t afford the charter';return short(Math.round(D.VESSELS.lease.cost*scale(t)),'lease');
      case 'buyT':if(st.tenders.length>=K.MAX_TENDERS)return `${K.MAX_TENDERS} tenders is all you can crew`;if(t.rep<K.BUY_REP)return `Needs reputation ${K.BUY_REP}`;return buy(D.VESSELS.used.price,'buyT');
      case 'sellT':{const v=st.tenders.find(x=>x.id===a.id);return !v?'No such tender':v.kind==='lease'?'A charter can’t be sold':null}
      case 'space':case 'shore':case 'floater':{
        if(st.plant)return `Sell your ${st.plant.name} first`;
        if(id==='space'){if(st.yrs<1)return 'Tender a season first';return t.cash<D.PLANTS.space.lease*scale(t)?'Can’t afford the lease':short(Math.round(D.PLANTS.space.lease*scale(t)),'space')}
        if(t.rep<K.BUY_REP)return `Needs reputation ${K.BUY_REP}`;
        if(id==='shore'&&st.yrs<2)return 'Needs two seasons in the business';
        if(id==='floater'&&st.yrs<3)return 'Needs three seasons in the business';
        if(id==='floater'&&t.rep<65)return 'Needs reputation 65';
        return buy(D.PLANTS[id].price,id)}
      case 'sellP':return !st.plant?'No plant':st.plant.kind==='space'?'A lease can’t be sold':null;
      case 'crew':return !st.plant?'No plant to crew':st.crew.s===t.s+0?'Already hired':t.daysLeft<K.CREW_DAY?'No free days left this winter':t.cash<crewCost(t,st,a.lvl||'full')?'Can’t afford the crew':null;
      case 'payLoan':return !st.loan?'No loan':t.cash<Math.min(st.loan.bal,n0(a.amt,st.loan.bal))?'Not enough cash':null;
      case 'wcrab':return !(st.plant&&st.plant.kind==='floater')?'Needs a floating processor':null;
      default:return null;
    }
  };
  // what a new venture needs in the bank for its first season: a tender's crew and fuel, a plant's crew and upkeep
  const reserve=k=>k==='buyT'?15000:D.PLANTS[k]?D.PLANTS[k].crew*D.FIX_CREW+(k==='space'?0:D.PLANTS[k].fixed*.25):0;
  const crewCost=(t,st,lvl)=>st.plant?Math.round(D.PLANTS[st.plant.kind].crew*(lvl==='lean'?.7:1)*D.FIX_CREW*(st.plant.mix==='fillet'?D.MIX_ADD.fillet.crew:1)*scale(t)):0;
  T.crewCost=(t0,lvl)=>{const t=T.normTicket(t0);return crewCost(t,t.state,lvl)};
  T.price=(t0,id)=>{const t=T.normTicket(t0);return Math.round((id==='lease'?D.VESSELS.lease.cost:id==='space'?D.PLANTS.space.lease:id==='buyT'?D.VESSELS.used.price:D.PLANTS[id]?D.PLANTS[id].price:0)*scale(t))};
  T.saleValue=function(t0,what){
    const t=T.normTicket(t0),st=t.state;
    if(what==='plant'){if(!st.plant||st.plant.kind==='space')return 0;const weak=T.forecast(t).lv.salmon===0;return Math.round(st.plant.val*(weak?K.SELL_WEAK:K.SELL_PLANT))}
    const v=st.tenders.find(x=>x.id===what);return v&&v.kind==='used'?Math.round(v.val*K.SELL_TENDER):0;
  };
  function borrow(t,st,amt,rep,quiet){
    if(amt<=0)return;const L=st.loan||{bal:0,rate:K.RATE,left:K.TERM};L.bal=Math.round(L.bal+amt);L.left=K.TERM;L.rate=K.RATE;st.loan=L;
    if(!quiet)rep.lines.push(`🏦 The bank lends you ${$(amt)} at ${Math.round(K.RATE*100)}% a year over ${K.TERM} years (about ${$(Math.round(payment(L.bal,L.rate,L.left)))} a year).`);
  }
  T.act=function(t0,id,arg){
    const t=T.normTicket(t0),st=copy(t.state),rep=report(st),a=arg||{},w=T.why(Object.assign({},t,{state:st}),id,a);
    if(w){rep.lines.push(w);rep.refused=w;return rep}
    const pay=c=>{rep.cashDelta-=c;rep.spent+=c},pre=c=>{st.pre=(st.pre||0)+c};
    const area=a.area==='lci'?'lci':'uci';
    switch(id){
      case 'lease':{const c=T.price(t,'lease');pay(c);pre(c);const v={id:st.nid++,kind:'lease',area,cond:D.VESSELS.lease.cond,val:0,name:nameT(st),from:t.s};st.tenders.push(v);
        rep.lines.push(`⚓ You charter the <b>${v.name}</b> for the season (${$(c)}), to buy ${D.AREAS[area].short} fish ${D.AREAS[area].where}.`);rep.events.push({id:'tender_anchor',sev:0});break}
      case 'buyT':{const c=T.price(t,'buyT'),down=a.loan?Math.round(c*K.DOWN):c;pay(down);if(a.loan)borrow(t,st,c-down,rep);
        const v={id:st.nid++,kind:'used',area,cond:D.VESSELS.used.cond,val:c,cost:c,name:nameT(st),from:t.s};st.tenders.push(v);st.tot.bought+=c;
        rep.lines.push(`🚢 You buy the <b>${v.name}</b>, a used 58-ft steel tender, for ${$(c)}${a.loan?` (${$(down)} down)`:''}. A Coast Guard dockside exam, a survey for the insurance and she’s yours.`);rep.events.push({id:'tender_anchor',sev:0});break}
      case 'sellT':{const v=st.tenders.find(x=>x.id===a.id),p=T.saleValue({state:st},v.id);rep.cashDelta+=p;rep.earned+=p;st.tenders=st.tenders.filter(x=>x!==v);st.tot.sold+=p;
        rep.lines.push(`🚢 You sell the ${v.name} for ${$(p)}.`);payDown(st,rep);break}
      case 'areaT':{const v=st.tenders.find(x=>x.id===a.id);if(v){v.area=area;rep.lines.push(`⚓ The ${v.name} will work ${D.AREAS[area].n} this summer.`)}break}
      case 'space':{const c=T.price(t,'space');pay(c);pre(c);st.plant={kind:'space',area,cond:70,val:0,mix:'hg',name:'leased line space',from:area};
        rep.lines.push(`🏚️ You lease line space at a custom processor in ${D.AREAS[area].port} for the season (${$(c)}). Your crew, your fish, their freezers.`);rep.events.push({id:'plant_line',sev:0});break}
      case 'shore':case 'floater':{const P=D.PLANTS[id],c=T.price(t,id),down=a.loan?Math.round(c*K.DOWN):c;pay(down);if(a.loan)borrow(t,st,c-down,rep);
        st.plant={kind:id,area,cond:id==='shore'?62:58,val:c,cost:c,mix:'hg',name:id==='shore'?`plant in ${D.AREAS[area].port}`:'floating processor',from:area};st.tot.bought+=c;st.crew={s:-1,lvl:'full'};
        rep.lines.push(`${P.ic} You buy ${id==='shore'?`a small shore plant in ${D.AREAS[area].port}`:'an old floating processor'} for ${$(c)}${a.loan?` (${$(down)} down)`:''}. State food-safety and wastewater discharge permits transfer with it, after an inspection.`);
        rep.events.push({id:id==='floater'?'floater_bay':'plant_line',sev:0});break}
      case 'sellP':{const p=T.saleValue({state:st,s:t.s},'plant');rep.cashDelta+=p;rep.earned+=p;st.tot.sold+=p;rep.lines.push(`🏭 You sell your ${st.plant.name} for ${$(p)}.`);st.plant=null;st.winterCrab=false;payDown(st,rep);break}
      case 'mix':{if(st.plant&&D.MIX[a.mix]&&(!D.MIX[a.mix].can||D.PLANTS[st.plant.kind].can)){st.plant.mix=a.mix;rep.lines.push(`🏭 This season the line packs ${D.MIX[a.mix].short}.`)}break}
      case 'parea':{if(st.plant&&st.plant.kind==='floater'){st.plant.area=area;rep.lines.push(`🛳️ The floater will anchor in ${D.AREAS[area].n} this summer (a tow of ${$(Math.round(D.PLANTS.floater.move*scale(t)))} when the season opens).`)}break}
      case 'wcrab':{st.winterCrab=!st.winterCrab;rep.lines.push(st.winterCrab?'🦀 The floater will winter out west, processing crab.':'🦀 The floater stays tied up this winter.');break}
      case 'crew':{const lvl=a.lvl==='lean'?'lean':'full',c=crewCost(t,st,lvl);pay(c);pre(c);st.crew={s:t.s,lvl};rep.daysUsed=K.CREW_DAY;
        rep.lines.push(`👷 You spend ${K.CREW_DAY===1?'a day':K.CREW_DAY+' days'} on the phone and at a job fair and hire a ${lvl} crew of ${Math.round(D.PLANTS[st.plant.kind].crew*(lvl==='lean'?.7:1))} for next summer: ${$(c)} for travel, recruiting and bunks.`);break}
      case 'maint':{st.maint=['full','basic','skip'].includes(a.lvl)?a.lvl:'basic';rep.lines.push(`🔧 Winter upkeep: ${st.maint==='full'?'a full overhaul':st.maint==='basic'?'the basics':'skip what you can'}. It’s paid when the season opens.`);break}
      case 'price':{st.policy.offset=clamp(Math.round(n0(a.offset,0)*100)/100,-.15,.2);if(a.care)st.policy.care=a.care==='fast'?'fast':'bled';
        rep.lines.push(`💲 Your posted price: ${st.policy.offset===0?'the going price':`${st.policy.offset>0?'+':''}${c2(st.policy.offset)} over the going price`} for sockeye, ${st.policy.care==='bled'?'bled fish only':'every fish, fast'}.`);break}
      case 'payLoan':{const amt=Math.min(st.loan.bal,Math.round(n0(a.amt,st.loan.bal)));pay(amt);st.loan.bal-=amt;rep.lines.push(`🏦 You pay ${$(amt)} on the loan.${st.loan.bal<=0?' It’s paid off.':''}`);if(st.loan.bal<=0)st.loan=null;break}
    }
    return rep;
  };
  // a sale pays the loan down first
  function payDown(st,rep){if(!st.loan)return;const amt=Math.min(st.loan.bal,Math.max(0,rep.cashDelta));if(amt>0){rep.cashDelta-=amt;st.loan.bal-=amt;rep.lines.push(`🏦 ${U.$(amt)} of it pays down the loan.${st.loan.bal<=0?' The loan is paid off.':''}`);if(st.loan.bal<=0)st.loan=null}}

  // ---- what the planner shows ----
  T.status=function(t0){
    const t=T.normTicket(t0),st=t.state,rows=[];
    st.tenders.forEach(v=>rows.push(['⚓ '+v.name,`${v.kind==='lease'?'chartered':'yours, worth '+$(v.val)} · ${D.AREAS[v.area].short} · condition ${Math.round(v.cond)}`]));
    if(st.plant){const p=st.plant;rows.push([D.PLANTS[p.kind].ic+' '+p.name,`${p.kind==='space'?'leased this season':'worth '+$(p.val)} · ${D.AREAS[p.area].short} · ${D.MIX[p.mix].short}${p.kind!=='space'?' · condition '+Math.round(p.cond):''}`]);
      rows.push(['👷 Crew',st.crew.s===t.s?`${st.crew.lvl} crew hired`:'not hired yet'])}
    rows.push(['💲 Posted price',`${st.policy.offset===0?'going price':(st.policy.offset>0?'+':'')+c2(st.policy.offset)} · ${st.policy.care==='bled'?'bled fish only':'every fish, fast'}`]);
    rows.push(['🤝 Fleet trust',`${Math.round(st.brep)}/100`]);
    if(st.loan)rows.push(['🏦 Bank loan',`${$(st.loan.bal)} left, ${st.loan.left} year${st.loan.left===1?'':'s'}`]);
    if(st.last)rows.push(['📒 Last season',$(st.last.net)]);
    return rows;
  };
})(Tender);
