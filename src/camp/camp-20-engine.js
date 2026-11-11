// ============================================================
//  KENAI WINTER CAMP, part 2: the engine.
//  A state machine with no screen of its own: KenaiCamp.session(ticket, {rand}) returns an object whose view() says what to
//  show (a title, some HTML and a list of choices) and whose choose(id) moves on. The UI (camp-30-ui.js) and the headless
//  simulator (camp-40-sim.js) both drive it the same way. It reads the ticket once and produces one report; it never touches
//  the host game's state.
//
//  One visit to the winter hub can hold up to MAX_TRIPS camping trips and some winter work, all inside a budget of
//  WINTER_DAYS free days. A trip is: where, when, how long, who comes, where you sleep, what you pack, then for each day
//  an activity (one in the dark months, two on long days), an evening, and a night; at the end, break camp.
// ============================================================
(function(K){
  'use strict';
  const D=K.data,U=K.util,{clamp,r2,$,esc,sgn}=U;
  const r3=x=>Math.round(x*1000)/1000;
  const n0=(v,d)=>typeof v==='number'&&isFinite(v)?v:d;

  // ---- the ticket: what the host hands in (anything missing gets a sensible default) ----
  K.normTicket=function(t){
    t=t||{};
    const ar=a=>Array.isArray(a)?a:[];
    return {
      v:K.SCHEMA,mode:t.mode==='solo'?'solo':'guide',
      year:n0(t.year,2026),                                   // the calendar year the winter starts in (Nov and Dec are this year; Jan to Mar the next)
      cash:n0(t.cash,0),energy:clamp(n0(t.energy,70),0,100),rep:clamp(n0(t.rep,50),0,100),skill:n0(t.skill,20),
      gas:n0(t.gas,5.34),mpg:n0(t.mpg,D.MPG),costMult:n0(t.costMult,1),   // pump price a gallon, the truck's mileage, the difficulty's cost multiplier
      gear:ar(t.gear).slice(),                                // owned gear ids: pack items, and the shelters 'wall' and 'camper'
      licYear:n0(t.licYear,0),                                // the calendar year of the last fishing license bought
      food:{meals:n0(t.food&&t.food.meals,0),freezerRoom:Math.max(0,n0(t.food&&t.food.freezerRoom,30))},
      regulars:ar(t.regulars).map(r=>({id:String(r.id),name:String(r.name||r.id),mood:n0(r.mood,60)})),   // returning clients: mood 0..100 is how their last trip went
      rival:t.rival&&t.rival.id?{id:String(t.rival.id),name:String(t.rival.name||'the other guide'),mood:n0(t.rival.mood,0)}:null,
      guideFriend:t.guideFriend!==false,
      daysLeft:Math.max(0,n0(t.daysLeft,D.WINTER_DAYS)),tripsLeft:Math.max(0,n0(t.tripsLeft,D.MAX_TRIPS)),gigsLeft:Math.max(0,n0(t.gigsLeft,D.MAX_GIGS)),
      gigsDone:ar(t.gigsDone).slice(),
      seen:Object.assign({},t.seen||{}),ach:ar(t.ach).slice(),noTraceTrips:n0(t.noTraceTrips,0),
    };
  };

  function weights(T,onlyWild,good){
    const pl=D.place(T.place),m=D.month(T.month);
    return D.ENC.map(e=>{
      let w=0;
      if(e.cat==='wild'){
        if(e.only)w=e.only.includes(pl.id)?5:0;else if(e.h.includes(pl.h))w=e.h[0]===pl.h?4:3;
      }else if(!onlyWild)w=e.base*m[e.mon];
      if(good&&e.kind==='bad')w=0;
      if(w&&e.kind==='bad'&&e.counter&&T.pack.includes(e.counter))w*=e.cw||.3;
      if(w&&e.kind==='bad'&&e.cat==='wild'&&T.warned)w*=.7;
      return w;
    });
  }
  // the odds of each encounter at a place in a month with a pack (for tests and balancing)
  K.weights=(place,month,pack)=>weights({place,month,pack:pack||[]},false,false).map((w,i)=>({id:D.ENC[i].id,kind:D.ENC[i].kind,w}));

  K.session=function(ticket,o){
    o=o||{};
    const t=K.normTicket(ticket),rand=typeof o.rand==='function'?o.rand:Math.random,r=()=>rand();
    const pk=a=>a[Math.floor(r()*a.length)];
    const ss={t,mode:t.mode,phase:'hub',cash:t.cash,energy:t.energy,rep:t.rep,skill:t.skill,days:t.daysLeft,tripsLeft:t.tripsLeft,gigsLeft:t.gigsLeft,
      gear:new Set(t.gear),lic:t.licYear,seen:Object.assign({},t.seen),gigsDone:new Set(t.gigsDone),plan:null,trip:null,res:null,steps:0,over:false};
    const R={spent:0,earned:0,wom:0,book:0,fish:0,tackle:0,q:0,scoutPts:0,scoutAreas:[],rel:{},seen:{},fresh:[],gearBought:[],lic:null,daysUsed:0,nights:0,enc:0,noTraceTrips:0,ties:0,aurora:0,trips:[],log:[],gigs:[],skillD:0};
    ss.R=R;
    const spend=x=>{x=r2(x);ss.cash=r2(ss.cash-x);R.spent=r2(R.spent+x)};
    const earn=x=>{x=r2(x);ss.cash=r2(ss.cash+x);R.earned=r2(R.earned+x)};
    const loseCash=x=>{const c=Math.min(x,Math.max(0,Math.floor(ss.cash)));spend(c);return c};
    const adjE=v=>{ss.energy=clamp(Math.round(ss.energy+v),0,100)};
    const adjR=v=>{ss.rep=clamp(Math.round(ss.rep+v),0,100)};
    const has=id=>ss.gear.has(id);
    const B=(id,l,s,dis)=>({id,l,s:s||'',dis:!!dis});
    const stat=()=>`<p class="cc-stat" style="font-size:13px;color:var(--mute,#667)">Cash ${$(Math.round(ss.cash))} · Energy ${ss.energy} · Days left this winter: ${ss.days}</p>`;
    const names=()=>{const m={};t.regulars.forEach(g=>{m[g.id]={name:g.name,kind:'regular'}});if(t.rival)m[t.rival.id]={name:t.rival.name,kind:'rival'};m.guide={name:'a fellow guide',kind:'guide'};return m};
    const seenN=()=>D.ALL.filter(id=>ss.seen[id]>0).length;
    const markSeen=id=>{const was=ss.seen[id]>0;ss.seen[id]=(ss.seen[id]||0)+1;R.seen[id]=(R.seen[id]||0)+1;if(!was){R.fresh.push(id);return true}return false};
    const sp=id=>D.SPECIES.find(s=>s.id===id);

    // ---- costs ----
    function cost(p){
      const pl=D.place(p.place),n=p.nights,sh=D.SHELTERS[p.shelter],comp=p.company?1:0;
      const gal=r2(Math.round(pl.miles*2/t.mpg*10)/10),fuel=r2(gal*t.gas*t.costMult);
      const cabin=p.shelter==='cabin'?r2(pl.cabin*n*t.costMult):0,fees=p.shelter==='cabin'?0:r2(pl.fee*n*t.costMult);
      const sup=r2(D.SUPPLIES*n*t.costMult*(1+.6*comp));
      let gear=0;(p.pack||[]).forEach(id=>{const it=D.pack(id);if(!it.once||!has(id))gear+=it.cost});
      return {gal,fuel,fees,cabin,sup,gear:r2(gear),total:r2(fuel+fees+cabin+sup+gear)};
    }
    const capOf=p=>D.CAPACITY+D.SHELTERS[p.shelter].cap;
    const loadOf=p=>D.SHELTERS[p.shelter].load+(p.company?2:0)+(p.pack||[]).reduce((a,id)=>a+D.pack(id).wt,0);
    function autoPack(p){
      const pl=D.place(p.place),m=D.month(p.month),want=['bear','bag','layers'];
      if(pl.ice)want.push('picks','ice');                 // on a stocked lake the picks come first; the kit can be rented if there is no room
      if(m.cold>=1)want.push('fuel');
      want.push('truck','vise');
      const out=[],base=Object.assign({},p,{pack:[]});
      for(const id of want){
        const it=D.pack(id),next=Object.assign({},p,{pack:out.concat(id)});
        if(loadOf(next)>capOf(next))continue;
        if((!it.once||!has(id))&&cost(next).total>ss.cash)continue;
        out.push(id);
      }
      return out;
    }

    // ---- daily weather and the ice ----
    const mon=()=>D.month(ss.trip.month);
    function newDay(){const T=ss.trip;T.today=[];T.slotsUsed=0;T.clear=r()<mon().clear;T.slots=D.slots(mon())}
    function iceThick(){const T=ss.trip;if(T.ice==null)T.ice=Math.max(1,Math.round(mon().ice*16+(r()-.5)*8));return Math.max(0,T.ice-(T.thaw?3:0))}

    // ---- encounters ----
    function pickEnc(T,onlyWild,good){
      const ws=weights(T,onlyWild,good),tot=ws.reduce((a,b)=>a+b,0);let x=r()*tot;
      for(let i=0;i<ws.length;i++){x-=ws[i];if(x<0)return D.ENC[i]}
      return D.ENC[0];
    }
    const fxLine=d=>{const a=[];if(d.energy)a.push('Energy '+sgn(d.energy));if(d.skill)a.push('Skill '+sgn(d.skill));if(d.rep)a.push('Rep '+sgn(d.rep));if(d.cash)a.push(`−${$(Math.abs(d.cash))}`);if(d.days)a.push('an extra day snowed in');return a.length?` (${a.join(', ')})`:''};
    function applyD(d){
      const T=ss.trip;let e=d.energy||0,cash=d.cash||0;
      if(cash<0){cash=-loseCash(-cash)}
      d.cash=cash;
      adjE(e);if(d.rep)adjR(d.rep);if(d.skill){ss.skill+=d.skill;R.skillD+=d.skill}if(d.wom)R.wom+=d.wom;
      if(d.thaw)T.thaw=true;if(d.messy)T.messy=true;if(d.days)T.extra+=d.days;
    }
    function night(){
      const T=ss.trip,i=T.i,m=D.month(T.month),comfort=D.SHELTERS[T.shelter].comfort,c={has:id=>T.pack.includes(id),r,comfort,shelter:T.shelter};
      let rows;
      if(r()<.5){
        let e=pickEnc(T,false,false);
        if(e.kind==='bad'&&comfort>0&&r()<.2*comfort)e=null;     // a better shelter turns a hard night into a bad hour
        if(e){
          const f=e.fx(c);applyD(f.d);T.enc++;R.enc++;
          const isNew=e.cat==='wild'?markSeen(e.id):false;
          T.events.push(e.id);
          if(T.company)T.rel+=e.kind==='bad'?-1:1;
          if(e.kind==='good')T.goodN++;else if(e.kind==='bad')T.badN++;
          return `<p><b>Night ${i}: ${e.ic} ${e.t}${isNew?' · new for your log':''}.</b> ${e.text} <em>${f.line}${fxLine(f.d)}</em>${f.lesson?`<br><span style="font-size:13px;color:var(--mute,#667)">💡 ${f.lesson}</span>`:''}</p>`;
        }
        adjE(2+comfort);if(T.company)T.rel+=1;
        return `<p><b>Night ${i}:</b> A bad night coming on, but your ${D.SHELTERS[T.shelter].n.toLowerCase()} turns it into a nuisance. (Energy +${2+comfort})</p>`;
      }
      adjE(2+(T.pack.includes('bag')?1:0)+(comfort>0?1:0));if(T.company)T.rel+=1;
      return `<p><b>Night ${i}:</b> ${pk(D.QUIET)} (Energy +${2+(T.pack.includes('bag')?1:0)+(comfort>0?1:0)})</p>`;
    }

    // ---- the flow ----
    const toRes=(title,html,next)=>{ss.res={title,html,next};ss.phase='result'};
    function startPlan(){ss.plan={place:null,month:null,nights:null,company:null,shelter:'tent',pack:[],declined:[]};ss.phase='where'}
    function guestOf(id){const n=names()[id];return n?n.name:'your guest'}
    function startTrip(){
      const p=ss.plan,c=cost(p),pl=D.place(p.place),sp0=R.spent;
      spend(c.total);(p.pack||[]).forEach(id=>{const it=D.pack(id);if(it.once&&!has(id)){ss.gear.add(id);R.gearBought.push(id)}});
      ss.trip={place:p.place,month:p.month,nights:p.nights,i:1,extra:0,company:p.company,shelter:p.shelter,pack:p.pack.slice(),cost:c,ice:null,thaw:false,warned:false,messy:false,
        sp0,rel:0,enc:0,goodN:0,badN:0,events:[],acts:[],fish:0,tackle:0,ties:0,scout:0,e0:ss.energy,c0:ss.cash+c.total,rep0:ss.rep,sk0:ss.skill,fresh0:R.fresh.length,aurora:0,thorough:null,log:[],leave:false,slots:1,slotsUsed:0,clear:false};
      newDay();ss.phase='day';
    }
    function afterAct(){
      const T=ss.trip;T.slotsUsed++;
      ss.phase=T.slotsUsed<T.slots?'day':'evening';
    }
    // an activity finishes: show what happened, then go on
    const actDone=(title,html)=>toRes(title,html,afterAct);

    function doActivity(id){
      const T=ss.trip,pl=D.place(T.place),m=mon();
      const note=(k,txt)=>{T.acts.push(k);T.today.push(k);T.log.push(txt)};
      if(id==='rest'){adjE(3);note('rest','Rested in camp.');return actDone('🏕️ A day in camp',`<p>You keep camp, split wood, melt snow and sit in the low sun. (Energy +3)</p>`)}
      if(id==='icefish'){
        if(ss.lic<D.calYear(m,t.year)){ss.phase='lic';return}
        if(!T.pack.includes('ice')){ss.phase='kit';return}
        ss.phase='icesafe';return;
      }
      if(id==='snowshoe'||id==='ski'){
        const ski=id==='ski',sprain=r()<(ski?.08:.1);
        if(sprain){adjE(-5);note(id,'Took a fall on the trail.');return actDone(ski?'⛷️ A fall on the trail':'🥾 A twisted ankle',`<p>${ski?'A ski catches in a drift':'A snowshoe catches a buried branch'} and you go down hard. You limp back to camp. (Energy −5)</p><p style="font-size:13px;color:var(--mute,#667)">💡 Tell someone your route, and carry a whistle and a headlamp in winter, even for a short loop.</p>`)}
        adjE(ski?5:4);let extra='';
        if(r()<(ski?.2:.3)){const e=pickEnc(T,true,true),isNew=markSeen(e.id);adjE(2);extra=`<p><b>${e.ic} ${e.t}${isNew?' · new for your log':''}.</b> ${e.text} (Energy +2)</p>`}
        note(id,ski?'Skied the trails.':'Snowshoed the trails.');
        return actDone(ski?'⛷️ Skiing the trails':'🥾 Snowshoeing',`<p>${ski?'You ski a groomed loop and a quiet side trail, the snow squeaking and the spruce hushed.':'You break trail on snowshoes up a ridge and loop back through the spruce.'} (Energy +${ski?5:4})</p>${extra}`);
      }
      if(id==='track'){
        const win=r()<clamp(.55+ss.skill/400+(T.company?.05:0),.3,.85);
        if(!win){adjE(1);note('track','Followed tracks that went cold.');return actDone('🐾 Cold tracks',`<p>The wind has erased most of the sign and the tracks you follow end at a creek. A good walk, anyway. (Energy +1)</p>`)}
        if(r()<.12){adjE(-5);note('track','Spooked a moose on the trail.');return actDone('🫎 Too close',`<p>You follow fresh sign into the willows and nearly walk into a moose. You back out slowly; it watches you go. (Energy −5)</p><p style="font-size:13px;color:var(--mute,#667)">💡 In winter, moose are stressed and hungry. Keep at least 25 yards, and never get between a cow and her calf.</p>`)}
        const pool=D.ENC.filter(e=>e.cat==='wild'&&e.id!=='bear'),ws=weights(T,true,false),cand=pool.map(e=>ws[D.ENC.indexOf(e)]);
        let tot=cand.reduce((a,b)=>a+b,0),x=r()*tot,e=pool[0];for(let i=0;i<pool.length;i++){x-=cand[i];if(x<0){e=pool[i];break}}
        const isNew=markSeen(e.id);let line;
        if(e.kind==='bad'){T.warned=true;line='You read the sign and now know what is around camp, so you tighten up food storage. (Skill +1, harder for raiders tonight)'}else{adjE(2);line='A clear look at an animal you came for. (Energy +2, Skill +1)'}
        ss.skill+=1;R.skillD+=1;note('track','Tracked '+e.t.toLowerCase()+'.');
        return actDone(`🐾 Tracking: ${e.ic} ${e.t}${isNew?' · new for your log':''}`,`<p>You pick up fresh tracks and follow them patiently, reading the sign. ${e.text}</p><p><em>${line}</em></p>`);
      }
      if(id==='scout'){
        if(r()<.15&&!T.pack.includes('truck')){const c=loseCash(40*t.costMult);adjE(-3);R.scoutAreas.includes(pl.scout)||R.scoutAreas.push(pl.scout);R.scoutPts=Math.min(2,R.scoutPts+1);T.scout++;note('scout','Scouted the water; the truck got stuck.');return actDone('🔭 Scouting, and a stuck truck',`<p>You walk the bank and take notes on the holes and the ice shelves, then get the truck stuck on the way out. A neighbor with a winch charges ${$(c)}. The notes are good, though. (Energy −3, −${$(c)})</p>`)}
        adjE(-3);ss.skill+=1;R.skillD+=1;R.scoutAreas.includes(pl.scout)||R.scoutAreas.push(pl.scout);R.scoutPts=Math.min(2,R.scoutPts+1);T.scout++;
        note('scout','Scouted next season’s water.');
        return actDone(pl.scout==='kasilof'?'🔭 Scouting the Kasilof':'🔭 Scouting the upper Kenai',`<p>${pl.scout==='kasilof'?'You walk the Kasilof’s bank where the dippers and drift boats go in summer, noting the bars, the log jams and the ice shelves.':'You walk the upper Kenai’s banks near the lake outlet, noting where the gravel is shifting, which holes are deepening and where the rapids have changed.'} You will know this water better in July. (Energy −3, Skill +1)</p>`);
      }
    }
    function iceFish(checked){
      const T=ss.trip,thick=iceThick();let fell=false;
      if(checked==null){   // risk it
        const p=thick<3?.45:thick<4?.3:thick<5?.06:.01;fell=r()<p;
        if(fell){
          const picks=T.pack.includes('picks');let e=picks?-8:-18,cash=picks?0:-90;if(T.pack.includes('layers'))e=Math.round(e*.6);
          adjE(e);const c=cash?loseCash(-cash):0;T.acts.push('icefall');T.today.push('icefish');T.log.push('Fell through the ice.');
          return actDone('🧊 Through the ice',`<p>The ice drops out from under you about ${pk([30,40,50])} feet from shore, ${thick} inch${thick===1?'':'es'} thick right there. ${picks?'You kick, grab your ice picks and haul yourself out onto your belly, then roll away from the hole.':'You claw at the edge until it holds, and the cold is huge.'} ${T.pack.includes('layers')?'You change into the dry layers in your pack.':'You are soaked in single-digit air and it is a long, dangerous walk to the truck.'}${c?` You lose an auger and a rod. (−${$(c)})`:''} (Energy ${e})</p><p style="font-size:13px;color:var(--mute,#667)">💡 Clear hard ice about 4 inches thick holds a person on foot. Check as you go, stay off ice near inlets, outlets and springs, and wear picks around your neck.</p>`);
        }
      }else if(checked<D.ICE_WALK){return}
      const n=Math.max(1,Math.round(1+r()*3.5+(ss.skill>=40?1:0)));
      T.fishN=n;ss.phase='icecatch';
    }
    function iceCatchUse(use){
      const T=ss.trip,n=T.fishN||0;let html;
      T.acts.push('icefish');T.today.push('icefish');
      if(use==='freezer'){const room=Math.max(0,t.food.freezerRoom-R.fish),put=Math.min(n,room);R.fish+=put;T.fish+=put;T.log.push(`Ice fished: ${n}, ${put} to the freezer.`);html=`<p>You clean ${n} fish on the ice and carry ${put} home for the freezer.${put<n?` The rest go to the neighbors; the freezer is full.`:''}</p>`}
      else if(use==='fry'){adjE(6);if(T.company)T.rel+=1;T.log.push(`Ice fished: ${n}, a fish fry.`);html=`<p>You fry ${n} fish in a skillet over the stove, right there on the shore: crisp, hot and eaten with your fingers. (Energy +6)${T.company?' Your company will remember it.':''}</p>`}
      else{adjR(1);R.wom+=n>=3?1:0;T.log.push(`Ice fished: ${n}, a story.`);html=`<p>You let the fish go (the bigger ones, anyway) and keep the story: ${n} on the ice in a day, and a hole you can describe to anybody. (Rep +1)</p>`}
      actDone('🧊 Ice fishing: '+n+' on the ice',html);
    }

    function evening(id){
      const T=ss.trip;
      if(id==='rest'){adjE(3);T.log.push('Early to bed.');return toRes('🌙 Early to bed',`<p>You eat, bank the stove and crawl in early. (Energy +3)</p>`,toNight)}
      if(id==='fire'){adjE(1);T.rel+=2;T.log.push('Stories around the fire.');return toRes('🔥 Around the fire',`<p>You swap stories until the coals go gray, ${esc(guestOf(T.company))} and you. (Energy +1)</p>`,toNight)}
      if(id==='tie'){
        const vise=T.pack.includes('vise'),gain=vise?2:1;T.tackle+=gain;T.ties++;R.ties++;adjE(1);
        T.log.push('Tied flies and fixed gear.');
        return toRes('🪶 Flies and leaders',`<p>${vise?'You clamp the vise to the cooler lid and tie a dozen sockeye flies and a few steelhead patterns, then re-rig leaders and sharpen hooks by headlamp.':'With no vise you re-rig leaders, sharpen hooks and splice a few lines by headlamp.'} Next July’s tackle is a little more taken care of. (Tackle credit +${gain}, Energy +1)</p>`,toNight);
      }
      if(id==='aurora'){
        const seen=r()<.7;T.aurora++;
        if(seen){const first=T.aurora===1;adjE(first&&T.pack.includes('layers')?2:0);if(first){adjR(1);R.wom+=1}R.aurora++;T.log.push('Photographed the northern lights.');
          return toRes('🌌 Northern lights',`<p>Around midnight a green curtain unrolls over the spruce, then pink at the edges. You set the camera on a tripod, count out thirty seconds and watch your breath freeze. ${first?'The pictures will be on your page by February. (Rep +1)':''}</p>`,toNight)}
        adjE(-2);T.log.push('Waited up for the aurora.');
        return toRes('🌌 Clouds close in',`<p>You wait up in the cold with the camera set, but a skin of cloud slides in from the inlet and the sky stays dark. (Energy −2)</p>`,toNight);
      }
    }
    function toNight(){const T=ss.trip;T.nightHtml=night();ss.phase='night'}
    function afterNight(){
      const T=ss.trip;
      if(T.i<T.nights){T.i++;newDay();ss.phase='day'}else ss.phase='leave';
    }
    function leave(thorough){
      const T=ss.trip;T.thorough=thorough;let html;
      if(thorough){adjE(-2);html=`<p>You police the site, pack out every scrap including the microtrash, scatter the cold fire ring’s ashes and leave the snow looking like nobody was there. (Energy −2)</p>`}
      else{html=`<p>You toss the scraps on the coals, kick snow over the ring and go.</p>`;T.messy=true;if(r()<.25){adjR(-1);html+=`<p>The next party in finds the mess and mentions it around town. (Rep −1)</p>`}}
      finishTrip(html);
    }
    function finishTrip(html){
      const T=ss.trip,m=D.month(T.month),pl=D.place(T.place),used=T.nights+T.extra;
      ss.days=Math.max(0,ss.days-used);ss.tripsLeft=Math.max(0,ss.tripsLeft-1);R.daysUsed+=used;R.nights+=T.nights;
      const noTrace=T.thorough===true&&!T.messy;if(noTrace)R.noTraceTrips++;
      let rel=null;
      if(T.company){
        const delta=clamp(T.rel,-3,4),who=names()[T.company]||{name:'your guest',kind:'guide'};
        R.rel[T.company]=(R.rel[T.company]||0)+delta;
        if(delta>=3){adjR(1)}else if(delta<=-2&&who.kind!=='guide')adjR(-1);
        if(delta>=2)R.book=Math.min(D.MAX_BOOK,R.book+.005);
        if(delta>=2&&who.kind==='guide'){ss.skill+=1;R.skillD+=1}
        rel={id:T.company,name:who.name,kind:who.kind,delta};
      }
      if(T.scout)R.book=Math.min(D.MAX_BOOK,R.book+.005);
      R.tackle+=T.tackle;
      const sum={place:T.place,placeName:pl.n,month:T.month,monthName:m.n,nights:T.nights,extra:T.extra,company:T.company,shelter:T.shelter,enc:T.enc,good:T.goodN,bad:T.badN,events:T.events,acts:T.acts,fish:T.fish,tackle:T.tackle,
        scout:T.scout,cost:r2(R.spent-T.sp0),energy:ss.energy-T.e0,cash:r2(ss.cash-T.c0),rep:ss.rep-T.rep0,skill:ss.skill-T.sk0,fresh:R.fresh.slice(T.fresh0),rel,noTrace,thorough:T.thorough===true,messy:T.messy,aurora:T.aurora,log:T.log};
      R.trips.push(sum);R.log.push({kind:'trip',title:`${m.n} at ${pl.n}`,lines:T.log.slice()});
      T.sum=sum;
      ss.res={title:`🏕️ Back from ${pl.n}`,html:html+summaryHtml(sum),next:()=>{ss.trip=null;ss.phase='hub'}};ss.phase='result';
    }
    function summaryHtml(s){
      const nm=names();
      const A={rest:'rested in camp',icefish:'ice fished',snowshoe:'snowshoed',ski:'skied',track:'tracked wildlife',scout:'scouted the water',icefall:'fell through the ice'};
      const acts=[...new Set(s.acts)].map(a=>A[a]).filter(Boolean);
      const rows=[`<b>${s.nights} night${s.nights===1?'':'s'}</b> at ${esc(s.placeName)} in ${s.monthName}${s.extra?`, plus ${s.extra} snowed-in day${s.extra>1?'s':''}`:''}. ${s.enc} encounter${s.enc===1?'':'s'}${s.enc?` (${s.good} good, ${s.bad} bad)`:''}.`,
        acts.length?`You ${acts.join(', ')}${s.aurora?' and watched for the northern lights':''}.`:'',
        s.fish?`🐟 ${s.fish} fish in the freezer.`:'',s.tackle?`🪶 Tackle credit +${s.tackle} for next season.`:'',s.scout?`🔭 You know the ${D.place(s.place).scout==='kasilof'?'Kasilof':'upper Kenai'} better for July.`:'',
        s.rel?`🤝 ${s.rel.delta>=2?'A good trip with':s.rel.delta<0?'A rough trip with':'A quiet trip with'} ${esc(s.rel.name)}.`:'',
        s.fresh.length?`📖 New in your log: ${s.fresh.map(id=>sp(id).ic+' '+sp(id).n).join(', ')}.`:'',
        s.noTrace?'🌲 No trace: you broke camp with nothing left behind.':s.messy?'🗑️ The camp was left a little messy.':'',
        `Spent ${$(s.cost)}. Energy ${sgn(s.energy)}, cash ${s.cash<0?'−':'+'}${$(Math.abs(s.cash))}${s.rep?`, rep ${sgn(s.rep)}`:''}${s.skill?`, skill ${sgn(s.skill)}`:''}.`].filter(Boolean);
      return `<hr style="border:0;border-top:1px solid var(--line,#ccd)">`+rows.map(x=>`<p>${x}</p>`).join('');
    }

    // ---- winter work ----
    function gig(id){
      const G=D.GIGS.find(g=>g.id===id),m=D.month('jan');let html='',net=0,e=0,rep=0,w=0,bk=0,title=G.ic+' '+G.n;
      ss.gigsLeft--;ss.days=Math.max(0,ss.days-1);R.daysUsed++;ss.gigsDone.add(id);
      if(id==='iceguide'){
        const lines=[];
        if(ss.lic<D.calYear(m,t.year)){spend(D.LICENSE);ss.lic=D.calYear(m,t.year);R.lic=ss.lic;lines.push(`You buy a ${ss.lic} fishing license first (${$(D.LICENSE)}).`)}
        let rent=0;if(!has('ice')){rent=D.RENT_ICE*t.costMult;spend(rent);lines.push(`You rent an ice kit (${$(rent)}).`)}
        const gas=r2(8*t.costMult*t.gas/5.3);spend(gas);
        let fare=140,tip=Math.round(r()*40);const cancel=r()<.15;if(cancel){fare=70;lines.push('One of the two cancels at the last minute.')}
        earn(fare+tip);net=fare+tip-gas-rent;e=-4;adjE(e);rep=cancel?0:1;adjR(rep);
        html=`<p>You meet two clients at a stocked lake, drill the holes, check the ice and get everybody on fish by noon. ${lines.join(' ')} They pay ${$(fare)} and tip ${$(tip)}. Gas ${$(gas)}.</p><p><em>Net about ${$(Math.round(net))}. (Energy ${e}${rep?', Rep +1':''})</em></p>`;
      }else if(id==='snowmachine'){
        const fuel=r2(35*t.costMult),gross=240;spend(fuel);const bust=r()<.15,tipTop=r()<.2;
        if(bust){earn(gross-60);rep=-1;adjR(rep);net=gross-60-fuel;html=`<p>A rented machine quits twelve miles out and you tow it back with another. You refund ${$(60)} and the riders are polite and unimpressed. Fuel ${$(fuel)}.</p>`}
        else{const tip=tipTop?50:Math.round(r()*20);earn(gross+tip);net=gross+tip-fuel;rep=tipTop?1:0;if(rep)adjR(1);html=`<p>Three riders, a blue-sky day, a lake crossing and a cow moose on the trail. They pay ${$(gross)} and tip ${$(tip)}. Fuel ${$(fuel)}.</p>`}
        e=-5;adjE(e);html+=`<p><em>Net about ${$(Math.round(net))}. (Energy ${e}${rep?`, Rep ${sgn(rep)}`:''})</em></p>`;
      }else{
        earn(60);net=60;e=-3;adjE(e);rep=1;adjR(1);w=1;bk=.005;R.wom+=w;R.book=Math.min(D.MAX_BOOK,R.book+bk);
        html=`<p>You work a trailhead table and a warming tent, hand out soup and learn names. Half the people in line turn out to fish the river in July. They pay a ${$(60)} stipend and meals.</p><p><em>(Energy ${e}, Rep +1, word of mouth +1)</em></p>`;
      }
      R.log.push({kind:'gig',title:G.n,lines:[`Net about ${$(Math.round(net))}.`]});R.gigs.push(id);
      toRes(title,html,()=>{ss.phase='hub'});
    }
    function gigWhy(g){
      if(ss.gigsLeft<=0)return 'No more winter work this winter.';
      if(ss.days<=0)return 'No free days left.';
      if(ss.gigsDone.has(g.id))return 'Done this winter.';
      if(g.id==='snowmachine'&&ss.rep<45)return 'Needs a little more reputation (45).';
      if(g.id==='iceguide'){const need=ss.lic<D.calYear(D.month('jan'),t.year)?D.LICENSE:0;if(ss.cash<need+D.RENT_ICE+12)return 'Can’t afford the license and the rental.'}
      return '';
    }

    // ---- views ----
    function V(){
      const ph=ss.phase,P=ss.plan,T=ss.trip;
      if(ph==='hub'){
        const left=ss.days>0&&ss.tripsLeft>0;
        return {title:'🏕️ Winter camp',exit:'done',meta:{},html:`<p>Winter on the Kenai Peninsula, with the river asleep. You have <b>${ss.days} free day${ss.days===1?'':'s'}</b> before spring: up to ${ss.tripsLeft} camping trip${ss.tripsLeft===1?'':'s'} and ${ss.gigsLeft} job${ss.gigsLeft===1?'':'s'}. Camp, fish through the ice, learn the water, or earn a little.</p>${stat()}<p style="font-size:13px;color:var(--mute,#667)">Pump gas about ${$(t.gas)}/gal; the pickup gets ${t.mpg} mpg. Most campgrounds are unserviced in winter. You have seen ${seenN()} of ${D.ALL.length} animals.</p>`,
          buttons:[B('plan','🏕️ Plan a camping trip',left?'Pick a place within 100 road miles of Soldotna, a month, how long, who comes and what you pack.':ss.tripsLeft<=0?'No more trips this winter.':'No free days left.',!left),
            B('work','💼 Winter work',ss.gigsLeft>0&&ss.days>0?'A day of paid work or a winter event instead of camping.':'No more winter work this winter.',!(ss.gigsLeft>0&&ss.days>0)),
            B('shop','🛒 Shelter & outfitters','A wall tent or a truck camper makes bad nights rarer.'),
            B('log','📖 Camping log',`${seenN()} of ${D.ALL.length} animals seen.`),
            B('done',ss.R.trips.length||ss.R.gigs.length?'Back to the off-season':'Not now','Back to the off-season summary.')]};
      }
      if(ph==='where')return {title:'🏕️ Where to?',exit:'back',meta:{},html:`<p>Pick a place within 100 road miles of Soldotna.</p>${stat()}`,
        buttons:D.PLACES.map(p=>B('p:'+p.id,`${p.ic} ${p.n} — ${p.miles} mi`,p.d+(p.ice?` Ice fishing: yes (${p.ice}).`:'')+(p.scout?` Scouting: ${p.scout==='kasilof'?'Kasilof':'upper Kenai'}.`:''))).concat([B('back','Back','Back to your winter plans.')])};
      if(ph==='when'){
        const pl=D.place(P.place);
        return {title:`${pl.ic} ${pl.n}`,exit:'back',meta:{},html:`<p>When do you go? The month sets the daylight, the ice, the weather and which fishing license you need.</p>${stat()}`,
          buttons:D.MONTHS.map(m=>{const cal=D.calYear(m,t.year),icy=pl.ice?(m.ice<.3?' Ice is thin.':m.ice<.6?' Ice is questionable.':' Good ice.'):'';
            return B('m:'+m.id,`${m.n} ${cal} — about ${m.day} hours of light`,`${m.d} ${m.t}. ${D.slots(m)>1?'Long enough days for two activities.':'One activity a day.'}${icy}`)}).concat([B('back','Back','Pick another place.')])};
      }
      if(ph==='nights'){
        const pl=D.place(P.place),m=D.month(P.month);
        return {title:`${pl.ic} ${pl.n}, ${m.n}`,exit:'back',meta:{},html:`<p>${pl.miles} miles each way. Each night has a 50% chance of an encounter; the animals, the weather and what you packed decide which. ${ss.days} free days left.</p>${stat()}`,
          buttons:D.NIGHTS.filter(n=>n<=Math.max(1,ss.days)).map(n=>{const c=cost(Object.assign({},P,{nights:n,shelter:'tent',pack:[],company:null}));return B('n:'+n,`${n} night${n>1?'s':''} — about ${$(c.fuel+c.fees+c.sup)}`,`${$(c.fuel)} gas, ${$(c.fees)} fees, ${$(c.sup)} supplies before gear.`,c.fuel+c.fees+c.sup>ss.cash)}).concat([B('back','Back','Pick another month.')])};
      }
      if(ph==='who'){
        const nm=names(),bs=[B('c:none','Go alone','Quiet, cheap and easy to pack for.')];
        const regs=t.regulars.filter(g=>g.mood>=45).sort((a,b)=>b.mood-a.mood).slice(0,3);
        regs.forEach(g=>bs.push(B('c:'+g.id,`Invite ${g.name}`,`A regular client. A good trip builds goodwill and next July’s booking; a bad night costs some. Costs a little more in supplies.`,P.declined.includes(g.id))));
        if(t.guideFriend)bs.push(B('c:guide','Invite a fellow guide','Swap spot notes and river stories. A friend who likes your camp tells other guides.',P.declined.includes('guide')));
        if(t.rival&&t.rival.mood>=0)bs.push(B('c:'+t.rival.id,`Invite ${t.rival.name}`,'The other guide on your seam. A night in the cold can melt a rivalry, or not.',P.declined.includes(t.rival.id)));
        bs.push(B('back','Back','Pick another length.'));
        return {title:'🤝 Who comes?',exit:'back',meta:{},html:`<p>Company makes the evening, and a bad night is shared. It also uses a little room in the truck and about 60% more in supplies.</p>${stat()}`,buttons:bs};
      }
      if(ph==='shelter'){
        const pl=D.place(P.place),bs=[];
        ['tent','wall','camper'].forEach(id=>{if(id==='tent'||has(id)){const s=D.SHELTERS[id];bs.push(B('s:'+id,`${s.ic} ${s.n}`,`${s.d} Comfort ${s.comfort}.`))}});
        if(pl.cabin){const s=D.SHELTERS.cabin,c=r2(pl.cabin*P.nights*t.costMult);bs.push(B('s:cabin',`${s.ic} ${s.n} — ${$(c)}`,`${s.d} Reserved ahead. Rates around ${$(pl.cabin)} a night; comfort ${s.comfort}.`,false))}
        bs.push(B('back','Back','Pick who comes.'));
        return {title:'🛏️ Where do you sleep?',exit:'back',meta:{},html:`<p>Comfort lowers the odds that a bad night stays a bad night.</p>${stat()}`,buttons:bs};
      }
      if(ph==='pack'){
        const cap=capOf(P),load=loadOf(P),c=cost(P),bs=[B('auto','Pack the usual','Food container, warm bag and layers first, then what this trip needs, as far as room and cash allow.'),B('packed','Done packing','Look over the cost.')];
        D.PACK.forEach(it=>{
          const on=P.pack.includes(it.id),owned=has(it.id),next=Object.assign({},P,{pack:P.pack.concat(it.id)}),fits=on||loadOf(next)<=cap;
          const price=!it.once?`${$(it.cost)} each trip`:owned?'you own it':`${$(it.cost)} to buy`;
          bs.push(B('k:'+it.id,`${on?'✓ ':''}${it.ic} ${it.n} (${it.wt})`,`${price}. ${it.d}${fits||on?'':' Not enough room.'}`,!fits&&!on));
        });
        bs.push(B('back','Back','Pick where you sleep.'));
        return {title:'🎒 Packing',exit:'back',meta:{},html:`<p>Load <b>${load} of ${cap}</b>. Everything you pack takes room: the shelter, any company and each item. Each item changes the odds of one problem.</p><p style="font-size:13px">Gear costs ${$(c.gear)} so far. Cash ${$(Math.round(ss.cash))}.</p>`,buttons:bs};
      }
      if(ph==='confirm'){
        const pl=D.place(P.place),c=cost(P),m=D.month(P.month),sh=D.SHELTERS[P.shelter];
        return {title:`🏕️ ${P.nights} night${P.nights>1?'s':''} at ${pl.n}`,exit:'back',meta:{},html:`<p>${m.n} ${D.calYear(m,t.year)}. ${sh.ic} ${sh.n}${P.company?`, with ${esc(guestOf(P.company))}`:', alone'}.</p><p>⛽ Gas: ${pl.miles*2} miles round trip ÷ ${t.mpg} mpg = ${c.gal} gal × ${$(t.gas*t.costMult)} = <b>${$(c.fuel)}</b><br>🏕️ ${P.shelter==='cabin'?'Cabin':'Campsite fees'}: <b>${$(P.shelter==='cabin'?c.cabin:c.fees)}</b><br>🥫 Supplies, ${$(D.SUPPLIES*t.costMult)}/night${P.company?' plus your guest':''}: <b>${$(c.sup)}</b><br>🎒 Gear: <b>${$(c.gear)}</b><br>Total: <b>${$(c.total)}</b> of ${$(Math.round(ss.cash))}.</p>`,
          buttons:[B('go','Pack the truck','Go.',c.total>ss.cash),B('back','Back','Change the packing.')]};
      }
      if(ph==='day'){
        const pl=D.place(T.place),m=mon(),left=T.slots-T.slotsUsed,bs=[];
        if(pl.ice&&!T.today.includes('icefish')){
          const need=ss.lic<D.calYear(m,t.year),thin=m.ice<.3;
          bs.push(B('icefish',`🧊 Ice fishing${need?' (license first)':''}`,`Stocked fish for the freezer, a fish fry or a story. ${need?`A fishing license is required, and licenses run by calendar year: ${$(D.LICENSE)}. `:''}${thin?'The ice is thin this early. ':''}Check the ice before you walk out.`));
        }
        if(pl.ski)bs.push(B('ski','⛷️ Cross-country skiing','Trails and quiet. Energy up, a small chance of a fall.'));
        bs.push(B('snowshoe','🥾 Snowshoeing','Break trail through the spruce. Energy up, a small chance of a twist.'));
        bs.push(B('track','🐾 Track wildlife','Read the sign. You may log an animal and learn what is around camp, or startle one.'));
        if(pl.scout)bs.push(B('scout',`🔭 Scout next season’s water (${pl.scout==='kasilof'?'Kasilof':'upper Kenai'})`,R.scoutPts>=2?'You already know it well.':'Walk the banks. Better first trips in July and a feel for the run, a little tiring.',R.scoutPts>=2));
        bs.push(B('rest','☕ Keep camp and rest','Energy +3.'));
        if(T.slotsUsed>0)bs.push(B('evening','Call it a day','Head for the fire.'));
        return {title:`${pl.ic} Day ${T.i} of ${T.nights}`,exit:null,meta:{},html:`<p><b>${m.n}</b>: about ${m.day} hours of daylight, ${m.t}. ${left>1?'A long enough day for two activities.':left===1?'Daylight for one activity.':''} ${T.clear?'A clear sky tonight.':'Clouds tonight.'}${T.thaw?' A chinook has softened the ice.':''}</p>${stat()}`,buttons:bs};
      }
      if(ph==='lic'){
        const m=mon(),cal=D.calYear(m,t.year);
        return {title:'🎣 A fishing license',exit:'no',meta:{},html:`<p>Ice fishing needs an Alaska fishing license, and licenses run by <b>calendar year</b>. ${ss.lic?`Your last one was for ${ss.lic}, so you need a ${cal} license`:`You need a ${cal} license`}${cal>t.year?', since the year turned on January 1':''}. A resident license is about ${$(D.LICENSE)}, valid through December 31, ${cal}.</p>${stat()}`,
          buttons:[B('buy',`Buy the ${cal} license — ${$(D.LICENSE)}`,'Then go fish.',ss.cash<D.LICENSE),B('no','Not today','Do something else with the day.')]};
      }
      if(ph==='kit')return {title:'🧊 An ice kit',exit:'no',meta:{},html:`<p>You didn’t pack an auger and rod. The tackle shop will rent you a kit for the day.</p>${stat()}`,buttons:[B('rent',`Rent one — ${$(D.RENT_ICE*t.costMult)}`,'Then go fish.',ss.cash<D.RENT_ICE*t.costMult),B('no','Not today','Do something else with the day.')]};
      if(ph==='icesafe'){
        const m=mon();
        return {title:'🧊 Ice safety',exit:null,meta:{},html:`<p>${esc(D.place(T.place).ice)} is frozen, but how thick? Ice thickness varies across a lake and gets thinner near inlets, outlets and springs. About <b>4 inches of clear, hard ice</b> holds a person on foot.${T.thaw?' The chinook has been at it.':''}${m.ice<.3?' It is early in the season.':''}</p><p style="font-size:13px;color:var(--mute,#667)">${T.pack.includes('picks')?'You are wearing your ice picks.':'You have no ice picks.'}</p>`,
          buttons:[B('check','Check the thickness first','Drill test holes every few steps. Takes a little time but you will know.'),B('risk','Walk out and fish','Faster. If the ice is thin, you may be wet and cold.')]};
      }
      if(ph==='icethin'){
        return {title:'🧊 Too thin',exit:'skip',meta:{},html:`<p>The auger comes up with only ${T.thinAt} inch${T.thinAt===1?'':'es'} of ice under your boots. That will not hold you out on the lake.</p>`,buttons:[B('shore','Fish from the shore','A few casts, a couple of fish at most.'),B('skip','Call it off','Not worth it.')]};
      }
      if(ph==='icecatch'){
        const room=Math.max(0,t.food.freezerRoom-R.fish);
        return {title:`🧊 ${T.fishN} on the ice`,exit:null,meta:{},html:`<p>You land ${T.fishN} stocked fish, rainbow trout and char, and the sun is low. What will you do with them?</p>${T.checkedMsg||''}`,buttons:[B('freezer','Take them home for the freezer',room>0?`Up to ${room} fit. Freezer fish count as food next season.`:'The freezer is full.',room<=0),B('fry','Fry them on the shore','A fish fry. Energy up.'),B('story','Release them and keep the story','Rep +1.')]};
      }
      if(ph==='evening'){
        const bs=[B('rest','🌙 Early to bed','Energy +3.')];
        if(T.company)bs.push(B('fire','🔥 Talk by the fire','Build goodwill with your guest.'));
        bs.push(B('tie',`🪶 Tie flies and fix gear${T.pack.includes('vise')?'':' (no vise)'}`,T.pack.includes('vise')?'Tackle credit +2 toward next season’s restock, and a small boost to your first trips.':'Tackle credit +1: re-rigging leaders with what you have.'));
        if(T.clear)bs.push(B('aurora','🌌 Photograph the northern lights','Clear tonight. It is cold work: a chance at a great picture, a chance at nothing.'));
        return {title:`🌙 Evening, day ${T.i}`,exit:null,meta:{},html:`<p>The light goes by mid-afternoon. How do you spend the evening?</p>${stat()}`,buttons:bs};
      }
      if(ph==='night')return {title:`🌙 Night ${T.i}`,exit:null,meta:{},html:T.nightHtml+stat(),buttons:[B('go',T.i<T.nights?'Next morning':'Break camp','')]};
      if(ph==='leave')return {title:'🧳 Breaking camp',exit:null,meta:{},html:`<p>Time to go. The snow keeps everything: a scrap of foil, a wrapper, a fire ring. How do you leave it?</p>`,
        buttons:[B('thorough','Leave no trace','Pack out all trash, scatter the ashes and leave the site clean. A little tiring.'),B('quick','Quick pack','Toss the scraps and go.')]};
      if(ph==='work')return {title:'💼 Winter work',exit:'back',meta:{},html:`<p>A day of work in the cold. Winter jobs pay a little and each uses a free day. ${ss.gigsLeft} job${ss.gigsLeft===1?'':'s'} left this winter.</p>${stat()}`,
        buttons:D.GIGS.map(g=>{const why=gigWhy(g);return B('g:'+g.id,`${g.ic} ${g.n}`,why?why+' '+g.d:g.d+(g.need?' '+g.need:''),!!why)}).concat([B('back','Back','Back to your winter plans.')])};
      if(ph==='shop'){
        const bs=[];['wall','camper'].forEach(id=>{const s=D.SHELTERS[id],owned=has(id);bs.push(B('b:'+id,`${s.ic} ${s.n} — ${$(s.cost)}`,owned?'You own it.':s.d,owned||ss.cash<s.cost))});
        bs.push(B('back','Back','Back to your winter plans.'));
        return {title:'🛒 Shelter & outfitters',exit:'back',meta:{},html:`<p>A better shelter lowers the chance that a bad night stays bad, on every trip, and wall tents and truck campers hold their value. The small gear (bear container, bag, ice kit and the rest) is bought when you pack.</p>${stat()}`,buttons:bs};
      }
      if(ph==='log'){
        const rows=D.SPECIES.map(s=>`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--line,#ccd)"><span>${s.ic} ${ss.seen[s.id]>0?s.n:'?'}</span><span>${ss.seen[s.id]>0?'×'+ss.seen[s.id]:'not yet'}</span></div>`).join('');
        return {title:'📖 Camping log',exit:'back',meta:{},html:`<p>${seenN()} of ${D.ALL.length} animals seen. See them all for the <b>Every Animal</b> award, and break camp clean for <b>No Trace</b>.</p>${rows}`,buttons:[B('back','Back','Back to your winter plans.')]};
      }
      if(ph==='result')return {title:ss.res.title,exit:'ok',meta:{},html:ss.res.html+stat(),buttons:[B('ok','Continue','')]};
      if(ph==='end')return {title:'🏕️ Back to town',exit:null,meta:{},html:'',buttons:[]};
      throw new Error('camp: unknown phase '+ph);
    }
    function view(){const v=V();v.meta.phase=ss.phase;v.meta.cash=ss.cash;v.meta.energy=ss.energy;v.meta.daysLeft=ss.days;v.meta.tripsLeft=ss.tripsLeft;v.meta.seen=seenN();v.meta.trip=ss.trip?{place:ss.trip.place,i:ss.trip.i,nights:ss.trip.nights,slotsUsed:ss.trip.slotsUsed,slots:ss.trip.slots,clear:ss.trip.clear,company:ss.trip.company,shelter:ss.trip.shelter,pack:ss.trip.pack.slice()}:null;v.meta.plan=ss.plan?JSON.parse(JSON.stringify(ss.plan)):null;v.meta.gear=[...ss.gear];v.meta.lic=ss.lic;return v}

    // ---- choices ----
    function choose(id){
      const v=view(),b=v.buttons.find(x=>x.id===id);
      if(!b||b.dis)return false;
      ss.steps++;const ph=ss.phase,P=ss.plan,T=ss.trip;
      switch(ph){
        case 'hub':
          if(id==='plan')startPlan();else if(id==='work')ss.phase='work';else if(id==='shop')ss.phase='shop';else if(id==='log')ss.phase='log';else if(id==='done')ss.phase='end';
          break;
        case 'where':if(id==='back')ss.phase='hub';else{P.place=id.slice(2);ss.phase='when'}break;
        case 'when':if(id==='back')ss.phase='where';else{P.month=id.slice(2);ss.phase='nights'}break;
        case 'nights':if(id==='back')ss.phase='when';else{P.nights=+id.slice(2);ss.phase='who'}break;
        case 'who':
          if(id==='back'){ss.phase='nights';break}
          if(id==='c:none'){P.company=null}
          else{
            const cid=id.slice(2),who=names()[cid],g=t.regulars.find(x=>x.id===cid);
            let p=cid==='guide'?.85:t.rival&&cid===t.rival.id?(t.rival.mood>0?.75:.4):(g.mood>=75?1:.6);
            if(r()>=p){P.declined.push(cid);ss.res={title:'📞 Can’t make it',html:`<p>${esc(who.name.charAt(0).toUpperCase()+who.name.slice(1))} thanks you for asking, but can’t get away this time. Maybe next winter.</p>`,next:()=>{ss.phase='who'}};ss.phase='result';break}
            P.company=cid;
          }
          {const pl=D.place(P.place);P.shelter='tent';P.pack=[];ss.phase=(pl.cabin||has('wall')||has('camper'))?'shelter':'pack'}
          break;
        case 'shelter':if(id==='back')ss.phase='who';else{P.shelter=id.slice(2);P.pack=[];ss.phase='pack'}break;
        case 'pack':
          if(id==='back'){const pl=D.place(P.place);ss.phase=(pl.cabin||has('wall')||has('camper'))?'shelter':'who'}
          else if(id==='auto')P.pack=autoPack(P);
          else if(id==='packed')ss.phase='confirm';
          else{const k=id.slice(2),i=P.pack.indexOf(k);if(i>=0)P.pack.splice(i,1);else P.pack.push(k)}
          break;
        case 'confirm':if(id==='back')ss.phase='pack';else startTrip();break;
        case 'day':if(id==='evening')ss.phase='evening';else doActivity(id);break;
        case 'lic':if(id==='buy'){spend(D.LICENSE);ss.lic=D.calYear(mon(),t.year);R.lic=ss.lic;ss.phase=T.pack.includes('ice')?'icesafe':'kit'}else ss.phase='day';break;
        case 'kit':if(id==='rent'){spend(D.RENT_ICE*t.costMult);T.rented=true;ss.phase='icesafe'}else ss.phase='day';break;
        case 'icesafe':
          if(id==='check'){const th=iceThick();T.checkedMsg=`<p style="font-size:13px;color:var(--mute,#667)">The ice was ${th} inch${th===1?'':'es'} thick where you drilled.</p>`;if(th<D.ICE_WALK){T.thinAt=th;ss.phase='icethin'}else iceFish(th)}
          else{T.checkedMsg='';iceFish(null)}
          break;
        case 'icethin':
          if(id==='shore'){T.fishN=r()<.5?1:0;if(T.fishN)ss.phase='icecatch';else{T.acts.push('icefish');T.today.push('icefish');T.log.push('Fished from shore; nothing.');actDone('🧊 A cold shore','<p>Half an hour of jigging from the bank and nothing bites. (No change)</p>')}}
          else{T.log.push('Called off ice fishing: too thin.');T.today.push('icefish');ss.phase='day'}
          break;
        case 'icecatch':iceCatchUse(id);break;
        case 'evening':evening(id);break;
        case 'night':afterNight();break;
        case 'leave':leave(id==='thorough');break;
        case 'work':if(id==='back')ss.phase='hub';else gig(id.slice(2));break;
        case 'shop':
          if(id==='back')ss.phase='hub';else{const sid=id.slice(2),s=D.SHELTERS[sid];spend(s.cost);ss.gear.add(sid);R.gearBought.push(sid);ss.res={title:`${s.ic} ${s.n}`,html:`<p>You buy a ${s.n.toLowerCase()} for ${$(s.cost)}. It will pay off every cold night you spend in it.</p>`,next:()=>{ss.phase='shop'}};ss.phase='result'}
          break;
        case 'log':ss.phase='hub';break;
        case 'result':{const n=ss.res.next;n()}break;
      }
      return true;
    }

    // ---- the report ----
    function report(){
      const seenAll=D.ALL.every(id=>ss.seen[id]>0),ach=[];
      if(seenAll&&!t.ach.includes('every_animal'))ach.push('every_animal');
      if(R.noTraceTrips>0&&!t.ach.includes('no_trace'))ach.push('no_trace');
      const nm=names(),rels=Object.keys(R.rel).map(id=>({id,kind:(nm[id]||{kind:'guide'}).kind,name:(nm[id]||{name:id}).name,delta:clamp(R.rel[id],-3,4)}));
      const sc=R.scoutPts,q=Math.min(D.MAX_FIRST,(sc>=2?.02:sc===1?.01:0)+Math.min(.01,R.ties*.004));
      return {
        v:K.SCHEMA,mode:t.mode,
        cashDelta:r2(ss.cash-t.cash),spent:r2(R.spent),earned:r2(R.earned),
        energyDelta:ss.energy-t.energy,repDelta:ss.rep-t.rep,skillDelta:R.skillD,
        womDelta:R.wom,bookingBoost:r3(Math.min(D.MAX_BOOK,R.book)),firstTripBoost:r3(q),
        foodFish:R.fish,tackleCredit:R.tackle,
        scout:sc>0?{areas:R.scoutAreas.slice(),points:sc,hint:true}:null,
        relations:rels,speciesSeen:Object.assign({},R.seen),newSpecies:R.fresh.slice(),achievements:ach,
        daysUsed:R.daysUsed,tripsTaken:R.trips.length,gigs:R.gigs.slice(),nights:R.nights,encounters:R.enc,noTraceTrips:R.noTraceTrips,
        gearBought:R.gearBought.slice(),license:R.lic?{year:R.lic}:null,
        log:R.log.map(x=>({kind:x.kind,title:x.title,lines:x.lines.slice()})),trips:R.trips.map(x=>Object.assign({},x,{log:x.log.slice()})),
      };
    }
    return {view,choose,report,get done(){return ss.phase==='end'},get phase(){return ss.phase},state:ss,K};
  };
})(KenaiCamp);
