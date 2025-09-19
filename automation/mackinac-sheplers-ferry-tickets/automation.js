const { chromium } = require("playwright");
const {
  getRandomUserAgent,
  getRandomDelayWithLimit,
  sendEmail,
  typeWithDelayWithPressMethod,
  typeWithDelay,
} = require("../../helper.js");
const fs = require("fs");
const path = require("path");
const { expect } = require("playwright/test");
require("dotenv").config();

const BookMckinacIslandTickets = async (orderData, tries) => {
  const browser = await chromium.launch({ headless: false, slowMo: 200, channel: "chrome" });
  const userAgent = getRandomUserAgent();
  const URL = "https://www.sheplersferry.com/";

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: userAgent,
  });

  const page = await context.newPage();

  try {
    await page.goto(URL, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });

    console.log("Navigating to the website");
    const playYourVisitHeading = await page.getByRole("heading").filter({hasText: "PLAN YOUR VISIT"});
    await expect(playYourVisitHeading).toBeVisible({timeout: getRandomDelayWithLimit(60000)});

    console.log("Navigated to the website successfully...");

    console.log("lookign for 'BUY TICKETS' button");
    const buyTicketsButton = await page.getByRole("link").filter({hasText: "BUY TICKETS"});
    await expect(buyTicketsButton).toBeVisible({timeout: getRandomDelayWithLimit(20000)});
    console.log("Found 'BUY TICKETS' button");

    console.log("Clicking on 'BUY TICKETS' button");
    await buyTicketsButton.click();
    console.log("Clicked on 'BUY TICKETS' button");

    console.log("Clicked on the purchase tickets button");
    await page.waitForTimeout(getRandomDelayWithLimit(5000));


    console.log("Waiting for Buy Tickets page visibility");

    const buyTicketsPageHeading = await page.getByRole("heading").filter({hasText: "CHOOSE DEPARTURE LOCATION"});
    await expect(buyTicketsPageHeading).toBeVisible({timeout: 80000});
    console.log("Buy Tickets page is visible");

    console.log("Waiting for the date range text to be visible");

    const div = await page.locator("div.ticket-container-white").first();
    const pText = await div.locator("p").textContent();
    console.log("Date Range found successfully");
    console.log(pText);
    await page.waitForTimeout(getRandomDelayWithLimit(500));

    const isDateValid = await checkDateInRange(orderData.bookingDate, pText);
    console.log("Date validity check result:", isDateValid, orderData.bookingDate, pText);
    if (!isDateValid) {
      throw new Error("Date is not within the valid range");
    }
    await page.waitForTimeout(getRandomDelayWithLimit(700));

    /// St. Ignace -> Mackinac Island (Round Trip)
    /// Mackinaw City -> Mackinac Island (Round Trip)
    // if(orderData.tourType === "")
    const locationSelector = await page.locator("select#departPort");
    await expect(locationSelector).toBeVisible({timeout: 10000});

    // Extract the starting point to match script example (e.g., "Mackinaw City")
    const tourTypeSelectOption = orderData?.tourType?.split(' ->')[0];
    console.log("Tour Type Select Option:", tourTypeSelectOption);

    await locationSelector.selectOption(tourTypeSelectOption); // Assuming index 0 is Mackinaw City based on tourType
    console.log(`Selected departure location: ${tourTypeSelectOption}`);
    await page.waitForTimeout(getRandomDelayWithLimit(1000));

    const ticketQuantities = {
      adult: orderData?.adult ? orderData?.adult?.split(' x ')[0] : "0",
      child: orderData?.child ? orderData?.child?.split(' x ')[0] : "0",
      infant: orderData?.infant ? orderData?.infant?.split(' x ')[0] : "0",
      pet: orderData?.pet ? orderData?.pet?.split(' x ')[0] : "0",
    };

    console.log("Ticket Quantities:", ticketQuantities);

    const adultCountSelector = page.locator("select#ferryTicketItem_1");
    await adultCountSelector.selectOption({
      value: ticketQuantities.adult,
    });
    console.log(`Set the adult ticket count to ${ticketQuantities.adult}`);
    await page.waitForTimeout(getRandomDelayWithLimit(700));

    const childSelectLocator = page.locator("select#ferryTicketItem_2");
    await childSelectLocator.selectOption({
      value: ticketQuantities.child,
    });
    console.log(`Set the child ticket count to ${ticketQuantities.child}`);
    await page.waitForTimeout(getRandomDelayWithLimit(1000));

    const infantSelectLocator = page.locator("select#ferryTicketItem_5");
    await infantSelectLocator.selectOption({
      value: ticketQuantities.infant,
    });
    console.log(`Set the infant ticket count to ${ticketQuantities.infant}`);
    await page.waitForTimeout(getRandomDelayWithLimit(300));

    const petSelectLocator = page.locator("select#ferryTicketItem_159");
    await petSelectLocator.selectOption({
      value: ticketQuantities.pet,
    });
    console.log(`Set the pet ticket count to ${ticketQuantities.pet}`);
    await page.waitForTimeout(getRandomDelayWithLimit(800));

    const ferryTicketsSectionHeading = await page.getByRole("heading").filter({hasText: "Ferry Tickets"});
    await expect(ferryTicketsSectionHeading).toBeVisible({timeout: 5000});
    console.log("Ferry Tickets section is visible");

    await page.waitForSelector("#ferryNextStep", { state: "visible" });

    const ticketsPageCheckoutButton = await page.locator("a#ferryNextStep");
    // const checkoutButton = await page.getByRole("link").filter({hasText: 'CHECKOUT'});
    await expect(ticketsPageCheckoutButton).toBeVisible({timeout: getRandomDelayWithLimit(10000)});

    console.log("Checkout button visible, Clicking on the checkout button");
    await ticketsPageCheckoutButton.click();
    console.log("Clicked on the checkout button");

    console.log("Waiting for the checkout page to load");
    await page.waitForTimeout(10000);

    const checkOutPageOrderReviewHeading = await page.getByRole("heading").filter({hasText: "Order Review", exact: true}).first();
    await expect(checkOutPageOrderReviewHeading).toBeVisible({timeout: 10000});
    console.log("Order Review page is visible");


    console.log("Looking for Billing Information section");
    const billingInformationSectionHeading = await page.getByRole("heading").filter({hasText: "BILLING INFORMATION"});
    await expect(billingInformationSectionHeading).toBeVisible({timeout: 10000});
    console.log("Billing Information section is visible");

    // Fill text input fields - First Name
    const billingInfoFirstNameInput = await page.locator("input[name='firstName']");
    await expect(billingInfoFirstNameInput).toBeVisible({timeout: 10000});

    await typeWithDelay(billingInfoFirstNameInput, orderData?.billing?.first_name);

    console.log(`Filled firstName with ${orderData?.billing?.first_name}`);
    await page.waitForTimeout(getRandomDelayWithLimit(1000));

    // Fill text input fields - Last Name
    const billingInfoLastNameInput = await page.locator("input[name='lastName']");
    await expect(billingInfoLastNameInput).toBeVisible({timeout: 10000});
    await typeWithDelay(billingInfoLastNameInput, orderData?.billing?.last_name);
    console.log(`Filled lastName with ${orderData?.billing?.last_name}`);
    await page.waitForTimeout(getRandomDelayWithLimit(1000));

    // Fill text input fields - Street Address
    const billingInfoStreetAdd1Input = await page.locator("input[name='streetAdd1']");
    await expect(billingInfoStreetAdd1Input).toBeVisible({timeout: 10000});
    await typeWithDelay(billingInfoStreetAdd1Input, orderData?.billing?.address_1?.slice(0, 38));

    console.log(
      `Filled streetAdd1 with ${orderData?.billing?.address_1?.slice(0, 38)}`
    );
    await page.waitForTimeout(getRandomDelayWithLimit(1500));

    // Fill text input fields - Street Address 2
    const billingInfoStreetAdd2Input = await page.locator("input[name='streetAdd2']");
    await expect(billingInfoStreetAdd2Input).toBeVisible({timeout: 10000});
    await typeWithDelay(billingInfoStreetAdd2Input, orderData?.billing?.address_2?.slice(0, 38));
    console.log(
      `Filled streetAdd2 with ${orderData?.billing?.address_2?.slice(0, 38)}`
    );
    await page.waitForTimeout(getRandomDelayWithLimit(1300));

    // Fill text input fields - City
    const billingInfoCityInput = await page.locator("input[name='city']");
    await expect(billingInfoCityInput).toBeVisible({timeout: 10000});
    await typeWithDelay(billingInfoCityInput, orderData?.billing?.city);
    console.log(`Filled city with ${orderData?.billing?.city}`);
    await page.waitForTimeout(getRandomDelayWithLimit(800));

    // Fill text input fields - State
    const billingInfoStateSelectInput = await page.locator("select[name='state']");
    await expect(billingInfoStateSelectInput).toBeVisible({timeout: 10000});
    await billingInfoStateSelectInput.selectOption(orderData?.billing?.state);
    console.log(`Filled state with ${orderData?.billing?.state}`);
    await page.waitForTimeout(getRandomDelayWithLimit(800));

    // Fill text input fields - Zip
    const billingInfoZipInput = await page.locator("input[name='zip']");
    await expect(billingInfoZipInput).toBeVisible({timeout: 10000});
    await typeWithDelay(billingInfoZipInput, orderData?.billing?.postcode);
    console.log(`Filled zip with ${orderData?.billing?.postcode}`);
    await page.waitForTimeout(getRandomDelayWithLimit(800));

    // Fill text input fields - Country
    const billingInfoCountrySelectInput = await page.locator("select[name='country']");
    await expect(billingInfoCountrySelectInput).toBeVisible({timeout: 10000});
    await billingInfoCountrySelectInput.selectOption(orderData?.billing?.country);
    console.log(`Filled country with ${orderData?.billing?.country}`);
    await page.waitForTimeout(getRandomDelayWithLimit(800));

    // Fill text input fields - Day Phone
    const billingInfoDayPhoneRawInput = await page.locator('input[name="dayPhoneRaw"]');
    await expect(billingInfoDayPhoneRawInput).toBeVisible({timeout: 10000});
    await typeWithDelay(billingInfoDayPhoneRawInput, orderData?.billing?.phone);
    
    console.log(`Filled dayPhoneRaw with ${orderData?.billing?.phone}`);
    await page.waitForTimeout(getRandomDelayWithLimit(400));

    // Fill text input fields - Email
    const billingInfoEmailInput = await page.locator('input[name="email"]');
    await expect(billingInfoEmailInput).toBeVisible({timeout: 10000});
    await typeWithDelay(billingInfoEmailInput, orderData?.billing?.email);
    console.log(`Filled email with ${orderData?.billing?.email}`);
    await page.waitForTimeout(getRandomDelayWithLimit(300));

    // Fill text input fields - Verify Email
    const billingInfoVerifyEmailInput = await page.locator('input[name="verify_email"]');
    await expect(billingInfoVerifyEmailInput).toBeVisible({timeout: 10000});
    await typeWithDelay(billingInfoVerifyEmailInput, orderData?.billing?.email);
    console.log(`Filled verify_email with ${orderData?.billing?.email}`);
    await page.waitForTimeout(getRandomDelayWithLimit(300));
    
    // Handle checkboxes
    // Uncheck marketingEmail checkbox
    const billingInfoMarketingEmailCheckbox = await page.locator('input[name="marketingEmail"]');
    await expect(billingInfoMarketingEmailCheckbox).toBeVisible({timeout: 10000});
    await billingInfoMarketingEmailCheckbox.setChecked(false);
    console.log("Unchecked marketingEmail checkbox");
    await page.waitForTimeout(getRandomDelayWithLimit(1200));

    // Check terms_checkbox2
    const billingInfoTermsCheckbox = await page.locator('#terms_checkbox, input[name="terms_checkbox2"]');
    await expect(billingInfoTermsCheckbox).toBeVisible({timeout: 10000});
    await billingInfoTermsCheckbox.check();
    console.log("Checked terms_checkbox2");
    await page.waitForTimeout(getRandomDelayWithLimit(1200));

    // Payment Details section
    const paymentDetailsSectionContainer = await page.getByRole("heading").filter({hasText: "CREDIT CARD DETAILS"});
    await expect(paymentDetailsSectionContainer).toBeVisible({timeout: 10000});
    console.log("Payment Details section is visible");

    await page.waitForTimeout(getRandomDelayWithLimit(2000));

    const showPaymentFormButton = await page.locator("#showPaymentFormButton");
    await expect(showPaymentFormButton).toBeVisible({timeout: 10000});
    await showPaymentFormButton.click();
    console.log("Clicked showPaymentFormButton");
    await page.waitForTimeout(getRandomDelayWithLimit(10000));
    
    // Locate the iframe
    // First, wait for the iframe element itself to be visible on the page
    await page
      .locator("#iframeAuthorizeNet")
      .waitFor({ state: "visible", timeout: 30000 });

    const frameLocator = page.frameLocator("#iframeAuthorizeNet");

    // Wait for the frame's body to be attached (not visible, since it may be hidden)
    await frameLocator
      .locator("body")
      .waitFor({ state: "attached", timeout: 30000 });

    // Now wait for the selectors inside the iframe
    const cardNumInput = frameLocator.locator("#cardNum");
    await expect(cardNumInput).toBeVisible({timeout: 10000});
    await typeWithDelay(cardNumInput, orderData.card.number);
    console.log(`Filled card number field successfully`);
    await page.waitForTimeout(getRandomDelayWithLimit(300));

    const expiryDateInput = frameLocator.locator("#expiryDate");
    await expect(expiryDateInput).toBeVisible({timeout: 10000});
    const expiryDateInputValue = orderData.card.expiration.replace("/", "");
    await typeWithDelay(expiryDateInput, expiryDateInputValue);
    console.log(`Filled expiryDate with ${orderData.card.expiration}, ${expiryDateInputValue}`);
    await page.waitForTimeout(getRandomDelayWithLimit(300));

    const cvvInput = frameLocator.locator("#cvv");
    await expect(cvvInput).toBeVisible({timeout: 10000});
    await typeWithDelay(cvvInput, orderData.card.cvc);
    console.log(`Filled cvv successfully`);
    await page.waitForTimeout(getRandomDelayWithLimit(300));
    
    const payBtn = frameLocator.locator("#payBtn");
    await expect(payBtn).toBeVisible({timeout: 10000});
    await page.pause();
    

    // Click the Pay button
    await page.waitForTimeout(getRandomDelayWithLimit(10000));
    await frameLocator.locator("#payBtn").click();
    console.log("Clicked payBtn");


    // Check if error message is visible
    // Robust detection: wait for either navigation to confirmation (success) or error element (failure)
    // const errorLocator = frameLocator.locator('div#errorMsgId'); // Fixed selector; inspect to confirm if needed
    // const [navResult, errorResult] = await Promise.allSettled([
    //   page.waitForURL('**/order-confirmation/', { waitUntil: 'domcontentloaded', timeout: 30000 }),
    //   errorLocator.waitFor({ state: 'visible', timeout: 30000 })
    // ]);

    // if (navResult.status === 'fulfilled') {
    //   console.log('Navigation to confirmation detected, assuming transaction success');
    //   getRandomDelayWithLimit(5000);
    //   // Optional: Verify success page content (e.g., check for a confirmation message)
    //   await captureAndSendSuccessScreenshot(page, orderData.orderId);
    //   console.log("Transaction completed successfully for orderId", orderData.orderId);

    // } else if (errorResult.status === 'fulfilled') {
    //   const errorText = await errorLocator.textContent();
    //   console.log('Payment error: ' + errorText.trim());
    //   getRandomDelayWithLimit(5000);
    //   await captureAndSendErrorScreenshot(page, orderData.orderId, errorText.trim());
    //   throw new Error(`Payment failed: ${errorText.trim()}`);
    // } else {
    //   // Timeout: check current state
    //   let isErrorVisible = false;
    //   try {
    //     isErrorVisible = await errorLocator.isVisible({ timeout: 5000 }); // Short timeout for check
    //   } catch (checkError) {
    //     console.log('Error checking for error message: ' + checkError.message);
    //   }
    //   if (isErrorVisible) {
    //     const errorText = await errorLocator.textContent();
    //     console.log('Payment error (late detection): ' + errorText.trim());
    //     getRandomDelayWithLimit(5000);
    //     await captureAndSendErrorScreenshot(page, orderData.orderId, errorText.trim());
    //     throw new Error(`Payment failed: ${errorText.trim()}`);
    //   } else {
    //     console.log('Transaction timed out without clear outcome');
    //     getRandomDelayWithLimit(5000);
    //     await captureAndSendErrorScreenshot(page, orderData.orderId, "Transaction timed out without clear outcome. Unknown transaction state.");
    //     throw new Error('Unknown transaction state');
    //   }
    // }

    // Wait for the page to stabilize after the click
    // await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(await getRandomDelayWithLimit(60000));
    console.log("Page stabilized, current URL:", page.url());

    // Define locators for confirmation and error messages
    const confirmationHeaderLocator = frameLocator.locator(
      "div.cruises-header h1",
      { hasText: "Order Confirmation" }
    );
    const thankYouLocator = frameLocator.getByRole("heading").filter({hasText: "Thank you!", exact: true, timeout: 30000});
    const errorLocator = frameLocator.locator("div#errorMsgId");
    // Broader error locator for dynamic error messages
    const dynamicErrorLocator = page.locator(
      "text=/error|failed|failure|invalid/i"
    );

    try {
      // Early check for error message to catch quick failures
      const isErrorVisibleEarly = await dynamicErrorLocator
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      if (isErrorVisibleEarly) {
        const errorText = await dynamicErrorLocator.textContent();
        console.log("Early error detected: " + errorText.trim());
        await page.waitForTimeout(5000);
        await captureAndSendErrorScreenshot(
          page,
          orderData.id,
          errorText.trim()
        );
        throw new Error(`Early payment error: ${errorText.trim()}`);
      }

      // Check for navigation to confirmation page
      if (page.url().includes("order-confirmation")) {
        // Verify confirmation messages
        const [isHeaderVisible, isThankYouVisible] = await Promise.all([
          confirmationHeaderLocator
            .isVisible({ timeout: 10000 })
            .catch(() => false),
          thankYouLocator.isVisible().catch(() => false),
        ]);

        if (isHeaderVisible && isThankYouVisible) {
          console.log(
            "Order confirmation messages detected, transaction successful"
          );
          await page.waitForTimeout(5000); // Delay for screenshot stability
          await captureAndSendSuccessScreenshot(page, orderData.id);
          await sendSuccessEmail(orderData.id);
          console.log(
            "Transaction completed successfully for orderId",
            orderData.id
          );
        } else {
          // Check for errors on confirmation page (edge case)
          const isErrorOnConfirmation = await dynamicErrorLocator
            .isVisible({ timeout: 5000 })
            .catch(() => false);
          if (isErrorOnConfirmation) {
            const errorText = await dynamicErrorLocator.textContent();
            console.log("Error on confirmation page: " + errorText.trim());
            await page.waitForTimeout(5000);
            await captureAndSendErrorScreenshot(
              page,
              orderData.id,
              errorText.trim()
            );
            throw new Error(
              `Payment failed on confirmation page: ${errorText.trim()}`
            );
          }
          console.log("Confirmation messages not found on confirmation page");
          await page.waitForTimeout(5000);
          await captureAndSendErrorScreenshot(
            page,
            orderData.id,
            "Confirmation messages not found"
          );
          throw new Error("Confirmation messages not found");
        }
      } else {
        // Check for error message on current page
        const isErrorVisible = await errorLocator
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        if (isErrorVisible) {
          const errorText = await errorLocator.textContent();
          console.log("Payment error: " + errorText.trim());
          await page.waitForTimeout(5000);
          await captureAndSendErrorScreenshot(
            page,
            orderData.id,
            errorText.trim()
          );
          throw new Error(`Payment failed: ${errorText.trim()}`);
        }
        // Fallback to dynamic error locator
        const isDynamicErrorVisible = await dynamicErrorLocator
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        if (isDynamicErrorVisible) {
          const errorText = await dynamicErrorLocator.textContent();
          console.log("Dynamic error detected: " + errorText.trim());
          await page.waitForTimeout(5000);
          await captureAndSendErrorScreenshot(
            page,
            orderData.id,
            errorText.trim()
          );
          throw new Error(`Payment failed: ${errorText.trim()}`);
        }
        // No confirmation or error detected
        console.log(
          "No confirmation or error detected, current URL:",
          page.url()
        );
        console.log("Page content sample:", await page.content().slice(0, 200));
        await page.waitForTimeout(5000);
        await captureAndSendErrorScreenshot(
          page,
          orderData.id,
          "No confirmation or error detected"
        );
        throw new Error("Unknown transaction state");
      }
    } catch (error) {
      console.log("Caught error: " + error.message);
      // await sendFailureEmail(orderData.orderId, error.message);
      // await captureAndSendErrorScreenshot(page, orderData.id, error.message);
      throw error; // Re-throw to ensure test failure
    }

    // Optional additional wait to observe result
    await page.waitForTimeout(2000);
    // Removed page.pause() for automation reliability
  } catch (error) {
    console.error(`Automation failed: ${error.message}\nStack: ${error.stack}`);
    if (!error.message.includes("Payment failed")) {
      console.log("There is an issue due to which automation failed", error);
      getRandomDelayWithLimit(5000);
      await captureAndSendErrorScreenshot(
        page,
        orderData.id,
        error.message
      );
    }
  } finally {
    console.log("Automation ended");
    // await browser.close();
  }
};


async function checkDateInRange(inputDateStr, dateRangeText) {
    // Normalize the input date format to MM DD YYYY (replace / or - with spaces)
    const normalizedInputDateStr = inputDateStr.replace(/[-/]/g, " ");
    console.log("Normalized Input Date:", normalizedInputDateStr);
  
    // Regular expression to match the date range in the format 'from Month Day, Year – Month Day, Year'
    const dateRegex =
      /(?:from\s)?([A-Za-z]+ \d{1,2}, \d{4})\s?–\s?([A-Za-z]+ \d{1,2}, \d{4})/;
    
    const match = dateRangeText.match(dateRegex);
    if (!match) {
      throw new Error("Invalid date range format");
    }
  
    const startDateStr = match[1];
    const endDateStr = match[2];
  
    const monthMap = {
      january: 0,
      february: 1,
      march: 2,
      april: 3,
      may: 4,
      june: 5,
      july: 6,
      august: 7,
      september: 8,
      october: 9,
      november: 10,
      december: 11,
    };
  
    // Parse the start date
    const [startMonth, startDay, startYear] = startDateStr.split(/[\s,]+/);
    const startDate = new Date(
      startYear,
      monthMap[startMonth.toLowerCase()],
      parseInt(startDay)
    );
  
    // Parse the end date
    const [endMonth, endDay, endYear] = endDateStr.split(/[\s,]+/);
    const endDate = new Date(
      endYear,
      monthMap[endMonth.toLowerCase()],
      parseInt(endDay)
    );
  
    // Parse the input date
    const [inputMonth, inputDay, inputYear] = normalizedInputDateStr
      .split(" ")  // Use space as a separator after normalization
      .map((num) => parseInt(num));
  
    const inputDate = new Date(inputYear, inputMonth - 1, inputDay);
  
    // Compare input date with the start and end date
    return inputDate >= startDate && inputDate <= endDate;
}
  

const captureAndSendSuccessScreenshot = async (page, orderId) => {
  const successDir = path.join(__dirname, "successful-orders-screenshots");
  if (!fs.existsSync(successDir)) {
    await fs.promises.mkdir(successDir, { recursive: true });
  }

  const successFileName = `${orderId}-order-success.png`;
  const successFilePath = path.join(successDir, successFileName);

  try {
    getRandomDelayWithLimit(10000);
    await page.screenshot({ fullPage: true, path: successFilePath });
    console.log("Taken screenshot of successful order and sending it over...");
  } catch (error) {
    console.log(`Error taking screenshot: ${error}`);
    // Optionally, you could handle this differently in a success case (e.g., proceed without screenshot)
    return; // Exit early if screenshot fails, or adjust based on requirements
  }

  await sendEmail(
    orderId,
    `Your order has been successfully placed. We have received your payment and will begin processing your order shortly.`,
    "farhan.qat123@gmail.com",
    [], // CC list; modify as needed
    successFilePath,
    successFileName,
    true,
    "Mackinac Sheplers Ferry Ticketing"
  );
};

const captureAndSendErrorScreenshot = async (
  page,
  orderId,
  errorMessage = ""
) => {
  const errorDir = path.join(__dirname, "errors-screenshots");
  if (!fs.existsSync(errorDir)) {
    await fs.promises.mkdir(errorDir, { recursive: true });
  }

  const errorFileName = `${orderId}-order-error.png`;
  const errorFilePath = path.join(errorDir, errorFileName);

  try {
    getRandomDelayWithLimit(10000);
    await page.screenshot({ fullPage: true, path: errorFilePath });
    console.log("Taken screenshot of failed order and sending it over...");
  } catch (error) {
    console.log(`Error taking screenshot: ${error}`);
    return;
  }

  await sendEmail(
    orderId,
    `Your order failed this time due to an error during processing ${errorMessage}.`,
    "farhan.qat123@gmail.com",
    [], // CC list; modify as needed
    errorFilePath,
    errorFileName,
    false,
    "Mackinac Sheplers Ferry Ticketing"
  );
};

module.exports = { BookMckinacIslandTickets };
