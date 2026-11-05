# QA S004R1 / seam: **PASS**

- File: `S004R1_seam.png` (stored as `art/returned/S004R1/S004R1_seam.png`), sha256 `cde4364e3470`, PNG 1254x1254
- Imported 2026-11-05T02:14:59Z; model reported: image_gen.imagegen built into Codex (model name/version not exposed); settings: seam repair redo; rails redrawn between measured entry/exit points; composited with hard band (--no-feather) because a feather ghosts moved rails
- Side-by-side: `QA_seam_cde4364e.png` (latest copy: `QA_seam.png`)

## Measurements

| Check | Value | Threshold |
|---|---|---|
| band geometry | 0.88 | >= 0.5 |
| seam -2_-2 / -1_-2 | before [1.16, 1.225] -> after [0.877, 0.877] | <= 1.8 |
| seam -2_-2 / -1_-2, worst 128 px block | before [1.443, 1.894] -> after [0.973, 1.297] (block [256, 384]) | <= 1.8 |
| kept area drift | (-0.07, +0.04) px, mean abs diff 11.8 | <= 3.0 px |
| band edge vertical at 464 px (span [0, 1024]), worst block [256, 384] | gradient x1.156, step x1.411 (accepted art there: x0.967, x1.544) | <= 1.8 (or <= accepted art + 0.15) |
| band edge vertical at 560 px (span [0, 1024]), worst block [0, 128] | gradient x1.091, step x1.37 (accepted art there: x0.858, x1.378) | <= 1.8 (or <= accepted art + 0.15) |

## Human review (automatic checks cannot judge these)

- [ ] Pixel-art quality: crisp clusters, readable windows, recognisable roofs, no smudges or AI artefacts
- [ ] Materials: concrete / brick / glass match the real buildings; trees and lawns look like late summer
- [ ] Light: sun from the lower left, shadows toward the upper right, same as neighbouring tiles
- [ ] No text, labels, borders or vignettes; frame filled edge to edge
