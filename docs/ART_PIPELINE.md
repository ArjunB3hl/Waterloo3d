# Art pipeline: requesting, checking and accepting tile artwork

Tiny Waterloo's final artwork is painted by a **separate image-generation agent** that lives in another conversation
with its own workspace. It cannot see this repository, so every request travels as a self-contained packet that the
user relays by hand: files to attach, a message to paste, and exact filenames to bring back. Everything deterministic
happens locally: building packets, cropping, resizing, QA, versioning and publishing. Everything generative goes
through the agent: first paintings, redraws and seam repairs.

```
reference job (data_cache/jobs/<i>_<j>)        art/requests/<batch>/ + IMAGE_REQUEST_<batch>.md + <batch>.zip
  color2x.png  cls.png  height.png  ---------->  (pipeline/art_request.py)  ----> user relays to the image agent
                                                                                          |
web/public/data  <-- publish_tiles.py <-- art/accepted/<i>_<j>.png <-- art_import.py <----+ returned files
                                           art/tiles.json                (QA, revision packets)
```

## Batches

| Batch | Tiles | Kind | How |
|---|---|---|---|
| `B001` | `0_0` (Dana Porter Library, Hagey Hall / arts quad, Ring Road) | style sample | paint over the 1024 reference |
| `B002` | `0_-1`, `-1_0`, `-1_-1` (E5, E7, DC, EIT, MC, SLC, QNC) | patch | context-image edits around accepted `0_0`; **draft until B001 is accepted** |
| `B001R1`... | items that failed QA | revision | made automatically by `art_import.py` |
| `S001`... | a join of accepted tiles | seam repair | `art_request.py seam` |

Start small: B001 sets the style, B002 completes the connected 2x2 campus patch, and wider coverage comes only after
both look right side by side in the viewer. New batches use the same commands, e.g.
`python3 pipeline/art_request.py build B003 --tiles 1_0,1_-1 --depends 0_0,0_-1`.

## Workflow

1. **Build the packet.** `python3 pipeline/art_request.py build B001`. This writes `art/requests/B001/` (exactly the
   attachments), `art/requests/B001.zip` (attachments plus the md) and `IMAGE_REQUEST_B001.md` at the repo root, and
   records the batch in `art/batches.json`.
2. **Relay.** The user opens the md, follows "What to do (for the user)": attach the listed files, paste "Message 1"
   (and later messages one tile at a time), save the returned images under the listed names in one folder, and
   copy the agent's model/settings note into `<batch>_report.txt` (`Model: ...` on one line, other `key: value` lines
   become the settings).
3. **Check.** `python3 pipeline/art_import.py B001 ~/Downloads/B001` runs QA only and writes
   `art/returned/B001/QA_<tile>_<sha8>.md` and `.png` for each returned file (reference | returned | edge overlay);
   `QA_<tile>.md` / `.png` are copies of the latest. Read the report and its
   human-review checklist.
4. **Accept.** `python3 pipeline/art_import.py B001 ~/Downloads/B001 --accept` copies passing tiles to
   `art/accepted/<i>_<j>.png`, writes `art/tiles.json`, and runs `pipeline/publish_tiles.py`, which regenerates the
   WebP LODs, overview and manifest. Life, height and class masks come from the reference job, so they stay aligned
   because accepted art must keep the reference geometry. Draft batches whose dependencies are now accepted are rebuilt
   automatically: accepting `0_0` turns B002 from `draft` into `requested`, with the finished `0_0` art in its margins.
5. **Revise.** A QA failure sets the item to `revision-needed` and creates `IMAGE_REQUEST_<batch>R<n>.md` with the
   previous output, an annotated copy (red = missing building, yellow = displaced or disagreeing area, red bar =
   visible join) and the exact corrections. That packet is relayed and imported the same way:
   `art_import.py B001R1 <folder> --accept`. Accepting a revision also marks the item accepted in every batch up its
   parent chain (B001R2 -> B001R1 -> B001).
6. **Repair seams.** If a join between accepted tiles shows, run `python3 pipeline/art_request.py seam --pair 0_0:1_0`
   (vertical or horizontal edge neighbours) or `seam --quad -1_-1` (the 2x2 junction whose top-left tile is given). The
   packet is a 1024 window centred on the join, a band mask (white = repaint, 96 px wide by default, `--band`), the
   reference underdrawing of the window and an annotated copy with the worst rows marked. On `--accept`, only the band
   is composited back, feathered by about 8 px. Every affected tile gets a new version, and its previous version is
   kept in the tile's `history` in `art/tiles.json`.

`--force` accepts an item that failed QA. Use it only after reviewing the report, for example when a visible join will
be fixed with a seam packet next. The forced acceptance is recorded (`forced: true`). `--only 0_-1` limits an import to
some items. `--model` and `--settings` record what the agent reported when there is no report file. Anything not
reported is stored as `unknown`.

## File naming

| What | Name |
|---|---|
| request md | `IMAGE_REQUEST_<batch>.md` (repo root) |
| attachments | `art/requests/<batch>/<batch>_<role>_<tile>.png`, roles: `ref`, `context`, `mask`, `classes`, `depth`, `style`, `contact_sheet`, `classes_legend`; seams: `window`, `mask`, `ref`, `marked`; revisions add `previous` and `marked` |
| returned | `<batch>_<i>_<j>.png` (seams: `<batch>_seam.png`). JPEG/WebP are accepted. Suffixes after a separator (`B001_0_0 (1).png`, `B001_0_0_v2.png`) still match |
| originals kept | `art/returned/<batch>/<original name>` (renamed `_r2`, `_r3`... if a different file has the same name) |
| QA | `art/returned/<batch>/QA_<item>_<sha8>.md` / `.png` per returned file; `QA_<item>.md` / `.png` = latest |
| accepted | `art/accepted/<i>_<j>.png` (1024x1024 RGB PNG) |

## Attachments

- **Composition**: the image that defines layout. For B001 it is `B001_ref_0_0.png`, the 1024 lit reference render.
  For context edits it is `<batch>_context_<tile>.png`.
- **Semantic map**: classes recoloured with distinct colours (roof, wall, road, path, plaza, parking, lawn, park,
  trees, water...). The legend is a separate image.
- **Depth**: visible-surface height above local terrain, from the height job and the DEM. Black is ground; white is
  45 m or more, with a gamma of 0.7.
- **Contact sheet**: the tile patch at half scale, labelled with tile ids, status and landmarks. It is for orientation
  only.
- **Style**: the accepted art the new tiles must match. B002 uses `0_0`.
- **Mask**: white = paint, black = keep. Black is accepted neighbour art in a context margin, or everything outside the
  band in a seam window. For agents that take a transparent mask, the white area is the area to make transparent.

## Output sizes and crop math

Camera and frame are fixed for every tile: orthographic, heading 20 deg, pitch 45 deg, 0.29296875 m/px. Tile (i, j)
covers canvas px [i*1024, (i+1)*1024) x [j*1024, (j+1)*1024).

- **Tile mode (B001):** the output is square, side W >= 1024. W = 1024 is used as is; larger squares are box-filtered
  to 1024. Smaller or non-square images fail.
- **Context mode (B002, default `--frame square`):** the canvas is 1536x1536 at 1:1, with its origin at canvas px
  (i*1024 - 256, j*1024 - 256). The tile is the centre crop (256, 256, 1280, 1280). The 256 px margin shows accepted
  neighbour art (mask black), reference underdrawing, or flat grey where nothing is mapped (mask white, painted for
  context and discarded). A return W x H must have aspect 1536/1536 within 1 %. With k = W/1536, the tile is the box
  (256k, 256k, 1280k, 1280k), resampled to 1024 with a box filter when k >= 1 and Lanczos when k < 1.
  - 1536 px: exact crop. 2048 or 3072 px: the crop is scaled up, then box-filtered down.
  - **1024x1024-only agents:** k = 0.6667, crop (170.67, 170.67, 853.33, 853.33), upscaled x1.5. This is accepted
    with a "reduced detail" warning. Prefer a larger square.
  - **Agents limited to 1536x1024 or 1024x1536:** rebuild with `--frame wide` (1536x1024, margins left and right only,
    crop (256, 0, 1280, 1024)) or `--frame tall` (1024x1536, margins top and bottom only, crop (0, 256, 1024, 1280)).
    These run at native scale. A join on a side with no margin is repaired with a seam packet.
- **Seam mode:** a 1024 window at 1:1. A larger square is box-filtered to 1024.
- **Order within B002:** `0_-1` and `-1_0` first (each borders `0_0`), then `-1_-1`, which borders both. Message 3
  asks the agent to match the two tiles it has just painted in the same conversation. For the strictest continuity,
  import and accept the first two, then rebuild `B002` (`build B002`) so that `-1_-1`'s margins hold their accepted
  art. Accepted items are left out of a rebuilt packet.

## QA checks and thresholds

All checks use numpy and Pillow only. The thresholds are **provisional**: they were calibrated only on synthetic
degradations of the reference (see the self-test below). Re-check them against the first real B001 return before
trusting them for wide coverage. They live in `T` at the top of `pipeline/art_import.py`.

| Check | Method | Fails when |
|---|---|---|
| match | filename stem vs expected return names | unmatched files are listed, not imported |
| decode / alpha | Pillow; PNG, JPEG or WebP | undecodable, other format, any alpha < 250 |
| size / aspect | see crop math | wrong aspect; tile mode < 1024 |
| translation | phase correlation (numpy FFT, Hann window) of blurred edge-strength maps, reference vs art | \|shift\| > 4 px, or peak < 0.02 (does not register at all) |
| camera change | 7x7 grid of 256 px blocks; per-block phase correlation; affine fit | scale off by > 1 %, rotation > 0.5 deg, or block residual > 8 px |
| geometry | class-group boundaries (roof, wall, road, path, plaza, parking, water, tree, green) vs the art's strongest 20 % edges within 3 px; chance-corrected recall, relative to the reference's own score | whole tile < 0.50; 3 or more of 64 cells < 0.30 |
| buildings and landmarks | every roof of 1500 px or more visible (projected roof polygon ∩ roof class): outline recall vs the reference, plus roof-to-surroundings colour contrast (Lab) vs the reference | outline < 0.35 or contrast < 0.35 on a landmark or a roof of 3000 px or more (smaller roofs only warn) |
| sun / shadows | luminance of the reference's cast-shadow ground pixels relative to lit pixels of the same classes | warns above 0.88; fails above 0.97 (no shadow where the sun puts one) |
| style | per class-group mean colour difference (CIE76 dE) and coarse HSV histogram (Bhattacharyya) vs all accepted tiles; skipped until a style sample is accepted | mean dE > 20 or any group > 30 (warns at dE > 12 or histogram > 0.35) |
| seams | against each accepted edge neighbour: colour difference of pixels 2 px apart across the join vs the same inside 4 px bands (`grad_ratio`), and the colour step between the 4 px bands vs the next band in (`step_ratio`) | either ratio > 1.8 |
| kept margin (context) | phase correlation and mean absolute difference of the mask-black area, returned vs sent | moved > 3 px (warns when repainted, mean abs diff > 30) |
| seam repair | kept area unchanged (mean abs diff <= 12, shift <= 2 px); band geometry; join and band-edge ratios after compositing | any of these |

A global failure (translation, registration or camera) is reported as the cause. The geometry and building failures
it produces are folded into one "consequence" note, so the revision asks for one clear fix. Pixel-art quality, the
right materials, the absence of text or borders, and the overall feel cannot be judged automatically. Each QA report
ends with a human-review checklist for them.

## Statuses (`art/batches.json`)

- **Batch:** `draft` (dependencies not accepted yet; do not send) -> `requested` -> `received` -> `complete`, or
  `revision-needed` when any item failed.
- **Item:** `draft` / `requested` -> `received` (QA pass, not yet accepted) | `revision-needed` (QA fail; see
  `revision_batch`) -> `accepted`.
- **Each item stores:** `prompt` and `prompt_sha`; `reference` (sha of color2x, cls and height, the composition
  attachment, and the neighbour art versions the context was built from); `return_filename`; `output` (size, crop,
  canvas origin); and `received[]` (file, stored copy, sha256, size, format, verdict, failures, warnings, embedded PNG
  text metadata, QA report paths). It also stores `model_reported`, `settings_reported` and `report_text`.
- **`art/tiles.json`:** per accepted tile, `{version (sha256[:12] of the accepted PNG), batch, model_reported,
  settings_reported, prompt_sha, reference_sha, accepted_utc, source_file, source_sha256, qa_verdict, forced,
  history[]}`. `publish_tiles.py` reads `version` and `batch` into the manifest.

## Resuming

Imports are idempotent. A file whose sha256 is already in the item's `received` list is skipped, so re-running an
import on the same folder does nothing new. A revised file, even under the same name, is processed as a new version
(`--reprocess` forces QA again). Several new returns of one item in a folder are processed oldest first (file
modification time), so the newest is the item's latest. `--accept` without new files accepts items whose latest
received file passed. A failure whose revision packet was never built (an interrupted run) gets its packet on the next
run. A rebuilt packet keeps the receive and QA history of its items, including the accepted items it no longer
requests, and increments `packet_rev`. Every item records sha256[:12] of its reference job files (color2x, cls,
height); if they changed since the packet was built, import and accept refuse the item until the packet is rebuilt and
resent (or `--force`), and `publish_tiles.py` warns when accepted art sits on a changed reference job. Do not rebuild a packet that
has already been sent unless you resend it: the kept-margin check compares against the current packet files.

## Self-test

`python3 tests/test_art_import.py` runs in about 100 s. It works on a temporary copy of the art state (`TW_ART_DIR`), so
the real `batches.json` is untouched, and publishing is skipped. It builds B001 and B002, then imports synthetic
returns:

- the reference posterized to a 32-colour palette and pixelated in 2x2 clusters: **pass**, accepted, and B002 unblocks
  with `0_0` art in its margin;
- the same image shifted 12 px: **fail** translation, with a B001R1 revision packet;
- Dana Porter Library painted out: **fail** building;
- a 2048 square: **pass**; a 1536x1024 image: **fail** size;
- a report file gives model and settings; re-running the import skips the same file;
- a B002 context edit: **pass**, including the seam against `0_0`; a version 30 levels brighter **fails** the seam; a
  1024x1024 fallback passes with a warning;
- a seam packet for `0_0:0_-1`: a return that changes the kept area **fails**; a faithful band repair is
  **accepted** and composited into both tiles;
- the CLI entry points.

Set `TW_ART_DIR` (or pass `--state-dir`) to try the tools on a scratch copy at any time.
