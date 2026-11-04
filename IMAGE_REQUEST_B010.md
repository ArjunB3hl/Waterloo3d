# Image request B010 - Second row north of campus - tiles -1_-3, 0_-3, 1_-3, 2_-3

Packet revision 1, built 2026-11-04T20:16:16Z. Status: `requested`.

## What to do (for the user)

Everything is in `art/requests/B010/` (also zipped as `art/requests/B010.zip`). Start a **new conversation** with the image agent.

1. **Message 1** (tile -1_-3): attach these 7 files, then paste the text of "Message 1" below.

   - `B010_context_-1_-3.png`
   - `B010_mask_-1_-3.png`
   - `B010_classes_-1_-3.png`
   - `B010_depth_-1_-3.png`
   - `B010_style_0_0.png`
   - `B010_contact_sheet.png`
   - `B010_classes_legend.png`

   Wait for the image before sending the next message.

2. **Message 2** (tile 0_-3): attach these 4 files, then paste the text of "Message 2" below.

   - `B010_context_0_-3.png`
   - `B010_mask_0_-3.png`
   - `B010_classes_0_-3.png`
   - `B010_depth_0_-3.png`

   Wait for the image before sending the next message.

3. **Message 3** (tile 1_-3): attach these 4 files, then paste the text of "Message 3" below.

   - `B010_context_1_-3.png`
   - `B010_mask_1_-3.png`
   - `B010_classes_1_-3.png`
   - `B010_depth_1_-3.png`

   Wait for the image before sending the next message.

4. **Message 4** (tile 2_-3): attach these 4 files, then paste the text of "Message 4" below.

   - `B010_context_2_-3.png`
   - `B010_mask_2_-3.png`
   - `B010_classes_2_-3.png`
   - `B010_depth_2_-3.png`

5. Save what comes back in one folder (e.g. `~/Downloads/B010/`) with exactly these names: `B010_-1_-3.png`, `B010_0_-3.png`, `B010_1_-3.png`, `B010_2_-3.png`. Copy the agent's note about model and settings into `B010_report.txt` in the same folder.

6. Check it: `python3 pipeline/art_import.py B010 ~/Downloads/B010` (QA report only), then `python3 pipeline/art_import.py B010 ~/Downloads/B010 --accept` to accept tiles that pass.

Total: 19 attachment files, 4 image(s) to bring back.

## Message 1 - tile -1_-3

```text
I'm making "Tiny Waterloo", an illustrated pixel-art map of Waterloo, Ontario (Canada) built from square tiles that join edge to edge. Please paint the image described below from the attached reference images. This conversation covers 4 tiles; this is tile 1 of 4 - I will send the others one at a time with the same rules.

ATTACHED FILES
- B010_context_-1_-3.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile -1_-3 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B010_mask_-1_-3.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B010_classes_-1_-3.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B010_depth_-1_-3.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more
- B010_style_0_0.png (1024x1024) - STYLE: finished, accepted artwork of neighbouring tile 0_0 - match its palette, pixel size, outlines, windows, trees and light exactly
- B010_contact_sheet.png (2048x2104) - CONTEXT ONLY: surrounding tiles at half scale, requested tile(s) outlined in red, landmark labels
- B010_classes_legend.png (760x664) - LEGEND for the semantic maps

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

TASK - tile -1_-3
Edit B010_context_-1_-3.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B010_mask_-1_-3.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B010_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B010_classes_-1_-3.png (legend: B010_classes_legend.png) for surface types and B010_depth_-1_-3.png for building heights.

THIS TILE SHOWS
- Prica Global Enterprises (lower right, around x=727, y=963): campus building - follow the reference wall colour for its material
- Meetz' Small Engines (upper centre, around x=590, y=10): campus building - follow the reference wall colour for its material
- Streets and paths crossing it: Phillip Street, Albert Street

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B010_context_-1_-3.png, named B010_-1_-3.png. We cut the tile out ourselves.
- If you can't output 1536 x 1536: a larger image with exactly the same aspect ratio is fine; if 1024 x 1024 is your only size, return the same full canvas scaled to it. Never crop, pad or change the aspect ratio.

WHAT TO SEND BACK
- The ORIGINAL generated image file(s) exactly as produced - full resolution, PNG preferred - not a screenshot, preview or re-compressed copy - named exactly as listed above.
- A short note with the model name and version you used and any settings you can disclose (e.g. seed, steps, guidance / strength, quality, output size, edit or inpaint mode, number of attempts). Write "unknown" for anything you can't tell.
```

## Message 2 - tile 0_-3

```text
Next tile (2 of 4): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B010_context_0_-3.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 0_-3 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B010_mask_0_-3.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B010_classes_0_-3.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B010_depth_0_-3.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

TASK - tile 0_-3
Edit B010_context_0_-3.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B010_mask_0_-3.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B010_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B010_classes_0_-3.png (legend: B010_classes_legend.png) for surface types and B010_depth_0_-3.png for building heights.
Paint this tile after -1_-3: where its border shows the underdrawing of -1_-3, match what you painted for that tile earlier in this conversation.

THIS TILE SHOWS
- Sandvine Incorporated (upper centre, around x=345, y=120): campus building - follow the reference wall colour for its material
- Bell Canada CO (centre, around x=358, y=544): campus building - follow the reference wall colour for its material
- Columbia Crossing (lower right, around x=906, y=796): campus building - follow the reference wall colour for its material
- Streets and paths crossing it: Cardill Crescent, Albert Street, Columbia Street West

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B010_context_0_-3.png, named B010_0_-3.png. We cut the tile out ourselves.
- If you can't output 1536 x 1536: a larger image with exactly the same aspect ratio is fine; if 1024 x 1024 is your only size, return the same full canvas scaled to it. Never crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Message 3 - tile 1_-3

```text
Next tile (3 of 4): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B010_context_1_-3.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 1_-3 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B010_mask_1_-3.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B010_classes_1_-3.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B010_depth_1_-3.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

TASK - tile 1_-3
Edit B010_context_1_-3.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B010_mask_1_-3.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B010_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B010_classes_1_-3.png (legend: B010_classes_legend.png) for surface types and B010_depth_1_-3.png for building heights.
Paint this tile after 0_-3: where its border shows the underdrawing of 0_-3, match what you painted for that tile earlier in this conversation.

THIS TILE SHOWS
- Movement Disorders Research & Rehabilitation Centre (lower right, around x=1003, y=721): campus building - follow the reference wall colour for its material
- Streets and paths crossing it: Columbia Street West, Hazel Street, Cardill Crescent, Hemlock Street, Albert Street, Austin Drive

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B010_context_1_-3.png, named B010_1_-3.png. We cut the tile out ourselves.
- If you can't output 1536 x 1536: a larger image with exactly the same aspect ratio is fine; if 1024 x 1024 is your only size, return the same full canvas scaled to it. Never crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Message 4 - tile 2_-3

```text
Next tile (4 of 4): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B010_context_2_-3.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 2_-3 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B010_mask_2_-3.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B010_classes_2_-3.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B010_depth_2_-3.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

TASK - tile 2_-3
Edit B010_context_2_-3.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B010_mask_2_-3.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B010_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B010_classes_2_-3.png (legend: B010_classes_legend.png) for surface types and B010_depth_2_-3.png for building heights.
Paint this tile after 1_-3: where its border shows the underdrawing of 1_-3, match what you painted for that tile earlier in this conversation.

THIS TILE SHOWS
- Waterloo Collegiate Institute (upper left, around x=281, y=297): campus building - follow the reference wall colour for its material
- Movement Disorders Research & Rehabilitation Centre (lower left, around x=73, y=804): campus building - follow the reference wall colour for its material
- Spruce Street Residence (WLU) (upper right, around x=950, y=81): campus building - follow the reference wall colour for its material
- Streets and paths crossing it: Hazel Street, Hickory Street West, State Street, Larch Street, Columbia Street West, Hawthorn Street

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B010_context_2_-3.png, named B010_2_-3.png. We cut the tile out ourselves.
- If you can't output 1536 x 1536: a larger image with exactly the same aspect ratio is fine; if 1024 x 1024 is your only size, return the same full canvas scaled to it. Never crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Packet details (for reference - the agent does not need this section)

| File | Size | Purpose | Tiles | Defines composition | sha256 |
|---|---|---|---|---|---|
| `B010_style_0_0.png` | 1024x1024 | STYLE: finished, accepted artwork of neighbouring tile 0_0 - match its palette, pixel size, outlines, windows, trees and light exactly | 0_0 | no | `bfd18a94f0c7` |
| `B010_contact_sheet.png` | 2048x2104 | CONTEXT ONLY: surrounding tiles at half scale, requested tile(s) outlined in red, landmark labels | -1_-2, -1_-3, 0_-2, 0_-3, 0_0, 1_-2, 1_-3, 2_-2, 2_-3 | no | `b55664bf68f0` |
| `B010_context_-1_-3.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile -1_-3 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | -1_-3 | yes | `ecf602314110` |
| `B010_mask_-1_-3.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | -1_-3 | no | `f7c578357610` |
| `B010_classes_-1_-3.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | -1_-3 | no | `08c8009bb413` |
| `B010_depth_-1_-3.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | -1_-3 | no | `495fe8316392` |
| `B010_context_0_-3.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 0_-3 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 0_-3 | yes | `b974398af565` |
| `B010_mask_0_-3.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 0_-3 | no | `c13b6cce3968` |
| `B010_classes_0_-3.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 0_-3 | no | `04167650848f` |
| `B010_depth_0_-3.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 0_-3 | no | `cd379883abae` |
| `B010_context_1_-3.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 1_-3 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 1_-3 | yes | `9e0663773117` |
| `B010_mask_1_-3.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 1_-3 | no | `c13b6cce3968` |
| `B010_classes_1_-3.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 1_-3 | no | `dc74b4782c44` |
| `B010_depth_1_-3.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 1_-3 | no | `753e5687c760` |
| `B010_context_2_-3.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 2_-3 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 2_-3 | yes | `dedb0958a159` |
| `B010_mask_2_-3.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 2_-3 | no | `c1d9344d6b67` |
| `B010_classes_2_-3.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 2_-3 | no | `0acaeb67fd82` |
| `B010_depth_2_-3.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 2_-3 | no | `f0bccaa6e306` |
| `B010_classes_legend.png` | 760x664 | LEGEND for the semantic maps | -1_-3, 0_-3, 1_-3, 2_-3 | no | `62f5363a73ef` |

| Return file | Item | Expected size | Crop in returned image (x0, y0, x1, y1) | Becomes |
|---|---|---|---|---|
| `B010_-1_-3.png` | -1_-3 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/-1_-3.png` (1024x1024) |
| `B010_0_-3.png` | 0_-3 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/0_-3.png` (1024x1024) |
| `B010_1_-3.png` | 1_-3 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/1_-3.png` (1024x1024) |
| `B010_2_-3.png` | 2_-3 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/2_-3.png` (1024x1024) |

**Crop math (context edit).** Context canvas = 1536x1536 canvas px at 1:1, origin at canvas px (tile_x*1024 - 256, tile_y*1024 - 256). For a returned image W x H with W/H = 1536/1536 (within 1 %), k = W/1536; the tile is the box (256k, 256k, 1280k, 1280k), resampled to 1024x1024 (box filter when k >= 1, Lanczos when k < 1). 1536x1536 -> crop (256, 256, 1280, 1280) exactly; a 2x image -> crop doubled, then box-halved. Fixed-size fallback 1024x1024: k = 0.6667, crop (170.67, 170.67, 853.33, 853.33) upscaled x1.50 (accepted with a reduced-detail warning). Agents limited to 1536x1024 or 1024x1536 get a native-scale packet instead: `build <batch> --frame wide` (margins left/right only, crop (256, 0, 1280, 1024)) or `--frame tall` (margins top/bottom only, crop (0, 256, 1024, 1280)). Joins that a frame has no margin for are repaired afterwards with seam packets (`art_request.py seam`).

**Camera and light.** Orthographic, heading 20.0 deg (camera looks NNE), pitch 45.0 deg, 0.29296875 m per artwork px. Sun azimuth 225.0 deg, elevation 50.0 deg: light from the lower left / behind the viewer, cast shadows toward the upper right. Tile (i, j) covers canvas px [i*1024, (i+1)*1024) x [j*1024, (j+1)*1024).

**QA on receipt** (`pipeline/art_import.py`, thresholds in docs/ART_PIPELINE.md): filename -> item match; decode; size / aspect; global translation by phase correlation of edge maps (> 4 px fails); local displacement and scale/rotation from a block grid (camera change); geometry agreement of class-map boundaries with image edges (whole tile, 8x8 cells, every building roof, landmark roofs); sun/shadow side; colour style against accepted tiles; seam discontinuity in a 4 px band against accepted neighbours; for context edits, drift of the kept margin.
