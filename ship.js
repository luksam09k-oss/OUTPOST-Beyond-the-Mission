const speakers = {
  curiosity: { name: 'Curiosity', image: 'assets/curiosity-retrato.webp' },
  neil: { name: 'Neil Armstrong', image: 'assets/neil-retrato.webp' }
};

const welcome = [
  ['curiosity', '¡Hola, exploradores! Bienvenidos a OUTPOST.'],
  ['neil', 'Su misión será explorar el espacio y mantener a salvo a su tripulación.'],
  ['curiosity', 'Deberán administrar tres recursos:', true],
  ['neil', 'Cada decisión puede cambiar sus niveles. ¡Elijan sabiamente y protejan a su tripulación!'],
  ['curiosity', '¿A dónde viajaremos?']
];
const lunarIntroduction = ['neil', '¡Soy Neil Armstrong! En 1969 fui el primer ser humano en caminar sobre la Luna, durante la misión Apollo 11. ¡Prepárate para tu misión lunar!'];

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let dialogueLine;
let typingFrame;
let finishTyping;

function enterShip() {
  dialogueLine = 0;
  show('ship', `
    <section class="ship" aria-label="Interior de la nave">
      <div class="ship-room" aria-hidden="true">
        <div class="ship-light"></div>
        <div class="ship-actor ship-neil"></div>
        <div class="ship-actor ship-curiosity"></div>
        <div class="ship-scan"></div>
      </div>
      <div class="ship-content"></div>
    </section>`);
  renderDialogue(welcome[0], 'Siguiente', 'advance');
}

function renderDialogue([speaker, words, displayResources], button, action) {
  const { name, image } = speakers[speaker];
  const ship = app.querySelector('.ship');
  const content = ship.querySelector('.ship-content');
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
  dialogueLine++;
  if (dialogueLine === welcome.length) {
    chooseDestination();
    return;
  }
  renderDialogue(welcome[dialogueLine], dialogueLine === welcome.length - 1 ? 'Elegir destino' : 'Siguiente', 'advance');
}

function chooseDestination() {
  const ship = app.querySelector('.ship');
  delete ship.dataset.speaker;
  const content = ship.querySelector('.ship-content');
  content.innerHTML = `
    <div class="ship-destination">
      <h1 tabindex="-1">Elige tu destino</h1>
      <div class="ship-options">
        <button class="ship-button" data-action="selectMoon"><strong>La Luna</strong><small>Neil Armstrong</small></button>
        <button class="ship-button" data-action="selectMars" aria-disabled="true"><strong>Marte</strong><small>Curiosity · No disponible</small></button>
      </div>
      <p class="ship-status" role="status"></p>
    </div>`;
  content.querySelector('h1').focus({ preventScroll: true });
}

function selectMars() {
  app.querySelector('.ship-status').textContent = 'Marte no está disponible en este prototipo. Puedes continuar hacia la Luna.';
}

function selectMoon() {
  renderDialogue(lunarIntroduction, 'Continuar a la Luna', 'continueMoon');
}

function continueMoon() {
  if (finishTyping) finishTyping();
  else briefing();
}
