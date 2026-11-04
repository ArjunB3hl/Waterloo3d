# Data sources

Tiny Waterloo is built from openly licensed geodata. This file records what is used, where it came from, when it was retrieved, what it covers, the licence and attribution it requires, and which leads were checked and **not** used (and why).

All retrievals below were made on **4 November 2026** from the build container, using `pipeline/fetch_overture.py` and `pipeline/fetch_terrain.py`. The container's network policy permitted AWS open-data buckets and package registries but blocked most other hosts, including openstreetmap.org, data.waterloo.ca, uwaterloo.ca, wikipedia.org and wikimedia.org. That limitation shapes several entries below.

## Sources in use

### 1. Overture Maps Foundation, release `2026-10-21.0`

| | |
|---|---|
| Access | Anonymous S3 `s3://overturemaps-us-west-2/release/2026-10-21.0/` (GeoParquet), read with row-group bbox filtering |
| Fetch bbox (WGS84) | lon −80.640 to −80.455, lat 43.420 to 43.545 (`config/world.json → fetch_bbox_wgs84`) |
| Retrieved (UTC) | 2026-11-04 12:40:05 – 12:41:04 (`data_cache/overture/fetch_meta.json`) |
| Layers and row counts | buildings/building 79,947 · buildings/building_part 328 · transportation/segment 32,182 · transportation/connector 59,121 · base/water 1,620 · base/land_use 6,031 · base/land 9,869 · base/land_cover 738 (fetched, not rendered) · base/infrastructure 32,021 · places/place 11,333 · divisions/division_area 55 |
| Upstream datasets seen in records | OpenStreetMap (building footprints, building parts, roads, paths, rail, water, land use, trees, the municipal boundary); Microsoft ML Buildings (footprints for 3,151 buildings not in OSM, and estimated heights); Meta / AllThePlaces and others (Places) |
| Licence | Buildings, transportation, base (OSM-derived) and divisions: **ODbL 1.0** (OpenStreetMap contributors; Microsoft ML Buildings is also ODbL). Places: CDLA Permissive 2.0. land_cover (ESA WorldCover derived) is not used. |
| Required attribution | "© OpenStreetMap contributors" and "Overture Maps Foundation" (shown in the map footer and About panel) |

**How it is used.** Overture supplies building footprints and parts, heights and floor counts, the road, path and rail network, water bodies and streams, land use (parks, pitches, parking and so on), individual OSM trees and tree rows, and the City of Waterloo boundary. Coordinates are converted to the local metric frame (`config/world.json → projection.proj4`) in `pipeline/build_scene.py`.

**ODbL consequences (important for publishing).**
- The rendered map tiles and artwork are a *Produced Work* under ODbL. They may be published under terms of our choice, but must carry the attribution above.
- The published **height tiles** (`web/public/data/heights/`), **class maps** (`cls/`), **collision chunks** (`collision/`), `search.json` and `landmarks.json` are derived from ODbL data and are *Derivative Databases*. If they are publicly distributed with the site, they must be offered under ODbL 1.0, and the attribution must be kept. The generated artwork is not exempt from the attribution requirement.
- OSM data was **not** fetched from openstreetmap.org directly (the host is blocked). Every OSM element still carries its OSM id (for example `w43250626@28`) for traceability.

**Building heights: provenance and approximations.** Each building part carries a `height_src` label (`pipeline/build_scene.py`). Counts for the whole fetched area, by building part:

| `height_src` | Parts | Meaning | Accuracy label |
|---|---:|---|---|
| `osm_height` | 2,518 | Explicit OSM `height` tag | measured or mapper-supplied |
| `osm_levels` | 8,041 | OSM `building:levels` × storey height (3.0 m residential, 3.6 m other, +1 m roof allowance), with `min_level` offsets for parts | **approximation** |
| `ms_ml_height` | 43,849 | Microsoft ML Buildings estimated height | **estimate** |
| `class_default` | 25,789 | No height data, so a default by building class (for example house 7 m, university 12 m) | **approximation** |

Pitched roofs on small near-rectangular houses that have no OSM `roof:shape` tag are **inferred** (`roof.inferred = true` in render jobs). The base elevation of each building is the minimum terrain height under its footprint.

**Municipal boundary (verified before any coverage percentage is reported).** The Overture division area for the locality "Waterloo" (region CA-ON) is `cf71da1a-e964-445e-8326-7c3ee16ed35e`, sourced from **OSM relation r2062154**. Its area in the local projection is **65.31 km²**. That is consistent with the City of Waterloo's published land area of about 64 km² (Statistics Canada 2021 census: 64.06 km²; this figure is quoted from knowledge and could not be re-fetched from the container). The boundary intersects **589** map tiles (`web/public/data/coverage.json`).

**Positional cross-check.** Overture *Places* POIs were compared with OSM footprints (`docs/validation/alignment.md`). E5 matched (0 m), but the POIs named "Student Life Centre" and "Laurier Library" sit 533 m and 867 m from their buildings. Places POIs are therefore **not** used for geometry. OSM footprints are authoritative here, and Places is only used as a hint.

### 2. AWS Terrain Tiles (Mapzen "terrarium" encoding)

| | |
|---|---|
| Access | `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/14/{x}/{y}.png` (AWS Open Data registry "Terrain Tiles") |
| Retrieved (UTC) | 2026-11-04 12:44:05 (`data_cache/terrain/meta.json`) |
| Coverage used | Zoom 14, 90 tiles covering the fetch bbox, resampled to a 5 m local grid (2,778 × 2,997 cells), elevation 294.1 – 411.3 m ASL |
| Underlying source for this area | Canadian Digital Elevation Model (CDEM), Natural Resources Canada, about 20 m effective resolution, mostly ground or bare earth (CDEM mixes sources, and some cells may be reflective-surface) |
| Licence and attribution | Mapzen Terrain Tiles attribution. CDEM: "Contains information licensed under the Open Government Licence – Canada". |

**How it is used.** Terrain is the **bare-earth** ground surface: the terrain mesh, building base elevations, ground z in collision chunks and the tree base heights. **Roof heights do not come from the DEM.** They come from the building data above. These two representations are kept separate throughout processing: `z0` is terrain under the footprint, while `top` and `bottom` are building heights above it.

### 3. Derived and editorial data produced in this project

| File | Derived from | Notes |
|---|---|---|
| `web/public/data/landmarks.json` | OSM geometry plus **editorial** descriptions | Card text is a short summary written for this project. Each card lists reference URLs (uwaterloo.ca, perimeterinstitute.ca, waterloo.ca, wlu.ca, wpl.ca, grandriver.ca), but these could **not** be fetched from the container. Card text should be verified against those pages before public launch. |
| Inferred trees | OSM wood, forest, scrub, park and residential polygons | Deterministic scatter with labelled source (`inferred_<class>`), in addition to the 8,472 mapped OSM trees and 1,026 trees interpolated along OSM tree rows. |

## Leads checked and not used

| Lead | What was checked (4 Nov 2026) | Status and required follow-up |
|---|---|---|
| **City of Waterloo Open Data** (data.waterloo.ca and the city's ArcGIS hub) | Both hosts are **blocked** by the build container's network policy (CONNECT 403). Layers, licence text, fields and dates could not be inspected. | Not used. To evaluate it, allow `data.waterloo.ca`, `*.arcgis.com` and `services.arcgis.com` in the environment's network settings, then inspect the building-footprint, street-tree and contour layers and the Open Data Licence terms (attribution wording, derived works). Street trees and official footprints would improve fidelity. |
| **OpenStreetMap (direct)** | `openstreetmap.org`, the Overpass API and Geofabrik are blocked. | The same data is used through Overture (ODbL, with OSM ids preserved). Direct OSM access would only be needed for tags Overture drops, such as `roof:levels` and some `building:part` details. |
| **Google Photorealistic 3D Tiles** (Map Tiles API) | `tile.googleapis.com` is reachable. **No API key is visible in this build session**: the user added one in the environment settings, but secrets reach only new sessions, and an unauthenticated request returned 403. | **Comparison-only integration built and tested offline** (`docs/GOOGLE_3D_TILES.md`): audits OSM-derived heights and alignment, keeps all Google content in gitignored `data_cache/`, and requires `--i-reviewed-google-terms`. The Google Maps Platform terms restrict caching, scraping and creating content derived from Google Maps Content, so Google views are **not** used for published artwork, heights or masks unless the user confirms each step is permitted. Keep the key out of source control (`.env*` is gitignored). |
| **University of Waterloo Geospatial Centre** (municipal-data and elevation catalogues) | `uwaterloo.ca` is blocked. Per the user's notes, access is request-based for academic, research and teaching use. | Not used. Its licence is unsuitable as a source for a publicly distributed derived map unless the Centre grants that permission in writing. |
| Copernicus DEM GLO-30 | Reachable (`copernicus-dem-30m.s3.amazonaws.com`). | Not used. It is a **surface** model (it includes buildings and trees), so it is not bare earth and would double-count building heights. |
| Microsoft Global ML Building Footprints (direct) | Blob host is blocked. | The same data is used through Overture. |
| Wikimedia Commons photographs for landmark cards | Blocked. | Not used. Landmark cards have no photographs. |

## Reproducing the data

```bash
python3 pipeline/fetch_overture.py      # ~1.5 min, ~150 MB into data_cache/overture/
python3 pipeline/fetch_terrain.py       # 90 terrain tiles -> data_cache/terrain/dem.npz
python3 pipeline/build_scene.py         # -> data_cache/scene/scene.pkl (+ scene_summary.json)
```

`data_cache/` is gitignored. Re-running the fetchers against a different Overture release requires changing `overture_release` in `config/world.json`.
