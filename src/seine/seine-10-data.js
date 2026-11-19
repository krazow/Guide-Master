// ============================================================
//  PURSE SEINE, part 1: the water, the fish, the money.
//  Simplified, plausible facts (see README.md, Facts and sources). Lower Cook Inlet's Southern District (Kachemak Bay) opens to
//  purse seines in mid-June on a Monday, Wednesday and Friday schedule of 16-hour periods (6 AM to 10 PM): sockeye bound for the
//  stocked Leisure and Hazel lakes and the Tutka Bay hatchery, then pink salmon. The hatchery's special harvest areas stay closed to
//  the fleet. Fishing after late July depends on the wild pink escapement, and the pinks can fail outright in a poor year.
//  Prices and weights: ADF&G's preliminary 2025 Lower Cook Inlet figures. Everything else here is an estimate for play.
// ============================================================
(function(K){
  'use strict';
  const D=K.data={};
  D.OPEN=360;D.CLOSE=1320;                     // a period runs 6 AM to 10 PM
  D.DAYS=[0,2,4];                              // Monday, Wednesday, Friday (0 is Monday)
  D.PRICE={sockeye:2.20,pink:0.25,chum:0.53};  // dollars a pound to the fisherman (ADF&G preliminary 2025, Lower Cook Inlet)
  D.WT={sockeye:4.5,pink:3.1,chum:6.4};        // average pounds a fish, same source
  D.BLEED=0.15;                                // a little more a pound for bled, slushed sockeye (an estimate; tenders vary)
  D.NAMES={sockeye:'sockeye',pink:'pinks',chum:'chums'};
  // shares, as fractions of the boat's gross after the day's fuel, ice and groceries come off the top
  D.SHARE={green:.08,hand:.10};                // a greenhorn's crew share, and a hand's after a season (or a good word from the skipper)
  D.SKIP={crew:3,crewShare:.09,boatShare:.20,transferShare:.20};   // running your own: three crew, the boat owner's share, the permit holder's share
  D.COST={dieselGal:40,ice:120,grub:80,bleedIce:60};               // a Kachemak Bay day: about 40 gallons of diesel, slush ice and groceries
  // the winter's paperwork and gear (estimates, except the crewmember license: ADF&G's resident fee)
  D.SEASON={license:60,gear:340,insurance:1500,exam:450,permitFee:300};
  D.PERMIT={price:45000,sell:.9};              // a Cook Inlet seine permit: tens of thousands, few sales a year (an estimate)
  D.SKILL_TO_SKIP=4;                           // openers worked as crew before you can run a boat
  D.WAIT=45;D.SET_MIN=80;                      // minutes to wait for a better school; minutes a set takes, start to brailed
  D.WIND_RUFF=18;D.WIND_BAD=25;                // knots: a sloppy day, and a small craft advisory day
  D.FINE={sha:1500,stream:1000};               // fishing inside a hatchery's special harvest area, or too close to a stream mouth (estimates)
  // the bays of the Southern District open to seining (from Homer harbor, across Kachemak Bay)
  D.SPOTS={
    tutka:{n:'Tutka Bay',ic:'🏞️',run:50,sock:1.0,pink:1.4,chum:.6,reef:.20,crowd:.75,line:'sha',lineTxt:'the hatchery’s special harvest area line',
      d:'Outside the Tutka Bay hatchery line. Hatchery pinks and sockeye mill along the beach; so does half the fleet.'},
    neptune:{n:'Neptune Bay',ic:'⛰️',run:45,sock:1.15,pink:.8,chum:.4,reef:.30,crowd:.55,line:'sha',lineTxt:'the Hazel Lake special harvest area line',
      d:'Sockeye bound for the stocked lakes stage off the point. Rocky edges.'},
    chinapoot:{n:'China Poot Bay',ic:'🪨',run:40,sock:1.3,pink:.6,chum:.3,reef:.38,crowd:.85,line:'sha',lineTxt:'the China Poot special harvest area line',
      d:'Where Leisure Lake’s stocked sockeye come home. Tight water, a reef on the east side, everybody wants the hook-off.'},
    halcove:{n:'Halibut Cove',ic:'🏘️',run:35,sock:.8,pink:1.0,chum:.5,reef:.14,crowd:.35,line:'stream',lineTxt:'the 500 yards off a salmon stream’s mouth',
      d:'Quieter water across the bay. Fewer boats, fewer fish, an easy beach to set on.'},
  };
  D.SPOT_IDS=Object.keys(D.SPOTS);
  // skippers you can crew for (fictional): how they fish
  D.CAPTAINS=[
    {name:'Arne Halvorsen',boat:'Kachemak Rose',style:'patient',sk:.95,line:'Forty seasons in the bay. Waits for a real school, never cuts in, never sets near a line.'},
    {name:'Della Moseley',boat:'Sea Bear',style:'hard',sk:1.08,line:'Fishes hard and loud. First on the hook-off, last to pick up, rough on greenhorns.'},
    {name:'Pete Kvasnikoff',boat:'Grewingk',style:'steady',sk:1.0,line:'Grew up in Port Graham. Quiet on the radio, good with a skiff, home for dinner when he can be.'},
  ];
  D.OWN_BOAT='Tutka Belle';                    // the 50-ft limit seiner and skiff you charter to run your own (fictional)
  // what you see on the water, best to worst (the read is only as good as your eye)
  D.SIGNS=[
    [1.25,'Jumpers everywhere and a push of fish finning down the beach.'],
    [0.95,'Steady jumpers off the point, and the odd fin showing.'],
    [0.65,'A jumper now and then. Something is there.'],
    [0.40,'One tired jumper, and a lot of glassy water.'],
    [0,'Nothing showing.'],
  ];
  // what the session reports for a host that shows it (Guide Master picks an illustration): [{ id, sev }]
  D.EVENTS=['dawn_set','full_bag','tender','water_haul','torn_net','skiff_wheel','injury','injury_bad','stay_in','weather_wait','cut_in','corked','line_cite','jackpot','missed_boat'];
  // run timing (day of the year): stocked-lake and hatchery sockeye peak around mid-July, pinks around the end of July
  D.sockAvail=dy=>dy<160||dy>235?0:.12+.88*K.util.gauss(dy,192,18);
  D.pinkAvail=dy=>dy<185||dy>245?0:K.util.gauss(dy,214,13);
  D.chumAvail=dy=>dy<170||dy>240?0:.6*K.util.gauss(dy,205,15);
})(Seine);
