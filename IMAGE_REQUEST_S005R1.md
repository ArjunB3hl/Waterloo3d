# Image request S005R1 - Revision of S005: seam

Packet revision 1, built 2026-11-05T02:23:39Z. Status: `requested`.

## What to do (for the user)

Everything is in `art/requests/S005R1/` (also zipped as `art/requests/S005R1.zip`). Start a **new conversation** with the image agent.

1. **Message 1**: attach these 5 files, then paste the text of "Message 1" below.

   - `S005R1_window.png`
   - `S005R1_mask.png`
   - `S005R1_ref.png`
   - `S005R1_previous_seam.png`
   - `S005R1_marked_seam.png`

2. Save what comes back in one folder (e.g. `~/Downloads/S005R1/`) with exactly these names: `S005R1_seam.png`. Copy the agent's note about model and settings into `S005R1_report.txt` in the same folder.

3. Check it: `python3 pipeline/art_import.py S005R1 ~/Downloads/S005R1` (QA report only), then `python3 pipeline/art_import.py S005R1 ~/Downloads/S005R1 --accept` to accept tiles that pass.

Total: 5 attachment files, 1 image(s) to bring back.

## Message 1

```text
I'm making "Tiny Waterloo", an illustrated pixel-art map of Waterloo, Ontario (Canada) built from square tiles that join edge to edge. Please paint the image described below from the attached reference images.

REVISION - your previous image for this item could not be used. Exact corrections:
- Vertical join (window x=512; window y = tile y). (1) Keep the colour and texture blend of your last repair along the whole join - it was good. (2) Rows 960-1024, x 464-559 (the evolv1 building): copy the facade EXACTLY as S005R1_window.png draws it - parapet at about y 1010 at x 464, y 990 at x 490, y 975 at x 510 on the left tile, and y 980 at x 520, y 951 at x 556 on the right tile. Do not change its height; only blend roof and wall colour across x=512 so no doubled parapet or window rows appear. (3) Repaint the whole diagonal lawn strip between the rails and the parking lot as cream paving, from (512,350) through (530,420), (545,460) and (560,495) to the band edge, matching the paving tone at x 480-505 on the same rows. (4) Rows 790-900: keep the curved sidewalk's outer edge exactly where it is (x about 508-512). Everything outside the white band stays exactly as in S005R1_window.png.

INPUT LIMIT: if your image tool accepts at most 5 input images, pass exactly these to it: S005R1_window.png, S005R1_mask.png.

ATTACHED FILES
- S005R1_window.png (1024x1024) - CANVAS TO EDIT + COMPOSITION: current accepted art around the join
- S005R1_mask.png (1024x1024) - EDIT MASK: white = repaint band, black = keep
- S005R1_ref.png (1024x1024) - GEOMETRY: reference underdrawing of the window
- S005R1_previous_seam.png (1024x1024) - YOUR PREVIOUS OUTPUT (as received) - keep what is good about it
- S005R1_marked_seam.png (1024x1024) - ANNOTATED: what is wrong (red = missing/misplaced vs reference, yellow = displaced area, labels give the fix)

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

TASK - revised seam seam
Repaint ONLY the white band of S005R1_mask.png in S005R1_window.png so the join reads as one continuous painting; everything in the black area must stay pixel-identical. S005R1_previous_seam.png is what you sent last time and S005R1_marked_seam.png marks what has to change: fix those points and keep the rest of its style. Geometry must follow S005R1_ref.png.

OUTPUT
- 1024 x 1024 px, PNG, named S005R1_seam.png. A larger image with exactly the same aspect ratio is fine; never crop, pad or change the aspect ratio.

WHAT TO SEND BACK
- The ORIGINAL generated image file(s) exactly as produced - full resolution, PNG preferred - not a screenshot, preview or re-compressed copy - named exactly as listed above.
- A short note with the model name and version you used and any settings you can disclose (e.g. seed, steps, guidance / strength, quality, output size, edit or inpaint mode, number of attempts). Write "unknown" for anything you can't tell.
```

## Packet details (for reference - the agent does not need this section)

| File | Size | Purpose | Tiles | Defines composition | sha256 |
|---|---|---|---|---|---|
| `S005R1_window.png` | 1024x1024 | CANVAS TO EDIT + COMPOSITION: current accepted art around the join | -3_-3, -2_-3 | yes | `1b2091f45e7d` |
| `S005R1_mask.png` | 1024x1024 | EDIT MASK: white = repaint band, black = keep | -3_-3, -2_-3 | no | `e446f0d7f606` |
| `S005R1_ref.png` | 1024x1024 | GEOMETRY: reference underdrawing of the window | -3_-3, -2_-3 | no | `4db5daef9975` |
| `S005R1_previous_seam.png` | 1024x1024 | YOUR PREVIOUS OUTPUT (as received) - keep what is good about it | -3_-3, -2_-3 | no | `ea49af185f94` |
| `S005R1_marked_seam.png` | 1024x1024 | ANNOTATED: what is wrong (red = missing/misplaced vs reference, yellow = displaced area, labels give the fix) | -3_-3, -2_-3 | no | `ec9dc3f06e87` |

| Return file | Item | Expected size | Crop in returned image (x0, y0, x1, y1) | Becomes |
|---|---|---|---|---|
| `S005R1_seam.png` | seam | 1024x1024 | (0, 0, 1024, 1024) | band composited into `-3_-3`, `-2_-3` |

**Crop math.** The returned square of side W is the 1024-px window (scale k = W/1024, box-filtered to 1024). Only the band (mask white, feathered 8 px) is composited back; the rest of the window must be unchanged.

**Camera and light.** Orthographic, heading 20.0 deg (camera looks NNE), pitch 45.0 deg, 0.29296875 m per artwork px. Sun azimuth 225.0 deg, elevation 50.0 deg: light from the lower left / behind the viewer, cast shadows toward the upper right. Tile (i, j) covers canvas px [i*1024, (i+1)*1024) x [j*1024, (j+1)*1024).

**QA on receipt** (`pipeline/art_import.py`, thresholds in docs/ART_PIPELINE.md): filename -> item match; decode; size / aspect; global translation by phase correlation of edge maps (> 4 px fails); local displacement and scale/rotation from a block grid (camera change); geometry agreement of class-map boundaries with image edges (whole tile, 8x8 cells, every building roof, landmark roofs); sun/shadow side; colour style against accepted tiles; seam discontinuity in a 4 px band against accepted neighbours; for context edits, drift of the kept margin.
