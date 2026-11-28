"""Unit checks for pipeline/harmonize_art.py on synthetic tiles (no art files needed).

  python3 tests/test_harmonize.py
"""
import os, sys, shutil, tempfile
import numpy as np
from PIL import Image
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


# 4. locked tiles: finished tiles never change because tiles were added next to them; new tiles do all the adapting
def old_harmonize(t, s, srcs):
    """harmonize as it was before locking (every tile equal), for comparison."""
    total = {k: 1.0 for k in t}
    for _ in range(s['passes']):
        g = H.detail_gains(t, s)
        if _: g = {k: v / s['gain_mean'] for k, v in g.items()}
        t = {k: H.apply_gain(v, g[k], s['detail_sigma']) for k, v in t.items()}
        total = {k: total[k] * g[k] for k in t}
    ok_in = None
    if s.get('xfade'): t, _, ok_in = H.crossfade(t, total, s, srcs)
    t, _ = H.colour_level(t, s, ok_in)
    if s.get('diffuse'): t, _ = H.seam_diffuse(t, s)
    return t


def edge_step(t, a, b, ax):
    sa, sb = H._strips(t[a], t[b], ax, 2); return float(np.abs(sa.mean((0, 1)) - sb.mean((0, 1))).max())


def detail_ratio(t, a, b, ax):
    sa, sb = H._strips(t[a], t[b], ax, 64); return H._energy(sb) / H._energy(sa)


def three_tiles(ids, paint, vertical):
    """Tiles (usually three) along a row (or column) of one world, each painted by its own "generation call" with a 256 px margin
    (what the cross-fade blends with). Returns (accepted art, sources)."""
    world = rng.normal(128, 12, (1024 + 2 * M, len(ids) * 1024 + 2 * M, 3)).astype(np.float32)
    if vertical: world = world.transpose(1, 0, 2).copy()
    art, srcs = {}, {}
    for n, (k, f) in enumerate(zip(ids, paint)):
        sl = slice(n * 1024, n * 1024 + 1024 + 2 * M); r = world[sl] if vertical else world[:, sl]
        r = np.clip(f(r.copy()), 0, 255).round(); i, j = map(int, k.split('_'))
        srcs[k] = (os.path.join(tmp, f'{k}.png'), {'canvas_origin': [i * 1024 - M, j * 1024 - M], 'width': 1024 + 2 * M, 'height': 1024 + 2 * M})
        Image.fromarray(r.astype(np.uint8)).save(srcs[k][0]); art[k] = r[M:-M, M:-M].copy()
    return art, srcs


SX = dict(H.DEFAULTS); M = 256; tmp = tempfile.mkdtemp()
sharp = lambda a: a
locked_soft = lambda a: H.apply_gain(a, 0.9, 1.2) + np.array([5, 0, -5], np.float32)      # finished, a bit softer and warmer
new_soft = lambda a: H.apply_gain(a, 0.7, 1.2) + np.array([30, 10, -20], np.float32)      # new: colour step, much softer
# (ids, paint, vertical, locked, (tile above/left, tile below/right, axis) of the locked-new edge, side of the new tile there)
cases = [(['0_0', '1_0', '2_0'], [sharp, locked_soft, new_soft], False, ['0_0', '1_0'], ('1_0', '2_0', 1), 'L', (S, SX)),
         (['0_0', '0_1', '0_2'], [new_soft, sharp, locked_soft], True, ['0_1', '0_2'], ('0_0', '0_1', 0), 'B', (SX,))]
for ids, paint, vertical, lk, (ea, eb, ax), side, settings_ in cases:
    art, srcs = three_tiles(ids, paint, vertical)
    new = next(k for k in ids if k not in lk); nl = eb if new == ea else ea
    for s_ in settings_:
        name = f' [{"column" if vertical else "row"}, new tile {new}{", cross-fade" if s_["xfade"] else ""}]'
        two = {k: art[k] for k in lk}
        alone = H.harmonize_tiles(dict(two), s_, set(lk), srcs)
        both = H.harmonize_tiles(dict(art), s_, set(lk), srcs)
        old3 = old_harmonize(dict(art), s_, srcs)
        check('locked tiles are identical with and without a new neighbour' + name, all(np.array_equal(alone[0][k], both[0][k]) for k in lk),
              f'max diff {max(np.abs(alone[0][k] - both[0][k]).max() for k in lk):.4f}')
        moved = float(np.abs(old3[nl] - alone[0][nl]).max())
        check('(without locking the new neighbour would have changed it)' + name, moved > 1, f'max change of {nl} {moved:.1f}')
        check('locked gains do not change' + name, all(alone[1][k] == both[1][k] for k in lk), str({k: round(v, 3) for k, v in both[1].items()}))
        st = edge_step(both[0], ea, eb, ax)
        check('the new tile absorbs the whole step at the shared edge' + name, st < 1.0, f'step {st:.2f} (was {edge_step(art, ea, eb, ax):.1f})')
        r0, r1 = detail_ratio(art, ea, eb, ax), detail_ratio(both[0], ea, eb, ax)
        check('the new tile matches the locked tile\'s detail' + name, abs(np.log(r1)) < abs(np.log(r0)) / 3,
              f'detail ratio x{r1:.2f} (was x{r0:.2f}), new tile gain {both[1][new]:.2f}')
        if s_['xfade']:
            rows = [r for r in both[2] if r[3] == 'ok']
            check('the new tile cross-fades into the locked tile\'s margin; the locked tile takes none' + name,
                  any(r[0] == new and r[1] == side and r[5] > 0.5 for r in rows) and not any(r[0] in lk and r[2] == new for r in rows))
        # old_harmonize calls this module's step functions, so these two pin the orchestration (locked tiles alone, or no
        # lock at all, take exactly the plain all-equal path); the arithmetic of the steps themselves is pinned by
        # republishing the committed map byte for byte (docs/ART_PIPELINE.md, publish-time harmonisation)
        ref = old_harmonize(dict(two), s_, srcs)
        check('locked tiles alone take exactly the plain all-equal path' + name, all(np.array_equal(alone[0][k], ref[k]) for k in lk))
        none = H.harmonize_tiles(dict(art), s_, set(), srcs)
        check('with nothing locked every tile takes the plain all-equal path' + name, all(np.array_equal(none[0][k], old3[k]) for k in art))
        if s_['xfade'] and not vertical:
            # one-sided cross-fade: at its border the new tile shows the locked tile's own (gain-matched) painting of
            # that ground, so nothing is left for levelling or diffusion (a two-sided blend would leave half the step)
            nd = H.harmonize_tiles(dict(art), dict(s_, diffuse=False), set(lk), srcs)
            nd2 = H.harmonize_tiles(dict(two), dict(s_, diffuse=False), set(lk), srcs)
            img, o = Image.open(srcs[nl][0]).convert('RGB'), srcs[nl][1]
            e = H.apply_gain(H._extract((img, o), (2048, 0, 2048 + 192, 1024), (192, 1024)), nd[1][nl], s_['detail_sigma'])
            dev = float(np.abs(nd[0][new][:, 0] - e[:, 0]).mean())
            check('the new tile\'s border column is the locked tile\'s margin painting' + name,
                  dev < 1.0 and edge_step(nd[0], ea, eb, ax) < 1.0 and all(np.array_equal(nd[0][k], nd2[0][k]) for k in lk),
                  f'mean |difference| {dev:.2f}, step {edge_step(nd[0], ea, eb, ax):.2f} (was {edge_step(art, ea, eb, ax):.1f})')
lone = H.harmonize_tiles({'0_1': art['0_1'], '0_0': art['0_0']}, SX, {'0_1'}, srcs)
check('a lone locked tile is left exactly as it is', np.array_equal(lone[0]['0_1'], art['0_1']) and edge_step(lone[0], '0_0', '0_1', 0) < 1.0,
      f'step {edge_step(lone[0], "0_0", "0_1", 0):.2f}')

# 4b. ordered lock groups: A (finished first), then B, then C. No group changes when tiles are added after it, and a
# region published unlocked keeps exactly its art when it is then locked as a new last group
other = lambda a: H.apply_gain(a, 0.8, 1.2) + np.array([-15, 5, 20], np.float32)
art, srcs = three_tiles(['0_0', '1_0', '2_0', '3_0'], [sharp, locked_soft, new_soft, other], False)
A, B, C = {'0_0', '1_0'}, {'2_0'}, {'3_0'}
ab = {k: art[k] for k in A | B}
runs = {'A,B locked': H.harmonize_tiles(dict(ab), SX, [A, B], srcs),
        'A locked, B unlocked': H.harmonize_tiles(dict(ab), SX, [A], srcs),
        'A,B locked, C unlocked': H.harmonize_tiles(dict(art), SX, [A, B], srcs),
        'A,B,C locked': H.harmonize_tiles(dict(art), SX, [A, B, C], srcs)}
same = lambda r1, r2, keys: all(np.array_equal(r1[0][k], r2[0][k]) and r1[1][k] == r2[1][k] for k in keys)
check('locking a reviewed region as a new last group keeps its art exactly', same(runs['A,B locked'], runs['A locked, B unlocked'], A | B))
check('earlier lock groups do not change when tiles are added after them',
      all(same(runs['A,B locked'], r, A | B) for r in runs.values()))
check('a group locked last equals the same tiles unlocked', same(runs['A,B locked, C unlocked'], runs['A,B,C locked'], C))
st = edge_step(runs['A,B,C locked'][0], '2_0', '3_0', 1)
check('a later group absorbs the whole step against the group before it', st < 1.0, f'step {st:.2f} (was {edge_step(art, "2_0", "3_0", 1):.1f})')
check('one set of locked tiles is the same as a single lock group',
      same(H.harmonize_tiles(dict(art), SX, A, srcs), H.harmonize_tiles(dict(art), SX, [A], srcs), art))
shutil.rmtree(tmp)

# 4c. colour levelling against locked tiles on its own (no seam diffusion after it): the new tile takes the whole step
cl_in = {'0_0': base[:, :1024].copy(), '1_0': base[:, 1024:].copy() + np.array([30, 10, -20], np.float32)}
cl, _ = H.colour_level(dict(cl_in), S, None, fixed={'0_0'})
sa, sb = H._strips(cl['0_0'], cl['1_0'], 1, 8)
blk = float(np.abs(sa.reshape(16, 64, 8, 3).mean((1, 2)) - sb.reshape(16, 64, 8, 3).mean((1, 2))).mean())   # noise alone ~0.6
moved = (cl['1_0'][:, :8] - cl_in['1_0'][:, :8]).mean((0, 1))
check('colour levelling: the new tile takes the whole step, the locked tile none',
      blk < 1.0 and np.array_equal(cl['0_0'], cl_in['0_0']) and np.abs(moved + np.array([30, 10, -20])).max() < 1,
      f'mean 64 px block step {blk:.2f} (was 20), new tile moved {moved.round(1).tolist()} at the edge')
# ... and both steps run on the new tiles inside harmonize_tiles: levelling alone (diffusion off) removes the flat step;
# diffusion removes a local one (a 40-row patch) that 64 px levelling blocks cannot
lv = H.harmonize_tiles(dict(cl_in), dict(S, diffuse=False), {'0_0'}, {})
sa, sb = H._strips(lv[0]['0_0'], lv[0]['1_0'], 1, 8)
blk2 = float(np.abs(sa.reshape(16, 64, 8, 3).mean((1, 2)) - sb.reshape(16, 64, 8, 3).mean((1, 2))).mean())
loc_in = dict(cl_in); loc_in['1_0'] = cl_in['1_0'].copy(); loc_in['1_0'][300:340, :60] += 50
lc = H.harmonize_tiles(dict(loc_in), S, {'0_0'}, {})
loc = float((lc[0]['1_0'][300:340, :2] - lc[0]['0_0'][300:340, -2:]).mean() - (lc[0]['1_0'][:, :2] - lc[0]['0_0'][:, -2:]).mean())
check('levelling and diffusion both run on the new tile in harmonize_tiles', blk2 < 1.0 and abs(loc) < 8,
      f'levelling only: mean block step {blk2:.2f} (was 20); local patch step {loc:+.1f} (was +50)')

# 4d. a new tile in a notch (locked tiles left of it and above it, the same colour): its corner is levelled once, not
# twice (both full corrections at once would push the corner past the locked tiles' colour)
w5 = rng.normal(128, 12, (2048, 2048, 3)).astype(np.float32); c5 = np.array([30, 10, -20], np.float32)
t5 = {'0_0': w5[:1024, :1024], '1_0': w5[:1024, 1024:], '0_1': w5[1024:, :1024], '1_1': w5[1024:, 1024:] + c5}
n5 = H.harmonize_tiles(dict(t5), S, {'0_0', '1_0', '0_1'}, {})
corner = n5[0]['1_1'][:128, :128].mean((0, 1)) - n5[0]['0_0'].mean((0, 1))
far5 = n5[0]['1_1'][600:, 600:].mean((0, 1)) - n5[0]['0_0'].mean((0, 1))
st5 = max(edge_step(n5[0], '1_0', '1_1', 0), edge_step(n5[0], '0_1', '1_1', 1))
check('a new tile in a notch is levelled once in its corner', np.abs(corner).max() < 3 and st5 < 1 and np.abs(far5 - c5).max() < 1,
      f'corner offset {corner.round(1).tolist()} (was {c5.tolist()}), worst edge step {st5:.2f}, interior keeps {far5.round(1).tolist()}')
# ... by each step on its own too (in the full run either one hides the other's corner error): both full corrections at
# once leave the 64 px corner block ~26 past the locked colour (levelling) or ~18 short of it (diffusion)
for nm, fn in (('colour levelling', lambda: H.colour_level(dict(t5), S, None, fixed={'0_0', '1_0', '0_1'})[0]),
               ('seam diffusion', lambda: H.seam_diffuse(dict(t5), S, {'0_0', '1_0', '0_1'})[0])):
    o5 = fn(); cb = o5['1_1'][:64, :64].mean((0, 1)) - o5['0_0'].mean((0, 1))
    check(f'{nm} alone: a new tile in a notch is corrected once in its corner', np.abs(cb).max() < 6, f'64 px corner offset {cb.round(1).tolist()}')

# 4e. locked_regions in config/world.json: a list of names is one group, a list of lists ordered groups; mixed or
# unknown names stop the publish
g1 = H.lock_groups({'locked_regions': ['campus2x2', 'park_uptown']}); g2 = H.lock_groups({'locked_regions': [['campus2x2'], ['park_uptown', 'campus2x2']]})
check('locked_regions: one group, or ordered groups (a tile stays in its first group)',
      len(g1) == 1 and len(g2) == 2 and g2[0] | g2[1] == g1[0] and not g2[0] & g2[1] and H.lock_groups({}) == [])
def stops(v):
    try: H.lock_groups({'locked_regions': v}); return False
    except SystemExit: return True
check('locked_regions: a mix of names and lists, or an unknown region, stops the publish', stops(['campus2x2', ['park_uptown']]) and stops([['nope']]))

# 5. junction of two locked tiles (top row) and two new ones (bottom row) with different colour steps: the new tiles meet
# the locked ones and each other, also in the 64 px next to the junction (one Jacobi update of all edges left 26 there)
w4 = rng.normal(128, 12, (2048, 2048, 3)).astype(np.float32)
t4 = {'0_0': w4[:1024, :1024], '1_0': w4[:1024, 1024:] + np.array([6, 0, -6], np.float32),
      '0_1': w4[1024:, :1024] + np.array([30, 10, -20], np.float32), '1_1': w4[1024:, 1024:] + np.array([-20, 5, 25], np.float32)}
out4, _ = H.seam_diffuse(dict(t4), S, {'0_0', '1_0'})
blocks = lambda a, b, ax: (lambda p: np.abs(p[0].reshape(16, 64, 2, 3).mean((1, 2)) - p[1].reshape(16, 64, 2, 3).mean((1, 2))).mean(-1))(H._strips(out4[a], out4[b], ax, 2))
ff = blocks('0_1', '1_1', 1)[0]; lf = max(blocks('0_0', '0_1', 0).max(), blocks('1_0', '1_1', 0).max())
check('seam diffusion settles a locked/new junction', ff < 2 and lf < 2 and all(np.array_equal(out4[k], t4[k]) for k in ('0_0', '1_0')),
      f'new|new step next to the junction {ff:.1f}, worst locked|new block {lf:.1f}')

print('all checks passed' if ok else 'SOME CHECKS FAILED'); sys.exit(0 if ok else 1)
