"""Even out detail and colour between neighbouring accepted tiles at publish time (art/accepted is never changed).

Every tile comes from a separate image-generation call, so neighbours differ in sharpness (measured 16-44 mean |Laplacian|)
and carry small colour steps where they meet. The 512 px / 64-colour pixel finish used to hide this; at full
resolution the tile borders show as straight lines. Two corrections, both driven only by the strips along shared edges
(where both tiles show the same ground, so content differences cancel out):

1. Detail gain per tile. For every shared edge the ratio of high-frequency energy in a strip on each side is measured;
   per-tile log gains are solved by least squares so the ratios become 1, shifted to the configured geometric mean and
   clipped. A gain g is applied as  out = blur + g * (img - blur)  (g > 1 sharpens like an unsharp mask, g < 1 softens).
   Two passes, re-measuring after the first.
2. Cross-fade. Each context-mode generation call also painted a margin around its tile, so near a shared edge there
   are two paintings of the same ground: the tile's own and its neighbour's margin. Their alignment is measured by phase
   correlation (offsets above xfade_max_shift px skip that margin), then the tile cross-fades into the neighbour's version over
   xfade_px (both sides when both margins exist, else one-sided), so no straight border line is left. Blocks where the
   two paintings disagree (normalised correlation of their 4-16 px structure below xfade_min_ncc; flat blocks always blend, e.g. where a seam
   packet repainted the border later) keep the tile's own art.
4. Seam diffusion (seam_diffuse): the step left exactly at each edge is removed with a harmonic correction.
3. Colour levelling, only where the cross-fade had nothing to blend with. Along each shared edge the mean colour of thin strips on both sides is compared in blocks; each
   tile takes half of the (smoothed, clipped) difference at the edge, fading out with a cosine over band_px.

Usage: from publish_tiles (config/world.json 'art_harmonize'); or  python3 pipeline/harmonize_art.py  for a report.
"""
import os, sys, glob, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from world import cfg, ROOT

DEFAULTS = {'enabled': True, 'detail_sigma': 1.2, 'gain_mean': 1.15, 'gain_clip': [0.85, 1.6], 'detail_strip_px': 64,
            'band_px': 256, 'strip_px': 8, 'block_px': 64, 'max_step': 30, 'passes': 2,
            'diffuse': True, 'diffuse_strip_px': 2, 'diffuse_sigma': 1.5, 'xfade': True, 'xfade_px': 192, 'xfade_min_ncc': 0.2, 'xfade_ncc_ramp': 0.2, 'xfade_flat_std': 3.0, 'xfade_max_shift': 6}


def settings():
    s = dict(DEFAULTS); s.update(cfg().get('art_harmonize') or {}); return s


def _blur(a, sigma):
    r = max(1, int(np.ceil(3 * sigma))); x = np.arange(-r, r + 1)
    k = np.exp(-x ** 2 / (2 * sigma ** 2)); k /= k.sum()
    for ax in (0, 1):                                    # separable Gaussian, edge padded
        p = np.pad(a, [(r, r) if d == ax else (0, 0) for d in range(3)], mode='edge')
        n = a.shape[ax]
        a = sum(w * np.take(p, np.arange(i, i + n), axis=ax) for i, w in enumerate(k))
    return a


def _energy(a):
    l = a.mean(-1)
    return float(np.abs(4 * l[1:-1, 1:-1] - l[:-2, 1:-1] - l[2:, 1:-1] - l[1:-1, :-2] - l[1:-1, 2:]).mean()) + 1e-6


def _edges(tiles):
    """Shared edges as (a, b, axis): axis 1 = b is right of a, axis 0 = b is below a."""
    out = []
    for k in tiles:
        i, j = map(int, k.split('_'))
        for di, dj, ax in ((1, 0, 1), (0, 1, 0)):
            n = f'{i + di}_{j + dj}'
            if n in tiles: out.append((k, n, ax))
    return out


def _strips(a, b, ax, w):
    """Strip of a and of b on either side of their shared edge, both oriented edge-along-axis-0 (shape L x w x 3)."""
    if ax == 1: return a[:, -w:], b[:, :w]
    return a[-w:].transpose(1, 0, 2), b[:w].transpose(1, 0, 2)


def detail_gains(tiles, s):
    keys = sorted(tiles); idx = {k: n for n, k in enumerate(keys)}
    rows, rhs = [], []
    for a, b, ax in _edges(tiles):
        sa, sb = _strips(tiles[a], tiles[b], ax, s['detail_strip_px'])
        r = np.zeros(len(keys)); r[idx[a]] = 1; r[idx[b]] = -1
        rows.append(r); rhs.append(np.log(_energy(sb)) - np.log(_energy(sa)))   # want x_a - x_b = log(Eb / Ea)
    if not rows: return {k: 1.0 for k in keys}
    A = np.vstack(rows + [np.full(len(keys), 1e-3)]); y = np.array(rhs + [0.0])   # tiny anchor for isolated groups
    x = np.linalg.lstsq(A, y, rcond=None)[0]
    x += np.log(s['gain_mean']) - x.mean()
    g = np.clip(np.exp(x), *s['gain_clip'])
    return {k: float(g[idx[k]]) for k in keys}


def apply_gain(a, g, sigma):
    if abs(g - 1) < 0.02: return a
    b = _blur(a, sigma)
    return np.clip(b + g * (a - b), 0, 255)


def base_sources():
    """tile -> (return path, output record) of the generation call its accepted art was cut from."""
    tiles = json.load(open(os.path.join(ROOT, 'art', 'tiles.json')))
    batches = json.load(open(os.path.join(ROOT, 'art', 'batches.json')))['batches']
    out = {}
    for t, m in tiles.items():
        src = m.get('source_file')
        for rec in batches.values():
            it = rec['items'].get(t)
            if src and it and it['output'].get('canvas_origin') is not None and \
                    any(r.get('stored') == src for r in it.get('received', [])):
                out[t] = (os.path.join(ROOT, src), it['output']); break
    return out


def _extract(src, wbox, size):
    """Region of world canvas px wbox (x0, y0, x1, y1; fractional ok) from a stored return, resampled to size (w, h);
    None when the return does not cover it."""
    img, o = src
    ox, oy = o['canvas_origin']; cw, ch = o['width'], o['height']
    x0, y0, x1, y1 = wbox[0] - ox, wbox[1] - oy, wbox[2] - ox, wbox[3] - oy
    if x0 < -0.01 or y0 < -0.01 or x1 > cw + 0.01 or y1 > ch + 0.01: return None
    kx, ky = img.width / cw, img.height / ch
    box = (max(0, x0 * kx), max(0, y0 * ky), min(img.width, x1 * kx), min(img.height, y1 * ky))
    return np.asarray(img.resize(size, Image.LANCZOS, box=box), np.float32)


def _hp(a):
    g = a.mean(-1, keepdims=True); return (g - _blur(g, 3.0))[..., 0]


def _phase_shift(a, b):
    """(dx, dy) such that a(x) ~ b(x - d)."""
    ga, gb = _hp(a), _hp(b)
    win = np.outer(np.hanning(ga.shape[0]), np.hanning(ga.shape[1]))
    R = np.fft.fft2(ga * win) * np.conj(np.fft.fft2(gb * win)); R /= np.abs(R) + 1e-9
    c = np.real(np.fft.ifft2(R)); py, px = np.unravel_index(np.argmax(c), c.shape)
    def sub(v, n, line):
        l, r = line[(v - 1) % n], line[(v + 1) % n]; m = line[v]; den = l - 2 * m + r
        off = 0.5 * (l - r) / den if abs(den) > 1e-9 else 0.0
        v = v + off; return v - n if v > n / 2 else v
    return sub(px, c.shape[1], c[py]), sub(py, c.shape[0], c[:, px])


def _bp(a):
    """Band-pass luminance (structure at roughly 4-16 px: edges of roofs, roads, trees - not texture grain)."""
    g = a.mean(-1, keepdims=True); return (_blur(g, 2.0) - _blur(g, 8.0))[..., 0]


def _block_ok(a, b, ax_along, B, s):
    """Per block of B px along the edge: 1 when the two paintings show the same structure (or the block is flat, so a
    blend cannot ghost), 0 when they clearly disagree. Returns (ok, ncc)."""
    ha, hb = _bp(a), _bp(b)
    if ax_along == 1: ha, hb = ha.T, hb.T                    # make the edge run along axis 0
    n = ha.shape[0] // B; ok = np.zeros(n); nc = np.zeros(n)
    for k in range(n):
        x, y = ha[k * B:(k + 1) * B].ravel(), hb[k * B:(k + 1) * B].ravel()
        x = x - x.mean(); y = y - y.mean()
        sx, sy = np.sqrt((x * x).mean()), np.sqrt((y * y).mean())
        nc[k] = float((x * y).mean() / (sx * sy + 1e-9))
        ok[k] = 1.0 if max(sx, sy) < s['xfade_flat_std'] else np.clip((nc[k] - s['xfade_min_ncc']) / s['xfade_ncc_ramp'], 0, 1)
    return ok, nc


SIDES = {'L': (-1, 0), 'R': (1, 0), 'T': (0, -1), 'B': (0, 1)}
OPP = {'L': 'R', 'R': 'L', 'T': 'B', 'B': 'T'}


def _side_coords(F_, side):
    """(inward distance d, along-edge index a) grids for one side of a F_ x F_ tile (pixel centres)."""
    yy, xx = np.mgrid[0:F_, 0:F_].astype(np.float32) + 0.5
    return {'L': (xx, yy), 'R': (F_ - xx, yy), 'T': (yy, xx), 'B': (F_ - yy, xx)}[side]


def crossfade(t, gains, s, srcs):
    """World-space blend: every pixel is a normalised weighted mix of all paintings that cover it (the tile's own art and
    its neighbours' margins), with weights that are continuous across tile borders and corners."""
    F_ = next(iter(t.values())).shape[0]; h = float(s['xfade_px']); B = s['block_px']
    imgs = {k: (Image.open(p).convert('RGB'), o) for k, (p, o) in srcs.items() if k in t}
    ss = lambda x: x * x * (3 - 2 * x)
    C = lambda d: ss(np.clip((d + h) / (2 * h), 0, 1))               # centred ramp: 0.5 at the border
    I = lambda d: ss(np.clip(d / h, 0, 1))                           # inside ramp: 0 at the border
    nb = lambda k, side: f'{int(k.split("_")[0]) + SIDES[side][0]}_{int(k.split("_")[1]) + SIDES[side][1]}'
    hh = int(h)
    # 1. neighbour margins into each tile, aligned, gain-matched, with per-pixel validity along the border
    ext, ok_in, report = {}, {}, []
    for k in t:
        i, j = map(int, k.split('_')); X, Y = i * F_, j * F_
        for side in SIDES:
            n = nb(k, side); ok_in[(k, side)] = np.zeros(F_, np.float32)
            if n not in t or n not in imgs: continue
            box = {'L': (X, Y, X + hh, Y + F_), 'R': (X + F_ - hh, Y, X + F_, Y + F_),
                   'T': (X, Y, X + F_, Y + hh), 'B': (X, Y + F_ - hh, X + F_, Y + F_)}[side]
            size = (hh, F_) if side in 'LR' else (F_, hh)
            own = t[k][box[1] - Y:box[3] - Y, box[0] - X:box[2] - X]
            e = _extract(imgs[n], box, size)
            if e is None: continue
            dx, dy = _phase_shift(e, own)
            if max(abs(dx), abs(dy)) > s['xfade_max_shift']: report.append((k, side, n, 'shift', dx, dy)); continue
            # no re-cropping by the measured shift: the margin must stay continuous with the neighbour's own art at
            # the border (a 1-2 px offset inside a 192 px cross-fade is invisible; larger offsets are skipped above)
            e = apply_gain(e, gains.get(n, 1.0), s['detail_sigma'])
            ok, ncc = _block_ok(e, own, 0 if side in 'LR' else 1, B, s)
            ok = np.convolve(np.pad(ok, 1, mode='edge'), [0.25, 0.5, 0.25], 'valid')
            ok_in[(k, side)] = np.interp((np.arange(F_) + 0.5) / B - 0.5, np.arange(len(ok)), ok).astype(np.float32)
            full = np.zeros_like(t[k]); full[box[1] - Y:box[3] - Y, box[0] - X:box[2] - X] = e
            ext[(k, side)] = full
            report.append((k, side, n, 'ok', float(ncc.mean()), float(ok.mean())))
    ok_out = {(k, side): ok_in.get((nb(k, side), OPP[side]), np.zeros(F_, np.float32)) for k in t for side in SIDES}
    coords = {side: _side_coords(F_, side) for side in SIDES}

    def own_ramp(k, side, d, a):
        ai = np.clip(a.astype(int), 0, F_ - 1)
        oi, oo = ok_in[(k, side)][ai], ok_out[(k, side)][ai]
        return oi * (oo * C(d) + (1 - oo) * I(d)) + (1 - oi)

    def own_weight(k):
        w = np.ones((F_, F_), np.float32)
        for side in SIDES:
            d, a = coords[side]; w *= own_ramp(k, side, d, a)
        return w
    out = {}
    for k in t:
        W = own_weight(k); num = W[..., None] * t[k]; den = W.copy()
        for side in SIDES:
            if (k, side) not in ext: continue
            n = nb(k, side); d, a = coords[side]
            m = ok_in[(k, side)][np.clip(a.astype(int), 0, F_ - 1)] * C(-d) * (d < h)
            # times the neighbour's own ramps on its two perpendicular sides at the same rows (columns); along those
            # sides p lies just past the neighbour's end that touches this tile
            end_n = np.full_like(d, F_ - 1 if side in 'LT' else 0)
            for ps in (('T', 'B') if side in 'LR' else ('L', 'R')):
                m = m * own_ramp(n, ps, coords[ps][0], end_n)
            num += m[..., None] * ext[(k, side)]; den += m
        out[k] = np.where(den[..., None] > 1e-4, num / np.maximum(den, 1e-4)[..., None], t[k])
    return out, report, ok_in


def seam_diffuse(t, s):
    """Remove the step that is left exactly at each shared edge (also when every available painting carries it, e.g.
    where an image tool's own tile met the neighbour context it reproduced). The per-row difference across the edge is
    split between both tiles and extended inwards as a harmonic (Laplace) function: a component with wavelength lam
    decays like exp(-2 pi dist / lam), so fine detail of the step is corrected within a few px and broad colour
    differences fade out smoothly over band_px. Two Jacobi passes settle the corners."""
    F_ = next(iter(t.values())).shape[0]; band = s['band_px']; w = s['diffuse_strip_px']
    L2 = 2 * F_; k = np.arange(L2 // 2 + 1)
    dist = np.arange(band, dtype=np.float32) + 0.5
    decay = np.exp(-2 * np.pi * np.outer(dist, k) / L2)                        # (band, nfreq)
    taper = (0.5 * (1 + np.cos(np.pi * np.clip(dist / band, 0, 1))))[:, None]  # keeps even k=0 inside the band
    g = np.exp(-0.5 * (np.arange(-4, 5) / s['diffuse_sigma']) ** 2); g /= g.sum()
    steps = []
    for _ in range(2):
        corr = {kk: np.zeros_like(v) for kk, v in t.items()}
        for a, b, ax in _edges(t):
            sa, sb = _strips(t[a], t[b], ax, w)
            d = sa.mean(1) - sb.mean(1)                                         # (F_, 3): a minus b along the edge
            d = np.stack([np.convolve(np.pad(d[:, c], 4, mode='edge'), g, 'valid') for c in range(3)], -1)
            d = np.clip(d, -s['max_step'] * 2, s['max_step'] * 2)
            if not _: steps.append(float(np.abs(d).mean()))
            D = np.fft.rfft(np.concatenate([d, d[::-1]], 0), axis=0)            # mirrored: no wrap-around at the ends
            f = np.stack([np.fft.irfft(D[:, c][None, :] * decay, n=L2, axis=1)[:, :F_] for c in range(3)], -1)
            f = f * taper[..., None] / 2                                        # (band, F_, 3), half to each side
            if ax == 1:
                corr[a][:, -band:] -= f[::-1].transpose(1, 0, 2); corr[b][:, :band] += f.transpose(1, 0, 2)
            else:
                corr[a][-band:] -= f[::-1]; corr[b][:band] += f
        t = {kk: np.clip(v + corr[kk], 0, 255) for kk, v in t.items()}
    return t, steps


def colour_level(tiles, s, ok_in=None):
    corr = {k: np.zeros_like(v) for k, v in tiles.items()}
    B, w, band = s['block_px'], s['strip_px'], s['band_px']
    d_edge = np.arange(band, dtype=np.float32)
    fall = 0.5 * (1 + np.cos(np.pi * d_edge / band))                 # 1 at the edge -> 0 at band px
    report = []
    for a, b, ax in _edges(tiles):
        sa, sb = _strips(tiles[a], tiles[b], ax, w)
        L = sa.shape[0]
        diff = sa.reshape(L // B, B, w, 3).mean((1, 2)) - sb.reshape(L // B, B, w, 3).mean((1, 2))   # per block
        # smooth along the edge, interpolate to every pixel, clip
        k = np.array([0.25, 0.5, 0.25]); dp = np.pad(diff, ((1, 1), (0, 0)), mode='edge')
        diff = np.stack([np.convolve(dp[:, c], k, 'valid') for c in range(3)], -1)
        xs = (np.arange(L) + 0.5) / B - 0.5
        full = np.stack([np.interp(xs, np.arange(L // B), diff[:, c]) for c in range(3)], -1)
        full = np.clip(full, -s['max_step'], s['max_step'])
        if ok_in is not None:   # only where the cross-fade had no agreeing painting to blend with
            sa_, sb_ = ('R', 'L') if ax == 1 else ('B', 'T')
            z = np.zeros(L, np.float32)
            done = np.maximum(ok_in.get((a, sa_), z), ok_in.get((b, sb_), z))
            full = full * (1 - done)[:, None]
        report.append((a, b, float(np.abs(diff).mean())))
        half = full / 2                                               # a moves by -half, b by +half
        if ax == 1:
            corr[a][:, -band:] -= half[:, None, :] * fall[::-1][None, :, None]
            corr[b][:, :band] += half[:, None, :] * fall[None, :, None]
        else:
            corr[a][-band:] -= half[None, :, :] * fall[::-1][:, None, None]
            corr[b][:band] += half[None, :, :] * fall[:, None, None]
    return {k: np.clip(tiles[k] + corr[k], 0, 255) for k in tiles}, report


def harmonize(images, verbose=True):
    """images: {tile id: PIL RGB 1024}. Returns ({tile id: PIL RGB}, info)."""
    s = settings()
    if not s.get('enabled') or len(images) < 2: return images, None
    t = {k: np.asarray(v.convert('RGB'), np.float32) for k, v in images.items()}
    total = {k: 1.0 for k in t}
    for _ in range(s['passes']):
        g = detail_gains(t, s)
        if _: g = {k: v / s['gain_mean'] for k, v in g.items()}       # later passes only even out what is left
        t = {k: apply_gain(v, g[k], s['detail_sigma']) for k, v in t.items()}
        total = {k: total[k] * g[k] for k in t}
    xrep, ok_in = [], None
    if s.get('xfade'):
        t, xrep, ok_in = crossfade(t, total, s, base_sources())
    t, rep = colour_level(t, s, ok_in)
    dsteps = []
    if s.get('diffuse'):
        t, dsteps = seam_diffuse(t, s)
    info = {'gains': {k: round(v, 3) for k, v in total.items()}, 'xfade': xrep,
            'colour_steps_before': {f'{a}|{b}': round(d, 1) for a, b, d in rep}}
    if verbose:
        gv = np.array(list(total.values()))
        print(f'harmonize: detail gains {gv.min():.2f}-{gv.max():.2f} (median {np.median(gv):.2f}); '
              f'{len(rep)} edges levelled, mean colour step {np.mean([d for *_, d in rep]):.1f} -> 0 at the edge')
        okx = [r for r in xrep if r[3] == 'ok']
        print(f'harmonize: cross-faded {len(okx)} border bands (mean agreement {np.mean([r[5] for r in okx]) if okx else 0:.2f}), '
              f'{sum(r[3] == "shift" for r in xrep)} skipped for misalignment')
        if dsteps: print(f'harmonize: seam diffusion on {len(dsteps)} edges (mean per-row step {np.mean(dsteps):.1f} -> 0)')
    return {k: Image.fromarray(v.round().astype(np.uint8)) for k, v in t.items()}, info


def seam_report(images):
    """Per-edge colour step and detail ratio (for before/after checks)."""
    t = {k: np.asarray(v.convert('RGB'), np.float32) for k, v in images.items()}
    out = []
    for a, b, ax in _edges(t):
        sa, sb = _strips(t[a], t[b], ax, 6)
        L = sa.shape[0]
        step = float(np.abs(sa.reshape(16, L // 16, 6, 3).mean((1, 2)) - sb.reshape(16, L // 16, 6, 3).mean((1, 2))).mean())
        da, db = _strips(t[a], t[b], ax, 64)
        out.append((a, b, step, _energy(da) / _energy(db)))
    return out


if __name__ == '__main__':
    imgs = {os.path.basename(p)[:-4]: Image.open(p).convert('RGB') for p in sorted(glob.glob(os.path.join(ROOT, 'art', 'accepted', '*.png')))}
    before = seam_report(imgs)
    out, info = harmonize(imgs)
    after = seam_report(out)
    def summ(r):
        st = np.array([x[2] for x in r]); ra = np.array([abs(np.log(x[3])) for x in r])
        return f'colour step median {np.median(st):.1f} max {st.max():.1f}; detail ratio median x{np.exp(np.median(ra)):.2f} worst x{np.exp(ra.max()):.2f}'
    print('before:', summ(before)); print('after: ', summ(after))
    print(json.dumps(info['gains']))
