const {JSDOM}=require('jsdom');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,context=dom.getInternalVMContext();
const canvas=new Proxy({measureText:()=>({width:30}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})}, {get:(o,p)=>p in o?o[p]:()=>{}});
w.HTMLCanvasElement.prototype.getContext=()=>canvas;
w.matchMedia=()=>({matches:true,addEventListener(){}});
w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};
w.fetch=async url=>({ok:true,status:200,json:async()=>JSON.parse(fs.readFileSync(path.join(root,url),'utf8'))});
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
w.HTMLDialogElement.prototype.close=function(){this.open=false;};
for(const file of ['opening.js','art.js','ship.js','science.js','moon-map.js','science-ui.js','viewport.js','game.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const run=s=>vm.runInContext(s,context);
const data=JSON.parse(fs.readFileSync(path.join(root,'data/nasa/routes.json')));w.testData=data;
// Headless DOM checks are intentionally not claimed as visual rendering tests.
run(`enterShip();`);assert.equal(run('allowsMovement()'),false);
for(let i=0;i<5;i++)run('advance()');assert.equal(run('allowsMovement()'),true);
run('player.x=71;player.y=68;talk()');assert(run("app.textContent.includes('Marte todavía no está disponible')"));run('advance()');
run('player.x=30;player.y=68;talk();advance()');assert.equal(run('screen'),'briefing');assert.equal(w.document.querySelectorAll('.crew li').length,5);
let paths=0;
for(let route=0;route<4;route++)for(let mode=0;mode<2;mode++)for(let failure=0;failure<2;failure++)for(let mask=0;mask<16;mask++) {
 run(`begin(); terrainRoute=testData.routes[${route}];terrainSession={data:testData,manifest:{},logs:[]};
 scene('explore');phase='decision';terrainResult=LunarScience.outcome(terrainRoute,${mode?'"astronaut"':'"rover"'},()=>${failure?0:.999});
 reconnaissance={scientific:true,rover:${mode===0},elapsed:9000,duration:9000};finishTerrainJourney();`);
 assert.equal(run('game.log.length'),1);
 const stored=JSON.parse(w.localStorage.getItem('outpost-expedition'));assert.equal(stored.game.roverAvailable,!(failure&&mode===0));
 run('next()');
 for(let mission=1;mission<5;mission++) {
  if(run('screen')==='results')break;
  run('explore();player.x=missions[game.index].x;player.y=missions[game.index].y;interact()');
  if(mission===1 && failure&&mode===0) {assert.equal(run('phase'),'feedback');assert.equal(run('game.log.at(-1).success'),false);}
  else {const opt=(mask>>(mission-1))&1;run(`choose(${opt});if(phase==='cinematic')applyDecision(${opt})`);assert.equal(run('phase'),'feedback');}
  run('next()');
 }
 assert.equal(run('screen'),'results');
 assert(run('game.resources.every(v=>v>=0&&v<=100)'));
 assert.equal(run('game.roverAvailable'),!(failure&&mode===0));
 paths++;
}
// Movement locked throughout analysis, choices, and all cinematics.
for(const p of ['analysis','decision','briefing','cinematic','feedback']) {run(`screen='map';phase='${p}'`);assert.equal(run('allowsMovement()'),false);}
console.log(`PASS: intro lock, five crew, Mars unavailable, ${paths} expedition combinations, lost rover across missions, saved state, resources and results.`);
dom.window.close();
