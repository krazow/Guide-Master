// ============================================================
//  GILLNET, part 4: headless play.
//  Gillnet.sim({ticket, seed | rand, policy}) plays one opener with no screen and returns {report, steps}.
//  Policies: 'first' (the first enabled choice: what a skipper does by habit), 'random', 'sensible' (reads the tide, picks often,
//  bleeds the fish, stays off the line and sits out a gale without a survival suit), 'greedy' (soaks long and pushes the rules),
//  or your own function (view, session) → choice id. The host game's bots and the tests use this; it is also how the money is balanced.
// ============================================================
(function(G){
  'use strict';
  const D=G.data;
  const P={
    first:v=>v.buttons.filter(b=>!b.dis)[0].id,
    random:(v,s,rand)=>{const b=v.buttons.filter(x=>!x.dis);return b[Math.floor(rand()*b.length)%b.length].id},
    sensible:(v,s)=>{const ids=v.buttons.filter(b=>!b.dis).map(b=>b.id),has=id=>ids.includes(id),T=s.ticket,F=s.state.flags;
      switch(v.meta.phase){
        case 'brief':if(T.seine)return 'careful';return T.wind>=D.SCA&&(T.kind==='set'||!T.suit)?'skip':'go';
        case 'set':return T.wind>=20&&has('hold')?'hold':F.deep?'flood':'all';
        case 'soak':return F.seals||!F.school?'pick':'soak';
        case 'pick':return 'bleed';
        case 'line':return has('rip')&&T.wind<20?'rip':ids[0];
        case 'set2':return T.day.area==='corridor'||T.day.area==='area1'?'short':'long';
        case 'tide':return {line:'pull',torn:'mend',seals:'haul',corked:'move',school:'pick'}[F.ev]||ids[0];
        case 'deliver':return T.kind==='set'?(F.bled?'dock':'tender'):(F.bar?'tender':'river');
        default:return ids[0];
      }},
    greedy:(v,s)=>{const ids=v.buttons.filter(b=>!b.dis).map(b=>b.id),has=id=>ids.includes(id);
      for(const k of ['go','all','soak','late','rip','long','ride','fish','leave','stay','tender'])if(has(k))return k;return ids[0]},
  };
  G.policies=P;
  G.sim=function(o){
    o=o||{};const rand=o.rand||(o.seed!=null?G.util.seeded(o.seed):Math.random);
    const s=G.session(o.ticket,{rand}),pol=typeof o.policy==='function'?o.policy:P[o.policy||'sensible']||P.sensible,steps=[];
    let g=0;
    while(!s.done&&g++<40){const v=s.view();if(v.meta.phase==='done'){s.choose('close');break}const id=pol(v,s,rand);steps.push([v.meta.phase,id]);if(!s.choose(id))s.choose(v.buttons.filter(b=>!b.dis)[0].id)}
    return {report:s.report(),steps};
  };
})(Gillnet);
