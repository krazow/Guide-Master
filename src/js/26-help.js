// ============================================================
//  GUIDE MASTER: the Help sheet ("❓ Help!" on the title screen, ⚙️ Settings → Help; 08-settings.js calls helpModal()).
//  One bottom sheet: a table of contents (tap a topic to jump to it), then one short section per topic, in the order a new
//  player meets things. Each section is [icon, title, html, anchor]: a one-line summary (.help-sum), then a few bullets.
//  Works before a game exists and mid-game. Every number here is checked against the game's own constants in tests/help.test.js.
//  Write for players: short sentences, plain words, no code terms.
// ============================================================
const HELP=[
  ['🧭','Getting started',`<p class="help-sum">Run a fishing-guide business out of Soldotna, Alaska, for a <b>2-, 5- or 10-year career</b>.</p><ul>
    <li>Each season you guide <b>two weeks</b> yourself. Season 1 is the July peak of the sockeye run. Between seasons comes the off-season: bills, upgrades and planning.</li>
    <li>Time moves only when you act. Tap an action on the <b>🧭 Here</b> tab, or open <b>Go somewhere</b> to drive to another place.</li>
    <li><b>Energy</b> drops through the day and with every trip. <b>Go to bed</b> at the shop to get most of it back; a nap or a diner breakfast helps a little. Under 30, your trips catch fewer fish.</li>
    <li>The alarm rings at 5:00 AM (change it at the shop). <b>⏳ Wait until…</b> skips ahead. Stay up past midnight and you fall asleep in the truck and wake up tired.</li>
    <li>Tabs: <b>🧭 Here</b> (what you can do), <b>📅 Bookings</b>, <b>🐟 Fish</b> (conditions), <b>🏠 Home</b> (the cabin), <b>📖 Regs</b>, <b>📋 To-do</b> (today’s list and your own) and <b>📜 Log</b>.</li>
    <li>The top bar shows cash, your ★ rating (reputation is the bar under it), energy, boat, fuel, food and your record.</li>
    <li>A career ends early with <b>3 active citations</b>, <b>reputation at 0</b> or <b>more than $2,000 in debt</b>.</li></ul>`,'start'],
  ['🛶','Your first trip',`<p class="help-sum">Be at the launch on time, pick a spot, make the calls through the day, then get paid at the dock.</p><ul>
    <li>Your schedule is on <b>📅 Bookings</b>. Sockeye, silver and June king trips leave the <b>Lower Kenai launch</b>, trout floats leave <b>Cooper Landing</b>, halibut charters leave the <b>Homer Spit</b>.</li>
    <li>The party shows up an hour early. Every minute you’re late costs goodwill, and after 90 minutes they leave (and post a review).</li>
    <li><b>At the launch</b> you pack the cooler and pick a spot. The day then runs in <b>stretches</b>. Before each one you see the clock, the tide, yesterday’s sonar count, the boat traffic, the wind and the bite.</li>
    <li><b>Your moves:</b> stay put, switch tactics (5 minutes), run to another spot (time and gas), stop for shore lunch, or on the last call head in early.</li>
    <li><b>Dilemmas</b> come up along the way. The answers are shuffled and none is marked. Some are judgment calls; others tempt you to bend a rule. There is always a legal answer, and it costs something.</li>
    <li><b>Back at the dock</b> you see the catch, the fare, the tip, any refund and the party’s written review. The whole trip is one sheet that changes in place.</li></ul>`,'trip'],
  ['🎯','Clients',`<p class="help-sum">Every party comes for something. Give them that day and the tip follows.</p><ul>
    <li>You see what they want on the booking request and at the launch: <b>🥩 a full cooler</b>, <b>🏆 one big fish</b>, <b>🧒 action and an early lunch for the kids</b>, <b>📸 scenery and wildlife</b>, <b>🪰 fish on a fly</b>, <b>🌱 coaching and easy water</b> or <b>🤢 calm water</b>.</li>
    <li>Fit the day to the party: the walkway and a shore lunch for a family, the long run for trophy hunters, streamers for fly purists, sheltered water for green faces.</li>
    <li>Happy clients tip. Unhappy ones want part of the fare back.</li>
    <li>Each review is 1 to 5 stars. A party with a great day may become a <b>regular</b> and book you again next season; if they don’t offer, hand them your card at the dock.</li>
    <li>Over the years you may meet a rival guide, a family that comes back every summer and the local fish and game advisory committee.</li></ul>`,'clients'],
  ['🐟','Fish, weather and timing',`<p class="help-sum">Read the water before you launch. The right spot on the right day beats the usual spot.</p><ul>
    <li>The <b>🐟 Fish</b> tab shows the weather, river level, tides, the odds by place and species, where to fish today and when each run arrives.</li>
    <li>Look at it (or <b>scout the river</b> from the lower launch) and the spot buttons show a <b>Hot, Good, Fair or Poor</b> read. Scouting gives the exact read.</li>
    <li>Fresh reds ride the flood tide in. Boats crowd the popular drifts by mid-morning. The wind builds in the afternoon. Halibut like slack water.</li>
    <li>The daily <b>sonar count</b> (at the shop or on 📖 Regs) tells you how many sockeye came in yesterday. Pinks run in even years.</li>
    <li>With no clients booked, <b>Take the boat out</b> to fill your freezer and learn the water. Alaska residents can also dipnet reds at the river mouth, July 10 to 31.</li>
    <li>Skill grows with every trip, scouting run and ADF&amp;G office visit, and some of it rusts away each winter.</li></ul>`,'fish'],
  ['📖','Rules and the law',`<p class="help-sum">Play it by the book. Bending a rule can pay today, but it costs you over a career.</p><ul>
    <li>The <b>📖 Regs</b> tab lists your licenses and every rule for the week you’re guiding. Season 1 follows the real 2026 rules; later seasons change them.</li>
    <li><b>Below Skilak Lake, May 1 to July 31:</b> no fishing from guide boats on Sundays and Mondays, and only 6 AM to 6 PM on other days. In July, no more than five people in a guide boat while fishing.</li>
    <li><b>June 20 to August 15 below Skilak:</b> one single hook, no bait, while kings are restricted. Kings are closed in 2026; later years may allow catch-and-release or one a day.</li>
    <li>Limits are per person and change by emergency order. Guides don’t fish with clients aboard. Dipnetting is for Alaska residents only.</li>
    <li><b>Paperwork:</b> fill out your logbook at the shop after every trip, before bed. Keep your <b>first-aid/CPR card</b> current: classes in Soldotna Monday, Tuesday and Thursday, 1 to 4 PM (join by 1:30); a card lasts two years.</li>
    <li>Troopers check boats at the launches. Your first minor offense each season is a warning. After that it’s a <b>citation</b> and a fine, and each citation on your record makes the next fine bigger.</li>
    <li>Every rule you break this season makes the next one likelier to be caught, and other guides talk. A citation is public record: booked clients may cancel. Citations drop off after the next season; <b>three active</b> and you lose your permit.</li></ul>`,'rules'],
  ['💵','Money and score',`<p class="help-sum">Trips pay the bills. Your grade is your score per season.</p><ul>
    <li>A trip pays its <b>booked fare</b>, plus a <b>tip</b> that grows with happiness (nothing at so-so, up to 30% of the fare on a great day), minus any refund (and a $15 launch fee on the lower river).</li>
    <li>You pay overhead every night, plus fuel, tackle, food, repairs and fines. Winter brings license, insurance and living bills.</li>
    <li>The weeks you don’t guide still earn: the off-season settles the rest of the summer, and it follows how happy your clients were, not only how many trips you ran.</li>
    <li>The <b>score</b> adds up net cash, the rest of your last summer, most of what you spent on boats and permits, your reputation and your trips. Citations cost points; a clean record earns a bonus. The end screen shows every line.</li>
    <li><b>Grades per season:</b> A 62,000, B 55,000, C 44,000, D 27,000, F below. A career that ends early is an F.</li>
    <li>Difficulty never changes the cutoffs. The same play scores about 5–15% less on Combat Season, about half a grade (A and B careers turn mostly B, some C), and about 17% more on Rookie Season, a full grade (B and C careers turn A and B). Prices here are for Licensed Guide.</li></ul>`,'money'],
  ['⭐','Reputation and the ★ rating',`<p class="help-sum">Your rating is the average of your last 20 reviews. Keep it high and work finds you.</p><ul>
    <li>It sits in the top bar. While you have few reviews, your reputation fills in. The bar under it is your reputation: at 0, nobody books you.</li>
    <li>A review is 5 stars for a great day, 4 for a good one and down from there.</li>
    <li><b>★4.5</b> with 10+ reviews: you’re a <b>top-rated guide</b>, and parties tip more on a good day.</li>
    <li><b>★4.7</b> with 12+ reviews: a <b>magazine feature</b>, once a career. The phone rings with extra trips that week.</li>
    <li>A season that averages <b>★4.7</b>: a <b>lodge partnership</b> that sends you extra parties every season (for a 10% fee), until your rating falls under <b>★4.3</b>.</li>
    <li>Under <b>★2.5</b>, fewer people book. Reputation also drifts back toward the middle each winter.</li></ul>`,'rating'],
  ['📆','The season',`<p class="help-sum">Two weeks of guiding a year. You pick which ones from your second summer on.</p><ul>
    <li>In the off-season, <b>📆 Your weeks</b> lets you choose two: <b>June kings</b> (or rainbows and halibut when kings are closed), either <b>July peak</b> week, <b>August silvers</b> or <b>September rainbows</b>. Dates, rules, runs and trips follow the week.</li>
    <li>The <b>☀️ morning report</b> gathers last night, overnight news, events, reminders and requests in one pop-up. Decisions that can’t wait follow it.</li>
    <li><b>Booking requests</b> wait at the top of 📅 Bookings for two days (a dot on the tab). Book or decline there; a bad date can often be moved. <b>Return calls</b> at the shop once a day for more.</li>
    <li><b>Season goals:</b> three a season, on 📅 Bookings. Reach them for a bonus, reputation or word of mouth on the season’s last night.</li>
    <li><b>Big days:</b> some requests come with a target, like <i>a 30-pound halibut for Dad’s 70th</i>. Meet it for a bonus.</li></ul>`,'season'],
  ['⛽','Boat, fuel and food',`<p class="help-sum">Keep the boat running, the tank full and food in the house.</p><ul>
    <li><b>Boat:</b> service it at the shop. A worn boat breaks down and clients notice. It warns you at 40, 20 and 10. At 0 it’s out of service until a $2,400 major repair; a $600 emergency patch (at 10 or less) or a $600 loaner (at 0) gets a booked trip out.</li>
    <li><b>Fuel:</b> a sockeye trip burns about 9 gallons, a silver trip about 11. Fill up only at the <b>Kenai Harbor fuel dock</b>, 6 AM to 10 PM, or haul gas home in cans and fuel up at the shop.</li>
    <li>Run dry and the Coast Guard tows you in: half the fare back to the clients, a $102 harbor assist and a hit to your reputation. Gas stored over winter needs stabilizer or it goes stale.</li>
    <li><b>Tackle:</b> restock in Soldotna. Out of tackle, trips go badly. <b>Rig tomorrow’s gear</b> at the shop for a better trip.</li>
    <li><b>Food:</b> you eat three meals a day from the pantry, fridge and freezer. Stock up in Soldotna. Missed meals cost energy, and a hungry guide has grumpy clients.</li>
    <li>Before each trip, <b>pack the cooler</b>: your lunch keeps you going, and snacks, lunch kits or a shore lunch of freezer reds make clients happier. On the all-day trout float and halibut charter, clients with no lunch are unhappy.</li>
    <li>Storms can knock the power out and spoil food. A <b>generator</b> (Home supplies in Soldotna) keeps the freezer going. Keep it and the gas outside.</li></ul>`,'boat'],
  ['🏠','Your cabin',`<p class="help-sum">The <b>🏠 Home</b> tab shows your cabin’s condition, 0 to 100. Keep it up and you sleep well.</p><ul>
    <li>It leaves you alone for your first week. After that it wears down slowly, and jobs come up. <b>Never more than two</b> show at once.</li>
    <li>Every job has <b>three ways</b>: do it yourself (time and energy), pay someone (cash) or skip it (a risk).</li>
    <li>Summer jobs: bear bins and fish waste, the generator, a garden (and a fence for the moose), the fish station. Off-season: heat, pipes and detectors in the fall, a cold snap and heavy snow, then spring breakup (driveway, well, septic).</li>
    <li>In good shape, you wake rested. Run down, you sleep badly, repairs land on guiding mornings, and a booked party can cancel.</li>
    <li>Do-it-yourself jobs in the off-season use the same 10 free days as winter camping.</li>
    <li>Trouble costs money, days, energy or reputation, but the cabin <b>never ends your career</b>. Never run a generator indoors.</li></ul>`,'cabin'],
  ['❄️','Off-season and winter camping',`<p class="help-sum">Between seasons you plan: bills, upgrades, your weeks, the cabin, camping and work.</p><ul>
    <li>The off-season summary shows last summer, the winter bills, next year’s rules and run forecast, and your record. Tap <b>Open bookings</b> when you’re ready.</li>
    <li><b>Upgrades:</b> a new motor, a new sled, a drift boat, marketing, a winter course, higher rates (more per trip, fewer bookings: the first step is cheap, the third is not), your own Homer charter permit and, later, an assistant guide, guest cabins or a riverfront lot.</li>
    <li>You have <b>10 free days</b> each winter for up to 3 camping trips and 2 winter jobs.</li>
    <li><b>Camping:</b> pick one of ten spots within 100 road miles, a month, company, where you sleep and what to pack. <b>Ice fish</b> (you need a fishing license, and licenses run by calendar year), ski, snowshoe, track wildlife, scout next season’s water or watch the northern lights.</li>
    <li>Each night has a 50% chance of an encounter, good or bad. What you pack and where you sleep change the odds.</li>
    <li>Each winter, skill rusts a little, warnings reset and old citations drop off. Renew your first-aid card if it’s due.</li></ul>`,'winter'],
  ['🧑‍🤝‍🧑','Growing the business',`<p class="help-sum">From your third off-season you can build an outfit, if you want to.</p><ul>
    <li>Hire up to <b>three guides</b> (reputation 55, 65 and 75 for the first, second and third) and buy up to <b>two more boats</b>: a used jet sled or a second drift boat.</li>
    <li>Guides take parties on days you’re booked, get calls of their own, and you can hand them one of your trips on the <b>Outfit</b> page of 📅 Bookings. Each needs a free boat. They never run Homer halibut.</li>
    <li>Their trips show up in the morning report. Their reviews name them and <b>don’t count</b> toward your own ★ rating.</li>
    <li>They’re paid per trip, get better every season and expect raises. Underpaid or overworked, they quit. Each needs licenses, and a guide’s citation goes on <b>your</b> record.</li>
    <li>An outfit run well earns a bit more. One that grows too fast can lose money.</li></ul>`,'outfit'],
  ['🏆','Trophy wall and memories',`<p class="help-sum">Your career’s highlights, in the <b>📜 Log</b> tab: switch to <b>🏆 Trophy wall</b>.</p><ul>
    <li>Your biggest fish of each species, your firsts (first king, first barn-door halibut over 100 lb, first limit-out, first five-star review), standout clients and postcards from past parties.</li>
    <li>A trophy, a king, a limit-out or a first fish gets a short moment on the trip and a <b>catch card</b> at the dock that you can save as a picture.</li>
    <li>When a new season starts, a past client or two may send a postcard in the morning report.</li></ul>`,'wall'],
  ['🧓','Walt, your mentor',`<p class="help-sum">On a new career’s first trip, Walt Brandvold, an old Soldotna guide, rides along.</p><ul>
    <li>He says one thing at a time: how to read the conditions, how to choose a move, what the party came for, and how to handle a rule dilemma.</li>
    <li>Tap <b>I’ve got this</b> to send him ashore.</li>
    <li>Want him back? With a game going, tap <b>Ride with the mentor again</b> below, and he joins your next trip.</li></ul>`,'mentor'],
  ['🖼️','Pictures and settings',`<p class="help-sum">Make the game look, sound and pop up the way you like in <b>⚙️ Settings</b>.</p><ul>
    <li><b>🖼️ Illustrations</b> show at the moments that matter: the cabin, the launch, the river, the morning report, storms and camping. Everyday scenes rest a few days so they don’t repeat. Turn them off to keep the drawn scenes and save data.</li>
    <li><b>🔔 Catch chime</b> plays for trophies and firsts. It’s off until you turn it on.</li>
    <li><b>🔔 Event pop-ups</b> are off: events show as small tiles and lines in the Log. Turn them on for an OK pop-up each. The morning report always shows.</li>
    <li><b>🛶 Show every trip step</b> gives each choice on a trip its own pop-up.</li>
    <li><b>♿ Accessibility:</b> bigger text, high contrast and reduce motion. Also: 💡 tips, 🔊 sound and three 💾 save slots.</li>
    <li>On a computer, number keys press buttons, a tab’s first letter opens it, <b>Esc</b> closes a pop-up and <b>?</b> lists the shortcuts.</li></ul>`,'settings'],
  ['💡','Tips for a good career',`<p class="help-sum">A few habits that pay, season after season.</p><ul>
    <li>Read the 🐟 Fish tab or scout before you pick a spot.</li>
    <li>Fit the day to the party, and pack them a lunch.</li>
    <li>Rig tomorrow’s gear, log every trip and get to bed.</li>
    <li>Keep the boat serviced, the tank full and food in the house.</li>
    <li>Answer requests, and hand happy parties your card.</li>
    <li>Pay the legal price in a dilemma. It’s cheaper than the fine.</li>
    <li>Raise your rates carefully: the third step costs more bookings than it’s worth.</li></ul>`,'tips'],
  ['📲','Install the app and play offline',`<p class="help-sum">Install Guide Master on your phone or computer and it plays like an app, even with no signal.</p><ul>
    <li>Tap <b>Install</b> in the bar at the top of the title screen, or <b>📲 Install app</b> under the big button. On Android, Chrome and Edge your browser asks to install; other browsers show their menu steps.</li>
    <li>On an iPhone or iPad it opens <a href="install/ios.html">a short how-to with a video</a>: in Safari, tap Share, then <b>Add to Home Screen</b>, then <b>Add</b>.</li>
    <li>Open it once from the new icon while online. After that it plays offline.</li>
    <li>On iPhone and iPad the Home Screen app keeps its own saves, so play from the icon. Use <b>🔁 Transfer a saved game</b> to move a game there or to another device.</li></ul>`,'install'],
  ['🪢','Commercial gillnetting',`<p class="help-sum">From your second off-season you can fish Cook Inlet sockeye for the fish ticket, on a setnet beach or a drift boat.</p><ul>
    <li>Plan it in the off-season under <b>🎣 Commercial & crab</b>: crew for a share first, then lease a setnet site or a drift permit and boat. Later you can buy your own drift permit and boat.</li>
    <li>Openers are regular periods on <b>Mondays and Thursdays</b>, plus extra periods by emergency order. ADF&amp;G announces each one the morning before; see <b>📅 Bookings</b> and the morning report.</li>
    <li>An opener is a whole day. Start it from <b>🧭 Here</b> in the early morning. On a day with trips booked you hand them to a guide, cancel them, or guide instead.</li>
    <li>The day runs in a few calls: when to set on the tide, pick now or let them soak, bleed and ice the fish, and the tender or the dock. A drift boat also picks its drift line and fights the tide.</li>
    <li>The setnet beach is tied to the Kenai kings. In a year kings are closed it starts the summer closed, and only a huge sockeye run might reopen it. Money paid up front is gone if it never opens.</li>
    <li>Rules have teeth: nets fishing after the close, or a drift across the corridor line into closed water, can mean a citation on your record. Seals, torn nets and wind cost fish.</li>
    <li>With a lease or your own boat, a partner fishes the openers you guide through, for a share. A survival suit is cheap insurance on the water.</li></ul>`,'gillnet'],
  ['💬','Feedback',`<p class="help-sum">Ideas, bugs, or a rule or fact we got wrong? Tell the developer.</p><ul>
    <li>Tap <b>Send feedback</b> below, on the title screen or in ⚙️ Settings.</li>
    <li>Add your email if you’d like a reply. If you’re offline, it’s sent the next time you’re online.</li></ul>`,'feedback'],
];
const helpId=k=>'help-'+k;
// tap a contents link: scroll the sheet to that section and move focus to its heading (keyboard and screen readers follow along)
window.helpJump=k=>{
  const el=document.getElementById(helpId(k));if(!el)return false;
  const rm=document.documentElement.classList.contains('rm')||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  try{el.scrollIntoView({block:'start',behavior:rm?'auto':'smooth'})}catch(e){el.scrollIntoView()}
  const h=el.matches('h3,nav')?el:el.querySelector('h3');if(h)try{h.focus({preventScroll:true})}catch(e){}
  return false;
};
function helpBody(){
  const toc=`<nav class="help-toc" id="${helpId('toc')}" tabindex="-1" aria-label="Help contents"><b>Contents</b><ul>${HELP.map(([ic,h,,k])=>
    `<li><a href="#${helpId(k)}" onclick="return helpJump('${k}')">${ic} ${h}</a></li>`).join('')}</ul></nav>`;
  const secs=HELP.map(([ic,h,t,k])=>`<section class="help-sec" id="${helpId(k)}" aria-labelledby="${helpId(k)}-h">
    <h3 id="${helpId(k)}-h" tabindex="-1"><span aria-hidden="true">${ic}</span> ${h}<a class="help-up" href="#${helpId('toc')}" onclick="return helpJump('toc')" aria-label="Back to contents" title="Back to contents">↑</a></h3>${t}</section>`).join('');
  return toc+secs+'<p class="help-note">Season 1 follows a simplified version of the real 2026 Kenai rules; later seasons invent plausible changes. This is a game: always check the current regulations and emergency orders at adfg.alaska.gov before you fish.</p>';
}
function helpModal(){
  modal('❓ Help! How to play Guide Master',helpBody(),
    [{l:'Got it',fn:()=>{}},...(typeof mentorCanReplay==='function'&&mentorCanReplay()?[{l:'🧓 Ride with the mentor again',s:'Walt rides along on your next trip and talks you through it.',fn:()=>{const ok=mentorAgain();if(ok&&document.querySelector('.title'))setTimeout(()=>modal('🧓 Walt’s coming along',`<p>He’ll ride along on your next trip. Tap <b>Continue</b> to get going.</p>`,[{l:'OK',fn:()=>{}}]),0)}}]:[]),{l:'💬 Send feedback',s:'Questions, ideas or bugs: tell the developer.',fn:()=>feedbackModal(helpModal)}]);
}
window.helpModal=helpModal;
