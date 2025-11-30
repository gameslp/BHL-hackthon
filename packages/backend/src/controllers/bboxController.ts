import { Request, Response } from 'express';
import { prisma, Prisma, Building } from '@repo/database';
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

  // Step 2: Convert Overpass buildings to polygons and check database
  const buildingsToProcess: Array<{
    polygon: number[][];
    centroid: { lng: number; lat: number };
    existing?: Building;
  }> = [];

  for (const overpassBuilding of overpassBuildings) {
    const polygon = OverpassService.convertToPolygon(overpassBuilding);
    if (polygon.length === 0) continue;

    const centroid = OverpassService.calculateCentroid(polygon);

    // Check if building already exists in database by centroid proximity
    const existingBuilding = await prisma.building.findFirst({
      where: {
        AND: [
          { centroidLng: { gte: centroid.lng - 0.0001, lte: centroid.lng + 0.0001 } },
          { centroidLat: { gte: centroid.lat - 0.0001, lte: centroid.lat + 0.0001 } },
        ],
      },
    });

    buildingsToProcess.push({
      polygon,
      centroid,
      existing: existingBuilding || undefined,
    });
  }

  // Step 3: Batch process new buildings
  const newBuildings = buildingsToProcess.filter(b => !b.existing);
  const existingBuildings = buildingsToProcess.filter(b => b.existing).map(b => b.existing!);

  console.log(`Found ${existingBuildings.length} existing buildings, processing ${newBuildings.length} new buildings`);

  let createdBuildings: Building[] = [];

  if (newBuildings.length > 0) {
    // Run asbestos check and ML predictions in parallel
    const asbestosStartTime = Date.now();
    const mlStartTime = Date.now();

    const [asbestosResults, mlResults] = await Promise.all([
      AsbestosCheckService.batchCheckIsAsbestos(newBuildings.map(b => b.polygon)),
      MLService.batchPredictAsbestos(newBuildings.map(b => b.centroid))
    ]);

    const asbestosExecutionTime = Date.now() - asbestosStartTime;
    const mlExecutionTime = Date.now() - mlStartTime;
    console.log(`✓ Asbestos check completed for ${newBuildings.length} buildings in ${asbestosExecutionTime}ms`);
    console.log(`✓ ML predictions completed for ${newBuildings.length} buildings in ${mlExecutionTime}ms`);

    // Create buildings one by one to avoid duplicates and get IDs back
    // (createMany doesn't return created records)
    const createdPromises = newBuildings.map(async (building, index) => {
      try {
        return await prisma.building.create({
          data: {
            polygon: building.polygon,
            centroidLng: building.centroid.lng,
            centroidLat: building.centroid.lat,
            isAsbestos: asbestosResults[index] || false,
            isPotentiallyAsbestos: mlResults[index],
          },
        });
      } catch (error) {
        // If duplicate, fetch the existing one
        console.log(`Building at ${building.centroid.lng}, ${building.centroid.lat} already exists, fetching...`);
        const existing = await prisma.building.findFirst({
          where: {
            AND: [
              { centroidLng: { gte: building.centroid.lng - 0.00001, lte: building.centroid.lng + 0.00001 } },
              { centroidLat: { gte: building.centroid.lat - 0.00001, lte: building.centroid.lat + 0.00001 } },
            ],
          },
        });
        return existing!;
      }
    });

    createdBuildings = await Promise.all(createdPromises);
  }

  // Combine and deduplicate buildings by ID
  const allBuildings = [...existingBuildings, ...createdBuildings];
  const buildingMap = new Map<string, Building>();
  allBuildings.forEach(building => {
    buildingMap.set(building.id, building);
  });
  const processedBuildings = Array.from(buildingMap.values());

  // Step 4: Calculate statistics
  const stats = {
    total: processedBuildings.length,
    asbestos: processedBuildings.filter(b => b.isAsbestos).length,
    potentiallyAsbestos: processedBuildings.filter(b => b.isPotentiallyAsbestos === true && b.isAsbestos === false).length,
    unknown: processedBuildings.filter(b => b.isAsbestos === false && b.isPotentiallyAsbestos === false).length,
  };

  // Step 5: Format response (convert polygon from Prisma JSON to array)
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
