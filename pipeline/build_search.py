"""Build web/public/data/search.json: one entry per unique street / trail / place name inside the City of Waterloo,
plus one entry per labelled building from web/public/data/labels.json (run pipeline/build_labels.py first).

Each entry carries a representative canvas point (where the camera jumps) and the tile key containing it.
Point choice: if any part of the feature lies inside a published tile, the point is picked among those vertices,
so a search jumps to artwork rather than to the pending area; otherwise among all of its in-city vertices.
Whether an entry is covered or pending is decided by the viewer at runtime against manifest.json (so this file
does not go stale when tiles are published), but re-running after publishing improves the chosen points.

Usage: python pipeline/build_search.py      (needs data_cache/scene/scene.pkl and data_cache/terrain/dem.npz)
"""
import os, sys, json, pickle, math, time
import numpy as np
import shapely
sys.path.insert(0, os.path.dirname(__file__))
from world import cfg, ROOT, world_to_canvas, F
from build_scene import DEM

# Overture road classes grouped into the kinds shown next to search results.
TRAIL_CLASSES = {'footway', 'path', 'cycleway', 'track', 'steps', 'bridleway', 'pedestrian'}
# Named areas worth finding by name (parks, schools, water...). Parking lots, retail, residential blocks etc. are noise.
PLACE_PREFIXES = ('park/', 'education/', 'cemetery/', 'golf/', 'protected/nature_reserve', 'horticulture/garden',
                  'recreation/', 'campground/', 'pedestrian/', 'medical/hospital')
WATER_CLASSES = {'lake', 'pond', 'river', 'basin', 'reservoir', 'water', 'stream'}
DENSIFY_M = 25.0  # resample long road segments so the representative point is not limited to sparse vertices


def densify(xy):
    out = [xy[:1]]
    for a, b in zip(xy[:-1], xy[1:]):
        n = max(1, int(math.ceil(np.hypot(*(b - a)) / DENSIFY_M)))
        t = np.arange(1, n + 1)[:, None] / n
        out.append(a + (b - a) * t)
    return np.concatenate(out)


def road_kind(r):
    if r['kind'] == 'rail': return 'rail'
    return 'trail' if r['cls'] in TRAIL_CLASSES else 'street'


def place_kind(a):
    c = a['cls']
    if a['layer'] == 'water' and c.split('/')[-1] in WATER_CLASSES: return 'water'
    if a['layer'] == 'land_use' and c.startswith(PLACE_PREFIXES): return 'place'
    return None


def main():
    S = pickle.load(open(os.path.join(ROOT, 'data_cache', 'scene', 'scene.pkl'), 'rb'))
    city = shapely.from_wkb(S['boundary_wkb']).buffer(30.0)
    shapely.prepare(city)
    D = DEM(); datum = cfg()['projection']['datum_m']
    published = set(json.load(open(os.path.join(ROOT, 'web', 'public', 'data', 'manifest.json')))['tiles'])

    groups = {}  # name -> {'kind': str, 'pts': [Nx2 local metres]}
    for r in S['roads']:
        name = (r.get('name') or '').strip()
        if name and len(r['xy']) >= 2:
            g = groups.setdefault(name, {'kind': road_kind(r), 'pts': []})
            if g['kind'] == 'trail' and road_kind(r) == 'street': g['kind'] = 'street'  # a name that is also a street is a street
            g['pts'].append(densify(np.asarray(r['xy'], float)))
    for a in S['areas']:
        name = (a.get('name') or '').strip(); kind = place_kind(a)
        if name and kind and name not in groups:
            poly = shapely.Polygon(a['ring'])
            if poly.is_valid and not poly.is_empty:
                p = poly.representative_point()
                groups[name] = {'kind': kind, 'pts': [np.array([[p.x, p.y]])]}
    # named streams and rivers mapped as lines (Laurel Creek, Clair Creek...); a creek sharing its name with a street
    # gets its own entry
    for l in S.get('lines', []):
        name = (l.get('name') or '').strip()
        if not name or len(l['xy']) < 2: continue
        key = name if groups.get(name, {}).get('kind', 'water') == 'water' else name + '\x00water'
        g = groups.setdefault(key, {'kind': 'water', 'pts': [], 'name': name})
        g['pts'].append(densify(np.asarray(l['xy'], float)))

    entries = []
    for name, g in groups.items():
        pts = np.concatenate(g['pts'])
        pts = pts[shapely.contains_xy(city, pts[:, 0], pts[:, 1])]
        if not len(pts): continue
        z = D.sample(pts[:, 0], pts[:, 1]) - datum
        c, _ = world_to_canvas(np.c_[pts, z])
        keys = np.array([f'{int(math.floor(x / F()))}_{int(math.floor(y / F()))}' for x, y in c])
        inside = np.isin(keys, list(published))
        cand = c[inside] if inside.any() else c
        k = keys[inside] if inside.any() else keys
        best = int(np.argmin(((cand - cand.mean(0)) ** 2).sum(1)))  # vertex nearest the centroid lies on the feature
        entries.append({'n': g.get('name', name), 'k': g['kind'], 'c': [round(float(cand[best, 0]), 1), round(float(cand[best, 1]), 1)], 't': str(k[best])})

    # labelled buildings (labels.json): name, UW code and alternative names are searchable; 'id' links the label so the
    # viewer can open its building card
    lpath = os.path.join(ROOT, 'web', 'public', 'data', 'labels.json')
    n_bld = 0
    if os.path.exists(lpath):
        for l in json.load(open(lpath))['labels']:
            e = {'n': l['name'], 'k': 'building', 'c': l['canvas'], 't': l['tile'], 'id': l['id']}
            if l.get('short'): e['s'] = l['short']           # curated UW code only (OSM alternative names never count as codes)
            alt = list(l.get('alt', []))
            d = l.get('display')                              # e.g. 'V1 East 3'; cut / abbreviated forms are not searchable names
            if d and '…' not in d and d not in alt and not any(x in d for x in ('Univ.', 'Ctr.', 'Bldg.', 'Eng.', 'Res.', 'Inst.')): alt.append(d)
            if alt: e['a'] = alt
            entries.append(e); n_bld += 1
    else:
        print('note: labels.json missing - run pipeline/build_labels.py to make buildings searchable')

    entries.sort(key=lambda e: (e['t'] not in published, e['n'].lower()))
    out = {'version': 1, 'generated_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
           'comment': "n name, k kind (street|trail|rail|place|water|building), c canvas px of a representative point, t tile 'i_j'; "
                      "buildings also carry id (labels.json id), s (curated UW code) and a (alternative names). "
                      'Covered/pending status is resolved at runtime against manifest.tiles.',
           'entries': entries}
    path = os.path.join(ROOT, 'web', 'public', 'data', 'search.json')
    with open(path, 'w') as f:
        json.dump(out, f, separators=(',', ':'), ensure_ascii=False)
    n_cov = sum(e['t'] in published for e in entries)
    kinds = {k: sum(e['k'] == k for e in entries) for k in sorted({e['k'] for e in entries})}
    print(f'search.json: {len(entries)} names ({n_cov} with a point in published tiles) {kinds}  {os.path.getsize(path) / 1024:.0f} KB')


if __name__ == '__main__':
    main()
