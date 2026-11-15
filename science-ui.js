let terrainSession;
let terrainRoute;
let terrainResult;
let terrainMap;
let terrainLoadId = 0;

const routeDistance = new Intl.NumberFormat('es', { maximumFractionDigits: 2 });

function formatRouteDistance(meters) {
  return meters < 1000 ? `${routeDistance.format(Math.round(meters))} m` : `${routeDistance.format(meters / 1000)} km`;
}

async function terrainAnalysis() {
  phase = 'analysis';
  pressed.clear(); player.moving = false;
  const id = ++terrainLoadId;
  if (finishTyping) finishTyping();
  app.querySelector('.mission-dialogue').hidden = true;
  let panel = app.querySelector('.terrain-panel');
  if (!panel) { panel = document.createElement('section'); panel.className = 'terrain-panel'; app.querySelector('.mission-console').append(panel); }
  panel.innerHTML = '<h2 tabindex="-1">Análisis del terreno</h2><p role="status">Preparando el mapa y la ruta…</p>';
  panel.querySelector('h2').focus({preventScroll:true});
  try {
    terrainSession ??= await MoonMap.load();
    if (id !== terrainLoadId || !panel.isConnected) return;
    terrainRoute ??= terrainSession.data.routes[Math.floor(Math.random()*terrainSession.data.routes.length)];
    const route = terrainRoute;
    panel.innerHTML = `<div class="terrain-heading">
        <h2 tabindex="-1">Análisis del terreno</h2>
        <button data-action="scienceInfo" aria-haspopup="dialog">Detalles técnicos</button>
      </div>
      <div class="terrain-layout">
        <div class="terrain-map-host"></div>
        <section class="terrain-data" aria-labelledby="terrain-route-title">
          <h3 id="terrain-route-title">${route.name}</h3>
          <p class="terrain-difficulty">${route.difficulty}</p>
          <dl>
            <dt>Distancia de ida</dt><dd>${formatRouteDistance(route.distanceM)}</dd>
            <dt>Pendiente máxima</dt><dd>${routeDistance.format(route.maxSlopeDeg)}°</dd>
          </dl>
        </section>
      </div>
      <div class="terrain-footer">
        <p>Connecting Ridge · NASA Moon Trek</p>
        <button class="console-button" data-action="terrainDecision">Elegir explorador ▸</button>
      </div>`;
    terrainMap?.dispose();
    const session = terrainSession;
    session.update = () => {
      const dialog = document.querySelector('#science-info[open]');
      if (dialog && terrainSession === session) MoonMap.updateApiDetails(dialog, session);
    };
    terrainMap = MoonMap.mount(panel.querySelector('.terrain-map-host'), session, route);
    MoonMap.capabilities(terrainSession);
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
  missionDialogue(`La ruta ${terrainRoute.name} mide ${formatRouteDistance(terrainRoute.distanceM)} de ida. Compara el consumo y el riesgo antes de elegir quién saldrá. Ambos valores son estimaciones del juego.`,
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
  const minutes = Math.max(1, Math.round(r.elapsedHours * 60));
  let why;
  if (r.observations) {
    const explorer = r.mode === 'rover' ? 'El rover volvió' : 'El astronauta volvió a salvo';
    const distance = formatRouteDistance(terrainRoute.distanceM * 2);
    why = `${explorer} tras recorrer ${distance} entre ida y vuelta. Trajo observaciones de todo el recorrido para planear la próxima salida.`;
  } else if (r.mode === 'rover') {
    const reached = formatRouteDistance(terrainRoute.distanceM * r.failureProgress);
    why = `Perdimos la señal del rover a ${reached} de la base, antes de recibir observaciones. Sin el vehículo, tendremos que aplazar la exploración del cráter.`;
  } else {
    const reached = formatRouteDistance(terrainRoute.distanceM * r.failureProgress);
    why = `El astronauta dio la vuelta a ${reached} de la base y regresó a salvo. El estudio quedó pendiente. El rover sigue disponible para explorar el cráter.`;
  }
  game.log.push({title:missions[0].title,name:`${terrainRoute.name} · ${r.mode==='rover'?'Rover':'Astronauta'}`,success:r.observations,explanation:why});
  persistExpedition();
  phase='feedback';
  document.querySelector('#stats').innerHTML=stats();
  app.querySelector('.journey-map')?.remove();terrainMap?.dispose();
  if(r.observations)app.querySelector('.map-backdrop').src=platformMapped.src;
  const resourceSummary = changes(r.applied) || 'Sin cambios de recursos';
  missionDialogue(why, `<p class="choice-cost">${minutes} min simulados · ${resourceSummary}</p>
    <div class="result-actions"><button class="ship-button" data-action="scienceInfo" aria-haspopup="dialog">Detalles técnicos</button>
    ${missionContinue('next','Siguiente misión · E')}</div>`, r.status);
}
function scienceInfo() {
  if (!terrainSession || !terrainRoute) return;
  pressed.clear();
  const dialog = document.querySelector('#science-info');
  if (dialog.open) return;
  const { information, api } = MoonMap.technical(terrainSession, terrainRoute, terrainResult);
  const result = terrainResult ? `<section class="science-result"><h3>${MoonMap.escape(terrainResult.status)}</h3>
    <p>${MoonMap.escape(game.log[0]?.explanation || '')}</p></section>` : '';
  dialog.innerHTML = `<header><h2 id="science-info-title">Detalles técnicos</h2>
      <form method="dialog"><button aria-label="Cerrar detalles técnicos">Cerrar ×</button></form></header>
    <div class="science-tabs" role="tablist" aria-label="Detalles técnicos">
      <button id="science-information-tab" role="tab" aria-selected="true" aria-controls="science-information" autofocus>Información</button>
      <button id="science-api-tab" role="tab" aria-selected="false" aria-controls="science-api" tabindex="-1">API de NASA</button>
    </div>
    <section id="science-information" class="science-details" role="tabpanel" aria-labelledby="science-information-tab" tabindex="0">
      ${result}${information}
    </section>
    <section id="science-api" class="science-details" role="tabpanel" aria-labelledby="science-api-tab" tabindex="0" hidden>${api}</section>`;
  const tabs = [...dialog.querySelectorAll('[role="tab"]')];
  function selectTab(active) {
    for (const tab of tabs) {
      const selected = tab === active;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
    }
    active.focus();
  }
  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      const target = { ArrowLeft: tabs[1 - index], ArrowRight: tabs[1 - index], Home: tabs[0], End: tabs.at(-1) }[event.key];
      if (!target) return;
      event.preventDefault();
      selectTab(target);
    });
  }
  MoonMap.updateApiDetails(dialog, terrainSession);
  const profile = dialog.querySelector('.elevation-profile');
  drawElevation(profile, terrainRoute);
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
