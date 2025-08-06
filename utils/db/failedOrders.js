/**
 * Utilities for handling failed orders in the database
 */

const { getDb, connectToMongoDB, isConnected, ObjectId } = require('../../db/mongodb');

/**
 * Determines if an order should be retried based on failure reason
 * @param {string} failureReason - The reason for the failure
 * @param {object} payload - The order payload with booking details
 * @returns {boolean} - Whether the order should be retried
 */
function shouldRetry(failureReason, payload) {
  // Don't retry terminal errors
  const terminalPatterns = [
    'Payment not completed',
    'No available tours',
    'Invalid credit card',
    'Booking time slot unavailable',
    'Tour not available'
  ];
  
  if (terminalPatterns.some(pattern => 
    failureReason && failureReason.includes(pattern))) {
    console.log(`Terminal error detected: ${failureReason}`);
    return false;
  }
  
  // Don't retry if booking time has already passed
  if (payload && payload.bookingDate) {
    try {
      // Try to parse the date - handles multiple formats
      let bookingDate;
      
      if (payload.bookingDate.includes('/')) {
        // Format: MM/DD/YYYY
        const [month, day, year] = payload.bookingDate.split('/');
        bookingDate = new Date(`${year}-${month}-${day}`);
      } else {
        // Format: YYYY-MM-DD
        bookingDate = new Date(payload.bookingDate);
      }
      
      if (bookingDate < new Date()) {
        console.log(`Booking date ${payload.bookingDate} has already passed`);
        return false;
      }
    } catch (error) {
      console.error('Error parsing booking date:', error);
      // If we can't parse the date, assume it's retryable
    }
  }
  
  return true;
}

/**
 * Record a failed order in the database for future retry
 * @param {object} params - Parameters for the failed order
 * @param {string} params.orderId - Unique identifier for the order
 * @param {object} params.payload - The complete webhook payload
 * @param {string} params.webhookUrl - The webhook URL that failed
 * @param {string} params.websiteName - Name of the website associated with the order
 * @param {number} params.failureCount - Number of times this order has failed (default: 1)
 * @param {string} params.failureReason - Reason for the failure
 * @param {Date} params.timestamp - When the failure occurred (default: now)
 * @param {string} params.status - Current status (default: 'failed')
 * @returns {Promise<{success: boolean, message: string, id: string|null}>} - Result of the operation
 */
async function recordFailedOrder({
  orderId,
  payload,
  webhookUrl,
  websiteName,
  failureCount = 1,
  failureReason = 'Unknown error',
  timestamp = new Date(),
  status = 'failed'
}) {
  try {
    console.log('📝 recordFailedOrder called with:', { orderId, websiteName, failureCount, status });
    
    if (!orderId || !websiteName) {
      console.error('❌ Missing required fields for failed order:', { orderId, websiteName });
      throw new Error('orderId and websiteName are required');
    }
    
    // Get the database connection using modular DB methods
    let db = getDb();
    if (!db) {
      console.log('⚠️ No database connection available, attempting to connect...');
      try {
        await connectToMongoDB();
        db = getDb();
      } catch (connErr) {
        console.error('❌ Failed to connect to database:', connErr);
        return {
          success: false,
          message: 'Database connection not available. Order processing will continue without recording failure.',
          id: null,
          databaseStatus: 'disconnected'
        };
      }
    }
    console.log('🔍 Database connection check:', db ? 'Available' : 'Not available');
    
    if (!db) {
      console.warn('⚠️ Database connection not available. Failed order not recorded but processing continues.');
      return {
        success: false,
        message: 'Database connection not available. Order processing will continue without recording failure.',
        id: null,
        databaseStatus: 'disconnected'
      };
    }

    // Log collections to verify db access
    try {
      const collections = await db.listCollections().toArray();
      console.log('📚 Available collections:', collections.map(c => c.name));
    } catch (listErr) {
      console.error('❌ Error listing collections:', listErr);
    }

    // Determine if this order should be retried automatically
    const retryable = shouldRetry(failureReason, payload);
    console.log(`📊 Order ${orderId} retryable status: ${retryable}`);
    
    // Create the failed order document
    const failedOrder = {
      orderId,
      payload: payload || {},
      webhookUrl,
      websiteName,
      failureCount: parseInt(failureCount, 10),
      failureReason,
      createdAt: timestamp, // Use the timestamp parameter as createdAt
      updatedAt: timestamp,
      status,
      retryable // Add the retryable flag
    };
    
    console.log(`🔍 Checking if order ${orderId} for ${websiteName} already exists in failed_orders...`);
    
    // Check if this order already exists in failed_orders for THIS SPECIFIC WEBSITE
    // This prevents orders with the same ID but from different websites being treated as the same
    const existingOrder = await db.collection('failed_orders').findOne({ orderId, websiteName });
    console.log('🔍 Existing order found?', existingOrder ? 'Yes' : 'No');
    
    let result;
    
    if (existingOrder) {
      // Update the existing record
      console.log(`🔄 Updating existing failed order ${orderId} for ${websiteName}`);
      result = await db.collection('failed_orders').updateOne(
        { orderId, websiteName }, // Use compound identifier for update
        { 
          $set: {
            failureReason,
            status,
            createdAt: timestamp,
            updatedAt: new Date(), // Add updatedAt field for tracking updates
            retryable: shouldRetry(failureReason, payload) // Update retryability based on latest failure
          },
          $inc: { failureCount: 1 }
        }
      );
      console.log('🔄 Update result:', result);
      
      return {
        success: true,
        message: `Failed order ${orderId} updated with incremented failure count: ${existingOrder.failureCount + 1}`,
        id: existingOrder._id.toString()
      };
    } else {
      // Insert a new record
      console.log(`➕ Inserting new failed order ${orderId}`);
      result = await db.collection('failed_orders').insertOne(failedOrder);
      console.log('➕ Insert result:', result);
      
      return {
        success: true,
        message: `Failed order ${orderId} recorded for future retry`,
        id: result.insertedId.toString()
      };
    }
  } catch (error) {
    console.error('❌ Error recording failed order:', error);
    return {
      success: false,
      message: error.message || 'Unknown error occurred',
      id: null
    };
  }
}

/**
 * Get a failed order by ID
 * @param {string} id - The MongoDB ObjectID of the failed order
 * @returns {Promise<Object|null>} - The failed order document or null if not found
 */
async function getFailedOrderById(id) {
  try {
    const db = getDb();
    if (!db) {
      throw new Error('Database connection not available');
    }

    return await db.collection('failed_orders').findOne({ _id: new ObjectId(id) });
  } catch (error) {
    console.error('❌ Error fetching failed order:', error);
    return null;
  }
}

/**
 * Update a failed order's status
 * @param {string} id - The MongoDB ObjectID of the failed order
 * @param {object} updates - Fields to update
 * @returns {Promise<{success: boolean, message: string}>} - Result of the operation
 */
async function updateFailedOrder(id, updates) {
  try {
    const db = getDb();
    if (!db) {
      throw new Error('Database connection not available');
    }

    updates.updatedAt = new Date(); // Always update the timestamp
    
    const result = await db.collection('failed_orders').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );
    
    return {
      success: result.modifiedCount > 0,
      message: result.modifiedCount > 0 
        ? `Failed order ${id} updated successfully` 
        : `No changes made to order ${id}`
    };
  } catch (error) {
    console.error('❌ Error updating failed order:', error);
    return {
      success: false,
      message: error.message || 'Unknown error occurred'
    };
  }
}

/**
 * Get pending failed orders to retry
 * @param {object} filters - Additional filters to apply
 * @param {number} limit - Maximum number of orders to retrieve
 * @returns {Promise<Array>} - Array of failed order documents
 */
async function getPendingFailedOrders(filters = {}, limit = 10) {
  try {
    const db = getDb();
    if (!db) {
      throw new Error('Database connection not available');
    }
    
    // Combine with status filter - only get failed orders, not ones currently being retried
    const query = { 
      status: 'failed',
      ...filters
    };
    
    return await db.collection('failed_orders')
      .find(query)
      .sort({ createdAt: 1 }) // Process oldest first
      .limit(limit)
      .toArray();
  } catch (error) {
    console.error('❌ Error fetching pending failed orders:', error);
    return [];
  }
}

module.exports = {
  recordFailedOrder,
  getFailedOrderById,
  updateFailedOrder,
  getPendingFailedOrders
};
