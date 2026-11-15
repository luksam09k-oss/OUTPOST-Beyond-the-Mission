const marsMissions = [
  { id:'mars-contact', title:t('Primer contacto · Marte','First Contact · Mars'), location:'Jezero', target:t('la terminal del rover','the rover terminal'), action:t('Analizar rutas','Analyze routes'), objective:t('Elige una ruta y envía el rover a reconocer Jezero.','Choose a route and send the rover to survey Jezero.'), x:128,y:181,platform:'mars' },
  { id:'dust',title:t('Tormenta de polvo','Dust Storm'),location:t('Base marciana','Mars Base'),target:t('el control de energía','the power controls'),action:t('Revisar los paneles','Check the panels'),objective:t('Protege la energía de la base durante la tormenta.','Protect the base’s power during the storm.'),x:134,y:152,platform:'mars' },
  { id:'oxygen',title:t('Producir oxígeno','Producing Oxygen'),location:t('Laboratorio marciano','Mars Laboratory'),target:t('el generador de oxígeno','the oxygen generator'),action:t('Revisar el prototipo','Check the prototype'),objective:t('Decide si activar el prototipo o conservar la energía.','Decide whether to run the prototype or conserve energy.'),x:324,y:152,platform:'mars' }
];
const marsBase = {title:t('Base de Jezero','Jezero Base'),location:'Jezero',target:t('la terminal de investigación','the research terminal'),action:t('Abrir expedición','Start expedition'),objective:t('Acércate a la terminal para comenzar la expedición.','Approach the terminal to begin your expedition.'),x:134,y:152};
let marsSession, marsLoading, marsMap, marsOperation, marsRouteIndex = 0, marsOutside = false, marsLoadId = 0;
function resetMars() { marsLoadId++;marsMap?.dispose();marsMap=null;marsSession=null;marsLoading=null;marsOperation=null;marsRouteIndex=0;marsOutside=false; }
async function loadMars() {
  const expedition=game;
  marsLoading ??= MarsData.load().catch(error=>{marsLoading=null;throw error;});
  const session=await marsLoading;
  if (game!==expedition || destination!=='mars') return null;
  if (!marsSession) {
    marsSession=session;
    if(game.mars?.audit)session.logs.unshift(...game.mars.audit.logs);
    game.mars ??= {};
    const pick=items=>items[Math.floor(Math.random()*items.length)];
    game.mars.dust ??= MarsScience.dustScenario(pick(session.science.meda));
    game.mars.oxygen ??= pick(session.science.moxie);
    game.mars.recoveredW ??= 0;
    persistExpedition();
  }
  return marsSession;
}
function marsFloor() { return phase !== 'base' && (missions[game.index].id === 'mars-contact' || marsOutside) ? 181 : 152; }
function marsBackdrop() {
  const img=app.querySelector('.map-backdrop');
  const mission=missions[game.index];
  img.src=`assets/mars-${phase==='base' ? 'base' : mission.id==='mars-contact' ? 'exterior' : mission.id==='oxygen' ? 'oxygen' : marsOutside ? 'dust' : 'base'}.webp`;
  img.parentElement.dataset.backdrop='mars';
  if(player)player.y=marsFloor();
}
function marsScene(nextPhase) {
  marsMap?.dispose();marsMap=null;marsOperation=null;marsLoadId++;marsOutside=false;
  phase=nextPhase;
  const mission=nextPhase==='base'?marsBase:missions[game.index];
  player={x:62,y:181,facing:1,moving:false};
  show('map',`${header()}<section class="mission-heading"><p class="kicker">${nextPhase==='base'?t('ESTABLECIMIENTO · MARTE','BASE SETUP · MARS'):`${t('MISIÓN','MISSION')} ${game.index+1} / 3 · MARTE`}</p><h1 tabindex="-1">${mission.title}</h1></section>
    <div class="dashboard mission-console mars-console"><div class="stats" id="stats">${stats()}</div>
      <section class="panel objective console-frame"><h2>⌖ ${t('Objetivo','Objective')}</h2><p>${mission.objective}</p></section>
      <div class="mission-viewport"><div class="map-frame"><img class="map-backdrop" alt=""><canvas id="map" width="384" height="216" aria-label="${mission.location}"></canvas>
        ${mission.id==='dust'?`<button class="mars-view" data-action="marsView">${t('Ver exterior','View outside')}</button>`:''}</div></div>
      <div class="mission-dialogue dialogue-dock" hidden></div><div class="controls">${movementButtons(true)}<p id="hint" aria-live="polite"></p><button class="console-button interact" data-action="interact" disabled>${t('Interactuar · E','Interact · E')}</button></div></div>`);
  marsBackdrop();
  const canvas=app.querySelector('#map'),ctx=canvas.getContext('2d');
  let lastTime;
  function tick(time) {
    const dt=lastTime===undefined?0:Math.min(40,time-lastTime);lastTime=time;
    const canMove=allowsMovement()&&!help.open;
    if(canMove)movePlayer(dt,.1,12,372,marsFloor(),marsFloor());
    ctx.clearRect(0,0,384,216);
    const pen=painter(canvas);
    if(mission.id==='dust'&&marsOutside) {
      ctx.fillStyle='#dcb39760';
      for(let i=0;i<64;i++){const x=(i*53+time*.1)%384,y=(i*31)%216;ctx.fillRect(x,y,8+(i%5),1);}
    }
    const reachable = canMove && Math.abs(player.x - mission.x) <= 17;
    if (canMove) {
      const y = marsFloor() - 50;
      const color = reachable ? '#9cf6d5' : '#ffce77';
      pen.box(mission.x - 11, y, 22, 12, '#081326');
      pen.box(mission.x - 7, y + 12, 14, 4, '#081326');
      pen.box(mission.x - 4, y + 16, 8, 4, '#081326');
      pen.box(mission.x - 8, y + 3, 16, 6, color);
      pen.box(mission.x - 5, y + 9, 10, 4, color);
      pen.box(mission.x - 2, y + 13, 4, 4, color);
    }
    if(explorerSprite.naturalWidth)drawExplorer(ctx,player,time);
    else sprite(pen,player.x-8,player.y-23,'#ffcd76');
    if(marsOperation&&phase==='cinematic') {
      if(!help.open&&!document.querySelector('#science-info').open)marsOperation.elapsed+=dt;
      const progress=Math.min(1,marsOperation.elapsed/marsOperation.duration);
      if(mission.id==='mars-contact') {
        const travel=progress<.5?progress*2:(1-progress)*2;
        marsSession.progress=travel;marsMap?.draw();
        const x=70+travel*260;
        if(roverSprite.naturalWidth)ctx.drawImage(roverSprite,(1+Math.floor(time/110)%5)*64,0,64,52,x-21,147,42,34);
        else pen.box(x-12,169,24,12,'#c8b194');
      } else if(mission.id==='dust'&&marsOperation.option===1) {
        if(roverSprite.naturalWidth)ctx.drawImage(roverSprite,0,0,64,52,90+Math.sin(progress*Math.PI)*190,147,42,34);
      } else if(mission.id==='oxygen'&&marsOperation.option===0) {
        for(let i=0;i<10;i++)pen.box(313+i*2,130-((time/35+i*11)%50),2,3,'#87f3f0');
      }
      if(progress===1)finishMarsOperation();
    }
    const controls=app.querySelector('.controls');controls.hidden=!canMove&&phase!=='cinematic';controls.classList.toggle('cinematic-controls',phase==='cinematic');
    controls.querySelectorAll('[data-move]').forEach(button=>{button.disabled=!canMove;});
    controls.querySelector('.interact').disabled = !reachable;
    app.querySelector('#hint').textContent=phase==='cinematic'?t('Operación en curso…','Operation in progress…'):reachable?`${t('Pulsa E','Press E')} · ${mission.action}`:`${t('Acércate a','Approach')} ${mission.target}.`;
    frame=requestAnimationFrame(tick);
  }
  if(nextPhase==='explore')explainMission(mission);
  frame=requestAnimationFrame(tick);
  loadMars().catch(()=>{}); // Analysis presents a retry if the local scientific files cannot load.
}
function marsView() {
  if(screen!=='map'||missions[game.index].id!=='dust'||!['briefing','explore','decision','feedback'].includes(phase))return;
  marsOutside=!marsOutside;marsBackdrop();
  app.querySelector('.mars-view').textContent=marsOutside?t('Ver interior','View inside'):t('Ver exterior','View outside');
}
function marsInteract() {
  if(screen!=='map'||help.open)return;
  const mission=phase==='base'?marsBase:missions[game.index];
  if(!['base','explore'].includes(phase)||Math.abs(player.x-mission.x)>17)return;
  if(phase==='base')scene('explore');else marsAnalysis();
}
async function marsAnalysis() {
  if(destination!=='mars'||screen!=='map'||!['explore','loading','load-error'].includes(phase))return;
  phase='loading';pressed.clear();player.moving=false;
  missionDialogue(t('Estoy preparando los datos de la misión.','I’m preparing the mission data.'),'');
  const id=++marsLoadId;
  try {
    const session=await loadMars();
    if(!session||id!==marsLoadId||screen!=='map')return;
    phase='decision';
    if(missions[game.index].id==='mars-contact')marsRouteSelect(0);
    else { MarsData.metadata(session,missions[game.index].id==='dust'?'meda':'moxie');marsDecision(); }
  } catch {
    if(id!==marsLoadId||screen!=='map')return;
    phase='load-error';missionDialogue(t('No se pudieron cargar los datos. Reintenta para continuar.','The data could not load. Retry to continue.'),dialogueContinue('marsAnalysis',t('Reintentar · E','Retry · E')));
  }
}
function marsRouteSelect(index) {
  if(phase!=='decision'||missions[game.index].id!=='mars-contact'||!marsSession)return;
  marsRouteIndex=index;
  const route=marsSession.terrain.routes[index],plan=MarsScience.routePlan(route);
  app.querySelector('.mars-route-panel')?.remove();marsMap?.dispose();
  const panel=document.createElement('section');panel.className='mars-route-panel';
  panel.innerHTML=`<div class="mars-route-map"></div><div class="mars-route-data"><div class="mars-tabs"><button data-action="marsRouteShort" aria-pressed="${index===0}">${t('Ruta corta','Short route')}</button><button data-action="marsRouteLong" aria-pressed="${index===1}">${t('Ruta larga','Long route')}</button></div><dl>
    <dt>${t('Distancia de ida','One-way distance')}</dt><dd>${numberText(route.distanceM)} m</dd><dt>${t('Dificultad','Difficulty')}</dt><dd>${index?t('Moderada','Moderate'):t('Baja','Low')}</dd><dt>${t('Tiempo estimado','Estimated time')}</dt><dd>${numberText(plan.hours*60)} min</dd><dt>${t('Riesgo de demora','Delay risk')}</dt><dd>${numberText(plan.risk*100)}%</dd></dl></div>`;
  app.querySelector('.mission-viewport').append(panel);
  marsSession.progress=null;marsMap=MarsMap.mount(panel.querySelector('.mars-route-map'),marsSession,route);
  const name=index?t('Exploración avanzada','Advanced exploration'):t('Exploración básica','Basic exploration');
  missionDialogue(index?t('La ruta larga estudia más terreno, pero requiere más tiempo y recursos.','The long route covers more terrain, but needs more time and resources.'):t('La ruta corta obtiene un reconocimiento básico con menor consumo.','The short route provides a basic survey using fewer resources.'),`<p class="choice-cost">${changes(plan.delta)}</p><div class="result-actions"><button data-action="choose" data-option="${index}" ${MarsScience.canAfford(game.resources,plan)?'':'disabled'}>${name}</button>${marsInfoButton()}</div>`,marsMissions[0].title);
}
function marsInfoButton() { return `<button class="science-back" data-action="marsInfo">${t('Ver más información','More information')}</button>`; }
function marsChoiceNames() {
  return missions[game.index].id==='dust'?[t('Ahorrar energía','Save energy'),t('Limpiar paneles con el robot','Clean panels with the robot')]:[t('Activar el prototipo','Run the prototype'),t('Usar reservas','Use reserves')];
}
function marsDecision() {
  const dust=missions[game.index].id==='dust',state=game.mars;
  const plans=[0,1].map(option=>dust?MarsScience.dustPlan(state.dust,option):MarsScience.oxygenPlan(state.oxygen,option,state.recoveredW));
  const words=dust?(state.dust.maintenanceAllowed?t('El polvo reduce la energía solar. Podemos ahorrar o intentar limpiar los paneles con el robot.','Dust reduces solar power. We can conserve energy or try cleaning the panels with the robot.'):t('La tormenta es demasiado intensa para enviar el robot. Ahorremos energía hasta que pase.','The storm is too strong to send the robot out. Let’s conserve energy until it passes.')):t('Este prototipo produce un poco de oxígeno, pero consume energía. No alcanza para abastecer a cinco personas: seguimos necesitando reservas.','This prototype produces a little oxygen, but uses energy. It cannot supply five people: we still need reserves.');
  const metrics=dust?`${t('Polvo','Dust')}: ${marsDustLabel(state.dust.level)} · ${t('Energía solar','Solar power')}: ${numberText(state.dust.solarW)} W`:`${t('Producción estimada','Estimated output')}: +${numberText(state.oxygen.producedG / MarsScience.balance.oxygenGramsPerPoint,2)} ${t('puntos de oxígeno','oxygen points')}`;
  const choices=marsChoiceNames().map((name,i)=>`<button data-action="choose" data-option="${i}" ${MarsScience.canAfford(game.resources,plans[i])?'':'disabled'}>${name}<small>${plans[i]?changes(plans[i].delta):t('No disponible durante polvo intenso','Unavailable in heavy dust')}</small></button>`).join('');
  missionDialogue(words,`<p class="choice-cost mars-indicator">${metrics}</p><div class="choices">${choices}</div>${marsInfoButton()}`,missions[game.index].title);
}
function marsDustLabel(level) { return {low:t('bajo','low'),moderate:t('moderado','moderate'),high:t('intenso','heavy')}[level]; }
function marsChoose(option) {
  if(phase!=='decision'||!marsSession||![0,1].includes(option))return;
  const mission=missions[game.index],state=game.mars;
  if(game.log.some(entry=>entry.id===mission.id))return;
  let result;
  if(mission.id==='mars-contact')result=MarsScience.terrainResult(marsSession.terrain.routes[option]);
  else if(mission.id==='dust')result=MarsScience.dustResult(state.dust,option);
  else result={...MarsScience.oxygenPlan(state.oxygen,option,state.recoveredW),success:true};
  if(!MarsScience.canAfford(game.resources,result))return;
  finishTyping?.();phase='cinematic';pressed.clear();player.moving=false;
  marsOperation={option,result,elapsed:0,duration:reducedMotion.matches?240:5200};
  app.querySelector('.mission-dialogue').hidden=true;app.querySelector('.mars-route-panel')?.remove();marsMap?.dispose();marsMap=null;
  if(mission.id==='mars-contact') {
    const host=document.createElement('div');host.className='journey-map';app.querySelector('.map-frame').append(host);
    marsMap=MarsMap.mount(host,marsSession,marsSession.terrain.routes[option]);
  } else if(mission.id==='dust'){marsOutside=option===1;marsBackdrop();}
}
function finishMarsOperation() {
  if(phase!=='cinematic'||!marsOperation)return;
  const {option,result}=marsOperation,mission=missions[game.index];
  marsOperation=null;phase='feedback';marsMap?.dispose();marsMap=null;app.querySelector('.journey-map')?.remove();
  let explanation,name;
  if(mission.id==='mars-contact') {
    name=option?t('Exploración avanzada','Advanced exploration'):t('Exploración básica','Basic exploration');
    explanation=(option?t('El rover regresó con un mapa más detallado del terreno.','The rover returned with a more detailed terrain map.'):t('El rover regresó con un reconocimiento básico de la zona.','The rover returned with a basic survey of the area.'))+' '+(result.delayed?t('Un desvío alargó el recorrido y aumentó el consumo.','A detour lengthened the journey and increased consumption.'):t('El recorrido se completó sin demoras.','The journey finished without delays.'));
    game.mars.routeId=marsSession.terrain.routes[option].id;
  } else if(mission.id==='dust') {
    name=marsChoiceNames()[option];game.mars.recoveredW=result.recoveredW;
    explanation=option===0?t('La tripulación se mantuvo a salvo. Ahorramos energía y esperamos a que mejoraran las condiciones.','The crew stayed safe. We conserved energy and waited for conditions to improve.'):result.repaired?t('El robot limpió parte del polvo. La energía recuperada ayudará en la siguiente misión.','The robot cleared some dust. The recovered power will help in the next mission.'):t('El robot regresó a salvo, pero el polvo impidió completar la limpieza. Los paneles siguen limitados.','The robot returned safely, but dust prevented a complete cleaning. Panel output remains limited.');
    marsOutside=false;marsBackdrop();
  } else {
    name=marsChoiceNames()[option];
    explanation=option===0?t('Produjimos una pequeña cantidad de oxígeno y redujimos un poco el uso de reservas. El equipo aún depende de los tanques.','We produced a small amount of oxygen and slightly reduced reserve use. The crew still depends on its tanks.'):t('Usamos oxígeno de los tanques y conservamos la energía del prototipo. La tripulación completó la operación a salvo.','We used oxygen from the tanks and conserved the prototype’s power. The crew completed the operation safely.');
  }
  game.resources=game.resources.map((v,i)=>MarsScience.rounded(Math.min(100,Math.max(0,v+result.delta[i]))));
  game.log.push({id:mission.id,title:mission.title,name,success:result.success,explanation,option,result});
  persistExpedition();app.querySelector('#stats').innerHTML=stats();
  missionDialogue(explanation,`<p class="choice-cost">${changes(result.delta)}</p><div class="result-actions">${dialogueContinue('next',game.index===2?t('Regresar a la Tierra · E','Return to Earth · E'):t('Siguiente misión · E','Next mission · E'))}${marsInfoButton()}</div>`,t('Operación completada','Operation complete'));
}
