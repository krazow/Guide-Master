// ============================================================
//  KENAI WINTER CAMP, part 4: headless play.
//  KenaiCamp.sim({ticket, seed|rand, policy, steps}) plays a whole visit with no screen and returns {report, steps}.
//  Policies: 'first' (the first enabled choice), 'random', 'thoughtful' (a sensible camper: ice fishing and scouting,
//  a good pack, company, flies in the evening, leaves no trace) or your own function (view, state) → choice id.
//  The host game's bots and the tests use this; it is also how the engine is balanced.
// ============================================================
(function(K){
  'use strict';
  const D=K.data;

  function thoughtful(opts){
    opts=opts||{};const reserve=opts.reserve!=null?opts.reserve:2500,maxTrips=opts.trips!=null?opts.trips:2,gigs=opts.gigs!=null?opts.gigs:2;
    let k=0,bought=false;
    const PLAN=[{p:'cook',m:'feb',n:2},{p:'quartz',m:'jan',n:2},{p:'johnson',m:'jan',n:2}];
    return (v,ss)=>{
      const ids=v.buttons.filter(b=>!b.dis).map(b=>b.id),has=id=>ids.includes(id),m=v.meta,T=m.trip;
      const first=()=>ids[0];
      switch(m.phase){
        case 'hub':
          if(opts.shop&&!bought&&m.cash>14000&&!m.gear.includes('camper')){bought=true;return 'shop'}
          if(k<maxTrips&&has('plan')&&m.cash>reserve+400)return 'plan';
          if(has('work')&&ss.R.gigs.length<gigs&&m.cash>600)return 'work';
          return 'done';
        case 'where':return 'p:'+PLAN[Math.min(k,PLAN.length-1)].p;
        case 'when':return 'm:'+PLAN[Math.min(k,PLAN.length-1)].m;
        case 'nights':{const n=PLAN[Math.min(k,PLAN.length-1)].n;return has('n:'+n)?'n:'+n:first()}
        case 'who':{const c=ids.filter(i=>i.startsWith('c:')&&i!=='c:none'&&i!=='c:guide');return c[0]||(has('c:guide')?'c:guide':'c:none')}
        case 'shelter':return has('s:camper')?'s:camper':has('s:wall')?'s:wall':'s:tent';
        case 'pack':return m.plan&&m.plan.pack.length?'packed':'auto';
        case 'confirm':if(!has('go')){return 'back'}k++;return 'go';
        case 'day':
          if(has('icefish'))return 'icefish';
          if(has('scout'))return 'scout';
          if(T.slotsUsed>0)return 'evening';
          return has('track')?'track':'snowshoe';
        case 'lic':return has('buy')?'buy':'no';
        case 'kit':return has('rent')?'rent':'no';
        case 'icesafe':return 'check';
        case 'icethin':return 'skip';
        case 'icecatch':return has('freezer')?'freezer':'fry';
        case 'evening':return T.company&&T.i===1&&has('fire')?'fire':has('tie')?'tie':'rest';
        case 'night':return 'go';
        case 'leave':return 'thorough';
        case 'work':{const g=ids.filter(i=>i.startsWith('g:'));return g[0]||'back'}
        case 'shop':return has('b:camper')?'b:camper':'back';
        case 'result':return 'ok';
        default:return first();
      }
    };
  }
  K.policies={
    first:()=>(v)=>{if(v.meta.phase==='pack')return 'packed';const b=v.buttons.find(x=>!x.dis);return b?b.id:v.exit},
    random:rand=>(v)=>{const o=v.buttons.filter(x=>!x.dis);return o.length?o[Math.floor(rand()*o.length)].id:v.exit},
    thoughtful,
  };

  K.sim=function(o){
    o=o||{};
    const rand=typeof o.rand==='function'?o.rand:K.util.seeded(o.seed==null?1:o.seed);
    const ticket=Object.assign({},o.ticket||(o.mode==='solo'?K.solo.ticket(K.solo.fresh()):{}),o.mode?{mode:o.mode}:{});
    const s=K.session(ticket,{rand});
    let pol=o.policy||'thoughtful';
    if(typeof pol==='string')pol=pol==='random'?K.policies.random(rand):pol==='first'?K.policies.first():K.policies.thoughtful(o.opts);
    const cap=o.steps||600;let guard=0;
    while(!s.done&&guard++<cap){
      const v=s.view();
      let id=pol(v,s.state);
      // after a long visit, head for the exit so a silly policy can't loop forever
      if(guard>cap-30){const on=v.buttons.filter(b=>!b.dis);id=v.exit||(on[on.length-1]||{}).id}
      if(!s.choose(id)){const b=v.buttons.find(x=>!x.dis);if(!b||!s.choose(b.id))break}
    }
    return {report:s.report(),steps:guard,finished:s.done,session:s};
  };
})(KenaiCamp);
