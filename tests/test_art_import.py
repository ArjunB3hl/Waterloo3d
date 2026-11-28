"""Self-test of the artwork relay: request packets -> synthetic "returned" art -> import QA -> accept -> seam repair.

No fake art enters the repo: every test works on a temporary copy of the art/ state (TW_ART_DIR), and publishing is
skipped automatically for such copies. Synthetic returns are derived from the reference renders:
  good      reference posterized to a fixed 32-colour palette and pixelated in 2x2 clusters (what a faithful agent does)
  shifted   the same, translated 12 px                       -> translation failure + revision packet
  painted   Dana Porter Library painted over with lawn       -> building/landmark failure
  bigger    2048 px square                                   -> accepted after box downsampling
  wide      1536x1024                                        -> size failure
  context   B002 edits that keep the mask's black area       -> crop, keep-drift and seam checks vs accepted 0_0
  seam      S001 window repairs                              -> kept-area check, accept, feathered composite keeps band edges
  pond      good + a blue pond painted on open lawn          -> content failure (invented water)
  lot       good + a grey lined parking lot on open lawn     -> content failure (paving on open ground)
  creek     a creek widened 12 px a side / 4 px              -> content failure / pass; a pale pond fails, a blue-grey
            shadow on parking does not; a paler tan field passes, asphalt on it fails
  force     two failing B002 edits, one named in --force     -> only that one accepted, recorded with reason and checks;
            a changed reference job                          -> refused, unless the item is named in --force ('reference');
            two changed B002 references, one named           -> the other is neither imported, accepted nor revised

Run:  python3 tests/test_art_import.py   (or python3 -m unittest tests.test_art_import)   ~1-2 minutes
"""
import os, sys, shutil, tempfile, zipfile, unittest, subprocess
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'pipeline'))
import art_common as A
import art_request as R
import art_import as I
from classes import CLS

_PALETTE = None


def stylise(rgb):
    """Posterize to one shared palette (so neighbouring tiles agree) and pixelate in 2x2 clusters."""
    global _PALETTE
    if _PALETTE is None:
        _PALETTE = Image.fromarray(A.reference_rgb('0_0')).resize((512, 512), Image.BOX).quantize(32, method=Image.Quantize.MEDIANCUT)
    h, w = rgb.shape[:2]
    small = Image.fromarray(rgb).resize((w // 2, h // 2), Image.BOX).quantize(palette=_PALETTE, dither=Image.Dither.NONE)
    return np.asarray(small.convert('RGB').resize((w, h), Image.NEAREST))


def save(folder, name, arr):
    os.makedirs(folder, exist_ok=True)
    Image.fromarray(arr).save(os.path.join(folder, name))
    return folder


def quiet(fn, *a, **k):
    """Run a pipeline call without its progress output cluttering the test log."""
    import io, contextlib
    with contextlib.redirect_stdout(io.StringIO()):
        return fn(*a, **k)


def captured(fn, *a, **k):
    """Like quiet(), but return the printed output."""
    import io, contextlib
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        fn(*a, **k)
    return buf.getvalue()


def open_ground_box(t, size=64):
    """(x, y) of a size x size square well inside the reference's open ground (clear of the content check's edge and roof
    margins), so painting there is invented content and nothing else."""
    cls = A.class_ids(t); soft = np.isin(cls, I.SOFT_GROUND)
    inner = soft & ~A.dilate(~soft, I.T['content_edge_px'] + 4) & ~A.dilate(np.isin(cls, [CLS['roof'], CLS['wall']]), I.T['content_bld_px'] + 4)
    ii = np.pad(inner.astype(np.int32), ((1, 0), (1, 0))).cumsum(0).cumsum(1)
    ys, xs = np.nonzero(ii[size:, size:] - ii[:-size, size:] - ii[size:, :-size] + ii[:-size, :-size] == size * size)
    assert len(ys), f'no {size} px open-ground square in {t}'
    return int(xs[len(xs) // 2]), int(ys[len(ys) // 2])


class ArtRelayTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix='tw_art_test_')
        cls.base = os.path.join(cls.tmp, 'base')
        os.environ['TW_ART_DIR'] = cls.base
        quiet(R.build_batch, 'B001')
        quiet(R.build_batch, 'B002')
        cls.good = stylise(A.reference_rgb('0_0'))

    @classmethod
    def tearDownClass(cls):
        os.environ.pop('TW_ART_DIR', None)
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def setUp(self):
        self.state = os.path.join(self.tmp, self.id().rsplit('.', 1)[-1])
        shutil.copytree(self.base, self.state)
        os.environ['TW_ART_DIR'] = self.state
        self.ret = os.path.join(self.state, '_incoming')

    def item(self, bid, key):
        return A.load_batches()['batches'][bid]['items'][key]

    def checks(self, bid, key):
        return {f['check'] for f in self.item(bid, key)['received'][-1]['failures']}

    def accept_style_sample(self):
        quiet(I.process, 'B001', save(self.ret + '_b001', 'B001_0_0.png', self.good), accept=True)

    # ------------------------------------------------------------------ packets
    def test_packets_are_exact_and_self_contained(self):
        b = A.load_batches()['batches']
        self.assertEqual(b['B001']['status'], 'requested')
        self.assertEqual(b['B002']['status'], 'draft')
        self.assertEqual(b['B002']['blocked_by'], ['0_0'])
        for bid in ('B001', 'B002'):
            rec = b[bid]
            listed = sorted(f['file'] for f in rec['attachments'])
            self.assertEqual(listed, sorted(os.listdir(A.sp('requests', bid))))  # folder = attachment list, nothing else
            with zipfile.ZipFile(A.sp('requests', f'{bid}.zip')) as z:
                self.assertEqual(sorted(z.namelist()), sorted(listed + [f'IMAGE_REQUEST_{bid}.md']))
            with open(os.path.join(A.md_dir(), f'IMAGE_REQUEST_{bid}.md')) as f:
                md = f.read()
            self.assertTrue(md.split('\n## ')[1].startswith('What to do (for the user)'))
            for f in listed: self.assertIn(f, md)
            self.assertNotIn(A.ROOT, md.split('## Packet details')[0])  # no local paths in what the agent sees
            for f in rec['attachments']:
                self.assertEqual(A.sha_file(A.sp('requests', bid, f['file'])), f['sha256'])
        ctx = b['B002']['items']['0_-1']['output']
        self.assertEqual((ctx['width'], ctx['height'], ctx['crop']), (1536, 1536, [256, 256, 1280, 1280]))

    # ------------------------------------------------------------------ B001 QA
    def test_good_passes_accepts_and_unblocks_b002(self):
        self.accept_style_sample()
        it = self.item('B001', '0_0')
        self.assertEqual(it['status'], 'accepted', it['received'][-1]['failures'])
        meta = A.load_tiles_meta()['0_0']
        self.assertEqual(meta['version'], A.sha_file(A.accepted_path('0_0'))[:12])
        self.assertEqual(meta['batch'], 'B001')
        self.assertEqual(meta['model_reported'], 'unknown')
        self.assertTrue(np.array_equal(A.accepted_rgb('0_0'), self.good))
        b2 = A.load_batches()['batches']['B002']
        self.assertEqual(b2['status'], 'requested')  # draft rebuilt automatically
        ctx = np.asarray(Image.open(A.sp('requests', 'B002', 'B002_context_0_-1.png')).convert('RGB'))
        self.assertTrue(np.array_equal(ctx[1280:, 256:1280], self.good[:256]))  # bottom margin = accepted 0_0 art
        mask = np.asarray(Image.open(A.sp('requests', 'B002', 'B002_mask_0_-1.png')))
        self.assertTrue((mask[1280:, 256:1280] == 0).all() and (mask[256:1280, 256:1280] == 255).all())

    def test_shift_fails_translation_and_makes_revision(self):
        s = np.empty_like(self.good); s[:, 12:] = self.good[:, :-12]; s[:, :12] = self.good[:, :1]
        quiet(I.process, 'B001', save(self.ret, 'B001_0_0.png', s), accept=True)
        it = self.item('B001', '0_0')
        self.assertEqual(it['status'], 'revision-needed')
        self.assertIn('translation', self.checks('B001', '0_0'))
        self.assertAlmostEqual(it['qa']['metrics']['registration']['dx'], 12, delta=0.5)
        self.assertFalse(os.path.exists(A.accepted_path('0_0')))  # never auto-accepted on failure
        rid = it['revision_batch']
        self.assertEqual(rid, 'B001R1')
        rev = A.load_batches()['batches'][rid]
        self.assertEqual(rev['items']['0_0']['return_filename'], 'B001R1_0_0.png')
        self.assertTrue(any('+12 px horizontally' in c for c in rev['items']['0_0']['revision_of']['corrections']))
        self.assertTrue(os.path.exists(A.sp('requests', rid, 'B001R1_marked_0_0.png')))

    def test_painted_out_building_flagged(self):
        r = next(b for b in A.building_roofs('0_0') if b['name'] == 'Dana Porter Library')
        cls = A.class_ids('0_0'); body = r['mask'].copy()
        for k in range(1, 120):  # the walls hang below the roof in this view
            body |= np.roll(r['mask'], k, 0) & np.isin(cls, [CLS['wall'], CLS['roof']])
        a = self.good.copy(); a[A.dilate(body, 2)] = (140, 180, 100)
        quiet(I.process, 'B001', save(self.ret, 'B001_0_0.png', a), revision=False)
        fails = self.item('B001', '0_0')['received'][-1]['failures']
        self.assertTrue(any(f['check'] == 'building' and 'Dana Porter Library' in f['detail'] for f in fails), fails)
        self.assertNotIn('translation', self.checks('B001', '0_0'))

    def test_invented_content_fails(self):
        """Content the reference does not have: a pond and a lined parking lot on open lawn fail 'content'; the faithful
        'good' has no content region at all (it also passes and is accepted in test_good_passes_accepts_and_unblocks_b002)."""
        from PIL import ImageDraw
        cc, _m = I.content_check(self.good, A.class_ids('0_0'))
        self.assertEqual([r for r in cc['regions'] if r['fail']], [], cc['metrics'])
        x, y = open_ground_box('0_0')
        pond = Image.fromarray(self.good.copy()); d = ImageDraw.Draw(pond)
        d.ellipse([x + 2, y + 8, x + 61, y + 55], fill=(58, 128, 186), outline=(40, 96, 150), width=2)
        for k in range(3): d.line([x + 14 + 9 * k, y + 22 + 8 * k, x + 26 + 9 * k, y + 22 + 8 * k], fill=(150, 200, 230), width=2)  # ripples
        quiet(I.process, 'B001', save(self.ret + '_pond', 'B001_0_0.png', np.asarray(pond)), revision=False)
        fails = self.item('B001', '0_0')['received'][-1]['failures']
        self.assertTrue(any(f['check'] == 'content' and 'water' in f['detail'] for f in fails), fails)
        reg = next(r for r in self.item('B001', '0_0')['qa']['metrics']['content']['regions'] if r['kind'] == 'water')
        self.assertTrue(reg['fail'] and x <= reg['at'][0] <= x + 64 and y <= reg['at'][1] <= y + 64, reg)  # located on the pond
        lot = self.good.copy(); lot[y + 2:y + 62, x + 2:x + 62] = (112, 108, 114)       # asphalt
        lot[y + 6:y + 58:10, x + 6:x + 58] = (236, 236, 228)                              # bay lines every 10 px
        lot[y + 6:y + 58, x + 31:x + 33] = (236, 236, 228)
        quiet(I.process, 'B001', save(self.ret + '_lot', 'B001_0_0.png', lot), revision=False)
        fails = self.item('B001', '0_0')['received'][-1]['failures']
        self.assertTrue(any(f['check'] == 'content' and 'parking' in f['detail'] for f in fails), fails)
        self.assertEqual(self.item('B001', '0_0')['status'], 'revision-needed')

    def test_widened_creek_and_pale_pond(self):
        """Pure content_check cases near the water thresholds: a creek widened by 12 px a side fails while 4 px of
        shoreline drift passes; a pale pond on lawn (saturation ~0.27, blue - red 55) fails; a blue-grey cast shadow on
        parking (blue - red 40) is not water."""
        cls = A.class_ids('-1_0'); wat = np.isin(cls, [CLS['water'], CLS['pool']]); roofs = np.isin(cls, [CLS['roof'], CLS['wall']])
        col = np.array([64, 132, 188], np.uint8)
        good = stylise(A.reference_rgb('-1_0')).copy(); good[wat] = col
        def water(k):
            art = good.copy(); art[A.dilate(wat, k) & ~roofs] = col
            cc, _m = I.content_check(art, cls)
            return cc['metrics']['water']['max_blob'], [r for r in cc['regions'] if r['fail'] and r['kind'] == 'water']
        self.assertEqual(water(4)[1], [], water(4))
        px, fails = water(12)
        self.assertTrue(fails and px >= I.T['content_water_px'], (px, fails))
        from PIL import ImageDraw
        cls0 = A.class_ids('0_0'); x, y = open_ground_box('0_0')
        pond = Image.fromarray(self.good.copy()); ImageDraw.Draw(pond).ellipse([x + 2, y + 8, x + 61, y + 55], fill=(150, 180, 205))
        cc, _m = I.content_check(np.asarray(pond), cls0)
        self.assertTrue(any(r['fail'] and r['kind'] == 'water' for r in cc['regions']), cc['metrics'])
        park = cls == CLS['parking']                                                     # -1_0 again
        ii = np.pad(park.astype(np.int32), ((1, 0), (1, 0))).cumsum(0).cumsum(1); n = 32
        ys, xs = np.nonzero(ii[n:, n:] - ii[:-n, n:] - ii[n:, :-n] + ii[:-n, :-n] == n * n)
        self.assertTrue(len(ys), 'no 32 px parking square in -1_0')
        px_, py_ = int(xs[len(xs) // 2]), int(ys[len(ys) // 2])
        shade = good.copy(); shade[py_:py_ + n, px_:px_ + n] = (120, 128, 160)          # 1024 px: water-sized if it counted
        cc, _m = I.content_check(shade, cls)
        self.assertFalse(any(r['fail'] for r in cc['regions']), cc['regions'])

    def test_paler_farm_field_is_not_paving(self):
        """A tan field painted paler than the reference is still a field; grey asphalt on it is paving."""
        cls = np.full((1024, 1024), CLS['farmland'], np.uint8)
        field = np.zeros((1024, 1024, 3), np.uint8); field[:] = (200, 160, 114)       # hue 32, saturation 0.43
        paler = field.copy(); paler[:] = (200, 172, 140)                                # saturation 0.30 (30% paler)
        for art in (field, paler):
            cc, _m = I.content_check(art, cls)
            self.assertFalse(any(r['fail'] for r in cc['regions']), cc['metrics'])
        lot = paler.copy(); lot[400:460, 400:460] = (118, 116, 120)
        cc, _m = I.content_check(lot, cls)
        self.assertTrue(any(r['fail'] and r['kind'] == 'hard' for r in cc['regions']), cc['metrics'])

    def test_force_changed_reference_is_per_item(self):
        """With two items whose references changed, naming one in --force lets only that one through: the other's new
        return is not imported, it is not accepted, and no revision packet is built for it from the stale reference."""
        self.accept_style_sample()
        folder = self.ret
        for t in ('0_-1', '-1_0'): save(folder, f'B002_{t}.png', self.context_return(t, brighten=30))  # both fail the seam
        quiet(I.process, 'B002', folder, revision=False)
        b = A.load_batches()
        for t in ('0_-1', '-1_0'): b['batches']['B002']['items'][t]['reference']['cls'] = '000000000000'
        A.save_batches(b)
        save(folder, 'B002_-1_0.png', self.context_return('-1_0', brighten=31))       # a new return for the item not named
        out = captured(I.process, 'B002', folder, accept=True, force='0_-1', reason='reference re-rendered, join reviewed')
        items = A.load_batches()['batches']['B002']['items']
        self.assertEqual(items['0_-1']['status'], 'accepted')
        self.assertEqual(sorted(A.load_tiles_meta()['0_-1']['forced_checks']), sorted({'reference'} | self.checks('B002', '0_-1')))
        self.assertIn('-1_0: the reference changed', out)
        self.assertEqual(len(items['-1_0']['received']), 1)                         # the new return was not imported
        self.assertEqual(items['-1_0']['status'], 'revision-needed')
        self.assertFalse(os.path.exists(A.accepted_path('-1_0')))
        self.assertNotIn('revision_batch', items['-1_0'])                           # no revision from the stale reference
        self.assertNotIn('revision packet', out)

    def test_force_is_per_item(self):
        """--force names items: only those may be accepted despite failing QA; tiles.json records the reason and the
        overridden checks. A batch-wide force or a force without a reason is refused."""
        self.accept_style_sample()
        folder = self.ret
        for t in ('0_-1', '-1_0'): save(folder, f'B002_{t}.png', self.context_return(t, brighten=30))  # both fail the seam vs 0_0
        with self.assertRaises(SystemExit): I.process('B002', folder, accept=True, force=True, reason='batch-wide')
        with self.assertRaises(SystemExit): I.process('B002', folder, accept=True, force={'0_-1'})           # no reason
        with self.assertRaises(SystemExit): I.process('B002', folder, accept=True, force={'9_9'}, reason='x')  # not an item
        out = captured(I.process, 'B002', folder, accept=True, force={'0_-1'}, reason='join fixed by a seam packet next', revision=False)
        items = A.load_batches()['batches']['B002']['items']
        self.assertEqual(items['0_-1']['status'], 'accepted')
        self.assertEqual(items['-1_0']['status'], 'revision-needed')          # failing but not named: stays unaccepted
        self.assertFalse(os.path.exists(A.accepted_path('-1_0')))
        self.assertIn('seam', self.checks('B002', '-1_0'))
        meta = A.load_tiles_meta()
        self.assertNotIn('-1_0', meta)
        m = meta['0_-1']
        self.assertTrue(m['forced'])
        self.assertEqual(m['forced_reason'], 'join fixed by a seam packet next')
        self.assertEqual(m['forced_checks'], sorted(self.checks('B002', '0_-1')))
        self.assertIn('seam', m['forced_checks'])
        self.assertTrue(items['0_-1']['accepted']['forced'] and items['0_-1']['accepted']['forced_checks'] == m['forced_checks'])
        self.assertIn('0_-1: ACCEPTED - FORCED', out)
        self.assertIn('-1_0: QA failed - not accepted', out)
        self.assertFalse(meta['0_0']['forced'])                                # an ordinary acceptance records no override

    def test_force_overrides_changed_reference(self):
        """A return for an item whose reference job changed since its packet was built is refused; naming the item in
        --force QAs it against the current reference and records 'reference' as the overridden check."""
        b = A.load_batches(); b['batches']['B001']['items']['0_0']['reference']['cls'] = '000000000000'; A.save_batches(b)
        folder = save(self.ret, 'B001_0_0.png', self.good)
        out = captured(I.process, 'B001', folder, accept=True, revision=False)
        self.assertIn('reference changed', out)
        self.assertEqual(self.item('B001', '0_0')['received'], [])           # not even imported
        self.assertFalse(os.path.exists(A.accepted_path('0_0')))
        out = captured(I.process, 'B001', folder, accept=True, force='0_0', reason='reference re-rendered, layout unchanged', revision=False)
        it = self.item('B001', '0_0')
        self.assertEqual(it['status'], 'accepted', it['received'][-1]['failures'])
        m = A.load_tiles_meta()['0_0']
        self.assertEqual((m['forced'], m['forced_checks'], m['forced_reason']), (True, ['reference'], 'reference re-rendered, layout unchanged'))
        self.assertIn('0_0: ACCEPTED - FORCED despite reference', out)

    def test_sizes(self):
        big = np.asarray(Image.fromarray(self.good).resize((2048, 2048), Image.NEAREST))
        quiet(I.process, 'B001', save(self.ret, 'B001_0_0.png', big), revision=False)
        self.assertEqual(self.item('B001', '0_0')['received'][-1]['verdict'], 'pass')
        wide = np.asarray(Image.fromarray(self.good).resize((1536, 1024)))
        quiet(I.process, 'B001', save(self.ret + '2', 'B001_0_0.png', wide), revision=False)
        self.assertEqual(self.checks('B001', '0_0'), {'size'})
        # within the 1% aspect tolerance but not square: rejected as a size failure, never a crash
        near = np.asarray(Image.fromarray(self.good).resize((1030, 1024)))
        quiet(I.process, 'B001', save(self.ret + '3', 'B001_0_0.png', near), revision=False)
        self.assertEqual(self.checks('B001', '0_0'), {'size'})

    def test_resume_and_report(self):
        folder = save(self.ret, 'B001_0_0.png', self.good)
        with open(os.path.join(folder, 'B001_report.txt'), 'w') as f:
            f.write('Model: ExampleImageModel v2\nSeed: 1234\nQuality: high\n')
        save(folder, 'unrelated.png', self.good[:64, :64])
        quiet(I.process, 'B001', folder)
        quiet(I.process, 'B001', folder)  # nothing new: must not add a second entry
        it = self.item('B001', '0_0')
        self.assertEqual(len(it['received']), 1)
        self.assertEqual(it['model_reported'], 'ExampleImageModel v2')
        self.assertIn('Seed: 1234', it['settings_reported'])
        # a revised file under a tolerated suffix is picked up as a new version
        save(folder, 'B001_0_0 (2).png', np.asarray(Image.fromarray(self.good).resize((2048, 2048), Image.NEAREST)))
        quiet(I.process, 'B001', folder)
        self.assertEqual(len(self.item('B001', '0_0')['received']), 2)

    # ------------------------------------------------------------------ B002 context edits + seams
    def context_return(self, tile, brighten=0):
        rec = A.load_batches()['batches']['B002']
        files = rec['items'][tile]['files']
        ctx = np.asarray(Image.open(A.sp('requests', 'B002', files['composition'])).convert('RGB'))
        mask = np.asarray(Image.open(A.sp('requests', 'B002', files['mask'])))
        out = np.where((mask == 0)[..., None], ctx, stylise(ctx))  # paint white, keep black exactly
        if brighten: out[256:1280, 256:1280] = np.clip(out[256:1280, 256:1280].astype(int) + brighten, 0, 255)
        return out

    def test_context_edit_crop_and_seam(self):
        self.accept_style_sample()
        quiet(I.process, 'B002', save(self.ret, 'B002_0_-1.png', self.context_return('0_-1')), revision=False)
        it = self.item('B002', '0_-1')
        self.assertEqual(it['received'][-1]['verdict'], 'pass', it['received'][-1]['failures'])
        seam = it['qa']['metrics']['seams'][0]
        self.assertEqual((seam['side'], seam['neighbour']), ('bottom', '0_0'))
        self.assertLess(seam['grad_ratio'], I.T['seam_ratio'])
        quiet(I.process, 'B002', save(self.ret + '_b', 'B002_0_-1.png', self.context_return('0_-1', brighten=30)), revision=False)
        self.assertIn('seam', self.checks('B002', '0_-1'))
        small = np.asarray(Image.fromarray(self.context_return('0_-1')).resize((1024, 1024), Image.LANCZOS))
        quiet(I.process, 'B002', save(self.ret + '_s', 'B002_0_-1.png', small), revision=False)
        last = self.item('B002', '0_-1')['received'][-1]
        self.assertTrue(any(w['check'] == 'size' for w in last['warnings']))  # 1024-only fallback: accepted math, flagged detail

    def test_seam_packet_roundtrip(self):
        self.accept_style_sample()
        quiet(I.process, 'B002', save(self.ret, 'B002_0_-1.png', self.context_return('0_-1')), accept=True)
        self.assertEqual(self.item('B002', '0_-1')['status'], 'accepted')
        with self.assertRaises(SystemExit):  # junction needs all four tiles accepted
            quiet(R.build_seam, quad='-1_-1')
        rec = quiet(R.build_seam, pair='0_0:0_-1')
        sid = rec['id']; o = rec['items']['seam']['output']
        self.assertEqual((sid, o['kind'], o['window']), ('S001', 'horizontal', [0, -512]))
        win = np.asarray(Image.open(A.sp('requests', sid, f'{sid}_window.png')).convert('RGB'))
        mask = np.asarray(Image.open(A.sp('requests', sid, f'{sid}_mask.png')))
        self.assertTrue((mask[512 - 48:512 + 48] == 255).all() and (mask[:400] == 0).all())
        # a repair that changes pixels outside the band must fail
        bad = win.copy(); bad[:300] = np.clip(bad[:300].astype(int) + 60, 0, 255)
        quiet(I.process, sid, save(self.ret + '_bad', f'{sid}_seam.png', bad), revision=False)
        self.assertIn('keep-changed', self.checks(sid, 'seam'))
        # a faithful repair (band repainted consistently, rest untouched) passes and is composited into both tiles
        good = win.copy(); good[464:560] = stylise(win)[464:560]
        before = {t: A.load_tiles_meta()[t]['version'] for t in ('0_0', '0_-1')}
        quiet(I.process, sid, save(self.ret + '_ok', f'{sid}_seam.png', good), accept=True)
        self.assertEqual(self.item(sid, 'seam')['status'], 'accepted', self.item(sid, 'seam')['received'][-1]['failures'])
        meta = A.load_tiles_meta()
        for t in ('0_0', '0_-1'):
            self.assertEqual(meta[t]['batch'], sid)
            self.assertEqual(meta[t]['history'][-1]['version'], before[t])
        q = self.item(sid, 'seam')['qa']['metrics']
        self.assertTrue(q['band_edges'] and all('step_ratio' in e and 'block' in e for e in q['band_edges']))
        self.assertIn('worst_block_after', q['seams'][0])

    def test_seam_feather_keeps_band_edges(self):
        """Feathered seam composite (T['seam_feather']): a return whose band does not meet the kept art (the whole frame
        regenerated 25 levels brighter, within the kept-area tolerance) is blended 1 at the join -> 0 at the band edges,
        so the outermost band pixels and everything outside the band stay identical to the accepted art."""
        self.assertTrue(I.T['seam_feather'])
        self.accept_style_sample()
        quiet(I.process, 'B002', save(self.ret, 'B002_0_-1.png', self.context_return('0_-1')), accept=True)
        rec = quiet(R.build_seam, pair='0_0:0_-1')
        sid, o = rec['id'], rec['items']['seam']['output']
        orig, _ = A.mosaic(*o['window'], R.SEAM_WINDOW, R.SEAM_WINDOW)
        ret = np.clip(orig.astype(int) + 10, 0, 255).astype(np.uint8)    # kept area changed by 10 < seam_keep_mad
        ret[464:560] = np.clip(stylise(orig)[464:560].astype(int) + 25, 0, 255)  # band visibly brighter than the kept art
        # the legacy hard band leaves a tone step at the band edges, the feathered blend does not
        mask = R.seam_mask({'joins': o['joins']}, o['band'])
        geo = {'joins': o['joins'], 'kind': o['kind'], 'tiles': o['tiles']}
        hard = I.composite_seam(orig, ret, mask, geo, o['band'], feather=False)
        soft = I.composite_seam(orig, ret, mask, geo, o['band'], feather=True)
        self.assertTrue(np.array_equal(soft[:465], orig[:465]) and np.array_equal(soft[559:], orig[559:]))
        self.assertFalse(np.array_equal(hard[464], orig[464]))
        self.assertGreater(np.abs(soft[511:513].astype(int) - orig[511:513]).mean(), 15)   # the repaint takes over at the join
        edge = lambda c: max(max(e['grad_ratio'], e['step_ratio']) for e in I.band_edge_profiles(geo, c, o['band'], mask))
        self.assertLess(edge(soft), edge(hard))
        quiet(I.process, sid, save(self.ret + '_f', f'{sid}_seam.png', ret), accept=True, revision=False)
        it = self.item(sid, 'seam')
        self.assertEqual(it['status'], 'accepted', it['received'][-1]['failures'])
        after, _ = A.mosaic(*o['window'], R.SEAM_WINDOW, R.SEAM_WINDOW)
        self.assertTrue(np.array_equal(after, soft))
        self.assertTrue(np.array_equal(after[464], orig[464]) and np.array_equal(after[559], orig[559]))  # band-edge pixels
        self.assertTrue(np.array_equal(after[:464], orig[:464]) and np.array_equal(after[560:], orig[560:]))

    def test_cli(self):
        folder = save(self.ret, 'B001_0_0.png', self.good)
        env = dict(os.environ, TW_ART_DIR=self.state)
        p = subprocess.run([sys.executable, os.path.join(ROOT, 'pipeline', 'art_import.py'), 'B001', folder, '--accept'],
                           env=env, capture_output=True, text=True)
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertIn('ACCEPTED', p.stdout)
        self.assertIn('publish skipped', p.stdout)  # state copy never publishes into web/public/data
        p = subprocess.run([sys.executable, os.path.join(ROOT, 'pipeline', 'art_request.py'), 'status'], env=env, capture_output=True, text=True)
        self.assertIn('B001     complete', p.stdout)
        # --force needs item ids and a reason; ids starting with '-' are read as ids, not as options
        cli = lambda *a: subprocess.run([sys.executable, os.path.join(ROOT, 'pipeline', 'art_import.py'), 'B001', folder, '--accept', *a],
                                        env=env, capture_output=True, text=True)
        p = cli('--force')
        self.assertNotEqual(p.returncode, 0); self.assertIn('--force needs the item ids', p.stderr)
        p = cli('--force', '--no-publish')
        self.assertNotEqual(p.returncode, 0); self.assertIn('--force needs the item ids', p.stderr)
        p = cli('--force', '0_0')
        self.assertNotEqual(p.returncode, 0); self.assertIn('needs --reason', p.stderr)
        p = cli('--force', '-1_0,-1_-1', '--reason', 'reviewed')
        self.assertNotEqual(p.returncode, 0); self.assertIn('-1_-1, -1_0 is not an item of B001', p.stderr)


if __name__ == '__main__':
    unittest.main(verbosity=2)
