# Image request B017R3 - Revision of B017R2: 5_-3

Packet revision 1, built 2026-11-05T14:48:46Z. Status: `requested`.

## What to do (for the user)

Everything is in `art/requests/B017R3/` (also zipped as `art/requests/B017R3.zip`). Start a **new conversation** with the image agent.

1. **Message 1**: attach these 8 files, then paste the text of "Message 1" below.

   - `B017R3_context_5_-3.png`
   - `B017R3_mask_5_-3.png`
   - `B017R3_ref_5_-3.png`
   - `B017R3_classes_5_-3.png`
   - `B017R3_previous_5_-3.png`
   - `B017R3_marked_5_-3.png`
   - `B017R3_style_0_0.png`
   - `B017R3_classes_legend.png`

2. Save what comes back in one folder (e.g. `~/Downloads/B017R3/`) with exactly these names: `B017R3_5_-3.png`. Copy the agent's note about model and settings into `B017R3_report.txt` in the same folder.

3. Check it: `python3 pipeline/art_import.py B017R3 ~/Downloads/B017R3` (QA report only), then `python3 pipeline/art_import.py B017R3 ~/Downloads/B017R3 --accept` to accept tiles that pass.

Total: 8 attachment files, 1 image(s) to bring back.

## Message 1

```text
I'm making "Tiny Waterloo", an illustrated pixel-art map of Waterloo, Ontario (Canada) built from square tiles that join edge to edge. Please paint the image described below from the attached reference images.

REVISION - your previous image for this item could not be used. Exact corrections:
- Tile 5_-3 (tile-local px in the 1024 tile; add 256 for the 1536 canvas). Your last image (B017R2 (attached as your previous output)) is the base and is almost right: keep the mown lawn, the cream footpath, the east driveway from the middle red bay door, and everything else in the tile exactly as it is. Fix only these three things:

1) WEST DRIVEWAY (from the station's west corner down-left, about 18 px wide): yours is too steep and drifts right below y 110. You drew it at x 442-462 at y 116, 421-440 at y 132, 400-419 at y 148, 379-397 at y 164 and 369-386 at y 172. Move it to x 456-463 at y 100, 434-451 at y 116, 411-428 at y 132, 388-406 at y 148, 365-383 at y 164 and 352-372 at y 172, and continue down-left until it joins the street at about x 327-360, y 180. Paint mown lawn where your strip was.

2) REMOVE THE THIRD DRIVEWAY. There must be only two asphalt driveways. Delete the strip that runs from the easternmost (right-hand) red bay door down-left to Weber St N, at x 528-538 at y 172, 517-534 at y 180, 506-524 at y 188, 496-514 at y 196, 487-504 at y 204, 478-495 at y 212, 468-485 at y 220 and 459-476 at y 228. Paint mown lawn there, and let the cream footpath continue straight across that lawn.

3) Plain lawn, no shrubs: remove the small bushes at about (362,167), (405,193) and (514,226).

Keep the east driveway as it is: x 482-497 at y 156, 472-488 at y 164, 451-466 at y 180 and 429-445 at y 196, meeting Weber St N at x 414-421, y 212. Keep the cream footpath from (376-386,172) to (474-484,228). Change nothing else: the Canada Computers / J&J roof, all other roofs, the dirt construction site, the striped lots and the joins with the neighbouring tiles.

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: B017R3_context_5_-3.png, B017R3_mask_5_-3.png, B017R3_classes_5_-3.png, B017R3_style_0_0.png. Read B017R3_classes_legend.png yourself and do not pass them to the tool.

ATTACHED FILES
- B017R3_context_5_-3.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536), tile in the centre at (256, 256, 1280, 1280)
- B017R3_mask_5_-3.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B017R3_ref_5_-3.png (1024x1024) - GEOMETRY: reference render of tile 5_-3 alone
- B017R3_classes_5_-3.png (1536x1536) - SEMANTIC MAP (same framing as the composition)
- B017R3_previous_5_-3.png (1024x1024) - YOUR PREVIOUS OUTPUT (as received) - keep what is good about it
- B017R3_marked_5_-3.png (1024x1024) - ANNOTATED: what is wrong (red = missing/misplaced vs reference, yellow = displaced area, labels give the fix)
- B017R3_style_0_0.png (1024x1024) - STYLE: accepted artwork of tile 0_0 - match it
- B017R3_classes_legend.png (760x624) - LEGEND for the semantic maps

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

TASK - revised tile 5_-3
Edit B017R3_context_5_-3.png (1536 x 1536 px): the central 1024 x 1024 square (x 256-1279, y 256-1279) is the tile. B017R3_mask_5_-3.png: WHITE = paint, BLACK = keep exactly (finished neighbour art - continue it seamlessly across the boundary); white border areas are context that we cut away. B017R3_previous_5_-3.png is what you sent last time and B017R3_marked_5_-3.png marks what has to change: fix those points and keep the rest of its style. Geometry must follow B017R3_ref_5_-3.png and B017R3_classes_5_-3.png.

THIS TILE SHOWS
- Men's Hostel (upper right, around x=953, y=260): building - follow the reference wall colour for its material
- Waterloo Fire Station #1 (upper centre, around x=535, y=100): building - follow the reference wall colour for its material
- Physical Plant Operations (lower centre, around x=442, y=800): building - follow the reference wall colour for its material
- 69 Lodge (lower left, around x=273, y=909): building - follow the reference wall colour for its material
- Canada Computers (upper centre, around x=343, y=31): building - follow the reference wall colour for its material
- Centre for Cold Regions and Water Science (lower left, around x=196, y=961): building - follow the reference wall colour for its material
- Tirecraft (centre, around x=453, y=349): building - follow the reference wall colour for its material
- J&J Cards & Collectibles (upper centre, around x=374, y=60): building - follow the reference wall colour for its material
- Streets and paths crossing it: Weber Street North, Lodge Street, Marshall Street

OUTPUT
- 1536 x 1536 px, PNG, named B017R3_5_-3.png. A larger image with exactly the same aspect ratio is fine; never crop, pad or change the aspect ratio.

WHAT TO SEND BACK
- The ORIGINAL generated image file(s) exactly as produced - full resolution, PNG preferred - not a screenshot, preview or re-compressed copy - named exactly as listed above.
- A short note with the model name and version you used and any settings you can disclose (e.g. seed, steps, guidance / strength, quality, output size, edit or inpaint mode, number of attempts). Write "unknown" for anything you can't tell.
```

## Packet details (for reference - the agent does not need this section)

| File | Size | Purpose | Tiles | Defines composition | sha256 |
|---|---|---|---|---|---|
| `B017R3_context_5_-3.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536), tile in the centre at (256, 256, 1280, 1280) | 5_-3 | yes | `391e7d8bff23` |
| `B017R3_mask_5_-3.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 5_-3 | no | `2ab762bb370f` |
| `B017R3_ref_5_-3.png` | 1024x1024 | GEOMETRY: reference render of tile 5_-3 alone | 5_-3 | no | `cb8beede5e82` |
| `B017R3_classes_5_-3.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition) | 5_-3 | no | `bc272e4600f3` |
| `B017R3_previous_5_-3.png` | 1024x1024 | YOUR PREVIOUS OUTPUT (as received) - keep what is good about it | 5_-3 | no | `f09f40af86cb` |
| `B017R3_marked_5_-3.png` | 1024x1024 | ANNOTATED: what is wrong (red = missing/misplaced vs reference, yellow = displaced area, labels give the fix) | 5_-3 | no | `3efc7eacb5ff` |
| `B017R3_classes_legend.png` | 760x624 | LEGEND for the semantic maps | 5_-3 | no | `ac82d5b35871` |
| `B017R3_style_0_0.png` | 1024x1024 | STYLE: accepted artwork of tile 0_0 - match it | 0_0 | no | `bfd18a94f0c7` |

| Return file | Item | Expected size | Crop in returned image (x0, y0, x1, y1) | Becomes |
|---|---|---|---|---|
| `B017R3_5_-3.png` | 5_-3 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/5_-3.png` (1024x1024) |

**Crop math (context edit).** Context canvas = 1536x1536 canvas px at 1:1, origin at canvas px (tile_x*1024 - 256, tile_y*1024 - 256). For a returned image W x H with W/H = 1536/1536 (within 1 %), k = W/1536; the tile is the box (256k, 256k, 1280k, 1280k), resampled to 1024x1024 (box filter when k >= 1, Lanczos when k < 1). 1536x1536 -> crop (256, 256, 1280, 1280) exactly; a 2x image -> crop doubled, then box-halved. Fixed-size fallback 1024x1024: k = 0.6667, crop (170.67, 170.67, 853.33, 853.33) upscaled x1.50 (accepted with a reduced-detail warning). Agents limited to 1536x1024 or 1024x1536 get a native-scale packet instead: `build <batch> --frame wide` (margins left/right only, crop (256, 0, 1280, 1024)) or `--frame tall` (margins top/bottom only, crop (0, 256, 1024, 1280)). Joins that a frame has no margin for are repaired afterwards with seam packets (`art_request.py seam`).

**Camera and light.** Orthographic, heading 20.0 deg (camera looks NNE), pitch 45.0 deg, 0.29296875 m per artwork px. Sun azimuth 225.0 deg, elevation 50.0 deg: light from the lower left / behind the viewer, cast shadows toward the upper right. Tile (i, j) covers canvas px [i*1024, (i+1)*1024) x [j*1024, (j+1)*1024).

**QA on receipt** (`pipeline/art_import.py`, thresholds in docs/ART_PIPELINE.md): filename -> item match; decode; size / aspect; global translation by phase correlation of edge maps (> 4 px fails); local displacement and scale/rotation from a block grid (camera change); geometry agreement of class-map boundaries with image edges (whole tile, 8x8 cells, every building roof, landmark roofs); sun/shadow side; colour style against accepted tiles; seam discontinuity in a 4 px band against accepted neighbours; for context edits, drift of the kept margin.
