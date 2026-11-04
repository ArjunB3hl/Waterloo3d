"""Shared map frame: projection, camera axes, tile grid. Every pipeline step imports this.

Canvas pixel coordinates (cx, cy) are the global artwork pixel grid (y grows downward).
Tile (i, j) covers cx in [i*F, (i+1)*F) and cy in [j*F, (j+1)*F) with F = frame_px.
"""
import json, math, os
from functools import lru_cache
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG_PATH = os.path.join(ROOT, 'config', 'world.json')


@lru_cache(None)
def cfg():
    with open(CFG_PATH) as f:
        return json.load(f)


def axes():
    """Return right, up, back unit vectors in local ENU (x east, y north, z up)."""
    c = cfg()['camera']
    h = math.radians(c['heading_deg']); p = math.radians(c['pitch_deg'])
    f = np.array([math.sin(h), math.cos(h), 0.0])
    z = np.array([0.0, 0.0, 1.0])
    r = np.array([math.cos(h), -math.sin(h), 0.0])
    u = f * math.sin(p) + z * math.cos(p)
    b = -(f * math.cos(p) - z * math.sin(p))
    return r, u, b


def sun_dir():
    s = cfg()['sun']
    az = math.radians(s['azimuth_deg']); el = math.radians(s['elevation_deg'])
    return np.array([math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)])


def mpp():
    return cfg()['camera']['meters_per_px']


def F():
    return cfg()['tiles']['frame_px']


@lru_cache(None)
def transformer():
    from pyproj import Transformer
    return Transformer.from_crs('EPSG:4326', cfg()['projection']['proj4'], always_xy=True)


@lru_cache(None)
def inv_transformer():
    from pyproj import Transformer
    return Transformer.from_crs(cfg()['projection']['proj4'], 'EPSG:4326', always_xy=True)


def lonlat_to_local(lon, lat):
    return transformer().transform(lon, lat)


def local_to_lonlat(x, y):
    return inv_transformer().transform(x, y)


def world_to_canvas(p):
    """p: (..., 3) local metres (z relative to datum). Returns (..., 2) canvas px and depth (toward camera, m)."""
    r, u, b = axes()
    p = np.asarray(p, dtype=float)
    cx = p @ r / mpp(); cy = -(p @ u) / mpp(); d = p @ b
    return np.stack([cx, cy], -1), d


def canvas_to_world(cx, cy, h):
    """Inverse: canvas px + surface height z -> local point."""
    r, u, b = axes()
    X = np.asarray(cx, float) * mpp(); Y = -np.asarray(cy, float) * mpp()
    t = (np.asarray(h, float) - Y * u[2]) / b[2]
    return X[..., None] * r + Y[..., None] * u + t[..., None] * b


def camera_record():
    r, u, b = axes()
    return {
        'right_enu': [round(v, 9) for v in r], 'up_enu': [round(v, 9) for v in u], 'back_enu': [round(v, 9) for v in b],
        'sun_enu': [round(v, 9) for v in sun_dir()],
        'meters_per_px': mpp(), 'frame_px': F(),
        'canvas_from_world': 'cx = dot(p,right)/meters_per_px ; cy = -dot(p,up)/meters_per_px ; depth = dot(p,back)',
        'world_from_canvas': 'X=cx*mpp, Y=-cy*mpp, t=(z - Y*up.z)/back.z, p = X*right + Y*up + t*back',
    }
