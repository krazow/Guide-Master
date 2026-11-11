// ============================================================
//  KENAI WINTER CAMP, part 3: start(), the journal and the solo save.
//  KenaiCamp.start({mode, ticket, host}) runs the session through the host's own screens:
//    host.show(title, html, buttons, lock)  show a pop-up; buttons are {l, s, dis, fn}; fn runs after the pop-up closes
//    host.onFinish(report)                  the visit is over; apply the report
//    host.toast(msg)                        optional, a short notice
//    host.rand()                            optional, a number in [0,1)
//    host.now()                             optional, milliseconds
//  The engine itself never reads the page or the host's state.
// ============================================================
(function(K){
  'use strict';
  const D=K.data,U=K.util;

  // ---- the shared journal: which animals this device has ever seen (key kenaicamp:journal) ----
  K.journal={
    load(){const j=U.store.get('journal');return j&&j.v===K.SCHEMA&&j.seen&&typeof j.seen==='object'?j:{v:K.SCHEMA,seen:{}}},
    merge(seen){const j=this.load();Object.keys(seen||{}).forEach(id=>{if(D.ALL.includes(id))j.seen[id]=(j.seen[id]||0)+seen[id]});U.store.set('journal',j);return j},
  };

  // ---- the solo save (key kenaicamp:solo): a fixed starting ticket and a few carried numbers ----
  K.solo={
    fresh(){return {v:K.SCHEMA,winter:0,cash:1500,energy:80,rep:55,skill:20,gear:[],licYear:0,seen:{},ach:[],noTraceTrips:0,tot:{trips:0,nights:0,fish:0,tackle:0,gigs:0},days:D.WINTER_DAYS,trips:D.MAX_TRIPS,gigs:D.MAX_GIGS,gigsDone:[]}},
    load(){const s=U.store.get('solo');return s&&s.v===K.SCHEMA&&Array.isArray(s.gear)?Object.assign(this.fresh(),s):this.fresh()},
    save(s){U.store.set('solo',s)},
    reset(){U.store.del('solo');return this.fresh()},
    ticket(s){s=s||this.load();
      return {mode:'solo',year:2026+s.winter,cash:s.cash,energy:s.energy,rep:s.rep,skill:s.skill,gas:5.34,mpg:D.MPG,costMult:1,gear:s.gear,licYear:s.licYear,food:{meals:30,freezerRoom:30},
        regulars:[{id:'garza',name:'the Garza family',mood:80},{id:'couple',name:'the retired couple',mood:60}],rival:null,guideFriend:true,
        daysLeft:s.days,tripsLeft:s.trips,gigsLeft:s.gigs,gigsDone:s.gigsDone,seen:s.seen,ach:s.ach,noTraceTrips:s.noTraceTrips}},
    // fold a report into a solo save; returns the new save
    apply(s,rep){
      const n=JSON.parse(JSON.stringify(s)),c=U.clamp;
      n.cash=Math.round((n.cash+rep.cashDelta)*100)/100;n.energy=c(n.energy+rep.energyDelta,0,100);n.rep=c(n.rep+rep.repDelta,0,100);n.skill+=rep.skillDelta;
      rep.gearBought.forEach(g=>{if(!n.gear.includes(g))n.gear.push(g)});if(rep.license)n.licYear=Math.max(n.licYear,rep.license.year);
      Object.keys(rep.speciesSeen).forEach(id=>{n.seen[id]=(n.seen[id]||0)+rep.speciesSeen[id]});
      rep.achievements.forEach(a=>{if(!n.ach.includes(a))n.ach.push(a)});n.noTraceTrips+=rep.noTraceTrips;
      n.days=Math.max(0,n.days-rep.daysUsed);n.trips=Math.max(0,n.trips-rep.tripsTaken);n.gigs=Math.max(0,n.gigs-rep.gigs.length);n.gigsDone=n.gigsDone.concat(rep.gigs);
      n.tot.trips+=rep.tripsTaken;n.tot.nights+=rep.nights;n.tot.fish+=rep.foodFish;n.tot.tackle+=rep.tackleCredit;n.tot.gigs+=rep.gigs.length;
      return n;
    },
    newWinter(s){const n=this.fresh(),o=s||this.load();return Object.assign(n,o,{winter:o.winter+1,energy:Math.max(o.energy,80),days:D.WINTER_DAYS,trips:D.MAX_TRIPS,gigs:D.MAX_GIGS,gigsDone:[]})},
  };

  // phases where Esc/back is safe (they have a Back button); everything mid-trip is locked
  const FREE=['hub','where','when','nights','who','shelter','pack','confirm','work','shop','log'];

  // start a visit. Returns a handle: {session, stop()}
  K.start=function(opts){
    opts=opts||{};
    const host=opts.host||{},mode=opts.mode==='solo'?'solo':'guide';
    if(typeof host.show!=='function')throw new Error('KenaiCamp.start needs host.show');
    let ticket=opts.ticket;
    if(mode==='solo'&&!ticket)ticket=K.solo.ticket();
    const sess=K.session(Object.assign({},ticket,{mode}),{rand:typeof host.rand==='function'?host.rand:undefined});
    let stopped=false,finished=false;
    function finish(){
      if(finished)return;finished=true;
      const rep=sess.report();
      K.journal.merge(rep.speciesSeen);
      let soloSave=null;
      if(mode==='solo'){soloSave=K.solo.apply(K.solo.load(),rep);K.solo.save(soloSave)}
      if(typeof host.onFinish==='function')host.onFinish(rep,soloSave);
    }
    function show(){
      if(stopped)return;
      if(sess.done)return finish();
      const v=sess.view();
      host.show(v.title,v.html,v.buttons.map(b=>({l:b.l,s:b.s,dis:b.dis,fn:()=>{sess.choose(b.id);setTimeout(show,0)}})),!FREE.includes(sess.phase));
    }
    show();
    return {session:sess,stop(){stopped=true}};
  };

  // a read-only camping log screen for the host (species seen, from the ticket)
  K.logView=function(seen){
    const rows=D.SPECIES.map(s=>`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--line,#ccd)"><span>${s.ic} ${seen&&seen[s.id]>0?s.n:'?'}</span><span>${seen&&seen[s.id]>0?'×'+seen[s.id]:'not yet'}</span></div>`).join('');
    const n=D.ALL.filter(id=>seen&&seen[id]>0).length;
    return {title:'📖 Camping log',html:`<p>${n} of ${D.ALL.length} animals seen.</p>${rows}`};
  };
})(KenaiCamp);
