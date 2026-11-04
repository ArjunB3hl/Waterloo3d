# QA B004 / 2_-1: **FAIL**

- File: `B004_2_-1.png` (stored as `art/returned/B004/B004_2_-1.png`), sha256 `1f0afa9e40a8`, PNG 1254x1254
- Imported 2026-11-04T19:28:32Z; model reported: image_gen.imagegen (model name/version not exposed); settings: reference-image style transfer/edit; masks as image guidance; no inpainting control; requested 1536 canvas, tool returned 1254x1254; seed/steps/guidance unknown; 2_0 used generated 2_-1 as northern neighbour reference
- Side-by-side: `QA_2_-1_1f0afa9e.png`

## Failures

- **building**: unnamed apartments building (around x=343, y=121): roof outline score 0.27, roof contrast 1.43 of the reference  
  Fix: unnamed apartments building (red outline in the marked image, around x=343, y=121) is missing, merged or misplaced: paint it exactly on its reference footprint, roof outline and height.
- **building**: unnamed apartments building (around x=657, y=353): roof outline score 0.22, roof contrast 1.29 of the reference  
  Fix: unnamed apartments building (red outline in the marked image, around x=657, y=353) is missing, merged or misplaced: paint it exactly on its reference footprint, roof outline and height.
- **building**: unnamed apartments building (around x=49, y=209): roof outline score -0.06, roof contrast 1.43 of the reference  
  Fix: unnamed apartments building (red outline in the marked image, around x=49, y=209) is missing, merged or misplaced: paint it exactly on its reference footprint, roof outline and height.

## Warnings

- **size**: returned 1254x1254 < requested 1536x1536: tile upscaled x1.22 (reduced detail)
- **geometry-cells**: 2 cell(s) with weak agreement: [[0, 128, 0.06], [256, 128, -0.35]]

## Measurements

| Check | Value | Threshold |
|---|---|---|
| size | [1254, 1254] for [1536, 1536] (k = 0.8164) | same aspect, tile mode >= 1024 |
| translation | (-0.72, +0.07) px, peak 0.0272 | <= 4.0 px, peak >= 0.02 |
| camera (block field, 20 blocks) | scale 1.0007, rot 0.037 deg, max residual 2.81 px | scale +-0.01, rot +-0.5 deg, residual <= 10.0 px |
| geometry (class boundaries vs edges) | 0.794 vs reference 0.684 -> 1.16 | >= 0.5; cells >= 0.3 |
| weak cells | 2 | < 3 |
| shadow (L shadow / L lit) | 0.622 (reference 0.617) | <= 0.88 (fail > 0.97) |
| style | hist 0.116, dE mean 4.2 {'roof': 1.1, 'wall': 6.3, 'road': 1.2, 'path': 4.3, 'parking': 3.9, 'tree': 11.0, 'green': 1.6} vs ['-1_-1', '-1_0', '0_-1', '0_0', '1_-1', '1_0'] | hist <= 0.35 (warn), dE mean <= 12.0 / 20.0, any class <= 30.0 |
| seam left vs 1_-1 | gradient x1.158, step x1.399 | <= 1.8 |
| kept area drift | (+0.03, +0.02) px, mean abs diff 10.2 | <= 3.0 px |

## Buildings (visible roof >= 1500 px)

| Building | Landmark | Roof px | Outline vs ref | Contrast vs ref | OK |
|---|---|---:|---:|---:|---|
| KW Granite Club |  | 24670 | 1.0 | 1.22 | yes |
| Woolwich Court |  | 22555 | 0.96 | 1.33 | yes |
| Waterloo Court |  | 21531 | 1.01 | 1.26 | yes |
| Waterloo College Hall |  | 12224 | 2.2 | 1.58 | yes |
| unnamed apartments building |  | 11075 | 0.89 | 0.98 | yes |
| unnamed building building |  | 10884 | 1.07 | 1.51 | yes |
| unnamed apartments building |  | 10169 | 0.27 | 1.43 | no |
| unnamed apartments building |  | 9422 | 0.22 | 1.29 | no |
| unnamed apartments building |  | 8750 | 3.32 | 1.53 | yes |
| unnamed building building |  | 7502 | 1.11 | 1.48 | yes |
| unnamed apartments building |  | 7456 | 3.26 | 1.7 | yes |
| The Beckett School |  | 7137 | 1.01 | 1.26 | yes |
| Beck Hall |  | 5945 | 0.9 | 1.39 | yes |
| unnamed building building |  | 5313 | 3.38 | 1.83 | yes |
| UW Place Grand Commons |  | 5213 | 1.13 | 1.19 | yes |
| unnamed apartments building |  | 4506 | -0.06 | 1.43 | no |
| unnamed parking building |  | 3221 | 0.71 | 1.77 | yes |
| Claudette Millar Hall |  | 2781 | 0.35 | 1.4 | yes |
| unnamed apartments building |  | 1507 | 7.16 | 1.53 | yes |
| Eby Hall |  | 1502 | 1.0 | 1.39 | yes |

## Human review (automatic checks cannot judge these)

- [ ] Pixel-art quality: crisp clusters, readable windows, recognisable roofs, no smudges or AI artefacts
- [ ] Materials: concrete / brick / glass match the real buildings; trees and lawns look like late summer
- [ ] Light: sun from the lower left, shadows toward the upper right, same as neighbouring tiles
- [ ] No text, labels, borders or vignettes; frame filled edge to edge
