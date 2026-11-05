"""Build web/public/data/labels.json: one map label per named building inside the published tiles.

Source: named buildings from OSM (via Overture) in data_cache/scene/scene.pkl. Each label carries
  id, name, short (curated UW building code or null), cls (OSM building class), group
  (campus | civic | commercial | residential | other), canvas [cx, cy] (anchor in canvas px), area_m2, height_m,
  priority (higher = placed first), min_zoom (smallest zoom at which the viewer considers it), osm, source,
  plus landmark / landmark_id when the building also has a landmark card, campus (university land use it sits in),
  alt (alternative names) and height_source.
  display / display_short (only when they differ from name): the text the map draws at zoom >= 1 (<= DISPLAY_CHARS)
  and below zoom 1 (<= SHORT_CHARS) - a shorter OSM alternative name when the name is long ('Tatham Centre'), else
  the name with common words abbreviated and cut at a word boundary. The card and search keep the full name.
  Student Village 1 houses ('East 3', 'North 2' ...) are displayed as 'V1 East 3'.

Anchor convention (as build_landmarks.py, but the pole of inaccessibility of the largest footprint polygon rather
than shapely's representative point, which can sit on the edge of irregular roofs), lifted to the roof of the
tallest part covering that point - lifting to the overall tallest part would float the label above a lower wing.
A label is kept when that anchor falls in a tile listed in manifest.tiles.

Buildings sharing a name and lying close together (Ron Eydt Village x3, Conrad Grebel University College x3,
St. Jerome's University x3 ...) are merged into one label anchored on the largest member; same-name buildings far
apart (two Tim Hortons) keep separate labels.

Usage: python pipeline/build_labels.py     (needs data_cache/scene/scene.pkl and web/public/data/manifest.json)
"""
import os, sys, json, pickle, math, re, time
import numpy as np
import shapely
sys.path.insert(0, os.path.dirname(__file__))
from world import cfg, ROOT, world_to_canvas, F, mpp
from building_codes import code_for
from shapely.ops import polylabel

DATA = os.path.join(ROOT, 'web', 'public', 'data')
MERGE_DIST_M = 80.0          # same-name footprints closer than this are one label

CAMPUS_CLS = {'university', 'college', 'dormitory'}
CIVIC_CLS = {'civic', 'public', 'government', 'school', 'church', 'chapel', 'religious', 'mosque', 'temple', 'synagogue',
             'cathedral', 'fire_station', 'train_station', 'transportation', 'medical', 'hospital', 'stadium',
             'sports_centre', 'sports_hall', 'kindergarten', 'library'}
COMMERCIAL_CLS = {'retail', 'commercial', 'office', 'hotel', 'supermarket', 'industrial', 'warehouse', 'manufacture',
                  'entertainment', 'kiosk'}
RESIDENTIAL_CLS = {'apartments', 'residential', 'house', 'detached', 'semidetached_house', 'terrace', 'bungalow'}
# classes that say little about use: a building of this class inside a university's land use is a campus building
GENERIC_CLS = {'building', 'roof', 'service', 'office', 'public', 'civic', 'greenhouse', 'school', 'sports_centre',
               'sports_hall', 'stadium', 'library', 'shed', 'parking', 'education'}

HEIGHT_SRC = {'osm_height': 'OSM height tag', 'osm_levels': 'OSM building:levels x storey height (approximation)',
              'ms_ml_height': 'Microsoft ML building height (estimate)', 'class_default': 'class default height (approximation)'}

# label size gate: a label is considered once the footprint spans about this many CSS px on screen
MIN_SCREEN_PX = 28.0
ZOOM_FLOOR, ZOOM_CEIL = 0.1, 1.0
# shops, offices and houses wait longer than campus / civic buildings of the same size, so small tenants do not
# compete with university buildings at overview zooms
QUIET_GROUPS, QUIET_FACTOR, QUIET_FLOOR = {'commercial', 'residential'}, 1.6, 0.3

DISPLAY_CHARS, SHORT_CHARS = 32, 26
ABBREV = [('University', 'Univ.'), ('Universty', 'Univ.'), ('Residence', 'Res.'), ('Centre', 'Ctr.'), ('Center', 'Ctr.'),
          ('Building', 'Bldg.'), ('Engineering', 'Eng.'), ('Institute', 'Inst.'), ('Information', 'Info.'),
          ('Technology', 'Tech.'), ('Co-operative', 'Co-op'), ('Laboratory', 'Lab'), ('Community', 'Comm.'),
          ('Services', 'Svcs.'), ('Association', 'Assoc.'), ('College', 'Coll.')]
CUT_TAIL = {'-', '–', ',', '&', 'and', 'of', 'the', 'for', 'at', 'on', 'in', 'de', '·'}
V1_HOUSE = re.compile(r'^(North|South|East|West) \d$')
V1_COMPLEX, V1_RADIUS_M = 'Student Village 1 Central Complex', 250.0
is_code = lambda s: bool(re.fullmatch(r'[A-Z0-9]{1,5}', s))


def slug(s):
    s = s.lower().replace('&', 'and').replace("'", '')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:48] or 'building'


def group_of(cls, name, campus):
    if cls == 'library' and 'public library' not in name.lower(): return 'campus' if campus else 'civic'
    if cls in CAMPUS_CLS: return 'campus'
    if campus and cls in GENERIC_CLS: return 'campus'
    if cls in CIVIC_CLS: return 'civic'
    if cls in COMMERCIAL_CLS: return 'commercial'
    if cls in RESIDENTIAL_CLS: return 'residential'
    return 'other'


def abbreviate(text):
    for long, short in ABBREV: text = re.sub(rf'\b{re.escape(long)}\b', short, text)
    return re.sub(r'\s+', ' ', text).strip()


def fit(text, limit):
    """text if it fits; else with common words abbreviated; else cut at a word boundary with an ellipsis."""
    if len(text) <= limit: return text
    text = abbreviate(text)
    if len(text) <= limit: return text
    words, out = text.split(' '), []
    for w in words:
        if len(' '.join(out + [w])) > limit - 1: break
        out.append(w)
    while out and (out[-1].lower() in CUT_TAIL): out.pop()
    if not out: return text[:limit - 1].rstrip() + '…'
    return ' '.join(out).rstrip(' -,:;') + '…'


def word_lcs(a, b):
    """Words two names share in the same order (case-insensitive)."""
    a = re.findall(r"[a-z0-9']+", a.lower()); b = re.findall(r"[a-z0-9']+", b.lower())
    t = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a)):
        for j in range(len(b)): t[i + 1][j + 1] = t[i][j] + 1 if a[i] == b[j] else max(t[i][j + 1], t[i + 1][j])
    return t[-1][-1]


def display_names(name, alts, code):
    """(display, display_short) for a label: the full name when it fits, else the name with common words abbreviated
    when that fits, else a related shorter OSM alternative name (not a code, Latin script, sharing words with the name
    in order), else the abbreviated name cut at a word boundary."""
    base = name[: -len(code) - 1].rstrip(' -') if code and name.endswith(' ' + code) else name   # 'St. Jerome's Academic Centre SJ2'
    def pick(limit):
        if len(base) <= limit: return base
        if len(abbreviate(base)) <= limit: return abbreviate(base)
        ok = [a for a in alts if not is_code(a) and a.isascii() and len(a) <= limit and len(a) >= 4 and word_lcs(name, a) >= 1]
        if ok: return max(ok, key=lambda a: (word_lcs(name, a), len(a), a))
        return fit(base, limit)
    return pick(DISPLAY_CHARS), pick(SHORT_CHARS)


def anchor(b, representative=False):
    """Label point (pole of inaccessibility of the largest footprint polygon) and the roof height (rel. datum) of the
    tallest part covering it. representative=True: shapely's representative point instead (used for buildings on the
    edge of the published area whose pole falls just outside it)."""
    foot = shapely.unary_union([shapely.Polygon(q['ring'], q['holes']) for q in b['parts']])
    if not foot.is_valid: foot = foot.buffer(0)
    big = max(getattr(foot, 'geoms', [foot]), key=lambda g: g.area)
    try:
        if representative: raise ValueError
        c = polylabel(big, tolerance=1.0)
        if not foot.covers(c): c = foot.representative_point()
    except Exception:
        c = foot.representative_point()
    under = [q['top'] for q in b['parts'] if shapely.Polygon(q['ring'], q['holes']).covers(c)]
    top = max(under) if under else max(q['top'] for q in b['parts'])
    return foot, c, b['z0'] + top


def main():
    S = pickle.load(open(os.path.join(ROOT, 'data_cache', 'scene', 'scene.pkl'), 'rb'))
    tiles = set(json.load(open(os.path.join(DATA, 'manifest.json')))['tiles'])
    rel = cfg()['overture_release']
    lm_path = os.path.join(DATA, 'landmarks.json')
    landmarks = {l['name']: l['id'] for l in json.load(open(lm_path))} if os.path.exists(lm_path) else {}

    unis = [(a['name'], shapely.Polygon(a['ring'], a.get('holes') or []))
            for a in S['areas'] if a['cls'] in ('education/university', 'education/college') and a['name']]
    unis = [(n, p if p.is_valid else p.buffer(0)) for n, p in unis]

    # 1. every named building with its anchor in a published tile
    cands = []
    for b in S['buildings']:
        name = (b['name'] or '').strip()
        if not name or not b['parts']: continue
        for rp in (False, True):
            foot, c, z = anchor(b, rp)
            (cx, cy), _ = world_to_canvas([c.x, c.y, z])
            key = f'{math.floor(cx / F())}_{math.floor(cy / F())}'
            if key in tiles: break
        if key not in tiles: continue
        campus = next((n for n, p in unis if p.covers(c)), None)
        cands.append({'b': b, 'name': name, 'foot': foot, 'c': c, 'canvas': (float(cx), float(cy)), 'tile': key,
                      'campus': campus, 'area': float(b['area'] or foot.area),
                      'height': max(q['top'] for q in b['parts'])})

    # 2. merge nearby buildings that share a name (union-find over footprint distance)
    by_name = {}
    for k, c in enumerate(cands): by_name.setdefault(c['name'], []).append(k)
    parent = list(range(len(cands)))
    def find(k):
        while parent[k] != k: parent[k] = parent[parent[k]]; k = parent[k]
        return k
    for ks in by_name.values():
        for a in range(len(ks)):
            for bb in range(a + 1, len(ks)):
                if cands[ks[a]]['foot'].distance(cands[ks[bb]]['foot']) < MERGE_DIST_M: parent[find(ks[a])] = find(ks[bb])
    groups = {}
    for k in range(len(cands)): groups.setdefault(find(k), []).append(cands[k])

    # Student Village 1 houses: near the V1 central complex
    v1 = next((c['foot'] for c in cands if c['name'] == V1_COMPLEX), None)

    # 3. one label per group
    labels, used_ids, merged = [], set(), 0
    for members in groups.values():
        members.sort(key=lambda m: -m['area'])
        m = members[0]; b = m['b']; name = m['name']
        if len(members) > 1: merged += len(members) - 1
        cls = b['cls'] or 'building'
        campus = m['campus'] or next((x['campus'] for x in members if x['campus']), None)
        group = group_of(cls, name, campus)
        if group == 'campus' and cls in GENERIC_CLS and any(x['b']['cls'] in CAMPUS_CLS for x in members):
            cls = next(x['b']['cls'] for x in members if x['b']['cls'] in CAMPUS_CLS)
        code = code_for(name) if campus == 'University of Waterloo' or group == 'campus' else None
        if code and group != 'campus': group = 'campus'      # a curated UW code means a UW building (Graduate House, ECH)
        v1_house = bool(v1 is not None and V1_HOUSE.match(name) and m['foot'].distance(v1) < V1_RADIUS_M)
        lid = landmarks.get(name)
        area = sum(x['area'] for x in members)
        height = max(x['height'] for x in members)
        # ids: the landmark id when there is a card, else a slug made unique
        base = lid or slug(name)
        cid = base; n = 2
        while cid in used_ids: cid = f'{base}-{n}'; n += 1
        used_ids.add(cid)
        srcs = sorted({q['src'] for x in members for q in x['b']['parts']})
        alt = sorted({a for x in members for a in (x['b']['alt_names'] or []) if a and a != name})
        # priority: footprint (log), height, then landmark / code / campus bonuses
        pr = 10 * math.log10(max(area, 10)) + 0.15 * min(height, 80) + (25 if lid else 0) + (12 if code else 0) + (6 if group == 'campus' else 0)
        size_px = math.sqrt(max(area, 10)) / mpp()
        mz = MIN_SCREEN_PX / size_px * (0.55 if code else 1.0)
        if group in QUIET_GROUPS: mz = max(QUIET_FLOOR, mz * QUIET_FACTOR)
        if v1_house: mz = max(mz, 0.8)     # the V1 code on the central complex names the cluster at overview zooms
        mz = ZOOM_FLOOR if lid else min(ZOOM_CEIL, max(ZOOM_FLOOR, mz))
        disp, disp_short = (f'V1 {name}', f'V1 {name}') if v1_house else display_names(name, alt, code)
        lab = {
            'id': cid, 'name': name, 'short': code, 'cls': cls, 'group': group,
            'canvas': [round(m['canvas'][0], 1), round(m['canvas'][1], 1)],
            'area_m2': round(area), 'height_m': round(height, 1), 'priority': round(pr, 2), 'min_zoom': round(mz, 3),
            'osm': b['osm'], 'source': f'OSM via Overture {rel}',
            'height_source': ', '.join(HEIGHT_SRC.get(s, s) for s in srcs), 'tile': m['tile'],
        }
        if disp != name: lab['display'] = disp
        if disp_short != disp: lab['display_short'] = disp_short
        if campus: lab['campus'] = campus
        if alt: lab['alt'] = alt
        if lid: lab['landmark'] = True; lab['landmark_id'] = lid
        if len(members) > 1: lab['osm_all'] = [x['b']['osm'] for x in members]
        labels.append(lab)

    labels.sort(key=lambda l: (-l['priority'], l['id']))
    out = {'version': 1, 'generated_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
           'source': f'Building names and footprints: OpenStreetMap contributors (ODbL) via Overture Maps {rel}. '
                     'Building codes: curated University of Waterloo table (pipeline/building_codes.py), verify against uwaterloo.ca/map.',
           'comment': 'canvas = roof anchor in canvas px; priority higher first; min_zoom = smallest view zoom at which the label is considered.',
           'labels': labels}
    path = os.path.join(DATA, 'labels.json')
    with open(path, 'w') as f: json.dump(out, f, separators=(',', ':'), ensure_ascii=False)
    gc = {g: sum(l['group'] == g for l in labels) for g in ('campus', 'civic', 'commercial', 'residential', 'other')}
    print(f'labels.json: {len(labels)} labels from {len(cands)} named buildings ({merged} merged), '
          f'{sum(bool(l["short"]) for l in labels)} with UW codes, {sum(bool(l.get("landmark")) for l in labels)} landmarks, '
          f'{gc}  {os.path.getsize(path) / 1024:.0f} KB')
    missing = sorted(set(__import__('building_codes').UW_BUILDING_CODES) - {l['name'] for l in labels})
    if missing: print('codes without a labelled building (outside published tiles or renamed in OSM):', missing)


if __name__ == '__main__':
    main()
