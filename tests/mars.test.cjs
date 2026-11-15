const {JSDOM}=require('jsdom'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),science=require('../data/mars/science.json'),terrain=require('../data/mars/routes.json'),manifest=require('../data/mars/wmts.json'),Mars=require('../mars-science.js');
for(const tile of manifest.tiles)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,tile.file))).digest('hex'),tile.sha256);
for(const r of terrain.routes){assert(r.distanceM>0&&r.maxSlopeDeg>0);assert.equal(r.coordinates.length,r.points.length);assert(Math.abs(r.distanceM-r.points.at(-1)[4])<.001);assert(r.coordinates.every(([lon,lat])=>lon>77.4&&lon<77.45&&lat>18.43&&lat<18.47));}
assert(terrain.routes[1].distanceM>terrain.routes[0].distanceM*3);
for(const record of science.meda){const rows=fs.readFileSync(path.join(root,record.extractFile),'utf8').trim().split('\n'),fields=rows.shift().split(','),idx=fields.indexOf('RDS_TOP_7');assert.equal(rows.length,record.count);const mean=rows.reduce((s,row)=>s+Number(row.split(',')[idx]),0)/rows.length;assert(Math.abs(mean-record.irradiance)<1e-8);assert(record.quality.antennaFlagMissing);}
for(const record of science.moxie){assert(record.producedG>5&&record.producedG<10);assert(record.energyWh>600);assert(record.cycleHours>record.productionHours);const a=Mars.oxygenPlan(record,0),b=Mars.oxygenPlan(record,1);assert(a.delta[0]<b.delta[0]);assert(a.delta[1]>b.delta[1]);assert(a.delta[1]-b.delta[1]<.2);assert(a.oxygenUsedG>record.producedG*60);assert(Mars.oxygenPlan(record,0,50).delta[0]>a.delta[0]);}
const low=Mars.dustScenario(science.meda[0],()=>0),high=Mars.dustScenario(science.meda[1],()=>1);
assert(low.maintenanceAllowed&&!high.maintenanceAllowed);assert.equal(Mars.dustResult(high,1),null);assert(low.solarW>high.solarW);assert(Mars.dustResult(low,1,()=>0).recoveredW>0);assert.equal(Mars.dustResult(low,1,()=>1).recoveredW,0);
function setup(mode='cached',html='index.html') {
 const dom=new JSDOM(fs.readFileSync(path.join(root,html),'utf8'),{url:'https://outpost.test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,context=dom.getInternalVMContext();
 const canvas=new Proxy({measureText:()=>({width:30}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,p)=>p in o?o[p]:()=>{}});
 w.HTMLCanvasElement.prototype.getContext=()=>canvas;w.matchMedia=()=>({matches:true,addEventListener(){}});w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};w.AbortSignal.timeout=()=>undefined;w.createImageBitmap=async()=>({width:256,height:256,close(){}});
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.fetch=async url=>{
  if(url.startsWith('https:')&&mode!=='live')throw new Error('Offline test');
  let file=url;
  if(url.startsWith('https:'))file=url===manifest.capabilities?'data/mars/WMTSCapabilities.xml':manifest.tiles.find(tile=>tile.url===url)?.file||science.pds.find(p=>p.url===url)?.file;
  if(mode==='unavailable'&&file.endsWith('.png'))return {ok:false,status:404};
  const bytes=fs.readFileSync(path.join(root,file));return {ok:true,status:200,json:async()=>JSON.parse(bytes),text:async()=>bytes.toString(),blob:async()=>new w.Blob([bytes]),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
 };
 const run=s=>vm.runInContext(s,context);
 for(const script of w.document.querySelectorAll('script[src]'))vm.runInContext(fs.readFileSync(path.join(root,script.getAttribute('src')),'utf8'),context,{filename:script.getAttribute('src')});
 return {dom,w,run};
}
(async()=>{
 const {dom,w,run}=setup();run('openReport=()=>{};selectDestination("mars");begin()');await run('loadMars()');
 let paths=0;
 for(let route=0;route<2;route++)for(const dustMode of ['save','clean','failed','blocked'])for(let ox=0;ox<2;ox++)for(let rec=0;rec<2;rec++) {
  run('Math.random=()=>.5;begin()');await run('loadMars()');run('scene("explore");explore()');await run('marsAnalysis()');
  assert.equal(w.document.querySelector('.dialog-name').textContent,'Curiosity');
  run(`marsRouteSelect(${route});marsChoose(${route});finishMarsOperation();finishMarsOperation()`);assert.equal(run('game.log.length'),1);run('marsInfo()');assert(w.document.querySelector('#science-information').textContent.includes('CTX'));w.document.querySelector('#science-info').close();
  run('next();explore()');await run('marsAnalysis()');
  run(`game.mars.dust=MarsScience.dustScenario(marsSession.science.meda[1],()=>${dustMode==='blocked'?1:0});marsDecision()`);
  if(dustMode==='blocked'){assert(w.document.querySelector('[data-option="1"]').disabled);run('marsChoose(1)');assert.equal(run('phase'),'decision');}
  run(`Math.random=()=>${dustMode==='failed'?.999:0};marsChoose(${['clean','failed'].includes(dustMode)?1:0});finishMarsOperation()`);
  run('marsInfo()');assert(w.document.querySelector('#science-information').textContent.includes('RDS_TOP_7'));w.document.querySelector('#science-info').close();
  assert.equal(run('game.log.length'),2,JSON.stringify({route,dustMode,ox,rec,phase:run('phase'),game:run('JSON.stringify(game)')}));const saved=run('JSON.stringify(game)');await run('resumeExpedition()');assert.equal(run('destination'),'mars');assert.equal(run('game.log.length'),2);assert.equal(run('game.index'),2);assert.equal(run('game.resources.join()'),JSON.parse(saved).resources.join());
  run('explore()');await run('marsAnalysis()');run(`game.mars.oxygen=marsSession.science.moxie[${rec}];marsDecision();marsChoose(${ox});finishMarsOperation();marsInfo()`);assert(w.document.querySelector('#science-information').textContent.includes('F_O2_I_G_HR'));w.document.querySelector('#science-info').close();
  run('next()');assert.equal(run('screen'),'results');assert(run('game.resources.every(v=>Number.isFinite(v)&&v>0&&v<100)'));assert.equal(run('game.log.map(e=>e.id).join()'),'mars-contact,dust,oxygen');assert.equal(run('game.finished'),true);paths++;
 }
 const report=JSON.parse(w.sessionStorage.getItem('outpost-report'));dom.window.close();
 for(const mode of ['live','cached','unavailable']) {
  const {dom,w,run}=setup(mode);run('selectDestination("mars");begin()');await run('loadMars()');await run('MarsData.capabilities(marsSession);MarsData.metadata(marsSession,"meda")');run('scene("explore");explore()');await run('marsAnalysis()');
  for(let i=0;i<100&&w.document.querySelector('.map-status').textContent.includes('cargando');i++)await new Promise(r=>setTimeout(r,1));
  const status=w.document.querySelector('.map-status').textContent;
  assert.match(status,new RegExp(mode==='live'?'en línea':mode==='cached'?'copia verificada':'no disponible'));
  assert.equal(run('marsSession.logs.find(l=>l.service.includes("GetCapabilities")).status'),mode==='live'?'ok':'unavailable');
  assert.equal(run('marsSession.logs.find(l=>l.service==="PDS Search").source'),mode==='live'?'network-metadata':'cached-metadata');
  dom.window.close();
 }
 const end=new JSDOM(fs.readFileSync(path.join(root,'mars-finale.html'),'utf8'),{url:'https://outpost.test/mars-finale.html',runScripts:'outside-only',pretendToBeVisual:true});
 const ew=end.window,ec=end.getInternalVMContext();ew.sessionStorage.setItem('outpost-report',JSON.stringify(report));ew.matchMedia=()=>({matches:true});let pendingFrame;ew.requestAnimationFrame=callback=>{pendingFrame=callback;return 1;};ew.cancelAnimationFrame=()=>{};ew.HTMLCanvasElement.prototype.getContext=()=>new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(o,p)=>p in o?o[p]:()=>{}});
 for(const script of ew.document.querySelectorAll('script[src]'))vm.runInContext(fs.readFileSync(path.join(root,script.getAttribute('src')),'utf8'),ec);
 pendingFrame(16);pendingFrame(32);vm.runInContext('closeFinalDialogue()',ec);pendingFrame(48);vm.runInContext('SpaceCenterScene.player.x=450',ec);ew.dispatchEvent(new ew.KeyboardEvent('keydown',{key:'e'}));pendingFrame(64);assert.match(ew.document.querySelector('#finale-status').textContent,/Dentro del centro/);vm.runInContext('SpaceCenterScene.player.x=350',ec);ew.dispatchEvent(new ew.KeyboardEvent('keydown',{key:'e'}));pendingFrame(80);assert.equal(ew.document.querySelector('.dialog-name').textContent,'Directora Vanessa');
 for(let i=0;i<4;i++)ew.document.querySelector('[data-action="finalNext"]').click();assert.equal(ew.document.querySelectorAll('.final-resource-list li').length,3);assert.match(ew.document.querySelector('.portrait-art img').src,/directora-retrato.webp/);end.window.close();
 console.log(`PASS Mars: ${paths} full expedition paths, persisted resources, all science panels, WMTS live/cache/error, authentic extracts and director ending.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
