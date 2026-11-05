# QA S007 / seam: **FAIL**

- File: `S007_seam.png` (stored as `art/returned/S007/S007_seam.png`), sha256 `99da5fac98b4`, PNG 1254x1254
- Imported 2026-11-05T02:21:18Z; model reported: image_gen.imagegen built into Codex (model name/version not exposed); settings: seam repair; feathered composite. FORCED: worst join block step x1.95 (from x2.95) is the foot of a small house wall lying on the join line
- Side-by-side: `QA_seam_99da5fac.png` (latest copy: `QA_seam.png`)

## Failures

- **seam**: join 5_-1 | 5_0 still visible: gradient x0.893, step x1.0 (worst 128 px block [128, 256]: gradient x1.314, step x1.954)  
  Fix: The join between 5_-1 and 5_0 is still visible: blend colour and brightness smoothly and continue every feature straight across the line.

## Measurements

| Check | Value | Threshold |
|---|---|---|
| band geometry | 0.957 | >= 0.5 |
| seam 5_-1 / 5_0 | before [1.184, 1.433] -> after [0.893, 1.0] | <= 1.8 |
| seam 5_-1 / 5_0, worst 128 px block | before [2.272, 2.951] -> after [1.314, 1.954] (block [128, 256]) | <= 1.8 |
| kept area drift | (-0.01, +0.11) px, mean abs diff 11.7 | <= 3.0 px |
| band edge horizontal at 464 px (span [0, 1024]), worst block [768, 896] | gradient x1.148, step x1.337 (accepted art there: x1.061, x1.34) | <= 1.8 (or <= accepted art + 0.15) |
| band edge horizontal at 560 px (span [0, 1024]), worst block [896, 1024] | gradient x1.164, step x1.349 (accepted art there: x1.154, x1.35) | <= 1.8 (or <= accepted art + 0.15) |

## Human review (automatic checks cannot judge these)

- [ ] Pixel-art quality: crisp clusters, readable windows, recognisable roofs, no smudges or AI artefacts
- [ ] Materials: concrete / brick / glass match the real buildings; trees and lawns look like late summer
- [ ] Light: sun from the lower left, shadows toward the upper right, same as neighbouring tiles
- [ ] No text, labels, borders or vignettes; frame filled edge to edge
