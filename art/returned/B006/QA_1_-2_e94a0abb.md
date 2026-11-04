# QA B006 / 1_-2: **PASS**

- File: `B006_1_-2.png` (stored as `art/returned/B006/B006_1_-2.png`), sha256 `e94a0abb36b4`, PNG 1254x1254
- Imported 2026-11-04T20:09:06Z; model reported: image_gen.imagegen built into Codex (model name/version not exposed); settings: reference-image guided edit/style transfer; mask as reference image (no mask parameter); 5 reference images per canvas; one call per canvas; requested 1536 canvas, returned 1254x1254; seed/steps/guidance/strength unknown
- Side-by-side: `QA_1_-2_e94a0abb.png`

## Warnings

- **size**: returned 1254x1254 < requested 1536x1536: tile upscaled x1.22 (reduced detail)
- **building**: Ivytowns (around x=939, y=432): roof outline score 0.29, roof contrast 1.42 of the reference

## Measurements

| Check | Value | Threshold |
|---|---|---|
| size | [1254, 1254] for [1536, 1536] (k = 0.8164) | same aspect, tile mode >= 1024 |
| translation | (+0.29, +0.96) px, peak 0.0397 | <= 4.0 px, peak >= 0.02 |
| camera (block field, 25 blocks) | scale 0.9991, rot 0.002 deg, max residual 18.97 px | scale +-0.01, rot +-0.5 deg, residual <= 10.0 px |
| geometry (class boundaries vs edges) | 0.842 vs reference 0.804 -> 1.048 | >= 0.5; cells >= 0.3 |
| weak cells | 0 | < 3 |
| shadow (L shadow / L lit) | 0.616 (reference 0.638) | <= 0.88 (fail > 0.97) |
| style | hist 0.24, dE mean 8.8 {'roof': 2.5, 'wall': 6.7, 'road': 4.4, 'path': 13.0, 'paved': 20.1, 'parking': 2.7, 'tree': 11.7, 'green': 9.1} vs ['-1_-1', '-1_0', '0_-1', '0_-2', '0_0', '1_-1', '1_0', '2_-1', '2_0', '3_-1', '3_0'] | hist <= 0.35 (warn), dE mean <= 12.0 / 20.0, any class <= 30.0 |
| seam left vs 0_-2 | gradient x0.94, step x0.987 | <= 1.8 |
| seam bottom vs 1_-1 | gradient x1.206, step x1.281 | <= 1.8 |
| kept area drift | (-0.09, +0.33) px, mean abs diff 19.0 | <= 3.0 px |

## Buildings (visible roof >= 1500 px)

| Building | Landmark | Roof px | Outline vs ref | Contrast vs ref | OK |
|---|---|---:|---:|---:|---|
| Sage 5 |  | 17211 | 1.0 | 1.32 | yes |
| unnamed apartments building |  | 11926 | 1.42 | 1.68 | yes |
| unnamed apartments building |  | 10901 | 1.0 | 1.17 | yes |
| WCRI-Clayfield |  | 8638 | 1.0 | 1.72 | yes |
| unnamed apartments building |  | 8130 | 1.0 | 1.17 | yes |
| Ivytowns |  | 7946 | 0.29 | 1.42 | no |
| unnamed building building |  | 7822 | 5.16 | 2.3 | yes |
| unnamed apartments building |  | 6909 | 0.99 | 1.24 | yes |
| unnamed apartments building |  | 6824 | 0.94 | 1.43 | yes |
| Fergus House |  | 6105 | 6.0 | 2.07 | yes |
| unnamed apartments building |  | 5848 | 11.63 | 2.16 | yes |
| unnamed apartments building |  | 5760 | 1.0 | 1.76 | yes |
| unnamed apartments building |  | 5367 | 1.0 | 1.52 | yes |
| unnamed apartments building |  | 5250 | 1.38 | 1.47 | yes |
| WCRI - Kershaw |  | 4960 | 1.0 | 1.18 | yes |
| unnamed residential building |  | 4460 | 1.01 | 1.43 | yes |
| unnamed residential building |  | 4418 | 1.14 | 1.45 | yes |
| WCRI-Carver |  | 4377 | 1.75 | 1.52 | yes |
| unnamed apartments building |  | 4063 | 1.02 | 1.47 | yes |
| unnamed residential building |  | 3994 | 1.14 | 1.32 | yes |
| unnamed apartments building |  | 3749 | 1.7 | 1.34 | yes |
| WCRI Fenwick |  | 3443 | 1.27 | 1.86 | yes |
| unnamed apartments building |  | 2917 | 0.99 | 1.3 | yes |
| unnamed building building |  | 2233 | 0.96 | 1.37 | yes |
| unnamed house building |  | 1929 | 0.56 | 1.86 | yes |
| unnamed apartments building |  | 1920 | 1.05 | 1.46 | yes |
| unnamed apartments building |  | 1816 | 0.85 | 1.66 | yes |
| unnamed apartments building |  | 1746 | 1.0 | 1.27 | yes |
| unnamed apartments building |  | 1682 | 1.2 | 1.49 | yes |
| unnamed house building |  | 1574 | 1.0 | 1.87 | yes |
| unnamed house building |  | 1561 | 1.19 | 2.22 | yes |

## Human review (automatic checks cannot judge these)

- [ ] Pixel-art quality: crisp clusters, readable windows, recognisable roofs, no smudges or AI artefacts
- [ ] Materials: concrete / brick / glass match the real buildings; trees and lawns look like late summer
- [ ] Light: sun from the lower left, shadows toward the upper right, same as neighbouring tiles
- [ ] No text, labels, borders or vignettes; frame filled edge to edge
