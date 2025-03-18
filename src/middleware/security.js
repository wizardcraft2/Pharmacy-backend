import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';

// Rate limiting configuration
export const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// API specific rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many requests from this IP, please try again after 15 minutes'
  }
});

// Stricter rate limit for auth routes
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  message: {
    error: 'Too many login attempts',
    message: 'Too many login attempts from this IP, please try again after an hour'
  }
});

// Security middleware configuration
export const securityMiddleware = [
  // Set security HTTP headers
  helmet(),
  
  // Sanitize data
  mongoSanitize(),
  
  // Prevent XSS attacks
  xss(),
];