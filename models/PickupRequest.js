const mongoose = require('mongoose');
const logger = require('../config/logger');

const PickupRequestSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  name: {
    type: String,
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please provide a valid phone number']
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true,
    minlength: [5, 'Address must be at least 5 characters'],
    maxlength: [500, 'Address cannot exceed 500 characters']
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'assigned', 'in-progress', 'completed', 'cancelled'],
      message: 'Status must be one of: pending, assigned, in-progress, completed, cancelled'
    },
    default: 'pending',
    index: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    validate: {
      validator: async function(value) {
        if (!value) return true; // Optional field

        const User = mongoose.model('User');
        const user = await User.findById(value);
        return user && (user.role === 'employee' || user.role === 'admin');
      },
      message: 'Assigned user must be an employee or admin'
    }
  },

  // Timing fields
  requestedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  assignedAt: Date,
  startedAt: Date,
  pickedUpAt: Date,

  // Additional details
  wasteType: {
    type: String,
    enum: ['general', 'recyclable', 'organic', 'hazardous', 'electronic'],
    default: 'general'
  },
  estimatedWeight: {
    type: Number,
    min: [0, 'Weight cannot be negative'],
    max: [1000, 'Weight cannot exceed 1000 kg']
  },
  actualWeight: {
    type: Number,
    min: [0, 'Weight cannot be negative'],
    max: [1000, 'Weight cannot exceed 1000 kg']
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    trim: true
  },

  // Location details
  location: {
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    },
    address: String,
    landmark: String
  },

  // Pricing
  estimatedPrice: {
    type: Number,
    min: [0, 'Price cannot be negative']
  },
  finalPrice: {
    type: Number,
    min: [0, 'Price cannot be negative']
  },

  // Images
  images: [{
    url: String,
    description: String,
    uploadedAt: { type: Date, default: Date.now }
  }],

  // Feedback
  customerRating: {
    type: Number,
    min: 1,
    max: 5
  },
  customerFeedback: {
    type: String,
    maxlength: [500, 'Feedback cannot exceed 500 characters']
  },

  // Cancellation details
  cancellationReason: String,
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelledAt: Date,

  // Priority
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },

  // Recurring pickup
  isRecurring: { type: Boolean, default: false },
  recurringSchedule: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly']
    },
    dayOfWeek: Number, // 0-6 for weekly
    dayOfMonth: Number, // 1-31 for monthly
    nextPickupDate: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
PickupRequestSchema.index({ status: 1, requestedAt: -1 });
PickupRequestSchema.index({ assignedTo: 1, status: 1 });
PickupRequestSchema.index({ customerId: 1, requestedAt: -1 });
PickupRequestSchema.index({ createdAt: -1 });

// Virtual for duration
PickupRequestSchema.virtual('duration').get(function() {
  if (this.pickedUpAt && this.requestedAt) {
    return Math.round((this.pickedUpAt - this.requestedAt) / (1000 * 60)); // Duration in minutes
  }
  return null;
});

// Virtual for status display
PickupRequestSchema.virtual('statusDisplay').get(function() {
  const statusMap = {
    'pending': 'Pending',
    'assigned': 'Assigned',
    'in-progress': 'In Progress',
    'completed': 'Completed',
    'cancelled': 'Cancelled'
  };
  return statusMap[this.status] || this.status;
});

// Pre-save middleware
PickupRequestSchema.pre('save', function(next) {
  // Set timestamps based on status changes
  if (this.isModified('status')) {
    const now = new Date();

    switch (this.status) {
      case 'assigned':
        if (!this.assignedAt) this.assignedAt = now;
        break;
      case 'in-progress':
        if (!this.startedAt) this.startedAt = now;
        break;
      case 'completed':
        if (!this.pickedUpAt) this.pickedUpAt = now;
        break;
      case 'cancelled':
        if (!this.cancelledAt) this.cancelledAt = now;
        break;
    }
  }

  // Validate assignment
  if (this.status === 'assigned' && !this.assignedTo) {
    return next(new Error('AssignedTo is required when status is assigned'));
  }

  next();
});

// Instance methods
PickupRequestSchema.methods.canBeModifiedBy = function(user) {
  if (user.role === 'admin') return true;
  if (user.role === 'employee' && this.assignedTo && this.assignedTo.equals(user._id)) return true;
  if (user.role === 'customer' && this.customerId && this.customerId.equals(user._id) && this.status === 'pending') return true;
  return false;
};

PickupRequestSchema.methods.assignTo = async function(employeeId, assignedBy) {
  this.assignedTo = employeeId;
  this.status = 'assigned';
  this.assignedAt = new Date();

  logger.info('Pickup request assigned', {
    pickupId: this._id,
    assignedTo: employeeId,
    assignedBy: assignedBy,
    customerId: this.customerId
  });

  return this.save();
};

PickupRequestSchema.methods.markCompleted = async function(completedBy, actualWeight, finalPrice) {
  this.status = 'completed';
  this.pickedUpAt = new Date();

  if (actualWeight !== undefined) this.actualWeight = actualWeight;
  if (finalPrice !== undefined) this.finalPrice = finalPrice;

  logger.info('Pickup request completed', {
    pickupId: this._id,
    completedBy: completedBy,
    customerId: this.customerId,
    actualWeight: this.actualWeight,
    finalPrice: this.finalPrice
  });

  return this.save();
};

PickupRequestSchema.methods.cancel = async function(reason, cancelledBy) {
  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.cancelledBy = cancelledBy;
  this.cancelledAt = new Date();

  logger.info('Pickup request cancelled', {
    pickupId: this._id,
    reason: reason,
    cancelledBy: cancelledBy,
    customerId: this.customerId
  });

  return this.save();
};

// Static methods
PickupRequestSchema.statics.getStatistics = async function(filters = {}) {
  const pipeline = [
    { $match: filters },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalWeight: { $sum: '$actualWeight' },
        totalRevenue: { $sum: '$finalPrice' }
      }
    }
  ];

  return this.aggregate(pipeline);
};

PickupRequestSchema.statics.findNearby = function(longitude, latitude, maxDistance = 5000) {
  return this.find({
    'location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance
      }
    }
  });
};

module.exports = mongoose.model('PickupRequest', PickupRequestSchema);
