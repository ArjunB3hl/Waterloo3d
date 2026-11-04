# Depth: the goose actor

"Fly as a goose" puts an original low-poly Canada goose over the illustrated map. The goose is lined up with the artwork,
casts a sun shadow on roofs, lawns and facades, shows as a stipple when it flies behind a tower, and collides with
buildings and terrain. This page describes how each part works and what the tests measured. The data it uses (collision
field, goose model, feathers) is described in [DEPTH_DATA.md](DEPTH_DATA.md).

| File (web/src/depth/) | Role |
| --- | --- |
| `Actor.ts` | `createActor(map)`: lifecycle, frame loop, input, follow camera, pickups, debug hooks |
| `flight.ts` | Deterministic flight model and collision response (no three.js, no DOM) |
| `heightWindow.ts` | 3 x 3 tile window of decoded visible-surface heights |
| `renderers.ts` | Lazy entry point (dynamic import) for everything that needs three.js |
| `actorRenderer.ts` | Actor canvas: render camera, pixel-art target, occlusion, stipple blit |
| `shadowRenderer.ts` | Shadow canvas: light depth pass, receiver pass on the visible surface |
| `shaders.ts` | Shared GLSL: map frame transforms, height-window sampling |
| `particles.ts` | Feather puffs, leaves, water spray, boost wake, pickup sparkle |
| `hud.ts`, `actor.css` | Flight toolbar, hints, touch pad, feather markers |
| `gooseDims.ts` | Goose dimensions without three.js (re-exported by `goose.ts`) |

`element` is a container (`position: absolute; inset: 0; pointer-events: none`) holding two transparent WebGL canvases.
Each canvas has its own three.js `WebGLRenderer` (`alpha`, `antialias: false`, premultiplied alpha,
`outputColorSpace = LinearSRGBColorSpace`, so colours pass through unconverted). The first canvas is the shadow canvas
(`mix-blend-mode: multiply`). The second is the actor canvas (normal blending). They sit above the fx canvas and below
`#map-overlay` and `#labels`.

The module renders on `map.on('frame')`, using that frame's `view` (the view the base map was drawn with), so the goose,
its shadow and the artwork always agree. While flying, it calls `map.invalidate()` every frame and pans the camera after
the goose.

three.js, the goose model and the GL contexts are created on the first flight (`await import('./renderers')`). The
initial app bundle is 98 kB (37 kB gzip). The 586 kB (150 kB gzip) renderer chunk loads only when someone flies.

## Camera alignment

The map's projection is a fixed orthographic camera with axes `right`, `up` and `back` (from `manifest.camera`). A world
point maps to canvas pixels as `cx = dot(p, right) / mpp` and `cy = -dot(p, up) / mpp`. So in view space, `x = cx * mpp`
and `y = -cy * mpp`, and an orthographic frustum over a canvas rectangle is that same rectangle in metres.

The render camera is a `THREE.OrthographicCamera` in world metres (local ENU, z up):

- `camera.up = up_enu` and `lookAt(eye - back_enu)`. three.js then builds the basis `x = up x back = right`, `y = up`,
  `z = back`.
- The eye sits on the `back` axis through the centre of the render-target rectangle, 150 m in front of the goose. Near is
  1 m and far is 300 m.
- `left/right/top/bottom` are +-half the rectangle size in metres.

The render target is not the whole screen. It is a 64 x 64 texel square around the goose:

- Texel size: `artPerTexel = max(1 artwork px, 1 device px)`, so at zoom >= 1 / dpr it is exactly one artwork pixel.
- The square is anchored on that texel grid in canvas coordinates, so goose pixels line up with artwork pixels.
- At zoom 1.6 the square covers 64 artwork px (18.75 m). The 7x goose has an 11.2 m wingspan, about 38 artwork px.

The blit is a quad over the square in canvas px, placed on screen with the map's own transform
(`(c - view.c) * zoom + size / 2`). It uses `texelFetch`, so sampling is nearest-neighbour.

**Verified:** each known surface point is projected through the actual render camera and the blit mapping
(`debug.projectToScreen`) and compared with `map.canvasToScreen`. The points are the Dana Porter roof, the E5 roof and the
SLC landmark, at zooms 0.7, 1.6 and 2.5. The goose was teleported near, not on, each point. Maximum error was
**3.7e-8 px**, and **2.5e-8 px at devicePixelRatio 2**.

## Pixel-art look

The goose is scaled **7x** (`GOOSE_DISPLAY_SCALE`). Real size would be about 5 artwork px across the wings. At 7x it is
about 25 artwork px long, roughly 40 CSS px at the take-off zoom of 1.6.

The plumage Lambert materials are replaced by shader materials with the same sRGB colours. Each facet's normal comes from
screen derivatives (flat shading). The shader quantises `dot(n, sun_enu)` into three flat tones (light 1.06, mid 0.88,
shade 0.70), and the shade tone is cooled slightly. Colours are written as sRGB with no conversion.

In the blit, texels next to the visible goose get a soft dark 1-texel rim (45%) so the goose separates from busy artwork.
Particles are 1-2 texel points in the same target. They fade with an ordered dither rather than alpha.

## Height window

`HeightWindow` holds a 3 x 3 tile block of `map.getHeightTile` results around the tile under the goose's canvas point:

- Size: 1536 x 1536 Float32 values, one per height texel (each texel is 2 x 2 artwork px, sampled at the block centre).
- Row 0 is the smallest canvas y.
- Invalid texels (NaN) and missing tiles become `HEIGHT_UNKNOWN = -10000`. The shaders treat that value as "no data": no
  occlusion and no shadow there.

Each renderer has its own R32F `DataTexture` over the shared array, with NEAREST filtering, `texelFetch` sampling and no
mipmaps. (Two GL contexts cannot share a texture.)

- **Recentre:** when the goose's tile changes, the array is refilled from the map's height LRU. The 5 x 5 ring around it
  is prefetched so the next recentre usually finds its tiles already decoded.
- **Uploads:** `flush()` uploads at most once per frame, and only after the contents changed.
- **Memory:** 9.4 MB on the CPU plus 2 x 9.4 MB on the GPU while flying. `release()` frees all of it on landing.

## Occlusion

The goose and particle fragment shaders run this test for each fragment:

1. Convert the fragment's world position to canvas px.
2. Read the visible-surface height `h` there from the window.
3. Reconstruct the city surface's depth with `frame.depthAt(c, h)`.
4. If the goose fragment is more than **0.3 m** behind that surface, mark it hidden. The shader writes alpha 0.5 instead
   of 1 into the render target.

The blit draws hidden texels as a 50% checkerboard stipple in amber (`#f3a646`), on the global texel grid so the pattern
stays stable as the goose moves. Empty texels next to hidden texels get a cream outline (`#fff4e0`). The player can follow
the goose behind towers, and parts that are not covered (for example a head sticking out past a roof edge) stay normally
shaded.

**Verified:** behind the Dana Porter tower, the test places the goose at (20.3, -222.2, 31.9). That is 8 m below the roof
and 11.3 m behind the tower's visible surface, at a free spot found by searching the decoded heights. Results:

- 88-89% of goose texels are occluded (3 runs).
- On screen: about 280 stipple pixels, 270 outline pixels and 78 normally shaded pixels (the head).
- The same spot raised above the roof is 0% occluded.
- At dpr 2: 87-100% occluded. See `docs/screenshots/actor_occluded.png`.

## Shadow

**Light pass:** the goose's shadow proxy (`goose.shadow`, with the goose group's world matrix) is rendered into a 128 x 128
`DepthTexture`.

- The light camera is orthographic, looks down `-sun_enu` at the goose and is fitted tightly around it: half-size is
  1.25 x half the scaled wingspan (7 m).
- Near and far are fitted each frame so the depth range reaches the lowest possible receiver.
- Orthographic depth is linear, so the 0.15 m bias is converted with `far - near`.

**Receiver pass:** a quad on the shadow canvas covers the canvas-space bounding square of the sun ray. The ray runs from
the goose down to `ground - 25 m`, with the goose's radius as a margin. For each fragment the shader:

1. Snaps to the actor's pixel grid.
2. Reads the visible-surface height and reconstructs the city surface point with `frame.canvasToWorld`.
3. Projects that point into light space and compares it with the goose's depth.

Four sub-samples per pixel give coverage of 0, 1/2 or 1, which makes a one-step pixel-art edge. The result is a cool
blue-grey `#8c9ec7`, multiplied over the map by CSS. It gets slightly lighter when the goose is 30-110 m above the
receiver.

Because the receiver is the visible surface, the shadow falls on roofs, lawns and the facades drawn in the artwork, and it
stops at roof edges correctly.

**Verified:** the reference point is where the sun ray through the centroid of the goose's light-pass silhouette (read from
the light target, so wing pose does not matter) meets the collision surface. The test compares that point with the
centroid of the shadow pixels on screen:

Values are ranges over the last three runs. The wing-beat phase at the moment of measurement differs between runs.

| Receiver | Offset (artwork px) | Decoded height at centroid (expected) |
| --- | --- | --- |
| Lawn at (-224, -172) | 0.06-0.15 | -0.01 m (-0.0) |
| Dana Porter roof | 0.12-0.14 | 39.92 m (39.92) |
| Tower's south-west facade | 0.07-0.15 | 28.9-29.7 m (29.3; facade heights change ~0.4 m per pixel) |

See `docs/screenshots/actor_shadow_roof.png`.

## Flight model and controls

| Action | Keys | Touch pad (coarse pointers) |
| --- | --- | --- |
| Turn | A / D or Left / Right (1.5 rad/s, banks up to 0.6 rad into the turn) | ◀ ▶ |
| Climb / dive | W / S or Up / Down (+6 / -9 m/s) | ▲ ▼ |
| Boost | Shift (24 m/s instead of 14 m/s) | Boost |
| Flap-climb | Space (+9 m/s, faster wing beat) | Flap |
| Land / exit | L or Escape | Land button (also in the toolbar) |

- **Keys are ignored** when they are aimed at form controls or the map's `#ui` panels (for example the settings panel
  during flight).
- **Wing beat** follows effort: 1.0 when climbing, 0.6 cruising, 0.3 when skimming low, 0.12 when diving.
- **Legs** lower when the goose skims within about 3 m of the surface.
- **Take-off:** the goose starts 35 m above the surface (obstacle top) at the given canvas point (or the view centre),
  facing up the screen. If that spot is not flyable it falls back to the campus origin and shows a toast.
- **Take-off camera:** if the zoom is below 1, the camera zooms to 1.6 with the map's animated fly-to. The simulation
  starts once the view settles (3.2 s at most).
- **Follow camera:** `map.setView({cx, cy})`, pan only. It is exponentially smoothed (0.35 s) and looks 0.6 s ahead along
  the velocity, clamped to 22% of the viewport.
- **Zoom while flying:** the user can still zoom. While the zoom is changing, the follow camera pauses so MapView's zoom
  easing is not cancelled, then catches up smoothly.
- **Simulation steps:** at most 1/60 s each. A frame's dt is clamped to 0.1 s.

## Collision response

Buildings, roofs and terrain are solid. Trees are soft. Water can be skimmed. All rules live in `flight.ts`:

1. **Sweep:** each sub-step sweeps a sphere of radius **2.8 m** (body radius 0.4 m x 7) with
   `CollisionField.sweep(from, to, r, 1, { trees: false })`. A collide-and-slide loop runs up to 3 iterations per
   sub-step.
2. **Wall hit** (horizontal normal):
   - Keep the non-penetrating contact point.
   - Remove the into-wall component from the velocity and from the remaining motion. The tangential part continues, so
     the goose slides.
   - Add a 1.5 m/s bounce along the normal.
   - Yaw the heading toward the wall tangent nearest it (3 rad/s, if within 75 degrees), so a scrape turns into flying
     along the wall.
   - Roll the wall-side wing up (up to 1.15 rad). This is visual only: it keeps the 3.9 m half-span out of the facade.
   - Feedback: a feather-puff particle burst and a `Honk!` toast, at most once every 2.5 s.
   - If a sweep starts already touching, step 0.25 m out along the normal.
3. **Up-facing contact** (rising ground, or a roof step lower than the goose's centre): lift to the hard floor ahead and
   continue with the rest of the motion.
4. **Altitude floor:** two floors, both measured from `solidTop` directly below.
   - Hard floor: `solidTop + radius + 0.05`. Never violated, so the sphere never penetrates.
   - Soft floor: `solidTop + 2.3 m`. When the goose is below it, it is pulled up with a 0.1 s time constant and any
     downward speed is cancelled. The goose skims and follows slopes and roofs.
   - The ceiling is the lower of 120 m above the surface and z 150 m (the top of the collision data).
5. **Trees (soft):** inside a crown (`canopyTop > z - 1 m`) the target speed drops to **40%**, with a 0.25 s time
   constant, and leaves fall. Nothing blocks the goose; the floor is the ground under the trees.
6. **Water:** over water cells the sweep radius drops to 0.8 m and the soft floor to 1.0 m. The goose skims low and throws
   spray.
7. **Edge of the artwork:** the goose's canvas point must stay at least 48 px inside published tiles, over collision data.
   - Motion across that edge is projected onto it (the fence normals are the canvas x and y axes on the ground), and the
     goose slides along.
   - The toast "The map ends here for now" appears at most every 5 s.
   - The projected move is swept too, so it cannot enter a wall.
8. **Unloaded data:** when collision data under the goose is not loaded yet, horizontal motion pauses (`waiting`). Chunks
   within 320 m are kept loaded (refreshed every 80 m), and the LRU holds 48 chunks (about 19 MB).

**Fix in `collision.ts` (reported):** the sphere test used to sample 8 points on the equator ring. A 2 m cell corner could
slip between two samples to about 1.1 m from the centre of a 2 m sphere; the first E5 test run measured 1.48 m. The probe
now tests every cell that overlaps the equator disc, at the cell point nearest the centre. That is exact for the column
model and costs about the same (0.025 ms per 15 m sweep in `tests/depth_selfcheck.mjs`, which still passes 11/11).
`sweep` also gained an optional fifth argument, `{ trees: false }`, which ignores crowns. The default keeps the old
behaviour.

## Feathers and HUD

- **Pickup:** the goose collects any feather whose centre is within **10 m** (3D), using `feathersNear`. Progress is
  saved by `FeatherProgress` in localStorage (guarded with try/catch).
- **Feedback:** `map.toast` announces each feather ("Feather found: Dana Porter Library rooftop (1 of 24)"). The toast
  element is `role=status`, so screen readers announce it.
- **Toolbar** (`#hud`): altitude above the surface below, horizontal speed, feathers n / N, a pointer and distance to the
  nearest uncollected feather, the Land button and keyboard hints.
- **Markers:** uncollected feathers on screen get bobbing markers. They are decorative (`aria-hidden`); the toolbar is a
  labelled region.
- **Phones:** the toolbar moves above a touch pad, which sits above the attribution footer. The touch buttons are out of
  the tab order, because keyboard users have the keys.
- **Focus:** on take-off, keyboard focus moves to `#stage`, so Space flaps and does not press Land. While flying,
  `map.setInteractive(false)` locks pan, and ui.ts hides the map-only UI.

## Debug hooks (tests)

`window.__tinyWaterloo.actor.debug` provides these hooks. All of them need an active flight.

| Hook | What it does |
| --- | --- |
| `getState()` | `x, y, z, vx, vy, vz, heading, speed, surface, inCanopy, overWater, waiting, time, lastHit` |
| `teleport(x, y, z, heading)` | Moves the goose without collision, snaps the camera and waits for collision and height data |
| `step(dt, input)` | The deterministic live step, including collision response and pickups |
| `setAutoStep(on)` | Freezes or resumes the live loop's simulation (rendering continues) |
| `occludedFraction()` | Fraction of goose texels drawn as occluded |
| `stippleStats()` | On-screen pixel classes of the last actor render |
| `shadowCentreScreen()` | Alpha-weighted centroid of the shadow on screen |
| `shadowRay()` | A point on the sun ray through the goose's light-pass silhouette centroid |
| `projectToScreen(x, y, z)` | World point to screen through the render camera and blit mapping |
| `windowHeight(cx, cy)` | Height-window sample at a canvas px |
| `inside(x, y, z)` | Whether the goose may fly at that point |
| `collision` | The `CollisionField` instance |

## Tests and measured results

`node tests/actor_check.mjs` uses Vite on port 5183 (it reuses a running server) and headless Chromium with SwiftShader
WebGL2, at 1280 x 800 and dpr 1, plus one dpr 2 context. The simulation checks use `debug.step` with the live loop
frozen, so results do not depend on the software-GL frame rate. Test sites are searched in the collision data at run
time.

Results: **16 / 16 PASS** on each of the last two runs. The run before them had 15 checks, before the UI-button check was
added, and passed 15 / 15. Where values vary, the ranges cover those three runs.

| Check | Measured |
| --- | --- |
| Start: active, HUD, map UI hidden, canvases | shadow canvas `multiply`, goose canvas `normal` |
| Alignment, 3 points x 3 zooms | max **3.7e-8 px** (< 0.5 px) |
| E5 wall | Hit after 1.6 s. Speed into the facade 11.5 to -0.4 m/s. Slid 22.1 m at 12.5 m/s. `solidTop - z` max -8.2 m (never above the goose). Closest building column 2.05 m (sphere 2 m). |
| Trees | Densest wood at (-336, -144). 15 s in crowns, minimum speed **5.60 m/s (40%)**. Passed 46 m beyond the centre with no blocking contact. |
| Steepest flyable slope | 8.9 degrees at (764, 540). Over 55.8 m the goose rose 4.86 m against 4.96 m of ground. Lowest point 2.05 m above the surface (hard floor 2.05 m). Deviation from the 2.3 m skim: max 0.25 m, mean 0.16 m. |
| Occlusion | 88% occluded behind Dana Porter. Stipple 277 px, outline 264 px. 0% above the roof. |
| Shadow | 0.06-0.15 artwork px from the sun-ray point on the lawn, roof and facade (threshold 0.75; receiver heights as in the table above) |
| Feathers | Toast "Feather found: Dana Porter Library rooftop (1 of 24)". HUD 1/24. Saved once. |
| Edge fence | Never left the flyable area (closest 48 px from the edge, the margin). Slid 46 m in 6 s. Toast shown. |
| Water | Skims 0.94-0.96 m above the surface (2.3 m over land) |
| Keyboard | Holding A raises the heading in the live loop. L lands ("Landed. Feathers found: 1 of 24"). |
| UI | The real "Fly as a goose" button starts the flight. Zoom 1.6 after the intro. |
| Land button / Escape / restart | Both stop the flight. After a restart the goose draws (216-274 shaded px). |
| Console | No page or console errors |
| dpr 2 | Alignment 2.5e-8 px. Shadow 918-1003 device px. 87-100% occluded. |

Screenshots, all 1280 x 800:

- `docs/screenshots/actor_flight.png`: banking boost turn over campus, with shadow, wake and HUD.
- `docs/screenshots/actor_occluded.png`
- `docs/screenshots/actor_shadow_roof.png`

`node tests/depth_selfcheck.mjs` (collision self-check) passes 11/11 with the probe fix. A separate run at 390 x 844
(touch, dpr 2) confirmed the layout has no horizontal overflow and that holding the ◀ touch button turns the goose.

## Known limitations

- **Performance on real hardware is not measured.** The CPU side of a frame (simulation, HUD and both render calls) is
  about 2 ms in headless SwiftShader. SwiftShader itself manages only a few frames per second for the whole app even
  without the actor, so frame rate on an M3 GPU still has to be checked by hand. Each flying frame adds:
  - two cleared full-screen transparent canvases;
  - a 64 x 64 render-target pass;
  - a 128 x 128 depth pass;
  - one quad on each canvas;
  - a base-map redraw, because the camera pans.
- **Collision is a 2 m column model.** Footprints are accurate to about +-1 m. There is no flying under bridges or
  overhangs. Wall normals are estimated from the grid (about 7 degrees off on diagonal facades, which makes slides along
  diagonal walls slightly bumpy). Wings (3.9 m half-span) can still overlap a facade when the goose scrapes it while
  banking hard toward it.
- **Occlusion sees only the visible surface,** like the artwork. A goose hidden behind a building whose height tile has
  not loaded yet (shown as unknown) is drawn normally. Facade depth is reconstructed per artwork pixel, with errors up to
  about 0.3 m right at a wall.
- **The shadow proxy keeps the flight neck pose** (see DEPTH_DATA.md). The shadow is not drawn over unknown heights
  (unpublished tiles).
- **Concave corners stop the goose.** In an inside corner it stays put until the player turns away. This is intended,
  but can feel sticky.
- **Zooming pauses the follow camera.** While the user zooms, the follow camera waits for MapView's zoom easing, so the
  goose drifts from the centre for about 0.3 s and the camera then catches up. A MapView option to keep a smooth zoom
  running across `setView` pans would remove the pause.
- **Rebuild the collision chunks and feathers** (`pipeline/build_collision.py`, then `pipeline/build_feathers.py`)
  whenever published tiles change. The flyable area is the published tiles that also have collision data.
