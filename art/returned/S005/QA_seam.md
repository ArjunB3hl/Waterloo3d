# QA S005 / seam: **FAIL**

- File: `S005_seam.png` (stored as `art/returned/S005/S005_seam.png`), sha256 `4506f002f841`, PNG 1254x1254
- Imported 2026-11-05T02:23:35Z; model reported: image_gen.imagegen built into Codex (model name/version not exposed); settings: seam repair; whole-frame regeneration
- Side-by-side: `QA_seam_4506f002.png` (latest copy: `QA_seam.png`)

## Failures

- **seam**: join -3_-3 | -2_-3 still visible: gradient x1.11, step x1.323 (worst 128 px block [768, 896]: gradient x1.51, step x1.822)  
  Fix: The join between -3_-3 and -2_-3 is still visible: blend colour and brightness smoothly and continue every feature straight across the line.

## Measurements

| Check | Value | Threshold |
|---|---|---|
| band geometry | 0.959 | >= 0.5 |
| seam -3_-3 / -2_-3 | before [1.773, 2.155] -> after [1.11, 1.323] | <= 1.8 |
| seam -3_-3 / -2_-3, worst 128 px block | before [2.311, 3.356] -> after [1.51, 1.822] (block [768, 896]) | <= 1.8 |
| kept area drift | (+0.06, +0.11) px, mean abs diff 10.1 | <= 3.0 px |
| band edge vertical at 464 px (span [0, 1024]), worst block [128, 256] | gradient x1.143, step x1.582 (accepted art there: x1.089, x1.56) | <= 1.8 (or <= accepted art + 0.15) |
| band edge vertical at 560 px (span [0, 1024]), worst block [128, 256] | gradient x1.071, step x1.143 (accepted art there: x1.069, x1.143) | <= 1.8 (or <= accepted art + 0.15) |

## Human review (automatic checks cannot judge these)

- [ ] Pixel-art quality: crisp clusters, readable windows, recognisable roofs, no smudges or AI artefacts
- [ ] Materials: concrete / brick / glass match the real buildings; trees and lawns look like late summer
- [ ] Light: sun from the lower left, shadows toward the upper right, same as neighbouring tiles
- [ ] No text, labels, borders or vignettes; frame filled edge to edge
