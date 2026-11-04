# Optional: Google Photorealistic 3D Tiles comparison

This path is **optional and off by default**. Tiny Waterloo's published map uses only openly licensed data (see `DATA_SOURCES.md`). Google 3D Tiles can be used to:

1. **Audit building heights.** Compare OSM-derived roof heights, especially the `osm_levels`, `ms_ml_height` and `class_default` approximations, with a measured surface.
2. **Check horizontal alignment** of the reference renders against photogrammetry.
3. Optionally, produce **material and colour hints** for the image-generation agent. This only applies if you confirm your use is permitted. It is not done by default.

## Status (4 Nov 2026)

- The code is in place and passes an offline geometry test (`tests/test_google3d_pipeline.mjs`). The test uses a synthetic ECEF glTF box at Dana Porter Library: it decodes to the exact expected height (80.00 m) at the expected pixel, with a 0.31 px centroid error.
- It has **not yet run against real Google data**, because the build session cannot see an API key. Environment secrets are only injected into sessions started after they are added. A request to `tile.googleapis.com/v1/3dtiles/root.json` from this session returned `403 PERMISSION_DENIED (unregistered caller)`.

## Licensing gate

Google Maps Platform terms restrict caching, scraping and creating content derived from Google Maps Content. They also require Google's attributions whenever content is displayed. The scripts therefore:

- refuse to run without `--i-reviewed-google-terms`;
- write everything to `data_cache/google3d/` (gitignored), never to `web/public/` or `art/`;
- publish only aggregate statistics (`docs/validation/google3d_compare.md`).

Do not attach Google renders to image-generation requests, and do not publish them, unless you have confirmed that the terms allow it.

## Run (in a session where `GOOGLE_MAPS_API_KEY` is set)

```bash
python3 pipeline/prepare_tiles.py --region campus2x2          # render jobs must exist
python3 pipeline/google3d_frames.py                          # per-tile ENU -> map-frame offsets
node render/google3d_fetch.mjs --i-reviewed-google-terms -1,-1 0,-1 -1,0 0,0
node render/google3d_render.mjs -1,-1 0,-1 -1,0 0,0
python3 pipeline/google3d_compare.py -1,-1 0,-1 -1,0 0,0     # -> docs/validation/google3d_compare.md
# re-render with the estimated undulation printed by the compare step, then compare again:
node render/google3d_render.mjs --undulation=<estimate> -1,-1 0,-1 -1,0 0,0
```

The key is read only from the environment and is stripped from error messages. Restrict it to the Map Tiles API and set a daily quota in the Google Cloud console.

## How it works

| Step | Detail |
|---|---|
| Tile selection | Breadth-first walk of the tileset from `root.json`, culling by intersecting each `boundingVolume.box` with a sphere around the prepared jobs' ground region. Tiles are refined while `geometricError` exceeds `--target-error` (default 0.6 m, about 2 artwork pixels). The `session` token is propagated. |
| Frames | glTF content is y-up, so it is rotated +90° about X into the z-up ECEF tileset frame. ECEF is converted to a local tangent plane with ellipsoid-curvature correction (`render/google3d_math.mjs`), and then shifted per tile to the map's transverse-Mercator frame (`frames.json`; at most 0.095 m inside the stage-2 area). |
| Heights | Local z = ellipsoidal height − (datum 330 m + geoid undulation). The undulation is estimated from the median offset on paved ground (`google3d_compare.py`). |
| Render | The same orthographic camera and tile framing as the reference renderer. An unlit colour view plus the packed height codec from `config/world.json`. Data passes are double-sided. |
