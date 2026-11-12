// ============================================================
//  KENAI WINTER CAMP, part 1: the content.
//  Places, months, gear, shelters, wildlife and weather, activities, winter work and achievements.
//
//  Mileages are one-way road miles from Soldotna, worked out from Sterling Highway mileposts (Soldotna at about
//  milepost 95.2): Johnson Lake Rd at MP 110, Clam Gulch at 117.4, Deep Creek at 137.3, Anchor River at 161, Homer at 173,
//  Quartz Creek at 44.9, Swanson River Rd at 83.5 (+17 mi), Skilak Lake Rd west end at 75.2, Hidden Lake 3.5 mi and Lower Skilak
//  13.3 mi along it. Captain Cook SRA is "25 miles north of Kenai" (about 11 from Soldotna to Kenai). Most campgrounds are not
//  serviced in winter, so winter camping there is free but without services. Prices are 2026 estimates, not quotes.
// ============================================================
(function(K){
  'use strict';
  const D=K.data={};
  D.MPG=15; D.SUPPLIES=25; D.NIGHTS=[1,2,3,5]; D.WINTER_DAYS=10; D.MAX_TRIPS=3; D.MAX_GIGS=2;
  D.MAX_BOOK=.02;            // the most a winter can add to next season's daily chance of a booking
  D.MAX_FIRST=.03;           // the most it can add to the catch on the first few trips
  D.LICENSE=20;               // an Alaska resident sport fishing license ($20 in ADF&G's 2025 and 2026 regulations; it was $29 before 1.11.0); licenses run by calendar year
  D.ICE_WALK=4;               // inches of clear, hard ice for a person on foot
  D.CAPACITY=12;              // load points the truck and sled carry; every item and companion uses some
  D.RENT_ICE=15;              // renting an ice kit at the Soldotna tackle shop

  // ---- places (habitat h: lake, forest, coast, river, mtn) ----
  D.PLACES=[
    {id:'johnson',ic:'🏞️',n:'Johnson Lake (Kasilof)',miles:16,fee:0,h:'lake',ice:'Johnson Lake',scout:'kasilof',d:'Sterling Hwy MP 110, then Johnson Lake Road. The state rec area has toilets and a boat launch in summer ($20 a site); in winter nothing is serviced or plowed, so you park out and camp free on the ice-rimmed lake. ADF&G stocks this lake, and winter anglers fish it through the ice.'},
    {id:'clam',ic:'🌊',n:'Clam Gulch beach',miles:22,fee:0,h:'coast',d:'MP 117.4 on the Sterling Hwy. The summer campground ($20 a site) is not serviced in winter; the bluff looks over Cook Inlet and the volcanoes across the water.'},
    {id:'hidden',ic:'🌲',n:'Hidden Lake (Kenai Refuge)',miles:24,fee:0,h:'forest',scout:'upper',d:'3.5 miles along Skilak Lake Road from the Sterling Hwy at MP 75.2. The refuge charges $15 in season. In winter, expect no services and no fee.'},
    {id:'swanson',ic:'🛶',n:'Swanson River Road & Swan Lake canoe area',miles:29,fee:0,h:'lake',ski:true,cabin:45,d:'Turn north at MP 83.5 and drive 17 miles of refuge road to the canoe-route landings. Summer parking is $5. In winter it’s unserviced, quiet ski and snowmobile country, and a refuge public-use cabin can be reserved ahead.'},
    {id:'skilak',ic:'⛰️',n:'Lower Skilak Lake Campground',miles:33,fee:0,h:'mtn',scout:'upper',cabin:55,d:'13.3 miles along Skilak Lake Road from the west end. A summer campground (May to September) with no fee. In winter you’re on your own on a big, windy lake shore; a public-use cabin in the area can be reserved ahead.'},
    {id:'cook',ic:'🌲',n:'Captain Cook State Rec Area',miles:36,fee:0,h:'forest',ice:'Stormy Lake',ski:true,d:'About 25 miles north of Kenai, near Stormy Lake, where winter visitors ice fish stocked fish. Discovery Campground is $20 a site in summer; in winter you camp unserviced.'},
    {id:'deep',ic:'🦅',n:'Deep Creek State Rec Area',miles:42,fee:0,h:'coast',d:'MP 137.3 on the Sterling Hwy, on the Cook Inlet bluff above the beach. Summer sites are $20; in winter there is no service, and the beach is a cold, bright place for eagles.'},
    {id:'quartz',ic:'🏔️',n:'Quartz Creek (Kenai Lake)',miles:51,fee:0,h:'mtn',scout:'upper',cabin:65,d:'Quartz Creek Campground sits at MP 44.9 near Cooper Landing, a summer Forest Service campground. In winter it is unserviced with steep mountain slopes on all sides. The campground has no cabin of its own, but the Forest Service rents public-use cabins in the area ($50 to $75 a night). Dall sheep and goats are in the high country, and the upper Kenai River runs below.'},
    {id:'anchor',ic:'🎣',n:'Anchor River State Rec Area',miles:66,fee:20,h:'river',d:'MP 161, the westernmost highway point in North America. The state campgrounds charge $20 a site; the Anchor River runs open under ice shelves and steelhead and Dolly Varden are in it.'},
    {id:'spit',ic:'⚓',n:'Homer Spit',miles:83,fee:0,h:'coast',d:'The city’s Spit campgrounds are open April through October only, so in winter you park rough with no hookups and no dump station. Expect sea ducks, sea otters, eagles and a hard wind off Kachemak Bay.'},
  ];
  D.place=id=>D.PLACES.find(p=>p.id===id);

  // ---- months: daylight hours (about, at 60°N), ice quality, and the weather odds ----
  D.MONTHS=[
    {id:'nov',n:'November',day:7.3,ice:.22,clear:.35,cold:.5,storm:1,chin:.5,yo:0,t:'10 to 25°F',d:'Early ice is thin and the days are shrinking.'},
    {id:'dec',n:'December',day:5.8,ice:.4,clear:.40,cold:1.2,storm:1.2,chin:.8,yo:0,t:'0 to 20°F',d:'The darkest weeks: barely five and a half hours of light, and the best northern lights.'},
    {id:'jan',n:'January',day:6.8,ice:.8,clear:.45,cold:1.6,storm:1,chin:1,yo:1,t:'−15 to 15°F',d:'Cold and still, with ice that holds. Fishing licenses started over on January 1.'},
    {id:'feb',n:'February',day:9,ice:.95,clear:.5,cold:1.3,storm:1,chin:1,yo:1,t:'−5 to 25°F',d:'The ice is at its best and the days are noticeably longer.'},
    {id:'mar',n:'March',day:11.5,ice:.65,clear:.5,cold:.5,storm:.7,chin:1.5,yo:1,t:'10 to 35°F',d:'Long bright days, but thaws and soft ice are coming.'},
  ];
  D.month=id=>D.MONTHS.find(m=>m.id===id);
  D.slots=m=>m.day>=9?2:1;                      // daylight activities per day: one in the dark months, two on long days
  // calendar year of a month in a winter that starts in `year`: Nov and Dec are that year, Jan to Mar the next
  D.calYear=(m,year)=>year+m.yo;

  // ---- things to pack (wt = load points; once = bought once and kept, otherwise paid every trip) ----
  D.PACK=[
    {id:'bear',ic:'🛢️',n:'Bear-resistant food container',cost:80,wt:3,once:true,d:'Locks food and scented gear away from foxes, ravens, wolverines and bears. Keep it downwind of camp, away from the tent.'},
    {id:'fuel',ic:'⛽',n:'Extra stove fuel',cost:14,wt:2,once:false,d:'A cold snap burns twice the fuel. Running out at 25 below is how a hard night becomes a dangerous one.'},
    {id:'bag',ic:'🛌',n:'Cold-rated sleeping bag (−20°F)',cost:160,wt:3,once:true,d:'Rated well below the night’s low, on an insulated pad. Cold sleepers burn through the night’s energy.'},
    {id:'layers',ic:'🧥',n:'Spare layers: wool, a dry hat and mitts',cost:70,wt:2,once:true,d:'Cotton kills when it’s wet. A dry set of wool is the cheapest insurance there is.'},
    {id:'truck',ic:'🔋',n:'Truck kit: jump pack, shovel, tow strap',cost:70,wt:2,once:true,d:'A dead battery or a drifted-in road is a nuisance with this and a tow bill without it.'},
    {id:'ice',ic:'🧊',n:'Ice kit: hand auger, rod and skimmer',cost:90,wt:4,once:true,d:'Needed to fish through the ice. You can rent one in town for a day if you can’t carry it.'},
    {id:'picks',ic:'📍',n:'Ice picks and a throw rope',cost:25,wt:1,once:true,d:'Worn around the neck, the picks let you pull yourself out of the water. The rope is for pulling out someone else.'},
    {id:'vise',ic:'🪶',n:'Fly-tying vise and materials',cost:40,wt:1,once:true,d:'Evenings by the fire turn into flies and leaders for next July.'},
  ];
  D.pack=id=>D.PACK.find(p=>p.id===id);

  // ---- where you sleep (comfort lowers the odds of a bad night; load and cap use truck space) ----
  D.SHELTERS={
    tent:{id:'tent',ic:'⛺',n:'Four-season tent and stove',comfort:0,load:2,cap:0,cost:0,d:'What you already own. Cold, but light.'},
    wall:{id:'wall',ic:'🏕️',n:'Wall tent with a wood stove',comfort:1,load:3,cap:0,cost:1200,d:'A canvas wall tent and a small stove: you can stand up, dry your boots and keep a pot hot. About $1,200.'},
    camper:{id:'camper',ic:'🚐',n:'Truck camper',comfort:2,load:0,cap:4,cost:7500,d:'A used, insulated pickup camper with a furnace. It carries your gear, too. About $7,500.'},
    cabin:{id:'cabin',ic:'🛖',n:'Public-use cabin',comfort:2,load:0,cap:0,cost:0,d:'A refuge, State Parks or Forest Service cabin reserved ahead: bunks, a stove and four walls.'},
  };

  // ---- the animals (every wildlife encounter is a species for the camping log) ----
  D.SPECIES=[
    ['moose','🫎','Moose'],['wolves','🐺','Wolves'],['lynx','🐈','Lynx'],['fox','🦊','Red fox'],['ravens','🐦‍⬛','Ravens'],
    ['porcupine','🦔','Porcupine'],['swans','🦢','Trumpeter swans'],['eagles','🦅','Bald eagles'],['sheep','🐏','Dall sheep'],['bear','🐻','Brown bear'],
    ['otters','🦦','River otters'],['wolverine','🦡','Wolverine'],['hares','🐇','Snowshoe hares'],['ptarmigan','🐦','Willow ptarmigan'],['seaotters','🦭','Sea otters'],['chickadees','🐤','Chickadees'],
  ].map(([id,ic,n])=>({id,ic,n}));
  D.ALL=D.SPECIES.map(s=>s.id);

  // ---- encounters and weather ----
  // kind: good, bad or mixed. cat: wild (weighted by the habitat of the place) or weather (any place, weighted by the month).
  // counter: the packed item that makes a bad one rarer and gentler. fx(c) returns {d:{energy,cash,rep,skill,wom,days,thaw,messy}, line}.
  // c.has(item), c.r() random 0..1, c.comfort, c.shelter. Money in d.cash is negative for a cost.
  const E=D.ENC=[];
  const add=e=>E.push(e);
  add({id:'moose',ic:'🫎',t:'A cow moose and her calf',kind:'good',cat:'wild',h:['forest','lake','river','coast'],
    text:'At first light a cow moose and her calf browse the willows right at the edge of camp, breath smoking in the cold.',
    fx:c=>c.r()<.25?{d:{energy:-6},line:'You edge in for a better look. She lays her ears back and stamps; you retreat to the truck for an hour.'}:{d:{energy:5},line:'You stay in the doorway and just watch.',lesson:'Give a moose room. A cow with a calf is the one that charges.'}});
  add({id:'wolves',ic:'🐺',t:'Wolves howling across the lake',kind:'good',cat:'wild',h:['lake','forest','mtn'],
    text:'Around midnight a pack starts up on the far shore. One voice, then five, rising and bouncing off the frozen lake.',
    fx:()=>({d:{energy:4,skill:1},line:'You lie awake and listen to every note.'})});
  add({id:'lynx',ic:'🐈',t:'A lynx on the trail',kind:'good',cat:'wild',h:['forest','lake'],
    text:'On a morning walk a lynx crosses the trail ahead, big paws, tufted ears, in snowshoe hare country. It looks at you and is gone.',
    fx:()=>({d:{energy:3,skill:1},line:'Hare tracks everywhere; you learn to read them.'})});
  add({id:'fox',ic:'🦊',t:'A red fox raids the food bag',kind:'bad',cat:'wild',h:['forest','coast','river','lake'],counter:'bear',
    text:'You wake to a fox trotting off with your bacon. The food bag you left out is shredded.',
    fx:c=>c.has('bear')?{d:{},line:'The fox gives the sealed container a hard sniff and trots off with nothing.',lesson:'A bear-resistant container works on foxes, too.'}:{d:{cash:-35,energy:-2,messy:1},line:'You restock at the gas station.',lesson:'Food left out feeds foxes and teaches them to come back. Seal it away from the tent.'}});
  add({id:'ravens',ic:'🐦‍⬛',t:'Ravens open the cooler',kind:'bad',cat:'wild',h:['forest','coast','river','lake','mtn'],counter:'bear',
    text:'A pair of ravens figure out the latch on the cooler and you find them lunching on your sandwiches, croaking like they paid for them.',
    fx:c=>c.has('bear')?{d:{},line:'The ravens walk around the locked container twice and give up.'}:{d:{cash:-20,messy:1},line:'Smart birds.',lesson:'Ravens learn latches. A cooler is not a lock.'}});
  add({id:'porcupine',ic:'🦔',t:'A porcupine at the truck',kind:'bad',cat:'wild',h:['forest','lake','river'],
    text:'In the night a porcupine finds salt on the truck and chews on a tire sidewall and the axe handle you left out.',
    fx:()=>({d:{cash:-60},line:'A new tire patch and a new axe handle.',lesson:'Salty tool handles and road-salted tires draw porcupines. Put tools away at night.'})});
  add({id:'swans',ic:'🦢',t:'Trumpeter swans on open water',kind:'good',cat:'wild',h:['lake','river'],
    text:'Where the outlet keeps the water open, a family of trumpeter swans feeds along the ice edge, their calls like small brass horns.',
    fx:()=>({d:{energy:4,rep:1},line:'You have a story for the next clients.'})});
  add({id:'eagles',ic:'🦅',t:'Bald eagles on the beach',kind:'good',cat:'wild',h:['coast','river'],
    text:'A dozen bald eagles line the tide flat and the driftwood, picking over what the tide left.',
    fx:()=>({d:{energy:4,skill:1},line:'You watch how they work the water.'})});
  add({id:'sheep',ic:'🐏',t:'Dall sheep on the slope',kind:'good',cat:'wild',h:['mtn'],
    text:'White specks on the avalanche chute above camp resolve into Dall sheep, bedded in the wind-scoured alpine, glowing in the low sun.',
    fx:()=>({d:{energy:6},line:'You carry the picture home.'})});
  add({id:'bear',ic:'🐻',t:'A brown bear out of its den',kind:'bad',cat:'wild',h:['forest','mtn','lake','coast'],counter:'bear',cw:.5,
    text:'A warm spell and big tracks in the snow beside the tent: a brown bear is awake and wandering where it should be asleep.',
    fx:c=>c.has('bear')?{d:{energy:-4},line:'Your food is sealed and well away from the tent, so there is nothing to reward the bear. You still break camp in the dark and drive out.',lesson:'A bear that finds food at a camp comes back for the next one. Store it, and leave.'}:{d:{cash:-15,energy:-9,messy:1},line:'You pack up in the dark and drive out.',lesson:'Food in the tent invites a bear to it. Cook and store away from where you sleep.'}});
  // new in this version
  add({id:'otters',ic:'🦦',t:'River otters on the ice',kind:'good',cat:'wild',h:['river','lake'],
    text:'Two river otters pop out of an open lead, slide belly-first down the snowbank and dive back in, again and again, as if the ice were a playground.',
    fx:()=>({d:{energy:4},line:'You laugh for the first time in a week.'})});
  add({id:'wolverine',ic:'🦡',t:'A wolverine raids the cache',kind:'bad',cat:'wild',h:['forest','mtn','lake'],counter:'bear',cw:.25,
    text:'Something with big claws and no fear has torn into the food you stashed under the tarp, and it dragged half of it into the spruce. The tracks are a wolverine’s, loping straight lines in the snow.',
    fx:c=>c.has('bear')?{d:{},line:'The wolverine rolls the locked container thirty feet and gives up.',lesson:'Nothing but a hard container stops a wolverine. A tarp is a wrapper.'}:{d:{cash:-45,energy:-3,messy:1},line:'You write off the food and restock.',lesson:'A wolverine will tear through a tarp. Hard-sided, locked, and away from camp.'}});
  add({id:'hares',ic:'🐇',t:'Snowshoe hares at dusk',kind:'good',cat:'wild',h:['forest','lake','river'],
    text:'At dusk the willows are full of snowshoe hares in their white coats, hopping out onto the packed trail with their oversized back feet.',
    fx:()=>({d:{energy:3},line:'Where the hares are, the lynx are not far away.'})});
  add({id:'ptarmigan',ic:'🐦',t:'Ptarmigan in the willows',kind:'good',cat:'wild',h:['mtn','lake','coast'],
    text:'A flock of willow ptarmigan, white as the snow, bursts from under a bush and clucks across the slope.',
    fx:()=>({d:{energy:4},line:'Alaska’s state bird, in its winter whites.'})});
  add({id:'seaotters',ic:'🦭',t:'Sea otters off the Spit',kind:'good',cat:'wild',h:['coast'],only:['spit'],
    text:'Off the end of the Spit a raft of sea otters floats on its backs in the swell, cracking clams on their chests.',
    fx:()=>({d:{energy:5},line:'You watch until your fingers go numb.'})});
  add({id:'chickadees',ic:'🐤',t:'Chickadees at camp',kind:'good',cat:'wild',h:['forest','lake','river','coast'],
    text:'A flock of black-capped and boreal chickadees works the spruce around camp, tiny and loud and not at all bothered by the cold.',
    fx:()=>({d:{energy:3},line:'They live on what they find, so you don’t feed them.',lesson:'Don’t feed wildlife, even the small ones. Fed birds lose their winter foraging skills.'})});
  // weather
  add({id:'coldsnap',ic:'🥶',t:'A cold snap',kind:'bad',cat:'weather',base:3.5,mon:'cold',
    text:'The temperature falls through the night to minus 25 and keeps going. Water bottles freeze solid, the water line of a camper or cabin freezes, and in the morning the truck’s battery will not turn over.',
    fx:c=>{let e=-8;if(c.has('bag'))e*=.6;if(c.has('layers'))e*=.75;if(c.has('fuel'))e*=.8;if(c.comfort>=2)e*=.7;e=Math.round(e);
      const kit=c.has('truck'),cash=kit?0:-60,ok=[c.has('bag')&&'a bag rated for it',c.has('layers')&&'dry layers',c.has('fuel')&&'plenty of stove fuel'].filter(Boolean);
      return {d:{energy:e,cash},line:(kit?'Your jump pack gets the truck going in minutes. ':'A tow truck and a new battery clamp cost you. ')+(ok.length?'Camp was ready with '+ok.join(' and ')+'.':'You were not ready for it.'),
        lesson:'A cold snap is when stove fuel, a bag rated below the low and a jump pack earn their weight.'}}});
  add({id:'snowstorm',ic:'🌨️',t:'A snowstorm',kind:'bad',cat:'weather',base:3.2,mon:'storm',counter:'truck',cw:.7,
    text:'Snow falls all night and by morning the road out is drifted shut. You are not going anywhere today.',
    fx:c=>{const e=c.comfort>=2?-1:c.comfort===1?-2:-3,kit=c.has('truck');
      return {d:{energy:e,cash:kit?-25:-95,days:1},line:kit?'You shovel out the truck with your own shovel, eat a stranded day’s food and drive out the next morning.':'A plow-truck neighbor pulls you out the next morning for a fee, after a stranded day.',lesson:'A shovel and a day’s extra food turn a snowed-in night into a story.'}}});
  add({id:'chinook',ic:'🌬️',t:'A chinook thaw',kind:'mixed',cat:'weather',base:2.6,mon:'chin',
    text:'A warm wind off the Gulf sweeps in overnight and the thermometer jumps thirty degrees. Icicles drip off the tent and the trail turns to slush.',
    fx:()=>({d:{energy:2,thaw:1},line:'An easy day, but the ice on every lake is softer than it was.',lesson:'A thaw weakens lake ice fast. Re-check it before you walk out.'})});

  // quiet nights
  D.QUIET=['❄️ A quiet night. Minus 10°F, snow squeaking under your boots, and stars all the way down.',
    '🌌 The northern lights roll green over the spruce for an hour. Then silence.',
    '🌲 Snow loads the spruce boughs until one lets go with a soft thump. Otherwise: nothing at all.',
    '🔥 You feed the fire, the stove ticks, and the cold sits just outside the tent.',
    '🌙 A full moon on fresh snow; you could read by it.',
    '💨 The wind rises at midnight and drops at four. You sleep through most of it.'];

  // ---- winter work (a day each) ----
  D.GIGS=[
    {id:'iceguide',ic:'🧊',n:'Guide ice fishers on a stocked lake',d:'Two clients, a day on the ice, about $70 each, and gas to the lake.',need:'You need an ice kit (you can rent one for $15) and a current fishing license.'},
    {id:'snowmachine',ic:'🛷',n:'Run a snowmachine tour for visitors',d:'A day showing visitors the refuge by snowmachine, about $80 a rider, less fuel. A machine can break down, and riders’ tips vary.',need:'You need a little reputation to be trusted with a rental sled.'},
    {id:'event',ic:'🏁',n:'Help at a winter event',d:'Winter Games in Soldotna or the Tustumena 200 sled dog race in Kasilof, whenever they run (neither runs every winter): a stipend and meals, and a lot of people who will remember you.',need:''},
  ];

  // ---- achievements the engine itself can award (the host may add its own) ----
  D.ACH=[
    {id:'every_animal',ic:'🦌',n:'Every Animal',d:'See all '+D.ALL.length+' kinds of Kenai winter wildlife.'},
    {id:'no_trace',ic:'🌲',n:'No Trace',d:'Break camp with nothing left behind: food stored, trash packed out, no raided camp.'},
  ];
})(KenaiCamp);
