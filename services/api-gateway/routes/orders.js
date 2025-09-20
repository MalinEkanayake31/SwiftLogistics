const express = require("express");
const router = express.Router();



const axios = require('axios');
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:3002';

// GET /api/orders - fetch real orders from order-service
router.get('/', async (req, res) => {
  try {
    const response = await axios.get(`${ORDER_SERVICE_URL}/orders`);
    res.json(response.data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch orders from order-service', details: err.message });
  }
});

// POST /api/orders - forward order creation to order-service
router.post('/', async (req, res) => {
  try {
    // Attach clientId from JWT if available
    const clientId = req.user && req.user.clientId ? req.user.clientId : undefined;
    const orderData = { ...req.body, clientId };
    const response = await axios.post(`${ORDER_SERVICE_URL}/orders`, orderData);
    res.status(response.status).json(response.data);
  } catch (err) {
    const status = err.response ? err.response.status : 502;
    const data = err.response ? err.response.data : { error: 'Failed to create order in order-service' };
    res.status(status).json(data);
  }
});

module.exports = router;
