"""Convert cached Overture + terrain data into a local-metre scene used by every render step.

Output: data_cache/scene/scene.pkl  (dict, see bottom) and data_cache/scene/scene_summary.json

Height provenance per building part (field `height_src`):
  osm_height      explicit OSM `height` (Overture source property without an ML marker)
  osm_levels      OSM building:levels * storey height (+ min_level offset)  -> APPROXIMATION
  ms_ml_height    Microsoft ML Buildings estimated height                     -> ESTIMATE
  class_default   no height data; default by building class                   -> APPROXIMATION
Base elevation (`z0`) = minimum terrain elevation sampled under the footprint (bare-earth DEM, ~20 m effective).
"""
import os, sys, json, pickle, math, collections
import numpy as np
import pyarrow.parquet as pq
import shapely
from shapely.geometry import Polygon, MultiPolygon, LineString, Point
from shapely.ops import transform as shp_transform
sys.path.insert(0, os.path.dirname(__file__))
from world import cfg, ROOT, transformer

CACHE = os.path.join(ROOT, 'data_cache')
OUT = os.path.join(CACHE, 'scene')

STOREY = {'house': 3.0, 'detached': 3.0, 'residential': 3.0, 'apartments': 3.0, 'dormitory': 3.2, 'semidetached_house': 3.0,
          'terrace': 3.0, 'garage': 3.0, 'garages': 3.0, 'shed': 2.6}
DEFAULT_STOREY = 3.6
CLASS_DEFAULT_H = {'house': 7.0, 'detached': 7.0, 'semidetached_house': 7.0, 'residential': 7.5, 'terrace': 7.5, 'garage': 3.0,
                   'garages': 3.0, 'shed': 2.6, 'apartments': 12.0, 'dormitory': 12.0, 'university': 12.0, 'school': 7.0,
                   'commercial': 7.0, 'retail': 6.0, 'industrial': 8.0, 'warehouse': 8.0, 'office': 10.0, 'church': 12.0,
                   'roof': 4.0, 'parking': 9.0, 'hospital': 15.0, 'civic': 9.0, 'library': 9.0, 'hotel': 15.0}
ROAD_W = {'motorway': 16, 'trunk': 14, 'primary': 14, 'secondary': 12, 'tertiary': 10, 'residential': 8, 'unclassified': 7,
          'living_street': 6, 'service': 4.5, 'pedestrian': 5, 'footway': 2.4, 'path': 2.2, 'cycleway': 2.4, 'steps': 2.4,
          'track': 3.0, 'bridleway': 2.0, 'unknown': 5}


class DEM:
    def __init__(self):
        d = np.load(os.path.join(CACHE, 'terrain', 'dem.npz'))
        self.z = d['z']; self.x0 = float(d['x0']); self.y0 = float(d['y0']); self.step = float(d['step'])

    def sample(self, x, y):
        x = np.asarray(x, float); y = np.asarray(y, float)
        fx = (x - self.x0) / self.step; fy = (y - self.y0) / self.step
        ix = np.clip(np.floor(fx).astype(int), 0, self.z.shape[1] - 2); iy = np.clip(np.floor(fy).astype(int), 0, self.z.shape[0] - 2)
        tx = np.clip(fx - ix, 0, 1); ty = np.clip(fy - iy, 0, 1)
        z = self.z
        return (z[iy, ix] * (1 - tx) * (1 - ty) + z[iy, ix + 1] * tx * (1 - ty) + z[iy + 1, ix] * (1 - tx) * ty + z[iy + 1, ix + 1] * tx * ty)


def to_local(g):
    t = transformer()
    return shp_transform(lambda x, y, z=None: t.transform(x, y), g)


def polys(g):
    if g is None or g.is_empty: return []
    if isinstance(g, Polygon): return [g]
    if isinstance(g, MultiPolygon): return list(g.geoms)
    if hasattr(g, 'geoms'):
        out = []
        for gg in g.geoms: out += polys(gg)
        return out
    return []


def ring(p):
    return np.round(np.asarray(p.exterior.coords)[:-1, :2], 2).astype(np.float32)


def height_of(r, cls):
    """Return (top_m, bottom_m, src)."""
    srcs = r.get('sources') or []
    # The height is an ML estimate when Microsoft ML supplied it ('/properties/height'), when the whole record comes from
    # Microsoft ML (property '' - the 3,151 ML-only footprints), or when no OpenStreetMap source exists at all.
    ml = any(s['dataset'] == 'Microsoft ML Buildings' and ((s['property'] or '') == '' or (s['property'] or '').startswith('/properties/height'))
             for s in srcs) or (bool(srcs) and not any(s['dataset'] == 'OpenStreetMap' for s in srcs))
    storey = STOREY.get(cls, DEFAULT_STOREY)
    bottom = 0.0
    if r.get('min_height') is not None: bottom = float(r['min_height'])
    elif r.get('min_floor') is not None: bottom = float(r['min_floor']) * storey
    if r.get('height') is not None and not ml:
        return float(r['height']), bottom, 'osm_height'
    if r.get('num_floors'):
        top = float(r['num_floors']) * storey + (1.0 if cls not in STOREY else 0.0)
        if r.get('min_floor') is not None and r.get('min_height') is None:
            top = max(top, bottom + storey)
        return top, bottom, 'osm_levels'
    if r.get('height') is not None and ml:
        return max(2.5, float(r['height'])), bottom, 'ms_ml_height'
    return CLASS_DEFAULT_H.get(cls, 6.0), bottom, 'class_default'


def level_spans(r, whole_level):
    """Overture linear referencing: bridges/tunnels are usually level_rules / road_flags with a `between` [a, b] range
    (fractions of the segment length). Returns [[a, b, level, tunnel], ...] covering [0, 1] when any part of the segment
    differs from (whole_level, not a tunnel); [] when the whole segment is uniform."""
    whole_tunnel = any('is_tunnel' in (f.get('values') or []) and f.get('between') is None for f in (r['road_flags'] or []))
    lv = [(lr['between'], lr.get('value') or 0) for lr in (r['level_rules'] or []) if lr.get('between')]
    tn = [f['between'] for f in (r['road_flags'] or []) if f.get('between') and 'is_tunnel' in (f.get('values') or [])]
    if not lv and not tn and not whole_tunnel: return []
    cuts = sorted({0.0, 1.0} | {min(1.0, max(0.0, float(v))) for (ab, _) in lv for v in ab} | {min(1.0, max(0.0, float(v))) for ab in tn for v in ab})
    spans = []
    for a, b in zip(cuts[:-1], cuts[1:]):
        if b - a <= 1e-9: continue
        m = (a + b) / 2
        level = next((v for (ab, v) in reversed(lv) if ab[0] <= m <= ab[1]), whole_level)
        tunnel = whole_tunnel or any(ab[0] <= m <= ab[1] for ab in tn)
        if spans and spans[-1][2] == level and spans[-1][3] == tunnel: spans[-1][1] = b
        else: spans.append([a, b, int(level), bool(tunnel)])
    return spans


def main():
    os.makedirs(OUT, exist_ok=True)
    dem = DEM(); datum = cfg()['projection']['datum_m']
    rd = lambda n, cols=None: pq.read_table(os.path.join(CACHE, 'overture', f'{n}.parquet'), columns=cols).to_pylist()

    # ---------------- buildings ----------------
    parts_by_b = collections.defaultdict(list)
    for r in rd('building_part'):
        parts_by_b[r['building_id']].append(r)
    buildings = []; hsrc = collections.Counter()
    for r in rd('building'):
        if r.get('is_underground'): continue
        g = to_local(shapely.from_wkb(r['geometry']))
        ps = polys(g)
        if not ps: continue
        cls = r['class'] or r['subtype'] or 'building'
        foot = shapely.unary_union(ps)
        cx, cy = foot.centroid.x, foot.centroid.y
        # base elevation: min of terrain at footprint vertices and centroid
        pts = np.vstack([ring(p) for p in ps] + [np.array([[cx, cy]])])
        z0 = float(dem.sample(pts[:, 0], pts[:, 1]).min()) - datum
        out_parts = []
        src_parts = parts_by_b.get(r['id']) if r.get('has_parts') else None
        if src_parts:
            # outline acts as footprint only; render the parts (OSM simple-3D convention)
            for pr in src_parts:
                if pr.get('is_underground'): continue
                pg = polys(to_local(shapely.from_wkb(pr['geometry'])))
                top, bot, src = height_of(pr, cls)
                for p in pg:
                    out_parts.append({'ring': ring(p), 'holes': [np.round(np.asarray(h.coords)[:-1, :2], 2).astype(np.float32) for h in p.interiors],
                                      'top': top, 'bottom': bot, 'src': src, 'roof_shape': pr.get('roof_shape'), 'roof_color': pr.get('roof_color')})
                    hsrc[src] += 1
            # outline not covered by parts -> render with outline height
            try:
                covered = shapely.unary_union([shapely.Polygon(pp['ring']) for pp in out_parts]).buffer(0.3)
                rest = foot.difference(covered)
                if rest.area > 15:
                    top, bot, src = height_of(r, cls)
                    for p in polys(rest):
                        if p.area < 6: continue
                        hsrc[src] += 1
                        out_parts.append({'ring': ring(p), 'holes': [], 'top': min(top, max(pp['top'] for pp in out_parts)), 'bottom': 0.0, 'src': src,
                                          'roof_shape': r.get('roof_shape'), 'roof_color': r.get('roof_color')})
            except Exception:
                pass
        if not out_parts:
            top, bot, src = height_of(r, cls)
            for p in ps:
                hsrc[src] += 1   # counted per emitted part, like the building-part branch
                out_parts.append({'ring': ring(p), 'holes': [np.round(np.asarray(h.coords)[:-1, :2], 2).astype(np.float32) for h in p.interiors],
                                  'top': top, 'bottom': bot, 'src': src, 'roof_shape': r.get('roof_shape'), 'roof_color': r.get('roof_color')})
        nm = (r['names'] or {}).get('primary')
        alt = [x['value'] for x in ((r['names'] or {}).get('rules') or []) if x.get('value')]
        buildings.append({'id': r['id'], 'name': nm, 'alt_names': alt, 'cls': cls, 'z0': z0, 'parts': out_parts,
                          'facade_color': r.get('facade_color'), 'facade_material': r.get('facade_material'),
                          'osm': next((s.get('record_id') for s in r['sources'] if s['dataset'] == 'OpenStreetMap'), None),
                          'datasets': sorted({s['dataset'] for s in r['sources']}),
                          'centroid': [round(cx, 2), round(cy, 2)], 'area': round(foot.area, 1)})

    # ---------------- transportation ----------------
    roads = []
    for r in rd('segment', ['id', 'subtype', 'class', 'names', 'width_rules', 'road_flags', 'level_rules', 'geometry', 'road_surface']):
        g = to_local(shapely.from_wkb(r['geometry']))
        if g.is_empty: continue
        cls = r['class'] or 'unknown'
        w = None
        if r['width_rules']:
            v = [x['value'] for x in r['width_rules'] if x.get('between') is None]
            if v: w = float(v[0])
        if r['subtype'] == 'rail':
            w = 3.2; kind = 'rail'
        else:
            kind = 'road'
            if w is None or w < 1.5: w = ROAD_W.get(cls, 5)
        flags = set()
        for f in (r['road_flags'] or []):
            for v in (f.get('values') or []): flags.add(v)
        level = 0
        for lr in (r['level_rules'] or []):
            if lr.get('between') is None: level = lr.get('value') or 0
        coords = np.asarray(g.coords)[:, :2].astype(np.float32)
        roads.append({'kind': kind, 'cls': cls, 'w': w, 'xy': coords, 'flags': sorted(flags), 'level': level,
                      'spans': level_spans(r, level), 'name': (r['names'] or {}).get('primary')})

    # ---------------- area layers ----------------
    areas = []  # (layer, class, polygon_local)
    def add_area(layer, cls, geom, name=None):
        for p in polys(to_local(shapely.from_wkb(geom))):
            if p.area > 2: areas.append({'layer': layer, 'cls': cls, 'ring': ring(p),
                                         'holes': [np.round(np.asarray(h.coords)[:-1, :2], 2).astype(np.float32) for h in p.interiors],
                                         'name': name})
    lines = []  # streams etc
    for r in rd('water', ['subtype', 'class', 'geometry', 'names', 'is_intermittent']):
        g = shapely.from_wkb(r['geometry'])
        if g.geom_type in ('LineString', 'MultiLineString'):
            gl = to_local(g)
            for ln in (gl.geoms if hasattr(gl, 'geoms') else [gl]):
                lines.append({'layer': 'water', 'cls': r['class'], 'xy': np.asarray(ln.coords)[:, :2].astype(np.float32),
                              'w': 6.0 if r['class'] == 'river' else 2.5, 'name': (r['names'] or {}).get('primary')})
        else:
            add_area('water', r['class'], r['geometry'], (r['names'] or {}).get('primary'))
    for r in rd('land_use', ['subtype', 'class', 'geometry', 'names']):
        if shapely.from_wkb(r['geometry']).geom_type in ('Polygon', 'MultiPolygon'):
            add_area('land_use', f"{r['subtype']}/{r['class']}", r['geometry'], (r['names'] or {}).get('primary'))
    trees = []
    for r in rd('land', ['subtype', 'class', 'geometry', 'names']):
        g = shapely.from_wkb(r['geometry'])
        if g.geom_type == 'Point':
            if r['subtype'] == 'tree':
                x, y = transformer().transform(g.x, g.y); trees.append((x, y, 'osm_tree'))
        elif g.geom_type in ('LineString',) and r['class'] == 'tree_row':
            gl = to_local(g)
            n = max(2, int(gl.length / 8))
            for k in range(n + 1):
                pt = gl.interpolate(k / n, normalized=True); trees.append((pt.x, pt.y, 'osm_tree_row_interp'))
        elif g.geom_type in ('Polygon', 'MultiPolygon'):
            add_area('land', f"{r['subtype']}/{r['class']}", r['geometry'], (r['names'] or {}).get('primary'))
    for r in rd('infrastructure', ['subtype', 'class', 'geometry', 'names']):
        g = shapely.from_wkb(r['geometry'])
        if g.geom_type in ('Polygon', 'MultiPolygon') and r['class'] in ('parking', 'platform', 'bridge', 'fountain', 'pier', 'boardwalk'):
            add_area('infrastructure', r['class'], r['geometry'], (r['names'] or {}).get('primary'))

    # ---------------- places / division ----------------
    places = []
    for r in rd('place', ['id', 'names', 'geometry', 'basic_category', 'confidence', 'taxonomy']):
        g = shapely.from_wkb(r['geometry']); x, y = transformer().transform(g.x, g.y)
        places.append({'id': r['id'], 'name': (r['names'] or {}).get('primary'), 'cat': r['basic_category'], 'conf': r['confidence'], 'xy': (round(x, 2), round(y, 2))})
    boundary = None
    for r in rd('division_area'):
        if r['subtype'] == 'locality' and (r['names'] or {}).get('primary') == 'Waterloo' and r['region'] == 'CA-ON':
            boundary = to_local(shapely.from_wkb(r['geometry']))
            boundary_meta = {'overture_id': r['id'], 'division_id': r['division_id'], 'sources': [s['dataset'] + ':' + str(s.get('record_id')) for s in r['sources']]}

    scene = {'buildings': buildings, 'roads': roads, 'areas': areas, 'lines': lines, 'trees': np.array([(t[0], t[1]) for t in trees], np.float32),
             'tree_src': [t[2] for t in trees], 'places': places, 'boundary_wkb': shapely.to_wkb(boundary), 'boundary_meta': boundary_meta}
    pickle.dump(scene, open(os.path.join(OUT, 'scene.pkl'), 'wb'), protocol=5)
    summ = {'buildings': len(buildings), 'building_parts_by_height_src': dict(hsrc), 'roads': len(roads), 'areas': len(areas), 'water_lines': len(lines),
            'trees': len(trees), 'places': len(places), 'boundary_area_km2': round(boundary.area / 1e6, 3), 'boundary': boundary_meta,
            'boundary_bounds_local_m': [round(v, 1) for v in boundary.bounds]}
    json.dump(summ, open(os.path.join(OUT, 'scene_summary.json'), 'w'), indent=2)
    print(json.dumps(summ, indent=2))


if __name__ == '__main__':
    main()
