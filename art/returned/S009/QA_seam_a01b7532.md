# QA S009 / seam: **FAIL**

- File: `S009_seam.png` (stored as `art/returned/S009/S009_seam.png`), sha256 `a01b7532dc74`, PNG 1254x1254
- Imported 2026-11-05T03:19:44Z; model reported: image_gen.imagegen built into Codex (model name/version not exposed); settings: seam; feathered. INTERIM, FORCED: whole join 1.61 -> 0.99; one 50 px canopy/shadow line at x 192-256 remains (worst block 1.92) -> S009R1
- Side-by-side: `QA_seam_a01b7532.png`

## Failures

- **seam**: join 7_-3 | 7_-2 still visible: gradient x0.985, step x1.109 (worst 128 px block [128, 256]: gradient x1.242, step x1.924)  
  Fix: The join between 7_-3 and 7_-2 is still visible: blend colour and brightness smoothly and continue every feature straight across the line.

## Measurements

| Check | Value | Threshold |
|---|---|---|
| band geometry | 0.832 | >= 0.5 |
| seam 7_-3 / 7_-2 | before [1.608, 1.537] -> after [0.985, 1.109] | <= 1.8 |
| seam 7_-3 / 7_-2, worst 128 px block | before [2.166, 2.387] -> after [1.242, 1.924] (block [128, 256]) | <= 1.8 |
| kept area drift | (-0.03, +0.19) px, mean abs diff 11.7 | <= 3.0 px |
| band edge horizontal at 464 px (span [0, 1024]), worst block [128, 256] | gradient x1.137, step x1.957 (accepted art there: x1.125, x1.971) | <= 1.8 (or <= accepted art + 0.15) |
| band edge horizontal at 560 px (span [0, 1024]), worst block [768, 896] | gradient x1.192, step x1.801 (accepted art there: x1.146, x1.802) | <= 1.8 (or <= accepted art + 0.15) |

## Human review (automatic checks cannot judge these)

- [ ] Pixel-art quality: crisp clusters, readable windows, recognisable roofs, no smudges or AI artefacts
- [ ] Materials: concrete / brick / glass match the real buildings; trees and lawns look like late summer
- [ ] Light: sun from the lower left, shadows toward the upper right, same as neighbouring tiles
- [ ] No text, labels, borders or vignettes; frame filled edge to edge
