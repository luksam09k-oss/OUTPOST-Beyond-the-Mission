const {JSDOM}=require('jsdom'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),manifest=require('../data/nasa/wmts.json');
async function check(mode) {
 const dom=new JSDOM('<div id="map"></div>',{url:'http://localhost',runScripts:'outside-only'}),w=dom.window,context=dom.getInternalVMContext(),requests=[];
 w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>{}});
 w.AbortSignal.timeout=()=>undefined;
 w.createImageBitmap=async()=>({width:256,height:256,close(){}});
 w.fetch=async url=>{
  requests.push(url);
  if(url.startsWith('https:')&&mode!=='live')throw new Error('Offline test');
  const file=url.startsWith('https:') ? url.endsWith('.xml')?'data/nasa/WMTSCapabilities.xml':manifest.tiles.find(t=>t.url===url)?.file:url;
  if(mode==='unavailable'&&file?.endsWith('.png'))return {ok:false,status:404};
  if(!file)throw new Error('Unknown endpoint');
  const bytes=fs.readFileSync(path.join(root,file));
  return {ok:true,status:200,json:async()=>JSON.parse(bytes),text:async()=>bytes.toString(),blob:async()=>new w.Blob([bytes]),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
 };
 for(const f of ['i18n.js','science.js','moon-map.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context);
 await vm.runInContext(`(async()=>{window.testSession=await MoonMap.load();await MoonMap.capabilities(testSession);MoonMap.mount(document.querySelector('#map'),testSession,testSession.data.routes[0]);})()`,context);
 for(let i=0;i<100 && w.document.querySelector('.map-status').textContent.includes('cargando');i++)await new Promise(r=>setTimeout(r,5));
 const status=w.document.querySelector('.map-status').textContent,s=w.testSession;
 assert(requests.includes(manifest.capabilities));assert(s.logs.some(l=>l.service==='Moon Trek GetTile'));
 if(mode==='live'){assert(s.capabilitiesStatus.includes('HTTP correcto'));assert(s.logs.filter(l=>l.service==='Moon Trek GetTile').every(l=>l.source==='NASA · solicitud HTTP'));}
 else {assert(s.capabilitiesStatus.includes('locales'));assert(s.logs.filter(l=>l.service==='Moon Trek GetTile').every(l=>mode==='cached'?l.source==='Caché local NASA':l.status==='Error'));}
 assert.equal(status, `Moon Trek: ${{live:'en línea',cached:'copia local',unavailable:'mapa no disponible'}[mode]}`);
 assert.match(s.mapStatus, /mosaicos por HTTP/);
 dom.window.close();console.log('PASS WMTS '+mode+': '+status);
}
(async()=>{for(const mode of ['live','cached','unavailable'])await check(mode);})().catch(e=>{console.error(e);process.exitCode=1;});
