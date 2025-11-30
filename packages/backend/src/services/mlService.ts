import axios from 'axios';

interface PredictionResult {
  centroidLat: number;
  centroidLng: number;
  id?: string;
  isPotentiallyAsbestos: number;
  success: boolean;
  error?: string;
}

interface BatchPredictResponse {
  results: PredictionResult[];
  total: number;
  successful: number;
  failed: number;
}

/**
 * Service for calling Python ML model to predict asbestos presence.
 */
export class MLService {
  private static readonly ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
  private static readonly PREDICTION_THRESHOLD = 0.7; // Probability threshold for positive prediction

  /**
   * Batch predict for multiple buildings using ML service
   * @param centroids - Array of building centroids with optional IDs
   * @returns Array of predictions (true/false/null)
   */
  static async batchPredictAsbestos(
    centroids: Array<{ lng: number; lat: number; id?: string }>
  ): Promise<(boolean | null)[]> {
    if (centroids.length === 0) {
      return [];
    }

    try {
      const response = await axios.post<BatchPredictResponse>(
        `${this.ML_SERVICE_URL}/batch_predict`,
        {
          coordinates: centroids.map(c => ({
            centroidLng: c.lng,
            centroidLat: c.lat,
            id: c.id,
          })),
        },
        { timeout: 30000 } // 30 second timeout for batch processing
      );

      // Map results back to boolean array based on threshold
      return response.data.results.map(result => {
        if (!result.success) {
          console.error(`ML prediction failed for ${result.id || 'unknown'}:`, result.error);
          return null;
        }
        return result.isPotentiallyAsbestos > this.PREDICTION_THRESHOLD;
      });
    } catch (error) {
      // ML service not available - return all null (unknown)
      console.error('ML service unavailable, returning null for isPotentiallyAsbestos');
      return centroids.map(() => null);
    }
  }

  /**
   * Predict if building potentially has asbestos based on ML model
   * @param centroid - Building centroid coordinates
   * @param id - Optional building ID for tracking
   * @returns true if potentially has asbestos, false otherwise, null if service unavailable
   */
  static async predictAsbestos(
    centroid: { lng: number; lat: number },
    id?: string
  ): Promise<boolean | null> {
    // Use batch predict for single prediction to maintain consistency
    const results = await this.batchPredictAsbestos([{ ...centroid, id }]);
    return results[0] ?? null;
  }
}
