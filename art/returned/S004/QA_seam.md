# QA S004 / seam: **FAIL**

- File: `S004_seam.png` (stored as `art/returned/S004/S004_seam.png`), sha256 `7a6fc774eca2`, PNG 1254x1254
- Imported 2026-11-04T22:42:23Z; model reported: image_gen.imagegen built into Codex (model name/version not exposed); settings: seam repair; whole-frame regeneration
- Side-by-side: `QA_seam_7a6fc774.png` (latest copy: `QA_seam.png`)

## Failures

- **keep-changed**: kept area changed (mean abs diff 12.1)  
  Fix: Only the white band may change; everything in the black area must stay pixel-identical.

## Measurements

| Check | Value | Threshold |
|---|---|---|
| band geometry | 0.871 | >= 0.5 |
| seam -2_-2 / -1_-2 | before [1.16, 1.225] -> after [0.999, 1.001] | <= 1.8 |
| seam -2_-2 / -1_-2, worst 128 px block | before [1.443, 1.894] -> after [1.247, 1.682] (block [256, 384]) | <= 1.8 |
| kept area drift | (-0.11, +0.03) px, mean abs diff 12.1 | <= 3.0 px |
| band edge vertical at 464 px (span [0, 1024]), worst block [256, 384] | gradient x1.076, step x1.537 (accepted art there: x0.967, x1.544) | <= 1.8 (or <= accepted art + 0.15) |
| band edge vertical at 560 px (span [0, 1024]), worst block [0, 128] | gradient x1.117, step x1.376 (accepted art there: x0.858, x1.378) | <= 1.8 (or <= accepted art + 0.15) |

## Human review (automatic checks cannot judge these)

- [ ] Pixel-art quality: crisp clusters, readable windows, recognisable roofs, no smudges or AI artefacts
- [ ] Materials: concrete / brick / glass match the real buildings; trees and lawns look like late summer
- [ ] Light: sun from the lower left, shadows toward the upper right, same as neighbouring tiles
- [ ] No text, labels, borders or vignettes; frame filled edge to edge
