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

## Road junctions inside published tiles (3/3 pass: class road and |dz| < 1 m)

| Junction | lon, lat | Class | dz (m) | Pass |
|---|---|---|---:|---|
| Ambulance & Taxi Access & University Campus Lane | -80.546478, 43.470047 | road | -0.01 | yes |
| Path 1 West & Ring Road | -80.543766, 43.468312 | road | 0.01 | yes |
| Ring Road & Transit Plaza Road & William Tutte Way | -80.541919, 43.473562 | road | -0.0 | yes |

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
