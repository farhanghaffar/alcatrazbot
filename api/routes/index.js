const express = require('express');
const router = express.Router();

// Import route modules
const userRoutes = require('./userRoutes');
const failedOrderRoutes = require('./failedOrderRoutes');

// Mount routes
router.use('/users', userRoutes);
router.use('/failed-orders', failedOrderRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is running' });
});

module.exports = router;
