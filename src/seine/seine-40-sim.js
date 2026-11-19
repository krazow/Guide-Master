// ============================================================
//  PURSE SEINE, part 4: headless play.
//  Seine.sim({ticket, seed|rand, policy}) plays one opener with no screen and returns {report, steps, finished}.
//  Policies: 'first' (the first enabled choice), 'random', 'careful' (a sensible hand or skipper: waits out a blow, turns at the
//  hook-off, stays outside the lines, sets off a bad reef, brails steady) and 'greedy' (cuts in, sets inside the line, tight to the
//  reef, hurries the brailer), or your own (view, session) → choice id. The host game's bots and the tests use it.
// ============================================================
(function(K){
  'use strict';
  const D=K.data;
  const has=(v,id)=>v.buttons.some(b=>b.id===id&&!b.dis);
  function careful(v,s){
    const m=v.meta,skip=m.role==='skip',or=(...ids)=>ids.find(id=>has(v,id))||(v.buttons.find(b=>!b.dis)||{}).id;
    switch(m.phase){
      case 'dock':return has(v,'missed')?'missed':s.X.wind>=D.WIND_BAD&&has(v,'wait')?'wait':'go';
      case 'grounds':{if(!skip)return 'pace:steady';
        const best=D.SPOT_IDS.map(id=>[id,D.SPOTS[id].sock*s.Y.sock+.3*D.SPOTS[id].pink*s.Y.pink-D.SPOTS[id].reef*.4]).sort((a,b)=>b[1]-a[1])[0][0];return 'spot:'+best}
      case 'look':{if(!skip)return s.T.state.skill>=20?'call':'quiet';
        const sc=m.school;if(sc.read<.55&&has(v,'wait')&&!s.X.waited){s.X.waited=true;return 'wait'}s.X.waited=false;
        return or('turn','set')}
      case 'move':return 'back';
      case 'set':return skip?(D.SPOTS[m.spot].reef>=.3?'off':'tight'):'watch';
      case 'haul':return or('brail','next','tender');
      case 'tender':return or('bleed','deliver');
      default:return or('done','ok');
    }
  }
  function greedy(v,s){
    const m=v.meta,or=(...ids)=>ids.find(id=>has(v,id))||(v.buttons.find(b=>!b.dis)||{}).id;
    switch(m.phase){
      case 'dock':return or('missed','go');
      case 'grounds':return m.role==='skip'?'spot:chinapoot':'pace:hustle';
      case 'look':return m.role==='skip'?or('inside','cut','set'):'call';
      case 'set':return or('tight','rush');
      case 'haul':return or('hurry','next','tender');
      case 'tender':return or('bleed','deliver');
      default:return or('done');
    }
  }
  K.policies={
    first:()=>v=>{const b=v.buttons.find(x=>!x.dis);return b?b.id:v.exit},
    random:rand=>v=>{const o=v.buttons.filter(x=>!x.dis);return o.length?o[Math.floor(rand()*o.length)].id:v.exit},
    careful:()=>careful,greedy:()=>greedy,
  };
  K.sim=function(o){
    o=o||{};
    const rand=typeof o.rand==='function'?o.rand:K.util.seeded(o.seed==null?1:o.seed);
    const s=K.session(o.ticket||{},{rand});
    let pol=o.policy||'careful';
    if(typeof pol==='string')pol=pol==='random'?K.policies.random(rand):(K.policies[pol]||K.policies.careful)();
    let guard=0;
    while(!s.done&&guard++<80){
      const v=s.view();let id=pol(v,s);
      if(!s.choose(id)){const b=v.buttons.find(x=>!x.dis);if(!b||!s.choose(b.id))break}
    }
    return {report:s.report(),steps:guard,finished:s.done,session:s};
  };
})(Seine);
