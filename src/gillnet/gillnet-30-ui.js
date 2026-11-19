// ============================================================
//  GILLNET, part 3: start().
//  Gillnet.start({ticket, host}) runs one opener through the host's own screens:
//    host.show(title, html, buttons, lock, meta)  show a pop-up; buttons are {l, s, dis, fn}; fn runs after the pop-up closes.
//                                                 meta: {phase, kind, role, events} (the host may pick a picture from events)
//    host.onFinish(report)                        the opener is over; apply the report (not called if the player walks away)
//    host.rand()                                  optional, a number in [0,1)
//  The engine itself never reads the page or the host's state.
// ============================================================
(function(G){
  'use strict';
  G.start=function(opts){
    opts=opts||{};const host=opts.host||{};
    if(typeof host.show!=='function') throw new Error('Gillnet.start needs host.show');
    const sess=G.session(opts.ticket,{rand:typeof host.rand==='function'?host.rand:undefined});
    let stopped=false,finished=false;
    function finish(){if(finished)return;finished=true;const rep=sess.report();if(typeof host.onFinish==='function')host.onFinish(rep)}
    function show(){
      if(stopped) return;
      if(sess.done) return finish();
      const v=sess.view();
      // the summary closes the session: the report is applied before the last sheet shows, so walking away there loses nothing
      if(v.meta.phase==='done'&&!finished){finished=true;const rep=sess.report();if(typeof host.onFinish==='function')host.onFinish(rep)}
      host.show(v.title,v.html,v.buttons.map(b=>({l:b.l,s:b.s,dis:b.dis,fn:()=>{sess.choose(b.id);setTimeout(show,0)}})),v.meta.phase!=='brief'&&v.meta.phase!=='done',v.meta);
    }
    show();
    return {session:sess,stop(){stopped=true}};
  };
})(Gillnet);
