# QA S001 / seam: **PASS**

- File: `S001_seam.png` (stored as `art/returned/S001/S001_seam.png`), sha256 `1f7953e8fa4f`, PNG 1254x1254
- Imported 2026-11-04T22:40:13Z; model reported: image_gen.imagegen built into Codex (model name/version not exposed); settings: seam repair; tool regenerates the whole frame; composited with feathered band (seam_feather)
- Side-by-side: `QA_seam_1f7953e8.png` (latest copy: `QA_seam.png`)

## Measurements

| Check | Value | Threshold |
|---|---|---|
| band geometry | 0.837 | >= 0.5 |
| seam 3_0 / 4_0 | before [1.161, 1.157] -> after [0.923, 0.913] | <= 1.8 |
| seam 3_0 / 4_0, worst 128 px block | before [2.113, 6.82] -> after [1.349, 1.101] (block [640, 768]) | <= 1.8 |
| kept area drift | (-0.01, +0.05) px, mean abs diff 11.2 | <= 3.0 px |
| band edge vertical at 464 px (span [0, 1024]), worst block [768, 896] | gradient x1.584, step x1.947 (accepted art there: x1.572, x1.947) | <= 1.8 (or <= accepted art + 0.15) |
| band edge vertical at 560 px (span [0, 1024]), worst block [0, 128] | gradient x1.185, step x1.159 (accepted art there: x1.175, x1.078) | <= 1.8 (or <= accepted art + 0.15) |

## Human review (automatic checks cannot judge these)

- [ ] Pixel-art quality: crisp clusters, readable windows, recognisable roofs, no smudges or AI artefacts
- [ ] Materials: concrete / brick / glass match the real buildings; trees and lawns look like late summer
- [ ] Light: sun from the lower left, shadows toward the upper right, same as neighbouring tiles
- [ ] No text, labels, borders or vignettes; frame filled edge to edge
