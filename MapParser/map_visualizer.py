import folium
from folium import GeoJson


def create_map_preview(gdf, output_html="buildings_map.html"):
    if gdf is None or gdf.empty:
        print("No buildings to visualize")
        return None

    bounds = gdf.total_bounds
    center_lat = (bounds[1] + bounds[3]) / 2
    center_lon = (bounds[0] + bounds[2]) / 2

    m = folium.Map(location=[center_lat, center_lon], zoom_start=15)

    building_colors = {
        'house': '#3388ff',
        'detached': '#3388ff',
        'residential': '#3388ff',
        'apartments': '#4488ff',
        'bungalow': '#3388ff',
        'garage': '#888888',
        'office': '#ff8833',
        'commercial': '#ff8833',
        'retail': '#ff8833',
        'industrial': '#cc3333',
        'warehouse': '#cc3333',
        'school': '#33cc33',
        'kindergarten': '#33cc33',
        'hospital': '#ff3333',
        'church': '#8833ff',
        'yes': '#999999'
    }

    for idx, row in gdf.iterrows():
        building_type = row['building']
        color = building_colors.get(building_type, '#999999')

        folium.GeoJson(
            row['geometry'],
            style_function=lambda x, color=color: {
                'fillColor': color,
                'color': color,
                'weight': 2,
                'fillOpacity': 0.5
            },
            tooltip=f"Type: {building_type}"
        ).add_to(m)

    m.save(output_html)
    print(f"Map saved to {output_html}")
    return m
