// utils/cron/index.js
const { initFailedOrderRetryCron } = require('./failedOrderRetry');

/**
 * Initialize all cron jobs
 */
function initCronJobs() {
  // Initialize the failed order retry cron job
  initFailedOrderRetryCron();
  
  console.log('✅ All cron jobs initialized');
}

module.exports = {
  initCronJobs
};
