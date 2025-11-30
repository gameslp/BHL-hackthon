import { Router } from 'express';
import { getBuildingsInBBox } from '../controllers/bboxController';
import { getBuildingById } from '../controllers/buildingsController';
import { searchAddress, batchReverseGeocode } from '../controllers/geocodingController';
import { validate } from '../middleware/validate';
import { BBoxRequestSchema, GeocodeQuerySchema, BatchReverseGeocodeRequestSchema } from '@repo/validation';

const router = Router();

// POST /api/bbox - Get buildings in bounding box
router.post('/bbox', validate(BBoxRequestSchema, 'body'), getBuildingsInBBox);

// GET /api/buildings/:id - Get building by ID
router.get('/buildings/:id', getBuildingById);

// GET /api/geocode - Search for address
router.get('/geocode', validate(GeocodeQuerySchema, 'query'), searchAddress);

// POST /api/geocode/batch - Batch reverse geocode coordinates
router.post('/geocode/batch', validate(BatchReverseGeocodeRequestSchema, 'body'), batchReverseGeocode);

export default router;
