// utils/cron/failedOrderRetry.js
const cron = require('node-cron');
const { getDb } = require('../../db/mongodb');
const { processManualRetry } = require('../retry/orderProcessor');
const { shouldRetry } = require('../../db/failedOrdersSchema');

// Configuration
const MAX_BATCH_SIZE = 5; // Process up to 5 orders at a time

/**
 * Get retryable failed orders with exactly 3 retries
 * @returns {Promise<Array>}
 */
async function getFailedOrdersWithThreeRetries() {
  try {
    const db = await getDb();
    return await db.collection('failed_orders')
      .find({
        status: 'failed',
        failureCount: 3,
        retryable: true // Only get retryable orders
      })
      .toArray();
  } catch (error) {
    console.error(`\u274c Error fetching failed orders: ${error.message}`);
    console.error('❌ Failed to fetch orders for cron retry:', error);
    return [];
  }
}

/**
 * Process a batch of failed orders
 * @returns {Promise<void>}
 */
async function processCronRetryBatch() {
  const db = await getDb();
  const cronRunId = Date.now().toString(); // Simple unique identifier for this run
  
  try {
    const orders = await getFailedOrdersWithThreeRetries();
    console.log(`📋 Cron job found ${orders.length} retryable failed orders with 3 retries`);
    
    if (orders.length === 0) {
      return;
    }
    
    // ========== PARALLEL BATCH PROCESSING IMPLEMENTATION ==========
    // Calculate optimal concurrency based on system resources
    // Using fewer workers than CPU cores to avoid overloading
    const os = require('os');
    const cpuCount = os.cpus().length;
    const MAX_CONCURRENT = Math.max(1, Math.min(3, Math.floor(cpuCount / 2)));
    
    console.log(`🔄 Processing orders with maximum ${MAX_CONCURRENT} concurrent jobs`);
    
    // Process orders in batches
    for (let i = 0; i < orders.length; i += MAX_CONCURRENT) {
      const batch = orders.slice(i, i + MAX_CONCURRENT);
      console.log(`🔄 Processing batch ${Math.floor(i/MAX_CONCURRENT) + 1} with ${batch.length} orders`);
      
      // Process this batch in parallel
      const batchPromises = batch.map(async (order) => {
        try {
          // Mark order as being processed
          await db.collection('failed_orders').updateOne(
            { _id: order._id },
            { 
              $set: { 
                status: 'retried',
                updatedAt: new Date(),
                failureReason: `Parallel cron retry initiated at ${new Date().toISOString()}`
              },
              $inc: { failureCount: 1 }
            }
          );
          
          console.log(`🔄 Cron job retrying order ${order.orderId} in parallel`);
          
          // Use your existing function without modification
          const result = await processManualRetry(order);
          
          // For successful orders, delete them from failed_orders collection
          if (result.success) {
            // Verify the order exists before trying to delete
            const orderExists = await db.collection('failed_orders').findOne({ _id: order._id });
            
            if (orderExists) {
              // Delete the order from failed_orders collection
              await db.collection('failed_orders').deleteOne({ _id: order._id });
              console.log(`\u2705 Parallel cron job successfully processed order ${order.orderId} and removed it from failed orders`);
            } else {
              console.log(`\u2753 Order ${order.orderId} already removed or doesn't exist in database`);
            }
          } else {
            await db.collection('failed_orders').updateOne(
              { _id: order._id },
              { 
                $set: { 
                  status: 'retried', // Keep as 'retried' to indicate it went through the retry process
                  failureReason: `Parallel cron retry failed: ${result.error || 'Unknown error'}`,
                  updatedAt: new Date()
                }
              }
            );
            console.log(`❌ Parallel cron job failed to process order ${order.orderId}: ${result.error || 'Unknown error'}`);
          }
          
          return { orderId: order.orderId, success: result.success };
        } catch (error) {
          console.error(`❌ Error during parallel cron retry of order ${order.orderId}:`, error);
          
          await db.collection('failed_orders').updateOne(
            { _id: order._id },
            { 
              $set: { 
                status: 'retried', // Keep as 'retried' to maintain retry history
                failureReason: `Exception during parallel cron retry: ${error.message || 'Unknown error'}`,
                updatedAt: new Date()
              }
            }
          );
          
          return { orderId: order.orderId, success: false, error: error.message };
        }
      });
      
      // Wait for all promises in this batch to complete
      const batchResults = await Promise.all(batchPromises);
      console.log(`✓ Batch ${Math.floor(i/MAX_CONCURRENT) + 1} completed:`, 
        batchResults.map(r => `${r.orderId}: ${r.success ? 'success' : 'failed'}`).join(', '));
      
      // Add delay between batches to allow system resources to recover
      if (i + MAX_CONCURRENT < orders.length) {
        console.log('⏳ Waiting 5 seconds between batches...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    console.log(`✅ Cron job completed processing ${orders.length} orders in parallel batches`);
    
    // ========== OLD SEQUENTIAL PROCESSING IMPLEMENTATION (COMMENTED OUT) ==========
    /*
    // Set maximum number of concurrent orders to process
    // For Playwright automation, we're limiting to 1 to avoid resource conflicts
    const MAX_CONCURRENT = 1;
    console.log(`🔄 Processing orders sequentially (max ${MAX_CONCURRENT} at a time) to avoid browser conflicts`);
    
    // Process orders with limited concurrency
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      console.log(`📅 Processing order ${i + 1} of ${orders.length}: ${order.orderId}`);
      
      // Mark order as being processed by cron - using valid status from schema
      await db.collection('failed_orders').updateOne(
        { _id: order._id },
        { 
          $set: { 
            status: 'retried', // Using 'retried' from schema enum ['failed', 'retried', 'resolved']
            updatedAt: new Date(),
            failureReason: `Cron retry initiated at ${new Date().toISOString()}`
          },
          $inc: { 
            failureCount: 1
          }
        }
      );
      
      console.log(`🔄 Cron job retrying order ${order.orderId}`);
      
      try {
        // Add delay between order processing to ensure previous browser is fully closed
        if (i > 0) {
          console.log(`⏳ Waiting 10 seconds between orders to ensure clean browser state...`);
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
        
        // Use existing manual retry function
        const result = await processManualRetry(order);
        
        // Update order based on retry result
        if (result.success) {
          await db.collection('failed_orders').updateOne(
            { _id: order._id },
            { 
              $set: { 
                status: 'resolved', // Using 'resolved' from schema enum ['failed', 'retried', 'resolved']
                failureReason: `Order successfully processed by cron at ${new Date().toISOString()}`,
                updatedAt: new Date()
              }
            }
          );
          console.log(`✅ Cron job successfully processed order ${order.orderId}`);
        } else {
          await db.collection('failed_orders').updateOne(
            { _id: order._id },
            { 
              $set: { 
                status: 'failed', // Using 'failed' from schema enum ['failed', 'retried', 'resolved']
                failureReason: `Cron retry failed: ${result.error || 'Unknown error'}`,
                updatedAt: new Date()
              }
            }
          );
          console.log(`❌ Cron job failed to process order ${order.orderId}: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error(`❌ Error during cron retry of order ${order.orderId}:`, error);
        
        // Reset status to failed
        await db.collection('failed_orders').updateOne(
          { _id: order._id },
          { 
            $set: { 
              status: 'failed',
              failureReason: `Exception during cron retry: ${error.message || 'Unknown error'}`,
              updatedAt: new Date()
            }
          }
        );
      }
    }
    */
  } catch (error) {
    console.error('❌ Cron job batch processing error:', error);
  }
}

// Process command line arguments
const args = process.argv.slice(2);
const forceRetryMachine = args.includes('--force-retry');

/**
 * Initialize cron job that runs every 20 minutes
 */
function initFailedOrderRetryCron() {
  // Get machine information from environment
  const machineName = process.env.MACHINE_NAME || 'unknown';
  const retryMachineName = process.env.RETRY_MACHINE_NAME || 'unknown';
  
  console.log(`🖥️ Current machine: ${machineName}, Designated retry machine: ${retryMachineName}`);
  
  // Only schedule the cron job if this is the designated retry machine or force flag is set
  if (machineName === retryMachineName || forceRetryMachine) {
    // Run every 20 minutes
    cron.schedule('*/20 * * * *', async () => {
      console.log('🕒 Running failed order retry cron job at', new Date().toISOString());
      await processCronRetryBatch();
    });
    
    console.log('✅ Failed order retry cron job initialized (runs every 20 minutes)');
  } else {
    console.log('ℹ️ This machine is not designated for retry processing. Cron job not scheduled.');
  }
}

/**
 * Run the cron job immediately for testing or manual triggering
 */
async function runCronJobImmediately() {
  console.log('🔄 Manually triggering failed order retry cron job');
  await processCronRetryBatch();
}

module.exports = {
  initFailedOrderRetryCron,
  runCronJobImmediately,
  processCronRetryBatch
};
