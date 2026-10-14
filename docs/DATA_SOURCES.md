# Road and toll data

## Actual imported road data

`src/data/dubai-roads.json` contains 241 OSM road pieces fetched on 11 October 2026. The source snapshot timestamp is included in the file. The Overpass selection was `highway=motorway|trunk` within latitude 25.11–25.24, longitude 55.18–55.36; full intersecting ways were subsequently clipped to a larger envelope. The snapshot includes parts of E11, D68, E44, E66, D71, D75, D83, D79 and E311. Coverage is regional and incomplete, particularly at the outer boundary. It is not the entire Dubai road network.

Geometry is projected from longitude/latitude around `[55.2744,25.1972]`, then compressed to 25% of geographic horizontal distances. One game metre represents roughly four real-world metres horizontally. Road widths are adjusted for the avatar/car scale; lanes rendered are simplified. OSM way IDs, names, refs, lanes and bridge/layer tags are retained for future refinement.

The first pass renders the highway network at ground level. Multi-level interchanges, ramps, coastlines, traffic rules and buildings are not geographically reconstructed. The central plaza, access road and buildings are procedural scenery. They are not surveyed Dubai architecture or a navigational map. The previous compact district layout has been replaced by this geographic road backbone.

Source: https://www.openstreetmap.org/copyright
API: https://overpass-api.de/api/interpreter
OSM node API: https://api.openstreetmap.org/api/0.6/nodes.json

The extracted geographic databases in `src/data/` are available under ODbL 1.0, https://opendatacommons.org/licenses/odbl/1-0/. In-game attribution is visible at the bottom of the screen. This data license does not imply a license for unrelated project code.

## Salik gate positions

`src/data/dubai-gates.json` contains 10 gantry nodes on the imported ways, representing five named gate locations/directional gantries: Al Barsha, Al Safa North, Al Safa South, Al Garhoud Bridge and Business Bay Crossing. These are **not all 10 named Salik gates in Dubai**. Nodes were retrieved via the OSM API. Positions are taken directly from the node coordinates. Node 1061530398 was named “Al Safa South” in OSM despite being next to the Al Safa North carriageway node; its display name is normalised to Al Safa North. The original OSM label is retained in `osmName`. Community map labels and positions can be wrong.

Official operator sources used for the gameplay tariff:

- Standard schedule: Salik 2024 annual report, https://ar2024.salik.ae/download/full-reports/ar_en_annual-report_pages_salik_2024.pdf
- Linked Al Safa rule: Salik press release, https://feeds.dfm.ae/documents/2024/Jan/19/525580ae-d331-4e02-b7a0-2e5731bb541f/PRL%20Salik_New%20Gate-%20Final%20-%20E.pdf
- 5% VAT from 1 June 2026: Salik disclosure, https://feeds.dfm.ae/documents/2026/May/22/2d9de89d-e273-4fad-bc1d-83857588a7af/General%20Disclosure%2022%205%202026%20FVS.Pdf.pdf

The game evaluates the server's real clock in Asia/Dubai. Standard peak periods are 06:00–10:00 and 16:00–20:00; off-peak is AED 4 before VAT, peak is AED 6 before VAT, and 01:00–06:00 is free. Ordinary Sundays use off-peak pricing. `SALIK_SPECIAL_DAY=true` makes Sunday use the normal peak schedule for operator-declared exceptional days. `SALIK_RAMADAN=true` selects the Ramadan schedule. The host manages these switches; the game does not download holiday/event schedules automatically.

A same-direction Al Safa North/South passage within one real hour produces one charge. Gantry jitter and opposite-carriageway duplicates are suppressed. Walking and resetting position do not trigger tolls. This is an in-game simulation, not a Salik account integration or a real billing service.

## Attached terrain scaffold

The supplied `terrain.3mf` contains six meshes, about 140,190 vertices and 267,747 triangles, in millimetres. It has no latitude/longitude metadata. It has not been added to the game or used to place real roads. Importing it later needs a known geographic area, at least two reference coordinates, geometry optimisation and collision preparation.

## Landmark anchors (11 October 2026)

`src/data/dubai-landmarks.json` records coordinates and source IDs. Five anchors are the arithmetic mean of nodes returned by the OpenStreetMap API `/api/0.6/way/{id}/full.json`: Burj Khalifa 446646206; Mall of the Emirates 175115425; Museum of the Future 1054289435; Dubai Frame 386649647; Burj Al Arab 12700546. This representative point is not a surveyed entrance. OSM © contributors, ODbL; existing in-game attribution remains visible.

Dubai Mall uses an approximate POI coordinate 25.198518, 55.279619 from https://www.gps-latitude-longitude.com/gps-coordinates-of-dubai-mall (also corroborated by https://www.coordinatesfinder.com/coordinates/93945-dubai-mall). It is explicitly labeled approximate in the data. Mall geometry is compressed to keep imported highway paths clear. All rendered models/footprints, entrance locations, sidewalks, parking and local connectors are authored approximations, not imported cadastral or architectural data. Height is scaled for gameplay; Burj Khalifa's simplified 207-unit tower represents 828 metres at quarter scale.

Ground cover now includes authored urban paving, parking pads and green-space patches around road corridors and landmarks. These patches are not surveyed land-use polygons or a complete reconstruction of Dubai's coastline/landscape. No sand texture is applied uniformly across the world.

## Real-distance Dubai pass (12 October 2026)

The projection now has horizontalScale=1. Coordinates use a local equirectangular metre approximation around Downtown, not survey-grade geodesy. Earlier quarter-scale references describe prior versions. Building and street extracts were retrieved from the public OSM map API `/api/0.6/map.json?bbox=...` using the two bounding boxes documented in README. ODbL attribution remains in-game and in the data. Reproduction script: `scripts/import-buildings.py`.

95 simple closed building ways are retained; multipolygon relation holes are not imported. Their coordinate extent is 55.1968769–55.2841935 E and 25.1155707–25.2027428 N. This is a partial snapshot, not a complete Dubai building inventory. The renderer uses these mapped footprints plus the separately named real landmark models, and no longer fills unmapped areas with invented building blocks. Height provenance is saved for each outline: 43 `height` tags, 9 `building:levels × 3.2m` estimates, 43 explicitly estimated 10m heights. 394 outdoor street ways retain their geographic nodes; indoor and non-ground parking levels are excluded. Widths are estimated from lane counts; unknown lanes default to two. There is no measured road-elevation dataset, so all roads render at ground level; a `bridge` or `layer` tag alone does not provide a bridge's vertical clearance. Primary reference: https://wiki.openstreetmap.org/wiki/Key:layer . Existing gate coordinates are unchanged; geographic projection rescales their placement automatically.
