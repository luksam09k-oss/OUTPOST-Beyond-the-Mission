const crew = [
  { name: 'Tú', role: 'Exploración', color: '#ffcd76' },
  { name: 'Vega', role: 'Comandante', color: '#aa94ff' },
  { name: 'Lina', role: 'Geóloga', color: '#7cebbb' },
  { name: 'Mateo', role: 'Ingeniero', color: '#7bdeff' },
  { name: 'Noa', role: 'Médica', color: '#ff9aa9' }
];

const missions = [
  {
    title: 'Primer contacto', location: 'Plataforma lunar', target: 'la terminal de exploración',
    action: 'Revisar el terreno', objective: 'Reconocer el terreno lunar y seleccionar una ruta de exploración.',
    problem: 'La tripulación de cinco astronautas debe estudiar el terreno antes de desplazarse. NASA utiliza instrumentos como LOLA y LROC para analizar elevaciones, pendientes, iluminación y características de la superficie.',
    x: 128, y: platformY, platform: 'first-contact',
    // Scientific decisions and costs are computed from LOLA in science-ui.js.
    options: []
  },
  {
    title: 'Explorando el cráter', location: 'Polo sur lunar', target: 'la estación de escaneo',
    action: 'Elegir zona para el rover', platform: 'crater', x: 160, y: craterPlatformY,
    objective: 'Investigar un cráter lunar, estudiar sus condiciones de iluminación y buscar posibles indicios de hielo de agua.',
    problem: 'La tripulación llega a un cráter cercano al polo sur lunar. Algunas zonas reciben luz solar durante largos períodos, mientras otras permanecen en oscuridad permanente y presentan temperaturas extremadamente bajas.',
    explanation: 'NASA investiga los cráteres polares porque sus regiones permanentemente sombreadas pueden conservar hielo. Sin embargo, estas zonas presentan dificultades energéticas y térmicas. Los astronautas permanecen protegidos en ambas opciones; las diferencias de radiación representan la duración de la operación.',
    options: [
      ['Explorar el borde iluminado', [-8, -10, 5], true, 'Obtener información que facilite futuras exploraciones.', 'Enviar un rover a la zona iluminada para estudiar el terreno e identificar rutas seguras. La luz solar facilita la generación de energía, pero limita la investigación del interior del cráter.'],
      ['Explorar el interior del cráter', [-18, -14, 7], true, 'Obtener información sobre posibles reservas de agua para futuras misiones.', 'Enviar un rover a una región permanentemente sombreada para investigar posibles depósitos de hielo de agua. La falta de luz solar y las temperaturas extremas dificultan la operación.']
    ]
  },
  {
    title: 'Buscando recursos', location: 'Zona polar', target: 'el sensor del terreno', backdrop: 'polar',
    action: 'Examinar terreno frío', objective: 'Busca indicios de hielo en el suelo de una zona sombreada.',
    problem: 'El sensor detectó una señal débil. Para comprobarla tendrás que quedarte más tiempo fuera y gastar oxígeno del traje.',
    x: 267, y: 174, outside: true,
    options: [
      ['Usar el escáner y perforar', [-21, -27, 0], true, 'El análisis encontró indicios de hielo. Buscarlo a mayor profundidad te costó baterías y parte de la reserva de oxígeno.'],
      ['Marcar el punto en el mapa', [-5, -5, 0], false, 'Guardaste la ubicación para otra salida. Una señal débil necesita más mediciones.']
    ]
  },
  {
    title: 'Alerta solar', location: 'Base lunar', target: 'la entrada al refugio',
    action: 'Consultar la alerta', objective: 'Ve al refugio y avisa a los cinco tripulantes.',
    problem: 'Una alerta solar indica que podría aumentar la radiación. El equipo aún recoge datos afuera.',
    x: 316, y: 142, outside: false,
    options: [
      ['Entrar todos al refugio', [-4, -5, 2], true, 'Las paredes del refugio reducen la exposición. Apagaste equipos secundarios para ahorrar energía.'],
      ['Cerrar el equipo antes de entrar', [-11, -8, 30], false, 'Guardaste los datos, pero la tripulación estuvo expuesta más tiempo. Hay que vigilar su estado.']
    ]
  },
  {
    title: 'Regreso seguro', location: 'Base lunar', target: 'los controles de soporte vital',
    action: 'Revisar soporte vital', objective: 'Restablece la circulación de aire y cierra la expedición.',
    problem: 'Un ventilador del soporte vital se averió. Queda una pieza de repuesto y un circuito de emergencia.',
    x: 286, y: 140, outside: false,
    options: [
      ['Instalar el repuesto', [-9, -7, 0], true, 'La pieza nueva reparó el ventilador. La base puede seguir operando con normalidad.'],
      ['Activar el circuito de emergencia', [-3, -24, 0], false, 'El circuito de emergencia mantuvo el aire en circulación. El circuito gasta más oxígeno de reserva y la reparación queda pendiente.']
    ]
  }
];

const resourceNames = ['Energía', 'Oxígeno', 'Radiación'];
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
  return '<div class="mission-badge"><img class="nasa-mark" src="assets/nasa-insignia.png" alt=""><span>NASA<br>Space Apps<br>Challenge 2026</span></div>';
}

function header() {
  return `<canvas class="mission-sky" width="384" height="216" aria-hidden="true"></canvas><header class="top"><div class="brand">OUTPOST</div>${nasaBadge()}<button class="console-button" data-action="help">Cómo jugar</button></header>`;
}

function guide(message) {
  return `<div class="guide"><img src="assets/neil-retrato.webp" alt=""><div><strong>Neil Armstrong</strong><p>${message}</p></div></div>`;
}

function show(next, html) {
  screen = next;
  app.dataset.screen = next;
  pressed.clear();
  cancelAnimationFrame(frame);
  app.innerHTML = html;
  app.querySelectorAll('[data-portrait]').forEach(canvas => {
    const id = canvas.dataset.portrait;
    sprite(painter(canvas), 5, 3, crew[Number(id)].color);
  });
  const backdrop = app.querySelector('.mission-sky');
  if (backdrop) drawMissionSky(backdrop);
  app.querySelector('h1')?.focus({ preventScroll: true });
  scheduleViewportFit();
}

function start() {
  show('opening', document.querySelector('#opening-template').innerHTML);
  launchOpening = animateOpening(enterShip);
  try {
    const saved=JSON.parse(localStorage.getItem('outpost-expedition'));
    if(saved?.version===1 && saved.game?.log?.length) {
      const resume=document.createElement('button');resume.className='resume-expedition';resume.dataset.action='resumeExpedition';resume.textContent='Continuar expedición guardada';app.querySelector('#stage').append(resume);
    }
  } catch {}
}

function movementButtons(horizontalOnly = false) {
  if (horizontalOnly) return `<div class="directions" aria-label="Movimiento horizontal">
    <button data-move="arrowleft" aria-label="Izquierda">←</button><button data-move="arrowright" aria-label="Derecha">→</button>
  </div>`;
  return `<div class="directions" aria-label="Movimiento">
    <button data-move="arrowleft" aria-label="Izquierda">←</button><button data-move="arrowup" aria-label="Arriba">↑</button>
    <button data-move="arrowdown" aria-label="Abajo">↓</button><button data-move="arrowright" aria-label="Derecha">→</button>
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
        <p class="kicker briefing-tag">Misión lunar</p>
        <div class="briefing-title">
          <div class="briefing-orbit" aria-hidden="true"><span>✦</span></div>
          <h1 id="briefing-title" tabindex="-1">Tripulación de la base</h1>
        </div>
        ${guide('Tu equipo debe estudiar el suelo lunar y mantener segura la base. Vamos a empezar reconociendo el terreno para elegir una ruta de exploración.')}
        <ul class="crew" aria-label="Cinco tripulantes">${crew.map((person, i) =>
          `<li>${i === 0 ? '<span class="crew-player" aria-hidden="true"></span>' : `<canvas width="26" height="26" data-portrait="${i}" aria-hidden="true"></canvas>`}<strong>${person.name}</strong><small>${person.role}</small></li>`).join('')}</ul>
        <div class="briefing-action"><button class="console-button" data-action="begin">Comenzar misión</button></div>
      </div>
    </section>`);
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
  game = { index: 0, log: [], resources: [...initialResources], roverAvailable: true, reconnaissanceData: false };
  terrainLoadId++;terrainMap?.dispose();terrainSession=null;terrainRoute=null;terrainResult=null;
  try {localStorage.removeItem('outpost-expedition');}catch {}
  scene('base');
}

const base = { title: 'Base lunar', location: 'Base lunar', target: 'la terminal de investigación',
  action: 'Abrir expedición', objective: 'Reúnete con tu equipo y activa la terminal de investigación.', x: 134, y: 143 };

function scene(nextPhase) {
  const mission = nextPhase === 'base' ? base : missions[game.index];
  phase = mission.platform === 'first-contact' ? 'arrival' : nextPhase;
  reconnaissance = null;
  player = { x: mission.platform === 'first-contact' ? platformDoorX : mission.platform ? 62 : mission.outside ? 52 : 188,
    y: mission.platform ? mission.y : mission.outside ? 180 : 155, facing: 1, moving: false };
  show('map', `${header()}<section class="mission-heading">
      <p class="kicker">${nextPhase === 'base' ? 'ESTABLECIMIENTO' : `MISIÓN ${game.index+1} / 5 · ${mission.location.toUpperCase()}`}</p>
      <h1 tabindex="-1">${mission.title}</h1>
    </section>
    <div class="dashboard mission-console">
      <div class="stats" id="stats">${stats()}</div>
      <div class="mission-viewport">
        <div class="map-frame">
          <img class="map-backdrop" alt="" fetchpriority="high">
          <canvas id="map" width="384" height="216" aria-label="Mapa de ${mission.location}"></canvas>
        </div>
        <section class="panel objective console-frame" id="mission-panel">
          <h2><span aria-hidden="true">⌖</span> Objetivo</h2>
          <p>${mission.objective}</p>
          <div class="objective-outpost" aria-hidden="true"><span></span></div>
        </section>
      </div>
      <div class="mission-dialogue" hidden></div>
      <div class="controls">${movementButtons(mission.platform)}
        <p id="hint" aria-live="polite"></p>
        <button class="console-button interact" data-action="interact" disabled>Interactuar · E</button>
      </div>
    </div>`);
  const canvas = document.querySelector('#map');
  const backdrop = app.querySelector('.map-backdrop');
  const missionImage = mission.platform === 'first-contact' ? platformOpen : mission.platform ? craterOutpost
    : mission.backdrop === 'polar' ? craterInterior : lunarInterior;
  backdrop.src = missionImage.src;
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
    } else if (mission.platform) {
      if (phase === 'explore') movePlayer(elapsed, .1, 12, 372, mission.y, mission.y);
      if (phase === 'cinematic' && !help.open && !document.querySelector('#science-info').open && (!reconnaissance.route || backdrop.complete)) {
        reconnaissance.elapsed += elapsed;
        if(reconnaissance.scientific) updateTerrainJourney();
        if (reconnaissance.elapsed >= reconnaissance.duration) {
          if(reconnaissance.scientific) finishTerrainJourney();
          else {
            if (!reconnaissance.route) backdrop.src = platformMapped.src;
            applyDecision(reconnaissance.option);
          }
        }
      }
      drawPlatform(canvas, player, mission, phase, time, reconnaissance);
    } else {
      if (phase === 'base' || phase === 'explore') {
        movePlayer(elapsed, .1, 12, 372, mission.outside ? 164 : 135, mission.outside ? 193 : 168);
      }
      drawMap(canvas, player, mission, phase === 'base' || phase === 'explore', crew, time);
    }

    const canMove = allowsMovement();
    movement.forEach(button => { button.disabled = !canMove; });
    const reachable = canMove && nearby(mission);
    interactButton.disabled = !reachable;
    const message = phase === 'cinematic' ? 'Reconocimiento en curso…' : reachable ? `Pulsa E · ${mission.action}` : canMove ? `Acércate a ${mission.target}.` : '';
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
  if (screen !== 'map' || help.open) return;
  const mission = phase === 'base' ? base : missions[game.index];
  if ((phase !== 'base' && phase !== 'explore') || !nearby(mission)) return;
  if (phase === 'base') {
    scene('explore');
    return;
  }
  if(game.index === 0) {terrainAnalysis();return;}
  if(game.index === 1 && !game.roverAvailable) {
    phase='feedback';
    const explanation='El rover se perdió en Primer contacto. Los cinco astronautas permanecen protegidos; aplazamos la exploración del cráter hasta disponer de otro vehículo. No se obtienen datos nuevos ni se cobran costes de una salida que no ocurrió.';
    game.log.push({title:mission.title,name:'Exploración aplazada · sin rover',success:false,explanation});persistExpedition();
    missionDialogue(explanation,missionContinue('next','Siguiente misión · E'),'Rover no disponible');return;
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
  renderNovelDialogue(overlay, 'neil', words, controls, 'h2', title);
  scheduleViewportFit();
}

function missionContinue(action, label) {
  return `<button class="ship-button" data-action="${action}">${label} <span aria-hidden="true">▸</span></button>`;
}

function explainMission(mission) {
  phase = 'briefing';
  missionDialogue(mission.objective, missionContinue('explore', 'Continuar · E'), mission.title);
}

function explore() {
  if (phase !== 'briefing') return;
  phase = 'explore';
  pressed.clear();
  const overlay = app.querySelector('.mission-dialogue');
  overlay.hidden = true;
  scheduleViewportFit();
  app.querySelector('.mission-heading h1').focus({ preventScroll: true });
}

function changes(delta) {
  return delta.map((value, i) => value ? `${resourceNames[i]} ${value > 0 ? '+' : '−'}${Math.abs(value)}` : '').filter(Boolean).join(' · ');
}

function choose(option) {
  if (phase !== 'decision') return;
  if (finishTyping) finishTyping();
  const mission = missions[game.index];
  if(game.index === 0 && !terrainRoute)return;
  if(game.index === 1 && !game.roverAvailable)return;
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
    backdrop.src = route.image.src;
    app.querySelector('.mission-heading .kicker').textContent = `MISIÓN 2 / ${missions.length} · ${route.label}`;
  }
  const overlay = app.querySelector('.mission-dialogue');
  overlay.hidden = true;
  scheduleViewportFit();
  app.querySelector('.mission-heading h1').focus({ preventScroll: true });
}

function applyDecision(option) {
  const mission = missions[game.index];
  const [name, delta, success, explanation] = mission.options[option];
  const before = game.resources;
  game.resources = before.map((value, i) => Math.min(100, Math.max(0, value + delta[i])));
  const applied = game.resources.map((value, i) => value - before[i]);
  game.log.push({ title: mission.title, name, success, explanation: mission.explanation ? `${explanation} ${mission.explanation}` : explanation });
  persistExpedition();
  phase = 'feedback';
  document.querySelector('#stats').innerHTML = stats();
  const continuation = missionContinue('next', game.index === missions.length - 1 ? 'Ver resultados' : 'Siguiente misión · E');
  const benefit = mission.explanation ? `<p class="mission-benefit"><strong>Beneficio</strong> · ${explanation}</p>` : '';
  missionDialogue(mission.explanation || explanation, `${benefit}<p class="choice-cost">${changes(applied)}</p>${continuation}`,
    success ? 'Objetivo completado' : 'Objetivo parcial');
}

function next() {
  if (phase !== 'feedback') return;
  const [energy, oxygen, radiation] = game.resources;
  if (game.index < missions.length-1 && energy > 0 && oxygen > 0 && radiation < 100) {
    game.index++;
    scene('explore');
  } else {
    results();
  }
}

function results() {
  const [energy, oxygen, radiation] = game.resources;
  const complete = game.log.filter(entry => entry.success).length;
  const finalRepair = game.log.length === 5 && game.log[4].success;
  const baseStatus = energy === 0 ? 'sin energía' : oxygen === 0 ? 'sin oxígeno' : finalRepair ? 'operativa' : 'en modo de emergencia';
  const crewStatus = oxygen === 0 || radiation >= 100 ? 'necesita atención urgente' : radiation < 25 ? 'está a salvo' : 'necesita observación médica';
  show('results', `${header()}<section class="panel"><p class="kicker">INFORME LUNAR</p>
    <h1 tabindex="-1">Resultados de la misión</h1>${terrainSession && terrainRoute ? '<button data-action="scienceInfo">Consultar datos de NASA · Misión 1</button>' : ''}
    <p><strong>${complete}/5 objetivos completados.</strong> Base ${baseStatus}. La tripulación ${crewStatus}.</p>
    <div class="stats">${stats()}</div>
    <h2>Decisiones de la expedición</h2>
    <ol class="log">${game.log.map(entry => `<li><strong>${entry.title}</strong><br>${entry.name}. ${entry.explanation}</li>`).join('')}</ol>
    <button class="primary" data-action="begin">Volver a jugar</button>
    <button data-action="returnToStart">Inicio</button></section>`);
}

const actions = {
  advance, talk, begin, interact, next, explore, terrainAnalysis, terrainDecision, scienceInfo, resumeExpedition,
  returnToStart: start,
  help: () => { pressed.clear(); help.showModal(); }
};
app.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if ((action === 'explore' || action === 'next') && finishTyping) finishTyping();
  else if (action === 'choose') choose(Number(button.dataset.option));
  else actions[action]?.();
});

document.addEventListener('keydown', event => {
  if (help.open || document.querySelector('#science-info').open) return;
  const key = event.key.toLowerCase();
  if (screen === 'opening' && (key === 'enter' || key === ' ')) {
    event.preventDefault();
    launchOpening();
  } else if ((screen === 'ship' || screen === 'map') && directions[key]) {
    event.preventDefault();
    if (allowsMovement() && !(screen === 'map' && phase === 'explore' && missions[game.index].platform && directions[key][1])) {
      pressed.set(key, directions[key]);
    }
  } else if (key === 'e' && !event.repeat) {
    if (screen === 'ship') talk();
    else if (screen === 'map') {
      if (finishTyping) finishTyping();
      else if (phase === 'briefing') explore();
      else if (phase === 'feedback') next();
      else interact();
    }
  } else if (screen === 'ship' && (key === 'enter' || key === ' ') && !event.repeat && !event.target.closest('button')) {
    const advanceButton = app.querySelector('.dialog-content button');
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
