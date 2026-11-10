// ============================================================
//  GUIDE MASTER: 💬 player feedback, emailed to the developer through Formspree.
//  The game POSTs JSON to the form endpoint; Formspree emails it with the subject below.
//  Only the form ID lives in this public code, never an email address.
//  Offline or unreachable → the message is queued in localStorage and sent when the game is online again.
// ============================================================
const FEEDBACK={
  formId:'mdeeqzbq',                            // Formspree form: https://formspree.io/f/mdeeqzbq
  subject:'Guide Master Feedback',
  maxLen:4000,
  qKey:()=>`${GAME.id}.feedbackQueue`,
};
const fbEndpoint=()=>FEEDBACK.formId?`https://formspree.io/f/${FEEDBACK.formId}`:'';
const FB_KINDS=['💡 Idea','🐞 Bug','📖 A rule or fact is wrong','👍 Love it','💬 Other'];
let FBD={kind:FB_KINDS[0],msg:'',email:'',trap:''};      // the open form's draft (inputs write here as you type)

function fbContext(){
  const standalone=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone;
  const c={version:APP_VERSION,app:standalone?'installed app':'browser',screen:`${screen.width}×${screen.height}`,device:navigator.userAgent.slice(0,160)};
  if(typeof S!=='undefined'&&S&&!S.over&&S.cur!=null){Object.assign(c,{career:`${S.years}-year, season ${seasonOf(S.cur)+1}`,day:`${dlongY(S.cur)} ${fmt(S.t)}`,difficulty:S.diff,location:(L[S.loc]||{}).name,cash:Math.round(S.money),rep:S.rep,trips:S.stats.trips})}
  return c;
}
function fbQueue(){try{return JSON.parse(localStorage.getItem(FEEDBACK.qKey())||'[]')}catch(e){return []}}
function fbSetQueue(q){try{localStorage.setItem(FEEDBACK.qKey(),JSON.stringify(q.slice(-10)))}catch(e){}}
// POST one message. Resolves 'sent' | 'queue' (network trouble: try later) | 'rejected' (Formspree said no).
async function fbPost(item){
  if(!fbEndpoint()) return 'queue';
  const ctl=typeof AbortController!=='undefined'?new AbortController():null,timer=setTimeout(()=>ctl&&ctl.abort(),12000);
  try{
    const r=await fetch(fbEndpoint(),{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},body:JSON.stringify(item),signal:ctl&&ctl.signal});
    if(r.ok) return 'sent';
    return r.status===429||r.status>=500?'queue':'rejected';
  }catch(e){return 'queue'}finally{clearTimeout(timer)}
}
async function fbFlush(){
  const q=fbQueue();if(!q.length||!fbEndpoint()||(navigator.onLine===false))return;
  const left=[];for(const it of q){const r=await fbPost(it);if(r==='queue')left.push(it)}
  fbSetQueue(left);
  if(left.length<q.length&&typeof showTile==='function') showTile('💬','Feedback sent',`${q.length-left.length} saved message${q.length-left.length>1?'s':''} delivered`,'good');
}
window.addEventListener('online',()=>fbFlush());
setTimeout(()=>fbFlush(),4000);

function feedbackModal(back){
  const esc=x=>String(x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const q=fbQueue().length;
  modal('💬 Send feedback',`<p style="font-size:14px">Tell the developer what you think: ideas, bugs, a rule we got wrong.</p>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0">${FB_KINDS.map(k=>`<button style="cursor:pointer;border:1px solid ${k===FBD.kind?'var(--brand)':'var(--line)'};background:${k===FBD.kind?'var(--brand)':'transparent'};color:${k===FBD.kind?'#fff':'var(--ink)'}" onclick="FBD.kind=${esc(JSON.stringify(k))};document.querySelectorAll('.fbk').forEach(b=>{const on=b.dataset.k===FBD.kind;b.style.background=on?'var(--brand)':'transparent';b.style.color=on?'#fff':'var(--ink)';b.style.borderColor=on?'var(--brand)':'var(--line)'})" data-k="${esc(k)}" class="tag fbk">${k}</button>`).join('')}</div>
    <textarea id="fbmsg" maxlength="${FEEDBACK.maxLen}" rows="6" placeholder="Your feedback…" oninput="FBD.msg=this.value" style="width:100%;box-sizing:border-box;font:inherit;font-size:15px;padding:10px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink)">${esc(FBD.msg)}</textarea>
    <input id="fbmail" type="email" placeholder="Your email (optional, for a reply)" value="${esc(FBD.email)}" oninput="FBD.email=this.value" autocomplete="email" style="width:100%;box-sizing:border-box;margin-top:8px;font:inherit;font-size:15px;padding:10px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink)">
    <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true" oninput="FBD.trap=this.value" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">
    <p style="font-size:12px;color:var(--mute);margin-top:8px">Sent with the game version, your device type and where you are in the game, so problems can be tracked down. Nothing else.${q?` ${q} earlier message${q>1?'s are':' is'} waiting to send.`:''}</p>`,
    [{l:'📨 Send',s:'Emails your feedback to the developer.',fn:()=>fbSend(back)},
     {l:back?'Back':'Cancel',fn:()=>{if(back)back()}}]);
  setTimeout(()=>{const t=document.getElementById('fbmsg');if(t)t.focus()},250);
}
async function fbSend(back){
  const msg=FBD.msg.trim(),email=FBD.email.trim();
  if(msg.length<3){modal('💬 Send feedback','<p>Write a few words first.</p>',[{l:'Back to the form',fn:()=>feedbackModal(back)}]);return}
  if(email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){modal('💬 Send feedback','<p>That email address doesn’t look right. Fix it, or leave it blank.</p>',[{l:'Back to the form',fn:()=>feedbackModal(back)}]);return}
  if(FBD.trap){FBD={kind:FB_KINDS[0],msg:'',email:'',trap:''};return}            // a bot filled the hidden field
  const item=Object.assign({_subject:FEEDBACK.subject,kind:FBD.kind,message:msg.slice(0,FEEDBACK.maxLen)},email?{email,_replyto:email}:{},fbContext(),{sentAt:new Date().toISOString()});
  showTile('📨','Sending…','Feedback','info');
  const r=navigator.onLine===false?'queue':await fbPost(item);
  if(r==='rejected'){modal('💬 Couldn’t send','<p>The feedback service turned the message down. Please try again later.</p>',[{l:'Back to the form',fn:()=>feedbackModal(back)},{l:'Close',fn:()=>{if(back)back()}}]);return}
  if(r==='queue') fbSetQueue(fbQueue().concat([item]));
  FBD={kind:FB_KINDS[0],msg:'',email:'',trap:''};
  sfx&&sfx('good');
  modal(r==='sent'?'🙏 Thanks!':'📥 Saved for later',r==='sent'?'<p>Your feedback is on its way. Thanks for helping make Guide Master better.</p>':'<p>No connection to the feedback service right now. Your message is saved on this device and will send automatically next time the game is online.</p>',
    [{l:'OK',fn:()=>{if(back)back()}}]);
}
window.feedbackModal=feedbackModal;
