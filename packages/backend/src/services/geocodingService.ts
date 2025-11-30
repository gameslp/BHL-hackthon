import axios from 'axios';

interface MapboxFeature {
  place_name: string;
  center: [number, number]; // [lng, lat]
}

interface ReverseGeocodeResult {
  latitude: number;
  longitude: number;
  address: string | null;
  city: string | null;
  country: string | null;
}

interface BatchGeocodeRequest {
  latitude: number;
  longitude: number;
}

export class GeocodingService {
  private static readonly MAPBOX_API_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
  private static readonly MAPBOX_BATCH_API_URL = 'https://api.mapbox.com/search/geocode/v6/batch';

  static async searchAddress(query: string): Promise<Array<{ placeName: string; center: [number, number] }>> {
    const accessToken = process.env.MAPBOX_ACCESS_TOKEN;

    if (!accessToken || accessToken === 'your_mapbox_token_here') {
      throw new Error('Mapbox access token not configured');
    }

    try {
      const response = await axios.get(
        `${this.MAPBOX_API_URL}/${encodeURIComponent(query)}.json`,
        {
          params: {
            access_token: accessToken,
            limit: 5,
            countries: 'pl' // Limit to Poland
          },
          timeout: 5000,
        }
      );

      const features: MapboxFeature[] = response.data.features || [];

      return features.map(feature => ({
        placeName: feature.place_name,
        center: feature.center,
      }));
    } catch (error) {
      console.error('Geocoding error:', error);
      throw new Error('Failed to geocode address');
    }
  }

  /**
   * Batch reverse geocoding: converts multiple lat/lng coordinates to addresses
   * Uses Mapbox Batch Geocoding API v6
   * @param coordinates Array of {latitude, longitude} objects
   * @returns Promise<ReverseGeocodeResult[]>
   */
  static async batchReverseGeocode(coordinates: BatchGeocodeRequest[]): Promise<ReverseGeocodeResult[]> {
    const accessToken = process.env.MAPBOX_ACCESS_TOKEN;

    if (!accessToken || accessToken === 'your_mapbox_token_here') {
      throw new Error('Mapbox access token not configured');
    }

    if (coordinates.length === 0) {
      return [];
    }

    // Mapbox batch API has a limit of 50 requests per batch
    const BATCH_LIMIT = 50;

    try {
      // Split into chunks if more than 50 coordinates
      const results: ReverseGeocodeResult[] = [];

      for (let i = 0; i < coordinates.length; i += BATCH_LIMIT) {
        const chunk = coordinates.slice(i, i + BATCH_LIMIT);
        const chunkResults = await this.processBatch(chunk, accessToken);
        results.push(...chunkResults);
      }

      return results;
    } catch (error) {
      console.error('Batch reverse geocoding error:', error);
      throw new Error('Failed to perform batch reverse geocoding');
    }
  }

  private static async processBatch(
    coordinates: BatchGeocodeRequest[],
    accessToken: string
  ): Promise<ReverseGeocodeResult[]> {
    try {
      // Build the request body for batch geocoding
      const requests = coordinates.map((coord) => ({
        types: ['address', 'place'],
        longitude: coord.longitude,
        latitude: coord.latitude,
        limit: 1,
      }));

      const response = await axios.post(
        this.MAPBOX_BATCH_API_URL,
        requests,
        {
          params: {
            access_token: accessToken,
          },
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 seconds for batch requests
        }
      );

      console.log('Batch geocoding response status:', response.status);
      //console.log('Batch geocoding response data:', response.data.batch);

      console.log('Batch geocoding response data:', (response.data.batch as any[]).map(item => item.features.properties));

      // Parse batch response
      const batchResponses = response.data.batch || [];
      console.log('Batch geocoding responses:', batchResponses);
      return coordinates.map((coord, index) => {
        const batchItem = batchResponses[index];

        if (!batchItem || !batchItem.features || batchItem.features.length === 0) {
          // No result found for this coordinate
          return {
            latitude: coord.latitude,
            longitude: coord.longitude,
            address: null,
            city: null,
            country: null,
          };
        }

        const feature = batchItem.features[0];
        const properties = feature.properties || {};

        // Extract address components
        const address = properties.full_address || properties.name || null;
        const city = this.extractCity(feature);
        const country = properties.country || null;

        return {
          latitude: coord.latitude,
          longitude: coord.longitude,
          address,
          city,
          country,
        };
      });
    } catch (error: any) {
      console.error('Batch processing error:', error.response?.data || error.message);

      // Return null results on error
      return coordinates.map(coord => ({
        latitude: coord.latitude,
        longitude: coord.longitude,
        address: null,
        city: null,
        country: null,
      }));
    }
  }

  private static extractCity(feature: any): string | null {
    const context = feature.context || [];

    // Try to find city/locality from context
    for (const ctx of context) {
      if (ctx.id && (ctx.id.startsWith('place.') || ctx.id.startsWith('locality.'))) {
        return ctx.text || null;
      }
    }

    // Fallback to properties
    const props = feature.properties || {};
    return props.place || props.locality || null;
  }
}
