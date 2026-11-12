// ============================================================
//  CABIN UPKEEP, part 1: the jobs and the shop.
//  Every job offers three ways: do it yourself (time and energy, a little cash), pay someone (cash) or skip it (a risk).
//  The summer is the two-week July peak (minutes of the day); the off-season is fall, winter and spring (whole free days, which the
//  host shares with winter camping). All prices are 2026 estimates in dollars at the standard difficulty; the host's cost
//  multiplier scales them. src/home/README.md lists each price and where it comes from.
// ============================================================
(function(C){
  'use strict';
  const D=C.data={};
  const $c=(t,x)=>Math.round(x*t.costMult);

  // The shop: things you buy once.
  D.SHOP=[
    {id:'stove',ic:'🔥',n:'Wood stove with an insulated chimney',cost:3400,d:'A second heat source: it keeps the cabin warm when the furnace is out of oil or the power is out. You cut or buy firewood and sweep the chimney every year.',has:s=>!!s.heat.stove},
    {id:'station',ic:'🐟',n:'Fish processing station',cost:1900,d:'A stainless table and sink, a vacuum sealer and a bench freezer: fillet, seal and freeze clients’ fish for a small fee. It needs cleaning and a yearly defrost, or a batch spoils.',has:s=>!!s.proc},
    {id:'bin',ic:'🗑️',n:'Bear-resistant trash bin',cost:140,d:'A latching bin for garbage and fish scraps. Bears give up on it far more often.',has:s=>!!s.bin},
  ];

  // Jobs. ph: when it can come up ('summer', 'fall', 'spring' or '*' for any time); pr: the lower, the sooner;
  // cond: how much it restores the cabin's condition; due(s,t): is it due; o(s,t): the three ways.
  // s is the module's state, t the ticket. A skipped yearly job does not come back until next year.
  D.JOBS=[
    {id:'sweep',ic:'🧹',ph:['fall'],pr:10,cond:4,
      due:(s,t)=>!!s.heat.stove&&t.y>=1&&s.did.sweep!==t.y,
      title:()=>'Sweep the chimney',why:()=>'Wood smoke leaves creosote in the chimney, and creosote burns.',risk:()=>'Skip it and a chimney fire gets more likely every year.',
      o:(s,t)=>({diy:{cash:$c(t,45),days:0,min:180,e:8,s:'Rods, brush and a ladder: an afternoon.'},pay:{cash:$c(t,200),s:'A chimney sweep does it and checks the flue.'},skip:{s:'Creosote keeps building. A chimney fire gets likelier.'}})},
    {id:'oil',ic:'🛢️',ph:['fall'],pr:12,cond:3,
      due:(s,t)=>!!s.heat.oil&&t.y>=1&&s.did.oil!==t.y,
      title:()=>'Top up the heating-oil tank',why:()=>'The furnace burns oil all winter. A cold snap on an empty tank means a freezing night and a rush delivery.',risk:()=>'Skip it and you order late at a higher price, and a cold snap can catch the tank low.',
      o:(s,t)=>{const half=s.heat.stove&&s.did.wood===t.y?.5:1;return {diy:{cash:$c(t,215*half),days:1,min:240,e:10,s:'Haul it home in drums from the fuel station.'},pay:{cash:$c(t,260*half),s:'Schedule a delivery.'},skip:{s:'Coast on what is in the tank.'}}}},
    {id:'wood',ic:'🪵',ph:['fall'],pr:14,cond:3,
      due:(s,t)=>!!s.heat.stove&&t.y>=1&&s.did.wood!==t.y,
      title:()=>'Firewood for the stove',why:()=>'A cord of seasoned birch or spruce heats a cabin for a good stretch of winter.',risk:()=>'Skip it and you buy green wood in January at a worse price.',
      o:(s,t)=>({diy:{cash:$c(t,90),days:2,min:480,e:20,s:'Cut, split and stack two cords: saw gas, bar oil and a woodcutting permit.'},pay:{cash:$c(t,700),s:'Two cords delivered, split and ready to stack.'},skip:{s:'Burn whatever you can find later.'}})},
    {id:'tape',ic:'🧵',ph:'*',pr:20,cond:8,once:true,
      due:(s)=>!s.tape,
      title:()=>'Heat tape on the water line',why:()=>'Thermostat-controlled heat cable keeps the line from the well or main from freezing.',risk:()=>'Skip it and a hard cold snap can freeze or burst a pipe.',
      o:(s,t)=>({diy:{cash:$c(t,160),days:1,min:240,e:8,s:'Cable, thermostat and pipe insulation.'},pay:{cash:$c(t,450),s:'A plumber fits it properly.'},skip:{s:'Pipes stay exposed.'}})},
    {id:'skirt',ic:'🧱',ph:'*',pr:25,cond:8,once:true,
      due:(s)=>!s.skirt,
      title:()=>'Skirt the crawlspace',why:()=>'Foam board and plywood around the base keep the wind out from under the floor and the pipes warm.',risk:()=>'Skip it and the floor stays cold and the pipes freeze sooner.',
      o:(s,t)=>({diy:{cash:$c(t,300),days:1,min:300,e:12,s:'Rigid foam, plywood, screws and a long day on your back.'},pay:{cash:$c(t,900),s:'A contractor skirts it and seals the vents.'},skip:{s:'The wind keeps getting under the floor.'}})},
    {id:'detect',ic:'🚨',ph:'*',pr:31,cond:3,once:true,
      due:(s)=>!s.detect,
      title:()=>'Fit smoke and carbon monoxide detectors',why:()=>'A wood stove or a generator can make carbon monoxide, which you cannot see or smell. Most people are first told by an alarm.',risk:()=>'Skip it and a smoky or gassy night can send you to the hospital.',
      o:(s,t)=>({diy:{cash:$c(t,85),days:0,min:30,e:1,s:'Two smoke alarms and two CO alarms, on the right walls.'},pay:{cash:$c(t,120),s:'A handyman fits and tests them.'},skip:{s:'No alarms in the cabin.'}})},
    {id:'detest',ic:'🔋',ph:['fall'],pr:30,cond:3,
      due:(s,t)=>!!s.detect&&t.y>=1&&s.did.detest!==t.y,
      title:()=>'Test the detectors and change the batteries',why:()=>'An alarm with a dead battery is just a plastic disc on the ceiling.',risk:()=>'Skip it and an alarm may stay quiet when it counts.',
      o:(s,t)=>({diy:{cash:$c(t,12),days:0,min:15,e:1,s:'Press the buttons, swap the batteries.'},pay:{cash:$c(t,70),s:'A handyman checks every alarm.'},skip:{s:'Hope the batteries are fine.'}})},
    {id:'strap',ic:'🪛',ph:'*',pr:40,cond:3,once:true,
      due:(s)=>!s.strap,
      title:()=>'Strap the water heater and secure the shelves',why:()=>'Southcentral Alaska has real earthquakes (the 2018 Anchorage quake was felt on the Kenai). A strapped heater stays put.',risk:()=>'Skip it and a rare quake can tip the heater and spill the shelves.',
      o:(s,t)=>({diy:{cash:$c(t,40),days:0,min:60,e:3,s:'Two metal straps, a stud finder and an hour.'},pay:{cash:$c(t,120),s:'A plumber straps the heater and anchors the tall shelves.'},skip:{s:'Hope for a quiet century.'}})},
    {id:'breakup',ic:'🚧',ph:['spring'],pr:10,cond:8,
      due:(s,t)=>t.y>=1&&s.did.breakup!==t.y,
      title:()=>'Spring breakup: fix the driveway, check the foundation',why:()=>'April and May bring mud, frost heaves and soft roads. The driveway turns to soup and the cabin can settle.',risk:()=>'Skip it and the truck can sink to the axles and the foundation can shift.',
      o:(s,t)=>({diy:{cash:$c(t,160),days:1,min:300,e:12,s:'Haul gravel, re-crown the driveway, check the posts and skirting.'},pay:{cash:$c(t,400),s:'A neighbor with a loader fixes the driveway and looks over the foundation.'},skip:{s:'See what the thaw does.'}})},
    {id:'well',ic:'💧',ph:['spring'],pr:20,cond:4,
      due:(s,t)=>t.y>=1&&s.did.well!==t.y,
      title:()=>'Test the well water',why:()=>'Many homes around Soldotna draw from their own well. A yearly test for bacteria and nitrate is cheap; a bad pump or tainted water is not.',risk:()=>'Skip it year after year and a failing pump or bad water gets likelier.',
      o:(s,t)=>({diy:{cash:$c(t,55),days:0,min:60,e:1,s:'A mail-in lab kit: fill the bottles, send them off.'},pay:{cash:$c(t,110),s:'A water tech samples it and checks the pump and pressure tank.'},skip:{s:'It tastes fine.'}})},
    {id:'septic',ic:'🚽',ph:['spring'],pr:25,cond:6,
      due:(s,t)=>t.y-s.did.septic>=3,
      title:()=>'Pump the septic tank',why:()=>'Many homes around Soldotna have septic systems, and a tank wants pumping every few years.',risk:()=>'Skip it and a backup or a failed drain field gets likelier, and the house is unusable for days.',
      o:(s,t)=>({diy:{cash:$c(t,20),days:0,min:120,e:4,s:'Find the lids, check the level and clean the outlet filter. It buys you a year, no more.'},pay:{cash:$c(t,400),s:'A septic hauler pumps the tank and looks at the baffles.'},skip:{s:'Flush and forget.'}})},
    {id:'bins',ic:'🗑️',ph:['summer'],pr:10,cond:2,
      due:(s,t)=>t.sday>=1&&t.abs-Math.max(s.did.bins,s.skipAbs)>=4,
      title:()=>'Latch the bins and clean up the fish waste',why:()=>'Cleaning clients’ fish at home leaves scraps, blood and smell. Bears on the Peninsula notice.',risk:()=>'Skip it and a bear in the yard gets likely: damage, a lost morning or a visit from Fish and Game.',
      o:(s,t)=>({diy:{cash:0,days:0,min:30,e:2,s:'Scrape the table, bag the carcasses, latch the bins, make a dump run.'},pay:{cash:$c(t,55),s:'A neighbor with a truck takes the waste and rinses the table.'},skip:{s:'It can wait. (A bear might not.)'}})},
    {id:'genoil',ic:'🛠️',ph:['summer'],pr:20,cond:3,
      due:(s,t)=>t.gen.owned&&t.sday>=1&&s.did.genoil!==t.y,
      title:()=>'Change the generator’s oil',why:()=>'A generator that has sat all year needs fresh oil and a clean filter before it carries the freezer.',risk:()=>'Skip it and the generator may not start in the next outage.',
      o:(s,t)=>({diy:{cash:$c(t,25),days:0,min:45,e:3,s:'Oil, filter and spark plug.'},pay:{cash:$c(t,140),s:'The small-engine shop services it.'},skip:{s:'It ran last time.'}})},
    {id:'genrun',ic:'🔌',ph:['summer'],pr:21,cond:2,
      due:(s,t)=>t.gen.owned&&t.sday>=2&&s.did.genrun!==t.y,
      title:()=>'Run the generator under load',why:()=>'Twenty minutes with a space heater plugged in keeps the carburetor clean. Do it outside, away from the cabin.',risk:()=>'Skip it and the generator may not start in the next outage.',
      o:(s,t)=>({diy:{cash:0,days:0,min:20,e:1,gas:.5,dis:t.homeFuel<.5?'No home gas to run it on.':'',s:'Outside, well away from the cabin. It burns about half a gallon of home gas.'},pay:{cash:$c(t,70),s:'The small-engine shop runs and checks it.'},skip:{s:'It will start. Probably.'}})},
    {id:'garden',ic:'🥬',ph:['summer'],pr:30,cond:2,
      due:(s,t)=>t.sday<=6&&s.garden.y!==t.y,
      title:()=>'Plant a small garden',why:()=>'Potatoes, kale and carrots in raised beds save a little at the grocery store. The long July light grows a lot.',risk:()=>'No garden is no risk. (Moose, though, will eat an unfenced one.)',
      o:(s,t)=>({diy:{cash:$c(t,45),days:0,min:90,e:5,s:'Soil, seed potatoes and starts.'},pay:{cash:$c(t,80),s:'A neighbor sets up the beds and plants them.'},skip:{s:'No garden this year.'}})},
    {id:'fence',ic:'🫎',ph:['summer'],pr:31,cond:3,once:true,
      due:(s,t)=>s.garden.y===t.y&&!s.fence,
      title:()=>'Fence the garden against moose',why:()=>'A moose will walk through a low fence and eat your kale like it is a salad bar. Eight feet works.',risk:()=>'Skip it and a moose will probably eat the garden.',
      o:(s,t)=>({diy:{cash:$c(t,210),days:0,min:150,e:8,s:'Posts, mesh and a lot of zip ties.'},pay:{cash:$c(t,380),s:'A neighbor builds an eight-foot fence.'},skip:{s:'Moose are not that smart. (They are.)'}})},
    {id:'stclean',ic:'🧽',ph:['summer'],pr:15,cond:2,
      due:(s)=>!!s.proc&&s.station.tidy<70,
      title:()=>'Scrub the fish table and the sealer',why:()=>'A dirty table and sealer spoil a batch, and clients remember.',risk:()=>'Skip it and a batch of clients’ fish may spoil.',
      o:(s,t)=>({diy:{cash:$c(t,12),days:0,min:40,e:3,s:'Hot water, bleach solution and a stiff brush.'},pay:{cash:$c(t,50),s:'A neighbor’s kid scrubs everything down.'},skip:{s:'Give it a rinse in the morning.'}})},
    {id:'stdef',ic:'❄️',ph:['summer'],pr:40,cond:3,
      due:(s,t)=>!!s.proc&&s.did.stdef!==t.y,
      title:()=>'Defrost the bench freezer, service the sealer',why:()=>'Frost builds up and a sealer’s gasket wears. Freezer-burned fillets are not what you sold.',risk:()=>'Skip it and fish are likelier to spoil.',
      o:(s,t)=>({diy:{cash:$c(t,25),days:0,min:60,e:4,s:'Empty, defrost, wipe, new gasket.'},pay:{cash:$c(t,110),s:'The appliance shop services both.'},skip:{s:'It still freezes.'}})},
  ];
  D.job=id=>D.JOBS.find(j=>j.id===id);
})(CabinUpkeep);
