"""Build web/public/data/landmarks.json: landmark cards with geometry/height provenance.

Geometry and positions come from OSM (via Overture). Descriptions are short editorial summaries written for this
project; each card lists reference URLs for verification. Those URLs could NOT be fetched from the build
environment (network policy) - see BUILD_STATUS.md - so descriptions are deliberately limited to widely documented facts.
"""
import os, sys, json, pickle
import numpy as np
import shapely
sys.path.insert(0, os.path.dirname(__file__))
from world import cfg, ROOT, world_to_canvas, F, local_to_lonlat

CARDS = [
    # id, match (building name | area name | point lon/lat), category, short, description, refs
    ('dana-porter', {'building': 'Dana Porter Library'}, 'Library', 'DP',
     "The University of Waterloo's main library for the arts, humanities and social sciences. Its concrete tower rises above the "
     "low campus core and is one of the easiest buildings to spot from across the main campus.",
     [('University of Waterloo Library', 'https://uwaterloo.ca/library/')]),
    ('slc', {'building': 'Student Life Centre'}, 'Student hub', 'SLC',
     'The Student Life Centre is the central student building on main campus, with food outlets, student services, '
     'lounges and meeting rooms, and a busy route between residences and classes.',
     [('University of Waterloo campus map', 'https://uwaterloo.ca/map/')]),
    ('e5', {'building': 'Engineering 5'}, 'Engineering', 'E5',
     'Engineering 5 sits on the north-east edge of the campus core beside Ring Road. It houses engineering teaching and '
     'research space and student design-team workshops.',
     [('Waterloo Engineering', 'https://uwaterloo.ca/engineering/')]),
    ('e7', {'building': 'Pearl Sullivan Engineering Building'}, 'Engineering', 'E7',
     "Engineering 7 (named the Pearl Sullivan Engineering Building in OpenStreetMap) is one of the newest engineering "
     'buildings on campus, next to E5 and E6 at the north-east corner of Ring Road.',
     [('Waterloo Engineering', 'https://uwaterloo.ca/engineering/')]),
    ('eit', {'building': 'Centre for Environmental and Information Technology'}, 'Science & Engineering', 'EIT',
     'The Centre for Environmental and Information Technology (EIT) connects the engineering and science sides of the '
     'campus core, near Mathematics & Computer and the Davis Centre.',
     [('University of Waterloo campus map', 'https://uwaterloo.ca/map/')]),
    ('mc', {'building': 'Mathematics & Computer'}, 'Mathematics', 'MC',
     'Mathematics & Computer (MC) is the home of the Faculty of Mathematics, a long concrete building on the western '
     'side of the campus core.',
     [('Faculty of Mathematics', 'https://uwaterloo.ca/math/')]),
    ('dc', {'building': 'William G. Davis Computer Research Centre'}, 'Computer Science', 'DC',
     'The Davis Centre houses the Cheriton School of Computer Science and a large study library; its stepped roofline '
     'is visible north of Ring Road.',
     [('Cheriton School of Computer Science', 'https://cs.uwaterloo.ca/')]),
    ('qnc', {'building': 'Mike & Ophelia Lazaridis Quantum Nano Centre'}, 'Research', 'QNC',
     'The Quantum-Nano Centre brings together quantum information and nanotechnology research next to the main '
     'campus green.',
     [('Institute for Quantum Computing', 'https://uwaterloo.ca/institute-for-quantum-computing/')]),
    ('waterloo-park', {'area': 'Waterloo Park'}, 'Park', 'Park',
     "Waterloo Park is the city's large central park between the University of Waterloo and Uptown, with Silver Lake, "
     'Laurel Creek, trails, sports fields and the LRT line running along its edge.',
     [('City of Waterloo - Waterloo Park', 'https://www.waterloo.ca/')]),
    ('silver-lake', {'area': 'Silver Lake'}, 'Lake', 'Lake',
     'Silver Lake is the pond at the heart of Waterloo Park, fed by Laurel Creek and lined with paths between the park '
     'and Uptown.',
     [('City of Waterloo', 'https://www.waterloo.ca/')]),
    ('perimeter', {'building': 'Perimeter Institute for Theoretical Physics'}, 'Research institute', 'PI',
     'Perimeter Institute for Theoretical Physics is an independent research centre beside Silver Lake. Its angular '
     'building faces the park on one side and Uptown on the other.',
     [('Perimeter Institute', 'https://perimeterinstitute.ca/')]),
    ('public-square', {'area': 'Waterloo Public Square'}, 'Public square', 'Square',
     "Waterloo Public Square is Uptown's central plaza beside King Street, used for markets, events and a winter rink.",
     [('City of Waterloo', 'https://www.waterloo.ca/')]),
    ('wpl-main', {'building': 'Waterloo Public Library - Main'}, 'Library', 'WPL',
     "The main branch of the Waterloo Public Library, on Albert Street at the edge of Uptown.",
     [('Waterloo Public Library', 'https://www.wpl.ca/')]),
    ('laurier', {'building': 'Laurier Library'}, 'University', 'WLU',
     'The Wilfrid Laurier University Waterloo campus sits east of the University of Waterloo along University Avenue. '
     'This card marks the Laurier Library on the campus core.',
     [('Wilfrid Laurier University', 'https://www.wlu.ca/')]),
    ('laurel-creek', {'area': 'Laurel Creek Reservoir'}, 'Conservation area', 'Reservoir',
     'Laurel Creek Reservoir and Conservation Area in north-west Waterloo is a large dam-made lake with trails and '
     'campgrounds, upstream of Waterloo Park.',
     [('Grand River Conservation Authority', 'https://www.grandriver.ca/')]),
]


def main():
    S = pickle.load(open(os.path.join(ROOT, 'data_cache', 'scene', 'scene.pkl'), 'rb'))
    from build_scene import DEM
    D = DEM(); datum = cfg()['projection']['datum_m']
    mp = os.path.join(ROOT, 'web', 'public', 'data', 'manifest.json')
    tiles = json.load(open(mp))['tiles'] if os.path.exists(mp) else {}
    bmap = {}
    for b in S['buildings']:
        if b['name']: bmap.setdefault(b['name'], b)
    amap = {}
    for a in S['areas']:
        if a['name']:
            pa = shapely.Polygon(a['ring']).area
            if a['name'] not in amap or pa > shapely.Polygon(amap[a['name']]['ring']).area: amap[a['name']] = a
    out = []; rel = cfg()['overture_release']
    for cid, match, cat, short, desc, refs in CARDS:
        if 'building' in match:
            b = bmap.get(match['building'])
            if not b: print('MISSING', match); continue
            p = max(b['parts'], key=lambda q: q['top'])
            foot = shapely.unary_union([shapely.Polygon(q['ring']) for q in b['parts']])
            # anchor at a point of the footprint, at the roof height of the part under that point: lifting it to the
            # tallest part's roof would float the label above a lower wing
            c = foot.representative_point()
            under = [q['top'] for q in b['parts'] if shapely.Polygon(q['ring'], q['holes']).covers(c)]
            z = b['z0'] + (max(under) if under else p['top'])
            gsrc = f"OSM {b['osm']} via Overture {rel}"
            srcs = sorted({q['src'] for q in b['parts']})
            hsrc = ', '.join({'osm_height': 'OSM height tag', 'osm_levels': 'OSM building:levels x storey height (approximation)',
                              'ms_ml_height': 'Microsoft ML building height (estimate)', 'class_default': 'class default height (approximation)'}[s] for s in srcs)
            name = b['name']; alt = b['alt_names']
        else:
            a = amap.get(match['area'])
            if not a: print('MISSING', match); continue
            poly = shapely.Polygon(a['ring']); c = poly.representative_point()
            z = float(D.sample(c.x, c.y)) - datum
            gsrc = f"OSM {a['layer']} polygon via Overture {rel}"; hsrc = 'terrain (AWS Terrain Tiles / CDEM)'; name = a['name']; alt = []
        (cx, cy), _ = world_to_canvas([c.x, c.y, z])
        lon, lat = local_to_lonlat(c.x, c.y)
        key = f'{int(np.floor(cx / F()))}_{int(np.floor(cy / F()))}'
        card = {'id': cid, 'name': name, 'short': short, 'category': cat, 'lonlat': [round(lon, 6), round(lat, 6)],
                'canvas': [round(float(cx), 1), round(float(cy), 1)], 'zoom': 1.0, 'description': desc,
                'facts': ([f'Also mapped as: {", ".join(alt)}'] if alt else []),
                'sources': [{'label': 'Geometry: OpenStreetMap contributors (ODbL) via Overture Maps', 'url': 'https://www.openstreetmap.org/copyright'}] +
                           [{'label': l, 'url': u} for l, u in refs],
                'geometry_source': gsrc, 'height_source': hsrc, 'description_source': 'editorial summary (not fetched/verified online from build environment)',
                'status': 'covered' if key in tiles else 'pending', 'tile': key}
        out.append(card)
    json.dump(out, open(os.path.join(ROOT, 'web', 'public', 'data', 'landmarks.json'), 'w'), indent=1)
    for c in out: print(f"{c['id']:14s} {c['status']:8s} tile {c['tile']:6s} {c['lonlat']}")


if __name__ == '__main__':
    main()
