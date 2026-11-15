let terrainSession;
let terrainRoute;
let terrainResult;
let terrainMap;
let terrainLoadId = 0;

async function terrainAnalysis() {
  phase = 'analysis';
  pressed.clear(); player.moving = false;
  const id = ++terrainLoadId;
  if (finishTyping) finishTyping();
  app.querySelector('.mission-dialogue').hidden = true;
  let panel = app.querySelector('.terrain-panel');
  if (!panel) { panel = document.createElement('section'); panel.className = 'terrain-panel'; app.querySelector('.mission-console').append(panel); }
  panel.innerHTML = '<h2 tabindex="-1">ANÁLISIS DEL TERRENO</h2><p role="status">Consultando NASA Moon Trek y preparando el perfil LOLA…</p>';
  panel.querySelector('h2').focus({preventScroll:true});
  try {
    terrainSession ??= await MoonMap.load();
    if (id !== terrainLoadId || !panel.isConnected) return;
    terrainRoute ??= terrainSession.data.routes[Math.floor(Math.random()*terrainSession.data.routes.length)];
    const r = terrainRoute, estimate = LunarScience.estimate(r,'rover');
    panel.innerHTML = `<div class="terrain-heading"><div><p class="kicker">CARTOGRAFÍA LUNAR · SITE01</p><h2 tabindex="-1">Análisis del terreno</h2></div><button data-action="scienceInfo">Ver datos originales</button></div>
      <div class="terrain-layout"><div class="terrain-map-host"></div><div class="terrain-data">
      <h3>${r.name}</h3><p class="terrain-difficulty">${r.difficulty} · ruta de exploración</p>
      <dl><dt>Distancia de ida</dt><dd>${(r.distanceM/1000).toFixed(2)} km</dd><dt>Pendiente máxima</dt><dd>${r.maxSlopeDeg.toFixed(1)}°</dd><dt>Desnivel (máx. − mín.)</dt><dd>${r.reliefM.toFixed(1)} m</dd><dt>Elevación</dt><dd>${r.elevationMinM.toFixed(0)}–${r.elevationMaxM.toFixed(0)} m</dd><dt>Tiempo con rover</dt><dd>${estimate.hours.toFixed(1)} h</dd><dt>Riesgo del rover</dt><dd>${(estimate.risk*100).toFixed(1)} %</dd></dl>
      <canvas class="elevation-profile" width="360" height="100" aria-label="Perfil de elevación de LOLA"></canvas>
      <p class="profile-caption">Perfil LOLA · distancia de ida / elevación (m)</p>
      <div class="nasa-data"><strong>DATOS DE NASA</strong><p>LOLA: modelo histórico local · 5 m/píxel.</p><p class="nasa-connection" role="status">Moon Trek: consultando…</p><p>RadLab / DONKI: no integrados.</p></div>
      </div></div><div class="terrain-footer"><p>Datos cartográficos: <a href="https://trek.nasa.gov/moon/" target="_blank" rel="noopener">NASA Moon Trek API / LRO</a> · Connecting Ridge<br><small>Terreno real; base, rutas, tiempos y riesgos de juego. La sombra no se mide con esta capa.</small></p><button class="console-button" data-action="terrainDecision">Elegir explorador ▸</button></div>`;
    terrainMap?.dispose();
    terrainMap = MoonMap.mount(panel.querySelector('.terrain-map-host'), terrainSession, r);
    terrainSession.update = () => {
      const node = panel.querySelector('.nasa-connection');
      if (node) node.textContent = `${terrainSession.mapStatus || 'Moon Trek: consultando…'} · ${terrainSession.capabilitiesStatus}. Consulta: ${new Date(terrainSession.timestamp).toLocaleTimeString()}`;
    };
    MoonMap.capabilities(terrainSession);
    drawElevation(panel.querySelector('.elevation-profile'), r);
    panel.querySelector('h2').focus({preventScroll:true});
  } catch (e) {
    if(id !== terrainLoadId || !panel.isConnected)return;
    panel.innerHTML = `<h2>Análisis no disponible</h2><p>No pudimos cargar los archivos científicos locales. Abre el juego desde un servidor HTTP (por ejemplo, GitHub Pages). No se usarán mediciones inventadas.</p><p>${MoonMap.escape(e.message)}</p><button data-action="terrainAnalysis">Reintentar</button>`;
  }
}
function drawElevation(canvas, route) {
  const ctx=canvas.getContext('2d'),z0=route.elevationMinM,z1=route.elevationMaxM;
  ctx.fillStyle='#09162c';ctx.fillRect(0,0,360,100);ctx.strokeStyle='#80f6ff';ctx.lineWidth=2;ctx.beginPath();
  route.points.forEach((p,i)=>{const x=12+p[4]/route.distanceM*335,y=76-(p[2]-z0)/Math.max(1,z1-z0)*54;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();
  ctx.fillStyle='#cbeaff';ctx.font='11px monospace';ctx.fillText(`${z1.toFixed(0)} m`,8,12);ctx.fillText(`${z0.toFixed(0)} m`,8,96);ctx.fillText(`${route.distanceM.toFixed(0)} m`,285,96);
}
function terrainDecision() {
  if(phase !== 'analysis' || !terrainRoute)return;
  terrainMap?.dispose();app.querySelector('.terrain-panel')?.remove();
  phase='decision';
  const choices = ['rover','astronaut'].map((mode,i)=>{
    const e=LunarScience.estimate(terrainRoute,mode);
    return `<button data-action="choose" data-option="${i}">${i?'B · Exploración con astronauta':'A · Exploración robótica'}<small>${i?'Sale un astronauta; cuatro quedan protegidos.':'Los cinco astronautas permanecen protegidos.'}</small><small>${e.hours.toFixed(1)} h · ${i?'Retirada':'Pérdida del rover'}: ${(e.risk*100).toFixed(1)} %</small><small class="choice-cost">${changes(e.delta)} · estimación si se completa</small></button>`;
  }).join('');
  missionDialogue(`La ruta ${terrainRoute.name} mide ${(terrainRoute.distanceM/1000).toFixed(2)} km de ida. Con estos datos de LOLA, decide cómo reconocerla. Los costes y el riesgo son una simulación.`,
    `<div class="choices">${choices}</div><button class="science-back" data-action="terrainAnalysis">Revisar mapa</button>`, 'Selecciona tu explorador');
}
function startTerrainJourney(option) {
  terrainResult=LunarScience.outcome(terrainRoute,option===0?'rover':'astronaut');
  reconnaissance.scientific = true;
  reconnaissance.duration = reducedMotion.matches ? 900 : 9000;
  const mini=document.createElement('div');mini.className='journey-map';
  app.querySelector('.mission-viewport').append(mini);
  terrainSession.progress=0;terrainSession.lost=false;
  terrainMap=MoonMap.mount(mini,terrainSession,terrainRoute,true);
}
function updateTerrainJourney() {
  const t=Math.min(1,reconnaissance.elapsed/reconnaissance.duration),r=terrainResult;
  let p;
  if(!r.failed) p=t<.45?t/.45:t<.55?1:(1-t)/.45;
  else if(r.mode==='rover') p=Math.min(1,t/.68)*r.failureProgress;
  else p=(t<.5?t*2:(1-t)*2)*r.failureProgress;
  reconnaissance.travelProgress=Math.max(0,p);
  reconnaissance.returning=t>.55 && !(r.failed && r.mode==='rover');
  terrainSession.progress=p;terrainSession.lost=r.failed && r.mode==='rover' && t>.68;
  reconnaissance.signalLost=terrainSession.lost;
  terrainMap?.draw();
}
function finishTerrainJourney() {
  const r=terrainResult,before=game.resources;
  game.resources=before.map((v,i)=>Math.min(100,Math.max(0,v+r.delta[i])));
  r.applied=game.resources.map((v,i)=>v-before[i]);
  game.roverAvailable=r.roverAvailable;
  game.reconnaissanceData=r.observations;
  // Persist vehicle state within this expedition, including reload-resume.
  const why=r.failed ? r.mode==='rover'?'El rover dejó de transmitir antes de llegar al destino. No recibimos observaciones nuevas. Conservamos el consumo acumulado y el vehículo ya no está disponible.':'El astronauta inició una retirada de emergencia antes de completar el estudio y regresó a salvo. El rover permanece en la base.' : 'El equipo volvió a la base y transmitió sus observaciones. La distancia y las pendientes determinaron el tiempo y el consumo.';
  game.log.push({title:missions[0].title,name:`${terrainRoute.name} · ${r.mode==='rover'?'Rover':'Astronauta'}`,success:r.observations,explanation:why});
  persistExpedition();
  phase='feedback';
  document.querySelector('#stats').innerHTML=stats();
  app.querySelector('.journey-map')?.remove();terrainMap?.dispose();
  if(r.observations)app.querySelector('.map-backdrop').src=platformMapped.src;
  missionDialogue(r.status,`<p class="choice-cost">${changes(r.applied)}</p><div class="result-actions"><button class="ship-button" data-action="scienceInfo">Ver más información</button>${missionContinue('next','Siguiente misión · E')}</div>`, 'Resultados de la misión');
}
function scienceInfo() {
  if(!terrainSession || !terrainRoute)return;
  pressed.clear();
  const dialog=document.querySelector('#science-info');
  dialog.innerHTML=`<header><h2>Datos y explicación de la misión</h2><form method="dialog"><button aria-label="Cerrar información">Cerrar ×</button></form></header><div class="science-details">${terrainResult ? `<p><strong>${MoonMap.escape(terrainResult.status)}</strong></p><p>${MoonMap.escape(game.log[0]?.explanation || '')}</p>` : ''}${MoonMap.technical(terrainSession,terrainRoute,terrainResult)}</div>`;
  dialog.showModal();
}
function persistExpedition() { try { localStorage.setItem('outpost-expedition',JSON.stringify({game,routeId:terrainRoute?.id,result:terrainResult,version:1,scientificAudit:terrainSession ? {timestamp:terrainSession.timestamp,logs:terrainSession.logs,mapStatus:terrainSession.mapStatus,capabilitiesStatus:terrainSession.capabilitiesStatus} : null})); } catch {} }
async function resumeExpedition() {
  let saved;try {saved=JSON.parse(localStorage.getItem('outpost-expedition'));}catch{return;}
  if(!saved || saved.version!==1 || !saved.game?.log?.length)return;
  game=saved.game;terrainResult=saved.result;terrainRoute=null;
  try {terrainSession=await MoonMap.load();terrainRoute=terrainSession.data.routes.find(r=>r.id===saved.routeId);if(saved.scientificAudit)Object.assign(terrainSession,saved.scientificAudit);}catch {terrainSession=null;}
  game.index=game.log.length;
  if(game.index>=missions.length || game.resources[0]<=0 || game.resources[1]<=0 || game.resources[2]>=100)results();else scene('explore');
}
