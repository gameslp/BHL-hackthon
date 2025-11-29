import matplotlib.pyplot as plt
import contextily as cx
import numpy as np
from pathlib import Path
from PIL import Image
from shapely.geometry import box


def generate_tiles(gdf, tile_size=128, output_dir="tiles", overlap=0):
    if gdf is None or gdf.empty:
        print("No buildings to process")
        return

    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True)

    image_dir = output_dir / "images"
    mask_dir = output_dir / "masks"
    image_dir.mkdir(exist_ok=True)
    mask_dir.mkdir(exist_ok=True)

    gdf = gdf.to_crs(epsg=3857)

    bounds = gdf.total_bounds
    min_x, min_y, max_x, max_y = bounds

    step = tile_size if overlap == 0 else tile_size - overlap

    tile_count = 0
    tiles_with_buildings = 0

    y = min_y
    while y < max_y:
        x = min_x
        while x < max_x:
            tile_bounds = [x, y, x + tile_size, y + tile_size]
            tile_box = box(x, y, x + tile_size, y + tile_size)

            intersecting = gdf[gdf.intersects(tile_box)]

            if len(intersecting) > 0:
                try:
                    fig, ax = plt.subplots(figsize=(1, 1), dpi=tile_size)
                    ax.set_xlim(x, x + tile_size)
                    ax.set_ylim(y, y + tile_size)
                    ax.set_axis_off()
                    plt.subplots_adjust(left=0, right=1, top=1, bottom=0)

                    cx.add_basemap(ax, source=cx.providers.Esri.WorldImagery, zoom='auto', attribution=False)

                    image_path = image_dir / f"tile_{tile_count:05d}.png"
                    plt.savefig(image_path, dpi=tile_size, bbox_inches='tight', pad_inches=0)
                    plt.close()

                    fig, ax = plt.subplots(figsize=(1, 1), dpi=tile_size)
                    ax.set_xlim(x, x + tile_size)
                    ax.set_ylim(y, y + tile_size)
                    ax.set_facecolor('black')
                    ax.set_axis_off()
                    plt.subplots_adjust(left=0, right=1, top=1, bottom=0)

                    intersecting.plot(ax=ax, color='white', edgecolor='white')

                    mask_path = mask_dir / f"tile_{tile_count:05d}.png"
                    plt.savefig(mask_path, dpi=tile_size, bbox_inches='tight', pad_inches=0, facecolor='black')
                    plt.close()

                    tiles_with_buildings += 1

                    if tiles_with_buildings % 10 == 0:
                        print(f"Generated {tiles_with_buildings} tiles with buildings")

                except Exception as e:
                    print(f"Error generating tile {tile_count}: {e}")
                    plt.close('all')

                tile_count += 1

            x += step
        y += step

    print(f"Total tiles generated: {tiles_with_buildings}")
    print(f"Images saved to: {image_dir}")
    print(f"Masks saved to: {mask_dir}")
