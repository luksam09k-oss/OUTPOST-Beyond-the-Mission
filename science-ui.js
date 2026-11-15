let terrainSession;
let terrainRoute;
let terrainResult;
let terrainMap;
let terrainLoadId = 0;

const routeDistance = new Intl.NumberFormat(language, { maximumFractionDigits: 2 });

function formatRouteDistance(meters) {
  return meters < 1000 ? `${routeDistance.format(Math.round(meters))} m` : `${routeDistance.format(meters / 1000)} km`;
}

function routeTitle(route) {
  if (language === 'es') return route.name;
  return ['Reconnaissance Plain', 'Ridge Trail', 'Rough Slope', 'Shadow Approach'][route.id - 1] || route.name;
}

function reconnaissanceStatus(result) {
  if (result.observations) return t('Reconocimiento completado', 'Reconnaissance complete');
  return result.mode === 'rover' ? t('Señal perdida', 'Signal lost') : t('Retirada de emergencia', 'Emergency retreat');
}

async function terrainAnalysis() {
  phase = 'analysis';
  pressed.clear(); player.moving = false;
  const id = ++terrainLoadId;
  if (finishTyping) finishTyping();
  app.querySelector('.mission-dialogue').hidden = true;
  let panel = app.querySelector('.terrain-panel');
  if (!panel) { panel = document.createElement('section'); panel.className = 'terrain-panel'; app.querySelector('.mission-console').append(panel); }
  panel.innerHTML = `<h2 tabindex="-1">${t('Análisis del terreno', 'Terrain analysis')}</h2>
    <p role="status">${t('Preparando el mapa y la ruta…', 'Preparing the map and route…')}</p>`;
  panel.querySelector('h2').focus({preventScroll:true});
  try {
    terrainSession ??= await MoonMap.load();
    if (id !== terrainLoadId || !panel.isConnected) return;
    terrainRoute ??= terrainSession.data.routes[Math.floor(Math.random()*terrainSession.data.routes.length)];
    const route = terrainRoute;
    panel.innerHTML = `<div class="terrain-heading">
        <h2 tabindex="-1">${t('Análisis del terreno', 'Terrain analysis')}</h2>
        <button data-action="scienceInfo" aria-haspopup="dialog">${t('Ver más información', 'More information')}</button>
      </div>
      <div class="terrain-layout">
        <div class="terrain-map-host"></div>
        <section class="terrain-data" aria-labelledby="terrain-route-title">
          <h3 id="terrain-route-title">${routeTitle(route)}</h3>
          <p class="terrain-difficulty">${route.difficulty === 'Fácil' ? t('Fácil', 'Easy') : t('Difícil', 'Hard')}</p>
          <dl>
            <dt>${t('Distancia de ida', 'One-way distance')}</dt><dd>${formatRouteDistance(route.distanceM)}</dd>
            <dt>${t('Pendiente máxima', 'Steepest slope')}</dt><dd>${routeDistance.format(route.maxSlopeDeg)}°</dd>
          </dl>
        </section>
      </div>
      <div class="terrain-footer">
        <p>Connecting Ridge · NASA Moon Trek</p>
        <button class="console-button" data-action="terrainDecision">${t('Elegir explorador ▸', 'Choose explorer ▸')}</button>
      </div>`;
    terrainMap?.dispose();
    const session = terrainSession;
    session.update = () => {
      const dialog = document.querySelector('#science-info[open]');
      if (dialog?.querySelector('[data-api-map]') && terrainSession === session) MoonMap.updateApiDetails(dialog, session);
    };
    terrainMap = MoonMap.mount(panel.querySelector('.terrain-map-host'), session, route);
    MoonMap.capabilities(terrainSession);
    panel.querySelector('h2').focus({preventScroll:true});
  } catch (e) {
    if(id !== terrainLoadId || !panel.isConnected)return;
    panel.innerHTML = `<h2>${t('Análisis no disponible', 'Analysis unavailable')}</h2><p>${t('No se pudieron cargar los datos del terreno. Abre el juego desde un servidor web.', 'Terrain data could not be loaded. Open the game from a web server.')}</p><p>${MoonMap.escape(e.message)}</p><button data-action="terrainAnalysis">${t('Reintentar', 'Retry')}</button>`;
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
    return `<button data-action="choose" data-option="${i}">${i ? t('B · Exploración con astronauta', 'B · Send an astronaut') : t('A · Exploración robótica', 'A · Send the rover')}<small>${i ? t('Sale un astronauta y cuatro quedan protegidos.', 'One astronaut goes out and four remain sheltered.') : t('Los cinco astronautas permanecen protegidos.', 'All five astronauts stay sheltered.')}</small><small>${e.hours.toFixed(1)} h · ${i ? t('Retirada', 'Retreat') : t('Pérdida del rover', 'Rover loss')}: ${(e.risk*100).toFixed(1)} %</small><small class="choice-cost">${changes(e.delta)} · ${t('estimación si se completa', 'estimate if completed')}</small></button>`;
  }).join('');
  const distance = formatRouteDistance(terrainRoute.distanceM);
  missionDialogue(t(`La ruta mide ${distance} de ida. Compara el consumo y el riesgo antes de decidir.`,
    `The route is ${distance} one way. Compare resource use and risk before deciding.`),
    `<div class="choices">${choices}</div><button class="science-back" data-action="terrainAnalysis">${t('Revisar mapa', 'Review map')}</button>`,
    t('Selecciona tu explorador', 'Choose your explorer'));
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
    const explorer = r.mode === 'rover' ? t('El rover volvió', 'The rover returned') : t('El astronauta volvió a salvo', 'The astronaut returned safely');
    const distance = formatRouteDistance(terrainRoute.distanceM * 2);
    why = t(`${explorer} tras recorrer ${distance} entre ida y vuelta. Trajo observaciones de todo el recorrido para planear la próxima salida.`,
      `${explorer} after a ${distance} round trip. We have observations from the full route to plan the next outing.`);
  } else if (r.mode === 'rover') {
    const reached = formatRouteDistance(terrainRoute.distanceM * r.failureProgress);
    why = t(`Perdimos la señal del rover a ${reached} de la base, antes de recibir observaciones. Sin el vehículo, tendremos que aplazar la exploración del cráter.`,
      `We lost the rover's signal ${reached} from base, before receiving observations. Crater exploration will have to wait.`);
  } else {
    const reached = formatRouteDistance(terrainRoute.distanceM * r.failureProgress);
    why = t(`El astronauta dio la vuelta a ${reached} de la base y regresó a salvo. El estudio quedó pendiente. El rover sigue disponible para explorar el cráter.`,
      `The astronaut turned back ${reached} from base and returned safely. The survey is unfinished. The rover is still available for the crater.`);
  }
  game.log.push({id: 'contact', title:missions[0].title,name:`${routeTitle(terrainRoute)} · ${r.mode === 'rover' ? 'Rover' : t('Astronauta', 'Astronaut')}`,success:r.observations,explanation:why});
  persistExpedition();
  phase='feedback';
  document.querySelector('#stats').innerHTML=stats();
  app.querySelector('.journey-map')?.remove();terrainMap?.dispose();
  if (r.observations) setMapBackdrop(app.querySelector('.map-backdrop'), platformMapped);
  const resourceSummary = changes(r.applied) || t('Sin cambios de recursos', 'No resource changes');
  missionDialogue(why, `<p class="choice-cost">${minutes} ${t('min simulados', 'simulated min')} · ${resourceSummary}</p>
    <div class="result-actions"><button class="ship-button" data-action="scienceInfo" aria-haspopup="dialog">${t('Ver más información', 'More information')}</button>
    ${missionContinue('next',t('Siguiente misión · E','Next mission · E'))}</div>`, reconnaissanceStatus(r));
}
function scienceInfo() {
  if (!terrainSession || !terrainRoute) return;
  pressed.clear();
  const { information, api } = MoonMap.technical(terrainSession, terrainRoute, terrainResult);
  const result = terrainResult ? `<section class="science-result"><h3>${reconnaissanceStatus(terrainResult)}</h3>
    <p>${MoonMap.escape(game.log[0]?.explanation || '')}</p></section>` : '';
  const dialog = showTechnicalDialog(result + information, api);
  if (!dialog) return;
  MoonMap.updateApiDetails(dialog, terrainSession);
  drawElevation(dialog.querySelector('.elevation-profile'), terrainRoute);
}

function showTechnicalDialog(information, api, {
  title = t('Detalles técnicos', 'Technical details'),
  informationTitle = t('Información', 'Information')
} = {}) {
  pressed.clear();
  const dialog = document.querySelector('#science-info');
  if (dialog.open) return;
  dialog.innerHTML = `<header><h2 id="science-info-title">${title}</h2>
      <form method="dialog"><button aria-label="${t('Cerrar detalles técnicos', 'Close technical details')}">${t('Cerrar ×', 'Close ×')}</button></form></header>
    <div class="science-tabs" role="tablist" aria-label="${title}">
      <button id="science-information-tab" role="tab" aria-selected="true" aria-controls="science-information" autofocus>${informationTitle}</button>
      <button id="science-api-tab" role="tab" aria-selected="false" aria-controls="science-api" tabindex="-1">${t('API de NASA', 'NASA APIs')}</button>
    </div>
    <section id="science-information" class="science-details" role="tabpanel" aria-labelledby="science-information-tab" tabindex="0">
      ${information}
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
  dialog.showModal();
  return dialog;
}
function persistExpedition() { try { localStorage.setItem('outpost-expedition',JSON.stringify({game,routeId:terrainRoute?.id,result:terrainResult,version:1,scientificAudit:terrainSession ? {timestamp:terrainSession.timestamp,logs:terrainSession.logs,mapStatus:terrainSession.mapStatus,capabilitiesStatus:terrainSession.capabilitiesStatus} : null})); } catch {} }
async function resumeExpedition() {
  let saved;try {saved=JSON.parse(localStorage.getItem('outpost-expedition'));}catch{return;}
  if(!saved || saved.version!==1 || !saved.game?.log?.length)return;
  game = saved.game;
  const oldOrder = ['contact', 'crater', 'resources', 'solar', 'return'];
  game.log.forEach((entry, index) => { entry.id ??= oldOrder[index]; });
  solarRun = game.solar;
  terrainResult = saved.result;
  terrainRoute = null;
  try {terrainSession=await MoonMap.load();terrainRoute=terrainSession.data.routes.find(r=>r.id===saved.routeId);if(saved.scientificAudit)Object.assign(terrainSession,saved.scientificAudit);}catch {terrainSession=null;}
  continueExpedition();
}
