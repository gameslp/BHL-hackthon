import { z } from 'zod';

// Coordinate validation
export const CoordinateSchema = z.tuple([
  z.number().min(-180).max(180), // longitude
  z.number().min(-90).max(90)    // latitude
]);

// Bounding box corner
export const CornerSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// POST /bbox request
export const BBoxRequestSchema = z.object({
  ne: CornerSchema.describe('North-east corner'),
  sw: CornerSchema.describe('South-west corner'),
}).refine(
  (data) => {
    // Validate that NE is actually north and east of SW
    return data.ne.lat > data.sw.lat && data.ne.lng > data.sw.lng;
  },
  {
    message: 'North-east corner must be north and east of south-west corner',
  }
).refine(
  (data) => {
    // Calculate area and ensure it's not too large (max ~2km × 2km)
    // At 52°N (Leszno): 0.0005 deg² ≈ 2.2km × 1.4km ≈ 3.1 km²
    const latDiff = data.ne.lat - data.sw.lat;
    const lngDiff = data.ne.lng - data.sw.lng;
    const area = latDiff * lngDiff;
    return area <= 0.0005;
  },
  {
    message: 'Bounding box area too large (max ~2km × 2km)',
  }
);

// GET /geocode query params
export const GeocodeQuerySchema = z.object({
  query: z.string().min(1).max(200),
});

// POST /geocode/batch request
export const BatchReverseGeocodeRequestSchema = z.object({
  coordinates: z.array(
    z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
  ).min(1).max(1000).describe('Array of coordinates to reverse geocode (max 1000)'),
});

export type BBoxRequest = z.infer<typeof BBoxRequestSchema>;
export type GeocodeQuery = z.infer<typeof GeocodeQuerySchema>;
export type BatchReverseGeocodeRequest = z.infer<typeof BatchReverseGeocodeRequestSchema>;
export type Coordinate = z.infer<typeof CoordinateSchema>;
