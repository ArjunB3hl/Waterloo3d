# Image request B007 - South of campus - tiles -1_1, 0_1, 1_1, 2_1

Packet revision 1, built 2026-11-04T19:32:45Z. Status: `requested`.

## What to do (for the user)

Everything is in `art/requests/B007/` (also zipped as `art/requests/B007.zip`). Start a **new conversation** with the image agent.

1. **Message 1** (tile -1_1): attach these 7 files, then paste the text of "Message 1" below.

   - `B007_context_-1_1.png`
   - `B007_mask_-1_1.png`
   - `B007_classes_-1_1.png`
   - `B007_depth_-1_1.png`
   - `B007_style_0_0.png`
   - `B007_contact_sheet.png`
   - `B007_classes_legend.png`

   Wait for the image before sending the next message.

2. **Message 2** (tile 0_1): attach these 4 files, then paste the text of "Message 2" below.

   - `B007_context_0_1.png`
   - `B007_mask_0_1.png`
   - `B007_classes_0_1.png`
   - `B007_depth_0_1.png`

   Wait for the image before sending the next message.

3. **Message 3** (tile 1_1): attach these 4 files, then paste the text of "Message 3" below.

   - `B007_context_1_1.png`
   - `B007_mask_1_1.png`
   - `B007_classes_1_1.png`
   - `B007_depth_1_1.png`

   Wait for the image before sending the next message.

4. **Message 4** (tile 2_1): attach these 4 files, then paste the text of "Message 4" below.

   - `B007_context_2_1.png`
   - `B007_mask_2_1.png`
   - `B007_classes_2_1.png`
   - `B007_depth_2_1.png`

5. Save what comes back in one folder (e.g. `~/Downloads/B007/`) with exactly these names: `B007_-1_1.png`, `B007_0_1.png`, `B007_1_1.png`, `B007_2_1.png`. Copy the agent's note about model and settings into `B007_report.txt` in the same folder.

6. Check it: `python3 pipeline/art_import.py B007 ~/Downloads/B007` (QA report only), then `python3 pipeline/art_import.py B007 ~/Downloads/B007 --accept` to accept tiles that pass.

Total: 19 attachment files, 4 image(s) to bring back.

## Message 1 - tile -1_1

```text
I'm making "Tiny Waterloo", an illustrated pixel-art map of Waterloo, Ontario (Canada) built from square tiles that join edge to edge. Please paint the image described below from the attached reference images. This conversation covers 4 tiles; this is tile 1 of 4 - I will send the others one at a time with the same rules.

ATTACHED FILES
- B007_context_-1_1.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile -1_1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B007_mask_-1_1.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B007_classes_-1_1.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B007_depth_-1_1.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more
- B007_style_0_0.png (1024x1024) - STYLE: finished, accepted artwork of neighbouring tile 0_0 - match its palette, pixel size, outlines, windows, trees and light exactly
- B007_contact_sheet.png (2048x1080) - CONTEXT ONLY: surrounding tiles at half scale, requested tile(s) outlined in red, landmark labels
- B007_classes_legend.png (760x784) - LEGEND for the semantic maps

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

TASK - tile -1_1
Edit B007_context_-1_1.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B007_mask_-1_1.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B007_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B007_classes_-1_1.png (legend: B007_classes_legend.png) for surface types and B007_depth_-1_1.png for building heights.

THIS TILE SHOWS
- Renison University College (upper left, around x=228, y=43): campus building - follow the reference wall colour for its material
- United College (upper centre, around x=586, y=236): campus building - follow the reference wall colour for its material
- United College Apartments (upper centre, around x=651, y=85): campus building - follow the reference wall colour for its material
- Conrad Grebel University College (right, around x=937, y=440): campus building - follow the reference wall colour for its material
- United College Green Wing (upper right, around x=691, y=137): campus building - follow the reference wall colour for its material
- Streets and paths crossing it: Westmount Road North, Longfellow Drive, University Campus Lane, Tennyson Place, Shakespeare Place

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B007_context_-1_1.png, named B007_-1_1.png. We cut the tile out ourselves.
- If you can't output 1536 x 1536: a larger image with exactly the same aspect ratio is fine; if 1024 x 1024 is your only size, return the same full canvas scaled to it. Never crop, pad or change the aspect ratio.

WHAT TO SEND BACK
- The ORIGINAL generated image file(s) exactly as produced - full resolution, PNG preferred - not a screenshot, preview or re-compressed copy - named exactly as listed above.
- A short note with the model name and version you used and any settings you can disclose (e.g. seed, steps, guidance / strength, quality, output size, edit or inpaint mode, number of attempts). Write "unknown" for anything you can't tell.
```

## Message 2 - tile 0_1

```text
Next tile (2 of 4): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B007_context_0_1.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 0_1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B007_mask_0_1.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B007_classes_0_1.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B007_depth_0_1.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

TASK - tile 0_1
Edit B007_context_0_1.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B007_mask_0_1.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B007_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B007_classes_0_1.png (legend: B007_classes_legend.png) for surface types and B007_depth_0_1.png for building heights.
Paint this tile after -1_1: where its border shows the underdrawing of -1_1, match what you painted for that tile earlier in this conversation.

THIS TILE SHOWS
- Psychology, Anthropology & Sociology (upper centre, around x=680, y=93): campus building - follow the reference wall colour for its material
- Conrad Grebel University College (left, around x=140, y=489): campus building - follow the reference wall colour for its material
- Minota Hagey Residence (right, around x=820, y=471): campus building - follow the reference wall colour for its material
- Environment 2 (upper centre, around x=350, y=23): campus building - follow the reference wall colour for its material
- Streets and paths crossing it: Westmount Road North, Ring Road, Iroquois Place, Longfellow Drive, Algonquin Drive, University Campus Lane

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B007_context_0_1.png, named B007_0_1.png. We cut the tile out ourselves.
- If you can't output 1536 x 1536: a larger image with exactly the same aspect ratio is fine; if 1024 x 1024 is your only size, return the same full canvas scaled to it. Never crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Message 3 - tile 1_1

```text
Next tile (3 of 4): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B007_context_1_1.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 1_1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B007_mask_1_1.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B007_classes_1_1.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B007_depth_1_1.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

TASK - tile 1_1
Edit B007_context_1_1.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B007_mask_1_1.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B007_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B007_classes_1_1.png (legend: B007_classes_legend.png) for surface types and B007_depth_1_1.png for building heights.
Paint this tile after 0_1: where its border shows the underdrawing of 0_1, match what you painted for that tile earlier in this conversation.

THIS TILE SHOWS
- EMS (lower right, around x=1004, y=860): campus building - follow the reference wall colour for its material
- Streets and paths crossing it: University Avenue West, Westmount Road North, Ring Road

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B007_context_1_1.png, named B007_1_1.png. We cut the tile out ourselves.
- If you can't output 1536 x 1536: a larger image with exactly the same aspect ratio is fine; if 1024 x 1024 is your only size, return the same full canvas scaled to it. Never crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Message 4 - tile 2_1

```text
Next tile (4 of 4): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B007_context_2_1.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 2_1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B007_mask_2_1.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B007_classes_2_1.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B007_depth_2_1.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

TASK - tile 2_1
Edit B007_context_2_1.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B007_mask_2_1.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B007_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B007_classes_2_1.png (legend: B007_classes_legend.png) for surface types and B007_depth_2_1.png for building heights.
Paint this tile after 1_1: where its border shows the underdrawing of 1_1, match what you painted for that tile earlier in this conversation.

THIS TILE SHOWS
- Service Centre (upper right, around x=796, y=40): campus building - follow the reference wall colour for its material
- Shell (lower left, around x=103, y=914): campus building - follow the reference wall colour for its material
- Servery (upper centre, around x=513, y=112): campus building - follow the reference wall colour for its material
- EMS (lower left, around x=14, y=855): campus building - follow the reference wall colour for its material
- Streets and paths crossing it: Father David Bauer Drive

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B007_context_2_1.png, named B007_2_1.png. We cut the tile out ourselves.
- If you can't output 1536 x 1536: a larger image with exactly the same aspect ratio is fine; if 1024 x 1024 is your only size, return the same full canvas scaled to it. Never crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Packet details (for reference - the agent does not need this section)

| File | Size | Purpose | Tiles | Defines composition | sha256 |
|---|---|---|---|---|---|
| `B007_style_0_0.png` | 1024x1024 | STYLE: finished, accepted artwork of neighbouring tile 0_0 - match its palette, pixel size, outlines, windows, trees and light exactly | 0_0 | no | `bfd18a94f0c7` |
| `B007_contact_sheet.png` | 2048x1080 | CONTEXT ONLY: surrounding tiles at half scale, requested tile(s) outlined in red, landmark labels | -1_0, -1_1, 0_0, 0_1, 1_0, 1_1, 2_0, 2_1 | no | `9ddf3e6464c6` |
| `B007_context_-1_1.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile -1_1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | -1_1 | yes | `de04e4399002` |
| `B007_mask_-1_1.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | -1_1 | no | `bfc1585e9309` |
| `B007_classes_-1_1.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | -1_1 | no | `d18361a0d9d9` |
| `B007_depth_-1_1.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | -1_1 | no | `c18be3929b0c` |
| `B007_context_0_1.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 0_1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 0_1 | yes | `dc2938b3fad7` |
| `B007_mask_0_1.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 0_1 | no | `dac115d9beca` |
| `B007_classes_0_1.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 0_1 | no | `6707abf91f3d` |
| `B007_depth_0_1.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 0_1 | no | `7376ed93625c` |
| `B007_context_1_1.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 1_1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 1_1 | yes | `0a909a2ef20d` |
| `B007_mask_1_1.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 1_1 | no | `dac115d9beca` |
| `B007_classes_1_1.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 1_1 | no | `10a68defa1eb` |
| `B007_depth_1_1.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 1_1 | no | `4e4f53a7ec06` |
| `B007_context_2_1.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 2_1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 2_1 | yes | `49b360c0114e` |
| `B007_mask_2_1.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 2_1 | no | `3a5c20ff06f1` |
| `B007_classes_2_1.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 2_1 | no | `350bd1aa9272` |
| `B007_depth_2_1.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 2_1 | no | `a085c84050d9` |
| `B007_classes_legend.png` | 760x784 | LEGEND for the semantic maps | -1_1, 0_1, 1_1, 2_1 | no | `2ea2d417fae6` |

| Return file | Item | Expected size | Crop in returned image (x0, y0, x1, y1) | Becomes |
|---|---|---|---|---|
| `B007_-1_1.png` | -1_1 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/-1_1.png` (1024x1024) |
| `B007_0_1.png` | 0_1 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/0_1.png` (1024x1024) |
| `B007_1_1.png` | 1_1 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/1_1.png` (1024x1024) |
| `B007_2_1.png` | 2_1 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/2_1.png` (1024x1024) |

**Crop math (context edit).** Context canvas = 1536x1536 canvas px at 1:1, origin at canvas px (tile_x*1024 - 256, tile_y*1024 - 256). For a returned image W x H with W/H = 1536/1536 (within 1 %), k = W/1536; the tile is the box (256k, 256k, 1280k, 1280k), resampled to 1024x1024 (box filter when k >= 1, Lanczos when k < 1). 1536x1536 -> crop (256, 256, 1280, 1280) exactly; a 2x image -> crop doubled, then box-halved. Fixed-size fallback 1024x1024: k = 0.6667, crop (170.67, 170.67, 853.33, 853.33) upscaled x1.50 (accepted with a reduced-detail warning). Agents limited to 1536x1024 or 1024x1536 get a native-scale packet instead: `build <batch> --frame wide` (margins left/right only, crop (256, 0, 1280, 1024)) or `--frame tall` (margins top/bottom only, crop (0, 256, 1024, 1280)). Joins that a frame has no margin for are repaired afterwards with seam packets (`art_request.py seam`).

**Camera and light.** Orthographic, heading 20.0 deg (camera looks NNE), pitch 45.0 deg, 0.29296875 m per artwork px. Sun azimuth 225.0 deg, elevation 50.0 deg: light from the lower left / behind the viewer, cast shadows toward the upper right. Tile (i, j) covers canvas px [i*1024, (i+1)*1024) x [j*1024, (j+1)*1024).

**QA on receipt** (`pipeline/art_import.py`, thresholds in docs/ART_PIPELINE.md): filename -> item match; decode; size / aspect; global translation by phase correlation of edge maps (> 4 px fails); local displacement and scale/rotation from a block grid (camera change); geometry agreement of class-map boundaries with image edges (whole tile, 8x8 cells, every building roof, landmark roofs); sun/shadow side; colour style against accepted tiles; seam discontinuity in a 4 px band against accepted neighbours; for context edits, drift of the kept margin.
