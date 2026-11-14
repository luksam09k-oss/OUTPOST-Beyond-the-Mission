function animateOpening(onComplete, backdrop) {
  const cv = backdrop || document.getElementById('c'), g = cv.getContext('2d'), W = 320, H = 180;
  const stage = document.getElementById('stage'), hud = document.getElementById('hud'), bar = document.getElementById('bar'), wh = document.getElementById('wh');
  const rnd = (a, b) => a + Math.random() * (b - a), clamp = x => Math.min(1, Math.max(0, x)), ease = x => 1 - (1 - clamp(x)) ** 3;
  let mx = 0, tl = -1, shoot = null;

  /* ---------- estrellas ---------- */
  const cols = ['#ffffff', '#bcd6ff', '#ffe9b0', '#d9b8ff'];
  const stars = Array.from({ length: 140 }, () => ({ x: rnd(0, W), y: rnd(0, 140), z: rnd(.3, 1), p: rnd(0, 6.28), s: rnd(1, 3), c: cols[Math.random() * 4 | 0], big: Math.random() < .08 }));

  /* ---------- sprites ---------- */
  const pal = { w: '#f2f6ff', g: '#9fb0d6', k: '#0b1230', b: '#2f8cff', o: '#ff9b3d', c: '#6fe3ff', d: '#5a6aa0', K: '#6fe3ff' };
  const ASTRO = ['..wwwww...', '.wwwwwww..', '.wkkkkkw..', '.wkbbbkw..', '.wkkkkkw..', '..wwwww...', 'gwwwwwwwg.', 'gwwoowwwg.', 'gwwwwwwwg.', '.wwwwwww..', '.ww...ww..', '.ww...ww..', '.dd...dd..'];
  const BOT = ['...c...', '..www..', '.wkkkw.', '.wcKcw.', '.wwwww.', '..wbw..', '.w.w.w.'];
  function sprite(map, x, y, s) {
    map.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') { g.fillStyle = pal[ch]; g.fillRect(x + i * s, y + j * s, s, s); } }));
  }
  const disc = (x, y, r, c) => { g.fillStyle = c; for (let j = -r; j <= r; j++) { const w = Math.round(Math.sqrt(r * r - j * j)); g.fillRect(x - w, y + j, w * 2 + 1, 1); } };
  function line(a, b, p, c) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.max(Math.abs(dx), Math.abs(dy)), n = L * p; g.fillStyle = c;
    for (let i = 0; i <= n; i++) g.fillRect(Math.round(a[0] + dx * i / L), Math.round(a[1] + dy * i / L), 1, 1);
  }

  /* ---------- planetas (cacheados cada ~90 ms) ---------- */
  const oc = document.createElement('canvas'); oc.width = W; oc.height = H; const og = oc.getContext('2d'); let lp = -1e3;
  function planet(c, cx, cy, r, t, kind) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const nx = x / r, ny = y / r, d = nx * nx + ny * ny; if (d > 1) continue;
      const z = Math.sqrt(1 - d), lon = Math.atan2(nx, z) + t, lat = Math.asin(ny);
      const n = Math.sin(lon * 3 + 1) * Math.cos(lat * 4) + .5 * Math.sin(lon * 5 + lat * 3);
      const lit = Math.max(.25, 1 - ((nx + .5) ** 2 + (ny + .5) ** 2) * .55);
      let k = kind === 'earth' ? (n > .35 ? [60, 170, 90] : n > .2 ? [40, 120, 200] : [25, 80, 190]) : (n > .4 ? [150, 55, 30] : n > -.3 ? [220, 105, 55] : [190, 80, 40]);
      if (kind === 'earth' && d > .86) k = [110, 180, 255];
      c.fillStyle = `rgb(${k[0] * lit | 0},${k[1] * lit | 0},${k[2] * lit | 0})`; c.fillRect(cx + x, cy + y, 1, 1);
    }
  }
  function moon(cx, cy, r) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      const v = (((x * 7 + y * 13) % 11 === 0) ? 105 : 150) * Math.max(.4, 1 - ((x + 3) ** 2 + (y + 3) ** 2) / (r * r * 2.6)) | 0;
      g.fillStyle = `rgb(${v},${v},${v + 20})`; g.fillRect(cx + x, cy + y, 1, 1);
    }
  }
  function nebula(t) {
    const sp = [[285, 18, 60, 40], [265, 95, 45, 25], [15, 108, 50, 18]];
    for (let y = 0; y < 140; y += 3) for (let x = 0; x < W; x += 3) {
      let m = 0; for (const [sx, sy, rx, ry] of sp) m = Math.max(m, 1 - Math.hypot((x - sx) / rx, (y - sy) / ry)); if (m <= 0) continue;
      const n = Math.sin(x * .13 + t * .25) + Math.sin(y * .17 - t * .2) + Math.sin((x + y) * .09 + t * .15), a = m * (n + 1.4) * .22;
      if (a > .05) { g.fillStyle = `rgba(${130 + n * 25 | 0},70,${200 - n * 20 | 0},${Math.min(a, .55)})`; g.fillRect(x, y, 3, 3); }
    }
  }

  /* ---------- superficie lunar y base ---------- */
  const gy = x => 176 - 38 * Math.pow(Math.abs(x - 160) / 160, 1.4) + Math.sin(x * .09) * 1.2;
  function ground() {
    for (let x = 0; x < W; x++) { const y = gy(x) | 0; g.fillStyle = '#7078bd'; g.fillRect(x, y, 1, H - y); g.fillStyle = '#8f98dc'; g.fillRect(x, y, 1, 1); }
    [[20, 152, 9, 2], [70, 166, 12, 3], [115, 172, 8, 2], [165, 176, 14, 3], [210, 170, 9, 2], [252, 166, 16, 3], [300, 156, 10, 3]]
      .forEach(([x, y, r, h]) => { g.fillStyle = '#4f579a'; g.fillRect(x - r, y, r * 2, h); g.fillStyle = '#8f98dc'; g.fillRect(x - r, y - 1, r * 2, 1); });
  }
  function base(t) {
    const bx = 258, by = 158, fl = .8 + .2 * Math.sin(t * 9) * Math.sin(t * 3.1);
    g.fillStyle = '#8d9bbf'; g.fillRect(bx - 38, by - 12, 78, 14); g.fillStyle = '#6d7aa3'; g.fillRect(bx - 38, by - 4, 78, 6);
    for (let y = -26; y <= 0; y++) { const w = Math.round(28 * Math.sqrt(1 - (y / 26) ** 2)); g.fillStyle = y < -18 ? '#a9d8ff' : y < -8 ? '#5d9cf0' : '#3f6fc8'; g.fillRect(bx - w - 4, by - 12 + y, w * 2, 1); }
    g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(bx - 14, by - 34, 9, 2); g.fillRect(bx - 19, by - 30, 3, 3);
    g.fillStyle = `rgb(${255 * fl | 0},${150 * fl | 0},40)`; g.fillRect(bx - 24, by - 9, 11, 11); g.fillStyle = '#ffd27a'; g.fillRect(bx - 22, by - 7, 7, 9);
    g.fillStyle = '#7f8ab0'; g.fillRect(bx + 26, by - 48, 9, 50); g.fillStyle = '#aab6d8'; g.fillRect(bx + 26, by - 48, 3, 50); g.fillStyle = '#ffcf6a'; g.fillRect(bx + 31, by - 26, 2, 7);
    g.fillStyle = '#9aa6c8'; g.fillRect(bx + 30, by - 62, 1, 14); g.fillStyle = Math.sin(t * 5) > 0 ? '#ff4d4d' : '#6a2030'; g.fillRect(bx + 29, by - 65, 3, 3);
    const a = t * 1.3, dx = Math.cos(a) * 8, dy = Math.sin(a) * 3; g.fillStyle = '#c9d4f0';
    for (let i = -4; i <= 4; i++) g.fillRect(bx + 40 + dx * i / 4 | 0, by - 56 + dy * i / 4 + Math.abs(i) * .5 | 0, 2, 2);
    g.fillStyle = '#7f8ab0'; g.fillRect(bx + 40, by - 54, 2, 8);
  }
  function scene(now, t) {
    if (now - lp > 90) { lp = now; og.clearRect(0, 0, W, H); planet(og, 36, 50, 40, t * .12, 'earth'); planet(og, 298, 57, 24, t * .08 + 1, 'mars'); }
    g.drawImage(oc, mx * 3 | 0, 0);
    moon(91 + (mx * 3 | 0), 36 + Math.sin(t * .8) * 1.5 | 0, 9);
    ground(); base(t);
    const bob = Math.sin(t * 2) > .6 ? 1 : 0, ay = (gy(36) | 0) - 39 + 1;
    g.fillStyle = 'rgba(0,0,30,.3)'; g.fillRect(22, ay + 38, 34, 2);
    sprite(ASTRO, 24, ay - bob, 3);
    const hop = Math.abs(Math.sin(t * 1.6)) * 4 | 0, ry = (gy(64) | 0) - 21 - hop;
    sprite(BOT, 54, ry, 3); g.fillStyle = Math.sin(t * 6) > 0 ? '#6fe3ff' : '#2a4a80'; g.fillRect(63, ry, 3, 3);
  }

  /* ---------- cohete (cámara exterior) ---------- */
  const smoke = [];
  function col(x, y, w, h, b, d, l) {
    const dk = Math.min(6, w >> 1), lt = Math.min(3, w >> 2);
    g.fillStyle = b; g.fillRect(x, y, w, h); g.fillStyle = d; g.fillRect(x + w - dk, y, dk, h); g.fillStyle = l; g.fillRect(x + lt, y, lt, h);
  }
  function rocket(t, tr) {
    const cx = 160, top = Math.round(16 + (1 - ease(tr / 2.2)) * 220), y0 = top + 26, yb = y0 + 68;
    for (let i = 0; i < 26; i++) { const w = Math.round(14 * Math.sqrt((i + 1) / 26)); col(cx - w, top + i, w * 2, 1, '#e0463d', '#a82a2f', '#ff7a6b'); }
    col(cx - 14, y0, 28, 68, '#e8eefc', '#a9b5da', '#ffffff');
    col(cx - 14, y0 + 4, 28, 4, '#e0463d', '#a82a2f', '#ff7a6b'); col(cx - 14, y0 + 54, 28, 6, '#e0463d', '#a82a2f', '#ff7a6b');
    const py = y0 + 28;                                                    // ventanilla: astronauta + robot adentro
    disc(cx, py, 10, '#7a86b4'); disc(cx, py, 8, '#2a3a7a'); disc(cx, py, 6, '#0d1640'); disc(cx - 2, py + 1, 4, '#f2f6ff');
    g.fillStyle = '#0b1230'; g.fillRect(cx - 5, py, 6, 3); g.fillStyle = '#2f8cff'; g.fillRect(cx - 4, py, 2, 1);
    g.fillStyle = '#6fe3ff'; g.fillRect(cx + 3, py + 2, 3, 3); g.fillRect(cx + 4, py, 1, 2); g.fillStyle = '#fff'; g.fillRect(cx - 6, py - 5, 2, 1);
    for (let j = 0; j < 26; j++) { const w = Math.round(j * .8); g.fillStyle = '#d23a37'; g.fillRect(cx - 14 - w, yb - 26 + j, w, 1); g.fillStyle = '#a82a2f'; g.fillRect(cx + 14, yb - 26 + j, w, 1); }
    g.fillStyle = '#4a5278'; g.fillRect(cx - 9, yb, 18, 4); g.fillStyle = '#2a3052'; g.fillRect(cx - 6, yb + 4, 12, 4);
    const L = 30 + Math.sin(t * 40) * 4 + rnd(0, 5);                        // llama
    [['#ff6a2a', 1, 1], ['#ffc44d', .65, .74], ['#fff6d0', .35, .46]].forEach(([c, wf, lf]) => {
      g.fillStyle = c; const Lh = L * lf;
      for (let i = 0; i < Lh; i++) { const w = Math.max(1, Math.round(9 * wf * (1 - Math.pow(i / Lh, 1.6)))); g.fillRect(cx - w, yb + 8 + i, w * 2, 1); }
    });
    g.globalCompositeOperation = 'lighter';
    const gl = g.createRadialGradient(cx, yb + 22, 2, cx, yb + 22, 80); gl.addColorStop(0, 'rgba(255,150,60,.38)'); gl.addColorStop(1, 'rgba(255,150,60,0)');
    g.fillStyle = gl; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 3; i++) smoke.push({ x: cx + rnd(-6, 6), y: yb + 10, vx: rnd(-1.4, 1.4), vy: rnd(1, 3), a: 1 });
    for (let i = smoke.length - 1; i >= 0; i--) {
      const s = smoke[i]; s.x += s.vx; s.y += s.vy; s.a -= .035; if (s.a <= 0) { smoke.splice(i, 1); continue; }
      const z = 3 + (1 - s.a) * 5 | 0; g.fillStyle = `rgba(${200 + 55 * s.a | 0},${170 + 40 * s.a | 0},${150 + 30 * s.a | 0},${s.a * .7})`; g.fillRect(s.x | 0, s.y | 0, z, z);
    }
  }

  /* ---------- constelaciones ---------- */
  const CON = [
    { p: [[34, 38], [62, 24], [92, 50], [74, 84], [40, 76]], e: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [1, 3]] },
    { p: [[176, 22], [204, 40], [232, 24], [258, 58], [216, 88]], e: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 1]] },
    { p: [[84, 132], [126, 116], [168, 138], [212, 120], [262, 142]], e: [[0, 1], [1, 2], [2, 3], [3, 4]] }];
  function constel(ts) {
    CON.forEach((c, k) => {
      const s0 = k * .8;
      c.e.forEach(([a, b], j) => { const p = clamp((ts - s0 - j * .35) / .35); if (p > 0) line(c.p[a], c.p[b], p, 'rgba(150,200,255,.75)'); });
      c.p.forEach((q, i) => {
        if (ts - s0 - i * .35 < 0) return;
        g.fillStyle = `rgba(255,240,200,${.6 + .4 * Math.sin(ts * 3 + i * 2 + k)})`;
        g.fillRect(q[0] - 1, q[1] - 1, 3, 3); g.fillRect(q[0] - 3, q[1], 7, 1); g.fillRect(q[0], q[1] - 3, 1, 7);
      });
    });
  }

  /* ---------- bucle principal ---------- */
  function frame(now) {
    if (!cv.isConnected) return;
    const t = now / 1000, tr = tl < 0 ? -1 : (now - tl) / 1000, rk = tr >= 0 && tr < 5.2, sp = tr >= 5.2, ts = tr - 5.2;
    const warp = rk ? clamp(tr / 2.4) : 0, cam = rk ? Math.pow(clamp(tr / 2.8), 2.2) * H * 1.6 : 0;
    g.fillStyle = '#0a0a2b'; g.fillRect(0, 0, W, H);
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(10,8,40,0)'); gr.addColorStop(1, 'rgba(40,30,110,.55)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.save(); if (rk && tr > .2) { const k = 1 + warp; g.translate(rnd(-k, k) | 0, rnd(-k, k) | 0); }
    nebula(t);
    for (const s of stars) {
      if (rk) { s.y += warp * 8 * s.z; if (s.y > H) { s.y = -6; s.x = rnd(0, W); } }
      else { s.x -= .02 * s.z; if (s.x < -10) { s.x = W + 4; s.y = rnd(0, 140); } }
      const px = s.x + mx * s.z * 5, tw = .55 + .45 * Math.sin(t * s.s + s.p);
      g.globalAlpha = warp > .1 ? 1 : tw; g.fillStyle = s.c; g.fillRect(px | 0, s.y | 0, 1, 1 + (warp * 16 * s.z | 0));
      if (s.big && !rk) { g.fillStyle = tw > .8 ? '#fff1c8' : '#ffcf6a'; g.fillRect(px - 2 | 0, s.y | 0, 5, 1); g.fillRect(px | 0, s.y - 2 | 0, 1, 5); }
    }
    g.globalAlpha = 1;
    if (tl < 0) {
      if (!shoot && Math.random() < .004) shoot = { x: rnd(120, 300), y: rnd(5, 50), l: 0 };
      if (shoot) { shoot.x -= 3; shoot.y += 1.4; shoot.l++; for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(255,255,255,${1 - i / 12})`; g.fillRect(shoot.x + i * 2.2 | 0, shoot.y - i | 0, 2, 1); } if (shoot.l > 40) shoot = null; }
    }
    if (!sp) {
      g.save();
      if (backdrop) { g.translate(0, 20); g.scale(1, .9); }
      else g.translate(0, cam | 0);
      scene(now, t);
      g.restore();
    }
    if (rk) { rocket(t, tr); hud.textContent = 'ALTITUD ' + String(Math.round(tr * tr * 140)).padStart(5, '0') + ' KM'; }
    if (sp) { smoke.length = 0; constel(ts); }
    g.restore();

    if (backdrop) {
      if (!reducedMotion.matches) requestAnimationFrame(frame);
      return;
    }
    wh.style.opacity = tr < 0 ? 0 : clamp(1 - Math.abs(tr - 5.1) / .45);
    stage.classList.toggle('rk', rk && tr > .5); stage.classList.toggle('sp', sp);
    if (sp) {
      bar.style.width = clamp(ts / 6) * 100 + '%';
      if (ts > 6.3) {
        onComplete();
        return;
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if (backdrop) return;

  /* ---------- interacción ---------- */
  stage.addEventListener('pointermove', e => { const r = stage.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - .5; });
  function launch() {
    if (tl >= 0) return;
    tl = performance.now();
    stage.classList.add('go');
    stage.querySelector('button').disabled = true;
  }
  stage.addEventListener('click', launch);
  return launch;
}
