# Image request B016 - Uptown east and south - tiles 7_-1, 7_0, 5_1, 6_1, 7_1

> **DRAFT - do not send yet.** Waiting for tiles from B013 (6_-1, 6_0, 5_0, 4_1) to be accepted. This packet is rebuilt
> automatically when `art_import.py <batch> --accept` accepts the last of them (or run `python3 pipeline/art_request.py build B016`);
> the current files are placeholders - do not attach them.

Packet revision 2, built 2026-11-04T20:54:29Z. Status: `draft`.

## What to do (for the user)

Everything is in `art/requests/B016/` (also zipped as `art/requests/B016.zip`). Start a **new conversation** with the image agent.

1. **Message 1** (tile 7_-1): attach these 7 files, then paste the text of "Message 1" below.

   - `B016_context_7_-1.png`
   - `B016_mask_7_-1.png`
   - `B016_classes_7_-1.png`
   - `B016_depth_7_-1.png`
   - `B016_style_0_0.png`
   - `B016_contact_sheet.png`
   - `B016_classes_legend.png`

   Wait for the image before sending the next message.

2. **Message 2** (tile 7_0): attach these 4 files, then paste the text of "Message 2" below.

   - `B016_context_7_0.png`
   - `B016_mask_7_0.png`
   - `B016_classes_7_0.png`
   - `B016_depth_7_0.png`

   Wait for the image before sending the next message.

3. **Message 3** (tile 5_1): attach these 4 files, then paste the text of "Message 3" below.

   - `B016_context_5_1.png`
   - `B016_mask_5_1.png`
   - `B016_classes_5_1.png`
   - `B016_depth_5_1.png`

   Wait for the image before sending the next message.

4. **Message 4** (tile 6_1): attach these 4 files, then paste the text of "Message 4" below.

   - `B016_context_6_1.png`
   - `B016_mask_6_1.png`
   - `B016_classes_6_1.png`
   - `B016_depth_6_1.png`

   Wait for the image before sending the next message.

5. **Message 5** (tile 7_1): attach these 4 files, then paste the text of "Message 5" below.

   - `B016_context_7_1.png`
   - `B016_mask_7_1.png`
   - `B016_classes_7_1.png`
   - `B016_depth_7_1.png`

6. Save what comes back in one folder (e.g. `~/Downloads/B016/`) with exactly these names: `B016_7_-1.png`, `B016_7_0.png`, `B016_5_1.png`, `B016_6_1.png`, `B016_7_1.png`. Copy the agent's note about model and settings into `B016_report.txt` in the same folder.

7. Check it: `python3 pipeline/art_import.py B016 ~/Downloads/B016` (QA report only), then `python3 pipeline/art_import.py B016 ~/Downloads/B016 --accept` to accept tiles that pass.

Total: 23 attachment files, 5 image(s) to bring back.

## Message 1 - tile 7_-1

```text
I'm making "Tiny Waterloo", an illustrated pixel-art map of Waterloo, Ontario (Canada) built from square tiles that join edge to edge. Please paint the image described below from the attached reference images. This conversation covers 5 tiles; this is tile 1 of 5 - I will send the others one at a time with the same rules.

ATTACHED FILES
- B016_context_7_-1.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 7_-1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B016_mask_7_-1.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B016_classes_7_-1.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B016_depth_7_-1.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more
- B016_style_0_0.png (1024x1024) - STYLE: finished, accepted artwork of neighbouring tile 0_0 - match its palette, pixel size, outlines, windows, trees and light exactly
- B016_contact_sheet.png (2048x1592) - CONTEXT ONLY: surrounding tiles at half scale, requested tile(s) outlined in red, landmark labels
- B016_classes_legend.png (760x744) - LEGEND for the semantic maps

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: B016_context_7_-1.png, B016_mask_7_-1.png, B016_classes_7_-1.png, B016_depth_7_-1.png, B016_style_0_0.png. Read B016_contact_sheet.png and B016_classes_legend.png yourself and do not pass them to the tool.

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

TASK - tile 7_-1
Edit B016_context_7_-1.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B016_mask_7_-1.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B016_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B016_classes_7_-1.png (legend: B016_classes_legend.png) for surface types and B016_depth_7_-1.png for building heights.

THIS TILE SHOWS
- Luther Manor (lower right, around x=944, y=962): building - follow the reference wall colour for its material
- Spa Surgica MediSpa (right, around x=761, y=427): building - follow the reference wall colour for its material
- Streets and paths crossing it: Erb Street East, Moore Avenue North, Devitt Avenue North, Moore Avenue South, Laurel Street, Tweed Street

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B016_context_7_-1.png, named B016_7_-1.png. We cut the tile out ourselves.
- Any square size of 1024 px or more is fine - e.g. if your tool returns 1254 x 1254, send that file unchanged; we scale it ourselves. Never upscale, crop, pad or change the aspect ratio.

WHAT TO SEND BACK
- The ORIGINAL generated image file(s) exactly as produced - full resolution, PNG preferred - not a screenshot, preview or re-compressed copy - named exactly as listed above.
- A short note with the model name and version you used and any settings you can disclose (e.g. seed, steps, guidance / strength, quality, output size, edit or inpaint mode, number of attempts). Write "unknown" for anything you can't tell.
```

## Message 2 - tile 7_0

```text
Next tile (2 of 5): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B016_context_7_0.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 7_0 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B016_mask_7_0.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B016_classes_7_0.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B016_depth_7_0.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: B016_context_7_0.png, B016_mask_7_0.png, B016_classes_7_0.png, B016_depth_7_0.png, B016_style_0_0.png (for tiles after the first you may swap the style file for your own previous output of the neighbouring tile).

TASK - tile 7_0
Edit B016_context_7_0.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B016_mask_7_0.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B016_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B016_classes_7_0.png (legend: B016_classes_legend.png) for surface types and B016_depth_7_0.png for building heights.
Paint this tile after 7_-1: where its border shows the underdrawing of 7_-1, match what you painted for that tile earlier in this conversation.

THIS TILE SHOWS
- William Place (left, around x=120, y=413): building - follow the reference wall colour for its material
- Luther Manor (upper right, around x=845, y=47): building - follow the reference wall colour for its material
- Waterloo Mennonite Homes (lower centre, around x=367, y=912): building - follow the reference wall colour for its material
- United Mennonite Church (lower left, around x=296, y=996): building - follow the reference wall colour for its material
- Saint Louis Catholic Church (right, around x=967, y=642): building - follow the reference wall colour for its material
- Spur Line Crossing (upper left, around x=27, y=125): building - follow the reference wall colour for its material
- Church of the Holy Saviour (lower right, around x=747, y=972): building - follow the reference wall colour for its material
- Convent (right, around x=969, y=556): building - follow the reference wall colour for its material
- Streets and paths crossing it: Herbert Street, Spurline Trail, Allen Street East, Willow Street, George Street, William Street East

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B016_context_7_0.png, named B016_7_0.png. We cut the tile out ourselves.
- Any square size of 1024 px or more is fine - e.g. if your tool returns 1254 x 1254, send that file unchanged; we scale it ourselves. Never upscale, crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Message 3 - tile 5_1

```text
Next tile (3 of 5): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B016_context_5_1.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 5_1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B016_mask_5_1.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B016_classes_5_1.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B016_depth_5_1.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: B016_context_5_1.png, B016_mask_5_1.png, B016_classes_5_1.png, B016_depth_5_1.png, B016_style_0_0.png (for tiles after the first you may swap the style file for your own previous output of the neighbouring tile).

TASK - tile 5_1
Edit B016_context_5_1.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B016_mask_5_1.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B016_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B016_classes_5_1.png (legend: B016_classes_legend.png) for surface types and B016_depth_5_1.png for building heights.

THIS TILE SHOWS
- CIGI Campus (upper left, around x=339, y=32): building - follow the reference wall colour for its material
- Sole (upper left, around x=187, y=120): building - follow the reference wall colour for its material
- Streets and paths crossing it: Euclid Avenue, Menno Street, Father David Bauer Drive, Alexandra Avenue, Avondale Avenue South, Wells Lane

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B016_context_5_1.png, named B016_5_1.png. We cut the tile out ourselves.
- Any square size of 1024 px or more is fine - e.g. if your tool returns 1254 x 1254, send that file unchanged; we scale it ourselves. Never upscale, crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Message 4 - tile 6_1

```text
Next tile (4 of 5): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B016_context_6_1.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 6_1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B016_mask_6_1.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B016_classes_6_1.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B016_depth_6_1.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: B016_context_6_1.png, B016_mask_6_1.png, B016_classes_6_1.png, B016_depth_6_1.png, B016_style_0_0.png (for tiles after the first you may swap the style file for your own previous output of the neighbouring tile).

TASK - tile 6_1
Edit B016_context_6_1.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B016_mask_6_1.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B016_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B016_classes_6_1.png (legend: B016_classes_legend.png) for surface types and B016_depth_6_1.png for building heights.
Paint this tile after 5_1: where its border shows the underdrawing of 5_1, match what you painted for that tile earlier in this conversation.

THIS TILE SHOWS
- First United Church (upper centre, around x=560, y=185): building - follow the reference wall colour for its material
- Chartwell Terrace on the Square Retirement Residence (upper right, around x=788, y=287): building - follow the reference wall colour for its material
- First Gulf Building (upper centre, around x=523, y=33): building - follow the reference wall colour for its material
- @LEX (left, around x=228, y=447): building - follow the reference wall colour for its material
- Erb & Good Family Funeral Home (upper right, around x=1004, y=302): building - follow the reference wall colour for its material
- Valentina Bridal & Couture (upper centre, around x=548, y=299): building - follow the reference wall colour for its material
- Faire (upper left, around x=69, y=10): building - follow the reference wall colour for its material
- Streets and paths crossing it: Caroline Street South, Iron Horse Trail, William Street West, Park Street, Norman Street, King Street South

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B016_context_6_1.png, named B016_6_1.png. We cut the tile out ourselves.
- Any square size of 1024 px or more is fine - e.g. if your tool returns 1254 x 1254, send that file unchanged; we scale it ourselves. Never upscale, crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Message 5 - tile 7_1

```text
Next tile (5 of 5): same art direction, light, camera, geometry rules and style as before.

ATTACHED FILES
- B016_context_7_1.png (1536x1536) - COMPOSITION + CANVAS TO EDIT (1536x1536): tile 7_1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin
- B016_mask_7_1.png (1536x1536) - EDIT MASK: white = paint, black = keep (finished neighbour art)
- B016_classes_7_1.png (1536x1536) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B016_depth_7_1.png (1536x1536) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: B016_context_7_1.png, B016_mask_7_1.png, B016_classes_7_1.png, B016_depth_7_1.png, B016_style_0_0.png (for tiles after the first you may swap the style file for your own previous output of the neighbouring tile).

TASK - tile 7_1
Edit B016_context_7_1.png (1536 x 1536 px). Its central 1024 x 1024 square (x 256-1279, y 256-1279) is the new tile, shown as the reference underdrawing; the border around it is the surroundings.
B016_mask_7_1.png (same size) says what you may change: WHITE = paint, BLACK = keep exactly as it is. Black areas are finished artwork of neighbouring tiles: continue their colours, roofs, roads, paths, lawns and trees seamlessly across the boundary. White border areas that still show the underdrawing (or flat grey where nothing is mapped) are context: paint them consistently - we cut them away. (If your tool expects a transparent mask: transparent = white.)
Match the finished style of B016_style_0_0.png exactly: palette, pixel size, outlines, window pattern, tree style and light. Use B016_classes_7_1.png (legend: B016_classes_legend.png) for surface types and B016_depth_7_1.png for building heights.
Paint this tile after 6_1 and 7_0: where its border shows the underdrawing of 6_1 / 7_0, match what you painted for those tiles earlier in this conversation.

THIS TILE SHOWS
- Circa 1877 (upper left, around x=156, y=253): building - follow the reference wall colour for its material
- Bauer Lofts shops (centre, around x=479, y=483): building - follow the reference wall colour for its material
- Red Condominium (upper centre, around x=610, y=234): building - follow the reference wall colour for its material
- Bauer Lofts (centre, around x=657, y=363): building - follow the reference wall colour for its material
- Erb & Good Family Funeral Home (upper left, around x=60, y=301): building - follow the reference wall colour for its material
- Warrior Building (lower right, around x=873, y=835): building - follow the reference wall colour for its material
- United Mennonite Church (upper left, around x=278, y=27): building - follow the reference wall colour for its material
- Erb-Kumpf House (upper left, around x=218, y=172): building - follow the reference wall colour for its material
- King Street Dental Centre (right, around x=950, y=346): building - follow the reference wall colour for its material
- Streets and paths crossing it: King Street South, Iron Horse Trail, Park Street, Caroline Street South, Allen Street West, John Street West

OUTPUT
- Return the WHOLE canvas: 1536 x 1536 px, PNG, same framing as B016_context_7_1.png, named B016_7_1.png. We cut the tile out ourselves.
- Any square size of 1024 px or more is fine - e.g. if your tool returns 1254 x 1254, send that file unchanged; we scale it ourselves. Never upscale, crop, pad or change the aspect ratio.

Send back the original file and the model/settings note as before.
```

## Packet details (for reference - the agent does not need this section)

| File | Size | Purpose | Tiles | Defines composition | sha256 |
|---|---|---|---|---|---|
| `B016_style_0_0.png` | 1024x1024 | STYLE: finished, accepted artwork of neighbouring tile 0_0 - match its palette, pixel size, outlines, windows, trees and light exactly | 0_0 | no | `bfd18a94f0c7` |
| `B016_contact_sheet.png` | 2048x1592 | CONTEXT ONLY: surrounding tiles at half scale, requested tile(s) outlined in red, landmark labels | 4_1, 5_0, 5_1, 6_-1, 6_0, 6_1, 7_-1, 7_0, 7_1 | no | `f8469ac936e9` |
| `B016_context_7_-1.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 7_-1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 7_-1 | yes | `f80b11a4c722` |
| `B016_mask_7_-1.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 7_-1 | no | `cd2249b035c0` |
| `B016_classes_7_-1.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 7_-1 | no | `417f75d3521e` |
| `B016_depth_7_-1.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 7_-1 | no | `7b54440cd71d` |
| `B016_context_7_0.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 7_0 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 7_0 | yes | `40264bad079b` |
| `B016_mask_7_0.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 7_0 | no | `cd2249b035c0` |
| `B016_classes_7_0.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 7_0 | no | `ff4caed7e686` |
| `B016_depth_7_0.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 7_0 | no | `d0f73a05f9e0` |
| `B016_context_5_1.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 5_1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 5_1 | yes | `d4c3197b5850` |
| `B016_mask_5_1.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 5_1 | no | `cd2249b035c0` |
| `B016_classes_5_1.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 5_1 | no | `65d6eed4ca9a` |
| `B016_depth_5_1.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 5_1 | no | `ff50a9df364c` |
| `B016_context_6_1.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 6_1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 6_1 | yes | `e173a6accbdf` |
| `B016_mask_6_1.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 6_1 | no | `cd2249b035c0` |
| `B016_classes_6_1.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 6_1 | no | `9b9e47a3b08b` |
| `B016_depth_6_1.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 6_1 | no | `bd0c8f8bd35d` |
| `B016_context_7_1.png` | 1536x1536 | COMPOSITION + CANVAS TO EDIT (1536x1536): tile 7_1 underdrawing in the centre (256,256)-(1280,1280), surroundings in the margin | 7_1 | yes | `2b84db78d92d` |
| `B016_mask_7_1.png` | 1536x1536 | EDIT MASK: white = paint, black = keep (finished neighbour art) | 7_1 | no | `cd2249b035c0` |
| `B016_classes_7_1.png` | 1536x1536 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 7_1 | no | `9f13fe04312a` |
| `B016_depth_7_1.png` | 1536x1536 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 7_1 | no | `78c5c41e4b44` |
| `B016_classes_legend.png` | 760x744 | LEGEND for the semantic maps | 7_-1, 7_0, 5_1, 6_1, 7_1 | no | `984f35885d2f` |

| Return file | Item | Expected size | Crop in returned image (x0, y0, x1, y1) | Becomes |
|---|---|---|---|---|
| `B016_7_-1.png` | 7_-1 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/7_-1.png` (1024x1024) |
| `B016_7_0.png` | 7_0 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/7_0.png` (1024x1024) |
| `B016_5_1.png` | 5_1 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/5_1.png` (1024x1024) |
| `B016_6_1.png` | 6_1 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/6_1.png` (1024x1024) |
| `B016_7_1.png` | 7_1 | 1536x1536 | (256, 256, 1280, 1280) | `art/accepted/7_1.png` (1024x1024) |

**Crop math (context edit).** Context canvas = 1536x1536 canvas px at 1:1, origin at canvas px (tile_x*1024 - 256, tile_y*1024 - 256). For a returned image W x H with W/H = 1536/1536 (within 1 %), k = W/1536; the tile is the box (256k, 256k, 1280k, 1280k), resampled to 1024x1024 (box filter when k >= 1, Lanczos when k < 1). 1536x1536 -> crop (256, 256, 1280, 1280) exactly; a 2x image -> crop doubled, then box-halved. Fixed-size fallback 1024x1024: k = 0.6667, crop (170.67, 170.67, 853.33, 853.33) upscaled x1.50 (accepted with a reduced-detail warning). Agents limited to 1536x1024 or 1024x1536 get a native-scale packet instead: `build <batch> --frame wide` (margins left/right only, crop (256, 0, 1280, 1024)) or `--frame tall` (margins top/bottom only, crop (0, 256, 1024, 1280)). Joins that a frame has no margin for are repaired afterwards with seam packets (`art_request.py seam`).

**Camera and light.** Orthographic, heading 20.0 deg (camera looks NNE), pitch 45.0 deg, 0.29296875 m per artwork px. Sun azimuth 225.0 deg, elevation 50.0 deg: light from the lower left / behind the viewer, cast shadows toward the upper right. Tile (i, j) covers canvas px [i*1024, (i+1)*1024) x [j*1024, (j+1)*1024).

**QA on receipt** (`pipeline/art_import.py`, thresholds in docs/ART_PIPELINE.md): filename -> item match; decode; size / aspect; global translation by phase correlation of edge maps (> 4 px fails); local displacement and scale/rotation from a block grid (camera change); geometry agreement of class-map boundaries with image edges (whole tile, 8x8 cells, every building roof, landmark roofs); sun/shadow side; colour style against accepted tiles; seam discontinuity in a 4 px band against accepted neighbours; for context edits, drift of the kept margin.
