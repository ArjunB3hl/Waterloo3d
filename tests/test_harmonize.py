"""Unit checks for pipeline/harmonize_art.py on synthetic tiles (no art files needed).

  python3 tests/test_harmonize.py
"""
import os, sys
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'pipeline'))
import harmonize_art as H

S = dict(H.DEFAULTS); S.update({'xfade': False})
rng = np.random.default_rng(1)
ok = True


def check(name, cond, detail=''):
    global ok
    ok &= bool(cond); print(('PASS ' if cond else 'FAIL ') + name + (f'  ({detail})' if detail else ''))


# 1. a colour step between two otherwise identical tiles disappears at the edge, and stays local
base = rng.normal(128, 12, (1024, 2048, 3)).astype(np.float32)
t = {'0_0': base[:, :1024].copy(), '1_0': base[:, 1024:].copy() + np.array([30, 10, -20], np.float32)}
out, steps = H.seam_diffuse(t, S)
step = np.abs(out['0_0'][:, -2:].mean((0, 1)) - out['1_0'][:, :2].mean((0, 1))).max()
far = np.abs(out['0_0'][:, :400] - t['0_0'][:, :400]).max()
check('seam diffusion removes a flat colour step at the edge', step < 1.0, f'step {step:.2f} (was 30)')
check('seam diffusion leaves the tile interior alone (beyond band_px)', far < 1e-3, f'max change {far:.4f}')

# 2. a step that varies along the edge (e.g. a tree painted differently) is removed row by row
t2 = {'0_0': base[:, :1024].copy(), '1_0': base[:, 1024:].copy()}
t2['1_0'][300:340, :60] += 50
out2, _ = H.seam_diffuse(t2, S)
local = (out2['1_0'][300:340, :2].mean() - out2['0_0'][300:340, -2:].mean())
check('seam diffusion removes a local step', abs(local) < 8, f'mean step over the 40 rows {local:+.1f} (was +50)')

# 3. detail gains even out a sharp and a soft neighbour
soft = H._blur(base[:, 1024:].copy(), 1.5)
g = H.detail_gains({'0_0': base[:, :1024], '1_0': soft}, S)
check('detail gains sharpen the soft tile more than the sharp one', g['1_0'] > g['0_0'], str({k: round(v, 2) for k, v in g.items()}))

print('all checks passed' if ok else 'SOME CHECKS FAILED'); sys.exit(0 if ok else 1)
