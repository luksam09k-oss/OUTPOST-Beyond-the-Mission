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
      session.capabilitiesStatus = t('HTTP correcto · metadatos verificados', 'HTTP successful · metadata verified');
      session.logs.push({ service: 'Moon Trek GetCapabilities', url, time, status: r.status, source: 'Solicitud de red', layer: session.manifest.layer, raw: text });
    } catch (e) {
      session.capabilitiesStatus = t('Metadatos locales verificados', 'Verified local metadata');
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
      <canvas width="960" height="650" aria-label="${t('Mapa NASA de Connecting Ridge con ruta y base ficticias', 'NASA map of Connecting Ridge with a fictional route and base')}"></canvas>
      <div class="map-legend">${t('● Base ficticia · ● Destino · ━ Ruta', '● Fictional base · ● Destination · ━ Route')}</div>
      ${compact ? '' : `<div class="map-zoom"><button data-map-zoom="1" aria-label="${t('Acercar mapa', 'Zoom in')}">+</button><button data-map-zoom="-1" aria-label="${t('Alejar mapa', 'Zoom out')}">−</button><button data-map-zoom="0">${t('Encuadrar', 'Fit route')}</button></div>`}
      </div><p class="map-status" role="status">Moon Trek: ${t('cargando mapa…', 'loading map…')}</p></div>`;
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
      for (const [p,name,color] of [[route.points[0],'BASE','#ffe69a'],[route.points.at(-1),t('DESTINO', 'DESTINATION'),'#91ffff']]) {
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
      tiles=[];label.textContent=`Moon Trek: ${t('cargando mapa…', 'loading map…')}`;draw();
      session.mapStatus = t('Consultando mosaicos…', 'Loading tiles…');
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
      session.mapStatus = t(
        `Moon Trek: ${live} mosaicos por HTTP · ${cached} en caché${missing ? ' · '+missing+' no disponibles' : ''}`,
        `Moon Trek: ${live} tiles fetched · ${cached} cached${missing ? ' · '+missing+' unavailable' : ''}`);
      const sources = [live && t('en línea', 'online'), cached && t('copia local', 'local copy')].filter(Boolean);
      const mapStatus = sources.length ? sources.join(t(' y ', ' and ')) + (missing ? t(' · mapa parcial', ' · partial map') : '') : t('mapa no disponible', 'map unavailable');
      label.textContent = `Moon Trek: ${mapStatus}`;
      session.update?.();
    }
    host.querySelectorAll('[data-map-zoom]').forEach(b=>b.addEventListener('click',()=>{zoom=Number(b.dataset.mapZoom)>0?1:0;refresh();}));
    refresh();
    return { draw, dispose:()=>{requestId++;}, canvas };
  }
  function technical(session, route, result) {
    const { manifest, data } = session;
    const plan = result || LunarScience.estimate(route, 'rover');
    const title = routeTitle(route);
    const metrics = [
      [t('Desnivel del terreno', 'Elevation range'), `${numberText(route.reliefM, 1)} m`],
      [t('Altitud mínima y máxima', 'Lowest and highest elevation'), `${numberText(route.elevationMinM)}–${numberText(route.elevationMaxM)} m`],
      [result ? t('Duración de la salida', 'Trip duration') : t('Tiempo estimado con rover', 'Estimated rover time'),
        `${numberText(result ? result.elapsedHours : plan.hours, 1)} h`],
      [result?.mode === 'astronaut' ? t('Riesgo de retirada', 'Retreat risk') : t('Riesgo de perder el rover', 'Rover loss risk'), `${numberText(plan.risk * 100, 1)} %`]
    ];
    const information = `<h3>${escape(title)}</h3>
      <dl class="science-metrics">${metrics.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>
      <figure class="science-profile">
        <canvas class="elevation-profile" width="360" height="100" aria-label="${t('Perfil de elevación de LOLA', 'LOLA elevation profile')}"></canvas>
        <figcaption>${t('Altura del terreno en el trayecto de ida', 'Terrain elevation along the outbound route')}</figcaption>
      </figure>
      <p>${t('La distancia y las pendientes afectan el tiempo y los recursos. Las alturas vienen de LOLA. El riesgo, el consumo y el tiempo son estimaciones del juego.',
        'Distance and slope affect time and resources. Elevations come from LOLA. Risk, resource use and time are game estimates.')}</p>`;
    const api = `<h3>NASA Moon Trek · LOLA</h3>
      <dl class="science-metrics">
        <div><dt>${t('Mapa', 'Map')}</dt><dd data-api-map></dd></div>
        <div><dt>${t('Última consulta', 'Last query')}</dt><dd data-api-timestamp></dd></div>
      </dl>
      <p>${t('Mapa de relieve lunar de Moon Trek. Las alturas y pendientes provienen del conjunto LOLA Site01, con una resolución de 5 m por píxel.',
        'Moon Trek supplies the lunar relief map. Elevations and slopes come from the LOLA Site01 dataset at 5 meters per pixel.')}</p>
      <p><a href="https://pgda.gsfc.nasa.gov/products/78" target="_blank" rel="noopener">${t('Fuente LOLA', 'LOLA source')}</a>
        · <a href="${manifest.capabilities}" target="_blank" rel="noopener">Moon Trek WMTS</a>
        · <a href="data/nasa/routes.json" target="_blank" rel="noopener">${t('Datos de la ruta', 'Route data')}</a></p>
      <details><summary>${t('Capa y consultas originales', 'Map layer and original queries')}</summary>
        <p><code>${escape(manifest.layer)}</code> · ${escape(manifest.crs)} · <span data-api-capabilities></span></p>
        <pre data-api-log></pre>
      </details>`;
    return { information, api };
  }

  function updateApiDetails(dialog, session) {
    dialog.querySelector('[data-api-map]').textContent = session.mapStatus || t('Consultando mosaicos…', 'Loading tiles…');
    dialog.querySelector('[data-api-capabilities]').textContent = session.capabilitiesStatus;
    dialog.querySelector('[data-api-timestamp]').textContent = new Date(session.timestamp).toLocaleString(language);
    dialog.querySelector('[data-api-log]').textContent = JSON.stringify(session.logs, null, 2);
  }

  return { load, capabilities, mount, technical, updateApiDetails, escape };
})();
