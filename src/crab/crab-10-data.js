// ============================================================
//  CRAB, part 1: data. Rules, prices, odds and words.
//  Facts (checked late 2026; see README.md "Facts and sources"): Kachemak Bay and Cook Inlet Tanner crab is a noncommercial
//  (sport) fishery from Oct 1 to the end of February by permit, males only, 4½ inches across the shell with the spines, whole crab
//  only off the boat, and it opens only in winters when the survey finds enough legal males (it stayed shut from 2012 to 2017).
//  A Dungeness subsistence fishery reopened in parts of Cook Inlet in July 2025, the first in decades: southern Kachemak Bay
//  around Seldovia, Port Graham and Nanwalek, Alaska residents with a permit, males only, at least 6½ inches across, one pot a
//  person and at most three on a boat, with a harvest report. Pots carry a buoy marked with your name and address, two escape rings
//  and a rot cord (a biodegradable escape panel), and nobody may pull another person's pot. Crab from a sport, personal-use or
//  subsistence permit is for the table, never for sale.
//  Prices, odds and shares are estimates for play, not quotes.
// ============================================================
(function(C){
  'use strict';
  const D={};C.data=D;

  // ---- the summer pot (Dungeness, subsistence) ----
  D.POT={
    kit:240,          // a Dungeness pot, a buoy and shot line (estimate)
    bait:12,          // herring and a few salmon carcasses from the cleaning table
    skiff:70,         // a buddy's skiff and its gas, when you don't run your own charter boat out of Homer
    ownFuel:25,       // your own charter boat's gas across the bay and back
    setMin:150,pullMin:150,          // minutes: run across the bay, set (or pull, measure, sort, rebait) and run back
    setEnergy:6,pullEnergy:8,
    afternoon:720,late:1260,         // the earliest and latest start (noon to 9 PM): a free afternoon or evening, not a guiding morning
    minWidth:6.5,                    // inches across the shell, males only
    pOpen:.75,                       // the chance the subsistence fishery is open in a given summer (a young fishery: some years it may not open)
    lostBase:.04,lostPerDay:.03,     // a lost pot: a prop through the line, a big tide; more likely the longer it soaks past three days
    mean:[0,2.2,3.0,3.3,3.1,2.6,2.1],  // legal males kept for a soak of 0..6+ days (bait runs out after a few days)
  };
  // ---- the winter Tanner pot (noncommercial, Oct 1 to Feb 28) ----
  D.TANNER={
    days:1,                 // one free day (set at first light, pull before dark)
    bait:12,skiff:90,       // a winter skiff from the harbor and its gas
    minWidth:4.5,           // inches across the shell, spines included, males only
    pOpen:.45,              // the chance the bay opens this winter (it needs a survey with enough legal males)
    limits:[2,3,3,4,5],     // the permit's limit when it opens (it changes with the survey)
    energy:10,
  };
  // what a crab gives the household: meals in the freezer (a cooked Dungeness or Tanner is about one meal of meat)
  D.MEALS_PER_CRAB=1;
  // a crab feed for the dock crowd and your next parties: goodwill, not money
  D.FEED={rep:1,wom:2,minCrab:3,energy:3};

  // ---- the winter deckhand job ----
  D.JOB={
    days:7,                 // free days of the winter it takes (the trip, the flights, the gear-up)
    failDays:2,             // days lost when nobody hires you
    air:1100,               // Anchorage to Dutch Harbor and back (estimate)
    lodging:150,            // a night in Unalaska while you walk the docks
    license:165,            // the commercial crewmember license (resident; estimate)
    gear:420,               // rain gear, boots, gloves, a knife (once; you keep them)
    // a full crew share for one trip, by the winter's outlook (estimates: the boat's take, less fuel, bait and food, split by shares)
    share:{good:8000,fair:6000,thin:3600},
    outlook:[['good',.4],['fair',.42],['thin',.18]],
    greenhorn:.5,           // a first-timer's share of a full share
    hand:[.5,.75,.85],      // by trips done before: greenhorn, second winter, after that
    pClose:{good:.1,fair:.2,thin:.35},   // the season (or the boat's quota) ends early
    closeCut:.55,
    hire:{docks:{good:.6,fair:.48,thin:.28},friend:{base:.3,rep:.005}},
    skipper:{solid:{n:'a steady skipper',noPay:.02},rough:{n:'a hard-driving skipper',noPay:.1},shady:{n:'a skipper with a reputation',noPay:.35}},
    paidPart:.35,           // what a crewman sees when the skipper "pays later"
    injury:{base:.06,minor:{cash:350,sore:3},major:{cash:1800,sore:6,cut:.6},pMajor:.3},
    energy:-15,
    boat:{share:.055,price:4.5},   // a full crew share is about this part of the boat's catch value; crab at the dock, a pound (estimates):
                                   // they size the boat's delivery, which a host with its own buyer out west may buy at its own price
  };
  D.EVENTS=['pot_set','pot_pull','pot_lost','crab_feed','tanner_measure','tanner_closed','job_hired','job_greenhorn','suit_drill','hauling','sorting','heavy_seas_ice','job_payout','job_injury','job_not_paid','job_closed'];

  // the winter's outlook, in words (general on purpose: quotas change every fall)
  D.OUTLOOK={
    good:'The fall survey was kind: the Bering Sea Tanner quota is big this winter and boats out of Dutch Harbor are looking for crew.',
    fair:'Middling quotas this winter. Some boats are hiring, most already have their crew.',
    thin:'Thin quotas this winter, and some fisheries stayed shut after the fall survey. Few boats are hiring, and the ones that are can be picky.',
  };
  D.LORE=[
    'Crab boats out west run monthly drills: abandon ship, fire, man overboard. The Coast Guard expects it, and so does every crewman who wants to come home.',
    'Since the crab fisheries were rationalized in 2005, boats fish their own quota at their own pace: fewer boats, longer seasons, smaller crews.',
    'Ice on the rails and the wheelhouse makes a boat top-heavy. When it builds, everyone grabs a bat or a mallet and beats it off.',
    'An immersion suit buys time in 38-degree water. Practice until you are in it, zipped and hooded, in under a minute.',
  ];
})(Crab);
