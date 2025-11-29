import geopandas as gpd
import osmnx as ox
from pathlib import Path


def parse_osm_buildings(osm_file_path):
    """
    Parse an OSM file and extract all buildings.

    Parameters:
    -----------
    osm_file_path : str
        Path to the .osm file

    Returns:
    --------
    GeoDataFrame containing all buildings with their geometries and attributes
    """
    print(f"Parsing OSM file: {osm_file_path}")

    ALLOWED_BUILDING_TYPES = {
        'house', 'detached', 'residential', 'apartments', 'bungalow',
        'semidetached_house', 'terrace', 'dormitory', 'hotel',
        'garage', 'garages', 'parking',
        'office', 'commercial', 'retail', 'shop', 'supermarket', 'mall',
        'industrial', 'warehouse', 'factory',
        'school', 'university', 'college', 'kindergarten',
        'hospital', 'clinic',
        'church', 'chapel', 'mosque', 'temple', 'synagogue',
        'civic', 'public', 'government',
        'yes'  # Generic building tag
    }

    try:
        gdf = ox.features_from_xml(
            osm_file_path,
            tags={'building': True}  
        )

        print(f"\nFound {len(gdf)} total buildings in the OSM file")

        if not gdf.empty and 'building' in gdf.columns:
            gdf = gdf[gdf['building'].isin(ALLOWED_BUILDING_TYPES)]

        if not gdf.empty:
            if 'building' in gdf.columns:
                building_types = gdf['building'].value_counts()
                print(f"\nBuilding types distribution:")
                print(building_types)

        return gdf

    except Exception as e:
        print(f"Error parsing OSM file: {e}")
        return None


def save_buildings_to_file(gdf, output_path, format='geojson'):
    if gdf is None or gdf.empty:
        print("No buildings to save.")
        return

    try:
        gdf.to_file(output_path, driver='GeoJSON')
    except Exception as e:
        print(f"Error saving file: {e}")


def main():
    osm_file = "map.osm"

    buildings = parse_osm_buildings(osm_file)

    if buildings is not None and not buildings.empty:
        simplified_buildings = buildings[['geometry', 'building']].copy()

        # Display first few buildings
        print("\n" + "="*50)
        print("Sample of building data:")
        print("="*50)
        print(simplified_buildings.head())

        output_file = "buildings.geojson"
        save_buildings_to_file(simplified_buildings, output_file, format='geojson')
    else:
        print("No buildings found or error occurred during parsing.")


if __name__ == "__main__":
    main()
