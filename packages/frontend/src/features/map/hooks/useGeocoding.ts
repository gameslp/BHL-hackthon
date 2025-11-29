import { useQuery } from '@tanstack/react-query';
import { getGeocode } from '@/lib/api/generated/sdk.gen';

export const useGeocoding = (query: string) => {
  return useQuery({
    queryKey: ['geocode', query],
    queryFn: async () => {
      if (!query || query.length < 3) return [];

      const response = await getGeocode({
        query: { query },
      });

      return response.data?.data?.results || [];
    },
    enabled: query.length >= 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
