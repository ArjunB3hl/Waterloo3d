# Image request B017 - North of Uptown - tiles 5_-2, 6_-2, 7_-2, 5_-3, 6_-3, 7_-3

> **DRAFT - do not send yet.** Waiting for tiles from B013 (5_-1, 6_-1); B014 (4_-2, 4_-3); B016 (7_-1) to be accepted. This packet is rebuilt
> automatically when `art_import.py <batch> --accept` accepts the last of them (or run `python3 pipeline/art_request.py build B017`);
> the current files are placeholders - do not attach them.

Packet revision 2, built 2026-11-04T20:54:52Z. Status: `draft`.

## What to do (for the user)

Everything is in `art/requests/B017/` (also zipped as `art/requests/B017.zip`). Start a **new conversation** with the image agent.

1. **Message 1** (tile 5_-2): attach these 7 files, then paste the text of "Message 1" below.

   - `B017_context_5_-2.png`
   - `B017_mask_5_-2.png`
   - `B017_classes_5_-2.png`
   - `B017_depth_5_-2.png`
   - `B017_style_0_0.png`
   - `B017_contact_sheet.png`
   - `B017_classes_legend.png`

   Wait for the image before sending the next message.

2. **Message 2** (tile 6_-2): attach these 4 files, then paste the text of "Message 2" below.

   - `B017_context_6_-2.png`
   - `B017_mask_6_-2.png`
   - `B017_classes_6_-2.png`
   - `B017_depth_6_-2.png`

   Wait for the image before sending the next message.

3. **Message 3** (tile 7_-2): attach these 4 files, then paste the text of "Message 3" below.

   - `B017_context_7_-2.png`
   - `B017_mask_7_-2.png`
   - `B017_classes_7_-2.png`
   - `B017_depth_7_-2.png`

   Wait for the image before sending the next message.

4. **Message 4** (tile 5_-3): attach these 4 files, then paste the text of "Message 4" below.

   - `B017_context_5_-3.png`
   - `B017_mask_5_-3.png`
   - `B017_classes_5_-3.png`
   - `B017_depth_5_-3.png`

   Wait for the image before sending the next message.

5. **Message 5** (tile 6_-3): attach these 4 files, then paste the text of "Message 5" below.

   - `B017_context_6_-3.png`
   - `B017_mask_6_-3.png`
   - `B017_classes_6_-3.png`
   - `B017_depth_6_-3.png`

   Wait for the image before sending the next message.

6. **Message 6** (tile 7_-3): attach these 4 files, then paste the text of "Message 6" below.

   - `B017_context_7_-3.png`
   - `B017_mask_7_-3.png`
   - `B017_classes_7_-3.png`
   - `B017_depth_7_-3.png`

7. Save what comes back in one folder (e.g. `~/Downloads/B017/`) with exactly these names: `B017_5_-2.png`, `B017_6_-2.png`, `B017_7_-2.png`, `B017_5_-3.png`, `B017_6_-3.png`, `B017_7_-3.png`. Copy the agent's note about model and settings into `B017_report.txt` in the same folder.

8. Check it: `python3 pipeline/art_import.py B017 ~/Downloads/B017` (QA report only), then `python3 pipeline/art_import.py B017 ~/Downloads/B017 --accept` to accept tiles that pass.

Total: 27 attachment files, 6 image(s) to bring back.

## Message 1 - tile 5_-2

```text
I'm making "Tiny Waterloo", an illustrated pixel-art map of Waterloo, Ontario (Canada) built from square tiles that join edge to edge. Please paint the image described below from the attached reference images. This conversation covers 6 tiles; this is tile 1 of 6 - I will send the others one at a time with the same rules.

ATTACHED FILES
- B017_context_5_-2.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 5_-2 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B017_mask_5_-2.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B017_classes_5_-2.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B017_depth_5_-2.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more
- B017_style_0_0.png (1024x1024) - STYLE: finished, accepted artwork of neighbouring tile 0_0 - match its palette, pixel size, outlines, windows, trees and light exactly
- B017_contact_sheet.png (2048x1592) - CONTEXT ONLY: surrounding tiles at half scale, requested tile(s) outlined in red, landmark labels
- B017_classes_legend.png (760x744) - LEGEND for the semantic maps

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: B017_context_5_-2.png, B017_mask_5_-2.png, B017_classes_5_-2.png, B017_depth_5_-2.png, B017_style_0_0.png. Read B017_contact_sheet.png and B017_classes_legend.png yourself and do not pass them to the tool.

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

TASK - tile 5_-2
Edit B017_context_5_-2.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B017_mask_5_-2.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B017_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B017_classes_5_-2.png (legend: B017_classes_legend.png) for surface types and B017_depth_5_-2.png for building heights.

THIS TILE SHOWS
- One28 (lower left, around x=69, y=992): building - follow the reference wall colour for its material
- Oddfellows Building (upper left, around x=85, y=20): building - follow the reference wall colour for its material
- Streets and paths crossing it: Noecker Street, Elgin Crescent, Brighton Street, Regina Street North, Marshall Street, Peppler Street

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B017_context_5_-2.png, named B017_5_-2.png. We cut the tile out ourselves.
- Any square size of 1024 px or more is fine - e.g. if your tool returns 1254 x 1254, send that file unchanged; we scale it ourselves. Never upscale, crop, pad or change the aspect ratio.

WHAT TO SEND BACK
- The ORIGINAL generated image file(s) exactly as produced - full resolution, PNG preferred - not a screenshot, preview or re-compressed copy - named exactly as listed above.
- A short note with the model name and version you used and any settings you can disclose (e.g. seed, steps, guidance / strength, quality, output size, edit or inpaint mode, number of attempts). Write "unknown" for anything you can't tell.
```

## Message 2 - tile 6_-2

```text
Next tile (2 of 6): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B017_context_6_-2.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 6_-2 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B017_mask_6_-2.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B017_classes_6_-2.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B017_depth_6_-2.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: B017_context_6_-2.png, B017_mask_6_-2.png, B017_classes_6_-2.png, B017_depth_6_-2.png, B017_style_0_0.png (for tiles after the first you may swap the style file for your own previous output of the neighbouring tile).

TASK - tile 6_-2
Edit B017_context_6_-2.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B017_mask_6_-2.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B017_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B017_classes_6_-2.png (legend: B017_classes_legend.png) for surface types and B017_depth_6_-2.png for building heights.
Paint this tile after 5_-2: where its border shows the underdrawing of 5_-2, match what you painted for that tile earlier in this conversation.

THIS TILE SHOWS
- Sobeys (right, around x=996, y=561): building - follow the reference wall colour for its material
- Streets and paths crossing it: Laurel Trail, Elgin Crescent, Brighton Street, Noecker Street, Weber Street North

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B017_context_6_-2.png, named B017_6_-2.png. We cut the tile out ourselves.
- Any square size of 1024 px or more is fine - e.g. if your tool returns 1254 x 1254, send that file unchanged; we scale it ourselves. Never upscale, crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Message 3 - tile 7_-2

```text
Next tile (3 of 6): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B017_context_7_-2.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 7_-2 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B017_mask_7_-2.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B017_classes_7_-2.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B017_depth_7_-2.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: B017_context_7_-2.png, B017_mask_7_-2.png, B017_classes_7_-2.png, B017_depth_7_-2.png, B017_style_0_0.png (for tiles after the first you may swap the style file for your own previous output of the neighbouring tile).

TASK - tile 7_-2
Edit B017_context_7_-2.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B017_mask_7_-2.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B017_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B017_classes_7_-2.png (legend: B017_classes_legend.png) for surface types and B017_depth_7_-2.png for building heights.
Paint this tile after 6_-2: where its border shows the underdrawing of 6_-2, match what you painted for that tile earlier in this conversation.

THIS TILE SHOWS
- Sobeys (left, around x=96, y=570): building - follow the reference wall colour for its material
- Shoppers Drug Mart (upper right, around x=816, y=303): building - follow the reference wall colour for its material
- Anytime Fitness (centre, around x=529, y=450): building - follow the reference wall colour for its material
- The Beer Store (upper right, around x=708, y=245): building - follow the reference wall colour for its material
- Streets and paths crossing it: Weber Street North, Bridgeport Road East, Lincoln Road

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B017_context_7_-2.png, named B017_7_-2.png. We cut the tile out ourselves.
- Any square size of 1024 px or more is fine - e.g. if your tool returns 1254 x 1254, send that file unchanged; we scale it ourselves. Never upscale, crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Message 4 - tile 5_-3

```text
Next tile (4 of 6): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B017_context_5_-3.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 5_-3 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B017_mask_5_-3.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B017_classes_5_-3.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B017_depth_5_-3.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: B017_context_5_-3.png, B017_mask_5_-3.png, B017_classes_5_-3.png, B017_depth_5_-3.png, B017_style_0_0.png (for tiles after the first you may swap the style file for your own previous output of the neighbouring tile).

TASK - tile 5_-3
Edit B017_context_5_-3.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B017_mask_5_-3.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B017_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B017_classes_5_-3.png (legend: B017_classes_legend.png) for surface types and B017_depth_5_-3.png for building heights.
Paint this tile after 5_-2: where its border shows the underdrawing of 5_-2, match what you painted for that tile earlier in this conversation.

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
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B017_context_5_-3.png, named B017_5_-3.png. We cut the tile out ourselves.
- Any square size of 1024 px or more is fine - e.g. if your tool returns 1254 x 1254, send that file unchanged; we scale it ourselves. Never upscale, crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Message 5 - tile 6_-3

```text
Next tile (5 of 6): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B017_context_6_-3.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 6_-3 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B017_mask_6_-3.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B017_classes_6_-3.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B017_depth_6_-3.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: B017_context_6_-3.png, B017_mask_6_-3.png, B017_classes_6_-3.png, B017_depth_6_-3.png, B017_style_0_0.png (for tiles after the first you may swap the style file for your own previous output of the neighbouring tile).

TASK - tile 6_-3
Edit B017_context_6_-3.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B017_mask_6_-3.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B017_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B017_classes_6_-3.png (legend: B017_classes_legend.png) for surface types and B017_depth_6_-3.png for building heights.
Paint this tile after 5_-3 and 6_-2: where its border shows the underdrawing of 5_-3 / 6_-2, match what you painted for those tiles earlier in this conversation.

THIS TILE SHOWS
- Fitzgerald Motors (upper left, around x=257, y=229): building - follow the reference wall colour for its material
- Men's Hostel (upper left, around x=52, y=189): building - follow the reference wall colour for its material
- Streets and paths crossing it: Marshall Street, Weber Street North, Alvin Street, Mackay Crescent, Elgin Crescent, Laurel Trail

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B017_context_6_-3.png, named B017_6_-3.png. We cut the tile out ourselves.
- Any square size of 1024 px or more is fine - e.g. if your tool returns 1254 x 1254, send that file unchanged; we scale it ourselves. Never upscale, crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Message 6 - tile 7_-3

```text
Next tile (6 of 6): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B017_context_7_-3.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 7_-3 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B017_mask_7_-3.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B017_classes_7_-3.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B017_depth_7_-3.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: B017_context_7_-3.png, B017_mask_7_-3.png, B017_classes_7_-3.png, B017_depth_7_-3.png, B017_style_0_0.png (for tiles after the first you may swap the style file for your own previous output of the neighbouring tile).

TASK - tile 7_-3
Edit B017_context_7_-3.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B017_mask_7_-3.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B017_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B017_classes_7_-3.png (legend: B017_classes_legend.png) for surface types and B017_depth_7_-3.png for building heights.
Paint this tile after 6_-3 and 7_-2: where its border shows the underdrawing of 6_-3 / 7_-2, match what you painted for those tiles earlier in this conversation.

THIS TILE SHOWS
- Streets and paths crossing it: Laurel Trail, Lincoln Road, Mackay Crescent

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B017_context_7_-3.png, named B017_7_-3.png. We cut the tile out ourselves.
- Any square size of 1024 px or more is fine - e.g. if your tool returns 1254 x 1254, send that file unchanged; we scale it ourselves. Never upscale, crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Packet details (for reference - the agent does not need this section)

| File | Size | Purpose | Tiles | Defines composition | sha256 |
|---|---|---|---|---|---|
| `B017_style_0_0.png` | 1024x1024 | STYLE: finished, accepted artwork of neighbouring tile 0_0 - match its palette, pixel size, outlines, windows, trees and light exactly | 0_0 | no | `bfd18a94f0c7` |
| `B017_contact_sheet.png` | 2048x1592 | CONTEXT ONLY: surrounding tiles at half scale, requested tile(s) outlined in red, landmark labels | 4_-2, 4_-3, 5_-1, 5_-2, 5_-3, 6_-1, 6_-2, 6_-3, 7_-1, 7_-2, 7_-3 | no | `6e50170f101c` |
| `B017_context_5_-2.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 5_-2 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 5_-2 | yes | `42512fe539e8` |
| `B017_mask_5_-2.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 5_-2 | no | `cd2249b035c0` |
| `B017_classes_5_-2.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 5_-2 | no | `b0c9261071b0` |
| `B017_depth_5_-2.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 5_-2 | no | `a5a1944f2ff9` |
| `B017_context_6_-2.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 6_-2 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 6_-2 | yes | `88ba5c773016` |
| `B017_mask_6_-2.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 6_-2 | no | `cd2249b035c0` |
| `B017_classes_6_-2.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 6_-2 | no | `517916a77648` |
| `B017_depth_6_-2.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 6_-2 | no | `1bdf7f090711` |
| `B017_context_7_-2.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 7_-2 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 7_-2 | yes | `deb1acf40c2f` |
| `B017_mask_7_-2.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 7_-2 | no | `cd2249b035c0` |
| `B017_classes_7_-2.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 7_-2 | no | `69ed59f1ba56` |
| `B017_depth_7_-2.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 7_-2 | no | `cd931c173748` |
| `B017_context_5_-3.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 5_-3 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 5_-3 | yes | `97a3d96c33f3` |
| `B017_mask_5_-3.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 5_-3 | no | `cd2249b035c0` |
| `B017_classes_5_-3.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 5_-3 | no | `bc272e4600f3` |
| `B017_depth_5_-3.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 5_-3 | no | `ac31c93fd158` |
| `B017_context_6_-3.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 6_-3 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 6_-3 | yes | `42eaaf1e00d5` |
| `B017_mask_6_-3.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 6_-3 | no | `cd2249b035c0` |
| `B017_classes_6_-3.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 6_-3 | no | `2cf3105a02d7` |
| `B017_depth_6_-3.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 6_-3 | no | `89e32d15cbcf` |
| `B017_context_7_-3.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 7_-3 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 7_-3 | yes | `27ca8af1b6ff` |
| `B017_mask_7_-3.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 7_-3 | no | `cd2249b035c0` |
| `B017_classes_7_-3.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 7_-3 | no | `25865080a2a3` |
| `B017_depth_7_-3.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 7_-3 | no | `e1b87763c159` |
| `B017_classes_legend.png` | 760x744 | LEGEND for the semantic maps | 5_-2, 6_-2, 7_-2, 5_-3, 6_-3, 7_-3 | no | `d7aa77db5948` |

| Return file | Item | Expected size | Crop in returned image (x0, y0, x1, y1) | Becomes |
|---|---|---|---|---|
| `B017_5_-2.png` | 5_-2 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/5_-2.png` (1024x1024) |
| `B017_6_-2.png` | 6_-2 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/6_-2.png` (1024x1024) |
| `B017_7_-2.png` | 7_-2 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/7_-2.png` (1024x1024) |
| `B017_5_-3.png` | 5_-3 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/5_-3.png` (1024x1024) |
| `B017_6_-3.png` | 6_-3 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/6_-3.png` (1024x1024) |
| `B017_7_-3.png` | 7_-3 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/7_-3.png` (1024x1024) |

**Crop math (context edit).** Context canvas = 1536x1536 canvas px at 1:1, origin at canvas px (tile_x*1024 - 256, tile_y*1024 - 256). For a returned image W x H with W/H = 1536/1536 (within 1 %), k = W/1536; the tile is the box (256k, 256k, 1280k, 1280k), resampled to 1024x1024 (box filter when k >= 1, Lanczos when k < 1). 1536x1536 -> crop (256, 256, 1280, 1280) exactly; a 2x image -> crop doubled, then box-halved. Fixed-size fallback 1024x1024: k = 0.6667, crop (170.67, 170.67, 853.33, 853.33) upscaled x1.50 (accepted with a reduced-detail warning). Agents limited to 1536x1024 or 1024x1536 get a native-scale packet instead: `build <batch> --frame wide` (margins left/right only, crop (256, 0, 1280, 1024)) or `--frame tall` (margins top/bottom only, crop (0, 256, 1024, 1280)). Joins that a frame has no margin for are repaired afterwards with seam packets (`art_request.py seam`).

**Camera and light.** Orthographic, heading 20.0 deg (camera looks NNE), pitch 45.0 deg, 0.29296875 m per artwork px. Sun azimuth 225.0 deg, elevation 50.0 deg: light from the lower left / behind the viewer, cast shadows toward the upper right. Tile (i, j) covers canvas px [i*1024, (i+1)*1024) x [j*1024, (j+1)*1024).

**QA on receipt** (`pipeline/art_import.py`, thresholds in docs/ART_PIPELINE.md): filename -> item match; decode; size / aspect; global translation by phase correlation of edge maps (> 4 px fails); local displacement and scale/rotation from a block grid (camera change); geometry agreement of class-map boundaries with image edges (whole tile, 8x8 cells, every building roof, landmark roofs); sun/shadow side; colour style against accepted tiles; seam discontinuity in a 4 px band against accepted neighbours; for context edits, drift of the kept margin.
