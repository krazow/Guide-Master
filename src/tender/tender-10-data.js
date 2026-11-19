// ============================================================
//  TENDER & PROCESSOR, part 1: the content.
//  Areas, tenders, plants, products, markets and the numbers behind them. Every price is a 2026 estimate for play (see the README's
//  Facts and estimates), scaled by the host's cost multiplier where it says so. The Help sheet quotes some of these: it reads them
//  from Tender.data.K, so the words and the game can't drift apart.
// ============================================================
(function(T){
  'use strict';
  const K={
    LEASE_REP:50,           // reputation needed to charter a tender
    BUY_REP:55,             // reputation needed for a bank loan, or to buy a tender or plant
    DOWN:.3,                // the least you put down when you borrow (the bank lends the rest)
    RATE:.09,               // the bank's yearly interest
    TERM:7,                 // years to pay a loan back
    MAX_TENDERS:2,          // tenders you can run at once
    SELL_TENDER:.85,        // what a tender fetches when you sell it, of its value
    SELL_PLANT:.75,         // what a plant fetches (less in a weak market year)
    SELL_WEAK:.65,
    FIRE:.55,               // a forced sale at the dock auction
    SCORE:.9,               // assets count in the score at nine tenths of their value
    NO_CREDIT:3,            // seasons a forced sale keeps the bank from lending again
    CREW_DAY:1,             // free winter days it takes to hire next season's plant crew yourself
    AGENCY:.2,              // an agency hires a crew you didn't: this much more, and a lean crew
    SPREAD:{sockeye:.12,coho:.1,chum:.07,pink:.05,crab:.25},   // what a plant pays a tender over the going price, a pound, for chilled fish
    QBONUS:{sockeye:.06,coho:.05,chum:.02,pink:.01,crab:0},     // the most a load earns for top quality (bled, cold), a pound
    SKIPPER:550,            // a hired skipper's day on an opener you don't run yourself
    DECK:2,DECK_DAY:320,    // deckhands and their day on an opener
    BURN:{uci:70,lci:95},   // gallons of diesel an opener burns (anchored, pumping, the run to the plant)
    PLANT_ENERGY:3,         // your energy each played morning you own a plant (calls with the plant manager)
    SELF_ENERGY:25,         // your energy for a day running the tender yourself
  };
  const AREAS={
    uci:{n:'Upper Cook Inlet',short:'Kenai/Kasilof',port:'Kenai',ic:'🌊',fleet:'drift gillnetters',where:'at anchor off the Kenai River mouth',
      d:'The Central District drift fleet on its Monday and Thursday periods, and the east-side setnets when the Kenai kings allow it.',days:50},
    lci:{n:'Lower Cook Inlet & Kachemak Bay',short:'Homer',port:'Homer',ic:'⛰️',fleet:'seiners',where:'in Kachemak Bay off the Homer Spit',
      d:'Seiners on the pink and sockeye openings across Lower Cook Inlet, and Kachemak Bay crab when a season opens.',days:55},
    west:{n:'Out west',short:'a crab port out west',port:'a crab port out west',ic:'🦀',fleet:'crab boats',where:'tied up at a crab port out west',d:'Winter crab, far from home.',days:0},
  };
  // the tender ladder: charter one for a season, then own one
  const VESSELS={
    lease:{ic:'⚓',n:'Charter an older 58-ft tender for the season',short:'chartered tender',cost:28000,hold:100000,cond:60,
      d:'A bareboat charter of a tired steel tender with a refrigerated seawater (RSW) hold of about 100,000 lb: one season, no haul-out bills. You hire the skipper and deckhands.'},
    used:{ic:'🚢',n:'Buy a used 58-ft steel tender with RSW',short:'your tender',price:340000,hold:120000,cond:65,upkeep:18000,dep:.05,fall:8000,
      d:'A 1980s steel tender with a rebuilt RSW system and a 120,000-lb hold. Haul-out, survey, insurance and moorage run about $18,000 a winter, and a processor charters it for fall work when it’s in shape.'},
  };
  // the plant ladder: lease space, a small shore plant, an old floating processor
  const PLANTS={
    space:{ic:'🏚️',n:'Lease line space at a custom processor',short:'leased line space',lease:34000,cap:22000,crew:12,fixed:14000,can:false,areas:['uci','lci'],
      d:'A corner of someone else’s plant: a heading line, a blast freezer and cold-storage pallets for the season. Your own small crew, their rules.'},
    shore:{ic:'🏭',n:'Buy a small shore plant',short:'shore plant',price:700000,cap:72000,crew:40,fixed:110000,dep:.04,can:true,areas:['uci','lci'],
      d:'An older plant on the water with a bunkhouse, a heading and filleting line, blast freezers, a small canning line and its discharge permit. Bought from a company getting out of Cook Inlet.'},
    floater:{ic:'🛳️',n:'Buy an old floating processor',short:'floating processor',price:1600000,cap:140000,crew:90,fixed:220000,dep:.05,can:true,areas:['uci','lci'],move:25000,
      d:'A converted ship with freezers, a canning line and berths for ninety. It goes where the fish are, and it can winter out west processing crab.'},
  };
  const MIX={
    hg:{n:'Frozen headed & gutted',short:'frozen H&G',d:'The steady product: head, gut, freeze, sell by the container.'},
    fresh:{n:'Frozen H&G plus fresh fish by air',short:'H&G and fresh',d:'The best sockeye and silvers go out fresh through Anchorage at a premium; the rest is frozen. A hot day can spoil a fresh load.'},
    fillet:{n:'Frozen fillets',short:'fillets',d:'More value a pound, but a slower line and a bigger, more skilled crew.'},
    can:{n:'Can the pinks and chums',short:'canned pinks',can:true,d:'Pinks and chums go in the can, sockeye and silvers frozen. Canned pinks keep, but a glut year leaves cases unsold.'},
  };
  // the markets, drawn each season: salmon (sockeye, silvers, chums), pinks and crab move separately
  const LEVELS=['weak','normal','strong'];
  const MKT_P={salmon:[.25,.5,.25],pink:[.3,.5,.2],crab:[.25,.5,.25]};
  const GOING={sockeye:[1.05,1.45,2.05],coho:[.85,1.1,1.4],chum:[.45,.6,.75],pink:[.18,.3,.42],crab:[3.5,4.5,6]};   // a pound over the rail, weak/normal/strong
  const MKT_OF={sockeye:'salmon',coho:'salmon',chum:'salmon',pink:'pink',crab:'crab'};
  // the plant's margin a pound over what a tender's fish cost delivered (the going price plus the tender's spread), after labor, packaging, freezing, storage and freight (frozen H&G)
  const MARGIN={sockeye:[.04,.12,.2],coho:[.02,.1,.17],chum:[0,.05,.09],pink:[-.04,.02,.06],crab:[.2,.45,.7]};
  const MIX_ADD={fresh:{sockeye:.2,coho:.16,share:.12},fillet:{sockeye:.07,coho:.06,chum:.04,speed:.65,crew:1.15},can:{pink:[-.08,.08,.13],chum:[-.03,.07,.11]}};
  const FRESH_FIX={space:6000,shore:18000,floater:30000};   // a fresh program: air-freight contracts, a fresh buyer's fees, boxes and gel ice
  const ENERGY={space:5000,shore:30000,floater:110000};   // diesel for generators and freezers, a season at $5 a gallon
  const FIX_CREW=1800;      // a seasonal plant worker's travel, recruiting and bunkhouse, a season
  // the fleet: pounds a buyer can see on one opener at the run's peak (all buyers together, near your anchorage)
  const FLEET={uci:{sockeye:170000,coho:16000,pink:10000,chum:9000},lci:{sockeye:90000,pink:300000,chum:16000,coho:3000}};
  // the timing of each catch through the summer (day of year)
  const TIMING={uci:{sockeye:[198,9],coho:[224,8],pink:[214,7],chum:[205,11]},lci:{sockeye:[186,13],pink:[214,9],chum:[208,11],coho:[230,9]}};
  // outside supply to a plant (other tenders, docks), pounds a season in an average run, and the east-side setnet deliveries
  const OUTSIDE={space:300000,shore:1600000,floater:3600000};
  const SETNET={space:60000,shore:350000,floater:500000};
  // events
  const EVENTS=['tender_anchor','tender_pump','tender_reject','tender_breakdown','plant_line','plant_inspect','plant_fine','plant_freezer','floater_bay','weak_market','forced_sale','crab_west'];
  T.data={K,AREAS,VESSELS,PLANTS,MIX,LEVELS,MKT_P,GOING,MKT_OF,MARGIN,MIX_ADD,FRESH_FIX,ENERGY,FIX_CREW,FLEET,TIMING,OUTSIDE,SETNET,EVENTS};
  T.EVENTS=EVENTS;
})(Tender);
