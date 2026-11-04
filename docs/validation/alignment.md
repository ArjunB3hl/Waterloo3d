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

## Road junctions inside published tiles (196/207 pass: class road and |dz| < 1 m)

| Junction | lon, lat | Class | dz (m) | Pass |
|---|---|---|---:|---|
| Academy Crescent & Old Post Road | -80.553334, 43.467892 | road | 0.03 | yes |
| Albert Street & Bricker Avenue | -80.52915, 43.471463 | road | -0.01 | yes |
| Albert Street & Bridgeport Road West & Caroline Street North | -80.525125, 43.467316 | major_road | -0.01 | yes |
| Albert Street & Cardill Crescent | -80.536827, 43.480813 | road | 0.01 | yes |
| Albert Street & Central Street | -80.527676, 43.470133 | road | 0.01 | yes |
| Albert Street & Columbia Street West | -80.535244, 43.478642 | major_road | 0.0 | yes |
| Albert Street & Dorset Street | -80.523891, 43.465987 | road | 0.0 | yes |
| Albert Street & Dupont Street West | -80.523784, 43.465881 | road | -0.0 | yes |
| Albert Street & Erb Street West | -80.523347, 43.465095 | major_road | -0.02 | yes |
| Albert Street & Ezra Avenue | -80.528374, 43.470757 | road | -0.01 | yes |
| Albert Street & Hickory Street West | -80.533796, 43.4766 | road | 0.0 | yes |
| Albert Street & Princess Street | -80.524513, 43.466653 | road | 0.0 | yes |
| Albert Street & Seagram Drive | -80.529836, 43.472068 | road | -0.0 | yes |
| Albert Street & Spring Street West | -80.526608, 43.468902 | road | -0.0 | yes |
| Albert Street & University Avenue West | -80.531675, 43.473742 | wall | 52.62 | NO |
| Albert Street & Young Street West | -80.525892, 43.468111 | road | -0.0 | yes |
| Alexandra Avenue & Caroline Street South | -80.522832, 43.461554 | road | -0.0 | yes |
| Alexandra Avenue & Euclid Avenue | -80.525074, 43.46042 | road | 0.01 | yes |
| Alexandra Avenue & Menno Street | -80.526013, 43.459843 | road | -0.01 | yes |
| Alexandra Avenue & Short Street | -80.523942, 43.461078 | road | 0.0 | yes |
| Algonquin Drive & Iroquois Place | -80.545296, 43.464967 | road | 0.05 | yes |
| Allen Street East & Allen Street West & King Street South | -80.519124, 43.460279 | major_road | 0.03 | yes |
| Allen Street East & Dodds Lane | -80.518727, 43.460645 | road | -0.0 | yes |
| Allen Street East & Herbert Street | -80.517197, 43.462028 | road | 0.01 | yes |
| Allen Street East & Mary Street | -80.518336, 43.460995 | road | 0.03 | yes |
| Allen Street East & Willow Street | -80.515953, 43.46316 | road | -0.01 | yes |
| Allen Street West & Caroline Street South | -80.519914, 43.459556 | roof | 56.86 | NO |
| Allen Street West & Freemont Street | -80.520315, 43.459215 | road | -0.0 | yes |
| Allen Street West & Park Street | -80.520671, 43.458865 | road | 0.0 | yes |
| Allen Street West & York Street | -80.521418, 43.458185 | road | -0.0 | yes |
| Alvin Street & Mackay Crescent | -80.515484, 43.474677 | road | 0.0 | yes |
| Alvin Street & Marshall Street | -80.516049, 43.475422 | road | 0.02 | yes |
| Ambulance & Taxi Access & University Campus Lane | -80.546478, 43.470047 | road | -0.01 | yes |
| Austin Drive & Cardill Crescent | -80.53392, 43.481061 | road | 0.02 | yes |
| Avondale Avenue North & Erb Street West | -80.529878, 43.462352 | major_road | -0.01 | yes |
| Avondale Avenue North & Father David Bauer Drive | -80.531797, 43.465202 | road | 0.01 | yes |
| Avondale Avenue South & Dawson Street | -80.528869, 43.461245 | road | -0.01 | yes |
| Avondale Avenue South & Erb Street West | -80.529794, 43.462389 | major_road | 0.0 | yes |
| Balsam Street & Hazel Street | -80.529068, 43.476479 | road | 0.01 | yes |
| Balsam Street & Hemlock Street | -80.531619, 43.475541 | roof | 21.16 | NO |
| Balsam Street & Larch Street | -80.530365, 43.476002 | road | -0.01 | yes |
| Barrel Yards Bouldevard & Barrel Yards Boulevard & Merchant Avenue | -80.529517, 43.463777 | roof | 41.82 | NO |
| Barrel Yards Bouldevard & Erb Street West & Menno Street | -80.52874, 43.462862 | major_road | 0.0 | yes |
| Barrel Yards Boulevard & Father David Bauer Drive | -80.53021, 43.465128 | roof | 76.49 | NO |
| Batavia Place & Columbia Street West | -80.536373, 43.478246 | major_road | 0.0 | yes |
| Beech Street & Hazel Street | -80.528784, 43.476092 | road | -0.0 | yes |
| Beech Street & State Court & State Street | -80.528147, 43.476652 | road | -0.0 | yes |
| Bricker Avenue & Clayfield Avenue | -80.526988, 43.472256 | road | 0.0 | yes |
| Bricker Avenue & King Street North | -80.524335, 43.473184 | major_road | 33.16 | NO |
| Bridgeport Road East & Bridgeport Road West & King Street North | -80.523048, 43.467642 | major_road | -0.0 | yes |
| Bridgeport Road East & Devitt Avenue North | -80.515555, 43.468937 | major_road | -0.0 | yes |
| Bridgeport Road East & Laurel Street | -80.516338, 43.468633 | major_road | 0.02 | yes |
| Bridgeport Road East & Moore Avenue North | -80.517033, 43.468462 | major_road | 0.01 | yes |
| Bridgeport Road East & Peppler Street | -80.5197, 43.468117 | major_road | 0.02 | yes |
| Bridgeport Road East & Regina Street North | -80.52184, 43.46781 | major_road | 0.01 | yes |
| Bridgeport Road East & Weber Street North | -80.512643, 43.470137 | major_road | -0.0 | yes |
| Bridgeport Road West & Dorset Street | -80.524248, 43.467492 | major_road | 0.01 | yes |
| Brighton Street & Elgin Crescent | -80.519923, 43.473092 | road | 0.04 | yes |
| Brighton Street & Marshall Street | -80.520347, 43.473887 | road | 0.01 | yes |
| Brighton Street & Noecker Street | -80.519287, 43.471966 | road | -0.01 | yes |
| Caroline Street North & Caroline Street South & Erb Street West | -80.525206, 43.464376 | major_road | 0.0 | yes |
| Caroline Street North & Dupont Street West | -80.525748, 43.465256 | major_road | -0.04 | yes |
| Caroline Street South & Father David Bauer Drive | -80.524085, 43.46309 | road | 0.03 | yes |
| Caroline Street South & Fire Route | -80.517974, 43.458393 | road | 0.0 | yes |
| Caroline Street South & Freemont Street | -80.520737, 43.460034 | road | 0.01 | yes |
| Caroline Street South & Fullerton Street | -80.521754, 43.46063 | road | 0.04 | yes |
| Caroline Street South & John Street West | -80.518355, 43.458643 | road | 0.01 | yes |
| Caroline Street South & Norman Street | -80.521371, 43.460408 | road | 0.0 | yes |
| Caroline Street South & William Street West | -80.522207, 43.460901 | road | -0.01 | yes |
| Caroline Street South & Willis Way | -80.52383, 43.462788 | road | -0.0 | yes |
| Carter Avenue & Marshall Street | -80.513638, 43.476278 | road | 0.01 | yes |
| Central Street & Dorset Street | -80.524832, 43.469823 | road | 0.01 | yes |
| Central Street & Fountain Street | -80.526087, 43.469977 | road | 0.0 | yes |
| Central Street & King Street North | -80.523608, 43.469784 | major_road | 0.0 | yes |
| Clayfield Avenue & Ezra Avenue | -80.526333, 43.471481 | road | -0.0 | yes |
| Columbia Street West & Hagey Boulevard | -80.546506, 43.474738 | major_road | 0.01 | yes |
| Columbia Street West & Hagey Boulevard & North Campus Road | -80.546427, 43.474629 | major_road | -0.02 | yes |
| Columbia Street West & Hazel Street | -80.531711, 43.479918 | major_road | -0.01 | yes |
| Columbia Street West & Lester Street | -80.537642, 43.477803 | major_road | 0.01 | yes |
| Columbia Street West & Phillip Street | -80.539939, 43.476982 | major_road | -0.01 | yes |
| Dawson Street & Dunbar Road South | -80.52993, 43.460771 | road | 0.0 | yes |
| Dawson Street & Euclid Avenue | -80.52676, 43.462164 | road | 0.02 | yes |
| Dawson Street & Menno Street | -80.527821, 43.461697 | road | 0.03 | yes |
| Dawson Street & Wells Lane | -80.527278, 43.461932 | road | 0.0 | yes |
| Devitt Avenue North & Devitt Avenue South & Erb Street East | -80.513959, 43.467469 | major_road | -0.01 | yes |
| Dominion Lane & Dupont Street West | -80.523109, 43.465943 | road | 0.0 | yes |
| Dominion Lane & Erb Street West | -80.522905, 43.465134 | major_road | -0.03 | yes |
| Dorset Street & Princess Street West | -80.524027, 43.466676 | road | -0.0 | yes |
| Dorset Street & Spring Street West | -80.524658, 43.469149 | road | -0.01 | yes |
| Dorset Street & Young Street West | -80.524446, 43.468326 | road | 0.0 | yes |
| Dunbar Road North & Dunbar Road South & Erb Street West | -80.530886, 43.461925 | major_road | 0.05 | yes |
| Dupont Street East & Dupont Street West & King Street North | -80.522627, 43.466012 | major_road | -0.0 | yes |
| Dupont Street East & Peppler Street | -80.519276, 43.466457 | road | -0.0 | yes |
| Dupont Street East & Regina Street North | -80.52142, 43.466164 | road | -0.0 | yes |
| Elgin Crescent & Noecker Street | -80.517026, 43.473021 | road | -0.02 | yes |
| Elgin Crescent & Regina Street North | -80.522299, 43.472269 | road | 0.01 | yes |
| Elgin Street & King Street North | -80.523694, 43.470134 | major_road | 0.03 | yes |
| Elgin Street & Peppler Street | -80.520358, 43.470551 | road | -0.0 | yes |
| Elgin Street & Regina Street North | -80.522509, 43.470288 | road | 0.0 | yes |
| Ellis Crescent North & Lincoln Road | -80.50983, 43.474571 | road | -0.0 | yes |
| Erb Street East & Erb Street West & King Street North & King Street South | -80.522367, 43.465188 | major_road | -0.01 | yes |
| Erb Street East & Gillen Street | -80.520257, 43.465473 | major_road | -0.01 | yes |
| Erb Street East & Hughes Lane | -80.521793, 43.465261 | roof | 11.74 | NO |
| Erb Street East & Moore Avenue North & Moore Avenue South | -80.515073, 43.466839 | major_road | -0.0 | yes |
| Erb Street East & Peppler Street | -80.519046, 43.46563 | major_road | 0.0 | yes |
| Erb Street East & Regina Street North & Regina Street South | -80.52118, 43.465341 | major_road | 0.0 | yes |
| Erb Street East & Tweed Street | -80.51687, 43.466047 | major_road | 0.02 | yes |
| Erb Street East & Willow Street | -80.518039, 43.465759 | major_road | -0.0 | yes |
| Erb Street West & Euclid Avenue | -80.527704, 43.463326 | major_road | 0.0 | yes |
| Erb Street West & Father David Bauer Drive | -80.526891, 43.463676 | major_road | 0.0 | yes |
| Erb Street West & Roslin Avenue South & Sunshine Avenue | -80.531924, 43.461472 | major_road | -0.02 | yes |
| Erb Street West & Wells Lane | -80.528224, 43.46309 | major_road | 0.01 | yes |
| Euclid Avenue & William Street West | -80.523757, 43.459507 | road | -0.01 | yes |
| Ezra Avenue & King Street North | -80.524141, 43.472262 | major_road | -0.03 | yes |
| Father David Bauer Drive & Merchant Avenue | -80.52824, 43.464754 | road | 0.01 | yes |
| Fir Street & Hickory Street West & Spruce Street | -80.526565, 43.477975 | road | -0.01 | yes |
| Fir Street & State Street | -80.528238, 43.477053 | road | -0.0 | yes |
| Fountain Street & Spring Street West | -80.525846, 43.468991 | road | -0.0 | yes |
| Fountain Street & Young Street West | -80.525606, 43.468177 | road | 0.01 | yes |
| Fullerton Street & Park Street | -80.522584, 43.459994 | road | 0.0 | yes |
| George Street & Herbert Street | -80.518352, 43.462706 | road | 0.03 | yes |
| George Street & King Street South | -80.520275, 43.46095 | major_road | 0.03 | yes |
| George Street & Willow Street | -80.516913, 43.463998 | road | -0.01 | yes |
| Hagey Boulevard & Wes Graham Way | -80.547115, 43.475984 | road | 0.0 | yes |
| Hawthorn Street & Hickory Street West | -80.52769, 43.477849 | road | 0.0 | yes |
| Hazel Street & Hickory Street West | -80.529892, 43.477596 | road | -0.0 | yes |
| Hazel Street & High Street | -80.532278, 43.48066 | road | 0.03 | yes |
| Hazel Street & MidCampus Drive & University Avenue West | -80.528028, 43.475057 | major_road | -0.01 | yes |
| Hemlock Street & Hickory Street West | -80.532722, 43.477021 | road | -0.01 | yes |
| Hemlock Street & University Avenue West | -80.530622, 43.474128 | major_road | 0.01 | yes |
| Herbert Street & William Street East | -80.519503, 43.463367 | road | 0.01 | yes |
| Hickory Street East & Hickory Street West & King Street North | -80.525369, 43.4781 | major_road | 0.0 | yes |
| Hickory Street East & Regina Street North | -80.5243, 43.478946 | roof | 66.95 | NO |
| Hickory Street West & Larch Street | -80.531311, 43.477308 | road | 0.01 | yes |
| Hickory Street West & Lester Street | -80.536144, 43.475756 | road | 0.01 | yes |
| Hickory Street West & State Street | -80.528382, 43.477768 | road | -0.0 | yes |
| Hickory Street West & Sunview Street | -80.534907, 43.476194 | road | 0.0 | yes |
| Hughes Lane & Laurel Trail | -80.521531, 43.464382 | road | 0.0 | yes |
| Hughes Lane & William Street East | -80.520924, 43.462101 | road | -0.0 | yes |
| Hughes Lane & Willis Way | -80.521347, 43.463719 | road | 0.0 | yes |
| Iroquois Place & Longfellow Drive | -80.545895, 43.465385 | road | 0.01 | yes |
| James Street & King Street North | -80.524072, 43.471923 | roof | 60.91 | NO |
| John Street East & John Street West & King Street South | -80.517622, 43.459322 | major_road | 0.01 | yes |
| John Street East & King Street South | -80.517502, 43.459429 | major_road | -0.0 | yes |
| John Street West & Park Street | -80.519106, 43.457953 | road | 0.01 | yes |
| King Street North & Lodge Street | -80.524425, 43.473599 | major_road | 0.04 | yes |
| King Street North & Marshall Street | -80.524205, 43.472554 | major_road | -0.0 | yes |
| King Street North & Noecker Street | -80.523951, 43.471323 | major_road | -0.02 | yes |
| King Street North & Princess Street East & Princess Street West | -80.522843, 43.466843 | major_road | -0.0 | yes |
| King Street North & Spring Street East & Spring Street West | -80.523492, 43.469305 | major_road | -0.0 | yes |
| King Street North & University Avenue East & University Avenue West | -80.524969, 43.476153 | major_road | -0.0 | yes |
| King Street North & Young Street East & Young Street West | -80.523283, 43.468493 | major_road | 0.0 | yes |
| King Street South & Kuntz Lane | -80.520692, 43.461183 | major_road | 0.0 | yes |
| King Street South & William Street East & William Street West | -80.521401, 43.461659 | major_road | -0.0 | yes |
| King Street South & Willis Way | -80.521954, 43.463624 | major_road | 0.03 | yes |
| Kuntz Lane & William Street West | -80.521758, 43.461307 | road | 0.0 | yes |
| Laurel Street & Moore Avenue North | -80.5167, 43.468278 | road | 0.01 | yes |
| Laurel Street & Peppler Street | -80.519101, 43.465846 | road | -0.0 | yes |
| Laurel Street & Tweed Street | -80.517869, 43.466909 | road | -0.01 | yes |
| Laurel Trail & Regina Street South | -80.520937, 43.464473 | road | -0.01 | yes |
| Lester Street & Seagram Drive | -80.531811, 43.470924 | road | -0.0 | yes |
| Lester Street & University Avenue West | -80.533965, 43.472871 | wall | 38.2 | NO |
| Lincoln Road & Weber Street North | -80.513717, 43.471115 | major_road | -0.01 | yes |
| Lions Court & The Lions Gate | -80.551392, 43.467658 | road | 0.04 | yes |
| Lodge Street & Regina Street North | -80.522851, 43.474113 | road | -0.0 | yes |
| Lodge Street & Weber Street North | -80.517975, 43.475858 | major_road | 0.0 | yes |
| Longfellow Drive & Mohawk Avenue | -80.547942, 43.465131 | road | -0.0 | yes |
| Longfellow Drive & Shakespeare Drive & Shakespeare Place | -80.55041, 43.465913 | road | 0.02 | yes |
| Longfellow Drive & Tennyson Place | -80.546576, 43.465095 | road | -0.0 | yes |
| Longfellow Drive & Westmount Road North | -80.545382, 43.465734 | major_road | 0.0 | yes |
| Mackay Crescent & Weber Street North | -80.514976, 43.472257 | major_road | 0.0 | yes |
| Maple Court & State Court | -80.527171, 43.47675 | road | -0.01 | yes |
| Maple Court & University Avenue West | -80.526022, 43.475787 | major_road | -0.0 | yes |
| Marshall Street & Regina Street North | -80.522627, 43.473076 | road | 0.01 | yes |
| Marshall Street & Weber Street North | -80.517274, 43.474979 | major_road | -0.01 | yes |
| Noecker Street & Peppler Street | -80.520644, 43.471735 | road | -0.0 | yes |
| Noecker Street & Regina Street North | -80.522707, 43.471474 | road | -0.0 | yes |
| Noecker Street & Weber Street North | -80.516037, 43.473456 | major_road | -0.01 | yes |
| Norman Street & Park Street | -80.522133, 43.459719 | road | 0.01 | yes |
| North Campus Road & Ring Road | -80.545799, 43.474106 | road | -0.03 | yes |
| Old Post Road & Post Horn Place | -80.554377, 43.466781 | road | 0.03 | yes |
| Old Post Road & Westmount Road North | -80.551782, 43.469029 | major_road | -0.01 | yes |
| Park Street & William Street West | -80.522824, 43.460343 | road | 0.02 | yes |
| Path 1 West & Ring Road | -80.543766, 43.468312 | road | 0.01 | yes |
| Peppler Street & Princess Street East | -80.519494, 43.467297 | road | 0.0 | yes |
| Peppler Street & Young Street East | -80.519926, 43.468922 | road | -0.01 | yes |
| Phillip Street & Transit Plaza Road | -80.538408, 43.474918 | road | 0.01 | yes |
| Phillip Street & University Avenue West | -80.536266, 43.472045 | major_road | 0.01 | yes |
| Princess Street East & Regina Street North | -80.521634, 43.467008 | road | 0.04 | yes |
| Regina Street North & Spring Street East | -80.522283, 43.469467 | road | 0.01 | yes |
| Regina Street North & University Avenue East | -80.523766, 43.476582 | major_road | 0.0 | yes |
| Regina Street North & Young Street East | -80.52207, 43.468648 | road | 0.0 | yes |
| Regina Street South & William Street East | -80.520424, 43.46255 | road | -0.01 | yes |
| Regina Street South & Willis Way | -80.520747, 43.463806 | road | -0.0 | yes |
| Residence Road & Villages Road | -80.554345, 43.471216 | road | 0.0 | yes |
| Rev Road & Villages Road | -80.553242, 43.471604 | road | -0.0 | yes |
| Ring Road & Seagram Drive & University Avenue West | -80.539135, 43.468797 | major_road | -0.01 | yes |
| Ring Road & Transit Plaza Road & William Tutte Way | -80.541919, 43.473562 | road | -0.0 | yes |
| Ring Road & Villages Road | -80.548082, 43.47262 | road | -0.0 | yes |
| Seagram Drive & University Avenue West | -80.538986, 43.468753 | major_road | 0.01 | yes |
| Sunview Street & University Avenue West | -80.532814, 43.473289 | major_road | 0.0 | yes |
| The Lions Gate & Westmount Road North | -80.548823, 43.468502 | major_road | 0.01 | yes |
| University Avenue East & Weber Street North | -80.519795, 43.478014 | major_road | -0.01 | yes |
| University Avenue West & Westmount Road North | -80.541504, 43.464297 | major_road | 0.01 | yes |
| University Campus Lane & Westmount Road North | -80.549481, 43.468865 | major_road | -0.0 | yes |
| Villages Road & West Culdesac | -80.552122, 43.471999 | road | -0.0 | yes |
| William Street East & Willow Street | -80.517528, 43.464499 | rail | 0.04 | NO |

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
