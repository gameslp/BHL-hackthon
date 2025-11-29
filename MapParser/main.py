from osm_parser import parse_osm_file
from overpass_fetcher import fetch_buildings
from map_visualizer import create_map_preview
import geopandas as gpd
import os
# from image_renderer import render_satellite_image, render_individual_buildings
# from tile_generator import generate_tiles


def save_to_geojson(gdf, output_path="buildings.geojson"):
    if gdf is None or gdf.empty:
        print("No buildings to save")
        return

    gdf.to_file(output_path, driver='GeoJSON')
    print(f"Saved {len(gdf)} buildings to {output_path}")


def load_from_geojson(file_path="buildings-checked.json"):
    if os.path.exists(file_path):
        print(f"Loading buildings from {file_path}")
        gdf = gpd.read_file(file_path)
        print(f"Loaded {len(gdf)} buildings")
        return gdf
    return None


def main():
    # Option 1: Parse existing OSM file
    # buildings = parse_osm_file("map.osm")

    # Option 2: Fetch from Overpass API
    # bbox format: (south, west, north, east)
    buildings = load_from_geojson("buildings-checked.json")

    if buildings is None:
        print("No existing data found, fetching from API...")
        buildings = fetch_buildings(bbox=(52.254, 20.5822, 52.27, 20.6359))
        save_to_geojson(buildings)

    create_map_preview(buildings)

    # Render satellite imagery
    # render_satellite_image(buildings)

    # Generate 128x128 tiles with masks
    # generate_tiles(buildings, tile_size=128, output_dir="tiles")

    # Render individual buildings (uncomment to use - creates many files)
    # render_individual_buildings(buildings, output_dir="building_images")


if __name__ == "__main__":
    main()
