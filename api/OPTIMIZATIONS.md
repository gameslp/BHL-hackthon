# ML Batch Prediction Optimizations

## Changes Made

### 1. Reduced Semaphore Limit (Line 42)
**Before:** `MAX_CONCURRENT_REQUESTS = 300`
**After:** `MAX_CONCURRENT_REQUESTS = 50`

**Reason:** With CPU-bound ONNX inference, 300 concurrent requests caused thread contention. Limited to 50 to match realistic CPU capacity.

**Impact:** Prevents resource thrashing, smoother execution

---

### 2. Added ThreadPoolExecutor for ONNX Inference (Lines 55, 135-136)
**New:** `INFERENCE_EXECUTOR = ThreadPoolExecutor(max_workers=cpu_count * 2)`

**Reason:** ONNX model.run() is CPU-bound and blocks the async event loop. Running it in a thread pool prevents blocking.

**Impact:** Allows image downloads to continue while inference runs

---

### 3. Batched ONNX Inference (Lines 388-424)
**Before:** Each prediction ran model.run() with single image (batch_size=1)
**After:** Images stacked into batches of 32, single model.run() call per batch

**Implementation:**
```python
# Stack images: [batch_size, 3, 128, 128]
batch_input = np.concatenate(batch, axis=0)

# Single inference call for entire batch
logits = await loop.run_in_executor(
    INFERENCE_EXECUTOR,
    lambda: model.run(None, {input_name: batch_input})[0]
)
```

**Reason:** ONNX Runtime is optimized for batch inference. Single call with 32 images is ~10x faster than 32 individual calls.

**Impact:** MASSIVE speedup - predicted 3-5x improvement in inference time

---

### 4. Separate Download and Inference Phases (Lines 404-438)
**Before:** Mixed async downloads with blocking inference in same loop
**After:**
- Phase 1: Download all images in parallel (async)
- Phase 2: Batch inference (CPU-bound in thread pool)

**Reason:** Maximizes parallelism - all downloads happen simultaneously, then all inference batched together

**Impact:** Better resource utilization, clearer performance metrics

---

### 5. Removed get_model() from Loop (Line 398)
**Before:** `model = get_model()` called inside loop for each prediction
**After:** `model = get_model()` called once before batch processing

**Reason:** Model is cached globally, but function call overhead is wasteful

**Impact:** Minor - removes unnecessary function calls

---

## Expected Performance Improvement

### Before (110 buildings):
- Asbestos check: 633ms (now parallelized) ✓
- ML predictions: 6105ms (sequential bottleneck) ✗
- **Total: ~6738ms**

### After (110 buildings):
- Download phase: ~1-2s (all parallel)
- Inference phase: ~1-2s (batched, 32 at a time = 4 batches)
- **Expected total: ~2-4s**

**Predicted speedup: 2-3x faster**

---

## Architecture Flow

### Old Architecture:
```
For each coordinate:
  1. Download image (async)
  2. BLOCKING inference (blocks event loop)
  3. Next coordinate...
```
Problem: Inference blocks downloads

### New Architecture:
```
Phase 1 (Parallel):
  Download all 110 images simultaneously

Phase 2 (Batched):
  Batch 1: Inference on images 0-31   (in thread pool)
  Batch 2: Inference on images 32-63  (in thread pool)
  Batch 3: Inference on images 64-95  (in thread pool)
  Batch 4: Inference on images 96-109 (in thread pool)
```
Benefit: Maximum parallelism + batch optimization

---

## Configuration Tuning

### MAX_CONCURRENT_REQUESTS (Line 42)
- Default: 50
- Increase if download is bottleneck (more network bandwidth available)
- Decrease if seeing connection errors

### MAX_INFERENCE_BATCH_SIZE (Line 43)
- Default: 32
- Increase for more GPU utilization (if using GPU)
- Decrease if running out of memory
- Sweet spot for CPU: 16-64

### INFERENCE_EXECUTOR workers (Line 135)
- Default: cpu_count * 2
- Increase for more parallel inference (if CPU has capacity)
- Decrease to reduce CPU contention

---

## Monitoring

The new implementation provides clear timing breakdown:

```
📥 PHASE 1: Downloading 110 satellite images...
✓ Downloaded 110/110 images in 1.234s

🧠 PHASE 2: Running batched ONNX inference...
✓ Completed 110 predictions in 1.567s
  - Average inference time: 0.0142s per image

⏱️  Download time: 1.234s
⏱️  Inference time: 1.567s
⏱️  TOTAL TIME: 2.801s
🚀 THROUGHPUT: 39.27 predictions/second
```

Watch these metrics to identify bottlenecks:
- High download time → Network bottleneck
- High inference time → CPU bottleneck
- High failed count → Stability issues
