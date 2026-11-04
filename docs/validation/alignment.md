# Alignment validation

Codec max error: 0.0050 m (step 0.01 m).

## Landmark roofs (7/7 pass: |dz| < 0.35 m and class = roof)

| Building | OSM | Height source | Source lon, lat | Expected roof z (m) | Decoded z (m) | dz (m) | Class | Pass |
|---|---|---|---|---:|---:|---:|---|---|
| Mathematics & Computer | w43250630@39 | osm_levels | -80.54383, 43.472363 | 28.62 | 28.62 | 0.003 | roof | yes |
| Student Life Centre | w43250627@37 | osm_levels | -80.545324, 43.472255 | 16.64 | 16.64 | 0.002 | roof | yes |
| Engineering 6 | w158807251@13 | osm_levels | -80.538685, 43.473003 | 29.53 | 29.53 | 0.004 | roof | yes |
| Engineering 5 | w51125806@22 | osm_levels | -80.540083, 43.472922 | 28.57 | 28.57 | -0.001 | roof | yes |
| Pearl Sullivan Engineering Building | w382735686@10 | osm_levels | -80.539504, 43.472834 | 17.78 | 17.78 | 0.001 | roof | yes |
| Centre for Environmental and Information Technology | w188703119@11 | osm_levels | -80.542301, 43.471638 | 22.95 | 22.95 | 0.001 | roof | yes |
| Dana Porter Library | w43250626@28 | osm_levels | -80.542262, 43.469725 | 39.92 | 39.92 | -0.003 | roof | yes |

## Road junctions inside published tiles (197 pass, 9 occluded by a building in front, 1 at a roof edge of a 512 px height block (full-res render correct), 0 fail; pass = class road/rail and |dz| < 1 m)

Failures and occlusions are listed; passing junctions are in alignment.json.

| Junction | lon, lat | Class | dz (m) | Result |
|---|---|---|---:|---|
| Albert Street & University Avenue West | -80.531675, 43.473742 | wall | 52.62 | occluded |
| Allen Street West & Caroline Street South | -80.519914, 43.459556 | roof | 56.86 | occluded |
| Balsam Street & Hemlock Street | -80.531619, 43.475541 | roof | 21.16 | occluded |
| Barrel Yards Bouldevard & Barrel Yards Boulevard & Merchant Avenue | -80.529517, 43.463777 | roof | 41.82 | occluded |
| Barrel Yards Boulevard & Father David Bauer Drive | -80.53021, 43.465128 | roof | 76.49 | occluded |
| Bricker Avenue & King Street North | -80.524335, 43.473184 | major_road | 33.16 | height-block edge (full-res dz -0.0 m) |
| Erb Street East & Hughes Lane | -80.521793, 43.465261 | roof | 11.74 | occluded |
| Hickory Street East & Regina Street North | -80.5243, 43.478946 | roof | 66.95 | occluded |
| James Street & King Street North | -80.524072, 43.471923 | roof | 60.91 | occluded |
| Lester Street & University Avenue West | -80.533965, 43.472871 | wall | 38.2 | occluded |

## Independent POI vs footprint

| Name | POI sources | POI lon, lat | Distance to footprint (m) | Same-name POIs |
|---|---|---|---:|---:|
| Student Life Centre | Overture, meta | -80.53926, 43.46896 | 532.7 | 1 |
| Engineering 5 | Overture, meta | -80.540133, 43.472754 | 0.0 | 1 |
| Laurier Library | AllThePlaces, Overture | -80.54095, 43.472572 | 866.6 | 1 |

## Inverse projection (canvas + decoded height -> ground position)

| Name | Horizontal error (m) |
|---|---:|
| Mathematics & Computer | 0.003 |
| Student Life Centre | 0.002 |
| Engineering 6 | 0.004 |
| Engineering 5 | 0.001 |
| Pearl Sullivan Engineering Building | 0.001 |
| Centre for Environmental and Information Technology | 0.001 |
| Dana Porter Library | 0.003 |

Annotated image: `alignment_patch.png` (green = pass, red = fail).
