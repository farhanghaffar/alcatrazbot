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

async function BayCruiseTickets(bookingData, tries) {
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

    let tourURL = "";

    if (bookingData.tourType === "San Francisco Bay Cruise (60 minutes)") {
      tourURL = "https://www.blueandgoldfleet.com/sf-bay-cruise/";
    } else if (bookingData.tourType === "Escape From The Rock (90 Minutes)") {
      tourURL = "https://www.blueandgoldfleet.com/escape-from-the-rock/";
    }
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

    await page.pause();

    await page.waitForTimeout(10000);
    console.log("Waiting for iframe to load...");
    await page.waitForSelector("iframe.zoid-component-frame.zoid-visible");
    const frameHandle = await page.frameLocator(
      "iframe.zoid-component-frame.zoid-visible"
    );

    console.log("Looking for calendar section inside iframe...");
    await expect(frameHandle.locator(".chooseDate_wrapper")).toBeVisible({
      timeout: 180000,
    });
    console.log("Calendar section is now visible");

    // const dummyDate = '2025-02-21';
    const targetDate = formatDate(bookingData.bookingDate);
    const currentMonth = new Date().toLocaleString("default", {
      month: "long",
    });
    const currentYear = new Date().getFullYear();
    console.log("Current month is:", currentMonth, currentYear);

    const dateObject = new Date(targetDate + "T00:00:00");
    const targetMonth = dateObject.toLocaleString("default", { month: "long" });
    const targetYear = dateObject.getFullYear();
    console.log("Before taget day: ", targetDate);
    const targetDay = dateObject.getDate();
    console.log("After target date: ", targetDay);
    console.log("Target date is:", targetMonth, targetYear, targetDay);

    if (targetMonth === currentMonth && targetYear === currentYear) {
      console.log("Same month and year, proceeding with date selection");
      const dateCell = frameHandle
        .getByRole("presentation")
        .locator(`.CalendarDay`)
        .filter({ hasText: `${targetDay}` })
        .first();
      const dataCellAttributes = await dateCell.getAttribute("class");
      if (dataCellAttributes.includes("CalendarDay__blocked_calendar")) {
        throw new Error("Date not available");
      }
      // await expect(dataCellAttributes).not.toContain('CalendarDay__blocked_calendar');
      await dateCell.click();

      await expect(dateCell).toBeVisible({ timeout: 5000 });
      console.log(`Successfully selected date ${targetDay}`);
    } else {
      console.log("Different month or year, calculating months to navigate");
      const monthsDiff =
        (targetYear - currentYear) * 12 +
        (dateObject.getMonth() - new Date().getMonth());
      console.log(`Need to move forward ${monthsDiff} months`);

      for (let i = 0; i < monthsDiff; i++) {
        const nextMonthButton = frameHandle
          .getByRole("button", {
            name: "Move forward to switch to the next month.",
          })
          .locator("svg");

        await nextMonthButton.click();
        await page.waitForTimeout(1000);
        console.log(`Moved forward month ${i + 1} of ${monthsDiff}`);

        // Check if the target month is now visible
        const isTargetMonthVisible = await frameHandle
          .locator(".CalendarMonth_caption strong")
          .filter({ hasText: `${targetMonth} ${targetYear}` })
          .isVisible();

        if (isTargetMonthVisible) {
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
      await expect(
        frameHandle
          .locator(".CalendarMonth_caption strong")
          .filter({ hasText: `${targetMonth} ${targetYear}` })
      ).toBeVisible();
      console.log(`Verified calendar shows ${targetMonth} ${targetYear}`);

      await page.waitForTimeout(10000);
      console.log(targetDay, `day to select`);
      const dateCell = frameHandle
        .getByRole("presentation")
        .locator(`.CalendarDay`)
        .filter({ hasText: `${targetDay}` })
        .first();
      await expect(dateCell).toBeVisible();

      const dataCellAttributes = await dateCell.getAttribute("class");
      if (dataCellAttributes.includes("CalendarDay__blocked_calendar")) {
        throw new Error("Date not available");
      }
      await dateCell.click();

      await expect(
        frameHandle
          .getByRole("presentation")
          .locator(`td.CalendarDay__selected:has(span:text("${targetDay}"))`)
      ).toBeVisible();
      console.log(`Successfully selected date ${targetDay}`);
    }
    // const showMoreTimesButton = frameHandle
    //   .getByRole("button")
    //   .filter({ hasText: "Show more times" })
    //   .first();
    // await page.waitForTimeout(6000);

    // randomtime = getRandomTime();
    // await page.waitForTimeout(randomtime);

    // const isButtonVisible = await showMoreTimesButton.isVisible();
    // if (isButtonVisible) {
    //   console.log("Found Show More Times button, clicking it...");
    //   await showMoreTimesButton.click();
    //   console.log("Clicked Show More Times button");
    // } else {
    //   console.log("Show more times button not visible");
    // }

    randomtime = getRandomTime();
    await page.waitForTimeout(randomtime);

    // const timeSlotToSelect = '9:20 AM';
    const timeSlotToSelect = addOneHour(bookingData.bookingTime);
    console.log("timeSlotToSelect:", timeSlotToSelect);

    const timeSlot = frameHandle
      .getByRole("button")
      .filter({ hasText: new RegExp(`^${timeSlotToSelect}\\s*`) })
      .first();

    const adultTicketSelectionDiv = frameHandle
      .locator(`[data-bdd="ticket-selection-list-item"]`)
      .filter({
        hasText: "Adult",
        has: frameHandle.locator('button[data-bdd="increment-button"]').first(),
      });
    await expect(adultTicketSelectionDiv.first()).toBeVisible({
      timeout: 80000,
    });

    const timeSlotExist = await timeSlot.isVisible({ timeout: 30000 });
    if (timeSlotExist) {
      await timeSlot.click();
      console.log("Time slot selected:", timeSlotToSelect);
    }

    const ticketQuantities = {
      _booking_adults: bookingData.adults,
      _booking_children: bookingData.childs,
      _booking_juniors: bookingData.juniors,
      _booking_seniors: bookingData.seniors,
      _booking_military: bookingData.military,
      _booking_child_under_five: bookingData.child_under_five,
    };
    for (const [ticketType, quantity] of Object.entries(ticketQuantities)) {
      if (quantity > 0) {
        console.log(`Incrementing ${ticketType} tickets by ${quantity}`);
        if (ticketType === "_booking_adults") {
          await incrementTickets(frameHandle, "Adult", quantity);
        } else if (ticketType === "_booking_children") {
          await incrementTickets(frameHandle, "Child", quantity);
        } else if (ticketType === "_booking_juniors") {
          await incrementTickets(frameHandle, "Junior", quantity);
        } else if (ticketType === "_booking_seniors") {
          await incrementTickets(frameHandle, "Senior (Ages 65+)", quantity);
        } else if (ticketType === "_booking_military") {
          await incrementTickets(frameHandle, "Military", quantity);
        } else if (ticketType === "_booking_child_under_five") {
          await incrementTickets(frameHandle, "Child (Under 5)", quantity);
        }
      }
    }

    randomtime = getRandomTime();
    await page.waitForTimeout(randomtime);

    const continueButton = frameHandle.getByRole("button", {
      name: "Continue",
    });
    const buyNowBtn = await frameHandle.getByRole("button", {
      name: "Buy Now",
    });
    const checkOutNowBtn0 = await frameHandle.getByRole("button", {
      name: "Checkout Now",
    });
    const continueButtonVisible = await continueButton.isVisible();
    const buyNowBtnVisible = await buyNowBtn.isVisible();
    if (continueButtonVisible) {
      await continueButton.click();
    } else if (buyNowBtnVisible) {
      await buyNowBtn.click();
    } else {
      await checkOutNowBtn0.click();
    }

    console.log("Clicked Continue button");

    for (const [ticketType, quantity] of Object.entries(ticketQuantities)) {
      if (quantity > 0) {
        let ticketLabel;
        if (ticketType === "_booking_adults") {
          ticketLabel = "Adult";
        } else if (ticketType === "_booking_children") {
          ticketLabel = "Child";
        } else if (ticketType === "_booking_juniors") {
          ticketLabel = "Junior";
        } else if (ticketType === "_booking_seniors") {
          ticketLabel = "Senior";
        } else if (ticketType === "_booking_military") {
          ticketLabel = "Military";
        } else if (ticketType === "_booking_child_under_five") {
          ticketLabel = "Child (Under 5)";
        }

        await expectedIncrementTickets(frameHandle, ticketLabel, quantity);
      }
    }

    await expect(page).toHaveURL(/checkout/, { timeout: 120000 });
    console.log("Successfully reached checkout page");

    const firstNameInput = await frameHandle.locator('input[name="firstName"]');
    await expect(firstNameInput).toBeVisible({ timeout: 80000 });
    // await firstNameInput.fill(bookingData.billing.first_name);
    await typeWithDelay(firstNameInput, bookingData.billing.first_name);

    const lastNameInput = await frameHandle.locator('input[name="lastName"]');
    await expect(lastNameInput).toBeVisible({ timeout: 80000 });
    // await lastNameInput.fill(bookingData.billing.last_name);
    await typeWithDelay(lastNameInput, bookingData.billing.last_name);

    const emailInput = await frameHandle.locator('input[name="email"]');
    await expect(emailInput).toBeVisible({ timeout: 80000 });
    // await emailInput.fill(bookingData.billing.email);
    await typeWithDelay(emailInput, bookingData.billing.email);

    const country = bookingData.billing.country;

    const phoneInput = await frameHandle.locator('input[name="phone"]');
    await expect(phoneInput).toBeVisible({ timeout: 80000 });
    // await phoneInput.fill(bookingData.billing.phone);
    const phoneNumber =
      "345" + String(Math.floor(Math.random() * 10000000)).padStart(7, "0");
    console.log("Phone Number being entered :", phoneNumber);
    // await phoneInput.fill(phoneNumber);
    await typeWithDelay(phoneInput, phoneNumber);

    const countrySelectElement = await frameHandle.locator(
      'select[name="country"]'
    );
    await expect(countrySelectElement).toBeVisible({ timeout: 80000 });
    if (bookingData.billing.country.length === 2) {
      await countrySelectElement.selectOption(
        bookingData.billing.country.toUpperCase()
      );
      const countrySelectElementValue = await countrySelectElement.inputValue();
      await expect(countrySelectElementValue).toBe(
        bookingData.billing.country.toUpperCase()
      );
    } else {
      const countryValue = toTitleCase(bookingData.billing.country);
      await countrySelectElement.selectOption(countryValue);
    }

    // await page.pause();
    const addressInput = await frameHandle.locator('input[name="address"]');
    await expect(addressInput).toBeVisible({ timeout: 80000 });
    await addressInput.fill(
      bookingData.billing.address_2 + bookingData.billing.address_1
    );

    const cityInput = await frameHandle.locator('input[name="city"]');
    await expect(cityInput).toBeVisible({ timeout: 80000 });
    await cityInput.fill(bookingData.billing.city);

    // await page.pause();
    const postalCodeInput = await frameHandle.locator(
      'input[name="postalCode"]'
    );
    await expect(postalCodeInput).toBeVisible({ timeout: 80000 });
    let postcodeeValue = bookingData.billing.postcode;
    if (!postcodeeValue && bookingData.billing.country === "AE") {
      postcodeeValue = "1224";
    }
    await postalCodeInput.fill(postcodeeValue);

    const state = bookingData.billing.state;
    console.log("State Value:", state);

    const stateSelectElement = await frameHandle.locator(
      '[data-bdd="state-input"] select'
    );
    const stateVisible = await stateSelectElement.isVisible();
    if (stateVisible) {
      if (state.length === 2 || state.length === 3) {
        await stateSelectElement.selectOption(state.toUpperCase());
        const stateSelectElementValue = await stateSelectElement.inputValue();
        await expect(stateSelectElementValue).toBe(state.toUpperCase());
      } else {
        const stateValue = toTitleCase(state);
        await stateSelectElement.selectOption(stateValue);
      }
    }

    const billingInfoContinueButton = await frameHandle
      .locator("button:not(disabled)")
      .filter({ hasText: "CONTINUE" })
      .first();

    await expect(billingInfoContinueButton).toBeVisible({ timeout: 80000 });

    await billingInfoContinueButton.click();
    console.log("Clicked billing info Continue");

    const ticketAssuranceSectionHeading = await frameHandle.locator(
      '[data-bdd="ticketInsurance"]'
    );
    await expect(ticketAssuranceSectionHeading).toBeVisible({ timeout: 3000 });

    const ticketAssuranceSectionNoOption = await frameHandle.locator(
      '[data-bdd="insurance-no-radio"]'
    );
    await expect(ticketAssuranceSectionNoOption).toBeVisible({ timeout: 5000 });
    await ticketAssuranceSectionNoOption.click();

    const ticketAssurancePayNowButton = await frameHandle.locator(
      '[data-bdd="pay-in-USD-button"]'
    );

    await expect(ticketAssurancePayNowButton).toBeVisible({ timeout: 80000 });
    await expect(ticketAssurancePayNowButton).not.toBeDisabled();
    await ticketAssurancePayNowButton.click();

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

    const nestedIframe = frameHandle.frameLocator(
      'iframe[name="chaseHostedPayment"]'
    );

    // STRIPE Payment Form section
    const securePaymentFormContainerIframe = nestedIframe.frameLocator(
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

    const saveInfoCheckboxInput = await nestedIframe.locator(
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

    const payNowToCompleteOrderButton = await nestedIframe.locator(
      'button[id="submit"]'
    );

    await expect(payNowToCompleteOrderButton).toBeVisible({ timeout: 80000 });

    await page.pause();
    console.log("Skipped captcha! Clicking Complete...");
    await payNowToCompleteOrderButton.click();

    await page.pause();

    await page.waitForTimeout(5000);
    // const captchaFrame = nestedIframe.frameLocator("#mtcaptcha-iframe-1");
    // const captchaImg = captchaFrame.locator('img[aria-label="captcha image."]');

    // const isCaptchaVisible = await captchaImg.isVisible();
    // if (isCaptchaVisible) {
    //   let imgSrc = await captchaImg.getAttribute("src");

    //   const captchaInput = await captchaFrame.locator(
    //     'input[placeholder="Enter text from image"]'
    //   );

    //   let captchaResult = await solver.imageCaptcha({
    //     body: imgSrc,
    //   });

    //   console.log(captchaResult);
    //   await typeWithDelay(captchaInput, captchaResult.data);
    //   await cardCVCInput.click();

    //   const captchaVerifiedMsg = captchaFrame
    //     .getByRole("paragraph")
    //     .filter({ hasText: "Verified Successfully" });
    //   await page.waitForTimeout(3000);
    //   let captchaVerified = await captchaVerifiedMsg.isVisible();
    //   if (!captchaVerified) {
    //     console.log("Captcha try #2");
    //     await captchaInput.clear();
    //     imgSrc = await captchaImg.getAttribute("src");
    //     captchaResult = await solver.imageCaptcha({
    //       body: imgSrc,
    //     });

    //     console.log(captchaResult);
    //     await typeWithDelay(captchaInput, captchaResult.data);
    //     await cardCVCInput.click();
    //     await page.waitForTimeout(3000);
    //     captchaVerified = await captchaVerifiedMsg.isVisible();
    //     if (!captchaVerified) {
    //       console.log("Captcha try #3");
    //       await captchaInput.clear();
    //       imgSrc = await captchaImg.getAttribute("src");
    //       captchaResult = await solver.imageCaptcha({
    //         body: imgSrc,
    //       });

    //       console.log(captchaResult);
    //       await typeWithDelay(captchaInput, captchaResult.data);
    //       await cardCVCInput.click();
    //     }
    //   }
    //   await expect(captchaVerifiedMsg).toBeVisible({ timeout: 60000 });
    //   console.log("Captcha Verified");
    // }

    await page.waitForTimeout(12000);

    const paymentMessageContainer = await frameHandle.locator(
      'div[id="payment-message"]'
    );
    const isPaymentMessageDivVisible =
      await paymentMessageContainer.isVisible();
      console.log("Payment message container:", isPaymentMessageDivVisible);
      await page.pause();

    if (isPaymentMessageDivVisible) {
      const messageText = await paymentMessageContainer.textContent();
      const trimmedMessage = messageText?.trim() || "";

      console.log("Payment Message:", trimmedMessage);
      await page.pause();

      if (trimmedMessage.includes("Your card was declined")) {
        throw new Error("Payment failed: Card was declined.");
      } else if (trimmedMessage.includes("We are unable to authenticate your payment method. Please choose a different payment method and try again.")) {
        throw new Error("Payment failed: Some other error occurred.");
      } else if (trimmedMessage.includes("An error occurred while processing your payment.")) {
        throw new Error("Payment not completed: Some other error occurred.");
      } else {
        console.log("Payment message:", trimmedMessage);
        throw new Error("Payment not completed");
      }
    } else {
      console.log("Payment message error div is not visible.");
    }

    // const errorMsg = await frameHandle.getByText(
    //   "Oops... something went wrong."
    // );
    // const errorMsgVisible = await errorMsg.isVisible();

    // const paymentError = await frameHandle.getByText(
    //   "An error occurred while processing your payment."
    // );
    // const paymentErrorVisible = await paymentError.isVisible();

    // if (errorMsgVisible || paymentErrorVisible) {
    //   throw new Error("Payment not completed");
    // }

    await page.waitForTimeout(12000);

    // await page.pause();
    const thankYouMsg = await frameHandle
      .getByText("Thank you for your purchase!")
      .first();
    await expect(thankYouMsg).toBeVisible({ timeout: 120000 });

    const successDir = path.join(__dirname, "successful-orders-screenshots");
    if (!fs.existsSync(successDir)) {
      fs.mkdir(successDir);
    }
    const screenshotFileName = bookingData.id + "-order-sucess.png";
    const screenshotPath = path.join(successDir, screenshotFileName);
    await page.screenshot({ fullPage: true, path: screenshotPath });

    await sendEmail(
      bookingData.id, // order number
      `Try ${tries + 1}. The final screen snip is attached for your reference.`, // order description
      "farhan.qat123@gmail.com", // recipient email address
      // ['mymtvrs@gmail.com'], // CC email(s), can be a single email or comma-separated multiple mails
      [],
      screenshotPath, // path to the screenshot
      screenshotFileName,
      true,
      "ByCruiseTicketing"
    );

    // await page.pause();
    // const isServiceChargesDeducted = await ServiceCharges(bookingData.bookingServiceCharges, bookingData.id, bookingData.card.number, bookingData.card.expiration, bookingData.card.cvc, bookingData.billing?.postcode, bookingData.billing?.email, "BayCruiseTicketing");
    // if (isServiceChargesDeducted) {
    //     // ORDERS STATUS API PARAM OPTIONS
    //     // auto-draft, pending, processing, on-hold, completed, cancelled, refunded, failed, and checkout-draft
    //     const updatedOrder = await updateOrderStatus("BayCruiseTicketing", bookingData.id, "completed");
    //     console.log(`Order#${bookingData.id} status changed to ${updatedOrder.status} successfully!`);
    // }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Booking automation error:", error);
    const errorsDir = path.join(__dirname, "errors-screenshots");
    if (!fs.existsSync(errorsDir)) {
      fs.mkdirSync(errorsDir);
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
        // ['mymtvrs@gmail.com'], // CC email(s), can be a single email or comma-separated
        [],
        screenshotPath, // path to the screenshot
        screenshotFileName, // screenshot filename
        false, // Automation Passed Status
        "ByCruiseTicketing"
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

module.exports = { BayCruiseTickets };
