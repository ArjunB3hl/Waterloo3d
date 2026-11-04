# QA B008 / -2_-1: **PASS**

- File: `B008_-2_-1.png` (stored as `art/returned/B008/B008_-2_-1.png`), sha256 `f02f5dbff9f9`, PNG 1254x1254
- Imported 2026-11-04T20:12:08Z; model reported: image_gen.imagegen built into Codex (model name/version not exposed); settings: reference-image guided edit/style transfer; mask as reference image (no mask parameter); 5 reference images per canvas; one call per canvas; requested 1536 canvas, returned 1254x1254; seed/steps/guidance/strength unknown
- Side-by-side: `QA_-2_-1_f02f5dbf.png`

## Warnings

- **size**: returned 1254x1254 < requested 1536x1536: tile upscaled x1.22 (reduced detail)

## Measurements

| Check | Value | Threshold |
|---|---|---|
| size | [1254, 1254] for [1536, 1536] (k = 0.8164) | same aspect, tile mode >= 1024 |
| translation | (-0.33, +0.04) px, peak 0.031 | <= 4.0 px, peak >= 0.02 |
| camera (block field, 18 blocks) | scale 0.999, rot -0.073 deg, max residual 8.03 px | scale +-0.01, rot +-0.5 deg, residual <= 10.0 px |
| geometry (class boundaries vs edges) | 0.911 vs reference 0.884 -> 1.03 | >= 0.5; cells >= 0.3 |
| weak cells | 0 | < 3 |
| shadow (L shadow / L lit) | 0.586 (reference 0.65) | <= 0.88 (fail > 0.97) |
| style | hist 0.174, dE mean 4.0 {'roof': 2.4, 'wall': 8.5, 'road': 2.7, 'path': 4.8, 'parking': 4.2, 'tree': 2.5, 'green': 3.2} vs ['-1_-1', '-1_0', '-1_1', '0_-1', '0_-2', '0_0', '0_1', '1_-1', '1_-2', '1_0', '1_1', '2_-1', '2_-2', '2_0', '2_1', '3_-1', '3_0'] | hist <= 0.35 (warn), dE mean <= 12.0 / 20.0, any class <= 30.0 |
| seam right vs -1_-1 | gradient x1.219, step x1.231 | <= 1.8 |
| kept area drift | (+0.00, +0.00) px, mean abs diff 10.2 | <= 3.0 px |

## Buildings (visible roof >= 1500 px)

| Building | Landmark | Roof px | Outline vs ref | Contrast vs ref | OK |
|---|---|---:|---:|---:|---|
| School of Optometry & Vision Science |  | 47351 | 1.0 | 1.46 | yes |
| Columbia Icefield |  | 44375 | 1.0 | 1.12 | yes |
| Applied Health Sciences Expansion Building |  | 14730 | 1.07 | 1.83 | yes |
| Federation Hall |  | 8480 | 1.0 | 1.65 | yes |
| B.C. Matthews Hall |  | 5762 | 1.0 | 1.33 | yes |
| Lyle S. Hallman Institute for Health Promotion |  | 5338 | 1.0 | 1.23 | yes |

## Human review (automatic checks cannot judge these)

- [ ] Pixel-art quality: crisp clusters, readable windows, recognisable roofs, no smudges or AI artefacts
- [ ] Materials: concrete / brick / glass match the real buildings; trees and lawns look like late summer
- [ ] Light: sun from the lower left, shadows toward the upper right, same as neighbouring tiles
- [ ] No text, labels, borders or vignettes; frame filled edge to edge
