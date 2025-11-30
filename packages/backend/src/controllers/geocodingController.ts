import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../middleware/response';
import { GeocodingService } from '../services/geocodingService';
import type { BatchReverseGeocodeRequest } from '@repo/validation';

export const searchAddress = asyncHandler(async (req: Request, res: Response) => {
  const { query } = req.query as { query: string };

  const results = await GeocodingService.searchAddress(query);

  sendSuccess(res, { results });
});

export const batchReverseGeocode = asyncHandler(async (req: Request, res: Response) => {
  const { coordinates } = req.body as BatchReverseGeocodeRequest;

  const results = await GeocodingService.batchReverseGeocode(coordinates);

  sendSuccess(res, { results });
});
