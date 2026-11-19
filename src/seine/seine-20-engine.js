// ============================================================
//  PURSE SEINE, part 2: the state, the year, ADF&G's schedule, the winter plan and one opener as a state machine.
//  Seine.session(ticket, {rand}) → { view(), choose(id), report(), done, phase }: every screen is data, so it runs headless.
// ============================================================
(function(K){
  'use strict';
  const D=K.data,U=K.util,{clamp,$,esc,n0,copy,hash,pick,doy,timeTxt,plural}=U;

  // ---- the module's own state (the host stores it and hands it back) ----
  K.newState=()=>({v:1,skill:0,openers:0,crewOps:0,skipOps:0,sets:0,permit:false,gear:false,
    plan:{s:-1,role:'none',route:''},paid:{s:-1,items:[]},respect:{},fleet:0,
    tot:{gross:0,take:0,fish:{sockeye:0,pink:0,chum:0},lbs:0,water:0,injuries:0,torn:0,wheel:0,cites:0,stayed:0,missed:0,best:0}});
  function fill(o,d){Object.keys(d).forEach(k=>{if(o[k]===undefined||o[k]===null&&d[k]!==null)o[k]=copy(d[k]);else if(d[k]&&typeof d[k]==='object'&&!Array.isArray(d[k])&&o[k]&&typeof o[k]==='object')fill(o[k],d[k])});return o}
  K.normState=x=>x&&typeof x==='object'&&!Array.isArray(x)?fill(x,K.newState()):K.newState();

  // ---- the year: how the runs and the price came in (from the year alone, so a save always sees the same summer) ----
  K.year=function(y){
    const h1=hash(y,1),h2=hash(y,2),h3=hash(y,3),h4=hash(y,4);
    const sock=Math.round((.55+.9*h1)*100)/100;
    const bust=h2<.3,pink=Math.round((bust?.04+.2*h3:.6+1.2*h3)*100)/100;
    const price=Math.round((.85+.3*h4)*100)/100;
    return {sock,pink,price,bust,
      txt:`${sock>=1.1?'A strong':sock>=.8?'A fair':'A weak'} sockeye return to Kachemak Bay, and ${bust?'the pinks are failing: few fish and little fishing time after July':pink>=1.2?'a big pink year':'a middling pink year'}.`};
  };
  K.captain=(y,st)=>{const s=K.normState(st);const i=s.plan&&s.plan.cap!=null?s.plan.cap:Math.floor(hash(y,5)*D.CAPTAINS.length)%D.CAPTAINS.length;return Object.assign({i},D.CAPTAINS[i])};
  K.crewShare=(st,cap)=>{const s=K.normState(st);return s.crewOps>=6||(s.respect[cap]||0)>=2?D.SHARE.hand:D.SHARE.green};

  // ---- ADF&G's schedule: Monday, Wednesday and Friday periods from mid-June; after July only in a fair pink year ----
  // days: [{ d (the host's day number), md (month*100+day), dow (0 Monday … 6 Sunday) }]. Returns the openers among them.
  // eo: the period is on the regular schedule but ADF&G will hold it closed (announced a few days ahead, by emergency order)
  K.isOpen=function(y,md,dow){
    const dy=doy(md),Y=K.year(y);
    if(!D.DAYS.includes(dow)) return {open:false,sched:false,why:'Seine periods run Monday, Wednesday and Friday.'};
    if(dy<doy(615)) return {open:false,sched:false,why:'The Southern District opens to seines in mid-June.'};
    if(dy>doy(831)) return {open:false,sched:false,why:'The seine season is over for the year.'};
    if(dy>doy(731)&&(Y.bust||Y.pink<.6)) return {open:false,sched:false,why:'Closed: the wild pink escapement is weak, so ADF&G keeps the bay shut after July.'};
    const p=dy>doy(731)?.75:.9;
    if(hash(y,md,6)>=p) return {open:false,sched:true,eo:true,why:'ADF&G holds this period closed to let more fish into the lakes and streams.'};
    return {open:true,sched:true,why:''};
  };
  // the regular schedule among the days given: [{ d, md, dow, run, eo }] (eo: it will be closed by emergency order)
  K.schedule=function(o){
    const y=n0(o&&o.year,2026);
    return ((o&&o.days)||[]).map(x=>Object.assign({},x,K.isOpen(y,x.md,x.dow))).filter(x=>x.sched).map(x=>({d:x.d,md:x.md,dow:x.dow,run:K.runTxt(y,x.md),eo:!!x.eo}));
  };
  K.runTxt=function(y,md){
    const dy=doy(md),Y=K.year(y),s=D.sockAvail(dy)*Y.sock,p=D.pinkAvail(dy)*Y.pink;
    const w=v=>v>.9?'strong':v>.5?'good':v>.2?'some':'a few';
    return s<.05&&p<.05?'not much showing yet':[s>=.05?`${w(s)} sockeye`:'',p>=.05?`${w(p)} pinks`:''].filter(Boolean).join(', ');
  };

  // ---- the winter: what you sign up for next summer ----
  // t: { state, season, year, cash, costMult }. planOptions lists the choices; plan(t, id) carries one out and returns a report.
  function seasonCost(t,items){const s=K.normState(t.state),paid=s.paid.s===t.season?s.paid.items:[],cm=n0(t.costMult,1);
    return items.filter(k=>!paid.includes(k)&&!(k==='gear'&&s.gear)).map(k=>[k,Math.round(D.SEASON[k]*(k==='license'?1:cm))])}
  const ITEM_TXT={license:'a commercial crewmember license',gear:'rain gear, boots and gloves',insurance:'insurance for the boat and crew',exam:'the Coast Guard dockside exam and safety gear (survival suits, flares, the life raft’s service)',permitFee:'the permit’s yearly renewal'};
  const sum=a=>a.reduce((x,[,c])=>x+c,0);
  K.planOptions=function(t){
    const s=K.normState(t.state),y=n0(t.year,2027),cap=K.captain(y,s),cash=n0(t.cash,0),cm=n0(t.costMult,1),ready=s.crewOps>=D.SKILL_TO_SKIP;
    const trans=hash(y,7)<.7,o=[];
    const cur=s.plan.s===t.season?s.plan.role+(s.plan.route?':'+s.plan.route:''):'none';
    const mk=(id,l,sub,items,why)=>{const c=seasonCost(t,items),cost=sum(c);o.push({id,l,s:sub+(cost?` Up front: ${$(cost)} for ${c.map(([k])=>ITEM_TXT[k]).join(', ')}.`:''),cost,on:cur===id,dis:!!why||cash<cost,why:why||(cash<cost?'Not enough cash':'')})};
    o.push({id:'none',l:'Not this summer',s:'Guide only. Openers won’t show on your schedule.',cost:0,on:cur==='none',dis:false});
    const sh=Math.round(K.crewShare(s,cap.i)*100);
    mk('crew',`Crew on the ${cap.boat} for ${cap.name}`,`${cap.line} ${[8,11,18].includes(sh)?'An':'A'} ${sh}% crew share of each opener you work, after fuel, ice and groceries come off the top.`,['license','gear']);
    const skipWhy=ready?'':`Crew ${D.SKILL_TO_SKIP} openers first (you have ${s.crewOps})`;
    const skipSub=`You run the ${D.OWN_BOAT}, a chartered limit seiner and skiff, with ${D.SKIP.crew} crew on ${Math.round(D.SKIP.crewShare*100)}% shares. The boat’s owner takes ${Math.round(D.SKIP.boatShare*100)}%.`;
    if(s.permit) mk('skip:own',`Run the ${D.OWN_BOAT} on your own permit`,`${skipSub} You keep the permit’s share.`,['license','gear','insurance','exam','permitFee'],skipWhy);
    else mk('skip:transfer',`Run the ${D.OWN_BOAT} on an emergency transfer`,`${skipSub} ${trans?`An old permit holder can’t fish this summer (a new hip), so the state can move his permit to you for the season. He takes ${Math.round(D.SKIP.transferShare*100)}%.`:''}`,['license','gear','insurance','exam'],skipWhy||(trans?'':'No permit holder needs an emergency transfer this year'));
    if(!s.permit){const why=ready?'':skipWhy;o.push({id:'buy',l:`Buy a Cook Inlet seine permit — ${$(Math.round(D.PERMIT.price*cm))}`,s:'Yours to fish every summer, and to sell when you’re done. Most of the permits sit unfished in a lean year.',cost:Math.round(D.PERMIT.price*cm),on:false,dis:!!why||cash<Math.round(D.PERMIT.price*cm),why:why||(cash<Math.round(D.PERMIT.price*cm)?'Not enough cash':'')})}
    else o.push({id:'sell',l:`Sell your seine permit — ${$(K.permitValue(y,cm))}`,s:'A broker finds a buyer over the winter.',cost:0,on:false,dis:cur==='skip:own',why:cur==='skip:own'?'You’re running it this summer':''});
    return o;
  };
  K.permitValue=(y,cm)=>Math.round(D.PERMIT.price*n0(cm,1)*(D.PERMIT.sell+.1*hash(y,8))/100)*100;
  K.plan=function(t,id){
    const s=copy(K.normState(t.state)),y=n0(t.year,2027),o=K.planOptions(t).find(x=>x.id===id),R={state:s,cashDelta:0,spent:0,earned:0,lines:[],plan:null,permitDelta:0};
    if(!o||o.dis) return null;
    if(s.paid.s!==t.season)s.paid={s:t.season,items:[]};
    if(id==='buy'){R.cashDelta=-o.cost;R.spent=o.cost;s.permit=true;s.permitPaid=o.cost;R.permitDelta=o.cost;R.lines.push(`🪪 You buy a Cook Inlet purse seine permit: ${$(o.cost)}. The state transfers the card to your name.`);R.state=s;return R}
    if(id==='sell'){const v=K.permitValue(y,t.costMult);R.cashDelta=v;R.earned=v;s.permit=false;R.permitDelta=-(s.permitPaid||v);s.permitPaid=0;if(s.plan.s===t.season&&s.plan.route==='own')s.plan={s:-1,role:'none',route:''};R.lines.push(`🪪 You sell your seine permit for ${$(v)}.`);R.state=s;return R}
    const items=id==='crew'?['license','gear']:id==='skip:own'?['license','gear','insurance','exam','permitFee']:id==='skip:transfer'?['license','gear','insurance','exam']:[];
    const c=seasonCost(t,items);c.forEach(([k,v])=>{R.cashDelta-=v;R.spent+=v;s.paid.items.push(k);if(k==='gear')s.gear=true});
    const cap=K.captain(y,s);
    s.plan=id==='none'?{s:t.season,role:'none',route:''}:id==='crew'?{s:t.season,role:'crew',route:'',cap:cap.i}:{s:t.season,role:'skip',route:id.split(':')[1]};
    R.plan=copy(s.plan);
    R.lines.push(id==='none'?'⚓ No seining this summer.':id==='crew'?`⚓ You’ll crew on the ${cap.boat} for ${cap.name} this summer${c.length?` (${c.map(([k,v])=>`${ITEM_TXT[k]} ${$(v)}`).join(', ')})`:''}.`:
      `⚓ You’ll run the ${D.OWN_BOAT} this summer${id==='skip:transfer'?' on an emergency transfer':' on your own permit'}${c.length?` (${c.map(([k,v])=>`${ITEM_TXT[k]} ${$(v)}`).join(', ')})`:''}. She passes the Coast Guard’s dockside exam.`);
    R.state=s;return R;
  };

  // ---- one opener ----
  K.normTicket=function(t){
    t=t||{};
    const st=K.normState(copy(t.state||K.newState()));
    return {role:t.role==='skip'?'skip':'crew',route:t.route==='own'?'own':'transfer',state:st,md:n0(t.md,715),dow:n0(t.dow,0),year:n0(t.year,2027),season:n0(t.season,1),
      wind:Math.round(n0(t.wind,8)),sky:t.sky||'cloud',cash:n0(t.cash,0),energy:n0(t.energy,80),costMult:n0(t.costMult,1),bad:n0(t.bad,1),late:Math.max(0,n0(t.late,0)),
      diesel:n0(t.diesel,5.6),dayTxt:t.dayTxt||'',first:st.openers===0};
  };
  function normal(r){let u=0,v=0;while(u===0)u=r();while(v===0)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
  const signTxt=q=>D.SIGNS.find(s=>q>=s[0])[1];

  K.session=function(ticket,o){
    const T=K.normTicket(ticket),r=(o&&typeof o.rand==='function')?o.rand:U.seeded(Math.floor(hash(T.year,T.md,T.state.openers,T.state.sets)*4294967296)),Y=K.year(T.year),dy=doy(T.md);
    const cap=K.captain(T.year,T.state),skip=T.role==='skip',st=T.state;
    const X={phase:'dock',t:D.OPEN+(skip?T.late:0),i:0,ends:[],spot:null,school:null,pace:'steady',call:false,fish:{sockeye:0,pink:0,chum:0},
      sets:0,water:0,lines:[],events:[],costs:{},fines:[],viol:0,cancels:0,energy:-8,skill:0,respect:0,fleet:0,fished:false,bleed:false,stayed:false,missed:false,
      lost:0,hurried:false,best:0,last:null,injured:false,start:D.OPEN+(skip?T.late:0),wind:T.wind,setsLog:[]};
    const Q={T,X,Y,cap,get done(){return X.phase==='done'},get phase(){return X.phase}};
    const ev=(id,sev)=>X.events.push({id,sev:sev||0});
    const cost=(k,v)=>{X.costs[k]=(X.costs[k]||0)+Math.round(v)};
    const spot=()=>D.SPOTS[X.spot];
    const who=skip?'you':cap.name.split(' ')[0];
    const boat=skip?D.OWN_BOAT:cap.boat;
    const windTxt=w=>w>=D.WIND_BAD?`${w} knots: a small craft advisory, whitecaps across the bay`:w>=D.WIND_RUFF?`${w} knots and choppy`:`${w} knots, a fine day on the bay`;
    const skillRead=()=>skip?st.skill:Math.min(100,st.skill+10);
    // the stretches of the day: whatever is left of the period after the run out, in three parts
    function plan(){const a=X.t,b=D.CLOSE,n=3;X.ends=[1,2,3].map(k=>Math.round(a+(b-a)*k/n));X.i=0}
    function newSchool(){
      const sp=spot(),tide=X.i===0?1.12:X.i===1?.95:1.02;
      const q=clamp((.3+.95*r())*tide,.05,1.6);
      const crowd=r()<sp.crowd*.55,line=r()<.22;
      const noise=(1-skillRead()/100)*.55*(r()*2-1);
      const skiffTrue=r()<.7,skiffHot=skiffTrue?q>=.8:q<.8;
      X.school={q,crowd,line,read:clamp(q+noise,0,2),skiff:skiffHot,rival:pick(r,['the Northern Dawn','the Kamishak','the Lady Ann','the Raven','the Silver Spray'])};
    }
    function lookHtml(){
      const s=X.school,sp=spot();
      const p=[`<p><b>${['Morning','Midday','Evening'][X.i]} at ${sp.ic} ${sp.n}</b> · ${timeTxt(X.t)}, the period closes at ${timeTxt(D.CLOSE)}. Wind ${windTxt(X.wind)}.</p>`,
        `<p>👀 ${signTxt(s.read)}${skip?'':' (your read)'}</p>`,
        `<p>🚤 The skiff man: “${s.skiff?'They’re thick in here. Let’s go!':'I don’t like it. Not much under us.'}”</p>`];
      if(s.crowd) p.push(`<p>⛵ The <b>${s.rival.replace('the ','')}</b> is circling the same school and he was here first. The fleet’s rule: you wait your turn at a hook-off, and you never lay your net across another boat’s set.</p>`);
      if(s.line) p.push(`<p>📍 The thickest fish are milling just inside ${sp.lineTxt}. Closed water: the fleet fishes outside it.</p>`);
      p.push(`<p class="small-note" style="font-size:13px">So far: ${tally()}.</p>`);
      return p.join('');
    }
    const tally=()=>{const f=X.fish,n=f.sockeye+f.pink+f.chum;return n?[f.sockeye?plural(f.sockeye,'sockeye','sockeye'):'',f.pink?plural(f.pink,'pink'):'',f.chum?plural(f.chum,'chum'):''].filter(Boolean).join(', ')+` in ${plural(X.sets,'set')}`:`${plural(X.sets,'set')}, nothing in the hold yet`};

    // ---- what a stretch of sets brings in ----
    function stretch(mode,o2){
      o2=Object.assign({},o2||{});if(X.hurryNext){o2.hurry=true;X.hurryNext=false}
      const sp=spot(),s=X.school,end=X.ends[X.i];
      const mins=Math.max(D.SET_MIN,end-X.t-X.lost);X.lost=0;
      let n=Math.max(1,Math.floor(mins/D.SET_MIN));
      const sk=skip?.75+.45*st.skill/100:cap.sk*(X.call?(st.skill>=25||s.read-s.q<.25?1.08:.97):1);
      const risk=mode==='tight'?1.3:mode==='off'?.85:mode==='rush'?1.1:1;
      const wx=X.wind>=D.WIND_BAD?.7:X.wind>=D.WIND_RUFF?.88:1;
      const av={sockeye:70*D.sockAvail(dy)*Y.sock*sp.sock,pink:420*D.pinkAvail(dy)*Y.pink*sp.pink,chum:10*D.chumAvail(dy)*sp.chum};
      const got={sockeye:0,pink:0,chum:0},line=[];let water=0,best=0,inside=!!o2.inside,seized=null;
      let q0=s.q*(o2.wait?1:1)*(o2.turn?.85:1)*(o2.corked?.5:1);
      for(let k=0;k<n;k++){
        let qk=q0*Math.pow(.88,k)+(inside&&k===0?.6:0);
        const pw=clamp(.1+.42*(1-qk),.05,.6);
        X.sets++;
        if(r()<pw){water++;X.water++;line.push('a water haul');continue}
        const m=qk*Math.exp(.55*normal(r))*sk*risk*wx,one={};
        let tot=0;for(const sp2 of ['sockeye','pink','chum']){one[sp2]=Math.max(0,Math.round(av[sp2]*m*(.8+.4*r())));tot+=one[sp2]}
        if(tot<6){water++;X.water++;line.push('next to nothing');continue}
        if(inside&&k===0)seized=one;
        for(const k2 in one)got[k2]+=one[k2];
        best=Math.max(best,one.sockeye*D.WT.sockeye*D.PRICE.sockeye+one.pink*D.WT.pink*D.PRICE.pink+one.chum*D.WT.chum*D.PRICE.chum);
        line.push(fishTxt(one));
      }
      // what can go wrong
      const out=[];let lose=0;
      if(inside){ if(r()<.35){X.viol++;const fine=Math.round(D.FINE[sp.line]*Math.sqrt(T.bad));X.fines.push({what:sp.line==='sha'?'seining inside a hatchery special harvest area':'seining too close to a salmon stream',fine});
        if(seized)for(const k2 in seized)got[k2]-=seized[k2];
        ev('line_cite',1);out.push(`🚔 A Wildlife Troopers skiff was watching ${sp.lineTxt}. ${skip?'You get':`${cap.name.split(' ')[0]} gets`} a citation (${$(fine)}) and the fish from that set are seized.`)}
        else out.push(`📍 You set inside ${sp.lineTxt} and nobody saw. ${skip?'You don’t sleep well about it.':'The crew doesn’t talk about it.'}`)}
      const torn=sp.reef*(mode==='tight'?.32:mode==='off'?.06:.12)*Math.sqrt(T.bad);
      if(r()<torn){lose+=.45;st.tot.torn++;ev('torn_net',1);
        if(skip){const c=Math.round((900+1900*r())*T.costMult/10)*10;cost('net',c);out.push(`🕸️ The lead hangs up on the reef and tears a hole you could drive a skiff through. You pick up early and the net loft in Homer patches it: ${$(c)}.`)}
        else out.push('🕸️ The net hangs up on the reef and tears. Everybody mends web for an hour instead of fishing.')}
      const pw=.035+(mode==='rush'?.04:0)+(X.wind>=D.WIND_RUFF?.03:0)-(mode==='watch'?.02:0);
      if(r()<pw){lose+=.25;X.lost+=90;st.tot.wheel++;ev('skiff_wheel',1);
        if(skip){const c=Math.round(350*T.costMult);cost('diver',c);out.push(`🌀 The skiff line goes into the wheel. Dead in the water until a diver from Homer cuts it free: ${$(c)} and an hour and a half.`)}
        else out.push('🌀 The skiff line goes into the wheel. The skipper is not happy. A diver cuts it free an hour and a half later.')}
      const pin=(skip?.02:.025)+(mode==='rush'?.035:0)+(o2.hurry?.045:0)+(X.wind>=D.WIND_BAD?.03:0)+(T.energy<30?.03:0)-(mode==='watch'?.015:0)+(X.pace==='hustle'?.015:0);
      if(!X.injured&&r()<pin){X.injured=true;st.tot.injuries++;const bad=r()<.2;
        if(skip){const c=Math.round(1000*T.costMult);cost('deductible',c);lose+=.5;ev(bad?'injury_bad':'injury',bad?2:1);
          out.push(`🩹 Your deckhand gets a hand caught at the power block${bad?' and it’s broken':''}. You run him to the clinic in Homer and lose the rest of the tide. The insurance deductible is yours: ${$(c)}.`)}
        else{const c=Math.round((bad?1800:180)*T.costMult);cost('medical',c);X.energy-=bad?30:15;if(bad)X.cancels=1;ev(bad?'injury_bad':'injury',bad?2:1);
          out.push(bad?`🚑 A swinging brailer catches you square and something in your wrist goes. South Peninsula Hospital in Homer sets it: ${$(c)}. You’ll be slow for days.`:`🩹 The purse line burns a stripe across your palm and you jam two fingers in the block. The Homer clinic tapes you up: ${$(c)}.`)}}
      if(lose>0)for(const k2 in got)got[k2]=Math.round(got[k2]*(1-Math.min(.8,lose)));
      for(const k2 in got){got[k2]=Math.max(0,got[k2]);X.fish[k2]+=got[k2]}
      X.fished=true;X.best=Math.max(X.best,best);
      const n2=got.sockeye+got.pink+got.chum;
      if(water===n&&n>0)ev('water_haul',0);
      if(X.i===0&&!X.events.some(e=>e.id==='dawn_set')&&n2>0)ev('dawn_set',0);
      if(best>=2500)ev('jackpot',0);
      X.last={n,line,got,out,big:n2>=700||got.sockeye>=300};
      if(X.last.big)ev('full_bag',0);
      X.t=end;
    }
    const fishTxt=f=>[f.sockeye?plural(f.sockeye,'sockeye','sockeye'):'',f.pink?plural(f.pink,'pink'):'',f.chum?plural(f.chum,'chum'):''].filter(Boolean).join(' and ')||'next to nothing';

    // ---- the money ----
    function settle(){
      const P={sockeye:D.PRICE.sockeye*Y.price+(X.bleed?D.BLEED:0),pink:D.PRICE.pink*Y.price,chum:D.PRICE.chum*Y.price};
      const lbs={},val={};let gross=0,L=0;
      for(const k in X.fish){lbs[k]=Math.round(X.fish[k]*D.WT[k]);val[k]=Math.round(lbs[k]*P[k]);gross+=val[k];L+=lbs[k]}
      const top=X.stayed||X.missed?0:Math.round((D.COST.dieselGal+(X.moveGal||0))*T.diesel*T.costMult+(D.COST.ice+D.COST.grub+(X.bleed?D.COST.bleedIce:0))*T.costMult);
      const net=gross-top;let take=0;const rows=[];
      rows.push(['Fish ticket at the tender',gross]);
      if(top)rows.push(['Off the top: fuel, ice, groceries',-top]);
      if(skip){
        const pos=Math.max(0,net),crew=Math.round(pos*D.SKIP.crewShare*D.SKIP.crew),bo=Math.round(pos*D.SKIP.boatShare),pm=T.route==='transfer'?Math.round(pos*D.SKIP.transferShare):0;
        take=net-crew-bo-pm;
        if(crew)rows.push([`Crew shares (${D.SKIP.crew} × ${Math.round(D.SKIP.crewShare*100)}%)`,-crew]);
        if(bo)rows.push([`The boat’s share (${Math.round(D.SKIP.boatShare*100)}%)`,-bo]);
        if(pm)rows.push([`The permit holder’s share (${Math.round(D.SKIP.transferShare*100)}%)`,-pm]);
      }else{const sh=K.crewShare(st,cap.i);take=X.missed||X.stayed?0:Math.max(0,Math.round(net*sh));rows.push([`Your crew share (${Math.round(sh*100)}%)`,take])}
      let out=take;
      for(const k of ['net','diver','deductible','medical']) if(X.costs[k]){out-=X.costs[k];rows.push([{net:'Net repairs',diver:'The diver',deductible:'Insurance deductible',medical:'Your doctor’s bill'}[k],-X.costs[k]])}
      X.fines.forEach(f=>{if(skip){out-=f.fine;rows.push(['Fine',-f.fine])}});
      return {P,lbs,val,gross,top,net,take,out,rows,L};
    }

    // ---- screens ----
    Q.view=function(){
      const b=[],add=(id,l,s,dis)=>b.push({id,l,s:s||'',dis:!!dis});
      let title='',html='';
      const meta={phase:X.phase,role:T.role,spot:X.spot,t:X.t,fish:copy(X.fish),events:X.events.slice(),school:X.school?{q:X.school.q,read:X.school.read,crowd:X.school.crowd,line:X.school.line}:null,i:X.i};
      switch(X.phase){
        case 'dock':{
          title=`⚓ Homer harbor · ${T.dayTxt||'opener day'}`;
          if(!skip&&T.late>30){html=`<p>You pull into the harbor at ${timeTxt(D.OPEN+T.late)}. The <b>${cap.boat}</b>’s slip is empty: ${cap.name.split(' ')[0]} left at 6:30 with somebody’s cousin on deck.</p><p>No opener, no share, and a skipper who won’t forget it.</p>`;add('missed','Walk back up the dock');break}
          html=`<p>${skip?`You run the <b>${D.OWN_BOAT}</b>, a 50-ft limit seiner, with her skiff and ${D.SKIP.crew} crew.`:`You crew on the <b>${cap.boat}</b> for <b>${cap.name}</b>. ${cap.line}`}</p>
            <p>📣 Southern District purse seine period, 6 AM to 10 PM. ${esc(K.runTxt(T.year,T.md))}.</p>
            <p>💨 Wind ${windTxt(X.wind)}.${skip&&T.late>0?` You’re ${T.late} minutes late and the crew is waiting.`:''}</p>
            ${T.first?`<p class="small-note" style="font-size:13px">How a set works: the skiff holds one end of the net while the seiner runs a circle around a school, then a winch draws the purse line and closes the bottom. The crew stacks the net back aboard and brails the fish into the hold. At the end of the day a tender at anchor buys the catch.</p>`:''}`;
          if(skip){
            add('go','Run out at first light',`About ${45} minutes across the bay.${X.wind>=D.WIND_BAD?' Rough: more risk, fewer fish.':''}`);
            if(X.wind>=D.WIND_RUFF) add('wait','Wait for the wind to lay down','Three hours tied up. It should ease off by midmorning.');
            add('stay','Stay in port today','No fish, no costs. The crew loses a day’s pay.');
          }else{
            add('go','Climb aboard',X.wind>=D.WIND_RUFF?`${cap.name.split(' ')[0]} makes the weather call.`:'Coffee, rain gear, a cold run across the bay.');
            if(X.wind>=D.WIND_BAD) add('begoff','Tell the skipper you’re not going out in that','No share today, and he’ll remember.');
          }
          break}
        case 'grounds':{
          title=`🗺️ Where to set · ${timeTxt(X.t)}`;
          if(skip){html=`<p>Which bay do you start in? ${esc(K.runTxt(T.year,T.md))}. Kachemak Bay’s seine water is small: the boats you see at dawn are the boats you’ll see all day.</p>`;
            D.SPOT_IDS.forEach(id=>{const sp=D.SPOTS[id];add('spot:'+id,`${sp.ic} ${sp.n}`,`${sp.d} ${sp.run} min run.`)})}
          else{const sp=spot();html=`<p>${cap.name.split(' ')[0]} heads for <b>${sp.ic} ${sp.n}</b>. ${sp.d}</p><p>You’re on deck: stacking the net as it comes over the block, then brailing. How do you work it?</p>`;
            add('pace:steady','Work steady and keep clear of the lines','Safer. Nobody notices you.');add('pace:hustle','Hustle','The skipper notices. So does the power block.')}
          break}
        case 'look':{
          title=`👀 ${spot().n} · ${['the morning set','midday','the evening set'][X.i]}`;html=lookHtml();
          const s=X.school,left=X.ends[X.i]-X.t;
          if(skip){
            if(s.crowd){add('turn',`Take your turn behind the ${s.rival.replace('the ','')}`,'40 minutes on the hook-off; he gets first crack at the school.');add('cut','Cut in ahead of him','Set now. The fleet has a long memory.')}
            else add('set','Set on them now',`About ${Math.max(1,Math.floor(left/D.SET_MIN))} set${Math.floor(left/D.SET_MIN)>1?'s':''} this stretch.`);
            if(left>=D.SET_MIN+D.WAIT) add('wait','Wait for a better school',`${D.WAIT} minutes of watching the water.`);
            add('move','Run to another bay','Time and fuel. Maybe better fish.');
            if(s.line) add('inside','Set inside the line','The fish are stacked there. So is the risk of a citation.');
            if(X.i===2) add('early','Pick up and deliver early','Save your energy. Home sooner.');
          }else{
            add('call','Sing out what you see',`Your read: ${signTxt(s.read).toLowerCase()}`);
            add('quiet','Leave it to the skipper and the skiff man','');
          }
          break}
        case 'move':{
          title='🧭 Run to another bay';html=`<p>It’s ${timeTxt(X.t)}. Running costs time and diesel.</p>`;
          D.SPOT_IDS.filter(id=>id!==X.spot).forEach(id=>{const sp=D.SPOTS[id];add('to:'+id,`${sp.ic} ${sp.n}`,`${Math.abs(sp.run-spot().run)+15} min. ${sp.d}`)});
          add('back','Stay here');break}
        case 'set':{
          const s=X.school;title=`🕸️ Make the set · ${timeTxt(X.t)}`;
          html=`<p>${skip?`The skiff takes the end and you run the circle around ${s.inside?'the fish inside the line':'the school'}.`:`${cap.name.split(' ')[0]} sets ${X.decide||'on the school'}. The skiff takes the end, the boat runs the circle and the purse line comes in.`}</p>`;
          if(skip){add('tight','Set tight to the reef, where they hold',`More fish. ${spot().reef>=.3?'This beach has a mean reef.':'Some reef here.'}`);add('off','Set off the reef','Safer for the net, fewer fish.')}
          else{add('watch','Watch the skiff line and the purse line','Slower, safer.');add('rush','Rush the stack to get the next set in','More sets, more risk.')}
          break}
        case 'haul':{
          const L=X.last;title=`🐟 ${L.n} set${L.n>1?'s':''} · ${timeTxt(X.t)}`;
          html=`<p>${L.line.map((x,i)=>`Set ${i+1}: ${x}`).join('. ')}.</p>${L.out.map(x=>`<p>${x}</p>`).join('')}<p class="small-note" style="font-size:13px">In the hold: ${tally()}.</p>`;
          if(L.big&&!X.hurried&&X.i<2){html+=`<p>💪 The last bag is full to the corks. Brail it aboard before the next set.</p>`;
            add('brail','Brail it steady','Safe, and the next set goes in a little later.');add('hurry','Hurry the brailer and set again','A little more fishing time; brailers and wet decks hurt people.')}
          else add(X.i>=2||X.t>=D.CLOSE-30?'tender':'next',X.i>=2||X.t>=D.CLOSE-30?'Pick up and run to the tender':'Next stretch');
          break}
        case 'tender':{
          const m=settle();title='🚢 The tender at anchor';
          html=`<p>The tender lies at anchor off the Spit with her lights on. ${m.L?`You pitch ${plural(m.L,'pound')} aboard: ${fishTxt(X.fish)}.`:'Not much to pitch.'}</p><p>Price at the tender this year: sockeye $${m.P.sockeye.toFixed(2)} a pound, pinks $${m.P.pink.toFixed(2)}, chums $${m.P.chum.toFixed(2)}.</p>`;
          if(skip&&X.fish.sockeye>0&&!X.bleed){add('bleed','Bleed and slush the sockeye first',`An hour of hard work: ${'$'+D.BLEED.toFixed(2)} more a pound for sockeye, ${$(Math.round(D.COST.bleedIce*T.costMult))} more ice.`);add('deliver','Deliver as they are')}
          else add('deliver',skip?'Deliver':'Pitch fish and clean up');
          break}
        case 'result':{
          const m=X.money;title=X.stayed?'⚓ A day in port':X.missed?'⚓ Missed the boat':`📋 Fish ticket · ${plural(m.L,'pound')}`;
          html=(X.stayed||X.missed?X.lines.map(l=>`<p>${l}</p>`).join(''):`<p>${X.sets} sets, ${X.water} water haul${X.water===1?'':'s'}: ${fishTxt(X.fish)}.</p>`)+
            `<p>${m.rows.map(([l,v])=>`${l}: <b>${v<0?'−':''}${$(Math.abs(v))}</b>`).join('<br>')}</p><p><b>${skip?'Yours, after everything':'Your pay'}: ${m.out<0?'−':''}${$(Math.abs(m.out))}</b></p>`;
          add('done',skip?'Tie up and call it a day':'Collect your share and head up the dock');break}
        default: title='⚓';html='';
      }
      return {title,html,buttons:b,exit:b.length?b[b.length-1].id:null,meta};
    };

    Q.choose=function(id){
      const v=Q.view(),bt=v.buttons.find(x=>x.id===id);if(!bt||bt.dis)return false;
      switch(X.phase){
        case 'dock':
          if(id==='missed'){X.missed=true;st.tot.missed++;X.respect-=2;ev('missed_boat',1);X.lines.push(`You missed the ${cap.boat}.`);return finish()}
          if(id==='stay'){X.stayed=true;st.tot.stayed++;ev('stay_in',0);X.lines.push(`🌬️ You keep the ${D.OWN_BOAT} tied up. The crew plays cribbage in the galley and grumbles about the share they didn’t make.`);X.energy+=4;return finish()}
          if(id==='begoff'){X.stayed=true;X.respect-=1;ev('stay_in',0);X.lines.push(`🌬️ You tell ${cap.name.split(' ')[0]} you’re not going. He shrugs and goes without you.`);return finish()}
          if(id==='wait'||(!skip&&X.wind>=(cap.style==='patient'?D.WIND_RUFF:cap.style==='steady'?D.WIND_BAD:99))){X.t+=180;X.wind=Math.max(6,X.wind-8);ev('weather_wait',0);X.lines.push('🌬️ You wait out the morning blow in the harbor.')}
          if(skip){X.phase='grounds';return true}
          X.spot=npcSpot();X.t+=D.SPOTS[X.spot].run;plan();X.phase='grounds';return true;
        case 'grounds':
          if(id.startsWith('spot:')){X.spot=id.slice(5);X.t+=spot().run;plan();newSchool();X.phase='look';return true}
          if(id.startsWith('pace:')){X.pace=id.slice(5);if(X.pace==='hustle'){X.energy-=4;X.respect+=1}newSchool();X.phase='look';return true}
          return false;
        case 'look':{
          const s=X.school;X.o2={};
          if(skip){
            if(id==='move'){X.phase='move';return true}
            if(id==='early'){X.lines.push('You pick up early.');X.phase='tender';X.t=Math.min(X.t,D.CLOSE);X.energy+=6;return true}
            if(id==='wait'){X.t+=D.WAIT;const q0=s.q;newSchool();X.school.q=Math.max(X.school.q,q0*.7);return true}
            if(id==='turn'){X.t+=40;X.o2.turn=true}
            if(id==='cut'){X.fleet-=1;ev('cut_in',1);if(r()<.3+Math.max(0,-st.fleet)*.1){X.o2.corked=true;ev('corked',1)}}
            if(id==='inside'){X.o2.inside=true;s.inside=true}
            X.phase='set';return true;
          }
          // crew: the skipper decides
          X.call=id==='call';
          if(X.call&&Math.abs(s.read-s.q)<.3)X.respect+=1;
          const st2=cap.style;let dec='on the school';
          if(st2==='patient'&&s.q<.55&&X.ends[X.i]-X.t>=D.SET_MIN+D.WAIT){X.t+=D.WAIT;const q0=s.q;newSchool();X.school.q=Math.max(X.school.q,q0*.8);X.school.crowd=false;X.school.line=false;dec='after waiting out a better school'}
          if(X.school.crowd){if(st2==='hard'){X.o2.cutNpc=true;ev('cut_in',1);dec=`right across the ${X.school.rival.replace('the ','')}’s bow, cutting in`;if(r()<.3){X.o2.corked=true;ev('corked',1)}}else{X.t+=40;X.o2.turn=true;dec='after waiting his turn at the hook-off'}}
          if(X.school.line&&st2==='hard'&&r()<.35){X.o2.inside=true;X.school.inside=true;dec='inside the line, where the fish are stacked'}
          X.decide=dec;X.phase='set';return true}
        case 'move':
          if(id==='back'){X.phase='look';return true}
          if(id.startsWith('to:')){const a=spot().run;X.spot=id.slice(3);X.t+=Math.abs(spot().run-a)+15;X.moveGal=(X.moveGal||0)+8;newSchool();X.phase='look';return true}
          return false;
        case 'set':
          stretch(id,X.o2);X.phase='haul';return true;
        case 'haul':
          if(id==='hurry'){X.hurried=true;X.lost-=30;X.hurryNext=true;X.energy-=3}
          if(id==='brail'){X.lost+=15}
          if(id==='tender'){X.phase='tender';return true}
          X.i++;if(X.i>2||X.t>=D.CLOSE-30){X.phase='tender';return true}
          newSchool();X.phase='look';
          return true;
        case 'tender':
          if(id==='bleed'){X.bleed=true;X.energy-=6}
          ev('tender',0);return finish();
        case 'result':
          X.phase='done';return true;
      }
      return false;
    };
    function npcSpot(){
      const best=D.SPOT_IDS.map(id=>{const sp=D.SPOTS[id];return [id,sp.sock*D.sockAvail(dy)*Y.sock+.25*sp.pink*D.pinkAvail(dy)*Y.pink+(cap.style==='hard'?sp.crowd*.2:cap.style==='patient'?-sp.crowd*.2:0)+.25*r()]}).sort((a,b)=>b[1]-a[1]);
      return best[0][0];
    }
    function finish(){
      X.money=settle();X.phase='result';
      if(X.fished)X.lines.push(`🚢 Delivered to the tender: ${fishTxt(X.fish)}.`);
      return true;
    }
    // the report: what the host applies (any time; final once done)
    Q.report=function(){
      const m=X.money||settle(),s=copy(st),f=X.fish,worked=!X.missed&&!X.stayed;
      if(worked){s.openers++;if(skip)s.skipOps++;else s.crewOps++;s.sets+=X.sets;s.skill=clamp(s.skill+(skip?2:3)+(X.call?1:0),0,100);
        for(const k in f){s.tot.fish[k]+=f[k]}s.tot.lbs+=m.L;s.tot.water+=X.water;s.tot.gross+=m.gross;s.tot.best=Math.max(s.tot.best,m.gross)}
      if(!skip)s.respect[cap.i]=clamp((s.respect[cap.i]||0)+X.respect,-5,5);
      s.fleet=clamp(s.fleet+X.fleet,-5,5);if(X.viol)s.tot.cites+=X.viol;
      s.tot.take+=m.out;
      const end=X.missed?D.OPEN+T.late:X.stayed?Math.max(X.t,D.OPEN+30):Math.min(1425,Math.max(X.t,D.OPEN)+45+(X.spot?D.SPOTS[X.spot].run:0));
      const start=D.OPEN+(skip?T.late:Math.min(T.late,30));
      return {state:s,role:T.role,fished:worked&&X.fished,stayed:X.stayed,missed:X.missed,
        cashDelta:m.out,earned:Math.max(0,m.take),spent:Math.max(0,m.take-m.out),gross:m.gross,offTop:m.top,take:m.take,rows:m.rows,
        fish:copy(f),lbs:m.L,sets:X.sets,water:X.water,spot:X.spot,
        energyDelta:worked?X.energy-(skip?4:0):Math.min(0,X.energy+8),repDelta:X.viol&&skip?-3:0,skillDelta:worked?1:0,
        fines:skip?X.fines.slice():[],viol:skip?X.viol:0,cancels:X.cancels,start,end,minutes:Math.max(0,end-start),
        events:X.events.slice(),lines:X.lines.slice(),respect:X.respect,fleet:X.fleet,captain:skip?null:{name:cap.name,boat:cap.boat},boat};
    };
    return Q;
  };
})(Seine);
