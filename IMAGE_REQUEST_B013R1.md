# Image request B013R1 - Revision of B013: 5_-1

Packet revision 1, built 2026-11-04T22:26:08Z. Status: `requested`.

## What to do (for the user)

Everything is in `art/requests/B013R1/` (also zipped as `art/requests/B013R1.zip`). Start a **new conversation** with the image agent.

1. **Message 1**: attach these 8 files, then paste the text of "Message 1" below.

   - `B013R1_context_5_-1.png`
   - `B013R1_mask_5_-1.png`
   - `B013R1_ref_5_-1.png`
   - `B013R1_classes_5_-1.png`
   - `B013R1_previous_5_-1.png`
   - `B013R1_marked_5_-1.png`
   - `B013R1_style_0_0.png`
   - `B013R1_classes_legend.png`

2. Save what comes back in one folder (e.g. `~/Downloads/B013R1/`) with exactly these names: `B013R1_5_-1.png`. Copy the agent's note about model and settings into `B013R1_report.txt` in the same folder.

3. Check it: `python3 pipeline/art_import.py B013R1 ~/Downloads/B013R1` (QA report only), then `python3 pipeline/art_import.py B013R1 ~/Downloads/B013R1 --accept` to accept tiles that pass.

Total: 8 attachment files, 1 image(s) to bring back.

## Message 1

```text
I'm making "Tiny Waterloo", an illustrated pixel-art map of Waterloo, Ontario (Canada) built from square tiles that join edge to edge. Please paint the image described below from the attached reference images.

REVISION - your previous image for this item could not be used. Exact corrections:
- Tile 5_-1 (tile-local px in the 1024 tile; add 256 for the 1536 context canvas). Keep everything except the box x 60-300, y 895-1024. 1) Remove the invented Gothic church and its spire (x~135-280, y~900-1024, including its base running into the margin below) and the tree clump at x~70-130, y~950-1010 - there is no church there in the reference. 2) Paint the reference buildings on their footprints instead: a 4-storey red-brown brick apartment block with a flat pale roof (roof x 108-159, y 937-975); a small dark-grey pitched-roof house (x 164-212, y 951-996); a small pitched-roof house (x 241-287, y 1010-1024) continuing across the bottom edge; a small flat-roofed box (x 268-299, y 988-1006). Keep the brown pitched house at x 172-227, y 919-953 and the light paved lot between them exactly as in the context image. 3) Nothing in this block may be taller than the depth guide shows (2-4 storeys, no spire). 4) Optional: Emmanuel United Church (flat footprint x 12-173, y 795-902) may get church materials such as stone trim or a small cross on the parapet - same footprint, outline and height. 5) Change nothing else: the joins with 4_-1 (left) and the street layout are correct.

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: B013R1_context_5_-1.png, B013R1_mask_5_-1.png, B013R1_classes_5_-1.png, B013R1_style_0_0.png. Read B013R1_classes_legend.png yourself and do not pass them to the tool.

ATTACHED FILES
- B013R1_context_5_-1.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536), tile in the centre at (256, 256, 1280, 1280)
- B013R1_mask_5_-1.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B013R1_ref_5_-1.png (1024x1024) - GEOMETRY: reference render of tile 5_-1 alone
- B013R1_classes_5_-1.png (1536x1536) - SEMANTIC MAP (same framing as the composition)
- B013R1_previous_5_-1.png (1024x1024) - YOUR PREVIOUS OUTPUT (as received) - keep what is good about it
- B013R1_marked_5_-1.png (1024x1024) - ANNOTATED: what is wrong (red = missing/misplaced vs reference, yellow = displaced area, labels give the fix)
- B013R1_style_0_0.png (1024x1024) - STYLE: accepted artwork of tile 0_0 - match it
- B013R1_classes_legend.png (760x584) - LEGEND for the semantic maps

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

TASK - revised tile 5_-1
Edit B013R1_context_5_-1.png (1536 x 1536 px): the central 1024 x 1024 square (x 256-1279, y 256-1279) is the tile. B013R1_mask_5_-1.png: WHITE = paint, BLACK = keep exactly (finished neighbour art - continue it seamlessly across the boundary); white border areas are context that we cut away. B013R1_previous_5_-1.png is what you sent last time and B013R1_marked_5_-1.png marks what has to change: fix those points and keep the rest of its style. Geometry must follow B013R1_ref_5_-1.png and B013R1_classes_5_-1.png.

THIS TILE SHOWS
- Fourteen Princess (lower centre, around x=419, y=930): building - follow the reference wall colour for its material
- Huether Hotel (lower centre, around x=558, y=924): building - follow the reference wall colour for its material
- Emmanuel United Church (lower left, around x=91, y=844): building - follow the reference wall colour for its material
- Princess Twin Cinemas (lower right, around x=844, y=997): building - follow the reference wall colour for its material
- One28 (upper left, around x=87, y=14): building - follow the reference wall colour for its material
- The Pub On King (lower centre, around x=428, y=741): building - follow the reference wall colour for its material
- Kentucky Bourbon and Barbecue (left, around x=210, y=537): building - follow the reference wall colour for its material
- Ethel's Lounge (left, around x=290, y=384): building - follow the reference wall colour for its material
- Revive (centre, around x=490, y=598): building - follow the reference wall colour for its material
- Streets and paths crossing it: King Street North, Regina Street North, Young Street East, Bridgeport Road West, Bridgeport Road East, Dorset Street

OUTPUT
- 1536 x 1536 px, PNG, named B013R1_5_-1.png. A larger image with exactly the same aspect ratio is fine; never crop, pad or change the aspect ratio.

WHAT TO SEND BACK
- The ORIGINAL generated image file(s) exactly as produced - full resolution, PNG preferred - not a screenshot, preview or re-compressed copy - named exactly as listed above.
- A short note with the model name and version you used and any settings you can disclose (e.g. seed, steps, guidance / strength, quality, output size, edit or inpaint mode, number of attempts). Write "unknown" for anything you can't tell.
```

## Packet details (for reference - the agent does not need this section)

| File | Size | Purpose | Tiles | Defines composition | sha256 |
|---|---|---|---|---|---|
| `B013R1_context_5_-1.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536), tile in the centre at (256, 256, 1280, 1280) | 5_-1 | yes | `1d81f3fb3156` |
| `B013R1_mask_5_-1.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 5_-1 | no | `8a89d4a3604f` |
| `B013R1_ref_5_-1.png` | 1024x1024 | GEOMETRY: reference render of tile 5_-1 alone | 5_-1 | no | `8de2d1430821` |
| `B013R1_classes_5_-1.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition) | 5_-1 | no | `2edd83a1e0e3` |
| `B013R1_previous_5_-1.png` | 1024x1024 | YOUR PREVIOUS OUTPUT (as received) - keep what is good about it | 5_-1 | no | `a8b2049e442d` |
| `B013R1_marked_5_-1.png` | 1024x1024 | ANNOTATED: what is wrong (red = missing/misplaced vs reference, yellow = displaced area, labels give the fix) | 5_-1 | no | `7f1788c17dcd` |
| `B013R1_classes_legend.png` | 760x584 | LEGEND for the semantic maps | 5_-1 | no | `ca00c3bb915e` |
| `B013R1_style_0_0.png` | 1024x1024 | STYLE: accepted artwork of tile 0_0 - match it | 0_0 | no | `bfd18a94f0c7` |

| Return file | Item | Expected size | Crop in returned image (x0, y0, x1, y1) | Becomes |
|---|---|---|---|---|
| `B013R1_5_-1.png` | 5_-1 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/5_-1.png` (1024x1024) |

**Crop math (context edit).** Context canvas = 1536x1536 canvas px at 1:1, origin at canvas px (tile_x*1024 - 256, tile_y*1024 - 256). For a returned image W x H with W/H = 1536/1536 (within 1 %), k = W/1536; the tile is the box (256k, 256k, 1280k, 1280k), resampled to 1024x1024 (box filter when k >= 1, Lanczos when k < 1). 1536x1536 -> crop (256, 256, 1280, 1280) exactly; a 2x image -> crop doubled, then box-halved. Fixed-size fallback 1024x1024: k = 0.6667, crop (170.67, 170.67, 853.33, 853.33) upscaled x1.50 (accepted with a reduced-detail warning). Agents limited to 1536x1024 or 1024x1536 get a native-scale packet instead: `build <batch> --frame wide` (margins left/right only, crop (256, 0, 1280, 1024)) or `--frame tall` (margins top/bottom only, crop (0, 256, 1024, 1280)). Joins that a frame has no margin for are repaired afterwards with seam packets (`art_request.py seam`).

**Camera and light.** Orthographic, heading 20.0 deg (camera looks NNE), pitch 45.0 deg, 0.29296875 m per artwork px. Sun azimuth 225.0 deg, elevation 50.0 deg: light from the lower left / behind the viewer, cast shadows toward the upper right. Tile (i, j) covers canvas px [i*1024, (i+1)*1024) x [j*1024, (j+1)*1024).

**QA on receipt** (`pipeline/art_import.py`, thresholds in docs/ART_PIPELINE.md): filename -> item match; decode; size / aspect; global translation by phase correlation of edge maps (> 4 px fails); local displacement and scale/rotation from a block grid (camera change); geometry agreement of class-map boundaries with image edges (whole tile, 8x8 cells, every building roof, landmark roofs); sun/shadow side; colour style against accepted tiles; seam discontinuity in a 4 px band against accepted neighbours; for context edits, drift of the kept margin.
