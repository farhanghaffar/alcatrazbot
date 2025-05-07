const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;
require("dotenv").config();

const alcatraz_site_url = process.env.ALCATRAZ_WP_SITE_URL;
const alcatraz_consumer_key = process.env.ALCATRAZ_WC_REST_API_CONSUMER_KEY;
const alcatraz_consumer_secret = process.env.ALCATRAZ_WC_REST_API_CONSUMER_SECRET;

// Configure WooCommerce API instance
const AlcatrazWooCommerceInstance = new WooCommerceRestApi({
  url: alcatraz_site_url,           
  consumerKey: alcatraz_consumer_key,     
  consumerSecret: alcatraz_consumer_secret, 
  version: "wc/v3"
});

const potomac_site_url = process.env.POTOMAC_WP_SITE_URL;
const potomac_consumer_key = process.env.POTOMAC_WC_REST_API_CONSUMER_KEY;
const potomac_consumer_secret = process.env.POTOMAC_WC_REST_API_CONSUMER_SECRET;

const PotomacWooCommerceInstance = new WooCommerceRestApi({
  url: potomac_site_url,           
  consumerKey: potomac_consumer_key,     
  consumerSecret: potomac_consumer_secret, 
  version: "wc/v3"
});

/**
 * Update WooCommerce order status
 * @param {number|string} orderId - WooCommerce Order ID
 * @param {string} status - New status (e.g., 'completed', 'cancelled', 'processing')
 * @returns {Promise<object>} Response from WooCommerce API
 */
const updateOrderStatus = async (siteName,orderId, status) => {
    console.log("Update Order Details:", siteName,orderId, status);
    let woocommerceApi = null;
    if (siteName == "AlcatrazTicketing") {
        woocommerceApi = AlcatrazWooCommerceInstance;
    } else if(siteName == "PotomacTicketing"){
      woocommerceApi = PotomacWooCommerceInstance;
    }
  try {
    const response = await woocommerceApi.put(`orders/${orderId}`, {
      status: status
    });

    console.log(`✅ Order ${orderId} updated to ${status}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to update order ${orderId}:`, error.response?.data || error.message);
    throw error;
  }
};

module.exports = {
  updateOrderStatus
};