# QA S005R1 / seam: **FAIL**

- File: `S005R1_seam.png` (stored as `art/returned/S005R1/S005R1_seam.png`), sha256 `db0479c83cf5`, PNG 1254x1254
- Imported 2026-11-05T03:17:40Z; model reported: image_gen.imagegen built into Codex (model name/version not exposed); settings: seam redo; feathered. FORCED: worst block [640,768] x2.03 is a path T-junction + tree canopy lying on x=512; whole join 2.16 -> 1.32
- Side-by-side: `QA_seam_db0479c8.png` (latest copy: `QA_seam.png`)

## Failures

- **seam**: join -3_-3 | -2_-3 still visible: gradient x1.146, step x1.319 (worst 128 px block [640, 768]: gradient x1.86, step x2.027)  
  Fix: The join between -3_-3 and -2_-3 is still visible: blend colour and brightness smoothly and continue every feature straight across the line.

## Measurements

| Check | Value | Threshold |
|---|---|---|
| band geometry | 0.967 | >= 0.5 |
| seam -3_-3 / -2_-3 | before [1.773, 2.155] -> after [1.146, 1.319] | <= 1.8 |
| seam -3_-3 / -2_-3, worst 128 px block | before [2.311, 3.356] -> after [1.86, 2.027] (block [640, 768]) | <= 1.8 |
| kept area drift | (+0.17, +0.12) px, mean abs diff 9.8 | <= 3.0 px |
| band edge vertical at 464 px (span [0, 1024]), worst block [128, 256] | gradient x1.145, step x1.576 (accepted art there: x1.089, x1.56) | <= 1.8 (or <= accepted art + 0.15) |
| band edge vertical at 560 px (span [0, 1024]), worst block [128, 256] | gradient x1.071, step x1.142 (accepted art there: x1.069, x1.143) | <= 1.8 (or <= accepted art + 0.15) |

## Human review (automatic checks cannot judge these)

- [ ] Pixel-art quality: crisp clusters, readable windows, recognisable roofs, no smudges or AI artefacts
- [ ] Materials: concrete / brick / glass match the real buildings; trees and lawns look like late summer
- [ ] Light: sun from the lower left, shadows toward the upper right, same as neighbouring tiles
- [ ] No text, labels, borders or vignettes; frame filled edge to edge
