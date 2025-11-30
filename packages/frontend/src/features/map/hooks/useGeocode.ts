import { useMutation } from '@tanstack/react-query';
import { client } from '@/lib/api/generated/client.gen';

interface BatchGeocodeRequest {
  coordinates: Array<{
    latitude: number;
    longitude: number;
  }>;
}

interface ReverseGeocodeResult {
  latitude: number;
  longitude: number;
  address: string | null;
  city: string | null;
  country: string | null;
}

interface BatchGeocodeResponse {
  data: {
    results: ReverseGeocodeResult[];
  } | null;
  error: {
    message: string;
    code: string;
  } | null;
}

export const useBatchGeocode = () => {
  return useMutation({
    mutationFn: async (coordinates: BatchGeocodeRequest['coordinates']) => {
      const response = await client.POST('/geocode/batch', {
        body: { coordinates },
      }) as BatchGeocodeResponse;

      if (response.error) {
        throw new Error(response.error.message || 'Failed to geocode coordinates');
      }

      if (!response.data) {
        throw new Error('No data returned from geocoding service');
      }

      return response.data.results;
    },
  });
};
