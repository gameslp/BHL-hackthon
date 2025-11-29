import folium
from folium import GeoJson


def create_map_preview(gdf, output_html="buildings_map.html"):
    if gdf is None or gdf.empty:
        print("No buildings to visualize")
        return None

    bounds = gdf.total_bounds
    center_lat = (bounds[1] + bounds[3]) / 2
    center_lon = (bounds[0] + bounds[2]) / 2

    m = folium.Map(
        location=[center_lat, center_lon],
        zoom_start=17,
        tiles='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attr='Esri'
    )

    building_colors = {
        'house': '#ffff00',
        'detached': '#ffff00',
        'residential': '#ffff00',
        'apartments': '#ffaa00',
        'bungalow': '#ffff00',
        'garage': '#ffffff',
        'office': '#ff00ff',
        'commercial': '#ff00ff',
        'retail': '#ff00ff',
        'industrial': '#ff0000',
        'warehouse': '#ff0000',
        'school': '#00ff00',
        'kindergarten': '#00ff00',
        'hospital': '#ff3333',
        'church': '#00ffff',
        'yes': '#ffffff'
    }

    for idx, row in gdf.iterrows():
        building_type = row['building']

        # Check if building has asbestos - override color if true
        if 'isAsbestos' in row and row['isAsbestos'] == True:
            color = '#ff6600'  # Orange color for asbestos buildings
            tooltip_text = f"Type: {building_type} (ASBESTOS)"
        else:
            color = building_colors.get(building_type, '#ffffff')
            tooltip_text = f"Type: {building_type}"

        folium.GeoJson(
            row['geometry'],
            style_function=lambda x, color=color: {
                'fillColor': color,
                'color': color,
                'weight': 3,
                'fillOpacity': 0.3
            },
            tooltip=tooltip_text
        ).add_to(m)

    m.save(output_html)
    print(f"Map saved to {output_html}")
    return m
