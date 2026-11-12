// Summarise result files: node tools/sim/analyze.js out/a.json [out/b.json ...]
// Per style/difficulty/years: mean season score (non-lost careers), grade mix, key score parts.
// Styles ending _c / _n are the careful / neglect home policies; with MATRIX=1 they are shown beside the default (_d) with the neglect cost.
const CUTS=(process.env.CUTS||'62000,55000,44000,27000').split(',').map(Number);
const g=s=>s>=CUTS[0]?'A':s>=CUTS[1]?'B':s>=CUTS[2]?'C':s>=CUTS[3]?'D':'F';
let R=[];process.argv.slice(2).forEach(f=>R=R.concat(require(require('path').resolve(f))));
const avg=a=>a.reduce((x,y)=>x+y,0)/(a.length||1);const sd=a=>{const m=avg(a);return Math.sqrt(avg(a.map(x=>(x-m)**2)))};
const mix=(a,y)=>{const o={A:0,B:0,C:0,D:0,F:0};a.forEach(r=>o[r.loss?'F':g(r.score/y)]++);return Object.entries(o).filter(x=>x[1]).map(([k,n])=>k+n).join('')};
const sc=(a,y)=>a?avg(a.filter(r=>!r.loss).map(r=>r.score/y)):0;
const se=(a,y)=>a&&a.length?sd(a.filter(r=>!r.loss).map(r=>r.score/y))/Math.sqrt(a.length):0;
if(process.env.MATRIX){
 const key={};R.forEach(r=>{const m=r.style.match(/^(.*?)(_c|_n)?$/);const k=[m[1],r.diff,r.years].join(' ');(key[k]=key[k]||{})[m[2]||'_d']=((key[k]||{})[m[2]||'_d']||[]).concat(r)});
 for(const k of Object.keys(key).sort()){const y=+k.split(' ')[2],c=key[k];const cs=sc(c._c,y),ds=sc(c._d,y),ns=sc(c._n,y);
  console.log(k.padEnd(18),'C',Math.round(cs),mix(c._c||[],y).padEnd(9),'D',Math.round(ds),mix(c._d||[],y).padEnd(9),'N',Math.round(ns),mix(c._n||[],y).padEnd(9),'neglect cost%',((1-ns/cs)*100).toFixed(1),'+-',Math.round(se(c._n,y)),'n',(c._n||[]).length)}
}else{
 const key={};R.forEach(r=>{const k=[r.style,r.diff,r.years].join(' ');(key[k]=key[k]||[]).push(r)});
 for(const k of Object.keys(key).sort()){
  const a=key[k],y=a[0].years,ok=a.filter(r=>!r.loss);
  const part=n=>Math.round(avg(ok.map(r=>(r.parts.find(p=>p[0]===n)||[0,0])[1]))/y);
  console.log(k.padEnd(18),'n',a.length,'mean',Math.round(sc(a,y)),'+-',Math.round(se(a,y)),mix(a,y).padEnd(14),'| net',part('Net cash'),'rest',part('Rest of this summer'),'asset',part('Boats & permits'),'rep',part('Reputation'),'trips',part('Trips'),'| lost',a.length-ok.length,'cites',avg(a.map(r=>r.cites||0)).toFixed(1))}
}
