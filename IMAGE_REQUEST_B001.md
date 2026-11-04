# Image request B001 - Style sample - tile 0_0, University of Waterloo campus core

Packet revision 2, built 2026-11-04T13:31:12Z. Status: `requested`.

## What to do (for the user)

Everything is in `art/requests/B001/` (also zipped as `art/requests/B001.zip`). Start a **new conversation** with the image agent.

1. **Message 1**: attach these 5 files, then paste the text of "Message 1" below.

   - `B001_ref_0_0.png`
   - `B001_classes_0_0.png`
   - `B001_depth_0_0.png`
   - `B001_contact_sheet.png`
   - `B001_classes_legend.png`

2. Save what comes back in one folder (e.g. `~/Downloads/B001/`) with exactly these names: `B001_0_0.png`. Copy the agent's note about model and settings into `B001_report.txt` in the same folder.

3. Check it: `python3 pipeline/art_import.py B001 ~/Downloads/B001` (QA report only), then `python3 pipeline/art_import.py B001 ~/Downloads/B001 --accept` to accept tiles that pass.

Total: 5 attachment files, 1 image(s) to bring back.

## Message 1

```text
I'm making "Tiny Waterloo", an illustrated pixel-art map of Waterloo, Ontario (Canada) built from square tiles that join edge to edge. Please paint the image described below from the attached reference images.

ATTACHED FILES
- B001_ref_0_0.png (1024x1024) - COMPOSITION: reference render of tile 0_0; the output must match its layout pixel for pixel
- B001_classes_0_0.png (1024x1024) - SEMANTIC MAP (same framing as the composition): colour = surface type, see legend
- B001_depth_0_0.png (1024x1024) - HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more
- B001_contact_sheet.png (1024x1080) - CONTEXT ONLY: surrounding tiles at half scale, requested tile(s) outlined in red, landmark labels
- B001_classes_legend.png (760x544) - LEGEND for the semantic maps

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

TASK - tile 0_0 (Style sample - tile 0_0, University of Waterloo campus core)
Paint a finished pixel-art version of B001_ref_0_0.png at the same size and framing. Use B001_classes_0_0.png (colour legend: B001_classes_legend.png) to know what every surface is, and B001_depth_0_0.png (brighter = taller above ground) for building heights. B001_contact_sheet.png shows the surrounding campus for orientation only (requested tile outlined in red) - don't copy its labels or grid.

THIS TILE SHOWS
- Dana Porter Library (centre, around x=390, y=451): tall pale precast-concrete tower with a dense regular window grid, standing on a wide low podium
- Centre for Environmental and Information Technology (upper left, around x=215, y=53): EIT - concrete and brick science/engineering block
- J. G. Hagey Hall of the Humanities (lower right, around x=773, y=862): Hagey Hall - low concrete and red-brown brick humanities building
- Physics (upper centre, around x=428, y=161): red-brown brick campus building
- Engineering 2 (upper right, around x=744, y=83): campus building - follow the reference wall colour for its material
- Earth Sciences & Chemistry (upper left, around x=81, y=120): red-brown brick campus building
- Environment 1 (lower centre, around x=507, y=857): campus building - follow the reference wall colour for its material
- Environment 3 (lower centre, around x=345, y=956): campus building - follow the reference wall colour for its material
- J. R. Coutts Engineering Lecture Hall (upper right, around x=720, y=241): campus building - follow the reference wall colour for its material
- Streets and paths crossing it: Two Row Path, Path 1 West, Path 1 East, Ring Road

OUTPUT
- One image, exactly 1024 x 1024 px (1:1), PNG, named B001_0_0.png.
- If your tool can only make a larger square (e.g. 2048 x 2048), that is fine: same composition, just bigger. Never crop, pad, letterbox or change the aspect ratio.

WHAT TO SEND BACK
- The ORIGINAL generated image file(s) exactly as produced - full resolution, PNG preferred - not a screenshot, preview or re-compressed copy - named exactly as listed above.
- A short note with the model name and version you used and any settings you can disclose (e.g. seed, steps, guidance / strength, quality, output size, edit or inpaint mode, number of attempts). Write "unknown" for anything you can't tell.
```

## Packet details (for reference - the agent does not need this section)

| File | Size | Purpose | Tiles | Defines composition | sha256 |
|---|---|---|---|---|---|
| `B001_contact_sheet.png` | 1024x1080 | CONTEXT ONLY: surrounding tiles at half scale, requested tile(s) outlined in red, landmark labels | -1_-1, 0_-1, -1_0, 0_0 | no | `c0151d192ce5` |
| `B001_ref_0_0.png` | 1024x1024 | COMPOSITION: reference render of tile 0_0; the output must match its layout pixel for pixel | 0_0 | yes | `56cd5ccd5bca` |
| `B001_classes_0_0.png` | 1024x1024 | SEMANTIC MAP (same framing as the composition): colour = surface type, see legend | 0_0 | no | `d7ea8c8e92a9` |
| `B001_depth_0_0.png` | 1024x1024 | HEIGHT GUIDE: brighter = taller above ground, white = 45 m or more | 0_0 | no | `56cbb6fe868f` |
| `B001_classes_legend.png` | 760x544 | LEGEND for the semantic maps | 0_0 | no | `8aa88109d682` |

| Return file | Item | Expected size | Crop in returned image (x0, y0, x1, y1) | Becomes |
|---|---|---|---|---|
| `B001_0_0.png` | 0_0 | 1024x1024 | (0, 0, 1024, 1024) | `art/accepted/0_0.png` (1024x1024) |

**Crop math.** The returned square of side W is the whole tile: if W = 1024 it is used as is; if W > 1024 it is box-filtered down to 1024 (scale k = W/1024). Smaller or non-square images are rejected.

**Camera and light.** Orthographic, heading 20.0 deg (camera looks NNE), pitch 45.0 deg, 0.29296875 m per artwork px. Sun azimuth 225.0 deg, elevation 50.0 deg: light from the lower left / behind the viewer, cast shadows toward the upper right. Tile (i, j) covers canvas px [i*1024, (i+1)*1024) x [j*1024, (j+1)*1024).

**QA on receipt** (`pipeline/art_import.py`, thresholds in docs/ART_PIPELINE.md): filename -> item match; decode; size / aspect; global translation by phase correlation of edge maps (> 4 px fails); local displacement and scale/rotation from a block grid (camera change); geometry agreement of class-map boundaries with image edges (whole tile, 8x8 cells, every building roof, landmark roofs); sun/shadow side; colour style against accepted tiles; seam discontinuity in a 4 px band against accepted neighbours; for context edits, drift of the kept margin.
