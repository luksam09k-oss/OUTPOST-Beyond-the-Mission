const crew = [
  { name: 'Tú', role: 'Exploración', color: '#ffcd76' },
  { name: 'Vega', role: 'Comandante', color: '#aa94ff' },
  { name: 'Lina', role: 'Geóloga', color: '#7cebbb' },
  { name: 'Mateo', role: 'Ingeniero', color: '#7bdeff' },
  { name: 'Noa', role: 'Médica', color: '#ff9aa9' }
];

const missions = [
  {
    title: 'Primer contacto lunar', location: 'Superficie lunar', target: 'trípode de observación',
    action: 'Fotografiar el terreno', objective: 'Fotografía los alrededores para trazar un mapa de la base.',
    problem: 'El polvo sobre los paneles reduce la energía disponible. ¿Cómo fotografías la zona?',
    x: 134, y: 131, outside: true,
    options: [
      ['Hacer un mapa detallado', [-25, 0, 0], true, 'El equipo de fotografía consumió energía de las baterías. El mapa detallado está listo.'],
      ['Hacer un mapa básico', [-9, 0, 0], true, 'Unas pocas fotos bastaron para trazar una ruta. Ahorraste energía y el mapa tiene menos detalles.']
    ]
  },
  {
    title: 'Explorando el cráter', location: 'Borde del cráter', target: 'muestra junto al cráter',
    action: 'Recoger la muestra', objective: 'Recoge suelo lunar y decide cómo estudiar la muestra.',
    problem: 'El laboratorio y el soporte vital usan la misma batería. Hay que decidir cuál recibe la energía.',
    x: 205, y: 149, outside: true,
    options: [
      ['Analizar la muestra ahora', [-24, -12, 0], true, 'Identificaste componentes del suelo. La ventilación consumió parte de la reserva de oxígeno.'],
      ['Guardar la muestra', [-6, 0, 0], false, 'La muestra queda recogida y pendiente de análisis. La energía se reservó para el soporte vital.']
    ]
  },
  {
    title: 'Buscando recursos', location: 'Zona polar', target: 'sensor del terreno',
    action: 'Examinar terreno frío', objective: 'Busca indicios de hielo en el suelo de una zona sombreada.',
    problem: 'El sensor detectó una señal débil. Para comprobarla tendrás que quedarte más tiempo fuera y gastar oxígeno del traje.',
    x: 267, y: 111, outside: true,
    options: [
      ['Usar el escáner y perforar', [-21, -27, 0], true, 'El análisis encontró indicios de hielo. Buscarlo a mayor profundidad te costó baterías y parte de la reserva de oxígeno.'],
      ['Marcar el punto en el mapa', [-5, -5, 0], false, 'Guardaste la ubicación para otra salida. Una señal débil necesita más mediciones.']
    ]
  },
  {
    title: 'Alerta solar', location: 'Base lunar', target: 'entrada al refugio',
    action: 'Consultar la alerta', objective: 'Ve al refugio y avisa a los cinco tripulantes.',
    problem: 'Una alerta solar indica que podría aumentar la radiación. El equipo aún recoge datos afuera.',
    x: 253, y: 146, outside: false,
    options: [
      ['Entrar todos al refugio', [-4, -5, 2], true, 'Las paredes del refugio reducen la exposición. Apagaste equipos secundarios para ahorrar energía.'],
      ['Cerrar el equipo antes de entrar', [-11, -8, 30], false, 'Guardaste los datos, pero la tripulación estuvo expuesta más tiempo. Hay que vigilar su estado.']
    ]
  },
  {
    title: 'Regreso seguro', location: 'Base lunar', target: 'soporte vital',
    action: 'Revisar soporte vital', objective: 'Restablece la circulación de aire y cierra la expedición.',
    problem: 'Un ventilador del soporte vital se averió. Queda una pieza de repuesto y un circuito de emergencia.',
    x: 319, y: 120, outside: false,
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

function header() {
  return '<header class="top"><div class="brand">OUTPOST</div><button data-action="help">Cómo jugar</button></header>';
}

function guide(message) {
  return `<div class="guide"><img src="assets/neil-retrato.webp" alt=""><div><strong>Neil Armstrong</strong><p>${message}</p></div></div>`;
}

function show(next, html) {
  screen = next;
  pressed.clear();
  cancelAnimationFrame(frame);
  app.innerHTML = html;
  app.querySelectorAll('[data-portrait]').forEach(canvas => {
    const id = canvas.dataset.portrait;
    sprite(painter(canvas), 5, 3, crew[Number(id)].color);
  });
  app.querySelector('h1')?.focus();
}

function briefing() {
  show('briefing', `${header()}<section class="panel">
    <p class="kicker">MISIÓN LUNAR</p><h1 tabindex="-1">Tripulación de la base</h1>
    ${guide('Tu equipo debe estudiar el suelo lunar y mantener segura la base. Vamos a empezar fotografiando el terreno.')}
    <ul class="crew" aria-label="Cinco tripulantes">${crew.map((person, i) =>
      `<li><canvas width="26" height="26" data-portrait="${i}" aria-hidden="true"></canvas><strong>${person.name}</strong><small>${person.role}</small></li>`).join('')}</ul>
    <button class="primary" data-action="begin">Comenzar</button>
    </section>`);
}

function stats() {
  return game.resources.map((value, i) => `<div class="stat">${resourceNames[i]} <strong>${value}%</strong>
    <meter min="0" max="100" low="26" high="74" optimum="${i === 2 ? 0 : 100}" value="${value}" aria-label="${resourceNames[i]}"></meter></div>`).join('');
}

function begin() {
  game = { index: 0, log: [], resources: [...initialResources] };
  scene('base');
}

const base = { title: 'Base lunar', location: 'Base lunar', target: 'terminal de investigación',
  action: 'Abrir expedición', objective: 'Reúnete con tu equipo y activa la terminal de investigación.', x: 65, y: 119 };

function scene(nextPhase) {
  phase = nextPhase;
  const mission = nextPhase === 'base' ? base : missions[game.index];
  player = { x: mission.outside ? 52 : 180, y: 155, moving: false };
  show('map', `${header()}<p class="kicker">${nextPhase === 'base' ? 'ESTABLECIMIENTO' : `MISIÓN ${game.index+1} / 5 · ${mission.location.toUpperCase()}`}</p>
    <h1 tabindex="-1">${mission.title}</h1><div class="stats" id="stats">${stats()}</div>
    <div class="dashboard"><div>
      <canvas class="stage" id="map" width="384" height="192" aria-label="Mapa de ${mission.location}"></canvas>
      <div class="controls"><div class="directions" aria-label="Movimiento">
        <button data-move="arrowleft" aria-label="Izquierda">←</button><button data-move="arrowup" aria-label="Arriba">↑</button>
        <button data-move="arrowdown" aria-label="Abajo">↓</button><button data-move="arrowright" aria-label="Derecha">→</button>
      </div><button class="primary" data-action="interact" disabled>Interactuar · E</button></div>
    </div><section class="panel" id="mission-panel">
      <h2>Objetivo</h2><p>${mission.objective}</p><p id="hint" aria-live="polite">Acércate a ${mission.target}.</p>
    </section></div>`);
  const canvas = document.querySelector('#map');
  const interactButton = app.querySelector('[data-action="interact"]');
  const hint = document.querySelector('#hint');
  let lastTime = 0;
  function tick(time) {
    const elapsed = lastTime ? Math.min(40, time-lastTime) : 0;
    lastTime = time;
    if ((phase === 'base' || phase === 'explore') && !help.open) {
      let dx = 0;
      let dy = 0;
      for (const [x, y] of pressed.values()) { dx += x; dy += y; }
      const length = Math.hypot(dx, dy);
      player.moving = length > 0;
      if (length) {
        player.x = Math.max(12, Math.min(372, player.x + dx/length*elapsed*.1));
        player.y = Math.max(mission.outside ? 97 : 113, Math.min(168, player.y + dy/length*elapsed*.1));
      }
      const reachable = nearby(mission);
      interactButton.disabled = !reachable;
      const message = reachable ? `Pulsa E · ${mission.action}` : `Acércate a ${mission.target}.`;
      if (hint.textContent !== message) hint.textContent = message;
    }
    drawMap(canvas, player, mission, phase === 'base' || phase === 'explore', crew, time);
    frame = requestAnimationFrame(tick);
  }
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
  phase = 'decision';
  pressed.clear();
  player.moving = false;
  app.querySelector('[data-action="interact"]').disabled = true;
  const panel = document.querySelector('#mission-panel');
  panel.innerHTML = `<p class="kicker">${mission.action.toUpperCase()}</p><h2 tabindex="-1">Decisión</h2><p>${mission.problem}</p>
    <div class="choices">${mission.options.map(([name, costs], i) =>
      `<button data-action="choose" data-option="${i}">${name}<small>${changes(costs)}</small></button>`).join('')}</div>`;
  panel.querySelector('h2').focus();
}

function changes(delta) {
  return delta.map((value, i) => value ? `${resourceNames[i]} ${value > 0 ? '+' : '−'}${Math.abs(value)}` : '').filter(Boolean).join(' · ');
}

function choose(option) {
  if (phase !== 'decision') return;
  const mission = missions[game.index];
  const [name, delta, success, explanation] = mission.options[option];
  game.resources = game.resources.map((value, i) => Math.min(100, Math.max(0, value + delta[i])));
  game.log.push({ title: mission.title, name, success, explanation });
  phase = 'feedback';
  document.querySelector('#stats').innerHTML = stats();
  const panel = document.querySelector('#mission-panel');
  panel.innerHTML = `<h2 tabindex="-1">${success ? 'Objetivo completado' : 'Objetivo parcial'}</h2>
    ${guide(explanation)}<p>${changes(delta)}</p>
    <button class="primary" data-action="next">${game.index === 4 ? 'Ver resultados' : 'Siguiente misión'}</button>`;
  panel.querySelector('h2').focus();
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
    <h1 tabindex="-1">Resultados de la misión</h1>
    <p><strong>${complete}/5 objetivos completados.</strong> Base ${baseStatus}. La tripulación ${crewStatus}.</p>
    <div class="stats">${stats()}</div>
    <h2>Decisiones de la expedición</h2>
    <ol class="log">${game.log.map(entry => `<li><strong>${entry.title}</strong><br>${entry.name}. ${entry.explanation}</li>`).join('')}</ol>
    <button class="primary" data-action="begin">Volver a jugar</button>
    <button data-action="returnToStart">Inicio</button></section>`);
}

const actions = {
  advance, selectMoon, selectMars, continueMoon, begin, interact, next,
  returnToStart: () => location.assign('index.html'),
  help: () => { pressed.clear(); help.showModal(); }
};
app.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'choose') choose(Number(button.dataset.option));
  else actions[action]();
});

document.addEventListener('keydown', event => {
  if (help.open) return;
  const key = event.key.toLowerCase();
  if (screen === 'ship' && (key === 'enter' || key === ' ') && !event.repeat && !event.target.closest('button')) {
    const advanceButton = app.querySelector('.dialog-content button');
    if (advanceButton) {
      event.preventDefault();
      advanceButton.click();
    }
  } else if (screen === 'map' && directions[key]) {
    event.preventDefault();
    pressed.set(key, directions[key]);
  } else if (key === 'e' && !event.repeat) {
    interact();
  }
});
document.addEventListener('keyup', event => pressed.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => pressed.clear());
app.addEventListener('pointerdown', event => {
  const button = event.target.closest('[data-move]');
  if (!button) return;
  button.setPointerCapture(event.pointerId);
  pressed.set(event.pointerId, directions[button.dataset.move]);
});
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  app.addEventListener(eventName, event => pressed.delete(event.pointerId));
}

enterShip();
