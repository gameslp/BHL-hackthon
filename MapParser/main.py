from osm_parser import parse_osm_file
from overpass_fetcher import fetch_buildings


def save_to_geojson(gdf, output_path="buildings.geojson"):
    if gdf is None or gdf.empty:
        print("No buildings to save")
        return

    gdf.to_file(output_path, driver='GeoJSON')
    print(f"Saved {len(gdf)} buildings to {output_path}")


def main():
    # Option 1: Parse existing OSM file
    # buildings = parse_osm_file("map.osm")

    # Option 2: Fetch from Overpass API (uncomment to use)
    # bbox format: (south, west, north, east)
    buildings = fetch_buildings(bbox=(52.26, 20.60, 52.27, 20.64))

    save_to_geojson(buildings)


if __name__ == "__main__":
    main()
