const { firefox } = require("playwright");
const { expect } = require("@playwright/test");
require("dotenv").config();

// Orders Statuses Options on Wordpress
/*
1- Pending payment
2- Processing
3- On hold
4- Completed
5- Cancelled
6- Refunded
7- Failed
8- Draft
*/

async function updateOrderStatus(siteName, username, password, orderId, newStatus) {
    console.log("Data Received:", siteName, username, password, orderId, newStatus);
    
    const browser = await firefox.launch({ headless: false }); // set to true for headless mode
    const context = await browser.newContext();
    const page = await context.newPage();

    
  await page.setDefaultTimeout(170000);
  await expect.configure({ timeout: 130000 });



    try {
        let siteUrl = "";

        if (siteName == "AlcatrazTicketing") {
            siteUrl = "https://www.alcatrazticketing.com";
        } else if(siteName == "PotomacTicketing"){
            siteUrl = "https://www.potomacticketing.com"
        } else if(siteName == "StatueTicketing"){
            siteUrl = "https://www.statueticketing.com"
        }

        // Login
        await page.goto(`${siteUrl}/wp-login.php`);

        const wpUsernameLocator = await page.locator("#user_login");
        await expect(wpUsernameLocator).toBeVisible();
        await wpUsernameLocator.fill(username);


        const wpPasswordLocator = await page.locator("#user_pass");
        await expect(wpPasswordLocator).toBeVisible();
        await wpPasswordLocator.fill(password);

        await page.waitForTimeout(2000);

        const wpSubmitButton = await page.locator('#wp-submit');
        await expect(wpSubmitButton).toBeVisible({timeout: 5000});
        await wpSubmitButton.click();
        // await page.waitForNavigation();

        await page.waitForTimeout(3000);
        // Go to WooCommerce Orders
        await page.goto(`${siteUrl}/wp-admin/admin.php?page=wc-orders`);
        console.log('reached on the page');
        

        const wpOrdersPageSearchInputLocator = page.locator("#orders-search-input-search-input");

        await expect(wpOrdersPageSearchInputLocator).toBeVisible({timeout: 10000});

        // Search for the specific order
        await wpOrdersPageSearchInputLocator.fill(String(orderId));

        const wpOrdersPageSearchSubmitBtn = await page.locator("#search-submit");
        await wpOrdersPageSearchSubmitBtn.click();

        // Create a regex pattern with the order ID
        const orderIdRegex = new RegExp(`#${orderId}\\s.*$`);
        const link = await page.getByRole('link', { name: orderIdRegex });
        
        await expect(link).toBeVisible();
        // Click on the order
        await link.click();

        const orderStatusSelectLocator = await page.locator("#order_status");
        
        await expect(orderStatusSelectLocator).toBeVisible({timeout: 5000})
        
        // Update order status
        await orderStatusSelectLocator.selectOption(`${newStatus}`);

        await page.waitForTimeout(3000);
        
        // Save/Update the order
        const updateOrderInfoBtn = await page.locator("button[name='save']");
        await expect(updateOrderInfoBtn).toBeVisible();

        await updateOrderInfoBtn.click();

        console.log(`✅ Order ${orderId} updated to ${newStatus}`);
        await page.pause()
    } catch (error) {
        console.error(`❌ Error updating order:`, error);
    } finally {
        await browser.close();
    }
}

module.exports = {updateOrderStatus}