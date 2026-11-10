// ---------------- UI ----------------
// Everything is plain template strings rendered into #app. render() rebuilds the screen from S after every tap,
// and autosaves. Content supplies: STATS, SCENE, L (places), actionsHere(), ACT_CATS, statusTags(), alertBar(),
// todoItems(), RULES_HTML, TIPS, EXTRA_TABS. See 20-world.js and 21-story.js.
const app=document.getElementById('app');
function meter(v,good){v=clamp(Math.round(v),0,100);const c=good?(v>60?'#8fd19e':v>30?'#f4d27a':'#ff8a70'):(v<40?'#8fd19e':v<70?'#f4d27a':'#ff8a70');return `<div class="meter"><i style="width:${v}%;background:${c}"></i></div>`}

// ---- scene: sky by time of day + the place's own art (L[loc].art) ----
function sceneSVG(){
  const m=tod(),[rise,set]=SCENE.sun,night=m<rise||m>set,dusk=(m>=set-90&&m<=set+30)||(m>=rise-30&&m<=rise+60);
  const sky=night?SCENE.skyNight:dusk?SCENE.skyDusk:SCENE.skyDay;
  const f=clamp((m-rise)/(set-rise),0,1);
  const sun=night?`<circle cx="400" cy="34" r="12" fill="#f3efe0"/>`:`<circle cx="${80+f*320}" cy="${50-Math.sin(f*Math.PI)*25}" r="16" fill="#fbeaa8" opacity=".9"/>`;
  const art=L[S.loc].art?L[S.loc].art({night,dusk,m}):'';
  return `<svg viewBox="0 0 480 170" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs>
  <rect width="480" height="170" fill="url(#sk)"/>${sun}<rect y="140" width="480" height="30" fill="${night?SCENE.groundNight:SCENE.ground}"/>${art}</svg>`;
}
function hud(){
  const d=day(),n=STATS.length;
  return `<div class="hud"><div class="hud-top"><div><div class="hud-day">${dayName(d)}</div><div class="hud-sub">{{name}} · ${DF().ic} ${DF().n} · Day ${d+1} of ${GAME.days}</div></div><div style="display:flex;align-items:center;gap:10px"><div class="hud-time">${fmt(S.t)}</div><button class="gear" onclick="openSettings()" aria-label="Settings">⚙️</button></div></div>
  <div class="stats" style="grid-template-columns:repeat(${Math.min(n,6)},minmax(0,1fr))">${STATS.map(s=>`<div class="stat"${s.title?` title="${esc(s.title)}"`:''}><small>${s.l}</small><b${s.warn&&s.warn()?' style="color:#ff8a70"':''}>${s.v()}</b>${s.m?meter(s.m(),s.good!==false):''}</div>`).join('')}</div></div>`;
}
function allTabs(){return [['act','🧭','Here'],...(EXTRA_TABS||[]).map(t=>[t.k,t.ic,t.l]),['todo','📋','To-do'],['log','📜','Log']]}
function render(){
  if(!S||S.over) return;
  const loc=L[S.loc];
  let h=hud();
  const al=typeof alertBar==='function'?alertBar():null;
  if(al) h+=`<div class="alertbar ${al.kind||''}">${al.t}</div>`;
  h+=`<div class="scene">${sceneSVG()}<div class="place"><h2>${loc.ic} ${loc.name}</h2><div>${loc.desc||''}${loc.hours?' · '+hoursTxt(S.loc):''}</div></div></div>`;
  const xt=(EXTRA_TABS||[]).find(t=>t.k===tab);
  h+=`<div class="content">${tab==='act'?actView():tab==='todo'?todoView():tab==='log'?logView():xt?xt.view():actView()}</div>`;
  const pending=todoItems().filter(x=>x.urgent&&!x.ok).length,tabs=allTabs();
  h+=`<nav class="tabs" style="grid-template-columns:repeat(${tabs.length},1fr)">${tabs.map(([k,i,l])=>`<button class="${tab===k?'on':''}" onclick="setTab('${k}')"${tab===k?' aria-current="page"':''}><span class="ti">${i}</span>${l}${k==='todo'&&pending?'<span class="dot"></span>':''}</button>`).join('')}</nav>`;
  app.innerHTML=withName(h);
  achCheck();
  saveGame();
}
window.setTab=k=>{tab=k;render();window.scrollTo(0,0)};

// ---- Here tab: narration, status, tip, actions, places ----
let ACTS=[];
function actView(){
  ACTS=[];
  let h=tipView();
  if(uiNarr.length) h+=`<div class="narr">${uiNarr.slice(-4).map(s=>'<p>'+s+'</p>').join('')}</div>`;
  const tags=typeof statusTags==='function'?statusTags():[];
  if(tags.length) h+=`<div class="status">${tags.join('')}</div>`;
  const acts=actionsHere().filter(Boolean);
  const btn=a=>{const i=ACTS.push(a.fn)-1;return `<button class="act ${a.cls||''}" ${a.dis?'disabled':''} onclick="ACT(${i})"><span class="ic">${a.ic}</span><span class="tx"><b>${a.l}</b>${a.s?'<span>'+a.s+'</span>':''}</span></button>`};
  if(acts.length>4){ // group into sections; the section holding a primary action goes first
    const groups={};acts.forEach(a=>{const c=ACT_CATS[a.cat]?a.cat:'here';(groups[c]=groups[c]||[]).push(a)});
    Object.keys(ACT_CATS).filter(c=>groups[c]).sort((x,y)=>(groups[y].some(a=>a.cls==='primary')?1:0)-(groups[x].some(a=>a.cls==='primary')?1:0))
      .forEach(c=>{h+=`<div class="sect">${ACT_CATS[c]}</div>`+groups[c].map(btn).join('')});
  } else if(acts.length) h+='<div class="sect">Do something</div>'+acts.map(btn).join('');
  const dests=Object.keys(L).filter(k=>k!==S.loc&&!L[k].hidden);
  const p=prefs().goOpen,open=p===null||p===undefined?acts.length<=5:p;
  h+=`<details class="go" ${open?'open':''} ontoggle="setPref('goOpen',this.open)"><summary>🧭 Go somewhere (${dests.length})</summary>`;
  dests.forEach(k=>{const m=travelMins(S.loc,k),i=ACTS.push(()=>go(k))-1;
    h+=`<div class="dest compact"><div class="dn"><b>${L[k].ic} ${L[k].name}</b><span>${L[k].hours?hoursTxt(k):L[k].desc||''}</span></div><div class="chips"><button class="chip" onclick="ACT(${i})">Go · ${m} min</button></div></div>`});
  return h+'</details>';
}
window.ACT=i=>{uiNarr=[];sfx('tap');const f=ACTS[i];f&&f();afterAction();if(S&&!S.over&&!document.querySelector('.title,.end'))render()};

// ---- tips: one at a time, each shown once per game (TIPS in 21-story.js) ----
function tipView(){
  if(!prefs().tips||!S) return '';
  const t=TIPS.find(x=>!S.tips.seen.includes(x.id)&&(()=>{try{return x.when()}catch(e){return false}})());
  if(!t) return '';
  return `<div class="tip">💡 ${t.t}<div class="tb"><button onclick="tipSeen('${t.id}')">Got it</button><button onclick="setPref('tips',false);render()">Turn off tips</button></div></div>`;
}
window.tipSeen=id=>{if(!S.tips.seen.includes(id))S.tips.seen.push(id);render()};

// ---- To-do tab: your goals + the player's own priority list ----
const PRIO_MAX=15,PRIO_LEN=80;let PRIO_ED='';
function prioView(){
  const P=S.prios,open=P.filter(q=>!q.done).length;let rank=0;
  const rows=P.map((q,i)=>{const r=q.done?'✓':++rank;return `<div class="prio ${q.done?'done':''}"><span class="rk">${r}</span><span class="pt" role="button" tabindex="0" onclick="prioToggle(${i})" title="Tap to mark done">${esc(q.t)}</span><span class="pb">
    <button aria-label="Move up" ${i===0?'disabled':''} onclick="prioMove(${i},-1)">▲</button><button aria-label="Move down" ${i===P.length-1?'disabled':''} onclick="prioMove(${i},1)">▼</button><button aria-label="Edit" onclick="prioEdit(${i})">✏️</button><button aria-label="Delete" onclick="prioDel(${i})">🗑️</button></span></div>`}).join('');
  return `<div class="sect">My priorities${P.length?` · ${open} open`:''}</div>`+
    (rows||'<div class="prio-empty">Your own list, in your order. Add anything, or tap 📌 on a goal above. Tap an item to check it off.</div>')+
    (P.length<PRIO_MAX?`<div class="prio-add"><input id="prioIn" maxlength="${PRIO_LEN}" placeholder="Add a priority…" autocomplete="off" onkeydown="if(event.key==='Enter'){event.preventDefault();prioAdd(this.value,true)}"><button onclick="prioAdd(document.getElementById('prioIn').value,true)">Add</button></div>`:`<div class="prio-empty">That’s ${PRIO_MAX}: the most the list holds.</div>`)+
    (P.some(q=>q.done)?`<div class="prio-add"><button onclick="prioClear()">Clear checked-off items</button></div>`:'');
}
function prioSave(focus){render();if(focus)setTimeout(()=>{const i=document.getElementById('prioIn');i&&i.focus()},0)}
window.prioAdd=(t,focus)=>{t=String(t||'').replace(/\s+/g,' ').trim().slice(0,PRIO_LEN);if(!t||S.prios.length>=PRIO_MAX)return;S.prios.push({t,done:false});sfx('info');prioSave(focus)};
window.prioToggle=i=>{const q=S.prios[i];if(!q)return;q.done=!q.done;S.prios.splice(i,1);
  if(q.done)S.prios.push(q);else{const k=S.prios.findIndex(x=>x.done);S.prios.splice(k<0?S.prios.length:k,0,q)}prioSave()};
window.prioMove=(i,dir)=>{const P=S.prios,j=i+dir;if(j<0||j>=P.length)return;[P[i],P[j]]=[P[j],P[i]];prioSave()};
window.prioDel=i=>{S.prios.splice(i,1);prioSave()};
window.prioClear=()=>{S.prios=S.prios.filter(q=>!q.done);prioSave()};
window.prioEdit=i=>{const q=S.prios[i];if(!q)return;PRIO_ED=q.t;
  modal('✏️ Edit priority',`<input class="nm-in" id="prioEd" maxlength="${PRIO_LEN}" autocomplete="off" value="${esc(q.t)}" oninput="PRIO_ED=this.value" onkeydown="if(event.key==='Enter'){event.preventDefault();MBTN(0)}">`,[
    {l:'Save',fn:()=>{const v=String(PRIO_ED).replace(/\s+/g,' ').trim().slice(0,PRIO_LEN);if(v)q.t=v}},{l:'Cancel',fn:()=>{}}]);
  setTimeout(()=>{const e=document.getElementById('prioEd');if(e){e.focus();e.select()}},60)};
function todoView(){
  const P=S.prios;
  return `<div class="sect">This ${GAME.days===7?'week':'run'}</div>`+todoItems().map(x=>`<div class="todo"><span class="ck">${x.ok?'✅':x.fail?'❌':x.urgent?'⚠️':'⬜'}</span><div><b>${x.l}</b><span>${x.s||''}</span></div>${!x.ok&&!x.fail&&!P.some(q=>q.t===x.l&&!q.done)&&P.length<PRIO_MAX?`<button class="pin" title="Add to my priorities" aria-label="Add to my priorities" onclick="prioAdd(${esc(JSON.stringify(x.l))})">📌</button>`:''}</div>`).join('')+
    prioView()+(typeof RULES_HTML==='string'&&RULES_HTML?`<div class="sect">How it works</div><div class="rules">${RULES_HTML}</div>`:'');
}
function logView(){return `<div class="log">${S.log.slice().reverse().map(e=>`<p><em>${dayName(Math.floor(e.t/1440)).slice(0,3)} ${fmt(e.t)}</em>${e.s}</p>`).join('')||'<p>Nothing yet.</p>'}</div>`}
