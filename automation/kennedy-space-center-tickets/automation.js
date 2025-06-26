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

async function KennedySpaceCenterTickets(bookingData, tries) {
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

    console.log("Starting Kennedy Space Center booking automation...");

    let tourURL =
      "https://tickets.kennedyspacecenter.com/webstore/shop/viewitems.aspx?cg=consumer&c=admission";

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

    const admissionPageHeading = await page
      .locator('h1.ng-binding:has-text("ADMISSION")')
      .first();
    await expect(admissionPageHeading).toBeVisible({ timeout: 300000 });
    const isAdmissionHeadingVisible = await admissionPageHeading.isVisible();
    console.log("isAdmissionHeadingVisible:", isAdmissionHeadingVisible);

    const oneDayAdmissionTicketsBtn = await page
      .locator('span.ng-binding:has-text("1-Day Admission Tickets")')
      .first();

    const twoDayAdmissionTicketsBtn = await page
      .locator('span.ng-binding:has-text("2-Day Admission Tickets")')
      .first();

    await expect(oneDayAdmissionTicketsBtn).toBeVisible();
    await expect(twoDayAdmissionTicketsBtn).toBeVisible();

    if (bookingData.tourType === "1-Day Admission") {
      await oneDayAdmissionTicketsBtn.click();

      const oneDayAdmissionTicketWrapper = await page
        .locator("div.subcat__details-wrap")
        .filter({
          hasText:
            "If you only have 1 day to spend at the visitor complex, arrive early and spend a full day exploring the exhibits and attractions included with admission!",
        });
      const isOneDayAdmissionTicketWrapperExpanded =
        await oneDayAdmissionTicketWrapper.isVisible();

      console.log(
        "isOneDayAdmissionTicketWrapperExpanded:",
        isOneDayAdmissionTicketWrapperExpanded
      );

      // Locate the div with the ticket name '1-Day Adult Ticket'
      // const ticketDivLocator = await page.locator('div[ng-repeat="item in subCategory.items"] div .pluName >> text="1-Day Adult Ticket"');
      const adultsTicketSelectorContainerLocator = await page.getByText(
        "1-Day Adult Ticket"
      );
      const isOneDayAdultTicketsSelectorVisible =
        await adultsTicketSelectorContainerLocator.isVisible();
      console.log(
        "isOneDayAdultTicketsSelectorVisible:",
        isOneDayAdultTicketsSelectorVisible
      );

      if (isOneDayAdultTicketsSelectorVisible) {
        const adultTicketQuantityInput = await page.locator(
          "[aria-label='Enter a quantity for  1-Day Adult Ticket ages 12+ ']"
        );
        // const incrementButtonLocator = await page.locator('button[ng-click="inc(true, item)"]');
        const isAdultTicketQuantityInputVisible =
          await adultTicketQuantityInput.isVisible();
        console.log(
          "isIncrementButtonVisible:",
          isAdultTicketQuantityInputVisible
        );
        await adultTicketQuantityInput.fill(`${bookingData.adults}`);
      }

      const childTicketSelectorContainerLocator = await page.getByText(
        "1-Day Child Ticket"
      );
      const isOneDayChildTicketsSelectorVisible =
        await childTicketSelectorContainerLocator.isVisible();
      console.log(
        "isOneDayChildTicketsSelectorVisible:",
        isOneDayChildTicketsSelectorVisible
      );

      if (isOneDayChildTicketsSelectorVisible) {
        const childTicketQuantityInput = await page.locator(
          "[aria-label='Enter a quantity for  1-Day Child Ticket Ages 3-11 ']"
        );
        const isChildTicketQuantityInputVisible =
          await childTicketQuantityInput.isVisible();
        console.log(
          "isChildTicketQuantityInputVisible:",
          isChildTicketQuantityInputVisible
        );
        await childTicketQuantityInput.fill(`${bookingData.childs}`);
      }

      const selectDateTimeButton = await page.locator(
        "#ctl00_ContentPlaceHolder_SalesChannelDetailControl_SalesChannelDetailRepeater_ctl01_2799_EventsHeaderControl_EventsCalendarGroupRepeater_ctl01_CalendarImageButton"
      );
      const isSelectDateTimeButtonVisible =
        await selectDateTimeButton.isVisible();
      if (isSelectDateTimeButtonVisible) {
        await selectDateTimeButton.click();
      }
      // await page.pause();

      // await page.waitForTimeout(10000);

      const dateSelectorCalender = await page.getByRole("dialog");

      await expect(dateSelectorCalender).toBeVisible({ timeout: 30000 });
      console.log("Booking Date Calender is Visible...");

      // const dummyDate = '2025-02-21';
      const targetDate = formatDate(bookingData.bookingDate);
      const currentMonth = new Date().toLocaleString("default", {
        month: "long",
      });
      const currentYear = new Date().getFullYear();
      console.log("Current month is:", currentMonth, currentYear);

      const dateObject = new Date(targetDate + "T00:00:00");
      const targetMonth = dateObject.toLocaleString("default", {
        month: "long",
      });
      const targetYear = dateObject.getFullYear();
      console.log("Before taget day: ", targetDate);
      const targetDay = dateObject.getDate();
      console.log("After target date: ", targetDay);
      console.log("Target date is:", targetMonth, targetYear, targetDay);

      // await page.pause();

      if (targetMonth === currentMonth && targetYear === currentYear) {
        console.log("Same month and year, proceeding with date selection");

        const dateCell = await page.locator(
          `td div.day.available span.date-text >> text=${targetDay}`
        );

        await dateCell.click();

        console.log(`Successfully selected date ${targetDay}`);
      } else {
        console.log("Different month or year, calculating months to navigate");
        const monthsDiff =
          (targetYear - currentYear) * 12 +
          (dateObject.getMonth() - new Date().getMonth());
        console.log(`Need to move forward ${monthsDiff} months`);

        for (let i = 0; i < monthsDiff; i++) {
          const nextMonthButton = await page.locator(
            "[aria-label='Go to next month']"
          );

          await nextMonthButton.click();
          await page.waitForTimeout(1000);
          console.log(`Moved forward month ${i + 1} of ${monthsDiff}`);
        }

        console.log(
          `Target month ${targetMonth} ${targetYear} is visible, stopping navigation`
        );

        console.log("Loop Exited");

        randomtime = getRandomTime();
        await page.waitForTimeout(randomtime);

        console.log(`Verified calendar shows ${targetMonth} ${targetYear}`);

        await page.waitForTimeout(5000);
        console.log(targetDay, `day to select`);

        const dateCell = await page.locator(
          `td div.day.available span.date-text >> text=/^${targetDay}$/`
        );

        await page.waitForTimeout(3000);

        await dateCell.click();

        console.log(`Successfully selected date ${targetDay}`);
      }

      randomtime = getRandomTime();
      await page.waitForTimeout(randomtime);

      const selectedDateWithinCalenderText = await selectDateTimeButton
        .locator("span.ng-binding")
        .textContent();

      // Log or assert the text inside the span
      console.log("Text inside button span:", selectedDateWithinCalenderText);

      // await page.pause();

      // Define the expected text with the dynamic date
      let bookingDATE = bookingData.bookingDate;
      if (bookingDATE.startsWith("0")) {
        bookingDATE = bookingDATE.replace(/^0/, "");
        console.log("Removing leading 0 from the month string...");
        // bookingDATE = bookingDATE.replace(/\/0(\d{1})\//g, '/$1/');
        bookingDATE = bookingDATE.replace(/\/0(\d{1})\//g, "/$1/");
        console.log("Removing leading 0 from the day string...");
      }

      console.log("Cleaned booking date:", bookingDATE);
      const expectedText = `Admission ${bookingDATE}`;

      // Assert that the text matches the expected format
      const isRightDateSelected =
        selectedDateWithinCalenderText.trim() === expectedText;
      console.log("isRightDateSelected:", isRightDateSelected, expectedText);

      const randomTime = await getRandomTime();
      await page.waitForTimeout(randomTime);

      const addToCartButton = await page.locator(
        "#ctl00_ContentPlaceHolder_SalesChannelDetailControl_SalesChannelDetailRepeater_ctl01_2799_AddToCartButton"
      );
      await expect(addToCartButton).toBeVisible({ timeout: 5000 });
      await addToCartButton.click();

      await page.waitForTimeout(5000);
    } else if (bookingData.tourType === "2-Day Admission") {
      await twoDayAdmissionTicketsBtn.click();

      const twoDayAdmissionTicketWrapper = await page
        .locator("div.subcat__details-wrap")
        .filter({
          hasText:
            "Visit for as low as $45 per day! A 2-day visit is recommended to see and experience everything at the visitor complex. Save by purchasing a 2-day admission ticket.",
        });
      const isTwoDayAdmissionTicketWrapperExpanded =
        await twoDayAdmissionTicketWrapper.isVisible();

      console.log(
        "isTwoDayAdmissionTicketWrapperExpanded:",
        isTwoDayAdmissionTicketWrapperExpanded
      );

      // Locate the div with the ticket name '1-Day Adult Ticket'
      // const ticketDivLocator = await page.locator('div[ng-repeat="item in subCategory.items"] div .pluName >> text="1-Day Adult Ticket"');
      const adultsTicketSelectorContainerLocator = await page.getByText(
        "2-Day Adult Ticket"
      );
      const isTwoDayAdultTicketsSelectorVisible =
        await adultsTicketSelectorContainerLocator.isVisible();
      console.log(
        "isTwoDayAdultTicketsSelectorVisible:",
        isTwoDayAdultTicketsSelectorVisible
      );

      if (isTwoDayAdultTicketsSelectorVisible) {
        const adultTicketQuantityInput = await page.locator(
          "[aria-label='Enter a quantity for  2-Day Adult Ticket ages 12+ ']"
        );
        // const incrementButtonLocator = await page.locator('button[ng-click="inc(true, item)"]');
        const isAdultTicketQuantityInputVisible =
          await adultTicketQuantityInput.isVisible();
        console.log(
          "isIncrementButtonVisible:",
          isAdultTicketQuantityInputVisible
        );
        await adultTicketQuantityInput.fill(`${bookingData.adults}`);

        // ***************************** SELECT DATE FOR 2-DAY ADULT TICKETS ************************
        const selectAdultDateTimeButton = await page.locator(
          "#ctl00_ContentPlaceHolder_SalesChannelDetailControl_SalesChannelDetailRepeater_ctl02_2802_SalesChannelDetailPLURepeater_ctl01_CalendarImageButton"
        );
        const isSelectDateTimeButtonVisible =
          await selectAdultDateTimeButton.isVisible();
        if (isSelectDateTimeButtonVisible) {
          console.log("Clicking Select DATE for ADULTs Button.");
          await selectAdultDateTimeButton.click();
          console.log("Clicked Select DATE for ADULTs Button.");
        }
        // await page.pause();

        // await page.waitForTimeout(10000);

        const adultDateSelectorCalender = await page.getByRole("dialog");

        await expect(adultDateSelectorCalender).toBeVisible({ timeout: 30000 });
        console.log("Booking Date Calender is Visible...");

        // const dummyDate = '2025-02-21';
        const targetDate = formatDate(bookingData.bookingDate);
        const currentMonth = new Date().toLocaleString("default", {
          month: "long",
        });
        const currentYear = new Date().getFullYear();
        console.log("Current month is:", currentMonth, currentYear);

        const dateObject = new Date(targetDate + "T00:00:00");
        const targetMonth = dateObject.toLocaleString("default", {
          month: "long",
        });
        const targetYear = dateObject.getFullYear();
        console.log("Before taget day: ", targetDate);
        const targetDay = dateObject.getDate();
        console.log("After target date: ", targetDay);
        console.log("Target date is:", targetMonth, targetYear, targetDay);

        // await page.pause();

        if (targetMonth === currentMonth && targetYear === currentYear) {
          console.log("Same month and year, proceeding with date selection");

          const dateCell = await page.locator(
            `td div.day.available span.date-text >> text=${targetDay}`
          );

          await dateCell.click();

          console.log(
            `Successfully selected date ${targetDay} for 2-Day Adults Tickets!`
          );
        } else {
          console.log(
            "Different month or year, calculating months to navigate"
          );
          const monthsDiff =
            (targetYear - currentYear) * 12 +
            (dateObject.getMonth() - new Date().getMonth());
          console.log(`Need to move forward ${monthsDiff} months`);

          for (let i = 0; i < monthsDiff; i++) {
            const nextMonthButton = await page.locator(
              "[aria-label='Go to next month']"
            );

            await nextMonthButton.click();
            await page.waitForTimeout(1000);
            console.log(`Moved forward month ${i + 1} of ${monthsDiff}`);
          }

          console.log(
            `Target month ${targetMonth} ${targetYear} is visible, stopping navigation`
          );

          console.log("Loop Exited");

          randomtime = getRandomTime();
          await page.waitForTimeout(randomtime);

          console.log(`Verified calendar shows ${targetMonth} ${targetYear}`);

          await page.waitForTimeout(5000);
          console.log(targetDay, `day to select`);

          const dateCell = await page.locator(
            `td div.day.available span.date-text >> text=/^${targetDay}$/`
          );

          await page.waitForTimeout(3000);

          await dateCell.click();

          console.log(`Successfully selected date ${targetDay}`);
        }

        randomtime = getRandomTime();
        await page.waitForTimeout(randomtime);

        // await page.pause();

        const selectedDateWithinCalenderText = await selectAdultDateTimeButton
          .locator("span.ng-binding")
          .textContent();

        // Log or assert the text inside the span
        console.log("Text inside button span:", selectedDateWithinCalenderText);

        // await page.pause();

        // Define the expected text with the dynamic date
        let bookingDATE = bookingData.bookingDate;
        if (bookingDATE.startsWith("0")) {
          bookingDATE = bookingDATE.replace(/^0/, "");
          console.log("Removing leading 0 from the month string...");
          // bookingDATE = bookingDATE.replace(/\/0(\d{1})\//g, '/$1/');
          bookingDATE = bookingDATE.replace(/\/0(\d{1})\//g, "/$1/");
          console.log("Removing leading 0 from the day string...");
        }

        console.log("Cleaned booking date:", bookingDATE);
        // const expectedText = `Admission ${bookingDATE}`;
        const expectedText = `${bookingDATE}`;

        // Assert that the text matches the expected format
        const isRightDateSelected =
          selectedDateWithinCalenderText.trim() === expectedText;
        console.log(
          "isRightDateSelected: Adult Tickets",
          isRightDateSelected,
          expectedText
        );
      }

      const randomTime = await getRandomTime();
      await page.waitForTimeout(randomTime);
      // ***************************** CALENDER DATE SELECTION AND VERIFICATION COMPLETED **************

      const childTicketSelectorContainerLocator = await page.getByText(
        "2-Day Child Ticket"
      );

      // await page.pause();

      const isTwoDayChildTicketsSelectorVisible =
        await childTicketSelectorContainerLocator.isVisible();
      console.log(
        "isTwoDayChildTicketsSelectorVisible:",
        isTwoDayChildTicketsSelectorVisible
      );

      if (isTwoDayChildTicketsSelectorVisible) {
        const childTicketQuantityInput = await page.locator(
          "[aria-label='Enter a quantity for  2-Day Child Ticket Ages 3-11 ']"
        );
        const isChildTicketQuantityInputVisible =
          await childTicketQuantityInput.isVisible();
        console.log(
          "isChildTicketQuantityInputVisible:",
          isChildTicketQuantityInputVisible
        );
        await childTicketQuantityInput.fill(`${bookingData.childs}`);

        // ***************************** SELECT DATE FOR 2-DAY CHILD TICKETS ************************
        const selectChildDateTimeButton = await page.locator(
          "#ctl00_ContentPlaceHolder_SalesChannelDetailControl_SalesChannelDetailRepeater_ctl02_2802_SalesChannelDetailPLURepeater_ctl02_CalendarImageButton"
        );
        const isSelectDateTimeButtonVisible =
          await selectChildDateTimeButton.isVisible();
        if (isSelectDateTimeButtonVisible) {
          console.log("Clicking Select DATE for Child Button.");
          await selectChildDateTimeButton.click();
          console.log("Clicked Select DATE for Child Button.");
        }
        // await page.pause();

        // await page.waitForTimeout(10000);

        const adultDateSelectorCalender = await page.getByRole("dialog");

        await expect(adultDateSelectorCalender).toBeVisible({ timeout: 30000 });
        console.log("Booking Date Calender is Visible...");

        // const dummyDate = '2025-02-21';
        const targetDate = formatDate(bookingData.bookingDate);
        const currentMonth = new Date().toLocaleString("default", {
          month: "long",
        });
        const currentYear = new Date().getFullYear();
        console.log("Current month is:", currentMonth, currentYear);

        const dateObject = new Date(targetDate + "T00:00:00");
        const targetMonth = dateObject.toLocaleString("default", {
          month: "long",
        });
        const targetYear = dateObject.getFullYear();
        console.log("Before taget day: ", targetDate);
        const targetDay = dateObject.getDate();
        console.log("After target date: ", targetDay);
        console.log("Target date is:", targetMonth, targetYear, targetDay);

        // await page.pause();

        if (targetMonth === currentMonth && targetYear === currentYear) {
          console.log("Same month and year, proceeding with date selection");

          const dateCell = await page.locator(
            `td div.day.available span.date-text >> text=${targetDay}`
          );

          await dateCell.click();

          console.log(
            `Successfully selected date ${targetDay} for 2-Day Adults Tickets!`
          );
        } else {
          console.log(
            "Different month or year, calculating months to navigate"
          );
          const monthsDiff =
            (targetYear - currentYear) * 12 +
            (dateObject.getMonth() - new Date().getMonth());
          console.log(`Need to move forward ${monthsDiff} months`);

          for (let i = 0; i < monthsDiff; i++) {
            const nextMonthButton = await page.locator(
              "[aria-label='Go to next month']"
            );

            await nextMonthButton.click();
            await page.waitForTimeout(1000);
            console.log(`Moved forward month ${i + 1} of ${monthsDiff}`);
          }

          console.log(
            `Target month ${targetMonth} ${targetYear} is visible, stopping navigation`
          );

          console.log("Loop Exited");

          randomtime = getRandomTime();
          await page.waitForTimeout(randomtime);

          console.log(`Verified calendar shows ${targetMonth} ${targetYear}`);

          await page.waitForTimeout(5000);
          console.log(targetDay, `day to select`);

          const dateCell = await page.locator(
            `td div.day.available span.date-text >> text=/^${targetDay}$/`
          );

          await page.waitForTimeout(3000);

          await dateCell.click();

          console.log(`Successfully selected date ${targetDay}`);
        }

        randomtime = getRandomTime();
        await page.waitForTimeout(randomtime);

        // await page.pause();

        const selectedDateWithinCalenderText = await selectChildDateTimeButton
          .locator("span.ng-binding")
          .textContent();

        // Log or assert the text inside the span
        console.log("Text inside button span:", selectedDateWithinCalenderText);

        // await page.pause();

        // Define the expected text with the dynamic date
        let bookingDATE = bookingData.bookingDate;
        if (bookingDATE.startsWith("0")) {
          bookingDATE = bookingDATE.replace(/^0/, "");
          console.log("Removing leading 0 from the month string...");
          // bookingDATE = bookingDATE.replace(/\/0(\d{1})\//g, '/$1/');
          bookingDATE = bookingDATE.replace(/\/0(\d{1})\//g, "/$1/");
          console.log("Removing leading 0 from the day string...");
        }

        console.log("Cleaned booking date:", bookingDATE);
        // const expectedText = `Admission ${bookingDATE}`;
        const expectedText = `${bookingDATE}`;

        // Assert that the text matches the expected format
        const isRightDateSelected =
          selectedDateWithinCalenderText.trim() === expectedText;
        console.log(
          "isRightDateSelected: Child Tickets",
          isRightDateSelected,
          expectedText
        );
        // ***************************** CALENDER DATE SELECTION AND VERIFICATION COMPLETED **************

        const randomTime = await getRandomTime();
        await page.waitForTimeout(randomTime);

        const addToCartButton = await page.locator(
          "#ctl00_ContentPlaceHolder_SalesChannelDetailControl_SalesChannelDetailRepeater_ctl02_2802_AddToCartButton"
        );
        await expect(addToCartButton).toBeVisible({ timeout: 5000 });
        await addToCartButton.click();

        await page.waitForTimeout(5000);
      }

      // await page.pause();
    }

    console.log("Waiting for URL to match the pattern containing 'AddOns'...");
    // Wait for the URL to match the pattern that includes "AddOns"
    await page.waitForURL("**/AddOns*");

    const currentURL = page.url();

    console.log("Current URL after navigation:", currentURL);

    // Assert the URL contains the expected part
    const expectedPart = "AddOns";
    const isNavigatedToAddOns = currentURL.includes(expectedPart);

    // Log the result
    console.log("Navigation to AddOns screen:", isNavigatedToAddOns);

    await expect(isNavigatedToAddOns).toBe(true);

    console.log("Checking if 'ENHANCE YOUR EXPERIENCE' heading is visible...");
    const addOnsPageHeading = await page.getByText("ENHANCE YOUR EXPERIENCE");
    console.log("Checking if the 'Decline' button is visible...");
    await expect(addOnsPageHeading).toBeVisible({ timeout: 20000 });

    const adOnsDeclineButton = await page.locator(
      "[data-decline='data-decline']"
    );
    await expect(adOnsDeclineButton).toBeVisible({ timeout: 5000 });

    console.log("Clicking the 'Decline' button...");
    await adOnsDeclineButton.click();
    console.log("Successfully clicked the 'Decline' button.");

    /* View Cart & Checkout Page */
    console.log(
      "Waiting for URL to match the pattern containing 'viewcart'..."
    );
    await page.waitForURL("**/viewcart*");
    await page.waitForTimeout(2000);

    const currentUrlOnViewCartPage = page.url();

    console.log("Current URL on the View Cart page:", currentUrlOnViewCartPage);

    // Assert the URL contains the expected part
    const expectedPartOnViewCartPage = "viewcart";
    const isNavigatedToViewCart = currentUrlOnViewCartPage.includes(
      expectedPartOnViewCartPage
    );

    console.log("Navigation to View Cart screen:", isNavigatedToViewCart);

    await expect(isNavigatedToAddOns).toBe(true);

    console.log("Checking if 'Shopping Cart' heading is visible...");
    const viewCartPageHeading = await page.getByText("Shopping Cart");
    await expect(viewCartPageHeading).toBeVisible({ timeout: 20000 });

    console.log("Checking if the 'Checkout' button is visible...");
    const viewCartCheckoutButton = await page.locator("[value='Checkout']");
    await expect(viewCartCheckoutButton).toBeVisible({ timeout: 5000 });

    console.log("Clicking the 'Checkout' button...");
    await viewCartCheckoutButton.click();
    console.log("Successfully clicked the 'Checkout' button.");

    /* Checkout Page */
    console.log("Waiting for URL to match the pattern for checkoutPage...");

    await page.waitForURL(
      "https://tickets.kennedyspacecenter.com/WebStore/checkoutPage/"
    );
    await page.waitForTimeout(2000);
    console.log("Reached Checkout Page...");

    // Get the current URL
    const currentUrlOncheckoutPage = page.url();
    console.log("Current URL on Checkout Page:", currentUrlOncheckoutPage);

    // Assert the URL contains the expected part
    const expectedPartOnCheckoutPage = "checkoutPage";
    const isNavigatedToCheckoutPage = currentUrlOncheckoutPage.includes(
      expectedPartOnCheckoutPage
    );

    // Log the result
    console.log(
      "Navigation to checkoutPage screen:",
      isNavigatedToCheckoutPage
    );

    await expect(isNavigatedToCheckoutPage).toBe(true);

    console.log("Checking if 'Checkout' heading is visible...");
    const checkoutPageHeading = await page.locator('h1:has-text("Checkout")');
    await expect(checkoutPageHeading).toBeVisible({ timeout: 20000 });

    console.log(
      "Successfully reached the Checkout Page and confirmed the 'Checkout' heading visibility."
    );

    const deliverySectionHeading = await page.locator(
      'h3:has-text("Delivery Options")'
    );
    await expect(deliverySectionHeading).toBeVisible();
    console.log("Reached delivery Options section.");

    const deliveryOptionSelector = await page.locator("#deliveryMethods");
    await expect(deliveryOptionSelector).toBeVisible({ timeout: 5000 });
    await deliveryOptionSelector.selectOption({ label: "PrintAtHome" });

    console.log("Reached billing contact section.");
    const nameTitleSelector = await page.locator("#Title_BillingContact");
    await expect(nameTitleSelector).toBeVisible({ timeout: 5000 });

    const firstNameInputField = await page
      .locator('[data-firstname="data-firstname"], [aria-label="First Name"]')
      .first();
    await expect(firstNameInputField).toBeVisible({ timeout: 50000 });
    await typeWithDelay(firstNameInputField, bookingData.billing.first_name);

    await page.waitForTimeout(1000);

    const lastNameInputField = await page
      .locator('[data-lastname="data-lastname"], [aria-label="Last Name"]')
      .first();
    await expect(lastNameInputField).toBeVisible({ timeout: 50000 });
    await typeWithDelay(lastNameInputField, bookingData.billing.last_name);

    await page.waitForTimeout(1000);

    // Get the address string
    let validateAddress = bookingData.billing.address_1;

    // Check if the address length exceeds 60 characters
    if (validateAddress.length > 60) {
      // Keep only the last 60 characters
      validateAddress = validateAddress.slice(-60);
      console.log(
        "Address exceeds 60 characters, trimming to last 60 characters:",
        validateAddress
      );
    } else {
      console.log("Address does not exceeding 60 characters.");
      
    }

    const addressStreet1InputField = await page.locator(
      "#Street1_BillingContact"
    );
    await expect(addressStreet1InputField).toBeVisible({ timeout: 50000 });
    await typeWithDelay(
      addressStreet1InputField,
      validateAddress
    );

    const randomDelay = await getRandomTime();
    await page.waitForTimeout(randomDelay);

    const addressStreet2InputField = await page
      .locator('[aria-label="Street 2"], [data-street2="data-street2"]')
      .first();
    await expect(addressStreet2InputField).toBeVisible({ timeout: 50000 });

    if (bookingData.billing.address_2) {
      await typeWithDelay(
        addressStreet2InputField,
        bookingData.billing.address_2
      );
    }

    const delay = await getRandomTime();
    await page.waitForTimeout(delay);

    const addressCityInputField = await page
      .locator('[aria-label="City"], [data-city="data-city"]')
      .first();
    await expect(addressCityInputField).toBeVisible({ timeout: 50000 });
    await typeWithDelay(addressCityInputField, bookingData.billing.city);

    await page.waitForTimeout(3000);

    const addressCountrySelector = await page.locator(
      "#Country_BillingContact"
    );
    await expect(addressCountrySelector).toBeVisible({ timeout: 50000 });
    await addressCountrySelector.selectOption({
      value: `string:${bookingData.billing.country}`,
    });

    await page.waitForTimeout(3500);

    const addressStateSelector = await page.locator("#States_BillingContact");
    await expect(addressStateSelector).toBeVisible({ timeout: 50000 });
    await addressStateSelector.selectOption({
      value: `string:${bookingData.billing.state}`,
    });

    await page.waitForTimeout(2500);

    const addressZipcodeInputField = await page
      .locator('[aria-label="Zip Code"], [data-zipcode="data-zipcode"]')
      .first();
    await expect(addressZipcodeInputField).toBeVisible({ timeout: 50000 });
    await typeWithDelay(addressZipcodeInputField, bookingData.billing.postcode);

    await page.waitForTimeout(1500);

    const addressPhoneNumberInputField = await page
      .locator('[aria-label="Phone Number"], [data-phone="data-phone"]')
      .first();
    await expect(addressPhoneNumberInputField).toBeVisible({ timeout: 50000 });
    await typeWithDelay(
      addressPhoneNumberInputField,
      bookingData.billing.phone
    );

    await page.waitForTimeout(2700);

    const addressEmailInputField = await page
      .locator('[aria-label="Email Address"], [data-email="data-email"]')
      .first();
    await expect(addressEmailInputField).toBeVisible({ timeout: 50000 });
    await typeWithDelay(addressEmailInputField, bookingData.billing.email);

    await page.waitForTimeout(3300);

    const addressConfirmEmailInputField = await page
      .locator(
        '[aria-label="Confirm Email Address"], [data-confirmemail="data-confirmemail"]'
      )
      .first();
    await expect(addressConfirmEmailInputField).toBeVisible({ timeout: 50000 });
    await typeWithDelay(
      addressConfirmEmailInputField,
      bookingData.billing.email
    );

    console.log("Billing Contact section information filled.");

    await page.waitForTimeout(3300);

    const shippingSameAsBillingCheckbox = await page.locator(
      "#shippingSameAsBilling"
    );
    await expect(shippingSameAsBillingCheckbox).toBeVisible({ timeout: 5000 });
    const isShippingSameAsBillingCheckboxChecked =
      await shippingSameAsBillingCheckbox.isChecked();

    if (!isShippingSameAsBillingCheckboxChecked) {
      console.log(
        "shippingSameAsBilling checkbox is not checked, checking it..."
      );
      await shippingSameAsBillingCheckbox.check();
    } else {
      console.log("shippingSameAsBilling checkbox is already checked.");
    }

    await page.waitForTimeout(1500);

    const termsAndConditionsCheckbox = await page.locator(
      "#termsAndConditions"
    );
    await expect(termsAndConditionsCheckbox).toBeVisible({ timeout: 5000 });
    const isTermsAndConditionsCheckboxChecked =
      await termsAndConditionsCheckbox.isChecked();
    console.log(
      "isTermsAndConditionsCheckboxChecked:",
      isTermsAndConditionsCheckboxChecked
    );

    if (!isTermsAndConditionsCheckboxChecked) {
      console.log("termsAndConditions checkbox is not checked, checking it...");
      await page.waitForTimeout(2000);
      await termsAndConditionsCheckbox.check();
    } else {
      console.log("termsAndConditions checkbox is already checked.");
    }

    await page.waitForTimeout(3000);

    const submitOrderButton = await page.locator(
      '#submitOrderButton, [data-submit="data-submit"]'
    );
    await expect(submitOrderButton).toBeVisible({ timeout: 5000 });
    console.log("Clicking the submit Order Button...");
    await submitOrderButton.click();
    console.log("Submit order button clicked successfully.");

    await page.waitForTimeout(5000);

    const orderConfirmationPopupHeading = await page.locator(
      'h2:has-text("Confirm Order")'
    );
    await expect(orderConfirmationPopupHeading).toBeVisible({ timeout: 5000 });
    console.log("Confirm Order heading popup visible");

    const confirmButton = await page.getByRole("button", { name: " Confirm" });
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    console.log("Confirm button on Popup visible.");

    console.log("Clicking the Confirm Button...");
    await confirmButton.click();
    console.log("Confirm button clicked successfully.");

    await page.waitForTimeout(20000);

    /* Checkout Page */
    console.log("Waiting for URL to match the pattern for paymentPage...");

    await page.waitForURL("https://payments.freedompay.com/checkout/payment**");
    await page.waitForTimeout(2000);
    console.log("Reached Payment Page...");

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
    console.log("Card Info:", cardInfo);

    // Get the current URL
    const currentUrlOnPaymentPage = page.url();
    console.log("Current URL on Payment Page:", currentUrlOnPaymentPage);

    // Assert the URL contains the expected part
    const expectedPartOnPaymentPage = "payment";
    const isNavigatedToPaymentPage = currentUrlOnPaymentPage.includes(
      expectedPartOnPaymentPage
    );

    // Log the result
    console.log("Navigation to checkoutPage screen:", isNavigatedToPaymentPage);

    await expect(isNavigatedToPaymentPage).toBe(true);

    console.log(
      "Checking if 'Payment Information' section container is visible..."
    );
    const paymentInfoConatiner = await page.locator("#pnlPayment");
    await expect(paymentInfoConatiner).toBeVisible({ timeout: 5000 });

    const paymentInformationSectionHeading = await page.locator(
      "div.PaymentHeading"
    );
    await expect(paymentInformationSectionHeading).toBeVisible({
      timeout: 2000,
    });

    console.log(
      "Successfully reached the Payment Page and confirmed the 'Payment Information' section header visibility."
    );

    const paymentInfoNameOnCardInput = await page.locator(
      "#CardInformation_NameOnCard"
    );
    await expect(paymentInfoNameOnCardInput).toBeVisible({ timeout: 2000 });

    await page.waitForTimeout(1500);

    const paymentInfoCardNumberInput = await page.locator("#CARDNO");
    await expect(paymentInfoCardNumberInput).toBeVisible({ timeout: 2000 });
    await typeWithDelay(
      paymentInfoCardNumberInput,
      removeSpaces(cardInfo.cardNumber)
    );

    await page.waitForTimeout(1000);

    const paymentInfoCardExpirationMonthInput = await page.locator(
      "#CardInformation_ExpirationMonth"
    );
    await expect(paymentInfoCardExpirationMonthInput).toBeVisible({
      timeout: 2000,
    });
    console.log("CardMoth:", cardInfo.cardMonth);

    await typeWithDelay(
      paymentInfoCardExpirationMonthInput,
      cardInfo.cardMonth
    );

    await page.waitForTimeout(1800);

    const paymentInfoCardExpirationYearInput = await page.locator(
      "#CardInformation_ExpirationYear"
    );
    await expect(paymentInfoCardExpirationYearInput).toBeVisible({
      timeout: 2000,
    });
    const cardYearLastTwoDigits = cardInfo.cardYear.toString().slice(-2);
    console.log("CardYear:", cardYearLastTwoDigits);
    await typeWithDelay(
      paymentInfoCardExpirationYearInput,
      cardYearLastTwoDigits
    );

    await page.waitForTimeout(2000);

    const paymentInfoCardCVVInput = await page.locator("#CardInformation_Cvv");
    await expect(paymentInfoCardCVVInput).toBeVisible({ timeout: 2000 });
    console.log("Card CVV:", cardInfo.cardCVC);

    await typeWithDelay(paymentInfoCardCVVInput, cardInfo.cardCVC);

    await page.waitForTimeout(10000);

    const paymentInfoSubmitButton = await page.locator("#SUBMITBTN");
    await expect(paymentInfoSubmitButton).toBeVisible({ timeout: 2000 });

    console.log("Clicking submit button.");
    await paymentInfoSubmitButton.click();
    console.log("Clicked submit button.");

    // Address cannot exceed 60 characters
    // Address_Street1-error

    const streetAddress1ErrorLocator = await page.locator("Address_Street1-error");
    const isStreetAddress1ErrorVisible = await streetAddress1ErrorLocator.isVisible();
    if (isStreetAddress1ErrorVisible) {
      console.log("isStreetAddress1ErrorVisible:", isStreetAddress1ErrorVisible);
    }

    console.log("");
    // await page.pause();

    await page.waitForTimeout(5000);

    // const sitekey = process.env.BAY_CRUISE_TICKETING_SITE_KEY;

    // *************************************************************************************

    // console.log(
    //   "[hCaptcha] Starting hCaptcha solving process for Stripe payment form"
    // );

    // // 1. Solve the captcha
    // console.log("[hCaptcha] Sending request to 2Captcha service...");

    // const { data: token } = await solver.hcaptcha({
    //   sitekey,
    //   pageurl: page.url(),
    //   invisible: true,
    // });

    // if (!token) {
    //   console.error("[hCaptcha] ERROR: No token received from 2Captcha");
    //   throw new Error("No captcha token returned");
    // }
    // console.log("[hCaptcha] Successfully received token!");

    // // 2. Inject into response fields
    // console.log(
    //   "[hCaptcha] Attempting to inject token into response fields..."
    // );
    // const injectionResult = await page.evaluate((token) => {
    //   console.log("[hCaptcha] Searching for response fields in DOM...");
    //   const fields = [
    //     ...document.querySelectorAll(
    //       'textarea[name="h-captcha-response"], ' +
    //         'textarea[name="g-recaptcha-response"]'
    //     ),
    //   ];

    //   console.log(`[hCaptcha] Found ${fields.length} response fields`);

    //   fields.forEach((field, index) => {
    //     console.log(`[hCaptcha] Field ${index + 1}:`, {
    //       name: field.name,
    //       currentValue: field.value,
    //       willSet: token,
    //     });
    //     field.value = token;

    //     ["input", "change", "blur"].forEach((eventType) => {
    //       console.log(
    //         `[hCaptcha] Dispatching ${eventType} event to field ${index + 1}`
    //       );
    //       field.dispatchEvent(new Event(eventType, { bubbles: true }));
    //     });
    //   });

    //   if (fields.length === 0) {
    //     console.log(
    //       "[hCaptcha] No existing fields found, creating fallback field"
    //     );
    //     const newField = document.createElement("textarea");
    //     newField.name = "h-captcha-response";
    //     newField.style.display = "none";
    //     newField.value = token;
    //     document.body.appendChild(newField);
    //     return { createdFallback: true };
    //   }

    //   return { fieldsUpdated: fields.length };
    // }, token);

    // // NEW: Add verification right here
    // const fieldExists = await page.evaluate(() => {
    //   return !!document.querySelector('[name="h-captcha-response"]');
    // });
    // console.log("h-captcha-response field exists:", fieldExists);

    // console.log("[hCaptcha] Injection result:", injectionResult);

    // // 3. Trigger verification
    // console.log("[hCaptcha] Attempting to trigger hCaptcha verification...");
    // const verificationResult = await page.evaluate(() => {
    //   if (typeof hcaptcha !== "undefined") {
    //     console.log("[hCaptcha] hCaptcha API detected");
    //     const widgets = hcaptcha.getWidgets();
    //     console.log(`[hCaptcha] Found ${widgets.length} hCaptcha widgets`);

    //     widgets.forEach((widget, index) => {
    //       console.log(
    //         `[hCaptcha] Submitting widget ${index + 1} (ID: ${widget.id})`
    //       );
    //       hcaptcha.submit(widget.id);
    //     });
    //     return { widgetsTriggered: widgets.length };
    //   }
    //   console.log("[hCaptcha] No hCaptcha API detected");
    //   return { widgetsTriggered: 0 };
    // });

    // console.log("[hCaptcha] Verification result:", verificationResult);

    // // 4. Verify token was accepted
    // console.log("[hCaptcha] Verifying token acceptance...");
    // const verificationStatus = await page.evaluate(() => {
    //   const field = document.querySelector('[name="h-captcha-response"]');
    //   if (!field) {
    //     console.log("[hCaptcha] No h-captcha-response field found");
    //     return { verified: false, reason: "field_missing" };
    //   }

    //   if (!field.value) {
    //     console.log("[hCaptcha] h-captcha-response field is empty");
    //     return { verified: false, reason: "empty_field" };
    //   }

    //   const successIndicator = document.querySelector(
    //     ".h-captcha-success, .captcha-success"
    //   );
    //   if (successIndicator) {
    //     console.log("[hCaptcha] Found visual success indicator");
    //     return { verified: true, reason: "visual_indicator" };
    //   }

    //   console.log("[hCaptcha] Token present but no visual confirmation");
    //   return { verified: true, reason: "token_present" };
    // });

    // console.log("[hCaptcha] Verification status:", verificationStatus);

    // if (!verificationStatus.verified) {
    //   console.warn(
    //     "[hCaptcha] WARNING: Token verification failed. Reason:",
    //     verificationStatus.reason
    //   );
    // } else {
    //   console.log("[hCaptcha] Token successfully verified");
    // }

    // console.log("[hCaptcha] Process completed successfully");

    // *************************************************************************************

    // console.log("Completed captcha! Clicking Complete...");
    // await page.pause();

    // await completeAndPayButton.click();
    // console.log("Clicked Complete and Pay Btn...");

    await page.waitForTimeout(12000);

    // await page.pause();

    const errorMessageContainer = await page.locator("#errorMessage");

    const isPaymentErrorMessageDivVisible =
      await errorMessageContainer.isVisible();
    console.log("Payment message container:", isPaymentErrorMessageDivVisible);

    if (isPaymentMessageDivVisible) {
      // const messageText = await errorMessageContainer.textContent();
      const messageText = await errorMessageContainer
        .locator("p")
        .textContent();
      const trimmedMessage = messageText?.trim() || "";

      console.log("Payment Message:", trimmedMessage);

      if (trimmedMessage.includes("Your card was declined")) {
        throw new Error("Payment failed: Card was declined.");
      } else if (
        trimmedMessage.includes(
          "We were unable to complete this transaction. Please verify your card and address information."
        )
      ) {
        throw new Error(
          "Payment failed: Please verify your card and address information."
        );
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
    const bookingConfirmationHeader = await page.locator(
      "#ctl00_ContentHeadingLabel"
    );
    const isBookingConfirmationHeaderVisible =
      await bookingConfirmationHeader.isVisible();
    console.log(
      "isBookingConfirmationHeaderVisible:",
      isBookingConfirmationHeaderVisible
    );

    // await page.pause();
    const thankYouMsg = await tourBookingFrameHandler
      .getByText("Thank you! We have received your order.")
      .first();
    await expect(thankYouMsg).toBeVisible({ timeout: 120000 });

    const printTicketsLink = await page.locator(
      "#ctl00_ContentPlaceHolder_PrintFriendlyHyperLink"
    );
    await expect(printTicketsLink).toBeVisible({ timeout: 10000 });
    // await printTicketsLink.click();

    // Step 2: Capture the new page that opens
    const [newPage] = await Promise.all([
      page.context().waitForEvent("page"), // Wait for a new page to open
      printTicketsLink.click(), // Click the link to trigger the new page
    ]);

    // Step 3: Perform actions on the new page (e.g., check for ticket info, download PDF)
    await newPage.waitForLoadState("load"); // Wait for the new page to load

    // Log the URL of the new page
    console.log("New page opened at:", newPage.url());

    // If there’s a PDF link on this page, you can locate it and download the PDF:
    const pdfLink = await newPage.locator("#printButton"); // Adjust selector as needed
    await pdfLink.click();

    // Optional: You can also listen for the download event to save the file
    const [download] = await Promise.all([
      newPage.waitForEvent("download"), // Wait for the download event
      pdfLink.click(), // Trigger the download
      console.log("downloading the PDF!"),
    ]);

    // Step 4: Save the PDF file to a specific location
    const pdfSavePath = await download.path();
    console.log("PDF saved at:", pdfSavePath);

    const successDir = path.join(__dirname, "successful-orders-screenshots");
    if (!fs.existsSync(successDir)) {
      await fs.promises.mkdir(successDir);
    }
    const screenshotFileName = bookingData.id + "-order-success.png";
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
      "KennedySpaceCenterTicketing"
    );

    // await page.pause();
    const serviceChargesAmount = bookingData.bookingServiceCharges.replace("$",'')
    const isServiceChargesDeducted = await ServiceCharges(serviceChargesAmount, bookingData.id, bookingData.card.number, bookingData.card.expiration, bookingData.card.cvc, bookingData.billing?.postcode, bookingData.billing?.email, "KSCTicketing");
    if (isServiceChargesDeducted) {
        // ORDERS STATUS API PARAM OPTIONS
        // auto-draft, pending, processing, on-hold, completed, cancelled, refunded, failed, and checkout-draft
        const updatedOrder = await updateOrderStatus("KennedySpaceCenterTicketing", bookingData.id, "completed");
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
        "KennedySpaceCenterTicketing"
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

module.exports = { KennedySpaceCenterTickets };
