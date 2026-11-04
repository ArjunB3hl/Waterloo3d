# QA B015 / -3_-2: **FAIL**

- File: `B015_-3_-2.png` (stored as `art/returned/B015/B015_-3_-2.png`), sha256 `bfad4e660167`, PNG 1254x1254
- Imported 2026-11-04T22:55:15Z; model reported: image_gen.imagegen built into Codex (model name/version not exposed); settings: reference-guided image edit/style transfer; mask as reference image (no mask parameter); one call per canvas; requested 1536 canvas, returned 1254x1254 PNG; seed/steps/guidance/strength/quality unknown. FORCED (reviewed): -3_-2 geometry-cell flags are false positives (all roads/kerbs/parking on class outlines at 2-4x); -3_-3 right-join colour step x2.16 (geometry exact, fit scale 1.000 / 0.10 deg) -> seam packet
- Side-by-side: `QA_-3_-2_bfad4e66.png`

## Failures

- **geometry-cells**: 5 of 64 cells disagree with the class map  
  Fix: In the yellow-boxed areas of the marked image the geometry differs from the reference: redraw those areas on the reference outlines.

## Warnings

- **size**: returned 1254x1254 < requested 1536x1536: tile upscaled x1.22 (reduced detail)

## Measurements

| Check | Value | Threshold |
|---|---|---|
| size | [1254, 1254] for [1536, 1536] (k = 0.8164) | same aspect, tile mode >= 1024 |
| translation | (-0.15, +1.30) px, peak 0.0337 | <= 4.0 px, peak >= 0.02 |
| camera (block field, 12 blocks) | scale 1.0009, rot -0.024 deg, max residual 19.27 px | scale +-0.01, rot +-0.5 deg, residual <= 10.0 px |
| geometry (class boundaries vs edges) | 0.681 vs reference 0.989 -> 0.689 | >= 0.5; cells >= 0.3 |
| weak cells | 5 | < 3 |
| shadow (L shadow / L lit) | 0.646 (reference 0.681) | <= 0.88 (fail > 0.97) |
| style | hist 0.276, dE mean 4.5 {'roof': 2.8, 'wall': 11.4, 'road': 5.0, 'path': 1.1, 'paved': 5.8, 'parking': 1.1, 'tree': 4.3, 'green': 4.3} vs ['-1_-1', '-1_-2', '-1_-3', '-1_0', '-1_1', '-2_-1', '-2_-2', '-2_-3', '-2_0', '-2_1', '-3_-1', '-3_0', '0_-1', '0_-2', '0_-3', '0_0', '0_1', '1_-1', '1_-2', '1_-3', '1_0', '1_1', '2_-1', '2_-2', '2_-3', '2_0', '2_1', '3_-1', '3_-2', '3_-3', '3_0', '3_1', '4_-1', '4_-2', '4_-3', '4_0', '4_1', '5_0', '6_-1'] | hist <= 0.35 (warn), dE mean <= 12.0 / 20.0, any class <= 30.0 |
| seam right vs -2_-2 | gradient x1.111, step x1.5 | <= 1.8 |
| seam bottom vs -3_-1 | gradient x1.005, step x1.227 | <= 1.8 |
| kept area drift | (-0.29, +0.18) px, mean abs diff 16.7 | <= 3.0 px |

## Buildings (visible roof >= 1500 px)

| Building | Landmark | Roof px | Outline vs ref | Contrast vs ref | OK |
|---|---|---:|---:|---:|---|
| Toby Jenkins Applied Health Research Building |  | 29269 | 1.0 | 1.0 | yes |
| Cora Building |  | 28449 | 1.0 | 1.31 | yes |
| Accelerator Building |  | 16181 | 1.0 | 1.87 | yes |
| evolv1 |  | 15082 | 1.78 | 0.62 | yes |
| innoTECH Building |  | 14966 | 1.0 | 0.79 | yes |

## Human review (automatic checks cannot judge these)

- [ ] Pixel-art quality: crisp clusters, readable windows, recognisable roofs, no smudges or AI artefacts
- [ ] Materials: concrete / brick / glass match the real buildings; trees and lawns look like late summer
- [ ] Light: sun from the lower left, shadows toward the upper right, same as neighbouring tiles
- [ ] No text, labels, borders or vignettes; frame filled edge to edge
