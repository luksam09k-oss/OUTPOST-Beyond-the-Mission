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
    host.innerHTML = `<div class="lunar-map"><canvas width="960" height="650" aria-label="Mapa NASA de Connecting Ridge con ruta y base ficticias"></canvas>
      <div class="map-legend">● Base ficticia &nbsp; ◇ Destino &nbsp; ━ Ruta calculada</div>
      ${compact ? '' : '<div class="map-zoom"><button data-map-zoom="1" aria-label="Acercar mapa">+</button><button data-map-zoom="-1" aria-label="Alejar mapa">−</button><button data-map-zoom="0">Encuadrar</button></div>'}
      <p class="map-status" role="status">Consultando NASA Moon Trek…</p></div>`;
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
      tiles=[];label.textContent='Consultando NASA Moon Trek…';draw();
      // Four simultaneous requests, bounded by the verified manifest.
      let index=0;
      await Promise.all(Array.from({length:Math.min(4,entries.length)},async()=>{
        while(index<entries.length){const entry=entries[index++],result=await tile(session,entry);if(id!==requestId)return;tiles.push({entry,result});draw();}
      }));
      if(id!==requestId || !host.isConnected)return;
      const live=tiles.filter(t=>t.result.source==='NASA · solicitud HTTP').length;
      const cached=tiles.filter(t=>t.result.image && t.result.source!=='NASA · solicitud HTTP').length;
      const missing=tiles.length-live-cached;
      label.textContent=`Moon Trek: ${live} mosaicos por HTTP · ${cached} en caché${missing?' · '+missing+' no disponibles':''}`;
      session.mapStatus=label.textContent;session.update?.();
    }
    host.querySelectorAll('[data-map-zoom]').forEach(b=>b.addEventListener('click',()=>{zoom=Number(b.dataset.mapZoom)>0?1:0;refresh();}));
    refresh();
    return { draw, dispose:()=>{requestId++;}, canvas };
  }
  function technical(session, route, result) {
    const m=session.manifest,d=session.data;
    const fields=['distanceM','maxSlopeDeg','meanSlopeDeg','reliefM','ascentM','descentM','elevationMinM','elevationMaxM'];
    return `<p>Cartografía: <a href="${m.capabilities}" target="_blank" rel="noopener">NASA Moon Trek / LRO</a>. ${escape(session.mapStatus||'Consultando mosaicos')}</p>
      <p>Capa: ${escape(m.layer)}. Relieve sombreado derivado de LOLA; no es una fotografía ni una medición de luz solar.</p>
      <p>${escape(m.crs)}. ${escape(m.crsNote)}</p>
      <p>LOLA: modelos históricos de <a href="https://pgda.gsfc.nasa.gov/products/78" target="_blank" rel="noopener">Barker et al. · Site01</a>, 5 m/píxel, MOON_ME DE421. Datos locales preparados: ${escape(d.preparedAt)}.</p>
      <p>RadLab: no integrado. DONKI: no integrado. No hay medición de radiación en tiempo real.</p>
      <p>Última consulta iniciada: ${escape(new Date(session.timestamp).toLocaleString())}. Cada petición conserva su propia hora en el registro.</p>
      <h3>Valores derivados de LOLA</h3><pre>${escape(JSON.stringify(Object.fromEntries(fields.map(k=>[k,route[k]])),null,2))}</pre>
      <p>Distancias, desniveles y elevaciones en metros; pendientes en grados. Elevaciones relativas al radio lunar de 1 737 400 m. Base y rutas ficticias. La viabilidad aquí solo evalúa el modelo de terreno; no certifica una ruta para una misión real. El nombre «sombra» no verifica iluminación.</p>
      <p>Las pendientes se comprobaron en celdas de 20 m usando el máximo de los 16 píxeles de 5 m; perfil muestreado cada ≤5 m. Hay interpolación en el modelo LOLA y no se representan rocas menores de 5 m.</p>
      <h3>Fórmulas del juego · puntos simulados</h3>
      <p>Tiempo = ida y vuelta / velocidad × (1 + pendiente media / 20) + 0,25 h de estudio. Oxígeno = horas × (5 × consumo base + traje, si sale un astronauta). Energía = soporte de base + kilómetros × equipo × pendiente + ascenso y descenso + instrumentos. Radiación = horas × (índice protegido + índice exterior, si procede) × condición ambiental simulada.</p>
      <p>Riesgo del rover = referencia de ruta + distancia de ida × 0,8 %/km + pendiente máxima × 0,2 %/grado + relieve × 0,6 %/100 m, limitado al 45 %. Retirada humana = 60 % de ese riesgo. Se sortea una vez. Distancia, pendiente y relieve sustituyen la rugosidad a esta escala; no se inventan obstáculos observados.</p>
      <p>Si falla, solo se cobra la fracción del tiempo transcurrido (incluido el regreso en una retirada humana). No hay observaciones nuevas antes de llegar al destino. Los recursos se redondean hacia arriba a puntos enteros y se limitan a la reserva disponible.</p>
      <pre>${escape(JSON.stringify({coefficients:LunarScience.balance,result:result||'Todavía sin decisión'},null,2))}</pre>
      <h3>Archivos y trazabilidad</h3>${d.sources.map(s=>`<p><a href="${s.url}" target="_blank" rel="noopener">${s.url.split('/').at(-1)}</a><br>SHA-256: <code>${s.sha256}</code></p>`).join('')}
      <p><a href="data/nasa/routes.json" target="_blank">Perfil LOLA completo y coordenadas</a> · <a href="data/nasa/layer-metadata.json" target="_blank">Metadatos originales de la capa</a> · <a href="data/nasa/wmts.json" target="_blank">Mosaicos y hashes del respaldo</a></p>
      <details><summary>Registro de solicitudes y respuestas originales</summary><pre>${escape(JSON.stringify(session.logs,null,2))}</pre></details>`;
  }
  return { load, capabilities, mount, technical, escape };
})();
