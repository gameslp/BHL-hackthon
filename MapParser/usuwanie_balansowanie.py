import json
import random

# Wczytaj dane z pliku
with open('buildings-checked.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Wyciągnij features z GeoJSON
features = data['features']

# Policz budynki z azbestem i bez azbestu (sprawdzamy properties.asbestosPixelCount)
buildings_with_asbestos = [f for f in features if f['properties'].get('asbestosPixelCount', 0) > 0]
buildings_without_asbestos = [f for f in features if f['properties'].get('asbestosPixelCount', 0) == 0]

print(f"Budynki z azbestem: {len(buildings_with_asbestos)}")
print(f"Budynki bez azbestu: {len(buildings_without_asbestos)}")

# Losowo wymieszaj obie grupy
random.shuffle(buildings_with_asbestos)
random.shuffle(buildings_without_asbestos)

# Zrównaj ilości - zostaw tyle samo z każdej grupy
min_count = min(len(buildings_with_asbestos), len(buildings_without_asbestos))

# Weź tylko tyle budynków z każdej grupy, żeby było równo
balanced_features = buildings_with_asbestos[:min_count] + buildings_without_asbestos[:min_count]

# Wymieszaj całą wynikową listę
random.shuffle(balanced_features)

print(f"\nPo zrównoważeniu:")
print(f"Łączna liczba budynków: {len(balanced_features)}")
print(f"Budynki z azbestem: {sum(1 for f in balanced_features if f['properties'].get('asbestosPixelCount', 0) > 0)}")
print(f"Budynki bez azbestu: {sum(1 for f in balanced_features if f['properties'].get('asbestosPixelCount', 0) == 0)}")

# Stwórz nowy GeoJSON z zachowaniem struktury
balanced_data = {
    "type": "FeatureCollection",
    "name": "buildings",
    "crs": data.get('crs'),
    "features": balanced_features
}

# Zapisz zrównoważone dane do nowego pliku
with open('buildings-balanced.json', 'w', encoding='utf-8') as f:
    json.dump(balanced_data, f, ensure_ascii=False, indent=2)

print(f"\nZapisano zrównoważone dane do: buildings-balanced.json")