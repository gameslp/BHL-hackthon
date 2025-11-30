import json
import random
import argparse

# Parsowanie argumentów z linii komend
parser = argparse.ArgumentParser(description='Balansowanie danych budynków z i bez azbestu')
parser.add_argument('--asbestos', type=int, help='Liczba budynków z azbestem (domyślnie: auto-balansowanie)')
parser.add_argument('--no-asbestos', type=int, help='Liczba budynków bez azbestu (domyślnie: auto-balansowanie)')
args = parser.parse_args()

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

# Określ ile budynków z każdej grupy wziąć
if args.asbestos is not None and args.no_asbestos is not None:
    # Użytkownik podał konkretne liczby
    asbestos_count = min(args.asbestos, len(buildings_with_asbestos))
    no_asbestos_count = min(args.no_asbestos, len(buildings_without_asbestos))
    print(f"\nUżywam podanych wartości:")
    print(f"Żądane budynki z azbestem: {args.asbestos} (dostępne: {len(buildings_with_asbestos)})")
    print(f"Żądane budynki bez azbestu: {args.no_asbestos} (dostępne: {len(buildings_without_asbestos)})")
else:
    # Auto-balansowanie - zrównaj ilości
    asbestos_count = min(len(buildings_with_asbestos), len(buildings_without_asbestos))
    no_asbestos_count = asbestos_count
    print(f"\nAuto-balansowanie - używam po {asbestos_count} budynków z każdej grupy")

# Weź odpowiednią liczbę budynków z każdej grupy
balanced_features = buildings_with_asbestos[:asbestos_count] + buildings_without_asbestos[:no_asbestos_count]

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