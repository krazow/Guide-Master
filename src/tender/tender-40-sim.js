// ============================================================
//  TENDER & PROCESSOR, part 4: headless play.
//  Tender.autoplay(host, {policy}) makes the winter's decisions with no screen. host: {ticket(), apply(report)}.
//  Policies:
//    'processor'  works up the ladder sensibly: a chartered tender, then one of its own, line space, then a shore plant bought mostly
//                 with cash in a year the market doesn't look weak; hires a full crew, keeps things up, pays the loan down
//    'mogul'      over-invests: borrows the most it can for two tenders, a shore plant, then a floating processor; overpays the fleet,
//                 skips upkeep, fillets everything
//    or your own function (ticket) → [[id, arg], ...]
// ============================================================
(function(T){
  'use strict';
  const D=T.data,K=D.K;
  const P={
    processor(t){
      const st=t.state,out=[],cash=t.cash,left=t.seasonsLeft,owned=st.tenders.filter(v=>v.kind==='used').length,fc=T.forecast(t).lv;
      if(left<=0) return out;
      // tenders
      if(!st.tenders.length){
        const price=T.price(t,'buyT');
        if(st.yrs>=1&&left>=3&&cash>=price+70000) out.push(['buyT',{area:'uci'}]);
        else if(st.yrs>=1&&left>=3&&cash>=price*K.DOWN+60000&&t.rep>=K.BUY_REP) out.push(['buyT',{area:'uci',loan:true}]);
        else if(cash>=T.price(t,'lease')+40000&&left>=1) out.push(['lease',{area:'uci'}]);
      }
      // the plant: line space first, a shore plant once the business has a few seasons and the cash
      if(!st.plant&&owned+(out.some(x=>x[0]==='buyT')?1:0)>0){
        const sp=T.price(t,'shore');
        if(st.yrs>=2&&left>=4&&fc.salmon>0&&cash>=sp*.6+90000&&t.rep>=K.BUY_REP) out.push(['shore',{area:'uci',loan:cash<sp+90000}]);
        else if(st.yrs>=1&&cash>=T.price(t,'space')+30000) out.push(['space',{area:'uci'}]);
      }
      out.push(['mix',{mix:'fresh'}],['crew',{lvl:'full'}],['price',{offset:.02,care:'bled'}]);
      const low=st.tenders.some(v=>v.kind==='used'&&v.cond<55)||(st.plant&&st.plant.kind!=='space'&&st.plant.cond<55);
      out.push(['maint',{lvl:low?'full':'basic'}]);
      if(st.loan&&cash>160000) out.push(['payLoan',{amt:Math.min(st.loan.bal,Math.round(cash-140000))}]);
      return out;
    },
    mogul(t){
      const st=t.state,out=[],left=t.seasonsLeft;
      if(left<=0) return out;
      if(st.tenders.length<K.MAX_TENDERS) out.push(['buyT',{area:'uci',loan:true}],['lease',{area:'uci'}]);
      if(!st.plant) out.push(['floater',{area:'uci',loan:true}],['shore',{area:'uci',loan:true}],['space',{area:'uci'}]);
      else if(st.plant.kind==='shore'&&st.yrs>=3&&t.rep>=65) out.push(['sellP',{}],['floater',{area:'uci',loan:true}]);
      out.push(['mix',{mix:'fillet'}],['crew',{lvl:'full'}],['price',{offset:.08,care:'fast'}],['maint',{lvl:'skip'}]);
      if(st.plant&&st.plant.kind==='floater') out.push(['wcrab',{}]);
      return out;
    },
  };
  T.policies=P;
  T.autoplay=function(host,opts){
    // the policy is asked again after every step (cash and the state change), and each kind of step is taken once a winter
    const pol=typeof(opts&&opts.policy)==='function'?opts.policy:P[(opts&&opts.policy)||'processor'],done=[];
    for(let g=0;g<16;g++){
      const t=host.ticket(),next=pol(t).find(([id,arg])=>!done.includes(id)&&!T.why(t,id,arg)&&!(id==='wcrab'&&t.state.winterCrab));
      if(!next)break;
      const rep=T.act(t,next[0],next[1]);done.push(next[0]);if(rep.refused)continue;host.apply(rep);
    }
    return done;
  };
})(Tender);
