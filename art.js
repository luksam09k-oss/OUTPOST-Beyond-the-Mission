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

function consoleUnit({ box, label }, x, name, accent) {
  box(x-28, 57, 56, 38, '#0e1429');
  box(x-25, 59, 50, 30, '#354773');
  box(x-22, 62, 44, 17, '#172e4d');
  for (let row = 64; row < 77; row += 3) box(x-20, row, 40, 1, '#285976');
  label(name, x, 73, accent);
  box(x-20, 83, 8, 2, accent);
  box(x-8, 83, 3, 2, '#fdb673');
  box(x+8, 83, 12, 2, '#6d82a8');
  box(x-21, 89, 5, 10, '#212945');
  box(x+16, 89, 5, 10, '#212945');
}

function drawMap(canvas, player, mission, active, crew, time) {
  const pen = painter(canvas);
  const { box, label } = pen;
  const exterior = mission.outside;
  const context = canvas.getContext('2d');
  if (exterior) {
    starfield(pen, 384, 192);
    box(0, 76, 384, 116, '#444766');
    for (let x = 0; x < 384; x += 8) {
      box(x, 73 + Math.floor(Math.sin(x/25)*5), 8, 12, '#676987');
    }
    for (let i = 0; i < 330; i++) {
      box((i*97+i*i*7)%384, 84+(i*23+i*i*9)%108, 2+i%4, 1+i%2, ['#565977','#363a58','#777991'][i%3]);
    }
    for (const [x, y] of [[16,143],[142,94],[318,156]]) {
      box(x, y+3, 29, 7, '#303450');
      box(x+4, y, 20, 3, '#777a98');
      box(x+6, y+10, 17, 2, '#606681');
    }
    consoleUnit(pen, 42, 'BASE', '#89edff');
    if (mission.location === 'Borde del cráter') {
      for (let row = -19; row <= 19; row++) {
        const radius = Math.round(59 * Math.sqrt(1 - (row / 20) ** 2));
        box(215-radius, 138+row, radius*2, 1, row < -12 ? '#7d809c' : '#252a49');
      }
      box(185, 137, 58, 2, '#313754');
    } else if (mission.location === 'Zona polar') {
      for (let row = 0; row < 48; row++) {
        box(226+Math.floor(row/2), 79+row, 155-Math.floor(row/2), 1, '#292d50');
      }
      box(281, 104, 7, 2, '#677ca5');
      box(298, 95, 4, 2, '#839abd');
    }
  } else {
    if (lunarInterior.naturalWidth) {
      context.drawImage(lunarInterior, 0, 0, canvas.width, canvas.height);
    } else {
      box(0, 0, canvas.width, canvas.height, '#161c3d');
      box(0, 132, canvas.width, 43, '#303958');
    }
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

const platformY = 180;
const platformDoorX = 67;
const platformOpen = new Image();
platformOpen.src = 'assets/primer-contacto.webp';
const platformMapped = new Image();
platformMapped.src = 'assets/ruta-lunar.webp';
const roverSprite = new Image();
roverSprite.src = 'assets/curiosity-sprite.png';

function drawPlatform(canvas, player, phase, time, shot) {
  const ctx = canvas.getContext('2d');
  const { box, label } = painter(canvas);
  const background = phase === 'feedback' && platformMapped.naturalWidth ? platformMapped : platformOpen;
  if (background.naturalWidth) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
  } else {
    box(0, 0, canvas.width, canvas.height, '#161c3d');
    box(0, platformY, canvas.width, 12, '#7278ac');
  }
  if (phase === 'arrival' || phase === 'feedback') return;

  if (phase === 'explore') {
    const y = platformY - 43 - Math.round(Math.sin(time / 210) * 2);
    box(125, y, 7, 2, '#ffdc7a');
    box(127, y+2, 3, 2, '#ffdc7a');
  }

  const progress = shot ? Math.min(1, shot.elapsed / shot.duration) : 0;
  const moverX = shot ? shot.startX + (352 - shot.startX) * Math.min(1, progress / .83) : player.x;
  if (!shot || !shot.rover) {
    const explorer = shot ? { x: moverX, y: platformY, facing: 1, moving: progress < .83 } : player;
    if (explorerSprite.naturalWidth) drawExplorer(ctx, explorer, time, .66);
    else sprite(painter(canvas), explorer.x-8, platformY-20, '#ffcd76');
    if (!shot) label('TÚ', Math.round(player.x), platformY-35, '#fff1b9');
  } else if (roverSprite.naturalWidth) {
    const frameIndex = progress < .83 ? 6 + Math.floor(time / 95) % 6 : 0;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(roverSprite, frameIndex * 64, 0, 64, 52, Math.round(moverX)-21, platformY-34, 42, 34);
  }

  if (shot && progress >= .78 && !reducedMotion.matches) {
    for (let i = 0; i < 3; i++) {
      const width = Math.round(((shot.elapsed / 27 + i * 11) % 34) + 5);
      box(Math.round(moverX)-width/2, platformY-44-i*3, width, 1, '#80f2ff');
    }
  }
}
