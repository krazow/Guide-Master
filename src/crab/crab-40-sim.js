// ============================================================
//  CRAB, part 4: headless play, for tests and balancing.
//  Crab.autoJob(ticket, {rand, policy}) plays the deckhand job with no screen and returns {report, steps}.
//  Policies: 'careful' (a buddy's skipper, then the docks, home if nobody hires; drills, works steady, sorts carefully, beats ice),
//            'reckless' (the boat nobody wants, keeps the pace, sorts fast, stays on the stack), 'first' (the top button),
//            or your own (view, session) → button id.
//  Crab.autoSummer(ticket, {rand, use}) does what makes sense at Homer now (pull a soaking pot, set one, empty the cooler);
//  returns a list of reports (the host applies each, in order, getting a fresh ticket in between: pass {next: report => ticket}).
// ============================================================
(function(C){
  'use strict';
  const POL={
    careful:v=>({intro:'friend',nohire:v.buttons.some(b=>b.id==='docks')?'docks':'home',hired:'sail',drill:'practice',storm:'steady',sort:'careful',ice:'chip',pay:'done'})[v.meta.phase],
    reckless:v=>({intro:'anyboat',nohire:'anyboat',hired:'sail',drill:'motions',storm:'pace',sort:'fast',ice:'stack',pay:'done'})[v.meta.phase],
    first:v=>(v.buttons.find(b=>!b.dis)||{}).id,
  };
  C.policies=POL;
  C.autoJob=function(ticket,o){
    o=o||{};const pol=typeof o.policy==='function'?o.policy:POL[o.policy||'careful'];
    const s=C.job(ticket,{rand:o.rand}),steps=[];let g=0;
    while(!s.done&&g++<30){const v=s.view(),id=pol(v,s);steps.push([v.meta.phase,id]);if(!s.choose(id))s.choose((v.buttons.find(b=>!b.dis)||{}).id)}
    return {report:s.report(),steps};
  };
  C.autoSummer=function(ticket,o){
    o=o||{};const out=[];let t=ticket;
    const next=r=>{out.push(r);t=o.next?o.next(r):Object.assign({},t,{state:r.state})};
    for(let g=0;g<3;g++){
      const op=C.potOptions(t).find(x=>!x.dis);if(!op)break;
      if(op.id==='cooler'){next(C.useCrab(t,o.use||'freezer'));continue}
      if(op.id==='pull'){next(C.pullPot(t,{rand:o.rand}));continue}
      if(op.id==='set'){next(C.setPot(t,{rand:o.rand}));break}
    }
    return out;
  };
})(Crab);
