/**
 * EXAMPLE: How to use hey-api generated client
 *
 * After running `pnpm generate:client`, you can use the generated functions like this:
 */

import { useMutation, useQuery } from '@tanstack/react-query';
// These will be available after generation:
// import { getBuildingsById, postBbox } from '@/lib/api/generated';
// import type { BBoxRequest, BBoxResponse } from '@/lib/api/generated/types';

// For now, using custom client
import { apiClient } from '@/lib/api/client';
import type { BBoxRequest } from '@repo/validation';

interface Building {
  id: string;
  polygon: number[][];
  centroid: { lng: number; lat: number };
  isAsbestos: boolean;
  isPotentiallyAsbestos: boolean | null;
  createdAt: string;
  updatedAt: string;
}

interface BBoxStats {
  total: number;
  asbestos: number;
  potentiallyAsbestos: number;
  clean: number;
  unknown: number;
}

interface BBoxResponse {
  data: {
    buildings: Building[];
    stats: BBoxStats;
  };
  error: null;
}

// OPTION 1: Using custom client (current implementation)
export const useBBoxBuildings = () => {
  return useMutation({
    mutationFn: async (bbox: BBoxRequest): Promise<BBoxResponse> => {
      return apiClient.fetch<BBoxResponse>('/bbox', {
        method: 'POST',
        body: JSON.stringify(bbox),
      });
    },
  });
};

// OPTION 2: Using hey-api generated client (after generation)
/*
export const useBBoxBuildingsGenerated = () => {
  return useMutation({
    mutationFn: async (bbox: BBoxRequest) => {
      // postBbox is auto-generated from OpenAPI spec
      const response = await postBbox({
        body: bbox
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response;
    },
  });
};

export const useBuildingGenerated = (id: string | null) => {
  return useQuery({
    queryKey: ['building', id],
    queryFn: async () => {
      if (!id) return null;

      // getBuildingsById is auto-generated from OpenAPI spec
      const response = await getBuildingsById({
        path: { id }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    },
    enabled: !!id,
  });
};
*/
