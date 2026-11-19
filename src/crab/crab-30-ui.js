// ============================================================
//  CRAB, part 3: screens. Every screen goes through the host's own pop-up.
//  The host adapter: {
//    show(title, html, buttons, lock, meta)  required. buttons: [{l, s, dis, fn}]; fn runs after the pop-up has closed. lock=true: Esc
//                                            must not dismiss it. meta (optional): {events: [{id, sev}]} from Crab.data.EVENTS, for a
//                                            host that shows an illustration; ignore it if you like.
//    ticket(),                               required. A fresh ticket from the host's numbers (it changes after every report).
//    apply(report),                          required. Apply a report to the host.
//    rand(),                                 optional, [0,1)
//  }
//  Crab.ui.pot(host, id, done)     the summer pot: 'set', 'pull' or 'cooler' (a result, then what to do with the crab)
//  Crab.ui.cooler(host, done)      crab in the cooler: the freezer, a crab feed, or (never) a sale
//  Crab.ui.winter(host, back)      the winter sheet: buy a pot, a Tanner day, the deckhand job
//  Crab.ui.job(host, done)         the deckhand job, screen by screen; the report is applied once, at the end
// ============================================================
(function(C){
  'use strict';
  const U=C.util,D=C.data,{esc}=U;
  const UI={};C.ui=UI;
  const rnd=h=>typeof h.rand==='function'?{rand:h.rand}:undefined;
  const P=lines=>lines.map(l=>`<p>${l}</p>`).join('');
  const SELL_WHY='Not allowed: crab from a sport, personal-use or subsistence permit is for your household and friends. Selling it, or trading it for money, is illegal.';

  UI.cooler=function(host,done){
    const t=host.ticket(),h=C.normState(t.state).hold;
    if(!h){if(done)done();return}
    const kind=h.kind==='tanner'?'Tanner crab':'Dungeness';
    host.show(`🦀 ${h.n} ${kind} in the cooler`,`<p>What happens to them?</p>`,[
      {l:'🧊 Into the freezer',s:`About ${h.n*D.MEALS_PER_CRAB} meal${h.n*D.MEALS_PER_CRAB===1?'':'s'} of crab meat for the winter.`,fn:()=>{const r=C.useCrab(host.ticket(),'freezer');host.apply(r);host.show('🧊 Crab in the freezer',P(r.lines),[{l:'OK',fn:()=>{if(done)done(r)}}],false,{events:r.events})}},
      {l:'🍽️ A crab feed on the dock',s:'For the dock crowd and a party you guided. Goodwill, and people talk.',fn:()=>{const r=C.useCrab(host.ticket(),'feed');host.apply(r);host.show('🍽️ Crab feed',P(r.lines),[{l:'OK',fn:()=>{if(done)done(r)}}],false,{events:r.events})}},
      {l:'💵 Sell them to a restaurant on the Spit',s:SELL_WHY,dis:true,fn:()=>{}},
    ],true,{events:[{id:'pot_pull',sev:0}]});
  };
  UI.pot=function(host,id,done){
    if(id==='cooler') return UI.cooler(host,done);
    const r=id==='set'?C.setPot(host.ticket(),rnd(host)):C.pullPot(host.ticket(),rnd(host));
    host.apply(r);
    const hold=C.normState(r.state).hold;
    const title=id==='set'?'🦀 Pot set':r.events.some(e=>e.id==='pot_lost')?'🌊 Pot lost':'🦀 Pulling the pot';
    if(hold) return host.show(title,P(r.lines)+`<p>${hold.n} legal crab in the cooler. What happens to them?</p>`,[
      {l:'🧊 Into the freezer',s:`About ${hold.n*D.MEALS_PER_CRAB} meal${hold.n*D.MEALS_PER_CRAB===1?'':'s'} of crab meat.`,fn:()=>{const u=C.useCrab(host.ticket(),'freezer');host.apply(u);if(done)done(u)}},
      {l:'🍽️ A crab feed on the dock',s:'For the dock crowd and a party you guided. Goodwill, and people talk.',fn:()=>{const u=C.useCrab(host.ticket(),'feed');host.apply(u);if(done)done(u)}},
      {l:'💵 Sell them to a restaurant on the Spit',s:SELL_WHY,dis:true,fn:()=>{}},
    ],true,{events:r.events});
    host.show(title,P(r.lines),[{l:'OK',fn:()=>{if(done)done(r)}}],false,{events:r.events});
  };
  UI.winter=function(host,back){
    const t=host.ticket(),o=C.winterOptions(t),again=()=>UI.winter(host,back);
    const st=C.status(t).map(([a,b])=>`${esc(a)}: <b>${esc(b)}</b>`).join(' · ');
    host.show('🦀 Crabbing',`<p style="font-size:13px;opacity:.85">${st}. ${t.daysLeft} free day${t.daysLeft===1?'':'s'} left this winter, shared with camping, the cabin and winter work.</p>`,
      o.map(x=>({l:`${x.ic} ${x.l}`,s:x.s,dis:x.dis,fn:()=>{
        if(x.id==='cooler') return UI.cooler(host,again);
        if(x.id==='kit'){const r=C.buyKit(host.ticket());host.apply(r);return host.show('🪤 A crab pot',P(r.lines),[{l:'OK',fn:again}],false,{events:r.events})}
        if(x.id==='tanner'){const r=C.tannerDay(host.ticket(),rnd(host));host.apply(r);const h=C.normState(r.state).hold;
          return host.show('❄️ Tanner crab in Kachemak Bay',P(r.lines),[{l:h?'Deal with the crab':'OK',fn:()=>h?UI.cooler(host,again):again()}],!!h,{events:r.events})}
        if(x.id==='job') return UI.job(host,()=>again());
      }})).concat([{l:'Back',s:'',fn:()=>{if(back)back()}}]),false,{});
  };
  UI.job=function(host,done){
    const sess=C.job(host.ticket(),rnd(host));
    const step=()=>{
      if(sess.done){const r=sess.report();host.apply(r);if(done)done(r);return}
      const v=sess.view();
      host.show(v.title,v.html,v.buttons.map(b=>({l:b.l,s:b.s,dis:b.dis,fn:()=>{sess.choose(b.id);step()}})),v.meta.phase!=='intro',{events:v.meta.events,phase:v.meta.phase});
    };
    step();
    return sess;
  };
})(Crab);
