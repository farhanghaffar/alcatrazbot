const { getDb } = require('./mongodb'); // Import from our mongodb connection module

/**
 * Determines if an order should be retried based on failure reason
 * @param {string} failureReason - The reason for the failure
 * @param {object} payload - The order payload with booking details
 * @returns {boolean} - Whether the order should be retried
 */
function shouldRetry(failureReason, payload) {
  // Don't retry terminal errors - Make global for debugging
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
 * Records a failed order in the database
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
    if (!orderId || !websiteName) {
      throw new Error('orderId and websiteName are required');
    }

    const db = await getDb();
    if (!db) {
      throw new Error('Database connection not available');
    }

    // Determine if this order should be retried automatically
    const retryable = shouldRetry(failureReason, payload);
    console.log(`DEBUG: Order ${orderId} retryable status: ${retryable}`);
    console.log(`DEBUG: Failure reason: "${failureReason}", matches terminal patterns: ${terminalPatterns.some(pattern => failureReason && failureReason.includes(pattern))}`);
    
    // Create the failed order document
    const failedOrder = {
      orderId,
      payload: payload || {},
      webhookUrl,
      websiteName,
      failureCount: parseInt(failureCount, 10),
      failureReason,
      createdAt: timestamp, // Use consistent naming according to schema
      updatedAt: timestamp,
      status,
      retryable // Add the retryable flag
    };
    
    // Check if this order already exists in failed_orders
    const existingOrder = await db.collection('failed_orders').findOne({ orderId });
    
    let result;
    
    if (existingOrder) {
      // Determine if this existing order should be retried
      const retryable = shouldRetry(failureReason, payload);
      
      // Update the existing record
      result = await db.collection('failed_orders').updateOne(
        { orderId },
        { 
          $set: {
            failureReason,
            status,
            updatedAt: timestamp,
            websiteName,
            retryable // Update retryability based on latest failure
          },
          $inc: { failureCount: 1 }
        }
      );
      
      return {
        success: true,
        message: `Failed order ${orderId} updated with incremented failure count: ${existingOrder.failureCount + 1}`,
        id: existingOrder._id.toString()
      };
    } else {
      // Insert a new record
      console.log('DEBUG: Saving failed order with fields:', JSON.stringify(failedOrder, null, 2));
      result = await db.collection('failed_orders').insertOne(failedOrder);
      
      // Verify the record was saved correctly
      const savedRecord = await db.collection('failed_orders').findOne({ _id: result.insertedId });
      console.log('DEBUG: Record after save:', JSON.stringify(savedRecord, null, 2));
      
      return {
        success: true,
        message: `Failed order ${orderId} recorded for future retry`,
        id: result.insertedId.toString()
      };
    }
  } catch (error) {
    console.error('\u274c Error recording failed order:', error);
    return {
      success: false,
      message: error.message || 'Unknown error occurred',
      id: null
    };
  }
}

async function initializeFailedOrdersSchema() {
  try {
    const db = await getDb();
    const collectionName = 'failed_orders';

    // Check if collection exists, create if it doesn't
    const collections = await db.listCollections().toArray();
    const collectionExists = collections.some(col => col.name === collectionName);

    if (!collectionExists) {
      await db.createCollection(collectionName);
    }

    // Define schema validation
    const schema = {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['orderId', 'payload', 'webhookUrl', 'websiteName', 'failureCount', 'createdAt', 'status'],
          properties: {
            orderId: {
              bsonType: 'string',
              description: 'must be a string and is required'
            },
            payload: {
              bsonType: 'object',
              description: 'must be an object and is required'
            },
            webhookUrl: {
              bsonType: 'string',
              description: 'must be a string and is required'
            },
            websiteName: {
              bsonType: 'string',
              description: 'must be a string and is required'
            },
            failureCount: {
              bsonType: 'int',
              minimum: 1,
              description: 'must be an integer >= 1 and is required'
            },
            failureReason: {
              bsonType: ['string', 'null'],
              description: 'must be a string or null'
            },
            createdAt: {
              bsonType: 'date',
              description: 'must be a date and is required'
            },
            status: {
              enum: ['failed', 'retried', 'resolved'],
              description: 'must be one of "failed", "retried", or "resolved"'
            },
            updatedAt: {
              bsonType: ['date', 'null'],
              description: 'must be a date if present'
            },
            deletedAt: {
              bsonType: ['date', 'null'],
              description: 'must be a date if present'
            },
            retryable: {
              bsonType: 'bool',
              description: 'indicates if this failed order should be automatically retried'
            }
          }
        }
      },
      validationLevel: 'strict',
      validationAction: 'error'
    };

    // Apply schema validation to the collection
    await db.command({
      collMod: collectionName,
      validator: schema.validator,
      validationLevel: schema.validationLevel,
      validationAction: schema.validationAction
    });

    // Create index on orderId for uniqueness and performance
    await db.collection(collectionName).createIndex({ orderId: 1 }, { unique: true });

    console.log(`Schema initialized for ${collectionName} collection`);
  } catch (error) {
    console.error('Error initializing schema:', error);
    throw error;
  }
}

module.exports = { initializeFailedOrdersSchema, recordFailedOrder, shouldRetry };