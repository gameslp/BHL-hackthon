import { Response } from 'express';

export const sendSuccess = <T>(res: Response, data: T, statusCode: number = 200) => {
  res.status(statusCode).json({
    data,
    error: null,
  });
};

export const sendError = (res: Response, message: string, code: string, statusCode: number = 500) => {
  res.status(statusCode).json({
    data: null,
    error: {
      message,
      code,
    },
  });
};
