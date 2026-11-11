// ============================================================
//  CABIN UPKEEP, part 3: screens.
//  CabinUpkeep.ui.tab(ticket)            the Home tab as an HTML string. Its buttons carry data-cab="job" (with data-id) or data-cab="shop";
//                                        the host listens for clicks on them and calls open() or shop().
//  CabinUpkeep.ui.open(host, jobId)      the choice pop-up for one job: do it yourself, pay someone, or skip it
//  CabinUpkeep.ui.shop(host, back)       the things you buy once
//  CabinUpkeep.ui.scenes(host, rep, done) a winter report followed by each storm prompt in turn, then done()
//
//  The host adapter: {
//    show(title, html, buttons, lock),   required. Show a pop-up. buttons: [{l, s, dis, fn}]; fn runs after the pop-up has closed.
//    ticket(),                           required. A fresh ticket from the host's current numbers (it changes after every report).
//    apply(report),                      required. Apply a report to the host.
//    rand()                              optional, [0,1)
//  }
//  Pop-ups should be accessible: focus inside, Tab stays in, 44 px targets.
// ============================================================
(function(C){
  'use strict';
  const U=C.util,{$,esc,clamp}=U;
  const U2={};C.ui=U2;
  const rnd=h=>typeof h.rand==='function'?{rand:h.rand}:undefined;

  function meter(v){
    v=clamp(Math.round(v),0,100);const c=v>60?'#2f8f4e':v>30?'#c99a1c':'#c0392b';
    return `<div role="img" aria-label="Cabin condition ${v} out of 100" style="height:10px;border-radius:6px;background:rgba(127,127,127,.25);overflow:hidden"><i style="display:block;height:100%;width:${v}%;background:${c}"></i></div>`;
  }
  function jobButton(j){
    const best=j.opts[0],cheap=j.opts[1];
    const sub=`${j.why} ${best.dis?'':`Yourself: ${best.cash?$(best.cash):'free'}, ${best.min?best.min+' min':best.days?best.days+' day'+(best.days>1?'s':''):'a few hours'}. `}Or pay ${$(cheap.cash)}. ${j.risk}`;
    return `<button class="act ${j.kind==='event'?'primary':''}" data-cab="job" data-id="${esc(j.id)}"><span class="ic">${j.ic}</span><span class="tx"><b>${esc(j.title)}</b><span>${esc(sub)}</span></span></button>`;
  }
  U2.tab=function(t0){
    const t=C.normTicket(t0),s=t.state,jobs=C.jobs(t0),more=C.dueCount(t0)-jobs.length;
    const rows=C.status(t0).map(([a,b])=>`<div class="kv"><span>${a}</span><b style="text-align:right">${esc(b)}</b></div>`).join('');
    const low=s.cond<40;
    return `<div class="sect">🏠 Cabin condition</div>
      <div style="display:flex;align-items:center;gap:10px;margin:4px 0 10px"><div style="flex:1">${meter(s.cond)}</div><b style="min-width:3.2em;text-align:right${low?';color:var(--bad)':''}">${Math.round(s.cond)}/100</b></div>
      <p style="font-size:13px;color:var(--mute);margin:0 0 8px">${low?'The cabin is run down, so bad luck finds it more often.':s.cond>=75?'In good shape. Things go wrong less often.':'It drifts down a little every season. Jobs bring it back up.'} Every job: do it yourself, pay someone, or skip it and take the risk.</p>
      ${rows}
      <div class="sect">${jobs.length?'Due now':'Nothing due'}</div>
      ${jobs.length?jobs.map(jobButton).join(''):`<p style="font-size:13.5px;color:var(--mute)">${t.phase==='summer'?'The cabin can wait. Check back in a few days, and after the season.':'Nothing needs doing right now.'}</p>`}
      ${more>0?`<p style="font-size:12.5px;color:var(--mute)">${more} more job${more>1?'s':''} will come up after these.</p>`:''}
      <button class="act" data-cab="shop"><span class="ic">🏪</span><span class="tx"><b>Home upgrades</b><span>A wood stove, a fish processing station, a bear-resistant bin.</span></span></button>`;
  };

  // one job: three ways
  U2.open=function(host,jobId,then,lock){
    const t=host.ticket(),job=C.jobs(t,{all:true}).find(j=>j.id===jobId);
    if(!job){if(then)then();return}
    const run=o=>()=>{
      const rep=C.resolve(host.ticket(),jobId,o.id,rnd(host));
      if(!rep){if(then)then();return}
      host.apply(rep);
      if(job.kind==='event'||rep.severity>0)host.show(`${job.ic} ${job.title}`,rep.lines.map(l=>`<p>${l}</p>`).join('')+condLine(rep),[{l:'Continue',fn:()=>{if(then)then()}}],lock);
      else if(then)then();
    };
    const btns=job.opts.map(o=>({l:`${o.l}${o.id==='skip'?'':` · ${o.cash?$(o.cash):'free'}`}`,s:o.dis&&o.why?`${o.why}`:o.s,dis:o.dis,fn:run(o)}));
    if(!lock)btns.push({l:'Not now',s:'Decide later.',fn:()=>{if(then)then()}});
    host.show(`${job.ic} ${job.title}`,`<p>${esc(job.why)}</p><p class="small-note" style="color:var(--mute);font-size:13px">If you skip it: ${esc(job.risk.replace(/^Skip it and /,'').replace(/^Skip it /,''))}</p>`,btns,!!lock);
  };
  const condLine=rep=>`<p style="font-size:13px;color:var(--mute)">Cabin condition ${Math.round(rep.cond)}/100.</p>`;

  U2.shop=function(host,back){
    const t=host.ticket(),items=C.shop(t);
    host.show('🏪 Home upgrades',`<p style="font-size:13px;color:var(--mute)">Cash ${$(Math.round(t.cash))}. One-time buys for the cabin.</p>`,
      items.map(i=>({l:`${i.ic} ${i.n} — ${$(i.cost)}`,s:i.why&&i.has?`${i.why}. ${i.d}`:i.d,dis:i.dis,fn:()=>{const rep=C.buy(host.ticket(),i.id);if(rep)host.apply(rep);setTimeout(()=>U2.shop(host,back),0)}}))
        .concat([{l:'Done',fn:()=>{if(back)setTimeout(back,0)}}]));
  };

  // the winter report, then each storm prompt in turn
  U2.scenes=function(host,rep,done){
    const events=()=>C.jobs(host.ticket(),{all:true}).filter(j=>j.kind==='event');
    const next=()=>{const e=events()[0];if(!e){if(done)done();return}U2.open(host,e.id,next,true)};
    if(rep&&rep.lines&&rep.lines.length)host.show('🏠 The cabin this winter',rep.lines.map(l=>`<p>${l}</p>`).join('')+condLine(rep),[{l:'Continue',fn:next}],true);
    else next();
  };
  // a plain report as a pop-up (spring, a failed generator, a summer bear)
  U2.report=function(host,title,rep,done){
    if(!rep||!rep.lines.length){if(done)done();return}
    host.show(title,rep.lines.map(l=>`<p>${l}</p>`).join('')+condLine(rep),[{l:'Continue',fn:()=>{if(done)done()}}],true);
  };
})(CabinUpkeep);
