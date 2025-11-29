import { Request, Response } from 'express';
import { prisma, Prisma } from '@repo/database';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../middleware/response';
import { OverpassService } from '../services/overpassService';
import { AsbestosCheckService } from '../services/asbestosCheckService';
import { MLService } from '../services/mlService';

export const getBuildingsInBBox = asyncHandler(async (req: Request, res: Response) => {
  const { ne, sw } = req.body;

  // Extract coordinates
  const { lat: north, lng: east } = ne;
  const { lat: south, lng: west } = sw;

  // Step 1: Fetch buildings from Overpass API
  console.log(`Fetching buildings from Overpass API for bbox: ${south},${west},${north},${east}`);
  const overpassBuildings = await OverpassService.getBuildingsInBBox(south, west, north, east);

  console.log(`Found ${overpassBuildings.length} buildings from Overpass API`);

  // Step 2: Process each building
  const processedBuildings = [];

  for (const overpassBuilding of overpassBuildings) {
    const polygon = OverpassService.convertToPolygon(overpassBuilding);

    if (polygon.length === 0) continue;

    const centroid = OverpassService.calculateCentroid(polygon);

    // Check if building already exists in database by centroid proximity
    // (since we don't have OSM ID stored, we use spatial proximity)
    const existingBuilding = await prisma.building.findFirst({
      where: {
        AND: [
          { centroidLng: { gte: centroid.lng - 0.0001, lte: centroid.lng + 0.0001 } },
          { centroidLat: { gte: centroid.lat - 0.0001, lte: centroid.lat + 0.0001 } },
        ],
      },
    });

    if (existingBuilding) {
      // Building exists - return from database
      processedBuildings.push(existingBuilding);
    } else {
      // New building - process it
      console.log(`Processing new building at ${centroid.lng}, ${centroid.lat}`);

      // Check asbestos database
      const isAsbestos = await AsbestosCheckService.checkIsAsbestos(polygon);

      // Get ML prediction
      const isPotentiallyAsbestos = await MLService.predictAsbestos(polygon);

      // Save to database
      const newBuilding = await prisma.building.create({
        data: {
          polygon: polygon,
          centroidLng: centroid.lng,
          centroidLat: centroid.lat,
          isAsbestos,
          isPotentiallyAsbestos,
        },
      });

      processedBuildings.push(newBuilding);
    }
  }

  // Step 3: Calculate statistics
  const stats = {
    total: processedBuildings.length,
    asbestos: processedBuildings.filter(b => b.isAsbestos).length,
    potentiallyAsbestos: processedBuildings.filter(b => b.isPotentiallyAsbestos === true).length,
    clean: processedBuildings.filter(b => !b.isAsbestos && b.isPotentiallyAsbestos === false).length,
    unknown: processedBuildings.filter(b => !b.isAsbestos && b.isPotentiallyAsbestos === null).length,
  };

  // Step 4: Format response (convert polygon from Prisma JSON to array)
  const formattedBuildings = processedBuildings.map(building => ({
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
  }));

  sendSuccess(res, {
    buildings: formattedBuildings,
    stats,
  });
});
