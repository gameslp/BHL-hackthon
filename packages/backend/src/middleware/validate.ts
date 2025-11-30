import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError, ZodSchema } from 'zod';

export const validate = (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req[source]);
      next();
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          data: null,
          error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: error.errors,
          },
        });
      }
      next(error);
    }
  };
};
