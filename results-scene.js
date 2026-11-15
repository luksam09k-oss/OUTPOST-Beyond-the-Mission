const g = document.getElementById('fx').getContext('2d'), world = document.getElementById('world');
g.scale(.5, .5);                                   // se dibuja en coordenadas de la imagen (1672×941)
const R = (a, b) => a + Math.random() * (b - a), sn = Math.sin, ease = x => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;
const calm = matchMedia('(prefers-reduced-motion:reduce)').matches;
let mx = 0, my = 0, smx = 0, smy = 0, sh = null;

/* estrellas de 4 puntas (posiciones tomadas de la imagen) */
const STARS = [[75,44,'#ffd27a',1],[958,45,'#ffd27a',1.6],[818,125,'#bfe0ff',1.3],[48,150,'#fff',1],[53,305,'#ffd27a',1],[152,113,'#ffd27a',.6],[663,90,'#ffd27a',.7],[886,272,'#dff0ff',.9],[910,374,'#ffd27a',1.1],[1615,170,'#dff0ff',1],[1609,46,'#fff',.9],[1527,93,'#fff',.6],[1500,22,'#fff',.6],[1549,234,'#ffd27a',.6]].map(([x,y,c,s]) => ({ x, y, c, s, p: R(0, 6.28), f: R(.8, 2) }));
const GLINT = [[95,470],[1100,545],[1410,552],[1608,512],[985,572],[1268,598]].map(([x, y]) => ({ x, y, p: R(0, 6.28) }));
const TINY = []; while (TINY.length < 80) {
  const x = R(0, 1672), y = R(0, 500);
  if (((x - 440) / 270) ** 2 + ((y - 360) / 250) ** 2 < 1 || Math.hypot(x - 1283, y - 235) < 195) continue;
  TINY.push({ x: x / 4 | 0, y: y / 4 | 0, p: R(0, 6.28), f: R(1, 3.5), c: ['#fff', '#bfe0ff', '#ffe3a6'][TINY.length % 3] });
}
const DUST = Array.from({ length: 50 }, () => ({ x: R(0, 1672), y: R(620, 941), z: R(.3, 1), p: R(0, 6.28) }));
const LEDS = [[[432,348,34,10],[432,362,34,10],[432,376,34,10],[432,390,34,11]], [[164,669,30,16],[160,691,29,12],[158,704,29,11],[154,721,30,18]]];

function spark(x, y, c, n, a) {
  g.globalAlpha = a; g.fillStyle = c; g.fillRect(x - 4, y - 4, 8, 8);
  for (let i = 1; i <= n; i++) { const w = i < n * .6 ? 4 : 2, l = i * 4 + 4;
    g.fillRect(x + l - 4, y - w / 2, 4, w); g.fillRect(x - l, y - w / 2, 4, w); g.fillRect(x - w / 2, y + l - 4, w, 4); g.fillRect(x - w / 2, y - l, w, 4); }
  g.globalAlpha = 1;
}
function glow(x, y, r0, r1, col, a) {
  const gr = g.createRadialGradient(x, y, r0, x, y, r1); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr; g.fillRect(x - r1, y - r1, r1 * 2, r1 * 2);
}

/* nebulosas moradas: manchas que derivan a lo largo de cada estela */
function nebula(t) {
  g.globalCompositeOperation = 'lighter';
  [[0, 235, 650, 0], [1210, 495, 1672, 320]].forEach(([x0, y0, x1, y1], k) => {
    for (let i = 0; i < 9; i++) {
      const s = (i / 9 + t * .018 + k * .3) % 1, env = sn(Math.PI * s), x = x0 + (x1 - x0) * s, y = y0 + (y1 - y0) * s + sn(t * .5 + i) * 10;
      glow(x, y, 0, 85, '150,80,255', .2 * env * (.7 + .3 * sn(t + i * 2)));
    }
  });
  g.globalCompositeOperation = 'source-over';
}

/* la Tierra: halo que respira y un brillo que la recorre */
function earth(t) {
  const cx = 1283, cy = 235, r = 172, a = .5 + .5 * sn(t * .9);
  g.globalCompositeOperation = 'lighter';
  let gr = g.createRadialGradient(cx, cy, r * .9, cx, cy, r * 1.4); gr.addColorStop(0, `rgba(90,170,255,${.26 + .2 * a})`); gr.addColorStop(1, 'rgba(90,170,255,0)');
  g.fillStyle = gr; g.fillRect(cx - r * 1.5, cy - r * 1.5, r * 3, r * 3);
  g.save(); g.beginPath(); g.arc(cx, cy, r - 2, 0, 6.283); g.clip();
  const x0 = cx - r + (((t * .07) % 1) * 2.4 - .7) * 2 * r;
  gr = g.createLinearGradient(x0 - 80, cy - r * .6, x0 + 80, cy + r * .6);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(190,225,255,.17)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2); g.restore();
  g.globalCompositeOperation = 'source-over';
}

/* destello del sol en la visera */
function flare(t) {
  const x = 645, y = 258, p = .55 + .45 * sn(t * 1.7) * sn(t * .6 + 1);
  g.globalCompositeOperation = 'lighter';
  glow(x, y, 0, 70 + 20 * p, '255,200,140', .25 + .4 * p);
  for (let i = 0; i < 8; i++) {
    const len = (i % 2 ? 70 : 190) * (.7 + .5 * p);
    g.save(); g.translate(x, y); g.rotate(i * Math.PI / 4 + sn(t * .5 + i) * .05 + (i % 2 ? t * .03 : 0));
    const gr = g.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, `rgba(255,230,190,${.7 * p})`); gr.addColorStop(1, 'rgba(255,200,150,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, -2); g.lineTo(len, 0); g.lineTo(0, 2); g.fill(); g.restore();
  }
  g.globalCompositeOperation = 'source-over'; spark(x, y, '#fff', 4, .5 + .5 * p);
}

/* luces del casco y de la mochila: barras que se encienden en secuencia */
function leds(t) {
  LEDS.forEach((bars, k) => {
    const cx = k ? 174 : 449, cy = k ? 704 : 372, on = Math.floor(t * 3 + k * 1.7) % 4;
    g.globalCompositeOperation = 'lighter'; glow(cx, cy, 10, 95, '255,190,60', .16 + .2 * (.5 + .5 * sn(t * 2.4 + k * 2)));
    bars.forEach((b, i) => {
      if (i === on) { g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,235,150,.5)'; }
      else { g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(110,45,8,.4)'; }
      g.fillRect(...b);
    });
  });
  g.globalCompositeOperation = 'source-over';
}

function frame(now) {
  const t = now / 1000;
  g.clearRect(0, 0, 1672, 941);
  nebula(t); earth(t);
  for (const s of TINY) { g.globalAlpha = .1 + .7 * (.5 + .5 * sn(t * s.f + s.p)) ** 3; g.fillStyle = s.c; g.fillRect(s.x * 4, s.y * 4, 4, 4); }
  g.globalAlpha = 1;
  for (const s of STARS) { const a = (.5 + .5 * sn(t * s.f + s.p)) ** 2; spark(s.x, s.y, s.c, Math.round(2 + 3 * s.s * a), .3 + .7 * a); }
  for (const m of GLINT) { const a = Math.max(0, sn(t * .8 + m.p)) ** 14; if (a > .05) spark(m.x, m.y, '#fff', 3, a); }
  flare(t); leds(t);
  for (const d of DUST) {                                            // polvo lunar
    d.x -= .35 * d.z; d.y += sn(t * .6 + d.p) * .12 - .03 * d.z; if (d.x < -10) { d.x = 1682; d.y = R(620, 941); } if (d.y < 600) d.y = 941;
    g.fillStyle = `rgba(215,205,255,${(.15 + .35 * d.z) * (.6 + .4 * sn(t * 2 + d.p))})`; g.fillRect((d.x / 4 | 0) * 4, (d.y / 4 | 0) * 4, d.z > .7 ? 8 : 4, d.z > .7 ? 8 : 4);
  }
  if (!calm) {                                                       // estrella fugaz
    if (!sh && Math.random() < .004) sh = { x: R(800, 1500), y: R(10, 160), l: 0 };
    if (sh) { sh.x -= 26; sh.y += 11; sh.l++; for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(255,255,255,${1 - i / 14})`; g.fillRect(((sh.x + i * 22) / 4 | 0) * 4, ((sh.y - i * 9.4) / 4 | 0) * 4, 8, 4); } if (sh.l > 34) sh = null; }
  }
  smx += (mx - smx) * .05; smy += (my - smy) * .05;                  // cámara: deriva suave + paralaje con el ratón
  const k = calm ? 0 : 1, z = 1.045 + .07 * (1 - ease(t / 3.2)) + .008 * sn(t * .2) * k;
  world.style.transform = `translate(${(-smx * 1.2 + sn(t * .17) * .5) * k}%,${(-smy * .8 + sn(t * .23) * .35) * k}%) scale(${z})`;
  if (!calm) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; });
