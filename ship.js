const speakers = {
  curiosity: { name: 'Curiosity', image: 'assets/curiosity-retrato.webp' },
  neil: { name: 'Neil Armstrong', image: 'assets/neil-retrato.webp' }
};

const introduction = [
  ['curiosity', '¡Hola, exploradores! Bienvenidos a OUTPOST.'],
  ['neil', 'Su misión será explorar el espacio y mantener a salvo a su tripulación.'],
  ['curiosity', 'Deberán administrar tres recursos:', true],
  ['neil', 'Cada decisión puede cambiar sus niveles. ¡Elijan sabiamente y protejan a su tripulación!'],
  ['curiosity', '¿A dónde viajaremos? Acércate a Neil para ir a la Luna o a mí para ir a Marte.']
];
const lunarIntroduction = ['neil', '¡Soy Neil Armstrong! En 1969 fui el primer ser humano en caminar sobre la Luna, durante la misión Apollo 11. ¡Prepárate para tu misión lunar!'];
const shipCrew = [{ id: 'neil', x: 30, y: 68 }, { id: 'curiosity', x: 71, y: 68 }];

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let dialogue;
let dialogueLine;
let typingFrame;
let finishTyping;

function enterShip() {
  dialogue = 'intro';
  dialogueLine = 0;
  finishTyping = null;
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
        <div class="ship-controls" hidden>
          ${movementButtons()}
          <button class="ship-button" data-action="talk" disabled>Hablar · E</button>
        </div>
        <p class="ship-hint" tabindex="-1" aria-live="polite" hidden></p>
      </div>
    </section>`);
  const actor = app.querySelector('.ship-player');
  const hint = app.querySelector('.ship-hint');
  const talk = app.querySelector('[data-action="talk"]');
  let lastTime = 0;

  function tick(time) {
    if (!dialogue) movePlayer(lastTime ? Math.min(40, time - lastTime) : 0, .032, 10, 90, 65, 74);
    lastTime = time;
    actor.style.left = player.x + '%';
    actor.style.top = player.y + '%';
    actor.style.setProperty('--facing', player.facing);
    actor.style.backgroundPositionX = (player.moving ? (1 + Math.floor(time / 100) % 6) * 100 / 6 : 0) + '%';
    const near = nearbySpeaker();
    const message = near
      ? (near.id === 'neil' ? 'E · Neil Armstrong · La Luna' : 'E · Curiosity · Marte (no disponible)')
      : 'Muévete con WASD o las flechas y acércate a Neil o Curiosity para elegir destino.';
    talk.disabled = !near || Boolean(dialogue);
    if (!dialogue && hint.textContent !== message) hint.textContent = message;
    frame = requestAnimationFrame(tick);
  }
  tick(0);
  renderDialogue(introduction[0], 'Siguiente · E');
}

function nearbySpeaker() {
  return shipCrew.find(({ x, y }) => Math.hypot(player.x - x, (player.y - y) * 1.5) <= 9);
}

function talk() {
  if (screen !== 'ship') return;
  if (dialogue) {
    advance();
    return;
  }
  const near = nearbySpeaker();
  if (!near) return;
  pressed.clear();
  player.moving = false;
  app.querySelector('.ship-controls').hidden = true;
  app.querySelector('.ship-hint').hidden = true;
  if (near.id === 'neil') {
    dialogue = 'moon';
    renderDialogue(lunarIntroduction, 'Continuar a la Luna');
  } else {
    dialogue = 'mars';
    renderDialogue(['curiosity', 'Marte todavía no está disponible. Puedes continuar con Neil hacia la Luna.'], 'Volver a la nave');
  }
}

function renderDialogue([speaker, words, displayResources], button) {
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
        <button class="ship-button" data-action="advance">${button} <span aria-hidden="true">▸</span></button>
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
  if (dialogue === 'intro' && ++dialogueLine < introduction.length) {
    const button = dialogueLine === introduction.length - 1 ? 'Elegir destino · E' : 'Siguiente · E';
    renderDialogue(introduction[dialogueLine], button);
    return;
  }
  dialogue = null;
  pressed.clear();
  app.querySelector('.ship-overlay').replaceChildren();
  delete app.querySelector('.ship').dataset.speaker;
  app.querySelector('.ship-controls').hidden = false;
  const hint = app.querySelector('.ship-hint');
  hint.hidden = false;
  hint.focus({ preventScroll: true });
}
