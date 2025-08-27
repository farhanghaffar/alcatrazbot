const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true },
  payload: { type: Object, required: true },
  webhookEndpoint: { type: String, required: true },
  websiteName: { type: String, required: true },
  triggeredMachine: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Machine', // This assumes you have a Machine model
    required: false, // Set this to false since it will only be populated when triggered
  },
  status: { type: String, enum: ['Not Triggered', 'Failed', 'Passed', 'Executed'], default: 'Not Triggered' },
  serviceChargesStatus: { type: String, enum: ['Not Triggered', 'Failed', 'Charged', 'Executed'], default: 'Not Triggered' },
  serviceChargesError: { type: String, default: null },
  failureReason: { type: String, default: null },
  triggerable: { type: Boolean, default: true }
}, {
  timestamps: true
});

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

module.exports = Order;
