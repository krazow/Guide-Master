// ---- ⌨️ keyboard shortcuts (desktop) ----
// 1–9 press the numbered buttons (in a pop-up, its buttons; otherwise the action buttons on screen),
// a tab's first letter switches to it (H Here, T To-do, L Log…), Esc closes, ? lists all of this.
// Number hints only show on a computer with a mouse (CSS: hover + fine pointer), and never while typing.
const KEY_CLOSE=/^(never mind|close|cancel|not now|ok|got it|back|keep playing|keep it)\b/i;
const keyTabs=()=>{const m={};allTabs().forEach(([k,,l])=>{const c=l[0].toLowerCase();if(!m[c])m[c]=k});return m};
const keyVisible=el=>!!el&&!el.disabled&&el.offsetParent!==null&&el.getClientRects().length>0;
function keyTargets(){
  const mb=document.getElementById('mbg');
  if(mb) return {where:'modal',list:[...mb.querySelectorAll('.modal > button.act')].filter(keyVisible)};
  if(document.querySelector('.cross'))return {where:'none',list:[]};
  if(typeof S==='undefined'||!S||S.over||!document.querySelector('#app .hud'))return {where:'none',list:[]};
  return {where:'main',list:tab==='act'?[...document.querySelectorAll('#app .content button.act')].filter(keyVisible):[]}}
function keyHints(){try{
  document.querySelectorAll('.kn').forEach(n=>n.remove());
  const {list}=keyTargets();list.slice(0,9).forEach((b,i)=>{const n=document.createElement('i');n.className='kn';n.setAttribute('aria-hidden','true');n.textContent=i+1;b.appendChild(n)})}catch(e){}}
function keysModal(back){
  const row=(k,t)=>`<div class="keys-row"><kbd>${k}</kbd><span>${t}</span></div>`;
  const tabs=Object.entries(keyTabs());
  modal('⌨️ Keyboard shortcuts',`<div class="keys">${[
    row('1 – 9','Press the numbered button (the small number on its right)'),
    row(tabs.map(([c])=>c.toUpperCase()).join(' '),tabs.map(([,k])=>allTabs().find(t=>t[0]===k)[2]).join(', ')+' tabs'),
    row('Esc','Close the pop-up; skip a transition'),
    row('Enter','Press the highlighted button'),
    row('?','This list')].join('')}</div><p style="font-size:12px;color:var(--mute)">Shortcuts never fire while you’re typing.</p>`,
    (back?[{l:'Back to settings',fn:back}]:[]).concat([{l:'Close',fn:()=>{}}]))}
window.keysModal=keysModal;
document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;
  const t=e.target;if(t&&(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)||t.isContentEditable))return;
  const k=e.key,lk=k.length===1?k.toLowerCase():k;
  if(k==='?'){e.preventDefault();if(!document.getElementById('mbg'))keysModal();return}
  const {where,list}=keyTargets();
  if(/^[1-9]$/.test(k)){const b=list[+k-1];if(b){e.preventDefault();b.click()}return}
  if(where==='modal'){
    if(k==='Escape'){const b=[...list].reverse().find(x=>KEY_CLOSE.test(((x.querySelector('.tx b')||x).textContent||'').trim()));if(b){e.preventDefault();b.click()}}
    return}
  if(where!=='main')return;
  const kt=keyTabs();if(kt[lk]){e.preventDefault();setTab(kt[lk])}
});
// refresh the hints whenever the screen or a pop-up changes
{let q=false;const go=()=>{q=false;keyHints()};
  try{new MutationObserver(ms=>{if(q)return;if(ms.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&!n.classList.contains('kn'))||[...m.removedNodes].some(n=>n.nodeType===1&&n.id==='mbg'))){q=true;requestAnimationFrame(go)}})
    .observe(document.body,{childList:true,subtree:true})}catch(e){}}
