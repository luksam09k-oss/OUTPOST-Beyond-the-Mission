function painter(canvas) {
  const context = canvas.getContext('2d');
  return {
    box(x, y, width, height, color) {
      context.fillStyle = color;
      context.fillRect(Math.round(x), Math.round(y), width, height);
    },
    label(value, x, y, color = '#d7ebff') {
      context.fillStyle = color;
      context.font = 'bold 8px monospace';
      context.textAlign = 'center';
      context.fillText(value, x, y);
    }
  };
}

function starfield({ box }, width, height) {
  box(0, 0, width, height, '#090d22');
  for (let i = 0; i < 140; i++) {
    const x = (i * 89 + i * i * 11) % width;
    const y = (i * 53 + i * i * 3) % height;
    const tint = ['#242d5e', '#485283', '#89a0c9', '#e1eaff'][i % 4];
    box(x, y, i % 12 === 0 ? 2 : 1, 1, tint);
  }
}

const lunarInterior = new Image();
lunarInterior.src = 'assets/base-lunar.webp';

const explorerSprite = new Image();
explorerSprite.src = 'assets/player-sprite.png';

function drawExplorer(ctx, player, time, scale = .63) {
  const frameIndex = player.moving ? 1 + Math.floor(time / 100) % 6 : 0;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(player.x), Math.round(player.y));
  ctx.scale(player.facing || 1, 1);
  ctx.drawImage(explorerSprite, frameIndex * 32, 0, 32, 48, -16 * scale, -48 * scale, 32 * scale, 48 * scale);
  ctx.restore();
}

function sprite({ box }, x, y, accent) {
  box(x+1, y+20, 15, 3, '#101327');
  box(x+2, y+9, 13, 10, '#161b32');
  box(x+4, y+10, 9, 7, '#a8b9dd');
  box(x+5, y+11, 7, 3, accent);
  box(x+2, y+11, 2, 5, '#ebedf5');
  box(x+13, y+11, 2, 5, '#7885af');
  box(x+4, y+17, 3, 4, '#d7dfef');
  box(x+10, y+17, 3, 4, '#8998bc');
  box(x+2, y+2, 13, 8, '#d5def1');
  box(x+4, y+1, 9, 2, '#f6f8ff');
  box(x+5, y+4, 9, 5, '#172745');
  box(x+6, y+5, 2, 2, accent);
  box(x+11, y+5, 2, 2, accent);

}

function drawMap(canvas, player, mission, active, crew, time) {
  const pen = painter(canvas);
  const { box, label } = pen;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!mission.outside) {
    crew.slice(1).forEach((member, i) => sprite(pen, [84, 206, 249, 343][i], 122, member.color));
  }

  const { x, y } = mission;
  box(x-5, y-6, 10, 9, '#172237');
  box(x-3, y-7, 6, 3, '#a7edff');
  box(x-2, y-3, 4, 3, '#65caef');
  if (active) {
    const markerY = y-15-Math.round(Math.sin(time/220)*2);
    box(x-4, markerY, 9, 2, '#ffcc75');
    box(x-2, markerY+2, 5, 2, '#ffcc75');
    box(x, markerY+4, 1, 2, '#ffcc75');
  }
  if (explorerSprite.naturalWidth) drawExplorer(context, player, time);
  else sprite(pen, player.x-8, player.y-20, crew[0].color);
  label('TÚ', Math.round(player.x), Math.round(player.y-33), '#fff1b9');
}

function drawMissionSky(canvas) {
  const pen = painter(canvas);
  const { box } = pen;
  starfield(pen, canvas.width, canvas.height);
  const craters = [[-22, -16, 12], [11, -27, 10], [-8, 18, 15], [22, 4, 12]];
  for (let y = -46; y <= 46; y += 2) {
    for (let x = -46; x <= 46; x += 2) {
      if (x*x + y*y > 46*46) continue;
      const crater = craters.some(([cx, cy, radius]) => (x-cx)**2 + (y-cy)**2 < radius*radius);
      const light = Math.max(0, Math.min(3, 2 - Math.floor((x+y) / 32) - Number(crater)));
      box(292+x, 65+y, 2, 2, ['#1b2041', '#22294e', '#313963', '#414873'][light]);
    }
  }
  for (let x = 0; x < canvas.width; x += 3) {
    const y = 204 + Math.round(4 * Math.sin(x/23) + 3 * Math.sin(x/8));
    box(x, y, 3, canvas.height-y, '#272d57');
    box(x, y, 3, 1, '#454b76');
  }
}

const platformY = 181;
const craterPlatformY = 192;
const platformDoorX = 67;
const platformOpen = new Image();
platformOpen.src = 'assets/primer-contacto.webp';
const platformMapped = new Image();
platformMapped.src = 'assets/ruta-lunar.webp';
const roverSprite = new Image();
roverSprite.src = 'assets/curiosity-sprite.png';

const craterOutpost = new Image();
craterOutpost.src = 'assets/puesto-crater.webp';
const craterRim = new Image();
craterRim.src = 'assets/borde-crater.webp';
const craterInterior = new Image();
craterInterior.src = 'assets/interior-crater.webp';

const craterRoutes = [
  { image: craterRim, label: 'BORDE ILUMINADO', points: [[34, 165], [107, 176], [195, 193], [272, 202], [349, 200]] },
  { image: craterInterior, label: 'INTERIOR EN SOMBRA', points: [[34, 169], [111, 171], [184, 174], [241, 169], [289, 166]], headlamp: true }
];

function drawPlatform(canvas, player, mission, phase, time, shot) {
  const ctx = canvas.getContext('2d');
  const { box, label } = painter(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (phase === 'feedback' && !shot?.route) return;

  if (phase === 'explore') {
    const y = mission.y - 43 - Math.round(Math.sin(time / 210) * 2);
    box(mission.x-3, y, 7, 2, '#ffdc7a');
    box(mission.x-1, y+2, 3, 2, '#ffdc7a');
  }

  const progress = shot?.scientific ? shot.travelProgress || 0 : shot ? Math.min(1, shot.elapsed / shot.duration / .83) : 0;
  let x = shot ? shot.startX + (352 - shot.startX) * progress : player.x;
  let y = mission.y;
  if (shot?.route) {
    const points = shot.route.points;
    const position = progress * (points.length - 1);
    const index = Math.min(points.length - 2, Math.floor(position));
    const offset = position - index;
    const [[fromX, fromY], [toX, toY]] = points.slice(index, index + 2);
    x = fromX + (toX - fromX) * offset;
    y = fromY + (toY - fromY) * offset;
    if (shot.route.headlamp) {
      ctx.fillStyle = '#81c9ff2f';
      ctx.beginPath();
      ctx.moveTo(x+14, y-21);
      ctx.lineTo(x+62, y-33);
      ctx.lineTo(x+62, y+4);
      ctx.closePath();
      ctx.fill();
    }
  }

  if (!shot || !shot.rover) {
    const explorer = shot ? { x, y, facing: shot.returning ? -1 : 1, moving: progress < 1 } : player;
    if (explorerSprite.naturalWidth) drawExplorer(ctx, explorer, time, .66);
    else sprite(painter(canvas), x-8, y-20, '#ffcd76');
    if (!shot) label('TÚ', Math.round(player.x), y-35, '#fff1b9');
  } else if (roverSprite.naturalWidth) {
    const frameIndex = progress < 1 ? 6 + Math.floor(time / 95) % 6 : 0;
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(Math.round(x),Math.round(y));
    if(shot.returning)ctx.scale(-1,1);
    ctx.drawImage(roverSprite, frameIndex * 64, 0, 64, 52, -21, -34, 42, 34);
    ctx.restore();
    if(shot.signalLost)label('SEÑAL PERDIDA',Math.round(x),y-40,'#ff8b91');
  }

  if (shot && phase === 'cinematic' && progress >= .9 && !reducedMotion.matches) {
    for (let i = 0; i < 3; i++) {
      const width = Math.round(((shot.elapsed / 27 + i * 11) % 34) + 5);
      box(x-width/2, y-44-i*3, width, 1, '#80f2ff');
    }
  }
}
