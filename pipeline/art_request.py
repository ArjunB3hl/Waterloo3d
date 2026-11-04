"""Build artwork request packets for the separate image-generation agent (relayed by hand by the user).

A packet = IMAGE_REQUEST_<batch>.md at the repo root (what to attach, what to paste, what to bring back) + the exact
attachment files in art/requests/<batch>/ + art/requests/<batch>.zip (the md and the attachments, for easy relay).
Every request is recorded in art/batches.json with per-tile prompt, reference hashes and expected return filenames.

Commands
  python3 pipeline/art_request.py build B001                 style sample: tile 0_0 from its reference (1024 out)
  python3 pipeline/art_request.py build B002 [--frame F]     rest of the campus 2x2 as context-image edits; stays a DRAFT
                                                              until its dependencies (0_0) are accepted - re-run then
  python3 pipeline/art_request.py build <id> --tiles a,b --depends c   any further patch batch (context mode)
  python3 pipeline/art_request.py seam --pair 0_0:1_0        seam repair for a vertical/horizontal join of accepted tiles
  python3 pipeline/art_request.py seam --quad -1_-1          seam repair of the 2x2 junction whose top-left tile is given
  python3 pipeline/art_request.py status                     print the batch record

--frame (context mode): square = 1536x1536 canvas, 256 px margin on all sides (default)
                        wide   = 1536x1024 canvas, margins left/right only (agents limited to 1536x1024)
                        tall   = 1024x1536 canvas, margins top/bottom only (agents limited to 1024x1536)
Revision packets (<batch>R<n>) are created by art_import.py when QA fails, through build_revision() below.
Set TW_ART_DIR (or pass --state-dir) to work on a copy of the art/ state, e.g. in tests.
"""
import os, sys, re, shutil, zipfile, argparse
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import art_common as A
from world import F, cfg

# ----------------------------------------------------------------------------------------------- the plan
PLAN = {
    'B001': {'kind': 'style-sample', 'title': 'Style sample - tile 0_0, University of Waterloo campus core',
             'tiles': ['0_0'], 'mode': 'tile', 'depends_on': [],
             'sheet': ['-1_-1', '0_-1', '-1_0', '0_0']},
    'B002': {'kind': 'patch', 'title': 'Campus 2x2 patch - tiles 0_-1, -1_0, -1_-1 continuing the accepted style sample',
             # order matters: the two edge neighbours of 0_0 first, the diagonal tile last (it borders both)
             'tiles': ['0_-1', '-1_0', '-1_-1'], 'mode': 'context', 'depends_on': ['0_0'], 'style_from': '0_0',
             'sheet': ['-1_-1', '0_-1', '-1_0', '0_0']},
}
# canvas (w, h) and margin (mx, my) around the 1024 tile; crop of the tile inside the canvas is (mx, my, mx+F, my+F)
FRAMES = {'square': (1536, 1536, 256, 256), 'wide': (1536, 1024, 256, 0), 'tall': (1024, 1536, 0, 256)}
SEAM_BAND = 48      # half-width (px) of the repaint band either side of a join
SEAM_WINDOW = 1024  # seam packets are a 1024x1024 window centred on the join / junction

# ----------------------------------------------------------------------------------------------- prompt text
INTRO = ('I\'m making "Tiny Waterloo", an illustrated pixel-art map of Waterloo, Ontario (Canada) built from square '
         'tiles that join edge to edge. Please paint the image described below from the attached reference images.')

ART_DIRECTION = """ART DIRECTION
- Detailed pixel-art city illustration with a miniature-diorama feel: crisp, deliberate pixel clusters and clean edges where materials meet. No blur, airbrush, painterly smearing, film grain or photo texture.
- Clear, readable architecture: repeated window detail on every facade (regular rows and columns matching the building's height), recognizable roof shapes, parapets and rooftop equipment.
- Warm, readable palette in consistent late-summer afternoon daylight: rich but natural greens, cream and warm-grey paving, soft blue-grey shade.
- Local vegetation: mature maple and oak canopy in layered leaf clusters, mown campus lawns crossed by worn footpaths, lush greens along creeks and ponds.
- Waterloo materials: University of Waterloo brutalist / precast concrete (pale warm grey, deep window reveals), red-brown brick on many campus buildings, glass-and-metal curtain walls on the newer engineering buildings and the Quantum-Nano Centre. The reference's wall colour gives the material family: red-brown = brick, pale grey or cream = concrete, blue-grey = glass."""

LIGHT = """LIGHT (identical on every tile - moving objects on the map cast shadows with this same sun)
- Sun from the south-west, behind the viewer's left shoulder: in the image the light comes from the lower left.
- Cast shadows fall toward the upper right, with the same direction and length as the shadows in the reference.
- Walls facing the lower left are sunlit; walls facing the lower right are in soft shade."""

CAMERA = """CAMERA (fixed for the whole map)
- Parallel (orthographic) projection looking toward compass bearing 20 degrees (north-north-east), tilted 45 degrees down; image "up" is roughly north-north-east. Scale: 1 px = 0.29 m.
- No perspective: no vanishing points, parallel edges stay parallel, far objects are not smaller."""

GEOMETRY = """GEOMETRY - most important
- The reference is a precise underdrawing. Keep every building footprint, roof outline and building height, every road, path, parking lot, water edge and tree cluster exactly where it is (same pixels).
- Do not add, remove, move, rotate or resize anything: no new streets, buildings, plazas or water. Paint over the geometry; don't redesign it.
- Do not change the camera angle, zoom, crop or framing.
- Fill the whole frame edge to edge. The scene continues into neighbouring tiles, so anything cut by the border stays cut at exactly the same place.
- No text, labels, street names, lettering on signs, UI, legend, border, frame, vignette, watermark or sky."""

RETURN = """WHAT TO SEND BACK
- The ORIGINAL generated image file(s) exactly as produced - full resolution, PNG preferred - not a screenshot, preview or re-compressed copy - named exactly as listed above.
- A short note with the model name and version you used and any settings you can disclose (e.g. seed, steps, guidance / strength, quality, output size, edit or inpaint mode, number of attempts). Write "unknown" for anything you can't tell."""


# ----------------------------------------------------------------------------------------------- packet helpers
class Packet:
    """Collects the attachment files of one batch (in order) with their purpose, tiles and hashes."""

    def __init__(self, bid):
        self.bid = bid
        self.dir = A.sp('requests', bid)
        shutil.rmtree(self.dir, ignore_errors=True)  # generated output: the folder holds exactly this packet's files
        os.makedirs(self.dir)
        self.files = []

    def add(self, name, img, purpose, tiles, composition=False):
        path = A.save_png(img, os.path.join(self.dir, name))
        with Image.open(path) as im:
            w, h = im.size
        self.files.append({'file': name, 'purpose': purpose, 'tiles': tiles, 'defines_composition': composition,
                           'size': [w, h], 'sha256': A.sha_file(path)})
        return name

    def sha(self, name):
        return next(f['sha256'] for f in self.files if f['file'] == name)


def write_zip(bid, md_path, files):
    """Deterministic zip (fixed timestamps, sorted entries): the md plus every attachment, flat."""
    zpath = A.sp('requests', f'{bid}.zip')
    entries = [(os.path.basename(md_path), md_path)] + [(f['file'], os.path.join(A.sp('requests', bid), f['file'])) for f in files]
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
        for arc, src in sorted(entries):
            zi = zipfile.ZipInfo(arc, date_time=(1980, 1, 1, 0, 0, 0)); zi.compress_type = zipfile.ZIP_DEFLATED
            with open(src, 'rb') as f:
                z.writestr(zi, f.read())
    return zpath


def contact_sheet(tiles, requested, title):
    """Context sheet of a tile patch at half scale: grid, tile ids, finished/requested status, landmark labels."""
    ij = [A.parse_tid(t) for t in tiles]
    i0, i1 = min(i for i, _ in ij), max(i for i, _ in ij); j0, j1 = min(j for _, j in ij), max(j for _, j in ij)
    cols, rows = i1 - i0 + 1, j1 - j0 + 1
    rgb, src = A.mosaic(i0 * F(), j0 * F(), cols * F(), rows * F())
    half = F() // 2
    sheet = Image.fromarray(rgb).resize((cols * half, rows * half), Image.BOX)
    head = 56
    im = Image.new('RGB', (sheet.width, sheet.height + head), (24, 26, 30)); im.paste(sheet, (0, head))
    d = ImageDraw.Draw(im)
    d.text((14, 16), title, font=A.font(20, True), fill=(255, 255, 255))
    for i in range(i0, i1 + 1):
        for j in range(j0, j1 + 1):
            t = A.tid(i, j); x, y = (i - i0) * half, (j - j0) * half + head
            d.rectangle([x, y, x + half - 1, y + half - 1], outline=(255, 255, 255), width=1)
            state = 'finished art' if A.accepted_rgb(t) is not None else ('reference only' if A.has_reference(t) else 'no data')
            if t in requested: state = 'REQUESTED NOW'
            A.label(d, (x + 10, y + 10), f'tile {t}  -  {state}', size=16, bg=(200, 30, 30) if t in requested else (20, 20, 24))
            if t in requested:
                d.rectangle([x + 2, y + 2, x + half - 3, y + half - 3], outline=(230, 30, 30), width=5)
    for lm in A.load_json(os.path.join(A.ROOT, 'web', 'public', 'data', 'landmarks.json'), []):
        x = (lm['canvas'][0] - i0 * F()) / 2; y = (lm['canvas'][1] - j0 * F()) / 2 + head
        if 0 <= x < sheet.width and head <= y < im.height:
            text = lm['name'] if len(lm['name']) <= 26 else lm.get('short') or lm['name'][:26]
            tw = d.textlength(text, font=A.font(13, True))
            d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(255, 210, 0), outline=(0, 0, 0))
            A.label(d, (min(x + 9, im.width - tw - 6), y - 9), text, size=13, bg=(0, 0, 0))
    # north arrow: north (0,1,0) on screen is (dot(N,right), -dot(N,up)) = up and slightly left
    r, u = cfg_axes()
    nx, ny = r[1], -u[1]; n = np.hypot(nx, ny); nx, ny = nx / n, ny / n
    cx, cy = im.width - 46, head + 50
    d.line([cx - nx * 26, cy - ny * 26, cx + nx * 26, cy + ny * 26], fill=(255, 255, 255), width=4)
    d.polygon([(cx + nx * 34, cy + ny * 34), (cx + nx * 18 - ny * 9, cy + ny * 18 + nx * 9), (cx + nx * 18 + ny * 9, cy + ny * 18 - nx * 9)],
              fill=(255, 255, 255))
    A.label(d, (cx - 8 - nx * 50, cy - 10 - ny * 50), 'N', size=16)
    return im


def cfg_axes():
    from world import axes
    r, u, _b = axes()
    return r, u


def tile_contents(t):
    lines = []
    for n in A.tile_notes(t):
        desc = n['hint'] or 'campus building - follow the reference wall colour for its material'
        lines.append(f"- {n['name']} ({n['where']}, around x={n['x']}, y={n['y']}): {desc}")
    streets = A.tile_streets(t)
    if streets: lines.append('- Streets and paths crossing it: ' + ', '.join(streets))
    return '\n'.join(lines)


def batch_record(bid):
    return A.load_batches()['batches'].get(bid)


def save_batch(rec):
    b = A.load_batches(); b['batches'][rec['id']] = rec; A.save_batches(b)


def merge_items(old, new):
    """Keep receive/QA history of items when a packet is rebuilt (e.g. a draft refreshed after its dependency).

    old/new are whole batch records. Items of the old record that the rebuild no longer requests (accepted ones) are kept
    unchanged, so their receive/QA/accept history stays in batches.json; only new['order'] (the to-do list) is re-sent."""
    if not old: return new
    old_items = old.get('items', {})
    for t, it in new['items'].items():
        o = old_items.get(t)
        if not o: continue
        for k in ('received', 'model_reported', 'settings_reported', 'qa', 'revision_batch', 'accepted'):
            if k in o: it[k] = o[k]
        if o['status'] not in ('draft', 'requested'): it['status'] = o['status']
    for t, o in old_items.items():
        if t not in new['items'] and o.get('status') == 'accepted': new['items'][t] = o
    return new


def next_id(prefix):
    ids = [k for k in A.load_batches()['batches'] if re.fullmatch(prefix + r'\d{3}', k)]
    return f'{prefix}{len(ids) + 1:03d}'


# ----------------------------------------------------------------------------------------------- tile batches
def build_batch(bid, tiles=None, depends=None, frame='square', mode=None, title=None):
    plan = dict(PLAN.get(bid, {}))
    if not plan and not tiles: raise SystemExit(f'{bid} is not a planned batch; pass --tiles (and --depends) to define it')
    if tiles: plan['tiles'] = tiles
    if depends is not None: plan['depends_on'] = depends
    plan.setdefault('kind', 'patch'); plan.setdefault('depends_on', [])
    plan['mode'] = mode or plan.get('mode', 'context')
    plan['title'] = title or plan.get('title', f'Tiles {", ".join(plan["tiles"])}')
    if not plan.get('style_from'):
        # Style reference: first dependency, else the accepted tile the shared finish palette was built from (the style sample).
        accepted = A.load_tiles_meta()
        sample = (A.cfg().get('art_finish') or {}).get('palette_from') if hasattr(A, 'cfg') else None
        plan['style_from'] = next((t for t in plan['depends_on']), None) or (sample if sample in accepted else next(iter(sorted(accepted)), None))
    for t in plan['tiles'] + plan['depends_on']:
        if not A.has_reference(t): raise SystemExit(f'tile {t} has no reference job in data_cache/jobs (run prepare_tiles/render first)')
    old = batch_record(bid)
    if old and old.get('kind') in ('seam', 'revision'): raise SystemExit(f'{bid} is a {old["kind"]} batch; it cannot be rebuilt')
    tiles_meta = A.load_tiles_meta()
    # accepted tiles have nothing left to request, unless explicitly listed with --tiles
    todo = [t for t in plan['tiles'] if tiles or (old or {}).get('items', {}).get(t, {}).get('status') != 'accepted']
    if not todo: raise SystemExit(f'{bid}: every tile is already accepted')
    blocked = [t for t in plan['depends_on'] if t not in tiles_meta or not os.path.exists(A.accepted_path(t))]
    status = 'draft' if blocked else 'requested'

    pk = Packet(bid)
    present = set()
    items = {}
    shared = []
    style = plan['style_from'] if plan['mode'] == 'context' else None
    if style:
        art = A.accepted_rgb(style)
        img = art if art is not None else A.reference_rgb(style)
        purpose = ('STYLE: finished, accepted artwork of neighbouring tile ' + style + ' - match its palette, pixel size, outlines, '
                   'windows, trees and light exactly' if art is not None else
                   'DRAFT PLACEHOLDER (reference render) - replaced by the accepted art of ' + style + ' when the batch is rebuilt')
        shared.append(pk.add(f'{bid}_style_{style}.png', img, purpose, [style]))
    sheet_tiles = plan.get('sheet') or sorted(set(todo) | set(plan['depends_on']))
    shared.append(pk.add(f'{bid}_contact_sheet.png', contact_sheet(sheet_tiles, todo, f'{bid}: context only - do not copy the labels'),
                         'CONTEXT ONLY: surrounding tiles at half scale, requested tile(s) outlined in red, landmark labels', sheet_tiles))
    frame_spec = FRAMES[frame] if plan['mode'] == 'context' else (F(), F(), 0, 0)
    cw, ch, mx, my = frame_spec
    for t in todo:
        i, j = A.parse_tid(t)
        x0, y0 = i * F() - mx, j * F() - my
        cls = A.mosaic_classes(x0, y0, cw, ch); present |= set(np.unique(cls).tolist())
        files = {}
        if plan['mode'] == 'tile':
            files['composition'] = pk.add(f'{bid}_ref_{t}.png', A.reference_rgb(t),
                                          f'COMPOSITION: reference render of tile {t}; the output must match its layout pixel for pixel', [t], True)
            neighbours = {}
        else:
            rgb, src = A.mosaic(x0, y0, cw, ch)
            mask = np.where(src == 2, 0, 255).astype(np.uint8)
            mask[my:my + F(), mx:mx + F()] = 255
            files['composition'] = pk.add(f'{bid}_context_{t}.png', rgb,
                                          f'COMPOSITION + CANVAS TO EDIT ({cw}x{ch}): tile {t} underdrawing in the centre '
                                          f'({mx},{my})-({mx + F()},{my + F()}), surroundings in the margin', [t], True)
            files['mask'] = pk.add(f'{bid}_mask_{t}.png', mask, 'EDIT MASK: white = paint, black = keep (finished neighbour art)', [t])
            neighbours = {}
            for side, n in A.neighbours4(t).items():
                neighbours[n] = tiles_meta.get(n, {}).get('version') if os.path.exists(A.accepted_path(n)) else (
                    'reference' if A.has_reference(n) else 'none')
        files['classes'] = pk.add(f'{bid}_classes_{t}.png', A.semantic_rgb(cls),
                                  'SEMANTIC MAP (same framing as the composition): colour = surface type, see legend', [t])
        files['depth'] = pk.add(f'{bid}_depth_{t}.png', A.depth_image(A.mosaic_depth(x0, y0, cw, ch)),
                                f'HEIGHT GUIDE: brighter = taller above ground, white = {A.DEPTH_MAX_M:.0f} m or more', [t])
        jd = os.path.join(A.JOBS, t)
        items[t] = {
            'status': 'draft' if blocked else 'requested',
            'return_filename': f'{bid}_{t}.png',
            'files': files,
            'output': {'mode': plan['mode'], 'frame': frame if plan['mode'] == 'context' else 'tile',
                       'width': cw, 'height': ch, 'crop': [mx, my, mx + F(), my + F()], 'canvas_origin': [x0, y0]},
            'reference': {'color2x': A.sha_file(os.path.join(jd, 'color2x.png'))[:12], 'cls': A.sha_file(os.path.join(jd, 'cls.png'))[:12],
                          'height': A.sha_file(os.path.join(jd, 'height.png'))[:12],
                          'composition': pk.sha(files['composition'])[:12], 'neighbours': neighbours},
            'model_reported': 'unknown', 'settings_reported': 'unknown', 'received': [], 'qa': None,
        }
    shared.append(pk.add(f'{bid}_classes_legend.png', A.legend_image(present), 'LEGEND for the semantic maps', todo))
    for t in todo:
        items[t]['prompt'] = tile_prompt(bid, t, plan, items, shared, todo)
        items[t]['prompt_sha'] = A.sha_text(items[t]['prompt'])[:12]
    rec = {'id': bid, 'kind': plan['kind'], 'title': plan['title'], 'mode': plan['mode'], 'frame': frame if plan['mode'] == 'context' else 'tile',
           'status': status, 'depends_on': plan['depends_on'], 'blocked_by': blocked, 'parent': None,
           'created_utc': (old or {}).get('created_utc', A.utc_now()), 'updated_utc': A.utc_now(),
           'packet_rev': (old or {}).get('packet_rev', 0) + 1, 'order': todo, 'style_from': style, 'shared_files': shared,
           'attachments': pk.files, 'items': items}
    rec = merge_items(old, rec)
    finish_packet(rec, pk)
    return rec


def tile_prompt(bid, t, plan, items, shared, order):
    it = items[t]; f = it['files']; o = it['output']
    legend = f'{bid}_classes_legend.png'
    head = f'TASK - tile {t}' + (f' ({plan["title"]})' if plan['mode'] == 'tile' else '')
    if plan['mode'] == 'tile':
        task = (f"{head}\nPaint a finished pixel-art version of {f['composition']} at the same size and framing. Use {f['classes']} "
                f"(colour legend: {legend}) to know what every surface is, and {f['depth']} (brighter = taller above ground) for "
                f"building heights. {bid}_contact_sheet.png shows the surrounding campus for orientation only (requested tile outlined "
                f"in red) - don't copy its labels or grid.")
        out = (f"OUTPUT\n- One image, exactly {F()} x {F()} px (1:1), PNG, named {it['return_filename']}.\n"
               f"- If your tool can only make a larger square (e.g. 2048 x 2048), that is fine: same composition, just bigger. "
               f"Never crop, pad, letterbox or change the aspect ratio.")
    else:
        cw, ch = o['width'], o['height']; x0, y0, x1, y1 = o['crop']
        style = next((s for s in shared if '_style_' in s), None)
        task = (f"{head}\nEdit {f['composition']} ({cw} x {ch} px). Its central {F()} x {F()} square (x {x0}-{x1 - 1}, y {y0}-{y1 - 1}) "
                f"is the new tile, shown as the reference underdrawing; the border around it is the surroundings.\n"
                f"{f['mask']} (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are "
                f"finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across "
                f"the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: "
                f"paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)\n"
                f"Match the finished style of {style} exactly: palette, pixel size, outlines, window pattern, tree style and light. "
                f"Use {f['classes']} (legend: {legend}) for surface types and {f['depth']} for building heights.")
        same_batch = [n for n in A.neighbours4(t).values() if n in order and order.index(n) < order.index(t)]
        if same_batch:
            task += (f"\nPaint this tile after {' and '.join(same_batch)}: where its border shows the underdrawing of "
                     f"{' / '.join(same_batch)}, match what you painted for {'those tiles' if len(same_batch) > 1 else 'that tile'} "
                     f"earlier in this conversation.")
        alt = f'; if 1024 x 1024 is your only size, return the same full canvas scaled to it' if cw == ch else ''
        out = (f"OUTPUT\n- Return the WHOLE canvas: {cw} x {ch} px, PNG, same framing as {f['composition']}, named {it['return_filename']}. "
               f"We cut the tile out ourselves.\n- If you can't output {cw} x {ch}: a larger image with exactly the same aspect ratio is "
               f"fine{alt}. Never crop, pad or change the aspect ratio.")
    return '\n\n'.join([task, 'THIS TILE SHOWS\n' + (tile_contents(t) or '- campus grounds'), out])


def finish_packet(rec, pk):
    """Write the md + zip for a batch record and save it in batches.json."""
    md_path = os.path.join(A.md_dir(), f'IMAGE_REQUEST_{rec["id"]}.md')
    with open(md_path, 'w') as f:
        f.write(render_md(rec))
    zpath = write_zip(rec['id'], md_path, pk.files)
    rec['packet'] = {'md': A.rel(md_path), 'dir': A.rel(pk.dir), 'zip': A.rel(zpath), 'zip_sha256': A.sha_file(zpath)}
    save_batch(rec)
    print(f'{rec["id"]}: {rec["status"]} - {len(pk.files)} attachments in {A.rel(pk.dir)}, {A.rel(md_path)}, {A.rel(zpath)}')


# ----------------------------------------------------------------------------------------------- markdown
def messages(rec):
    """Split a batch into paste-able messages: message 1 carries the full brief, later ones one tile each."""
    order = rec['order']; shared = rec['shared_files']
    msgs = []
    for k, t in enumerate(order):
        it = rec['items'][t]
        attach = list(it['files'].values()) + (shared if k == 0 else [])  # composition first
        if k == 0:
            n = len(order)
            body = [INTRO + (f' This conversation covers {n} tiles; this is tile 1 of {n} - I will send the others one at a time '
                             f'with the same rules.' if n > 1 else ''), attach_list(rec, attach), ART_DIRECTION, LIGHT, CAMERA, GEOMETRY]
            if rec['kind'] == 'revision': body.insert(1, rec['correction_text'][t])
            body += [it['prompt'], RETURN]
        else:
            body = [f'Next tile ({k + 1} of {len(order)}): same art direction, light, camera, geometry rules and style as before.',
                    attach_list(rec, attach), it['prompt'], 'Send back the original file and the model/settings note as before.']
            if rec['kind'] == 'revision': body.insert(1, rec['correction_text'][t])
        msgs.append({'tile': t, 'attach': attach, 'text': '\n\n'.join(body)})
    return msgs


def attach_list(rec, names):
    by = {f['file']: f for f in rec['attachments']}
    return 'ATTACHED FILES\n' + '\n'.join(f'- {n} ({by[n]["size"][0]}x{by[n]["size"][1]}) - {by[n]["purpose"]}' for n in names)


def render_md(rec):
    bid = rec['id']; msgs = messages(rec)
    total = len({a for m in msgs for a in m['attach']})
    L = [f'# Image request {bid} - {rec["title"]}', '']
    if rec['status'] == 'draft':
        L += [f'> **DRAFT - do not send yet.** Waiting for {", ".join(rec["blocked_by"])} to be accepted. After that, rebuild with',
              f'> `python3 pipeline/art_request.py build {bid}` - the margins then show the finished art.', '']
    L += [f'Packet revision {rec["packet_rev"]}, built {rec["updated_utc"]}. Status: `{rec["status"]}`.', '',
          '## What to do (for the user)', '',
          f'Everything is in `art/requests/{bid}/` (also zipped as `art/requests/{bid}.zip`). Start a **new conversation** with the image agent.', '']
    for k, m in enumerate(msgs):
        head = f'**Message {k + 1}**' + (f' (tile {m["tile"]})' if len(msgs) > 1 else '')
        L += [f'{k + 1}. {head}: attach these {len(m["attach"])} files, then paste the text of "Message {k + 1}" below.', '']
        L += [f'   - `{a}`' for a in m['attach']] + ['']
        if len(msgs) > 1 and k < len(msgs) - 1:
            L += ['   Wait for the image before sending the next message.', '']
    names = [rec['items'][t]['return_filename'] for t in rec['order']]
    L += [f'{len(msgs) + 1}. Save what comes back in one folder (e.g. `~/Downloads/{bid}/`) with exactly these names: '
          + ', '.join(f'`{n}`' for n in names) + '. Copy the agent\'s note about model and settings into '
          f'`{bid}_report.txt` in the same folder.', '',
          f'{len(msgs) + 2}. Check it: `python3 pipeline/art_import.py {bid} ~/Downloads/{bid}` (QA report only), then '
          f'`python3 pipeline/art_import.py {bid} ~/Downloads/{bid} --accept` to accept tiles that pass.', '',
          f'Total: {total} attachment files, {len(names)} image(s) to bring back.', '']
    for k, m in enumerate(msgs):
        L += [f'## Message {k + 1}' + (f' - tile {m["tile"]}' if len(msgs) > 1 else ''), '', '```text', m['text'], '```', '']
    L += ['## Packet details (for reference - the agent does not need this section)', '',
          '| File | Size | Purpose | Tiles | Defines composition | sha256 |', '|---|---|---|---|---|---|']
    for f in rec['attachments']:
        L.append(f'| `{f["file"]}` | {f["size"][0]}x{f["size"][1]} | {f["purpose"]} | {", ".join(f["tiles"])} | '
                 f'{"yes" if f["defines_composition"] else "no"} | `{f["sha256"][:12]}` |')
    L += ['', '| Return file | Item | Expected size | Crop in returned image (x0, y0, x1, y1) | Becomes |', '|---|---|---|---|---|']
    for t in rec['order']:
        it = rec['items'][t]; o = it['output']
        dest = f'`art/accepted/{t}.png` (1024x1024)' if o['mode'] != 'seam' else 'band composited into ' + ', '.join(f'`{x}`' for x in o['tiles'])
        crop = o.get('crop', [0, 0, o['width'], o['height']])
        L.append(f'| `{it["return_filename"]}` | {t} | {o["width"]}x{o["height"]} | {tuple(crop)} | {dest} |')
    L += ['', crop_math(rec), '', camera_md(), '', qa_md(rec)]
    return '\n'.join(L) + '\n'


def crop_math(rec):
    it = rec['items'][rec['order'][0]]; o = it['output']
    if o['mode'] == 'tile':
        return ('**Crop math.** The returned square of side W is the whole tile: if W = 1024 it is used as is; if W > 1024 it is '
                'box-filtered down to 1024 (scale k = W/1024). Smaller or non-square images are rejected.')
    if o['mode'] == 'seam':
        return (f'**Crop math.** The returned square of side W is the {SEAM_WINDOW}-px window (scale k = W/{SEAM_WINDOW}, box-filtered to '
                f'{SEAM_WINDOW}). Only the band (mask white, feathered 8 px) is composited back; the rest of the window must be unchanged.')
    cw, ch = o['width'], o['height']; x0, y0, x1, y1 = o['crop']
    text = (f'**Crop math (context edit).** Context canvas = {cw}x{ch} canvas px at 1:1, origin at canvas px '
            f'(tile_x*1024 - {x0}, tile_y*1024 - {y0}). For a returned image W x H with W/H = {cw}/{ch} (within 1 %), k = W/{cw}; '
            f'the tile is the box ({x0}k, {y0}k, {x1}k, {y1}k), resampled to 1024x1024 (box filter when k >= 1, Lanczos when '
            f'k < 1). {cw}x{ch} -> crop ({x0}, {y0}, {x1}, {y1}) exactly; a 2x image -> crop doubled, then box-halved.')
    if cw == ch:
        k = F() / cw
        text += (f' Fixed-size fallback 1024x1024: k = {k:.4f}, crop ({x0 * k:.2f}, {y0 * k:.2f}, {x1 * k:.2f}, {y1 * k:.2f}) upscaled '
                 f'x{1 / k:.2f} (accepted with a reduced-detail warning). Agents limited to 1536x1024 or 1024x1536 get a native-scale '
                 'packet instead: `build <batch> --frame wide` (margins left/right only, crop (256, 0, 1280, 1024)) or `--frame tall` '
                 '(margins top/bottom only, crop (0, 256, 1024, 1280)).')
    else:
        text += ' This frame is itself the fixed output size, so no scaling is involved.'
    return text + ' Joins that a frame has no margin for are repaired afterwards with seam packets (`art_request.py seam`).'


def camera_md():
    c = cfg()['camera']; s = cfg()['sun']
    return (f'**Camera and light.** Orthographic, heading {c["heading_deg"]} deg (camera looks NNE), pitch {c["pitch_deg"]} deg, '
            f'{c["meters_per_px"]} m per artwork px. Sun azimuth {s["azimuth_deg"]} deg, elevation {s["elevation_deg"]} deg: '
            'light from the lower left / behind the viewer, cast shadows toward the upper right. Tile (i, j) covers canvas '
            'px [i*1024, (i+1)*1024) x [j*1024, (j+1)*1024).')


def qa_md(rec):
    return ('**QA on receipt** (`pipeline/art_import.py`, thresholds in docs/ART_PIPELINE.md): filename -> item match; decode; '
            'size / aspect; global translation by phase correlation of edge maps (> 4 px fails); local displacement and '
            'scale/rotation from a block grid (camera change); geometry agreement of class-map boundaries with image edges '
            '(whole tile, 8x8 cells, every building roof, landmark roofs); sun/shadow side; colour style against accepted '
            'tiles; seam discontinuity in a 4 px band against accepted neighbours; for context edits, drift of the kept margin.')


# ----------------------------------------------------------------------------------------------- seam packets
def seam_geometry(pair=None, quad=None):
    """Window origin, joins and tiles for a seam packet. pair 'A:B' (edge neighbours) or quad = top-left tile id."""
    h = SEAM_WINDOW // 2
    if pair:
        a, b = pair.split(':')
        (ia, ja), (ib, jb) = A.parse_tid(a), A.parse_tid(b)
        if (ia, ja) > (ib, jb): (ia, ja), (ib, jb), a, b = (ib, jb), (ia, ja), b, a
        if ja == jb and ib == ia + 1:
            return {'x0': ib * F() - h, 'y0': ja * F(), 'joins': [{'axis': 'vertical', 'at': h, 'tiles': [a, b]}], 'tiles': [a, b], 'kind': 'vertical'}
        if ia == ib and jb == ja + 1:
            return {'x0': ia * F(), 'y0': jb * F() - h, 'joins': [{'axis': 'horizontal', 'at': h, 'tiles': [a, b]}], 'tiles': [a, b], 'kind': 'horizontal'}
        raise SystemExit(f'{pair}: tiles are not edge neighbours')
    i, j = A.parse_tid(quad)
    tl, tr, bl, br = A.tid(i, j), A.tid(i + 1, j), A.tid(i, j + 1), A.tid(i + 1, j + 1)
    return {'x0': (i + 1) * F() - h, 'y0': (j + 1) * F() - h, 'kind': 'junction', 'tiles': [tl, tr, bl, br],
            'joins': [{'axis': 'vertical', 'at': h, 'tiles': [tl, tr]}, {'axis': 'vertical', 'at': h, 'tiles': [bl, br]},
                      {'axis': 'horizontal', 'at': h, 'tiles': [tl, bl]}, {'axis': 'horizontal', 'at': h, 'tiles': [tr, br]}]}


def seam_mask(geo, band=SEAM_BAND):
    m = np.zeros((SEAM_WINDOW, SEAM_WINDOW), np.uint8)
    for jn in geo['joins']:
        if jn['axis'] == 'vertical': m[:, jn['at'] - band:jn['at'] + band] = 255
        else: m[jn['at'] - band:jn['at'] + band, :] = 255
    return m


def seam_profiles(geo, rgb):
    """Seam metrics for every join inside a window image (rgb 1024x1024)."""
    out = []
    for jn in geo['joins']:
        at = jn['at']
        if jn['axis'] == 'vertical':
            half = slice(0, at) if geo['kind'] != 'junction' else (slice(0, at) if jn['tiles'][0] == geo['tiles'][0] else slice(at, None))
            a, b = rgb[half, :at], rgb[half, at:]
            r = A.seam_metrics(a, b, 'vertical')
        else:
            half = slice(None) if geo['kind'] != 'junction' else (slice(0, at) if jn['tiles'][0] == geo['tiles'][0] else slice(at, None))
            a, b = rgb[:at, half], rgb[at:, half]
            r = A.seam_metrics(a, b, 'horizontal')
        r['tiles'] = jn['tiles']; r['axis'] = jn['axis']
        out.append(r)
    return out


def build_seam(pair=None, quad=None, band=SEAM_BAND):
    geo = seam_geometry(pair, quad)
    tiles_meta = A.load_tiles_meta()
    missing = [t for t in geo['tiles'] if not os.path.exists(A.accepted_path(t))]
    if missing: raise SystemExit(f'seam packets are made from accepted art; not accepted yet: {", ".join(missing)}')
    sid = next_id('S')
    x0, y0 = geo['x0'], geo['y0']
    rgb, _src = A.mosaic(x0, y0, SEAM_WINDOW, SEAM_WINDOW)
    ref, _ = A.mosaic(x0, y0, SEAM_WINDOW, SEAM_WINDOW, use_accepted=False)
    mask = seam_mask(geo, band)
    prof = seam_profiles(geo, rgb)
    pk = Packet(sid)
    f_win = pk.add(f'{sid}_window.png', rgb, f'CANVAS TO EDIT + COMPOSITION: current accepted art around the join ({SEAM_WINDOW}x{SEAM_WINDOW})',
                   geo['tiles'], True)
    f_mask = pk.add(f'{sid}_mask.png', mask, f'EDIT MASK: white = repaint band ({2 * band} px wide), black = keep pixel-identical', geo['tiles'])
    f_ref = pk.add(f'{sid}_ref.png', ref, 'GEOMETRY: reference underdrawing of the same window (where every edge must be)', geo['tiles'])
    f_mark = pk.add(f'{sid}_marked.png', seam_marked(rgb, geo, band, prof), 'ANNOTATED: band in red, join line dashed, worst rows in yellow', geo['tiles'])
    shared = [f_win, f_mask, f_ref, f_mark]
    joins_txt = '; '.join(f'{p["axis"]} join between {p["tiles"][0]} and {p["tiles"][1]} (discontinuity x{p["grad_ratio"]:.2f} of '
                          f'the interior gradient, colour step x{p["step_ratio"]:.2f})' for p in prof)
    where = {'vertical': 'the vertical line at x = 512', 'horizontal': 'the horizontal line at y = 512',
             'junction': 'the cross at x = 512 and y = 512 where four tiles meet'}[geo['kind']]
    prompt = (f"TASK - seam repair {sid}\nIn {f_win}, {where} is where separately painted tiles meet, and the join is visible. "
              f"Repaint ONLY the white band of {f_mask} so the band reads as one continuous painting: carry roofs, walls, window rows, "
              f"roads, kerbs, path edges, lawn texture and tree clusters straight across the line and blend colour and brightness "
              f"smoothly. Everything in the black area must stay pixel-identical. Keep every edge where {f_ref} has it (no moved or "
              f"invented buildings, roads or trees). {f_mark} shows the band and the worst spots - it is a guide only.\n"
              f"Measured now: {joins_txt}.\n\nOUTPUT\n- One image, exactly {SEAM_WINDOW} x {SEAM_WINDOW} px, PNG, named {sid}_seam.png, "
              f"same framing as {f_win}. A larger square is fine; never crop, pad or change the aspect ratio.")
    item = {'status': 'requested', 'return_filename': f'{sid}_seam.png', 'files': {'composition': f_win, 'mask': f_mask},
            'output': {'mode': 'seam', 'width': SEAM_WINDOW, 'height': SEAM_WINDOW, 'window': [x0, y0], 'band': band,
                       'kind': geo['kind'], 'joins': geo['joins'], 'tiles': geo['tiles']},
            'reference': {'composition': pk.sha(f_win)[:12], 'tiles': {t: tiles_meta.get(t, {}).get('version') for t in geo['tiles']},
                          'jobs': {t: A.reference_hashes(t) for t in geo['tiles']}},
            'before': prof, 'prompt': prompt, 'prompt_sha': A.sha_text(prompt)[:12],
            'model_reported': 'unknown', 'settings_reported': 'unknown', 'received': [], 'qa': None}
    rec = {'id': sid, 'kind': 'seam', 'title': f'Seam repair - {geo["kind"]} join of ' + ', '.join(geo['tiles']), 'mode': 'seam',
           'status': 'requested', 'depends_on': geo['tiles'], 'blocked_by': [], 'parent': None, 'created_utc': A.utc_now(),
           'updated_utc': A.utc_now(), 'packet_rev': 1, 'order': ['seam'], 'shared_files': shared, 'attachments': pk.files,
           'items': {'seam': item}}
    finish_packet(rec, pk)
    return rec


def seam_marked(rgb, geo, band, prof):
    im = Image.fromarray(rgb).copy(); d = ImageDraw.Draw(im)
    for jn in geo['joins']:
        at = jn['at']
        if jn['axis'] == 'vertical':
            d.rectangle([at - band, 0, at + band - 1, SEAM_WINDOW - 1], outline=(230, 30, 30), width=3)
            for y in range(0, SEAM_WINDOW, 24): d.line([at, y, at, y + 12], fill=(255, 255, 255), width=2)
        else:
            d.rectangle([0, at - band, SEAM_WINDOW - 1, at + band - 1], outline=(230, 30, 30), width=3)
            for x in range(0, SEAM_WINDOW, 24): d.line([x, at, x + 12, at], fill=(255, 255, 255), width=2)
    for p in prof:
        off = 0
        if geo['kind'] == 'junction' and p['tiles'][0] != geo['tiles'][0]: off = SEAM_WINDOW // 2
        for a, b in p['worst']:
            if p['axis'] == 'vertical':
                d.rectangle([SEAM_WINDOW // 2 - band - 6, off + a, SEAM_WINDOW // 2 + band + 5, off + b], outline=(255, 220, 0), width=3)
            else:
                d.rectangle([off + a, SEAM_WINDOW // 2 - band - 6, off + b, SEAM_WINDOW // 2 + band + 5], outline=(255, 220, 0), width=3)
    for t in geo['tiles']:
        i, j = A.parse_tid(t)
        x = max(0, i * F() - geo['x0']) + 8; y = max(0, j * F() - geo['y0']) + 8
        A.label(d, (x, y), f'tile {t}', size=16)
    return im


# ----------------------------------------------------------------------------------------------- revision packets
def build_revision(parent_id, fixes):
    """Focused re-request for items that failed QA.

    fixes: {item: {'prev': uint8 image as returned (tile crop, or window for seams), 'marked': PIL annotated image,
                   'corrections': [str]}}. Returns the new batch id (<root>R<n>).
    """
    batches = A.load_batches()['batches']
    parent = batches[parent_id]
    root = re.match(r'^([A-Z]\d{3})', parent_id).group(1)
    n = 1 + sum(1 for k in batches if re.fullmatch(root + r'R\d+', k))
    rid = f'{root}R{n}'
    pk = Packet(rid)
    items = {}; shared = []; present = set()
    for key, fx in fixes.items():
        pit = parent['items'][key]; o = dict(pit['output'])
        files = {}
        if o['mode'] == 'seam':
            geo = {'x0': o['window'][0], 'y0': o['window'][1], 'joins': o['joins'], 'tiles': o['tiles'], 'kind': o['kind']}
            rgb, _ = A.mosaic(geo['x0'], geo['y0'], SEAM_WINDOW, SEAM_WINDOW)
            ref, _ = A.mosaic(geo['x0'], geo['y0'], SEAM_WINDOW, SEAM_WINDOW, use_accepted=False)
            files['composition'] = pk.add(f'{rid}_window.png', rgb, 'CANVAS TO EDIT + COMPOSITION: current accepted art around the join',
                                          o['tiles'], True)
            files['mask'] = pk.add(f'{rid}_mask.png', seam_mask(geo, o['band']), 'EDIT MASK: white = repaint band, black = keep', o['tiles'])
            files['reference'] = pk.add(f'{rid}_ref.png', ref, 'GEOMETRY: reference underdrawing of the window', o['tiles'])
            ret = f'{rid}_seam.png'
        else:
            t = key; i, j = A.parse_tid(t)
            x0, y0 = i * F() - o['crop'][0], j * F() - o['crop'][1]
            if o['mode'] == 'context':
                rgb, src = A.mosaic(x0, y0, o['width'], o['height'])
                mask = np.where(src == 2, 0, 255).astype(np.uint8)
                cx0, cy0, cx1, cy1 = o['crop']; mask[cy0:cy1, cx0:cx1] = 255
                files['composition'] = pk.add(f'{rid}_context_{t}.png', rgb, f'COMPOSITION + CANVAS TO EDIT ({o["width"]}x{o["height"]}), '
                                              f'tile in the centre at {tuple(o["crop"])}', [t], True)
                files['mask'] = pk.add(f'{rid}_mask_{t}.png', mask, 'EDIT MASK: white = paint, black = keep (finished neighbour art)', [t])
                files['reference'] = pk.add(f'{rid}_ref_{t}.png', A.reference_rgb(t), f'GEOMETRY: reference render of tile {t} alone', [t])
            else:
                files['composition'] = pk.add(f'{rid}_ref_{t}.png', A.reference_rgb(t),
                                              f'COMPOSITION: reference render of tile {t}; match its layout pixel for pixel', [t], True)
            cls = A.mosaic_classes(x0, y0, o['width'], o['height']); present |= set(np.unique(cls).tolist())
            files['classes'] = pk.add(f'{rid}_classes_{t}.png', A.semantic_rgb(cls), 'SEMANTIC MAP (same framing as the composition)', [t])
            o['canvas_origin'] = [x0, y0]
            ret = f'{rid}_{t}.png'
        tag = key if o['mode'] != 'seam' else 'seam'; tiles = [key] if o['mode'] != 'seam' else o['tiles']
        if fx['prev'] is not None:  # undecodable / wrongly sized returns have nothing useful to annotate
            files['previous'] = pk.add(f'{rid}_previous_{tag}.png', fx['prev'], 'YOUR PREVIOUS OUTPUT (as received) - keep what is good about it', tiles)
            files['marked'] = pk.add(f'{rid}_marked_{tag}.png', fx['marked'],
                                     'ANNOTATED: what is wrong (red = missing/misplaced vs reference, yellow = displaced area, labels give the fix)', tiles)
        # corrections were worded against the parent's file names: point them at this packet's files
        corrections = []
        for c in fx['corrections']:
            for role, name in pit['files'].items():
                if role in files: c = c.replace(name, files[role])
            corrections.append(c.replace('the marked image', files.get('marked', 'the marked image')))
        items[key] = {'status': 'requested', 'return_filename': ret, 'files': files, 'output': o,
                      # the revision packet is rendered from the current reference jobs: record their hashes, not the parent's
                      'reference': dict(pit['reference'], composition=pk.sha(files['composition'])[:12],
                                        **({'jobs': {t: A.reference_hashes(t) for t in o['tiles']}} if o['mode'] == 'seam'
                                           else A.reference_hashes(key))),
                      'model_reported': 'unknown', 'settings_reported': 'unknown', 'received': [], 'qa': None,
                      'revision_of': {'batch': parent_id, 'corrections': corrections}}
        if o['mode'] == 'seam': items[key]['before'] = pit.get('before')
    if present:
        shared.append(pk.add(f'{rid}_classes_legend.png', A.legend_image(present), 'LEGEND for the semantic maps', list(items)))
    style = parent.get('style_from')
    if style and os.path.exists(A.accepted_path(style)):
        shared.insert(0, pk.add(f'{rid}_style_{style}.png', A.accepted_rgb(style), f'STYLE: accepted artwork of tile {style} - match it', [style]))
    rec = {'id': rid, 'kind': 'revision', 'title': f'Revision of {parent_id}: ' + ', '.join(items), 'mode': parent['mode'],
           'frame': parent.get('frame'), 'status': 'requested', 'depends_on': parent.get('depends_on', []), 'blocked_by': [],
           'parent': parent_id, 'created_utc': A.utc_now(), 'updated_utc': A.utc_now(), 'packet_rev': 1, 'order': list(items),
           'style_from': parent.get('style_from'), 'shared_files': shared, 'attachments': pk.files, 'items': items, 'correction_text': {}}
    for key, it in items.items():
        it['prompt'] = revision_prompt(key, it)
        it['prompt_sha'] = A.sha_text(it['prompt'])[:12]
        rec['correction_text'][key] = ('REVISION - your previous image for this item could not be used. Exact corrections:\n'
                                       + '\n'.join(f'- {c}' for c in it['revision_of']['corrections']))
    finish_packet(rec, pk)
    return rid


def revision_prompt(key, it):
    """Self-contained task text for a re-request (the agent may not have the original conversation any more)."""
    f = it['files']; o = it['output']
    if o['mode'] == 'seam':
        keep = (f"Repaint ONLY the white band of {f['mask']} in {f['composition']} so the join reads as one continuous painting; "
                "everything in the black area must stay pixel-identical.")
    elif 'mask' in f:
        x0, y0, x1, y1 = o['crop']
        keep = (f"Edit {f['composition']} ({o['width']} x {o['height']} px): the central {F()} x {F()} square (x {x0}-{x1 - 1}, "
                f"y {y0}-{y1 - 1}) is the tile. {f['mask']}: WHITE = paint, BLACK = keep exactly (finished neighbour art - continue it "
                "seamlessly across the boundary); white border areas are context that we cut away.")
    else:
        keep = f"Paint a finished pixel-art version of {f['composition']} at the same size and framing."
    prev = (f" {f['previous']} is what you sent last time and {f['marked']} marks what has to change: fix those points and keep "
            "the rest of its style." if 'previous' in f else '')
    geo = f"Geometry must follow {f.get('reference', f['composition'])}" + (f" and {f['classes']}" if 'classes' in f else '') + '.'
    body = [f"TASK - revised {'seam' if o['mode'] == 'seam' else 'tile'} {key}\n{keep}{prev} {geo}"]
    if o['mode'] != 'seam': body.append('THIS TILE SHOWS\n' + (tile_contents(key) or '- campus grounds'))
    body.append(f"OUTPUT\n- {o['width']} x {o['height']} px, PNG, named {it['return_filename']}. A larger image with exactly the same "
                "aspect ratio is fine; never crop, pad or change the aspect ratio.")
    return '\n\n'.join(body)


# ----------------------------------------------------------------------------------------------- CLI
def status():
    b = A.load_batches()['batches']
    if not b: print('no batches yet'); return
    for bid, r in b.items():
        print(f'{bid:8s} {r["status"]:16s} {r["kind"]:12s} {r["title"]}')
        for k, it in r['items'].items():
            last = it['received'][-1] if it['received'] else None
            extra = f' - last received {last["file"]} ({last["verdict"]})' if last else ''
            print(f'           {k:10s} {it["status"]:16s} -> {it["return_filename"]}{extra}')


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--state-dir', help='use this art/ state directory instead of the repo one (also: TW_ART_DIR)')
    sub = ap.add_subparsers(dest='cmd', required=True)
    b = sub.add_parser('build', help='build or refresh a tile batch packet')
    b.add_argument('batch')
    b.add_argument('--tiles', help='comma-separated tile ids (required for unplanned batches)')
    b.add_argument('--depends', help='comma-separated tiles that must be accepted first')
    b.add_argument('--frame', choices=sorted(FRAMES), default='square')
    b.add_argument('--mode', choices=['tile', 'context'])
    b.add_argument('--title')
    s = sub.add_parser('seam', help='seam-repair packet from accepted tiles')
    g = s.add_mutually_exclusive_group(required=True)
    g.add_argument('--pair', help='A:B edge neighbours, e.g. 0_0:1_0')
    g.add_argument('--quad', help='top-left tile of a 2x2 junction, e.g. -1_-1')
    s.add_argument('--band', type=int, default=SEAM_BAND)
    sub.add_parser('status', help='print batches.json')
    a = ap.parse_args(argv)
    if a.state_dir: os.environ['TW_ART_DIR'] = os.path.abspath(a.state_dir)
    os.makedirs(A.state_dir(), exist_ok=True)
    if not os.path.exists(A.sp('tiles.json')): A.save_tiles_meta({})
    if a.cmd == 'build':
        split = lambda v: [x.strip() for x in v.split(',') if x.strip()] if v is not None else None
        build_batch(a.batch, split(a.tiles), split(a.depends), a.frame, a.mode, a.title)
    elif a.cmd == 'seam':
        build_seam(a.pair, a.quad, a.band)
    else:
        status()


if __name__ == '__main__':
    main()
