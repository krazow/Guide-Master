// ---------------- bottom-sheet modal ----------------
// modal(title, bodyHtml, [{l:'Label', s:'subtitle', fn:()=>{}, dis:false}, …])
// The first enabled button is highlighted (unless it has np:true; dilemma choices do, so no option is the "right" one).
// A button may carry legal:true/false, written to its data-legal attribute. Modals opened while one is showing are queued and shown in order.
// A 4th argument true makes the pop-up required: Esc doesn't close it, only its own button does (no backdrop-tap close exists).
// After any button, the game re-renders (unless you're on the title or end screen).
let MB=[], MQ=[], FOCUS_RET=null;
// Keyboard and screen-reader behavior: while a pop-up is open the page behind it is inert and Tab stays inside the pop-up;
// Esc closes it unless it is required (a 4th argument of true); closing gives focus back to what you had pressed.
const FOCUSABLE='button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';
function focusKey(el){if(!el||el===document.body||!el.tagName)return null;const tag=el.tagName.toLowerCase();return {id:el.id||'',tag,txt:(el.textContent||'').trim().slice(0,80),idx:[...document.querySelectorAll(tag)].indexOf(el)}}
function focusBack(k){if(!k)return;
  let el=k.id?document.getElementById(k.id):null;
  if(!el){const all=[...document.querySelectorAll(k.tag)].filter(e=>!e.closest('#mbg'));el=all.find(e=>(e.textContent||'').trim().slice(0,80)===k.txt)||all[k.idx]}
  if(el&&!el.disabled&&el.offsetParent!==null){try{el.focus({preventScroll:true})}catch(e){}}}
function syncInert(){const a=document.getElementById('app'),on=!!document.getElementById('mbg');if(a){if(on)a.setAttribute('inert','');else a.removeAttribute('inert')}}
function modal(title,body,btns,noClose){
  if(document.getElementById('mbg')){MQ.push([title,body,btns,noClose]);return}
  MB=btns;
  if(!FOCUS_RET)FOCUS_RET=focusKey(document.activeElement)||{};
  const el=document.createElement('div');el.className='modal-bg';el.id='mbg';if(noClose)el.dataset.lock='1';
  el.innerHTML=withName(`<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title.replace(/<[^>]+>/g,''))}" tabindex="-1"><h2>${title}</h2><div class="mb">${body}</div>${btns.map((b,i)=>`<button class="act ${i===0&&!b.dis&&!b.np?'primary':''}" ${b.legal!==undefined?`data-legal="${b.legal}"`:''} ${b.dis?'disabled':''} onclick="MBTN(${i})"><span class="tx"><b>${b.l}</b>${b.s?'<span>'+b.s+'</span>':''}</span></button>`).join('')}</div>`);
  el.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();escModal();return}
    if(e.key!=='Tab')return;
    const f=[...el.querySelectorAll(FOCUSABLE)].filter(x=>x.offsetParent!==null||x===document.activeElement);
    if(!f.length){e.preventDefault();el.querySelector('.modal').focus();return}
    const first=f[0],last=f[f.length-1],cur=document.activeElement;
    if(!el.contains(cur)||cur===el.querySelector('.modal')){e.preventDefault();(e.shiftKey?last:first).focus();return}
    if(e.shiftKey&&cur===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&cur===last){e.preventDefault();first.focus()}});
  document.body.appendChild(el);syncInert();
  setTimeout(()=>{const m=el.querySelector('.modal'),b=el.querySelector('button.act:not([disabled])');if(!document.body.contains(el))return;
    if(b&&!el.querySelector('input,textarea'))b.focus({preventScroll:true});else if(!el.contains(document.activeElement)&&m)m.focus({preventScroll:true})},30);
}
// after a pop-up closes: show the next queued one, else redraw and give focus back
function modalClosed(){
  if(!document.getElementById('mbg')&&MQ.length&&S&&!S.over){const q=MQ.shift();modal(...q)}
  if(S&&!S.over&&!document.querySelector('.title,.end'))render();
  syncInert();
  if(!document.getElementById('mbg')){const k=FOCUS_RET;FOCUS_RET=null;focusBack(k)}
}
window.MBTN=i=>{if(MB[i]&&MB[i].dis)return;const el=document.getElementById('mbg');el&&el.remove();const f=MB[i]&&MB[i].fn;f&&f();modalClosed()};
// Esc: press the pop-up's own close button if it has one (or its only button); otherwise just put it away. Required pop-ups ignore it.
function escModal(){
  const el=document.getElementById('mbg');if(!el||el.dataset.lock)return false;
  const bs=[...el.querySelectorAll('.modal > button.act')].filter(b=>!b.disabled);
  const c=[...bs].reverse().find(x=>/^(never mind|close|cancel|not now|ok|got it|back|keep playing|keep it)\b/i.test(((x.querySelector('.tx b')||x).textContent||'').trim()))||(bs.length===1?bs[0]:null);
  if(c){c.click();return true}
  el.remove();modalClosed();return true}
window.escModal=escModal;
function closeModals(){MQ=[];FOCUS_RET=null;document.querySelectorAll('.modal-bg').forEach(e=>e.remove());syncInert()}

// ---------------- full-screen transition ----------------
// transition('🚌','Off to work','20 minutes', done)  plays a short animation, then calls done().
// Tap to skip. Reduce-motion shortens it.
function transition(ic,cap,cap2,done,snd){
  const el=document.createElement('div');el.className='cross';el.tabIndex=0;sfx(snd||'whoosh');
  el.innerHTML=`<svg viewBox="0 0 480 260" aria-hidden="true"><rect width="480" height="260" fill="none"/><path d="M0 200 h480 M0 222 h480" stroke="#fff" stroke-opacity=".1"/>
    <text class="bob" x="240" y="150" text-anchor="middle" font-size="84">${ic}</text></svg>
    <div class="cap">${withName(cap)}</div><div class="cap2">${withName(cap2||'')}</div><div class="cap2" style="margin-top:18px">tap to skip</div>`;
  document.body.appendChild(el);el.focus();
  let fin=false;const end=()=>{if(fin)return;fin=true;el.remove();done&&done()};
  el.onclick=end;el.onkeydown=e=>{if(e.key==='Escape'||e.key==='Enter'||e.key===' '){e.preventDefault();end()}};
  setTimeout(end,prefs().rm?700:2200);
}

// ---------------- event tiles (toasts) ----------------
// showTile('🎉','Found $20','On the way to the park','good')   kind: good | bad | warn | info
// One tile at a time, shown just below the HUD so Cash and Rep stay readable. Extra tiles wait in a short queue (duplicates are
// dropped, the oldest goes if it grows past TILE_QUEUE) and each stays about 3.5 seconds. A tile whose title is already in an open
// (or queued) pop-up is skipped: the pop-up says it.
let tileQ=[];const TILE_MAX=1,TILE_QUEUE=3,TILE_MS=3500;
const plain=h=>String(h||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().toLowerCase();
function modalSays(title){
  const t=plain(withName(title));if(!t) return false;
  const open=document.getElementById('mbg');
  return (open&&plain(open.textContent).includes(t))||MQ.some(q=>plain(q[0]+' '+q[1]).includes(t));
}
function tileBox(){let el=document.getElementById('tiles');if(!el){el=document.createElement('div');el.id='tiles';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.appendChild(el)}return el}
function showTile(ic,title,sub,kind,when){
  if(!S||S.over) return;
  if(modalSays(title)) return;
  when=when||`${dayName(day()).slice(0,3)} ${fmt(S.t)}`;
  const box=tileBox();
  if(box.children.length>=TILE_MAX){
    if(!tileQ.some(q=>q[1]===title&&q[2]===sub)){tileQ.push([ic,title,sub,kind,when]);while(tileQ.length>TILE_QUEUE)tileQ.shift()}
    return}
  const hud=document.querySelector('.hud');box.style.top=hud?Math.round(hud.getBoundingClientRect().bottom+6)+'px':'';
  const t=document.createElement('div');t.className='tile '+(kind||'info');
  title=withName(title);sub=withName(sub);sfx(kind==='good'?'good':kind==='bad'?'bad':'info');
  t.innerHTML=`<span class="ti">${ic}</span><span class="tt"><small>${{good:'Good news',bad:'Event',warn:'Heads up'}[kind]||'Update'} · ${when}</small><b>${title}</b>${sub?`<span>${sub}</span>`:''}</span><button class="ok" aria-label="Got it">✓</button>`;
  let gone=false;const close=()=>{if(gone)return;gone=true;t.classList.add('out');setTimeout(()=>{t.remove();if(tileQ.length){const q=tileQ.shift();showTile(...q)}},260)};
  t.querySelector('.ok').onclick=close;t.onclick=e=>{if(e.target===t)close()};
  setTimeout(close,tileQ.length>=2?TILE_MS-1200:TILE_MS);box.appendChild(t);
}
function clearTiles(){tileQ=[];document.querySelectorAll('#tiles .tile').forEach(t=>t.remove())}
window.showTile=showTile;
