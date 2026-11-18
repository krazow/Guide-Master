// ============================================================
//  GUIDE MASTER, part 18: illustrations (the art registry).
//  Optional raster illustrations that can sit on top of a screen: the Home tab and the fall cabin sheet (set "cabin"), the trip
//  sheet (set "boat"), the winter-camping screens (set "camp") and event pop-ups / the morning report (set "event").
//  EVERY image ships switched off. With no enabled entry, every hook below returns '' and the screen is exactly what it was
//  before; callers never need an "if". See art/README.md for how to add a set (tools/art.py import → review → enable → test).
//
//  ART.register(entry)        add or replace one manifest entry {id, set, file, thumb?, webp?, thumbWebp?, v?, w, h, alt, when, enabled}
//                             (enabled is false unless it is exactly true). Returns the stored entry, or null if it is unusable.
//  artFor(set, ctx)           the best ENABLED entry of a set whose `when` matches ctx, or null (the caller keeps its SVG art).
//                             Every key in `when` must match; the score is the number of keys that matched something specific
//                             ("any" matches but scores 0). Ties are broken by a stable hash of the day and the set, so a scene
//                             doesn't flicker between renders of the same day.
//  artImg(entry)              the <figure><img></figure> HTML (alt, width/height, lazy, async decode, srcset thumb/full, WebP)
//  artSlot(set, ctx)          artImg(artFor(set, ctx)) or '' (never throws)
//  artCabinCtx(), artBoatCtx(b, where), artCampCtx(session, extra), artEventCtx(id, from)
//                             build a ctx from the game's state (the keys are listed in ART.KEYS and art/README.md)
//
//  The manifest is art/manifest.json, embedded here by tools/build.py between the markers below. The images stay separate files
//  under art/ (cached on first use by sw.js, never precached) and are left out of the single-file offline build
//  (tools/build-offline.py --with-art inlines the enabled ones).
// ============================================================
const ART_MANIFEST=/*@ART@*/[]/*@/ART@*/;
const ART=(()=>{
  // the "when" keys each set understands (tools/art.py validates against the same lists)
  const KEYS={
    cabin:['heat','season','time','cond','has'],
    boat:['boat','where','cond','up','time','trip'],
    camp:['place','shelter','activity','time','weather'],
    event:['event','from','time'],
  };
  const ALL=[],ALLOF=['has','up'];   // array values under these keys must ALL be present in the context
  const isRange=v=>Array.isArray(v)&&v.length===2&&v.every(x=>typeof x==='number');
  function register(e){
    if(!e||typeof e!=='object'||!e.id||!KEYS[e.set]||!e.file) return null;
    const x=Object.assign({w:1600,h:900,alt:'',when:{}},e,{id:String(e.id),enabled:e.enabled===true});
    if(!x.when||typeof x.when!=='object') x.when={};
    const i=ALL.findIndex(y=>y.id===x.id);
    if(i>=0) ALL[i]=x; else ALL.push(x);
    return x;
  }
  // one key: -1 no match, 0 matched "any", 1 matched something specific
  function key(k,w,c){
    if(w===undefined||w===null||w==='any') return 0;
    if(c===undefined||c===null) return -1;
    const has=v=>Array.isArray(c)?c.includes(v):c===v;
    if(ALLOF.includes(k)){const need=Array.isArray(w)?w:[w];return !need.length?0:need.every(has)?1:-1}   // [] asks for nothing
    if(isRange(w)){const n=Array.isArray(c)?c[0]:c;return typeof n==='number'&&n>=w[0]&&n<=w[1]?1:-1}
    if(Array.isArray(w)) return w.some(v=>v==='any'||has(v))?1:-1;   // one of several values
    return has(w)?1:-1;
  }
  function score(e,ctx){
    let s=0;
    const known=KEYS[e.set];
    for(const k of Object.keys(e.when)){if(known&&!known.includes(k))continue;   // a key the set doesn't know is a note, not a condition (tools/art.py flags it)
      const m=key(k,e.when[k],ctx?ctx[k]:undefined);if(m<0)return -1;s+=m}
    return s;
  }
  // a small stable string hash (FNV-1a)
  function hash(str){let h=0x811c9dc5;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}return h>>>0}
  function pick(set,ctx,opts){
    const c=ALL.filter(e=>e.set===set&&(e.enabled||(opts&&opts.all)));
    let best=-1,top=[];
    c.forEach(e=>{const s=score(e,ctx||{});if(s<0)return;if(s>best){best=s;top=[e]}else if(s===best)top.push(e)});
    if(!top.length) return null;
    top.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    const seed=ctx&&ctx.seed!=null?ctx.seed:'';
    return top[hash(`${seed}|${set}`)%top.length];
  }
  const enabled=()=>ALL.filter(e=>e.enabled);
  return {KEYS,register,score,pick,hash,
    list:()=>ALL.slice(),enabled,any:()=>ALL.some(e=>e.enabled),get:id=>ALL.find(e=>e.id===id)||null,
    enable(id,on){const e=ALL.find(x=>x.id===id||x.set===id);ALL.forEach(x=>{if(x.id===id||x.set===id)x.enabled=on!==false});return !!e},
    clear(){ALL.length=0}};
})();
ART_MANIFEST.forEach(e=>ART.register(e));

// Settings → Illustrations (on by default; the switch only shows once an image is enabled)
const artPref=()=>prefs().art!==false;
const artOn=()=>ART.any()&&artPref();
function artFor(set,ctx){
  if(!artOn()) return null;
  const c=Object.assign({},ctx);
  if(c.seed==null) c.seed=S?(S.winter?'w'+S.winter.s:day()):0;   // the same scene all day; a new pick tomorrow
  return ART.pick(set,c);
}
// the image's address: files are relative to art/ (data:, blob: and http(s): addresses pass through, for tests and inlined builds)
const artUrl=(f,v)=>/^(data:|blob:|https?:)/.test(f)?f:`art/${f}${v?`?v=${encodeURIComponent(v)}`:''}`;
const artSaveData=()=>{try{return !!(navigator.connection&&navigator.connection.saveData)}catch(e){return false}};
function artImg(e){
  if(!e) return '';
  const lite=artSaveData()&&e.thumb,full=artUrl(e.file,e.v),th=e.thumb?artUrl(e.thumb,e.v):'';
  const sizes='(max-width: 520px) 100vw, 480px';
  const set=(f,t)=>t?`${t} 400w, ${f} ${e.w}w`:`${f} ${e.w}w`;
  const src=lite?th:full,srcset=lite?'':` srcset="${esc(set(full,th))}" sizes="${sizes}"`;
  const webp=e.webp&&!lite?`<source type="image/webp" srcset="${esc(set(artUrl(e.webp,e.v),e.thumbWebp?artUrl(e.thumbWebp,e.v):''))}" sizes="${sizes}">`:
    e.thumbWebp&&lite?`<source type="image/webp" srcset="${esc(artUrl(e.thumbWebp,e.v))}">`:'';
  const img=`<img class="art-img" src="${esc(src)}"${srcset} alt="${esc(e.alt||'')}" width="${e.w}" height="${e.h}" loading="lazy" decoding="async" style="object-fit:cover">`;
  return `<figure class="art-fig" data-art="${esc(e.id)}">${webp?`<picture>${webp}${img}</picture>`:img}</figure>`;
}
function artSlot(set,ctx){if(!artOn())return '';try{return artImg(artFor(set,typeof ctx==='function'?ctx():ctx))}catch(err){return ''}}   // pass ctx as a function: it is only built when art is on

// ---- context builders: what each set's "when" keys are matched against ----
// time of day the way the scene art draws it (05-ui.js sceneSVG): 'day' | 'dusk' | 'night'
function artTime(){
  if(!S) return 'day';
  const m=tod(),[rise,set]=SCENE.sun;
  return m<rise||m>set?'night':(m>=set-90&&m<=set+30)||(m>=rise-30&&m<=rise+60)?'dusk':'day';
}
// cabin: heat, season, time, cond, has
function artCabinCtx(){
  const s=cabin(),y=homeSeason(),t=artTime(),H=S.home||{},C=S.camp||{};
  const has=[
    genOf()&&'generator', H.frz&&'freezer', (C.gear||[]).includes('vise')&&'vise', s.detect&&'detectors', s.proc&&'processing',
    s.garden&&s.garden.y===y&&'garden', s.heat.stove&&'woodstove', s.heat.oil&&'propane',   // the furnace burns "heating oil or propane" (src/home)
    s.heat.oil&&'furnace', s.bin&&'bearbin', s.fence&&'fence', s.tape&&'heattape', s.skirt&&'skirting', s.strap&&'strapped', H.tank&&'fueltank',
  ].filter(Boolean);
  return {heat:[s.heat.oil&&'oil',s.heat.stove&&'wood'].filter(Boolean),season:S.winter?'winter':'summer',
    time:S.winter?['day','night']:t==='dusk'?['dusk','night']:t,   // the off-season has no clock: day and night scenes both fit
    cond:Math.round(s.cond),has};
}
// boat: boat, where, cond, up, time, trip. b is a booking; where is 'river' | 'launch' | 'harbor' | 'trailer' | 'shop' (or a list)
const artBoatKind=type=>type==='halibut'?'charter':type==='trout'?'drift':'sled';
function artBoatCtx(b,where){
  const U=S.up||{},s=seasonOf(day());
  const up=UPGRADES.map(u=>u.id).filter(id=>id==='web'||id==='course'?U[id]===s:id==='rates'?(U.rate||1)>1:!!U[id]);
  const kind=b?artBoatKind(b.type):'sled';
  return {boat:b&&b.asst?['staff',kind]:kind,where:where||(S.loc==='shop'?'shop':S.loc==='homer'?'harbor':'launch'),cond:Math.round(S.boat),up,time:artTime(),trip:b?b.type:null};
}
// camp: place, shelter, activity, time, weather, read from a KenaiCamp session (28-camping.js keeps the session handle; the engine
// itself never sees the game). extra: {activity, night} tracked by the adapter.
function artCampCtx(sess,extra){
  const ss=sess&&sess.state;if(!ss) return {time:'day'};
  const T=ss.trip,P=ss.plan,ph=ss.phase,x=extra||{};
  const night=['evening','night'].includes(ph)||(ph==='result'&&x.night);
  const wx=T?[T.clear&&'clear',T.thaw&&'thaw',T.events.includes('snowstorm')&&'snow',T.events.includes('coldsnap')&&'cold'].filter(Boolean):[];
  return {place:T?T.place:P&&P.place||null,shelter:T?T.shelter:P&&P.place?P.shelter:null,activity:T?x.activity||null:null,
    time:night?'night':'day',weather:wx,phase:ph};
}
// event: event (an id from defEvent, src/home's storm prompts or src/camp's encounters), from ('game' | 'home' | 'camp'), time
function artEventCtx(id,from){return {event:id,from:from||'game',time:S&&!S.winter?artTime():'day'}}
