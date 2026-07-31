import { Request, Response, NextFunction } from "express";
import { LoggerService } from "../services/LoggerService";
import { appConfig } from "../config/index";

/**
 * Custom operational error class for the application.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    // Restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Higher-order function to wrap async Express router handlers and automatically catch errors.
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export interface AppErrorInstance extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

/**
 * Global Express error handling middleware.
 */
export const errorHandler = (
  err: AppErrorInstance,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "An unexpected error occurred / حدث خطأ غير متوقع";

  // Log to LoggerService
  LoggerService.error(
    "api_error",
    `[${req.method} ${req.originalUrl}] - Status ${statusCode}: ${message}`,
    {
      method: req.method,
      url: req.originalUrl,
      statusCode,
      stack: err.stack,
      ip: req.ip
    }
  );

  // Return consistent error payload compatible with the frontend expectations
  res.status(statusCode).json({
    success: false,
    status: "error",
    error: message,
    stack: !appConfig.isProduction ? err.stack : undefined
  });
};
