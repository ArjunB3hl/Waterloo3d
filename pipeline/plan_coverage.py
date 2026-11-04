"""Plan citywide tile coverage from the verified municipal boundary and define staged regions.

Writes web/public/data/coverage.json (city tiles + boundary in canvas px) and updates config/regions.json
(stage 1 campus2x2 kept; stage 2 park_uptown computed from landmark positions).
"""
import os, sys, json, pickle, math
import numpy as np
import shapely
from shapely.geometry import box
sys.path.insert(0, os.path.dirname(__file__))
from world import cfg, ROOT, world_to_canvas, F, lonlat_to_local
from build_scene import DEM

STAGE2_ANCHORS = [  # (label, lon, lat) - positions from OSM/Overture geometry used to bound the stage-2 region
    ('Student Life Centre', -80.5453, 43.4719), ('Engineering 7', -80.5396, 43.4729),
    ('Laurier Library', -80.5300, 43.4729), ('Laurier Arts', -80.5293, 43.4738),
    ('Waterloo Park (Silver Lake)', -80.5285, 43.4654), ('Perimeter Institute', -80.5277, 43.4654),
    ('Waterloo Public Square', -80.5226, 43.4644), ('Uptown King St N', -80.5222, 43.4670),
    ('Waterloo City Hall', -80.5209, 43.4637), ('Waterloo Public Library Main', -80.5247, 43.4659),
]


def main():
    S = pickle.load(open(os.path.join(ROOT, 'data_cache', 'scene', 'scene.pkl'), 'rb'))
    bnd = shapely.from_wkb(S['boundary_wkb'])
    D = DEM(); datum = cfg()['projection']['datum_m']
    rings_c = []; polys_c = []
    geoms = list(bnd.geoms) if hasattr(bnd, 'geoms') else [bnd]
    for g in geoms:
        ext = np.asarray(g.exterior.coords)[:, :2]
        z = D.sample(ext[:, 0], ext[:, 1]) - datum
        c, _ = world_to_canvas(np.c_[ext, z])
        rings_c.append(np.round(c, 1).tolist()); polys_c.append(shapely.Polygon(c))
    cb = shapely.unary_union(polys_c)
    x0, y0, x1, y1 = cb.bounds
    tiles = []
    for i in range(math.floor(x0 / F()), math.floor(x1 / F()) + 1):
        for j in range(math.floor(y0 / F()), math.floor(y1 / F()) + 1):
            if cb.intersects(box(i * F(), j * F(), (i + 1) * F(), (j + 1) * F())): tiles.append([i, j])
    cov = {'city_tiles': tiles, 'boundary_canvas': rings_c,
           'boundary_source': f"Overture divisions locality 'Waterloo' (CA-ON) {S['boundary_meta']['overture_id']} from OSM relation r2062154",
           'boundary_area_km2': round(bnd.area / 1e6, 3), 'tile_count': len(tiles)}
    os.makedirs(os.path.join(ROOT, 'web', 'public', 'data'), exist_ok=True)
    json.dump(cov, open(os.path.join(ROOT, 'web', 'public', 'data', 'coverage.json'), 'w'))
    # stage-2 region: tile rectangle around anchors, clipped to city tiles
    pts = []
    for _, lon, lat in STAGE2_ANCHORS:
        x, y = lonlat_to_local(lon, lat); z = float(D.sample(x, y)) - datum
        (cx, cy), _ = world_to_canvas([x, y, z]); pts.append((cx, cy))
    pts = np.array(pts)
    ia, ib = math.floor(pts[:, 0].min() / F()), math.floor(pts[:, 0].max() / F())
    ja, jb = math.floor(pts[:, 1].min() / F()), math.floor(pts[:, 1].max() / F())
    city = {tuple(t) for t in tiles}
    stage2 = [[i, j] for i in range(ia, ib + 1) for j in range(ja, jb + 1) if (i, j) in city]
    rp = os.path.join(ROOT, 'config', 'regions.json')
    regions = json.load(open(rp))
    regions['park_uptown'] = {'title': 'Campus to Waterloo Park, Silver Lake, Uptown Waterloo and Laurier (stage 2)', 'stage': 2, 'tiles': stage2,
                              'anchors': [a[0] for a in STAGE2_ANCHORS]}
    json.dump(regions, open(rp, 'w'), indent=1)
    print(f'city tiles: {len(tiles)}  boundary {cov["boundary_area_km2"]} km2  canvas bounds {[round(v) for v in cb.bounds]}')
    print(f'stage2: {len(stage2)} tiles  i {ia}..{ib}  j {ja}..{jb}')


if __name__ == '__main__':
    main()
