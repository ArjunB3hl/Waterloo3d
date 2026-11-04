"""Per-tile horizontal correction between the tangent-plane ENU frame (used to place Google 3D Tiles) and the map's
transverse-Mercator local frame. Writes data_cache/google3d/frames.json: {"i_j": {"dx": .., "dy": ..}} metres to ADD to ENU
x/y at that tile's region centre (residual error inside one tile region < ~2 cm)."""
import os, sys, json, math, glob
import numpy as np
from pyproj import Transformer
sys.path.insert(0, os.path.dirname(__file__))
from world import cfg, ROOT, local_to_lonlat

o = cfg()['origin']; t = Transformer.from_crs('EPSG:4326', 'EPSG:4978', always_xy=True)
lat0, lon0 = math.radians(o['lat']), math.radians(o['lon'])
O = np.array(t.transform(o['lon'], o['lat'], 0))
E = np.array([-math.sin(lon0), math.cos(lon0), 0]); N = np.array([-math.sin(lat0) * math.cos(lon0), -math.sin(lat0) * math.sin(lon0), math.cos(lat0)])
out = {}
for jp in sorted(glob.glob(os.path.join(ROOT, 'data_cache', 'jobs', '*', 'job.json'))):
    d = os.path.basename(os.path.dirname(jp)); b = json.load(open(jp))['region_bbox']
    x, y = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
    lon, lat = local_to_lonlat(x, y); p = np.array(t.transform(lon, lat, 300)) - O
    out[d] = {'dx': round(float(x - p @ E), 4), 'dy': round(float(y - p @ N), 4)}
os.makedirs(os.path.join(ROOT, 'data_cache', 'google3d'), exist_ok=True)
json.dump(out, open(os.path.join(ROOT, 'data_cache', 'google3d', 'frames.json'), 'w'), indent=1)
print(f'{len(out)} tile corrections; max |d| = {max(math.hypot(v["dx"], v["dy"]) for v in out.values()):.3f} m')
