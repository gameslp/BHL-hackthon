import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

interface GeocodeResult {
  placeName: string;
  center: [number, number]; // [lng, lat]
}

interface GeocodeResponse {
  data: {
    results: GeocodeResult[];
  };
  error: null;
}

export const useGeocoding = (query: string) => {
  return useQuery({
    queryKey: ['geocode', query],
    queryFn: async (): Promise<GeocodeResult[]> => {
      if (!query || query.length < 3) return [];

      const response = await apiClient.fetch<GeocodeResponse>(
        `/geocode?query=${encodeURIComponent(query)}`
      );

      return response.data.results;
    },
    enabled: query.length >= 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
