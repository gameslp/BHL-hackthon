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


def calculate_bounding_box(buildings):
    """Calculate bounding box for all buildings."""
    min_lat = float('inf')
    max_lat = float('-inf')
    min_lng = float('inf')
    max_lng = float('-inf')
    
    for building in buildings:
        if isinstance(building, dict):
            geometry = building.get('geometry', {})
            
            if 'coordinates' in geometry:
                coordinates = geometry['coordinates']
                geom_type = geometry.get('type', 'Polygon')
            elif 'coordinates' in building:
                coordinates = building['coordinates']
                geom_type = building.get('type', 'Polygon')
            else:
                continue
            
            try:
                if geom_type == 'MultiPolygon':
                    lat, lng = calculate_polygon_center(coordinates[0])
                else:
                    lat, lng = calculate_polygon_center(coordinates)
                
                min_lat = min(min_lat, lat)
                max_lat = max(max_lat, lat)
                min_lng = min(min_lng, lng)
                max_lng = max(max_lng, lng)
            except:
                continue
    
    # Add 10% margin
    lat_margin = (max_lat - min_lat) * 0.1
    lng_margin = (max_lng - min_lng) * 0.1
    
    return {
        'min_lat': min_lat - lat_margin,
        'max_lat': max_lat + lat_margin,
        'min_lng': min_lng - lng_margin,
        'max_lng': max_lng + lng_margin
    }


def download_area_image(bbox, zoom=20):
    """Download large image covering entire bounding box."""
    print(f"Downloading area image for bbox: {bbox}")
    
    # Calculate tile range
    min_x_tile, min_y_tile, _, _ = lat_lng_to_pixel_in_tile(bbox['max_lat'], bbox['min_lng'], zoom)
    max_x_tile, max_y_tile, _, _ = lat_lng_to_pixel_in_tile(bbox['min_lat'], bbox['max_lng'], zoom)
    
    tiles_x = max_x_tile - min_x_tile + 1
    tiles_y = max_y_tile - min_y_tile + 1
    
    print(f"  Tiles needed: {tiles_x}x{tiles_y} = {tiles_x * tiles_y} tiles")
    
    tile_size = 256
    combined_size_x = tile_size * tiles_x
    combined_size_y = tile_size * tiles_y
    combined_image = Image.new('RGB', (combined_size_x, combined_size_y))
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    total_tiles = tiles_x * tiles_y
    downloaded = 0
    
    for i in range(tiles_x):
        for j in range(tiles_y):
            tx = min_x_tile + i
            ty = min_y_tile + j
            
            url = f"https://mt1.google.com/vt/lyrs=s&x={tx}&y={ty}&z={zoom}"
            
            try:
                response = requests.get(url, headers=headers, timeout=30)
                response.raise_for_status()
                tile_img = Image.open(BytesIO(response.content))
                combined_image.paste(tile_img, (i * tile_size, j * tile_size))
                downloaded += 1
                if downloaded % 10 == 0:
                    print(f"  Progress: {downloaded}/{total_tiles} tiles")
            except Exception as e:
                print(f"  Error downloading tile ({tx}, {ty}): {e}")
                gray_tile = Image.new('RGB', (tile_size, tile_size), (128, 128, 128))
                combined_image.paste(gray_tile, (i * tile_size, j * tile_size))
    
    print(f"  ✓ Downloaded {downloaded}/{total_tiles} tiles successfully")
    
    return combined_image, {
        'min_x_tile': min_x_tile,
        'min_y_tile': min_y_tile,
        'zoom': zoom
    }


def extract_building_image(area_image, area_info, lat, lng, size=128):
    """Extract building image from large area image."""
    x_tile, y_tile, pixel_x, pixel_y = lat_lng_to_pixel_in_tile(lat, lng, area_info['zoom'])
    
    # Calculate position in the large image
    tile_offset_x = x_tile - area_info['min_x_tile']
    tile_offset_y = y_tile - area_info['min_y_tile']
    
    center_x = tile_offset_x * 256 + pixel_x
    center_y = tile_offset_y * 256 + pixel_y
    
    # Crop
    half_size = size // 2
    left = max(0, center_x - half_size)
    top = max(0, center_y - half_size)
    right = min(area_image.width, left + size)
    bottom = min(area_image.height, top + size)
    
    # Check if building is within the image
    if right - left < size or bottom - top < size:
        return None
    
    cropped = area_image.crop((left, top, right, bottom))
    return cropped


def download_satellite_image(lat, lng, output_path, size=128, zoom=20):
    """Download satellite image using Google Satellite tiles."""
    x_tile, y_tile, pixel_x, pixel_y = lat_lng_to_pixel_in_tile(lat, lng, zoom)
    
    # Use more tiles to ensure no black borders
    tile_size = 256
    tiles_needed = 3  # 3x3 grid gives plenty of margin
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

    # Calculate center position
    center_x = (tiles_needed // 2) * tile_size + pixel_x
    center_y = (tiles_needed // 2) * tile_size + pixel_y

    # Crop exactly size x size pixels centered on the building
    half_size = size // 2
    left = center_x - half_size
    top = center_y - half_size
    right = left + size
    bottom = top + size

    cropped = combined_image.crop((left, top, right, bottom))

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
    json_path = os.path.join(script_dir, 'buildings-balanced.json')
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

    # Ask user which method to use
    print("\n" + "="*60)
    print("Choose download method:")
    print("  1. Fast method - Download one large area image first (recommended)")
    print("     Pros: Much faster, fewer API calls")
    print("     Cons: Uses more memory initially")
    print("\n  2. Individual method - Download each building separately")
    print("     Pros: Lower memory usage")
    print("     Cons: Much slower, more API calls")
    print("="*60)
    
    while True:
        choice = input("\nEnter your choice (1 or 2): ").strip()
        if choice in ['1', '2']:
            break
        print("Invalid choice. Please enter 1 or 2.")
    
    use_area_method = (choice == '1')

    # Prepare CSV data
    csv_data = []
    successful = 0
    failed = 0

    if use_area_method:
        # Fast method: Download area once, then extract
        print("\n" + "="*60)
        print("Using FAST METHOD - downloading large area image")
        print("="*60)
        
        print("\nStep 1: Calculating bounding box...")
        bbox = calculate_bounding_box(buildings)
        
        print("\nStep 2: Downloading large area image (this may take a while)...")
        area_image, area_info = download_area_image(bbox, zoom=20)

        print("\nStep 3: Extracting building images...")
        
        for i, building in enumerate(buildings):
            if isinstance(building, dict):
                geometry = building.get('geometry', {})
                properties = building.get('properties', building)

                if 'coordinates' in geometry:
                    coordinates = geometry['coordinates']
                    geom_type = geometry.get('type', 'Polygon')
                elif 'coordinates' in building:
                    coordinates = building['coordinates']
                    geom_type = building.get('type', 'Polygon')
                else:
                    print(f"  Skipping building {i}: No coordinates found")
                    continue

                has_asbestos = None
                for key in ['asbestos', 'has_asbestos', 'azbest', 'contains_asbestos', 'isAsbestos', 'asbestosPresent']:
                    if key in properties:
                        has_asbestos = properties[key]
                        break
                    if key in building:
                        has_asbestos = building[key]
                        break

                if has_asbestos is None:
                    has_asbestos = 0
                elif isinstance(has_asbestos, bool):
                    has_asbestos = 1 if has_asbestos else 0
                elif isinstance(has_asbestos, str):
                    has_asbestos = 1 if has_asbestos.lower() in ['true', 'yes', 'tak', '1'] else 0
                else:
                    has_asbestos = int(has_asbestos) if has_asbestos else 0

                try:
                    if geom_type == 'MultiPolygon':
                        lat, lng = calculate_polygon_center(coordinates[0])
                    else:
                        lat, lng = calculate_polygon_center(coordinates)
                except Exception as e:
                    print(f"  Skipping building {i}: Error calculating center - {e}")
                    continue

                filename = f"{lat:.7f}_{lng:.7f}.png"
                output_path = os.path.join(output_dir, filename)

                if (i + 1) % 50 == 0:
                    print(f"Processing {i + 1}/{len(buildings)}...")

                try:
                    building_img = extract_building_image(area_image, area_info, lat, lng, size=128)
                    
                    if building_img:
                        building_img.save(output_path, 'PNG')
                        successful += 1
                        csv_data.append({
                            'filename': filename,
                            'latitude': lat,
                            'longitude': lng,
                            'has_asbestos': has_asbestos
                        })
                    else:
                        print(f"  ✗ Building outside area bounds: {filename}")
                        failed += 1
                except Exception as e:
                    print(f"  ✗ Failed: {filename} - {e}")
                    failed += 1
    
    else:
        # Individual method: Download each building separately
        print("\n" + "="*60)
        print("Using INDIVIDUAL METHOD - downloading each building separately")
        print("="*60)
        
        for i, building in enumerate(buildings):
            if isinstance(building, dict):
                geometry = building.get('geometry', {})
                properties = building.get('properties', building)

                if 'coordinates' in geometry:
                    coordinates = geometry['coordinates']
                    geom_type = geometry.get('type', 'Polygon')
                elif 'coordinates' in building:
                    coordinates = building['coordinates']
                    geom_type = building.get('type', 'Polygon')
                else:
                    print(f"  Skipping building {i}: No coordinates found")
                    continue

                has_asbestos = None
                for key in ['asbestos', 'has_asbestos', 'azbest', 'contains_asbestos', 'isAsbestos', 'asbestosPresent']:
                    if key in properties:
                        has_asbestos = properties[key]
                        break
                    if key in building:
                        has_asbestos = building[key]
                        break

                if has_asbestos is None:
                    print(f"  Warning: No asbestos field found for building {i}")
                    print(f"    Available fields: {list(properties.keys()) if isinstance(properties, dict) else 'N/A'}")
                    has_asbestos = 0
                elif isinstance(has_asbestos, bool):
                    has_asbestos = 1 if has_asbestos else 0
                elif isinstance(has_asbestos, str):
                    has_asbestos = 1 if has_asbestos.lower() in ['true', 'yes', 'tak', '1'] else 0
                else:
                    has_asbestos = int(has_asbestos) if has_asbestos else 0

                try:
                    if geom_type == 'MultiPolygon':
                        lat, lng = calculate_polygon_center(coordinates[0])
                    else:
                        lat, lng = calculate_polygon_center(coordinates)
                except Exception as e:
                    print(f"  Skipping building {i}: Error calculating center - {e}")
                    continue

                filename = f"{lat:.7f}_{lng:.7f}.png"
                output_path = os.path.join(output_dir, filename)

                print(f"Downloading image {i + 1}/{len(buildings)}: {filename} (asbestos: {has_asbestos})")

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
