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
   is composited back, with a triangular feather (see [Seam compositing](#seam-compositing)). Every affected tile gets
   a new version, and its previous version is kept in the tile's `history` in `art/tiles.json`.

**Forcing is per item.** `--force 0_-1,-1_0 --reason "join fixed by seam packet S011 next"` accepts the named items
even though their latest return failed QA. It also lets them past the changed-reference refusal (see
[Resuming](#resuming)). Use it only after reviewing each item's report and choosing it by name.

- Every other failing item of the batch stays unaccepted, exactly as without `--force`. There is no batch-wide force:
  a bare `--force` without item ids is refused, and so is `--force` without `--reason`.
- Each forced acceptance is printed as `<item>: ACCEPTED - FORCED despite <checks>; reason: ...`, with a summary line
  at the end of the run.
- `art/tiles.json` (and the item's `accepted` record in `art/batches.json`) gets `forced: true`, `forced_reason` and
  `forced_checks`. `forced_checks` lists the failing QA checks that were overridden, plus `reference` when the
  reference job had changed.
- A named item that passed QA on a current reference is accepted normally (`forced: false`).
- Tile ids that start with `-` can follow `--force` and `--only` directly (`--force -1_0`). `--force=-1_0,-1_-1` also
  works.

The 26 Nov 2026 ring attempt ran `--accept --force` on whole batches and accepted 17 failing tiles nobody had looked at.
That is why forcing is now per item.

`--only 0_-1` limits an import to some items. `--model` and `--settings` record what the agent reported when there is
no report file. Anything not reported is stored as `unknown`.

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
| content | invented content: water-blue pixels outside the reference's water and pools; asphalt, paving or roof colours inside its open ground; tan ground painted green. Connected blobs, see [Invented content](#invented-content) | a water blob of 500 px or more, paving on open ground of 1500 px or more, lawn on tan ground of 20000 px or more (warns from half) |
| seams | against each accepted edge neighbour: colour difference of pixels 2 px apart across the join vs the same inside 4 px bands (`grad_ratio`), and the colour step between the 4 px bands vs the next band in (`step_ratio`) | either ratio > 1.8 |
| kept margin (context) | phase correlation and mean absolute difference of the mask-black area, returned vs sent | moved > 3 px (warns when repainted, mean abs diff > 30) |
| seam repair | kept area unchanged (mean abs diff <= 12, shift <= 2 px); band geometry; after compositing: join `grad_ratio` and `step_ratio` over the whole join **and per 128 px block along it** (worst block reported); both band edges, gradient **and** step ratio per 128 px block | kept area / geometry as stated; join: whole-join or worst-block ratio > 1.8; band edge: a block > 1.8 **and** > the accepted art's own ratio at that block + 0.15 |

A global failure (translation, registration or camera) is reported as the cause. The geometry, building and content
failures it produces are folded into one "consequence" note, so the revision asks for one clear fix. Pixel-art quality,
the right materials, the absence of text or borders, and the overall feel cannot be judged automatically. Each QA
report ends with a human-review checklist for them.

### Invented content

Geometry, building and style checks only test that what the reference has is in the painting. They cannot see what
the painting adds. The 26 Nov 2026 ring attempt passed them with five invented ponds (8_0), ponds and a lined parking
lot on lawn (4_2), and a creek widened about 7x (-4_-2). `content_check(rgb, cls)` in `pipeline/art_import.py` is a pure
function of the 1024 px art and the reference class ids. It returns metrics and the regions with their positions, so it
can be run directly on any tile. It looks for three kinds of content:

- **water**: blue pixels (hue 185-245, saturation >= 0.15) outside the reference's water and pool classes, which are
  dilated by 8 px to allow for shoreline drift. Pixels within 3 px of roofs and walls are ignored, so window glass does
  not count. This style paints cast shadows blue-grey on paving and parking, so on hard ground a pixel must be much
  bluer (blue - red >= 60) than on soft ground (>= 30). The blue mask is opened before the shoreline band is taken
  out. Opening it afterwards erased every strip of widening narrower than about 5 px, so a creek could be painted
  13 px wider on each side, 4-5x its width, without a flagged pixel. Now reference water widened by up to 9 px a side
  passes and by 11 px or more fails (synthetic widening of 7_-2, 6_-2 and 5_0: 3264-3757 px at 11 px).
- **hard**: asphalt, parking, paving or roof colours on the reference's open ground (lawn, park, residential yards,
  pitch, golf, farmland, forest floor). These are grey pixels, or non-green pixels below saturation 0.35 (0.25 on
  farmland). Only pixels 6 px inside the open ground and 10 px from roofs and walls count, so cast shadows, kerbs and
  buildings painted a few px off are ignored. Dark green shade and water-blue are not counted. Farmland is the only
  open ground whose colour is not green: a tan field has hue 27-32 and saturation 0.43-0.58. At 0.35 a field painted
  20% paler failed as a whole-field parking lot. At 0.25 a field 40% paler passes, and the invented street of houses
  over -4_-3's field still fails (21668 px). The 0.35 cut elsewhere is tight: at 0.40 the faithful ring tiles -4_1 and
  -4_2 fail on pale sunlit tan ground.
- **ground**: saturated green on the inside of construction or farmland, that is, a tan field painted as lawn.

Each colour mask is opened by 2 px, which removes fences, paths, lane dashes and window panes. It is then split into
connected blobs on a 4 px grid. A blob at or above its threshold fails, and blobs from half the threshold upward are
warnings. Failing blobs are drawn as boxes on the QA overlay and on the marked image of the revision packet: cyan for
water, magenta for paving, orange for lawn on tan ground. The revision text gives each blob's position, size and the
reference class under it.

Calibration (largest blob per tile; thresholds and evidence are in `T`, keys `content_*`):

| Set | water | hard | ground |
|---|---|---|---|
| 55 accepted tiles (must pass) | max 155 px (7_-2's creek painted a little wider) | max 657 px (a driveway, 5_-3) | max 8291 px (7_1's construction lot painted as lawn) |
| reference renders and the self-test's posterised references, 147 jobs | 0 | max 825 px | 0 |
| ring tiles judged fine (9) | 0 | max 451 px | 0 |
| ring tiles with invented water (12) | 11 tiles fail, 1055-10830 px; -4_-1 (a small shoreline change) missed | | |
| ring tiles with paving or buildings on open ground (15) | | 9 caught, 2727-21668 px | -4_-2, -4_-3 (51000+ px) |

The largest blob that passes is not always faithful content: the minor driveway pads the ring added beside houses reach
1048 px (7_-4), 70% of the hard threshold. On 5_-4 both water defects fail: the upper reach painted 20 px west of the
reference (1639 px), and the stream drawn 36-48 px wide where the reference has 9-10 px (951 px). Before the water
mask was opened first, the stream left only blobs under 500 px.

Not caught: buildings on ground the reference already marks as paved (-1_-4), a green pitch painted on lawn (5_2),
houses on a construction lot (3_-4), and dense forest painted over open lawn. Construction is not treated as open ground
for the hard check, because the reference's own construction colour (saturation about 0.3) reads as paving. A pitch
painted as lawn is too close in colour to park to test reliably.

### Seam compositing

The image tool regenerates the whole frame even when it is given a mask, so the band it returns never meets the kept
pixels exactly. With a hard band, the tone step or feature offset only moves from the join to the two band edges (S001
water, S002 lawn: step ratios 2.2-4.2 at the band edges; S004: the rail kink moved to the band edge). Accepting a seam
is therefore a deterministic, documented blend of two images - local tile assembly, not a generative redraw:

    final = w * returned + (1 - w) * accepted

`w` is a triangle across the band: about 1 on the join line, falling linearly to exactly 0 on the outermost band pixels
(`w = clip(1 - |x + 0.5 - join| / (band - 0.5), 0, 1)` per pixel column or row). At a 2x2 junction the weight follows
the nearest join line, which is the minimum distance over both axes (the maximum of the two triangles). The band
edges are the accepted pixels, unchanged, and the repaint takes over at the join. The kept area of the return is not
used at all. The kept-area check still applies, because it tells you whether the window drifted or was redrawn.

Feathering fixes tone and texture steps. It cannot fix geometry. If the returned band draws a line feature somewhere
other than where the kept art has it at the band edges, both versions show at half strength mid-band, as a ghost or
double line. The return must still bring every feature into the band edges where the kept art has it (S004: tracks).
Check the rails, kerbs and roof edges in the QA image. The ratio checks measure tone and gradient, not line offsets.

`T['seam_feather'] = True` in `pipeline/art_import.py` is the switch. With `False` you get the legacy composite: the
whole band from the return, with its edges blurred over about 8 px.

The seam QA measures the composite. Each join is measured over its whole length and per 128 px block, and the worst
block must stay at or below 1.8, so a lake about 200 rows long or a rail defect about 30 rows long is not averaged
away. Both band edges are measured for gradient and colour step per 128 px block. A band-edge block fails only if it
is above 1.8 and also above the accepted art's own ratio at that block by more than 0.15 (`T['seam_edge_tol']`). The
band edge is an arbitrary line through untouched art, so a kerb or shoreline that happens to lie on it is not a defect
of the repair. In a junction, the parts of a band edge that the other band crosses are skipped.

## Publish-time harmonisation

`publish_tiles.py` evens out neighbouring accepted tiles with `pipeline/harmonize_art.py` before it applies overlays.
`art/accepted/` is never changed. Four steps run, all driven by the strips along shared edges:

1. A detail gain per tile, solved by least squares so that sharpness matches across every edge.
2. A cross-fade of each border band into the neighbour's margin painting from its generation call. Bands whose
   margin is misaligned or paints different structure are skipped.
3. Colour levelling, only where the cross-fade had nothing to blend with.
4. Seam diffusion of the step left exactly at each edge.

Settings are in `config/world.json` under `art_harmonize`. `python3 pipeline/harmonize_art.py` prints a before/after
seam report.

**Locked tiles.** Finished tiles must not change when tiles are added next to them. `art_harmonize.locked_regions`
names the regions of `config/regions.json` whose tiles are final, in ordered lock groups, oldest first:

- a list of names is one group: now `["campus2x2", "park_uptown", "stage2_surround"]`;
- a list of lists is several groups, for example
  `[["campus2x2", "park_uptown", "stage2_surround"], ["stage3_ring"]]`. A tile listed twice stays in its first group.
  A mix of names and lists, or an unknown region, stops the publish.

How each kind of tile is treated:

- The first group is harmonised among itself only, exactly as if no other tile existed.
- Each later group is fitted to the groups before it and sees no later group and no unlocked tile:
  - Its gains are solved with the earlier gains held.
  - On an edge with an earlier tile, it takes the whole correction: a one-sided cross-fade into the earlier tile's
    margin painting (where it lines up), and the full colour levelling and seam diffusion. The earlier side gets none
    of it.
  - Edges inside the group are shared half and half.
- The unlocked tiles come last and are fitted to all locked groups the same way.
- Edges between two locked groups, and at a notch (a new tile with earlier tiles on two adjacent sides), are handled
  one direction at a time, so a corner is not corrected twice.
- With every accepted tile in one group (the committed state), the output is byte-identical to what the code
  published before locking existed. The same holds with no locked tile at all.

Workflow: publish new tiles unlocked and review them on the map. Once they are final, add their region as a new last
group. Its tiles then keep exactly the art they were reviewed with. This assumes no unlocked tile next to them changed
in between, because while unlocked they were fitted together with their unlocked neighbours. No earlier group changes,
then or later. Adding the region to an existing group instead would re-harmonise that whole group as equals, and every
tile in it would change slightly. The change would be largest near the new region but would reach whole tiles,
through the shared detail gains.

What to expect at a locked edge:

- Where the locked tile's margin does not line up with the new tile (band skipped as misaligned) or disagrees in
  structure, there is no cross-fade. Colour levelling and seam diffusion then pull the new tile's border colours
  toward the locked tile's. Where the two paintings show different ground (for example lawn where the locked tile
  has plaza), this shows as a tinted haze on the new tile's side. Before locking, the same mismatch showed as a ghost
  on the finished tile. Fix it by revising the new tile or with a repaint overlay on the new tile's side, not by
  unlocking.
- In the 36-tile ring test (Hermes attempt, Nov 2026), all 32 locked-to-ring bands were skipped as misaligned. So the
  ring joined the 55 locked tiles through levelling and diffusion only, which left a purple haze on `-3_-4` where
  it meets the pink plaza of `-3_-3`.

Unit checks: `python3 tests/test_harmonize.py`.

## Repaint overlays (publish-time fixes)

`pipeline/art_overlay.py` handles small fixes that are easier to repaint than to request as whole tiles: a join where two
tiles painted different content, ghosting left by the border cross-fade, or one surface painted in the wrong colour.

1. `make <id> --box x0,y0,w,h --seam v|h` (or `--cls parking`) cuts a window from **what is published now** (the
   harmonised art plus every overlay accepted so far) and writes `art/overlays/<id>_input.png` (upscaled to 2048 px for
   the model), `<id>_window.png` and a soft `<id>_mask.png`. Seam masks are a band of ±150 px around the join (full
   strength within ±72 px); region masks are the class pixels grown by 8 px.
2. The window is repainted by an image model with a Change / Preserve / Constraints prompt. Since 16 Nov 2026 this is
   done directly through the ElevenLabs connector (model `gpt-image-2.5-sunburst`, 2048 px output, quality high); the
   input is fetched from its raw GitHub URL and the result downloaded from `elevenlabsusercontent.com`.
3. `qa <id> <file>` checks the return at window size: aspect, global shift against the input (limit 1.5 px), per-block
   shift inside the mask (3 px), colour agreement where the mask fades out, and 4-16 px structure agreement. It writes
   `art/overlays/<id>_qa.png` (input, return, composite) for review.
4. `accept <id> <file> --model ... --generation ...` stores the original in `art/returned/overlays/` and the window-size
   image in `art/overlays/<id>.png`, and records model, generation id, prompt summary, hashes and the QA numbers in
   `art/overlays.json`.
5. `publish_tiles.py` applies accepted overlays in list order after `harmonize_art`. Seam overlays are colour-matched to
   the map first (detail from the repaint, colour coarser than 40 px from the map), so a model's brightness drift does
   not show; region overlays keep their own colour. `art/accepted/` is never changed, and deleting an entry from
   `art/overlays.json` undoes that fix.

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
  history[]}`. A forced acceptance adds `forced_reason` and `forced_checks` (the overridden failing checks, plus
  `reference` for a changed reference job). A later unforced seam acceptance drops them from the current entry, and
  they stay in `history`. `publish_tiles.py` reads `version` and `batch` into the manifest.

## Resuming

Imports are idempotent. A file whose sha256 is already in the item's `received` list is skipped, so re-running an
import on the same folder does nothing new. A revised file, even under the same name, is processed as a new version
(`--reprocess` forces QA again). Several new returns of one item in a folder are processed oldest first (file
modification time), so the newest is the item's latest. `--accept` without new files accepts items whose latest
received file passed. A failure whose revision packet was never built (an interrupted run) gets its packet on the next
run. A rebuilt packet keeps the receive and QA history of its items, including the accepted items it no longer
requests, and increments `packet_rev`. Every item records sha256[:12] of its reference job files (color2x, cls,
height); if they changed since the packet was built, import and accept refuse the item until the packet is rebuilt and
resent (or the item is named in `--force`, which records `reference` among its `forced_checks`), and `publish_tiles.py`
warns when accepted art sits on a changed reference job. Do not rebuild a packet that
has already been sent unless you resend it: the kept-margin check compares against the current packet files.

## Self-test

`python3 tests/test_art_import.py` runs in about 80 s. It works on a temporary copy of the art state (`TW_ART_DIR`), so
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
  **accepted** and composited into both tiles; a regenerated frame with a brighter band is accepted with the feathered
  blend, and the band-edge pixels and everything outside the band stay identical to the accepted art;
- the posterized reference with a blue pond, or a grey lined parking lot, painted on open lawn: **fail** content, with
  the region located on the painted area;
- two B002 edits that both fail the seam, imported with `--force 0_-1 --reason ...`: only `0_-1` is accepted, and
  `art/tiles.json` records `forced`, `forced_reason` and `forced_checks`. The other item stays `revision-needed`. A
  batch-wide force, a force without a reason, and a force naming an unknown item are refused;
- a return for an item whose reference job changed is refused, and accepted with `--force 0_0` and
  `forced_checks: ['reference']`. With two changed B002 references and only `0_-1` named, the other item's new return
  is not imported, it is not accepted, and no revision packet is built for it;
- content thresholds: a creek widened 12 px a side **fails** (4 px of drift passes); a pale pond on lawn **fails**; a
  blue-grey shadow on parking and a tan field painted 30% paler pass; asphalt on the field **fails**;
- the CLI entry points, including a bare `--force`, `--force` without `--reason`, and ids starting with `-`.

Set `TW_ART_DIR` (or pass `--state-dir`) to try the tools on a scratch copy at any time.
