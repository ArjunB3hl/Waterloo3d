"""Prepare per-tile render jobs: visible world region, scene subset, top-down ground colour + class textures.

Usage: python3 pipeline/prepare_tiles.py --region campus2x2      (named region from config/regions.json)
       python3 pipeline/prepare_tiles.py --tiles 0,0 -1,0
Outputs data_cache/jobs/<i>_<j>/{job.json, ground.png, groundcls.png}
"""
import os, sys, json, math, pickle, argparse, hashlib
import numpy as np
from PIL import Image, ImageDraw
import shapely
from shapely.geometry import box, Polygon
from shapely.strtree import STRtree
from shapely.ops import substring
sys.path.insert(0, os.path.dirname(__file__))
from world import cfg, ROOT, canvas_to_world, world_to_canvas, F, mpp, camera_record
from classes import CLS, GROUND_COLORS, area_class, road_style

CACHE = os.path.join(ROOT, 'data_cache')
RES = 0.25  # metres per ground-texture pixel


def load_scene():
    S = pickle.load(open(os.path.join(CACHE, 'scene', 'scene.pkl'), 'rb'))
    return S


def tile_region(i, j, zmin, zmax, margin=25.0):
    pts = []
    for cx in (i * F(), (i + 1) * F()):
        for cy in (j * F(), (j + 1) * F()):
            for z in (zmin, zmax):
                pts.append(canvas_to_world(cx, cy, z)[:2])
    pts = np.array(pts)
    return (pts[:, 0].min() - margin, pts[:, 1].min() - margin, pts[:, 0].max() + margin, pts[:, 1].max() + margin)


def hash01(*v):
    h = hashlib.md5(('%.2f,' * len(v) % v).encode()).digest()
    return int.from_bytes(h[:4], 'little') / 2 ** 32


class Indexes:
    def __init__(self, S):
        self.S = S
        self.bpolys = [shapely.box(*np.r_[np.min(np.vstack([p['ring'] for p in b['parts']]), 0), np.max(np.vstack([p['ring'] for p in b['parts']]), 0)]) for b in S['buildings']]
        self.btree = STRtree(self.bpolys)
        self.apolys = [shapely.box(*np.r_[a['ring'].min(0), a['ring'].max(0)]) for a in S['areas']]
        self.atree = STRtree(self.apolys)
        self.rlines = [shapely.box(*np.r_[r['xy'].min(0), r['xy'].max(0)]) for r in S['roads']]
        self.rtree = STRtree(self.rlines)
        self.llines = [shapely.box(*np.r_[r['xy'].min(0), r['xy'].max(0)]) for r in S['lines']]
        self.ltree = STRtree(self.llines) if self.llines else None


def dem_crop(bb):
    d = np.load(os.path.join(CACHE, 'terrain', 'dem.npz'))
    z, x0, y0, st = d['z'], float(d['x0']), float(d['y0']), float(d['step'])
    ix0 = max(0, int((bb[0] - x0) / st) - 1); ix1 = min(z.shape[1] - 1, int((bb[2] - x0) / st) + 2)
    iy0 = max(0, int((bb[1] - y0) / st) - 1); iy1 = min(z.shape[0] - 1, int((bb[3] - y0) / st) + 2)
    return z[iy0:iy1 + 1, ix0:ix1 + 1], x0 + ix0 * st, y0 + iy0 * st, st


def texel_bbox(bb):
    """Grow bb (local metres) to whole ground texels, keeping its north-west corner: the texture then spans exactly the
    bbox the renderer maps its UVs over (renderer.js buildTerrain: uv = (x - gx0) / (gx1 - gx0))."""
    W = int(math.ceil((bb[2] - bb[0]) / RES - 1e-9)); H = int(math.ceil((bb[3] - bb[1]) / RES - 1e-9))
    return (bb[0], bb[3] - H * RES, bb[0] + W * RES, bb[3])


def road_pieces(r):
    """[(xy, level)] drawable pieces of a road: split at its linear-referenced level / tunnel spans (build_scene
    level_spans). Tunnels are dropped; roads below ground level are dropped, rail below ground is kept (open cuts)."""
    spans = r.get('spans') or [[0.0, 1.0, r['level'], False]]
    whole = len(spans) == 1 and spans[0][0] <= 0 and spans[0][1] >= 1
    line = None if whole else shapely.LineString(r['xy'])
    out = []
    for a, b, level, tunnel in spans:
        if tunnel or (level < 0 and r['kind'] != 'rail'): continue
        if whole: out.append((r['xy'], level)); continue
        g = substring(line, a, b, normalized=True)
        if g.geom_type != 'LineString' or g.length <= 0: continue
        out.append((np.asarray(g.coords)[:, :2], level))
    return out


def draw_ground(S, idx, bb, footprints):
    """Rasterize top-down ground colour + class textures for region bb (local metres, texel aligned - see texel_bbox).

    Texel (p, q) covers x in [bb0 + p RES, +RES), y in (bb3 - (q + 1) RES, bb3 - q RES]. PIL puts integer coordinates at
    pixel centres, so world coordinates map to (x - bb0) / RES - 0.5."""
    W = int(round((bb[2] - bb[0]) / RES)); H = int(round((bb[3] - bb[1]) / RES))
    col = Image.new('RGB', (W, H), GROUND_COLORS['lawn']); cls = Image.new('L', (W, H), CLS['lawn'])
    dc = ImageDraw.Draw(col); dk = ImageDraw.Draw(cls)
    tf = lambda xy: [((x - bb[0]) / RES - 0.5, (bb[3] - y) / RES - 0.5) for x, y in xy]
    q = box(*bb)
    # areas, drawn by priority
    ais = [k for k in idx.atree.query(q)]
    items = []
    for k in ais:
        a = S['areas'][k]
        c = area_class(a['layer'], a['cls'])
        if c: items.append((c[2], k, c))
    for _, k, (gname, cid, _) in sorted(items):
        a = S['areas'][k]
        if not a['holes']:
            dc.polygon(tf(a['ring']), fill=GROUND_COLORS[gname]); dk.polygon(tf(a['ring']), fill=cid)
            continue
        # holes mean "this area is absent here": composite through a mask so whatever was drawn beneath shows through
        pr = tf(a['ring'])
        x0 = max(0, int(math.floor(min(p[0] for p in pr))) - 1); y0 = max(0, int(math.floor(min(p[1] for p in pr))) - 1)
        x1 = min(W, int(math.ceil(max(p[0] for p in pr))) + 2); y1 = min(H, int(math.ceil(max(p[1] for p in pr))) + 2)
        if x1 <= x0 or y1 <= y0: continue
        m = Image.new('L', (x1 - x0, y1 - y0), 0); dm = ImageDraw.Draw(m)
        sh = lambda pts: [(x - x0, y - y0) for x, y in pts]
        dm.polygon(sh(pr), fill=255)
        for h in a['holes']: dm.polygon(sh(tf(h)), fill=0)
        col.paste(GROUND_COLORS[gname], (x0, y0, x1, y1), m); cls.paste(cid, (x0, y0, x1, y1), m)
    # water lines (streams)
    if idx.ltree is not None:
        for k in idx.ltree.query(q):
            l = S['lines'][k]
            w = max(1, int(l['w'] / RES))
            dc.line(tf(l['xy']), fill=GROUND_COLORS['water'], width=w, joint='curve'); dk.line(tf(l['xy']), fill=CLS['water'], width=w, joint='curve')
    # roads, one level at a time from the lowest up (bridges over what they cross); within a level casing pass then
    # fill pass, by class order so big roads are on top
    pieces = []
    for k in idx.rtree.query(q):
        r = S['roads'][k]; st = road_style(r)
        if not st: continue
        for xy, level in road_pieces(r): pieces.append((level, st['z'], st, r, xy))
    pieces.sort(key=lambda t: (t[0], t[1]))
    for level in sorted({p[0] for p in pieces}):
        grp = [p for p in pieces if p[0] == level]
        for _, _, s, r, xy in grp:
            if s.get('casing'):
                w = max(1, int((r['w'] + 1.2) / RES))
                dc.line(tf(xy), fill=s['casing'], width=w, joint='curve')
        for _, _, s, r, xy in grp:
            w = max(1, int(r['w'] / RES))
            dc.line(tf(xy), fill=GROUND_COLORS[s['ground']], width=w, joint='curve')
            dk.line(tf(xy), fill=CLS[s['ground']], width=w, joint='curve')
            for x, y in xy[[0, -1]] if s['ground'] in ('road', 'major_road') else []:
                rr = r['w'] / 2 / RES; px, py = tf([(x, y)])[0]
                dc.ellipse([px - rr, py - rr, px + rr, py + rr], fill=GROUND_COLORS[s['ground']]); dk.ellipse([px - rr, py - rr, px + rr, py + rr], fill=CLS[s['ground']])
        # centre line markings on major roads (dashed)
        for _, _, s, r, xy in grp:
            if s['ground'] == 'major_road' and r['w'] >= 9:
                ln = shapely.LineString(xy)
                n = int(ln.length / 3)
                for k in range(0, n, 2):
                    a_ = ln.interpolate(k * 3); b_ = ln.interpolate(min(ln.length, k * 3 + 1.8))
                    dc.line(tf([(a_.x, a_.y), (b_.x, b_.y)]), fill=(236, 226, 196), width=max(1, int(0.25 / RES)))
    # building footprints on ground class map (so wall bases do not show lawn) - drawn as pavement apron
    for ring_ in footprints:
        dk.polygon(tf(ring_), fill=CLS['paved'])
    return col, cls


def scatter_trees(S, idx, bb, footprints_union):
    """OSM trees + inferred trees in wooded / park / residential areas. Returns list of [x, y, radius, src]."""
    out = []
    pts = S['trees']
    m = (pts[:, 0] > bb[0]) & (pts[:, 0] < bb[2]) & (pts[:, 1] > bb[1]) & (pts[:, 1] < bb[3])
    for (x, y), src in zip(pts[m], np.array(S['tree_src'])[m]):
        out.append([float(x), float(y), 2.6 + 2.0 * hash01(x, y), 'osm'])
    q = box(*bb)
    dens = {'forest': 1 / 30.0, 'wood': 1 / 30.0, 'scrub': 1 / 120.0, 'park': 1 / 700.0, 'residential': 1 / 450.0, 'wetland': 1 / 300.0}
    road_buf = []
    for k in idx.rtree.query(q):
        r = S['roads'][k]
        if (r['kind'] == 'road' and r['cls'] not in ('footway', 'path', 'cycleway', 'steps')) or r['kind'] == 'rail':
            road_buf.append(shapely.LineString(r['xy']).buffer(r['w'] / 2 + 1.5))
    # surfaces drawn on top of parks / woods where no tree can stand: water, pools, pitches, tracks, parking, plazas,
    # platforms (separate polygons over the park) and streams
    excl = []
    for k in idx.atree.query(q):
        a = S['areas'][k]; c = area_class(a['layer'], a['cls'])
        if c and (c[0] in ('water', 'pool', 'pitch', 'track', 'parking') or a['cls'].split('/')[-1] in ('plaza', 'pedestrian', 'platform')):
            pg = shapely.Polygon(a['ring'], a['holes'])
            if pg.is_valid and not pg.is_empty: excl.append(pg)
    if idx.ltree is not None:
        for k in idx.ltree.query(q):
            l = S['lines'][k]
            if len(l['xy']) >= 2: excl.append(shapely.LineString(l['xy']).buffer(l['w'] / 2 + 1.0))
    excl_union = shapely.unary_union(excl) if excl else None
    if excl_union is not None: shapely.prepare(excl_union)
    for k in idx.atree.query(q):
        a = S['areas'][k]
        c = a['cls'].split('/')[-1]
        if a['layer'] == 'water': continue
        d = dens.get(c)
        if not d: continue
        poly = shapely.Polygon(a['ring'], a['holes']).intersection(q)
        if poly.is_empty: continue
        n = int(poly.area * d)
        if n == 0: continue
        minx, miny, maxx, maxy = poly.bounds
        # deterministic jittered grid
        stp = math.sqrt(1 / d)
        gx = np.arange(math.floor(minx / stp) * stp, maxx, stp); gy = np.arange(math.floor(miny / stp) * stp, maxy, stp)
        cand = []
        for x in gx:
            for y in gy:
                jx = x + stp * hash01(x, y, 1); jy = y + stp * hash01(x, y, 2)
                cand.append((jx, jy))
        if not cand: continue
        P = shapely.points(np.array(cand))
        ok = shapely.contains(poly, P)
        if footprints_union is not None: ok &= ~shapely.intersects(footprints_union, shapely.buffer(P, 3.0))
        for rb in road_buf:
            if not ok.any(): break
            ok &= ~shapely.intersects(rb, P)
        if excl_union is not None and ok.any(): ok &= ~shapely.intersects(excl_union, P)
        for (x, y), o in zip(cand, ok):
            if o: out.append([float(x), float(y), 2.4 + 2.4 * hash01(x, y, 3), 'inferred_' + c])
    return out


HOUSE = {'house', 'detached', 'semidetached_house', 'residential', 'terrace', 'garage', 'garages', 'shed', 'bungalow', 'cabin', 'farm', 'barn'}


def roof_spec(cls, part):
    """Attach a pitched-roof spec. Explicit OSM roof:shape wins; small near-rectangular houses get an INFERRED gable."""
    shape = part.get('roof_shape')
    poly = shapely.Polygon(part['ring'])
    if not poly.is_valid or poly.area < 12: return part
    inferred = False
    if shape in (None, 'flat') and cls in HOUSE and poly.area < 400 and not part['holes'] and part['bottom'] == 0:
        shape = 'gabled'; inferred = True
    if shape not in ('gabled', 'hipped', 'pyramidal', 'half-hipped', 'gambrel', 'saltbox'):
        return part
    rect = poly.minimum_rotated_rectangle
    if poly.area / max(rect.area, 1e-6) < 0.82: return part
    c = np.asarray(rect.exterior.coords)[:4]
    e0 = np.linalg.norm(c[1] - c[0]); e1 = np.linalg.norm(c[2] - c[1])
    if e1 > e0: c = np.roll(c, -1, axis=0); e0, e1 = e1, e0   # c[0]->c[1] is the long side
    rise = min(0.5 * e1 * 0.75, max(1.2, part['top'] - part['bottom'] - 2.4))
    part = dict(part)
    part['ring'] = np.round(c, 2).tolist(); part['holes'] = []
    part['roof'] = {'type': 'hipped' if shape in ('hipped', 'pyramidal') else 'gabled', 'rise': round(float(rise), 2), 'inferred': inferred}
    return part


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--region'); ap.add_argument('--tiles', nargs='*', default=[]); ap.add_argument('--force', action='store_true')
    a = ap.parse_args()
    tiles = [tuple(map(int, t.split(','))) for t in a.tiles]
    if a.region:
        regions = json.load(open(os.path.join(ROOT, 'config', 'regions.json')))
        tiles += [tuple(t) for t in regions[a.region]['tiles']]
    S = load_scene(); idx = Indexes(S)
    for (i, j) in tiles:
        od = os.path.join(CACHE, 'jobs', f'{i}_{j}')
        if os.path.exists(os.path.join(od, 'job.json')) and not a.force:
            print('skip', i, j); continue
        os.makedirs(od, exist_ok=True)
        # terrain range in tile ground region
        bb0 = tile_region(i, j, -40, 90, 0)
        dz, _, _, _ = dem_crop(bb0)
        datum = cfg()['projection']['datum_m']
        tmin, tmax = float(dz.min() - datum), float(dz.max() - datum)
        gbb = texel_bbox(tile_region(i, j, tmin - 4, tmax + 4, 30))   # ground texture region (whole texels)
        bbb = tile_region(i, j, tmin - 4, tmax + 130, 130)       # buildings / shadow casters
        q = box(*bbb)
        bsel = [k for k in idx.btree.query(q)]
        blds = []
        for k in bsel:
            b = S['buildings'][k]
            blds.append({'id': b['id'], 'name': b['name'], 'cls': b['cls'], 'z0': b['z0'], 'facade_color': b['facade_color'],
                         'facade_material': b['facade_material'],
                         'parts': [roof_spec(b['cls'], {'ring': p['ring'].tolist(), 'holes': [h.tolist() for h in p['holes']], 'top': p['top'], 'bottom': p['bottom'],
                                    'src': p['src'], 'roof_shape': p['roof_shape'], 'roof_color': p['roof_color']}) for p in b['parts']]})
        fps = [np.array(p['ring']) for b in blds for p in b['parts']]
        fu = shapely.unary_union([shapely.Polygon(f) for f in fps if len(f) >= 3]) if fps else None
        col, cls = draw_ground(S, idx, gbb, fps)
        col.save(os.path.join(od, 'ground.png')); cls.save(os.path.join(od, 'groundcls.png'))
        trees = scatter_trees(S, idx, bbb, fu)
        dzb, dx0, dy0, dst = dem_crop(bbb)
        job = {'tile': [i, j], 'camera': camera_record(), 'frame_px': F(), 'heights': cfg()['heights'],
               'ground_bbox': list(gbb), 'region_bbox': list(bbb), 'datum_m': datum,
               'dem': {'x0': dx0, 'y0': dy0, 'step': dst, 'w': int(dzb.shape[1]), 'h': int(dzb.shape[0]), 'z': np.round(dzb - datum, 2).ravel().tolist()},
               'buildings': blds, 'trees': trees, 'classes': CLS}
        json.dump(job, open(os.path.join(od, 'job.json'), 'w'))
        print(f'tile {i},{j}: {len(blds)} buildings, {len(trees)} trees, ground {col.size}', flush=True)


if __name__ == '__main__':
    main()
