const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

// Custom validators
const isValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(value);
};

const isValidCoordinates = (value) => {
  if (!Array.isArray(value) || value.length !== 2) return false;
  const [lng, lat] = value;
  return typeof lng === 'number' && typeof lat === 'number' &&
         lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
};

// Common validation rules
const commonValidations = {
  // User validations
  name: body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z\s\u00C0-\u017F]+$/)
    .withMessage('Name can only contain letters and spaces'),

  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
    .isLength({ max: 255 })
    .withMessage('Email cannot exceed 255 characters'),

  password: body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  phone: body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),

  address: body('address')
    .optional()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Address must be between 5 and 500 characters'),

  role: body('role')
    .isIn(['admin', 'employee', 'customer'])
    .withMessage('Role must be admin, employee, or customer'),

  // Pickup request validations
  pickupName: body('name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),

  pickupPhone: body('phone')
    .trim()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),

  pickupAddress: body('address')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Address must be between 5 and 500 characters'),

  wasteType: body('wasteType')
    .optional()
    .isIn(['general', 'recyclable', 'organic', 'hazardous', 'electronic'])
    .withMessage('Invalid waste type'),

  estimatedWeight: body('estimatedWeight')
    .optional()
    .isFloat({ min: 0, max: 1000 })
    .withMessage('Estimated weight must be between 0 and 1000 kg'),

  actualWeight: body('actualWeight')
    .optional()
    .isFloat({ min: 0, max: 1000 })
    .withMessage('Actual weight must be between 0 and 1000 kg'),

  notes: body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),

  priority: body('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Priority must be low, normal, high, or urgent'),

  status: body('status')
    .optional()
    .isIn(['pending', 'assigned', 'in-progress', 'completed', 'cancelled'])
    .withMessage('Invalid status'),

  coordinates: body('coordinates')
    .optional()
    .custom(isValidCoordinates)
    .withMessage('Coordinates must be an array of [longitude, latitude]'),

  customerRating: body('customerRating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),

  customerFeedback: body('customerFeedback')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Feedback cannot exceed 500 characters'),

  // Parameter validations
  objectId: (paramName = 'id') => param(paramName)
    .custom(isValidObjectId)
    .withMessage(`${paramName} must be a valid ID`),

  // Query validations
  page: query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  limit: query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  sortBy: query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'requestedAt', 'status', 'priority'])
    .withMessage('Invalid sort field'),

  sortOrder: query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),

  statusFilter: query('status')
    .optional()
    .isIn(['pending', 'assigned', 'in-progress', 'completed', 'cancelled'])
    .withMessage('Invalid status filter'),

  dateFrom: query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid ISO date'),

  dateTo: query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid ISO date'),

  search: query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters')
};

// Validation schemas for different endpoints
const validationSchemas = {
  // Auth validations
  register: [
    commonValidations.name,
    commonValidations.email,
    commonValidations.password,
    commonValidations.phone,
    commonValidations.address
  ],

  login: [
    commonValidations.email,
    body('password').notEmpty().withMessage('Password is required')
  ],

  changePassword: [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    commonValidations.password.withMessage('New password must meet security requirements')
  ],

  // Pickup request validations
  createPickup: [
    commonValidations.pickupName,
    commonValidations.pickupPhone,
    commonValidations.pickupAddress,
    commonValidations.wasteType,
    commonValidations.estimatedWeight,
    commonValidations.notes,
    commonValidations.priority,
    commonValidations.coordinates
  ],

  updatePickup: [
    commonValidations.objectId(),
    commonValidations.pickupName,
    commonValidations.pickupPhone,
    commonValidations.pickupAddress,
    commonValidations.wasteType,
    commonValidations.estimatedWeight,
    commonValidations.actualWeight,
    commonValidations.notes,
    commonValidations.priority,
    commonValidations.status,
    commonValidations.coordinates
  ],

  assignPickup: [
    commonValidations.objectId(),
    body('employeeId').custom(isValidObjectId).withMessage('Employee ID must be valid')
  ],

  completePickup: [
    commonValidations.objectId(),
    commonValidations.actualWeight,
    body('finalPrice').optional().isFloat({ min: 0 }).withMessage('Final price must be positive')
  ],

  ratePickup: [
    commonValidations.objectId(),
    commonValidations.customerRating,
    commonValidations.customerFeedback
  ],

  // Admin validations
  createUser: [
    commonValidations.name,
    commonValidations.email,
    commonValidations.password,
    commonValidations.role,
    commonValidations.phone,
    commonValidations.address
  ],

  updateUser: [
    commonValidations.objectId(),
    commonValidations.name.optional(),
    commonValidations.email.optional(),
    commonValidations.phone,
    commonValidations.address
  ],

  updateUserRole: [
    commonValidations.objectId(),
    commonValidations.role
  ],

  // Query validations
  pagination: [
    commonValidations.page,
    commonValidations.limit,
    commonValidations.sortBy,
    commonValidations.sortOrder
  ],

  pickupFilters: [
    commonValidations.statusFilter,
    commonValidations.dateFrom,
    commonValidations.dateTo,
    commonValidations.search,
    query('wasteType').optional().isIn(['general', 'recyclable', 'organic', 'hazardous', 'electronic']),
    query('priority').optional().isIn(['low', 'normal', 'high', 'urgent'])
  ]
};

module.exports = {
  commonValidations,
  validationSchemas,
  isValidObjectId,
  isValidCoordinates
};
