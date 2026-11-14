const speakers = {
  curiosity: { name: 'Curiosity', image: 'assets/curiosity-retrato.webp' },
  neil: { name: 'Neil Armstrong', image: 'assets/neil-retrato.webp' }
};

const introductions = {
  curiosity: [
    ['curiosity', '¡Hola, exploradores! Bienvenidos a OUTPOST.'],
    ['curiosity', 'Deberán administrar tres recursos:', true],
    ['curiosity', '¿A dónde viajaremos?']
  ],
  neil: [
    ['neil', 'Su misión será explorar el espacio y mantener a salvo a su tripulación.'],
    ['neil', 'Cada decisión puede cambiar sus niveles. ¡Elijan sabiamente y protejan a su tripulación!']
  ]
};
const lunarIntroduction = ['neil', '¡Soy Neil Armstrong! En 1969 fui el primer ser humano en caminar sobre la Luna, durante la misión Apollo 11. ¡Prepárate para tu misión lunar!'];
const shipCrew = [{ id: 'neil', x: 30, y: 68 }, { id: 'curiosity', x: 71, y: 68 }];

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let met;
let dialogue;
let dialogueLine;
let typingFrame;
let finishTyping;
let choosingDestination;

function enterShip() {
  met = new Set();
  dialogue = null;
  finishTyping = null;
  choosingDestination = false;
  player = { x: 50, y: 69, facing: 1, moving: false };
  show('ship', `
    <section class="ship" aria-label="Interior de la nave">
      <div class="ship-room" aria-hidden="true">
        <div class="ship-light"></div>
        ${shipCrew.map(({ id, x, y }) => `<div class="ship-actor ship-${id}" style="left:${x}%;top:${y}%"><span>${speakers[id].name}</span></div>`).join('')}
        <div class="ship-actor ship-player"><span>Tú</span></div>
        <div class="ship-scan"></div>
      </div>
      <div class="ship-content">
        <div class="ship-overlay"></div>
        <div class="ship-controls">
          ${movementButtons()}
          <button class="ship-button" data-action="talk" disabled>Hablar · E</button>
          <button class="ship-button" data-action="destinations" hidden>Elegir destino</button>
        </div>
        <p class="ship-hint" aria-live="polite"></p>
      </div>
    </section>`);
  const actor = app.querySelector('.ship-player');
  const hint = app.querySelector('.ship-hint');
  const talk = app.querySelector('[data-action="talk"]');
  let lastTime = 0;

  function tick(time) {
    movePlayer(lastTime ? Math.min(40, time - lastTime) : 0, .032, 10, 90, 65, 74);
    lastTime = time;
    actor.style.left = player.x + '%';
    actor.style.top = player.y + '%';
    actor.style.setProperty('--facing', player.facing);
    actor.style.backgroundPositionX = (player.moving ? (1 + Math.floor(time / 100) % 6) * 100 / 6 : 0) + '%';
    const near = nearbySpeaker();
    const message = near ? `Pulsa E para hablar con ${speakers[near.id].name}.` : 'Muévete con WASD o las flechas. Acércate a Neil o a Curiosity.';
    talk.disabled = choosingDestination || (!near && !dialogue);
    const talkLabel = dialogue ? 'Continuar · E' : 'Hablar · E';
    if (talk.textContent !== talkLabel) talk.textContent = talkLabel;
    if (hint.textContent !== message && !dialogue && !choosingDestination) hint.textContent = message;
    hint.hidden = Boolean(dialogue || choosingDestination);
    frame = requestAnimationFrame(tick);
  }
  tick(0);
}

function nearbySpeaker() {
  return shipCrew.find(({ x, y }) => Math.hypot(player.x - x, (player.y - y) * 1.5) <= 9);
}

function talk() {
  if (screen !== 'ship') return;
  if (choosingDestination) return;
  if (dialogue) {
    advance();
    return;
  }
  const near = nearbySpeaker();
  if (!near) return;
  dialogue = near.id;
  dialogueLine = 0;
  renderDialogue(introductions[dialogue][0], 'Siguiente · E', 'advance');
}

function renderDialogue([speaker, words, displayResources], button, action) {
  const { name, image } = speakers[speaker];
  const ship = app.querySelector('.ship');
  const content = ship.querySelector('.ship-overlay');
  ship.dataset.speaker = speaker;
  content.innerHTML = `
    <div class="ship-dialog">
      <img class="dialog-portrait" src="${image}" alt="">
      <div class="dialog-content">
        <h1 class="dialog-name" tabindex="-1">${name}</h1>
        <p class="sr-only">${words}</p>
        <p class="dialog-text" aria-hidden="true"></p>
        ${displayResources ? initialMeters() : ''}
        <button class="ship-button" data-action="${action}">${button} <span aria-hidden="true">▸</span></button>
      </div>
    </div>`;
  content.querySelector('h1').focus({ preventScroll: true });
  const text = content.querySelector('.dialog-text');
  text.textContent = words;
  if (reducedMotion.matches) return;

  // Keep the complete line in the layout so the panel never jumps while it types.
  text.style.position = 'relative';
  const visible = document.createElement('span');
  text.innerHTML = '<span class="dialog-layout"></span>';
  text.firstChild.textContent = words;
  visible.className = 'dialog-typing';
  text.append(visible);
  const started = performance.now();
  finishTyping = () => {
    cancelAnimationFrame(typingFrame);
    text.textContent = words;
    finishTyping = null;
  };
  function type(now) {
    const length = Math.ceil((now - started) / 15);
    if (length >= words.length) {
      finishTyping();
      return;
    }
    visible.textContent = words.slice(0, length);
    typingFrame = requestAnimationFrame(type);
  }
  typingFrame = requestAnimationFrame(type);
}

function initialMeters() {
  return `<ul class="ship-meters" aria-label="Recursos iniciales">${resourceNames.map((name, i) =>
    `<li>${name} <strong>${initialResources[i]} %</strong></li>`).join('')}</ul>`;
}

function advance() {
  if (finishTyping) {
    finishTyping();
    return;
  }
  if (dialogue === 'moon') {
    briefing();
    return;
  }
  if (!dialogue) return;
  const lines = introductions[dialogue];
  dialogueLine++;
  if (dialogueLine < lines.length) {
    renderDialogue(lines[dialogueLine], dialogueLine === lines.length - 1 ? 'Terminar · E' : 'Siguiente · E', 'advance');
    return;
  }
  met.add(dialogue);
  dialogue = null;
  app.querySelector('.ship-overlay').replaceChildren();
  delete app.querySelector('.ship').dataset.speaker;
  if (met.size === shipCrew.length) {
    app.querySelector('[data-action="destinations"]').hidden = false;
    chooseDestination();
  }
}

function chooseDestination() {
  choosingDestination = true;
  const ship = app.querySelector('.ship');
  delete ship.dataset.speaker;
  const content = ship.querySelector('.ship-overlay');
  content.innerHTML = `
    <div class="ship-destination">
      <h1 tabindex="-1">Elige tu destino</h1>
      <div class="ship-options">
        <button class="ship-button" data-action="selectMoon"><strong>La Luna</strong><small>Neil Armstrong</small></button>
        <button class="ship-button" data-action="selectMars" aria-disabled="true"><strong>Marte</strong><small>Curiosity · No disponible</small></button>
      </div>
      <p class="ship-status" role="status"></p>
      <button class="ship-button" data-action="backToShip">Volver a la nave</button>
    </div>`;
  content.querySelector('h1').focus({ preventScroll: true });
}

function selectMars() {
  app.querySelector('.ship-status').textContent = 'Marte no está disponible en este prototipo. Puedes continuar hacia la Luna.';
}

function backToShip() {
  choosingDestination = false;
  app.querySelector('.ship-overlay').replaceChildren();
  app.querySelector('[data-action="destinations"]').focus();
}

function selectMoon() {
  choosingDestination = false;
  dialogue = 'moon';
  renderDialogue(lunarIntroduction, 'Continuar a la Luna', 'advance');
}
