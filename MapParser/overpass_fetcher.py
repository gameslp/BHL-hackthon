import requests
import time
import geopandas as gpd
from shapely.geometry import Polygon
from config import ALLOWED_BUILDING_TYPES


OVERPASS_URL = "https://overpass-api.de/api/interpreter"
TIMEOUT = 180
MAX_RETRIES = 3


def build_overpass_query(bbox):
    south, west, north, east = bbox
    query = f"""
    [out:json][timeout:180];
    (
      way["building"]({south},{west},{north},{east});
      relation["building"]({south},{west},{north},{east});
    );
    out geom;
    """
    return query


def parse_overpass_response(data):
    buildings = []

    for element in data.get('elements', []):
        if 'geometry' not in element:
            continue

        building_type = element.get('tags', {}).get('building', 'yes')
        coords = [(node['lon'], node['lat']) for node in element['geometry']]

        if len(coords) >= 3:
            if coords[0] != coords[-1]:
                coords.append(coords[0])

            polygon = Polygon(coords)
            buildings.append({
                'geometry': polygon,
                'building': building_type
            })

    return gpd.GeoDataFrame(buildings, crs='EPSG:4326')


def fetch_buildings(bbox):
    print(f"Bounding box: {bbox}")
    query = build_overpass_query(bbox)

    for attempt in range(MAX_RETRIES):
        try:
            print(f"Attempt {attempt + 1}/{MAX_RETRIES}...")
            response = requests.post(OVERPASS_URL, data={'data': query}, timeout=TIMEOUT)
            response.raise_for_status()

            data = response.json()
            print(f"Received {len(data.get('elements', []))} elements from API")

            gdf = parse_overpass_response(data)
            print(f"Created {len(gdf)} building geometries")

            if not gdf.empty and 'building' in gdf.columns:
                gdf = gdf[gdf['building'].isin(ALLOWED_BUILDING_TYPES)]
                print(f"Filtered to {len(gdf)} buildings")

            return gdf

        except requests.exceptions.Timeout:
            print(f"Request timed out after {TIMEOUT}s")
            if attempt < MAX_RETRIES - 1:
                wait_time = 5 * (attempt + 1)
                print(f"Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                print("Max retries reached")
                return None
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 504 and attempt < MAX_RETRIES - 1:
                wait_time = 10 * (attempt + 1)
                print(f"Server timeout (504). Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                print(f"HTTP error: {e}")
                return None
        except requests.exceptions.RequestException as e:
            print(f"HTTP request failed: {e}")
            return None
        except Exception as e:
            print(f"Error processing data: {e}")
            return None
