import { Request, Response } from 'express';
import { prisma } from '@repo/database';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../middleware/response';
import { AppError } from '../middleware/errorHandler';

export const getBuildingById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const building = await prisma.building.findUnique({
    where: { id },
  });

  if (!building) {
    throw new AppError('Building not found', 'NOT_FOUND', 404);
  }

  // Format response
  const formattedBuilding = {
    id: building.id,
    polygon: building.polygon as number[][],
    centroid: {
      lng: building.centroidLng,
      lat: building.centroidLat,
    },
    isAsbestos: building.isAsbestos,
    isPotentiallyAsbestos: building.isPotentiallyAsbestos,
    createdAt: building.createdAt.toISOString(),
    updatedAt: building.updatedAt.toISOString(),
  };

  sendSuccess(res, formattedBuilding);
});
