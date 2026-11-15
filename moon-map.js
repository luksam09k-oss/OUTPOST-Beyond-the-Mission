/* WMTS renderer: native polar coordinates, no Earth/Web Mercator conversions. */
const MoonMap = (() => {
  let assetsPromise;
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function json(url) {
    const r = await fetch(url); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.json();
  }
  async function load() {
    assetsPromise ??= Promise.all([json('data/nasa/routes.json'), json('data/nasa/wmts.json')]).catch(error => { assetsPromise = null; throw error; });
    const [data, manifest] = await assetsPromise;
    return { data, manifest, logs: [], tiles: new Map(), timestamp: new Date().toISOString(), capabilitiesStatus: 'Consultando', progress: null };
  }
  async function capabilities(session) {
    const url = session.manifest.capabilities, time = new Date().toISOString();
    session.timestamp=time;session.capabilitiesStatus='Consultando…';session.update?.();
    try {
      const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = await r.text(), xml = new DOMParser().parseFromString(text, 'application/xml');
      if (xml.querySelector('parsererror')) throw new Error('XML no válido');
      const ids = [...xml.getElementsByTagNameNS('*', 'Identifier')].map(n => n.textContent);
      if (!ids.includes(session.manifest.layer) || !ids.includes(session.manifest.matrixSet)) throw new Error('La capa o matriz cambió');
      const entries = [...xml.getElementsByTagNameNS('*', 'TileMatrix')].filter(n => n.getElementsByTagNameNS('*', 'ScaleDenominator').length);
      for (const matrix of session.manifest.matrices) {
        const live = entries.find(n => n.getElementsByTagNameNS('*', 'Identifier')[0]?.textContent === matrix.id);
        const value = name => live?.getElementsByTagNameNS('*', name)[0]?.textContent;
        const origin = value('TopLeftCorner')?.split(/\s+/).map(Number);
        if (!live || Math.abs(Number(value('ScaleDenominator')) * .00028 - matrix.resolution) > .001
          || origin.some((v,i) => v !== matrix.origin[i]) || Number(value('TileWidth')) !== matrix.tileSize) throw new Error('La geometría WMTS cambió; se usa la copia verificada');
      }
      session.capabilitiesStatus = 'HTTP correcto · metadatos verificados';
      session.logs.push({ service: 'Moon Trek GetCapabilities', url, time, status: r.status, source: 'Solicitud de red', layer: session.manifest.layer, raw: text });
    } catch (e) {
      session.capabilitiesStatus = 'Metadatos locales verificados · red no disponible o cambió';
      session.logs.push({ service: 'Moon Trek GetCapabilities', url, time, status: 'No completado', error: e.message, fallback: 'data/nasa/WMTSCapabilities.xml' });
    }
    session.update?.();
  }
  function tile(session, entry) {
    session.pending ??= new Map();
    if(!session.pending.has(entry.file)) session.pending.set(entry.file,requestTile(session,entry).finally(()=>session.pending.delete(entry.file)));
    return session.pending.get(entry.file);
  }
  async function requestTile(session, entry) {
    const key = entry.file;
    if (session.tiles.has(key)) return session.tiles.get(key);
    let result;
    {
      const time = new Date().toISOString();
      try {
        const r = await fetch(entry.url, { cache: 'no-store', signal: AbortSignal.timeout(7000) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const blob = await r.blob();
        const bitmap = await createImageBitmap(blob);
        if (bitmap.width !== 256 || bitmap.height !== 256) { bitmap.close(); throw new Error('Dimensiones inesperadas'); }
        result = { image: bitmap, source: 'NASA · solicitud HTTP', time, status: r.status };
      } catch (e) {
        try {
          const r = await fetch(entry.file); if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const bytes = await r.arrayBuffer();
          if (crypto.subtle) {
            const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2,'0')).join('');
            if (hash !== entry.sha256) throw new Error('SHA-256 de caché incorrecto');
          }
          const bitmap = await createImageBitmap(new Blob([bytes],{type:'image/png'}));
          result = { image: bitmap, source: 'Caché local NASA', time, status: 'Respaldo', error: e.message };
        } catch (fallback) { result = { source: 'No disponible', time, status: 'Error', error: `${e.message}; ${fallback.message}` }; }
      }
    }
    session.tiles.set(key, result);
    session.logs.push({ service: 'Moon Trek GetTile', url: entry.url, time: result.time, status: result.status, source: result.source,
      error: result.error, z: entry.z, row: entry.row, col: entry.col, cache: entry.file, cacheSHA256: entry.sha256 });
    return result;
  }
  function mount(host, session, route, compact = false) {
    host.innerHTML = `<div class="lunar-map"><div class="map-plot">
      <canvas width="960" height="650" aria-label="Mapa NASA de Connecting Ridge con ruta y base ficticias"></canvas>
      <div class="map-legend">● Base ficticia &nbsp; ● Destino &nbsp; ━ Ruta</div>
      ${compact ? '' : '<div class="map-zoom"><button data-map-zoom="1" aria-label="Acercar mapa">+</button><button data-map-zoom="-1" aria-label="Alejar mapa">−</button><button data-map-zoom="0">Encuadrar</button></div>'}
      </div><p class="map-status" role="status">Moon Trek: cargando mapa…</p></div>`;
    const canvas = host.querySelector('canvas'), ctx = canvas.getContext('2d'), label = host.querySelector('.map-status');
    const m = session.manifest;
    let zoom = 0, requestId = 0, tiles = [], view;
    const xs=route.points.map(p=>p[0]),ys=route.points.map(p=>p[1]);
    const xmid=(Math.min(...xs)+Math.max(...xs))/2,ymid=(Math.min(...ys)+Math.max(...ys))/2;
    const fitWidth=Math.max(1400,Math.max(...xs)-Math.min(...xs)+700,(Math.max(...ys)-Math.min(...ys)+700)*960/650);
    function projection(x,y) { return [(x-view[0])/(view[2]-view[0])*canvas.width, (view[3]-y)/(view[3]-view[1])*canvas.height]; }
    function draw() {
      ctx.fillStyle='#0a1024'; ctx.fillRect(0,0,canvas.width,canvas.height);
      if (!view) return;
      for (const {entry,result} of tiles) {
        if (!result?.image) continue;
        const matrix=m.matrices.find(v=>v.id===entry.z),span=matrix.resolution*256;
        const x=matrix.origin[0]+entry.col*span, y=matrix.origin[1]-entry.row*span;
        const [px,py]=projection(x,y), [qx,qy]=projection(x+span,y-span);
        ctx.drawImage(result.image,px,py,qx-px+.3,qy-py+.3);
      }
      const line = (color,width) => {
        ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();route.points.forEach((p,i)=>{const xy=projection(p[0],p[1]);if(i)ctx.lineTo(...xy);else ctx.moveTo(...xy);});ctx.stroke();
      };
      line('#081420',7);line('#75f6ff',3);
      for (const [p,name,color] of [[route.points[0],'BASE','#ffe69a'],[route.points.at(-1),'DESTINO','#91ffff']]) {
        const [x,y]=projection(p[0],p[1]);ctx.fillStyle=color;ctx.strokeStyle='#061020';ctx.lineWidth=3;
        ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fill();ctx.stroke();
        ctx.font='bold 14px monospace';const tx=Math.min(canvas.width-82,Math.max(4,x+12)),ty=Math.max(20,y-12);
        ctx.fillStyle='#09142acc';ctx.fillRect(tx-3,ty-15,76,20);ctx.fillStyle=color;ctx.fillText(name,tx,ty);
      }
      if (session.progress !== null) {
        const p=LunarScience.pointAt(route,session.progress),[x,y]=projection(...p);
        ctx.fillStyle=session.lost?'#ff767c':'#fff';ctx.strokeStyle='#081625';ctx.lineWidth=3;
        ctx.fillRect(x-8,y-8,16,16);ctx.strokeRect(x-8,y-8,16,16);
      }
      // Scale bar in the same projected metres as the routes.
      const length=500/(view[2]-view[0])*canvas.width;
      ctx.fillStyle='#071224d9';ctx.fillRect(13,canvas.height-42,length+24,31);ctx.fillStyle='#fff';ctx.fillRect(24,canvas.height-18,length,3);
      ctx.font='13px monospace';ctx.fillText('500 m',24,canvas.height-24);
    }
    async function refresh() {
      const id=++requestId;
      const width=fitWidth/(zoom?1.7:1),height=width*canvas.height/canvas.width;
      view=[xmid-width/2,ymid-height/2,xmid+width/2,ymid+height/2];
      const z=zoom || fitWidth < 2500 ? '10' : '9',matrix=m.matrices.find(v=>v.id===z),span=matrix.resolution*256;
      const entries=m.tiles.filter(t=>t.z===z && matrix.origin[0]+(t.col+1)*span>view[0] && matrix.origin[0]+t.col*span<view[2]
        && matrix.origin[1]-t.row*span>view[1] && matrix.origin[1]-(t.row+1)*span<view[3]);
      tiles=[];label.textContent='Moon Trek: cargando mapa…';draw();
      session.mapStatus = 'Consultando mosaicos…';
      session.update?.();
      // Four simultaneous requests, bounded by the verified manifest.
      let index=0;
      await Promise.all(Array.from({length:Math.min(4,entries.length)},async()=>{
        while(index<entries.length){const entry=entries[index++],result=await tile(session,entry);if(id!==requestId)return;tiles.push({entry,result});draw();}
      }));
      if(id!==requestId || !host.isConnected)return;
      const live=tiles.filter(t=>t.result.source==='NASA · solicitud HTTP').length;
      const cached=tiles.filter(t=>t.result.image && t.result.source!=='NASA · solicitud HTTP').length;
      const missing=tiles.length-live-cached;
      session.mapStatus = `Moon Trek: ${live} mosaicos por HTTP · ${cached} en caché${missing ? ' · '+missing+' no disponibles' : ''}`;
      const sources = [live && 'en línea', cached && 'copia local'].filter(Boolean);
      const mapStatus = sources.length ? sources.join(' y ') + (missing ? ' · mapa parcial' : '') : 'mapa no disponible';
      label.textContent = `Moon Trek: ${mapStatus}`;
      session.update?.();
    }
    host.querySelectorAll('[data-map-zoom]').forEach(b=>b.addEventListener('click',()=>{zoom=Number(b.dataset.mapZoom)>0?1:0;refresh();}));
    refresh();
    return { draw, dispose:()=>{requestId++;}, canvas };
  }
  function technical(session, route, result) {
    const { manifest, data } = session;
    const number = new Intl.NumberFormat('es', { maximumFractionDigits: 3 });
    const metrics = [
      ['Distancia de ida', route.distanceM, 'm'],
      ['Pendiente máxima', route.maxSlopeDeg, '°'],
      ['Pendiente media', route.meanSlopeDeg, '°'],
      ['Desnivel máximo − mínimo', route.reliefM, 'm'],
      ['Ascenso acumulado', route.ascentM, 'm'],
      ['Descenso acumulado', route.descentM, 'm'],
      ['Elevación mínima', route.elevationMinM, 'm'],
      ['Elevación máxima', route.elevationMaxM, 'm']
    ];
    const information = `<h3>${escape(route.name)}</h3>
      <p>${escape(route.difficulty)} · Connecting Ridge</p>
      <dl class="science-metrics">${metrics.map(([label, value, unit]) =>
        `<div><dt>${label}</dt><dd>${number.format(value)}${unit === '°' ? '' : ' '}${unit}</dd></div>`).join('')}</dl>
      <figure class="science-profile">
        <canvas class="elevation-profile" width="360" height="100" aria-label="Perfil de elevación de LOLA"></canvas>
        <figcaption>Perfil de elevación a lo largo de la ruta de ida</figcaption>
      </figure>
      <details><summary>Cómo se calculó la ruta</summary>
        <p>Las alturas se expresan respecto al radio lunar de 1 737 400 m. Las pendientes se verificaron en celdas de 20 m con el máximo de sus 16 píxeles de 5 m. El perfil se muestreó cada 5 m o menos.</p>
        <p>La base y la ruta son ficticias. LOLA incluye alturas interpoladas. Los obstáculos de menos de 5 m y la iluminación quedan fuera de este análisis, incluso en la ruta «Aproximación a la sombra».</p>
        <p><a href="data/nasa/routes.json" target="_blank" rel="noopener">Perfil LOLA completo y coordenadas</a></p>
      </details>
      <details><summary>Fórmulas y valores de la simulación</summary>
        <p>Tiempo = ida y vuelta / velocidad × (1 + pendiente media / 20) + 0,25 h de estudio. Oxígeno = horas × (5 × consumo base + traje, si sale un astronauta). Energía = soporte de base + kilómetros × equipo × pendiente + ascenso y descenso + instrumentos. Radiación = horas × (índice protegido + índice exterior, si procede) × condición ambiental simulada.</p>
        <p>Riesgo del rover = referencia de ruta + distancia de ida × 0,8 %/km + pendiente máxima × 0,2 %/grado + relieve × 0,6 %/100 m, limitado al 45 %. La retirada humana tiene un 60 % de ese riesgo, con un límite del 30 %. El resultado se sortea una vez.</p>
        <p>Si falla, se aplica la fracción del consumo previsto según el tiempo transcurrido. Una retirada humana incluye el regreso. Las observaciones se transmiten al llegar al destino. El juego redondea el consumo hacia arriba y lo limita a la reserva disponible.</p>
        <pre>${escape(JSON.stringify({ coefficients: LunarScience.balance, result: result || 'Todavía sin decisión' }, null, 2))}</pre>
      </details>`;
    const api = `<h3>Moon Trek</h3>
      <dl class="science-metrics">
        <div><dt>Mapa</dt><dd data-api-map></dd></div>
        <div><dt>Metadatos</dt><dd data-api-capabilities></dd></div>
        <div><dt>Última consulta</dt><dd data-api-timestamp></dd></div>
      </dl>
      <details><summary>Capa, proyección y archivos cartográficos</summary>
        <p>Capa <code>${escape(manifest.layer)}</code>. Relieve sombreado de LRO derivado de LOLA.</p>
        <p>${escape(manifest.crs)}. ${escape(manifest.crsNote)}</p>
        <ul>
          <li><a href="${manifest.capabilities}" target="_blank" rel="noopener">GetCapabilities de NASA Moon Trek</a></li>
          <li><a href="data/nasa/WMTSCapabilities.xml" target="_blank" rel="noopener">Copia local de GetCapabilities</a></li>
          <li><a href="data/nasa/layer-metadata.json" target="_blank" rel="noopener">Metadatos originales de la capa</a></li>
          <li><a href="data/nasa/wmts.json" target="_blank" rel="noopener">Mosaicos y hashes del respaldo</a></li>
        </ul>
      </details>
      <details><summary>Registro de solicitudes y respuestas originales</summary><pre data-api-log></pre></details>
      <h3>Fuente de elevación LOLA</h3>
      <p>Modelo histórico de <a href="https://pgda.gsfc.nasa.gov/products/78" target="_blank" rel="noopener">Barker et al. · Site01</a>, 5 m/píxel, marco MOON_ME DE421. Datos locales preparados el ${escape(new Date(data.preparedAt).toLocaleDateString('es'))}.</p>
      <details><summary>Archivos originales y verificaciones SHA-256</summary>
        ${data.sources.map(source => `<p><a href="${source.url}" target="_blank" rel="noopener">${source.url.split('/').at(-1)}</a><br>SHA-256 <code>${source.sha256}</code></p>`).join('')}
      </details>
      <p>El índice de radiación es simulado. RadLab y DONKI quedan fuera de la simulación actual.</p>`;
    return { information, api };
  }

  function updateApiDetails(dialog, session) {
    dialog.querySelector('[data-api-map]').textContent = session.mapStatus || 'Consultando mosaicos…';
    dialog.querySelector('[data-api-capabilities]').textContent = session.capabilitiesStatus;
    dialog.querySelector('[data-api-timestamp]').textContent = new Date(session.timestamp).toLocaleString('es');
    dialog.querySelector('[data-api-log]').textContent = JSON.stringify(session.logs, null, 2);
  }

  return { load, capabilities, mount, technical, updateApiDetails, escape };
})();
