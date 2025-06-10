const { firefox } = require("playwright");
const { expect } = require("@playwright/test");
const {
  incrementTickets,
  expectedIncrementTickets,
  getCardType,
  formatDate,
  formatCardDate,
  typeWithDelay,
  sendEmail,
  toTitleCase,
  getRandomTime,
  removeSpaces,
  getRandomUserAgent,
  formatAndValidateCardExpirationDate,
  addOneHour,
} = require("./../../helper");
const { Solver } = require("@2captcha/captcha-solver");
const fs = require("fs");
const path = require("path");
const { ServiceCharges } = require("../service-charges");
const { updateOrderStatus } = require("../wp-update-order-status/automation");
require("dotenv").config();

const proxyUrl = process.env.SCRAPEOPS_PROXY_URL;
const SCRAPEOPS_API_KEY = process.env.SCRAPEOPS_API_KEY;

// For BrightData
let proxySession = Math.floor(Math.random() * 100000);
const brightDataProxyURL = "brd.superproxy.io:33335";
const brightDataUserName = `brd-customer-hl_986ab42b-zone-residential_proxy1-country-ca-session-${proxySession}`;
const brightDataPassword = "kfwvdwq63bd5";

const launchOptions = {
  // proxy: {
  //     server: proxyUrl,
  //     username: 'scrapeops.country=us',
  //     password: SCRAPEOPS_API_KEY
  // },

  // BrightData Proxy
  // proxy: {
  //     server: brightDataProxyURL,
  //     username: brightDataUserName,
  //     password: brightDataPassword
  // },
  headless: false,
  timeout: 55000,
  // channel: 'msedge'
};

let randomtime = 0;

async function FortSumterTickets(bookingData, tries) {
  const browser = await firefox.launch(launchOptions);
  // const userAgent = new UserAgent({deviceCategory: 'mobile'}).toString();
  const userAgent = getRandomUserAgent();
  console.log("User Agent:", userAgent);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: userAgent,
    // userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    // ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  await page.setDefaultTimeout(170000);
  await expect.configure({ timeout: 130000 });

  const solver = new Solver(process.env.CAPTCHA_API_KEY);

  try {
    // Check user agent information
    // await page.goto('https://www.whatismybrowser.com/detect/what-is-my-user-agent/');
    // // await page.pause();

    // // Check IP address and log it
    // // await page.goto('https://api.myip.com/');
    // await page.goto('https://httpbin.org/ip');
    // const pageContent = await page.textContent('body');
    // console.log('Current IP', pageContent);
    // // await page.pause();

    console.log("Starting booking automation...");

    let tourURL = "https://www.fortsumtertours.com/";

    await page.goto(tourURL, {
      timeout: 300000,
      waitUntil: "domcontentloaded",
    });

    console.log("Page loaded, looking for Check Availability button...");

    console.log(
      "Checking Card expiry date validity! before Order proceeding..."
    );

    // formatAndValidateCardExpirationDate
    // Validate Payment Card expiry date
    const { cardMonth, cardYear } = formatAndValidateCardExpirationDate(
      bookingData.card.expiration
    );
    console.log("Checked: Card expiry date is valid!", cardMonth, cardYear);

    console.log("Clicked Card expiry date validaty, waiting for calendar...");

    await page.waitForTimeout(10000);

    const bookYourTourButton = await page
      .locator('a.button:has-text("Book Your Tour")')
      .first();
    await expect(bookYourTourButton).toBeVisible({ timeout: 300000 });
    const isBookYourTourButtonVisible = await bookYourTourButton.isVisible();
    console.log("isBookYourTourButtonVisible:", isBookYourTourButtonVisible);

    if (!isBookYourTourButtonVisible) {
      throw new Error("BOOK YOUR TOUR button not found");
    }
    await bookYourTourButton.click();
    console.log("Clicked BOOK YOUR TOUR Button, waiting for calendar...");

    await page.waitForTimeout(5000);
    const tourBookingFrameHandler = await page.frameLocator(
      "#fareharbor-lightframe-iframe"
    );
    const allTourTypesContainerDiv = await tourBookingFrameHandler.locator(
      "div.book-embed-container"
    );
    await expect(allTourTypesContainerDiv).toBeVisible({ timeout: 80000 });
    const isToursPopupVisible = await allTourTypesContainerDiv.isVisible();
    console.log("isToursPopupVisible:", isToursPopupVisible);

    const FSTFromPatriotsPointName = tourBookingFrameHandler.locator(
      "[data-test-id='item-fort-sumter-tours-from-patriots-point-name']"
    );
    const FSTFromLibertySquareName = tourBookingFrameHandler.locator(
      "[data-test-id='item-fort-sumter-tours-from-liberty-square-name']"
    );

    await expect(FSTFromPatriotsPointName).toBeVisible({ timeout: 2000 });
    await expect(FSTFromLibertySquareName).toBeVisible({ timeout: 2000 });

    if (bookingData.tourType === "Fort Sumter Tour (From Patriots Point)") {
      await FSTFromPatriotsPointName.click();
    } else if (
      bookingData.tourType === "Fort Sumter Tour (From Liberty Square)"
    ) {
      await FSTFromLibertySquareName.click();
    }

    await page.waitForTimeout(10000);

    // await page.pause();

    const dateAvailabilityCalendar = tourBookingFrameHandler.locator(
      "[data-test-id='calendar-view']"
    );
    await expect(dateAvailabilityCalendar).toBeVisible({ timeout: 30000 });
    console.log("Booking Date Calender is Visible...");

    // const dummyDate = '2025-02-21';
    const targetDate = formatDate(bookingData.bookingDate);
    const currentMonth = new Date().toLocaleString("default", {
      month: "long",
    });
    const currentYear = new Date().getFullYear();
    console.log("Current month is:", currentMonth, currentYear);

    const dateObject = new Date(targetDate + "T00:00:00");
    const targetMonth = dateObject.toLocaleString("default", { month: "long" });
    const tragetMonthNumericValue = dateObject.getMonth();
    const targetYear = dateObject.getFullYear();
    console.log("Before taget day: ", targetDate);
    const targetDay = dateObject.getDate();
    console.log("After target date: ", targetDay);
    console.log("Target date is:", targetMonth, targetYear, targetDay);

    // await page.pause();

    if (targetMonth === currentMonth && targetYear === currentYear) {
      console.log("Same month and year, proceeding with date selection");
      //   const dateCell = frameHandle
      //     .getByRole("presentation")
      //     .locator(`.CalendarDay`)
      //     .filter({ hasText: `${targetDay}` })
      //     .first();
      const dateCell = tourBookingFrameHandler
        .locator(`td button:not([disabled]) span:text("${targetDay}")`)
        .first();
      // await page.click();

      //   const dataCellAttributes = await dateCell.getAttribute("class");
      //   if (dataCellAttributes.includes("CalendarDay__blocked_calendar")) {
      //     throw new Error("Date not available");
      //   }

      const dataCellAttributes = await dateCell.getAttribute("disabled");
      if (dataCellAttributes === "disabled") {
        throw new Error("Date not available");
      }
      // await expect(dataCellAttributes).not.toContain('CalendarDay__blocked_calendar');
      await dateCell.click();

      await expect(dateCell).toBeVisible({ timeout: 5000 });
      //   await page.pause();
      console.log(`Successfully selected date ${targetDay}`);
    } else {
      console.log("Different month or year, calculating months to navigate");
      const monthsDiff =
        (targetYear - currentYear) * 12 +
        (dateObject.getMonth() - new Date().getMonth());
      console.log(`Need to move forward ${monthsDiff} months`);

      for (let i = 0; i < monthsDiff; i++) {
        const nextMonthButton = tourBookingFrameHandler.locator(
          "[data-test-id='select-next-month-action']"
        );

        await nextMonthButton.click();
        await page.waitForTimeout(1000);
        console.log(`Moved forward month ${i + 1} of ${monthsDiff}`);

        // Check if the target month is now visible
        const targetMonthSelectedValue = await tourBookingFrameHandler
          .locator('[data-test-id="month-nav-label"]')
          .inputValue();
        // await expect(targetMonthSelectedValue).toBe(targetDay);
        console.log("targetMonthSelectedValue:", targetMonthSelectedValue);

        const match = targetMonthSelectedValue.match(/number:(\d+)/);
        const monthIndex = match ? match[1] : null;

        console.log(
          "match:",
          match,
          "monthIndex:",
          monthIndex,
          "targetMonth:",
          targetMonth,
          "tragetMonthNumericValue:",
          tragetMonthNumericValue
        );

        // await page.pause();

        if (monthIndex == tragetMonthNumericValue) {
          console.log(
            `Target month ${targetMonth} ${targetYear} is visible, stopping navigation`
          );
          break; // Exit the loop early as the correct month is found
        }
      }
      console.log("Loop Exited");

      randomtime = getRandomTime();
      await page.waitForTimeout(randomtime);

      // Verify final month selection
      //   await expect(
      //     frameHandle
      //       .locator(".CalendarMonth_caption strong")
      //       .filter({ hasText: `${targetMonth} ${targetYear}` })
      //   ).toBeVisible();

      // await expect(monthIndex).toBe(targetDay);
      console.log(`Verified calendar shows ${targetMonth} ${targetYear}`);

      await page.waitForTimeout(10000);
      console.log(targetDay, `day to select`);
      //   const dateCell = frameHandle
      //     .getByRole("presentation")
      //     .locator(`.CalendarDay`)
      //     .filter({ hasText: `${targetDay}` })
      //     .first();
      const dateCell = tourBookingFrameHandler
        .locator(`td button:not([disabled]) span:text("${targetDay}")`)
        .first();

      await expect(dateCell).toBeVisible();

      //   const dataCellAttributes = await dateCell.getAttribute("class");
      //   if (dataCellAttributes.includes("CalendarDay__blocked_calendar")) {
      //     throw new Error("Date not available");
      //   }

      const dataCellAttributes = await dateCell.getAttribute("disabled");
      if (dataCellAttributes === "disabled") {
        throw new Error("Date not available");
      }

      await dateCell.click();

      //   await expect(
      //     frameHandle
      //       .getByRole("presentation")
      //       .locator(`td.CalendarDay__selected:has(span:text("${targetDay}"))`)
      //   ).toBeVisible();
      // await expect(monthIndex).toBe(targetDay);

      console.log(`Successfully selected date ${targetDay}`);
    }

    randomtime = getRandomTime();
    await page.waitForTimeout(randomtime);

    // await page.pause();

    // const timeSlotToSelect = '9:20 AM';
    const timeSlotToSelect = bookingData.bookingTime;
    console.log("timeSlotToSelect:", timeSlotToSelect);

    const timeSlot = await tourBookingFrameHandler.locator(
      `li:has(.cb-time:has-text("${timeSlotToSelect}")) >> a`
    );

    const timeSlotExist = await timeSlot.isVisible({ timeout: 30000 });
    if (timeSlotExist) {
      await timeSlot.click();
      console.log("Time slot selected:", timeSlotToSelect);
    }

    const randomTime = await getRandomTime();
    await page.waitForTimeout(randomTime);

    const checkoutPageHeading = await tourBookingFrameHandler.locator(
      "#booking-item-label"
    );
    await expect(checkoutPageHeading).toBeVisible({ timeout: 20000 });

    const ticketsSelectorAdults = await tourBookingFrameHandler.locator(
      "[data-test-id='user-type-adult']"
    );
    await expect(ticketsSelectorAdults).toBeVisible();
    await ticketsSelectorAdults.selectOption(`${bookingData.adults}`);

    const ticketsSelectorSeniorMilitary = await tourBookingFrameHandler.locator(
      "[data-test-id='user-type-seniormilitary']"
    );
    await expect(ticketsSelectorSeniorMilitary).toBeVisible();
    await ticketsSelectorSeniorMilitary.selectOption(
      `${bookingData.senior_military}`
    );

    const ticketsSelectorChildren = await tourBookingFrameHandler.locator(
      "[data-test-id='user-type-child']"
    );
    await expect(ticketsSelectorChildren).toBeVisible();
    await ticketsSelectorChildren.selectOption(`${bookingData.childs}`);

    const ticketsSelectorInfants = await tourBookingFrameHandler.locator(
      "[data-test-id='user-type-infant']"
    );
    await expect(ticketsSelectorInfants).toBeVisible();
    await ticketsSelectorInfants.selectOption(
      `${bookingData.infants_under_three}`
    );

    // await page.pause();

    await page.waitForTimeout(5000);

    console.log("Successfully reached Contact Details section!");

    const contactDetailsSectionContainer =
      await tourBookingFrameHandler.locator(
        "[data-test-id='contact-information-form']"
      );
    expect(contactDetailsSectionContainer).toBeVisible({ timeout: 5000 });

    const fullNameInputField = await tourBookingFrameHandler.locator(
      "#id_name, input[name='contact-name']"
    );
    await expect(fullNameInputField).toBeVisible({ timeout: 50000 });
    await typeWithDelay(
      fullNameInputField,
      `${bookingData.billing.first_name} ${bookingData.billing.last_name}`
    );

    await page.waitForTimeout(500);

    const phoneInput = await tourBookingFrameHandler.locator(
      '#id_phone, input[name="contact-phone"]'
    );
    await expect(phoneInput).toBeVisible({ timeout: 50000 });
    const phoneNumber =
      "345" + String(Math.floor(Math.random() * 10000000)).padStart(7, "0");
    console.log("Phone Number being entered :", phoneNumber);
    await typeWithDelay(phoneInput, phoneNumber);

    await page.waitForTimeout(500);

    const emailInput = await tourBookingFrameHandler.locator(
      '#id_email, input[name="contact-email"]'
    );
    await expect(emailInput).toBeVisible({ timeout: 50000 });
    await typeWithDelay(emailInput, bookingData.billing.email);

    console.log("Successfully reached Payment Details section!");

    const paymentDetailsSectionContainer =
      await tourBookingFrameHandler.locator("[data-test-id='payment-details']");
    expect(paymentDetailsSectionContainer).toBeVisible({ timeout: 5000 });

    let postcodeeValue = bookingData.billing.postcode;
    if (!postcodeeValue && bookingData.billing.country === "AE") {
      postcodeeValue = "1224";
    }

    console.log("Zipcode value:", postcodeeValue);

    const cardInfo = {
      cardName:
        bookingData.billing.first_name + " " + bookingData.billing.last_name,
      cardZip:
        bookingData.billing.postcode ||
        (bookingData.billing.country === "AE" ? postcodeeValue : ""),
      cardNumber: bookingData.card.number,
      cardType: getCardType(bookingData.card.number),
      cardCVC: bookingData.card.cvc,
      cardMonth: cardMonth,
      cardYear: cardYear,
      cardExpiration: bookingData.card.expiration,
    };

    // STRIPE Payment Form section
    const securePaymentFormContainerIframe =
      tourBookingFrameHandler.frameLocator(
        'iframe[title="Secure payment input frame"]'
      );

    // Card Number
    const cardNumberInput = securePaymentFormContainerIframe.locator(
      '#Field-numberInput, [placeholder="1234 1234 1234 1234"]'
    );
    await expect(cardNumberInput).toBeVisible({ timeout: 30000 });
    await typeWithDelay(cardNumberInput, removeSpaces(cardInfo.cardNumber));

    // Card Expiration date
    const cardExpirationDateInput = securePaymentFormContainerIframe.locator(
      '#Field-expiryInput, [placeholder="MM / YY"]'
    );
    await expect(cardExpirationDateInput).toBeVisible({ timeout: 30000 });
    await typeWithDelay(
      cardExpirationDateInput,
      removeSpaces(cardInfo.cardExpiration)
    );

    // Card CVC
    const cardCVCInput = securePaymentFormContainerIframe.locator(
      '#Field-cvcInput, [placeholder="CVC"]'
    );
    await expect(cardCVCInput).toBeVisible({ timeout: 30000 });
    await typeWithDelay(cardCVCInput, cardInfo.cardCVC);

    // Country
    const paymentCountrySelect = securePaymentFormContainerIframe.locator(
      '#Field-countryInput, [name="country"]'
    );
    await expect(paymentCountrySelect).toBeVisible({ timeout: 30000 });
    if (bookingData.billing.country.length === 2) {
      await paymentCountrySelect.selectOption(
        bookingData.billing.country.toUpperCase()
      );
      const countrySelectElementValue = await paymentCountrySelect.inputValue();
      await expect(countrySelectElementValue).toBe(
        bookingData.billing.country.toUpperCase()
      );
    } else {
      const countryValue = toTitleCase(bookingData.billing.country);
      await paymentCountrySelect.selectOption(countryValue);
    }

    await page.waitForTimeout(1000);
    // Card CVC
    const postalCodeeInput = securePaymentFormContainerIframe.locator(
      '#Field-postalCodeInput, [name="postalCode"]'
    );
    const isPostalCodeInputVisible = await postalCodeeInput.isVisible();
    if (isPostalCodeInputVisible) {
      await typeWithDelay(postalCodeeInput, cardInfo.cardZip);
    }

    const saveInfoCheckboxInput = await tourBookingFrameHandler.locator(
      "#checkbox-linkOptIn"
    );
    // await expect(saveInfoCheckboxInput).toBeVisible({ timeout: 2000 });
    if (await saveInfoCheckboxInput.isVisible()) {
      const isChecked = await checkbox.isChecked();
      if (isChecked) {
        await checkbox.click(); // Uncheck it
        console.log("Checkbox was checked, now unchecked.");
      } else {
        console.log("Checkbox is already unchecked.");
      }
    } else {
      console.log("Checkbox is not visible.");
    }

    console.log("Card payment information filled");

    const completeAndPayButton = await tourBookingFrameHandler.locator(
      '[data-test-id="complete-and-pay-submit-button"]'
    );

    await expect(completeAndPayButton).toBeVisible({ timeout: 50000 });
    await expect(completeAndPayButton).toBeEnabled({ timeout: 50000 });

    // await page.pause();

    const sitekey = process.env.BAY_CRUISE_TICKETING_SITE_KEY;

    // *************************************************************************************

    console.log(
      "[hCaptcha] Starting hCaptcha solving process for Stripe payment form"
    );

    // 1. Solve the captcha
    console.log("[hCaptcha] Sending request to 2Captcha service...");

    const { data: token } = await solver.hcaptcha({
      sitekey,
      pageurl: page.url(),
      invisible: true,
    });

    if (!token) {
      console.error("[hCaptcha] ERROR: No token received from 2Captcha");
      throw new Error("No captcha token returned");
    }
    console.log("[hCaptcha] Successfully received token:", token);

    // 2. Inject into response fields
    console.log(
      "[hCaptcha] Attempting to inject token into response fields..."
    );
    const injectionResult = await page.evaluate((token) => {
      console.log("[hCaptcha] Searching for response fields in DOM...");
      const fields = [
        ...document.querySelectorAll(
          'textarea[name="h-captcha-response"], ' +
            'textarea[name="g-recaptcha-response"]'
        ),
      ];

      console.log(`[hCaptcha] Found ${fields.length} response fields`);

      fields.forEach((field, index) => {
        console.log(`[hCaptcha] Field ${index + 1}:`, {
          name: field.name,
          currentValue: field.value,
          willSet: token,
        });
        field.value = token;

        ["input", "change", "blur"].forEach((eventType) => {
          console.log(
            `[hCaptcha] Dispatching ${eventType} event to field ${index + 1}`
          );
          field.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
      });

      if (fields.length === 0) {
        console.log(
          "[hCaptcha] No existing fields found, creating fallback field"
        );
        const newField = document.createElement("textarea");
        newField.name = "h-captcha-response";
        newField.style.display = "none";
        newField.value = token;
        document.body.appendChild(newField);
        return { createdFallback: true };
      }

      return { fieldsUpdated: fields.length };
    }, token);

    // NEW: Add verification right here
    const fieldExists = await page.evaluate(() => {
      return !!document.querySelector('[name="h-captcha-response"]');
    });
    console.log("h-captcha-response field exists:", fieldExists);

    console.log("[hCaptcha] Injection result:", injectionResult);

    // 3. Trigger verification
    console.log("[hCaptcha] Attempting to trigger hCaptcha verification...");
    const verificationResult = await page.evaluate(() => {
      if (typeof hcaptcha !== "undefined") {
        console.log("[hCaptcha] hCaptcha API detected");
        const widgets = hcaptcha.getWidgets();
        console.log(`[hCaptcha] Found ${widgets.length} hCaptcha widgets`);

        widgets.forEach((widget, index) => {
          console.log(
            `[hCaptcha] Submitting widget ${index + 1} (ID: ${widget.id})`
          );
          hcaptcha.submit(widget.id);
        });
        return { widgetsTriggered: widgets.length };
      }
      console.log("[hCaptcha] No hCaptcha API detected");
      return { widgetsTriggered: 0 };
    });

    console.log("[hCaptcha] Verification result:", verificationResult);

    // 4. Verify token was accepted
    console.log("[hCaptcha] Verifying token acceptance...");
    const verificationStatus = await page.evaluate(() => {
      const field = document.querySelector('[name="h-captcha-response"]');
      if (!field) {
        console.log("[hCaptcha] No h-captcha-response field found");
        return { verified: false, reason: "field_missing" };
      }

      if (!field.value) {
        console.log("[hCaptcha] h-captcha-response field is empty");
        return { verified: false, reason: "empty_field" };
      }

      const successIndicator = document.querySelector(
        ".h-captcha-success, .captcha-success"
      );
      if (successIndicator) {
        console.log("[hCaptcha] Found visual success indicator");
        return { verified: true, reason: "visual_indicator" };
      }

      console.log("[hCaptcha] Token present but no visual confirmation");
      return { verified: true, reason: "token_present" };
    });

    console.log("[hCaptcha] Verification status:", verificationStatus);

    if (!verificationStatus.verified) {
      console.warn(
        "[hCaptcha] WARNING: Token verification failed. Reason:",
        verificationStatus.reason
      );
    } else {
      console.log("[hCaptcha] Token successfully verified");
    }

    console.log("[hCaptcha] Process completed successfully");

    // *************************************************************************************

    console.log("Completed captcha! Clicking Complete...");
    // await page.pause();

    await completeAndPayButton.click();
    console.log("Clicked Complete and Pay Btn...");

    await page.waitForTimeout(12000);

    // await page.pause();

    const flashErrorMessageContainer = await tourBookingFrameHandler.locator(
      "[data-test-id='test-flash-message-indicator']"
    );

    await expect(flashErrorMessageContainer).toBeVisible({ timeout: 5000 });
    const isPaymentMessageDivVisible =
      await flashErrorMessageContainer.isVisible();
    console.log("Payment message container:", isPaymentMessageDivVisible);

    if (isPaymentMessageDivVisible) {
      const messageText = await flashErrorMessageContainer.textContent();
      const trimmedMessage = messageText?.trim() || "";

      console.log("Payment Message:", trimmedMessage);

      if (trimmedMessage.includes("Your card was declined")) {
        throw new Error("Payment failed: Card was declined.");
      } else if (
        trimmedMessage.includes(
          "We are unable to authenticate your payment method. Please choose a different payment method and try again."
        )
      ) {
        throw new Error("Payment failed: Some other error occurred.");
      } else if (
        trimmedMessage.includes(
          "An error occurred while processing your payment."
        )
      ) {
        throw new Error("Payment not completed: Some other error occurred.");
      } else if (
        trimmedMessage.includes("Something went wrong. Please try again later.")
      ) {
        console.log("Something went wrong. Please try again later.");
        throw new Error("Something went wrong. Please try again later.");
      } else {
        console.log("Payment message:", trimmedMessage);
        throw new Error("Payment not completed");
      }
    } else {
      console.log("Payment message error div is not visible.");
    }

    await page.waitForTimeout(12000);

    // await page.pause();
    const thankYouMsg = await frameHandle
      .getByText("Thank you for your purchase!")
      .first();
    await expect(thankYouMsg).toBeVisible({ timeout: 120000 });

    const successDir = path.join(__dirname, "successful-orders-screenshots");
    if (!fs.existsSync(successDir)) {
      await fs.promises.mkdir(successDir);
    }
    const screenshotFileName = bookingData.id + "-order-sucess.png";
    const screenshotPath = path.join(successDir, screenshotFileName);
    await page.screenshot({ fullPage: true, path: screenshotPath });

    await sendEmail(
      bookingData.id, // order number
      `Try ${tries + 1}. The final screen snip is attached for your reference.`, // order description
      "farhan.qat123@gmail.com", // recipient email address
      ['mymtvrs@gmail.com'], // CC email(s), can be a single email or comma-separated multiple mails
      // [],
      screenshotPath, // path to the screenshot
      screenshotFileName,
      true,
      "FortSumterTicketing"
    );

    // await page.pause();
    const isServiceChargesDeducted = await ServiceCharges(bookingData.bookingServiceCharges, bookingData.id, bookingData.card.number, bookingData.card.expiration, bookingData.card.cvc, bookingData.billing?.postcode, bookingData.billing?.email, "FortSumterTicketing");
    if (isServiceChargesDeducted) {
        // ORDERS STATUS API PARAM OPTIONS
        // auto-draft, pending, processing, on-hold, completed, cancelled, refunded, failed, and checkout-draft
        const updatedOrder = await updateOrderStatus("FortSumterTicketing", bookingData.id, "completed");
        console.log(`Order#${bookingData?.id} status changed to ${updatedOrder?.status} successfully!`);
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Booking automation error:", error);
    const errorsDir = path.join(__dirname, "errors-screenshots");
    if (!fs.existsSync(errorsDir)) {
      await fs.promises.mkdir(errorsDir);
    }
    const screenshotFileName = bookingData.id + "-error-screenshot.png";
    const screenshotPath = path.join(errorsDir, screenshotFileName);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    try {
      await sendEmail(
        bookingData.id, // order number
        `Try ${
          tries + 1
        }.The final screen snip is attached for your reference. ${
          error.message ? `ERRMSG: ` + error.message : ""
        }`, // order description
        "farhan.qat123@gmail.com", // recipient email address
        ['mymtvrs@gmail.com'], // CC email(s), can be a single email or comma-separated
        // [],
        screenshotPath, // path to the screenshot
        screenshotFileName, // screenshot filename
        false, // Automation Passed Status
        "FortSumterTicketing"
      );
    } catch (err) {
      console.log("Sending mail Error", err);
    }
    // await page.pause();
    return {
      success: false,
      error: error.message,
      errorScreenshot: bookingData.id + "-error-screenshot.png",
    };
  } finally {
    await browser.close();
  }
}

module.exports = { FortSumterTickets };
