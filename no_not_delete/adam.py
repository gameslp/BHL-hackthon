import json
import os
import csv
import requests
from PIL import Image
from io import BytesIO
import math


def lat_lng_to_pixel_in_tile(lat, lng, zoom):
    """Convert lat/lng to pixel position within a tile."""
    lat_rad = math.radians(lat)
    n = 2.0 ** zoom
    x = (lng + 180.0) / 360.0 * n
    y = (1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n

    x_tile = int(x)
    y_tile = int(y)

    pixel_x = int((x - x_tile) * 256)
    pixel_y = int((y - y_tile) * 256)

    return x_tile, y_tile, pixel_x, pixel_y


def calculate_polygon_center(coordinates):
    """Calculate the center point of a polygon."""
    # Handle both Polygon and MultiPolygon
    if isinstance(coordinates[0][0], list):
        # It's a polygon with rings
        polygon = coordinates[0]
    else:
        # It's a simple list of coordinates
        polygon = coordinates

    lngs = [point[0] for point in polygon]
    lats = [point[1] for point in polygon]

    center_lng = sum(lngs) / len(lngs)
    center_lat = sum(lats) / len(lats)

    return center_lat, center_lng


def download_satellite_image(lat, lng, output_path, size=100, zoom=20):
    """Download satellite image using Google Satellite tiles."""
    x_tile, y_tile, pixel_x, pixel_y = lat_lng_to_pixel_in_tile(lat, lng, zoom)
    tiles_needed = 2
    tile_size = 256
    combined_size = tile_size * tiles_needed
    combined_image = Image.new('RGB', (combined_size, combined_size))

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }

    for i in range(tiles_needed):
        for j in range(tiles_needed):
            tx = x_tile - tiles_needed // 2 + i
            ty = y_tile - tiles_needed // 2 + j

            url = f"https://mt1.google.com/vt/lyrs=s&x={tx}&y={ty}&z={zoom}"

            try:
                response = requests.get(url, headers=headers, timeout=30)
                response.raise_for_status()
                tile_img = Image.open(BytesIO(response.content))
                combined_image.paste(tile_img, (i * tile_size, j * tile_size))
            except Exception as e:
                print(f"  Error downloading tile ({tx}, {ty}): {e}")
                gray_tile = Image.new('RGB', (tile_size, tile_size), (128, 128, 128))
                combined_image.paste(gray_tile, (i * tile_size, j * tile_size))

    center_x = (tiles_needed // 2) * tile_size + pixel_x
    center_y = (tiles_needed // 2) * tile_size + pixel_y

    half_size = size // 2
    left = max(0, center_x - half_size)
    top = max(0, center_y - half_size)
    right = min(combined_size, center_x + half_size)
    bottom = min(combined_size, center_y + half_size)

    cropped = combined_image.crop((left, top, right, bottom))

    if cropped.size != (size, size):
        cropped = cropped.resize((size, size), Image.LANCZOS)

    cropped.save(output_path, 'PNG')
    return True


def download_satellite_image_bing(lat, lng, output_path, size=100, zoom=20):
    """Fallback: Download satellite image using Bing Maps tiles."""

    def tile_to_quadkey(x, y, z):
        quadkey = ""
        for i in range(z, 0, -1):
            digit = 0
            mask = 1 << (i - 1)
            if (x & mask) != 0:
                digit += 1
            if (y & mask) != 0:
                digit += 2
            quadkey += str(digit)
        return quadkey

    x_tile, y_tile, pixel_x, pixel_y = lat_lng_to_pixel_in_tile(lat, lng, zoom)

    tiles_needed = 2
    tile_size = 256
    combined_size = tile_size * tiles_needed
    combined_image = Image.new('RGB', (combined_size, combined_size))

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }

    for i in range(tiles_needed):
        for j in range(tiles_needed):
            tx = x_tile - tiles_needed // 2 + i
            ty = y_tile - tiles_needed // 2 + j

            quadkey = tile_to_quadkey(tx, ty, zoom)
            url = f"https://ecn.t0.tiles.virtualearth.net/tiles/a{quadkey}.jpeg?g=1"

            try:
                response = requests.get(url, headers=headers, timeout=30)
                response.raise_for_status()
                tile_img = Image.open(BytesIO(response.content))
                if tile_img.mode != 'RGB':
                    tile_img = tile_img.convert('RGB')
                combined_image.paste(tile_img, (i * tile_size, j * tile_size))
            except Exception as e:
                gray_tile = Image.new('RGB', (tile_size, tile_size), (128, 128, 128))
                combined_image.paste(gray_tile, (i * tile_size, j * tile_size))

    center_x = (tiles_needed // 2) * tile_size + pixel_x
    center_y = (tiles_needed // 2) * tile_size + pixel_y

    half_size = size // 2
    left = max(0, center_x - half_size)
    top = max(0, center_y - half_size)
    right = min(combined_size, center_x + half_size)
    bottom = min(combined_size, center_y + half_size)

    cropped = combined_image.crop((left, top, right, bottom))

    if cropped.size != (size, size):
        cropped = cropped.resize((size, size), Image.LANCZOS)

    cropped.save(output_path, 'PNG')
    return True


def load_buildings_json(json_path):
    """Load buildings data from JSON file."""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data


def main():
    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(script_dir, 'buildings-checked.json')
    output_dir = os.path.join(script_dir, 'building_images_labeled')
    csv_path = os.path.join(script_dir, 'building_labels.csv')

    # Create output directory
    os.makedirs(output_dir, exist_ok=True)

    # Load buildings data
    print(f"Loading buildings from {json_path}...")
    
    try:
        buildings_data = load_buildings_json(json_path)
    except FileNotFoundError:
        print(f"Error: File {json_path} not found!")
        return
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
        return

    # Determine data structure
    if isinstance(buildings_data, list):
        buildings = buildings_data
    elif isinstance(buildings_data, dict):
        # Could be GeoJSON FeatureCollection or other structure
        if 'features' in buildings_data:
            buildings = buildings_data['features']
        elif 'buildings' in buildings_data:
            buildings = buildings_data['buildings']
        else:
            buildings = [buildings_data]
    else:
        print("Unknown data structure in JSON")
        return

    print(f"Found {len(buildings)} buildings")

    # Prepare CSV data
    csv_data = []
    successful = 0
    failed = 0

    for i, building in enumerate(buildings):
        # Extract geometry and asbestos info
        # Adapt this based on your actual JSON structure
        
        if isinstance(building, dict):
            # Try different possible structures
            geometry = building.get('geometry', {})
            properties = building.get('properties', building)
            
            # Get coordinates
            if 'coordinates' in geometry:
                coordinates = geometry['coordinates']
                geom_type = geometry.get('type', 'Polygon')
            elif 'coordinates' in building:
                coordinates = building['coordinates']
                geom_type = building.get('type', 'Polygon')
            else:
                print(f"  Skipping building {i}: No coordinates found")
                continue

            # Get asbestos label - try different possible field names
            has_asbestos = None
            for key in ['asbestos', 'has_asbestos', 'azbest', 'contains_asbestos', 'isAsbestos', 'asbestosPresent']:
                if key in properties:
                    has_asbestos = properties[key]
                    break
                if key in building:
                    has_asbestos = building[key]
                    break
            
            # Convert to boolean/int if needed
            if has_asbestos is None:
                # Check if there's any field that might indicate asbestos
                print(f"  Warning: No asbestos field found for building {i}")
                print(f"    Available fields: {list(properties.keys()) if isinstance(properties, dict) else 'N/A'}")
                has_asbestos = 0  # Default to no asbestos
            elif isinstance(has_asbestos, bool):
                has_asbestos = 1 if has_asbestos else 0
            elif isinstance(has_asbestos, str):
                has_asbestos = 1 if has_asbestos.lower() in ['true', 'yes', 'tak', '1'] else 0
            else:
                has_asbestos = int(has_asbestos) if has_asbestos else 0

            # Calculate center
            try:
                if geom_type == 'MultiPolygon':
                    # Use first polygon for center
                    lat, lng = calculate_polygon_center(coordinates[0])
                else:
                    lat, lng = calculate_polygon_center(coordinates)
            except Exception as e:
                print(f"  Skipping building {i}: Error calculating center - {e}")
                continue

            # Create filename
            filename = f"{lat:.7f}_{lng:.7f}.png"
            output_path = os.path.join(output_dir, filename)

            print(f"Downloading image {i + 1}/{len(buildings)}: {filename} (asbestos: {has_asbestos})")

            # Download image
            try:
                if download_satellite_image(lat, lng, output_path, size=128, zoom=20):
                    print(f"  ✓ Saved: {filename}")
                    successful += 1
                    csv_data.append({
                        'filename': filename,
                        'latitude': lat,
                        'longitude': lng,
                        'has_asbestos': has_asbestos
                    })
                else:
                    raise Exception("Google failed")
            except:
                try:
                    if download_satellite_image_bing(lat, lng, output_path, size=128, zoom=20):
                        print(f"  ✓ Saved (Bing): {filename}")
                        successful += 1
                        csv_data.append({
                            'filename': filename,
                            'latitude': lat,
                            'longitude': lng,
                            'has_asbestos': has_asbestos
                        })
                    else:
                        print(f"  ✗ Failed: {filename}")
                        failed += 1
                except Exception as e:
                    print(f"  ✗ Failed: {filename} - {e}")
                    failed += 1

    # Save CSV
    print(f"\nSaving labels to {csv_path}...")
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['filename', 'latitude', 'longitude', 'has_asbestos'])
        writer.writeheader()
        writer.writerows(csv_data)

    print(f"\nDone!")
    print(f"  Successful: {successful}")
    print(f"  Failed: {failed}")
    print(f"  Images saved to: {output_dir}")
    print(f"  Labels saved to: {csv_path}")
    
    # Print asbestos statistics
    asbestos_count = sum(1 for row in csv_data if row['has_asbestos'] == 1)
    no_asbestos_count = sum(1 for row in csv_data if row['has_asbestos'] == 0)
    print(f"\nAsbestos statistics:")
    print(f"  With asbestos: {asbestos_count}")
    print(f"  Without asbestos: {no_asbestos_count}")


if __name__ == "__main__":
    main()
