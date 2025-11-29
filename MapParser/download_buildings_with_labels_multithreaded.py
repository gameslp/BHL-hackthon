import json
import os
import csv
import requests
from PIL import Image
from io import BytesIO
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
import time


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
    if isinstance(coordinates[0][0], list):
        polygon = coordinates[0]
    else:
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
    
    lat_margin = (max_lat - min_lat) * 0.1
    lng_margin = (max_lng - min_lng) * 0.1
    
    return {
        'min_lat': min_lat - lat_margin,
        'max_lat': max_lat + lat_margin,
        'min_lng': min_lng - lng_margin,
        'max_lng': max_lng + lng_margin
    }


def download_tile(tx, ty, zoom, i, j, tile_size):
    """Download single tile - for multithreading."""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    url = f"https://mt1.google.com/vt/lyrs=s&x={tx}&y={ty}&z={zoom}"
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        tile_img = Image.open(BytesIO(response.content))
        return (i, j, tile_img, True)
    except Exception as e:
        gray_tile = Image.new('RGB', (tile_size, tile_size), (128, 128, 128))
        return (i, j, gray_tile, False)


def download_area_image(bbox, zoom=20, max_workers=10):
    """Download large image covering entire bounding box - multithreaded."""
    print(f"Downloading area image for bbox: {bbox}")
    
    min_x_tile, min_y_tile, _, _ = lat_lng_to_pixel_in_tile(bbox['max_lat'], bbox['min_lng'], zoom)
    max_x_tile, max_y_tile, _, _ = lat_lng_to_pixel_in_tile(bbox['min_lat'], bbox['max_lng'], zoom)
    
    tiles_x = max_x_tile - min_x_tile + 1
    tiles_y = max_y_tile - min_y_tile + 1
    
    print(f"  Tiles needed: {tiles_x}x{tiles_y} = {tiles_x * tiles_y} tiles")
    print(f"  Using {max_workers} threads for downloading")
    
    tile_size = 256
    combined_size_x = tile_size * tiles_x
    combined_size_y = tile_size * tiles_y
    combined_image = Image.new('RGB', (combined_size_x, combined_size_y))
    
    total_tiles = tiles_x * tiles_y
    downloaded = 0
    lock = Lock()
    
    # Prepare tasks
    tasks = []
    for i in range(tiles_x):
        for j in range(tiles_y):
            tx = min_x_tile + i
            ty = min_y_tile + j
            tasks.append((tx, ty, zoom, i, j, tile_size))
    
    # Download tiles in parallel
    start_time = time.time()
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(download_tile, *task): task for task in tasks}
        
        for future in as_completed(futures):
            i, j, tile_img, success = future.result()
            combined_image.paste(tile_img, (i * tile_size, j * tile_size))
            
            with lock:
                if success:
                    downloaded += 1
                if (downloaded) % 20 == 0 or downloaded == total_tiles:
                    elapsed = time.time() - start_time
                    print(f"  Progress: {downloaded}/{total_tiles} tiles ({elapsed:.1f}s)")
    
    elapsed = time.time() - start_time
    print(f"  ✓ Downloaded {downloaded}/{total_tiles} tiles in {elapsed:.1f}s")
    
    return combined_image, {
        'min_x_tile': min_x_tile,
        'min_y_tile': min_y_tile,
        'zoom': zoom
    }


def extract_building_image(area_image, area_info, lat, lng, size=128):
    """Extract building image from large area image."""
    x_tile, y_tile, pixel_x, pixel_y = lat_lng_to_pixel_in_tile(lat, lng, area_info['zoom'])
    
    tile_offset_x = x_tile - area_info['min_x_tile']
    tile_offset_y = y_tile - area_info['min_y_tile']
    
    center_x = tile_offset_x * 256 + pixel_x
    center_y = tile_offset_y * 256 + pixel_y
    
    half_size = size // 2
    left = max(0, center_x - half_size)
    top = max(0, center_y - half_size)
    right = min(area_image.width, left + size)
    bottom = min(area_image.height, top + size)
    
    if right - left < size or bottom - top < size:
        return None
    
    cropped = area_image.crop((left, top, right, bottom))
    return cropped


def download_single_building(lat, lng, size=128, zoom=20):
    """Download single building image - for multithreading."""
    x_tile, y_tile, pixel_x, pixel_y = lat_lng_to_pixel_in_tile(lat, lng, zoom)
    
    tile_size = 256
    tiles_needed = 3
    combined_size = tile_size * tiles_needed
    combined_image = Image.new('RGB', (combined_size, combined_size))

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
            except:
                gray_tile = Image.new('RGB', (tile_size, tile_size), (128, 128, 128))
                combined_image.paste(gray_tile, (i * tile_size, j * tile_size))

    center_x = (tiles_needed // 2) * tile_size + pixel_x
    center_y = (tiles_needed // 2) * tile_size + pixel_y

    half_size = size // 2
    left = center_x - half_size
    top = center_y - half_size
    right = left + size
    bottom = top + size

    cropped = combined_image.crop((left, top, right, bottom))
    return cropped


def process_building_individual(building_data):
    """Process single building - for multithreading individual method."""
    i, building, output_dir = building_data
    
    try:
        if not isinstance(building, dict):
            return None
            
        geometry = building.get('geometry', {})
        properties = building.get('properties', building)

        if 'coordinates' in geometry:
            coordinates = geometry['coordinates']
            geom_type = geometry.get('type', 'Polygon')
        elif 'coordinates' in building:
            coordinates = building['coordinates']
            geom_type = building.get('type', 'Polygon')
        else:
            return None

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

        if geom_type == 'MultiPolygon':
            lat, lng = calculate_polygon_center(coordinates[0])
        else:
            lat, lng = calculate_polygon_center(coordinates)

        filename = f"{lat:.7f}_{lng:.7f}.png"
        output_path = os.path.join(output_dir, filename)

        building_img = download_single_building(lat, lng, size=128, zoom=20)
        building_img.save(output_path, 'PNG')
        
        return {
            'filename': filename,
            'latitude': lat,
            'longitude': lng,
            'has_asbestos': has_asbestos,
            'success': True
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def load_buildings_json(json_path):
    """Load buildings data from JSON file."""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(script_dir, 'buildings-balanced.json')
    output_dir = os.path.join(script_dir, 'building_images_labeled')
    csv_path = os.path.join(script_dir, 'building_labels.csv')

    os.makedirs(output_dir, exist_ok=True)

    print(f"Loading buildings from {json_path}...")

    try:
        buildings_data = load_buildings_json(json_path)
    except FileNotFoundError:
        print(f"Error: File {json_path} not found!")
        return
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
        return

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

    print("\n" + "="*60)
    print("Choose download method:")
    print("  1. Fast method - Download one large area image first (recommended)")
    print("     Pros: Much faster, fewer API calls")
    print("     Cons: Uses more memory initially")
    print("\n  2. Individual method - Download each building separately (multithreaded)")
    print("     Pros: Lower memory usage, parallelized downloads")
    print("     Cons: More API calls")
    print("="*60)
    
    while True:
        choice = input("\nEnter your choice (1 or 2): ").strip()
        if choice in ['1', '2']:
            break
        print("Invalid choice. Please enter 1 or 2.")
    
    # Ask for thread count
    while True:
        try:
            max_workers = input("\nEnter number of threads (recommended: 10-20): ").strip()
            max_workers = int(max_workers)
            if 1 <= max_workers <= 50:
                break
            print("Please enter a number between 1 and 50.")
        except ValueError:
            print("Please enter a valid number.")
    
    use_area_method = (choice == '1')

    csv_data = []
    successful = 0
    failed = 0

    start_time = time.time()

    if use_area_method:
        print("\n" + "="*60)
        print(f"Using FAST METHOD - downloading large area image ({max_workers} threads)")
        print("="*60)
        
        print("\nStep 1: Calculating bounding box...")
        bbox = calculate_bounding_box(buildings)
        
        print("\nStep 2: Downloading large area image...")
        area_image, area_info = download_area_image(bbox, zoom=20, max_workers=max_workers)

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
                    continue

                filename = f"{lat:.7f}_{lng:.7f}.png"
                output_path = os.path.join(output_dir, filename)

                if (i + 1) % 100 == 0:
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
                        failed += 1
                except Exception as e:
                    failed += 1
    
    else:
        print("\n" + "="*60)
        print(f"Using INDIVIDUAL METHOD - multithreaded ({max_workers} threads)")
        print("="*60)
        
        tasks = [(i, building, output_dir) for i, building in enumerate(buildings)]
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(process_building_individual, task): task for task in tasks}
            
            for future in as_completed(futures):
                result = future.result()
                
                if result and result.get('success'):
                    successful += 1
                    csv_data.append({
                        'filename': result['filename'],
                        'latitude': result['latitude'],
                        'longitude': result['longitude'],
                        'has_asbestos': result['has_asbestos']
                    })
                else:
                    failed += 1
                
                if (successful + failed) % 20 == 0:
                    elapsed = time.time() - start_time
                    print(f"  Progress: {successful + failed}/{len(buildings)} ({elapsed:.1f}s)")

    elapsed = time.time() - start_time
    print(f"\nSaving labels to {csv_path}...")
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['filename', 'latitude', 'longitude', 'has_asbestos'])
        writer.writeheader()
        writer.writerows(csv_data)

    print(f"\nDone in {elapsed:.1f}s!")
    print(f"  Successful: {successful}")
    print(f"  Failed: {failed}")
    print(f"  Images saved to: {output_dir}")
    print(f"  Labels saved to: {csv_path}")

    asbestos_count = sum(1 for row in csv_data if row['has_asbestos'] == 1)
    no_asbestos_count = sum(1 for row in csv_data if row['has_asbestos'] == 0)
    print(f"\nAsbestos statistics:")
    print(f"  With asbestos: {asbestos_count}")
    print(f"  Without asbestos: {no_asbestos_count}")


if __name__ == "__main__":
    main()
