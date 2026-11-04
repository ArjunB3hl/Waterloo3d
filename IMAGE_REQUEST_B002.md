# Image request B002 - Campus 2x2 patch - tiles 0_-1, -1_0, -1_-1 continuing the accepted style sample

Packet revision 3, built 2026-11-04T17:01:48Z. Status: `requested`.

## What to do (for the user)

Everything is in `art/requests/B002/` (also zipped as `art/requests/B002.zip`). Start a **new conversation** with the image agent.

1. **Message 1** (tile 0_-1): attach these 7 files, then paste the text of "Message 1" below.

   - `B002_context_0_-1.png`
   - `B002_mask_0_-1.png`
   - `B002_classes_0_-1.png`
   - `B002_depth_0_-1.png`
   - `B002_style_0_0.png`
   - `B002_contact_sheet.png`
   - `B002_classes_legend.png`

   Wait for the image before sending the next message.

2. **Message 2** (tile -1_0): attach these 4 files, then paste the text of "Message 2" below.

   - `B002_context_-1_0.png`
   - `B002_mask_-1_0.png`
   - `B002_classes_-1_0.png`
   - `B002_depth_-1_0.png`

   Wait for the image before sending the next message.

3. **Message 3** (tile -1_-1): attach these 4 files, then paste the text of "Message 3" below.

   - `B002_context_-1_-1.png`
   - `B002_mask_-1_-1.png`
   - `B002_classes_-1_-1.png`
   - `B002_depth_-1_-1.png`

4. Save what comes back in one folder (e.g. `~/Downloads/B002/`) with exactly these names: `B002_0_-1.png`, `B002_-1_0.png`, `B002_-1_-1.png`. Copy the agent's note about model and settings into `B002_report.txt` in the same folder.

5. Check it: `python3 pipeline/art_import.py B002 ~/Downloads/B002` (QA report only), then `python3 pipeline/art_import.py B002 ~/Downloads/B002 --accept` to accept tiles that pass.

Total: 15 attachment files, 3 image(s) to bring back.

## Message 1 - tile 0_-1

```text
I'm making "Tiny Waterloo", an illustrated pixel-art map of Waterloo, Ontario (Canada) built from square tiles that join edge to edge. Please paint the image described below from the attached reference images. This conversation covers 3 tiles; this is tile 1 of 3 - I will send the others one at a time with the same rules.

ATTACHED FILES
- B002_context_0_-1.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 0_-1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B002_mask_0_-1.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B002_classes_0_-1.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B002_depth_0_-1.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more
- B002_style_0_0.png (1024x1024) - STYLE: finished, accepted artwork of neighbouring tile 0_0 - match its palette, pixel size, outlines, windows, trees and light exactly
- B002_contact_sheet.png (1024x1080) - CONTEXT ONLY: surrounding tiles at half scale, requested tile(s) outlined in red, landmark labels
- B002_classes_legend.png (760x704) - LEGEND for the semantic maps

ART DIRECTION
- Detailed pixel-art city illustration with a miniature-diorama feel: crisp, deliberate pixel clusters and clean edges where materials meet. No blur, airbrush, painterly smearing, film grain or photo texture.
- Clear, readable architecture: repeated window detail on every facade (regular rows and columns matching the building's height), recognizable roof shapes, parapets and rooftop equipment.
- Warm, readable palette in consistent late-summer afternoon daylight: rich but natural greens, cream and warm-grey paving, soft blue-grey shade.
- Local vegetation: mature maple and oak canopy in layered leaf clusters, mown campus lawns crossed by worn footpaths, lush greens along creeks and ponds.
- Waterloo materials: University of Waterloo brutalist / precast concrete (pale warm grey, deep window reveals), red-brown brick on many campus buildings, glass-and-metal curtain walls on the newer engineering buildings and the Quantum-Nano Centre. The reference's wall colour gives the material family: red-brown = brick, pale grey or cream = concrete, blue-grey = glass.

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

TASK - tile 0_-1
Edit B002_context_0_-1.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B002_mask_0_-1.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B002_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B002_classes_0_-1.png (legend: B002_classes_legend.png) for surface types and B002_depth_0_-1.png for building heights.

THIS TILE SHOWS
- William G. Davis Computer Research Centre (lower left, around x=141, y=794): DC - large brick-and-concrete research building with a stepped roofline
- Pearl Sullivan Engineering Building (centre, around x=678, y=494): E7 - newer engineering building, glass and metal curtain walls
- Engineering 5 (centre, around x=569, y=527): E5 - newer engineering building, glass and metal curtain walls
- Centre for Environmental and Information Technology (lower left, around x=203, y=979): EIT - concrete and brick science/engineering block
- Engineering 3 (lower centre, around x=529, y=899): campus building - follow the reference wall colour for its material
- East Campus Hall (upper right, around x=800, y=249): campus building - follow the reference wall colour for its material
- Carl A. Pollock Hall (lower right, around x=928, y=951): campus building - follow the reference wall colour for its material
- Engineering 6 (right, around x=897, y=396): E6 - newer engineering building; follow the reference wall colour for its material
- East Campus 4 (upper centre, around x=357, y=54): campus building - follow the reference wall colour for its material
- Streets and paths crossing it: Path 2 East, Ring Road, Laurel Trail (Trans-Canada Trail), Transit Plaza Road, Path 3 East, Phillip Street

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B002_context_0_-1.png, named B002_0_-1.png. We cut the tile out ourselves.
- If you can't output 1536 x 1536: a larger image with exactly the same aspect ratio is fine; if 1024 x 1024 is your only size, return the same full canvas scaled to it. Never crop, pad or change the aspect ratio.

WHAT TO SEND BACK
- The ORIGINAL generated image file(s) exactly as produced - full resolution, PNG preferred - not a screenshot, preview or re-compressed copy - named exactly as listed above.
- A short note with the model name and version you used and any settings you can disclose (e.g. seed, steps, guidance / strength, quality, output size, edit or inpaint mode, number of attempts). Write "unknown" for anything you can't tell.
```

## Message 2 - tile -1_0

```text
Next tile (2 of 3): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B002_context_-1_0.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile -1_0 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B002_mask_-1_0.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B002_classes_-1_0.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B002_depth_-1_0.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

TASK - tile -1_0
Edit B002_context_-1_0.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B002_mask_-1_0.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B002_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B002_classes_-1_0.png (legend: B002_classes_legend.png) for surface types and B002_depth_-1_0.png for building heights.

THIS TILE SHOWS
- Student Life Centre (upper centre, around x=362, y=163): SLC - the student centre; follow the reference wall colour for its material
- Mike & Ophelia Lazaridis Quantum Nano Centre (upper right, around x=734, y=214): QNC - glass and metal curtain wall with a honeycomb-like facade pattern
- Mathematics & Computer (upper right, around x=721, y=29): MC - long precast-concrete brutalist block with a repeated narrow window rhythm
- Physical Activities Complex (upper left, around x=103, y=92): campus building - follow the reference wall colour for its material
- St. Jerome's University (lower centre, around x=529, y=787): campus building - follow the reference wall colour for its material
- Renison University College (lower left, around x=164, y=963): campus building - follow the reference wall colour for its material
- Health Services (left, around x=323, y=555): campus building - follow the reference wall colour for its material
- Biology 2 (upper right, around x=898, y=306): red-brown brick campus building
- St. Jerome's University Residence Buildings (lower left, around x=329, y=863): campus building - follow the reference wall colour for its material
- Streets and paths crossing it: Ring Road, University Campus Lane, Two Row Path, Path 2 East, Path 2 West, Alumni Lane

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B002_context_-1_0.png, named B002_-1_0.png. We cut the tile out ourselves.
- If you can't output 1536 x 1536: a larger image with exactly the same aspect ratio is fine; if 1024 x 1024 is your only size, return the same full canvas scaled to it. Never crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Message 3 - tile -1_-1

```text
Next tile (3 of 3): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B002_context_-1_-1.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile -1_-1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B002_mask_-1_-1.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B002_classes_-1_-1.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B002_depth_-1_-1.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

TASK - tile -1_-1
Edit B002_context_-1_-1.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B002_mask_-1_-1.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B002_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B002_classes_-1_-1.png (legend: B002_classes_legend.png) for surface types and B002_depth_-1_-1.png for building heights.
Paint this tile after 0_-1 and -1_0: where its border shows the underdrawing of 0_-1 / -1_0, match what you painted for those tiles earlier in this conversation.

THIS TILE SHOWS
- William G. Davis Computer Research Centre (lower right, around x=926, y=719): DC - large brick-and-concrete research building with a stepped roofline
- Mathematics & Computer (lower centre, around x=669, y=960): MC - long precast-concrete brutalist block with a repeated narrow window rhythm
- Student Life Centre (lower left, around x=220, y=995): SLC - the student centre; follow the reference wall colour for its material
- General Services Complex (right, around x=755, y=573): campus building - follow the reference wall colour for its material
- B.C. Matthews Hall (lower left, around x=90, y=724): campus building - follow the reference wall colour for its material
- Chemistry 2 (lower right, around x=928, y=948): campus building - follow the reference wall colour for its material
- Mathematics 3 (lower centre, around x=492, y=734): campus building - follow the reference wall colour for its material
- Commisary (centre, around x=673, y=437): campus building - follow the reference wall colour for its material
- Energy Research Centre (centre, around x=357, y=638): campus building - follow the reference wall colour for its material
- Streets and paths crossing it: Ring Road, Columbia Street West, Laurel Trail (Trans-Canada Trail), Path 3 East, William Tutte Way, Alumni Lane

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B002_context_-1_-1.png, named B002_-1_-1.png. We cut the tile out ourselves.
- If you can't output 1536 x 1536: a larger image with exactly the same aspect ratio is fine; if 1024 x 1024 is your only size, return the same full canvas scaled to it. Never crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Packet details (for reference - the agent does not need this section)

| File | Size | Purpose | Tiles | Defines composition | sha256 |
|---|---|---|---|---|---|
| `B002_style_0_0.png` | 1024x1024 | STYLE: finished, accepted artwork of neighbouring tile 0_0 - match its palette, pixel size, outlines, windows, trees and light exactly | 0_0 | no | `bfd18a94f0c7` |
| `B002_contact_sheet.png` | 1024x1080 | CONTEXT ONLY: surrounding tiles at half scale, requested tile(s) outlined in red, landmark labels | -1_-1, 0_-1, -1_0, 0_0 | no | `bbcb851817e3` |
| `B002_context_0_-1.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 0_-1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 0_-1 | yes | `d623172801fc` |
| `B002_mask_0_-1.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 0_-1 | no | `834776451c52` |
| `B002_classes_0_-1.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 0_-1 | no | `7e33aa8d1ff6` |
| `B002_depth_0_-1.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 0_-1 | no | `bfe1e822e375` |
| `B002_context_-1_0.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile -1_0 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | -1_0 | yes | `1281314db2af` |
| `B002_mask_-1_0.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | -1_0 | no | `fea14f0a4eb0` |
| `B002_classes_-1_0.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | -1_0 | no | `837f05a9c65a` |
| `B002_depth_-1_0.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | -1_0 | no | `e7484bf7fce8` |
| `B002_context_-1_-1.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile -1_-1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | -1_-1 | yes | `d229751d98da` |
| `B002_mask_-1_-1.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | -1_-1 | no | `17934c186a9b` |
| `B002_classes_-1_-1.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | -1_-1 | no | `acd9bf0b4152` |
| `B002_depth_-1_-1.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | -1_-1 | no | `cfa746f4a539` |
| `B002_classes_legend.png` | 760x704 | LEGEND for the semantic maps | 0_-1, -1_0, -1_-1 | no | `fa726c46b242` |

| Return file | Item | Expected size | Crop in returned image (x0, y0, x1, y1) | Becomes |
|---|---|---|---|---|
| `B002_0_-1.png` | 0_-1 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/0_-1.png` (1024x1024) |
| `B002_-1_0.png` | -1_0 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/-1_0.png` (1024x1024) |
| `B002_-1_-1.png` | -1_-1 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/-1_-1.png` (1024x1024) |

**Crop math (context edit).** Context canvas = 1536x1536 canvas px at 1:1, origin at canvas px (tile_x*1024 - 256, tile_y*1024 - 256). For a returned image W x H with W/H = 1536/1536 (within 1 %), k = W/1536; the tile is the box (256k, 256k, 1280k, 1280k), resampled to 1024x1024 (box filter when k >= 1, Lanczos when k < 1). 1536x1536 -> crop (256, 256, 1280, 1280) exactly; a 2x image -> crop doubled, then box-halved. Fixed-size fallback 1024x1024: k = 0.6667, crop (170.67, 170.67, 853.33, 853.33) upscaled x1.50 (accepted with a reduced-detail warning). Agents limited to 1536x1024 or 1024x1536 get a native-scale packet instead: `build <batch> --frame wide` (margins left/right only, crop (256, 0, 1280, 1024)) or `--frame tall` (margins top/bottom only, crop (0, 256, 1024, 1280)). Joins that a frame has no margin for are repaired afterwards with seam packets (`art_request.py seam`).

**Camera and light.** Orthographic, heading 20.0 deg (camera looks NNE), pitch 45.0 deg, 0.29296875 m per artwork px. Sun azimuth 225.0 deg, elevation 50.0 deg: light from the lower left / behind the viewer, cast shadows toward the upper right. Tile (i, j) covers canvas px [i*1024, (i+1)*1024) x [j*1024, (j+1)*1024).

**QA on receipt** (`pipeline/art_import.py`, thresholds in docs/ART_PIPELINE.md): filename -> item match; decode; size / aspect; global translation by phase correlation of edge maps (> 4 px fails); local displacement and scale/rotation from a block grid (camera change); geometry agreement of class-map boundaries with image edges (whole tile, 8x8 cells, every building roof, landmark roofs); sun/shadow side; colour style against accepted tiles; seam discontinuity in a 4 px band against accepted neighbours; for context edits, drift of the kept margin.
