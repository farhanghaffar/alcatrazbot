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
  addOrUpdateOrder,
  getRandomDelayWithLimit,
} = require("../../helper");
const { Solver } = require("@2captcha/captcha-solver");
const fs = require("fs");
const path = require("path");
const { ServiceCharges } = require("../service-charges");
const { updateOrderStatus } = require("../wp-update-order-status/automation");
const Order = require("../../api/models/Order");
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

async function NiagaraCruiseTickets(bookingData, tries, payload) {
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

    await addOrUpdateOrder(bookingData, 'NiagaraCruiseTicketing', '/niagara-cruise-tickets-webhook', payload);

    let tourURL = "";

    if (bookingData.tourType === "Niagara City Cruise") {
      tourURL =
        "https://www.cityexperiences.com/niagara-ca/city-cruises/voyage-to-the-falls-boat-tour/";
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

    const checkAvailabilityButton = await page
      .locator('a.ce-book-now-action:has-text("Check Availability")')
      .first();
    await expect(checkAvailabilityButton).toBeVisible({ timeout: 300000 });
    const checkAvailabilityButtonVisible =
      await checkAvailabilityButton.isVisible();
    if (!checkAvailabilityButtonVisible) {
      throw new Error("Check Availability button not found");
    }
    await checkAvailabilityButton.click();
    console.log("Clicked Check Availability, waiting for calendar...");

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

      const randomTimeHere = await getRandomDelayWithLimit(10000);
      await page.waitForTimeout(randomTimeHere);

      const noTicketsAvailableMessage = frameHandle.locator('span').filter({ hasText: 'Tickets are not available for the date you selected. Check out these other dates which are still available:' });
      const isNoTicketsMessageVisible = await noTicketsAvailableMessage.isVisible({timeout: 5000});
      console.log(`Visibility of "no tickets available" message: ${isNoTicketsMessageVisible}`);
      if (isNoTicketsMessageVisible) {
          console.error('Tickets are not available for the selected date. Throwing an error.');
          throw new Error('Tickets are not available for the date you selected.');
      }

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

      
      const randomTimeHere = await getRandomDelayWithLimit(10000);
      await page.waitForTimeout(randomTimeHere);

      const noTicketsAvailableMessage = frameHandle.locator("span").filter({
        hasText:
          "Tickets are not available for the date you selected. Check out these other dates which are still available:",
      });
      const isNoTicketsMessageVisible =
        await noTicketsAvailableMessage.isVisible({
          timeout: 5000,
        });
      console.log(
        `Visibility of "no tickets available" message: ${isNoTicketsMessageVisible}`
      );
      if (isNoTicketsMessageVisible) {
        console.error(
          "Tickets are not available for the selected date. Throwing an error."
        );
        throw new Error("Tickets are not available for the date you selected.");
      }
      
    }
    const showMoreTimesButton = frameHandle
      .getByRole("button")
      .filter({ hasText: "Show more times" })
      .first();
    await page.waitForTimeout(6000);

    randomtime = getRandomTime();
    await page.waitForTimeout(randomtime);

    const isButtonVisible = await showMoreTimesButton.isVisible();
    if (isButtonVisible) {
      console.log("Found Show More Times button, clicking it...");
      await showMoreTimesButton.click();
      console.log("Clicked Show More Times button");
    } else {
      console.log("Show more times button not visible");
    }

    randomtime = getRandomTime();
    await page.waitForTimeout(randomtime);

    // const timeSlotToSelect = '9:20 AM';
    const timeSlotToSelect = addOneHour(bookingData.bookingTime);
    console.log("TimeSlotToSelect:", timeSlotToSelect);

    const timeSlot = frameHandle
      .getByRole("button")
      .filter({ hasText: new RegExp(`^${timeSlotToSelect}\\s*`) })
      .first();

    const adultTicketSelectionDiv = frameHandle
      // .locator(`.ticket-qty-selector-item`)
      .locator(`li[data-bdd="ticket-selection-list-item"]`)
      .filter({
        hasText: "Adult",
        has: frameHandle.locator('button[data-bdd="increment-button"]').first(),
      });
    await expect(adultTicketSelectionDiv.first()).toBeVisible({
      timeout: 80000,
    });

    // await expect(timeSlot).toBeVisible({timeout: 30000});
    const timeSlotExist = await timeSlot.isVisible({ timeout: 30000 });
    if (timeSlotExist) {
      await timeSlot.click();
      console.log("Time slot selected:", timeSlotToSelect);
    }

    const ticketQuantities = {
      _booking_adults: bookingData.adults,
      _booking_children: bookingData.childs,
      _booking_infant_under_two: bookingData.infant_under_two,
    };
    for (const [ticketType, quantity] of Object.entries(ticketQuantities)) {
      if (quantity > 0) {
        console.log(`Incrementing ${ticketType} tickets by ${quantity}`);
        if (ticketType === "_booking_adults") {
          await incrementTickets(frameHandle, "Adult", quantity);
        } else if (ticketType === "_booking_children") {
          await incrementTickets(frameHandle, "Child (3 - 12)", quantity);
        } else if (ticketType === "_booking_infant_under_two") {
          await incrementTickets(frameHandle, "Infant (2 and under)", quantity);
        }
      }
    }

    // await page.pause();

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
        } else if (ticketType === "_booking_infant_under_two") {
          ticketLabel = "Infant (2 and under)";
        } else if (ticketType === "_booking_children") {
          ticketLabel = "Child (3 - 12)";
        }
        await expectedIncrementTickets(frameHandle, ticketLabel, quantity);
      }
    }

    randomtime = getRandomTime();
    await page.waitForTimeout(randomtime);
        await page.waitForTimeout(10000);

    const addToCartBtn = await frameHandle
      .locator(`[data-bdd="add-to-cart-button"]`)
      .getByText("Add to Cart");
    const addToCartBtnVisible = await addToCartBtn.isVisible({
      timeout: 120000,
    });

    randomtime = getRandomTime();
    await page.waitForTimeout(randomtime);

    const checkoutNowBtn = await frameHandle
      .locator('[data-bdd="checkout-now-button"]')
      .filter({ hasText: "Checkout Now" });
    await page.waitForTimeout(5000);
    const checkoutNowBtnVisible = await checkoutNowBtn.isVisible();
    await page.waitForTimeout(6000);
    if (addToCartBtnVisible) {
      await addToCartBtn.click();
      await page.waitForSelector("iframe.zoid-component-frame", {
        timeout: 120000,
      });
      const checkoutPageFrame = await page.frameLocator(
        "iframe.zoid-component-frame"
      );
      const checkoutButton = await checkoutPageFrame
        .getByRole(`button`)
        .filter({ hasText: "Checkout" });
      await expect(checkoutButton).toBeVisible({ timeout: 80000 });
      await checkoutButton.click();
    } else if (checkoutNowBtnVisible) {
      await checkoutNowBtn.click();
    }
    // await expect(page).toHaveURL(/cart/, {timeout: 80000});
    // console.log('Successfully reached cart page');

    await expect(page).toHaveURL(/checkout/, { timeout: 120000 });
    console.log("Successfully reached checkout page");
    const emailInput = await frameHandle.locator('input[name="email"]');
    await expect(emailInput).toBeVisible({ timeout: 120000 });
    await typeWithDelay(emailInput, bookingData.billing.email);
    console.log("Email filled");

    randomtime = getRandomTime();
    await page.waitForTimeout(randomtime);

    const continueButton2 = await frameHandle
      .locator("button")
      .filter({ hasText: "Continue" })
      .first();
    await expect(continueButton2).toBeVisible({ timeout: 80000 });
    await continueButton2.click();
    console.log("Clicked Continue");

    await page.waitForTimeout(3000);

    const ticketAssuranceSectionHeading = await frameHandle.locator(
      '//h6/span[normalize-space()="Ticket Assurance (Recommended)"]'
    );
    await expect(ticketAssuranceSectionHeading).toBeVisible({ timeout: 3000 });

    const ticketAssuranceSectionNoOption = await frameHandle.locator(
      '[data-bdd="insurance-no-radio"]'
    );
    await expect(ticketAssuranceSectionNoOption).toBeVisible({ timeout: 5000 });
    await ticketAssuranceSectionNoOption.click();

    const attendeesNames = bookingData.personNames;
    const attendeesNamesInputs = await frameHandle.locator(
      '[autocomplete="name"]'
    );
    const attendeesNamesInputsCount = await attendeesNamesInputs.count();
    console.log("Attendees Inputs Count", attendeesNamesInputsCount);

    if (attendeesNamesInputsCount > 0) {
      for (let i = 0; i < attendeesNamesInputsCount; i++) {
        const element = await attendeesNamesInputs.nth(i);
        await expect(element).toBeVisible();
        await typeWithDelay(element, attendeesNames[i]);
        console.log(`Attendee name ${i + 1} filled`);
      }

      const continue3 = await frameHandle
        .locator("button:not(disabled)")
        .filter({ hasText: "Continue" });
      await continue3.first().click();
    }

    const firstNameInput = await frameHandle.locator('input[name="firstName"]');
    await expect(firstNameInput).toBeVisible({ timeout: 80000 });
    await typeWithDelay(firstNameInput, bookingData.billing.first_name);

    const lastNameInput = await frameHandle.locator('input[name="lastName"]');
    await expect(lastNameInput).toBeVisible({ timeout: 80000 });
    await typeWithDelay(lastNameInput, bookingData.billing.last_name);

    const country = bookingData.billing.country;

    const phoneInput = await frameHandle.locator('input[name="phone"]');
    await expect(phoneInput).toBeVisible({ timeout: 80000 });
    const phoneNumber =
      "345" + String(Math.floor(Math.random() * 10000000)).padStart(7, "0");
    console.log("Phone Number being entered :", phoneNumber);
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

    const state = bookingData.billing.state;
    const stateSelectElement = await frameHandle.locator(
      'select[name="state"]'
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

    // await page.pause();
    const postalCodeInput = await frameHandle.locator(
      'input[name="postalCode"]'
    );
    await expect(postalCodeInput).toBeVisible({ timeout: 80000 });
    // await postalCodeInput.fill(bookingData.billing.postcode);
    let postcodeeValue = bookingData.billing.postcode;
    if (!postcodeeValue && bookingData.billing.country === "AE") {
      postcodeeValue = "1224";
    }
    await postalCodeInput.fill(postcodeeValue);

    console.log("Successfully Filled Booking details");

    // await page.pause();

    const TNCRadioElement = frameHandle.locator("#checkoutTermsAndConditions");
    const TNCExist = await TNCRadioElement.isVisible();
    if (TNCExist) {
      await TNCRadioElement.click();
    }

    const payInCADbutton = await frameHandle.locator(
      "button[data-bdd='pay-in-CAD-button']"
    );

    const payInUSDbutton = await frameHandle.locator(
      "button[data-bdd='pay-in-USD-button']"
    );

    await expect(payInCADbutton).toBeEnabled({ setTimeout: 5000 });

    console.log("Clicking Pay in CAD button...");

    await payInCADbutton.click();

    const processingPaymentCheckbox = await frameHandle
      .locator("#step-for-stage-processingPayment")
      .locator('input[type="checkbox"]');
    const processingPaymentCheckboxVisible =
      await processingPaymentCheckbox.isVisible();
    if (processingPaymentCheckboxVisible) {
      const checked = await processingPaymentCheckbox.isChecked();
      if (!checked) {
        await processingPaymentCheckbox.click();
      }
    }
    // await frameHandle.getByRole('heading', { name: 'Debit/Credit Card' }).click();

    // const {cardMonth, cardYear} = formatCardDate(bookingData.card.expiration);
    console.log("Zipcode value:", postcodeeValue);

    const cardInfo = {
      cardName:
        bookingData.billing.first_name + " " + bookingData.billing.last_name,
      // cardZip: bookingData.billing.postcode,
      cardZip:
        bookingData.billing.postcode ||
        (bookingData.billing.country === "AE" ? postcodeeValue : ""),
      cardNumber: bookingData.card.number,
      cardType: getCardType(bookingData.card.number),
      cardCVC: bookingData.card.cvc,
      cardMonth: cardMonth,
      cardYear: cardYear,
    };

    const nestedIframe = frameHandle.frameLocator(
      'iframe[name="chaseHostedPayment"]'
    );

    // const cardNameInput = nestedIframe.locator('.creNameField');
    // await expect(cardNameInput).toBeVisible({timeout: 30000});
    // await page.waitForTimeout(2500);
    // await cardNameInput.clear()
    // await page.waitForTimeout(1000);
    // await typeWithDelay(cardNameInput, cardInfo.cardName);

    // Card Zip
    const cardZipInput = nestedIframe.locator(".creZipField");
    const isCardZipCodeInputVisible = await cardZipInput.isVisible();
    if (isCardZipCodeInputVisible) {
    // await expect(cardZipInput).toBeVisible({ timeout: 30000 });
    await typeWithDelay(cardZipInput, cardInfo.cardZip);
    } else {
      console.log('Card Zipcode field not visible');
    }

    // Card Number
    const cardNumberInput = nestedIframe.locator("#ccNumber, .creNumberField");
    await expect(cardNumberInput).toBeVisible({ timeout: 30000 });
    await typeWithDelay(cardNumberInput, removeSpaces(cardInfo.cardNumber));

    // Card CVC
    const cardCVCInput = nestedIframe.locator("#CVV2, .creCVV2Field");
    await expect(cardCVCInput).toBeVisible({ timeout: 30000 });
    await typeWithDelay(cardCVCInput, cardInfo.cardCVC);

    const cardTypeInput = nestedIframe.locator("#ccType");
    await expect(cardTypeInput).toBeVisible({ timeout: 30000 });
    await cardTypeInput.selectOption(cardInfo.cardType);

    const cardExpMonth = nestedIframe.locator("#expMonth");
    await expect(cardExpMonth).toBeVisible({ timeout: 30000 });
    await cardExpMonth.selectOption(cardInfo.cardMonth);

    const cardExpYear = nestedIframe.locator("#expYear");
    await expect(cardExpYear).toBeVisible({ timeout: 30000 });
    await cardExpYear.selectOption(cardInfo.cardYear);

    console.log("Card payment information filled");

    await page.waitForTimeout(5000);
    const captchaFrame = nestedIframe.frameLocator("#mtcaptcha-iframe-1");
    const captchaImg = captchaFrame.locator('img[aria-label="captcha image."]');
    const captchaCardImgContainer = captchaFrame.locator("#mtcap-card-1");

    const isCaptchaVisible = await captchaImg.isVisible();
    const isCaptchaCardVisible = await captchaCardImgContainer.isVisible();
    console.log("isCaptchaCardVisible:", isCaptchaCardVisible);
    console.log("isCaptchaVisible:", isCaptchaVisible);

    if (isCaptchaCardVisible) {
      let imgSrc = await captchaImg.getAttribute("src");

      const captchaInput = await captchaFrame.locator(
        'input[placeholder="Enter text from image"]'
      );

      let captchaResult = await solver.imageCaptcha({
        body: imgSrc,
      });

      console.log(captchaResult);
      await typeWithDelay(captchaInput, captchaResult.data);
      await cardCVCInput.click();

      const captchaVerifiedMsg = captchaFrame
        .getByRole("paragraph")
        .filter({ hasText: "Verified Successfully" });
      await page.waitForTimeout(3000);
      let captchaVerified = await captchaVerifiedMsg.isVisible();
      if (!captchaVerified) {
        console.log("Captcha try #2");
        await captchaInput.clear();
        imgSrc = await captchaImg.getAttribute("src");
        captchaResult = await solver.imageCaptcha({
          body: imgSrc,
        });

        console.log(captchaResult);
        await typeWithDelay(captchaInput, captchaResult.data);
        await cardCVCInput.click();
        await page.waitForTimeout(3000);
        captchaVerified = await captchaVerifiedMsg.isVisible();
        if (!captchaVerified) {
          console.log("Captcha try #3");
          await captchaInput.clear();
          imgSrc = await captchaImg.getAttribute("src");
          captchaResult = await solver.imageCaptcha({
            body: imgSrc,
          });

          console.log(captchaResult);
          await typeWithDelay(captchaInput, captchaResult.data);
          await cardCVCInput.click();
        }
      }
      await expect(captchaVerifiedMsg).toBeVisible({ timeout: 60000 });
      console.log("Captcha Verified");
    } else {
      console.log("Captcha is not visible!");
      console.log("Skipped captcha! Clicking Complete...");
    }

    // await page.pause();
    await page.waitForTimeout(5000);

    const completeBtn = await nestedIframe
      .getByRole("button")
      .filter({ hasText: "Complete" });
    await expect(completeBtn).toBeVisible();
    await completeBtn.click();
    console.log("Clicked Complete Button");

    await page.waitForTimeout(12000);
    const errorMsg = await frameHandle.getByText('Oops... something went wrong').first();
    const errorMsgVisible = await errorMsg.isVisible()

    const paymentError = await frameHandle.getByText('An error occurred while processing your payment.').first();
    const paymentErrorVisible = await paymentError.isVisible();

    const paymentDeclinedError = await frameHandle.getByText('Unfortunately the payment was declined.').first();
    const paymentDeclinedErrorVisible = await paymentDeclinedError.isVisible();

    const creditFloorError = await frameHandle.getByText('error:a0:89:Credit Floor.').first();
    const creditFloorErrorVisible = await creditFloorError.isVisible();

    const creditCardNumberError = await frameHandle.getByText('Credit card number you entered is invalid.').first();
    const creditCardNumberErrorVisible = await creditCardNumberError.isVisible();

    const orderRejectedError = await frameHandle.getByText('REJECTED').first();
    const orderRejectedErrorVisible = await orderRejectedError.isVisible();

    if((errorMsgVisible && paymentErrorVisible) || (errorMsgVisible && paymentDeclinedErrorVisible) || (errorMsgVisible && creditFloorErrorVisible) || (errorMsgVisible && creditCardNumberErrorVisible)) {
        throw new Error('Payment not completed');
    }

    if(errorMsgVisible && orderRejectedErrorVisible) {
        throw new Error('Order Rejected');
    }

    await page.waitForTimeout(12000);
    // await page.pause();
    const thankYouMsg = await frameHandle
      .getByText("Thank you for your purchase!")
      .first();
    await expect(thankYouMsg).toBeVisible({ timeout: 120000 });

    try{
      await Order.findOneAndUpdate(
          { orderId: bookingData.id, websiteName: 'NiagaraCruiseTicketing' },  // Match by both orderId and websiteName
          { status: 'Passed', failureReason: null },  // Update the status field to 'Failed'
          { new: true }  // Return the updated document
        );
    } catch (err) {
      console.error("Error updating order status:", err);
    }

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
      ["tickets@niagaracruisetickets.com"], // CC email(s), can be a single email or comma-separated multiple mails
      // [],
      screenshotPath, // path to the screenshot
      screenshotFileName,
      true,
      "NiagaraCruiseTicketing"
    );

    // await page.pause();
    const ServiceChargesAmount = parseFloat(bookingData.bookingServiceCharges.replace("CA$", ""));
    const isServiceChargesDeducted = await ServiceCharges(
      `${ServiceChargesAmount}`,
      bookingData.id,
      bookingData.card.number,
      bookingData.card.expiration,
      bookingData.card.cvc,
      bookingData.billing?.postcode,
      bookingData.billing?.email,
      "NiagaraCruiseTicketing",
      "CAD"
    );
    if (isServiceChargesDeducted) {
      // ORDERS STATUS API PARAM OPTIONS
      // auto-draft, pending, processing, on-hold, completed, cancelled, refunded, failed, and checkout-draft
      const updatedOrder = await updateOrderStatus(
        "NiagaraCruiseTicketing",
        bookingData.id,
        "completed"
      );
      console.log(
        `Order#${bookingData?.id} status changed to ${updatedOrder?.status} successfully!`
      );
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Booking automation error:", error);

    try{
      await Order.findOneAndUpdate(
      { orderId: bookingData.id, websiteName: 'NiagaraCruiseTicketing' },  // Match by both orderId and websiteName
      { status: 'Failed', failureReason: error?.message || error },  // Update the status field to 'Failed'
      { new: true }  // Return the updated document
    );
    } catch (err) {
      console.error("Error updating order status:", err);
    }

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
        ["tickets@niagaracruisetickets.com"], // CC email(s), can be a single email or comma-separated
        // [],
        screenshotPath, // path to the screenshot
        screenshotFileName, // screenshot filename
        false, // Automation Passed Status
        "NiagaraCruiseTicketing"
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

module.exports = { NiagaraCruiseTickets };
