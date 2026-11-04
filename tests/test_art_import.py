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


if __name__ == '__main__':
    unittest.main(verbosity=2)
