# QA S003 / seam: **PASS**

- File: `S003_seam.png` (stored as `art/returned/S003/S003_seam.png`), sha256 `d4fa6f73295b`, PNG 1254x1254
- Imported 2026-11-04T22:24:14Z; model reported: image_gen.imagegen built into Codex (model name/version not exposed); settings: seam repair; whole-frame regeneration, band composited
- Side-by-side: `QA_seam_d4fa6f73.png`

## Measurements

| Check | Value | Threshold |
|---|---|---|
| band geometry | 0.737 | >= 0.5 |
| seam -1_-3 / -1_-2 | before [1.254, 1.9] -> after [0.944, 0.932] | <= 1.8 |
| kept area drift | (-0.12, +0.05) px, mean abs diff 9.3 | <= 3.0 px |
| band edges | [0.93, 1.078] | <= 1.8 |

## Human review (automatic checks cannot judge these)

- [ ] Pixel-art quality: crisp clusters, readable windows, recognisable roofs, no smudges or AI artefacts
- [ ] Materials: concrete / brick / glass match the real buildings; trees and lawns look like late summer
- [ ] Light: sun from the lower left, shadows toward the upper right, same as neighbouring tiles
- [ ] No text, labels, borders or vignettes; frame filled edge to edge
