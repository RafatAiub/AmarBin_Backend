const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { AuthMiddleware } = require('../middleware/auth');
const permit = require('../middleware/role');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authRateLimit, sanitizeInput, validationRules, handleValidationErrors } = require('../middleware/security');
const logger = require('../config/logger');
require('dotenv').config();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User authentication and JWT management
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *       400:
 *         description: Validation error or email already exists
 */
router.post('/register',
  authRateLimit,
  sanitizeInput,
  [
    validationRules.name,
    validationRules.email,
    validationRules.password,
    validationRules.phone.optional(),
    validationRules.address.optional()
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { name, email, password, phone, address } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new AppError('An account with this email already exists', 400);
    }

    // Create new user
    const userData = {
      name: name.trim(),
      email: email.toLowerCase(),
      passwordHash: password, // Will be hashed by pre-save middleware
      role: 'customer',
      phone: phone?.trim(),
      address: address?.trim()
    };

    const user = await User.create(userData);

    // Generate tokens
    const tokens = AuthMiddleware.generateTokens(user._id);

    // Store refresh token
    user.refreshTokens.push({
      token: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip
    });
    await user.save();

    // Log registration
    logger.info('New user registered', {
      userId: user._id,
      email: user.email,
      role: user.role,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      status: 'success',
      message: 'Account created successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          address: user.address,
          isEmailVerified: user.isEmailVerified
        },
        tokens
      }
    });
  })
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Authenticate user and get access tokens
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               rememberMe:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *       400:
 *         description: Invalid credentials
 *       423:
 *         description: Account locked due to too many failed attempts
 */
router.post('/login',
  authRateLimit,
  sanitizeInput,
  [
    validationRules.email,
    validationRules.password.optional() // Don't validate password strength on login
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { email, password, rememberMe = false } = req.body;

    // Find user by email
    const user = await User.findByEmailForAuth(email);
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    // Check if account is locked
    if (user.isAccountLocked) {
      throw new AppError('Account is temporarily locked due to too many failed login attempts', 423);
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Handle failed login attempt
      await user.handleFailedLogin();

      // Add to login history
      user.loginHistory.unshift({
        timestamp: new Date(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: false
      });
      await user.save();

      throw new AppError('Invalid email or password', 401);
    }

    // Handle successful login
    await user.handleSuccessfulLogin(req.ip, req.get('User-Agent'));

    // Generate tokens
    const tokens = AuthMiddleware.generateTokens(user._id);

    // Store refresh token
    const refreshTokenExpiry = rememberMe ? 30 : 7; // 30 days if remember me, otherwise 7 days
    user.refreshTokens.push({
      token: tokens.refreshToken,
      expiresAt: new Date(Date.now() + refreshTokenExpiry * 24 * 60 * 60 * 1000),
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip
    });

    // Clean up old refresh tokens (keep only last 5)
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }

    await user.save();

    res.json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          address: user.address,
          isEmailVerified: user.isEmailVerified,
          lastLogin: user.lastLogin
        },
        tokens
      }
    });
  })
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh',
  sanitizeInput,
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400);
    }

    // Verify refresh token
    const user = await AuthMiddleware.verifyRefreshToken(refreshToken);

    // Check if refresh token exists in user's stored tokens
    const storedToken = user.refreshTokens.find(t => t.token === refreshToken);
    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    // Generate new tokens
    const tokens = AuthMiddleware.generateTokens(user._id);

    // Update stored refresh token
    storedToken.token = tokens.refreshToken;
    storedToken.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await user.save();

    res.json({
      status: 'success',
      message: 'Token refreshed successfully',
      data: { tokens }
    });
  })
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user and invalidate tokens
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *               logoutAll:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout',
  AuthMiddleware.authenticate,
  sanitizeInput,
  asyncHandler(async (req, res) => {
    const { refreshToken, logoutAll = false } = req.body;

    // Blacklist current access token
    await AuthMiddleware.blacklistToken(req.token);

    // Remove refresh token(s)
    if (logoutAll) {
      // Remove all refresh tokens (logout from all devices)
      req.user.refreshTokens = [];
    } else if (refreshToken) {
      // Remove specific refresh token
      req.user.refreshTokens = req.user.refreshTokens.filter(t => t.token !== refreshToken);
    }

    await req.user.save();

    logger.info('User logged out', {
      userId: req.user._id,
      email: req.user.email,
      logoutAll,
      ip: req.ip
    });

    res.json({
      status: 'success',
      message: logoutAll ? 'Logged out from all devices' : 'Logout successful'
    });
  })
);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 */
router.get('/me',
  AuthMiddleware.authenticate,
  asyncHandler(async (req, res) => {
    res.json({
      status: 'success',
      data: {
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          phone: req.user.phone,
          address: req.user.address,
          isEmailVerified: req.user.isEmailVerified,
          lastLogin: req.user.lastLogin,
          createdAt: req.user.createdAt,
          preferences: req.user.preferences
        }
      }
    });
  })
);

/**
 * @swagger
 * /auth/change-password:
 *   patch:
 *     summary: Change user password
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 */
router.patch('/change-password',
  AuthMiddleware.authenticate,
  sanitizeInput,
  [
    validationRules.password.withMessage('Current password is required').custom((value, { req }) => {
      req.body.currentPassword = value;
      return true;
    }),
    validationRules.password.withMessage('New password must meet security requirements').custom((value, { req }) => {
      req.body.newPassword = value;
      return true;
    })
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const isCurrentPasswordValid = await req.user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw new AppError('Current password is incorrect', 400);
    }

    // Update password
    req.user.passwordHash = newPassword; // Will be hashed by pre-save middleware
    req.user.passwordChangedAt = new Date();

    // Invalidate all refresh tokens (force re-login on all devices)
    req.user.refreshTokens = [];

    await req.user.save();

    // Blacklist current access token
    await AuthMiddleware.blacklistToken(req.token);

    logger.info('Password changed', {
      userId: req.user._id,
      email: req.user.email,
      ip: req.ip
    });

    res.json({
      status: 'success',
      message: 'Password changed successfully. Please log in again.'
    });
  })
);

module.exports = router;
