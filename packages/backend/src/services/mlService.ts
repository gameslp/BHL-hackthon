import axios from 'axios';

/**
 * Service for calling Python ML model to predict asbestos presence.
 * The ML service is still in development, so this uses a mock implementation.
 */
export class MLService {
  private static readonly ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

  /**
   * Predict if building potentially has asbestos based on ML model
   * @param polygon - Building polygon coordinates
   * @returns true if potentially has asbestos, false otherwise, null if service unavailable
   */
  static async predictAsbestos(centroid: { lng: number; lat: number }): Promise<boolean | null> {
    try {
      // Try to call real ML service if available
      const response = await axios.post(
        `${this.ML_SERVICE_URL}/predict`,
        { centroidLng: centroid.lng, centroidLat: centroid.lat },
        { timeout: 5000 }
      );

      return response.data.isPotentiallyAsbestos > 0.6;
    } catch (error) {
      // ML service not available yet - return null (unknown)
      console.log('ML service error:', error);
      console.warn('ML service unavailable, returning null for isPotentiallyAsbestos');
      return null;
    }
  }

  /**
   * Batch predict for multiple buildings
   * @param buildings - Array of building polygons
   * @returns Array of predictions (true/false/null)
   */
  static async batchPredictAsbestos(centroids: { lng: number; lat: number }[]): Promise<(boolean | null)[]> {
    try {
      const response = await axios.post(
        `${this.ML_SERVICE_URL}/predict/batch`,
        { coordinates: centroids.map(c => ({ centroidLng: c.lng, centroidLat: c.lat })) },
        { timeout: 10000 }
      );

      return response.data.predictions;
    } catch (error) {
      // Fallback to individual predictions
      return Promise.all(centroids.map(centroid => {
        return this.predictAsbestos(centroid);
      }));
    }
  }
}
