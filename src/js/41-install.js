// ---------------- "📲 Install app" on the title screen ----------------
// 08-settings.js puts installButton() on the title screen. What the button does depends on the device:
//   Chrome / Edge / Samsung Internet (Android and computers): when the browser has offered an install (beforeinstallprompt),
//     the button opens the browser's own install prompt; after appinstalled it hides and says thanks.
//   No offer yet (Firefox, a browser that hasn't decided the page is installable, …): a short sheet with the menu steps.
//   iPhone / iPad (incl. iPadOS that reports as a Mac with touch): the step-by-step page install/ios.html, with a video.
// The button is hidden while running as the installed app, and in the single-file offline build (no server, nothing to install).
let deferredInstall=null;
const INSTALLED_KEY=KEY('installed');   // set after appinstalled: a browser tab of an installed app shows no button
const isStandalone=()=>{try{return matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true}catch(e){return false}};
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const SINGLE_FILE=false;   // tools/build-offline.py turns this on in the one-file offline copy
const canInstallHere=()=>!SINGLE_FILE&&/^https?:$/.test(location.protocol)&&!isStandalone();
function installShown(){
  if(!canInstallHere())return false;
  if(deferredInstall||isIOS())return true;
  try{return localStorage.getItem(INSTALLED_KEY)!=='1'}catch(e){return true}
}
function installButton(){return installShown()?'<button id="installBtn" class="ghost" onclick="doInstall()">📲 Install app</button>':''}
function syncInstallBtn(){const b=document.getElementById('installBtn');
  if(b&&!installShown())b.remove();
  else if(!b&&installShown()&&document.querySelector('.title'))titleScreen()}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;try{localStorage.removeItem(INSTALLED_KEY)}catch(x){}syncInstallBtn()});
window.addEventListener('appinstalled',()=>{deferredInstall=null;try{localStorage.setItem(INSTALLED_KEY,'1')}catch(e){}syncInstallBtn();
  installToast('✅ Thanks for installing Guide Master! Find it on your home screen. It plays offline, too.')});
// A short note at the bottom of the screen (the title screen has no event tiles).
function installToast(msg){
  document.querySelectorAll('.inst-toast').forEach(e=>e.remove());
  const el=document.createElement('div');el.className='inst-toast';el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.textContent=msg;
  document.body.appendChild(el);setTimeout(()=>el.remove(),6000);
}
// The other browsers' menu steps, by what this browser looks like.
function installSteps(){
  const ua=navigator.userAgent,mobile=/android|mobile/i.test(ua);
  if(/SamsungBrowser/i.test(ua))return ['Tap the menu button (☰) at the bottom of the screen.','Tap <b>Add page to</b>, then <b>Home screen</b>.','Tap <b>Add</b>. Guide Master is now on your home screen.'];
  if(/Firefox|FxiOS/i.test(ua)&&mobile)return ['Tap the browser menu (⋮).','Tap <b>Add app to Home screen</b> (or <b>Install</b>).','Tap <b>Add</b>. Guide Master is now on your home screen.'];
  if(/Firefox/i.test(ua))return ['Firefox on a computer can’t install web apps. Open this page in Chrome or Edge to install it.','Or simply bookmark it: once loaded, the game also plays offline in this browser.'];
  if(!mobile&&/Safari/i.test(ua)&&!/Chrome|Chromium|Edg/i.test(ua))return ['In Safari’s menu bar, choose <b>File → Add to Dock…</b> (macOS Sonoma or later).','Click <b>Add</b>. Guide Master opens from the Dock in its own window.'];
  if(!mobile)return ['Click the install icon (a screen with a down arrow) at the right end of the address bar,','or open the browser menu (⋮ or …) and choose <b>Install Guide Master</b> (Edge: <b>Apps → Install this site as an app</b>).','Click <b>Install</b>. Guide Master gets its own window and a desktop icon.'];
  return ['Open the browser menu (⋮), at the top right.','Tap <b>Install app</b> or <b>Add to Home screen</b>.','Tap <b>Install</b> (or <b>Add</b>). Guide Master is now on your home screen.'];
}
function installSheet(){
  const steps=installSteps();
  modal('📲 Install Guide Master',`<p>Put the game on your home screen: it opens full screen, like an app, and plays offline.</p>
  <ol class="inst-steps">${steps.map(s=>`<li>${s}</li>`).join('')}</ol>
  <p style="font-size:13px;color:var(--mute)">Don’t see it in the menu? Use the game for a minute and look again: some browsers only offer it after a short visit. On Android and computers the installed app keeps this browser’s saved games.</p>`,
  [{l:'Got it',fn:()=>{}}]);
}
window.doInstall=async()=>{
  if(deferredInstall){const ev=deferredInstall;deferredInstall=null;
    try{ev.prompt();const c=await ev.userChoice;if(c&&c.outcome==='accepted'){try{localStorage.setItem(INSTALLED_KEY,'1')}catch(e){}}}catch(e){}
    syncInstallBtn();return}
  if(isIOS()){if(typeof saveGame==='function'&&S&&!S.over)saveGame();location.href='install/ios.html';return}
  installSheet();
};
