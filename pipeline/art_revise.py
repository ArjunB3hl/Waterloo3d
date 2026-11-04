"""Build a focused revision packet with a hand-written correction (for defects automatic QA cannot see).

  python3 pipeline/art_revise.py <batch> <item> --note "exact correction" [--box x0,y0,x1,y1 ...] [--return <file>]

<item> is a tile id (e.g. 5_-1) or 'seam'. The previous output is the latest stored return for that item
(art/returned/<batch>/...) unless --return is given; it is cut to the tile (or seam window) exactly as art_import does,
annotated with the --box rectangles (tile-local px in the 1024 frame, or window px for seams) and attached together with
the current context/mask/reference. The item is marked revision-needed in the parent batch. Prints the new batch id.
"""
import os, sys, argparse
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
import art_common as A
import art_request as R
import art_import as I


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('batch'); ap.add_argument('item')
    ap.add_argument('--note', required=True, help='exact correction for the image agent')
    ap.add_argument('--box', action='append', default=[], help='x0,y0,x1,y1 area to highlight (repeatable)')
    ap.add_argument('--return', dest='ret', help='returned file to use as the previous output')
    a = ap.parse_args()
    rec = A.load_batches()['batches'][a.batch]
    it = rec['items'][a.item]
    path = a.ret or (it['received'][-1]['stored'] if it.get('received') else None)
    if not path: raise SystemExit(f'{a.batch}/{a.item}: no stored return to revise')
    path = path if os.path.isabs(path) else os.path.join(A.ROOT, path)
    class _Res:  # cut_tile reports size problems through a QA result object; they were already reported at import
        metrics = {}
        def fail(self, *a, **k): pass
        def warn(self, *a, **k): pass
    pil = Image.open(path); fmt = pil.format
    tile, _full = I.cut_tile(it, pil.convert('RGB'), {'format': fmt, 'alpha_min': None}, _Res())
    if tile is None: raise SystemExit(f'{path}: could not cut the item with the batch crop rules')
    prev = np.asarray(tile)
    marked = Image.fromarray(prev).convert('RGB'); d = ImageDraw.Draw(marked)
    for b in a.box:
        x0, y0, x1, y1 = map(int, b.split(','))
        d.rectangle([x0, y0, x1, y1], outline=(255, 40, 40), width=6)
        d.text((x0 + 6, max(0, y0 - 22)), 'FIX HERE', fill=(255, 255, 255), stroke_width=3, stroke_fill=(0, 0, 0))
    rid = R.build_revision(a.batch, {a.item: {'prev': prev, 'marked': marked, 'corrections': [a.note]}})
    batches = A.load_batches()
    batches['batches'][a.batch]['items'][a.item]['status'] = 'revision-needed'
    batches['batches'][a.batch]['items'][a.item]['revision_batch'] = rid
    A.save_batches(batches)
    print(rid)


if __name__ == '__main__':
    main()
