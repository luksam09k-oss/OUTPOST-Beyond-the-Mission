document.title = t('OUTPOST · Informe lunar', 'OUTPOST · Lunar Report');
const reportContent = document.querySelector('.report-content');
const reportActions = document.querySelector('.report-actions');
let report;
try {
  report = JSON.parse(sessionStorage.getItem('outpost-report') || 'null');
  if (!report) {
    const save = JSON.parse(localStorage.getItem('outpost-expedition') || 'null');
    if (save?.game?.finished) report = save.game;
  }
} catch {}

if (!report || !Array.isArray(report.log) || report.resources?.length !== 3) {
  reportContent.innerHTML = `<h1 id="report-title">${t('Informe lunar', 'Lunar Report')}</h1>
    <p>${t('Completa una expedición para recibir el informe.', 'Finish an expedition to receive your report.')}</p>`;
  reportActions.innerHTML = `<a href="index.html?lang=${language}">${t('Inicio', 'Home')}</a>`;
} else {
  const [energy, oxygen, radiation] = report.resources;
  const count = report.log.filter(entry => entry.success).length;
  const repair = report.log.some(entry => entry.id === 'return' && entry.success);
  const baseStatus = energy === 0 ? t('Base sin energía.', 'Base out of power.') :
    oxygen === 0 ? t('Base sin oxígeno.', 'Base out of oxygen.') :
    repair ? t('Base operativa.', 'Base operational.') : t('Base en modo de emergencia.', 'Base in emergency mode.');
  const crewStatus = oxygen === 0 || radiation >= 100 ? t('La tripulación necesita atención urgente.', 'The crew needs urgent care.') :
    radiation >= 25 ? t('La tripulación queda en observación.', 'The crew remains under observation.') :
      t('La tripulación está a salvo.', 'The crew is safe.');
  const objectives = missionOrder.map(id => {
    const entry = report.log.find(item => item.id === id);
    const status = entry ? entry.success ? t('Completo', 'Complete') : t('Parcial', 'Partial') : t('Pendiente', 'Pending');
    return `<li data-reveal hidden><span>${missionTitles[id]}</span><span>${status}</span></li>`;
  }).join('');
  reportContent.innerHTML = `<h1 id="report-title">${t('Informe lunar', 'Lunar Report')}</h1>
    <p data-reveal hidden><strong>${count}/${missionOrder.length} ${t('objetivos completados', 'objectives complete')}</strong></p>
    <p class="report-status" data-reveal hidden>${baseStatus} ${crewStatus}</p>
    <dl data-reveal hidden>${report.resources.map((value, i) => `<div><dt>${resourceNames[i]}</dt><dd>${numberText(value)}%</dd></div>`).join('')}</dl>
    <ol aria-label="${t('Estado de cada objetivo', 'Status by objective')}">${objectives}</ol>`;
  reportActions.innerHTML = `<button id="show-all">${t('Mostrar todo', 'Show all')}</button>
    <a href="index.html?lang=${language}">${t('Inicio', 'Home')}</a>
    <a href="index.html?lang=${language}&replay=1">${t('Volver a jugar', 'Play again')}</a>`;
  const skip = document.querySelector('#show-all');
  const items = [...reportContent.querySelectorAll('[data-reveal]')];
  let timer;
  function showAll() {
    clearTimeout(timer);
    for (const item of items) item.hidden = false;
    skip.disabled = true;
  }
  skip.addEventListener('click', showAll);
  function revealNext() {
    const item = items.find(node => node.hidden);
    if (!item) {
      skip.disabled = true;
      return;
    }
    item.hidden = false;
    timer = setTimeout(revealNext, 430);
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) showAll();
  else timer = setTimeout(revealNext, 600);
}
