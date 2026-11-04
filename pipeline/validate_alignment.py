"""Milestone-1/4 validation: geographic grounding + reference/height alignment at known locations.

Checks (results -> docs/validation/alignment.json + .md, annotated image -> docs/validation/alignment_patch.png):
 1. Height codec round trip (encode->decode) across the full range.
 2. Landmark roofs: project the roof point of each landmark's tallest part (source footprint + height) into the canvas,
    read the PUBLISHED 512px height tile and class tile there, and compare with the source height.
 3. Road junctions: project transportation connectors shared by named roads; class must be road, height = terrain.
 4. Independent position check: Overture Places POI (non-OSM sources where available) vs OSM-derived footprint.
 5. Inverse projection: canvas pixel + decoded height -> lon/lat, distance to the source point.
"""
import os, sys, json, pickle, math, collections
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import pyarrow.parquet as pq
import shapely
sys.path.insert(0, os.path.dirname(__file__))
from world import cfg, ROOT, world_to_canvas, canvas_to_world, F, local_to_lonlat, lonlat_to_local
from classes import CLS

DATA = os.path.join(ROOT, 'web', 'public', 'data')
OUTD = os.path.join(ROOT, 'docs', 'validation')
INV = {v: k for k, v in CLS.items()}
LANDMARKS = ['Dana Porter Library', 'Student Life Centre', 'Engineering 5', 'Pearl Sullivan Engineering Building',
             'Centre for Environmental and Information Technology', 'Mathematics & Computer', 'Engineering 6']


def encode(z):
    h = cfg()['heights']; e = np.clip(np.floor((np.asarray(z) - h['floor_m']) * h['units_per_m'] + 0.5), 0, 65535).astype(int)
    return e // 256, e % 256


def decode(rgb):
    h = cfg()['heights']; rgb = np.asarray(rgb, float)
    return (rgb[..., 0] * 256 + rgb[..., 1]) / h['units_per_m'] + h['floor_m'], rgb[..., 2] > 127


class TileReader:
    def __init__(self): self.cache = {}
    def get(self, kind, i, j):
        k = (kind, i, j)
        if k not in self.cache:
            p = os.path.join(DATA, kind, f'{i}_{j}.png')
            self.cache[k] = np.asarray(Image.open(p).convert('RGB')) if os.path.exists(p) else None
        return self.cache[k]
    def sample(self, cx, cy):
        i, j = int(math.floor(cx / F())), int(math.floor(cy / F()))
        hp = cfg()['tiles']['height_px']; s = F() // hp
        H = self.get('heights', i, j); C = self.get('cls', i, j)
        if H is None: return None
        px, py = cx - i * F(), cy - j * F()
        z, ok = decode(H[int(py // s), int(px // s)])
        return {'tile': [i, j], 'z': float(z), 'valid': bool(ok), 'cls': INV.get(int(C[int(py), int(px), 0]), '?')}


def main():
    os.makedirs(OUTD, exist_ok=True)
    S = pickle.load(open(os.path.join(ROOT, 'data_cache', 'scene', 'scene.pkl'), 'rb'))
    tr = TileReader(); res = {'codec': {}, 'landmarks': [], 'junctions': [], 'poi_vs_footprint': [], 'inverse': []}
    # 1 codec
    zs = np.linspace(cfg()['heights']['floor_m'], 500, 200001)
    hi, lo = encode(zs); dz, _ = decode(np.stack([hi, lo, np.full_like(hi, 255)], -1))
    res['codec'] = {'max_abs_error_m': float(np.abs(dz - zs).max()), 'step_m': 1 / cfg()['heights']['units_per_m']}
    # 2 landmarks
    marks = []
    for b in S['buildings']:
        if b['name'] not in LANDMARKS: continue
        p = max(b['parts'], key=lambda q: (q['top'], shapely.Polygon(q['ring']).area))
        poly = shapely.Polygon(p['ring']).buffer(-1.0)
        if poly.is_empty: poly = shapely.Polygon(p['ring'])
        rp = poly.representative_point(); z = b['z0'] + p['top']
        (cx, cy), _ = world_to_canvas([rp.x, rp.y, z])
        s = tr.sample(cx, cy)
        lon, lat = local_to_lonlat(rp.x, rp.y)
        r = {'name': b['name'], 'osm': b['osm'], 'height_src': p['src'], 'source_lonlat': [round(lon, 6), round(lat, 6)],
             'expected_roof_z_m': round(z, 2), 'canvas_px': [round(cx, 1), round(cy, 1)], 'sample': s}
        if s:
            r['dz_m'] = round(s['z'] - z, 3); r['pass'] = abs(r['dz_m']) < 0.35 and s['cls'] == 'roof'
            # 5 inverse projection from the sampled height
            w = canvas_to_world(cx, cy, s['z']); ilon, ilat = local_to_lonlat(w[0], w[1])
            res['inverse'].append({'name': b['name'], 'horizontal_error_m': round(float(math.hypot(w[0] - rp.x, w[1] - rp.y)), 3)})
        res['landmarks'].append(r); marks.append((cx, cy, b['name'], r.get('pass')))
    # 3 junctions
    seg = pq.read_table(os.path.join(ROOT, 'data_cache', 'overture', 'segment.parquet'), columns=['names', 'class', 'connectors', 'subtype']).to_pylist()
    con = {r['id']: r for r in pq.read_table(os.path.join(ROOT, 'data_cache', 'overture', 'connector.parquet'), columns=['id', 'geometry']).to_pylist()}
    names_at = collections.defaultdict(set)
    for s_ in seg:
        if s_['subtype'] != 'road' or s_['class'] not in ('primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'service', 'living_street'): continue
        nm = (s_['names'] or {}).get('primary')
        if not nm: continue
        for c in s_['connectors'] or []: names_at[c['connector_id']].add(nm)
    dem = np.load(os.path.join(ROOT, 'data_cache', 'terrain', 'dem.npz'))
    from build_scene import DEM
    D = DEM(); datum = cfg()['projection']['datum_m']
    jl = []
    for cid, nms in names_at.items():
        if len(nms) < 2 or cid not in con: continue
        g = shapely.from_wkb(con[cid]['geometry']); x, y = lonlat_to_local(g.x, g.y)
        z = float(D.sample(x, y)) - datum
        (cx, cy), _ = world_to_canvas([x, y, z])
        s = tr.sample(cx, cy)
        if not s: continue
        r = {'junction': ' & '.join(sorted(nms)), 'lonlat': [round(g.x, 6), round(g.y, 6)], 'terrain_z_m': round(z, 2), 'canvas_px': [round(cx, 1), round(cy, 1)], 'sample': s,
             'dz_m': round(s['z'] - z, 2), 'pass': s['cls'] in ('road', 'major_road', 'rail') and abs(s['z'] - z) < 1.0}
        # a junction hidden behind a taller building in front of it (camera sees the roof/wall) is not testable here
        r['occluded'] = (not r['pass']) and s['cls'] in ('roof', 'wall', 'tree') and s['z'] - z > 2.0
        if not r['pass'] and not r['occluded']:
            # published heights are 512 px (one sample per 2x2 artwork px); check the full-resolution render height
            fh = os.path.join(ROOT, 'data_cache', 'jobs', f"{s['tile'][0]}_{s['tile'][1]}", 'height.png')
            if os.path.exists(fh):
                H1 = np.asarray(Image.open(fh).convert('RGB'))
                zf, _ = decode(H1[int(cy - s['tile'][1] * F()), int(cx - s['tile'][0] * F())])
                r['full_res_dz_m'] = round(float(zf) - z, 2)
                r['edge_of_height_block'] = abs(float(zf) - z) < 1.0
        jl.append(r)
    seen = set()
    for r in sorted(jl, key=lambda r: r['junction']):
        if r['junction'] in seen: continue
        seen.add(r['junction']); res['junctions'].append(r); marks.append((r['canvas_px'][0], r['canvas_px'][1], r['junction'], r['pass']))
    # 4 POI vs footprint
    bname = {b['name']: b for b in S['buildings'] if b['name']}
    pl = pq.read_table(os.path.join(ROOT, 'data_cache', 'overture', 'place.parquet'), columns=['names', 'geometry', 'sources']).to_pylist()
    for p in pl:
        nm = (p['names'] or {}).get('primary')
        if nm in LANDMARKS + ['Perimeter Institute for Theoretical Physics', 'Waterloo Public Library - Main', 'Laurier Library'] and nm in bname:
            g = shapely.from_wkb(p['geometry']); x, y = lonlat_to_local(g.x, g.y)
            foot = shapely.unary_union([shapely.Polygon(q['ring']) for q in bname[nm]['parts']])
            res['poi_vs_footprint'].append({'name': nm, 'poi_sources': sorted({s['dataset'] for s in p['sources']}),
                                            'poi_lonlat': [round(g.x, 6), round(g.y, 6)], 'distance_to_footprint_m': round(foot.distance(shapely.Point(x, y)), 1)})
    # keep the nearest POI per name, and record how many candidates existed
    best = {}
    for r in res['poi_vs_footprint']:
        n = r['name']; r['candidates'] = sum(1 for q in res['poi_vs_footprint'] if q['name'] == n)
        if n not in best or r['distance_to_footprint_m'] < best[n]['distance_to_footprint_m']: best[n] = r
    res['poi_vs_footprint'] = list(best.values())
    json.dump(res, open(os.path.join(OUTD, 'alignment.json'), 'w'), indent=1)
    # annotated patch image
    tiles = json.load(open(os.path.join(DATA, 'manifest.json')))['tiles']
    ii = [t['i'] for t in tiles.values()]; jj = [t['j'] for t in tiles.values()]
    i0, j0 = min(ii), min(jj); W = (max(ii) - i0 + 1) * F(); H = (max(jj) - j0 + 1) * F()
    im = Image.new('RGB', (W, H))
    for k, t in tiles.items(): im.paste(Image.open(os.path.join(DATA, 'tiles', '1024', f'{k}.webp')), ((t['i'] - i0) * F(), (t['j'] - j0) * F()))
    dr = ImageDraw.Draw(im)
    try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20)
    except Exception: font = ImageFont.load_default()
    for cx, cy, nm, ok in marks:
        x, y = cx - i0 * F(), cy - j0 * F()
        if not (0 <= x < W and 0 <= y < H): continue
        c = (40, 220, 90) if ok else (230, 40, 40)
        dr.ellipse([x - 9, y - 9, x + 9, y + 9], outline=c, width=4); dr.line([x - 14, y, x + 14, y], fill=c, width=2); dr.line([x, y - 14, x, y + 14], fill=c, width=2)
        dr.text((x + 14, y - 26), nm[:34], fill=(255, 255, 255), font=font, stroke_width=3, stroke_fill=(0, 0, 0))
    # crop to the checked points (+ margin) so the evidence image stays small as coverage grows
    lm = marks[:len(res['landmarks'])]   # frame the landmark checks; junctions outside that frame are listed in the report
    xs = [cx - i0 * F() for cx, _, _, _ in lm]; ys = [cy - j0 * F() for _, cy, _, _ in lm]
    box_ = (max(0, int(min(xs)) - 200), max(0, int(min(ys)) - 200), min(W, int(max(xs)) + 400), min(H, int(max(ys)) + 200))
    im = im.crop(box_); im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    im.save(os.path.join(OUTD, 'alignment_patch.png'), optimize=True)
    lm_ok = sum(1 for r in res['landmarks'] if r.get('pass')); j_ok = sum(1 for r in res['junctions'] if r['pass'])
    j_occ = sum(1 for r in res['junctions'] if r.get('occluded')); j_edge = sum(1 for r in res['junctions'] if r.get('edge_of_height_block'))
    j_fail = len(res['junctions']) - j_ok - j_occ - j_edge
    md = ['# Alignment validation', '', f"Codec max error: {res['codec']['max_abs_error_m']:.4f} m (step {res['codec']['step_m']} m).", '',
          f'## Landmark roofs ({lm_ok}/{len(res["landmarks"])} pass: |dz| < 0.35 m and class = roof)', '',
          '| Building | OSM | Height source | Source lon, lat | Expected roof z (m) | Decoded z (m) | dz (m) | Class | Pass |', '|---|---|---|---|---:|---:|---:|---|---|']
    for r in res['landmarks']:
        s = r['sample'] or {}
        md.append(f"| {r['name']} | {r['osm']} | {r['height_src']} | {r['source_lonlat'][0]}, {r['source_lonlat'][1]} | {r['expected_roof_z_m']} | {s.get('z', float('nan')):.2f} | {r.get('dz_m')} | {s.get('cls')} | {'yes' if r.get('pass') else 'NO'} |")
    md += ['', f'## Road junctions inside published tiles ({j_ok} pass, {j_occ} occluded by a building in front, {j_edge} at a roof edge of a 512 px height block (full-res render correct), {j_fail} fail; pass = class road/rail and |dz| < 1 m)', '',
           'Failures and occlusions are listed; passing junctions are in alignment.json.', '', '| Junction | lon, lat | Class | dz (m) | Result |', '|---|---|---|---:|---|']
    for r in res['junctions']:
        if r['pass']: continue
        md.append(f"| {r['junction']} | {r['lonlat'][0]}, {r['lonlat'][1]} | {r['sample']['cls']} | {r['dz_m']} | {'occluded' if r.get('occluded') else ('height-block edge (full-res dz %s m)' % r.get('full_res_dz_m') if r.get('edge_of_height_block') else 'FAIL')} |")
    md += ['', '## Independent POI vs footprint', '', '| Name | POI sources | POI lon, lat | Distance to footprint (m) | Same-name POIs |', '|---|---|---|---:|---:|']
    for r in res['poi_vs_footprint']:
        md.append(f"| {r['name']} | {', '.join(r['poi_sources'])} | {r['poi_lonlat'][0]}, {r['poi_lonlat'][1]} | {r['distance_to_footprint_m']} | {r['candidates']} |")
    md += ['', '## Inverse projection (canvas + decoded height -> ground position)', '', '| Name | Horizontal error (m) |', '|---|---:|']
    for r in res['inverse']: md.append(f"| {r['name']} | {r['horizontal_error_m']} |")
    md += ['', 'Annotated image: `alignment_patch.png` (green = pass, red = fail).']
    open(os.path.join(OUTD, 'alignment.md'), 'w').write('\n'.join(md) + '\n')
    print('\n'.join(md))


if __name__ == '__main__':
    main()
