# Midtown Manhattan map data

The playable map is a geographic snapshot of Midtown Manhattan from NYC Open Data and NYC DOT. It covers the area around Times Square, Bryant Park, Grand Central Terminal, Rockefeller Center and the south edge of Central Park. It is a compact neighborhood, not the whole borough.

## Imported datasets

| In game | NYC Open Data source | Use |
| --- | --- | --- |
| `src/data/manhattan-buildings.json` | [Building Footprints (5zhs-2jue)](https://data.cityofnewyork.us/Housing-Development/Building-Footprints/5zhs-2jue) | Official building polygons and source height fields |
| `src/data/manhattan-roads.json` | [Street Centerline (CSCL), inkn-q76z](https://data.cityofnewyork.us/City-Government/Street-Centerline-CSCL/inkn-q76z) | Official street centerlines, road names, widths, lanes and direction where available |
| `src/data/manhattan-signs.json` | [Parking Regulation Locations and Signs (nfid-uabd)](https://data.cityofnewyork.us/Transportation/Parking-Regulation-Locations-and-Signs/nfid-uabd) | NYC DOT parking sign post coordinates and plate descriptions |

The snapshots were retrieved on 14 October 2026 by `scripts/import-manhattan.py`. The script clips the source features to longitude −74.000 to −73.960 and latitude 40.748 to 40.780, then projects them into the game coordinate system at 0.55 scale. Snapshot counts: 8,032 building footprints, 2,294 street segments and 6,309 sign posts. Sign coordinates are transformed from NYC State Plane (EPSG:2263); multiple sign plates at one post are grouped together.

Building footprints and street segments are source features. Each building renders as one instanced, window-textured rectangular massing box oriented and sized from its source footprint; its exact footprint polygon remains active for collision. This is a lightweight visualization, not a photogrammetric model. A positive source roof height is scaled for gameplay. Twenty-one records without a usable height use a 12 m fallback and carry `heightSource: "estimated-default"`. Roads are rendered at ground level because these datasets do not provide measured vertical clearances. Road widths and lane markings are simplified for the game. Parking sign posts use the NYC DOT source locations; the current renderer uses a shared white regulatory sign appearance rather than typesetting every plate description.

## Public destinations and content

`src/data/manhattan-landmarks.json` contains public destination anchors for Times Square, the Empire State Building, Grand Central Terminal, Rockefeller Center, Bryant Park and Central Park South. These names are navigation/map annotations; the scene does not add substitute architecture over the official footprint layer. The game does not render alcohol, gambling, adult-entertainment or other adult venue assets. Fictional purchasable property listings have been removed.

## Attribution and limits

The snapshots come from the City of New York / NYC Open Data. See the individual source pages above for dataset metadata and terms. The in-game credit links to NYC Open Data. Data can be incomplete or change over time, and the game snapshot is not an official navigation product. Buildings use simplified extruded footprints, no building interiors are mapped, and no traffic controls or measured road elevations are reconstructed.
