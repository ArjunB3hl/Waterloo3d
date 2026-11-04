# QA B003 / 1_-1: **PASS**

- File: `B003_1_-1.png` (stored as `art/returned/B003/B003_1_-1.png`), sha256 `5ee9fb6ec3ff`, PNG 1254x1254
- Imported 2026-11-04T19:03:25Z; model reported: image_gen.imagegen (model name/version not exposed); settings: reference-image style transfer/edit; masks as image guidance; no inpainting control; requested 1536 canvas, tool returned 1254x1254; seed/steps/guidance unknown; 1_0 used generated 1_-1 as northern neighbour reference
- Side-by-side: `QA_1_-1_5ee9fb6e.png`

## Warnings

- **size**: returned 1254x1254 < requested 1536x1536: tile upscaled x1.22 (reduced detail)
- **geometry-cells**: 1 cell(s) with weak agreement: [[896, 896, 0.0]]
- **building**: unnamed building building (around x=72, y=997): roof outline score -0.82, roof contrast None of the reference
- **building**: Onnuri (around x=698, y=210): roof outline score 0.29, roof contrast 0.99 of the reference

## Measurements

| Check | Value | Threshold |
|---|---|---|
| size | [1254, 1254] for [1536, 1536] (k = 0.8164) | same aspect, tile mode >= 1024 |
| translation | (-0.68, +0.79) px, peak 0.0589 | <= 4.0 px, peak >= 0.02 |
| camera (block field, 38 blocks) | scale 1.0005, rot -0.004 deg, max residual 4.21 px | scale +-0.01, rot +-0.5 deg, residual <= 10.0 px |
| geometry (class boundaries vs edges) | 0.803 vs reference 0.699 -> 1.149 | >= 0.5; cells >= 0.3 |
| weak cells | 1 | < 3 |
| shadow (L shadow / L lit) | 0.604 (reference 0.622) | <= 0.88 (fail > 0.97) |
| style | hist 0.159, dE mean 4.9 {'roof': 3.5, 'wall': 9.2, 'road': 1.0, 'path': 3.1, 'paved': 4.9, 'parking': 2.8, 'tree': 9.7, 'green': 4.9} vs ['-1_-1', '-1_0', '0_-1', '0_0'] | hist <= 0.35 (warn), dE mean <= 12.0 / 20.0, any class <= 30.0 |
| seam left vs 0_-1 | gradient x1.146, step x1.147 | <= 1.8 |
| kept area drift | (-0.15, +0.06) px, mean abs diff 13.3 | <= 3.0 px |

## Buildings (visible roof >= 1500 px)

| Building | Landmark | Roof px | Outline vs ref | Contrast vs ref | OK |
|---|---|---:|---:|---:|---|
| Wilmot Court |  | 22916 | 1.91 | 1.61 | yes |
| Wellesley Court |  | 21093 | 1.88 | 1.57 | yes |
| unnamed retail building |  | 17630 | 1.88 | 1.28 | yes |
| Claudette Millar Hall |  | 10185 | 1.69 | 1.29 | yes |
| Waterloo Central Supermarket |  | 10108 | 0.85 | 1.11 | yes |
| Elora House |  | 8087 | 1.0 | 1.11 | yes |
| Carl A. Pollock Hall |  | 8056 | 0.43 | 1.4 | yes |
| Hespeler House |  | 7998 | 1.38 | 1.35 | yes |
| Blair House |  | 6916 | 0.48 | 0.94 | yes |
| unnamed retail building |  | 6774 | 0.63 | 1.34 | yes |
| unnamed apartments building |  | 5405 | 1.0 | 1.1 | yes |
| Eby Hall |  | 4445 | 2.05 | 1.51 | yes |
| WCRI Hammar |  | 4125 | 1.0 | 1.64 | yes |
| Rooster's Fried Chicken |  | 3353 | 1.41 | 0.96 | yes |
| WCRI-Carver |  | 3221 | 0.95 | 1.36 | yes |
| Burger King |  | 2780 | 0.64 | 1.13 | yes |
| UniClaw |  | 2742 | 1.83 | None | yes |
| bb.q Village |  | 2635 | None | 1.38 | yes |
| mochi mochi |  | 2403 | 0.58 | 0.97 | yes |
| unnamed building building |  | 2326 | -0.82 | None | no |
| Shawerma Plus |  | 2151 | 0.67 | None | yes |
| Onnuri |  | 2059 | 0.29 | 0.99 | no |
| Fergus House |  | 1891 | 0.49 | 1.89 | yes |
| Mr. Yin |  | 1575 | 0.87 | 0.91 | yes |

## Human review (automatic checks cannot judge these)

- [ ] Pixel-art quality: crisp clusters, readable windows, recognisable roofs, no smudges or AI artefacts
- [ ] Materials: concrete / brick / glass match the real buildings; trees and lawns look like late summer
- [ ] Light: sun from the lower left, shadows toward the upper right, same as neighbouring tiles
- [ ] No text, labels, borders or vignettes; frame filled edge to edge
