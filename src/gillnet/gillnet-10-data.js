// ============================================================
//  GILLNET, part 1: the numbers and the words.
//  Prices, shares, leases, fisheries, the calendar, citations and the events the host can illustrate. Facts are simplified
//  from recent Upper Cook Inlet seasons (see README.md, "Facts and estimates"); money is an estimate for play, not a quote.
// ============================================================
(function(G){
  'use strict';
  const D={
    LB:6,                                 // pounds in an average Cook Inlet sockeye
    // the ex-vessel price a pound: drawn once a season between lo and hi (Upper Cook Inlet sockeye averaged about $1.70 in 2025)
    PRICE:{lo:1.35,hi:1.95,bled:.20,dock:.10,soft:.15},   // bled & slush-iced bonus; trucked/run to the dock; long-dead fish docked
    // the two fisheries. fish: sockeye a typical opener at the peak of an average run (one site's three nets, or one drift boat)
    set:{n:'east-side setnet site',ic:'🪢',fish:240,open:625,close:815,hours:[420,1140],
      crew:.10,leaseUp:2800,permit:.20,hire:.10,ice:35,gas:15,energy:-20,end:1230},
    drift:{n:'drift gillnet boat',ic:'🚤',fish:280,open:619,close:815,hours:[420,1140],
      crew:.12,leaseUp:6000,lease:.15,deck:.12,gal:45,ice:60,energy:-22,end:1260},
    // owning a drift permit and boat (a limited-entry permit and a used 32-foot gillnetter)
    OWN:{permit:32000,boat:58000,winter:4200,deprec:.08,sell:.85},
    REST:{share:.4,set:15,drift:16},      // the rest of the summer: your partner or hired skipper's openers, and the share you keep
    SUIT:450,CREWLIC:60,                  // an immersion (survival) suit; the commercial crewmember license
    REPAIR:[350,900],                     // mending a torn net, or a new panel
    SEINE_WAGE:180,                       // a day helping on an experimental beach seine (cost-neutral: sales only cover costs)
    UNLOCK:2,                             // seasons played before the planner offers it (the second off-season)
    SCA:25,                               // knots: a small-craft advisory; at or above it the opener can be sat out
    // ADF&G areas and statuses, as the host shows them
    AREA:{beach:'the east-side beach',district:'the whole Central District',corridor:'the corridor along the east-side beaches (the Expanded Kenai and Kasilof Sections)',
      area1:'Drift Area 1, south of Kalgin Island',west:'the west side of the inlet'},
    ST:{open:'open',restricted:'restricted',closed:'closed',reopen:'reopened by emergency order',extra:'extra period by emergency order'},
    // citations (the host turns them into its own; fines before its multipliers)
    CITE:{
      late:{what:'set gillnets left fishing after the period closed',fine:1000},
      line:{what:'drift gillnetting in closed waters across the corridor line',fine:1500},
      exam:{what:'a fishing vessel with no current Coast Guard dockside exam decal',fine:300,minor:true},
    },
    // things that happen, for the host's pictures: {id, sev}
    EVENTS:['gn_closed_morning','gn_low_tide_site','gn_full_net','gn_seals','gn_kelp','gn_torn_net','gn_tide_rip','gn_corridor_line','gn_corked',
      'gn_tender','gn_dock','gn_bar','gn_swamped','gn_beach_seine','gn_stay_in','gn_partner'],
    // who you work for, and who works the days you don't
    SKIPPERS:{set:['Marge Ostrander','the Kalifornsky Johnsons','Dee Hollier'],drift:['Ray Tikhonov','Carla Weiss','Benny Moller']},
  };
  // the roles a summer can be planned around
  D.ROLES={
    'set:crew':{kind:'set',role:'crew',ic:'🪢',l:'Crew on a family setnet site',s:'Pick fish on the beach for a share of the catch. No money up front.'},
    'set:lease':{kind:'set',role:'lease',ic:'🪢',l:'Lease a setnet site and permit',s:'Your own nets on the beach, a share to the permit holder, a hand to help.'},
    'drift:crew':{kind:'drift',role:'crew',ic:'🚤',l:'Deckhand on a drift boat',s:'Run out of Kenai with a skipper for a crew share.'},
    'drift:lease':{kind:'drift',role:'lease',ic:'🚤',l:'Lease a drift permit and boat',s:'Run the boat yourself; the owner takes a share; you pay fuel and a deckhand.'},
    'drift:own':{kind:'drift',role:'own',ic:'⚓',l:'Fish your own drift permit and boat',s:'Your boat, your permit, your fuel bill. A deckhand takes a share.'},
  };
  G.data=D;
})(Gillnet);
