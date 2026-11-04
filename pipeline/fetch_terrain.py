"""Download AWS Terrain Tiles (terrarium encoding) for the bbox and resample to a local-metre DEM grid.

Source: s3://elevation-tiles-prod/terrarium/{z}/{x}/{y}.png (public dataset, Mapzen/Linux Foundation).
For Canada the underlying source is primarily CDEM (Natural Resources Canada) - a ground/bare-earth-oriented
DEM of ~20 m effective resolution. Output: data_cache/terrain/dem.npz with
  z (float32, metres ASL), x0, y0 (local metres of cell [0,0] centre), step (m).
"""
import os, sys, math, io, json, time, urllib.request
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from world import cfg, ROOT, lonlat_to_local, local_to_lonlat

Z = 14
BASE = 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium'


def deg2tile(lon, lat, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def main():
    bb = cfg()['fetch_bbox_wgs84']
    out = os.path.join(ROOT, 'data_cache', 'terrain'); os.makedirs(os.path.join(out, 'tiles'), exist_ok=True)
    x0, y1 = deg2tile(bb[0], bb[1], Z); x1, y0 = deg2tile(bb[2], bb[3], Z)
    xs = range(int(x0), int(x1) + 1); ys = range(int(y0), int(y1) + 1)
    mosaic = np.zeros((len(ys) * 256, len(xs) * 256), np.float32)
    for j, ty in enumerate(ys):
        for i, tx in enumerate(xs):
            fp = os.path.join(out, 'tiles', f'{Z}_{tx}_{ty}.png')
            if not os.path.exists(fp):
                for attempt in range(4):
                    try:
                        data = urllib.request.urlopen(f'{BASE}/{Z}/{tx}/{ty}.png', timeout=30).read(); break
                    except Exception as e:
                        time.sleep(2 ** attempt)
                else:
                    raise
                open(fp, 'wb').write(data)
            a = np.asarray(Image.open(fp).convert('RGB'), np.float32)
            mosaic[j*256:(j+1)*256, i*256:(i+1)*256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    # resample to local grid
    step = 5.0
    corners = [lonlat_to_local(bb[0], bb[1]), lonlat_to_local(bb[2], bb[3]), lonlat_to_local(bb[0], bb[3]), lonlat_to_local(bb[2], bb[1])]
    lx0 = min(c[0] for c in corners); lx1 = max(c[0] for c in corners)
    ly0 = min(c[1] for c in corners); ly1 = max(c[1] for c in corners)
    gx = np.arange(lx0, lx1, step); gy = np.arange(ly0, ly1, step)
    GX, GY = np.meshgrid(gx, gy)
    lon, lat = local_to_lonlat(GX, GY)
    n = 2 ** Z
    px = ((lon + 180) / 360 * n - xs[0]) * 256 - 0.5
    py = ((1 - np.arcsinh(np.tan(np.radians(lat))) / np.pi) / 2 * n - ys[0]) * 256 - 0.5
    # bilinear
    ix = np.clip(np.floor(px).astype(int), 0, mosaic.shape[1] - 2); iy = np.clip(np.floor(py).astype(int), 0, mosaic.shape[0] - 2)
    fx = np.clip(px - ix, 0, 1); fy = np.clip(py - iy, 0, 1)
    m = mosaic
    zg = (m[iy, ix] * (1 - fx) * (1 - fy) + m[iy, ix + 1] * fx * (1 - fy) + m[iy + 1, ix] * (1 - fx) * fy + m[iy + 1, ix + 1] * fx * fy)
    np.savez_compressed(os.path.join(out, 'dem.npz'), z=zg.astype(np.float32), x0=gx[0], y0=gy[0], step=step)
    meta = {'source': f'{BASE}/{Z}/{{x}}/{{y}}.png', 'zoom': Z, 'tiles': len(xs) * len(ys), 'grid_step_m': step,
            'shape': list(zg.shape), 'z_min': float(zg.min()), 'z_max': float(zg.max()),
            'retrieved_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
    json.dump(meta, open(os.path.join(out, 'meta.json'), 'w'), indent=2)
    print(meta)


if __name__ == '__main__':
    main()
