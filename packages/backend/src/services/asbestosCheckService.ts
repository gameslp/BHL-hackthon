import { checkBuildingForAsbestos, batchCheckBuildings } from '@repo/asbestos-checker';

/**
 * Service for checking if a building is in the asbestos database.
 * Integrated with the Polish asbestos database WMS service.
 */
export class AsbestosCheckService {
  /**
   * Check if building at given coordinates is in asbestos database
   * @param polygon - Building polygon coordinates [[lng, lat], ...]
   * @returns true if building has asbestos, false otherwise
   */
  static async checkIsAsbestos(polygon: number[][]): Promise<boolean> {
    try {
      return await checkBuildingForAsbestos(polygon);
    } catch (error) {
      console.error('Error checking building for asbestos:', error);
      // Return false on error to avoid blocking the entire request
      return false;
    }
  }

  /**
   * Batch check multiple buildings
   * @param buildings - Array of building polygons
   * @returns Array of boolean results
   */
  static async batchCheckIsAsbestos(buildings: number[][][]): Promise<boolean[]> {
    try {
      // Use optimized batch function with 20 concurrent requests
      return await batchCheckBuildings(buildings, 20);
    } catch (error) {
      console.error('Error in batch asbestos check:', error);
      // Return all false on error
      return buildings.map(() => false);
    }
  }
}
