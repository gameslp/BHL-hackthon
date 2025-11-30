import { useMutation, useQuery } from '@tanstack/react-query';
import { postBbox, getBuildingsById } from '@/lib/api/generated/sdk.gen';
import type { BBoxRequest } from '@repo/validation';
import type { Building } from '@/lib/api/generated/types.gen';

export const useBBoxBuildings = () => {
  return useMutation({
    mutationFn: async (bbox: BBoxRequest) => {
      const response = await postBbox({
        body: bbox,
      });

      // Check if response has error
      if (response.error) {
        throw new Error(response.error.message || 'Failed to fetch buildings');
      }

      // Check if data exists
      if (!response.data) {
        throw new Error('No data returned from server');
      }

      return response.data;
    },
  });
};

export const useBuilding = (id: string | null) => {
  return useQuery({
    queryKey: ['building', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await getBuildingsById({
        path: { id },
      });
      return response.data;
    },
    enabled: !!id,
  });
};
