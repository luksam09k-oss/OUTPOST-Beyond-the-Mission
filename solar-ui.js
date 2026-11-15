let solarRun;
let solarLoading;
const solarNames = [
  t('Evacuación inmediata', 'Evacuate immediately'),
  t('Asegurar equipos y evacuar', 'Secure equipment and evacuate')
];
const solarLevels = {
  low: t('Bajo', 'Low'), moderate: t('Moderado', 'Moderate'), high: t('Alto', 'High')
};

async function solarAnalysis() {
  phase = 'solar-analysis';
  pressed.clear();
  player.moving = false;
  const expedition = game;
  missionDialogue(t('Consultando los registros de actividad solar y radiación…', 'Checking solar activity and radiation records…'), '',
    t('Análisis de actividad solar', 'Solar activity analysis'));
  const data = solarRun || await (solarLoading ??= Solar.load());
  if (game !== expedition || phase !== 'solar-analysis') return;
  solarRun = data;
  const { level } = solarRun;
  app.querySelector('.mission-console').dataset.solar = level;
  const estimate = Solar.plan(solarRun, 0);
  const status = level === 'high' ?
    t('El equipo exterior debe refugiarse de inmediato.', 'The crew outside must take shelter immediately.') :
    t('Cada minuto afuera aumenta la exposición. Aún hay tiempo para asegurar los equipos.', 'Every minute outside adds exposure. There is still time to secure the equipment.');
  const recommendation = level === 'high' ?
    t('Recomendación: evacuar ahora.', 'Recommendation: evacuate now.') :
    t('Recomendación: prioriza a la tripulación.', 'Recommendation: put the crew first.');
  missionDialogue(status, `<p class="choice-cost">${t('Dosis de fondo estimada al evacuar', 'Estimated background dose if evacuated')} · ${doseLabel(estimate.dose)}</p>
    <p>${recommendation}</p>
    <div class="result-actions"><button class="ship-button" data-action="solarInfo">${t('Ver más información', 'More information')}</button>
    ${missionContinue('solarDecision', t('Elegir acción', 'Choose an action'))}</div>`,
    `${t('Nivel de alerta', 'Alert level')} · ${solarLevels[level]}`);
}

function doseLabel(dose) {
  if (dose === null) return t('Sin referencia disponible', 'Reference unavailable');
  return `${numberText(dose, 1)} μGy (${t('simulación', 'simulation')})`;
}

function solarDecision() {
  if (phase !== 'solar-analysis' || !solarRun) return;
  phase = 'decision';
  const choices = solarNames.map((name, option) => {
    const plan = Solar.plan(solarRun, option);
    if (!plan) return `<button disabled>${name}<small>${t('Bloqueada por alerta alta', 'Locked due to high alert')}</small></button>`;
    const note = option === 0 ? t('Menos exposición. Podrían perderse datos.', 'Less exposure. Some data may be lost.') :
      t('Conserva los datos. Más tiempo afuera.', 'Preserves data. More time outside.');
    return `<button data-action="choose" data-option="${option}">${name}<small>${note}</small>
      <small class="choice-cost">${changes(plan.delta)}</small></button>`;
  }).join('');
  missionDialogue(t('La tripulación espera tu orden para volver al refugio.', 'The crew is waiting for your order to return to shelter.'),
    `<div class="choices">${choices}</div><button class="science-back" data-action="solarInfo">${t('Ver más información', 'More information')}</button>`,
    missionTitles.solar);
}

function startSolarEvacuation(option) {
  const plan = Solar.resolve(solarRun, option);
  if (!plan) return;
  solarRun = { ...solarRun, option, result: plan };
  reconnaissance = { solar: true, elapsed: 0, duration: reducedMotion.matches ? 200 : option === 0 ? 2700 : 4200 };
  phase = 'cinematic';
  app.querySelector('.mission-dialogue').hidden = true;
  scheduleViewportFit();
  app.querySelector('.mission-heading h1').focus({ preventScroll: true });
}

function drawEvacuation(canvas, progress, time) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const pen = painter(canvas);
  const hold = solarRun.option === 1 ? .38 : .05;
  const doorX = 316;
  pen.box(297, 82, 34, 48, '#202843');
  const close = Math.max(0, (progress - .82) / .18);
  pen.box(300, 85, 28, 44, '#efb45f');
  pen.box(300, 85, 28 * close, 44, '#232e48');
  pen.box(302, 86, 25 * close, 3, '#687fa0');
  if (progress < hold && solarRun.option === 1) {
    pen.box(190, 131, 27, 11, '#1b2548');
    pen.box(194, 133, 19 * progress / hold, 4, '#77e7ff');
    pen.label(t('GUARDANDO DATOS', 'SAVING DATA'), 203, 112, '#ffe594');
  }
  for (const [i, member] of crew.entries()) {
    const startX = [184, 145, 188, 232, 263][i];
    const advance = Math.max(0, Math.min(1, (progress - hold - i * .034) / (.65 - hold)));
    if (advance >= 1) continue;
    const x = startX + (doorX - startX) * advance;
    const bob = advance > 0 ? Math.sin(time / 55 + i) * 2 : 0;
    sprite(pen, x - 8, 121 - 16 * advance + bob, member.color);
  }
  if (progress > .84) pen.label(t('REFUGIO SELLADO', 'SHELTER SEALED'), 280, 151, '#a6f6d2');
}

function finishSolarEvacuation() {
  const { option, result } = solarRun;
  const before = game.resources;
  game.resources = before.map((value, i) => Math.min(100, Math.max(0, value + result.delta[i])));
  result.applied = game.resources.map((value, i) => value - before[i]);
  const message = option === 0 ?
    t('Todos están bajo techo. Salimos cuanto antes, aunque parte de los datos quedó en los equipos exteriores.',
      'Everyone is inside. We got to shelter quickly, though some data was left on the equipment outside.') :
    t('La tripulación está protegida y los datos se guardaron. Ese tiempo extra afuera costó más oxígeno y aumentó la exposición.',
      'The crew is sheltered and the data is saved. The extra time outside used more oxygen and increased exposure.');
  game.log.push({ id: 'solar', title: missionTitles.solar, name: solarNames[option], success: true, explanation: message });
  game.solar = solarRun;
  persistExpedition();
  phase = 'feedback';
  app.querySelector('#stats').innerHTML = stats();
  delete app.querySelector('.mission-console').dataset.solar;
  missionDialogue(message, `<p class="choice-cost">${changes(result.applied)} · ${doseLabel(result.dose)}</p>
    <div class="result-actions"><button class="ship-button" data-action="solarInfo">${t('Ver más información', 'More information')}</button>
    ${missionContinue('next', t('Siguiente misión · E', 'Next mission · E'))}</div>`,
  t('Evacuación completada', 'Evacuation complete'));
}

function solarInfo() {
  if (!solarRun) return;
  const { event, measurement, eventSource, measurementSource, result } = solarRun;
  const sourceNames = {
    recent: t('Registro reciente consultado en línea', 'Recent record fetched online'),
    historical: t('Registro histórico consultado en línea', 'Historical record fetched online'),
    cache: t('Copia de datos históricos', 'Cached historical record'),
    none: t('Sin registros disponibles', 'No records available')
  };
  const states = {
    ok: t('Datos recibidos', 'Records received'), empty: t('Sin registros válidos', 'No valid records'),
    http: t('Error HTTP', 'HTTP error'), unavailable: t('Sin acceso desde el navegador', 'Unavailable from the browser')
  };
  const information = `<h3>${t('Partículas solares y refugio', 'Solar particles and shelter')}</h3>
    <p>${t('Algunos eventos solares lanzan partículas energéticas al espacio. Entrar al refugio limita el tiempo de exposición exterior.',
      'Some solar events release energetic particles into space. Getting to shelter limits the time spent exposed outside.')}</p>
    <p>${t('El catálogo DONKI aporta un evento de referencia. La alerta es parte de la simulación, no un aviso actual ni una medida de la intensidad del evento.',
      'The DONKI catalog supplies a reference event. The alert is a simulation setting, not a current warning or a measurement of event intensity.')}</p>
    ${result ? `<p>${t('El traje y el soporte vital consumieron oxígeno. El traslado, los equipos y el cierre del refugio usaron energía.',
      'The suit and life support used oxygen. Moving the crew, running equipment and sealing the shelter used energy.')}</p>
      <p>${numberText(result.outside)} ${t('min fuera', 'min outside')} · ${numberText(result.shelterMinutes)} ${t('min bajo refugio', 'min in shelter')} · ${doseLabel(result.dose)}</p>` : ''}`;
  const api = `<h3>DONKI · SEP</h3>
    <p>${sourceNames[eventSource]}${event ? ` · <a href="${MoonMap.escape(event.link)}" target="_blank" rel="noopener">${MoonMap.escape(event.sepID)}</a>
      · ${MoonMap.escape(event.eventTime)} (UTC)` : ''}</p>
    <h3>RadLab · ${measurement ? MoonMap.escape(measurement.instrument_id) : 'LND / CRaTER'}</h3>
    <p>${sourceNames[measurementSource]}${measurement ? ` · ${numberText(measurement.absorbed_dose_rate, 2)} μGy/h
      · ${MoonMap.escape(measurement.timestamp)} (UTC)` : ''}</p>
    <p>${measurement?.instrument_id.toUpperCase().startsWith('LND') ?
      t('Instrumento de superficie a bordo de Chang’e 4.', 'Surface instrument aboard Chang’e 4.') :
      t('CRaTER mide en órbita lunar desde LRO. Sus valores sirven de referencia para la dosis de fondo simulada, con diferencias respecto a la superficie y al cuerpo humano.',
      'CRaTER measures from lunar orbit aboard LRO. Its readings are a baseline for the simulated background dose, with differences from the surface and the human body.')}</p>
    <details><summary>${t('Fórmula y supuestos', 'Formula and assumptions')}</summary>
      <p>${t('Dosis (μGy) = tasa de referencia × (horas fuera + horas dentro × 0,25) × variación (±15 %). El blindaje de 0,25 es un supuesto del juego. La actividad solar influye en el indicador de riesgo por separado y el modelo excluye la dosis adicional de un SEP.',
      'Dose (μGy) = reference rate × (hours outside + hours inside × 0.25) × variation (±15%). The 0.25 shielding factor is a game assumption. Solar activity influences the risk meter separately, and the model excludes any additional SEP dose.')}</p></details>
    <details><summary>${t('Consultas y registros originales', 'Queries and original records')}</summary>
      <ul>${solarRun.queries.map(q => `<li><a href="${MoonMap.escape(q.url)}" target="_blank" rel="noopener">${q.url.includes('/DONKI/') ? 'DONKI SEP' : 'RadLab'}</a>
        · ${states[q.state]} ${q.http || ''} · ${MoonMap.escape(q.checkedAt)} · ${q.count}</li>`).join('')}</ul>
      ${solarRun.cacheDate ? `<p><a href="data/nasa/solar-reference.json">${t('Copia local', 'Local copy')}</a> · ${MoonMap.escape(solarRun.cacheDate)}</p>` : ''}
      <pre>${MoonMap.escape(JSON.stringify({ event, measurement }, null, 2))}</pre></details>
    <p><a href="https://ccmc.gsfc.nasa.gov/tools/DONKI/" target="_blank" rel="noopener">NASA DONKI</a> ·
    <a href="https://visualization.osdr.nasa.gov/radlab/gui/data-api/" target="_blank" rel="noopener">NASA RadLab</a></p>`;
  showTechnicalDialog(information, api, { title: t('Datos de la alerta solar', 'Solar alert data'), informationTitle: t('Explicación científica', 'Science explained') });
}
