# Depth data for the goose actor

Data and standalone modules that the goose actor (`web/src/depth/Actor.ts`) builds on:

| Piece | Source | Output |
| --- | --- | --- |
| Collision field | `pipeline/build_collision.py` | `web/public/data/collision/{meta.json, solid/*.png, ground/*.png}` |
| Collision runtime | `web/src/depth/collision.ts` | `CollisionField` (pure TS, no three.js) |
| Goose model | `web/src/depth/goose.ts` | `createGoose()` (three.js primitives, original) |
| Collectibles | `pipeline/build_feathers.py`, `web/src/depth/feathers.ts` | `web/public/data/feathers.json`, `FeatherProgress` |
| Checks | `tests/test_collision.py`, `tests/depth_selfcheck.mjs` | see [Verification](#verification) |

All coordinates are the map's local ENU metres (x east, y north, z up, z relative to `datum_m` = 330 m ASL), the same frame as
`web/src/frame.ts`. Convert with `frame.worldToCanvas()` / `frame.canvasToWorld()`.

## Regenerating

```sh
python3 pipeline/build_collision.py        # chunks under the published tiles (51 chunks, about 4 MB, for the 55 published tiles)
python3 pipeline/build_collision.py --all  # whole-city tile plan from coverage.json (~4 min, 372 chunks, 32 MB)
python3 pipeline/build_feathers.py         # needs the collision chunks; deterministic
python3 tests/test_collision.py            # Python checks against scene.pkl + DEM + rendered height tiles
node tests/depth_selfcheck.mjs             # TS module checks (Node >= 22.18, built-in type stripping)
```

Inputs: `data_cache/scene/scene.pkl`, `data_cache/terrain/dem.npz` (both reproducible via the pipeline),
`web/public/data/manifest.json` (published tiles), `coverage.json` (for `--all`), `landmarks.json` (feathers).
`--chunks 0,-1 1,-1` rebuilds individual chunks and merges them into an existing `meta.json`; `--out DIR` writes elsewhere.
Re-run both scripts whenever the scene, the DEM or the published tile set changes (new tiles need new chunks).

## Collision field

A **top-down** grid built from the **source geometry** (building parts, DEM, trees, water), not from the rendered
visible-surface heights, so it knows about the backs of buildings and the ground under them.

### Grid and addressing

- 2 m cells; chunks of 256 x 256 cells = 512 m. Chunk `(ix, iy) = (floor(x / 512), floor(y / 512))`.
- Global cell `(gc, gr) = (floor(x / 2), floor(y / 2))`, centre `((gc + 0.5) * 2, (gr + 0.5) * 2)`.
- Images are **north-up**: `col = gc - 256 ix`, `row = 255 - (gr - 256 iy)`. Equivalently cell `(col c, row r)` of chunk
  `(ix, iy)` has its centre at `x = 512 ix + 2 (c + 0.5)`, `y = 512 (iy + 1) - 2 (r + 0.5)`.
- Chunks built: those intersecting each published tile's world footprint over the actor's altitude range
  z in [-30, 150] m plus a 32 m margin (`chunks_for_tiles`). `meta.json` lists exactly the files present.

### Files (lossless 8-bit PNG)

`z = (256 R + G) / 100 - 100` (metres rel. datum; identical to the height tiles' codec, 1 cm steps).

| File | Channel | Meaning |
| --- | --- | --- |
| `solid/{ix}_{iy}.png` (RGBA) | R, G | solid top z: max of terrain and every building part covering the cell centre (pitched roofs follow their roof surface) |
| | B | canopy top above the cell's ground z, 0.1 m units (0 = no canopy; max 25.5 m) |
| | A | kind bits: 1 building, 2 tree crown, 4 water, 8 valid (inside terrain data) |
| `ground/{ix}_{iy}.png` (RGB) | R, G | terrain z (bilinear DEM at the cell centre) |
| | B | 255 valid, 0 outside terrain data |

**Decode the PNGs byte-exactly.** The alpha channel carries data, so they must not go through a 2D canvas
(premultiplied alpha corrupts RGB wherever A < 255). `collision.ts` ships a small PNG decoder (`decodePng`) that uses the
platform `DecompressionStream`; in Python, `PIL.Image.open(...).convert('RGBA')` is exact (`build_collision.load_chunk`).

`meta.json` records the codec, layout, kind bits, crown model, sources, and per chunk `{zmax, zmin, v}`:
`zmax` = highest solid or canopy z in the chunk (lets the runtime prove a high-flying sphere is clear without loading
the chunk), `v` = content hash (cache-busting `?v=`).

### Semantics

- **Buildings**: Overture/OSM footprints and parts from `scene.pkl`. Roof z = building base `z0` (min terrain under the
  footprint) + part `top`, exactly as the reference renderer draws it. Pitched roofs use `prepare_tiles.roof_spec`
  (explicit OSM roof shapes and inferred gables on small houses) and the renderer's gable / hip surface formula.
  A cell belongs to a part when its centre is inside the part polygon (unbiased: footprint edges are within +-1 m).
  The field is a column model: overhangs and sky bridges (parts with `bottom > 0`) are filled to the ground.
  Parts entirely below the local terrain add nothing. Where no building covers a cell, solid == ground bit-exactly.
- **Trees**: the same tree set the renderer draws (OSM trees + `prepare_tiles.scatter_trees` inferred trees, reused by
  import) and the renderer's exact crown shape: an ellipsoid of radius r (vertical semi-axis 0.85 r) centred at
  ground + 1.6 + 0.9 r, plus a 0.7 r blob offset by up to r/2 (offsets from a Python port of the renderer's hash,
  `js_hash`, verified identical) and raised 0.35 r. Each cell stores the maximum over its area (conservative), so crown
  tops are ~ground + 1.6 + 1.75..1.85 r. The crown column is treated as solid down to the ground (no flying under trees).
- **Water**: water / pool areas (incl. golf water hazards, fountains) and stream lines buffered to their width. Water is
  only a kind bit; its z is the terrain z.

### Accuracy (measured, see Verification)

- Dana Porter Library tower: 197 cells inside the footprint, max |solid - (z0 + top)| = 0.0027 m.
- Against the published height tiles (every texel of all 55 tiles reconstructed to a world point; `tests/test_collision.py`
  on 2026-11-04): roof pixels median error 0.000 m, 93.3% within 0.5 m (the rest are footprint-edge cells); ground pixels
  99.2% within 0.5 m; tree pixels 99.9% at or under the stored canopy top.

## `collision.ts` - `CollisionField`

```ts
import { CollisionField, KIND_WATER } from './depth/collision';

const field = await CollisionField.open('data/collision/meta.json', { maxChunks: 48 }); // ~390 KB per decoded chunk
await field.ensureAround(goose.x, goose.y, 300);   // call ahead of the actor (cheap when already loaded)

field.ground(x, y);       // terrain z, bilinear                      (NaN = not loaded / no data)
field.solidTop(x, y);     // terrain or roof z, nearest cell (sharp walls); == ground() off buildings
field.canopyTop(x, y);    // absolute crown top z, NaN where there is no tree
field.obstacleTop(x, y);  // max(solidTop, canopyTop): minimum safe altitude for a point
field.kind(x, y);         // KIND_BUILDING | KIND_TREE | KIND_WATER | KIND_VALID bits, 0 = not loaded
field.isLoaded(x, y); field.covers(x, y); field.stats();

const r = field.sweep(from, to, radius);   // Vec3 from/to in metres, sphere radius in metres, steps <= 1 m
field.sweep(from, to, radius, 1, { trees: false });   // soft vegetation: tree crowns never block (the goose actor)
// r.hit: 'none' | 'building' | 'ground' | 'tree'
// r.point: last non-penetrating position (bisection-refined to ~3 cm); r.t in [0, 1]
// r.normal: (0,0,1) for ground, roofs and canopy tops; horizontal outward normal for walls and crown sides; 0 for 'none'
// r.missing: part of the path crossed unloaded data (treated as free space)
```

Contact rules (sphere of radius r at centre p, tested at <= 1 m steps):

1. Fast reject: every chunk under the sphere is listed and its `zmax` < p.z - r -> free (no decode needed).
2. Every column whose cell overlaps the sphere's equator disc (tested at the cell point nearest p, so exact for the
   column model): a building column taller than p.z touches the sphere's side -> wall.
3. Centre column: building and p.z - r < solidTop -> roof (or wall, if the sphere was not above that column at the
   previous free sample, e.g. a point-sized probe flying into a facade); a disc crown column taller than p.z -> tree side;
   p.z - r < canopyTop -> canopy top; p.z - r < ground -> ground.
4. After the first hit, 5 bisection steps refine the contact; side normals come from a 24-direction occupancy ring
   around the contact (within ~10 degrees of the true facade normal in the Dana Porter test).

A hit at `t = 0` means the start position is already in contact. Recommended actor radius: `GOOSE_BODY_RADIUS_M` times
the display scale (e.g. 0.4 m x 7 = 2.8 m). Cost: ~0.03 ms per 15 m sweep with radius 1.5 m (measured in Node in the build container), so dozens per frame
are affordable.

Memory is bounded by `maxChunks` (least recently used chunk evicted on insert); keep `ensure()` boxes small. Failed
chunk loads are logged once and then read as "not loaded".

## `goose.ts` - `createGoose()`

Original low-poly Canada goose from three.js primitives (icosahedron ellipsoids, cylinders, cones, extruded wing
outlines); 648 triangles, six flat-shaded `MeshLambertMaterial` tones (brown-grey body, darker wing coverts, dark
primaries, pale breast, white chin strap / undertail, black neck / head / bill / tail / feet).

- Model frame: **+X forward, +Y left wing, +Z up**, origin at the body centre, real size in metres: wingspan 1.57 m
  (`GOOSE_WINGSPAN_M` = 1.6 nominal), 1.08 m bill to tail in flight.
- At 0.29 m per artwork px a real-size goose is only ~4 px long: scale the group by `GOOSE_DISPLAY_SCALE` (5; 4-6 reads
  well) and put it in a Z-up scene (or rotate the group -90 degrees about X for a Y-up scene).
- `setFlap(phase, amount)`: phase in radians (sin(phase) = 1 at the top of the upstroke; e.g. advance by 2 pi x 3 Hz x dt),
  amount 0 (glide, slight dihedral) .. 1 (full beat). The hand lags the arm for a natural wing wave.
- `setPose({ fold, legs, neck, headYaw })`: each 0..1 blend - `fold` 1 folds the wings along the back (flap amplitude
  fades out automatically), `legs` 1 lowers the feet (landing / walking; 0 = tucked under the tail), `neck` 1 = upright
  S-neck (standing / swimming; 0 = stretched forward for flight), `headYaw` radians.
- `shadow`: a 88-triangle proxy (one merged torso geometry + one flat double-sided panel per wing segment, black
  `MeshBasicMaterial`) that follows the same wing pose. Render it in the shadow / depth pass with the goose's transform
  (`shadow.matrix.copy(goose.group.matrixWorld); shadow.matrixAutoUpdate = false`). It keeps the flight neck.
- `dispose()` frees all geometries and materials.

## Feathers

`web/public/data/feathers.json`: `{ version, datum_m, feathers: Feather[] }`, each
`{ id, x, y, z, label, over: 'roof'|'ground'|'tree'|'water', canvas: [cx, cy], landmark_id? }`.

24 feathers: one above each of the 14 covered landmarks plus Waterloo Park (4), Silver Lake (2), Arts Quad, Graduate
House Green, Mathematics 3 Green and Laurier's Alumni Field. z = highest obstacle within 6 m + clearance (roof 6 m,
ground / canopy 4 m, water 3 m). Every feather's canvas point (at its z) lies in a published tile at least 40 px from an
unpublished one; scattered feathers are >= 45 m from every other feather (farthest-point sampling, deterministic).

```ts
import { loadFeathers, FeatherProgress, feathersNear } from './depth/feathers';
const feathers = await loadFeathers();                 // data/feathers.json
const progress = new FeatherProgress(feathers);        // localStorage 'tinywaterloo.feathers.v1', try/catch guarded
for (const f of feathersNear(feathers, gooseWorldPos, 6)) if (progress.collect(f.id)) announce(`Feather found: ${f.label}`);
progress.count; progress.total; progress.has(id); progress.onChange(cb); progress.reset();
```

`collect()` returns true only the first time. Stored ids that no longer exist are ignored in `count`. When storage is
missing, blocked or full, progress silently lasts for the session. `label` is written for HUD text and screen-reader
announcements.

## Verification

`python3 tests/test_collision.py` (plain asserts, pytest-compatible) checks against `scene.pkl` + DEM + published
rendered heights: meta / hash / zmax consistency and tile coverage; Dana Porter tower roof; solid == ground on every
non-building cell and on the largest open pitch / grass area; ground follows the DEM at the steepest slope inside the
published tiles (0.185, 10.5 degrees at (-359, -2), max error 0.005 m over 11 x 11 cells); 200 OSM tree cells have canopy
no lower than their own crown; a gabled house ridge vs eave; rendered-height agreement (numbers above); feathers clear
of obstacles (>= 3.0 m) and inside published tiles.

`node tests/depth_selfcheck.mjs` loads the real chunks through `CollisionField` with a file loader and checks the
samplers, wall / roof / ground / canopy sweeps and normals, t = 0 starts, fast rejection without loading, LRU bounds,
the PNG decoder against a known pixel, sweep cost, and `FeatherProgress` persistence with broken storage.

## Known limitations

- 2 m cells: footprints are accurate to +-1 m and building parts narrower than ~2 m can vanish; walls are vertical
  steps between cells. Use a sweep radius of at least ~1 m for robust wall contacts.
- Column model: no flying under bridges, overhangs or tree crowns.
- Wall normals are estimated from the grid (~10 degree error on diagonal facades).
- Building heights inherit the scene's provenance (many are OSM levels x storey height or class defaults) - the
  field matches the artwork, not necessarily reality.
- Generated artwork that departs from the reference geometry (e.g. a hand-drawn roof feature) is not reflected; the
  field follows the source geometry that the reference renders and height tiles were made from.
