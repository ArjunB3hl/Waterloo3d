# Image request B013 - Uptown core: Waterloo Public Library, Public Square, King St - tiles 4_1, 5_-1, 5_0, 6_-1, 6_0

> **DRAFT - do not send yet.** Waiting for tiles from B009 (3_1, 4_-1, 4_0) to be accepted. This packet is rebuilt
> automatically when `art_import.py <batch> --accept` accepts the last of them (or run `python3 pipeline/art_request.py build B013`);
> the current files are placeholders - do not attach them.

Packet revision 2, built 2026-11-04T20:53:39Z. Status: `draft`.

## What to do (for the user)

Everything is in `art/requests/B013/` (also zipped as `art/requests/B013.zip`). Start a **new conversation** with the image agent.

1. **Message 1** (tile 4_1): attach these 7 files, then paste the text of "Message 1" below.

   - `B013_context_4_1.png`
   - `B013_mask_4_1.png`
   - `B013_classes_4_1.png`
   - `B013_depth_4_1.png`
   - `B013_style_0_0.png`
   - `B013_contact_sheet.png`
   - `B013_classes_legend.png`

   Wait for the image before sending the next message.

2. **Message 2** (tile 5_-1): attach these 4 files, then paste the text of "Message 2" below.

   - `B013_context_5_-1.png`
   - `B013_mask_5_-1.png`
   - `B013_classes_5_-1.png`
   - `B013_depth_5_-1.png`

   Wait for the image before sending the next message.

3. **Message 3** (tile 5_0): attach these 4 files, then paste the text of "Message 3" below.

   - `B013_context_5_0.png`
   - `B013_mask_5_0.png`
   - `B013_classes_5_0.png`
   - `B013_depth_5_0.png`

   Wait for the image before sending the next message.

4. **Message 4** (tile 6_-1): attach these 4 files, then paste the text of "Message 4" below.

   - `B013_context_6_-1.png`
   - `B013_mask_6_-1.png`
   - `B013_classes_6_-1.png`
   - `B013_depth_6_-1.png`

   Wait for the image before sending the next message.

5. **Message 5** (tile 6_0): attach these 4 files, then paste the text of "Message 5" below.

   - `B013_context_6_0.png`
   - `B013_mask_6_0.png`
   - `B013_classes_6_0.png`
   - `B013_depth_6_0.png`

6. Save what comes back in one folder (e.g. `~/Downloads/B013/`) with exactly these names: `B013_4_1.png`, `B013_5_-1.png`, `B013_5_0.png`, `B013_6_-1.png`, `B013_6_0.png`. Copy the agent's note about model and settings into `B013_report.txt` in the same folder.

7. Check it: `python3 pipeline/art_import.py B013 ~/Downloads/B013` (QA report only), then `python3 pipeline/art_import.py B013 ~/Downloads/B013 --accept` to accept tiles that pass.

Total: 23 attachment files, 5 image(s) to bring back.

## Message 1 - tile 4_1

```text
I'm making "Tiny Waterloo", an illustrated pixel-art map of Waterloo, Ontario (Canada) built from square tiles that join edge to edge. Please paint the image described below from the attached reference images. This conversation covers 5 tiles; this is tile 1 of 5 - I will send the others one at a time with the same rules.

ATTACHED FILES
- B013_context_4_1.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 4_1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B013_mask_4_1.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B013_classes_4_1.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B013_depth_4_1.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more
- B013_style_0_0.png (1024x1024) - STYLE: finished, accepted artwork of neighbouring tile 0_0 - match its palette, pixel size, outlines, windows, trees and light exactly
- B013_contact_sheet.png (2048x1592) - CONTEXT ONLY: surrounding tiles at half scale, requested tile(s) outlined in red, landmark labels
- B013_classes_legend.png (760x784) - LEGEND for the semantic maps

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: B013_context_4_1.png, B013_mask_4_1.png, B013_classes_4_1.png, B013_depth_4_1.png, B013_style_0_0.png. Read B013_contact_sheet.png and B013_classes_legend.png yourself and do not pass them to the tool.

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

TASK - tile 4_1
Edit B013_context_4_1.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B013_mask_4_1.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B013_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B013_classes_4_1.png (legend: B013_classes_legend.png) for surface types and B013_depth_4_1.png for building heights.

THIS TILE SHOWS
- The Bevel (upper centre, around x=431, y=128): building - follow the reference wall colour for its material
- Delta Waterloo (upper right, around x=711, y=91): building - follow the reference wall colour for its material
- Erb Street Mennonite (centre, around x=430, y=639): building - follow the reference wall colour for its material
- Archibald Automotive (lower left, around x=93, y=933): building - follow the reference wall colour for its material
- Streets and paths crossing it: Erb Street West, Dunbar Road South, Dawson Street, Avondale Avenue South, Avondale Avenue North, Merchant Avenue

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B013_context_4_1.png, named B013_4_1.png. We cut the tile out ourselves.
- Any square size of 1024 px or more is fine - e.g. if your tool returns 1254 x 1254, send that file unchanged; we scale it ourselves. Never upscale, crop, pad or change the aspect ratio.

WHAT TO SEND BACK
- The ORIGINAL generated image file(s) exactly as produced - full resolution, PNG preferred - not a screenshot, preview or re-compressed copy - named exactly as listed above.
- A short note with the model name and version you used and any settings you can disclose (e.g. seed, steps, guidance / strength, quality, output size, edit or inpaint mode, number of attempts). Write "unknown" for anything you can't tell.
```

## Message 2 - tile 5_-1

```text
Next tile (2 of 5): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B013_context_5_-1.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 5_-1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B013_mask_5_-1.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B013_classes_5_-1.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B013_depth_5_-1.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: B013_context_5_-1.png, B013_mask_5_-1.png, B013_classes_5_-1.png, B013_depth_5_-1.png, B013_style_0_0.png (for tiles after the first you may swap the style file for your own previous output of the neighbouring tile).

TASK - tile 5_-1
Edit B013_context_5_-1.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B013_mask_5_-1.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B013_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B013_classes_5_-1.png (legend: B013_classes_legend.png) for surface types and B013_depth_5_-1.png for building heights.

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
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B013_context_5_-1.png, named B013_5_-1.png. We cut the tile out ourselves.
- Any square size of 1024 px or more is fine - e.g. if your tool returns 1254 x 1254, send that file unchanged; we scale it ourselves. Never upscale, crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Message 3 - tile 5_0

```text
Next tile (3 of 5): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B013_context_5_0.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 5_0 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B013_mask_5_0.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B013_classes_5_0.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B013_depth_5_0.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: B013_context_5_0.png, B013_mask_5_0.png, B013_classes_5_0.png, B013_depth_5_0.png, B013_style_0_0.png (for tiles after the first you may swap the style file for your own previous output of the neighbouring tile).

TASK - tile 5_0
Edit B013_context_5_0.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B013_mask_5_0.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B013_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B013_classes_5_0.png (legend: B013_classes_legend.png) for surface types and B013_depth_5_0.png for building heights.
Paint this tile after 5_-1: where its border shows the underdrawing of 5_-1, match what you painted for that tile earlier in this conversation.

THIS TILE SHOWS
- Waterloo Public Library - Main (upper left, around x=335, y=271): building - follow the reference wall colour for its material
- The Shops at Waterloo Town Square (lower right, around x=892, y=818): building - follow the reference wall colour for its material
- CIGI Campus (lower left, around x=341, y=939): building - follow the reference wall colour for its material
- RideCo (lower centre, around x=448, y=812): building - follow the reference wall colour for its material
- Knox Presbyterian Church (centre, around x=355, y=583): building - follow the reference wall colour for its material
- Canadian Clay and Glass Gallery (left, around x=50, y=642): building - follow the reference wall colour for its material
- Market Hotel (upper centre, around x=603, y=140): building - follow the reference wall colour for its material
- Marsland Centre (upper centre, around x=610, y=315): building - follow the reference wall colour for its material
- The Atrium (right, around x=716, y=529): building - follow the reference wall colour for its material
- Streets and paths crossing it: Albert Street, King Street North, Erb Street West, Dupont Street West, Erb Street East, Caroline Street South

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B013_context_5_0.png, named B013_5_0.png. We cut the tile out ourselves.
- Any square size of 1024 px or more is fine - e.g. if your tool returns 1254 x 1254, send that file unchanged; we scale it ourselves. Never upscale, crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Message 4 - tile 6_-1

```text
Next tile (4 of 5): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B013_context_6_-1.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 6_-1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B013_mask_6_-1.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B013_classes_6_-1.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B013_depth_6_-1.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: B013_context_6_-1.png, B013_mask_6_-1.png, B013_classes_6_-1.png, B013_depth_6_-1.png, B013_style_0_0.png (for tiles after the first you may swap the style file for your own previous output of the neighbouring tile).

TASK - tile 6_-1
Edit B013_context_6_-1.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B013_mask_6_-1.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B013_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B013_classes_6_-1.png (legend: B013_classes_legend.png) for surface types and B013_depth_6_-1.png for building heights.
Paint this tile after 5_-1: where its border shows the underdrawing of 5_-1, match what you painted for that tile earlier in this conversation.

THIS TILE SHOWS
- Kindred Credit Union (centre, around x=501, y=510): building - follow the reference wall colour for its material
- Canon (lower left, around x=35, y=994): building - follow the reference wall colour for its material
- Streets and paths crossing it: Peppler Street, Laurel Trail, Bridgeport Road East, Laurel Street, Dupont Street East, Princess Street East

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B013_context_6_-1.png, named B013_6_-1.png. We cut the tile out ourselves.
- Any square size of 1024 px or more is fine - e.g. if your tool returns 1254 x 1254, send that file unchanged; we scale it ourselves. Never upscale, crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Message 5 - tile 6_0

```text
Next tile (5 of 5): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B013_context_6_0.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 6_0 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B013_mask_6_0.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B013_classes_6_0.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B013_depth_6_0.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: B013_context_6_0.png, B013_mask_6_0.png, B013_classes_6_0.png, B013_depth_6_0.png, B013_style_0_0.png (for tiles after the first you may swap the style file for your own previous output of the neighbouring tile).

TASK - tile 6_0
Edit B013_context_6_0.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B013_mask_6_0.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B013_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B013_classes_6_0.png (legend: B013_classes_legend.png) for surface types and B013_depth_6_0.png for building heights.
Paint this tile after 5_0 and 6_-1: where its border shows the underdrawing of 5_0 / 6_-1, match what you painted for those tiles earlier in this conversation.

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
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B013_context_6_0.png, named B013_6_0.png. We cut the tile out ourselves.
- Any square size of 1024 px or more is fine - e.g. if your tool returns 1254 x 1254, send that file unchanged; we scale it ourselves. Never upscale, crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Packet details (for reference - the agent does not need this section)

| File | Size | Purpose | Tiles | Defines composition | sha256 |
|---|---|---|---|---|---|
| `B013_style_0_0.png` | 1024x1024 | STYLE: finished, accepted artwork of neighbouring tile 0_0 - match its palette, pixel size, outlines, windows, trees and light exactly | 0_0 | no | `bfd18a94f0c7` |
| `B013_contact_sheet.png` | 2048x1592 | CONTEXT ONLY: surrounding tiles at half scale, requested tile(s) outlined in red, landmark labels | 3_1, 4_-1, 4_0, 4_1, 5_-1, 5_0, 6_-1, 6_0 | no | `d8f5f672e438` |
| `B013_context_4_1.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 4_1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 4_1 | yes | `14eb029d35c2` |
| `B013_mask_4_1.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 4_1 | no | `2531215eb04a` |
| `B013_classes_4_1.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 4_1 | no | `6ee99efb1c42` |
| `B013_depth_4_1.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 4_1 | no | `65446d606a66` |
| `B013_context_5_-1.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 5_-1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 5_-1 | yes | `7a2d18a5ef58` |
| `B013_mask_5_-1.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 5_-1 | no | `cd2249b035c0` |
| `B013_classes_5_-1.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 5_-1 | no | `2edd83a1e0e3` |
| `B013_depth_5_-1.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 5_-1 | no | `435e205ad5ef` |
| `B013_context_5_0.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 5_0 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 5_0 | yes | `ba0cc13dacc5` |
| `B013_mask_5_0.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 5_0 | no | `cd2249b035c0` |
| `B013_classes_5_0.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 5_0 | no | `a91f85b41520` |
| `B013_depth_5_0.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 5_0 | no | `d169d16dfb91` |
| `B013_context_6_-1.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 6_-1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 6_-1 | yes | `455a7531294c` |
| `B013_mask_6_-1.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 6_-1 | no | `cd2249b035c0` |
| `B013_classes_6_-1.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 6_-1 | no | `3f79809f74c6` |
| `B013_depth_6_-1.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 6_-1 | no | `97c0ffcb100b` |
| `B013_context_6_0.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 6_0 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 6_0 | yes | `27f2fde0b84b` |
| `B013_mask_6_0.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 6_0 | no | `cd2249b035c0` |
| `B013_classes_6_0.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 6_0 | no | `c23cb218b297` |
| `B013_depth_6_0.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 6_0 | no | `5d93e2091315` |
| `B013_classes_legend.png` | 760x784 | LEGEND for the semantic maps | 4_1, 5_-1, 5_0, 6_-1, 6_0 | no | `44f8972580c7` |

| Return file | Item | Expected size | Crop in returned image (x0, y0, x1, y1) | Becomes |
|---|---|---|---|---|
| `B013_4_1.png` | 4_1 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/4_1.png` (1024x1024) |
| `B013_5_-1.png` | 5_-1 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/5_-1.png` (1024x1024) |
| `B013_5_0.png` | 5_0 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/5_0.png` (1024x1024) |
| `B013_6_-1.png` | 6_-1 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/6_-1.png` (1024x1024) |
| `B013_6_0.png` | 6_0 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/6_0.png` (1024x1024) |

**Crop math (context edit).** Context canvas = 1536x1536 canvas px at 1:1, origin at canvas px (tile_x*1024 - 256, tile_y*1024 - 256). For a returned image W x H with W/H = 1536/1536 (within 1 %), k = W/1536; the tile is the box (256k, 256k, 1280k, 1280k), resampled to 1024x1024 (box filter when k >= 1, Lanczos when k < 1). 1536x1536 -> crop (256, 256, 1280, 1280) exactly; a 2x image -> crop doubled, then box-halved. Fixed-size fallback 1024x1024: k = 0.6667, crop (170.67, 170.67, 853.33, 853.33) upscaled x1.50 (accepted with a reduced-detail warning). Agents limited to 1536x1024 or 1024x1536 get a native-scale packet instead: `build <batch> --frame wide` (margins left/right only, crop (256, 0, 1280, 1024)) or `--frame tall` (margins top/bottom only, crop (0, 256, 1024, 1280)). Joins that a frame has no margin for are repaired afterwards with seam packets (`art_request.py seam`).

**Camera and light.** Orthographic, heading 20.0 deg (camera looks NNE), pitch 45.0 deg, 0.29296875 m per artwork px. Sun azimuth 225.0 deg, elevation 50.0 deg: light from the lower left / behind the viewer, cast shadows toward the upper right. Tile (i, j) covers canvas px [i*1024, (i+1)*1024) x [j*1024, (j+1)*1024).

**QA on receipt** (`pipeline/art_import.py`, thresholds in docs/ART_PIPELINE.md): filename -> item match; decode; size / aspect; global translation by phase correlation of edge maps (> 4 px fails); local displacement and scale/rotation from a block grid (camera change); geometry agreement of class-map boundaries with image edges (whole tile, 8x8 cells, every building roof, landmark roofs); sun/shadow side; colour style against accepted tiles; seam discontinuity in a 4 px band against accepted neighbours; for context edits, drift of the kept margin.
