/* Fit the actual measured dialogue, never guess its height or scroll it into view. */
let fitRequest;
function scheduleViewportFit() {
  cancelAnimationFrame(fitRequest);
  fitRequest=requestAnimationFrame(fitViewport);
}
function fitViewport() {
  const root=document.querySelector('#app');
  if(!root)return;
  const console=root.querySelector('.mission-console');
  if(console) {
    const viewport=console.querySelector('.mission-viewport');
    const dialogue=console.querySelector('.mission-dialogue');
    const controls=console.querySelector('.controls');
    const top=console.getBoundingClientRect().top;
    const available=Math.max(40,window.innerHeight-top-22-(dialogue.hidden?0:dialogue.offsetHeight+8)-controls.offsetHeight-console.querySelector('.stats').offsetHeight-16);
    const width=Math.min(console.clientWidth-16,available*16/9);
    viewport.style.width=`${Math.floor(width)}px`;
    viewport.style.height=`${Math.floor(width*9/16)}px`;
    root.dataset.dialogue=String(!dialogue.hidden);
  }
  const ship=root.querySelector('.ship');
  if(ship) {
    // Room and dialogue are separate rows inside one viewport; both remain fully visible.
    const content=ship.querySelector('.ship-content');
    const free=Math.max(50,window.innerHeight-content.offsetHeight-16);
    ship.querySelector('.ship-room').style.width=`${Math.min(root.clientWidth,free*16/9)}px`;
  }
}
window.addEventListener('resize',scheduleViewportFit);
window.visualViewport?.addEventListener('resize',scheduleViewportFit);
document.addEventListener('DOMContentLoaded',()=>{
  const observer=new MutationObserver(scheduleViewportFit);
  observer.observe(document.querySelector('#app'),{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  document.fonts?.ready.then(scheduleViewportFit);
});
