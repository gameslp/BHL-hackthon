from fastapi import FastAPI, HTTPException
import requests
from PIL import Image
from io import BytesIO
import math
import os

app = FastAPI(title="Asbestos Detection API")

IMG_SIZE = 128
ZOOM = 20

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


def download_satellite_image(lat, lng, size=128, zoom=20):
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
            except Exception as e:
                print(f"Error downloading tile: {e}")
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

@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "message": "Asbestos Detection API",
        "version": "1.0.0",
        "endpoints": {
            "predict": "POST /predict",
            "health": "GET /health"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
