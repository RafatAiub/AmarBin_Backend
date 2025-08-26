const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const logger = require('../config/logger');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [1, 'Name must be at least 1 character'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  passwordHash: {
    type: String,
    required: [true, 'Password is required']
  },
  role: {
    type: String,
    enum: {
      values: ['customer', 'admin', 'employee'],
      message: 'Role must be either customer, admin, or employee'
    },
    default: 'customer'
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please provide a valid phone number']
  },
  address: {
    type: String,
    trim: true,
    maxlength: [500, 'Address cannot exceed 500 characters']
  },

  // Security fields
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,

  // Account lockout fields
  loginAttempts: {
    type: Number,
    default: 0
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  lockUntil: Date,

  // Password reset fields
  passwordResetToken: String,
  passwordResetExpires: Date,
  passwordChangedAt: Date,

  // Refresh token fields
  refreshTokens: [{
    token: String,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date,
    userAgent: String,
    ipAddress: String
  }],

  // Login tracking
  lastLogin: Date,
  lastLoginIP: String,
  loginHistory: [{
    timestamp: { type: Date, default: Date.now },
    ipAddress: String,
    userAgent: String,
    success: Boolean
  }],

  // Profile fields
  avatar: String,
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true }
    },
    language: { type: String, default: 'en' },
    timezone: { type: String, default: 'UTC' }
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.passwordHash;
      delete ret.passwordResetToken;
      delete ret.emailVerificationToken;
      delete ret.refreshTokens;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ lastLogin: -1 });

// Virtual for account lock status
UserSchema.virtual('isAccountLocked').get(function() {
  return !!(this.isLocked && this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
UserSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('passwordHash')) return next();

  try {
    // Hash password with cost of 12
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    this.passwordHash = await bcrypt.hash(this.passwordHash, saltRounds);

    // Set password changed timestamp
    if (!this.isNew) {
      this.passwordChangedAt = new Date();
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.passwordHash);
  } catch (error) {
    logger.error('Password comparison error:', error);
    return false;
  }
};

// Instance method to handle failed login attempts
UserSchema.methods.handleFailedLogin = async function() {
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
  const lockTime = parseInt(process.env.LOCKOUT_TIME) || 15; // minutes

  // Increment login attempts
  this.loginAttempts += 1;

  // Lock account if max attempts reached
  if (this.loginAttempts >= maxAttempts) {
    this.isLocked = true;
    this.lockUntil = new Date(Date.now() + lockTime * 60 * 1000);

    logger.warn('Account locked due to failed login attempts', {
      userId: this._id,
      email: this.email,
      attempts: this.loginAttempts,
      lockUntil: this.lockUntil
    });
  }

  await this.save();
};

// Instance method to handle successful login
UserSchema.methods.handleSuccessfulLogin = async function(ipAddress, userAgent) {
  // Reset login attempts and unlock account
  this.loginAttempts = 0;
  this.isLocked = false;
  this.lockUntil = undefined;
  this.lastLogin = new Date();
  this.lastLoginIP = ipAddress;

  // Add to login history (keep last 10 entries)
  this.loginHistory.unshift({
    timestamp: new Date(),
    ipAddress,
    userAgent,
    success: true
  });

  if (this.loginHistory.length > 10) {
    this.loginHistory = this.loginHistory.slice(0, 10);
  }

  await this.save();

  logger.info('Successful login', {
    userId: this._id,
    email: this.email,
    ipAddress,
    userAgent
  });
};

// Static method to find user by email with security checks
UserSchema.statics.findByEmailForAuth = async function(email) {
  return this.findOne({
    email: email.toLowerCase(),
    isActive: true
  });
};

// Static method to cleanup expired tokens
UserSchema.statics.cleanupExpiredTokens = async function() {
  const now = new Date();

  await this.updateMany(
    {},
    {
      $pull: {
        refreshTokens: { expiresAt: { $lt: now } }
      }
    }
  );

  logger.info('Cleaned up expired refresh tokens');
};

module.exports = mongoose.model('User', UserSchema);
