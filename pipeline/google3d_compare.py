"""Compare OSM-derived reference geometry with Google Photorealistic 3D Tiles views (OPTIONAL; needs google3d_render output).

1. Vertical datum: estimates the geoid undulation used to convert Google ellipsoidal heights to the map datum, from the
   median difference on open paved/road/parking pixels (ground that trees and cars rarely cover).
2. Building heights: for every building part whose roof point is visible in a compared tile, compares the OSM-derived roof
   height with the Google surface height at that pixel, grouped by height provenance (osm_height, osm_levels,
   ms_ml_height, class_default) - this measures how good the approximations are.
3. Horizontal alignment: phase correlation between the reference and Google views (edges).
Outputs: data_cache/google3d/compare.json and docs/validation/google3d_compare.md (aggregate statistics only; no Google
imagery is written outside data_cache/). Usage: python3 pipeline/google3d_compare.py 0,0 -1,0 ... [--undulation=-35.5]
"""
import os, sys, json, pickle, math, collections, argparse
import numpy as np
from PIL import Image
import shapely
sys.path.insert(0, os.path.dirname(__file__))
from world import cfg, ROOT, world_to_canvas, F
from classes import CLS

G = os.path.join(ROOT, 'data_cache', 'google3d')
GROUND = [CLS[c] for c in ('road', 'major_road', 'parking', 'paved')]


def dec(path):
    h = np.asarray(Image.open(path).convert('RGB')).astype(np.float64)
    z = (h[..., 0] * 256 + h[..., 1]) / cfg()['heights']['units_per_m'] + cfg()['heights']['floor_m']
    z[h[..., 2] <= 127] = np.nan
    return z


def phase_shift(a, b):
    def edges(im):
        g = np.asarray(Image.fromarray(im).convert('L'), float)
        gx = np.abs(np.diff(g, axis=1, prepend=g[:, :1])); gy = np.abs(np.diff(g, axis=0, prepend=g[:1]))
        e = gx + gy; return (e - e.mean()) / (e.std() + 1e-6)
    A = np.fft.fft2(edges(a)); B = np.fft.fft2(edges(b))
    R = A * np.conj(B); R /= np.abs(R) + 1e-9
    r = np.fft.ifft2(R).real; y, x = np.unravel_index(np.argmax(r), r.shape)
    if y > r.shape[0] // 2: y -= r.shape[0]
    if x > r.shape[1] // 2: x -= r.shape[1]
    return int(x), int(y), float(r.max())


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('tiles', nargs='+'); ap.add_argument('--undulation', type=float, default=-35.5)
    a = ap.parse_args()
    tiles = [t.replace(',', '_') for t in a.tiles]
    S = pickle.load(open(os.path.join(ROOT, 'data_cache', 'scene', 'scene.pkl'), 'rb'))
    res = {'undulation_assumed_m': a.undulation, 'tiles': {}}
    diffs_ground = []
    views = {}
    for t in tiles:
        zr = dec(os.path.join(ROOT, 'data_cache', 'jobs', t, 'height.png'))
        zg = dec(os.path.join(G, 'views', f'{t}_height.png'))
        cls = np.asarray(Image.open(os.path.join(ROOT, 'data_cache', 'jobs', t, 'cls.png')))[..., 0]
        m = np.isin(cls, GROUND) & np.isfinite(zr) & np.isfinite(zg)
        d = (zg - zr)[m]
        diffs_ground.append(d)
        ref = np.asarray(Image.open(os.path.join(ROOT, 'data_cache', 'jobs', t, 'color2x.png')).convert('RGB').resize((F(), F()), Image.BOX))
        gv = np.asarray(Image.open(os.path.join(G, 'views', f'{t}_color.png')).convert('RGB'))
        sx, sy, peak = phase_shift(ref, gv)
        res['tiles'][t] = {'ground_px': int(m.sum()), 'ground_median_dz_m': float(np.median(d)) if d.size else None, 'shift_px': [sx, sy], 'phase_peak': round(peak, 4)}
        views[t] = zg
    allg = np.concatenate(diffs_ground) if diffs_ground else np.array([])
    corr = float(np.median(allg)) if allg.size else 0.0
    res['ground_median_dz_m'] = corr
    res['undulation_estimated_m'] = round(a.undulation + corr, 3)
    res['ground_mad_m'] = float(np.median(np.abs(allg - corr))) if allg.size else None
    # building roofs
    byk = collections.defaultdict(list)
    for b in S['buildings']:
        for p in b['parts']:
            poly = shapely.Polygon(p['ring']).buffer(-1.0)
            if poly.is_empty or poly.area < 20: continue
            rp = poly.representative_point(); z = b['z0'] + p['top']
            (cx, cy), _ = world_to_canvas([rp.x, rp.y, z])
            i, j = int(cx // F()), int(cy // F()); k = f'{i}_{j}'
            if k not in views: continue
            zg = views[k][int(cy - j * F()), int(cx - i * F())] - corr
            if not np.isfinite(zg): continue
            byk[p['src']].append({'name': b['name'], 'osm': b['osm'], 'cls': b['cls'], 'expected': z, 'google': float(zg), 'dz': float(zg - z)})
    summ = {}
    for src, rows in byk.items():
        dz = np.array([r['dz'] for r in rows])
        summ[src] = {'n': len(rows), 'median_dz_m': round(float(np.median(dz)), 2), 'mad_m': round(float(np.median(np.abs(dz - np.median(dz)))), 2),
                     'p90_abs_m': round(float(np.percentile(np.abs(dz), 90)), 2)}
    res['roof_height_check'] = summ
    res['named_buildings'] = sorted([r for rows in byk.values() for r in rows if r['name']], key=lambda r: -abs(r['dz']))[:40]
    json.dump(res, open(os.path.join(G, 'compare.json'), 'w'), indent=1)
    md = ['# Comparison with Google Photorealistic 3D Tiles', '',
          'Aggregate statistics only. Google imagery and meshes stay in `data_cache/google3d/` (comparison use; see DATA_SOURCES.md).', '',
          f"Tiles compared: {', '.join(tiles)}", '',
          f"Vertical datum: assumed undulation {a.undulation} m, ground median difference {corr:+.2f} m over {allg.size} paved/road px "
          f"(MAD {res['ground_mad_m']:.2f} m) -> estimated undulation **{res['undulation_estimated_m']} m**.", '',
          '| Tile | Ground px | Median dz (m) | Image shift ref->Google (px) | Phase peak |', '|---|---:|---:|---|---:|']
    for t, v in res['tiles'].items():
        md.append(f"| {t} | {v['ground_px']} | {v['ground_median_dz_m']:+.2f} | {v['shift_px']} | {v['phase_peak']} |")
    md += ['', '## Roof heights: OSM-derived vs Google surface (after datum correction)', '', '| Height source | n | Median dz (m) | MAD (m) | P90 abs (m) |', '|---|---:|---:|---:|---:|']
    for src, v in sorted(summ.items()):
        md.append(f"| {src} | {v['n']} | {v['median_dz_m']:+.2f} | {v['mad_m']} | {v['p90_abs_m']} |")
    md += ['', 'Positive dz = Google surface higher than the OSM-derived roof (e.g. underestimated height, rooftop equipment, or trees over the roof point).',
           '', '## Largest differences at named buildings', '', '| Building | OSM | Expected roof z | Google z | dz |', '|---|---|---:|---:|---:|']
    for r in res['named_buildings'][:20]:
        md.append(f"| {r['name']} | {r['osm']} | {r['expected']:.1f} | {r['google']:.1f} | {r['dz']:+.1f} |")
    os.makedirs(os.path.join(ROOT, 'docs', 'validation'), exist_ok=True)
    open(os.path.join(ROOT, 'docs', 'validation', 'google3d_compare.md'), 'w').write('\n'.join(md) + '\n')
    print('\n'.join(md))


if __name__ == '__main__':
    main()
