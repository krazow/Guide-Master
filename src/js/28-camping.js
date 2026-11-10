// ============================================================
//  GUIDE MASTER, part 9: winter camping.
//  In the off-season (S.winter pending) you can take one camping trip: pick a place within 100 road miles of
//  Soldotna and a number of nights. You pay for gas (round trip, pickup), campsite fees and supplies, then each
//  night has a 50% chance of a wildlife encounter, weighted by the habitat of the place. Encounters nudge energy
//  (which carries into the new season), skill, rep and cash. The trip never advances S.t or S.cur.
//
//  Mileages are one-way road miles from Soldotna, worked out from Sterling Highway mileposts (Soldotna at about
//  milepost 95.2): Johnson Lake Rd at MP 110, Clam Gulch at 117.4, Deep Creek at 137.3, Anchor River at 161,
//  Homer at 173, Quartz Creek at 44.9, Swanson River Rd at 83.5 (+17 mi), Skilak Lake Rd west end at 75.2,
//  Hidden Lake 3.5 mi and Lower Skilak 13.3 mi along it. Captain Cook SRA is "25 miles north of Kenai" (about 11
//  from Soldotna to Kenai). Fees are Alaska State Parks' published $20/site where a campground is run; most are
//  unmaintained in winter, so winter camping is free but without services.
// ============================================================
const CAMP_MPG=15, CAMP_SUPPLIES=25, CAMP_NIGHTS=[1,2,3,5,7];
const CAMP_DEST=[
  {id:'johnson',ic:'🏞️',n:'Johnson Lake (Kasilof)',miles:16,fee:0,h:'lake',d:'Sterling Hwy MP 110, then Johnson Lake Road. The state rec area has toilets and a boat launch in summer ($20 a site); in winter nothing is serviced or plowed, so you park out and camp free on the ice-rimmed lake.'},
  {id:'clam',ic:'🌊',n:'Clam Gulch beach',miles:22,fee:0,h:'coast',d:'MP 117.4 on the Sterling Hwy. The summer campground ($20 a site) is not serviced in winter; the bluff looks over Cook Inlet and the volcanoes across the water.'},
  {id:'hidden',ic:'🌲',n:'Hidden Lake (Kenai Refuge)',miles:24,fee:0,h:'forest',d:'3.5 miles along Skilak Lake Road from the Sterling Hwy at MP 75.2. The refuge charges $15 in season; I couldn’t confirm winter service, so the game treats it as unmaintained: no fee, no services.'},
  {id:'swanson',ic:'🛶',n:'Swanson River Road & Swan Lake canoe area',miles:29,fee:0,h:'lake',d:'Turn north at MP 83.5 and drive 17 miles of refuge road to the canoe-route landings. Summer parking is $5; the game treats winter as unserviced, quiet ski and snowmobile country.'},
  {id:'skilak',ic:'⛰️',n:'Lower Skilak Lake Campground',miles:33,fee:0,h:'mtn',d:'13.3 miles along Skilak Lake Road from the west end. Listed as a summer campground (May to September) with no fee; treated here as unserviced in winter: you are on your own on a big, windy lake shore.'},
  {id:'cook',ic:'🌲',n:'Captain Cook State Rec Area',miles:36,fee:0,h:'forest',d:'About 25 miles north of Kenai, near Stormy Lake, where winter visitors ice fish. Discovery Campground is $20 a site in summer; in winter you camp unserviced.'},
  {id:'deep',ic:'🦅',n:'Deep Creek State Rec Area',miles:42,fee:0,h:'coast',d:'MP 137.3 on the Sterling Hwy, on the Cook Inlet bluff above the beach. Summer sites are $20; in winter there is no service, and the beach is a cold, bright place for eagles.'},
  {id:'quartz',ic:'🏔️',n:'Quartz Creek (Kenai Lake)',miles:51,fee:0,h:'mtn',d:'Quartz Creek Campground sits at MP 44.9 near Cooper Landing, a summer Forest Service campground. In winter it is unserviced with steep mountain slopes on all sides. Dall sheep and goats are in the high country.'},
  {id:'anchor',ic:'🎣',n:'Anchor River State Rec Area',miles:66,fee:20,h:'river',d:'MP 161, the westernmost highway point in North America. The state campgrounds charge $20 a site; the Anchor River runs open under ice shelves and steelhead and Dolly Varden are in it.'},
  {id:'spit',ic:'⚓',n:'Homer Spit',miles:83,fee:0,h:'coast',d:'The city’s Spit campgrounds are open April through October only, so in winter you park rough with no hookups and no dump station. Expect sea ducks, eagles and a hard wind off Kachemak Bay.'}
];
const campGas=()=>Math.round(Math.max(4.5,((S.fuelBase&&S.fuelBase.kenai)||6.19)-.85)*100)/100;   // Peninsula pump gas ≈ marine dock price − the marine premium
function campCost(dest,n){
  const gas=campGas(),gal=Math.round(dest.miles*2/CAMP_MPG*10)/10,fuel=Math.round(gal*gas*100)/100,fees=dest.fee*n,sup=CAMP_SUPPLIES*n;
  return {gas,gal,fuel,fees,sup,total:Math.round((fuel+fees+sup)*100)/100};
}

// ---- ten encounters (fx applies the effect and returns the line to show) ----
const loseCash=x=>{const c=Math.min(x,Math.max(0,Math.round(S.money)));money(-c);S.stats.spent+=c;return c};
const CAMP_ENC=[
  {id:'moose',ic:'🫎',t:'A cow moose and her calf',good:true,h:['forest','lake','river'],
   text:'At first light a cow moose and her calf browse the willows right at the edge of camp, breath smoking in the cold.',
   fx(){if(Math.random()<.25){adj('energy',-6);return 'You edge in for a better look. She lays her ears back and stamps; you retreat to the truck for an hour. (Energy −6)'}adj('energy',5);return 'You stay in the doorway and just watch. (Energy +5)'}},
  {id:'wolves',ic:'🐺',t:'Wolves howling across the lake',good:true,h:['lake','forest','mtn'],
   text:'Around midnight a pack starts up on the far shore. One voice, then five, rising and bouncing off the frozen lake.',
   fx(){adj('energy',4);S.skill+=1;return 'You lie awake and listen to every note. (Energy +4, Skill +1)'}},
  {id:'lynx',ic:'🐈',t:'A lynx on the trail',good:true,h:['forest','lake'],
   text:'On a morning walk a lynx crosses the trail ahead, big paws, tufted ears, in snowshoe hare country. It looks at you and is gone.',
   fx(){adj('energy',3);S.skill+=1;return 'Hare tracks everywhere; you learn to read them. (Energy +3, Skill +1)'}},
  {id:'fox',ic:'🦊',t:'A red fox raids the food bag',good:false,h:['forest','coast','river','lake'],
   text:'You wake to a fox trotting off with your bacon. The food bag you left out is shredded.',
   fx(){const c=loseCash(35);adj('energy',-2);return `You restock at the gas station. (−${$(c)}, Energy −2)`}},
  {id:'ravens',ic:'🐦‍⬛',t:'Ravens open the cooler',good:false,h:['forest','coast','river','lake','mtn'],
   text:'A pair of ravens figure out the latch on the cooler and you find them lunching on your sandwiches, croaking like they paid for them.',
   fx(){const c=loseCash(20);return `Smart birds. (−${$(c)})`}},
  {id:'porcupine',ic:'🦔',t:'A porcupine at the truck',good:false,h:['forest','lake','river'],
   text:'In the night a porcupine finds salt on the truck and chews on a tire sidewall and the axe handle you left out.',
   fx(){const c=loseCash(60);return `A new tire patch and a new axe handle. (−${$(c)})`}},
  {id:'swans',ic:'🦢',t:'Trumpeter swans on open water',good:true,h:['lake','river'],
   text:'Where the outlet keeps the water open, a family of trumpeter swans feeds along the ice edge, their calls like small brass horns.',
   fx(){adj('energy',4);adj('rep',1);return 'You have a story for the next clients. (Energy +4, Rep +1)'}},
  {id:'eagles',ic:'🦅',t:'Bald eagles on the beach',good:true,h:['coast','river'],
   text:'A dozen bald eagles line the tide flat and the driftwood, picking over what the tide left.',
   fx(){adj('energy',4);S.skill+=1;return 'You watch how they work the water. (Energy +4, Skill +1)'}},
  {id:'sheep',ic:'🐏',t:'Dall sheep on the slope',good:true,h:['mtn'],
   text:'White specks on the avalanche chute above camp resolve into Dall sheep, bedded in the wind-scoured alpine, glowing in the low sun.',
   fx(){adj('energy',6);return 'You carry the picture home. (Energy +6)'}},
  {id:'bear',ic:'🐻',t:'A brown bear out of its den',good:false,h:['forest','mtn','lake','coast'],
   text:'A warm spell and big tracks in the snow beside the tent: a brown bear is awake and wandering where it should be asleep.',
   fx(){const c=loseCash(15);adj('energy',-9);return `You pack up in the dark and drive out. (Energy −9, −${$(c)} gas)`}}
];
function campPick(dest){
  const w=CAMP_ENC.map(e=>e.h.includes(dest.h)?(e.h[0]===dest.h?4:3):0),tot=w.reduce((a,b)=>a+b,0);
  let r=Math.random()*tot;for(let i=0;i<w.length;i++){r-=w[i];if(r<0)return CAMP_ENC[i]}
  return CAMP_ENC[0];
}
const CAMP_QUIET=['❄️ A quiet night. Minus 10°F, snow squeaking under your boots, and stars all the way down.',
  '🌌 The northern lights roll green over the spruce for an hour. Then silence.',
  '🌲 Snow loads the spruce boughs until one lets go with a soft thump. Otherwise: nothing at all.',
  '🔥 You feed the fire, the stove ticks, and the cold sits just outside the tent.',
  '🌙 A full moon on fresh snow; you could read by it.',
  '💨 The wind rises at midnight and drops at four. You sleep through most of it.'];

// ---- the flow: winterModal → campModal → nightsModal → confirm → goCamp → report ----
const campUsed=()=>!!(S.camp&&S.winter&&S.camp.s===S.winter.s);
function campModal(){
  if(!S.winter) return;
  modal('🏕️ Winter camping · cash '+$(Math.round(S.money)),`<p>Winter on the Kenai Peninsula. Pick a place within 100 road miles of Soldotna. One trip per off-season: the rest of the winter you work your other job.</p><p style="font-size:13px;color:var(--mute)">Pump gas about ${$(campGas())}/gal; the pickup gets ${CAMP_MPG} mpg. Most campgrounds are unserviced in winter.</p>`,
    CAMP_DEST.map(d=>({l:`${d.ic} ${d.n} — ${d.miles} mi`,s:d.d,fn:()=>setTimeout(()=>nightsModal(d),0)})).concat([{l:'Not now',s:'Back to the off-season summary.',fn:()=>setTimeout(winterModal,0)}]));
}
function nightsModal(d){
  modal(`${d.ic} ${d.n}`,`<p>${d.d}</p><p style="font-size:13px;color:var(--mute)">${d.miles} miles each way. Fee ${d.fee?$(d.fee)+'/night':'none (unmaintained in winter)'}. Each night has a 50% chance of a wildlife encounter.</p>`,
    CAMP_NIGHTS.map(n=>{const c=campCost(d,n);return {l:`${n} night${n>1?'s':''} — ${$(c.total)}`,s:c.total>S.money?'Can’t afford it.':`${$(c.fuel)} gas, ${$(c.fees)} fees, ${$(c.sup)} supplies.`,dis:c.total>S.money,fn:()=>setTimeout(()=>campConfirm(d,n),0)}})
      .concat([{l:'Back',s:'Pick another place.',fn:()=>setTimeout(campModal,0)}]));
}
function campConfirm(d,n){
  const c=campCost(d,n);
  modal(`🏕️ ${n} night${n>1?'s':''} at ${d.n}`,`<p>⛽ Gas: ${d.miles*2} miles round trip ÷ ${CAMP_MPG} mpg = ${c.gal} gal × ${$(c.gas)} = <b>${$(c.fuel)}</b><br>🏕️ Campsite fees: <b>${$(c.fees)}</b><br>🥫 Supplies, ${$(CAMP_SUPPLIES)}/night: <b>${$(c.sup)}</b><br>Total: <b>${$(c.total)}</b> of ${$(Math.round(S.money))}.</p>`,
    [{l:'Pack the truck',s:'Go.',dis:c.total>S.money,fn:()=>goCamp(d,n)},{l:'Back',fn:()=>setTimeout(()=>nightsModal(d),0)}]);
}
function goCamp(d,n){
  if(!S.winter||campUsed()) return null;
  const c=campCost(d,n);if(c.total>S.money) return null;
  money(-c.total);S.stats.spent+=c.total;S.camp={s:S.winter.s,dest:d.id,nights:n};
  const st=S.stats;st.campNights=(st.campNights||0)+n;st.seen=st.seen||{};
  const e0=S.energy,rows=[];let enc=0;
  for(let i=1;i<=n;i++){
    if(Math.random()<.5){
      const e=campPick(d);enc++;st.encounters=(st.encounters||0)+1;st.seen[e.id]=(st.seen[e.id]||0)+1;
      rows.push(`<p><b>Night ${i}: ${e.ic} ${e.t}.</b> ${e.text} <em>${e.fx()}</em></p>`);
    }else{adj('energy',2);rows.push(`<p><b>Night ${i}:</b> ${pick(CAMP_QUIET)} (Energy +2)</p>`)}
  }
  adj('energy',0);
  S.camp.enc=enc;
  sfx(enc?'good':'click');
  modal(`🏕️ Back from ${d.n}`,rows.join('')+`<p>${n} night${n>1?'s':''}, ${enc} encounter${enc===1?'':'s'}. Spent <b>${$(c.total)}</b>. Energy ${e0} → <b>${S.energy}</b> (carries into the season). Cash ${$(Math.round(S.money))}.</p>`,
    [{l:'Back to the off-season',fn:()=>setTimeout(winterModal,0)}]);
  return {cost:c.total,enc,rows};
}
