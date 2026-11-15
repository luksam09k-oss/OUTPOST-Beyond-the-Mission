const MarsData = (() => {
  let assets;
  async function read(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} · ${url}`);
    return response.json();
  }
  async function load() {
    assets ??= Promise.all(['science', 'routes', 'wmts'].map(name => read(`data/mars/${name}.json`)))
      .catch(error => { assets = null; throw error; });
    const [science, terrain, manifest] = await assets;
    if (!science.meda?.length || !science.moxie?.length || terrain.body !== 'Mars' || !manifest.tiles?.length) {
      assets = null;
      throw new Error('Incomplete Mars data cache');
    }
    return { science, terrain, manifest, service: 'Mars Trek', tiles: new Map(), logs: [],
      checked: new Set(), progress: null, timestamp: new Date().toISOString() };
  }
  async function metadata(session, instrument) {
    if (session.checked.has(instrument)) return;
    session.checked.add(instrument);
    const cached = session.science.pds.find(item => item.instrument === instrument);
    const log = { service: 'PDS Search', instrument, url: cached.url, time: new Date().toISOString(), status: 'pending' };
    session.logs.push(log);
    try {
      const response = await fetch(cached.url, { signal: AbortSignal.timeout(6000) });
      log.http = response.status;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data.data?.length) throw new Error('No metadata records returned');
      log.status = 'ok';
      log.source = 'network-metadata';
      log.ids = data.data.map(item => item.id);
    } catch (error) {
      log.status = 'unavailable';
      log.error = error.message;
      log.source = 'cached-metadata';
      log.fallback = cached.file;
      log.cachedAt = cached.retrievedAt;
    }
    session.update?.();
  }
  async function capabilities(session) {
    if (session.checked.has('wmts')) return;
    session.checked.add('wmts');
    const manifest = session.manifest;
    const log = { service: 'Mars Trek GetCapabilities', url: manifest.capabilities, time: new Date().toISOString(), status: 'pending' };
    session.logs.push(log);
    try {
      const response = await fetch(log.url, { signal: AbortSignal.timeout(6000) });
      log.http = response.status;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
      if (xml.querySelector('parsererror')) throw new Error('Invalid WMTS XML');
      const ids = [...xml.getElementsByTagNameNS('*', 'Identifier')].map(node => node.textContent);
      const crs = [...xml.getElementsByTagNameNS('*', 'SupportedCRS')].map(node => node.textContent);
      if (!ids.includes(manifest.layer) || !ids.includes(manifest.matrixSet) || !crs.includes(manifest.crs)) {
        throw new Error('WMTS layer or projection changed');
      }
      for (const expected of manifest.matrices) {
        const matrix = [...xml.getElementsByTagNameNS('*', 'TileMatrix')].find(node =>
          node.getElementsByTagNameNS('*', 'Identifier')[0]?.textContent === expected.id);
        const value = name => matrix?.getElementsByTagNameNS('*', name)[0]?.textContent;
        if (Math.abs(Number(value('ScaleDenominator')) - expected.scaleDenominator) > .001 || Number(value('MatrixWidth')) !== expected.columns || Number(value('MatrixHeight')) !== expected.rows
          || Number(value('TileWidth')) !== expected.tileSize || value('TopLeftCorner')?.trim().split(/\s+/).map(Number).join(',') !== '-180,90') {
          throw new Error('WMTS grid changed');
        }
      }
      log.status = 'ok';
      log.source = 'network-metadata';
    } catch (error) {
      log.status = 'unavailable';
      log.error = error.message;
      log.fallback = 'data/mars/WMTSCapabilities.xml';
      log.cachedAt = manifest.downloadedAt;
    }
    session.update?.();
  }
  return { load, metadata, capabilities };
})();

const MarsMap = (() => {
  function mount(host, session, route) {
    host.innerHTML = `<div class="lunar-map"><div class="map-plot">
      <canvas width="960" height="540" aria-label="${t('Mapa real de Jezero con ruta ficticia de exploración', 'Real Jezero map with a fictional exploration route')}"></canvas>
      <div class="map-legend">${t('● Base ficticia · ━ Ruta', '● Fictional base · ━ Route')}</div>
      <div class="map-zoom"><button data-mars-zoom="1" aria-label="${t('Acercar mapa', 'Zoom in')}">+</button>
        <button data-mars-zoom="0" aria-label="${t('Encuadrar recorrido', 'Fit route')}">−</button></div>
      </div><p class="map-status" role="status">Mars Trek · ${t('cargando…', 'loading…')}</p></div>`;
    const canvas = host.querySelector('canvas');
    const context = canvas.getContext('2d');
    const status = host.querySelector('.map-status');
    let disposed = false;
    let zoom = 0;
    let request = 0;
    let tiles = [];
    let view;
    const xs = route.points.map(point => point[0]);
    const ys = route.points.map(point => point[1]);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const width = Math.max(1200, Math.max(...xs)-Math.min(...xs)+900, (Math.max(...ys)-Math.min(...ys)+700)*16/9);
    const project = (x,y) => [(x-view[0])/view[2]*canvas.width, (view[1]-y)/view[3]*canvas.height];
    function draw() {
      if (disposed || !view) return;
      context.fillStyle = '#171726';
      context.fillRect(0,0,canvas.width,canvas.height);
      for (const { entry, result } of tiles) {
        if (!result.image) continue;
        const [left,bottom,right,top] = entry.bounds;
        const [x,y] = project(left,top);
        const [x2,y2] = project(right,bottom);
        context.drawImage(result.image,x,y,x2-x+.5,y2-y+.5);
      }
      for (const [color, thickness] of [['#17151e',9],['#ffc575',4]]) {
        context.strokeStyle=color;context.lineWidth=thickness;context.beginPath();
        route.points.forEach((point,index) => { const [x,y]=project(...point);if(index)context.lineTo(x,y);else context.moveTo(x,y); });
        context.stroke();
      }
      for (const [point,label] of [[route.points[0],t('BASE','BASE')],[route.points.at(-1),t('DESTINO','DESTINATION')]]) {
        const [x,y] = project(...point);
        context.fillStyle='#ffe7b3';context.beginPath();context.arc(x,y,8,0,Math.PI*2);context.fill();
        context.font='bold 16px monospace';context.textAlign='left';context.fillStyle='#101421';context.fillRect(x+8,y-25,106,24);
        context.fillStyle='#fff';context.fillText(label,x+12,y-8);
      }
      if (session.progress !== null) {
        const [x,y]=project(...LunarScience.pointAt(route,session.progress));
        context.fillStyle='#80efff';context.fillRect(x-9,y-9,18,18);
        context.strokeStyle='#071322';context.lineWidth=3;context.strokeRect(x-9,y-9,18,18);
      }
      const scale=250/view[2]*canvas.width;
      context.fillStyle='#111a2ee8';context.fillRect(12,canvas.height-43,scale+20,34);
      context.fillStyle='#fff';context.fillRect(22,canvas.height-18,scale,3);
      context.font='14px monospace';context.fillText('250 m',22,canvas.height-24);
    }
    async function refresh() {
      const current=++request;
      const span=width/(zoom?1.3:1);
      view=[centerX-span/2,centerY+span*9/32,span,span*9/16];
      const entries=session.manifest.tiles.filter(entry => entry.z === (zoom?'13':'12'));
      tiles=[];draw();
      let index=0;
      await Promise.all(Array.from({length:Math.min(4,entries.length)},async()=>{
        while(index<entries.length) {
          const entry=entries[index++];
          const result=await MoonMap.tile(session,entry);
          if(disposed || current!==request)return;
          tiles.push({entry,result});draw();
        }
      }));
      if(disposed || current!==request)return;
      const live=tiles.filter(tile=>tile.result.source==='NASA · solicitud HTTP').length;
      const cached=tiles.filter(tile=>tile.result.image && tile.result.source!=='NASA · solicitud HTTP').length;
      const missing=entries.length-live-cached;
      session.mapStatus={live,cached,missing};
      status.textContent='Mars Trek · '+(live ? t('imágenes en línea','online imagery') : cached ? t('copia verificada','verified copy') : t('mapa no disponible','map unavailable'))
        + (missing && live+cached ? t(' · cobertura parcial',' · partial coverage') : '');
      session.update?.();
    }
    host.querySelectorAll('[data-mars-zoom]').forEach(button => button.addEventListener('click',()=>{zoom=Number(button.dataset.marsZoom);refresh();}));
    refresh();
    MarsData.capabilities(session);
    return { draw, dispose() { disposed=true;request++; } };
  }
  return { mount };
})();
