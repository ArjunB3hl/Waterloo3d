"""Publish-time repaint overlays: small image-model fixes applied on top of the harmonised art.

An overlay is a window of the map (a box in canvas px) that an image model repainted, plus a soft mask saying which
part of the window is used. publish_tiles applies accepted overlays after harmonize_art, so the input the model saw is
exactly what the viewer shows. art/accepted is never changed; removing an entry from art/overlays.json undoes it.

  python3 pipeline/art_overlay.py make <id> --box x0,y0,w,h (--seam v|h [--core 72 --band 150] | --cls parking [--grow 8])
                                           [--send-px 2048] --note "what to change"
      -> art/overlays/<id>_input.png (the window, upscaled to --send-px for the model), <id>_mask.png, and a record.
  python3 pipeline/art_overlay.py qa <id> <returned file>          checks only, writes art/overlays/<id>_qa.png
  python3 pipeline/art_overlay.py accept <id> <returned file> --model M [--provider P] [--generation G] [--force]
  python3 pipeline/art_overlay.py list

Checks on a return (all at window size): aspect, global shift against the input (phase correlation), per-block shift,
drift in the kept area, colour agreement where the mask fades out, and structure agreement inside the mask.
"""
import os, sys, json, argparse, hashlib, shutil, time
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from world import cfg, ROOT, F
from classes import CLS
import harmonize_art as H

DIR = os.path.join(ROOT, 'art', 'overlays')
REC = os.path.join(ROOT, 'art', 'overlays.json')
HARM = os.path.join(ROOT, 'data_cache', 'harmonized')      # written by publish_tiles (harmonised, before overlays)
T = {'colour_sigma': 40.0, 'shift_px': 1.5, 'block_shift_px': 3.0, 'edge_diff': 14.0, 'min_ncc': 0.15}


def load():
    return json.load(open(REC)) if os.path.exists(REC) else {'overlays': []}


def save(d):
    os.makedirs(DIR, exist_ok=True); json.dump(d, open(REC, 'w'), indent=1)


def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()[:12]


def _tiles(box):
    x0, y0, w, h = box
    return [(i, j) for j in range(y0 // F(), (y0 + h - 1) // F() + 1) for i in range(x0 // F(), (x0 + w - 1) // F() + 1)]


def mosaic(box, get):
    """Assemble box (canvas px) from per-tile arrays; get(tile id) -> HxW[xC] array or None."""
    x0, y0, w, h = box; out = None
    for i, j in _tiles(box):
        a = get(f'{i}_{j}')
        if a is None: raise SystemExit(f'tile {i}_{j} is not available for box {box}')
        if out is None: out = np.zeros((h, w) + a.shape[2:], a.dtype)
        tx, ty = i * F(), j * F()
        ax0, ay0, ax1, ay1 = max(x0, tx), max(y0, ty), min(x0 + w, tx + F()), min(y0 + h, ty + F())
        out[ay0 - y0:ay1 - y0, ax0 - x0:ax1 - x0] = a[ay0 - ty:ay1 - ty, ax0 - tx:ax1 - tx]
    return out


def harmonised(t):
    p = os.path.join(HARM, f'{t}.png')
    return np.asarray(Image.open(p).convert('RGB')) if os.path.exists(p) else None


def classes(t):
    for p in (os.path.join(ROOT, 'art', 'accepted', 'layers', t, 'cls.png'), os.path.join(ROOT, 'data_cache', 'jobs', t, 'cls.png')):
        if os.path.exists(p): return np.asarray(Image.open(p).convert('RGB'))[..., 0]
    return None


def seam_mask(w, h, axis, core, band):
    d = np.abs((np.arange(w if axis == 'v' else h) + 0.5) - (w if axis == 'v' else h) / 2)
    prof = np.where(d <= core, 1.0, 0.5 * (1 + np.cos(np.pi * np.clip((d - core) / (band - core), 0, 1))))
    # fade out towards the two ends of the join too, so the overlay never meets the window edge at full strength
    along = np.arange(h if axis == 'v' else w) + 0.5; n = len(along)
    ends = np.clip(np.minimum(along, n - along) / 48.0, 0, 1)
    m = np.outer(ends, prof) if axis == 'v' else np.outer(prof, ends)
    return (m * 255).round().astype(np.uint8)


def make(a):
    box = [int(v) for v in a.box.split(',')]; x0, y0, w, h = box
    win = mosaic(box, harmonised)
    if a.seam:
        mask = seam_mask(w, h, a.seam, a.core, a.band); kind = 'seam'
    else:
        cls = mosaic(box, classes)
        m = Image.fromarray(((cls == CLS[a.cls]) * 255).astype(np.uint8))
        m = m.filter(ImageFilter.MaxFilter(2 * a.grow + 1)).filter(ImageFilter.GaussianBlur(a.grow / 2))
        mask = np.asarray(m); kind = 'region'
    os.makedirs(DIR, exist_ok=True)
    s = a.send_px
    Image.fromarray(win).resize((s * w // max(w, h), s * h // max(w, h)), Image.LANCZOS).save(os.path.join(DIR, f'{a.id}_input.png'))
    Image.fromarray(win).save(os.path.join(DIR, f'{a.id}_window.png'))
    Image.fromarray(mask).save(os.path.join(DIR, f'{a.id}_mask.png'))
    d = load(); d['overlays'] = [o for o in d['overlays'] if o['id'] != a.id]
    d['overlays'].append({'id': a.id, 'kind': kind, 'box': box, 'status': 'requested', 'note': a.note,
                          'seam': a.seam, 'cls': None if a.seam else a.cls, 'keep_colour': bool(a.seam), 'created_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                          'window_sha': sha(os.path.join(DIR, f'{a.id}_window.png')), 'tiles': [f'{i}_{j}' for i, j in _tiles(box)]})
    save(d); print(f'{a.id}: window {w}x{h} at ({x0},{y0}), mask covers {100 * (mask > 127).mean():.1f}% -> art/overlays/{a.id}_input.png')


def check(rec, path):
    x0, y0, w, h = rec['box']
    img = Image.open(path).convert('RGB'); W, Hh = img.size
    res = {'returned': [W, Hh], 'fail': [], 'warn': []}
    if abs(W / Hh - w / h) > 0.01 * w / h: res['fail'].append(f'aspect {W}x{Hh} does not match the window {w}x{h}')
    raw = np.asarray(img.resize((w, h), Image.BOX if W >= w else Image.LANCZOS), np.float32)
    win = np.asarray(Image.open(os.path.join(DIR, f'{rec["id"]}_window.png')).convert('RGB'), np.float32)
    # Image models drift in overall brightness / saturation. Keep the repaint's detail but take the broad colour
    # (everything coarser than ~colour_sigma px) from the current map, so the overlay does not show as a lighter patch.
    # Region overlays that are meant to change a surface colour (rec['keep_colour'] false) skip this.
    res_colour = float(np.abs(H._blur(raw, 12) - H._blur(win, 12)).mean())
    out = np.clip(raw + H._blur(win - raw, T['colour_sigma']), 0, 255) if rec.get('keep_colour', True) else raw
    mask = np.asarray(Image.open(os.path.join(DIR, f'{rec["id"]}_mask.png')).convert('L'), np.float32) / 255
    res['colour_drift_before_match'] = round(res_colour, 1)
    dx, dy = H._phase_shift(out, win); res['shift'] = [round(float(dx), 2), round(float(dy), 2)]
    if max(abs(dx), abs(dy)) > T['shift_px']: res['fail'].append(f'whole image shifted by ({dx:+.1f}, {dy:+.1f}) px')
    B = 256; worst = 0.0; blocks = []
    for by in range(0, h - B + 1, B):
        for bx in range(0, w - B + 1, B):
            if mask[by:by + B, bx:bx + B].max() < 0.05: continue
            sx, sy = H._phase_shift(out[by:by + B, bx:bx + B], win[by:by + B, bx:bx + B])
            blocks.append([bx, by, round(float(sx), 1), round(float(sy), 1)]); worst = max(worst, abs(sx), abs(sy))
    res['block_shift_max'] = round(float(worst), 2); res['blocks'] = blocks
    if worst > T['block_shift_px']: res['fail'].append(f'local shift up to {worst:.1f} px inside the mask')
    keep = mask < 0.02
    res['keep_drift'] = round(float(np.abs(out - win)[keep].mean()), 1) if keep.any() else None
    edge = (mask > 0.05) & (mask < 0.35)
    res['edge_diff'] = round(float(np.abs(H._blur(out, 2) - H._blur(win, 2))[edge].mean()), 1) if edge.any() else 0.0
    if res['edge_diff'] > T['edge_diff']: res['warn'].append(f'colour differs by {res["edge_diff"]} levels where the mask fades out')
    ok, ncc = H._block_ok(out, win, 0, 128, H.settings())
    res['structure_ncc_min'] = round(float(ncc.min()), 2); res['structure_ncc_mean'] = round(float(ncc.mean()), 2)
    if ncc.min() < T['min_ncc']: res['warn'].append(f'structure agreement drops to {ncc.min():.2f} in one 128 px row band')
    res['sharpness_ratio'] = round(H._energy(out) / H._energy(win), 2)
    comp = win * (1 - mask[..., None]) + out * mask[..., None]
    sheet = Image.new('RGB', (w * 3 + 20, h + 26), (20, 20, 24)); d = ImageDraw.Draw(sheet)
    for n, (im, name) in enumerate(((win, 'input (current map)'), (out, 'returned'), (comp, 'composite that would be published'))):
        sheet.paste(Image.fromarray(im.round().astype(np.uint8)), (n * (w + 10), 26)); d.text((n * (w + 10) + 4, 4), name, fill='white', font_size=16)
    sheet.save(os.path.join(DIR, f'{rec["id"]}_qa.png'))
    return res, out, comp


def accept(a):
    d = load(); rec = next(o for o in d['overlays'] if o['id'] == a.id)
    res, out, _ = check(rec, a.file)
    print(json.dumps({k: v for k, v in res.items() if k != 'blocks'}))
    if a.cmd == 'qa': return
    if res['fail'] and not a.force: raise SystemExit('not accepted: ' + '; '.join(res['fail']))
    os.makedirs(os.path.join(ROOT, 'art', 'returned', 'overlays'), exist_ok=True)
    stored = os.path.join('art', 'returned', 'overlays', f'{a.id}{os.path.splitext(a.file)[1].lower()}')
    shutil.copyfile(a.file, os.path.join(ROOT, stored))
    Image.fromarray(out.round().astype(np.uint8)).save(os.path.join(DIR, f'{a.id}.png'))
    rec.update({'status': 'accepted', 'model': a.model, 'provider': a.provider, 'generation_id': a.generation, 'source_file': stored,
                'source_sha256': hashlib.sha256(open(a.file, 'rb').read()).hexdigest(), 'qa': {k: v for k, v in res.items() if k != 'blocks'},
                'forced': bool(res['fail']), 'prompt': a.prompt, 'accepted_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())})
    save(d); print(f'{a.id}: accepted' + (' (FORCED)' if res['fail'] else ''))


def apply(images, verbose=True):
    """images: {tile id: PIL RGB}. Composite every accepted overlay; returns (images, ids applied)."""
    done = []
    arr = {}
    for o in load()['overlays']:
        p, mp = os.path.join(DIR, f'{o["id"]}.png'), os.path.join(DIR, f'{o["id"]}_mask.png')
        if o.get('status') != 'accepted' or not os.path.exists(p): continue
        x0, y0, w, h = o['box']
        ov = np.asarray(Image.open(p).convert('RGB'), np.float32); m = np.asarray(Image.open(mp).convert('L'), np.float32)[..., None] / 255
        for i, j in _tiles(o['box']):
            t = f'{i}_{j}'
            if t not in images: continue
            if t not in arr: arr[t] = np.asarray(images[t].convert('RGB'), np.float32).copy()
            tx, ty = i * F(), j * F()
            ax0, ay0, ax1, ay1 = max(x0, tx), max(y0, ty), min(x0 + w, tx + F()), min(y0 + h, ty + F())
            sl_t = (slice(ay0 - ty, ay1 - ty), slice(ax0 - tx, ax1 - tx)); sl_o = (slice(ay0 - y0, ay1 - y0), slice(ax0 - x0, ax1 - x0))
            arr[t][sl_t] = arr[t][sl_t] * (1 - m[sl_o]) + ov[sl_o] * m[sl_o]
        done.append(o['id'])
    out = dict(images)
    for t, v in arr.items(): out[t] = Image.fromarray(v.round().astype(np.uint8))
    if verbose and done: print(f'overlays: applied {", ".join(done)}')
    return out, done


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    m = sub.add_parser('make'); m.add_argument('id'); m.add_argument('--box', required=True)
    m.add_argument('--seam', choices=['v', 'h']); m.add_argument('--core', type=int, default=72); m.add_argument('--band', type=int, default=150)
    m.add_argument('--cls'); m.add_argument('--grow', type=int, default=8); m.add_argument('--send-px', type=int, default=2048)
    m.add_argument('--note', default='')
    for name in ('qa', 'accept'):
        q = sub.add_parser(name); q.add_argument('id'); q.add_argument('file'); q.add_argument('--model'); q.add_argument('--provider', default='ElevenLabs')
        q.add_argument('--generation'); q.add_argument('--prompt', default=''); q.add_argument('--force', action='store_true')
    sub.add_parser('list')
    a = ap.parse_args()
    if a.cmd == 'make':
        if not a.seam and not a.cls: raise SystemExit('give --seam v|h or --cls <class>')
        make(a)
    elif a.cmd == 'list':
        for o in load()['overlays']: print(o['id'], o['kind'], o['box'], o['status'], o.get('model') or '')
    else: accept(a)


if __name__ == '__main__':
    main()
