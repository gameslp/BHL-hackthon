import axios from 'axios';

interface OverpassBuilding {
  type: string;
  id: number;
  geometry: Array<{ lat: number; lon: number }>;
}

export class OverpassService {
  private static readonly OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

  static async getBuildingsInBBox(
    south: number,
    west: number,
    north: number,
    east: number
  ): Promise<OverpassBuilding[]> {
    // Overpass QL query to get all buildings in bbox
    const query = `
      [out:json];
      (
        way["building"](${south},${west},${north},${east});
        relation["building"](${south},${west},${north},${east});
      );
      out geom;
    `;

    try {
      const response = await axios.post(
        this.OVERPASS_URL,
        query,
        {
          headers: { 'Content-Type': 'text/plain' },
          timeout: 30000, // 30 second timeout
        }
      );

      return response.data.elements || [];
    } catch (error) {
      console.error('Overpass API error:', error);
      throw new Error('Failed to fetch buildings from Overpass API');
    }
  }

  static convertToPolygon(building: OverpassBuilding): number[][] {
    if (building.geometry) {
      return building.geometry.map(node => [node.lon, node.lat]);
    }
    return [];
  }

  static calculateCentroid(polygon: number[][]): { lng: number; lat: number } {
    if (polygon.length === 0) {
      return { lng: 0, lat: 0 };
    }

    let sumLng = 0;
    let sumLat = 0;

    for (const [lng, lat] of polygon) {
      sumLng += lng;
      sumLat += lat;
    }

    return {
      lng: sumLng / polygon.length,
      lat: sumLat / polygon.length,
    };
  }
}
