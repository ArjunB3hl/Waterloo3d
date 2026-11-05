# QA S010 / seam: **PASS**

- File: `S010_seam.png` (stored as `art/returned/S010/S010_seam.png`), sha256 `76f78caf4842`, PNG 1254x1254
- Imported 2026-11-05T14:48:19Z; model reported: image_gen.imagegen built into Codex (model name/version not exposed); settings: seam
- Side-by-side: `QA_seam_76f78caf.png`

## Warnings

- **keep-changed**: kept area re-rendered (mean abs diff 12.2, no drift) - not composited

## Measurements

| Check | Value | Threshold |
|---|---|---|
| band geometry | 0.812 | >= 0.5 |
| seam 7_-3 / 7_-2 | before [0.985, 1.109] -> after [0.916, 1.048] | <= 1.8 |
| seam 7_-3 / 7_-2, worst 128 px block | before [1.242, 1.924] -> after [1.115, 1.403] (block [768, 896]) | <= 1.8 |
| kept area drift | (-0.01, +0.20) px, mean abs diff 12.2 | <= 3.0 px |
| band edge horizontal at 464 px (span [0, 1024]), worst block [128, 256] | gradient x1.166, step x1.931 (accepted art there: x1.137, x1.957) | <= 1.8 (or <= accepted art + 0.15) |
| band edge horizontal at 560 px (span [0, 1024]), worst block [768, 896] | gradient x1.203, step x1.804 (accepted art there: x1.153, x1.801) | <= 1.8 (or <= accepted art + 0.15) |

## Human review (automatic checks cannot judge these)

- [ ] Pixel-art quality: crisp clusters, readable windows, recognisable roofs, no smudges or AI artefacts
- [ ] Materials: concrete / brick / glass match the real buildings; trees and lawns look like late summer
- [ ] Light: sun from the lower left, shadows toward the upper right, same as neighbouring tiles
- [ ] No text, labels, borders or vignettes; frame filled edge to edge
