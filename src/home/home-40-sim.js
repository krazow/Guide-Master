// ============================================================
//  CABIN UPKEEP, part 4: headless play.
//  CabinUpkeep.autoplay(host, {policy, rand}) does every job that is due now, using a policy, with no screen. The host's bots and
//  the tests use it, and it is how the module is balanced. host: {ticket(), apply(report)}.
//  Policies:
//    'careful'  do it yourself when there is time and energy, else pay (while cash is comfortable), else skip
//    'payall'   pay when cash is comfortable, else do it yourself, else skip
//    'neglect'  skip everything, including the storm prompts
//    'first'    the first option that is available (what a bot tapping the top button would do)
//  or your own function (job, ticket) → 'diy' | 'pay' | 'skip' | null (null leaves the job for later).
// ============================================================
(function(C){
  'use strict';
  const POL={
    careful:(j,t)=>{const d=j.opts[0],p=j.opts[1];
      if(!d.dis&&(t.phase==='summer'||d.days<=1||t.daysLeft>=d.days+4))return 'diy';
      if(!p.dis&&t.cash>1500+p.cash)return 'pay';return 'skip'},
    payall:(j,t)=>{const d=j.opts[0],p=j.opts[1];if(!p.dis&&t.cash>1500+p.cash)return 'pay';if(!d.dis)return 'diy';return 'skip'},
    neglect:()=>'skip',
    first:j=>(j.opts.find(o=>!o.dis)||{}).id||'skip',
  };
  C.policies=POL;
  C.autoplay=function(host,o){
    o=o||{};const pol=typeof o.policy==='function'?o.policy:POL[o.policy||'careful'];
    const handled=new Set(),reports=[];let guard=0;
    while(guard++<40){
      const t=host.ticket(),j=C.jobs(t,{all:true}).find(x=>!handled.has(x.id));
      if(!j)break;
      handled.add(j.id);
      const pick=pol(j,C.normTicket(t));
      if(!pick)continue;
      const rep=C.resolve(host.ticket(),j.id,pick,o.rand?{rand:o.rand}:undefined);
      if(rep){host.apply(rep);reports.push(rep)}
    }
    return reports;
  };
})(CabinUpkeep);
