const speakers = {
  curiosity: { name: 'Curiosity', image: 'assets/curiosity-retrato.webp' },
  neil: { name: 'Neil Armstrong', image: 'assets/neil-retrato.webp' }
};

const introduction = [
  ['curiosity', t('¡Hola, exploradores! Bienvenidos a OUTPOST.', 'Hello, explorers! Welcome to OUTPOST.')],
  ['neil', t('Su misión será explorar el espacio y mantener a salvo a su tripulación.', 'Your mission is to explore space and keep your crew safe.')],
  ['curiosity', t('Deberán administrar tres recursos:', 'You will manage three resources:'), true],
  ['neil', t('Cada decisión puede cambiar sus niveles. ¡Elijan sabiamente y protejan a su tripulación!', 'Every decision can change those levels. Choose carefully and protect your crew!')],
  ['curiosity', t('¿A dónde viajaremos? Acércate a Neil para ir a la Luna o a mí para ir a Marte.', 'Where should we go? Talk to Neil for the Moon or to me for Mars.')]
];
const lunarIntroduction = ['neil', t('¡Soy Neil Armstrong! En 1969 fui el primer ser humano en caminar sobre la Luna, durante la misión Apollo 11. ¡Prepárate para tu misión lunar!', 'I am Neil Armstrong. In 1969, I became the first person to walk on the Moon during Apollo 11. Get ready for your lunar mission!')];
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
    <section class="ship" aria-label="${t('Interior de la nave', 'Ship interior')}">
      <div class="ship-scene" aria-hidden="true">
      <div class="ship-room">
        <div class="ship-light"></div>
        ${shipCrew.map(({ id, x, y }) => `<div class="ship-actor ship-${id}" style="left:${x}%;top:${y}%"><span>${speakers[id].name}</span></div>`).join('')}
        <div class="ship-actor ship-player"><span>${t('Tú', 'You')}</span></div>
        <div class="ship-scan"></div>
      </div>
      </div>
      <div class="ship-content">
        <div class="ship-overlay"></div>
        <div class="ship-controls" hidden>
          ${movementButtons()}
          <button class="ship-button" data-action="talk" disabled>${t('Hablar · E', 'Talk · E')}</button>
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
      ? (near.id === 'neil' ? t('E · Neil Armstrong · La Luna', 'E · Neil Armstrong · Moon') : t('E · Curiosity · Marte (no disponible)', 'E · Curiosity · Mars (unavailable)'))
      : t('Muévete con WASD o las flechas y acércate a Neil o Curiosity para elegir destino.', 'Use WASD or the arrows and approach Neil or Curiosity to choose a destination.');
    talk.disabled = !near || Boolean(dialogue);
    if (!dialogue && hint.textContent !== message) hint.textContent = message;
    frame = requestAnimationFrame(tick);
  }
  tick(0);
  renderDialogue(introduction[0], t('Siguiente · E', 'Next · E'));
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
    renderDialogue(lunarIntroduction, t('Continuar a la Luna', 'Continue to the Moon'));
  } else {
    dialogue = 'mars';
    renderDialogue(['curiosity', t('Marte todavía no está disponible. Puedes continuar con Neil hacia la Luna.', 'Mars is not available yet. Talk to Neil to continue to the Moon.')], t('Volver a la nave', 'Return to ship'));
  }
}

function renderDialogue([speaker, words, displayResources], button) {
  const ship = app.querySelector('.ship');
  ship.dataset.speaker = speaker;
  renderNovelDialogue(ship.querySelector('.ship-overlay'), speaker, words,
    `${displayResources ? initialMeters() : ''}
     <button class="ship-button" data-action="advance">${button} <span aria-hidden="true">▸</span></button>`, 'h1');
}

function portraitArt({ image, name }) {
  return `<span class="portrait-art${name === 'Neil Armstrong' ? ' portrait-neil' : ''}" aria-hidden="true"><img src="${image}" alt=""></span>`;
}

function renderNovelDialogue(content, speaker, words, controls, heading = 'h2', title = '') {
  if (finishTyping) finishTyping();
  const { name, image } = speakers[speaker];
  content.innerHTML = `
    <div class="ship-dialog">
      <span class="dialog-portrait">${portraitArt({ image, name })}</span>
      <div class="dialog-content">
        ${title ? `<p class="kicker">${title}</p>` : ''}
        <${heading} class="dialog-name" tabindex="-1">${name}</${heading}>
        <p class="sr-only">${words}</p>
        <p class="dialog-text" aria-hidden="true"></p>
        ${controls}
      </div>
    </div>`;
  content.querySelector('.dialog-name').focus({ preventScroll: true });
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
  return `<ul class="ship-meters" aria-label="${t('Recursos iniciales', 'Starting resources')}">${resourceNames.map((name, i) =>
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
    const button = dialogueLine === introduction.length - 1 ? t('Elegir destino · E', 'Choose destination · E') : t('Siguiente · E', 'Next · E');
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
