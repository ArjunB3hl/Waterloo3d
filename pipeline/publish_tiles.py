"""Publish rendered/accepted tiles to web/public/data for the viewer.

For every tile with a reference render (data_cache/jobs/<i>_<j>) this writes:
  tiles/<lod>/<i>_<j>.webp       artwork, lod in {256, 512, 1024}. Source = accepted generated art if present
                                 (art/accepted/<i>_<j>.png), else the procedural reference render.
  heights/<i>_<j>.png            512x512 lossless packed visible-surface heights (see config/world.json 'heights')
  life/<i>_<j>.png               1024x1024 RGB mask: R=tree sway weight, G=canopy, B=water (derived from class map)
  cls/<i>_<j>.png                1024x1024 class IDs (R channel) - used by collision/QA tools
  overview.webp + manifest.json
Usage: python3 pipeline/publish_tiles.py
"""
import os, sys, json, glob, hashlib, time
import numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from world import cfg, ROOT, camera_record, F
from classes import CLS

JOBS = os.path.join(ROOT, 'data_cache', 'jobs')
OUT = os.path.join(ROOT, 'web', 'public', 'data')
ART = os.path.join(ROOT, 'art', 'accepted')


def sha(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()[:12]


def life_mask(cls):
    tree = cls == CLS['tree']; water = (cls == CLS['water']) | (cls == CLS['pool'])
    # sway weight: stronger toward canopy interior (distance from canopy edge), quantised
    t = Image.fromarray((tree * 255).astype(np.uint8))
    inner = np.asarray(t.filter(ImageFilter.MinFilter(5)))
    sway = np.where(tree, np.where(inner > 0, 255, 140), 0).astype(np.uint8)
    rgb = np.stack([sway, (tree * 255).astype(np.uint8), (water * 255).astype(np.uint8)], -1)
    return Image.fromarray(rgb)


def main():
    regions = json.load(open(os.path.join(ROOT, 'config', 'regions.json')))
    art_meta_p = os.path.join(ROOT, 'art', 'tiles.json')
    art_meta = json.load(open(art_meta_p)) if os.path.exists(art_meta_p) else {}
    for d in ('tiles/256', 'tiles/512', 'tiles/1024', 'heights', 'life', 'cls'):
        os.makedirs(os.path.join(OUT, d), exist_ok=True)
    tiles = {}
    hp = cfg()['tiles']['height_px']
    for d in sorted(os.listdir(JOBS)):
        jd = os.path.join(JOBS, d)
        if not os.path.exists(os.path.join(jd, 'height.png')): continue
        i, j = map(int, d.split('_'))
        accepted = os.path.join(ART, f'{d}.png')
        if os.path.exists(accepted):
            src = Image.open(accepted).convert('RGB'); kind = 'art'
        else:
            src = Image.open(os.path.join(jd, 'color2x.png')).convert('RGB').resize((F(), F()), Image.BOX); kind = 'reference'
        assert src.size == (F(), F()), (d, src.size)
        for lod in cfg()['tiles']['lods_px']:
            im = src if lod == F() else src.resize((lod, lod), Image.LANCZOS)
            im.save(os.path.join(OUT, 'tiles', str(lod), f'{d}.webp'), quality=88 if kind == 'art' else 82, method=6)
        h = np.asarray(Image.open(os.path.join(jd, 'height.png')).convert('RGB'))
        step = F() // hp
        # nearest sample at pixel centres of each step x step block: keeps exact encoded values (no blending of packed bytes)
        hs = h[step // 2::step, step // 2::step]
        Image.fromarray(hs).save(os.path.join(OUT, 'heights', f'{d}.png'), optimize=True)
        cls = np.asarray(Image.open(os.path.join(jd, 'cls.png')).convert('RGB'))[..., 0]
        Image.fromarray(cls).save(os.path.join(OUT, 'cls', f'{d}.png'), optimize=True)
        life_mask(cls).save(os.path.join(OUT, 'life', f'{d}.png'), optimize=True)
        meta = art_meta.get(d, {})
        tiles[d] = {'i': i, 'j': j, 'kind': kind, 'v': sha(os.path.join(OUT, 'tiles', '1024', f'{d}.webp')),
                    'hv': sha(os.path.join(OUT, 'heights', f'{d}.png')), 'art_version': meta.get('version'), 'batch': meta.get('batch')}
    # overview: 64 px per tile
    ov = cfg()['tiles']['overview_px_per_tile']
    ii = [t['i'] for t in tiles.values()]; jj = [t['j'] for t in tiles.values()]
    i0, i1, j0, j1 = min(ii), max(ii), min(jj), max(jj)
    canvas = Image.new('RGB', ((i1 - i0 + 1) * ov, (j1 - j0 + 1) * ov), (30, 33, 38))
    for d, t in tiles.items():
        im = Image.open(os.path.join(OUT, 'tiles', '256', f'{d}.webp')).resize((ov, ov), Image.LANCZOS)
        canvas.paste(im, ((t['i'] - i0) * ov, (t['j'] - j0) * ov))
    canvas.save(os.path.join(OUT, 'overview.webp'), quality=85)
    # city coverage tiles (pending) from planner output if present
    plan_p = os.path.join(ROOT, 'web', 'public', 'data', 'coverage.json')
    manifest = {
        'name': 'Tiny Waterloo', 'generated_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'frame_px': F(), 'lods_px': cfg()['tiles']['lods_px'], 'height_px': hp,
        'camera': camera_record(), 'heights': cfg()['heights'], 'origin': cfg()['origin'], 'datum_m': cfg()['projection']['datum_m'],
        'proj4': cfg()['projection']['proj4'], 'classes': CLS,
        'overview': {'url': 'overview.webp', 'i0': i0, 'j0': j0, 'cols': i1 - i0 + 1, 'rows': j1 - j0 + 1, 'px_per_tile': ov},
        'regions': regions, 'tiles': tiles,
        'counts': {'tiles': len(tiles), 'art': sum(t['kind'] == 'art' for t in tiles.values()), 'reference': sum(t['kind'] == 'reference' for t in tiles.values())},
        'attribution': ['© OpenStreetMap contributors (ODbL) via Overture Maps Foundation', 'Overture Maps Foundation',
                        'Microsoft ML Building heights (ODbL) via Overture', 'Terrain: AWS Terrain Tiles / Mapzen (incl. CDEM © NRCan, OGL-Canada)'],
    }
    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
    print(json.dumps(manifest['counts']), 'overview', canvas.size)


if __name__ == '__main__':
    main()
