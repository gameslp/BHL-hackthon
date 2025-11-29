import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../middleware/response';
import { GeocodingService } from '../services/geocodingService';

export const searchAddress = asyncHandler(async (req: Request, res: Response) => {
  const { query } = req.query as { query: string };

  const results = await GeocodingService.searchAddress(query);

  sendSuccess(res, { results });
});
