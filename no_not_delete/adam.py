import re
import json
import os
import requests
from PIL import Image
from io import BytesIO


def extract_geojson_from_html(html_path):
    """Extract all GeoJSON feature collections from the HTML file."""
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find all GeoJSON data in the HTML
    pattern = r'_add\((\{"features":\s*\[\{"geometry".*?\}\]\s*,\s*"type":\s*"FeatureCollection"\})\)'
    matches = re.findall(pattern, content, re.DOTALL)

    geojson_list = []
    for match in matches:
        try:
            geojson = json.loads(match)
            geojson_list.append(geojson)
        except json.JSONDecodeError:
            continue

    return geojson_list


def calculate_polygon_center(coordinates):
    """Calculate the center point of a polygon."""
    # Coordinates are in format [[[lng, lat], [lng, lat], ...]]
    polygon = coordinates[0]  # Get the outer ring

    lngs = [point[0] for point in polygon]
    lats = [point[1] for point in polygon]

    center_lng = sum(lngs) / len(lngs)
    center_lat = sum(lats) / len(lats)

    return center_lat, center_lng


def download_satellite_image(lat, lng, output_path, size=100, zoom=19):
    """Download satellite image from Esri World Imagery."""
    # Using Esri's export map image API
    # Calculate bounding box based on center point
    # At zoom 19, roughly 0.0001 degrees covers about 10 meters
    delta = 0.0003  # Adjust this to control the area captured

    bbox = f"{lng - delta},{lat - delta},{lng + delta},{lat + delta}"

    url = (
        f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export"
        f"?bbox={bbox}"
        f"&bboxSR=4326"
        f"&size={size},{size}"
        f"&imageSR=4326"
        f"&format=png"
        f"&f=image"
    )

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()

        # Open and verify the image
        img = Image.open(BytesIO(response.content))

        # Resize to exactly 100x100 if needed
        if img.size != (size, size):
            img = img.resize((size, size), Image.LANCZOS)

        # Save the image
        img.save(output_path, 'PNG')
        return True
    except Exception as e:
        print(f"Error downloading image for ({lat}, {lng}): {e}")
        return False


def main():
    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    html_path = os.path.join(script_dir, 'buildings_map.html')
    output_dir = os.path.join(script_dir, 'building_images')

    # Create output directory
    os.makedirs(output_dir, exist_ok=True)

    # Extract GeoJSON from HTML
    print("Extracting building coordinates from HTML...")
    geojson_list = extract_geojson_from_html(html_path)
    print(f"Found {len(geojson_list)} buildings")

    # Process each building
    for i, geojson in enumerate(geojson_list):
        for feature in geojson.get('features', []):
            geometry = feature.get('geometry', {})

            if geometry.get('type') == 'Polygon':
                coordinates = geometry.get('coordinates', [])

                if coordinates:
                    lat, lng = calculate_polygon_center(coordinates)

                    # Create filename with coordinates
                    filename = f"{lat:.7f}_{lng:.7f}.png"
                    output_path = os.path.join(output_dir, filename)

                    print(f"Downloading image {i + 1}/{len(geojson_list)}: {filename}")

                    if download_satellite_image(lat, lng, output_path):
                        print(f"  Saved: {output_path}")
                    else:
                        print(f"  Failed to save: {output_path}")

    print(f"\nDone! Images saved to: {output_dir}")


if __name__ == "__main__":
    main()
