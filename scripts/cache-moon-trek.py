"""Download only verified WMTS tiles intersecting the route region at two zooms.
Requires requests, Pillow. Re-run from any directory; verifies PNG decoding and hashes.
"""
from pathlib import Path
import json, math, hashlib, io, concurrent.futures
from datetime import datetime, timezone
import xml.etree.ElementTree as ET
import requests
from PIL import Image
root=Path(__file__).resolve().parents[1]; out=root/'data/nasa'; tiles=out/'tiles'; tiles.mkdir(exist_ok=True)
endpoint='https://trek.nasa.gov/tiles/Moon/SP/Site01_final_adj_5mpp_Hillshade'
capurl=endpoint+'/1.0.0/WMTSCapabilities.xml'
r=requests.get(capurl,timeout=30);r.raise_for_status();(out/'WMTSCapabilities.xml').write_bytes(r.content)
n={'w':'http://www.opengis.net/wmts/1.0','o':'http://www.opengis.net/ows/1.1'}
xml=ET.fromstring(r.content); layer=xml.find('.//w:Layer',n); matrixset=xml.find('.//w:Contents/w:TileMatrixSet',n)
matrices=[]
for m in matrixset.findall('w:TileMatrix',n):
 matrices.append(dict(id=m.find('o:Identifier',n).text,resolution=float(m.find('w:ScaleDenominator',n).text)*.00028,
 origin=list(map(float,m.find('w:TopLeftCorner',n).text.split())),tileSize=int(m.find('w:TileWidth',n).text),
 width=int(float(m.find('w:MatrixWidth',n).text)),height=int(float(m.find('w:MatrixHeight',n).text))))
data=json.load(open(out/'routes.json')); pts=[p for route in data['routes'] for p in route['points']]
# Square complete-region view used by the app at fit zoom; individual routes can be zoomed.
xs=[p[0] for p in pts];ys=[p[1] for p in pts];cx=(min(xs)+max(xs))/2;cy=(min(ys)+max(ys))/2
side=max(max(xs)-min(xs),max(ys)-min(ys))+1800
extent=[cx-side/2,cy-side/2,cx+side/2,cy+side/2];tasks=[]
for m in matrices[-2:]:
 span=m['resolution']*256;ox,oy=m['origin']
 for row in range(math.floor((oy-extent[3])/span),math.floor((oy-extent[1])/span)+1):
  for col in range(math.floor((extent[0]-ox)/span),math.floor((extent[2]-ox)/span)+1):
   tasks.append((m['id'],row,col))
def download(t):
 z,row,col=t;url=f'{endpoint}/1.0.0/default/default028mm/{z}/{row}/{col}.png';r=requests.get(url,timeout=45);r.raise_for_status()
 im=Image.open(io.BytesIO(r.content));im.load();assert im.size==(256,256)
 name=f'{z}-{row}-{col}.png';(tiles/name).write_bytes(r.content)
 return dict(z=z,row=row,col=col,url=url,file='data/nasa/tiles/'+name,bytes=len(r.content),sha256=hashlib.sha256(r.content).hexdigest())
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: entries=list(pool.map(download,tasks))
manifest=dict(endpoint=endpoint,capabilities=capurl,layer=layer.find('o:Identifier',n).text,format='image/png',style='default',matrixSet='default028mm',
 crs='IAU2000:30120 / Moon south polar stereographic',crsNote='WMTS reports EPSG:0; projection resolved from official layer catalogue and matched to LOLA GeoTIFF. WGS84BoundingBox is mislabeled and is NOT used.',
 proj4=data['proj4'],extent=extent,matrices=matrices,cachedAt=datetime.now(timezone.utc).isoformat(),tiles=entries)
(out/'wmts.json').write_text(json.dumps(manifest,indent=2))
print('Verified',len(entries),'tiles;',sum(t['bytes'] for t in entries),'bytes;',extent)
