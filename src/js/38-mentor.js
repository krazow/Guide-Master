// ============================================================
//  GUIDE MASTER, part 8 (1.15): a mentor's first trip.
//  On a new career's first trip, Walt Brandvold (forty-some Julys on the Kenai, a Soldotna local) rides along and walks you
//  through one thing per beat: reading the conditions line, choosing a move, the party's goals and a rule dilemma.
//  His lines sit inside the trip sheet (no extra pop-ups). "I’ve got this" sends him ashore; he rides once per save
//  (S.mem.mentor: due → riding → done | skipped), and Help → "Ride with the mentor again" brings him back for one trip.
// ============================================================
const MENTOR={n:'Walt Brandvold',sh:'Walt',ic:'🧓'};
// the lessons, in the order he likes to give them; each one once, on the first sheet where it fits
function mentorSay(b,t,key){
  const m=t.mentor,T=TRIPS[b.type]||{},seen=k=>m.seen.includes(k),first=!m.seen.length;
  const hi=first?`Walt Brandvold climbs in with a thermos and a coffee can of jigs. He has run this river since the sleds were wooden. `:'';
  const illegal=window.TRIPV&&TRIPV.o&&TRIPV.o.some(o=>o.legal===false);
  if((key==='spot'||key==='pack')&&!seen('conds')){
    const c={reds:'Clock, tide, yesterday’s sonar, the boats, the wind and the radio. Fresh reds ride the flood in, and Big Eddy is elbow to elbow by eight.',
      silver:'Clock, tide, sonar, the boats, the wind. Silvers push in on the flood and turn on toward evening. Six o’clock is the hard stop down here.',
      trout:'Read the river level and the wind. Spawning reds put the rainbows on the egg bite, and Skilak blows up most afternoons.',
      halibut:'Tide first, always. Slack holds a chum slick on the bottom; a running tide drags it off. Then the wind: chop out in the open means green faces.'}[b.type]||'Clock, water, boats, wind, the radio: read it top to bottom.';
    return ['conds',`${hi}“See that list? Read it top to bottom before you pick a spot. ${c} The 🐟 Fish tab gives you the same read ashore, the night before.”`];
  }
  if(key==='beat'&&!seen('moves')) return ['moves',`${hi}“Your call now, ${'{{name}}'}. Stay if the bite is holding. Switching tactics costs five minutes; a run costs time and gas. Don’t chase every rumor on the radio, but don’t babysit a dead drift either.”`];
  if(illegal&&!seen('rules')) return ['rules',`${hi}“Here’s where guides lose permits. There’s always a legal answer, and it always costs you something: time, a fish, a smaller tip. Pay it. The troopers know every boat on this river, and three tickets ends you.”`];
  if((key==='beat'||(!first&&seen('moves')))&&!seen('goals')&&key!=='pack'){
    const tr=(b.tr||[]).filter(k=>TRAITS[k]);
    return ['goals',`${hi}“Look at the 🎯 line. ${tr.length?`The ${b.who} came for ${tr.map(k=>TRAITS[k].want).join(', and ')}.`:`Ask the ${b.who} what they came for.`} Give them that and the tip takes care of itself. Fish count, but the day they wanted counts more.”`];
  }
  if(first) return ['hi',`${hi}“Don’t mind me. I’ll speak up when it matters.”`];
  return null;
}
// tripStart: he climbs aboard if he is due (or rode a trip that never launched)
function mentorBoard(b,t){
  const M=MEM();
  if(M.mentor==='due'||M.mentor==='riding'){M.mentor='riding';t.mentor={seen:[]}}
}
const mentorOn=t=>!!(t&&t.mentor&&S.mem&&S.mem.mentor==='riding');
// a line for this sheet of the trip ('' when he has nothing new to say)
function mentorLine(b,t,key){
  if(!mentorOn(t)) return '';
  const r=mentorSay(b,t,key);if(!r) return '';
  t.mentor.seen.push(r[0]);
  return `<div class="gm-mentor" role="note" aria-label="${MENTOR.n}, your mentor"><span class="gm-who" aria-hidden="true">${MENTOR.ic}</span><div><p><b>${MENTOR.sh}:</b> ${r[1]}</p><button type="button" class="gm-skip" onclick="mentorSkip()">I’ve got this</button></div></div>`;
}
// the dock: his last word, and he heads home
function mentorDock(b,t){
  if(!mentorOn(t)) return '';
  const s=t.mentor.seen,miss=['conds','moves','goals','rules'].filter(k=>!s.includes(k));
  S.mem.mentor='done';t.mentor=null;
  const extra=miss.includes('rules')?' And when a client asks you to bend a rule, there is always a legal answer. It costs something. Pay it.':miss.includes('goals')?' Next time, look at what the party came for. That’s where the tip is.':'';
  return `<div class="gm-mentor" role="note" aria-label="${MENTOR.n}, your mentor"><span class="gm-who" aria-hidden="true">${MENTOR.ic}</span><div><p><b>${MENTOR.sh}:</b> “Not bad, {{name}}. Write it up in the logbook before bed.${extra} You don’t need me in the boat anymore.” He tips his cap and walks up the ramp to his truck.</p></div></div>`;
}
// "I’ve got this": he goes quiet for good (this save), and the sheet loses his lines at once
window.mentorSkip=()=>{
  if(S&&S.mem)S.mem.mentor='skipped';if(S&&S.trip)S.trip.mentor=null;
  document.querySelectorAll('#mbg .gm-mentor').forEach(e=>e.remove());
  const b=document.querySelector('#mbg button.act:not([disabled])');if(b)b.focus({preventScroll:true});
  if(S&&!S.over)saveGame();
};
// Help → "Ride with the mentor again": the game you are playing, or (on the title screen) the saved game in this slot
window.mentorAgain=()=>{
  if(S&&!S.over&&!document.querySelector('.title,.end')){MEM().mentor='due';say(`${MENTOR.ic} ${MENTOR.n} says he’ll ride along on your next trip. “Bring the good coffee.”`);saveGame();return true}
  const r=rawSave();if(!r) return false;
  try{const d=JSON.parse(r.v);if(!d||!d.S)return false;d.S.mem=d.S.mem&&typeof d.S.mem==='object'?d.S.mem:{};d.S.mem.mentor='due';store().setItem(r.k,JSON.stringify(d));return true}catch(e){return false}
};
const mentorCanReplay=()=>!!((S&&!S.over&&!document.querySelector('.title,.end'))||rawSave());
