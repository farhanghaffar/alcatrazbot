const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { 
  getDb, 
  isConnected, 
  getPaginatedRecords 
} = require('../../db/mongodb');
const { 
  getFailedOrderById, 
  updateFailedOrder 
} = require('../../utils/db/failedOrders');
const { processManualRetry } = require('../../utils/retry/orderProcessor');
const { verifyToken, isAdmin } = require('../middleware/auth');

/**
 * Get paginated failed orders
 * @route GET /api/failed-orders
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    // Check database connection first
    if (!isConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection unavailable',
        databaseStatus: 'disconnected'
      });
    }

    // Extract query parameters with defaults
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const websiteName = req.query.websiteName;
    const status = req.query.status;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const includePayload = req.query.includePayload === 'true';
    
    // Build query filter
    const query = {};
    if (websiteName) query.websiteName = websiteName;
    if (status) query.status = status;
    
    // Build sort options
    const sort = {};
    sort[sortBy] = sortOrder;
    
    // Set projection based on whether payload should be included
    const projection = includePayload ? {} : { payload: 0 };
    
    // Get paginated records
    const result = await getPaginatedRecords('failed_orders', query, {
      page,
      limit,
      sort,
      projection
    });
    
    res.json(result);
  } catch (error) {
    console.error('\u274c Error fetching failed orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

/**
 * Get a specific failed order by ID
 * @route GET /api/failed-orders/:id
 */
router.get('/:id', verifyToken, async (req, res) => {
  try {
    // Check database connection first
    if (!isConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection unavailable',
        databaseStatus: 'disconnected'
      });
    }
    
    const { id } = req.params;
    const includePayload = req.query.includePayload === 'true';
    
    // Set projection based on whether payload should be included
    const projection = includePayload ? {} : { payload: 0 };
    
    // Check if ID is valid ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }
    
    // Get order by ID
    const order = await getDb().collection('failed_orders').findOne(
      { _id: new ObjectId(id) },
      { projection }
    );
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Failed order not found'
      });
    }
    
    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('\u274c Error fetching failed order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error.message
    });
  }
});

/**
 * Retry a failed order
 * @route POST /api/failed-orders/retry/:id
 */
router.post('/retry/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    // Check database connection
    if (!isConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection unavailable',
        databaseStatus: 'disconnected'
      });
    }
    
    const { id } = req.params;
    
    // Check if ID is valid ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }
    
    // Find the order
    const failedOrder = await getDb().collection('failed_orders').findOne(
      { _id: new ObjectId(id) }
    );
    
    if (!failedOrder) {
      return res.status(404).json({
        success: false,
        message: 'Failed order not found'
      });
    }
    
    // Check if this is an Alcatraz booking - we're only implementing retries for Alcatraz now
    if (failedOrder.websiteName !== 'Alcatraz Island Tours') {
      return res.status(400).json({
        success: false,
        message: 'Retry is currently only implemented for Alcatraz bookings'
      });
    }
    
    // Update status to retrying
    await getDb().collection('failed_orders').updateOne(
      { _id: failedOrder._id },
      { 
        $set: { 
          status: 'retrying', 
          updatedAt: new Date(),
          notes: (failedOrder.notes || '') + `\nManual retry initiated at ${new Date().toISOString()}`
        }
      }
    );
    
    // Start retry in background using the utility module
    processManualRetry(failedOrder).catch(error => {
      console.error('❌ Error in manual retry:', error);
    });
    
    // Immediate response
    res.status(200).json({
      success: true,
      message: 'Retry initiated',
      orderId: failedOrder.orderId
    });
  } catch (error) {
    console.error('❌ Error initiating retry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate retry',
      error: error.message
    });
  }
});

/**
 * Update a failed order
 * @route PATCH /api/failed-orders/:id
 */
router.patch('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    // Check database connection first
    if (!isConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection unavailable',
        databaseStatus: 'disconnected'
      });
    }
    
    const { id } = req.params;
    const updates = req.body;
    
    // Check if ID is valid ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }
    
    // Validate allowed fields to update
    const allowedUpdates = ['notes', 'status'];
    const updateKeys = Object.keys(updates);
    
    const isValidOperation = updateKeys.every(key => allowedUpdates.includes(key));
    
    if (!isValidOperation) {
      return res.status(400).json({
        success: false,
        message: `Only ${allowedUpdates.join(', ')} can be updated`
      });
    }
    
    // Prepare update document
    const updateData = {
      ...updates,
      updatedAt: new Date()
    };
    
    // Update the order
    const result = await getDb().collection('failed_orders').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Failed order not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Order updated successfully'
    });
  } catch (error) {
    console.error('\u274c Error updating order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order',
      error: error.message
    });
  }
});

module.exports = router;
