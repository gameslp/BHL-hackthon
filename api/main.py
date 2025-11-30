import torch
import torch.nn as nn  # Wciąż potrzebne dla torch.sigmoid/softmax w postprocessingu
import torchvision.transforms as transforms
# Usunięto: import torchvision.models as models (niepotrzebne)

import onnxruntime as ort
import numpy as np
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import aiohttp
import asyncio
from PIL import Image
from io import BytesIO
import math
import os
from typing import Optional, Dict, Any, List

# ====================================================================
# APLIKACJA I METADANE
# ====================================================================

app = FastAPI(title="Asbestos Detection API")

# GLOBALNE KONSTANTY
IMG_SIZE = 128
ZOOM = 20
MAX_WORKERS = 20  # Liczba wątków dla batch prediction

# 1. Zmieniony typ obiektu modelu na sesję ONNX Runtime
MODEL: Optional[ort.InferenceSession] = None 

# 2. Poprawne, zsynchronizowane metadane normalizacyjne z checkpointa
MODEL_META: Dict[str, Any] = {
    'input_shape': (3, 128, 128),
    'mean': [0.3616, 0.3497, 0.3882],
    'std': [0.2406, 0.2315, 0.2276],
}


class PredictRequest(BaseModel):
    centroidLat: float
    centroidLng: float


class CoordinateItem(BaseModel):
    centroidLat: float
    centroidLng: float
    id: Optional[str] = None  # Opcjonalne ID do identyfikacji


class BatchPredictRequest(BaseModel):
    coordinates: List[CoordinateItem]


class PredictionResult(BaseModel):
    centroidLat: float
    centroidLng: float
    id: Optional[str] = None
    isPotentiallyAsbestos: float
    success: bool
    error: Optional[str] = None


class BatchPredictResponse(BaseModel):
    results: List[PredictionResult]
    total: int
    successful: int
    failed: int


# ====================================================================
# FUNKCJE AKWIZYCJI OBRAZU I PRZETWARZANIA WSTĘPNEGO
# ====================================================================

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


async def download_satellite_image(lat, lng, size=128, zoom=20):
    x_tile, y_tile, pixel_x, pixel_y = lat_lng_to_pixel_in_tile(lat, lng, zoom)
    
    tile_size = 256
    tiles_needed = 3
    combined_size = tile_size * tiles_needed
    combined_image = Image.new('RGB', (combined_size, combined_size))

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }

    # Przygotowanie listy kafelków do pobrania
    tiles_to_download = []
    for i in range(tiles_needed):
        for j in range(tiles_needed):
            tx = x_tile - tiles_needed // 2 + i
            ty = y_tile - tiles_needed // 2 + j
            timestamp = int(time.time() * 1000)
            url = f"https://mt1.google.com/vt/lyrs=s&x={tx}&y={ty}&z={zoom}&ts={timestamp}"
            tiles_to_download.append((url, i, j))

    # Asynchroniczne pobieranie wszystkich kafelków
    async with aiohttp.ClientSession(headers=headers) as session:
        tasks = []
        for url, i, j in tiles_to_download:
            tasks.append(_download_tile(session, url, i, j, tile_size))
        
        tile_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Wklejanie pobranych kafelków
        for result in tile_results:
            if isinstance(result, Exception):
                print(f"Error downloading tile: {result}")
                continue
            if result is not None:
                tile_img, i, j = result
                combined_image.paste(tile_img, (i * tile_size, j * tile_size))

    center_x = (tiles_needed // 2) * tile_size + pixel_x
    center_y = (tiles_needed // 2) * tile_size + pixel_y

    half_size = size // 2
    left = center_x - half_size
    top = center_y - half_size
    right = left + size
    bottom = top + size

    cropped = combined_image.crop((left, top, right, bottom))
    return cropped


async def _download_tile(session: aiohttp.ClientSession, url: str, i: int, j: int, tile_size: int):
    """Helper function to download a single tile asynchronously."""
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as response:
            response.raise_for_status()
            content = await response.read()
            tile_img = Image.open(BytesIO(content))
            return (tile_img, i, j)
    except Exception as e:
        print(f"Error downloading tile at ({i}, {j}): {e}")
        gray_tile = Image.new('RGB', (tile_size, tile_size), (128, 128, 128))
        return (gray_tile, i, j)


# 3. NOWA FUNKCJA ŁADOWANIA SESJI ONNX
def _load_onnx_session(path: str):
    global MODEL
    session_path = path.replace('.pt', '.onnx') # Oczekuj pliku .onnx

    if not os.path.exists(session_path):
        raise FileNotFoundError(f"Sesja ONNX nie znaleziona: {session_path}")

    try:
        MODEL = ort.InferenceSession(session_path)
        return MODEL
    except Exception as e:
        raise RuntimeError(f'Błąd ładowania sesji ONNX: {e}')


def get_model():
    global MODEL
    if MODEL is not None:
        return MODEL
    # Użycie ścieżki do pliku .onnx
    onnx_file = os.path.join(os.path.dirname(__file__), '..', 'artifacts', 'asbestos_net.onnx')
    onnx_file = os.path.normpath(onnx_file)
    return _load_onnx_session(onnx_file)


def _prepare_image_for_model(pil_img: Image.Image):
    # Funkcja preprocessingowa
    meta = MODEL_META
    
    input_shape = tuple(meta.get('input_shape'))
    _, H, W = input_shape
    if pil_img.size[::-1] != (H, W):
        pil_img = pil_img.resize((W, H))
        
    x = transforms.ToTensor()(pil_img)

    # Użycie wartości z MODEL_META
    mean_tensor = torch.tensor(meta['mean'], dtype=torch.float32)
    std_tensor = torch.tensor(meta['std'], dtype=torch.float32)

    # Normalizacja (X - mu) / sigma
    x = (x - mean_tensor[:, None, None]) / std_tensor[:, None, None]
    
    # Dodanie wymiaru batcha: [1, C, H, W]
    x = x.unsqueeze(0)
    
    return x

# ====================================================================
# ENDPOINTY API
# ====================================================================

@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "message": "Asbestos Detection API",
        "version": "1.0.0",
        "endpoints": {
            "predict": "POST /predict",
            "batch_predict": "POST /batch_predict",
            "health": "GET /health"
        }
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/predict")
async def predict(req: PredictRequest):
    print(f"Received prediction request: {req}")
    """Predict whether building at centroid has asbestos using model checkpoint."""
    
    try:
        model = get_model() # Ładuje sesję ONNX Runtime
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model load error: {e}")

    # download image around centroid (teraz asynchronicznie)
    try:
        pil_img = await download_satellite_image(req.centroidLat, req.centroidLng, size=IMG_SIZE, zoom=ZOOM)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download image: {e}")

    # prepare tensor
    try:    
        x = _prepare_image_for_model(pil_img)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to prepare image: {e}")

    # 4. KLUCZOWA ZMIANA: WNIOSKOWANIE ZA POMOCĄ ONNX RUNTIME
    try:
        # Konwersja tensora PyTorch na tablicę NumPy
        input_np = x.cpu().numpy()
        
        # Pobranie nazwy wejścia z sesji ONNX (z eksportu: 'input')
        input_name = model.get_inputs()[0].name
        
        # Wykonanie wnioskowania
        ort_outs = model.run(None, {input_name: input_np})
        
        # Wynik jest tablicą NumPy logitów - konwersja na tensor PyTorch dla post-processingu
        logits = torch.from_numpy(ort_outs[0]) 

        # Post-processing (bez zmian)
        if logits.ndim == 2 and logits.size(1) > 1:
            probs = torch.softmax(logits, dim=1)[0].cpu().tolist()
            prob_asbestos = float(probs[1]) if len(probs) > 1 else float(probs[-1])
        else:
            prob_asbestos = float(torch.sigmoid(logits.view(-1))[0].cpu().item())

        is_potential = bool(prob_asbestos >= 0.5)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model inference error (ONNX): {e}")

    return {"isPotentiallyAsbestos": prob_asbestos}


@app.post("/batch_predict")
async def batch_predict(req: BatchPredictRequest) -> BatchPredictResponse:
    """Predict asbestos for multiple coordinates using parallel processing."""
    
    if not req.coordinates:
        raise HTTPException(status_code=400, detail="Coordinates list cannot be empty")
    
    try:
        get_model()
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model load error: {e}")
    
    results = []
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_coord = {
            executor.submit(
                _predict_single_coordinate,
                coord.centroidLat,
                coord.centroidLng,
                coord.id
            ): coord
            for coord in req.coordinates
        }
        
        for future in as_completed(future_to_coord):
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                coord = future_to_coord[future]
                results.append(PredictionResult(
                    centroidLat=coord.centroidLat,
                    centroidLng=coord.centroidLng,
                    id=coord.id,
                    isPotentiallyAsbestos=0.0,
                    success=False,
                    error=f"Unexpected error: {str(e)}"
                ))
    
    successful = sum(1 for r in results if r.success)
    failed = len(results) - successful
    
    return BatchPredictResponse(
        results=results,
        total=len(results),
        successful=successful,
        failed=failed
    )


def _predict_single_coordinate(lat: float, lng: float, coord_id: Optional[str] = None) -> PredictionResult:
    """Helper function to predict for a single coordinate."""
    try:
        # Download image
        pil_img = download_satellite_image(lat, lng, size=IMG_SIZE, zoom=ZOOM)
        
        # Prepare tensor
        x = _prepare_image_for_model(pil_img)
        
        # Get model (thread-safe as ONNX Runtime sessions are thread-safe)
        model = get_model()
        
        # Inference
        input_np = x.cpu().numpy()
        input_name = model.get_inputs()[0].name
        ort_outs = model.run(None, {input_name: input_np})
        logits = torch.from_numpy(ort_outs[0])
        
        # Post-processing
        if logits.ndim == 2 and logits.size(1) > 1:
            probs = torch.softmax(logits, dim=1)[0].cpu().tolist()
            prob_asbestos = float(probs[1]) if len(probs) > 1 else float(probs[-1])
        else:
            prob_asbestos = float(torch.sigmoid(logits.view(-1))[0].cpu().item())
        
        return PredictionResult(
            centroidLat=lat,
            centroidLng=lng,
            id=coord_id,
            isPotentiallyAsbestos=prob_asbestos,
            success=True,
            error=None
        )
    
    except Exception as e:
        return PredictionResult(
            centroidLat=lat,
            centroidLng=lng,
            id=coord_id,
            isPotentiallyAsbestos=0.0,
            success=False,
            error=str(e)
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)