const mongoose = require('mongoose');

const PickupRequestSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  phone: { type: String, required: true },
  address: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending','assigned','completed','cancelled'],
    default: 'pending'
  },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  requestedAt: { type: Date, default: Date.now },
  pickedUpAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('PickupRequest', PickupRequestSchema);
