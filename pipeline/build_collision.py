"""Top-down collision field for the goose actor, built from SOURCE geometry (scene.pkl + DEM), not from rendered heights.

Grid: 2 m cells in local metres, grouped into 512 m chunks of 256 x 256 cells. Chunk (ix, iy) covers
x in [ix*512, (ix+1)*512), y in [iy*512, (iy+1)*512). Image row 0 is the NORTH edge (north-up, viewable as a map):
    cell (col c, row r) centre:  x = ix*512 + (c + 0.5)*2 ,  y = (iy + 1)*512 - (r + 0.5)*2

Per chunk two lossless 8-bit PNGs (codec identical to the height tiles: z = (256*R + G)/100 - 100, metres rel. datum):
    solid/{ix}_{iy}.png   RGBA  RG = solid top z (max of terrain and building parts / pitched roof surface)
                                B  = canopy top above ground z of the cell, 0.1 m units (0 = no canopy)
                                A  = kind bits: 1 building, 2 tree crown, 4 water, 8 valid
    ground/{ix}_{iy}.png  RGB   RG = terrain z (bilinear DEM at the cell centre), B = 255 valid / 0 invalid
plus collision/meta.json describing the codec, the chunk list (with per-chunk zmax for fast rejects) and content hashes.

Trees are the SAME set the reference renderer draws (OSM trees + prepare_tiles.scatter_trees inferred trees) with the
renderer's exact two-blob crown shape (see crown_blobs), rasterized conservatively (max over each cell); the crown top
is ~ ground + 1.6 + 1.75..1.85 r.

Usage: python3 pipeline/build_collision.py            chunks under the published tiles (manifest.tiles) + margin
       python3 pipeline/build_collision.py --all      every chunk under the citywide tile plan (coverage.json)
       python3 pipeline/build_collision.py --chunks 0,-1 1,-1 --out /tmp/col
"""
import os, sys, json, math, time, argparse, hashlib, datetime
import numpy as np
from PIL import Image
import shapely
from shapely.geometry import box
sys.path.insert(0, os.path.dirname(__file__))
from world import cfg, ROOT
from build_scene import DEM
from classes import area_class
from prepare_tiles import load_scene, Indexes, scatter_trees, roof_spec, tile_region

CELL = 2.0
N = 256
CHUNK = CELL * N
KIND_BUILDING, KIND_TREE, KIND_WATER, KIND_VALID = 1, 2, 4, 8
CANOPY_UNITS_PER_M = 10
TREE_SCATTER_MARGIN = 24.0   # scatter trees over a wider box so edge effects of road / footprint exclusion stay outside the chunk
TILE_Z_RANGE = (-30.0, 150.0)  # altitudes the actor can occupy; widens each tile's world footprint along the view direction
TILE_MARGIN_M = 32.0
OUT_DEFAULT = os.path.join(ROOT, 'web', 'public', 'data', 'collision')


def heights_codec():
    h = cfg()['heights']
    return float(h['floor_m']), float(h['units_per_m'])


def encode_z(z):
    floor, units = heights_codec()
    code = np.clip(np.round((np.asarray(z, float) - floor) * units), 0, 65535).astype(np.uint16)
    return (code >> 8).astype(np.uint8), (code & 255).astype(np.uint8)


def decode_z(r, g):
    floor, units = heights_codec()
    return (r.astype(np.float64) * 256 + g) / units + floor


def chunk_origin(ix, iy):
    return ix * CHUNK, iy * CHUNK


def cell_centres(ix, iy):
    """(X, Y) arrays of shape (N, N), indexed [row, col], row 0 = north."""
    x0, y0 = chunk_origin(ix, iy)
    xs = x0 + (np.arange(N) + 0.5) * CELL
    ys = y0 + CHUNK - (np.arange(N) + 0.5) * CELL
    return np.meshgrid(xs, ys)


def chunks_for_tiles(tiles):
    """Chunks intersecting the world regions of the given canvas tiles over the actor's altitude range."""
    out = set()
    for i, j in tiles:
        bb = tile_region(i, j, TILE_Z_RANGE[0], TILE_Z_RANGE[1], TILE_MARGIN_M)
        for ix in range(math.floor(bb[0] / CHUNK), math.floor(bb[2] / CHUNK) + 1):
            for iy in range(math.floor(bb[1] / CHUNK), math.floor(bb[3] / CHUNK) + 1):
                out.add((ix, iy))
    return sorted(out)


def js_hash(x, y, k):
    """Port of render/renderer.js hash(x, y, k) (32-bit integer mixing) so crown offsets match the reference renderer."""
    M = 0xFFFFFFFF
    imul = lambda a, b: (a.astype(np.uint64) * np.uint64(b & M)) & np.uint64(M)
    xi = np.trunc(np.asarray(x, float) * 100).astype(np.int64) & M
    yi = np.trunc(np.asarray(y, float) * 100).astype(np.int64) & M
    h = imul(xi, 374761393) ^ imul(yi, 668265263) ^ np.uint64((k + 1) * 2246822519 & M)
    h = imul(h ^ (h >> np.uint64(13)), 1274126177)
    return (h ^ (h >> np.uint64(16))).astype(np.float64) / 4294967296.0


def crown_blobs(x, y, r, z):
    """The renderer's two ellipsoid blobs per tree (render/renderer.js buildTrees): main crown radius r centred at
    ground + 1.6 + 0.9 r (vertical semi-axis 0.85 r), plus a 0.7 r blob offset by up to r/2 and raised 0.35 r.
    Returns centre x, centre y, centre z, horizontal radius, vertical semi-axis (arrays of length 2 * len(x))."""
    ox, oy = (js_hash(x, y, 8) - 0.5) * r, (js_hash(x, y, 9) - 0.5) * r
    zc = z + 0.9 * r + 1.6
    return (np.r_[x, x + ox], np.r_[y, y + oy], np.r_[zc, zc + 0.35 * r], np.r_[r, 0.7 * r], np.r_[0.85 * r, 0.85 * 0.7 * r])


def pitched_roof_z(part, X, Y):
    """Roof surface z (relative to the part's ridge 'top') for a roof_spec'd rectangle; matches render/renderer.js."""
    c = np.asarray(part['ring'], float)       # 4 corners, c0 -> c1 is the long side (roof_spec guarantees it)
    o = c.mean(0)
    L = np.linalg.norm(c[1] - c[0]); W = np.linalg.norm(c[3] - c[0])
    u = (c[1] - c[0]) / max(L, 1e-6); v = (c[3] - c[0]) / max(W, 1e-6)
    a = np.abs((X - o[0]) * u[0] + (Y - o[1]) * u[1])
    w = np.abs((X - o[0]) * v[0] + (Y - o[1]) * v[1])
    slope = w / max(W / 2, 1e-6)
    if part['roof']['type'] == 'hipped':
        tl = min(0.45, (W / 2) / max(L, 1e-3)) * L
        slope = np.maximum(slope, np.maximum(0.0, a - (L / 2 - tl)) / max(tl, 1e-6))
    return -part['roof']['rise'] * np.clip(slope, 0.0, 1.0)


def spec_parts(b):
    """Building parts in the renderer's form (pitched roofs replaced by their roof_spec rectangle)."""
    return [roof_spec(b['cls'], {'ring': p['ring'].tolist(), 'holes': [h.tolist() for h in p['holes']], 'top': p['top'],
                                 'bottom': p['bottom'], 'src': p['src'], 'roof_shape': p['roof_shape'], 'roof_color': p['roof_color']})
            for p in b['parts']]


def window(poly_bounds, ix, iy):
    """Row / col slice of the chunk grid covering a bbox, or None if disjoint."""
    x0, y0 = chunk_origin(ix, iy)
    c0 = max(0, int(math.floor((poly_bounds[0] - x0) / CELL))); c1 = min(N, int(math.ceil((poly_bounds[2] - x0) / CELL)) + 1)
    r0 = max(0, int(math.floor((y0 + CHUNK - poly_bounds[3]) / CELL))); r1 = min(N, int(math.ceil((y0 + CHUNK - poly_bounds[1]) / CELL)) + 1)
    if c0 >= c1 or r0 >= r1: return None
    return slice(r0, r1), slice(c0, c1)


class CollisionBuilder:
    def __init__(self):
        self.S = load_scene()
        self.idx = Indexes(self.S)
        self.dem = DEM()
        self.datum = cfg()['projection']['datum_m']
        d = self.dem
        self.dem_bounds = (d.x0, d.y0, d.x0 + (d.z.shape[1] - 1) * d.step, d.y0 + (d.z.shape[0] - 1) * d.step)

    def build(self, ix, iy):
        """Returns dict of (N, N) arrays: solid, ground (z rel. datum), canopy_dm (uint8), kind (uint8)."""
        S, idx = self.S, self.idx
        X, Y = cell_centres(ix, iy)
        x0, y0 = chunk_origin(ix, iy)
        db = self.dem_bounds
        valid = (X >= db[0]) & (X <= db[2]) & (Y >= db[1]) & (Y <= db[3])
        ground = self.dem.sample(X, Y) - self.datum
        solid = ground.copy()
        kind = np.where(valid, KIND_VALID, 0).astype(np.uint8)

        # ---- buildings: max of every part top covering the cell centre (pitched roofs follow their surface)
        q = box(x0 - CELL, y0 - CELL, x0 + CHUNK + CELL, y0 + CHUNK + CELL)
        near = box(x0 - TREE_SCATTER_MARGIN - 4, y0 - TREE_SCATTER_MARGIN - 4, x0 + CHUNK + TREE_SCATTER_MARGIN + 4, y0 + CHUNK + TREE_SCATTER_MARGIN + 4)
        footprints = []
        for k in idx.btree.query(near):
            b = S['buildings'][k]
            parts = spec_parts(b)
            footprints += [np.asarray(p['ring']) for p in parts]
            if not idx.bpolys[k].intersects(q): continue
            for p in parts:
                poly = shapely.Polygon(p['ring'], p['holes'])
                if not poly.is_valid: poly = poly.buffer(0)
                if poly.is_empty: continue
                win = window(poly.bounds, ix, iy)
                if win is None: continue
                xs, ys = X[win], Y[win]
                shapely.prepare(poly)
                inside = shapely.contains_xy(poly, xs, ys)
                if not inside.any(): continue
                top = b['z0'] + p['top']
                z = top + pitched_roof_z(p, xs, ys) if p.get('roof') else np.full(xs.shape, top)
                hit = inside & (z > ground[win] + 0.3)    # parts sunk into the hillside add no obstacle
                solid[win] = np.where(hit, np.maximum(solid[win], z), solid[win])
                kind[win] |= np.where(hit, KIND_BUILDING, 0).astype(np.uint8)

        # ---- water: water / pool areas and buffered stream lines
        for k in idx.atree.query(q):
            a = S['areas'][k]
            c = area_class(a['layer'], a['cls'])
            if not c or c[0] not in ('water', 'pool'): continue
            self._burn(shapely.Polygon(a['ring'], a['holes']), ix, iy, X, Y, kind, KIND_WATER)
        if idx.ltree is not None:
            for k in idx.ltree.query(q):
                l = S['lines'][k]
                self._burn(shapely.LineString(l['xy']).buffer(l['w'] / 2), ix, iy, X, Y, kind, KIND_WATER)

        # ---- tree crowns (same tree set and crown shape as the reference renderer)
        sb = (x0 - TREE_SCATTER_MARGIN, y0 - TREE_SCATTER_MARGIN, x0 + CHUNK + TREE_SCATTER_MARGIN, y0 + CHUNK + TREE_SCATTER_MARGIN)
        fu = shapely.unary_union([shapely.Polygon(f) for f in footprints if len(f) >= 3]) if footprints else None
        trees = scatter_trees(S, idx, sb, fu)
        canopy_abs = np.full((N, N), -np.inf)
        if trees:
            T = np.array([t[:3] for t in trees], float)
            bx, by, bz, bh, bv = crown_blobs(T[:, 0], T[:, 1], T[:, 2], self.dem.sample(T[:, 0], T[:, 1]) - self.datum)
            col = np.floor((bx - x0) / CELL).astype(int); row = np.floor((y0 + CHUNK - by) / CELL).astype(int)
            reach = int(math.ceil(bh.max() / CELL)) + 1
            for dr in range(-reach, reach + 1):
                for dc in range(-reach, reach + 1):
                    rr, cc = row + dr, col + dc
                    cx = x0 + (cc + 0.5) * CELL; cy = y0 + CHUNK - (rr + 0.5) * CELL
                    # conservative: the crown height at the point of the cell nearest the blob centre (max over the cell),
                    # so thin crown rims are never lost between cell centres
                    nx = np.clip(bx, cx - CELL / 2, cx + CELL / 2); ny = np.clip(by, cy - CELL / 2, cy + CELL / 2)
                    q = 1 - ((nx - bx) ** 2 + (ny - by) ** 2) / bh ** 2
                    ok = (rr >= 0) & (rr < N) & (cc >= 0) & (cc < N) & (q > 0)
                    if not ok.any(): continue
                    np.maximum.at(canopy_abs, (rr[ok], cc[ok]), (bz + bv * np.sqrt(np.clip(q, 0, 1)))[ok])
        above = canopy_abs - ground
        has = np.isfinite(above) & (above > 0.05)
        canopy_dm = np.where(has, np.clip(np.round(above * CANOPY_UNITS_PER_M), 1, 255), 0).astype(np.uint8)
        kind |= np.where(has, KIND_TREE, 0).astype(np.uint8)

        solid = np.where(valid, solid, cfg()['heights']['floor_m'])
        ground = np.where(valid, ground, cfg()['heights']['floor_m'])
        kind = np.where(valid, kind, 0).astype(np.uint8)
        canopy_dm = np.where(valid, canopy_dm, 0).astype(np.uint8)
        return {'solid': solid, 'ground': ground, 'canopy_dm': canopy_dm, 'kind': kind, 'trees': len(trees)}

    @staticmethod
    def _burn(geom, ix, iy, X, Y, kind, bit):
        # clip first: some water polygons (e.g. Lake Huron) are huge, and validity checks on them are slow
        x0, y0 = chunk_origin(ix, iy)
        geom = shapely.clip_by_rect(geom, x0 - CELL, y0 - CELL, x0 + CHUNK + CELL, y0 + CHUNK + CELL)
        if geom.is_empty: return
        win = window(geom.bounds, ix, iy)
        if win is None: return
        shapely.prepare(geom)
        inside = shapely.contains_xy(geom, X[win], Y[win])
        kind[win] |= np.where(inside, bit, 0).astype(np.uint8)


def encode_chunk(c):
    sr, sg = encode_z(c['solid']); gr, gg = encode_z(c['ground'])
    valid = (c['kind'] & KIND_VALID) > 0
    solid_img = Image.fromarray(np.dstack([sr, sg, c['canopy_dm'], c['kind']]), 'RGBA')
    ground_img = Image.fromarray(np.dstack([gr, gg, np.where(valid, 255, 0).astype(np.uint8)]), 'RGB')
    return solid_img, ground_img


def load_chunk(out_dir, ix, iy):
    """Decode a published chunk back into float arrays (used by tests and build_feathers)."""
    s = np.asarray(Image.open(os.path.join(out_dir, 'solid', f'{ix}_{iy}.png')).convert('RGBA'))
    g = np.asarray(Image.open(os.path.join(out_dir, 'ground', f'{ix}_{iy}.png')).convert('RGB'))
    ground = decode_z(g[..., 0], g[..., 1])
    canopy = s[..., 2].astype(float) / CANOPY_UNITS_PER_M
    return {'solid': decode_z(s[..., 0], s[..., 1]), 'ground': ground, 'canopy_dm': s[..., 2], 'kind': s[..., 3],
            'canopy_top': np.where(s[..., 2] > 0, ground + canopy, np.nan)}


def cell_of(x, y):
    """(ix, iy, row, col) of the cell containing local point (x, y)."""
    ix, iy = math.floor(x / CHUNK), math.floor(y / CHUNK)
    x0, y0 = chunk_origin(ix, iy)
    return ix, iy, min(N - 1, int((y0 + CHUNK - y) / CELL)), min(N - 1, int((x - x0) / CELL))


def file_hash(*paths):
    h = hashlib.sha1()
    for p in paths:
        with open(p, 'rb') as f: h.update(f.read())
    return h.hexdigest()[:12]


def meta_record(chunks, scope):
    floor, units = heights_codec()
    return {
        'version': 1,
        'generated_utc': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'scope': scope,
        'cell_m': CELL, 'chunk_cells': N, 'chunk_m': CHUNK,
        'datum_m': cfg()['projection']['datum_m'],
        'z_codec': {'floor_m': floor, 'units_per_m': units, 'formula': 'z = (256*R + G) / units_per_m + floor_m  (metres rel. datum_m)'},
        'layout': 'chunk (ix, iy) covers x in [ix*chunk_m, (ix+1)*chunk_m), y in [iy*chunk_m, (iy+1)*chunk_m); '
                  'image row 0 = north edge; cell (col c, row r) centre x = ix*chunk_m + (c+0.5)*cell_m, y = (iy+1)*chunk_m - (r+0.5)*cell_m',
        'files': {'solid': 'solid/{ix}_{iy}.png', 'ground': 'ground/{ix}_{iy}.png'},
        'solid_png': {'R': 'solid top z high byte', 'G': 'solid top z low byte',
                      'B': 'canopy top above the cell ground z, 0.1 m units (0 = no canopy)', 'A': 'kind bits'},
        'ground_png': {'R': 'terrain z high byte', 'G': 'terrain z low byte', 'B': '255 = valid, 0 = outside terrain data'},
        'kind_bits': {'building': KIND_BUILDING, 'tree': KIND_TREE, 'water': KIND_WATER, 'valid': KIND_VALID},
        'canopy_units_per_m': CANOPY_UNITS_PER_M,
        'tree_crown': 'upper surface of the reference renderer crowns: ellipsoid radius r, vertical semi-axis 0.85 r, centre ground(tree) + 1.6 + 0.9 r, '
                      'plus a 0.7 r blob offset by up to r/2 and raised 0.35 r (peaks ~ ground + 1.6 + 1.75..1.85 r); each cell stores the max over its area',
        'sources': ['buildings: Overture/OSM footprints + parts from data_cache/scene/scene.pkl (base z0 = min terrain under footprint, '
                    'pitched roofs from prepare_tiles.roof_spec)',
                    'terrain: data_cache/terrain/dem.npz (bilinear)',
                    'trees: OSM trees + prepare_tiles.scatter_trees inferred trees (same set as the reference renderer)',
                    'water: Overture water areas / lines + land_use water_hazard + fountains'],
        'chunks': chunks,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--all', action='store_true', help='every chunk under the citywide tile plan (coverage.json)')
    ap.add_argument('--chunks', nargs='*', default=[], help='explicit chunk list "ix,iy"')
    ap.add_argument('--out', default=OUT_DEFAULT)
    a = ap.parse_args()
    data = os.path.join(ROOT, 'web', 'public', 'data')
    if a.chunks:
        chunks = sorted(tuple(map(int, c.split(','))) for c in a.chunks); scope = 'explicit'
    elif a.all:
        cov = json.load(open(os.path.join(data, 'coverage.json')))
        chunks = chunks_for_tiles([tuple(t) for t in cov['city_tiles']]); scope = 'city'
    else:
        man = json.load(open(os.path.join(data, 'manifest.json')))
        chunks = chunks_for_tiles([(t['i'], t['j']) for t in man['tiles'].values()]); scope = 'published'
    for sub in ('solid', 'ground'): os.makedirs(os.path.join(a.out, sub), exist_ok=True)
    t0 = time.time()
    builder = CollisionBuilder()
    print(f'scene loaded in {time.time() - t0:.1f}s; building {len(chunks)} chunks ({scope})', flush=True)
    records = {}
    for n, (ix, iy) in enumerate(chunks):
        t1 = time.time()
        c = builder.build(ix, iy)
        si, gi = encode_chunk(c)
        sp = os.path.join(a.out, 'solid', f'{ix}_{iy}.png'); gp = os.path.join(a.out, 'ground', f'{ix}_{iy}.png')
        si.save(sp, optimize=True); gi.save(gp, optimize=True)
        valid = (c['kind'] & KIND_VALID) > 0
        canopy_top = np.where(c['canopy_dm'] > 0, c['ground'] + c['canopy_dm'] / CANOPY_UNITS_PER_M, -np.inf)
        top = np.maximum(c['solid'], canopy_top)
        records[f'{ix}_{iy}'] = {
            'zmax': round(float(top[valid].max()), 2) if valid.any() else None,
            'zmin': round(float(c['ground'][valid].min()), 2) if valid.any() else None,
            'v': file_hash(sp, gp),
        }
        nb = int(((c['kind'] & KIND_BUILDING) > 0).sum()); nt = int(((c['kind'] & KIND_TREE) > 0).sum()); nw = int(((c['kind'] & KIND_WATER) > 0).sum())
        print(f'[{n + 1}/{len(chunks)}] chunk {ix},{iy}: building cells {nb}, tree cells {nt} ({c["trees"]} trees), water cells {nw}, '
              f'zmax {records[f"{ix}_{iy}"]["zmax"]} ({time.time() - t1:.1f}s)', flush=True)
    meta_path = os.path.join(a.out, 'meta.json')
    if scope == 'explicit' and os.path.exists(meta_path):
        # partial rebuild: keep the other chunks already listed
        old = json.load(open(meta_path))
        records = {**old['chunks'], **records}; scope = old['scope']
    else:
        # full rebuild: drop chunk files from earlier runs that are no longer listed, so the directory matches meta.json
        for sub in ('solid', 'ground'):
            for fn in os.listdir(os.path.join(a.out, sub)):
                if fn.endswith('.png') and fn[:-4] not in records: os.remove(os.path.join(a.out, sub, fn))
    json.dump(meta_record(dict(sorted(records.items())), scope), open(meta_path, 'w'), indent=1)
    print(f'wrote {len(records)} chunks to {a.out} in {time.time() - t0:.1f}s')


if __name__ == '__main__':
    main()
