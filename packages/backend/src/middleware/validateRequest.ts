import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { CustomError } from './errorHandler';

/**
 * Validation middleware to check express-validator results
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err: any) => err.msg).join(', ');
    throw new CustomError(`Validation failed: ${errorMessages}`, 400);
  }
  next();
};
