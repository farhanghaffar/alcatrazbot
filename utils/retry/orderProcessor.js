/**
 * Order retry mechanism utilities
 */

const { recordFailedOrder } = require('../db/failedOrders');

/**
 * Generic function to process any booking order with multiple retry attempts
 * 
 * HOW TO USE THIS FUNCTION:
 * 1. Import or reference your booking function (e.g., alcatrazBookTour, fortSumterBookTour)
 * 2. Call this function from your webhook handler with appropriate configuration
 * 3. Handle success case in your webhook (failure case is handled internally)
 * 
 * EXAMPLE USAGE:
 * ```
 * // In your webhook handler:
 * const result = await processOrderWithRetries({
 *   orderData,                  // The order data object from webhook
 *   bookingFunction: alcatrazBookTour,  // Your booking automation function
 *   webhookUrl: '/your-webhook-path',   
 *   websiteName: 'Your Attraction Name', 
 *   terminalErrorPatterns: [    // Errors that shouldn't trigger retries
 *     'Payment not completed',
 *     'The card has expired.'
 *   ]
 * });
 * 
 * if (result.success) {
 *   console.log('Booking successful!');
 * }
 * // Failed orders are automatically saved to the database for manual retry
 * ```
 * 
 * @param {Object} config - Configuration object
 * @param {Object} config.orderData - Order data from webhook
 * @param {Object} [config.originalWebhookPayload] - Original webhook payload for saving to DB
 * @param {Function} config.bookingFunction - The booking function to use (e.g. alcatrazBookTour)
 * @param {string} config.webhookUrl - The webhook URL that triggered this process
 * @param {string} config.websiteName - The name of the website/service (e.g. 'Alcatraz Island Tours')
 * @param {Array<string>} [config.terminalErrorPatterns=[]] - Error patterns that should not be retried
 * @param {number} [config.maxRetries=3] - Maximum number of retry attempts
 * @param {number} [config.baseDelayMs=3000] - Base delay between retries in milliseconds
 * @param {boolean} [config.skipDatabaseSave=false] - Whether to skip saving failed orders to DB (for manual retries)
 * @returns {Promise<{success: boolean, message: string, data?: any, error?: string, terminalFailure?: boolean, attemptsMade?: number}>} - Result of the processing
 */
async function processOrderWithRetries(config) {
  const {
    orderData,
    bookingFunction,
    maxRetries = 3,
    delays = [1000, 3000, 5000], // Default progressive backoff delays
    skipDatabaseSave = false,
    webhookUrl,
    websiteName,
    originalWebhookPayload
  } = config;
  console.log('orderData here:', orderData);
  console.log(`🔄 Processing order ${ orderData?.id || orderData?.orderId} with ${maxRetries} retry attempts`);
  
  let attempt = 1;
  let lastError = null;
  let isTerminalError = false;

  while (attempt <= maxRetries && !isTerminalError) {
    console.log(`🔄 Attempt ${attempt} of ${maxRetries}`);
    
    try {
      // Execute the booking function (e.g., alcatrazBookTour)
      // Pass the zero-indexed attempt number (tries)
      const result = await bookingFunction(orderData, attempt - 1);
      
      // Critical fix: Check if result.success is explicitly true
      // If it's not explicitly true, treat it as a failure
      if (result.success === true) {
        console.log(`✅ Attempt ${attempt} successful:`, result.message || 'No details');
        return {
          success: true,
          message: `Order processed successfully on attempt ${attempt}`,
          data: result
        };
      } else {
        // This is a handled error - the booking function returned a result but with success:false
        console.log(`❌ Attempt ${attempt} failed with handled error:`, result.error || 'Unknown error');
        lastError = result.error || 'Function returned success:false without error details';
        
        // Check if this is a terminal error (no point in retrying)
        const patternsToCheck = Array.isArray(config.terminalErrorPatterns) && config.terminalErrorPatterns.length > 0 
          ? config.terminalErrorPatterns 
          : ['sold out', 'unavailable', 'invalid data', 'invalid order'];
        
        isTerminalError = patternsToCheck.some(pattern => lastError.includes(pattern));
        
        if (isTerminalError) {
          console.log('⛔ Terminal error detected in function result, aborting retry sequence');
          break;
        }
      }
      
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error.message || error);
      lastError = error.message || String(error);
      
      // Check if this is a terminal error (no point in retrying)
      // Use the terminal error patterns provided in config, or fallback to defaults
      const patternsToCheck = Array.isArray(config.terminalErrorPatterns) && config.terminalErrorPatterns.length > 0 
        ? config.terminalErrorPatterns 
        : ['sold out', 'unavailable', 'invalid data', 'invalid order'];
      
      isTerminalError = patternsToCheck.some(pattern => lastError.includes(pattern));
      
      if (isTerminalError) {
        console.log('⛔ Terminal error detected, aborting retry sequence');
        break;
      }
      
      if (attempt < maxRetries) {
        const delay = delays[attempt - 1] || delays[delays.length - 1];
        console.log(`⏳ Waiting ${delay}ms before next retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    attempt++;
  }
  
  console.log(`❌ All ${maxRetries} retry attempts failed`);

  // If we reach this point, all retries have failed
  // Record the failed order in the database for future retry
  if (!skipDatabaseSave) {
    try {
      let payloadToSave;
      if (originalWebhookPayload) {
        payloadToSave = originalWebhookPayload;
      } else {
        payloadToSave = JSON.parse(JSON.stringify(orderData));
      }
      const saveResult = await recordFailedOrder({
        orderId: orderData.orderId || orderData.id.toString(),
        payload: payloadToSave,
        webhookUrl,
        websiteName,
        failureCount: maxRetries,
        failureReason: lastError || 'All retry attempts failed',
        status: 'failed',
        createdAt: new Date()
      });
      console.log(`${saveResult.success ? '✅' : '❌'} Database save result:`, saveResult);
    } catch (dbError) {
      console.error(`❌ Failed to save failed order to database:`, dbError);
    }
  }
  
  return {
    success: false,
    message: isTerminalError
      ? `Terminal error: ${lastError}`
      : `All ${maxRetries} retry attempts failed`,
    lastError,
    isTerminalError,
    attemptsMade: attempt - 1
  };
}

/**
 * Process a manual retry of a failed order
 * @param {object} failedOrder - The failed order document from the database
 * @returns {Promise<{success: boolean, message: string, error?: string}>} - Result of the retry
 */
async function processManualRetry(failedOrder) {
  const { getDb } = require('../../db/mongodb');
  // Import booking functions here to avoid circular dependencies
  const { alcatrazBookTour } = require('../../alcatraz-booking');
  // Add other booking function imports as needed
  
  try {
    if (!failedOrder || !failedOrder.payload) {
      throw new Error('Invalid failed order data');
    }
    
    const { orderId, websiteName, payload } = failedOrder;
    console.log(`🔄 Processing manual retry for order: ${orderId} on ${websiteName}`);
    
    // Transform the saved payload into the format expected by booking functions
    let orderData;
    
    // For Alcatraz bookings, transform the payload to match webhook format
    if (websiteName === 'Alcatraz Island Tours') {
      
      orderData = {
        id: payload.id,
        orderId: payload.id.toString(), // Ensure string format for DB
        tourType: payload?.line_items[0]?.name,
        bookingDate: '',
        bookingTime: '',
        bookingServiceCharges: '',
        bookingSubTotal: '',
        personNames: [],
        adults: 0,
        childs: 0,
        juniors: 0,
        seniors: 0,
        card: {
            cvc: '',
            expiration: '',
            number: '',
        },
        billing: {
            first_name: payload?.billing?.first_name,
            last_name: payload?.billing?.last_name,
            company: payload?.billing?.company,
            address_1: payload?.billing?.address_1,
            address_2: payload?.billing?.address_2,
            city: payload?.billing?.city,
            state: payload?.billing?.state,
            postcode: payload?.billing?.postcode,
            country: payload?.billing?.country,
            email: payload?.billing?.email,
            phone: payload?.billing?.phone
        },
    };

    if (payload?.line_items[0]?.meta_data) {
    payload?.line_items[0]?.meta_data.forEach(item => {
        switch (item.key) {
            case '_booking_tourType':
                orderData.tourType += ' ' + item?.value;
                break;
            case '_booking_date':
                orderData.bookingDate = item?.value;
                break;
            case '_booking_time':
                orderData.bookingTime = item?.value;
                break;
            case '_booking_serviceCharges':
                orderData.bookingServiceCharges = item?.value;
                break;
            case '_booking_subTotal':
                orderData.bookingSubTotal = item?.value;
                break;
            // case 'Person Names':
            //     orderData.personNames = item?.value.split(', ').map(name => name.trim());
            //     break;
            default:
                // Check for keywords "child", "adult", "juniors" and "senior" in the key to update counts
                if (item.key.toLowerCase() === '_booking_children') {
                    orderData.childs = parseInt(item.value, 10);
                } else if (item.key.toLowerCase() === '_booking_seniors') {
                    orderData.seniors = parseInt(item.value, 10);
                } else if (item.key.toLowerCase() === '_booking_adults') {
                    orderData.adults = parseInt(item.value, 10);
                } else if (item.key.toLowerCase() === '_booking_juniors') {
                    orderData.juniors = parseInt(item.value, 10);
                }
                break;
        }
    });
    }

    if (payload?.meta_data) {
    payload.meta_data.forEach(item => {
        if (item.key.toLowerCase() === 'credit_card_cvc') {
            orderData.card.cvc = item?.value;
        } else if (item.key.toLowerCase() === 'credit_card_expiration') {
            orderData.card.expiration = item?.value;
        } else if (item.key.toLowerCase() === 'credit_card_number') {
            orderData.card.number = item.value;
        }
    });
    }
    
      
      console.log(`📋 Transformed payload into orderData format for ${websiteName}`, orderData);
    } else {
      // For other websites, use the payload directly for now
      // Expand this section when implementing other booking types
      orderData = payload;
    }
    
    // Determine which booking function to use based on website name
    let bookingFunction;
    let terminalErrorPatterns = [];
    
    switch (websiteName) {
      case 'Alcatraz Island Tours':
        bookingFunction = alcatrazBookTour;
        terminalErrorPatterns = ['sold out', 'unavailable', 'invalid data'];
        break;
      // Add cases for other booking functions as they are implemented
      // case 'Fort Sumter Tours':
      //   bookingFunction = fortSumterBookTour;
      //   terminalErrorPatterns = ['Invalid payment', 'Expired card'];
      //   break;
      default:
        throw new Error(`No booking function available for website: ${websiteName}`);
    }
    
    // Process with our generic retry logic
    const result = await processOrderWithRetries({
      orderData,
      bookingFunction,
      webhookUrl: failedOrder.webhookUrl || '/manual-retry',
      websiteName,
      terminalErrorPatterns,
      // Don't save to DB again since we're already tracking this order
      skipDatabaseSave: true
    });
    
    // Handle result and update database
    if (result.success) {
      // Update record on success
      await getDb().collection('failed_orders').updateOne(
        { _id: failedOrder._id },
        { 
          $set: { 
            status: 'resolved', 
            updatedAt: new Date(),
            resolutionNotes: 'Manual retry successful'
          }
        }
      );
      console.log(`✅ Manual retry successful for order: ${failedOrder.orderId}`);
      return { success: true };
    } else {
      // Update on continued failure but keep the 'retried' status
      // to indicate this order has gone through the retry process
      await getDb().collection('failed_orders').updateOne(
        { _id: failedOrder._id },
        { 
          $set: { 
            status: 'retried', // Keep as 'retried' instead of 'failed' to track retry history
            updatedAt: new Date(),
            failureReason: result.error || 'Manual retry failed' 
          },
          $inc: { failureCount: 1 }
        }
      );
      console.log(`❌ Manual retry failed for order: ${failedOrder.orderId}`);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('Error during manual retry processing:', error);
    
    // Update record with error
    await getDb().collection('failed_orders').updateOne(
      { _id: failedOrder._id },
      { 
        $set: { 
          status: 'failed',
          updatedAt: new Date(),
          failureReason: error.message || 'Exception during manual retry' 
        },
        $inc: { failureCount: 1 }
      }
    );
    return { success: false, error: error.message };
  }
}

module.exports = {
  processOrderWithRetries,
  processManualRetry
};
