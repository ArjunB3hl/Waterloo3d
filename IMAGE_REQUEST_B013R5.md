# Image request B013R5 - Revision of B013R4: 6_0

Packet revision 1, built 2026-11-05T14:48:38Z. Status: `requested`.

## What to do (for the user)

Everything is in `art/requests/B013R5/` (also zipped as `art/requests/B013R5.zip`). Start a **new conversation** with the image agent.

1. **Message 1**: attach these 8 files, then paste the text of "Message 1" below.

   - `B013R5_context_6_0.png`
   - `B013R5_mask_6_0.png`
   - `B013R5_ref_6_0.png`
   - `B013R5_classes_6_0.png`
   - `B013R5_previous_6_0.png`
   - `B013R5_marked_6_0.png`
   - `B013R5_style_0_0.png`
   - `B013R5_classes_legend.png`

2. Save what comes back in one folder (e.g. `~/Downloads/B013R5/`) with exactly these names: `B013R5_6_0.png`. Copy the agent's note about model and settings into `B013R5_report.txt` in the same folder.

3. Check it: `python3 pipeline/art_import.py B013R5 ~/Downloads/B013R5` (QA report only), then `python3 pipeline/art_import.py B013R5 ~/Downloads/B013R5 --accept` to accept tiles that pass.

Total: 8 attachment files, 1 image(s) to bring back.

## Message 1

```text
I'm making "Tiny Waterloo", an illustrated pixel-art map of Waterloo, Ontario (Canada) built from square tiles that join edge to edge. Please paint the image described below from the attached reference images.

REVISION - your previous image for this item could not be used. Exact corrections:
- Tile 6_0 (tile-local px in the 1024 tile; add 256 for the 1536 canvas). Use your last image (B013R4) as the base. North of y 720 it is right: the curve at (254-265, 620)/(290-301, 660), the 40 px asphalt at y 620-700, no rails on King St north of the junction, the main line at the right edge at y 234-240, and all roofs, the plaza and the margins. Keep all of that exactly.

The problem is from y 720 down to the bottom edge. King Street South is still only about 30 px wide there, because its east kerb, the track and the lawn sit 8-13 px too far west. You also added a pale cream strip between the track and the lawn, about x 431-442 at y 820, that must not be there.

Keep the WEST kerb where it is now. Move the east kerb line and the track 10-13 px EAST, painting them over that pale strip, so that:

1) The asphalt spans x 336-374 at y 760, 386-427 at y 820, 440-479 at y 880, 492-533 at y 940, 546-585 at y 1000 and 564-605 at y 1023. In your last image these spans ended at 366, 417, 469, 520, 573 and 592.

2) The yellow centre dashes run in the MIDDLE of that span: about x 355 at y 760, 406 at y 820, 459 at y 880, 512 at y 940, 565 at y 1000 and 586-590 at y 1023. In your last image they were at 397, 501 and 575, about 10 px too far west.

3) ONE track, 11-12 px wide with two rails, as you painted it last time, directly against the asphalt's east edge: x 374-386 at y 760, 427-438 at y 820, 479-490 at y 880, 533-544 at y 940, 585-596 at y 1000 and 605-615 at y 1023.

4) Mown lawn runs from the track's east edge straight to the building walls, which stay exactly where they are (wall at x 455 at y 820). There is no pale strip between the track and the lawn.

5) At the bottom edge the road must continue the finished tile below, which is visible in the margin from canvas y 1280: asphalt x 566-605, centre dash x 586-590, track x 605-615 at y 1023. The dashes must line up with that tile's dashes with no sideways jump. Last time they jumped 13 px.

Do not change anything else.

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: B013R5_context_6_0.png, B013R5_mask_6_0.png, B013R5_classes_6_0.png, B013R5_style_0_0.png. Read B013R5_classes_legend.png yourself and do not pass them to the tool.

ATTACHED FILES
- B013R5_context_6_0.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536), tile in the centre at (256, 256, 1280, 1280)
- B013R5_mask_6_0.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B013R5_ref_6_0.png (1024x1024) - GEOMETRY: reference render of tile 6_0 alone
- B013R5_classes_6_0.png (1536x1536) - SEMANTIC MAP (same framing as the composition)
- B013R5_previous_6_0.png (1024x1024) - YOUR PREVIOUS OUTPUT (as received) - keep what is good about it
- B013R5_marked_6_0.png (1024x1024) - ANNOTATED: what is wrong (red = missing/misplaced vs reference, yellow = displaced area, labels give the fix)
- B013R5_style_0_0.png (1024x1024) - STYLE: accepted artwork of tile 0_0 - match it
- B013R5_classes_legend.png (760x664) - LEGEND for the semantic maps

ART DIRECTION
- Detailed pixel-art city illustration with a miniature-diorama feel: crisp, deliberate pixel clusters and clean edges where materials meet. No blur, airbrush, painterly smearing, film grain or photo texture.
- Clear, readable architecture: repeated window detail on every facade (regular rows and columns matching the building's height), recognizable roof shapes, parapets and rooftop equipment.
- Warm, readable palette in consistent late-summer afternoon daylight: rich but natural greens, cream and warm-grey paving, soft blue-grey shade.
- Local vegetation: mature maple and oak canopy in layered leaf clusters, mown lawns crossed by worn footpaths, lush greens along creeks, ponds and park trails.
- Waterloo materials: on the University of Waterloo campus, brutalist / precast concrete (pale warm grey, deep window reveals), red-brown brick and glass-and-metal curtain walls; in Uptown, two-to-four-storey red-brick commercial blocks with shopfronts along King Street, church spires and newer glass mid-rises; in residential streets, detached houses with shingled pitched roofs, garages and backyard trees. The reference's wall colour gives the material family: red-brown = brick, pale grey or cream = concrete or render, blue-grey = glass.

LIGHT (identical on every tile - moving objects on the map cast shadows with this same sun)
- Sun from the south-west, behind the viewer's left shoulder: in the image the light comes from the lower left.
- Cast shadows fall toward the upper right, with the same direction and length as the shadows in the reference.
- Walls facing the lower left are sunlit; walls facing the lower right are in soft shade.

CAMERA (fixed for the whole map)
- Parallel (orthographic) projection looking toward compass bearing 20 degrees (north-north-east), tilted 45 degrees down; image "up" is roughly north-north-east. Scale: 1 px = 0.29 m.
- No perspective: no vanishing points, parallel edges stay parallel, far objects are not smaller.

GEOMETRY - most important
- The reference is a precise underdrawing. Keep every building footprint, roof outline and building height, every road, path, parking lot, water edge and tree cluster exactly where it is (same pixels).
- Do not add, remove, move, rotate or resize anything: no new streets, buildings, plazas or water. Paint over the geometry; don't redesign it.
- Do not change the camera angle, zoom, crop or framing.
- Fill the whole frame edge to edge. The scene continues into neighbouring tiles, so anything cut by the border stays cut at exactly the same place.
- No text, labels, street names, lettering on signs, UI, legend, border, frame, vignette, watermark or sky.

TASK - revised tile 6_0
Edit B013R5_context_6_0.png (1536 x 1536 px): the central 1024 x 1024 square (x 256-1279, y 256-1279) is the tile. B013R5_mask_6_0.png: WHITE = paint, BLACK = keep exactly (finished neighbour art - continue it seamlessly across the boundary); white border areas are context that we cut away. B013R5_previous_6_0.png is what you sent last time and B013R5_marked_6_0.png marks what has to change: fix those points and keep the rest of its style. Geometry must follow B013R5_ref_6_0.png and B013R5_classes_6_0.png.

THIS TILE SHOWS
- The Shops at Waterloo Town Square (lower left, around x=59, y=767): building - follow the reference wall colour for its material
- Region of Waterloo Public Health & Community Services (lower right, around x=689, y=768): building - follow the reference wall colour for its material
- Uptown Waterloo Parkade (centre, around x=409, y=521): building - follow the reference wall colour for its material
- Waterloo City Centre (right, around x=802, y=626): building - follow the reference wall colour for its material
- Faire (lower left, around x=131, y=945): building - follow the reference wall colour for its material
- RBC Building (lower left, around x=332, y=830): building - follow the reference wall colour for its material
- First Gulf Building (lower centre, around x=460, y=973): building - follow the reference wall colour for its material
- Spur Line Crossing (upper right, around x=975, y=64): building - follow the reference wall colour for its material
- The Waterloo Hotel (upper left, around x=63, y=226): building - follow the reference wall colour for its material
- Waterloo Public Square (lower left, around x=183, y=693): open paved civic plaza - keep it open and paved
- Streets and paths crossing it: Erb Street East, Laurel Trail, King Street South, Regina Street South, Hughes Lane, Willis Way

OUTPUT
- 1536 x 1536 px, PNG, named B013R5_6_0.png. A larger image with exactly the same aspect ratio is fine; never crop, pad or change the aspect ratio.

WHAT TO SEND BACK
- The ORIGINAL generated image file(s) exactly as produced - full resolution, PNG preferred - not a screenshot, preview or re-compressed copy - named exactly as listed above.
- A short note with the model name and version you used and any settings you can disclose (e.g. seed, steps, guidance / strength, quality, output size, edit or inpaint mode, number of attempts). Write "unknown" for anything you can't tell.
```

## Packet details (for reference - the agent does not need this section)

| File | Size | Purpose | Tiles | Defines composition | sha256 |
|---|---|---|---|---|---|
| `B013R5_context_6_0.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536), tile in the centre at (256, 256, 1280, 1280) | 6_0 | yes | `40b261b180fc` |
| `B013R5_mask_6_0.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 6_0 | no | `4af4b948bf01` |
| `B013R5_ref_6_0.png` | 1024x1024 | GEOMETRY: reference render of tile 6_0 alone | 6_0 | no | `9b8bc1e0e4f1` |
| `B013R5_classes_6_0.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition) | 6_0 | no | `c23cb218b297` |
| `B013R5_previous_6_0.png` | 1024x1024 | YOUR PREVIOUS OUTPUT (as received) - keep what is good about it | 6_0 | no | `3e09a04980c6` |
| `B013R5_marked_6_0.png` | 1024x1024 | ANNOTATED: what is wrong (red = missing/misplaced vs reference, yellow = displaced area, labels give the fix) | 6_0 | no | `eec7406b2c11` |
| `B013R5_classes_legend.png` | 760x664 | LEGEND for the semantic maps | 6_0 | no | `842ce2584634` |
| `B013R5_style_0_0.png` | 1024x1024 | STYLE: accepted artwork of tile 0_0 - match it | 0_0 | no | `bfd18a94f0c7` |

| Return file | Item | Expected size | Crop in returned image (x0, y0, x1, y1) | Becomes |
|---|---|---|---|---|
| `B013R5_6_0.png` | 6_0 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/6_0.png` (1024x1024) |

**Crop math (context edit).** Context canvas = 1536x1536 canvas px at 1:1, origin at canvas px (tile_x*1024 - 256, tile_y*1024 - 256). For a returned image W x H with W/H = 1536/1536 (within 1 %), k = W/1536; the tile is the box (256k, 256k, 1280k, 1280k), resampled to 1024x1024 (box filter when k >= 1, Lanczos when k < 1). 1536x1536 -> crop (256, 256, 1280, 1280) exactly; a 2x image -> crop doubled, then box-halved. Fixed-size fallback 1024x1024: k = 0.6667, crop (170.67, 170.67, 853.33, 853.33) upscaled x1.50 (accepted with a reduced-detail warning). Agents limited to 1536x1024 or 1024x1536 get a native-scale packet instead: `build <batch> --frame wide` (margins left/right only, crop (256, 0, 1280, 1024)) or `--frame tall` (margins top/bottom only, crop (0, 256, 1024, 1280)). Joins that a frame has no margin for are repaired afterwards with seam packets (`art_request.py seam`).

**Camera and light.** Orthographic, heading 20.0 deg (camera looks NNE), pitch 45.0 deg, 0.29296875 m per artwork px. Sun azimuth 225.0 deg, elevation 50.0 deg: light from the lower left / behind the viewer, cast shadows toward the upper right. Tile (i, j) covers canvas px [i*1024, (i+1)*1024) x [j*1024, (j+1)*1024).

**QA on receipt** (`pipeline/art_import.py`, thresholds in docs/ART_PIPELINE.md): filename -> item match; decode; size / aspect; global translation by phase correlation of edge maps (> 4 px fails); local displacement and scale/rotation from a block grid (camera change); geometry agreement of class-map boundaries with image edges (whole tile, 8x8 cells, every building roof, landmark roofs); sun/shadow side; colour style against accepted tiles; seam discontinuity in a 4 px band against accepted neighbours; for context edits, drift of the kept margin.
