"""Place the goose's collectible feathers inside the published map area -> web/public/data/feathers.json.

One feather above each covered landmark (web/public/data/landmarks.json) plus a scatter over Waterloo Park, Silver Lake,
the campus greens and Laurier's Alumni Field. Altitudes come from the collision field (run pipeline/build_collision.py first):
z = highest obstacle (solid or canopy) within 6 m + clearance (roofs 6 m, open ground 4 m, water 3 m).
Every feather's canvas position (at its z) lies inside a published tile with a 40 px margin to unpublished tiles.
Deterministic: same inputs -> same file.

Usage: python3 pipeline/build_feathers.py
"""
import os, sys, json, math, datetime, pickle
import numpy as np
import shapely
sys.path.insert(0, os.path.dirname(__file__))
from world import ROOT, F, cfg, lonlat_to_local, world_to_canvas
from build_collision import OUT_DEFAULT as COLLISION_DIR, KIND_BUILDING, KIND_TREE, KIND_WATER, load_chunk, cell_of, CELL

DATA = os.path.join(ROOT, 'web', 'public', 'data')
CLEARANCE = {'roof': 6.0, 'ground': 4.0, 'tree': 4.0, 'water': 3.0}
NEAR_M = 6.0          # obstacle search radius around a feather
MIN_SPACING_M = 45.0  # between scattered feathers and anything already placed
EDGE_PX = 40          # keep feathers this far inside the published tile set
# (area name, scene layer, count, label) - scattered collectibles in the open spaces of the published area
SCATTER = [
    ('Waterloo Park', 'land_use', 4, 'Waterloo Park'),
    ('Silver Lake', 'water', 2, 'Silver Lake'),
    ('Arts Quad', 'land_use', 1, 'Arts Quad'),
    ('Graduate House Green', 'land_use', 1, 'Graduate House Green'),
    ('Mathematics 3 Green', 'land_use', 1, 'Mathematics 3 Green'),
    ('Alumni Field', 'land_use', 1, 'Alumni Field'),
]


class Field:
    """Decoded collision chunks, loaded on demand."""
    def __init__(self):
        self.meta = json.load(open(os.path.join(COLLISION_DIR, 'meta.json')))
        self.cache = {}

    def cell(self, x, y):
        ix, iy, r, c = cell_of(x, y)
        if f'{ix}_{iy}' not in self.meta['chunks']: return None
        if (ix, iy) not in self.cache: self.cache[(ix, iy)] = load_chunk(COLLISION_DIR, ix, iy)
        ch = self.cache[(ix, iy)]
        return ch['solid'][r, c], ch['canopy_top'][r, c], int(ch['kind'][r, c])

    def surface(self, x, y):
        """(highest obstacle z within NEAR_M, what lies directly below) or None outside the field."""
        top, below = -math.inf, None
        for dx in np.arange(-NEAR_M, NEAR_M + 0.1, CELL):
            for dy in np.arange(-NEAR_M, NEAR_M + 0.1, CELL):
                if dx * dx + dy * dy > NEAR_M * NEAR_M: continue
                c = self.cell(x + dx, y + dy)
                if c is None: return None
                top = max(top, c[0], np.nan_to_num(c[1], nan=-math.inf))
        s, can, k = self.cell(x, y)
        below = 'roof' if k & KIND_BUILDING else 'water' if k & KIND_WATER else 'tree' if k & KIND_TREE else 'ground'
        return float(top), below


def published_check(tiles):
    def inside(x, y, z):
        (cx, cy), _ = world_to_canvas([x, y, z])
        for ox, oy in ((0, 0), (EDGE_PX, 0), (-EDGE_PX, 0), (0, EDGE_PX), (0, -EDGE_PX)):
            if (math.floor((cx + ox) / F()), math.floor((cy + oy) / F())) not in tiles: return None
        return [round(float(cx), 1), round(float(cy), 1)]
    return inside


def feather(fid, x, y, field, inside, label, landmark_id=None):
    s = field.surface(x, y)
    if s is None: return None
    top, below = s
    x, y, z = round(float(x), 1), round(float(y), 1), round(top + CLEARANCE[below], 1)   # canvas from the published values
    canvas = inside(x, y, z)
    if canvas is None: return None
    f = {'id': fid, 'x': x, 'y': y, 'z': z, 'label': label, 'over': below, 'canvas': canvas}
    if landmark_id: f['landmark_id'] = landmark_id
    return f


def main():
    man = json.load(open(os.path.join(DATA, 'manifest.json')))
    tiles = {(t['i'], t['j']) for t in man['tiles'].values()}
    inside = published_check(tiles)
    field = Field()
    out = []

    for lm in json.load(open(os.path.join(DATA, 'landmarks.json'))):
        if lm['status'] != 'covered': continue
        x, y = lonlat_to_local(*lm['lonlat'])
        f = feather(f'feather-{lm["id"]}', x, y, field, inside, lm['name'], lm['id'])
        if f is None:
            print(f'skip landmark {lm["id"]}: outside the published area / collision field'); continue
        if f['over'] == 'roof': f['label'] = f'{lm["name"]} rooftop'
        out.append(f)

    S = pickle.load(open(os.path.join(ROOT, 'data_cache', 'scene', 'scene.pkl'), 'rb'))
    for area_name, layer, count, label in SCATTER:
        polys = [shapely.Polygon(a['ring'], a['holes']) for a in S['areas'] if a['name'] == area_name and a['layer'] == layer]
        if not polys: raise SystemExit(f'area {area_name!r} not found in scene')
        poly = shapely.unary_union(polys)
        core = poly.buffer(-8) if poly.buffer(-8).area > 200 else poly.buffer(-2)
        minx, miny, maxx, maxy = core.bounds
        gx, gy = np.meshgrid(np.arange(minx, maxx, 4.0), np.arange(miny, maxy, 4.0))
        ok = shapely.contains_xy(core, gx.ravel(), gy.ravel())
        cand = [(float(x), float(y)) for x, y in zip(gx.ravel()[ok], gy.ravel()[ok])]
        placed = 0
        while placed < count and cand:
            # farthest-point sampling: the candidate farthest from every feather placed so far (ties -> first, deterministic)
            P = np.array(cand); Q = np.array([[f['x'], f['y']] for f in out]) if out else np.zeros((0, 2))
            d = np.min(np.hypot(P[:, None, 0] - Q[None, :, 0], P[:, None, 1] - Q[None, :, 1]), 1) if len(Q) else np.full(len(P), np.inf)
            k = int(np.argmax(d))
            if d[k] < MIN_SPACING_M: break
            x, y = cand.pop(k)
            n = placed + 1
            slug = 'feather-' + area_name.lower().replace(' ', '-') + (f'-{n}' if count > 1 else '')
            f = feather(slug, x, y, field, inside, f'{label} ({n} of {count})' if count > 1 else label)
            if f is None or f['over'] == 'roof': continue
            out.append(f); placed += 1
        if placed < count: print(f'warning: placed only {placed}/{count} feathers in {area_name}')

    rec = {
        'version': 1,
        'generated_utc': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'datum_m': cfg()['projection']['datum_m'],
        'source': 'pipeline/build_feathers.py (collision field + landmarks.json + scene areas)',
        'coords': 'x, y, z local ENU metres (z rel. datum_m); canvas = artwork px of (x, y, z); over = what lies directly below',
        'feathers': out,
    }
    json.dump(rec, open(os.path.join(DATA, 'feathers.json'), 'w'), indent=1)
    print(f'wrote {len(out)} feathers')
    for f in out: print(f"  {f['id']:34s} ({f['x']:8.1f}, {f['y']:8.1f}, {f['z']:5.1f}) over {f['over']:6s} {f['label']}")


if __name__ == '__main__':
    main()
