# Image request B006 - North of campus: ION corridor and Columbia St area - tiles -1_-2, 0_-2, 1_-2, 2_-2

Packet revision 1, built 2026-11-04T19:32:26Z. Status: `requested`.

## What to do (for the user)

Everything is in `art/requests/B006/` (also zipped as `art/requests/B006.zip`). Start a **new conversation** with the image agent.

1. **Message 1** (tile -1_-2): attach these 7 files, then paste the text of "Message 1" below.

   - `B006_context_-1_-2.png`
   - `B006_mask_-1_-2.png`
   - `B006_classes_-1_-2.png`
   - `B006_depth_-1_-2.png`
   - `B006_style_0_0.png`
   - `B006_contact_sheet.png`
   - `B006_classes_legend.png`

   Wait for the image before sending the next message.

2. **Message 2** (tile 0_-2): attach these 4 files, then paste the text of "Message 2" below.

   - `B006_context_0_-2.png`
   - `B006_mask_0_-2.png`
   - `B006_classes_0_-2.png`
   - `B006_depth_0_-2.png`

   Wait for the image before sending the next message.

3. **Message 3** (tile 1_-2): attach these 4 files, then paste the text of "Message 3" below.

   - `B006_context_1_-2.png`
   - `B006_mask_1_-2.png`
   - `B006_classes_1_-2.png`
   - `B006_depth_1_-2.png`

   Wait for the image before sending the next message.

4. **Message 4** (tile 2_-2): attach these 4 files, then paste the text of "Message 4" below.

   - `B006_context_2_-2.png`
   - `B006_mask_2_-2.png`
   - `B006_classes_2_-2.png`
   - `B006_depth_2_-2.png`

5. Save what comes back in one folder (e.g. `~/Downloads/B006/`) with exactly these names: `B006_-1_-2.png`, `B006_0_-2.png`, `B006_1_-2.png`, `B006_2_-2.png`. Copy the agent's note about model and settings into `B006_report.txt` in the same folder.

6. Check it: `python3 pipeline/art_import.py B006 ~/Downloads/B006` (QA report only), then `python3 pipeline/art_import.py B006 ~/Downloads/B006 --accept` to accept tiles that pass.

Total: 19 attachment files, 4 image(s) to bring back.

## Message 1 - tile -1_-2

```text
I'm making "Tiny Waterloo", an illustrated pixel-art map of Waterloo, Ontario (Canada) built from square tiles that join edge to edge. Please paint the image described below from the attached reference images. This conversation covers 4 tiles; this is tile 1 of 4 - I will send the others one at a time with the same rules.

ATTACHED FILES
- B006_context_-1_-2.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile -1_-2 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B006_mask_-1_-2.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B006_classes_-1_-2.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B006_depth_-1_-2.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more
- B006_style_0_0.png (1024x1024) - STYLE: finished, accepted artwork of neighbouring tile 0_0 - match its palette, pixel size, outlines, windows, trees and light exactly
- B006_contact_sheet.png (2048x1592) - CONTEXT ONLY: surrounding tiles at half scale, requested tile(s) outlined in red, landmark labels
- B006_classes_legend.png (760x584) - LEGEND for the semantic maps

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

TASK - tile -1_-2
Edit B006_context_-1_-2.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B006_mask_-1_-2.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B006_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B006_classes_-1_-2.png (legend: B006_classes_legend.png) for surface types and B006_depth_-1_-2.png for building heights.

THIS TILE SHOWS
- Prica Global Enterprises (upper right, around x=779, y=52): campus building - follow the reference wall colour for its material
- WIW (right, around x=815, y=511): campus building - follow the reference wall colour for its material
- Lakes Software (centre, around x=469, y=657): campus building - follow the reference wall colour for its material
- FleetComplete (lower centre, around x=365, y=798): campus building - follow the reference wall colour for its material
- East Campus 1 (lower right, around x=974, y=772): campus building - follow the reference wall colour for its material
- East Campus 3 (lower centre, around x=672, y=1003): campus building - follow the reference wall colour for its material
- Ford (left, around x=30, y=367): campus building - follow the reference wall colour for its material
- East Campus 5 (lower right, around x=1001, y=930): campus building - follow the reference wall colour for its material
- Streets and paths crossing it: Phillip Street, Columbia Street West, Laurel Trail (Trans-Canada Trail)

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B006_context_-1_-2.png, named B006_-1_-2.png. We cut the tile out ourselves.
- If you can't output 1536 x 1536: a larger image with exactly the same aspect ratio is fine; if 1024 x 1024 is your only size, return the same full canvas scaled to it. Never crop, pad or change the aspect ratio.

WHAT TO SEND BACK
- The ORIGINAL generated image file(s) exactly as produced - full resolution, PNG preferred - not a screenshot, preview or re-compressed copy - named exactly as listed above.
- A short note with the model name and version you used and any settings you can disclose (e.g. seed, steps, guidance / strength, quality, output size, edit or inpaint mode, number of attempts). Write "unknown" for anything you can't tell.
```

## Message 2 - tile 0_-2

```text
Next tile (2 of 4): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B006_context_0_-2.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 0_-2 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B006_mask_0_-2.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B006_classes_0_-2.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B006_depth_0_-2.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

TASK - tile 0_-2
Edit B006_context_0_-2.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B006_mask_0_-2.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B006_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B006_classes_0_-2.png (legend: B006_classes_legend.png) for surface types and B006_depth_0_-2.png for building heights.
Paint this tile after -1_-2: where its border shows the underdrawing of -1_-2, match what you painted for that tile earlier in this conversation.

THIS TILE SHOWS
- Society 145 (centre, around x=501, y=466): campus building - follow the reference wall colour for its material
- Icon (centre, around x=458, y=579): campus building - follow the reference wall colour for its material
- East Campus 1 (lower left, around x=122, y=763): campus building - follow the reference wall colour for its material
- East Campus 5 (lower left, around x=88, y=941): campus building - follow the reference wall colour for its material
- WCRI Fenwick (right, around x=918, y=679): campus building - follow the reference wall colour for its material
- RIM 21 (Columbia Place) (upper left, around x=215, y=291): campus building - follow the reference wall colour for its material
- East Campus 4 (lower centre, around x=426, y=1004): campus building - follow the reference wall colour for its material
- A1 (lower right, around x=947, y=876): campus building - follow the reference wall colour for its material
- A4 (lower right, around x=748, y=803): campus building - follow the reference wall colour for its material
- Streets and paths crossing it: Columbia Street West, Phillip Street, Lester Street, Batavia Place

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B006_context_0_-2.png, named B006_0_-2.png. We cut the tile out ourselves.
- If you can't output 1536 x 1536: a larger image with exactly the same aspect ratio is fine; if 1024 x 1024 is your only size, return the same full canvas scaled to it. Never crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Message 3 - tile 1_-2

```text
Next tile (3 of 4): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B006_context_1_-2.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 1_-2 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B006_mask_1_-2.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B006_classes_1_-2.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B006_depth_1_-2.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

TASK - tile 1_-2
Edit B006_context_1_-2.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B006_mask_1_-2.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B006_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B006_classes_1_-2.png (legend: B006_classes_legend.png) for surface types and B006_depth_1_-2.png for building heights.
Paint this tile after 0_-2: where its border shows the underdrawing of 0_-2, match what you painted for that tile earlier in this conversation.

THIS TILE SHOWS
- Sage 5 (centre, around x=359, y=557): campus building - follow the reference wall colour for its material
- WCRI-Clayfield (lower left, around x=247, y=852): campus building - follow the reference wall colour for its material
- Ivytowns (right, around x=939, y=432): campus building - follow the reference wall colour for its material
- Fergus House (lower centre, around x=384, y=994): campus building - follow the reference wall colour for its material
- WCRI - Kershaw (lower left, around x=63, y=937): campus building - follow the reference wall colour for its material
- WCRI-Carver (lower left, around x=152, y=980): campus building - follow the reference wall colour for its material
- WCRI Fenwick (lower left, around x=21, y=719): campus building - follow the reference wall colour for its material
- Streets and paths crossing it: Hickory Street West, Lester Street, Albert Street, Sunview Street, Batavia Place, Hemlock Street

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B006_context_1_-2.png, named B006_1_-2.png. We cut the tile out ourselves.
- If you can't output 1536 x 1536: a larger image with exactly the same aspect ratio is fine; if 1024 x 1024 is your only size, return the same full canvas scaled to it. Never crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Message 4 - tile 2_-2

```text
Next tile (4 of 4): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B006_context_2_-2.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 2_-2 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B006_mask_2_-2.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B006_classes_2_-2.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B006_depth_2_-2.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

TASK - tile 2_-2
Edit B006_context_2_-2.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B006_mask_2_-2.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B006_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B006_classes_2_-2.png (legend: B006_classes_legend.png) for surface types and B006_depth_2_-2.png for building heights.
Paint this tile after 1_-2: where its border shows the underdrawing of 1_-2, match what you painted for that tile earlier in this conversation.

THIS TILE SHOWS
- Lazaridis Hall (upper right, around x=926, y=308): campus building - follow the reference wall colour for its material
- Frank C. Peters Building (lower right, around x=862, y=739): campus building - follow the reference wall colour for its material
- Sage 6 (centre, around x=372, y=394): campus building - follow the reference wall colour for its material
- Saint Michael's Catholic Church (right, around x=720, y=486): campus building - follow the reference wall colour for its material
- Schlegel Building (lower right, around x=983, y=809): campus building - follow the reference wall colour for its material
- V.I.P Student Housing (lower left, around x=132, y=983): campus building - follow the reference wall colour for its material
- Ivytowns (left, around x=28, y=507): campus building - follow the reference wall colour for its material
- Arts Building - C Wing (lower right, around x=1000, y=702): campus building - follow the reference wall colour for its material
- Chabad Lubavitch of the Waterloo Region (left, around x=86, y=577): campus building - follow the reference wall colour for its material
- Streets and paths crossing it: University Avenue West, Albert Street, Hemlock Street, Balsam Street, Sunview Street, Larch Street

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B006_context_2_-2.png, named B006_2_-2.png. We cut the tile out ourselves.
- If you can't output 1536 x 1536: a larger image with exactly the same aspect ratio is fine; if 1024 x 1024 is your only size, return the same full canvas scaled to it. Never crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Packet details (for reference - the agent does not need this section)

| File | Size | Purpose | Tiles | Defines composition | sha256 |
|---|---|---|---|---|---|
| `B006_style_0_0.png` | 1024x1024 | STYLE: finished, accepted artwork of neighbouring tile 0_0 - match its palette, pixel size, outlines, windows, trees and light exactly | 0_0 | no | `bfd18a94f0c7` |
| `B006_contact_sheet.png` | 2048x1592 | CONTEXT ONLY: surrounding tiles at half scale, requested tile(s) outlined in red, landmark labels | -1_-1, -1_-2, 0_-1, 0_-2, 0_0, 1_-1, 1_-2, 2_-1, 2_-2 | no | `2fc288e5cfd6` |
| `B006_context_-1_-2.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile -1_-2 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | -1_-2 | yes | `d5ee79c8a39a` |
| `B006_mask_-1_-2.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | -1_-2 | no | `f7c578357610` |
| `B006_classes_-1_-2.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | -1_-2 | no | `186677a3f2b4` |
| `B006_depth_-1_-2.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | -1_-2 | no | `e9ae377c5483` |
| `B006_context_0_-2.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 0_-2 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 0_-2 | yes | `17f30a56c02c` |
| `B006_mask_0_-2.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 0_-2 | no | `c13b6cce3968` |
| `B006_classes_0_-2.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 0_-2 | no | `b3b71297d7d1` |
| `B006_depth_0_-2.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 0_-2 | no | `c5567130ba9c` |
| `B006_context_1_-2.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 1_-2 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 1_-2 | yes | `19dcba70c37e` |
| `B006_mask_1_-2.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 1_-2 | no | `c13b6cce3968` |
| `B006_classes_1_-2.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 1_-2 | no | `78e024e29607` |
| `B006_depth_1_-2.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 1_-2 | no | `a575a42672d0` |
| `B006_context_2_-2.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 2_-2 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 2_-2 | yes | `44db3d7d1554` |
| `B006_mask_2_-2.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 2_-2 | no | `c1d9344d6b67` |
| `B006_classes_2_-2.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 2_-2 | no | `eaf4273c2ef6` |
| `B006_depth_2_-2.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 2_-2 | no | `d4645c72f38d` |
| `B006_classes_legend.png` | 760x584 | LEGEND for the semantic maps | -1_-2, 0_-2, 1_-2, 2_-2 | no | `092cf312c8f0` |

| Return file | Item | Expected size | Crop in returned image (x0, y0, x1, y1) | Becomes |
|---|---|---|---|---|
| `B006_-1_-2.png` | -1_-2 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/-1_-2.png` (1024x1024) |
| `B006_0_-2.png` | 0_-2 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/0_-2.png` (1024x1024) |
| `B006_1_-2.png` | 1_-2 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/1_-2.png` (1024x1024) |
| `B006_2_-2.png` | 2_-2 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/2_-2.png` (1024x1024) |

**Crop math (context edit).** Context canvas = 1536x1536 canvas px at 1:1, origin at canvas px (tile_x*1024 - 256, tile_y*1024 - 256). For a returned image W x H with W/H = 1536/1536 (within 1 %), k = W/1536; the tile is the box (256k, 256k, 1280k, 1280k), resampled to 1024x1024 (box filter when k >= 1, Lanczos when k < 1). 1536x1536 -> crop (256, 256, 1280, 1280) exactly; a 2x image -> crop doubled, then box-halved. Fixed-size fallback 1024x1024: k = 0.6667, crop (170.67, 170.67, 853.33, 853.33) upscaled x1.50 (accepted with a reduced-detail warning). Agents limited to 1536x1024 or 1024x1536 get a native-scale packet instead: `build <batch> --frame wide` (margins left/right only, crop (256, 0, 1280, 1024)) or `--frame tall` (margins top/bottom only, crop (0, 256, 1024, 1280)). Joins that a frame has no margin for are repaired afterwards with seam packets (`art_request.py seam`).

**Camera and light.** Orthographic, heading 20.0 deg (camera looks NNE), pitch 45.0 deg, 0.29296875 m per artwork px. Sun azimuth 225.0 deg, elevation 50.0 deg: light from the lower left / behind the viewer, cast shadows toward the upper right. Tile (i, j) covers canvas px [i*1024, (i+1)*1024) x [j*1024, (j+1)*1024).

**QA on receipt** (`pipeline/art_import.py`, thresholds in docs/ART_PIPELINE.md): filename -> item match; decode; size / aspect; global translation by phase correlation of edge maps (> 4 px fails); local displacement and scale/rotation from a block grid (camera change); geometry agreement of class-map boundaries with image edges (whole tile, 8x8 cells, every building roof, landmark roofs); sun/shadow side; colour style against accepted tiles; seam discontinuity in a 4 px band against accepted neighbours; for context edits, drift of the kept margin.
