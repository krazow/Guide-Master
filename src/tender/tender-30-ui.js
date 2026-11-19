// ============================================================
//  TENDER & PROCESSOR, part 3: screens.
//  Tender.ui.planner(host, back)   the off-season sheet: tenders, the plant, crew, upkeep, your posted price, the bank
//  Tender.ui.opener(host, done)    a day you run the tender yourself: the price you post, how picky you are, the run to the plant
//  Tender.ui.tab(ticket)           the business as HTML (the host shows it where it likes)
//  Tender.ui.report(host, title, rep, done)  a report's lines in a sheet
//
//  The host adapter: {
//    show(title, html, buttons, lock, meta),  required. Show a pop-up. buttons: [{l, s, dis, fn, stay}]. stay:true (every button here) asks the
//                                           host to keep the sheet up and show whatever fn shows next in it; a host that can't closes it first.
//                                           meta (optional): {events: [{id, sev}]} from Tender.EVENTS, for a host that shows a picture.
//    ticket(),                              required. A fresh ticket from the host's numbers.
//    apply(report),                         required. Apply a report (cash, energy, free days, the module's state).
//    rand()                                 optional, [0,1)
//  }
// ============================================================
(function(T){
  'use strict';
  const U=T.util,D=T.data,K=D.K,{$,c2,lb,esc}=U;
  const UI={};T.ui=UI;
  const o=h=>typeof h.rand==='function'?{rand:h.rand}:undefined;
  const later=f=>f;   // buttons carry stay:true, so the next step shows in the same sheet (a host that can't just opens a new one)
  const show=(h,title,html,btns,lock,meta)=>h.show(title,html,btns.map(b=>Object.assign({stay:true},b)),lock,meta);
  const rows=t=>`<div style="font-size:13px">${T.status(t).map(([a,b])=>`<div class="kv"><span>${a}</span><b style="text-align:right">${esc(b)}</b></div>`).join('')}</div>`;
  const note=s=>`<p style="font-size:12.5px;color:var(--mute)">${s}</p>`;
  function doAct(h,id,arg,then){const rep=T.act(h.ticket(),id,arg);if(!rep.refused)h.apply(rep);then(rep)}
  const lineP=rep=>rep.lines.length?`<p>${rep.lines.join('<br>')}</p>`:'';

  UI.planner=function(h,back,msg){
    const t=h.ticket(),st=t.state,fc=T.forecast(t),b=[];
    b.push({l:'⚓ Tenders',s:st.tenders.length?st.tenders.map(v=>`${v.name} (${v.kind==='lease'?'chartered':'yours'}, ${D.AREAS[v.area].short})`).join(', '):`Charter one for ${$(T.price(t,'lease'))} a season, or buy a used one for ${$(T.price(t,'buyT'))}.`,fn:later(()=>UI.tenders(h,back))});
    b.push({l:'🏭 Processing',s:st.plant?`Your ${st.plant.name} (${D.AREAS[st.plant.area].short}), packing ${D.MIX[st.plant.mix].short}.`:'Lease line space, buy a small shore plant or an old floating processor.',fn:later(()=>UI.plant(h,back))});
    if(st.plant){const w=T.why(t,'crew',{lvl:'full'});b.push({l:`👷 Hire next season’s crew${st.crew.s===t.s?': done':''}`,s:st.crew.s===t.s?`A ${st.crew.lvl} crew is hired.`:`${w&&w!=='Already hired'?w+'. ':''}${K.CREW_DAY} free day on the phone and at a job fair. Skip it and an agency hires a lean crew late for ${Math.round(K.AGENCY*100)}% more.`,dis:!!w,fn:later(()=>UI.crew(h,back))})}
    if(st.tenders.some(v=>v.kind==='used')||(st.plant&&st.plant.kind!=='space'))b.push({l:`🔧 Winter upkeep: ${{full:'a full overhaul',basic:'the basics',skip:'skip what you can'}[st.maint]}`,s:'Paid when the season opens. Run-down boats and plants break down more and fail inspections.',fn:later(()=>UI.maint(h,back))});
    b.push({l:`💲 Your posted price: ${st.policy.offset===0?'the going price':(st.policy.offset>0?'+':'')+c2(st.policy.offset)}`,s:'What your skipper and your plant pay the fleet. Too low and boats go elsewhere; too high and the margin is theirs.',fn:later(()=>UI.price(h,back))});
    if(st.loan)b.push({l:`🏦 Bank loan: ${$(st.loan.bal)} left`,s:`${Math.round(st.loan.rate*100)}% a year, ${st.loan.left} year${st.loan.left===1?'':'s'} to go. Pay some down early.`,fn:later(()=>UI.loan(h,back))});
    b.push({l:'Done',s:'Back to the off-season.',fn:later(back)});
    show(h,'⚓ Fish buying & processing',`${msg?`<p>${msg}</p>`:''}<p style="font-size:13px">📣 ${fc.text}</p>${T.active(st)||st.loan?rows(t):note(`Cash ${$(t.cash)}. Reputation ${t.rep}. Start small: charter a tender for a season and buy fish over the rail for a processor, then work up to a tender of your own and a plant. The business can fail and be sold off at a loss, but it never ends your guiding career.`)}`,b,false,{events:[{id:'tender_anchor',sev:0}]});
  };
  const areaPick=(h,title,why,go,back)=>show(h,title,note(why),[
    {l:`${D.AREAS.uci.ic} ${D.AREAS.uci.n}`,s:D.AREAS.uci.d,fn:later(()=>go('uci'))},
    {l:`${D.AREAS.lci.ic} ${D.AREAS.lci.n}`,s:D.AREAS.lci.d,fn:later(()=>go('lci'))},
    {l:'Never mind',fn:later(back)}]);
  UI.tenders=function(h,back){
    const t=h.ticket(),st=t.state,me=()=>UI.tenders(h,back),b=[],res=rep=>me(),fc=T.forecast(t);
    st.tenders.forEach(v=>{
      if(v.kind==='used')b.push({l:`Sell the ${v.name} — ${$(T.saleValue(t,v.id))}`,s:`Worth ${$(v.val)}, condition ${Math.round(v.cond)}. A sale pays the bank first.`,fn:later(()=>doAct(h,'sellT',{id:v.id},res))});
      const other=v.area==='uci'?'lci':'uci';b.push({l:`Send the ${v.name} to ${D.AREAS[other].short}`,s:`She works ${D.AREAS[v.area].n} now.`,fn:later(()=>doAct(h,'areaT',{id:v.id,area:other},res))})});
    const add=(id,l,s,arg)=>{const w=T.why(t,id,arg);b.push({l,s:(w?w+'. ':'')+s,dis:!!w,fn:later(()=>areaPick(h,l,'Where will she anchor this summer?',a=>doAct(h,id,Object.assign({},arg,{area:a}),res),me))})};
    add('lease',`⚓ Charter a tender — ${$(T.price(t,'lease'))}`,D.VESSELS.lease.d,{});
    add('buyT',`🚢 Buy a used tender — ${$(T.price(t,'buyT'))}`,D.VESSELS.used.d,{});
    add('buyT',`🏦 Buy one with a bank loan — ${$(Math.round(T.price(t,'buyT')*K.DOWN))} down`,`The bank lends the rest at ${Math.round(K.RATE*100)}% over ${K.TERM} years, paid each fall. Needs reputation ${K.BUY_REP}.`,{loan:true});
    b.push({l:'Back',fn:later(()=>UI.planner(h,back))});
    show(h,'⚓ Tenders',`${rows(t)}${note(`A tender anchors where the fleet fishes and buys over the rail on every opener, chills the fish in refrigerated seawater and runs them to the plant. A processor pays you the going price plus about ${c2(K.SPREAD.sockeye)} a pound for sockeye, more for cold, bled fish. Your skipper runs every opener you don’t run yourself. Up to ${K.MAX_TENDERS} tenders.`)}`,b,false,{events:[{id:'tender_anchor',sev:0}]});
  };
  UI.plant=function(h,back){
    const t=h.ticket(),st=t.state,me=()=>UI.plant(h,back),b=[],res=()=>me(),p=st.plant;
    if(p){
      Object.keys(D.MIX).forEach(k=>{const M=D.MIX[k],ok=!M.can||D.PLANTS[p.kind].can;b.push({l:`${p.mix===k?'✓ ':''}${M.n}`,s:(ok?'':'Needs a canning line. ')+M.d,dis:!ok||p.mix===k,fn:later(()=>doAct(h,'mix',{mix:k},res))})});
      if(p.kind==='floater'){const other=p.area==='uci'?'lci':'uci';b.push({l:`🛳️ Move the floater to ${D.AREAS[other].short}`,s:`A tow of ${$(Math.round(D.PLANTS.floater.move*(t.costMult||1)))} when the season opens.`,fn:later(()=>doAct(h,'parea',{area:other},res))});
        b.push({l:st.winterCrab?'🦀 Keep the floater home this winter':'🦀 Send the floater west for winter crab',s:'Crab sections for the winter fleet out west: a crew, the run out and back, and the crab market’s luck. Settled when the season opens.',fn:later(()=>doAct(h,'wcrab',{},res))})}
      if(p.kind!=='space')b.push({l:`Sell your ${p.name} — ${$(T.saleValue(t,'plant'))}`,s:`Worth ${$(p.val)}. Buyers pay less in a year the market looks weak. A sale pays the bank first.`,fn:later(()=>doAct(h,'sellP',{},res))});
    }else{
      const add=(id,l,s,arg)=>{const w=T.why(t,id,arg);b.push({l,s:(w?w+'. ':'')+s,dis:!!w,fn:later(()=>areaPick(h,l,'Where?',a=>doAct(h,id,Object.assign({},arg,{area:a}),res),me))})};
      add('space',`🏚️ Lease line space — ${$(T.price(t,'space'))} a season`,D.PLANTS.space.d,{});
      add('shore',`🏭 Buy a small shore plant — ${$(T.price(t,'shore'))}`,D.PLANTS.shore.d,{});
      add('shore',`🏦 Shore plant with a bank loan — ${$(Math.round(T.price(t,'shore')*K.DOWN))} down`,`${Math.round(K.RATE*100)}% over ${K.TERM} years.`,{loan:true});
      add('floater',`🛳️ Buy an old floating processor — ${$(T.price(t,'floater'))}`,D.PLANTS.floater.d,{});
      add('floater',`🏦 Floater with a bank loan — ${$(Math.round(T.price(t,'floater')*K.DOWN))} down`,`${Math.round(K.RATE*100)}% over ${K.TERM} years.`,{loan:true});
    }
    b.push({l:'Back',fn:later(()=>UI.planner(h,back))});
    show(h,'🏭 Processing',`${rows(t)}${note('A plant buys from your own tender, from outside tenders and at the dock, then heads, guts, fillets, freezes or cans the fish and sells it. The margin moves with the market; the crew, energy, permits and upkeep come due either way. A state food-safety inspection comes every season, and a run-down plant fails it.')}`,b,false,{events:[{id:'plant_line',sev:0}]});
  };
  UI.crew=function(h,back){
    const t=h.ticket(),res=rep=>UI.planner(h,back,rep.lines.join('<br>'));
    show(h,'👷 Next season’s crew',note('Seasonal workers from all over come for the summer: recruiting, travel and a bunk for each. A lean crew is cheaper but the line runs slower.'),[
      {l:`A full crew — ${$(T.crewCost(t,'full'))}`,s:`${K.CREW_DAY} free day.`,dis:!!T.why(t,'crew',{lvl:'full'}),fn:later(()=>doAct(h,'crew',{lvl:'full'},res))},
      {l:`A lean crew — ${$(T.crewCost(t,'lean'))}`,s:`${K.CREW_DAY} free day. About three quarters of the line’s speed.`,dis:!!T.why(t,'crew',{lvl:'lean'}),fn:later(()=>doAct(h,'crew',{lvl:'lean'},res))},
      {l:'Not now',fn:later(()=>UI.planner(h,back))}]);
  };
  UI.maint=function(h,back){
    const res=rep=>UI.planner(h,back,rep.lines.join('<br>'));
    show(h,'🔧 Winter upkeep',note('Haul-out, a survey, zincs and paint, the RSW and freezer compressors, the plant’s roof and floors.'),[
      {l:'A full overhaul',s:'Half again the usual bill. Condition comes up a lot.',fn:later(()=>doAct(h,'maint',{lvl:'full'},res))},
      {l:'The basics',s:'The usual bill. Condition holds about even.',fn:later(()=>doAct(h,'maint',{lvl:'basic'},res))},
      {l:'Skip what you can',s:'Insurance and moorage only. Condition drops: more breakdowns, a failed inspection.',fn:later(()=>doAct(h,'maint',{lvl:'skip'},res))}]);
  };
  UI.price=function(h,back){
    const t=h.ticket(),st=t.state,res=rep=>UI.planner(h,back,rep.lines.join('<br>')),g=T.market(st,t.s).going.sockeye;
    const o1=x=>({l:`${x===0?'The going price':(x>0?'+':'')+c2(x)} (sockeye ${c2(g+x)}, about)`,s:x<0?'Fewer boats come alongside; the ones who do are loyal or close by.':x===0?'A fair share of the fleet, a fair margin.':x>=.1?'Boats line up for you, and most of the margin goes with them.':'More boats choose you; a thinner margin.',fn:later(()=>doAct(h,'price',{offset:x},res))});
    show(h,'💲 Your posted price',note(`What you pay the fleet over the rail and at your dock, against what the other buyers pay. This season’s going price will be about ${c2(g)} for sockeye. Your skipper also follows your rule on quality: ${st.policy.care==='bled'?'bled fish only':'every fish, fast'}.`),
      [-.05,0,.03,.05,.1].map(o1).concat([{l:st.policy.care==='bled'?'Take every fish, fast':'Bled fish only',s:st.policy.care==='bled'?'More boats and pounds, lower quality: smaller bonuses, more rejected loads.':'A few boats won’t bother, but cold, bled fish earn the plant’s quality bonus.',fn:later(()=>doAct(h,'price',{offset:st.policy.offset,care:st.policy.care==='bled'?'fast':'bled'},res))},{l:'Back',fn:later(()=>UI.planner(h,back))}]));
  };
  UI.loan=function(h,back){
    const t=h.ticket(),st=t.state,res=rep=>UI.planner(h,back,rep.lines.join('<br>')),L=st.loan;if(!L)return UI.planner(h,back);
    const part=Math.min(L.bal,25000);
    show(h,'🏦 The bank',note(`${$(L.bal)} left at ${Math.round(L.rate*100)}% a year. Each fall’s payment comes out of the season’s money.`),[
      {l:`Pay ${$(part)} now`,dis:t.cash<part,fn:later(()=>doAct(h,'payLoan',{amt:part},res))},
      {l:`Pay it all off — ${$(L.bal)}`,dis:t.cash<L.bal,fn:later(()=>doAct(h,'payLoan',{amt:L.bal},res))},
      {l:'Back',fn:later(()=>UI.planner(h,back))}]);
  };

  // ---- a day running the tender yourself ----
  UI.opener=function(h,done){
    const t=h.ticket(),st=t.state,today=T.openerToday(t);if(!today){done&&done(null);return}
    const v=st.tenders.find(x=>x.id===today.tenders[0].id),A=D.AREAS[v.area],g=st.season.going,ch={self:true};
    const step3=()=>show(h,'🌅 The run to the plant',note(`The hold is full of fish in refrigerated seawater. ${v.cond<50?'The RSW compressor has been running hot all day.':'The RSW is holding the hold just above freezing.'}`),[
      {l:'Run in tonight',s:'Full throttle on the evening tide: more fuel, fresh fish at the plant.',fn:later(()=>fin('now'))},
      {l:'Wait for the morning tide',s:'Saves some fuel. The fish sit overnight; a warm hold gets rejected.',fn:later(()=>fin('tide'))}],false,{events:[{id:'tender_pump',sev:0}]});
    const fin=run=>{ch.run=run;const rep=T.opener(h.ticket(),ch,o(h));h.apply(rep);
      show(h,'⚓ Delivered',lineP(rep),[{l:'Done',fn:later(()=>done&&done(rep))}],false,{events:rep.events});};
    const step2=()=>show(h,'🐟 Boats alongside',note(`Gillnetters tie up two and three deep and the pump starts. ${t.energy<35?'You are running on fumes.':''}`),[
      {l:'Check temperatures, take bled fish only',s:'Slower. Cold, bled fish earn the plant’s quality bonus; a few boats go elsewhere.',fn:later(()=>{ch.care='bled';step3()})},
      {l:'Take every fish, fast',s:'More pounds, less care: a smaller bonus and a better chance of a rejected load.',fn:later(()=>{ch.care='fast';step3()})}],false,{events:[{id:'tender_pump',sev:0}]});
    const opt=x=>({l:`${x===0?'Post the going price':(x>0?'Post +':'Post ')+c2(x)} — sockeye ${c2(g.sockeye+x)}`,s:x<0?'Thin traffic; you keep more of each pound.':x===0?'A fair share of the boats.':x>=.1?'Boats line up for you; most of the margin goes with them.':'More boats choose you.',fn:later(()=>{ch.offset=x;step2()})});
    show(h,`⚓ Opener: ${A.short}, ${U.mdTxt(t.md)}`,`<p>The ${esc(v.name)} is ${A.where}, the ${A.fleet} are setting, and the other buyers are posting ${c2(g.sockeye)} a pound for sockeye. Hold condition ${Math.round(v.cond)}.</p>${note(`Running it yourself saves the skipper’s ${$(K.SKIPPER)} and you can be picky about quality. It takes the whole day and ${K.SELF_ENERGY} energy.`)}`,
      [0,.05,.1,-.05].map(opt).concat([{l:'Let the skipper run it',s:'Back to your day.',fn:later(()=>done&&done(null))}]),false,{events:[{id:'tender_anchor',sev:0}]});
  };

  UI.report=function(h,title,rep,done){show(h,title,lineP(rep),[{l:'OK',fn:later(()=>done&&done())}],false,{events:rep.events})};
  // the business at a glance, for the host's tab
  UI.tab=function(t0){
    const t=T.normTicket(t0),st=t.state,S0=st.season;
    let x=`<div class="sect">⚓ Fish buying & processing</div>${rows(t)}`;
    if(S0&&S0.s===t.s){const L=S0.led;x+=note(`This season so far: ${L.n} opener${L.n===1?'':'s'}, ${lb(L.lbs)} bought, ${$(L.net)} from tendering. The plant and the openers you don’t play settle in the fall.`);
      const up=st.tenders.map(v=>{const nx=(S0.cal[v.area]||[]).filter(md=>md>=t.md&&!S0.done.some(d=>d.md===md&&d.id===v.id)).slice(0,3);return nx.length?`${v.name}: ${nx.map(U.mdTxt).join(', ')}`:''}).filter(Boolean);
      if(up.length)x+=note('Next openers: '+up.join(' · '))}
    return x;
  };
})(Tender);
