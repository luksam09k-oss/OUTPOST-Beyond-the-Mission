const crew = [
  { name: t('Tú', 'You'), role: t('Exploración', 'Exploration'), color: '#ffcd76' },
  { name: 'Vega', role: t('Comandante', 'Commander'), color: '#aa94ff' },
  { name: 'Lina', role: t('Geóloga', 'Geologist'), color: '#7cebbb' },
  { name: 'Mateo', role: t('Ingeniero', 'Engineer'), color: '#7bdeff' },
  { name: 'Noa', role: t('Médica', 'Medic'), color: '#ff9aa9' }
];

const lunarMissions = [
  {
    id: 'contact', title: missionTitles.contact, location: t('Plataforma lunar', 'Lunar platform'), target: t('la terminal de exploración', 'the exploration terminal'),
    action: t('Revisar el terreno', 'Survey the terrain'), objective: t('Reconocer el terreno lunar y seleccionar una ruta de exploración.', 'Survey the lunar terrain and select a route.'),
    problem: t('La tripulación de cinco astronautas debe estudiar el terreno antes de desplazarse. NASA utiliza instrumentos como LOLA y LROC para analizar elevaciones, pendientes, iluminación y características de la superficie.', 'The five astronauts must survey the terrain before moving out. NASA uses instruments like LOLA and LROC to study terrain, slopes, and lighting.'),
    x: 128, y: platformY, platform: 'first-contact',
    // Scientific decisions and costs are computed from LOLA in science-ui.js.
    options: []
  },
  {
    id: 'crater', title: missionTitles.crater, location: t('Polo sur lunar', 'Lunar South Pole'), target: t('la estación de escaneo', 'the scanning station'),
    action: t('Elegir zona para el rover', 'Choose a rover destination'), platform: 'crater', x: 160, y: craterPlatformY,
    objective: t('Investigar un cráter lunar, estudiar sus condiciones de iluminación y buscar posibles indicios de hielo de agua.', 'Investigate a lunar crater, its lighting, and possible signs of water ice.'),
    problem: t('La tripulación llega a un cráter cercano al polo sur lunar. Algunas zonas reciben luz solar durante largos períodos, mientras otras permanecen en oscuridad permanente y presentan temperaturas extremadamente bajas.', 'The crew reaches a crater near the lunar South Pole. Some areas get sunlight for long periods. Others stay permanently dark and extremely cold.'),
    explanation: t('NASA investiga los cráteres polares porque sus regiones permanentemente sombreadas pueden conservar hielo. Sin embargo, estas zonas presentan dificultades energéticas y térmicas. Los astronautas permanecen protegidos en ambas opciones; las diferencias de radiación representan la duración de la operación.', 'NASA studies polar craters because permanently shadowed regions can hold ice. The darkness and cold make operations harder. The crew stays sheltered and the radiation difference reflects how long the operation lasts.'),
    options: [
      [t('Explorar el borde iluminado', 'Explore the sunlit rim'), [-8, -10, 5], true, t('Obtener información que facilite futuras exploraciones.', 'Collect information for future exploration.'), t('Enviar un rover a la zona iluminada para estudiar el terreno e identificar rutas seguras. La luz solar facilita la generación de energía, pero limita la investigación del interior del cráter.', 'Send the rover to the sunlit rim to find safe routes. Sunlight helps power the rover, but it will learn less about the crater interior.')],
      [t('Explorar el interior del cráter', 'Explore inside the crater'), [-18, -14, 7], true, t('Obtener información sobre posibles reservas de agua para futuras misiones.', 'Collect information about possible water reserves for future missions.'), t('Enviar un rover a una región permanentemente sombreada para investigar posibles depósitos de hielo de agua. La falta de luz solar y las temperaturas extremas dificultan la operación.', 'Send the rover into a permanently shadowed region to look for water ice. Lack of sunlight and extreme cold make the trip harder.')]
    ]
  },
  {
    id: 'solar', title: missionTitles.solar, location: t('Base lunar', 'Lunar Base'),
    target: t('la entrada al refugio', 'the shelter entrance'),
    action: t('Consultar la alerta', 'Check the alert'),
    objective: t('Protege a la tripulación ante la actividad solar.', 'Protect the crew during solar activity.'),
    x: 316, y: 142, options: []
  }
];

let missions = lunarMissions;
let destination = 'moon';
function selectDestination(value) { destination = value === 'mars' ? 'mars' : 'moon'; missions = destination === 'mars' ? marsMissions : lunarMissions; }

const initialResources = [100, 100, 0];
const directions = {
  arrowup: [0,-1], w: [0,-1], arrowdown: [0,1], s: [0,1],
  arrowleft: [-1,0], a: [-1,0], arrowright: [1,0], d: [1,0]
};
const app = document.querySelector('#app');
const help = document.querySelector('#help');
const pressed = new Map();
let screen;
let game;
let player;
let frame;
let phase;
let launchOpening;
let reconnaissance;

function nasaBadge() {
  return '<img class="mission-badge" src="assets/nasa-space-apps.webp" alt="NASA Space Apps Challenge 2026">';
}

function header() {
  return `<canvas class="mission-sky" width="384" height="216" aria-hidden="true"></canvas><header class="top"><div class="brand">OUTPOST</div>${nasaBadge()}<button class="console-button" data-action="help">${t('Cómo jugar', 'How to play')}</button></header>`;
}

function show(next, html) {
  screen = next;
  app.dataset.screen = next;
  pressed.clear();
  cancelAnimationFrame(frame);
  if (finishTyping) finishTyping();
  app.innerHTML = html;
  app.querySelectorAll('[data-portrait]').forEach(canvas => {
    const id = canvas.dataset.portrait;
    sprite(painter(canvas), 5, 3, crew[Number(id)].color);
  });
  const backdrop = app.querySelector('.mission-sky');
  if (backdrop) drawMissionSky(backdrop);
  app.querySelector('h1')?.focus({ preventScroll: true });
}

function start() {
  show('opening', document.querySelector('#opening-template').innerHTML);
  localizeMarkup(app);
  localizeMarkup(help);
  app.querySelector(`.language-options a[lang="${language}"]`).setAttribute('aria-current', 'true');
  launchOpening = animateOpening(enterShip);
  try {
    const saved=JSON.parse(localStorage.getItem('outpost-expedition'));
    if (saved?.game?.log?.length && !new URLSearchParams(location.search).has('replay')) {
      const resume=document.createElement('button');resume.className='resume-expedition';resume.dataset.action='resumeExpedition';resume.textContent=t('Continuar expedición guardada', 'Resume saved expedition');app.querySelector('#stage').append(resume);
    }
  } catch {}
}

function movementButtons(horizontalOnly = false) {
  if (horizontalOnly) return `<div class="directions" aria-label="${t('Movimiento horizontal', 'Horizontal movement')}">
    <button data-move="arrowleft" aria-label="${t('Izquierda', 'Left')}">←</button><button data-move="arrowright" aria-label="${t('Derecha', 'Right')}">→</button>
  </div>`;
  return `<div class="directions" aria-label="${t('Movimiento', 'Movement')}">
    <button data-move="arrowleft" aria-label="${t('Izquierda', 'Left')}">←</button><button data-move="arrowup" aria-label="${t('Arriba', 'Up')}">↑</button>
    <button data-move="arrowdown" aria-label="${t('Abajo', 'Down')}">↓</button><button data-move="arrowright" aria-label="${t('Derecha', 'Right')}">→</button>
  </div>`;
}

function movePlayer(elapsed, speed, minX, maxX, minY, maxY) {
  let dx = 0;
  let dy = 0;
  if (!help.open && !document.querySelector('#science-info').open) {
    for (const [x, y] of pressed.values()) { dx += x; dy += y; }
  }
  const length = Math.hypot(dx, dy);
  player.moving = length > 0;
  if (!length) return;
  if (dx) player.facing = Math.sign(dx);
  player.x = Math.max(minX, Math.min(maxX, player.x + dx / length * elapsed * speed));
  player.y = Math.max(minY, Math.min(maxY, player.y + dy / length * elapsed * speed));
}

function briefing() {
  show('briefing', `
    <section class="briefing" aria-labelledby="briefing-title">
      <canvas class="briefing-sky" width="320" height="180" aria-hidden="true"></canvas>
      ${nasaBadge()}
      <div class="briefing-frame console-frame">
        <p class="kicker briefing-tag">${destination === 'mars' ? t('Misión marciana', 'Mars Mission') : t('Misión lunar', 'Lunar Mission')}</p>
        <div class="briefing-title">
          <div class="briefing-orbit" aria-hidden="true"><span>✦</span></div>
          <h1 id="briefing-title" tabindex="-1">${t('Tripulación de la base', 'Base Crew')}</h1>
        </div>
        <ul class="crew" aria-label="${t('Cinco tripulantes', 'Five crew members')}">${crew.map((person, i) =>
          `<li>${i === 0 ? '<span class="crew-player" aria-hidden="true"></span>' : `<canvas width="26" height="26" data-portrait="${i}" aria-hidden="true"></canvas>`}<strong>${person.name}</strong><small>${person.role}</small></li>`).join('')}</ul>
      </div>
      <div class="briefing-dialogue dialogue-dock"></div>
    </section>`);
  renderNovelDialogue(app.querySelector('.briefing-dialogue'), destination === 'mars' ? 'curiosity' : 'neil',
    destination === 'mars' ? t('Bienvenidos a Jezero. Exploraremos el terreno, protegeremos la base del polvo y probaremos cómo producir oxígeno. Cinco tripulantes, tres misiones: cada decisión cuenta.', 'Welcome to Jezero. Survey the terrain, protect the base from dust and try producing oxygen. Five crew members, three missions: every decision counts.') : t('Tu equipo debe estudiar el suelo lunar y mantener segura la base. Vamos a empezar reconociendo el terreno para elegir una ruta de exploración.',
      'Your crew must study the lunar soil and keep the base safe. Start by surveying the terrain and picking a route.'),
    dialogueContinue('begin', t('Comenzar misión · E', 'Start mission · E')));
  animateOpening(null, app.querySelector('.briefing-sky'));
}

function stats() {
  const icons = ['ϟ', 'O₂', '☢'];
  return game.resources.map((value, i) => `<div class="stat console-frame" data-resource="${i}">
    <span class="stat-icon" aria-hidden="true">${icons[i]}</span><span>${resourceNames[i]}</span><strong>${value}%</strong>
    <meter min="0" max="100" low="26" high="74" optimum="${i === 2 ? 0 : 100}" value="${value}" aria-label="${resourceNames[i]}"></meter>
  </div>`).join('');
}

function begin() {
  solarRun = undefined;
  solarLoading = undefined;
  resetMars();
  game = { destination, index: 0, log: [], resources: [...initialResources], roverAvailable: true, reconnaissanceData: false };
  terrainLoadId++;terrainMap?.dispose();terrainSession=null;terrainRoute=null;terrainResult=null;
  try {
    localStorage.removeItem('outpost-expedition');
    sessionStorage.removeItem('outpost-report');
  } catch {}
  scene('base');
}

const base = { title: t('Base lunar', 'Lunar Base'), location: t('Base lunar', 'Lunar Base'), target: t('la terminal de investigación', 'the research terminal'),
  action: t('Abrir expedición', 'Start expedition'), objective: t('Reúnete con tu equipo y activa la terminal de investigación.', 'Meet your crew and activate the research terminal.'), x: 134, y: 143 };

function scene(nextPhase) {
  if (destination === 'mars') return marsScene(nextPhase);
  const mission = nextPhase === 'base' ? base : missions[game.index];
  if (mission.id === 'solar' && !solarRun) solarLoading ??= Solar.load();
  phase = mission.platform === 'first-contact' ? 'arrival' : nextPhase;
  reconnaissance = null;
  player = { x: mission.platform === 'first-contact' ? platformDoorX : mission.platform ? 62 : 188,
    y: mission.platform ? mission.y : 155, facing: 1, moving: false };
  show('map', `${header()}<section class="mission-heading">
      <p class="kicker">${nextPhase === 'base' ? t('ESTABLECIMIENTO', 'BASE SETUP') : `${t('MISIÓN', 'MISSION')} ${game.index+1} / ${missions.length} · ${mission.location.toUpperCase()}`}</p>
      <h1 tabindex="-1">${mission.title}</h1>
    </section>
    <div class="dashboard mission-console">
      <div class="stats" id="stats">${stats()}</div>
      <section class="panel objective console-frame" id="mission-panel">
        <h2><span aria-hidden="true">⌖</span> ${t('Objetivo', 'Objective')}</h2>
        <p>${mission.objective}</p>
      </section>
      <div class="mission-viewport">
        <div class="map-frame">
          <img class="map-backdrop" alt="" fetchpriority="high">
          <span class="map-emblem" aria-hidden="true"></span>
          <canvas id="map" width="384" height="216" aria-label="${t('Mapa de', 'Map of')} ${mission.location}"></canvas>
        </div>
      </div>
      <div class="mission-dialogue dialogue-dock" hidden></div>
      <div class="controls">${movementButtons(mission.platform)}
        <p id="hint" aria-live="polite"></p>
        <button class="console-button interact" data-action="interact" disabled>${t('Interactuar · E', 'Interact · E')}</button>
      </div>
    </div>`);
  const canvas = document.querySelector('#map');
  const backdrop = app.querySelector('.map-backdrop');
  const missionImage = mission.platform === 'first-contact' ? platformOpen : mission.platform ? craterOutpost
    : lunarInterior;
  setMapBackdrop(backdrop, missionImage);
  const interactButton = app.querySelector('[data-action="interact"]');
  const hint = document.querySelector('#hint');
  const movement = app.querySelectorAll('[data-move]');
  let lastTime;
  let scenerySince;
  function tick(time) {
    const elapsed = lastTime === undefined ? 0 : Math.min(40, time-lastTime);
    lastTime = time;
    if (phase === 'arrival') {
      if (backdrop.complete) scenerySince ??= time;
      if (scenerySince !== undefined && time-scenerySince >= 850) explainMission(mission);
    } else if (reconnaissance?.solar && phase === 'cinematic') {
      if (!help.open && !document.querySelector('#science-info').open) reconnaissance.elapsed += elapsed;
      const progress = Math.min(1, reconnaissance.elapsed / reconnaissance.duration);
      drawEvacuation(canvas, progress, time);
      if (progress === 1) finishSolarEvacuation();
    } else if (mission.platform) {
      if (phase === 'explore') movePlayer(elapsed, .1, 12, 372, mission.y, mission.y);
      if (phase === 'cinematic' && !help.open && !document.querySelector('#science-info').open && (!reconnaissance.route || backdrop.complete)) {
        reconnaissance.elapsed += elapsed;
        if(reconnaissance.scientific) updateTerrainJourney();
        if (reconnaissance.elapsed >= reconnaissance.duration) {
          if(reconnaissance.scientific) finishTerrainJourney();
          else {
            if (!reconnaissance.route) setMapBackdrop(backdrop, platformMapped);
            applyDecision(reconnaissance.option);
          }
        }
      }
      drawPlatform(canvas, player, mission, phase, time, reconnaissance);
    } else {
      if (phase === 'base' || phase === 'explore') {
        movePlayer(elapsed, .1, 12, 372, 135, 168);
      }
      if (reconnaissance?.solar && phase === 'feedback') drawEvacuation(canvas, 1, time);
      else drawMap(canvas, player, mission, phase === 'base' || phase === 'explore', crew, time);
    }

    const canMove = allowsMovement();
    const controls = hint.parentElement;
    controls.hidden = !canMove && phase !== 'cinematic';
    controls.classList.toggle('cinematic-controls', phase === 'cinematic');
    movement.forEach(button => { button.disabled = !canMove; });
    const reachable = canMove && nearby(mission);
    interactButton.disabled = !reachable;
    const message = phase === 'cinematic' ? (mission.id === 'solar' ? t('Evacuación en curso…', 'Evacuation in progress…') : t('Reconocimiento en curso…', 'Reconnaissance in progress…')) : reachable ? `${t('Pulsa E', 'Press E')} · ${mission.action}` : canMove ? `${t('Acércate a', 'Approach')} ${mission.target}.` : '';
    if (hint.textContent !== message) hint.textContent = message;
    frame = requestAnimationFrame(tick);
  }
  if (nextPhase === 'explore' && phase !== 'arrival') explainMission(mission);
  frame = requestAnimationFrame(tick);
}

function nearby(mission) {
  return Math.hypot(player.x-mission.x, player.y-mission.y) <= 17;
}

function interact() {
  if (destination === 'mars') return marsInteract();
  if (screen !== 'map' || help.open) return;
  const mission = phase === 'base' ? base : missions[game.index];
  if ((phase !== 'base' && phase !== 'explore') || !nearby(mission)) return;
  if (phase === 'base') {
    scene('explore');
    return;
  }
  if (mission.id === 'contact') { terrainAnalysis(); return; }
  if (mission.id === 'solar') { solarAnalysis(); return; }
  if(game.index === 1 && !game.roverAvailable) {
    phase='feedback';
    const explanation=t('El rover se perdió en Primer contacto. Los cinco astronautas permanecen protegidos; aplazamos la exploración del cráter hasta disponer de otro vehículo. No se obtienen datos nuevos ni se cobran costes de una salida que no ocurrió.', 'The rover was lost during First Contact. The crew is safe, but crater exploration will wait until we have another rover. The canceled trip used no resources.');
    game.log.push({id:mission.id,title:mission.title,name:t('Exploración aplazada · sin rover', 'Exploration postponed · no rover'),success:false,explanation});persistExpedition();
    missionDialogue(explanation,dialogueContinue('next',t('Siguiente misión · E', 'Next mission · E')),t('Rover no disponible', 'Rover unavailable'));return;
  }
  phase = 'decision';
  pressed.clear();
  player.moving = false;
  const choices = `<div class="choices">${mission.options.map(([name, costs, , , description], i) =>
    `<button data-action="choose" data-option="${i}">
      ${mission.platform ? ['A · ', 'B · '][i] : ''}${name}
      ${description ? `<small>${description}</small>` : ''}
      <small class="choice-cost">${changes(costs)}</small>
    </button>`).join('')}</div>`;
  missionDialogue(mission.problem, choices, mission.action);
}

function missionDialogue(words, controls, title) {
  const overlay = app.querySelector('.mission-dialogue');
  overlay.hidden = false;
  renderNovelDialogue(overlay, destination === 'mars' ? 'curiosity' : 'neil', words, controls, 'h2', title);
}

function explainMission(mission) {
  phase = 'briefing';
  missionDialogue(mission.objective, dialogueContinue('explore', t('Continuar · E', 'Continue · E')), mission.title);
}

function explore() {
  if (phase !== 'briefing') return;
  phase = 'explore';
  pressed.clear();
  const overlay = app.querySelector('.mission-dialogue');
  overlay.hidden = true;
  app.querySelector('.mission-heading h1').focus({ preventScroll: true });
}

function changes(delta) {
  return delta.map((value, i) => value ? `${resourceNames[i]} ${value > 0 ? '+' : '−'}${Math.abs(value)}` : '').filter(Boolean).join(' · ');
}

function choose(option) {
  if (destination === 'mars') return marsChoose(option);
  if (phase !== 'decision') return;
  if (finishTyping) finishTyping();
  const mission = missions[game.index];
  if(game.index === 0 && !terrainRoute)return;
  if(game.index === 1 && !game.roverAvailable)return;
  if (mission.id === 'solar') { startSolarEvacuation(option); return; }
  if (!mission.platform) {
    applyDecision(option);
    return;
  }

  phase = 'cinematic';
  const route = mission.platform === 'crater' ? craterRoutes[option] : null;
  const rover = Boolean(route) || option === 0;
  reconnaissance = { option, rover, route, elapsed: 0, duration: reducedMotion.matches ? 240 : 4800,
    startX: rover ? platformDoorX : player.x };
  if(game.index === 0)startTerrainJourney(option);
  if (route) {
    const backdrop = app.querySelector('.map-backdrop');
    setMapBackdrop(backdrop, route.image);
    app.querySelector('.mission-heading .kicker').textContent = `${t('MISIÓN', 'MISSION')} 2 / ${missions.length} · ${route.label}`;
  }
  const overlay = app.querySelector('.mission-dialogue');
  overlay.hidden = true;
  app.querySelector('.mission-heading h1').focus({ preventScroll: true });
}

function applyDecision(option) {
  const mission = missions[game.index];
  const [name, delta, success, explanation] = mission.options[option];
  const before = game.resources;
  game.resources = before.map((value, i) => Math.min(100, Math.max(0, value + delta[i])));
  const applied = game.resources.map((value, i) => value - before[i]);
  game.log.push({ id: mission.id, title: mission.title, name, success, explanation: mission.explanation ? `${explanation} ${mission.explanation}` : explanation });
  persistExpedition();
  phase = 'feedback';
  document.querySelector('#stats').innerHTML = stats();
  const continuation = dialogueContinue('next', game.index === missions.length - 1 ? t('Ver resultados', 'View results') : t('Siguiente misión · E', 'Next mission · E'));
  const benefit = mission.explanation ? `<p class="mission-benefit"><strong>${t('Beneficio', 'Benefit')}</strong> · ${explanation}</p>` : '';
  missionDialogue(mission.explanation || explanation, `${benefit}<p class="choice-cost">${changes(applied)}</p>${continuation}`,
    success ? t('Objetivo completado', 'Objective complete') : t('Objetivo parcial', 'Partial objective'));
}

function next() {
  if (phase !== 'feedback') return;
  continueExpedition();
}

function continueExpedition() {
  const [energy, oxygen, radiation] = game.resources;
  const pending = missions.findIndex(mission => !game.log.some(entry => entry.id === mission.id));
  if (pending >= 0 && energy > 0 && oxygen > 0 && radiation < 100) {
    game.index = pending;
    scene('explore');
  } else {
    results();
  }
}

function results() {
  game.finished = true;
  persistExpedition();
  try { sessionStorage.setItem('outpost-report', JSON.stringify(game)); } catch {}
  show('results', '');
  openReport();
}

function openReport() {
  location.assign(`${destination === 'mars' ? 'mars-finale.html' : 'results.html'}?lang=${language}`);
}

const actions = {
  marsAnalysis, marsRouteShort: () => marsRouteSelect(0), marsRouteLong: () => marsRouteSelect(1), marsInfo, marsView,
  advance, talk, begin, interact, next, explore, terrainAnalysis, terrainDecision, scienceInfo, resumeExpedition, solarDecision, solarInfo,
  returnToStart: start,
  help: () => { pressed.clear(); help.showModal(); }
};
app.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (button.hasAttribute('data-dialogue-continue') && finishTyping) finishTyping();
  else if (action === 'choose') choose(Number(button.dataset.option));
  else actions[action]?.();
});

document.addEventListener('keydown', event => {
  if (help.open || document.querySelector('#science-info').open) return;
  const key = event.key.toLowerCase();
  if (screen === 'opening' && (key === 'enter' || key === ' ') && !event.target.closest('a, button')) {
    event.preventDefault();
    launchOpening();
  } else if ((screen === 'ship' || screen === 'map') && directions[key]) {
    event.preventDefault();
    if (allowsMovement() && !(screen === 'map' && phase === 'explore' && missions[game.index].platform && directions[key][1])) {
      pressed.set(key, directions[key]);
    }
  } else if (key === 'e' && !event.repeat) {
    const advanceButton = app.querySelector('.dialogue-dock:not([hidden]) [data-dialogue-continue]');
    if (advanceButton) advanceButton.click();
    else if (finishTyping) finishTyping();
    else if (screen === 'ship') talk();
    else if (screen === 'map') interact();
  } else if ((key === 'enter' || key === ' ') && !event.repeat && !event.target.closest('a, button')) {
    const advanceButton = app.querySelector('.dialogue-dock:not([hidden]) [data-dialogue-continue]');
    if (advanceButton) {
      event.preventDefault();
      advanceButton.click();
    }
  }
});
document.addEventListener('keyup', event => pressed.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => pressed.clear());
function allowsMovement() {
  if(document.querySelector('#science-info').open)return false;
  if (screen === 'ship') return !dialogue;
  return screen === 'map' && (phase === 'base' || phase === 'explore');
}

app.addEventListener('pointerdown', event => {
  const button = event.target.closest('[data-move]');
  if (!button || help.open || !allowsMovement()) return;
  button.setPointerCapture(event.pointerId);
  pressed.set(event.pointerId, directions[button.dataset.move]);
});
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  app.addEventListener(eventName, event => pressed.delete(event.pointerId));
}

start();
