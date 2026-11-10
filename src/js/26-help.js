// ============================================================
//  GUIDE MASTER: the "Help!" button on the title screen (08-settings.js calls helpModal()).
//  One bottom sheet with a short section per topic; works before a game exists and mid-game.
// ============================================================
const HELP=[
  ['🎯','The goal','Run a Kenai River guide business out of Soldotna for a <strong>2-, 5- or 10-year career</strong>. Each year you play the two-week July peak; between years the off-season handles bills, upgrades and next season’s bookings. Keep clients happy, your boat running and your record clean.'],
  ['🕐','How a day works','Time moves only when you act. Tap an action on the <strong>🧭 Here</strong> tab, or <strong>Go somewhere</strong> to travel. Guides start early: the alarm is 4:30 AM. <strong>Go to bed</strong> at the shop to end the day; staying up past midnight costs you.'],
  ['🛶','Trips','Your schedule is on the <strong>📅 Bookings</strong> tab. Be at the launch spot by launch time: sockeye and silvers from the <strong>Lower Kenai launch</strong>, trout floats from <strong>Cooper Landing</strong>, halibut from the <strong>Homer Spit</strong>. On the water you pick a spot, then face a few choices. The illegal option usually pays better. That’s the point.'],
  ['📖','The rules','The <strong>📖 Regs</strong> tab lists your credentials and every rule you guide by: king status, single-hook/no-bait, no guide-boat fishing below Skilak on Sundays and Mondays, 6 AM–6 PM, five people a boat in July, bag limits, halibut rules. Break them and you may get a warning or a citation. <strong>Three active citations</strong> and State Parks pulls your permit.'],
  ['📓','Paperwork','Fill out your <strong>ADF&G logbook</strong> at the shop after every trip, before bed. Keep your <strong>first-aid/CPR card</strong> current: classes are in Soldotna, Tuesday and Thursday, 1–4 PM, and a card lasts two years.'],
  ['⛽','Fuel','The jet sled burns about 9 gallons on a sockeye trip and 11 on a silver trip. You can fill up <strong>only at the Kenai Harbor fuel dock</strong> (6 AM–10 PM). Run dry and the Coast Guard tows you in: half the fare refunded and a hit to your reputation. Watch the <strong>Fuel</strong> gauge in the top bar.'],
  ['🐟','Fish & weather','The <strong>🐟 Fish</strong> tab shows today’s weather, river level, tides, the odds by place and species, and when each run arrives. Reds bite best at first light; silvers build late July; pinks run in even years. With no clients booked, <strong>Take the boat out</strong> to fill your freezer and scout.'],
  ['🔧','Money & gear','Restock tackle in Soldotna, service the boats at the shop, buy fuel at the harbor. Overhead is charged every night. In the off-season you can buy upgrades: a new motor, sled or drift boat, marketing, higher rates, even your own Homer charter permit.'],
  ['💀','How you lose','Three active citations (permit pulled), reputation down to 0 (nobody books you), or $2,000 in debt (the bank takes the sled).'],
  ['💡','Tips','Rig tomorrow’s gear and scout the river for better trips. Tips (💡) appear as you play; turn them on or off in ⚙️ Settings. On a computer, number keys press buttons and <strong>?</strong> lists the shortcuts.'],
];
function helpModal(){
  modal('❓ Help! How to play Guide Master',HELP.map(([ic,h,t])=>`<div class="todo"><span class="ck">${ic}</span><div><b>${h}</b><span style="font-size:13.5px;line-height:1.45;color:var(--ink)">${t}</span></div></div>`).join('')+
    '<p style="font-size:12px;color:var(--mute);margin-top:10px">Season 1 follows a simplified version of the real 2026 Kenai rules; later seasons invent plausible changes. This is a game: always check the current regulations and emergency orders at adfg.alaska.gov before you fish.</p>',
    [{l:'Got it',fn:()=>{}},{l:'💬 Send feedback',s:'Questions, ideas or bugs: tell the developer.',fn:()=>feedbackModal(helpModal)}]);
}
window.helpModal=helpModal;
