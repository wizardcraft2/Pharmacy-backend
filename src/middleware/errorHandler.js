import { captureException } from '../services/sentry';
import logger from '../services/logger';

// Global error handling middleware
export const errorHandler = (err, req, res, next) => {
    // Log error details
    logger.error('Error:', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      body: req.body,
      query: req.query,
      params: req.params,
    });
  
    // Send error to Sentry
    captureException(err, {
      user: req.user?.id,
      path: req.path,
      method: req.method,
    });
  
    // Mongoose validation error
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation Error',
        details: Object.values(err.errors).map(e => e.message)
      });
    }
  
    // Mongoose duplicate key error
    if (err.code === 11000) {
      return res.status(400).json({
        error: 'Duplicate Error',
        message: 'A record with this information already exists'
      });
    }
  
    // JWT authentication error
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Authentication Error',
        message: 'Invalid token'
      });
    }
  
    // Default error response
    const statusCode = err.status || 500;
    const errorResponse = {
      error: err.name || 'Server Error',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred'
        : err.message,
    };
  
    if (process.env.NODE_ENV !== 'production') {
      errorResponse.stack = err.stack;
    }
  
    res.status(statusCode).json(errorResponse);
  };