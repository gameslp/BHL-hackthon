import { useMutation, useQuery } from '@tanstack/react-query';
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

export const useBuilding = (id: string | null) => {
  return useQuery({
    queryKey: ['building', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiClient.fetch<{ data: Building; error: null }>(`/buildings/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};
