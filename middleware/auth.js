const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');
const redisConnection = require('../config/redis');
require('dotenv').config();

class AuthMiddleware {
  // Enhanced authentication middleware
  static async authenticate(req, res, next) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Please provide a valid authentication token'
        });
      }

      const token = authHeader.replace('Bearer ', '');

      // Check if token is blacklisted
      const isBlacklisted = await AuthMiddleware.isTokenBlacklisted(token);
      if (isBlacklisted) {
        return res.status(401).json({
          error: 'Token invalid',
          message: 'This token has been revoked'
        });
      }

      // Verify JWT token
      const payload = jwt.verify(token, process.env.JWT_SECRET);

      // Check if user still exists and is active
      const user = await User.findById(payload.id).select('-passwordHash');
      if (!user) {
        return res.status(401).json({
          error: 'User not found',
          message: 'The user associated with this token no longer exists'
        });
      }

      if (user.isLocked && user.lockUntil > Date.now()) {
        return res.status(423).json({
          error: 'Account locked',
          message: 'Your account is temporarily locked due to too many failed login attempts',
          lockUntil: user.lockUntil
        });
      }

      // Check if token was issued before user's last password change
      if (user.passwordChangedAt && payload.iat < user.passwordChangedAt.getTime() / 1000) {
        return res.status(401).json({
          error: 'Token expired',
          message: 'Please log in again as your password was recently changed'
        });
      }

      // Add user to request object
      req.user = user;
      req.token = token;

      // Log successful authentication
      logger.info('User authenticated successfully', {
        userId: user._id,
        email: user.email,
        role: user.role,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      next();
    } catch (error) {
      logger.warn('Authentication failed', {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        token: req.headers.authorization ? 'provided' : 'missing'
      });

      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: 'Invalid token',
          message: 'The provided token is malformed or invalid'
        });
      }

      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expired',
          message: 'Your session has expired. Please log in again'
        });
      }

      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Unable to authenticate request'
      });
    }
  }

  // Optional authentication (for endpoints that work with or without auth)
  static async optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(); // Continue without authentication
      }

      const token = authHeader.replace('Bearer ', '');
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.id).select('-passwordHash');

      if (user && (!user.isLocked || user.lockUntil <= Date.now())) {
        req.user = user;
        req.token = token;
      }

      next();
    } catch (error) {
      // Ignore authentication errors for optional auth
      next();
    }
  }

  // Check if token is blacklisted
  static async isTokenBlacklisted(token) {
    try {
      if (!redisConnection.isReady()) {
        return false; // If Redis is not available, assume token is valid
      }

      return await redisConnection.exists(`blacklist:${token}`);
    } catch (error) {
      logger.error('Error checking token blacklist:', error);
      return false;
    }
  }

  // Blacklist a token
  static async blacklistToken(token, expiresIn = 86400) {
    try {
      if (!redisConnection.isReady()) {
        logger.warn('Redis not available, cannot blacklist token');
        return false;
      }

      await redisConnection.set(`blacklist:${token}`, true, expiresIn);
      return true;
    } catch (error) {
      logger.error('Error blacklisting token:', error);
      return false;
    }
  }

  // Generate JWT tokens
  static generateTokens(userId) {
    const accessToken = jwt.sign(
      { id: userId, type: 'access' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '15m' }
    );

    const refreshToken = jwt.sign(
      { id: userId, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
    );

    return { accessToken, refreshToken };
  }

  // Verify refresh token
  static async verifyRefreshToken(token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      const user = await User.findById(payload.id).select('-passwordHash');
      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }
}

// Export both the class and individual methods for backward compatibility
module.exports = AuthMiddleware.authenticate;
module.exports.AuthMiddleware = AuthMiddleware;
module.exports.optionalAuth = AuthMiddleware.optionalAuth;
