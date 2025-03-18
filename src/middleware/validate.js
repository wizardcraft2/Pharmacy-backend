import { body, param, query, validationResult } from 'express-validator';

// Validation middleware
export const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    res.status(400).json({
      error: 'Validation Error',
      details: errors.array()
    });
  };
};

// Drug validation rules
export const drugValidation = {
  create: [
    body('tradeName').trim().notEmpty().withMessage('Trade name is required'),
    body('activeIngredient').trim().notEmpty().withMessage('Active ingredient is required'),
    body('manufacturer').isMongoId().withMessage('Valid manufacturer ID is required'),
    body('dosageForm').optional().trim(),
    body('strength').optional().trim(),
    body('description').optional().trim(),
    body('uses.*').optional().trim(),
    body('sideEffects.*').optional().trim(),
  ],
  update: [
    param('id').isMongoId().withMessage('Valid drug ID is required'),
    body('tradeName').optional().trim(),
    body('activeIngredient').optional().trim(),
    body('manufacturer').optional().isMongoId().withMessage('Valid manufacturer ID is required'),
  ],
  search: [
    query('q').trim().notEmpty().withMessage('Search query is required'),
    query('type').optional().isIn(['name', 'ingredient', 'manufacturer']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ]
};

// Manufacturer validation rules
export const manufacturerValidation = {
  create: [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('country').optional().trim(),
    body('website').optional().trim().isURL().withMessage('Invalid website URL'),
    body('description').optional().trim(),
    body('authorizedSellers').optional().isArray(),
    body('authorizedSellers.*.name').optional().trim(),
    body('authorizedSellers.*.url').optional().isURL().withMessage('Invalid seller URL'),
  ],
  update: [
    param('id').isMongoId().withMessage('Valid manufacturer ID is required'),
    body('name').optional().trim(),
    body('country').optional().trim(),
    body('website').optional().trim().isURL().withMessage('Invalid website URL'),
  ]
};

// Auth validation rules
export const authValidation = {
  login: [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ]
};