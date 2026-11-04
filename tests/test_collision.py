"""Checks the published collision chunks (web/public/data/collision) against the SOURCE data (scene.pkl + DEM).

Run:  python3 tests/test_collision.py        (plain asserts; also collected by pytest if it is installed)
Needs data_cache/ (scene.pkl, dem.npz) and a prior `python3 pipeline/build_collision.py`.
"""
import os, sys, json, math, pickle
import numpy as np
import shapely

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'pipeline'))
from world import cfg                                                    # noqa: E402
from build_scene import DEM                                              # noqa: E402
from prepare_tiles import tile_region, hash01, roof_spec                 # noqa: E402
from build_collision import (OUT_DEFAULT, CELL, CHUNK, N, KIND_BUILDING, KIND_TREE, KIND_VALID, load_chunk,  # noqa: E402
                             cell_centres, cell_of, file_hash, decode_z)

DATUM = cfg()['projection']['datum_m']
META = json.load(open(os.path.join(OUT_DEFAULT, 'meta.json')))
SCENE = pickle.load(open(os.path.join(ROOT, 'data_cache', 'scene', 'scene.pkl'), 'rb'))
DEM_ = DEM()
CHUNKS = {}
REPORT = []


def chunk(ix, iy):
    if (ix, iy) not in CHUNKS:
        assert f'{ix}_{iy}' in META['chunks'], f'chunk {ix},{iy} not published'
        CHUNKS[(ix, iy)] = load_chunk(OUT_DEFAULT, ix, iy)
    return CHUNKS[(ix, iy)]


def sample(layer, x, y):
    ix, iy, r, c = cell_of(x, y)
    return chunk(ix, iy)[layer][r, c]


def published_chunks():
    return [tuple(map(int, k.split('_'))) for k in META['chunks']]


def test_meta_consistent():
    for k, rec in META['chunks'].items():
        sp = os.path.join(OUT_DEFAULT, 'solid', f'{k}.png'); gp = os.path.join(OUT_DEFAULT, 'ground', f'{k}.png')
        assert os.path.exists(sp) and os.path.exists(gp), k
        assert file_hash(sp, gp) == rec['v'], f'stale hash for {k}'
        c = chunk(*map(int, k.split('_')))
        top = np.fmax(c['solid'], c['canopy_top'])
        assert abs(np.nanmax(top) - rec['zmax']) < 0.02, (k, np.nanmax(top), rec['zmax'])
    # every published tile's ground footprint is inside the chunk set
    man = json.load(open(os.path.join(ROOT, 'web', 'public', 'data', 'manifest.json')))
    have = set(published_chunks())
    for t in man['tiles'].values():
        bb = tile_region(t['i'], t['j'], -30, 150, 0)
        for x in (bb[0], bb[2]):
            for y in (bb[1], bb[3]):
                assert (math.floor(x / CHUNK), math.floor(y / CHUNK)) in have, (t, x, y)
    REPORT.append(f'meta: {len(have)} chunks, hashes and zmax consistent, all {len(man["tiles"])} tiles covered')


def test_dana_porter_roof():
    b = next(b for b in SCENE['buildings'] if b['name'] == 'Dana Porter Library')
    tower = max(b['parts'], key=lambda p: p['top'])
    expected = b['z0'] + tower['top']                       # renderer: roof at building base z0 + part top
    inner = shapely.Polygon(tower['ring']).buffer(-2.5)     # cells well inside the tower footprint
    errs = []
    for ix, iy in {cell_of(x, y)[:2] for x, y in tower['ring']}:
        X, Y = cell_centres(ix, iy)
        m = shapely.contains_xy(inner, X, Y)
        c = chunk(ix, iy)
        assert (c['kind'][m] & KIND_BUILDING).all()
        errs += list(np.abs(c['solid'][m] - expected))
    errs = np.array(errs)
    assert len(errs) > 100, len(errs)
    assert errs.max() <= 0.3, errs.max()
    REPORT.append(f'Dana Porter tower: expected roof z {expected:.3f} m (rel. datum), {len(errs)} cells, max |err| {errs.max():.4f} m')


def test_open_lawn_is_ground():
    # global invariant: wherever there is no building, solid top == terrain (bit-exact codes)
    for k in published_chunks():
        c = chunk(*k)
        free = (c['kind'] & KIND_VALID) > 0
        free &= (c['kind'] & KIND_BUILDING) == 0
        assert np.array_equal(c['solid'][free], c['ground'][free]), k
    # a concrete lawn: the largest sports pitch / grass area in the published chunks, sampled away from its edges
    best = None
    for a in SCENE['areas']:
        if a['cls'] not in ('recreation/pitch', 'managed/grass'): continue
        poly = shapely.Polygon(a['ring'], a['holes'])
        cx, cy = poly.centroid.x, poly.centroid.y
        if f'{math.floor(cx / CHUNK)}_{math.floor(cy / CHUNK)}' not in META['chunks']: continue
        if best is None or poly.area > best.area: best = poly
    inner = best.buffer(-8)
    pt = inner.representative_point()
    ix, iy, r, c = cell_of(pt.x, pt.y)
    ch = chunk(ix, iy)
    X, Y = cell_centres(ix, iy)
    dem = DEM_.sample(X[r, c], Y[r, c]) - DATUM
    assert ch['kind'][r, c] & KIND_BUILDING == 0
    assert ch['solid'][r, c] == ch['ground'][r, c]
    assert abs(ch['ground'][r, c] - dem) <= 0.006, (ch['ground'][r, c], dem)
    REPORT.append(f'lawn ({best.area:.0f} m2 area) at ({pt.x:.1f}, {pt.y:.1f}): solid {ch["solid"][r, c]:.3f} == ground, DEM {dem:.3f}')


def test_steep_slope_follows_dem():
    # steepest DEM node inside the union of published tile ground regions
    z, x0, y0, st = DEM_.z, DEM_.x0, DEM_.y0, DEM_.step
    gy, gx = np.gradient(z, st)
    slope = np.hypot(gx, gy)
    xs = x0 + np.arange(z.shape[1]) * st; ys = y0 + np.arange(z.shape[0]) * st
    XX, YY = np.meshgrid(xs, ys)
    man = json.load(open(os.path.join(ROOT, 'web', 'public', 'data', 'manifest.json')))
    inside = np.zeros(z.shape, bool)
    for t in man['tiles'].values():
        bb = tile_region(t['i'], t['j'], -10, 30, 0)
        inside |= (XX > bb[0] + 20) & (XX < bb[2] - 20) & (YY > bb[1] + 20) & (YY < bb[3] - 20)
    k = np.argmax(np.where(inside, slope, -1))
    sx, sy, smax = XX.flat[k], YY.flat[k], slope.flat[k]
    ix, iy, r, c = cell_of(sx, sy)
    X, Y = cell_centres(ix, iy)
    win = (slice(max(0, r - 5), r + 6), slice(max(0, c - 5), c + 6))
    ch = chunk(ix, iy)
    dem = DEM_.sample(X[win], Y[win]) - DATUM
    err = np.abs(ch['ground'][win] - dem)
    assert err.max() <= 0.006, err.max()
    span = float(ch['ground'][win].max() - ch['ground'][win].min())
    assert span > 1.0, span    # the patch really is sloped
    REPORT.append(f'steepest DEM slope {smax:.3f} ({math.degrees(math.atan(smax)):.1f} deg) at ({sx:.0f}, {sy:.0f}): '
                  f'ground matches DEM within {err.max():.4f} m over 11x11 cells (relief {span:.2f} m)')


def test_tree_has_canopy():
    T, src = SCENE['trees'], np.array(SCENE['tree_src'])
    checked, worst = 0, 0.0
    for (x, y), s in zip(T, src):
        if s != 'osm_tree': continue
        ix, iy, r, c = cell_of(float(x), float(y))
        if f'{ix}_{iy}' not in META['chunks']: continue
        ch = chunk(ix, iy)
        assert ch['kind'][r, c] & KIND_TREE and ch['canopy_dm'][r, c] > 0, (x, y)
        rad = 2.6 + 2.0 * hash01(x, y)                     # same radius rule as prepare_tiles.scatter_trees
        X, Y = cell_centres(ix, iy)
        d = math.hypot(X[r, c] - x, Y[r, c] - y)
        tz = float(DEM_.sample(x, y)) - DATUM
        # main crown blob of render/renderer.js: ellipsoid radius r, vertical semi-axis 0.85 r, centre ground + 1.6 + 0.9 r
        own = tz + 1.6 + 0.9 * rad + 0.85 * rad * math.sqrt(max(0.0, 1 - (d / rad) ** 2))
        top = ch['canopy_top'][r, c]
        assert top >= own - 0.1, (x, y, top, own)          # overlapping crowns may only raise it
        worst = max(worst, abs(top - own))
        checked += 1
        if checked >= 200: break
    assert checked >= 50, checked
    REPORT.append(f'{checked} OSM tree cells all have canopy; canopy top >= own crown (max raise by neighbours {worst:.2f} m)')


def test_gabled_roof_profile():
    for b in SCENE['buildings']:
        if b['cls'] != 'house': continue
        cx, cy = b['centroid']
        if f'{math.floor(cx / CHUNK)}_{math.floor(cy / CHUNK)}' not in META['chunks']: continue
        p = b['parts'][0]
        s = roof_spec(b['cls'], {'ring': p['ring'].tolist(), 'holes': [], 'top': p['top'], 'bottom': p['bottom'], 'src': p['src'],
                                 'roof_shape': p['roof_shape'], 'roof_color': p['roof_color']})
        if not s.get('roof') or s['roof']['type'] != 'gabled' or s['roof']['rise'] < 2: continue
        c = np.asarray(s['ring']); W = np.linalg.norm(c[3] - c[0])
        if W < 9: continue
        ridge = (c[0] + c[3] + c[1] + c[2]) / 4                       # centre of the ridge line
        eave = ridge + (c[0] - c[3]) / np.linalg.norm(c[0] - c[3]) * (W / 2 - 1.2)
        top = b['z0'] + p['top']
        zr, ze = sample('solid', *ridge), sample('solid', *eave)
        assert abs(zr - top) <= s['roof']['rise'] * (CELL * 0.75) / (W / 2) + 0.01, (zr, top)
        assert zr > ze + 0.3, (zr, ze)
        REPORT.append(f'gabled house {b["id"][:8]}: ridge {zr:.2f} (spec {top:.2f}), near eave {ze:.2f}, rise {s["roof"]["rise"]}')
        return
    raise AssertionError('no gabled house found in published chunks')


def test_feathers_clear_and_published():
    rec = json.load(open(os.path.join(ROOT, 'web', 'public', 'data', 'feathers.json')))
    fs = rec['feathers']
    assert 20 <= len(fs) <= 30 and len({f['id'] for f in fs}) == len(fs)
    man = json.load(open(os.path.join(ROOT, 'web', 'public', 'data', 'manifest.json')))
    from world import world_to_canvas, F
    min_gap = math.inf
    for f in fs:
        (cx, cy), _ = world_to_canvas([f['x'], f['y'], f['z']])
        assert f'{math.floor(cx / F())}_{math.floor(cy / F())}' in man['tiles'], f['id']
        assert abs(cx - f['canvas'][0]) < 0.1 and abs(cy - f['canvas'][1]) < 0.1, f['id']
        top = max(max(sample('solid', f['x'] + dx, f['y'] + dy), np.nan_to_num(sample('canopy_top', f['x'] + dx, f['y'] + dy), nan=-1e9))
                  for dx in (-2, 0, 2) for dy in (-2, 0, 2))
        assert f['z'] - top >= 2.9, (f['id'], f['z'], top)
        min_gap = min(min_gap, f['z'] - top)
    REPORT.append(f'{len(fs)} feathers inside published tiles; min clearance above obstacles {min_gap:.1f} m')


def test_matches_rendered_heights():
    """The collision field (built from source geometry) agrees with the visible-surface height tiles of the artwork:
    every height texel is reconstructed to a world point; on roof / ground classes its z must equal solidTop, on tree
    pixels it must lie at or under the canopy top (side-on crown pixels sit below the crown's peak)."""
    from PIL import Image
    from world import canvas_to_world
    man = json.load(open(os.path.join(ROOT, 'web', 'public', 'data', 'manifest.json')))
    C = man['classes']
    groups = {'roof': [C['roof']], 'ground': [C[n] for n in ('lawn', 'park', 'pitch', 'road', 'major_road', 'paved', 'parking', 'path')],
              'tree': [C['tree']]}
    err = {k: [] for k in groups}
    for key, t in man['tiles'].items():
        H = np.asarray(Image.open(os.path.join(ROOT, 'web', 'public', 'data', 'heights', f'{key}.png')).convert('RGB')).astype(int)
        z = (H[..., 0] * 256 + H[..., 1]) / man['heights']['units_per_m'] + man['heights']['floor_m']
        cls = np.asarray(Image.open(os.path.join(ROOT, 'web', 'public', 'data', 'cls', f'{key}.png')).convert('RGB'))[::2, ::2, 0]
        v, u = np.mgrid[0:512, 0:512]
        P = canvas_to_world(t['i'] * 1024 + 2 * u + 1, t['j'] * 1024 + 2 * v + 1, z)    # height texel = 2x2 block centre
        solid = np.full(z.shape, np.nan); canopy = np.full(z.shape, np.nan)
        ix = np.floor(P[..., 0] / CHUNK).astype(int); iy = np.floor(P[..., 1] / CHUNK).astype(int)
        for cx_, cy_ in set(zip(ix.ravel().tolist(), iy.ravel().tolist())):
            if f'{cx_}_{cy_}' not in META['chunks']: continue
            m = (ix == cx_) & (iy == cy_)
            col = np.clip(((P[..., 0][m] - cx_ * CHUNK) / CELL).astype(int), 0, N - 1)
            row = np.clip((((cy_ + 1) * CHUNK - P[..., 1][m]) / CELL).astype(int), 0, N - 1)
            ch = chunk(cx_, cy_)
            solid[m] = ch['solid'][row, col]; canopy[m] = ch['canopy_top'][row, col]
        valid = (H[..., 2] > 127) & np.isfinite(solid)
        for g, ids in groups.items():
            m = valid & np.isin(cls, ids)
            err[g].append(((np.fmax(canopy, solid) if g == 'tree' else solid) - z)[m])
    out = {g: np.concatenate(e) for g, e in err.items()}
    frac = {g: float(np.mean(np.abs(e) < 0.5)) for g, e in out.items()}
    above = float(np.mean(out['tree'] > -0.5))
    assert frac['ground'] > 0.97 and frac['roof'] > 0.9 and above > 0.9, (frac, above)
    REPORT.append('rendered heights vs collision: ' + ', '.join(
        f'{g} {len(e)} px median {np.median(e):+.3f} m, {frac[g] * 100:.1f}% within 0.5 m' for g, e in out.items() if g != 'tree')
        + f'; tree {len(out["tree"])} px, {above * 100:.1f}% at/under canopy top (median gap {np.median(out["tree"]):+.2f} m)')


def test_codec_roundtrip():
    r = np.array([0, 39, 255], np.uint8); g = np.array([0, 16, 255], np.uint8)
    assert np.allclose(decode_z(r, g), [-100.0, (39 * 256 + 16) / 100 - 100, 555.35])


if __name__ == '__main__':
    tests = [v for k, v in sorted(globals().items()) if k.startswith('test_') and callable(v)]
    for t in tests:
        t(); print('PASS', t.__name__)
    print('\n'.join(REPORT))
