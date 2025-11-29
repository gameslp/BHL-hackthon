import matplotlib.pyplot as plt
import contextily as cx
from pathlib import Path


def render_satellite_image(gdf, output_path="buildings_satellite.png", dpi=300):
    if gdf is None or gdf.empty:
        print("No buildings to render")
        return None

    gdf = gdf.to_crs(epsg=3857)

    fig, ax = plt.subplots(figsize=(12, 12))

    building_colors = {
        'house': 'yellow',
        'detached': 'yellow',
        'residential': 'yellow',
        'apartments': 'orange',
        'bungalow': 'yellow',
        'garage': 'white',
        'office': 'magenta',
        'commercial': 'magenta',
        'retail': 'magenta',
        'industrial': 'red',
        'warehouse': 'red',
        'school': 'lime',
        'kindergarten': 'lime',
        'hospital': 'red',
        'church': 'cyan',
        'yes': 'white'
    }

    for building_type in gdf['building'].unique():
        subset = gdf[gdf['building'] == building_type]
        color = building_colors.get(building_type, 'white')
        subset.plot(ax=ax, facecolor=color, edgecolor=color, alpha=0.4, linewidth=2)

    cx.add_basemap(
        ax,
        source=cx.providers.Esri.WorldImagery,
        zoom='auto',
        attribution=False
    )

    ax.set_axis_off()
    plt.tight_layout(pad=0)

    plt.savefig(output_path, dpi=dpi, bbox_inches='tight', pad_inches=0)
    print(f"Satellite image saved to {output_path}")
    plt.close()

    return output_path


def render_individual_buildings(gdf, output_dir="building_images", size=256, dpi=150):
    if gdf is None or gdf.empty:
        print("No buildings to render")
        return

    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True)

    gdf = gdf.to_crs(epsg=3857)

    for idx, (_, building) in enumerate(gdf.iterrows()):
        fig, ax = plt.subplots(figsize=(size/dpi, size/dpi))

        bounds = building.geometry.bounds
        buffer = max(bounds[2] - bounds[0], bounds[3] - bounds[1]) * 0.3
        ax.set_xlim(bounds[0] - buffer, bounds[2] + buffer)
        ax.set_ylim(bounds[1] - buffer, bounds[3] + buffer)

        building_gdf = gdf.iloc[[idx]]
        building_gdf.plot(ax=ax, facecolor='yellow', edgecolor='yellow', alpha=0.5, linewidth=2)

        try:
            cx.add_basemap(ax, source=cx.providers.Esri.WorldImagery, zoom='auto', attribution=False)
        except Exception as e:
            print(f"Warning: Could not fetch basemap for building {idx}: {e}")

        ax.set_axis_off()
        plt.tight_layout(pad=0)

        output_file = output_dir / f"building_{idx:04d}.png"
        plt.savefig(output_file, dpi=dpi, bbox_inches='tight', pad_inches=0)
        plt.close()

        if (idx + 1) % 10 == 0:
            print(f"Rendered {idx + 1}/{len(gdf)} buildings")

    print(f"All {len(gdf)} buildings rendered to {output_dir}")
