// ============================================================
//  GUIDE MASTER, part 9 (1.15): the star rating. Reputation that keeps mattering.
//  · The rating is the average of the last RATE_N reviews (S.reviews, 33-day.js), with a light prior from S.rep so a new guide
//    (or a guide with few reviews) starts near ★4.0. The top bar shows it as ★4.6 where Rep used to be; S.rep stays underneath
//    (word of mouth, upgrade gates, the score and the rep-0 loss all still use it, and its meter still shows under the rating).
//  · Milestones: ★4.5 over 10+ reviews makes you a top-rated guide: parties that pay well and tip 15% more on a good day.
//    ★4.7 over 12+ reviews brings a magazine feature, once a career: a burst of up to three extra bookings over the next week.
//    A season averaging ★4.7 (6+ reviews) signs a lodge partnership: two extra bookings each season, 10% referral fee to the lodge,
//    until the rating slips under ★4.3 at a season's end. (1.15 integration: ★4.8 over a July never triggered in the sims.)
//  · With 1.14's summer weeks, the magazine's readers and the lodge's guests book inside the season's chosen weeks, on the trip
//    that week's water offers (memBookType): June kings, July sockeye, August silvers, September rainbows; trout or halibut Sun/Mon.
//  · Falling ratings hurt: under ★2.5, fewer season bookings and a quieter rest of the summer (starBook(), down to −30%).
//  Calibrated with tools/sim: the default bots (food, passive, ignores) average ★2.8–3.5 and never reach ★4.5, so none of this
//  moves their grades; guide/skilled play reaches ★4.5 in most careers and ★4.7 in some.
// ============================================================
const RATE_N=20,RATE_PRIOR=3,STAR_TOP=4.5,STAR_TOP_N=10,STAR_FEAT=4.7,STAR_FEAT_N=12,STAR_LODGE=4.7,STAR_LODGE_N=6,STAR_LODGE_OFF=4.3,STAR_LOW=2.5,TOP_TIP=1.15,LODGE_FEE=.1,LODGE_N=2,FEAT_N=3;
// {r, n}: the rating (1–5) and how many reviews it rests on
function rating(){
  const rv=(S&&S.reviews||[]).slice(-RATE_N),n=rv.length,p=clamp(3+((S&&S.rep)||0)/50,1,5);
  const r=(rv.reduce((a,x)=>a+(x.stars||0),0)+RATE_PRIOR*p)/(n+RATE_PRIOR);
  return {r:Math.round(r*100)/100,n};
}
const starTxt=r=>`★${(Math.round(r*10)/10).toFixed(1)}`;
const topRated=()=>{const x=rating();return x.n>=STAR_TOP_N&&x.r>=STAR_TOP};
// season and rest-of-summer bookings (24-career genSeasonBookings, 25-fuel restOfSeason): 1, or less under ★2.5
function starBook(){const x=rating();return x.n>=5&&x.r<STAR_LOW?Math.max(.7,1-(STAR_LOW-x.r)*.3):1}
// tips (22-trips tripEnd): a top-rated guide's parties tip more
const memTipK=()=>topRated()?TOP_TIP:1;

// ---- the top bar: the rating where Rep was (the meter under it is still Rep, the number the rep-0 loss watches) ----
{const i=STATS.findIndex(s=>s.l==='Rep');const R={l:'Rating',v:()=>starTxt(rating().r),m:()=>S.rep,warn:()=>S.rep<20||(rating().n>=5&&rating().r<STAR_LOW),
  get title(){const x=rating();return `Rating ${starTxt(x.r)}: the average of your last ${Math.min(RATE_N,x.n)||'few'} reviews${x.n<RATE_N?' (and your reputation, until there are more)':''}. ${topRated()?'Top-rated: better tips. ':''}Reputation ${S.rep}/100 (the bar): word of mouth. At 0, nobody books you.`}};
  if(i>=0)STATS[i]=R;else STATS.splice(1,0,R)}

// ---- a lodge guest pays the lodge its cut (tripStart, through memTripStart) ----
function starsTripStart(b,t){const fee=Math.round(payOf(b)*LODGE_FEE);if(fee>0){fx(t,-fee,'Referral fee to the lodge');if(S.mem&&S.mem.lodge)S.mem.lodge.fee+=fee}}

// ---- after each review (the dock sheet): top-rated, the magazine ----
function starsAfterTrip(b,t,info){
  const M=MEM(),x=rating(),out=[];
  if(!M.top&&topRated()){M.top=true;out.push(`⭐ <b>Top-rated guide: ${starTxt(x.r)}.</b> Your reviews put you near the top of every booking site on the Kenai. Parties who pay well find you, and they tip about 15% more on a good day.`)}
  else if(M.top&&x.n>=STAR_TOP_N&&x.r<STAR_TOP-.2){M.top=false;out.push(`📉 Your rating slips to ${starTxt(x.r)}: you drop off the top-rated lists. Good days bring it back.`)}
  if(!M.feat&&x.n>=STAR_FEAT_N&&x.r>=STAR_FEAT){
    const add=featBook(day()+1,7);M.feat={d:day(),s:seasonOf(day()),n:add.length,pend:add.length?0:(isLastSeason()?0:FEAT_N)};
    out.push(`📰 <b>A magazine feature.</b> A writer from an Alaska fishing magazine has been reading your reviews (${starTxt(x.r)}) and calls to ride along next summer. The story runs online tonight.${add.length?` The phone rings off the hook: ${add.length} more trip${add.length>1?'s':''} booked this week (${add.map(a=>dlabel(a.d)).join(', ')}).`:M.feat.pend?' This week is full, so the readers book the first week of next season.':''}`);
  }
  return out.length?`<div class="gm-stars-ms">${out.map(l=>`<p>${l}</p>`).join('')}</div>`:'';
}
// the trip a magazine reader or a lodge guest books on day d: the played week's main trip on Tue–Sat (June kings, or rainbows when
// kings are closed; July sockeye; August silvers; September rainbows and silvers), a trout float (or Homer halibut with the charter
// permit) on Sundays and Mondays while guide boats are off the lower river (through Jul 31; after that the week's trip runs then too)
function memBookType(d){
  const w=((d%7)+7)%7,main=typeof weekOf==='function'?weekOf(d).main(d):'reds';
  if((w===0||w===6)&&isSunMon(d)) return S.up&&S.up.chp?'halibut':'trout';
  return main;
}
// party size for those bookings (the week's usual sizes, a seeded pick)
function memBookN(type,d,k){const L=typeof WEEK_N!=='undefined'&&WEEK_N[type]||(type==='halibut'?[4,5,6]:type==='trout'?[2,3]:[3,4]);return L[Math.floor(memU(d,k,1)*L.length)]}
// up to FEAT_N bookings on open, legal days from d0 for `span` days within the season: magazine readers (deterministic picks)
function featBook(d0,span,max){
  const end=seasonFirst(seasonOf(d0))+SEASON,out=[];max=max||FEAT_N;
  for(let d=d0;d<Math.min(end,d0+span)&&out.length<max;d++){
    const type=memBookType(d);if(illegalDay(type,d)||conflicts(d,type))continue;
    const ps=PARTIES,p=ps[Math.floor(memU(d,out.length,7)*ps.length)];
    out.push(addBooking({d,type,n:memBookN(type,d,3),who:p.who,from:p.from,res:!!p.res,quirk:[],tr:['photo'],feat:true}));
  }
  return out;
}

// ---- the season turns (startSeason → memSeasonStart, in the morning report) ----
function starsSeasonStart(s){
  const M=MEM(),rv=(S.reviews||[]).filter(r=>seasonOf(r.day)===s-1),n=rv.length,avg=n?rv.reduce((a,x)=>a+x.stars,0)/n:0,x=rating();
  if(!M.lodge&&n>=STAR_LODGE_N&&avg>=STAR_LODGE&&s<S.years){M.lodge={s,n:0,fee:0};digestLine(`🏨 <b>A lodge partnership.</b> Last season’s reviews averaged ${starTxt(avg)}. A riverside lodge in Soldotna wants you as its guide: ${LODGE_N} extra trips with its guests every season, for a ${Math.round(LODGE_FEE*100)}% referral fee.`)}
  else if(M.lodge&&!M.lodge.off&&x.r<STAR_LODGE_OFF){M.lodge.off=s;digestLine(`🏨 Your rating fell to ${starTxt(x.r)}, and the lodge sends its guests to another guide. The partnership is over.`)}
  if(x.n>=5&&x.r<STAR_LOW) digestLine(`📉 Your rating is ${starTxt(x.r)}. Fewer parties book a guide with reviews like that: expect a quieter summer until it comes back up.`);
}
// finishWinter → memSeasonOpen: the lodge's guests, and magazine readers who couldn't get a date last summer
function starsSeasonOpen(s){
  const M=MEM(),lines=[],base=s*SEASON;
  if(M.feat&&M.feat.pend){const add=featBook(base+1,7,M.feat.pend);M.feat.pend=0;M.feat.n+=add.length;if(add.length)lines.push(`📰 Readers of last summer’s magazine story booked ${add.length} trip${add.length>1?'s':''} in the first week.`)}
  if(M.lodge&&!M.lodge.off){
    let k=0;const want=LODGE_N;
    for(let i=0;i<SEASON*3&&k<want;i++){const d=base+1+Math.floor(memU(s,i,11)*(SEASON-2)),w=sday(d)%7;if(w<1||w>5)continue;   // Tue–Sat of either chosen week
      const type=memBookType(d);if(conflicts(d,type)||illegalDay(type,d))continue;
      const p=PARTIES[Math.floor(memU(s,i,13)*PARTIES.length)];addBooking({d,type,n:memBookN(type,d,s),who:p.who,from:p.from,res:!!p.res,quirk:[],tr:['first'],lodge:true});k++}
    M.lodge.n+=k;if(k)lines.push(`🏨 The lodge sends ${k} part${k>1?'ies':'y'} of its guests (${Math.round(LODGE_FEE*100)}% referral fee).`);
  }
  return lines;
}

// ---- on the trophy wall ----
function starsWall(){
  const M=MEM(),x=rating(),rv=(S.reviews||[]).slice(-RATE_N),dist=[5,4,3,2,1].map(k=>[k,rv.filter(r=>r.stars===k).length]);
  const ms=[[topRated(),`★${STAR_TOP} top-rated guide (${STAR_TOP_N}+ reviews): parties that pay and tip better`],
    [!!M.feat,`★${STAR_FEAT} magazine feature (${STAR_FEAT_N}+ reviews): a week of extra bookings, once${M.feat?`: ran ${dlabel(M.feat.d)}, ${yearOf(M.feat.d)}`:''}`],
    [!!(M.lodge&&!M.lodge.off),`★${STAR_LODGE} over a whole season: a lodge partnership, ${LODGE_N} extra trips a season${M.lodge?` (${M.lodge.n} so far${M.lodge.off?', ended':''})`:''}`]];
  return `<div class="sect">★ Your rating</div><div class="rules gm-stars-ms" style="margin-top:0"><p style="margin:0 0 4px"><b style="font-size:20px">${starTxt(x.r)}</b> from the last ${x.n} review${x.n===1?'':'s'}${x.n<RATE_N?' (with your reputation filling in until there are '+RATE_N+')':''}. Reputation ${S.rep}/100.</p>
    <p style="margin:0 0 6px;color:var(--mute)">${dist.map(([k,c])=>`${k}★ ${c}`).join(' · ')}</p>${ms.map(([ok,t])=>`<div class="gm-ms"><span class="${ok?'ok':''}" aria-label="${ok?'reached':'not yet'}">${ok?'✓':'○'}</span><span>${t}</span></div>`).join('')}
    ${x.n>=5&&x.r<STAR_LOW?`<p style="color:var(--bad);margin:6px 0 0">Under ★${STAR_LOW}: fewer bookings until it comes back up.</p>`:''}</div>`;
}
