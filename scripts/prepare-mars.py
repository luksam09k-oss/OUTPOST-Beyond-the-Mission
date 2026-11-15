"""Rebuild the small Mars data cache from the NASA/PDS and USGS source products.

Requires Pillow. Downloads are cached in an optional scratch directory, never in Git.
Usage: python scripts/prepare-mars.py /tmp/outpost-mars-sources
"""
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/mars'
CACHE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/tmp/outpost-mars-sources')
OUT.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)
STAMP = datetime.now(timezone.utc).isoformat()
PDS = 'https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/'
LAYER = 'JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd'
ENDPOINT = f'https://trek.nasa.gov/tiles/Mars/EQ/{LAYER}/1.0.0'
RADIUS = 3396190
BASE = [77.435, 18.444]
NS = {'p': 'http://pds.nasa.gov/pds4/pds/v1', 'w': 'http://www.opengis.net/wmts/1.0', 'o': 'http://www.opengis.net/ows/1.1'}


def download(name, url):
    target = CACHE / name
    if not target.exists():
        with urllib.request.urlopen(url, timeout=60) as response:
            target.write_bytes(response.read())
    return target.read_bytes()


def save(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def source(name, url, body):
    return {'url': url, 'file': name, 'sha256': hashlib.sha256(body).hexdigest(), 'downloadedAt': STAMP}


def product_metadata(label):
    root = ET.fromstring(label)
    return {field: root.findtext('.//p:' + field, namespaces=NS) for field in
            ['logical_identifier', 'start_date_time', 'stop_date_time']}


# Preserve detached labels and the measurements used by the browser, with source hashes.
meda = []
for sol in [310, 313, 320]:
    name = f'WE__{sol:04d}___________CAL_RDS_________________P01'
    directory = f'{PDS}mars2020_meda/data_calibrated_env/sol_0300_0419/sol_{sol:04d}/'
    raw = download(f'meda{sol}-rds.csv', directory + name + '.CSV')
    label = download(f'meda{sol}-rds.xml', directory + name + '.xml')
    (OUT / f'meda-sol-{sol}.xml').write_bytes(label)
    rows = list(csv.DictReader(io.StringIO(raw.decode())))
    # Same true-solar-time window in each sol. Missing antenna flags remain missing.
    selected = [(index + 2, row) for index, row in enumerate(rows)
                if ' 12:4' in row['LTST'] and row['ROVER_STILL'] == '1'
                and row['RDS_TOP_7'] and 0 < float(row['RDS_TOP_7']) < 1000
                and row['ROVER_HGA_STILL'] != '0']
    if not selected:
        raise ValueError(f'No valid midday RDS samples for sol {sol}')
    fields = ['source_line', 'SCLK', 'LMST', 'LTST', 'RDS_TOP_7', 'ROVER_STILL', 'ROVER_HGA_STILL']
    with (OUT / f'meda-sol-{sol}.csv').open('w', newline='') as output:
        writer = csv.DictWriter(output, fieldnames=fields)
        writer.writeheader()
        for line, row in selected:
            writer.writerow({'source_line': line, **{k: row[k] for k in fields[1:]}})
    meda.append({
        'sol': sol, **product_metadata(label), 'sensor': 'RDS_TOP_7', 'unit': 'W/m²',
        'irradiance': sum(float(row['RDS_TOP_7']) for _, row in selected) / len(selected),
        'count': len(selected), 'ltstStart': selected[0][1]['LTST'], 'ltstEnd': selected[-1][1]['LTST'],
        'quality': {'roverStill': True, 'antennaFlagMissing': any(not r['ROVER_HGA_STILL'] for _, r in selected)},
        'original': source(name + '.CSV', directory + name + '.CSV', raw),
        'labelUrl': directory + name + '.xml', 'labelFile': f'data/mars/meda-sol-{sol}.xml',
        'extractFile': f'data/mars/meda-sol-{sol}.csv',
        'sample': selected[len(selected)//2][1]
    })

moxie = []
for sol, name in [(60, 'OX__0060_0672220723DDR0030032046MOXI00003P05'),
                  (535, 'OX__0535_0714382072DDR0190261222MOXI00114P03')]:
    directory = f'{PDS}moxie_bundle/data_derived/{sol:05d}/'
    raw = download(f'moxie{sol}.csv', directory + name + '.csv')
    label = download(f'moxie{sol}.xml', directory + name + '.xml')
    (OUT / f'moxie-sol-{sol}.xml').write_bytes(label)
    rows = list(csv.DictReader(io.StringIO(raw.decode())))
    times = [float(row['T']) for row in rows]
    rates = [float(row['F_O2_I_G_HR']) for row in rows]
    if any(not math.isfinite(v) or v < 0 for v in rates):
        raise ValueError('Invalid oxygen production measurement')
    if any(b-a != 1 for a, b in zip(times, times[1:])):
        raise ValueError('Expected one-second MOXIE samples')
    produced = sum((a+b)/2 for a,b in zip(rates,rates[1:])) / 3600
    producing = [value for value in rates if value > .1]
    fields = ['T', 'F_O2_I_G_HR', 'P_TOT_W', 'E_TOT_W_HR']
    with (OUT / f'moxie-sol-{sol}.csv').open('w', newline='') as output:
        writer = csv.DictWriter(output, fieldnames=fields)
        writer.writeheader()
        writer.writerows({k: row[k] for k in fields} for row in rows)
    moxie.append({
        'sol': sol, **product_metadata(label), 'rateGPerHour': sum(producing)/len(producing),
        'productionHours': len(producing)/3600, 'cycleHours': (times[-1]-times[0])/3600,
        'producedG': produced, 'energyWh': float(rows[-1]['E_TOT_W_HR']),
        'samples': len(rows), 'productionThresholdGPerHour': .1,
        'original': source(name + '.csv', directory + name + '.csv', raw),
        'labelUrl': directory + name + '.xml', 'labelFile': f'data/mars/moxie-sol-{sol}.xml',
        'extractFile': f'data/mars/moxie-sol-{sol}.csv'
    })

queries = []
for instrument in ['meda', 'moxie']:
    lid = f'urn:nasa:pds:mars2020_{instrument}'
    url = 'https://pds.nasa.gov/api/search/1/products?' + urllib.parse.urlencode({'q': f'lid eq "{lid}"', 'limit': 1})
    raw = download(f'pds-{instrument}.json', url)
    response = json.loads(raw)
    if not response.get('data'):
        raise ValueError(f'PDS returned no metadata for {lid}')
    (OUT / f'pds-{instrument}.json').write_bytes(raw)
    queries.append({'instrument': instrument, 'url': url, 'status': 200, 'retrievedAt': STAMP,
                    'hits': response['summary']['hits'], 'id': response['data'][0]['id'],
                    'file': f'data/mars/pds-{instrument}.json', 'sha256': hashlib.sha256(raw).hexdigest()})
save('science.json', {'retrievedAt': STAMP, 'meda': meda, 'moxie': moxie, 'pds': queries})

# A numeric CTX DTM supplies elevations. HiRISE WMTS images supply appearance only.
dem_name = 'JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif'
dem_url = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/' + dem_name
dem_raw = download('jezero-dem.tif', dem_url)
dem = Image.open(io.BytesIO(dem_raw))
origin_x, origin_y = dem.tag_v2[33922][3:5]
pixel_x, pixel_y = dem.tag_v2[33550][:2]
pixels = dem.load()


def project(lon, lat):
    return [RADIUS*math.radians(lon-BASE[0])*math.cos(math.radians(BASE[1])),
            RADIUS*math.radians(lat-BASE[1])]


def elevation(lon, lat):
    x = (RADIUS*math.radians(lon)-origin_x)/pixel_x - .5
    y = (origin_y-RADIUS*math.radians(lat))/pixel_y - .5
    ix, iy = math.floor(x), math.floor(y)
    samples = [pixels[ix,iy],pixels[ix+1,iy],pixels[ix,iy+1],pixels[ix+1,iy+1]]
    if any(v < -10000 for v in samples):
        raise ValueError('Route intersects DEM nodata')
    fx,fy=x-ix,y-iy
    return (1-fy)*((1-fx)*samples[0]+fx*samples[1])+fy*((1-fx)*samples[2]+fx*samples[3])


routes = []
for name, waypoints in [('short', [BASE,[77.432,18.4448],[77.429,18.446]]),
                        ('long', [BASE,[77.430,18.445],[77.426,18.448],[77.421,18.451],[77.417,18.455]])]:
    coordinates = [BASE]
    for a,b in zip(waypoints,waypoints[1:]):
        count = math.ceil(math.dist(project(*a),project(*b))/40)
        coordinates.extend([[a[0]+(b[0]-a[0])*i/count, a[1]+(b[1]-a[1])*i/count] for i in range(1,count+1)])
    points=[];distance=0;ascent=0;descent=0
    for lon,lat in coordinates:
        x,y=project(lon,lat);z=elevation(lon,lat);slope=0
        if points:
            a=points[-1];segment=math.hypot(x-a[0],y-a[1]);distance+=segment
            dz=z-a[2];ascent+=max(0,dz);descent+=max(0,-dz);slope=math.degrees(math.atan2(abs(dz),segment))
        points.append([round(v,4) for v in [x,y,z,slope,distance]])
    zs=[p[2] for p in points]
    weighted_slope=sum(p[3]*(p[4]-a[4]) for a,p in zip(points,points[1:]))/distance
    routes.append({'id':name,'coordinates':coordinates,'points':points,'distanceM':distance,
                   'meanSlopeDeg':weighted_slope,'maxSlopeDeg':max(p[3] for p in points),
                   'ascentM':ascent,'descentM':descent,'elevationMinM':min(zs),'elevationMaxM':max(zs),'reliefM':max(zs)-min(zs)})
save('routes.json', {'body':'Mars','region':'Jezero','radiusM':RADIUS,'base':BASE,'baseFictional':True,
                     'projection':'Local equirectangular, standard parallel 18.444 degrees N',
                     'dem':{**source(dem_name,dem_url,dem_raw),'pixelResolutionM':20,
                            'doi':'https://doi.org/10.5066/P906QQT8','origin':[origin_x,origin_y],
                            'method':'Bilinear elevation sampling every <=40 m; distance corrected for latitude. Along-route slopes, not subpixel obstacle safety.'},'routes':routes})

cap_url=ENDPOINT+'/WMTSCapabilities.xml'
cap_raw=download('mars-capabilities.xml',cap_url)
(OUT/'WMTSCapabilities.xml').write_bytes(cap_raw)
cap=ET.fromstring(cap_raw)
matrices=[]
for matrix in cap.findall('.//w:TileMatrix',NS):
    z=matrix.findtext('o:Identifier',namespaces=NS)
    if z not in ['12','13']:continue
    get=lambda name:matrix.findtext('w:'+name,namespaces=NS)
    matrices.append({'id':z,'columns':int(float(get('MatrixWidth'))),'rows':int(float(get('MatrixHeight'))),
                     'origin':[float(v) for v in get('TopLeftCorner').split()], 'tileSize':int(get('TileWidth')),
                     'scaleDenominator':float(get('ScaleDenominator'))})
assert len(matrices)==2
bounds=[77.405,18.430,77.448,18.465]
entries=[]
(OUT/'tiles').mkdir(exist_ok=True)
for matrix in matrices:
    span=360/matrix['columns'];z=matrix['id']
    for row in range(math.floor((90-bounds[3])/span),math.floor((90-bounds[1])/span)+1):
        for col in range(math.floor((bounds[0]+180)/span),math.floor((bounds[2]+180)/span)+1):
            url=f'{ENDPOINT}/default/default028mm/{z}/{row}/{col}.png'
            name=f'{z}-{row}-{col}.png';raw=download(name,url)
            image=Image.open(io.BytesIO(raw));assert image.size==(256,256)
            (OUT/'tiles'/name).write_bytes(raw)
            west=-180+col*span;north=90-row*span
            bottom_left=project(west,north-span);top_right=project(west+span,north)
            entries.append({'z':z,'row':row,'col':col,'url':url,'file':f'data/mars/tiles/{name}',
                            'bounds':bottom_left+top_right,'sha256':hashlib.sha256(raw).hexdigest()})
save('wmts.json', {'layer':LAYER,'title':'MRO HiRISE, Jezero Mosaic, Controlled','body':'Mars',
                   'capabilities':cap_url,'matrixSet':'default028mm','crs':'urn:ogc:def:crs:EPSG::104905',
                   'coordinateUnits':'degrees','matrices':matrices,'tiles':entries,'bounds':bounds,
                   'downloadedAt':STAMP})
print(json.dumps({'routes':[{k:r[k] for k in ['id','distanceM','maxSlopeDeg']} for r in routes],
                  'meda':[(m['sol'],m['irradiance'],m['count']) for m in meda],
                  'moxie':[(m['sol'],m['producedG']) for m in moxie],'tiles':len(entries)},indent=2))
