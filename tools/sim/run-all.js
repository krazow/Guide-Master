// Balance simulator runner: plays bot careers against the built game in headless Chromium.
// Env: IDX (game html, default ../../index.html) STYLES DIFFS YEARS N (careers per cell) W (parallel pages) OUT PATCH OVER
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const N=+process.env.N||20, W=+process.env.W||2;
const styles=(process.env.STYLES||'food,expert,phone,skilled,passive,ignores,opport').split(',');
const diffs=(process.env.DIFFS||'normal,hard').split(','), yrs=(process.env.YEARS||'5').split(',').map(Number);
const IDX=path.resolve(process.env.IDX||path.join(__dirname,'..','..','index.html'));
const LIB=path.resolve(process.env.LIB||path.join(__dirname,'sim-lib.js'));
const outDir=path.join(__dirname,'out');fs.mkdirSync(outDir,{recursive:true});
const out=process.env.OUT?path.resolve(process.env.OUT):path.join(outDir,'results.json');
const over=process.env.OVER?JSON.parse(process.env.OVER):undefined;
const seed0=+process.env.SEED0||0;
(async()=>{
 const jobs=[];for(const style of styles)for(const diff of diffs)for(const years of yrs)for(let i=0;i<N;i++)jobs.push({style,diff,years,seed:100000+(i+seed0)*7+years,over});
 const br=await chromium.launch();const res=[];const errs=[];let idx=0;const t0=Date.now();
 async function worker(){
  const pg=await br.newPage();pg.on('pageerror',e=>errs.push(String(e)));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await pg.goto('file://'+IDX);await pg.waitForSelector('.title');
  await pg.addScriptTag({path:LIB});await pg.evaluate(()=>simSetup());if(process.env.PATCH)await pg.evaluate(process.env.PATCH);
  while(idx<jobs.length){const j=jobs[idx++];try{res.push(await pg.evaluate(o=>runCareer(o),j))}catch(e){errs.push('job '+JSON.stringify(j)+' '+e)}}
 }
 await Promise.all(Array.from({length:W},worker));
 fs.writeFileSync(out,JSON.stringify(res));
 console.log('done',res.length,'jobs in',Math.round((Date.now()-t0)/1000),'s; page errors:',errs.length,JSON.stringify(errs.slice(0,2)).slice(0,300));
 await br.close();
})();
