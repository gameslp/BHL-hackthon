#!/usr/bin/env python3
"""
Skrypt do przygotowania datasetu z kafelków images/masks
do struktury train/test zgodnej z notebookiem Building_Mapping.ipynb

Tworzy strukturę:
- train/
  - *_image.tif
  - *_label.tif
- test/
  - *_image.tif
  - *_label.tif
"""

import os
import shutil
import glob
from pathlib import Path
import random
from PIL import Image

# Ustawienia
DATA_DIR = '../MapParser/tiles'
IMAGES_DIR = DATA_DIR + '/images'
MASKS_DIR = DATA_DIR + '/masks'
TRAIN_DIR = 'train'
TEST_DIR = 'test'
TRAIN_RATIO = 0.8  # 80% train, 20% test
RANDOM_SEED = 42

def prepare_directories():
    """Usuń i utwórz na nowo katalogi train i test"""
    for directory in [TRAIN_DIR, TEST_DIR]:
        if os.path.exists(directory):
            print(f"Usuwam istniejący katalog: {directory}/")
            shutil.rmtree(directory)
        os.makedirs(directory, exist_ok=True)
        print(f"✓ Utworzono katalog: {directory}/")

def convert_and_copy(src_image, src_mask, dest_dir, index):
    """
    Konwertuje PNG na TIFF i kopiuje do odpowiedniego katalogu
    z właściwą nazwą: XXXXX_image.tif i XXXXX_label.tif
    """
    # Wczytaj i konwertuj obrazy
    img = Image.open(src_image)
    mask = Image.open(src_mask)
    
    # Konwertuj maskę na skalę szarości jeśli ma wiele kanałów
    if mask.mode != 'L':
        mask = mask.convert('L')
    
    # Zapisz jako TIFF
    dest_image = os.path.join(dest_dir, f"{index:05d}_image.tif")
    dest_label = os.path.join(dest_dir, f"{index:05d}_label.tif")
    
    img.save(dest_image, format='TIFF')
    mask.save(dest_label, format='TIFF')
    
    return dest_image, dest_label

def main():
    print("=" * 60)
    print("Przygotowanie datasetu do treningu U-Net")
    print("=" * 60)
    
    # Sprawdź czy katalogi istnieją
    if not os.path.exists(IMAGES_DIR):
        print(f"❌ Błąd: Katalog {IMAGES_DIR}/ nie istnieje!")
        return
    
    if not os.path.exists(MASKS_DIR):
        print(f"❌ Błąd: Katalog {MASKS_DIR}/ nie istnieje!")
        return
    
    # Znajdź wszystkie pliki
    image_files = sorted(glob.glob(f'{IMAGES_DIR}/*.png'))
    mask_files = sorted(glob.glob(f'{MASKS_DIR}/*.png'))
    
    print(f"\nZnaleziono {len(image_files)} obrazów i {len(mask_files)} masek")
    
    if len(image_files) != len(mask_files):
        print(f"❌ Błąd: Liczba obrazów i masek się nie zgadza!")
        return
    
    if len(image_files) == 0:
        print(f"❌ Błąd: Brak plików do przetworzenia!")
        return
    
    # Sparuj pliki (sprawdź czy nazwy się zgadzają)
    pairs = []
    for img_path in image_files:
        img_name = os.path.basename(img_path)
        mask_path = os.path.join(MASKS_DIR, img_name)
        
        if os.path.exists(mask_path):
            pairs.append((img_path, mask_path))
        else:
            print(f"⚠️  Ostrzeżenie: Brak maski dla {img_name}")
    
    print(f"✓ Sparowano {len(pairs)} par obraz-maska")
    
    # Losowo pomieszaj pary
    random.seed(RANDOM_SEED)
    random.shuffle(pairs)
    
    # Podziel na train/test
    split_idx = int(len(pairs) * TRAIN_RATIO)
    train_pairs = pairs[:split_idx]
    test_pairs = pairs[split_idx:]
    
    print(f"\nPodział datasetu:")
    print(f"  Train: {len(train_pairs)} par ({len(train_pairs)/len(pairs)*100:.1f}%)")
    print(f"  Test:  {len(test_pairs)} par ({len(test_pairs)/len(pairs)*100:.1f}%)")
    
    # Przygotuj katalogi
    print("\nPrzygotowywanie katalogów...")
    prepare_directories()
    
    # Kopiuj pliki do train/
    print(f"\nKopiowanie {len(train_pairs)} par do train/...")
    for idx, (img_path, mask_path) in enumerate(train_pairs):
        convert_and_copy(img_path, mask_path, TRAIN_DIR, idx)
        if (idx + 1) % 20 == 0 or idx == len(train_pairs) - 1:
            print(f"  Train: {idx + 1}/{len(train_pairs)} plików skopiowanych")
    
    # Kopiuj pliki do test/
    print(f"\nKopiowanie {len(test_pairs)} par do test/...")
    # Rozpocznij numerację od ostatniego indeksu train, aby uniknąć duplikatów
    start_idx = len(train_pairs)
    for idx, (img_path, mask_path) in enumerate(test_pairs):
        convert_and_copy(img_path, mask_path, TEST_DIR, start_idx + idx)
        if (idx + 1) % 10 == 0 or idx == len(test_pairs) - 1:
            print(f"  Test: {idx + 1}/{len(test_pairs)} plików skopiowanych")
    
    # Podsumowanie
    print("\n" + "=" * 60)
    print("✓ SUKCES! Dataset przygotowany")
    print("=" * 60)
    
    train_images = len(glob.glob(f'{TRAIN_DIR}/*_image.tif'))
    train_labels = len(glob.glob(f'{TRAIN_DIR}/*_label.tif'))
    test_images = len(glob.glob(f'{TEST_DIR}/*_image.tif'))
    test_labels = len(glob.glob(f'{TEST_DIR}/*_label.tif'))
    
    print(f"\nStruktura katalogów:")
    print(f"  train/")
    print(f"    {train_images} plików *_image.tif")
    print(f"    {train_labels} plików *_label.tif")
    print(f"  test/")
    print(f"    {test_images} plików *_image.tif")
    print(f"    {test_labels} plików *_label.tif")
    
    print("\nTeraz możesz użyć w notebooku:")
    print("  train_x = sorted(glob.glob('train/*_image.tif'))")
    print("  train_y = sorted(glob.glob('train/*_label.tif'))")
    print("  test_x = sorted(glob.glob('test/*_image.tif'))")
    print("  test_y = sorted(glob.glob('test/*_label.tif'))")

if __name__ == '__main__':
    main()
