import torch
import torch.nn as nn
import torchvision.transforms as transforms

import onnxruntime as ort
import numpy as np
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
import sys

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

# Konfiguracja logowania - wypisywanie na konsolę
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Asbestos Detection API")

# GLOBALNE KONSTANTY
IMG_SIZE = 128
ZOOM = 20
MAX_WORKERS = 20
MAX_CONCURRENT_REQUESTS = 100  # Zwiększona liczba jednoczesnych requestów

# 1. Zmieniony typ obiektu modelu na sesję ONNX Runtime
MODEL: Optional[ort.InferenceSession] = None 

# GLOBALNA SESJA AIOHTTP (reużywalna)
GLOBAL_SESSION: Optional[aiohttp.ClientSession] = None

# SEMAFOR DO KONTROLI RÓWNOLEGŁOŚCI
SEMAPHORE: Optional[asyncio.Semaphore] = None

# 2. Poprawne, zsynchronizowane metadane normalizacyjne z checkpointa
MODEL_META: Dict[str, Any] = {
    'input_shape': (3, 128, 128),
    'mean': [0.3616, 0.3497, 0.3882],
    'std': [0.2406, 0.2315, 0.2276],
}

# Prekalkulowane wartości dla szybszej normalizacji
MEAN_NP = np.array(MODEL_META['mean'], dtype=np.float32).reshape(3, 1, 1)
STD_NP = np.array(MODEL_META['std'], dtype=np.float32).reshape(3, 1, 1)


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

async def get_aiohttp_session():
    """Get or create global aiohttp session with optimized settings."""
    global GLOBAL_SESSION
    if GLOBAL_SESSION is None or GLOBAL_SESSION.closed:
        connector = aiohttp.TCPConnector(
            limit=300,  # Jeszcze większy limit
            limit_per_host=100,
            ttl_dns_cache=300,
            force_close=False,
            enable_cleanup_closed=True
        )
        timeout = aiohttp.ClientTimeout(total=20, connect=5, sock_read=10)
        GLOBAL_SESSION = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )
        print(f"✓ Created aiohttp session with limit=300, limit_per_host=100")
    return GLOBAL_SESSION


@app.on_event("startup")
async def startup_event():
    """Initialize resources on startup."""
    global SEMAPHORE
    SEMAPHORE = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    print(f"✓ Semaphore initialized with {MAX_CONCURRENT_REQUESTS} concurrent requests")
    
    await get_aiohttp_session()
    
    # Preload model
    try:
        model = get_model()
        print(f"✓ Model loaded successfully")
        print(f"  - Model inputs: {[i.name for i in model.get_inputs()]}")
        print(f"  - Model outputs: {[o.name for o in model.get_outputs()]}")
    except Exception as e:
        print(f"✗ Model not loaded on startup: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup resources on shutdown."""
    global GLOBAL_SESSION
    if GLOBAL_SESSION and not GLOBAL_SESSION.closed:
        await GLOBAL_SESSION.close()


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
    start_time = time.time()
    x_tile, y_tile, pixel_x, pixel_y = lat_lng_to_pixel_in_tile(lat, lng, zoom)
    
    tile_size = 256
    tiles_needed = 3
    combined_size = tile_size * tiles_needed
    combined_image = Image.new('RGB', (combined_size, combined_size))

    # Przygotowanie listy kafelków do pobrania
    tiles_to_download = []
    timestamp = int(time.time() * 1000)
    for i in range(tiles_needed):
        for j in range(tiles_needed):
            tx = x_tile - tiles_needed // 2 + i
            ty = y_tile - tiles_needed // 2 + j
            url = f"https://mt1.google.com/vt/lyrs=s&x={tx}&y={ty}&z={zoom}&ts={timestamp}"
            tiles_to_download.append((url, i, j))

    # Użycie globalnej sesji
    session = await get_aiohttp_session()
    tasks = [_download_tile(session, url, i, j, tile_size) for url, i, j in tiles_to_download]
    
    tile_download_start = time.time()
    tile_results = await asyncio.gather(*tasks, return_exceptions=True)
    tile_download_time = time.time() - tile_download_start
    
    # Wklejanie pobranych kafelków
    for result in tile_results:
        if isinstance(result, Exception):
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
    
    total_time = time.time() - start_time
    
    return cropped


async def _download_tile(session: aiohttp.ClientSession, url: str, i: int, j: int, tile_size: int):
    """Helper function to download a single tile asynchronously."""
    try:
        async with session.get(url) as response:
            response.raise_for_status()
            content = await response.read()
            tile_img = Image.open(BytesIO(content))
            return (tile_img, i, j)
    except Exception as e:
        gray_tile = Image.new('RGB', (tile_size, tile_size), (128, 128, 128))
        return (gray_tile, i, j)


# 3. NOWA FUNKCJA ŁADOWANIA SESJI ONNX
def _load_onnx_session(path: str):
    global MODEL
    session_path = path.replace('.pt', '.onnx')

    if not os.path.exists(session_path):
        raise FileNotFoundError(f"Sesja ONNX nie znaleziona: {session_path}")

    try:
        # Optymalizacja sesji ONNX
        sess_options = ort.SessionOptions()
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        sess_options.intra_op_num_threads = 4  # Dostosuj do liczby rdzeni CPU
        
        MODEL = ort.InferenceSession(
            session_path,
            sess_options=sess_options,
            providers=['CPUExecutionProvider']  # Można dodać 'CUDAExecutionProvider' dla GPU
        )
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
    """Zoptymalizowana funkcja preprocessingowa używająca NumPy."""
    meta = MODEL_META
    
    input_shape = tuple(meta.get('input_shape'))
    _, H, W = input_shape
    
    # Resize jeśli potrzebne
    if pil_img.size != (W, H):
        pil_img = pil_img.resize((W, H), Image.BILINEAR)
    
    # Konwersja bezpośrednio do NumPy (szybsze niż przez PyTorch)
    img_array = np.array(pil_img, dtype=np.float32) / 255.0  # [H, W, C]
    
    # Transpozycja do [C, H, W]
    img_array = np.transpose(img_array, (2, 0, 1))
    
    # Normalizacja używając prekalkulowanych wartości
    img_array = (img_array - MEAN_NP) / STD_NP
    
    # Dodanie wymiaru batcha: [1, C, H, W]
    img_array = np.expand_dims(img_array, axis=0)
    
    return img_array


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
    start_time = time.time()
    print(f"\n{'='*60}")
    print(f"📍 SINGLE PREDICTION: lat={req.centroidLat:.6f}, lng={req.centroidLng:.6f}")
    
    try:
        model = get_model()
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model load error: {e}")

    # download image around centroid
    download_start = time.time()
    try:
        pil_img = await download_satellite_image(req.centroidLat, req.centroidLng, size=IMG_SIZE, zoom=ZOOM)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download image: {e}")
    download_time = time.time() - download_start
    print(f"  ⬇️  Download: {download_time:.3f}s")

    # prepare tensor
    prep_start = time.time()
    try:    
        input_np = _prepare_image_for_model(pil_img)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to prepare image: {e}")
    prep_time = time.time() - prep_start
    print(f"  🔧 Preprocessing: {prep_time:.3f}s")

    # inference
    inference_start = time.time()
    try:
        input_name = model.get_inputs()[0].name
        ort_outs = model.run(None, {input_name: input_np})
        logits = ort_outs[0]

        if logits.ndim == 2 and logits.shape[1] > 1:
            exp_logits = np.exp(logits - np.max(logits, axis=1, keepdims=True))
            probs = exp_logits / np.sum(exp_logits, axis=1, keepdims=True)
            prob_asbestos = float(probs[0, 1] if probs.shape[1] > 1 else probs[0, -1])
        else:
            prob_asbestos = float(1.0 / (1.0 + np.exp(-logits.flatten()[0])))

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model inference error (ONNX): {e}")
    
    inference_time = time.time() - inference_start
    total_time = time.time() - start_time
    
    print(f"  🧠 Inference: {inference_time:.3f}s")
    print(f"  ✅ TOTAL: {total_time:.3f}s | Result: {prob_asbestos:.4f}")
    print(f"{'='*60}\n")

    return {"isPotentiallyAsbestos": prob_asbestos}


@app.post("/batch_predict")
async def batch_predict(req: BatchPredictRequest) -> BatchPredictResponse:
    """Predict asbestos for multiple coordinates using high-performance async processing."""
    
    batch_start_time = time.time()
    batch_size = len(req.coordinates)
    
    print(f"\n{'='*80}")
    print(f"🚀 BATCH PREDICTION START")
    print(f"{'='*80}")
    print(f"📊 Batch size: {batch_size} coordinates")
    print(f"⚡ Max concurrent: {MAX_CONCURRENT_REQUESTS}")
    print(f"🌐 Connection pool: 300 total, 100 per host")
    
    if not req.coordinates:
        raise HTTPException(status_code=400, detail="Coordinates list cannot be empty")
    
    try:
        get_model()
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model load error: {e}")
    
    # Tworzenie tasków
    tasks_start = time.time()
    tasks = [
        _predict_single_coordinate_with_semaphore(
            coord.centroidLat, 
            coord.centroidLng, 
            coord.id,
            idx
        )
        for idx, coord in enumerate(req.coordinates)
    ]
    tasks_creation_time = time.time() - tasks_start
    print(f"✓ Created {len(tasks)} tasks in {tasks_creation_time:.3f}s")
    
    # Wykonanie wszystkich tasków równolegle
    print(f"⏳ Processing {batch_size} predictions in parallel...")
    gather_start = time.time()
    results = await asyncio.gather(*tasks, return_exceptions=True)
    gather_time = time.time() - gather_start
    
    print(f"\n{'='*80}")
    print(f"📈 BATCH STATISTICS")
    print(f"{'='*80}")
    print(f"⏱️  Parallel execution time: {gather_time:.3f}s")
    print(f"📊 Average time per prediction: {gather_time / batch_size:.3f}s")
    print(f"🚀 Throughput: {batch_size / gather_time:.2f} predictions/second")
    
    # Konwersja wyjątków na wyniki z błędami
    final_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            coord = req.coordinates[i]
            print(f"❌ [{i}] FAILED: {str(result)[:100]}")
            final_results.append(PredictionResult(
                centroidLat=coord.centroidLat,
                centroidLng=coord.centroidLng,
                id=coord.id,
                isPotentiallyAsbestos=0.0,
                success=False,
                error=str(result)
            ))
        else:
            final_results.append(result)
    
    successful = sum(1 for r in final_results if r.success)
    failed = len(final_results) - successful
    
    total_batch_time = time.time() - batch_start_time
    
    print(f"\n{'='*80}")
    print(f"✅ BATCH PREDICTION COMPLETE")
    print(f"{'='*80}")
    print(f"✅ Successful: {successful}/{batch_size} ({successful/batch_size*100:.1f}%)")
    print(f"❌ Failed: {failed}/{batch_size} ({failed/batch_size*100:.1f}%)")
    print(f"⏱️  TOTAL BATCH TIME: {total_batch_time:.3f}s")
    print(f"🚀 OVERALL THROUGHPUT: {batch_size / total_batch_time:.2f} predictions/second")
    print(f"{'='*80}\n")
    
    return BatchPredictResponse(
        results=final_results,
        total=len(final_results),
        successful=successful,
        failed=failed
    )


async def _predict_single_coordinate_with_semaphore(
    lat: float, 
    lng: float, 
    coord_id: Optional[str] = None,
    idx: int = 0
) -> PredictionResult:
    """Wrapper with semaphore for rate limiting."""
    async with SEMAPHORE:
        start_time = time.time()
        
        result = await _predict_single_coordinate_async(lat, lng, coord_id)
        
        elapsed = time.time() - start_time
        status_emoji = "✅" if result.success else "❌"
        print(f"{status_emoji} [{idx:4d}] {elapsed:.3f}s | prob={result.isPotentiallyAsbestos:.4f} | lat={lat:.6f}, lng={lng:.6f}")
        
        return result


async def _predict_single_coordinate_async(lat: float, lng: float, coord_id: Optional[str] = None) -> PredictionResult:
    """Asynchroniczna pomocnicza funkcja do przewidywania dla pojedynczej współrzędnej."""
    try:
        # Download image (async)
        pil_img = await download_satellite_image(lat, lng, size=IMG_SIZE, zoom=ZOOM)
        
        # Prepare tensor
        input_np = _prepare_image_for_model(pil_img)
        
        # Get model
        model = get_model()
        
        # Inference
        input_name = model.get_inputs()[0].name
        ort_outs = model.run(None, {input_name: input_np})
        logits = ort_outs[0]
        
        # Post-processing
        if logits.ndim == 2 and logits.shape[1] > 1:
            exp_logits = np.exp(logits - np.max(logits, axis=1, keepdims=True))
            probs = exp_logits / np.sum(exp_logits, axis=1, keepdims=True)
            prob_asbestos = float(probs[0, 1] if probs.shape[1] > 1 else probs[0, -1])
        else:
            prob_asbestos = float(1.0 / (1.0 + np.exp(-logits.flatten()[0])))
        
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


# Zachowanie starej synchronicznej funkcji dla kompatybilności
def _predict_single_coordinate(lat: float, lng: float, coord_id: Optional[str] = None) -> PredictionResult:
    """Synchroniczna wersja - uruchom async w nowym event loop."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(_predict_single_coordinate_async(lat, lng, coord_id))
    finally:
        loop.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)