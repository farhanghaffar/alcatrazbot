const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true },
  payload: { type: Object, required: true },
  webhookEndpoint: { type: String, required: true },
  websiteName: { type: String, required: true },
  status: { type: String, enum: ['Not Triggered', 'Failed', 'Passed', 'Executed'], default: 'Not Triggered' },
  failureReason: { type: String, default: null },
  triggerable: { type: Boolean, default: true }
}, {
  timestamps: true
});

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

module.exports = Order;
