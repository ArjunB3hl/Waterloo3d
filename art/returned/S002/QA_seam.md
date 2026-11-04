# QA S002 / seam: **PASS**

- File: `S002_seam.png` (stored as `art/returned/S002/S002_seam.png`), sha256 `90df63d4cb80`, PNG 1254x1254
- Imported 2026-11-04T22:41:18Z; model reported: image_gen.imagegen built into Codex (model name/version not exposed); settings: seam repair; tool regenerates the whole frame; composited with feathered band (seam_feather)
- Side-by-side: `QA_seam_90df63d4.png` (latest copy: `QA_seam.png`)

## Measurements

| Check | Value | Threshold |
|---|---|---|
| band geometry | 0.788 | >= 0.5 |
| seam -1_-3 / 0_-3 | before [1.194, 1.869] -> after [0.86, 1.002] | <= 1.8 |
| seam -1_-3 / 0_-3, worst 128 px block | before [1.577, 5.169] -> after [0.981, 1.263] (block [896, 1024]) | <= 1.8 |
| kept area drift | (-0.07, +0.11) px, mean abs diff 10.5 | <= 3.0 px |
| band edge vertical at 464 px (span [0, 1024]), worst block [512, 640] | gradient x1.112, step x1.405 (accepted art there: x0.956, x1.322) | <= 1.8 (or <= accepted art + 0.15) |
| band edge vertical at 560 px (span [0, 1024]), worst block [896, 1024] | gradient x1.168, step x1.83 (accepted art there: x1.157, x1.818) | <= 1.8 (or <= accepted art + 0.15) |

## Human review (automatic checks cannot judge these)

- [ ] Pixel-art quality: crisp clusters, readable windows, recognisable roofs, no smudges or AI artefacts
- [ ] Materials: concrete / brick / glass match the real buildings; trees and lawns look like late summer
- [ ] Light: sun from the lower left, shadows toward the upper right, same as neighbouring tiles
- [ ] No text, labels, borders or vignettes; frame filled edge to edge
