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
for(const file of ['i18n.js','opening.js','art.js','ship.js','science.js','moon-map.js','science-ui.js','viewport.js','solar.js','solar-ui.js','game.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const run=s=>vm.runInContext(s,context);
run('openReport = () => {}');
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
 if (mask === 0) {
  assert.equal(w.document.querySelector('.mission-dialogue .dialog-name').textContent, 'Neil Armstrong');
  const message = w.document.querySelector('.mission-dialogue .dialog-text').textContent;
  assert.match(message, failure ? mode ? /regresó a salvo.*rover sigue disponible/ : /Perdimos la señal.*aplazar/ : /observaciones de todo el recorrido/);
  assert.match(w.document.querySelector('.mission-dialogue .choice-cost').textContent, /min simulados.*Energía/);
 }
 const stored=JSON.parse(w.localStorage.getItem('outpost-expedition'));assert.equal(stored.game.roverAvailable,!(failure&&mode===0));
 run('next()');
 for(let mission=1;mission<5;mission++) {
  if(run('screen')==='results')break;
  run('explore();player.x=missions[game.index].x;player.y=missions[game.index].y');
  if (mission === 2) {
   const option = (mask >> 1) & 1;
   run(`solarRun = { level: 'moderate', measurement: { absorbed_dose_rate: 13 } }; phase = 'solar-analysis';
    solarDecision(); choose(${option}); finishSolarEvacuation(); next();`);
   continue;
  }
  run('interact()');
  if(mission===1 && failure&&mode===0) {assert.equal(run('phase'),'feedback');assert.equal(run('game.log.at(-1).success'),false);}
  else {const opt=(mask>>(mission-1))&1;run(`choose(${opt});if(phase==='cinematic')applyDecision(${opt})`);assert.equal(run('phase'),'feedback');}
  run('next()');
 }
 assert.equal(run('screen'),'results');
 assert(JSON.parse(w.sessionStorage.getItem('outpost-report')).finished);
 assert(run('game.resources.every(v=>v>=0&&v<=100)'));
 assert.equal(run('game.roverAvailable'),!(failure&&mode===0));
 paths++;
}
// Movement locked throughout analysis, choices, and all cinematics.
for(const p of ['analysis','decision','briefing','cinematic','feedback']) {run(`screen='map';phase='${p}'`);assert.equal(run('allowsMovement()'),false);}
async function checkSciencePanels() {
 run('begin(); scene("explore");');
 await run('terrainAnalysis()');
 const overview = w.document.querySelector('.terrain-panel');
 assert.deepEqual([...overview.querySelectorAll('dt')].map(node => node.textContent), ['Distancia de ida', 'Pendiente máxima']);
 assert.equal(overview.querySelector('.elevation-profile'), null);
 overview.querySelector('[data-action="scienceInfo"]').click();
 const dialog = w.document.querySelector('#science-info');
 assert(dialog.open);
 const info = dialog.querySelector('#science-information');
 const api = dialog.querySelector('#science-api');
 const infoTab = dialog.querySelector('#science-information-tab');
 const apiTab = dialog.querySelector('#science-api-tab');
 assert(!info.hidden && api.hidden);
 assert(info.querySelector('.elevation-profile'));
 assert(api.querySelector('[data-api-log]'));
 infoTab.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
 assert.equal(apiTab.getAttribute('aria-selected'), 'true');
 assert(info.hidden && !api.hidden);
 infoTab.click();
 assert(!info.hidden && api.hidden);
 dialog.close();
 run(`begin(); game.index = 2; scene('explore'); solarRun = {
   level: 'high', measurement: { instrument_id: 'CRaTER-D1D2', absorbed_dose_rate: 13, timestamp: '2020-05-09T00:59:58' },
   event: null, eventSource: 'none', measurementSource: 'cache', queries: []
 }; phase = 'solar-analysis'; solarDecision(); choose(1);`);
 assert.equal(run('phase'), 'decision');
 assert.equal(w.document.querySelector('.choices button:last-child').disabled, true);
 run('solarInfo()');
 assert.match(dialog.textContent, /órbita lunar/);
 dialog.close();
 run('choose(0); finishSolarEvacuation()');
 assert.match(w.document.querySelector('.mission-dialogue').textContent, /Evacuación completada/);
 console.log(`PASS: ${paths} expedition combinations, Neil's debriefs, simplified route overview, and keyboard-accessible technical tabs.`);
}
checkSciencePanels().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => dom.window.close());
