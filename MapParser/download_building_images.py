import re
import json
import os
import requests
from PIL import Image
from io import BytesIO
import math

def extract_geojson_from_html(html_path):
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()
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
    polygon = coordinates[0]
    
    lngs = [point[0] for point in polygon]
    lats = [point[1] for point in polygon]
    
    center_lng = sum(lngs) / len(lngs)
    center_lat = sum(lats) / len(lats)
    
    return center_lat, center_lng

def lat_lng_to_tile(lat, lng, zoom):
    lat_rad = math.radians(lat)
    n = 2.0 ** zoom
    x_tile = int((lng + 180.0) / 360.0 * n)
    y_tile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return x_tile, y_tile

def lat_lng_to_pixel_in_tile(lat, lng, zoom):
    lat_rad = math.radians(lat)
    n = 2.0 ** zoom
    x = (lng + 180.0) / 360.0 * n
    y = (1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n
    
    x_tile = int(x)
    y_tile = int(y)

    pixel_x = int((x - x_tile) * 256)
    pixel_y = int((y - y_tile) * 256)
    
    return x_tile, y_tile, pixel_x, pixel_y

def download_satellite_image(lat, lng, output_path, size=100, zoom=20):
    x_tile, y_tile, pixel_x, pixel_y = lat_lng_to_pixel_in_tile(lat, lng, zoom)
    tiles_needed = 2  # 2x2 grid of tiles
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
            
            # Google Satellite tile URL
            url = f"https://mt1.google.com/vt/lyrs=s&x={tx}&y={ty}&z={zoom}"
            
            try:
                response = requests.get(url, headers=headers, timeout=30)
                response.raise_for_status()
                
                tile_img = Image.open(BytesIO(response.content))
                combined_image.paste(tile_img, (i * tile_size, j * tile_size))
                
            except Exception as e:
                print(f"  Error downloading tile ({tx}, {ty}): {e}")
                # Fill with gray if tile fails
                gray_tile = Image.new('RGB', (tile_size, tile_size), (128, 128, 128))
                combined_image.paste(gray_tile, (i * tile_size, j * tile_size))
    
    # Calculate center position in combined image
    center_x = (tiles_needed // 2) * tile_size + pixel_x
    center_y = (tiles_needed // 2) * tile_size + pixel_y
    
    # Crop around center
    half_size = size // 2
    left = max(0, center_x - half_size)
    top = max(0, center_y - half_size)
    right = min(combined_size, center_x + half_size)
    bottom = min(combined_size, center_y + half_size)
    
    cropped = combined_image.crop((left, top, right, bottom))
    
    # Resize to exact size if needed
    if cropped.size != (size, size):
        cropped = cropped.resize((size, size), Image.LANCZOS)
    
    cropped.save(output_path, 'PNG')
    return True

def download_satellite_image_bing(lat, lng, output_path, size=100, zoom=20):
    """Fallback: Download satellite image using Bing Maps tiles."""
    
    def tile_to_quadkey(x, y, z):
        """Convert tile coordinates to Bing quadkey."""
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
            # Bing Aerial tile URL
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
    successful = 0
    failed = 0
    
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
                    
                    print(f"Downloading image {i+1}/{len(geojson_list)}: {filename}")
                    
                    try:
                        # Try Google first, then Bing as fallback
                        if download_satellite_image(lat, lng, output_path, size=100, zoom=20):
                            print(f"  ✓ Saved: {filename}")
                            successful += 1
                        else:
                            raise Exception("Google failed")
                    except:
                        try:
                            if download_satellite_image_bing(lat, lng, output_path, size=100, zoom=20):
                                print(f"  ✓ Saved (Bing): {filename}")
                                successful += 1
                            else:
                                print(f"  ✗ Failed: {filename}")
                                failed += 1
                        except Exception as e:
                            print(f"  ✗ Failed: {filename} - {e}")
                            failed += 1
    
    print(f"\nDone! Successful: {successful}, Failed: {failed}")
    print(f"Images saved to: {output_dir}")

if __name__ == "__main__":
    main()
