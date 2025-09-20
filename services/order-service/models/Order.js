const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  clientId: { type: String, required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true },
  deliveryAddress: { type: String, required: true },
  priority: { type: String, default: 'Normal' },
  description: { type: String },
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
