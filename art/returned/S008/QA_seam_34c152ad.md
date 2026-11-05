# QA S008 / seam: **FAIL**

- File: `S008_seam.png` (stored as `art/returned/S008/S008_seam.png`), sha256 `34c152ada60a`, PNG 1254x1254
- Imported 2026-11-05T03:18:44Z; model reported: image_gen.imagegen built into Codex (model name/version not exposed); settings: seam; feathered. FORCED: only keep-changed MAD 12.2 vs 12.0 (whole-frame regeneration); creek worst block 2.03 -> 1.53
- Side-by-side: `QA_seam_34c152ad.png`

## Failures

- **keep-changed**: kept area changed (mean abs diff 12.2)  
  Fix: Only the white band may change; everything in the black area must stay pixel-identical.

## Measurements

| Check | Value | Threshold |
|---|---|---|
| band geometry | 0.908 | >= 0.5 |
| seam 6_-2 / 6_-1 | before [1.26, 1.41] -> after [1.067, 1.175] | <= 1.8 |
| seam 6_-2 / 6_-1, worst 128 px block | before [1.8, 2.028] -> after [1.284, 1.533] (block [0, 128]) | <= 1.8 |
| kept area drift | (+0.00, +0.05) px, mean abs diff 12.2 | <= 3.0 px |
| band edge horizontal at 464 px (span [0, 1024]), worst block [384, 512] | gradient x1.106, step x1.198 (accepted art there: x0.996, x1.204) | <= 1.8 (or <= accepted art + 0.15) |
| band edge horizontal at 560 px (span [0, 1024]), worst block [768, 896] | gradient x1.157, step x1.441 (accepted art there: x1.095, x1.45) | <= 1.8 (or <= accepted art + 0.15) |

## Human review (automatic checks cannot judge these)

- [ ] Pixel-art quality: crisp clusters, readable windows, recognisable roofs, no smudges or AI artefacts
- [ ] Materials: concrete / brick / glass match the real buildings; trees and lawns look like late summer
- [ ] Light: sun from the lower left, shadows toward the upper right, same as neighbouring tiles
- [ ] No text, labels, borders or vignettes; frame filled edge to edge
