# Image request B014 - North-east of Laurier - tiles 4_-2, 3_-3, 4_-3

> **DRAFT - do not send yet.** Waiting for tiles from B009 (4_-1); B010 (2_-3); B011 (3_-2) to be accepted. This packet is rebuilt
> automatically when `art_import.py <batch> --accept` accepts the last of them (or run `python3 pipeline/art_request.py build B014`);
> the current files are placeholders - do not attach them.

Packet revision 2, built 2026-11-04T20:53:53Z. Status: `draft`.

## What to do (for the user)

Everything is in `art/requests/B014/` (also zipped as `art/requests/B014.zip`). Start a **new conversation** with the image agent.

1. **Message 1** (tile 4_-2): attach these 7 files, then paste the text of "Message 1" below.

   - `B014_context_4_-2.png`
   - `B014_mask_4_-2.png`
   - `B014_classes_4_-2.png`
   - `B014_depth_4_-2.png`
   - `B014_style_0_0.png`
   - `B014_contact_sheet.png`
   - `B014_classes_legend.png`

   Wait for the image before sending the next message.

2. **Message 2** (tile 3_-3): attach these 4 files, then paste the text of "Message 2" below.

   - `B014_context_3_-3.png`
   - `B014_mask_3_-3.png`
   - `B014_classes_3_-3.png`
   - `B014_depth_3_-3.png`

   Wait for the image before sending the next message.

3. **Message 3** (tile 4_-3): attach these 4 files, then paste the text of "Message 3" below.

   - `B014_context_4_-3.png`
   - `B014_mask_4_-3.png`
   - `B014_classes_4_-3.png`
   - `B014_depth_4_-3.png`

4. Save what comes back in one folder (e.g. `~/Downloads/B014/`) with exactly these names: `B014_4_-2.png`, `B014_3_-3.png`, `B014_4_-3.png`. Copy the agent's note about model and settings into `B014_report.txt` in the same folder.

5. Check it: `python3 pipeline/art_import.py B014 ~/Downloads/B014` (QA report only), then `python3 pipeline/art_import.py B014 ~/Downloads/B014 --accept` to accept tiles that pass.

Total: 15 attachment files, 3 image(s) to bring back.

## Message 1 - tile 4_-2

```text
I'm making "Tiny Waterloo", an illustrated pixel-art map of Waterloo, Ontario (Canada) built from square tiles that join edge to edge. Please paint the image described below from the attached reference images. This conversation covers 3 tiles; this is tile 1 of 3 - I will send the others one at a time with the same rules.

ATTACHED FILES
- B014_context_4_-2.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 4_-2 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B014_mask_4_-2.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B014_classes_4_-2.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B014_depth_4_-2.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more
- B014_style_0_0.png (1024x1024) - STYLE: finished, accepted artwork of neighbouring tile 0_0 - match its palette, pixel size, outlines, windows, trees and light exactly
- B014_contact_sheet.png (1536x1592) - CONTEXT ONLY: surrounding tiles at half scale, requested tile(s) outlined in red, landmark labels
- B014_classes_legend.png (760x664) - LEGEND for the semantic maps

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: B014_context_4_-2.png, B014_mask_4_-2.png, B014_classes_4_-2.png, B014_depth_4_-2.png, B014_style_0_0.png. Read B014_contact_sheet.png and B014_classes_legend.png yourself and do not pass them to the tool.

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

TASK - tile 4_-2
Edit B014_context_4_-2.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B014_mask_4_-2.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B014_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B014_classes_4_-2.png (legend: B014_classes_legend.png) for surface types and B014_depth_4_-2.png for building heights.

THIS TILE SHOWS
- Science Building (left, around x=242, y=486): building - follow the reference wall colour for its material
- Vogue (lower right, around x=701, y=786): building - follow the reference wall colour for its material
- King Street Residence (upper centre, around x=386, y=97): building - follow the reference wall colour for its material
- Univeristy View (centre, around x=481, y=673): building - follow the reference wall colour for its material
- Bricker Academic Building (left, around x=51, y=682): building - follow the reference wall colour for its material
- Science Research Building (left, around x=110, y=594): building - follow the reference wall colour for its material
- Co-operative Education and Career Development Centre (upper centre, around x=460, y=278): building - follow the reference wall colour for its material
- 202 Regina Street North (upper right, around x=778, y=19): building - follow the reference wall colour for its material
- Athletics Complex (upper left, around x=26, y=50): building - follow the reference wall colour for its material
- Streets and paths crossing it: King Street North, Lodge Street, Bricker Avenue, Regina Street North, Ezra Avenue, Marshall Street

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B014_context_4_-2.png, named B014_4_-2.png. We cut the tile out ourselves.
- Any square size of 1024 px or more is fine - e.g. if your tool returns 1254 x 1254, send that file unchanged; we scale it ourselves. Never upscale, crop, pad or change the aspect ratio.

WHAT TO SEND BACK
- The ORIGINAL generated image file(s) exactly as produced - full resolution, PNG preferred - not a screenshot, preview or re-compressed copy - named exactly as listed above.
- A short note with the model name and version you used and any settings you can disclose (e.g. seed, steps, guidance / strength, quality, output size, edit or inpaint mode, number of attempts). Write "unknown" for anything you can't tell.
```

## Message 2 - tile 3_-3

```text
Next tile (2 of 3): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B014_context_3_-3.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 3_-3 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B014_mask_3_-3.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B014_classes_3_-3.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B014_depth_3_-3.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: B014_context_3_-3.png, B014_mask_3_-3.png, B014_classes_3_-3.png, B014_depth_3_-3.png, B014_style_0_0.png (for tiles after the first you may swap the style file for your own previous output of the neighbouring tile).

TASK - tile 3_-3
Edit B014_context_3_-3.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B014_mask_3_-3.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B014_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B014_classes_3_-3.png (legend: B014_classes_legend.png) for surface types and B014_depth_3_-3.png for building heights.

THIS TILE SHOWS
- 308 King (upper right, around x=711, y=48): building - follow the reference wall colour for its material
- University Commons (centre, around x=637, y=552): building - follow the reference wall colour for its material
- Sage II (upper left, around x=235, y=56): building - follow the reference wall colour for its material
- Sage Condos I (upper centre, around x=367, y=278): building - follow the reference wall colour for its material
- Athletics Complex (lower right, around x=926, y=997): building - follow the reference wall colour for its material
- Preston House (upper centre, around x=365, y=33): building - follow the reference wall colour for its material
- BMO (centre, around x=571, y=416): building - follow the reference wall colour for its material
- Morty's Pub (right, around x=796, y=389): building - follow the reference wall colour for its material
- Perfect Image Studio (right, around x=1001, y=648): building - follow the reference wall colour for its material
- Streets and paths crossing it: King Street North, Fir Street, Hickory Street West, Maple Court, State Court, Spruce Street

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B014_context_3_-3.png, named B014_3_-3.png. We cut the tile out ourselves.
- Any square size of 1024 px or more is fine - e.g. if your tool returns 1254 x 1254, send that file unchanged; we scale it ourselves. Never upscale, crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Message 3 - tile 4_-3

```text
Next tile (3 of 3): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B014_context_4_-3.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 4_-3 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B014_mask_4_-3.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B014_classes_4_-3.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B014_depth_4_-3.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: B014_context_4_-3.png, B014_mask_4_-3.png, B014_classes_4_-3.png, B014_depth_4_-3.png, B014_style_0_0.png (for tiles after the first you may swap the style file for your own previous output of the neighbouring tile).

TASK - tile 4_-3
Edit B014_context_4_-3.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B014_mask_4_-3.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B014_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B014_classes_4_-3.png (legend: B014_classes_legend.png) for surface types and B014_depth_4_-3.png for building heights.
Paint this tile after 3_-3 and 4_-2: where its border shows the underdrawing of 3_-3 / 4_-2, match what you painted for those tiles earlier in this conversation.

THIS TILE SHOWS
- Alumni Educational Services (lower right, around x=699, y=868): building - follow the reference wall colour for its material
- 202 Regina Street North (lower right, around x=807, y=971): building - follow the reference wall colour for its material
- Richmond Square Tower 1 (upper left, around x=138, y=85): building - follow the reference wall colour for its material
- University Place Residence (upper centre, around x=500, y=169): building - follow the reference wall colour for its material
- Wilfrid Laurier University Special Constable Service (lower left, around x=221, y=947): building - follow the reference wall colour for its material
- Timbercreek Communities (upper left, around x=273, y=70): building - follow the reference wall colour for its material
- RBC Royal Bank (lower left, around x=80, y=804): building - follow the reference wall colour for its material
- Crabby Joe's Bar and Grill (upper right, around x=962, y=193): building - follow the reference wall colour for its material
- Tim Hortons (right, around x=744, y=370): building - follow the reference wall colour for its material
- Streets and paths crossing it: University Avenue East, Regina Street North, King Street North

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B014_context_4_-3.png, named B014_4_-3.png. We cut the tile out ourselves.
- Any square size of 1024 px or more is fine - e.g. if your tool returns 1254 x 1254, send that file unchanged; we scale it ourselves. Never upscale, crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Packet details (for reference - the agent does not need this section)

| File | Size | Purpose | Tiles | Defines composition | sha256 |
|---|---|---|---|---|---|
| `B014_style_0_0.png` | 1024x1024 | STYLE: finished, accepted artwork of neighbouring tile 0_0 - match its palette, pixel size, outlines, windows, trees and light exactly | 0_0 | no | `bfd18a94f0c7` |
| `B014_contact_sheet.png` | 1536x1592 | CONTEXT ONLY: surrounding tiles at half scale, requested tile(s) outlined in red, landmark labels | 2_-3, 3_-2, 3_-3, 4_-1, 4_-2, 4_-3 | no | `2c771e39adc1` |
| `B014_context_4_-2.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 4_-2 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 4_-2 | yes | `a5bb7e0f6f92` |
| `B014_mask_4_-2.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 4_-2 | no | `fbbd60c1fa3f` |
| `B014_classes_4_-2.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 4_-2 | no | `df6a9444e484` |
| `B014_depth_4_-2.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 4_-2 | no | `92ca639eca4a` |
| `B014_context_3_-3.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 3_-3 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 3_-3 | yes | `7e2ec49408c7` |
| `B014_mask_3_-3.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 3_-3 | no | `fbbd60c1fa3f` |
| `B014_classes_3_-3.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 3_-3 | no | `9004a72b1e9f` |
| `B014_depth_3_-3.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 3_-3 | no | `864d29b5e7e6` |
| `B014_context_4_-3.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 4_-3 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 4_-3 | yes | `447f9d95ab88` |
| `B014_mask_4_-3.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 4_-3 | no | `cd2249b035c0` |
| `B014_classes_4_-3.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 4_-3 | no | `2a7f3ff4bfa7` |
| `B014_depth_4_-3.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 4_-3 | no | `4682bc5b514e` |
| `B014_classes_legend.png` | 760x664 | LEGEND for the semantic maps | 4_-2, 3_-3, 4_-3 | no | `62f5363a73ef` |

| Return file | Item | Expected size | Crop in returned image (x0, y0, x1, y1) | Becomes |
|---|---|---|---|---|
| `B014_4_-2.png` | 4_-2 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/4_-2.png` (1024x1024) |
| `B014_3_-3.png` | 3_-3 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/3_-3.png` (1024x1024) |
| `B014_4_-3.png` | 4_-3 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/4_-3.png` (1024x1024) |

**Crop math (context edit).** Context canvas = 1536x1536 canvas px at 1:1, origin at canvas px (tile_x*1024 - 256, tile_y*1024 - 256). For a returned image W x H with W/H = 1536/1536 (within 1 %), k = W/1536; the tile is the box (256k, 256k, 1280k, 1280k), resampled to 1024x1024 (box filter when k >= 1, Lanczos when k < 1). 1536x1536 -> crop (256, 256, 1280, 1280) exactly; a 2x image -> crop doubled, then box-halved. Fixed-size fallback 1024x1024: k = 0.6667, crop (170.67, 170.67, 853.33, 853.33) upscaled x1.50 (accepted with a reduced-detail warning). Agents limited to 1536x1024 or 1024x1536 get a native-scale packet instead: `build <batch> --frame wide` (margins left/right only, crop (256, 0, 1280, 1024)) or `--frame tall` (margins top/bottom only, crop (0, 256, 1024, 1280)). Joins that a frame has no margin for are repaired afterwards with seam packets (`art_request.py seam`).

**Camera and light.** Orthographic, heading 20.0 deg (camera looks NNE), pitch 45.0 deg, 0.29296875 m per artwork px. Sun azimuth 225.0 deg, elevation 50.0 deg: light from the lower left / behind the viewer, cast shadows toward the upper right. Tile (i, j) covers canvas px [i*1024, (i+1)*1024) x [j*1024, (j+1)*1024).

**QA on receipt** (`pipeline/art_import.py`, thresholds in docs/ART_PIPELINE.md): filename -> item match; decode; size / aspect; global translation by phase correlation of edge maps (> 4 px fails); local displacement and scale/rotation from a block grid (camera change); geometry agreement of class-map boundaries with image edges (whole tile, 8x8 cells, every building roof, landmark roofs); sun/shadow side; colour style against accepted tiles; seam discontinuity in a 4 px band against accepted neighbours; for context edits, drift of the kept margin.
