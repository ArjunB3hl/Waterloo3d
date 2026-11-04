"""Shared helpers for the artwork relay tools (art_request.py builds packets, art_import.py checks what comes back).

The generated artwork comes from a separate image agent that the user talks to by hand, so everything here is about
making that relay exact and reproducible:
  * a tile's *reference* is the procedural lit render (data_cache/jobs/<t>/color2x.png, box-downsampled to 1024),
    its *class map* and *height map* come from the same job, and accepted art lives in <state>/accepted/<t>.png;
  * all request/receive/accept bookkeeping is in <state>/batches.json and <state>/tiles.json (read by publish_tiles.py).

<state> is ROOT/art unless the environment variable TW_ART_DIR points elsewhere (tests use a temp copy so the real
batch record is never touched). Pure numpy + Pillow: no scipy/OpenCV in the build image.
"""
import os, sys, json, glob, hashlib, time, math
from functools import lru_cache
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from world import ROOT, F, cfg, world_to_canvas, canvas_to_world
from classes import CLS

JOBS = os.path.join(ROOT, 'data_cache', 'jobs')
DEFAULT_STATE = os.path.join(ROOT, 'art')
SCHEMA = 1


# ----------------------------------------------------------------------------------------------- state locations
def state_dir():
    return os.path.abspath(os.environ.get('TW_ART_DIR') or DEFAULT_STATE)


def is_default_state():
    return state_dir() == os.path.abspath(DEFAULT_STATE)


def md_dir():
    """IMAGE_REQUEST_<batch>.md lives at the repo root for the real state, inside the state dir for test copies."""
    return ROOT if is_default_state() else state_dir()


def sp(*parts):
    return os.path.join(state_dir(), *parts)


def rel(path):
    """Path relative to the repo root when possible (for human-readable records)."""
    p = os.path.abspath(path)
    return os.path.relpath(p, ROOT) if p.startswith(ROOT + os.sep) else p


def utc_now():
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())


# ----------------------------------------------------------------------------------------------- hashing / json
def sha_bytes(b):
    return hashlib.sha256(b).hexdigest()


def sha_file(path):
    with open(path, 'rb') as f:
        return sha_bytes(f.read())


def sha_text(s):
    return sha_bytes(s.encode('utf-8'))


def load_json(path, default):
    if not os.path.exists(path): return default
    with open(path) as f:
        return json.load(f)


def save_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(obj, f, indent=1, ensure_ascii=False)
        f.write('\n')
    os.replace(tmp, path)


def load_batches():
    return load_json(sp('batches.json'), {'schema': SCHEMA, 'batches': {}})


def save_batches(b):
    save_json(sp('batches.json'), b)


def load_tiles_meta():
    """art/tiles.json: {tile_id: {version, batch, ...}} - publish_tiles.py reads version/batch from it."""
    return load_json(sp('tiles.json'), {})


def save_tiles_meta(m):
    save_json(sp('tiles.json'), m)


def save_png(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    (img if isinstance(img, Image.Image) else Image.fromarray(img)).save(path, optimize=True)
    return path


# ----------------------------------------------------------------------------------------------- tiles
def tid(i, j):
    return f'{i}_{j}'


def parse_tid(t):
    i, j = t.split('_')
    return int(i), int(j)


def has_reference(t):
    return os.path.exists(os.path.join(JOBS, t, 'color2x.png'))


@lru_cache(64)
def _reference(t):
    im = Image.open(os.path.join(JOBS, t, 'color2x.png')).convert('RGB').resize((F(), F()), Image.BOX)
    return np.asarray(im)


def reference_rgb(t):
    """1024x1024 uint8 reference render - identical to what publish_tiles.py ships for un-arted tiles."""
    return _reference(t)


@lru_cache(64)
def class_ids(t):
    return np.asarray(Image.open(os.path.join(JOBS, t, 'cls.png')).convert('RGB'))[..., 0].copy()


@lru_cache(64)
def surface_z(t):
    """Visible-surface z (m rel. datum) and validity, 1024x1024, decoded from the packed height job."""
    h = np.asarray(Image.open(os.path.join(JOBS, t, 'height.png')).convert('RGB')).astype(np.float64)
    hc = cfg()['heights']
    z = (256 * h[..., 0] + h[..., 1]) / hc['units_per_m'] + hc['floor_m']
    return z, h[..., 2] > 127


@lru_cache(32)
def job(t):
    with open(os.path.join(JOBS, t, 'job.json')) as f:
        return json.load(f)


def accepted_path(t):
    return sp('accepted', f'{t}.png')


def accepted_rgb(t):
    p = accepted_path(t)
    return np.asarray(Image.open(p).convert('RGB')) if os.path.exists(p) else None


def neighbours4(t):
    """Edge neighbours: side -> tile id. 'left' means the neighbour is to the left (its right edge touches our left)."""
    i, j = parse_tid(t)
    return {'left': tid(i - 1, j), 'right': tid(i + 1, j), 'top': tid(i, j - 1), 'bottom': tid(i, j + 1)}


def window(x0, y0, w, h, getter, fill=0):
    """Assemble the canvas window [x0, x0+w) x [y0, y0+h) from per-tile 1024 arrays; getter(t) -> array | None."""
    out = None
    for j in range(math.floor(y0 / F()), math.floor((y0 + h - 1) / F()) + 1):
        for i in range(math.floor(x0 / F()), math.floor((x0 + w - 1) / F()) + 1):
            a = getter(tid(i, j))
            if a is None: continue
            if out is None: out = np.full((h, w) + a.shape[2:], fill, a.dtype)
            ax0, ay0 = max(x0, i * F()), max(y0, j * F()); ax1, ay1 = min(x0 + w, (i + 1) * F()), min(y0 + h, (j + 1) * F())
            out[ay0 - y0:ay1 - y0, ax0 - x0:ax1 - x0] = a[ay0 - j * F():ay1 - j * F(), ax0 - i * F():ax1 - i * F()]
    return out


def mosaic(x0, y0, w, h, use_accepted=True):
    """Compose a canvas window from accepted art (preferred) or reference renders.

    Returns (rgb uint8 HxWx3, source uint8 HxW) with source 0 = no data (flat grey), 1 = reference, 2 = accepted art.
    """
    def art(t):
        return accepted_rgb(t) if use_accepted else None

    def rgb(t):
        a = art(t)
        return a if a is not None else (reference_rgb(t) if has_reference(t) else None)

    def src(t):
        return np.full((F(), F()), 2 if art(t) is not None else (1 if has_reference(t) else 0), np.uint8)
    im = window(x0, y0, w, h, rgb, fill=128)
    return (im if im is not None else np.full((h, w, 3), 128, np.uint8)), window(x0, y0, w, h, src)


def mosaic_classes(x0, y0, w, h):
    c = window(x0, y0, w, h, lambda t: class_ids(t) if has_reference(t) else None)
    return c if c is not None else np.zeros((h, w), np.uint8)


def mosaic_depth(x0, y0, w, h):
    d = window(x0, y0, w, h, lambda t: height_above_ground(t) if has_reference(t) else None)
    return d if d is not None else np.zeros((h, w))


# ----------------------------------------------------------------------------------------------- semantic map
# Human-readable colours for the semantic attachment (distinct hues, not the reference palette).
SEM = [  # (label, meaning for the image agent, colour, class names)
    ('roof', 'top surface of a building - paint as that building\'s roof', (232, 72, 56), ['roof']),
    ('wall', 'visible building facade - paint walls with windows', (122, 36, 44), ['wall']),
    ('major road', 'arterial road (asphalt, lane markings)', (44, 44, 56), ['major_road']),
    ('road', 'street, Ring Road, service lane (asphalt)', (92, 92, 106), ['road']),
    ('path', 'footpath / walkway / cycle path', (250, 222, 90), ['path']),
    ('paved plaza', 'paved plaza, courtyard or hardstanding', (206, 206, 206), ['paved']),
    ('parking', 'parking lot (asphalt with bays)', (156, 112, 214), ['parking']),
    ('lawn', 'mown lawn / campus grass', (132, 222, 96), ['lawn', 'residential']),
    ('park / meadow', 'park grass, meadow, rough', (70, 186, 112), ['park', 'golf']),
    ('sports field', 'sports pitch', (40, 230, 190), ['pitch']),
    ('trees', 'tree canopy (maple / oak)', (16, 104, 40), ['tree']),
    ('woodland floor', 'woodland / scrub under trees', (98, 140, 60), ['forest_floor']),
    ('wetland', 'wetland / marsh edge', (120, 180, 170), ['wetland']),
    ('water', 'creek, lake or pond', (30, 110, 240), ['water']),
    ('pool / fountain', 'pool or fountain', (110, 210, 255), ['pool']),
    ('sand / play', 'sand, playground', (246, 200, 150), ['sand']),
    ('running track', 'running track', (236, 110, 170), ['track']),
    ('rail', 'railway / LRT track', (140, 90, 40), ['rail']),
    ('construction', 'construction site / bare ground', (190, 160, 110), ['construction', 'farmland']),
    ('no data', 'outside the mapped area', (0, 0, 0), ['void']),
]
SEM_LUT = np.zeros((256, 3), np.uint8)
for _lab, _m, _c, _names in SEM:
    for _n in _names: SEM_LUT[CLS[_n]] = _c

# Class groups used for geometry QA (boundaries between groups are what the art must keep).
GROUPS = {'roof': ['roof'], 'wall': ['wall'], 'road': ['road', 'major_road', 'rail'], 'path': ['path'], 'paved': ['paved'],
          'parking': ['parking'], 'water': ['water', 'pool'], 'tree': ['tree'],
          'green': ['lawn', 'park', 'pitch', 'residential', 'golf', 'forest_floor', 'wetland', 'farmland'],
          'other': ['void', 'sand', 'track', 'construction']}
GROUP_LUT = np.zeros(256, np.uint8)
GROUP_NAMES = list(GROUPS)
for _gi, _g in enumerate(GROUP_NAMES):
    for _n in GROUPS[_g]: GROUP_LUT[CLS[_n]] = _gi


def semantic_rgb(cls):
    return SEM_LUT[cls]


# ----------------------------------------------------------------------------------------------- fonts / drawing
@lru_cache(8)
def font(size, bold=False):
    names = ['DejaVuSans-Bold.ttf', 'FreeSansBold.ttf'] if bold else ['DejaVuSans.ttf', 'FreeSans.ttf']
    for n in names:
        for p in glob.glob(f'/usr/share/fonts/**/{n}', recursive=True):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default(size=size)


def label(draw, xy, text, size=18, fill=(255, 255, 255), bg=(20, 20, 24), pad=4, bold=True):
    """Text on a solid box so it reads on any background."""
    f = font(size, bold)
    x, y = xy
    l, t, r, b = draw.textbbox((x, y), text, font=f)
    draw.rectangle([l - pad, t - pad, r + pad, b + pad], fill=bg)
    draw.text((x, y), text, font=f, fill=fill)
    return r + pad, b + pad


def legend_image(class_ids_present):
    rows = [s for s in SEM if any(CLS[n] in class_ids_present for n in s[3])]
    W, rh = 760, 40
    im = Image.new('RGB', (W, 64 + rh * len(rows)), (250, 250, 248)); d = ImageDraw.Draw(im)
    d.text((16, 16), 'Semantic map legend (colour = surface type)', font=font(22, True), fill=(20, 20, 20))
    for k, (lab, meaning, col, _n) in enumerate(rows):
        y = 60 + k * rh
        d.rectangle([16, y, 60, y + rh - 10], fill=col, outline=(40, 40, 40))
        d.text((74, y + 4), lab, font=font(18, True), fill=(20, 20, 20))
        d.text((250, y + 6), meaning, font=font(16), fill=(60, 60, 60))
    return im


# ----------------------------------------------------------------------------------------------- depth guidance
@lru_cache(16)
def height_above_ground(t):
    """Visible-surface height above local terrain (m) for tile t: buildings stand out, the hills of Waterloo do not."""
    z, valid = surface_z(t)
    i, j = parse_tid(t)
    cy, cx = np.mgrid[0:F(), 0:F()].astype(np.float64) + 0.5
    p = canvas_to_world(cx + i * F(), cy + j * F(), z)
    d = job(t)['dem']
    dem = np.asarray(d['z'], np.float64).reshape(d['h'], d['w'])
    fx = (p[..., 0] - d['x0']) / d['step']; fy = (p[..., 1] - d['y0']) / d['step']
    ix = np.clip(np.floor(fx).astype(int), 0, d['w'] - 2); iy = np.clip(np.floor(fy).astype(int), 0, d['h'] - 2)
    tx = np.clip(fx - ix, 0, 1); ty = np.clip(fy - iy, 0, 1)
    g = (dem[iy, ix] * (1 - tx) * (1 - ty) + dem[iy, ix + 1] * tx * (1 - ty) + dem[iy + 1, ix] * (1 - tx) * ty
         + dem[iy + 1, ix + 1] * tx * ty)
    return np.where(valid, np.maximum(z - g, 0), 0)


DEPTH_MAX_M = 45.0  # white in the depth attachment


def depth_image(hag):
    """Greyscale: black = ground level, white = DEPTH_MAX_M or taller (gamma 0.7 so low buildings stay visible)."""
    v = np.clip(hag / DEPTH_MAX_M, 0, 1) ** 0.7
    return (v * 255 + 0.5).astype(np.uint8)


# ----------------------------------------------------------------------------------------------- named buildings
def building_roofs(t, min_px=600):
    """Visible roof mask per building in tile t (projected roof polygons intersected with the roof class).

    Returns a list of dicts {id, name, cls, area, mask (bool 1024x1024), bbox, centroid} sorted by visible area.
    """
    i, j = parse_tid(t)
    roof = class_ids(t) == CLS['roof']
    out = []
    for b in job(t)['buildings']:
        im = Image.new('L', (F(), F()), 0); d = ImageDraw.Draw(im); drawn = False
        for p in b['parts']:
            ring = np.asarray(p['ring'], float)
            c, _ = world_to_canvas(np.c_[ring, np.full(len(ring), b['z0'] + p['top'])])
            c -= (i * F(), j * F())
            if c[:, 0].max() < 0 or c[:, 1].max() < 0 or c[:, 0].min() >= F() or c[:, 1].min() >= F(): continue
            d.polygon([tuple(q) for q in c], fill=255); drawn = True
            for hole in p.get('holes') or []:
                hr = np.asarray(hole, float)
                hc, _ = world_to_canvas(np.c_[hr, np.full(len(hr), b['z0'] + p['top'])])
                d.polygon([tuple(q) for q in hc - (i * F(), j * F())], fill=0)
        if not drawn: continue
        m = (np.asarray(im) > 0) & roof
        a = int(m.sum())
        if a < min_px: continue
        ys, xs = np.nonzero(m)
        out.append({'id': b['id'], 'name': b['name'], 'cls': b['cls'], 'area': a, 'mask': m,
                    'bbox': [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1],
                    'centroid': [int(xs.mean()), int(ys.mean())]})
    out.sort(key=lambda r: -r['area'])
    return out


@lru_cache(1)
def landmark_names():
    p = os.path.join(ROOT, 'web', 'public', 'data', 'landmarks.json')
    return {l['name'] for l in load_json(p, [])}


# Material/identity hints for the prompt, in our own words. Keys are OSM building names.
MATERIAL_HINTS = {
    'Dana Porter Library': 'tall pale precast-concrete tower with a dense regular window grid, standing on a wide low podium',
    'J. G. Hagey Hall of the Humanities': 'Hagey Hall - low concrete and red-brown brick humanities building',
    'Modern Languages': 'concrete brutalist block (theatre and classrooms)',
    'Mathematics & Computer': 'MC - long precast-concrete brutalist block with a repeated narrow window rhythm',
    'Mike & Ophelia Lazaridis Quantum Nano Centre': 'QNC - glass and metal curtain wall with a honeycomb-like facade pattern',
    'Engineering 5': 'E5 - newer engineering building, glass and metal curtain walls',
    'Pearl Sullivan Engineering Building': 'E7 - newer engineering building, glass and metal curtain walls',
    'Engineering 6': 'E6 - newer engineering building; follow the reference wall colour for its material',
    'Student Life Centre': 'SLC - the student centre; follow the reference wall colour for its material',
    'William G. Davis Computer Research Centre': 'DC - large brick-and-concrete research building with a stepped roofline',
    'Centre for Environmental and Information Technology': 'EIT - concrete and brick science/engineering block',
    'Physics': 'red-brown brick campus building', 'Biology 1': 'red-brown brick campus building',
    'Biology 2': 'red-brown brick campus building', 'Earth Sciences & Chemistry': 'red-brown brick campus building',
    'Ira G. Needles Hall': 'administration building, concrete and brick',
    'Arts Lecture Hall': 'arts lecture hall beside the arts quad',
    'South Campus Hall': 'brick building at the south edge of the campus core',
}


def position_words(x, y, size=F()):
    h = 'left' if x < size / 3 else ('right' if x > 2 * size / 3 else 'centre')
    v = 'upper' if y < size / 3 else ('lower' if y > 2 * size / 3 else 'middle')
    return 'centre' if (h, v) == ('centre', 'middle') else f'{v} {h}'.replace('middle ', '')


def tile_notes(t, max_buildings=9):
    """Identifiable buildings in tile t (largest visible roofs first) for the prompt and QA."""
    notes = []
    roofs = sorted(building_roofs(t, min_px=1500), key=lambda r: (r['name'] not in landmark_names(), -r['area']))
    for r in roofs:
        if not r['name']: continue
        if any(n['name'] == r['name'] for n in notes): continue
        x, y = r['centroid']
        notes.append({'name': r['name'], 'x': x, 'y': y, 'area': r['area'], 'where': position_words(x, y),
                      'hint': MATERIAL_HINTS.get(r['name']), 'landmark': r['name'] in landmark_names()})
        if len(notes) >= max_buildings: break
    return notes


@lru_cache(1)
def _scene_roads():
    import pickle
    p = os.path.join(ROOT, 'data_cache', 'scene', 'scene.pkl')
    if not os.path.exists(p): return []
    with open(p, 'rb') as f:
        return [r for r in pickle.load(f)['roads'] if r.get('name') and r['kind'] == 'road']


def tile_streets(t, min_px=120, limit=6):
    """Named streets crossing tile t (projected at terrain height), longest first."""
    i, j = parse_tid(t)
    d = job(t)['dem']
    dem = np.asarray(d['z'], np.float64).reshape(d['h'], d['w'])
    x0, y0, x1, y1 = job(t)['region_bbox']
    lengths = {}
    for r in _scene_roads():
        xy = np.asarray(r['xy'], float)
        if xy[:, 0].max() < x0 or xy[:, 0].min() > x1 or xy[:, 1].max() < y0 or xy[:, 1].min() > y1: continue
        # densify so clipping by tile bounds measures length inside the tile
        seg = np.linspace(0, 1, 9)[:-1]
        pts = np.concatenate([a + (b - a) * seg[:, None] for a, b in zip(xy[:-1], xy[1:])] + [xy[-1:]])
        ix = np.clip(((pts[:, 0] - d['x0']) / d['step']).astype(int), 0, d['w'] - 1)
        iy = np.clip(((pts[:, 1] - d['y0']) / d['step']).astype(int), 0, d['h'] - 1)
        c, _ = world_to_canvas(np.c_[pts, dem[iy, ix]])
        c -= (i * F(), j * F())
        inside = (c[:, 0] >= 0) & (c[:, 0] < F()) & (c[:, 1] >= 0) & (c[:, 1] < F())
        if inside.sum() < 2: continue
        steps = np.linalg.norm(np.diff(c, axis=0), axis=1)
        L = float(steps[inside[:-1] & inside[1:]].sum())
        name = r['name']
        lengths[name] = lengths.get(name, 0) + L
    return [n for n, L in sorted(lengths.items(), key=lambda kv: -kv[1]) if L >= min_px][:limit]


# ----------------------------------------------------------------------------------------------- image measures
def to_float(rgb):
    return np.asarray(rgb, np.float32)


def gray(rgb):
    a = to_float(rgb)
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def box_blur(a, r):
    """Separable mean filter of radius r (edge-clamped), any 2-D float array."""
    if r <= 0: return a
    k = 2 * r + 1
    for ax in (0, 1):
        p = np.pad(a, [(r + 1, r) if d == ax else (0, 0) for d in range(a.ndim)], mode='edge')
        c = np.cumsum(p, axis=ax, dtype=np.float64)
        hi = np.take(c, np.arange(k, k + a.shape[ax]), axis=ax); lo = np.take(c, np.arange(0, a.shape[ax]), axis=ax)
        a = ((hi - lo) / k).astype(np.float32)
    return a


def grad_mag(g):
    gx = np.zeros_like(g); gy = np.zeros_like(g)
    gx[:, 1:-1] = g[:, 2:] - g[:, :-2]; gy[1:-1] = g[2:] - g[:-2]
    return np.hypot(gx, gy)


def edge_strength(rgb, blur=1):
    """Gradient magnitude of the (lightly blurred) luminance - the common currency for registration checks."""
    return grad_mag(box_blur(gray(rgb), blur))


def class_boundaries(cls):
    """Pixels where the class *group* changes to the right or below (roof outlines, road edges, water edges...)."""
    g = GROUP_LUT[cls]
    b = np.zeros(g.shape, bool)
    b[:, :-1] |= g[:, :-1] != g[:, 1:]; b[:-1] |= g[:-1] != g[1:]
    return b


def dilate(mask, r):
    """Square (chessboard) dilation of a boolean mask by r pixels (separable, edge-padded)."""
    out = mask
    for ax in (0, 1):
        n = out.shape[ax]
        p = np.pad(out, [(r, r) if d == ax else (0, 0) for d in range(2)])
        acc = np.zeros_like(out)
        for s in range(2 * r + 1):
            acc |= np.take(p, np.arange(s, s + n), axis=ax)
        out = acc
    return out


def hann2(h, w):
    return np.outer(np.hanning(h), np.hanning(w)).astype(np.float32)


def phase_correlate(a, b):
    """Translation (dx, dy) such that b(x, y) ~= a(x - dx, y - dy), plus the normalised correlation peak (0..1).

    a, b: 2-D float arrays of equal shape (use edge strength, not raw colour). Sub-pixel by parabolic peak fit.
    """
    h, w = a.shape
    win = hann2(h, w)
    A = np.fft.rfft2((a - a.mean()) * win); B = np.fft.rfft2((b - b.mean()) * win)
    R = np.conj(A) * B
    R /= np.maximum(np.abs(R), 1e-9)
    r = np.fft.irfft2(R, s=(h, w))
    py, px = np.unravel_index(np.argmax(r), r.shape)
    peak = float(r[py, px])

    def sub(m1, c, p1):
        den = m1 - 2 * c + p1
        return 0.0 if abs(den) < 1e-12 else 0.5 * (m1 - p1) / den
    dx = px + sub(r[py, (px - 1) % w], r[py, px], r[py, (px + 1) % w])
    dy = py + sub(r[(py - 1) % h, px], r[py, px], r[(py + 1) % h, px])
    if dx > w / 2: dx -= w
    if dy > h / 2: dy -= h
    return float(dx), float(dy), peak


def rgb_to_lab(rgb):
    """sRGB uint8 (...,3) -> CIE L*a*b* (D65)."""
    c = to_float(rgb) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]], np.float32)
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883], np.float32)
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def hsv_hist(rgb, mask=None):
    """Normalised coarse joint histogram: 8 hue bins (+1 grey bin for unsaturated pixels) x 3 saturation x 3 value.

    Coarse on purpose: a pixel-art palette is a set of spikes, and fine bins would call two nearly identical palettes
    disjoint."""
    a = to_float(rgb).reshape(-1, 3) / 255.0
    if mask is not None: a = a[mask.reshape(-1)]
    mx = a.max(1); mn = a.min(1); dlt = np.maximum(mx - mn, 1e-6)
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    r, g, b = a[:, 0], a[:, 1], a[:, 2]
    hh = np.where(mx == r, ((g - b) / dlt) % 6, np.where(mx == g, (b - r) / dlt + 2, (r - g) / dlt + 4)) / 6.0
    hb = np.where(s < 0.12, 8, np.clip((hh * 8).astype(int), 0, 7))
    sb = np.clip((s * 3).astype(int), 0, 2); vb = np.clip((mx * 3).astype(int), 0, 2)
    hist = np.bincount(hb * 9 + sb * 3 + vb, minlength=81).astype(np.float64)
    return hist / max(hist.sum(), 1)


def bhattacharyya(p, q):
    return float(np.sqrt(max(0.0, 1.0 - np.sum(np.sqrt(p * q)))))


def resample_square(img, size, box=None):
    """Resize (optionally a sub-box) to size x size: box filter when shrinking (keeps pixel clusters crisp), Lanczos when
    enlarging."""
    bw = (box[2] - box[0]) if box else img.width
    return img.resize((size, size), Image.BOX if bw >= size else Image.LANCZOS, box=box)


def read_image(path):
    """Open a returned file: (PIL RGB image, info dict) - raises ValueError for undecodable/unsupported files."""
    try:
        im = Image.open(path); im.load()
    except Exception as e:  # PIL raises a variety of exception types for corrupt data
        raise ValueError(f'cannot decode image: {e}')
    fmt = (im.format or '').upper()
    if fmt not in ('PNG', 'JPEG', 'WEBP'):
        raise ValueError(f'unsupported format {fmt or "unknown"} (need PNG, JPEG or WebP)')
    info = {'format': fmt, 'mode': im.mode, 'size': list(im.size)}
    meta = {k: str(v)[:500] for k, v in (im.info or {}).items() if isinstance(v, (str, bytes)) and k not in ('icc_profile', 'exif')}
    if meta: info['embedded_text'] = meta
    alpha_min = None
    if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
        alpha_min = int(np.asarray(im.convert('RGBA'))[..., 3].min())
    info['alpha_min'] = alpha_min
    return im.convert('RGB'), info


def seam_metrics(a, b, axis):
    """Discontinuity across a join between image `a` (left / top) and `b` (right / bottom).

    grad_ratio: mean colour difference between pixels 2 px apart straddling the join vs the same 2 px differences inside
                the 4 px bands on either side (1.0 = indistinguishable from the interior). Pixel pairs 2 apart always
                span one cluster boundary of 2x2 pixel art, so the join landing on a cluster edge is not mistaken for a seam.
    step_ratio: colour step between the two 4 px bands (smoothed along the join) vs the step between the 4 px band and
                the next 4 px band inside each image - catches soft brightness/colour offsets that a gradient misses.
    worst:      up to 5 [start, end] ranges along the join (px) where the local jump is > 2.5x the local interior.
    """
    a = to_float(a); b = to_float(b)
    if axis == 'horizontal': a, b = a.transpose(1, 0, 2), b.transpose(1, 0, 2)
    cross = 0.5 * (np.abs(a[:, -1] - b[:, 1]) + np.abs(a[:, -2] - b[:, 0])).mean(-1)
    inner = np.mean([np.abs(a[:, -c - 2] - a[:, -c]).mean(-1) for c in range(1, 5)]
                    + [np.abs(b[:, c - 1] - b[:, c + 1]).mean(-1) for c in range(1, 5)], axis=0)
    grad_ratio = float(cross.mean() / max(inner.mean(), 1.0))

    def along(v, r):  # smooth a per-row (H,) or (H,3) profile along the join
        return box_blur(v.reshape(len(v), -1).astype(np.float32), r) if v.ndim > 1 else box_blur(v[:, None].astype(np.float32), r)[:, 0]
    ma, mb = a[:, -4:].mean(1), b[:, :4].mean(1)
    ia, ib = a[:, -8:-4].mean(1), b[:, 4:8].mean(1)
    step = np.linalg.norm(along(ma - mb, 8).reshape(-1, 3), axis=1)
    base = 0.5 * (np.linalg.norm(along(ia - ma, 8).reshape(-1, 3), axis=1) + np.linalg.norm(along(ib - mb, 8).reshape(-1, 3), axis=1))
    step_ratio = float(step.mean() / max(base.mean(), 1.0))
    local = along(cross, 12) / np.maximum(along(inner, 12), 2.0)
    bad = local > 2.5
    runs, k = [], 0
    while k < len(bad):
        if bad[k]:
            e = k
            while e < len(bad) and bad[e]: e += 1
            if e - k >= 16: runs.append((float(local[k:e].mean()), [k, e]))
            k = e
        else:
            k += 1
    worst = [r for _s, r in sorted(runs, key=lambda x: -x[0])[:5]]
    return {'grad_ratio': round(grad_ratio, 3), 'step_ratio': round(step_ratio, 3), 'cross_mean': round(float(cross.mean()), 2),
            'interior_mean': round(float(inner.mean()), 2), 'worst': worst}
