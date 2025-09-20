// Basic orders route for SwiftLogistics order-service
const express = require('express');
const router = express.Router();


const Order = require('../models/Order');

// GET /orders - return all orders
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders', details: err.message });
  }
});

// POST /orders - create a new order
router.post('/', async (req, res) => {
  try {
    const { clientId, productName, quantity, deliveryAddress, priority, description } = req.body;
    console.log('DEBUG: Attempting to save order:', { clientId, productName, quantity, deliveryAddress, priority, description });
    const order = new Order({ clientId, productName, quantity, deliveryAddress, priority, description });
    await order.save();
    console.log('DEBUG: Order saved successfully:', order);
    res.status(201).json({ success: true, order });
  } catch (err) {
    console.error('DEBUG: Error saving order:', err);
    res.status(400).json({ error: 'Failed to create order', details: err.message });
  }
});

module.exports = router;
