const crypto = require('crypto');
const logger = require('../config/logger');

// Response helper functions
const sendResponse = (res, statusCode, status, message, data = null, meta = null) => {
  const response = {
    status,
    message,
    timestamp: new Date().toISOString()
  };

  if (data !== null) {
    response.data = data;
  }

  if (meta !== null) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

const sendSuccess = (res, message, data = null, meta = null) => {
  return sendResponse(res, 200, 'success', message, data, meta);
};

const sendCreated = (res, message, data = null) => {
  return sendResponse(res, 201, 'success', message, data);
};

const sendError = (res, statusCode, message, errors = null) => {
  const response = {
    status: 'error',
    message,
    timestamp: new Date().toISOString()
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

// Pagination helper
const getPaginationMeta = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? page + 1 : null,
      prevPage: hasPrevPage ? page - 1 : null
    }
  };
};

// Query builder helper
const buildQuery = (filters = {}) => {
  const query = {};

  // Status filter
  if (filters.status) {
    query.status = filters.status;
  }

  // Date range filter
  if (filters.dateFrom || filters.dateTo) {
    query.createdAt = {};
    if (filters.dateFrom) {
      query.createdAt.$gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      query.createdAt.$lte = new Date(filters.dateTo);
    }
  }

  // Search filter (for text fields)
  if (filters.search) {
    const searchRegex = new RegExp(filters.search, 'i');
    query.$or = [
      { name: searchRegex },
      { address: searchRegex },
      { phone: searchRegex },
      { notes: searchRegex }
    ];
  }

  // Waste type filter
  if (filters.wasteType) {
    query.wasteType = filters.wasteType;
  }

  // Priority filter
  if (filters.priority) {
    query.priority = filters.priority;
  }

  // Customer filter
  if (filters.customerId) {
    query.customerId = filters.customerId;
  }

  // Assigned employee filter
  if (filters.assignedTo) {
    query.assignedTo = filters.assignedTo;
  }

  return query;
};

// Sort options helper
const buildSortOptions = (sortBy = 'createdAt', sortOrder = 'desc') => {
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
  return sortOptions;
};

// Generate random token
const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Generate OTP
const generateOTP = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};

// Sanitize user data for response
const sanitizeUser = (user) => {
  const sanitized = user.toObject ? user.toObject() : user;
  delete sanitized.passwordHash;
  delete sanitized.passwordResetToken;
  delete sanitized.emailVerificationToken;
  delete sanitized.refreshTokens;
  delete sanitized.__v;
  return sanitized;
};

// Sanitize pickup data for response
const sanitizePickup = (pickup) => {
  const sanitized = pickup.toObject ? pickup.toObject() : pickup;
  return sanitized;
};

// Calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return distance;
};

// Format date for display
const formatDate = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  if (!date) return null;
  
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  switch (format) {
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'YYYY-MM-DD HH:mm':
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    case 'YYYY-MM-DD HH:mm:ss':
    default:
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
};

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone format
const isValidPhone = (phone) => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone);
};

// Generate slug from text
const generateSlug = (text) => {
  return text
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-');
};

// Deep clone object
const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

// Remove undefined/null values from object
const removeEmpty = (obj) => {
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null && value !== '') {
      cleaned[key] = value;
    }
  }
  return cleaned;
};

// Retry function with exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms`, { error: error.message });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Rate limiting key generator
const generateRateLimitKey = (req, suffix = '') => {
  const ip = req.ip || req.connection.remoteAddress;
  const userId = req.user?.id || 'anonymous';
  return `rate_limit:${ip}:${userId}${suffix ? ':' + suffix : ''}`;
};

// Cache key generator
const generateCacheKey = (prefix, ...parts) => {
  return `${prefix}:${parts.join(':')}`;
};

module.exports = {
  sendResponse,
  sendSuccess,
  sendCreated,
  sendError,
  getPaginationMeta,
  buildQuery,
  buildSortOptions,
  generateToken,
  generateOTP,
  sanitizeUser,
  sanitizePickup,
  calculateDistance,
  formatDate,
  isValidEmail,
  isValidPhone,
  generateSlug,
  deepClone,
  removeEmpty,
  retryWithBackoff,
  generateRateLimitKey,
  generateCacheKey
};
