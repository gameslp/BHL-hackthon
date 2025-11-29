import osmnx as ox
from config import ALLOWED_BUILDING_TYPES


def parse_osm_file(osm_file_path):
    print(f"Parsing OSM file: {osm_file_path}")

    gdf = ox.features_from_xml(osm_file_path, tags={'building': True})
    print(f"Found {len(gdf)} total buildings")

    if not gdf.empty and 'building' in gdf.columns:
        gdf = gdf[gdf['building'].isin(ALLOWED_BUILDING_TYPES)]
        print(f"Filtered to {len(gdf)} buildings")

    return gdf[['geometry', 'building']].copy() if not gdf.empty else gdf
