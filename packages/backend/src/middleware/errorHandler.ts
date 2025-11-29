import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@repo/database';

export class AppError extends Error {
  constructor(
    public message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      data: null,
      error: {
        message: err.message,
        code: err.code,
      },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        data: null,
        error: {
          message: 'Resource already exists',
          code: 'DUPLICATE_ERROR',
        },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        data: null,
        error: {
          message: 'Resource not found',
          code: 'NOT_FOUND',
        },
      });
    }
  }

  res.status(500).json({
    data: null,
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  });
};
