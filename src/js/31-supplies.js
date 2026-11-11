// ============================================================
//  GUIDE MASTER, part 8: food, home fuel and backup power (added in 1.7.0).
//
//  Three small systems that share one idea: the cabin has stores, and the stores can run out.
//
//  FOOD (S.food, S.freezer)
//    Meals are the unit (3 a day). The pantry (dry goods, no spoilage), the fridge (fresh, goes off after 6 days) and the freezer
//    (your dipnet and solo-trip reds, one red is about 4 meals) feed you. Every night the game eats the day's meals for you,
//    fridge first, then pantry, then a thawed red; a meal you already ate in town or packed for a trip doesn't count twice.
//    A meal you can't eat costs energy. One tap at the Soldotna grocery store stocks about a week ("Stock up").
//    Groceries used to be part of the nightly overhead; that part now lives here (OVERHEAD went from $75 to $57), so nobody pays twice.
//  THE COOLER (STEP.pack)
//    Before each trip you pack your own lunch (energy) and decide what the clients get: nothing, snack bags, store lunch kits
//    or a shore lunch of freezer reds (happiness, so tips). On a long day (the trout float, halibut) hungry clients are unhappy.
//  HOME FUEL (S.home)
//    Fuel is still bought only at the Kenai Harbor dock; you can haul extra home into approved cans (and a 100-gallon transfer tank
//    you can buy) and fuel the sled from it at the shop. Untreated gas goes stale over a winter; stabilizer ($9 per 25 gal) carries
//    it through one. Stale gas takes up room until you dispose of it.
//  OUTAGES AND THE GENERATOR (S.home.gen, the power_out event, suppliesWinter)
//    Wind and trees knock out the Peninsula's power now and then, in July and in winter. A portable generator (outside, with an
//    inlet and interlock) burns home fuel to keep the freezer going; without one a long outage spoils fresh food and, past a day
//    or two, the freezer, and costs you sleep. A freezer holds about 24 hours half full and 48 hours full; the fridge only a few hours.
//
//  Off-season: pantry and freezer carry over, the fridge doesn't, untreated fuel goes stale, one winter outage may hit, and there is
//  no day-to-day food tracking (the winter living bill already covers eating).
//  Prices are 2026 estimates; README.md ("Food, home fuel and the generator") lists them and where they come from.
// ============================================================
const MEALS=3, FISH_MEALS=4, FRESH_DAYS=6;
const PANTRY_CAP=60, FRIDGE_CAP=15, KIT_CAP=18;                // meals; meals; client lunch kits
const MEAL_PRICE={fri:7,pan:5}, KIT_PRICE=12, GAS_STATION_LUNCH=12;   // dollars (×the difficulty's cost)
const CAN_GAL=5, CAN_PRICE=35, CANS_MAX=8, TANK_GAL=100, TANK_PRICE=768;
const STAB_PRICE=9, STAB_GAL=25, STALE_FEE=15;                 // stabilizer ($ per 25 gal), hazardous-waste drop-off
const FREEZER_BASE=30, FREEZER_BIG=70, FREEZER_PRICE=650;      // fish the freezer holds
const GENS=[null,
  {n:'7,500 W open-frame generator',short:'open-frame',cost:850,install:600,gph:.45},
  {n:'7,000 W inverter generator',short:'inverter',cost:4449,install:600,gph:.28}];
const mealPrice=k=>Math.round(MEAL_PRICE[k]*DF().cost*100)/100;
const kitPrice=()=>Math.round(KIT_PRICE*DF().cost);
const r1=x=>Math.round(x*10)/10;

// ---- what you have ----
const fuelCap=()=>S.home.cans*CAN_GAL+(S.home.tank?TANK_GAL:0);
const fuelFresh=()=>r1(S.home.gal+S.home.tgal);                 // usable gallons (untreated + stabilized)
const fuelAll=()=>r1(S.home.gal+S.home.tgal+S.home.stale);      // everything taking up room
const fuelRoom=()=>Math.max(0,r1(fuelCap()-fuelAll()));
const fishCap=()=>S.home.frz?FREEZER_BIG:FREEZER_BASE;
const groceryMeals=()=>S.food.fri+S.food.pan;
const foodMeals=()=>groceryMeals()+S.freezer*FISH_MEALS+S.food.fm;
const foodDays=()=>Math.floor(foodMeals()/MEALS*10)/10;
const dayWord=d=>d===1?'day':'days';
const daysTxt=d=>d>=10?String(Math.floor(d)):d.toFixed(1).replace(/\.0$/,'');
const genOf=()=>GENS[S.home.gen]||null;
// A hint for the fuel alerts: gas from your own cans is a way to fuel the sled without a trip to the harbor.
const homeFuelHint=()=>fuelFresh()>=3?` Or fuel the sled at the shop from your home cans (${fuelFresh()} gal).`:'';
const genHours=()=>genOf()?r1(fuelFresh()/genOf().gph):0;

// Put fish in the freezer (it holds fishCap()); the rest go to the neighbors. Returns how many were stored.
function addFish(n){
  const put=Math.max(0,Math.min(n,fishCap()-S.freezer));S.freezer+=put;
  if(put<n) say(`🧊 The freezer is full (${fishCap()}). ${n-put} fish go to the neighbors.`);
  return put;
}
// A meal eaten somewhere else today (the diner, fish and chips, a packed lunch) doesn't come out of the pantry tonight.
function ateAdd(k){const d=day();S.ate=(S.ate&&S.ate.d===d)?S.ate:{d,n:0};S.ate.n+=k}
const ateToday=()=>S.ate&&S.ate.d===day()?S.ate.n:0;
// Take meals from the stores: the fridge first (it spoils), then the pantry, then a thawed red. Returns {fri,pan,fish,miss}.
function takeMeals(k){
  const F=S.food,got={fri:0,pan:0,fish:0,miss:0};
  for(let i=0;i<k;i++){
    if(F.fri>0){F.fri--;got.fri++}
    else if(F.pan>0){F.pan--;got.pan++}
    else if(F.fm>0){F.fm--;got.fish++}
    else if(S.freezer>0){S.freezer--;F.fm=FISH_MEALS-1;got.fish++}
    else got.miss++;
  }
  return got;
}

// ---- the grocery store ----
// How many meals of fresh and pantry food a shop to `target` meals buys (the fridge holds 15, the pantry 60).
function groceryPlan(target){
  const F=S.food,need=Math.max(0,target-F.pan-F.fri);
  let fri=Math.min(Math.round(need*.4),FRIDGE_CAP-F.fri),pan=Math.min(need-fri,PANTRY_CAP-F.pan);
  fri=Math.min(need-pan,FRIDGE_CAP-F.fri);
  fri=Math.max(0,fri);pan=Math.max(0,pan);
  return {fri,pan,cost:Math.round((fri*mealPrice('fri')+pan*mealPrice('pan'))*100)/100};
}
// "Stock up": buy groceries to `days` days of pantry and fridge food. Returns the plan, or null if there's nothing to buy or no money.
function stockUp(days){
  const target=Math.min(PANTRY_CAP+FRIDGE_CAP,Math.round(days*MEALS)),p=groceryPlan(target);
  if(p.fri+p.pan<=0||S.money<p.cost) return null;
  spend(p.cost);S.food.fri+=p.fri;S.food.pan+=p.pan;if(p.fri>0)S.food.fd=day();
  S.stats.groceries=(S.stats.groceries||0)+p.cost;return p;
}
function buyKits(n){
  n=Math.min(n,KIT_CAP-S.food.kits);const c=n*kitPrice();
  if(n<=0||S.money<c) return 0;
  spend(c);S.food.kits+=n;S.stats.groceries=(S.stats.groceries||0)+c;return n;
}

// ---- home fuel ----
// Buy fuel at a dock and carry it home in cans. Fuel is sold only at the Kenai Harbor dock (or your own pump, with the riverfront lot).
function haulFuel(gal,where){
  const p=fuelPrice(where||'kenai'),room=fuelRoom();
  const g=Math.max(0,Math.min(gal==null?room:gal,room,Math.floor(S.money/p*10)/10)),cost=Math.round(g*p*100)/100;
  if(g<=0) return 0;
  S.home.gal=r1(S.home.gal+g);money(-cost);S.stats.spent+=cost;S.stats.fuelGal=(S.stats.fuelGal||0)+g;S.stats.fuelCost=(S.stats.fuelCost||0)+cost;
  return {gal:r1(g),cost,p};
}
function takeHomeFuel(g){                                       // untreated first, then stabilized
  const H=S.home;let left=g;
  const a=Math.min(H.gal,left);H.gal=r1(H.gal-a);left-=a;
  const b=Math.min(H.tgal,left);H.tgal=r1(H.tgal-b);left-=b;
  return r1(g-left);
}
function fuelSledFromHome(){
  const g=r1(Math.min(SLED_TANK()-S.fuel,fuelFresh()));
  if(g<=0) return 0;
  takeHomeFuel(g);S.fuel=r1(S.fuel+g);return g;
}
const stabCost=()=>Math.ceil(S.home.gal/STAB_GAL)*STAB_PRICE;
function stabilize(){
  const H=S.home,c=stabCost();
  if(H.gal<=0||S.money<c) return 0;
  spend(c);const g=H.gal;H.tgal=r1(H.tgal+g);H.gal=0;return g;
}

// ---- power outages ----
// An outage of h hours. A generator runs on home fuel for as long as the fuel lasts; the rest of the time the freezer and fridge warm up.
function outage(h,winter){
  const G=genOf(),out={h,run:0,burn:0,off:h,fish:0,fresh:0,energy:0,lines:[]};
  if(G){out.run=r1(Math.min(h,fuelFresh()/G.gph));out.burn=takeHomeFuel(r1(out.run*G.gph));out.off=r1(h-out.run)}
  const off=out.off,keep=S.freezer>=fishCap()/2?48:24;
  out.fish=Math.round(S.freezer*clamp((off-keep)/24,0,1));S.freezer-=out.fish;S.stats.spoiled=(S.stats.spoiled||0)+out.fish;
  out.fresh=Math.round(S.food.fri*clamp((off-8)/16,0,1));S.food.fri-=out.fresh;
  if(!winter&&off>=4){out.energy=Math.min(10,Math.round(2+off/3));adj('energy',-out.energy)}
  S.stats.outages=(S.stats.outages||0)+1;
  const hrs=out.h>=48?`${r1(out.h/24)} days`:`${Math.round(out.h)} hours`;
  if(G&&out.off<=0) out.lines.push(`🔌 The power is out about ${hrs}. You roll out the ${G.short} generator, plug it into the inlet and run it outside, well away from the cabin (exhaust is carbon monoxide). ${out.burn} gallons of home gas later the freezer, fridge and lights never missed a beat.`);
  else if(G&&out.run>0) out.lines.push(`🔌 The power is out about ${hrs}. The ${G.short} generator keeps things going for ${Math.round(out.run)} hours, then the home gas runs out (${out.burn} gallons burned). The last ${Math.round(out.off)} hours are cold and dark.`);
  else if(G) out.lines.push(`🔌 The power is out about ${hrs}, and the ${G.short} generator has no gas to run on: your cans are empty.`);
  else out.lines.push(`⚡ The power is out about ${hrs}. Without a generator the freezer and fridge are on their own.`);
  if(out.fish||out.fresh) out.lines.push(`🧊 ${[out.fish?`${out.fish} red${out.fish>1?'s':''} thawed in the freezer and went in the dump`:'',out.fresh?`${out.fresh} meals of fresh food spoiled`:''].filter(Boolean).join(' and ')}.`);
  else if(out.off>0) out.lines.push(`🧊 The freezer held (${out.off<keep?'it was closed and stayed cold':'barely'}).`);
  if(out.energy) out.lines.push(`😮‍💨 No lights, no coffee maker, a dead phone and a warm cabin: you sleep badly. Energy −${out.energy}.`);
  return out;
}
const outageHours=winter=>{const r=Math.random();
  if(winter) return r<.45?8+Math.floor(Math.random()*17):r<.85?24+Math.floor(Math.random()*37):60+Math.floor(Math.random()*51);
  return r<.55?2+Math.floor(Math.random()*6):r<.9?8+Math.floor(Math.random()*13):24+Math.floor(Math.random()*17)};
// July: a windy morning is the likeliest time for a tree on the line.
defEvent({id:'power_out',hook:'wake',tile:['⚡','Power outage','bad'],bad:true,cooldown:3,chance:()=>S.wx[day()]==='wind'?.1:.025,cond:()=>!S.winter&&day()>0,
  run:()=>{const o=outage(outageHours(false));S.power={d:day(),h:o.h,gen:!!genOf()&&o.run>0,burn:o.burn,fish:o.fish,fresh:o.fresh};say(o.lines.join(' '))}});

// ---- the off-season ----
// Runs once as a season rolls over (24-career.js, startSeason). Returns lines for the winter summary.
function suppliesWinter(){
  const H=S.home,F=S.food,bits=[];
  if(H.gal>0){H.stale=r1(H.stale+H.gal);bits.push(`⛽ ${r1(H.gal)} gal of untreated gas went stale (dispose of it at the shop)`);H.gal=0}
  if(H.tgal>0){H.gal=H.tgal;H.tgal=0}                       // stabilized gas made it through; it is a year old now and needs treating again
  if(F.fri>0){bits.push(`🥬 ${F.fri} meals of fresh food spoiled`);F.fri=0}
  const lines=bits.length?[bits.join(' · ')+'.']:[];
  if(Math.random()<.55*DF().bad){const o=outage(outageHours(true),true);
    lines.push(`🌨️ <b>A winter storm cut the power for ${o.h>=48?`${r1(o.h/24)} days`:`${Math.round(o.h)} hours`}.</b> ${genOf()?(o.off<=0?`The generator burned ${o.burn} gal and the freezer held.`:o.run<=0?'The generator had no gas to run on.':`The generator ran ${Math.round(o.run)} hours on ${o.burn} gal of home gas, then it was cold and dark.`):'No generator.'}${o.fish?` ${o.fish} freezer reds spoiled.`:S.freezer&&o.off>0?' The freezer held.':''}`)}
  return lines;
}

// ---- nightly meals (called from onNight) ----
function suppliesNight(notes,d){
  const F=S.food;
  if(F.fri>0&&d-F.fd>=FRESH_DAYS){notes.push(`🥬 ${F.fri} meals of fresh food went off in the fridge.`);F.fri=0}
  const need=Math.max(0,MEALS-(S.ate&&S.ate.d===d?S.ate.n:0)),got=takeMeals(need);
  const eaten=got.fri+got.pan+got.fish,out=MEALS-need;
  if(eaten) notes.push(`🍽️ ${eaten} meal${eaten>1?'s':''} at home${got.fish?' (red salmon from the freezer)':''}${out?`, ${out} on the road`:''}. About ${daysTxt(foodDays())} days of food left.`);
  S.hungry=got.miss>0?Math.min(3,(S.hungry||0)+1):0;             // nights in a row you went without
  if(got.miss){S.stats.missed=(S.stats.missed||0)+got.miss;const e=7*got.miss;adj('energy',-e);notes.push(`🍽️ The cupboards are bare: you went without ${got.miss} meal${got.miss>1?'s':''}. Energy −${e}. Stock up at the grocery store in Soldotna.`)}
  else if(foodDays()<2) notes.push('🛒 Food is running low. Stock up at the grocery store in Soldotna.');
  if(S.power&&S.power.d===d) S.power=null;
}

// A guide who has been going without is short with the clients (called from tripStart): -5 happiness a night in a row, up to 3, and a worse catch.
function hungerTrip(t){
  const h=S.hungry||0;if(h<=0) return;
  t.happy-=5*h;t.q-=.02*h;t.notes.push(`🍽️ ${h>1?'Days':'A day'} of going without food: you’re short-tempered and slow, and the clients notice.`);
}

// ---- the cooler: before each trip ----
const LUNCH_EFFECT={none:[0,-6],snack:[2,4],kit:[4,7],fish:[6,9]};   // client happiness on a short / long trip
STEP.pack=(b,t)=>{
  const T=TRIPS[b.type],long=T.len>=480,n=b.n,F=S.food,L_=long?1:0;
  const skips=long?10:6,kitN=n,fishN=Math.ceil(n/4),snackN=Math.ceil(n/3);
  const ownNote=foodMeals()>0?`1 meal from home (${daysTxt(foodDays())} days of food left).`:`The cupboards are bare: a ${$(rp(GAS_STATION_LUNCH))} gas-station sandwich on the way.`;
  const lunch=(kind,txt)=>{const [s,l]=LUNCH_EFFECT[kind],h=L_?l:s;t.happy+=h;t.notes.push(txt)};
  const eatOwn=()=>{
    if(foodMeals()>0){takeMeals(1);t.notes.push('🥪 You pack your own lunch from home. A real lunch keeps you going.')}
    else{fx(t,-rp(GAS_STATION_LUNCH),'Gas-station sandwich');t.notes.push('🥪 Nothing at home to pack, so you grab a gas-station sandwich on the way.')}
    ateAdd(1);adj('energy',3);
  };
  const o=[O('Pack your own lunch',`${ownNote} ${long?'The clients get nothing, and on a long day they notice (−6 happiness).':'The clients bring their own.'}`,(b,t)=>{eatOwn();if(long)lunch('none','😒 No lunch for the clients on an all-day trip. Stomachs growl by noon.')})];
  if(F.pan>=snackN) o.push(O('…and snack bags for the clients',`Pantry granola bars, jerky and drinks (${snackN} pantry meals). Clients ${long?'+4':'+2'} happiness.`,(b,t)=>{eatOwn();F.pan-=snackN;lunch('snack','🍫 Snack bags and hot drinks for the clients.')}));
  if(F.kits>=kitN) o.push(O('…and a lunch kit for each client',`Sandwich, chips, fruit and a drink (${kitN} of your ${F.kits} kits). Clients ${long?'+7':'+4'} happiness.`,(b,t)=>{eatOwn();F.kits-=kitN;lunch('kit','🥪 Lunch kits at the first gravel bar: the clients are delighted.')}));
  if(S.freezer>=fishN) o.push(O('…and a shore lunch of grilled red salmon',`Thaw ${fishN} freezer red${fishN>1?'s':''} (${S.freezer} on hand). A Kenai tradition. Clients ${long?'+9':'+6'} happiness.`,(b,t)=>{eatOwn();S.freezer-=fishN;lunch('fish','🔥 Grilled red salmon with lemon and pepper on a gravel bar: the clients will remember it.')}));
  o.push(O('Skip food and just go',`Saves the food. You'll drag all day: energy −${skips}.${long?' The clients go hungry too (−6 happiness).':''}`,(b,t)=>{adj('energy',-skips);t.notes.push('🥱 No lunch for anyone. By two o’clock you are running on coffee.');if(long)lunch('none','😒 No lunch for the clients on an all-day trip. Stomachs growl by noon.')}));
  return {t:'🧺 Pack the cooler',b:`<p>${hrsTxt(T.len)} on the water with the ${b.who}. Pack your own lunch and decide what the ${n} clients get. You have <b>${daysTxt(foodDays())} ${dayWord(foodDays())}</b> of food at home${F.kits?`, ${F.kits} lunch kit${F.kits>1?'s':''}`:''}${S.freezer?` and ${S.freezer} red${S.freezer>1?'s':''} in the freezer`:''}.</p>`,o,fixed:true};
};
const hrsTxt=m=>`${Math.round(m/60)} hours`;

// ---- shopping for the house ----
function buyHome(id){
  const H=S.home;let c=0,msg='';
  if(id==='cans'){c=2*CAN_PRICE;H.cans=Math.min(CANS_MAX,H.cans+2);msg=`🛢️ Two more approved 5-gallon fuel cans: ${$(c)}. They stand outside on a pad, away from the cabin and from anything that could light them. Storage ${fuelCap()} gal.`}
  if(id==='tank'){c=TANK_PRICE;H.tank=1;msg=`🛢️ A ${TANK_GAL}-gallon steel transfer tank with a hand pump: ${$(c)}. It sits outside on a level pad, away from the cabin. Storage ${fuelCap()} gal.`}
  if(id==='gen1'||id==='gen2'){const k=id==='gen1'?1:2,G=GENS[k],swap=H.gen>0;c=G.cost+(swap?0:G.install);H.gen=k;msg=`🔌 ${G.n}${swap?' swapped in for the old one':' and an electrician’s inlet and interlock'}: ${$(c)}. It runs outside on home gas, about ${G.gph} gallons an hour, and keeps the freezer going through an outage.`}
  if(id==='frz'){c=FREEZER_PRICE;H.frz=1;msg=`🧊 A big chest freezer: ${$(c)}. It holds ${FREEZER_BIG} fish instead of ${FREEZER_BASE}.`}
  spend(c);sfx('good');say(msg);
}
function homeItems(){
  const H=S.home,items=[];
  const add=(id,ic,n,c,d,why)=>items.push({id,l:`${ic} ${n} — ${$(c)}`,s:why?`${why}. ${d}`:d,dis:!!why||S.money<c,c});
  add('cans','🛢️','Two more fuel cans (+10 gal)',2*CAN_PRICE,'Approved 5-gallon cans, stored outside.',H.cans>=CANS_MAX?'You have the most the shed holds':'');
  add('tank','🛢️',`${TANK_GAL}-gallon transfer tank with pump`,TANK_PRICE,`Haul a month of fuel home from the harbor. Stale gas still goes bad over a winter unless you stabilize it.`,H.tank?'Done':'');
  if(H.gen<1) add('gen1','🔌',`${GENS[1].n} + install`,GENS[1].cost+GENS[1].install,`About ${GENS[1].gph} gal/hr. Louder, thirstier, cheap. Keeps the freezer on in an outage.`,'');
  if(H.gen<2) add('gen2','🔌',H.gen?`Swap in the ${GENS[2].n}`:`${GENS[2].n} + install`,GENS[2].cost+(H.gen?0:GENS[2].install),`About ${GENS[2].gph} gal/hr (Honda EU7000iS class). Quiet and frugal.`,'');
  add('frz','🧊','Chest freezer (holds 70 fish)',FREEZER_PRICE,`Room for a full dipnet and more (now ${FREEZER_BASE}).`,H.frz?'Done':'');
  return items;
}
function homeShopModal(back){
  modal('🏪 Home supplies',`<p style="font-size:13px;color:var(--mute)">Cash ${$(Math.round(S.money))}. Generators and fuel stay outside: gasoline fumes and exhaust don’t belong in the house or an attached shed.</p>`,
    homeItems().map(i=>({l:i.l,s:i.s,dis:i.dis,fn:()=>{buyHome(i.id);setTimeout(()=>homeShopModal(back),0)}})).concat([{l:'Done',fn:()=>{if(back)setTimeout(back,0)}}]));
}
function homeModal(){
  const F=S.food,H=S.home,G=genOf();
  const row=(a,b)=>`<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--line);font-size:14px"><span>${a}</span><b style="text-align:right">${b}</b></div>`;
  modal('📦 The cabin’s stores',`${row('🥫 Pantry (keeps)',`${F.pan}/${PANTRY_CAP} meals`)}${row('🥬 Fridge (spoils in 6 days)',`${F.fri}/${FRIDGE_CAP} meals`)}${row('🧊 Freezer reds (4 meals each)',`${S.freezer}/${fishCap()}`)}${row('🥪 Client lunch kits',`${F.kits}/${KIT_CAP}`)}${row('🍽️ Days of food',daysTxt(foodDays()))}
    ${row('🛢️ Home fuel',`${fuelFresh()} gal${H.tgal?` (${H.tgal} stabilized)`:''} of ${fuelCap()}`)}${H.stale?row('⛽ Stale gas',`${H.stale} gal`):''}${row('🔌 Generator',G?`${G.short}, ${genHours()} h of fuel`:'none')}
    <p style="font-size:12.5px;color:var(--mute);margin-top:10px">Meals come out of the pantry and fridge every night, fridge first, then a thawed red. Fuel is bought only at the Kenai Harbor dock. Untreated gas goes stale over a winter; stabilizer ($${STAB_PRICE} per ${STAB_GAL} gal) keeps it. A freezer holds food about a day (half full) to two (full) without power.</p>`,[{l:'Got it',fn:()=>{}}]);
}

// ---- actions on the Here tab (called from actionsHere in 20-world.js) ----
function suppliesActions(a){
  const H=S.home,F=S.food,open=isOpen('town');
  if(S.loc==='shop'){
    a.push({ic:'📦',l:'Check the pantry, freezer and fuel cans',s:`${daysTxt(foodDays())} days of food · ${fuelFresh()} gal home fuel${genOf()?` · ${genOf().short} generator`:''}.`,cat:'work',fn:()=>homeModal()});
    const g=r1(Math.min(SLED_TANK()-S.fuel,fuelFresh()));
    if(fuelFresh()>0&&g>=1) a.push({ic:'🛢️',l:`Fuel the sled from your home cans — ${g.toFixed(1)} gal`,s:`Free, 10 min. Sled ${Math.round(S.fuel)}/${SLED_TANK()} gal; ${fuelFresh()} gal in storage.`,cat:'work',cls:S.fuel<bn('reds')+2?'primary':'',fn:()=>{const x=fuelSledFromHome();pass(10);say(`🛢️ You pour ${x.toFixed(1)} gallons from the cans into the sled. Tank ${Math.round(S.fuel)} gal; ${fuelFresh()} gal left at home.`)}});
    if(H.gal>0) a.push({ic:'🧴',l:`Add stabilizer to your stored fuel — ${$(stabCost())}`,s:`${H.gal} gal of untreated gas. Stabilized gas keeps through a winter; untreated goes stale.`,cat:'work',cls:sday(day())>=SEASON-3&&!isLastSeason()?'primary':'',dis:S.money<stabCost(),fn:()=>{const c=stabCost(),x=stabilize();pass(10);say(`🧴 Stabilizer in ${r1(x)} gallons of stored gas: ${$(c)}. It will keep through the winter.`)}});
    if(H.stale>0) a.push({ic:'🗑️',l:`Dispose of stale gas — ${$(STALE_FEE)}`,s:`${H.stale} gal. Take it to the hazardous-waste drop-off; don’t burn it in the sled. 45 min.`,cat:'work',dis:S.money<STALE_FEE,fn:()=>{spend(STALE_FEE);pass(45);say(`🗑️ ${H.stale} gallons of stale gas to the hazardous-waste drop-off: ${$(STALE_FEE)}. The cans are free again.`);H.stale=0}});
    if(S.up&&S.up.dock&&fuelRoom()>=1) a.push({ic:'🛢️',l:`Fill your home cans at your own pump — ${fuelRoom().toFixed(1)} gal`,s:`${$(fuelPrice('dock'))}/gal. ${fuelAll()}/${fuelCap()} gal stored.`,cat:'work',dis:S.money<fuelPrice('dock'),fn:()=>{const r=haulFuel(null,'dock');pass(10);if(r)say(`🛢️ ${r.gal} gallons from your own pump into the cans: ${$(Math.round(r.cost))}.`)}});
  }
  if(S.loc==='town'){
    const week=groceryPlan(7*MEALS),days=Math.max(0,Math.min(7,7-(groceryMeals())/MEALS));
    a.push({ic:'🛒',l:week.fri+week.pan>0?`Stock up: groceries for a week — ${$(Math.round(week.cost))}`:'Stock up: the kitchen is already full for a week',s:week.fri+week.pan>0?`${week.fri+week.pan} meals, 45 min. You have ${daysTxt(foodDays())} ${dayWord(foodDays())} of food. Soldotna groceries run about 23% over the national average.`:`${daysTxt(foodDays())} days of food at home (the pantry and fridge hold a week or more).`,cat:'town',cls:foodDays()<2?'primary':'',dis:!open||week.fri+week.pan<=0||S.money<week.cost,fn:()=>{const p=stockUp(7);pass(45);if(p)say(`🛒 Groceries for the week: ${p.fri+p.pan} meals (${p.fri} fresh, ${p.pan} for the pantry), ${$(Math.round(p.cost))}. About ${daysTxt(foodDays())} days of food at home.`)}});
    a.push({ic:'🥪',l:`Lunch kits for clients — 6 for ${$(6*kitPrice())}`,s:`Sandwich, chips, fruit, drink. ${F.kits}/${KIT_CAP} on hand. Pack them before a trip: happier clients, bigger tips.`,cat:'town',dis:!open||F.kits>KIT_CAP-6||S.money<6*kitPrice(),fn:()=>{const n=buyKits(6);pass(20);if(n)say(`🥪 ${n} client lunch kits: ${$(n*kitPrice())}. ${F.kits} in the cooler.`)}});
    const big=groceryPlan(PANTRY_CAP+FRIDGE_CAP);
    a.push({ic:'🏪',l:'Home supplies: generator, fuel cans, freezer',s:`${genOf()?`${genOf().short} generator · `:'No generator · '}${fuelCap()} gal of fuel storage · freezer ${fishCap()} fish.`,cat:'town',fn:()=>homeShopModal()});
    if(big.fri+big.pan>=20) a.push({ic:'🧺',l:`Big shop: fill the pantry and fridge — ${$(Math.round(big.cost))}`,s:`${big.fri+big.pan} meals (${Math.round((big.fri+big.pan)/MEALS)} days) for the winter or a long stretch. 60 min.`,cat:'town',dis:!open||S.money<big.cost,fn:()=>{const p=stockUp((PANTRY_CAP+FRIDGE_CAP)/MEALS);pass(60);if(p)say(`🧺 A big shop: ${p.fri+p.pan} meals, ${$(Math.round(p.cost))}. About ${daysTxt(foodDays())} days of food.`)}});
  }
  if(S.loc==='harbor'){
    const open2=isOpen('harbor'),room=fuelRoom(),p=fuelPrice('kenai');
    if(fuelCap()>0){
      a.push({ic:'🛢️',l:room>=1?`Haul fuel home: fill the cans — ${room.toFixed(1)} gal × ${$(p)} = ${$(Math.round(room*p))}`:'Haul fuel home: your cans and tank are full',s:`${fuelAll()}/${fuelCap()} gal stored${H.stale?` (${H.stale} stale)`:''}. Marine fuel from the dock into approved cans, outside on the truck bed. 15 min.`,cat:'work',dis:!open2||room<1||S.money<p,fn:()=>{const r=haulFuel(null,'kenai');pass(15);if(r)say(`🛢️ ${r.gal} gallons into the cans for home: ${$(Math.round(r.cost))}. ${fuelFresh()} gal in storage.`)}});
      if(room>10) a.push({ic:'🛢️',l:`Haul 10 gallons home — ${$(Math.round(10*p))}`,s:'A smaller load for the truck bed.',cat:'work',dis:!open2||S.money<p*10,fn:()=>{const r=haulFuel(10,'kenai');pass(10);if(r)say(`🛢️ ${r.gal} gallons into the cans for home: ${$(Math.round(r.cost))}. ${fuelFresh()} gal in storage.`)}});
    }
  }
}

// ---- status tags, alerts, to-do ----
function suppliesTags(){
  const t=[],gd=foodDays(),H=S.home;
  t.push(`<span class="tag ${gd<2?'bad':''}">🍽️ ${daysTxt(gd)} ${dayWord(gd)} of food</span>`);
  if(S.loc==='shop'||S.loc==='harbor') t.push(`<span class="tag ${H.stale?'bad':''}">🛢️ ${fuelFresh()}/${fuelCap()} gal at home${H.stale?` · ${H.stale} stale`:''}</span>`);
  if(S.loc==='shop'&&genOf()) t.push(`<span class="tag">🔌 ${genOf().short} generator</span>`);
  if(S.food.kits&&(S.loc==='shop'||S.loc==='town')) t.push(`<span class="tag">🥪 ${S.food.kits} lunch kit${S.food.kits>1?'s':''}</span>`);
  if(S.hungry>0) t.push('<span class="tag bad">🍽️ hungry: short-tempered</span>');
  if(S.power&&S.power.d===day()) t.push(`<span class="tag bad">⚡ power ${S.power.gen?'out, generator on':'out'}</span>`);
  return t;
}
function suppliesAlert(){
  if(S.power&&S.power.d===day()){const P=S.power;return {t:P.gen?`🔌 Power outage (about ${Math.round(P.h)} h). The generator is carrying the house: ${P.burn} gallons of home gas used.`:`⚡ Power outage (about ${Math.round(P.h)} h).${P.fish||P.fresh?` ${P.fish?P.fish+' reds':''}${P.fish&&P.fresh?' and ':''}${P.fresh?P.fresh+' meals of fresh food':''} spoiled.`:' The freezer is holding.'}`,kind:'info'}}
  if(foodDays()<1.5) return {t:`🍽️ ${foodDays()<=0?'No food at home.':`Only ${daysTxt(foodDays())} ${dayWord(foodDays())} of food at home.`} Stock up at the grocery store in Soldotna, or you go hungry and tired.`};
  if(S.home.gal>0&&!isLastSeason()&&sday(day())>=SEASON-3) return {t:`⛽ ${S.home.gal} gallons of untreated gas in the cans will be stale by next July. Add stabilizer at the shop before the season ends.`,kind:'info'};
  return null;
}
function suppliesTodo(){
  const it=[],gd=foodDays();
  it.push({l:'Keep food in the house',s:`${daysTxt(gd)} ${dayWord(gd)} of food (${S.food.fri+S.food.pan} meals of groceries, ${S.freezer} reds). Stock up at the grocery store in Soldotna.`,ok:gd>=3,urgent:gd<2});
  if(S.home.gal>0&&!isLastSeason()&&sday(day())>=SEASON-3) it.push({l:'Stabilize the stored gas before winter',s:`${S.home.gal} gal untreated. $${STAB_PRICE} per ${STAB_GAL} gal at the shop; otherwise it goes stale.`,ok:false,urgent:sday(day())>=SEASON-1});
  if(genOf()&&fuelFresh()<10) it.push({l:'Haul gas home for the generator',s:`${fuelFresh()} gal in storage is ${genHours()} hours of generator time. Fuel is sold only at the Kenai Harbor dock.`,ok:false,urgent:false});
  return it;
}
// 1.7.0: the Food stat joins the top bar; tips for the new ideas
STATS.splice(5,0,{l:'Food',v:()=>`${Math.floor(foodDays())}d`,m:()=>foodDays()/10*100,warn:()=>foodDays()<2,title:'Days of food at home: pantry, fridge and freezer reds. Stock up at the grocery store in Soldotna.'});
TIPS.push({id:'food',when:()=>day()>=1&&foodDays()<3,t:'🍽️ You’re low on food at home. <b>Stock up</b> at the grocery store in Soldotna: meals come out of the pantry every night, and a hungry guide runs out of energy.'},
  {id:'cooler',when:()=>day()>=1&&todays().length>0&&foodDays()>=1,t:'🧺 Before each trip you <b>pack the cooler</b>: your own lunch keeps your energy up, and a lunch kit or a shore lunch of freezer reds makes the clients happier (and tips bigger), especially on the long trout float and halibut days.'});
