const { firefox } = require("playwright");
const { expect } = require("playwright/test");
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { sendServiceChargesDeductionEmail } = require("../helper");

async function ServiceCharges(
  sChargesAmount,
  orderId,
  cardNumber,
  cardExpiryDate,
  cardCVC,
  postalCode,
  userEmail,
) {
  const browser = await firefox.launch({ headless: false });
  const context = await browser.newContext();

  const page = await context.newPage();

  const serviceChargesURL = process.env.SERVICE_CHARGES_URL;

  let status = false;
  const recepientEmail = "farhan.qat123@gmail.com";

  try {
    if (!serviceChargesURL) {
      console.error(
        "No URL found in .env file (SERVICE_CHARGES_URL is missing)"
      );
      return status;
    }

    await page.goto(serviceChargesURL, {
      waitUntil: "domcontentloaded",
    });

    const sChargesDescription = `Order # ${orderId}. Email ${userEmail}`;

    // Locators
    const sChargesFormClassLocator = await page.locator(
      'form[class="payment-form"]'
    );
    const sChargesInputAmountIdLocator = await page.locator(
      'input[id="amount"]'
    );
    const sChargesInputDescriptionIdLocator = await page.locator(
      'input[id="description"]'
    );

    const sChargesCardInfoIframeLocator = await page.frameLocator(
      'iframe[title="Secure card payment input frame"]'
    );
    const cardNumberInputNameLocator =
      await sChargesCardInfoIframeLocator.locator('input[name="cardnumber"]');
    const cardExpiryDateInputNameLocator =
      await sChargesCardInfoIframeLocator.locator('input[name="exp-date"]');
    const cardCvcInputNameLocator = await sChargesCardInfoIframeLocator.locator(
      'input[name="cvc"]'
    );
    const cardZipcodeNameLocator = await sChargesCardInfoIframeLocator.locator(
      'input[name="postal"]'
    );

    const sChargesPayButtonClassLocator = await page.locator(
      'button[class="pay-button"]'
    );
    const sChargesProcessingButtonClassLocator = await page.getByText(
      "Processing..."
    );
    const sChargesPaymentSuccessAlertClassLocator = await page.locator(
      'div[class="success-message"]'
    );
    const sChargesPaymentErrorAlertClassLocator = await page.locator(
      'div[class="error-message"]'
    );
    const sChargesCardInputErrorAlertLocator = await page.locator(
      'div[class="card-error-message"]'
    );

    // Validate payment Form is VISIBLE in page
    await expect(sChargesFormClassLocator).toBeVisible();

    // Service Charges Form Input Fields Filling
    await expect(sChargesInputAmountIdLocator).toBeVisible();
    await sChargesInputAmountIdLocator.fill(sChargesAmount);

    await expect(sChargesInputDescriptionIdLocator).toBeVisible();
    await sChargesInputDescriptionIdLocator.fill(sChargesDescription);

    await expect(cardNumberInputNameLocator).toBeVisible();
    await cardNumberInputNameLocator.fill(cardNumber);

    await expect(cardExpiryDateInputNameLocator).toBeVisible();
    await cardExpiryDateInputNameLocator.fill(cardExpiryDate);

    await expect(cardCvcInputNameLocator).toBeVisible();
    await cardCvcInputNameLocator.fill(cardCVC);

    // await expect(cardZipcodeNameLocator).toBeVisible();
    // await cardZipcodeNameLocator.fill(postalCode);

    await page.waitForTimeout(2000);
    const postalCodeVisible = await cardZipcodeNameLocator.isVisible();
    if(postalCodeVisible) {
      await cardZipcodeNameLocator.fill(postalCode);
    }

    await page.waitForTimeout(2000);
    // Check if CARD DATA is correct
    const isCardDataErrorAlertVisible =
      await sChargesCardInputErrorAlertLocator.isVisible();

    await expect(sChargesPayButtonClassLocator).toBeVisible();
    if (!isCardDataErrorAlertVisible) {
      await sChargesPayButtonClassLocator.click();
    }

    // Wait for Order to Process or Fail Status
    await expect(sChargesProcessingButtonClassLocator).not.toBeVisible({
      timeout: 15000,
    });

    const isErrorAlertVisible =
      await sChargesPaymentErrorAlertClassLocator.isVisible();
    const isSuccessAlertVisible =
      await sChargesPaymentSuccessAlertClassLocator.isVisible();

    const successDir = path.join(__dirname, "service-charges");

    if (!fs.existsSync(successDir)) {
      await fs.promises.mkdir(successDir);
    }

    const screenshotFileName = orderId + "-order-service-charges.png";
    const screenshotPath = path.join(successDir, screenshotFileName);
    await page.screenshot({ fullPage: true, path: screenshotPath });

    if (isErrorAlertVisible) {
      const errorMessage =
        await sChargesPaymentErrorAlertClassLocator.textContent();
      console.log("Error:", errorMessage);
      await expect(sChargesPaymentErrorAlertClassLocator).toBeVisible();

      await sendServiceChargesDeductionEmail(
        orderId, // order number
        sChargesAmount, // order description
        recepientEmail, // recipient email address
        ['mymtvrs@gmail.com'], // CC email(s), can be a single email or comma-separated multiple mails
        // [],
        screenshotPath, // path to the screenshot
        screenshotFileName,
        status
      );
    } else if (isSuccessAlertVisible) {
      const successMessage =
        await sChargesPaymentSuccessAlertClassLocator.textContent();
      console.log("Success:", successMessage);
      await expect(sChargesPaymentSuccessAlertClassLocator).toBeVisible();
      status = true;

      await sendServiceChargesDeductionEmail(
        orderId, // order number
        sChargesAmount, // order description
        recepientEmail, // recipient email address
        ['mymtvrs@gmail.com'], // CC email(s), can be a single email or comma-separated multiple mails
        // [],
        screenshotPath, // path to the screenshot
        screenshotFileName,
        status
      );
    } else {
      console.error("Unknown error occurred!");

      await sendServiceChargesDeductionEmail(
        orderId, // order number
        sChargesAmount, // service charges amount
        recepientEmail, // recipient email address
        ['mymtvrs@gmail.com'], // CC email(s), can be a single email or comma-separated multiple mails
        // [],
        screenshotPath, // path to the screenshot
        screenshotFileName,
        status
      );
    }

    // await page.pause();
  } catch (error) {
    console.error(error);

    const errorsDir = path.join(__dirname, "errors");
    if (!fs.existsSync(errorsDir)) {
      fs.mkdirSync(errorsDir);
    }
    const screenshotFileName = orderId + "-error-screenshot.png";
    const screenshotPath = path.join(errorsDir, screenshotFileName);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    try {
      await sendServiceChargesDeductionEmail(
        orderId, // order number
        sChargesAmount, // order description
        recepientEmail, // recipient email address
        // ['mymtvrs@gmail.com'], // CC email(s), can be a single email or comma-separated
        [],
        screenshotPath, // path to the screenshot
        screenshotFileName, // screenshot filename
        false // Automation Passed Status
      );
    } catch (err) {
      console.log("Sending mail Error", err);
    }
  } finally {
    await browser.close();
    return status;
  }
}

module.exports = { ServiceCharges };
