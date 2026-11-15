localizeMarkup(document);
const finalDock=document.querySelector('.finale-dialogue');
const finalControls=document.querySelector('.finale-controls');
let finalReport;
try { finalReport=JSON.parse(sessionStorage.getItem('outpost-report')); } catch {}
if(finalReport?.destination!=='mars') {
  try { const saved=JSON.parse(localStorage.getItem('outpost-expedition'));if(saved?.game?.destination==='mars')finalReport=saved.game;else finalReport=null; } catch { finalReport=null; }
}
const completedMars=Boolean(finalReport?.finished&&finalReport.log?.some(entry=>entry.id==='oxygen'));
let finalLine=0,finalTalking=false,finalIntroduction=true,finalCompleted=false;
function finalLines() {
  if(!completedMars)return [t('Bienvenido al Space Center. Esta es la escena de regreso de Marte; completa las tres misiones para recibir tu informe de expedición.','Welcome to the Space Center. This is the return scene for Mars. Complete all three missions to receive your expedition report.')];
  const first=finalReport.log.find(entry=>entry.id==='mars-contact');
  const dust=finalReport.log.find(entry=>entry.id==='dust');
  const oxygen=finalReport.log.find(entry=>entry.id==='oxygen');
  return [
    t('Bienvenidos de vuelta, exploradores. Soy Vanessa, la directora de esta misión. Cinco personas regresan con algo tan valioso como las muestras: experiencia para la próxima expedición.','Welcome back, explorers. I’m Vanessa, this mission’s director. Five people return with something as valuable as samples: experience for the next expedition.'),
    first?.option===1?t('Su recorrido largo nos dejó un mapa más detallado de Jezero. Invirtieron más recursos para conocer mejor el terreno.','Your long route gave us a more detailed Jezero map. You invested more resources to understand the terrain.'):t('Eligieron un reconocimiento corto y cuidaron las reservas. Ese primer mapa será la base de futuras exploraciones.','You chose a short survey and protected your reserves. That first map will support future exploration.'),
    dust?.result?.repaired?t('El robot recuperó parte de la energía de los paneles. Una decisión durante la tormenta ayudó a la misión siguiente: en una base, todo está conectado.','The robot recovered some panel power. A decision during the storm helped the next mission: everything in a base is connected.'):dust?.option===1?t('La limpieza no salió como esperaban, pero el robot y el equipo regresaron a salvo. También aprendemos de las operaciones que no completan su objetivo.','Cleaning did not go as planned, but the robot and crew returned safely. We also learn from operations that fall short of their goal.'):t('Durante la tormenta priorizaron ahorrar energía y proteger a la tripulación. Saber cuándo esperar también forma parte de explorar.','During the storm you prioritized energy savings and crew safety. Knowing when to wait is part of exploration, too.'),
    oxygen?.option===0?t('El prototipo produjo una pequeña cantidad de oxígeno. Es una demostración importante, pero aún necesitamos reservas y sistemas mucho mayores para vivir en Marte.','The prototype produced a small amount of oxygen. It is an important demonstration, but living on Mars still requires reserves and much larger systems.'):t('Conservaron la energía y utilizaron el oxígeno de reserva. La próxima expedición podrá evaluar cuándo conviene activar el prototipo.','You conserved energy and used reserve oxygen. The next expedition can evaluate when running the prototype is worthwhile.'),
    t('Misión marciana completada. La exploración continúa gracias a decisiones informadas y al trabajo de todo el equipo. Bienvenidos a casa.','Mars mission complete. Exploration continues through informed decisions and the work of the whole team. Welcome home.')
  ];
}
function renderFinalLine() {
  const lines=finalLines(),last=finalLine===lines.length-1;
  const resources=completedMars&&last?`<ul class="final-resource-list">${finalReport.resources.map((v,i)=>`<li>${resourceNames[i]} <strong>${numberText(v,1)}%</strong></li>`).join('')}</ul>`:'';
  const actions=last?`<div class="final-actions"><a href="index.html?lang=${language}&replay=1">${t('Nueva expedición','New expedition')}</a>${dialogueContinue('finalClose',t('Explorar el centro · E','Explore the center · E'))}</div>`:dialogueContinue('finalNext',t('Siguiente · E','Next · E'));
  renderNovelDialogue(finalDock,'director',lines[finalLine],resources+actions,'h2',t('Informe de la expedición','Expedition debrief'));
}
function talkToDirector() {
  if(finalTalking)return;
  finalIntroduction=false;finalTalking=true;finalLine=0;finalDock.hidden=false;finalControls.hidden=true;SpaceCenterScene.setDialogueActive(true);renderFinalLine();
}
function closeFinalDialogue() {
  finalTalking=false;finalDock.hidden=true;finalControls.hidden=false;SpaceCenterScene.setDialogueActive(false);
  if(!finalIntroduction)finalCompleted=true;
  document.querySelector('#finale-scene').setAttribute('tabindex','-1');document.querySelector('#finale-scene').focus({preventScroll:true});
}
SpaceCenterScene.init(document.querySelector('#finale-scene'),{
  onStatus(message){document.querySelector('#finale-status').textContent=message;},
  onTalk:talkToDirector,
  onEnter(){document.querySelector('.finale-header .kicker').textContent=t('CENTRO DE CONTROL','MISSION CONTROL');}
});
SpaceCenterScene.setDialogueActive(true);finalTalking=true;finalDock.hidden=false;finalControls.hidden=true;
renderNovelDialogue(finalDock,'director',t('¡Ya están en la Tierra! Síganme al centro de control. Camina hacia la entrada de la derecha y pulsa E; dentro revisaremos lo aprendido en Marte.','You’re back on Earth! Follow me to mission control. Walk to the entrance on the right and press E; inside, we will review what you learned on Mars.'),dialogueContinue('finalClose',t('Vamos · E','Let’s go · E')));
document.querySelector('#finale-status').textContent=t('Muévete con A/D o las flechas. Ve a la puerta y pulsa E.','Move with A/D or the arrows. Approach the door and press E.');
finalDock.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button)return;
  if(finishTyping){finishTyping();return;}
  if(button.dataset.action==='finalClose')closeFinalDialogue();
  else if(button.dataset.action==='finalNext'){finalLine++;renderFinalLine();}
});
document.addEventListener('keydown',event=>{
  if(!finalTalking||event.repeat||!['e','E','Enter',' '].includes(event.key)||event.target.closest('a'))return;
  event.preventDefault();event.stopPropagation();
  finalDock.querySelector('[data-dialogue-continue]')?.click();
},true);
