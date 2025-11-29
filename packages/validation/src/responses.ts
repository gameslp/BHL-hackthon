import { z } from 'zod';

// Building schema for response validation
const BuildingSchema = z.object({
  id: z.string(),
  polygon: z.array(z.array(z.number())),
  centroid: z.object({
    lng: z.number(),
    lat: z.number(),
  }),
  isAsbestos: z.boolean(),
  isPotentiallyAsbestos: z.boolean().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Statistics schema
const BBoxStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  asbestos: z.number().int().nonnegative(),
  potentiallyAsbestos: z.number().int().nonnegative(),
  clean: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
});

// POST /bbox response
export const BBoxResponseSchema = z.object({
  data: z.object({
    buildings: z.array(BuildingSchema),
    stats: BBoxStatsSchema,
  }),
  error: z.null(),
});

// GET /buildings/:id response
export const BuildingResponseSchema = z.object({
  data: BuildingSchema,
  error: z.null(),
});

// Geocode result
const GeocodeResultSchema = z.object({
  placeName: z.string(),
  center: z.tuple([z.number(), z.number()]),
});

// GET /geocode response
export const GeocodeResponseSchema = z.object({
  data: z.object({
    results: z.array(GeocodeResultSchema),
  }),
  error: z.null(),
});

// Error response
export const ErrorResponseSchema = z.object({
  data: z.null(),
  error: z.object({
    message: z.string(),
    code: z.string(),
  }),
});

export type BuildingResponse = z.infer<typeof BuildingResponseSchema>;
export type BBoxResponse = z.infer<typeof BBoxResponseSchema>;
export type GeocodeResponse = z.infer<typeof GeocodeResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
