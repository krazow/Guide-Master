// ============================================================
//  PURSE SEINE, part 3: the screens, through the host's own pop-ups.
//  Seine.start({ticket, host}) plays one opener:
//    host.show(title, html, buttons, lock, meta)  show a pop-up; buttons are {l, s, dis, fn}; fn runs after the pop-up closes.
//                                                 lock is true mid-opener (Esc must not dismiss it). meta: {id:'seine', phase, events}
//                                                 (what happened since the last screen: ids from Seine.data.EVENTS); ignore it if you like.
//    host.onFinish(report)                        the opener is over; apply the report (once)
//    host.rand()                                  optional, a number in [0,1)
//  Seine.ui.plan(host, ticket, back) shows the winter's choices (host.apply(report) applies one, host.ticket() gives a fresh ticket).
// ============================================================
(function(K){
  'use strict';
  K.start=function(opts){
    opts=opts||{};const host=opts.host||{};
    if(typeof host.show!=='function')throw new Error('Seine.start needs host.show');
    const sess=K.session(opts.ticket||{},{rand:typeof host.rand==='function'?host.rand:undefined});
    let stopped=false,finished=false,seen=0;
    function finish(){if(finished)return;finished=true;if(typeof host.onFinish==='function')host.onFinish(sess.report())}
    function show(){
      if(stopped)return;
      if(sess.done)return finish();
      const v=sess.view(),evs=v.meta.events.slice(seen);seen=v.meta.events.length;
      host.show(v.title,v.html,v.buttons.map(b=>({l:b.l,s:b.s,dis:b.dis,fn:()=>{sess.choose(b.id);setTimeout(show,0)}})),true,{id:'seine',phase:v.meta.phase,events:evs});
    }
    show();
    return {session:sess,stop(){stopped=true}};
  };
  K.ui={
    plan(host,back){
      const t=host.ticket(),o=K.planOptions(t),cur=o.find(x=>x.on);
      host.show(`⚓ Purse seining · ${t.year}`,`<p>Seine for salmon out of Homer on the Southern District’s openers: Monday, Wednesday and Friday, 6 AM to 10 PM, from mid-June. ${K.year(t.year).txt}</p><p style="font-size:13px;color:var(--mute)">The summer’s periods show in 📅 Bookings when the bookings open, and ADF&G can close one with a few days’ notice. Each one you sign on for is a day off the river: you choose, opener by opener. Now: <b>${cur?cur.l:'Not this summer'}</b>.</p>`,
        o.map(x=>({l:`${x.on?'✅ ':''}${x.l}`,s:x.dis&&x.why?`${x.why}. ${x.s}`:x.s,dis:x.dis||x.on,fn:()=>{const r=K.plan(host.ticket(),x.id);if(r)host.apply(r);setTimeout(()=>K.ui.plan(host,back),0)}}))
          .concat([{l:'Done',s:'Back to the off-season.',fn:()=>{if(back)setTimeout(back,0)}}]),false,{id:'seine',phase:'plan',events:[]});
    },
  };
})(Seine);
