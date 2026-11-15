const language = (() => {
  const requested = new URLSearchParams(location.search).get('lang');
  try {
    if (requested === 'es' || requested === 'en') localStorage.setItem('outpost-language', requested);
    return requested === 'en' || (!requested && localStorage.getItem('outpost-language') === 'en') ? 'en' : 'es';
  } catch {
    return requested === 'en' ? 'en' : 'es';
  }
})();
document.documentElement.lang = language;

const t = (es, en) => language === 'en' ? en : es;
const numberText = (value, digits = 0) => new Intl.NumberFormat(language, {
  maximumFractionDigits: digits
}).format(value);
const resourceNames = [t('Energía', 'Energy'), t('Oxígeno', 'Oxygen'), t('Radiación', 'Radiation')];
const missionTitles = {
  contact: t('Primer contacto', 'First Contact'),
  crater: t('Explorando el cráter', 'Exploring the Crater'),
  solar: t('Alerta solar', 'Solar Alert')
};
const missionOrder = Object.keys(missionTitles);

function expeditionLog(log, destination = 'moon') {
  const legacyOrder = ['contact', 'crater', 'resources', 'solar', 'return'];
  const byMission = new Map(log.map((entry, index) => {
    const id = entry.id ?? legacyOrder[index];
    return [id, { ...entry, id }];
  }));
  return (destination === 'mars' ? ['mars-contact', 'dust', 'oxygen'] : missionOrder).map(id => byMission.get(id)).filter(Boolean);
}

function localizeMarkup(root) {
  for (const node of root.querySelectorAll('[data-en]')) {
    if (language === 'en') node.textContent = node.dataset.en;
  }
  for (const node of root.querySelectorAll('[data-label-en]')) {
    if (language === 'en') node.setAttribute('aria-label', node.dataset.labelEn);
  }
}
