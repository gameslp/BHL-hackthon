import { useMutation } from '@tanstack/react-query';
import { postGeocodeBatch } from '@/lib/api/generated';
import type { BatchGeocodeRequest, BatchGeocodeResponse } from '@/lib/api/generated/types.gen';

export const useBatchGeocode = () => {
  return useMutation({
    mutationFn: async (coordinates: BatchGeocodeRequest['coordinates']) => {
      const response = await postGeocodeBatch({
        body: { coordinates },
      });

      if (response.error) {
        const errorMessage = (response.error as any).message || 'Failed to geocode coordinates';
        throw new Error(errorMessage);
      }

      if (!response.data) {
        throw new Error('No data returned from geocoding service');
      }

      return (response.data.data as any).results;
    },
  });
};
