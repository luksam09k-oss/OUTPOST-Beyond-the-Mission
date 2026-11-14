const opening = document.querySelector('#opening');

opening.addEventListener('load', () => {
  const introDocument = opening.contentDocument;
  if (!introDocument) {
    document.querySelector('#offline').hidden = false;
    return;
  }
  introDocument.addEventListener('outpost:start', () => location.replace('juego.html'), { once: true });
});
opening.src = 'inicio.html';
