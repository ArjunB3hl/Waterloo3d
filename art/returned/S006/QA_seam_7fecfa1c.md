# QA S006 / seam: **PASS**

- File: `S006_seam.png` (stored as `art/returned/S006/S006_seam.png`), sha256 `7fecfa1cc856`, PNG 1254x1254
- Imported 2026-11-05T02:13:21Z; model reported: image_gen.imagegen built into Codex (model name/version not exposed); settings: seam repair; whole-frame regeneration; feathered composite
- Side-by-side: `QA_seam_7fecfa1c.png`

## Measurements

| Check | Value | Threshold |
|---|---|---|
| band geometry | 0.908 | >= 0.5 |
| seam 4_-3 / 4_-2 | before [1.09, 1.158] -> after [0.921, 1.036] | <= 1.8 |
| seam 4_-3 / 4_-2, worst 128 px block | before [1.263, 1.842] -> after [1.066, 1.293] (block [128, 256]) | <= 1.8 |
| kept area drift | (-0.00, +0.07) px, mean abs diff 10.6 | <= 3.0 px |
| band edge horizontal at 464 px (span [0, 1024]), worst block [768, 896] | gradient x1.101, step x1.6 (accepted art there: x1.082, x1.562) | <= 1.8 (or <= accepted art + 0.15) |
| band edge horizontal at 560 px (span [0, 1024]), worst block [512, 640] | gradient x1.086, step x1.312 (accepted art there: x0.986, x1.323) | <= 1.8 (or <= accepted art + 0.15) |

## Human review (automatic checks cannot judge these)

- [ ] Pixel-art quality: crisp clusters, readable windows, recognisable roofs, no smudges or AI artefacts
- [ ] Materials: concrete / brick / glass match the real buildings; trees and lawns look like late summer
- [ ] Light: sun from the lower left, shadows toward the upper right, same as neighbouring tiles
- [ ] No text, labels, borders or vignettes; frame filled edge to edge
