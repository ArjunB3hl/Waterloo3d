# Image request B009 - Silver Lake, Perimeter Institute and Waterloo Park south - tiles 4_-1, 4_0, 3_1

Packet revision 1, built 2026-11-04T20:15:58Z. Status: `requested`.

## What to do (for the user)

Everything is in `art/requests/B009/` (also zipped as `art/requests/B009.zip`). Start a **new conversation** with the image agent.

1. **Message 1** (tile 4_-1): attach these 7 files, then paste the text of "Message 1" below.

   - `B009_context_4_-1.png`
   - `B009_mask_4_-1.png`
   - `B009_classes_4_-1.png`
   - `B009_depth_4_-1.png`
   - `B009_style_0_0.png`
   - `B009_contact_sheet.png`
   - `B009_classes_legend.png`

   Wait for the image before sending the next message.

2. **Message 2** (tile 4_0): attach these 4 files, then paste the text of "Message 2" below.

   - `B009_context_4_0.png`
   - `B009_mask_4_0.png`
   - `B009_classes_4_0.png`
   - `B009_depth_4_0.png`

   Wait for the image before sending the next message.

3. **Message 3** (tile 3_1): attach these 4 files, then paste the text of "Message 3" below.

   - `B009_context_3_1.png`
   - `B009_mask_3_1.png`
   - `B009_classes_3_1.png`
   - `B009_depth_3_1.png`

4. Save what comes back in one folder (e.g. `~/Downloads/B009/`) with exactly these names: `B009_4_-1.png`, `B009_4_0.png`, `B009_3_1.png`. Copy the agent's note about model and settings into `B009_report.txt` in the same folder.

5. Check it: `python3 pipeline/art_import.py B009 ~/Downloads/B009` (QA report only), then `python3 pipeline/art_import.py B009 ~/Downloads/B009 --accept` to accept tiles that pass.

Total: 15 attachment files, 3 image(s) to bring back.

## Message 1 - tile 4_-1

```text
I'm making "Tiny Waterloo", an illustrated pixel-art map of Waterloo, Ontario (Canada) built from square tiles that join edge to edge. Please paint the image described below from the attached reference images. This conversation covers 3 tiles; this is tile 1 of 3 - I will send the others one at a time with the same rules.

ATTACHED FILES
- B009_context_4_-1.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 4_-1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B009_mask_4_-1.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B009_classes_4_-1.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B009_depth_4_-1.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more
- B009_style_0_0.png (1024x1024) - STYLE: finished, accepted artwork of neighbouring tile 0_0 - match its palette, pixel size, outlines, windows, trees and light exactly
- B009_contact_sheet.png (2560x1592) - CONTEXT ONLY: surrounding tiles at half scale, requested tile(s) outlined in red, landmark labels
- B009_classes_legend.png (760x824) - LEGEND for the semantic maps

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

TASK - tile 4_-1
Edit B009_context_4_-1.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B009_mask_4_-1.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B009_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B009_classes_4_-1.png (legend: B009_classes_legend.png) for surface types and B009_depth_4_-1.png for building heights.

THIS TILE SHOWS
- MacGregor Public School (upper centre, around x=507, y=236): campus building - follow the reference wall colour for its material
- Streets and paths crossing it: Albert Street, Central Street, Spring Street West, Fountain Street, King Street North, Young Street West

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B009_context_4_-1.png, named B009_4_-1.png. We cut the tile out ourselves.
- If you can't output 1536 x 1536: a larger image with exactly the same aspect ratio is fine; if 1024 x 1024 is your only size, return the same full canvas scaled to it. Never crop, pad or change the aspect ratio.

WHAT TO SEND BACK
- The ORIGINAL generated image file(s) exactly as produced - full resolution, PNG preferred - not a screenshot, preview or re-compressed copy - named exactly as listed above.
- A short note with the model name and version you used and any settings you can disclose (e.g. seed, steps, guidance / strength, quality, output size, edit or inpaint mode, number of attempts). Write "unknown" for anything you can't tell.
```

## Message 2 - tile 4_0

```text
Next tile (2 of 3): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B009_context_4_0.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 4_0 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B009_mask_4_0.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B009_classes_4_0.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B009_depth_4_0.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

TASK - tile 4_0
Edit B009_context_4_0.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B009_mask_4_0.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B009_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B009_classes_4_0.png (legend: B009_classes_legend.png) for surface types and B009_depth_4_0.png for building heights.
Paint this tile after 4_-1: where its border shows the underdrawing of 4_-1, match what you painted for that tile earlier in this conversation.

THIS TILE SHOWS
- Perimeter Institute for Theoretical Physics (centre, around x=629, y=616): campus building - follow the reference wall colour for its material
- The Cooperage South (lower centre, around x=481, y=783): campus building - follow the reference wall colour for its material
- The Cooperage North (lower left, around x=241, y=791): campus building - follow the reference wall colour for its material
- The Staves (lower left, around x=251, y=979): campus building - follow the reference wall colour for its material
- The Onyx South (lower left, around x=47, y=906): campus building - follow the reference wall colour for its material
- The Cooperage (lower centre, around x=362, y=878): campus building - follow the reference wall colour for its material
- Streets and paths crossing it: Father David Bauer Drive, Laurel Trail, Caroline Street North, Barrel Yards Boulevard, Merchant Avenue, Young Street West

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B009_context_4_0.png, named B009_4_0.png. We cut the tile out ourselves.
- If you can't output 1536 x 1536: a larger image with exactly the same aspect ratio is fine; if 1024 x 1024 is your only size, return the same full canvas scaled to it. Never crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Message 3 - tile 3_1

```text
Next tile (3 of 3): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B009_context_3_1.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 3_1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B009_mask_3_1.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B009_classes_3_1.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B009_depth_3_1.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

TASK - tile 3_1
Edit B009_context_3_1.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B009_mask_3_1.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B009_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B009_classes_3_1.png (legend: B009_classes_legend.png) for surface types and B009_depth_3_1.png for building heights.

THIS TILE SHOWS
- Waterloo Heights Apartments (lower centre, around x=586, y=831): campus building - follow the reference wall colour for its material
- Community Pavilion (upper centre, around x=342, y=333): campus building - follow the reference wall colour for its material
- The Onyx (upper right, around x=949, y=42): campus building - follow the reference wall colour for its material
- Streets and paths crossing it: Sunshine Avenue, Father David Bauer Drive, Beverley Avenue North, Avondale Avenue North, Dunbar Road North, Erb Street West

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B009_context_3_1.png, named B009_3_1.png. We cut the tile out ourselves.
- If you can't output 1536 x 1536: a larger image with exactly the same aspect ratio is fine; if 1024 x 1024 is your only size, return the same full canvas scaled to it. Never crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Packet details (for reference - the agent does not need this section)

| File | Size | Purpose | Tiles | Defines composition | sha256 |
|---|---|---|---|---|---|
| `B009_style_0_0.png` | 1024x1024 | STYLE: finished, accepted artwork of neighbouring tile 0_0 - match its palette, pixel size, outlines, windows, trees and light exactly | 0_0 | no | `bfd18a94f0c7` |
| `B009_contact_sheet.png` | 2560x1592 | CONTEXT ONLY: surrounding tiles at half scale, requested tile(s) outlined in red, landmark labels | 0_0, 2_1, 3_-1, 3_0, 3_1, 4_-1, 4_0 | no | `4fc40e1130d6` |
| `B009_context_4_-1.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 4_-1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 4_-1 | yes | `680dd0fdd840` |
| `B009_mask_4_-1.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 4_-1 | no | `46fa38d1d704` |
| `B009_classes_4_-1.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 4_-1 | no | `d0135ccaa9b2` |
| `B009_depth_4_-1.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 4_-1 | no | `07acedff3199` |
| `B009_context_4_0.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 4_0 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 4_0 | yes | `c009b71da66c` |
| `B009_mask_4_0.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 4_0 | no | `4aa71b138e65` |
| `B009_classes_4_0.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 4_0 | no | `5bbf943fa6ac` |
| `B009_depth_4_0.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 4_0 | no | `d1e76e0f2a34` |
| `B009_context_3_1.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 3_1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 3_1 | yes | `030e073db688` |
| `B009_mask_3_1.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 3_1 | no | `6ccc61cc7d7b` |
| `B009_classes_3_1.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 3_1 | no | `633250f7cd27` |
| `B009_depth_3_1.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 3_1 | no | `9eea53854307` |
| `B009_classes_legend.png` | 760x824 | LEGEND for the semantic maps | 4_-1, 4_0, 3_1 | no | `1eff77afa7ef` |

| Return file | Item | Expected size | Crop in returned image (x0, y0, x1, y1) | Becomes |
|---|---|---|---|---|
| `B009_4_-1.png` | 4_-1 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/4_-1.png` (1024x1024) |
| `B009_4_0.png` | 4_0 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/4_0.png` (1024x1024) |
| `B009_3_1.png` | 3_1 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/3_1.png` (1024x1024) |

**Crop math (context edit).** Context canvas = 1536x1536 canvas px at 1:1, origin at canvas px (tile_x*1024 - 256, tile_y*1024 - 256). For a returned image W x H with W/H = 1536/1536 (within 1 %), k = W/1536; the tile is the box (256k, 256k, 1280k, 1280k), resampled to 1024x1024 (box filter when k >= 1, Lanczos when k < 1). 1536x1536 -> crop (256, 256, 1280, 1280) exactly; a 2x image -> crop doubled, then box-halved. Fixed-size fallback 1024x1024: k = 0.6667, crop (170.67, 170.67, 853.33, 853.33) upscaled x1.50 (accepted with a reduced-detail warning). Agents limited to 1536x1024 or 1024x1536 get a native-scale packet instead: `build <batch> --frame wide` (margins left/right only, crop (256, 0, 1280, 1024)) or `--frame tall` (margins top/bottom only, crop (0, 256, 1024, 1280)). Joins that a frame has no margin for are repaired afterwards with seam packets (`art_request.py seam`).

**Camera and light.** Orthographic, heading 20.0 deg (camera looks NNE), pitch 45.0 deg, 0.29296875 m per artwork px. Sun azimuth 225.0 deg, elevation 50.0 deg: light from the lower left / behind the viewer, cast shadows toward the upper right. Tile (i, j) covers canvas px [i*1024, (i+1)*1024) x [j*1024, (j+1)*1024).

**QA on receipt** (`pipeline/art_import.py`, thresholds in docs/ART_PIPELINE.md): filename -> item match; decode; size / aspect; global translation by phase correlation of edge maps (> 4 px fails); local displacement and scale/rotation from a block grid (camera change); geometry agreement of class-map boundaries with image edges (whole tile, 8x8 cells, every building roof, landmark roofs); sun/shadow side; colour style against accepted tiles; seam discontinuity in a 4 px band against accepted neighbours; for context edits, drift of the kept margin.
