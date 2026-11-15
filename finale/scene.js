/* =====================================================================
   SpaceCenterScene · escena 2D pixel art reutilizable (mundo 320x180 escalado x2)
   Requiere astronaut-sprite.js (tu astronauta) cargado antes.
   Uso:  SpaceCenterScene.init(canvas, { onEnter(){ ... } });
   API:  init · start · stop · player · CFG
   ===================================================================== */
const SpaceCenterScene=(()=>{
const CFG={W:320,H:180,VW:640,VH:360,GROUND:328,SPEED:2,START_X:240,MIN_X:24,MAX_X:616,
  DOOR:{x1:408,x2:500},DOOR_IN:{x1:556,x2:620},TALK:56,PROMPT:t('[E] ENTRAR','[E] ENTER')};
let scene='out',fade=0;const INT=new Image();INT.src='finale/interior.png';
const BRAND=new Image();BRAND.src='assets/nasa-space-apps.webp';BRAND.onload=()=>{if(ctx)build();};
let dialogueActive=false;
const V={x:300,dir:1,mode:'wait',t:0}; // Vanessa: wait → walk → gone (dentro)
const say=m=>opts.onStatus&&opts.onStatus(m);
const P={x:CFG.START_X,y:0,vy:0,dir:1,moving:false,t:0,frontUntil:0};
const keys={left:false,right:false,jump:false};
let ctx,wc,wx,skyC,fgC,T,opts={},raf=0,last=0,act=false,bound=false,FR=null;
const W=CFG.W,H=CFG.H;
const mk=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.imageSmoothingEnabled=false;return[c,x]};
const R=(x,y,w,h,c)=>{T.fillStyle=c;T.fillRect(x,y,w,h)};
const disc=(cx,cy,r,c)=>{for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++)if(x*x+y*y<=r*r)R(cx+x,cy+y,1,1,c)};
const tx=(s,x,y,sz,c)=>{T.font='bold '+sz+'px monospace';T.fillStyle=c;T.fillText(s,x,y)};
let seed=11;const rnd=()=>(seed=seed*16807%2147483647)/2147483647;
const clouds=[{x:20,y:10,s:2,v:.05},{x:200,y:26,s:1,v:.03},{x:120,y:4,s:1,v:.04},{x:290,y:36,s:2,v:.06}];
const cloud=(x,y,s)=>{R(x,y+3*s,18*s,3*s,'#fff');R(x+3*s,y,8*s,3*s,'#fff');R(x+9*s,y+s,6*s,2*s,'#fff');R(x,y+5*s,18*s,s,'#d6e6fa')};

function logo(cx,cy,r){ if(BRAND.naturalWidth)T.drawImage(BRAND,cx-r,cy-r,r*2,r*2); }
const bush=(x,y)=>{R(x,y,1,8,'#4a3320');disc(x-3,y-2,4,'#d96aa7');disc(x+3,y-3,4,'#e88bbf');disc(x,y-6,4,'#d96aa7');disc(x,y+6,5,'#3a7a3a')};

function build(){
  let ctxs;
  [skyC,ctxs]=mk();T=ctxs;
  ['#1b64d0','#2a76dc','#3b88e4','#52a0ec','#6db4f2','#8fc8f6'].forEach((c,i)=>R(0,i*24,W,24,c));
  let fx;[fgC,fx]=mk();T=fx;

  // árbol izquierdo y caseta
  R(6,95,5,45,'#4a3320');disc(10,62,18,'#1f5a2a');disc(5,86,13,'#1f5a2a');disc(22,78,11,'#245f2e');disc(14,56,8,'#2f7a36');disc(4,70,6,'#2f7a36');
  R(4,122,32,18,'#b9bec6');R(4,120,32,3,'#555b66');R(8,128,6,10,'#7d848f');

  // muro oscuro con letrero
  R(44,72,136,48,'#262932');
  for(let y=80;y<120;y+=8)R(44,y,136,1,'#1d2027');
  for(let x=78;x<180;x+=34)R(x,72,1,48,'#1d2027');
  R(44,72,136,2,'#3a3e4a');
  disc(57,96,5,'#e8eaee');disc(57,96,3,'#262932');R(55,96,6,2,'#e8eaee');
  tx('Space',66,92,8,'#fff');tx('Center',66,101,8,'#fff');tx('Houston',66,110,8,'#fff');
  [88,92,96].forEach(y=>R(106,y,18,1,'#9aa0ac'));R(106,102,14,1,'#9aa0ac');
  logo(146,97,10);

  // muro blanco inferior, puerta y papelera
  R(44,120,136,18,'#d6dae0');for(let x=44;x<180;x+=17)R(x,120,1,18,'#c3c8cf');R(44,136,136,2,'#9aa0a8');
  R(132,124,7,14,'#2a2d36');R(140,131,7,7,'#585d66');R(140,131,7,1,'#7b8089');

  // edificio de vidrio (derecha)
  for(let x=172;x<192;x++){const top=Math.round(92-(x-172)*1.8);R(x,top,1,112-top,(x%4<2)?'#3d4b66':'#34415a')}
  const gl=['#16355f','#1b4278','#245292','#12294d'];
  for(let gx=192;gx<W;gx+=16)for(let gy=56;gy<112;gy+=14)R(gx,gy,16,14,gl[Math.floor(rnd()*4)]);
  disc(262,96,9,'#0e2a44');disc(282,92,11,'#0e2a44');disc(302,98,9,'#0e2a44');disc(246,100,6,'#0e2a44');
  for(let gx=192;gx<W;gx+=16)R(gx,56,1,56,'#0b1d3a');
  for(let gy=56;gy<112;gy+=14)R(192,gy,128,1,'#0b1d3a');
  logo(186,98,0+9);
  R(172,110,148,2,'#f0f2f5');R(172,112,148,8,'#2e323c');

  // entrada con arco azul
  R(198,116,60,24,'#eceef2');R(198,116,60,2,'#fff');R(198,138,60,2,'#c3c8cf');
  tx('WELCOME',210,124,5,'#1f5fd0');
  disc(228,140,13,'#1f5fd0');disc(228,140,10,'#1b2030');R(214,141,28,2,'#eceef2');
  R(222,132,12,4,'#4a5266');R(220,136,16,4,'#2c3346');
  R(180,118,6,22,'#1d2029');R(258,120,62,20,'#1c2433');R(258,120,6,20,'#9aa0a8');
  for(let x=270;x<W;x+=14)R(x,120,2,20,'#2e3a4f');R(258,120,62,2,'#2e323c');

  // arbustos rosas, postes y base de pared
  [48,78,110,124].forEach(x=>bush(x,126));
  [41,96].forEach(x=>{R(x,46,1,100,'#e8eaee');R(x+1,46,1,100,'#a8aeb8');disc(x,45,2,'#ffcc33')});

  // acera y plaza plana
  R(0,138,W,8,'#d4d1d6');R(0,145,W,1,'#b9b5bd');
  R(0,146,W,34,'#cfcdd5');
  for(let x=0;x<190;x+=40)R(x,146,1,26,'#bdbac4');
  for(let y=150;y<168;y++)R(30+Math.round((168-y)*.9),y,150,1,y<152?'#c5cde0':'#a9b3c8');
  R(190,146,130,26,'#d9bba8');
  for(let y=146;y<172;y+=4){R(190,y,130,1,'#c9a592');for(let x=190+((y/4)%2)*4;x<W;x+=8)R(x,y,1,4,'#c9a592')}
  R(0,172,W,8,'#b3a99f');R(0,172,W,1,'#d6cdc3');R(0,178,W,2,'#8f857b');
  // cartel azul de la plaza
  R(79,146,14,18,'#1d5fb8');R(81,148,10,7,'#e8f1ff');R(82,157,8,1,'#8fb4ee');R(78,164,16,2,'#2a2a30');
}

function flags(t){
  T=wx;
  for(let i=0;i<22;i++){const o=Math.round(Math.sin(t/200+i*.45)*1.5);
    for(let r=0;r<13;r++)R(42+i,50+r+o,1,1,(i<9&&r<7)?'#2b3f8f':(Math.floor(r/2)%2===0?'#c8202f':'#fff'))}
  for(let i=0;i<24;i++){const o=Math.round(Math.sin(t/220+i*.4+1)*1.5);
    for(let r=0;r<14;r++)R(97+i,48+r+o,1,1,i<8?'#1d3a8a':(r<7?'#fff':'#c8202f'))}
  R(100,54+Math.round(Math.sin(t/220+2.4)*1.5),2,2,'#fff');
}

function player(t,dt){
  const air=P.y>0,front=t<P.frontUntil;
  if(P.moving)P.t+=dt/60;else P.t=0;
  const img=front?FR.front:air?FR.idle:P.moving?FR.walk[Math.floor(P.t*10)%FR.walk.length]:FR.idle;
  const br=(!P.moving&&!air&&!front)?Math.floor(t/500)%2:0; // respiración
  const G=CFG.GROUND,x=Math.round(P.x);
  ctx.fillStyle='rgba(0,0,0,.28)';ctx.fillRect(x-14,G-1,28-Math.round(P.y/4),3);
  ctx.save();ctx.translate(x,G-Math.round(P.y));ctx.scale(P.dir,1);
  ctx.drawImage(img,0,0,FRAME_W,34,-FRAME_W/2,-FRAME_H+br,FRAME_W,34);
  ctx.drawImage(img,0,34,FRAME_W,FRAME_H-34,-FRAME_W/2,-FRAME_H+34,FRAME_W,FRAME_H-34);
  ctx.restore();
}
const door=()=>scene==='out'?CFG.DOOR:CFG.DOOR_IN;
const atDoor=()=>P.y===0&&P.x>=door().x1&&P.x<=door().x2;
const nearV=()=>scene==='in'&&Math.abs(P.x-V.x)<CFG.TALK;
function vanessa(time){
  const walk=V.mode==='walk',F=walk?VanessaSprite.walk:VanessaSprite.idle,img=F[Math.floor(time/(walk?100:400))%F.length],G=CFG.GROUND,x=Math.round(V.x);
  ctx.fillStyle='rgba(0,0,0,.28)';ctx.fillRect(x-14,G-1,28,3);
  ctx.save();ctx.translate(x,G);ctx.scale(V.dir,1);ctx.drawImage(img,-FRAME_W/2,-FRAME_H);ctx.restore();
  if(V.mode==='wait'&&scene==='out'){ctx.font='bold 12px monospace';ctx.fillStyle='#141a33';ctx.fillText(t('¡SÍGUEME!','FOLLOW ME!'),x-33,G-FRAME_H-5);ctx.fillStyle='#ffcc33';ctx.fillText(t('¡SÍGUEME!','FOLLOW ME!'),x-34,G-FRAME_H-6)}
}
function fx(t){ // luces y monitores animados (datos en interior-fx.js)
  if(typeof INT_FX==='undefined')return;
  INT_FX.leds.forEach((l,i)=>{if(Math.floor(t/350+i*1.7)%5===0){ctx.fillStyle='#10143a';ctx.fillRect(l[0],l[1],l[2],l[3])}});
  INT_FX.mons.forEach((m,i)=>{const y=m[1]+Math.floor(t/90+i*5)%m[3];ctx.fillStyle='rgba(120,255,190,.28)';ctx.fillRect(m[0],y,m[2],2);
    ctx.fillStyle='rgba(43,220,106,.07)';ctx.fillRect(m[0]-3,m[1]-3,m[2]+6,m[3]+6)});
  ctx.globalCompositeOperation='lighter';
  INT_FX.lights.forEach((l,i)=>{const a=.1+.025*Math.sin(t/700+i*2),g=ctx.createRadialGradient(l[0],l[1],4,l[0],l[1]+60,150);
    g.addColorStop(0,'rgba(255,214,120,'+a*2+')');g.addColorStop(1,'rgba(255,214,120,0)');ctx.fillStyle=g;ctx.fillRect(l[0]-150,l[1],300,200)});
  ctx.globalCompositeOperation='source-over';
}
function vignette(){const g=ctx.createRadialGradient(320,180,150,320,180,420);g.addColorStop(0,'rgba(5,6,20,0)');g.addColorStop(1,'rgba(5,6,20,.5)');ctx.fillStyle=g;ctx.fillRect(0,0,CFG.VW,CFG.VH)}
const swap=(to,x)=>{scene=to;P.x=x;fade=1};

function update(dt){
  P.moving=false;
  if(dialogueActive)return;
  if(keys.left){P.x-=CFG.SPEED*dt;P.dir=-1;P.moving=true}
  if(keys.right){P.x+=CFG.SPEED*dt;P.dir=1;P.moving=true}
  P.x=Math.max(CFG.MIN_X,Math.min(CFG.MAX_X,P.x));
  if(keys.jump&&P.y===0&&P.vy===0)P.vy=6.4;
  if(P.y>0||P.vy>0){P.vy-=.44*dt;P.y+=P.vy*dt;if(P.y<=0){P.y=0;P.vy=0}}
  if(scene==='out'&&V.mode!=='gone'){V.t+=dt/60;
    if(V.mode==='wait'&&V.t>3)V.mode='walk';
    if(V.mode==='walk'){V.x+=1.1*dt;if(V.x>=454){V.mode='gone';say(t('Vanessa entró al Space Center. Ve a la puerta y pulsa E.','Vanessa entered the Space Center. Approach the door and press E.'))}}}
  if(fade>0)fade=Math.max(0,fade-.03*dt);
  if(act){act=false;
    if(atDoor()){
      if(scene==='out'){swap('in',70);V.x=380;V.dir=-1;V.mode='wait';P.dir=1;say(t('Dentro del centro de control. Acércate a Vanessa y pulsa E para hablar.','Inside mission control. Approach Vanessa and press E to talk.'));if(opts.onEnter)opts.onEnter()}
      else{swap('out',454);say(t('Volviste a la plaza. Pulsa E en la puerta para entrar de nuevo.','Back in the plaza. Press E at the door to enter again.'))}
    }else if(nearV()){P.frontUntil=performance.now()+1200;if(opts.onTalk)opts.onTalk()}}
}

function frame(now){
  const dt=Math.min(2,(now-last)/16.67);last=now;update(dt);
  if(scene==='out'){
    T=wx;wx.drawImage(skyC,0,0);
    clouds.forEach(c=>{c.x+=c.v*dt;if(c.x>W+20)c.x=-40;cloud(Math.round(c.x),c.y,c.s)});
    wx.drawImage(fgC,0,0);flags(now);
    ctx.drawImage(wc,0,0,CFG.VW,CFG.VH);
    if(V.mode!=='gone')vanessa(now);
  }else{
    ctx.fillStyle='#172343';ctx.fillRect(0,0,CFG.VW,CFG.VH);
    if(INT.naturalWidth)ctx.drawImage(INT,0,0,CFG.VW,CFG.VH);
    ctx.fillStyle='#24234f';ctx.fillRect(9,116,65,70);
    if(BRAND.naturalWidth)ctx.drawImage(BRAND,14,124,56,56);
    fx(now);vanessa(now)
  }
  player(now,dt);
  if(scene==='in')vignette();
  const pr=dialogueActive?'':atDoor()?(scene==='out'?CFG.PROMPT:t('[E] SALIR','[E] EXIT')):nearV()?t('[E] HABLAR','[E] TALK'):'';
  if(pr&&Math.floor(now/400)%2===0){
    const px=Math.round(P.x)-34,py=CFG.GROUND-FRAME_H-8;
    ctx.font='bold 14px monospace';ctx.fillStyle='#141a33';ctx.fillText(pr,px+1,py+1);ctx.fillStyle='#ffcc33';ctx.fillText(pr,px,py);
  }
  if(fade>0){ctx.fillStyle='rgba(5,6,15,'+fade+')';ctx.fillRect(0,0,CFG.VW,CFG.VH)}
  raf=requestAnimationFrame(frame);
}

const MAP={ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right',' ':'jump',ArrowUp:'jump',w:'jump',W:'jump'};
function bind(){
  if(bound)return;bound=true;
  addEventListener('keydown',e=>{if(dialogueActive||e.repeat&&['e','E'].includes(e.key))return;if(e.key==='e'||e.key==='E'){act=true;return}const k=MAP[e.key];if(k){keys[k]=true;e.preventDefault()}});
  addEventListener('keyup',e=>{const k=MAP[e.key];if(k)keys[k]=false});
  document.querySelectorAll('.pad button').forEach(btn=>{
    const k=btn.dataset.k;
    btn.addEventListener('pointerdown',e=>{e.preventDefault();if(dialogueActive)return;btn.setPointerCapture(e.pointerId);if(k==='act')act=true;else keys[k]=true});
    ['pointerup','pointerleave','pointercancel','lostpointercapture'].forEach(ev=>btn.addEventListener(ev,()=>{if(k!=='act')keys[k]=false}));
  });
}
function clearKeys(){Object.keys(keys).forEach(k=>keys[k]=false);act=false;P.moving=false;}
addEventListener('blur',clearKeys);
function setDialogueActive(value){dialogueActive=value;clearKeys();}
function start(){if(!raf){last=performance.now();raf=requestAnimationFrame(frame)}}
function stop(){cancelAnimationFrame(raf);raf=0}
function init(canvas,o){
  opts=o||{};canvas.width=CFG.VW;canvas.height=CFG.VH;
  ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  [wc,wx]=mk();
  FR={front:bake(FRONT),idle:bake(IDLE),walk:WALK.map(bake)};
  build();bind();start();
}
return{init,start,stop,setDialogueActive,player:P,CFG};
})();
