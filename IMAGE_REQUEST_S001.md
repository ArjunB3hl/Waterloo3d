# Image request S001 - Seam repair - vertical join of 3_0, 4_0

Packet revision 1, built 2026-11-04T21:09:57Z. Status: `requested`.

## What to do (for the user)

Everything is in `art/requests/S001/` (also zipped as `art/requests/S001.zip`). Start a **new conversation** with the image agent.

1. **Message 1**: attach these 6 files, then paste the text of "Message 1" below.

   - `S001_window.png`
   - `S001_mask.png`
   - `S001_window.png`
   - `S001_mask.png`
   - `S001_ref.png`
   - `S001_marked.png`

2. Save what comes back in one folder (e.g. `~/Downloads/S001/`) with exactly these names: `S001_seam.png`. Copy the agent's note about model and settings into `S001_report.txt` in the same folder.

3. Check it: `python3 pipeline/art_import.py S001 ~/Downloads/S001` (QA report only), then `python3 pipeline/art_import.py S001 ~/Downloads/S001 --accept` to accept tiles that pass.

Total: 4 attachment files, 1 image(s) to bring back.

## Message 1

```text
I'm making "Tiny Waterloo", an illustrated pixel-art map of Waterloo, Ontario (Canada) built from square tiles that join edge to edge. Please paint the image described below from the attached reference images.

ATTACHED FILES
- S001_window.png (1024x1024) - CANVAS TO EDIT + COMPOSITION: current accepted art around the join (1024x1024)
- S001_mask.png (1024x1024) - EDIT MASK: white = repaint band (96 px wide), black = keep pixel-identical
- S001_window.png (1024x1024) - CANVAS TO EDIT + COMPOSITION: current accepted art around the join (1024x1024)
- S001_mask.png (1024x1024) - EDIT MASK: white = repaint band (96 px wide), black = keep pixel-identical
- S001_ref.png (1024x1024) - GEOMETRY: reference underdrawing of the same window (where every edge must be)
- S001_marked.png (1024x1024) - ANNOTATED: band in red, join line dashed, worst rows in yellow

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

TASK - seam repair S001
In S001_window.png, the vertical line at x = 512 is where separately painted tiles meet, and the join is visible. Repaint ONLY the white band of S001_mask.png so the band reads as one continuous painting: carry roofs, walls, window rows, roads, kerbs, path edges, lawn texture and tree clusters straight across the line and blend colour and brightness smoothly. Everything in the black area must stay pixel-identical. Keep every edge where S001_ref.png has it (no moved or invented buildings, roads or trees). S001_marked.png shows the band and the worst spots - it is a guide only.
Measured now: vertical join between 3_0 and 4_0 (discontinuity x1.04 of the interior gradient, colour step x0.73).
SPECIFIC FIX (from our review of this join): Silver Lake crosses this join (water band roughly y 500-720). The right side's water is brighter with dense sparkle (L~55) and the left side is darker and smoother (L~45): repaint the water in the band so it keeps the left tile's darker, smoother blue across the line and blends the sparkle texture in gradually. No vertical line or tone step in the water; shoreline stays where the reference has it.

OUTPUT
- One image, exactly 1024 x 1024 px, PNG, named S001_seam.png, same framing as S001_window.png. Any square size of 1024 px or more is fine (e.g. 1254 x 1254 if that is what your tool returns - send it unchanged); never upscale, crop, pad or change the aspect ratio.

WHAT TO SEND BACK
- The ORIGINAL generated image file(s) exactly as produced - full resolution, PNG preferred - not a screenshot, preview or re-compressed copy - named exactly as listed above.
- A short note with the model name and version you used and any settings you can disclose (e.g. seed, steps, guidance / strength, quality, output size, edit or inpaint mode, number of attempts). Write "unknown" for anything you can't tell.
```

## Packet details (for reference - the agent does not need this section)

| File | Size | Purpose | Tiles | Defines composition | sha256 |
|---|---|---|---|---|---|
| `S001_window.png` | 1024x1024 | CANVAS TO EDIT + COMPOSITION: current accepted art around the join (1024x1024) | 3_0, 4_0 | yes | `18e3a7d8caed` |
| `S001_mask.png` | 1024x1024 | EDIT MASK: white = repaint band (96 px wide), black = keep pixel-identical | 3_0, 4_0 | no | `e446f0d7f606` |
| `S001_ref.png` | 1024x1024 | GEOMETRY: reference underdrawing of the same window (where every edge must be) | 3_0, 4_0 | no | `56fa82e8f15a` |
| `S001_marked.png` | 1024x1024 | ANNOTATED: band in red, join line dashed, worst rows in yellow | 3_0, 4_0 | no | `8169fbf56de3` |

| Return file | Item | Expected size | Crop in returned image (x0, y0, x1, y1) | Becomes |
|---|---|---|---|---|
| `S001_seam.png` | seam | 1024x1024 | (0, 0, 1024, 1024) | band composited into `3_0`, `4_0` |

**Crop math.** The returned square of side W is the 1024-px window (scale k = W/1024, box-filtered to 1024). Only the band (mask white, feathered 8 px) is composited back; the rest of the window must be unchanged.

**Camera and light.** Orthographic, heading 20.0 deg (camera looks NNE), pitch 45.0 deg, 0.29296875 m per artwork px. Sun azimuth 225.0 deg, elevation 50.0 deg: light from the lower left / behind the viewer, cast shadows toward the upper right. Tile (i, j) covers canvas px [i*1024, (i+1)*1024) x [j*1024, (j+1)*1024).

**QA on receipt** (`pipeline/art_import.py`, thresholds in docs/ART_PIPELINE.md): filename -> item match; decode; size / aspect; global translation by phase correlation of edge maps (> 4 px fails); local displacement and scale/rotation from a block grid (camera change); geometry agreement of class-map boundaries with image edges (whole tile, 8x8 cells, every building roof, landmark roofs); sun/shadow side; colour style against accepted tiles; seam discontinuity in a 4 px band against accepted neighbours; for context edits, drift of the kept margin.
