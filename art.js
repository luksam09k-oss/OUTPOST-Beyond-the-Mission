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

function drawMoon(canvas) {
  const pen = painter(canvas);
  starfield(pen, canvas.width, canvas.height);
  const { box } = pen;
  const craters = [[-21,-24,12], [18,14,17], [-30,20,7], [22,-30,9], [3,-12,6], [-4,37,9]];
  for (let y = -56; y <= 56; y += 2) {
    for (let x = -56; x <= 56; x += 2) {
      if (x*x + y*y > 56*56) continue;
      const crater = craters.some(([cx, cy, r]) => (x-cx)**2 + (y-cy)**2 < r*r);
      const light = 4 - Math.floor((x+y+112)/46) - Number(crater);
      const tones = ['#3a4166','#526189','#7788aa','#a1b4ca','#cbd9e8'];
      box(142+x, 72+y, 2, 2, tones[Math.max(0, light)]);
    }
  }
}

function sprite({ box }, x, y, accent, robot = false, stride = 0) {
  box(x+1, y+20, 15, 3, '#101327');
  box(x+2, y+9, 13, 10, '#161b32');
  box(x+4, y+10, 9, 7, '#a8b9dd');
  box(x+5, y+11, 7, 3, accent);
  box(x+2, y+11, 2, 5, '#ebedf5');
  box(x+13, y+11, 2, 5, '#7885af');
  box(x+4, y+17, 3, 4 + stride, '#d7dfef');
  box(x+10, y+17, 3, 4 - stride, '#8998bc');
  box(x+2, y+2, 13, 8, '#d5def1');
  box(x+4, y+1, 9, 2, '#f6f8ff');
  box(x+5, y+4, 9, 5, '#172745');
  box(x+6, y+5, 2, 2, accent);
  box(x+11, y+5, 2, 2, accent);
  if (robot) {
    box(x+8, y-2, 1, 4, '#a8b9dd');
    box(x+7, y-3, 3, 2, accent);
  }
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
  starfield(pen, 384, 192);
  if (exterior) {
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
    box(0, 40, 384, 61, '#20294b');
    box(0, 38, 384, 4, '#394a85');
    box(0, 98, 384, 81, '#222b49');
    for (let x = 0; x < 384; x += 24) {
      box(x, 43, 2, 55, '#323c66');
      box(x+5, 47, 14, 2, '#586183');
      for (let y = 99; y < 168; y += 17) {
        box(x+1, y+1, 22, 15, (x+y)%4 ? '#303958' : '#293451');
        box(x+3, y+3, 2, 2, '#475172');
      }
    }
    box(0, 171, 384, 7, '#171d34');
    for (let x = 0; x < 384; x += 10) {
      for (let y = 0; y < 6; y++) box(x+y, 171+y, 4, 1, '#b49258');
    }
    consoleUnit(pen, 65, 'INVESTIGACIÓN', '#89edff');
    consoleUnit(pen, 192, 'LABORATORIO', '#bca5ff');
    consoleUnit(pen, 319, 'SOPORTE VITAL', '#97e8b0');
    crew.slice(1).forEach((member, i) => sprite(pen, 87+i*64, 100, member.color));
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
  sprite(pen, player.x-8, player.y-20, crew[0].color, false, player.moving ? Math.floor(time/100)%3-1 : 0);
  label('TÚ', Math.round(player.x), Math.round(player.y-24), '#fff1b9');
}
