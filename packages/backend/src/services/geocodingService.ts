import axios from 'axios';

interface MapboxFeature {
  place_name: string;
  center: [number, number]; // [lng, lat]
}

export class GeocodingService {
  private static readonly MAPBOX_API_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

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
}
