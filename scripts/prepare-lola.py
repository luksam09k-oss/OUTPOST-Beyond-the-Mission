"""Rebuild scientific route data from the original NASA Site01 rasters.
Usage: python scripts/prepare-lola.py /path/to/rasters (surf.tif, slp.tif).
Dependencies: numpy, scipy, rasterio, pyproj. Raster downloads are NOT shipped.
"""
from pathlib import Path
import sys, json, hashlib, heapq, math
from datetime import datetime, timezone
import numpy as np
import rasterio
from pyproj import Transformer, CRS

root=Path(__file__).resolve().parents[1]; source=Path(sys.argv[1])
with rasterio.open(source/'surf.tif') as d:
    dem=d.read(1); transform=d.transform; crs=d.crs; bounds=list(d.bounds)
with rasterio.open(source/'slp.tif') as d:
    slope=d.read(1)
    assert d.transform==transform and d.crs==crs and d.shape==dem.shape
assert transform.a==5 and transform.e==-5
# 20 m corridor cells, retaining the maximum of every 5 m pixel, never the mean.
g=slope.reshape(800,4,800,4).max(axis=(1,3)); base=(145,499)
geo=Transformer.from_crs(crs, CRS.from_proj4('+proj=longlat +R=1737400 +no_defs'),always_xy=True)

def search(cap):
    dist={base:0.}; prev={}; q=[(0.,base)]
    while q:
        length,p=heapq.heappop(q)
        if length!=dist[p]: continue
        if length>4100: continue
        for dr,dc in ((0,1),(0,-1),(1,0),(-1,0),(1,1),(1,-1),(-1,1),(-1,-1)):
            r,c=p[0]+dr,p[1]+dc
            if not (0<=r<800 and 0<=c<800) or not np.isfinite(g[r,c]) or g[r,c]>cap: continue
            if dr and dc and (g[p[0]+dr,p[1]]>cap or g[p[0],p[1]+dc]>cap): continue
            nd=length+20*math.hypot(dr,dc)
            if nd<dist.get((r,c),math.inf):
                dist[(r,c)]=nd; prev[(r,c)]=p; heapq.heappush(q,(nd,(r,c)))
    return dist,prev

routes=[]
for i,(name,target,cap,lower,risk) in enumerate([
 ('Llanura de reconocimiento',500,5,0,.03),('Sendero de la cresta',1200,10,5,.07),
 ('Ladera accidentada',2500,15,10,.15),('Aproximación a la sombra',4000,15,10,.25)]):
    dist,prev=search(cap)
    candidates=[p for p,v in dist.items() if abs(v-target)<20]
    # Prefer a different direction for each route; no claim of illumination from a DEM.
    bearings=[0,1.5,3.,4.5]; angle=bearings[i]
    candidates.sort(key=lambda p: abs(dist[p]-target)+10*(1-math.cos(math.atan2(p[0]-base[0],p[1]-base[1])-angle)))
    for end in candidates:
        cells=[end]
        while cells[-1]!=base: cells.append(prev[cells[-1]])
        cells.reverse()
        if max(g[p] for p in cells)>=lower: break
    points=[]; distance=0
    for j,(r,c) in enumerate(cells):
        x,y=-19000+c*20+10,-4000-r*20-10
        if j==0: pairs=[(x,y)]
        else:
            px,py=points[-1][:2]; steps=math.ceil(math.hypot(x-px,y-py)/5)
            pairs=[(px+(x-px)*k/steps,py+(y-py)*k/steps) for k in range(1,steps+1)]
        for xx,yy in pairs:
            rr,cc=rasterio.transform.rowcol(transform,xx,yy)
            z=float(dem[rr,cc]); sl=float(slope[rr,cc]); assert math.isfinite(z) and sl<=cap
            if points: distance+=math.hypot(xx-points[-1][0],yy-points[-1][1])
            points.append([xx,yy,z,sl,distance])
    zz=np.array([p[2] for p in points]); ss=np.array([p[3] for p in points]); delta=np.diff(zz)
    lon,lat=geo.transform(points[-1][0],points[-1][1]); bx,by=points[0][:2]
    route=dict(id=i+1,name=name,difficulty='Fácil' if i<2 else 'Difícil',targetDistanceM=target,targetSlopeMaxDeg=cap,referenceRisk=risk,
      distanceM=round(distance,2),maxSlopeDeg=round(float(ss.max()),3),meanSlopeDeg=round(float(ss.mean()),3),
      reliefM=round(float(zz.max()-zz.min()),2),netElevationM=round(float(zz[-1]-zz[0]),2),
      ascentM=round(float(delta[delta>0].sum()),2),descentM=round(float(-delta[delta<0].sum()),2),
      elevationMinM=round(float(zz.min()),2),elevationMaxM=round(float(zz.max()),2),
      destinationLonLat=[lon,lat],points=[[round(v,3) for v in p] for p in points])
    routes.append(route)
    print(name,{k:route[k] for k in ['distanceM','maxSlopeDeg','reliefM']})
baseurl='https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/'
result=dict(region='Connecting Ridge · Site01',preparedAt=datetime.now(timezone.utc).isoformat(),
  sourceKind='Historical NASA LOLA rasters, preprocessed locally',resolutionM=5,referenceFrame='MOON_ME DE421',
  projection=crs.to_wkt(),proj4='+proj=stere +lat_0=-90 +lon_0=0 +k=1 +R=1737400 +units=m +no_defs',bounds=bounds,
  sources=[dict(url=baseurl+'Site01_final_adj_5mpp_'+n+'.tif',sha256=hashlib.sha256((source/file).read_bytes()).hexdigest()) for n,file in [('surf','surf.tif'),('slp','slp.tif')]],
  baseXY=[bx,by],baseLonLat=list(geo.transform(bx,by)),pointColumns=['x_m','y_m','elevation_m','slope_deg','distance_m'],
  method='Shortest 8-neighbour paths in 20 m cells with conservative max of all sixteen 5 m slopes; no diagonal corner cutting; sampled every <=5 m. Fictional base and routes; DEM-only feasibility, not flight-certified navigation. No illumination measurement.',routes=routes)
(root/'data/nasa/routes.json').write_text(json.dumps(result,separators=(',',':'),ensure_ascii=False))
