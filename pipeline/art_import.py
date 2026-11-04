"""Import artwork returned by the image agent: match, QA against the source geometry, record, accept, publish.

  python3 pipeline/art_import.py <batch> <dir-with-returned-files> [--accept] [--force] [--only 0_0,...]
                                 [--model "..."] [--settings "..."] [--reprocess] [--no-publish] [--no-revision]

For each returned file whose name matches an expected return filename of the batch (e.g. B001_0_0.png; suffixes such
as "B001_0_0 (1).png" are tolerated) and that has not been processed before (by sha256):
  1. the original is copied to art/returned/<batch>/ and decoded (PNG / JPEG / WebP);
  2. size/aspect are checked and the final 1024 tile is cut out (see crop math in docs/ART_PIPELINE.md);
  3. QA: global translation (phase correlation of edge maps), block displacement + scale/rotation (camera change),
     geometry agreement of class-map boundaries with image edges (tile, cells, every visible roof, landmarks),
     shadow side, colour style vs accepted tiles, seams against accepted neighbours, kept-margin drift;
  4. art/returned/<batch>/QA_<item>_<sha8>.md + .png per returned file (reference | returned | edge overlay; QA_<item>.md/.png
     are copies of the latest) are written and
     batches.json is updated: received (QA pass) or revision-needed (QA fail, with reasons); failures also get a focused
     revision packet <batch>R<n> (IMAGE_REQUEST_<batch>R<n>.md) unless --no-revision.
--accept copies passing items to art/accepted/<i>_<j>.png (seams: composites the band into the accepted tiles), writes
art/tiles.json and runs pipeline/publish_tiles.py; QA failures are never accepted unless --force. Items are processed
in the batch order and accepted immediately, so later tiles of the batch are seam-checked against earlier ones.
Draft batches whose dependencies become accepted are rebuilt automatically. Returns for an item whose reference job
(color2x/cls/height) changed since its packet was built are refused (rebuild and resend, or --force).
"""
import math, os, sys, re, json, shutil, argparse, subprocess
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import art_common as A
import art_request as R
from world import F
from classes import CLS

# QA thresholds (provisional: calibrated on synthetic degradations of the reference, see tests/test_art_import.py)
T = {
    'shift_px': 4.0,             # global translation must be within this
    'peak_min': 0.02,            # phase-correlation peak below this = image does not register with the reference at all
    'scale_dev': 0.01,           # |scale - 1| from the block displacement field (1 % = 10 px across a tile)
    'rot_deg': 0.5,
    'local_px': 10.0,            # block displacement residual after the affine fit (8 -> 10 after the first real return, B001: 9.1 px with excellent geometry)
    'geom_rel': 0.50,            # tile geometry score relative to the reference's own score
    'cell_rel': 0.30,            # per 128 px cell
    'bld_rel': 0.35,             # roof outline score relative to the reference
    'bld_contrast': 0.35,        # roof-vs-surroundings colour contrast relative to the reference
    'bld_fail_px': 3000,         # non-landmark buildings smaller than this only warn
    'shadow_warn': 0.88, 'shadow_fail': 0.97,  # L(shadow)/L(lit) on the reference's cast-shadow pixels
    'hist_warn': 0.35,           # Bhattacharyya distance of coarse HSV histograms vs accepted tiles (content-dependent: warn only)
    'de_warn': 12.0, 'de_fail': 20.0,          # mean per-class colour difference (CIE76 dE) vs accepted tiles
    'de_group_fail': 30.0,                     # any single class group (e.g. all lawns) this far off fails
    'seam_ratio': 1.8,           # grad_ratio / step_ratio across a join with an accepted neighbour
    'keep_px': 3.0, 'keep_mad_warn': 30.0, 'seam_keep_mad': 12.0,
}
EDGE_FRAC = 0.20                 # top fraction of gradient magnitudes counted as image edges
NEAR = 3                         # class boundary counts as matched when an image edge is within this many px
CHANCE_SHIFTS = [(37, 23), (-29, 41), (53, -17), (-45, -31)]
EXTS = ('.png', '.jpg', '.jpeg', '.webp')


# ----------------------------------------------------------------------------------------------- matching
def match_files(rec, folder):
    """Map item -> [paths] for files whose stem starts with the item's expected stem; also return unmatched files."""
    expected = {os.path.splitext(it['return_filename'])[0].lower(): k for k, it in rec['items'].items()}
    found, unmatched = {}, []
    for name in sorted(os.listdir(folder)):
        p = os.path.join(folder, name)
        if not os.path.isfile(p) or not name.lower().endswith(EXTS): continue
        stem = os.path.splitext(name)[0].lower()
        key = next((k for s, k in expected.items() if stem == s or (stem.startswith(s) and not stem[len(s)].isalnum())), None)
        (found.setdefault(key, []).append(p) if key else unmatched.append(name))
    # oldest first, so the newest return of an item is processed last and becomes its 'latest' (a browser re-download
    # 'X (1).png' sorts before 'X.png' by name)
    for v in found.values(): v.sort(key=lambda p: (os.path.getmtime(p), os.path.basename(p)))
    return found, unmatched


def read_report(rec, folder, model=None, settings=None):
    """Model/settings the agent reported: <batch>_report.{txt,md,json} in the folder, overridden by CLI flags."""
    out = {'model': 'unknown', 'settings': 'unknown'}
    for ext in ('json', 'txt', 'md'):
        p = os.path.join(folder, f'{rec["id"]}_report.{ext}')
        if not os.path.exists(p): continue
        with open(p, encoding='utf-8', errors='replace') as f:
            text = f.read()
        out['report_file'] = os.path.basename(p); out['report_text'] = text[:4000]
        if ext == 'json':
            try:
                d = json.loads(text)
                out['model'] = str(d.get('model', 'unknown')); out['settings'] = d.get('settings', 'unknown')
            except ValueError:
                pass
        else:
            m = re.search(r'^\W*model[^:=\n]*[:=]\s*(.+)$', text, re.I | re.M)
            if m: out['model'] = m.group(1).strip()
            rest = [l.strip(' -*\t') for l in text.splitlines() if re.match(r'^\W*[\w /()-]+\s*[:=]\s*\S', l) and not re.match(r'^\W*model', l, re.I)]
            if rest: out['settings'] = '; '.join(rest)
        break
    if model: out['model'] = model
    if settings: out['settings'] = settings
    return out


# ----------------------------------------------------------------------------------------------- measuring
def edges_near(rgb):
    e = A.edge_strength(rgb)
    E = e >= max(np.quantile(e, 1 - EDGE_FRAC), 1e-3)
    return A.dilate(E, NEAR)


def shift_mask(m, dx, dy):
    o = np.zeros_like(m); H, W = m.shape
    o[max(dy, 0):H + min(dy, 0), max(dx, 0):W + min(dx, 0)] = m[max(-dy, 0):H + min(-dy, 0), max(-dx, 0):W + min(-dx, 0)]
    return o


def agreement(B, near):
    """Chance-corrected recall of boundary pixels B by dilated image edges `near` (1 = perfect, 0 = chance level)."""
    n = B.sum()
    if n == 0: return None
    rec = near[B].mean()
    chance = np.mean([near[sm].mean() if (sm := shift_mask(B, dx, dy)).any() else rec for dx, dy in CHANCE_SHIFTS])
    return float((rec - chance) / max(1 - chance, 1e-6))


def rel(a, b):
    return None if a is None or b is None or b <= 0.05 else a / b


def registration(ref, ret):
    """Global shift + block displacement field (7x7 blocks of 256 px, stride 128) with an affine fit."""
    er, et = A.edge_strength(ref, blur=2), A.edge_strength(ret, blur=2)  # blur 2: robust to dithering / texture noise
    dx, dy, peak = A.phase_correlate(er, et)
    blocks = []
    for by in range(0, F() - 255, 128):
        for bx in range(0, F() - 255, 128):
            a, b = er[by:by + 256, bx:bx + 256], et[by:by + 256, bx:bx + 256]
            if a.mean() < 2.0: continue  # featureless block (lawn, water): no reliable shift
            bdx, bdy, bp = A.phase_correlate(a, b)
            if bp >= 0.06: blocks.append((bx + 128, by + 128, bdx, bdy, bp))
    out = {'dx': round(dx, 2), 'dy': round(dy, 2), 'peak': round(peak, 4), 'blocks': len(blocks)}
    if len(blocks) >= 8:
        P = np.array([[x - 512, y - 512, 1] for x, y, *_ in blocks], float)
        D = np.array([[d1, d2] for *_xy, d1, d2, _p in blocks], float)
        M, *_ = np.linalg.lstsq(P, D, rcond=None)  # D = P @ M: M[0:2] linear part (transposed), M[2] translation
        resid = np.linalg.norm(D - P @ M, axis=1)
        def confirmed(x, y):
            # Repetitive parallel structure (rail lines, parking stripes) can make one 256 px correlation lock onto the wrong
            # stripe. Only report a block when at least 2 of its four 128 px sub-blocks also disagree with the affine fit.
            bad = 0
            for sy in (y - 128, y):
                for sx in (x - 128, x):
                    a, b = er[sy:sy + 128, sx:sx + 128], et[sy:sy + 128, sx:sx + 128]
                    if a.mean() < 2.0: continue
                    sdx, sdy, sp = A.phase_correlate(a, b)
                    pred = np.array([sx + 64 - 512, sy + 64 - 512, 1.0]) @ M
                    if sp >= 0.06 and math.hypot(sdx - pred[0], sdy - pred[1]) > T['local_px']: bad += 1
            return bad >= 2
        flagged = [(x, y, d1, d2, r) for (x, y, d1, d2, _p), r in zip(blocks, resid) if r > T['local_px']]
        out.update({'scale': round(float(1 + (M[0, 0] + M[1, 1]) / 2), 4),
                    'rot_deg': round(float(np.degrees((M[0, 1] - M[1, 0]) / 2)), 3),
                    'max_resid': round(float(resid.max()), 2),
                    'unconfirmed_blocks': [[int(x), int(y), round(float(r), 1)] for x, y, d1, d2, r in flagged if not confirmed(x, y)],
                    'displaced': [[int(x), int(y), round(float(d1), 1), round(float(d2), 1)]
                                  for x, y, d1, d2, r in flagged if confirmed(x, y)]})
    return out


def building_checks(t, near_ref, near_ret, lab_ref, lab_ret):
    rows = []
    for b in A.building_roofs(t, min_px=1500):
        m = b['mask']; ol = m & A.dilate(~m, 1)
        s_ref, s_ret = agreement(ol, near_ref), agreement(ol, near_ret)
        ring = A.dilate(m, 7) & ~A.dilate(m, 2)
        c_ref = float(np.linalg.norm(lab_ref[m].mean(0) - lab_ref[ring].mean(0)))
        c_ret = float(np.linalg.norm(lab_ret[m].mean(0) - lab_ret[ring].mean(0)))
        r_ol, r_c = rel(s_ret, s_ref), (c_ret / c_ref if c_ref > 8 else None)
        bad = (r_ol is not None and r_ol < T['bld_rel']) or (r_c is not None and r_c < T['bld_contrast'])
        name = b['name'] or f'unnamed {b["cls"]} building'
        rows.append({'name': name, 'id': b['id'], 'area': b['area'], 'centroid': b['centroid'], 'bbox': b['bbox'],
                     'landmark': b['name'] in A.landmark_names(), 'outline_rel': None if r_ol is None else round(r_ol, 2),
                     'contrast_rel': None if r_c is None else round(r_c, 2), 'bad': bool(bad), 'mask': m})
    return rows


def shadow_check(t, ref, ret):
    """Luminance of the reference's cast-shadow ground pixels relative to lit pixels of the same classes, in the art."""
    cls = A.class_ids(t); Lr, Lt = A.gray(ref), A.gray(ret)
    sh = np.zeros(cls.shape, bool); lit = np.zeros(cls.shape, bool)
    for n in ('lawn', 'park', 'paved', 'road', 'path', 'parking', 'residential', 'major_road'):
        m = cls == CLS[n]
        if m.sum() < 2000: continue
        med = np.median(Lr[m]); sh |= m & (Lr < 0.8 * med); lit |= m & (Lr > 0.95 * med)
    if sh.sum() < 500 or lit.sum() < 5000: return None
    return {'ref': round(float(Lr[sh].mean() / Lr[lit].mean()), 3), 'art': round(float(Lt[sh].mean() / max(Lt[lit].mean(), 1)), 3),
            'pixels': int(sh.sum())}


def style_check(t, ret, cls):
    """Colour statistics against every accepted tile except t (none yet -> None: this tile sets the style)."""
    others = [os.path.basename(p)[:-4] for p in sorted(os.listdir(A.sp('accepted')))] if os.path.isdir(A.sp('accepted')) else []
    others = [o for o in others if o != t and A.has_reference(o)]
    if not others: return None
    arts = [A.accepted_rgb(o) for o in others]
    h_ret = A.hsv_hist(ret)
    h_acc = np.mean([A.hsv_hist(a) for a in arts], 0)
    lab_ret = A.rgb_to_lab(ret)
    labs = [A.rgb_to_lab(a) for a in arts]; clss = [A.GROUP_LUT[A.class_ids(o)] for o in others]
    g_ret = A.GROUP_LUT[cls]
    des = {}
    for gi, g in enumerate(A.GROUP_NAMES):
        if g in ('other', 'water'): continue
        m = g_ret == gi
        acc = [l[c == gi] for l, c in zip(labs, clss) if (c == gi).sum() > 2000]
        if m.sum() < 2000 or not acc: continue
        des[g] = round(float(np.linalg.norm(lab_ret[m].mean(0) - np.concatenate(acc).mean(0))), 1)
    return {'against': others, 'hist': round(A.bhattacharyya(h_ret, h_acc), 3), 'dE': des,
            'dE_mean': round(float(np.mean(list(des.values()))), 1) if des else None}


def seam_checks(t, tile):
    out = []
    for side, n in A.neighbours4(t).items():
        nb = A.accepted_rgb(n)
        if nb is None or n == t: continue
        if side == 'right': m = A.seam_metrics(tile, nb, 'vertical')
        elif side == 'left': m = A.seam_metrics(nb, tile, 'vertical')
        elif side == 'bottom': m = A.seam_metrics(tile, nb, 'horizontal')
        else: m = A.seam_metrics(nb, tile, 'horizontal')
        m.update({'side': side, 'neighbour': n, 'bad': m['grad_ratio'] > T['seam_ratio'] or m['step_ratio'] > T['seam_ratio']})
        out.append(m)
    return out


def keep_drift(ctx, mask, ret_full):
    """How far the kept (black-mask) area of an edit moved / changed. ctx, ret_full at the context size."""
    K = mask == 0
    if K.sum() < 5000: return None
    ea, eb = A.edge_strength(ctx) * K, A.edge_strength(ret_full) * K
    dx, dy, peak = A.phase_correlate(ea, eb)
    mad = float(np.abs(A.to_float(ctx)[K] - A.to_float(ret_full)[K]).mean())
    return {'dx': round(dx, 2), 'dy': round(dy, 2), 'peak': round(peak, 3), 'mad': round(mad, 1)}


# ----------------------------------------------------------------------------------------------- QA of a tile item
class Result:
    def __init__(self):
        self.failures, self.warnings, self.metrics = [], [], {}

    def fail(self, check, detail, fix):
        self.failures.append({'check': check, 'detail': detail, 'fix': fix})

    def warn(self, check, detail):
        self.warnings.append({'check': check, 'detail': detail})

    @property
    def verdict(self):
        return 'fail' if self.failures else 'pass'


def cut_tile(item, img, info, res):
    """Apply the documented size/crop rules. Returns (tile 1024 uint8, full image at the requested size) or (None, None)."""
    o = item['output']; W, H = img.size
    if info.get('alpha_min') is not None and info['alpha_min'] < 250:
        res.fail('transparency', f'transparent pixels (min alpha {info["alpha_min"]})', 'Fill the whole frame - no transparent pixels.')
    if info['format'] == 'JPEG': res.warn('format', 'JPEG (lossy) - PNG preferred')
    cw, ch = o['width'], o['height']
    if abs(W / H - cw / ch) > 0.01 * cw / ch:
        res.fail('size', f'{W}x{H} has aspect {W / H:.3f}, expected {cw}x{ch} ({cw / ch:.3f})',
                 f'Return exactly {cw}x{ch} px (or a larger image with the same aspect ratio) - do not crop or pad.')
        return None, None
    kx, ky = W / cw, H / ch; k = min(kx, ky)
    res.metrics['size'] = {'returned': [W, H], 'expected': [cw, ch], 'k': round(k, 4)}
    if o['mode'] == 'tile' and W != H:
        res.fail('size', f'{W}x{H} is not square', f'Return exactly {F()}x{F()} px (or a larger square) - do not crop or pad.')
        return None, None
    if o['mode'] == 'tile' and W < F():
        res.fail('size', f'{W}x{H} is smaller than {F()}x{F()}', f'Return {F()}x{F()} px (or larger, square).')
        return None, None
    if k < 1:
        res.warn('size', f'returned {W}x{H} < requested {cw}x{ch}: tile upscaled x{1 / k:.2f} (reduced detail)')
    x0, y0, x1, y1 = o['crop']
    # scale each axis on its own (the aspect may be off by up to 1%) and keep the box inside the image
    box = (min(W, x0 * kx), min(H, y0 * ky), min(W, x1 * kx), min(H, y1 * ky))
    tile = np.asarray(A.resample_square(img, F(), box=box))
    full = np.asarray(img if (W, H) == (cw, ch) else img.resize((cw, ch), Image.BOX if k >= 1 else Image.LANCZOS))
    return tile, full


def qa_tile(rec, key, item, img, info):
    res = Result(); t = key
    tile, full = cut_tile(item, img, info, res)
    if tile is None: return res, None, None
    ref = A.reference_rgb(t); cls = A.class_ids(t)
    reg = registration(ref, tile); res.metrics['registration'] = reg
    comp = item['files']['composition']
    if reg['peak'] < T['peak_min']:
        res.fail('registration', f'image does not register with the reference (correlation peak {reg["peak"]:.3f})',
                 f'The image does not follow the layout of {comp}: paint over that exact composition (same camera, framing and buildings).')
    elif max(abs(reg['dx']), abs(reg['dy'])) > T['shift_px']:
        res.fail('translation', f'shifted by ({reg["dx"]:+.1f}, {reg["dy"]:+.1f}) px',
                 f'The whole image is offset by {reg["dx"]:+.0f} px horizontally and {reg["dy"]:+.0f} px vertically from {comp}. '
                 'Keep its framing exactly: every roof edge, road and tree on the same pixel.')
    if 'scale' in reg:
        if abs(reg['scale'] - 1) > T['scale_dev'] or abs(reg['rot_deg']) > T['rot_deg']:
            res.fail('camera', f'scale {reg["scale"]:.3f}, rotation {reg["rot_deg"]:+.2f} deg',
                     f'The image is scaled x{reg["scale"]:.3f} and rotated {reg["rot_deg"]:+.2f} deg relative to {comp} (camera or zoom '
                     'changed). Use exactly the reference camera: same scale, no rotation, no perspective.')
        elif reg['displaced']:
            res.fail('displacement', f'{len(reg["displaced"])} block(s) displaced > {T["local_px"]:.0f} px',
                     'Parts of the image are displaced (yellow boxes in the marked image): put buildings and streets back on the '
                     'reference positions.')
    else:
        res.warn('registration', f'only {reg["blocks"]} textured blocks - no camera/scale estimate')

    B = A.class_boundaries(cls)
    near_ref, near_ret = edges_near(ref), edges_near(tile)
    g_ref, g_ret = agreement(B, near_ref), agreement(B, near_ret)
    geom = {'ref': round(g_ref, 3), 'art': round(g_ret, 3), 'rel': round(rel(g_ret, g_ref) or 0, 3)}
    cells = []
    for cy in range(0, F(), 128):
        for cx in range(0, F(), 128):
            b = np.zeros_like(B); b[cy:cy + 128, cx:cx + 128] = B[cy:cy + 128, cx:cx + 128]
            if b.sum() < 300: continue
            r_ = rel(agreement(b, near_ret), agreement(b, near_ref))
            if r_ is not None and r_ < T['cell_rel']: cells.append([cx, cy, round(r_, 2)])
    geom['bad_cells'] = cells; res.metrics['geometry'] = geom
    if geom['rel'] < T['geom_rel']:
        res.fail('geometry', f'class-boundary agreement {geom["rel"]:.2f} of the reference (< {T["geom_rel"]})',
                 f'Edges of roofs, roads, paths and water do not follow {comp}: redraw them on the reference outlines.')
    if len(cells) >= 3:
        res.fail('geometry-cells', f'{len(cells)} of 64 cells disagree with the class map',
                 'In the yellow-boxed areas of the marked image the geometry differs from the reference: redraw those areas on the '
                 'reference outlines.')
    elif cells:
        res.warn('geometry-cells', f'{len(cells)} cell(s) with weak agreement: {cells}')

    lab_ref, lab_ret = A.rgb_to_lab(ref), A.rgb_to_lab(tile)
    blds = building_checks(t, near_ref, near_ret, lab_ref, lab_ret)
    res.metrics['buildings'] = [{k: v for k, v in b.items() if k != 'mask'} for b in blds]
    for b in blds:
        if not b['bad']: continue
        what = (f'{b["name"]} (around x={b["centroid"][0]}, y={b["centroid"][1]}): roof outline score {b["outline_rel"]}, '
                f'roof contrast {b["contrast_rel"]} of the reference')
        if b['landmark'] or b['area'] >= T['bld_fail_px']:
            res.fail('building', what, f'{b["name"]} (red outline in the marked image, around x={b["centroid"][0]}, '
                     f'y={b["centroid"][1]}) is missing, merged or misplaced: paint it exactly on its reference footprint, roof outline '
                     'and height.')
        else:
            res.warn('building', what)

    sh = shadow_check(t, ref, tile); res.metrics['shadow'] = sh
    if sh and sh['ref'] < 0.85:
        if sh['art'] > T['shadow_fail']:
            res.fail('shadow', f'no darkening where the reference casts shadows (ratio {sh["art"]}, reference {sh["ref"]})',
                     'Cast shadows are missing or fall the wrong way: sun from the lower left, shadows toward the upper right, '
                     'same length and direction as in the reference.')
        elif sh['art'] > T['shadow_warn']:
            res.warn('shadow', f'weak shadows where the reference has them (ratio {sh["art"]}, reference {sh["ref"]})')

    st = style_check(t, tile, cls); res.metrics['style'] = st
    if st:
        style_name = f'the accepted tile(s) {", ".join(st["against"])}'
        worst, worst_de = max(st['dE'].items(), key=lambda kv: kv[1]) if st['dE'] else ('overall', 0)
        if (st['dE_mean'] or 0) > T['de_fail'] or worst_de > T['de_group_fail']:
            res.fail('style', f'mean class colour difference dE {st["dE_mean"]} (worst: {worst} {worst_de}), histogram {st["hist"]}',
                     f'Colours and light differ from {style_name} (most in "{worst}" areas): match their palette, saturation and '
                     'brightness exactly.')
        elif st['hist'] > T['hist_warn'] or (st['dE_mean'] or 0) > T['de_warn']:
            res.warn('style', f'colour distance: histogram {st["hist"]}, dE mean {st["dE_mean"]} (worst: {worst} {worst_de})')

    seams = seam_checks(t, tile); res.metrics['seams'] = seams
    for s in seams:
        if s['bad']:
            res.fail('seam', f'{s["side"]} edge vs accepted {s["neighbour"]}: gradient x{s["grad_ratio"]}, step x{s["step_ratio"]}',
                     f'The {s["side"]} edge does not continue the finished neighbour tile {s["neighbour"]} (visible join, worst along '
                     f'{s["worst"][:3]} px): match colours and continue every feature across the edge; the black mask area is the truth.')

    if item['output']['mode'] == 'context':
        pdir = A.sp('requests', rec['id'])
        ctx_p, mask_p = os.path.join(pdir, item['files']['composition']), os.path.join(pdir, item['files']['mask'])
        if os.path.exists(ctx_p) and os.path.exists(mask_p):
            kd = keep_drift(np.asarray(Image.open(ctx_p).convert('RGB')), np.asarray(Image.open(mask_p).convert('L')), full)
            res.metrics['keep'] = kd
            if kd and max(abs(kd['dx']), abs(kd['dy'])) > T['keep_px']:
                res.fail('keep-drift', f'kept margin moved ({kd["dx"]:+.1f}, {kd["dy"]:+.1f}) px',
                         'The kept (black-mask) area moved: do not shift, rescale or re-frame the canvas.')
            elif kd and kd['mad'] > T['keep_mad_warn']:
                res.warn('keep-drift', f'kept margin repainted (mean abs diff {kd["mad"]}) - discarded by the crop, check the seams')
        else:
            res.warn('keep-drift', 'packet files missing - kept-margin drift not checked')
    if any(f['check'] in ('registration', 'translation', 'camera') for f in res.failures):
        # a global offset / camera change misaligns everything: report the cause, keep the consequences as notes
        follow = [f for f in res.failures if f['check'] in ('geometry', 'geometry-cells', 'building', 'displacement')]
        res.failures = [f for f in res.failures if f not in follow]
        res.warnings = [w for w in res.warnings if w['check'] not in ('geometry-cells', 'building')]
        if follow:
            res.warn('consequence', f'{len(follow)} geometry/building check(s) also fail - expected from the global misregistration: '
                     + '; '.join(f['detail'] for f in follow[:4]) + (' ...' if len(follow) > 4 else ''))
    overlays = {'B': B, 'near': near_ret, 'buildings': [b for b in blds if b['bad']], 'cells': cells, 'reg': reg, 'seams': seams}
    return res, tile, overlays


# ----------------------------------------------------------------------------------------------- QA of a seam item
def qa_seam(item, img, info):
    res = Result(); o = item['output']
    W, H = img.size
    if W != H or W < R.SEAM_WINDOW:
        res.fail('size', f'{W}x{H}', f'Return exactly {R.SEAM_WINDOW}x{R.SEAM_WINDOW} px (or a larger square).')
        return res, None, None
    if info.get('alpha_min') is not None and info['alpha_min'] < 250:
        res.fail('transparency', f'min alpha {info["alpha_min"]}', 'Fill the whole frame - no transparent pixels.')
    win = np.asarray(A.resample_square(img, R.SEAM_WINDOW))
    geo = {'x0': o['window'][0], 'y0': o['window'][1], 'joins': o['joins'], 'tiles': o['tiles'], 'kind': o['kind']}
    base, _ = A.mosaic(geo['x0'], geo['y0'], R.SEAM_WINDOW, R.SEAM_WINDOW)
    mask = R.seam_mask(geo, o['band'])
    kd = keep_drift(base, mask, win); res.metrics['keep'] = kd
    if kd and max(abs(kd['dx']), abs(kd['dy'])) > 2:
        res.fail('keep-drift', f'kept area moved ({kd["dx"]:+.1f}, {kd["dy"]:+.1f}) px', 'Do not shift or rescale the window.')
    if kd and kd['mad'] > T['seam_keep_mad']:
        res.fail('keep-changed', f'kept area changed (mean abs diff {kd["mad"]})',
                 'Only the white band may change; everything in the black area must stay pixel-identical.')
    comp = composite_seam(base, win, mask)
    cls = A.mosaic_classes(geo['x0'], geo['y0'], R.SEAM_WINDOW, R.SEAM_WINDOW)
    band = A.dilate(mask > 0, 2)
    B = A.class_boundaries(cls) & band
    g = rel(agreement(B, edges_near(comp)), agreement(B, edges_near(A.mosaic(geo['x0'], geo['y0'], R.SEAM_WINDOW, R.SEAM_WINDOW, False)[0])))
    res.metrics['geometry'] = {'band_rel': None if g is None else round(g, 3)}
    if g is not None and g < T['geom_rel']:
        res.fail('geometry', f'band geometry agreement {g:.2f} of the reference',
                 'Inside the band, roofs, roads and paths must stay on the reference outlines (see the _ref image).')
    after = R.seam_profiles(geo, comp); before = item.get('before') or R.seam_profiles(geo, base)
    res.metrics['seams'] = [{'tiles': a['tiles'], 'before': [b['grad_ratio'], b['step_ratio']], 'after': [a['grad_ratio'], a['step_ratio']]}
                            for a, b in zip(after, before)]
    for a in after:
        if a['grad_ratio'] > T['seam_ratio'] or a['step_ratio'] > T['seam_ratio']:
            res.fail('seam', f'join {a["tiles"][0]} | {a["tiles"][1]} still visible: gradient x{a["grad_ratio"]}, step x{a["step_ratio"]}',
                     f'The join between {a["tiles"][0]} and {a["tiles"][1]} is still visible: blend colour and brightness smoothly '
                     'and continue every feature straight across the line.')
    edges = band_edge_profiles(geo, comp, o['band'])
    res.metrics['band_edges'] = edges
    if any(e > T['seam_ratio'] for e in edges):
        res.fail('band-edge', f'band edges visible (gradient ratios {edges})',
                 'The edges of the repainted band show: the band must fade into the untouched art with no visible boundary.')
    return res, comp, {'geo': geo, 'mask': mask, 'after': after, 'win': win}


def composite_seam(base, win, mask):
    """Feathered composite: repainted band from `win`, everything else from the accepted art `base`."""
    a = A.box_blur(A.box_blur((mask > 0).astype(np.float32), 4), 4)[..., None] * (mask > 0)[..., None]
    return (A.to_float(win) * a + A.to_float(base) * (1 - a) + 0.5).astype(np.uint8)


def band_edge_profiles(geo, comp, band):
    out = []
    for jn in geo['joins']:
        for at in (jn['at'] - band, jn['at'] + band):
            ax = jn['axis']
            m = A.seam_metrics(comp[:, :at], comp[:, at:], 'vertical') if ax == 'vertical' else A.seam_metrics(comp[:at], comp[at:], 'horizontal')
            out.append(m['grad_ratio'])
    return sorted(set(out))


# ----------------------------------------------------------------------------------------------- reports
def panel(img, size=768):
    return Image.fromarray(img).resize((size, size), Image.BOX)


def overlay_image(tile, ov):
    """Greyed art with class boundaries: green = matched by an image edge, red = no edge nearby."""
    g = (A.gray(tile) * 0.45 + 70).astype(np.uint8)
    out = np.stack([g, g, g], -1)
    B, near = ov['B'], ov['near']
    out[B & near] = (40, 220, 80); out[B & ~near] = (240, 40, 40)
    return out


def marked_image(tile, ov, res):
    """The art as received with the problems drawn on it (used in QA reports and revision packets)."""
    im = Image.fromarray(tile).copy(); d = ImageDraw.Draw(im)
    for b in ov['buildings']:
        edge = b['mask'] & A.dilate(~b['mask'], 2)
        arr = np.asarray(im).copy(); arr[A.dilate(edge, 1)] = (255, 30, 30); im = Image.fromarray(arr); d = ImageDraw.Draw(im)
        A.label(d, (b['bbox'][0], max(0, b['bbox'][1] - 26)), f'{b["name"]}: restore', size=15, bg=(200, 20, 20))
    for cx, cy, _r in ov['cells']:
        d.rectangle([cx + 2, cy + 2, cx + 125, cy + 125], outline=(255, 220, 0), width=4)
    for x, y, dx, dy in ov['reg'].get('displaced', []):
        d.rectangle([x - 126, y - 126, x + 125, y + 125], outline=(255, 220, 0), width=3)
        A.label(d, (x - 120, y - 120), f'moved {dx:+.0f},{dy:+.0f} px', size=14, bg=(120, 100, 0))
    for s in ov['seams']:
        if not s['bad']: continue
        bar = {'left': [0, 0, 7, F() - 1], 'right': [F() - 8, 0, F() - 1, F() - 1], 'top': [0, 0, F() - 1, 7],
               'bottom': [0, F() - 8, F() - 1, F() - 1]}[s['side']]
        d.rectangle(bar, fill=(255, 30, 30))
        A.label(d, (bar[0] + 14 if s['side'] != 'right' else F() - 330, bar[1] + 14 if s['side'] != 'bottom' else F() - 40),
                f'visible join with {s["neighbour"]}', size=15, bg=(200, 20, 20))
    reg = ov['reg']
    if any(f['check'] in ('translation', 'registration', 'camera') for f in res.failures):
        A.label(d, (14, 40), f'shifted {reg["dx"]:+.1f}, {reg["dy"]:+.1f} px / scale {reg.get("scale", "?")} / rot {reg.get("rot_deg", "?")} deg - '
                'keep the reference framing', size=16, bg=(200, 20, 20))
    return im


def write_report(rec, key, entry, res, tile_or_win, ov, ref_img, out_dir):
    """QA_<item>.md + QA_<item>.png (reference | returned | edge overlay or keep mask)."""
    head = 40
    W = 768
    if res.metrics.get('geometry') is not None and ov and 'B' in ov:
        third = overlay_image(tile_or_win, ov)
    elif ov and 'mask' in ov:
        third = np.where((ov['mask'] > 0)[..., None], tile_or_win, (A.to_float(tile_or_win) * 0.35).astype(np.uint8))
    else:
        third = None
    imgs = [ref_img] + ([tile_or_win] if tile_or_win is not None else []) + ([third] if third is not None else [])
    sheet = Image.new('RGB', (W * len(imgs), W + head), (24, 26, 30)); d = ImageDraw.Draw(sheet)
    names = ['reference', 'returned (as cut)', 'class edges: green matched / red missing' if ov and 'B' in ov else 'band (kept area dimmed)']
    for n, (im, nm) in enumerate(zip(imgs, names)):
        sheet.paste(panel(im, W), (n * W, head))
        d.text((n * W + 12, 10), nm, font=A.font(18, True), fill=(255, 255, 255))
    d.text((W * len(imgs) - 170, 10), res.verdict.upper(), font=A.font(20, True), fill=(90, 220, 110) if res.verdict == 'pass' else (255, 80, 80))
    tag = f'{key}_{entry["sha256"][:8]}'   # one report per returned file; QA_<item>.* is a copy of the latest
    png = os.path.join(out_dir, f'QA_{tag}.png'); sheet.save(png, optimize=True)
    L = [f'# QA {rec["id"]} / {key}: **{res.verdict.upper()}**', '',
         f'- File: `{entry["file"]}` (stored as `{entry["stored"]}`), sha256 `{entry["sha256"][:12]}`, {entry["format"]} {entry["size"][0]}x{entry["size"][1]}',
         f'- Imported {entry["utc"]}; model reported: {entry["model_reported"]}; settings: {entry["settings_reported"]}',
         f'- Side-by-side: `{os.path.basename(png)}`', '']
    if res.failures:
        L += ['## Failures', ''] + [f'- **{f["check"]}**: {f["detail"]}  \n  Fix: {f["fix"]}' for f in res.failures] + ['']
    if res.warnings:
        L += ['## Warnings', ''] + [f'- **{w["check"]}**: {w["detail"]}' for w in res.warnings] + ['']
    m = res.metrics
    L += ['## Measurements', '', '| Check | Value | Threshold |', '|---|---|---|']
    if 'size' in m: L.append(f'| size | {m["size"]["returned"]} for {m["size"]["expected"]} (k = {m["size"]["k"]}) | same aspect, tile mode >= 1024 |')
    if 'registration' in m:
        r = m['registration']
        L.append(f'| translation | ({r["dx"]:+.2f}, {r["dy"]:+.2f}) px, peak {r["peak"]} | <= {T["shift_px"]} px, peak >= {T["peak_min"]} |')
        if 'scale' in r:
            L.append(f'| camera (block field, {r["blocks"]} blocks) | scale {r["scale"]}, rot {r["rot_deg"]} deg, max residual {r["max_resid"]} px | '
                     f'scale +-{T["scale_dev"]}, rot +-{T["rot_deg"]} deg, residual <= {T["local_px"]} px |')
    if 'geometry' in m:
        g = m['geometry']
        if 'rel' in g:
            L.append(f'| geometry (class boundaries vs edges) | {g["art"]} vs reference {g["ref"]} -> {g["rel"]} | >= {T["geom_rel"]}; cells >= {T["cell_rel"]} |')
            L.append(f'| weak cells | {len(g["bad_cells"])} | < 3 |')
        else:
            L.append(f'| band geometry | {g["band_rel"]} | >= {T["geom_rel"]} |')
    if m.get('shadow'): L.append(f'| shadow (L shadow / L lit) | {m["shadow"]["art"]} (reference {m["shadow"]["ref"]}) | <= {T["shadow_warn"]} (fail > {T["shadow_fail"]}) |')
    if 'style' in m:
        s = m['style']
        L.append('| style | ' + ('no accepted tiles yet - this tile sets the style' if not s else
                                 f'hist {s["hist"]}, dE mean {s["dE_mean"]} {s["dE"]} vs {s["against"]}') +
                 f' | hist <= {T["hist_warn"]} (warn), dE mean <= {T["de_warn"]} / {T["de_fail"]}, any class <= {T["de_group_fail"]} |')
    for s in m.get('seams', []):
        if 'side' in s:
            L.append(f'| seam {s["side"]} vs {s["neighbour"]} | gradient x{s["grad_ratio"]}, step x{s["step_ratio"]} | <= {T["seam_ratio"]} |')
        else:
            L.append(f'| seam {s["tiles"][0]} / {s["tiles"][1]} | before {s["before"]} -> after {s["after"]} | <= {T["seam_ratio"]} |')
    if not m.get('seams') and 'registration' in m: L.append('| seams | no accepted neighbours yet | - |')
    if m.get('keep'): L.append(f'| kept area drift | ({m["keep"]["dx"]:+.2f}, {m["keep"]["dy"]:+.2f}) px, mean abs diff {m["keep"]["mad"]} | <= {T["keep_px"]} px |')
    if 'band_edges' in m: L.append(f'| band edges | {m["band_edges"]} | <= {T["seam_ratio"]} |')
    if m.get('buildings'):
        L += ['', '## Buildings (visible roof >= 1500 px)', '', '| Building | Landmark | Roof px | Outline vs ref | Contrast vs ref | OK |', '|---|---|---:|---:|---:|---|']
        for b in m['buildings']:
            L.append(f'| {b["name"]} | {"yes" if b["landmark"] else ""} | {b["area"]} | {b["outline_rel"]} | {b["contrast_rel"]} | {"no" if b["bad"] else "yes"} |')
    L += ['', '## Human review (automatic checks cannot judge these)', '',
          '- [ ] Pixel-art quality: crisp clusters, readable windows, recognisable roofs, no smudges or AI artefacts',
          '- [ ] Materials: concrete / brick / glass match the real buildings; trees and lawns look like late summer',
          '- [ ] Light: sun from the lower left, shadows toward the upper right, same as neighbouring tiles',
          '- [ ] No text, labels, borders or vignettes; frame filled edge to edge']
    md = os.path.join(out_dir, f'QA_{tag}.md')
    with open(md, 'w') as f:
        f.write('\n'.join(L) + '\n')
    shutil.copyfile(png, os.path.join(out_dir, f'QA_{key}.png'))
    with open(os.path.join(out_dir, f'QA_{key}.md'), 'w') as f:
        f.write('\n'.join(L).replace(f'`{os.path.basename(png)}`', f'`{os.path.basename(png)}` (latest copy: `QA_{key}.png`)') + '\n')
    return md, png


# ----------------------------------------------------------------------------------------------- accept
def accept_tile(rec, key, item, tile, entry, forced):
    t = key
    path = A.save_png(tile, A.accepted_path(t))
    meta = A.load_tiles_meta()
    prev = meta.get(t)
    meta[t] = {'version': A.sha_file(path)[:12], 'batch': rec['id'], 'model_reported': entry['model_reported'],
               'settings_reported': entry['settings_reported'], 'prompt_sha': item['prompt_sha'],
               'reference_sha': item['reference']['composition'],
               'reference_files': {k: item['reference'][k] for k in A.REFERENCE_FILES if k in item['reference']},
               'accepted_utc': A.utc_now(), 'source_file': entry['stored'],
               'source_sha256': entry['sha256'], 'qa_verdict': entry['verdict'], 'forced': forced,
               'history': ((prev or {}).get('history', []) + [{k: v for k, v in prev.items() if k != 'history'}]) if prev else []}
    A.save_tiles_meta(meta)
    return [t]


def accept_seam(rec, item, comp, entry, forced):
    o = item['output']; x0, y0 = o['window']; meta = A.load_tiles_meta(); changed = []
    for t in o['tiles']:
        i, j = A.parse_tid(t)
        art = A.accepted_rgb(t).copy()
        ax0, ay0 = max(x0, i * F()), max(y0, j * F()); ax1, ay1 = min(x0 + R.SEAM_WINDOW, (i + 1) * F()), min(y0 + R.SEAM_WINDOW, (j + 1) * F())
        art[ay0 - j * F():ay1 - j * F(), ax0 - i * F():ax1 - i * F()] = comp[ay0 - y0:ay1 - y0, ax0 - x0:ax1 - x0]
        path = A.save_png(art, A.accepted_path(t))
        prev = meta[t]
        meta[t] = dict(prev, version=A.sha_file(path)[:12], batch=rec['id'], accepted_utc=A.utc_now(), forced=forced,
                       seam={'source_file': entry['stored'], 'source_sha256': entry['sha256'], 'model_reported': entry['model_reported'],
                             'settings_reported': entry['settings_reported'], 'prompt_sha': item['prompt_sha']},
                       history=prev.get('history', []) + [{k: v for k, v in prev.items() if k != 'history'}])
        changed.append(t)
    A.save_tiles_meta(meta)
    return changed


def store_original(bid, src):
    d = A.sp('returned', bid); os.makedirs(d, exist_ok=True)
    name = os.path.basename(src); dst = os.path.join(d, name); n = 2
    sha = A.sha_file(src)
    while os.path.exists(dst) and A.sha_file(dst) != sha:
        stem, ext = os.path.splitext(name); dst = os.path.join(d, f'{stem}_r{n}{ext}'); n += 1
    if not os.path.exists(dst): shutil.copy2(src, dst)
    return dst, sha


def batch_status(rec):
    st = [it['status'] for it in rec['items'].values()]
    if all(s == 'accepted' for s in st): return 'complete'
    if 'revision-needed' in st: return 'revision-needed'
    if 'received' in st or 'accepted' in st: return 'received'
    return rec['status'] if rec['status'] in ('draft', 'requested') else 'requested'


def run_qa(rec, key, item, stored):
    """Decode + QA one stored return. Returns (res, info, cut, ov, ref_img); never raises for a bad image."""
    cut = ov = None
    try:
        img, info = A.read_image(stored)
    except ValueError as e:
        res = Result(); res.fail('decode', str(e), 'Send the original PNG file (not a screenshot or a link).')
        info = {'format': '?', 'size': [0, 0]}; img = None
    if img is not None:
        try:
            if item['output']['mode'] == 'seam':
                res, cut, ov = qa_seam(item, img, info)
            else:
                res, cut, ov = qa_tile(rec, key, item, img, info)
        except (ValueError, OSError) as e:   # e.g. PIL refusing a crop box: record it as this file's failure
            res = Result(); cut = ov = None
            res.fail('size', f'{img.width}x{img.height}: {type(e).__name__}: {e}',
                     f'Return exactly {item["output"]["width"]}x{item["output"]["height"]} px (or a larger image with the same '
                     'aspect ratio) - do not crop or pad.')
    if item['output']['mode'] == 'seam':
        ref_img = A.mosaic(*item['output']['window'], R.SEAM_WINDOW, R.SEAM_WINDOW, use_accepted=False)[0]
    else:
        ref_img = A.reference_rgb(key) if A.has_reference(key) else np.zeros((F(), F(), 3), np.uint8)
    return res, info, cut, ov, ref_img


def make_fix(item, res, cut, ov):
    if cut is None: prev = marked = None
    elif 'B' in ov: prev, marked = cut, marked_image(cut, ov, res)
    else: prev, marked = ov['win'], R.seam_marked(ov['win'], ov['geo'], item['output']['band'], ov['after'])
    return {'prev': prev, 'marked': marked, 'corrections': [f['fix'] for f in res.failures]}


def stored_path(entry):
    return os.path.join(A.ROOT, entry['stored']) if not os.path.isabs(entry['stored']) else entry['stored']


def resolve_parents(batches, rec, key, bid):
    """A revision resolves the item in every batch up its parent chain (B001R2 -> B001R1 -> B001)."""
    seen, pid = {rec['id']}, rec.get('parent')
    while pid and pid not in seen and pid in batches['batches']:
        seen.add(pid)
        prec = batches['batches'][pid]
        p = prec['items'].get(key)
        if p and p['status'] != 'accepted': p['status'] = 'accepted'; p['accepted'] = {'via': bid, 'utc': A.utc_now()}
        prec['status'] = batch_status(prec)
        pid = prec.get('parent')


# ----------------------------------------------------------------------------------------------- main flow
def process(bid, folder, accept=False, force=False, only=None, model=None, settings=None, reprocess=False,
            publish=True, revision=True):
    batches = A.load_batches()
    if bid not in batches['batches']: raise SystemExit(f'unknown batch {bid} (see python3 pipeline/art_request.py status)')
    rec = batches['batches'][bid]
    if rec['status'] == 'draft': print(f'warning: {bid} is still a DRAFT packet (dependencies were not accepted when it was built)')
    found, unmatched = match_files(rec, folder)
    for u in unmatched: print(f'  unmatched file (not an expected name for {bid}): {u}')
    report = read_report(rec, folder, model, settings)
    out_dir = A.sp('returned', bid); os.makedirs(out_dir, exist_ok=True)
    fixes, accepted = {}, []
    for key in rec['order']:
        if only and key not in only: continue
        item = rec['items'][key]
        seen = {e['sha256'] for e in item['received']}
        todo = [p for p in found.get(key, []) if reprocess or A.sha_file(p) not in seen]
        for p in found.get(key, []):
            if p not in todo: print(f'  {key}: {os.path.basename(p)} already processed (sha256 match) - skipped')
        changed = A.reference_changes(key, item)
        if changed and (todo or accept) and item['status'] != 'accepted':
            msg = (f'  {key}: the reference changed since packet rev {rec.get("packet_rev", "?")} was built '
                   f'({"; ".join(changed)})')
            if not force:
                print(msg + ' - not imported/accepted. Rebuild and resend the packet, or pass --force to QA against the '
                      'current reference.')
                continue
            print(msg + ' - continuing because of --force')
        for p in todo:
            stored, sha = store_original(bid, p)
            entry = {'file': os.path.basename(p), 'stored': A.rel(stored), 'sha256': sha, 'utc': A.utc_now(),
                     'model_reported': report['model'], 'settings_reported': report['settings']}
            res, info, cut, ov, ref_img = run_qa(rec, key, item, stored)
            if changed: res.warn('reference', 'reference changed since the packet was built: ' + '; '.join(changed))
            entry.update({'format': info['format'], 'size': info['size']})
            if info.get('embedded_text'): entry['embedded_metadata'] = info['embedded_text']
            entry.update({'verdict': res.verdict, 'failures': res.failures, 'warnings': res.warnings})
            md, png = write_report(rec, key, entry, res, cut, ov, ref_img, out_dir)
            entry.update({'qa_md': A.rel(md), 'qa_png': A.rel(png)})
            item['received'].append(entry)
            item['model_reported'], item['settings_reported'] = report['model'], report['settings']
            if report.get('report_text'): item['report_text'] = report['report_text']
            item['qa'] = {'verdict': res.verdict, 'metrics': json.loads(json.dumps(res.metrics, default=float)), 'file': entry['file']}
            item['status'] = 'received' if res.verdict == 'pass' else 'revision-needed'
            print(f'  {key}: {entry["file"]} -> QA {res.verdict.upper()}' + ''.join(f'\n      - {f["check"]}: {f["detail"]}' for f in res.failures)
                  + ''.join(f'\n      ~ {w["check"]}: {w["detail"]}' for w in res.warnings) + f'\n      report: {A.rel(md)}')
            if res.verdict == 'fail' and revision:
                fixes[key] = make_fix(item, res, cut, ov)
            else:
                fixes.pop(key, None)   # a later passing return supersedes an earlier failure in the same run
            save(batches, rec)
        # accept the latest received version if it passed (or with --force)
        last = item['received'][-1] if item['received'] else None
        if accept and last and item['status'] != 'accepted' and (last['verdict'] == 'pass' or force):
            try:
                img, info = A.read_image(stored_path(last))
            except ValueError as e:
                print(f'  {key}: cannot decode {last["file"]} ({e}) - not accepted'); continue
            if item['output']['mode'] == 'seam':
                _r, comp, _o = qa_seam(item, img, info)
                accepted += accept_seam(rec, item, comp, last, forced=last['verdict'] != 'pass')
            else:
                try:
                    tile, _full = cut_tile(item, img, info, Result())
                except (ValueError, OSError) as e:
                    tile = None; print(f'  {key}: {type(e).__name__}: {e}')
                if tile is None: print(f'  {key}: cannot cut a tile from {last["file"]} - not accepted'); continue
                accepted += accept_tile(rec, key, item, tile, last, forced=last['verdict'] != 'pass')
            item['status'] = 'accepted'; item['accepted'] = {'file': last['file'], 'utc': A.utc_now(), 'forced': last['verdict'] != 'pass'}
            if fixes.pop(key, None): print(f'  {key}: accepted with --force; no revision packet')
            print(f'  {key}: ACCEPTED' + (' (forced despite QA failure)' if last['verdict'] != 'pass' else ''))
            resolve_parents(batches, rec, key, bid)
            save(batches, rec)
    if not any(found.values()) and not accept: print(f'  no files for {bid} in {folder}')
    if revision:
        # resume: a failure saved by an earlier run that stopped before its revision packet was built
        for key in rec['order']:
            if (only and key not in only) or key in fixes: continue
            it = rec['items'][key]
            last = it['received'][-1] if it['received'] else None
            if (it['status'] == 'revision-needed' and last and last['verdict'] == 'fail' and not it.get('revision_batch')
                    and (force or not A.reference_changes(key, it))):
                res, _info, cut, ov, _ref = run_qa(rec, key, it, stored_path(last))
                if res.verdict == 'fail': fixes[key] = make_fix(it, res, cut, ov)
    if fixes:
        rid = R.build_revision(bid, fixes)
        batches = A.load_batches(); rec = batches['batches'][bid]
        for key in fixes: rec['items'][key]['revision_batch'] = rid
        save(batches, rec)
        print(f'  revision packet: IMAGE_REQUEST_{rid}.md ({len(fixes)} item(s))')
    if accepted:
        if publish and A.is_default_state():
            subprocess.run([sys.executable, os.path.join(A.ROOT, 'pipeline', 'publish_tiles.py')], check=True)
        elif publish:
            print('  (publish skipped: TW_ART_DIR state copy - publish_tiles.py reads the repo art/ only)')
        refresh_drafts()
    return A.load_batches()['batches'][bid]


def save(batches, rec):
    rec['status'] = batch_status(rec); rec['updated_utc'] = A.utc_now()
    batches['batches'][rec['id']] = rec
    A.save_batches(batches)


def refresh_drafts():
    """Rebuild draft packets whose dependencies are now all accepted (their margins then show the finished art)."""
    meta = A.load_tiles_meta()
    for bid, r in A.load_batches()['batches'].items():
        if r['status'] == 'draft' and all(t in meta for t in r['depends_on']):
            print(f'  dependencies of {bid} are accepted - rebuilding its packet')
            planned = bid in R.PLAN
            R.build_batch(bid, None if planned else r['order'], None if planned else r['depends_on'], r.get('frame') or 'square',
                          None if planned else r['mode'], None if planned else r['title'])


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('batch'); ap.add_argument('folder')
    ap.add_argument('--accept', action='store_true', help='accept items whose latest file passes QA')
    ap.add_argument('--force', action='store_true', help='with --accept: accept even if QA failed (recorded as forced)')
    ap.add_argument('--only', help='comma-separated item ids')
    ap.add_argument('--model', help='model name/version reported by the agent (overrides <batch>_report.txt)')
    ap.add_argument('--settings', help='settings reported by the agent')
    ap.add_argument('--reprocess', action='store_true', help='re-run QA on files already processed')
    ap.add_argument('--no-publish', action='store_true', help='do not run publish_tiles.py after accepting')
    ap.add_argument('--no-revision', action='store_true', help='do not create a revision packet for failures')
    ap.add_argument('--state-dir', help='use this art/ state directory (also: TW_ART_DIR)')
    a = ap.parse_args(argv)
    if a.state_dir: os.environ['TW_ART_DIR'] = os.path.abspath(a.state_dir)
    if not os.path.isdir(a.folder): raise SystemExit(f'not a directory: {a.folder}')
    rec = process(a.batch, a.folder, a.accept, a.force, set(a.only.split(',')) if a.only else None, a.model, a.settings,
                  a.reprocess, not a.no_publish, not a.no_revision)
    print(f'{a.batch}: {rec["status"]} - ' + ', '.join(f'{k} {it["status"]}' for k, it in rec['items'].items()))


if __name__ == '__main__':
    main()
