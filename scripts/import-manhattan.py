#!/usr/bin/env python3
"""Download a compact, official NYC Open Data snapshot for Midtown Manhattan."""
import json
import math
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "data"
BOUNDS = {"west": -74.0, "south": 40.748, "east": -73.96, "north": 40.78}
ORIGIN = (-73.982, 40.764)
SCALE = 0.55


def fetch(dataset, params):
    query = urllib.parse.urlencode(params)
    url = f"https://data.cityofnewyork.us/resource/{dataset}.json?{query}"
    request = urllib.request.Request(url, headers={"User-Agent": "GCAV-Manhattan-Map/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.load(response)


def in_bounds(lon, lat):
    return BOUNDS["west"] <= lon <= BOUNDS["east"] and BOUNDS["south"] <= lat <= BOUNDS["north"]


def local(lon, lat):
    return [round((lon - ORIGIN[0]) * 111320 * math.cos(math.radians(ORIGIN[1])) * SCALE, 2),
            round(-(lat - ORIGIN[1]) * 111320 * SCALE, 2)]


def inverse_ny_state_plane(x_ft, y_ft):
    # Inverse NAD83 / New York Long Island (US survey feet), EPSG:2263.
    a, inv_f = 6378137.0, 298.257222101
    f = 1 / inv_f
    e = math.sqrt(f * (2 - f))
    rad = math.radians
    lat1, lat2, lat0 = map(rad, (41 + 2 / 60, 40 + 40 / 60, 40 + 10 / 60))
    lon0 = rad(-74)

    def m(phi):
        return math.cos(phi) / math.sqrt(1 - e * e * math.sin(phi) ** 2)

    def t(phi):
        return math.tan(math.pi / 4 - phi / 2) / ((1 - e * math.sin(phi)) / (1 + e * math.sin(phi))) ** (e / 2)

    n = (math.log(m(lat1)) - math.log(m(lat2))) / (math.log(t(lat1)) - math.log(t(lat2)))
    factor = m(lat1) / (n * t(lat1) ** n)
    rho0 = a * factor * t(lat0) ** n
    x = x_ft * 1200 / 3937
    y = y_ft * 1200 / 3937
    dx = x - 984250 * 1200 / 3937
    dy = rho0 - y
    rho = math.copysign(math.hypot(dx, dy), n)
    theta = math.atan2(dx, dy)
    value = (rho / (a * factor)) ** (1 / n)
    lat = math.pi / 2 - 2 * math.atan(value)
    for _ in range(10):
        lat = math.pi / 2 - 2 * math.atan(value * ((1 - e * math.sin(lat)) / (1 + e * math.sin(lat))) ** (e / 2))
    return math.degrees(lon0 + theta / n), math.degrees(lat)


def write(name, payload):
    target = OUT / name
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    temporary.replace(target)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    box = f"within_box(the_geom,{BOUNDS['south']},{BOUNDS['west']},{BOUNDS['north']},{BOUNDS['east']})"
    building_rows = fetch("5zhs-2jue", {
        "$select": "the_geom,bin,doitt_id,construction_year,feature_code,geom_source,ground_elevation,height_roof,last_status_type",
        "$where": f"base_bbl like '1%' AND {box}", "$limit": 50000,
    })
    buildings = []
    for row in building_rows:
        geom = row.get("the_geom") or {}
        rings = geom.get("coordinates", [])
        if not rings:
            continue
        # Keep the exterior ring; each record is an actual city building footprint.
        polygon = [local(lon, lat) for lon, lat in rings[0][0]]
        if len(polygon) < 3:
            continue
        height = float(row.get("height_roof") or 0)
        if height <= 0:
            height = 12
            height_source = "estimated-default"
        else:
            height_source = "nyc-building-footprints-height-roof"
        buildings.append({"id": row.get("bin") or row.get("doitt_id"), "name": "", "height": round(height * SCALE, 2),
                          "heightSource": height_source, "polygon": polygon,
                          "source": "NYC Open Data BUILDING"})

    road_rows = fetch("inkn-q76z", {
        "$select": "the_geom,physicalid,trafdir,posted_speed,streetwidth,number_travel_lanes,number_total_lanes,full_street_name,from_level_code,to_level_code",
        "$where": box, "$limit": 50000,
    })
    roads = []
    for row in road_rows:
        geom = row.get("the_geom") or {}
        lines = geom.get("coordinates", [])
        if geom.get("type") == "LineString":
            lines = [lines]
        for line in lines:
            coords = [local(lon, lat) for lon, lat in line]
            if len(coords) < 2:
                continue
            feet = float(row.get("streetwidth") or 30)
            lanes = int(float(row.get("number_travel_lanes") or 0)) or 2
            roads.append({"id": row.get("physicalid"), "name": row.get("full_street_name") or "Manhattan street",
                          "direction": row.get("trafdir") or "TW", "width": round(feet * 0.3048 * SCALE, 2),
                          "lanes": lanes, "speedMph": int(float(row.get("posted_speed") or 25)), "points": coords})

    # Parking sign data is supplied in EPSG:2263. Group multiple plates on the same post.
    signs_raw = fetch("nfid-uabd", {
        "$select": "order_number,record_type,borough,on_street,from_street,to_street,side_of_street,sign_code,sign_description,sign_x_coord,sign_y_coord,order_completed_on_date,support",
        "$where": "borough='Manhattan' AND record_type='Current' AND sign_x_coord between 985000 and 994500 AND sign_y_coord between 214000 and 224000",
        "$limit": 50000,
    })
    signs_by_post = {}
    for row in signs_raw:
        try:
            lon, lat = inverse_ny_state_plane(float(row["sign_x_coord"]), float(row["sign_y_coord"]))
        except (KeyError, ValueError, TypeError):
            continue
        if not in_bounds(lon, lat):
            continue
        key = (round(float(row["sign_x_coord"])), round(float(row["sign_y_coord"])))
        post = signs_by_post.setdefault(key, {"lon": lon, "lat": lat, "street": row.get("on_street", ""), "plates": []})
        text = (row.get("sign_description") or "").strip()
        if text and text not in post["plates"]:
            post["plates"].append(text)
    signs = [{"position": local(v["lon"], v["lat"]), "street": v["street"], "plates": v["plates"][:3]}
             for v in signs_by_post.values()]

    meta = {"source": "NYC Open Data", "retrieved": time.strftime("%Y-%m-%d", time.gmtime()), "bounds": BOUNDS,
            "origin": ORIGIN, "scale": SCALE, "attribution": "NYC Open Data: NYC Department of City Planning / NYC DOT",
            "note": "The playable area is Midtown Manhattan. All building and road footprints are sourced features; heights without a positive source value use an explicitly marked 12 m estimate."}
    write("manhattan-buildings.json", {**meta, "buildings": buildings})
    write("manhattan-roads.json", {**meta, "roads": roads})
    write("manhattan-signs.json", {**meta, "signs": signs})
    print(f"Saved {len(buildings)} footprints, {len(roads)} road segments, and {len(signs)} current sign posts.")


if __name__ == "__main__":
    main()
