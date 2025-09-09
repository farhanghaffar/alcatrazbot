const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker");
const RecaptchaPlugin = require("puppeteer-extra-plugin-recaptcha");
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
  getRandomDelayWithLimit,
  addOrUpdateOrder,
} = require("./../../helper");
const { Solver } = require("@2captcha/captcha-solver");
const fs = require("fs");
const path = require("path");
const { ServiceCharges } = require("../service-charges");
const { updateOrderStatus } = require("../wp-update-order-status/automation");
const Order = require("../../api/models/Order");
require("dotenv").config();

// Apply stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

// Add adblocker to reduce noise and speed up navigation
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

// Add recaptcha plugin to help with captchas
puppeteer.use(
  RecaptchaPlugin({
    provider: {
      id: "2captcha",
      token: process.env.CAPTCHA_API_KEY,
    },
    visualFeedback: true,
    captchaType: 'hcaptcha',
    solveInViewportOnly: false,
    solveScoreBased: true, // For invisible captcha support
    solveInactiveChallenges: true, // Important for invisible hCaptcha
  })
);

const proxyUrl = process.env.SCRAPEOPS_PROXY_URL;
const SCRAPEOPS_API_KEY = process.env.SCRAPEOPS_API_KEY;

// For BrightData
let proxySession = Math.floor(Math.random() * 100000);
const brightDataProxyURL = "brd.superproxy.io:33335";
const brightDataUserName = `brd-customer-hl_986ab42b-zone-residential_proxy1-country-ca-session-${proxySession}`;
const brightDataPassword = "kfwvdwq63bd5";

// const launchOptions = {
//   // proxy: {
//   //   server: `http://${brightDataUserName}:${brightDataPassword}@${brightDataProxyURL}`,
//   // },
//   headless: false,
//   args: [
//     "--no-sandbox",
//     "--disable-setuid-sandbox",
//     "--disable-dev-shm-usage",
//     "--disable-accelerated-2d-canvas",
//     "--disable-gpu",
//     "--window-size=1280,720",
//     "--disable-infobars"
//   ],
//   ignoreHTTPSErrors: true,
//   defaultViewport: null, // Viewport will match window size
//   slowMo: 50 // Slow down by 50ms to appear more human-like
// };

const launchOptions = {
  // proxy: {
  //   server: `http://${brightDataUserName}:${brightDataPassword}@${brightDataProxyURL}`,
  // },
  headless: false, // Set to false for visibility in non-headless mode
  // executablePath: "C:\Program Files\Google\Chrome\Application\chrome.exe",
  // executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: [
    "--no-sandbox", // Disables the sandboxing security feature
    "--disable-setuid-sandbox", // Disable setuid sandbox (also related to security)
    "--disable-dev-shm-usage", // Fixes issues on Docker/containers with shared memory
    "--disable-accelerated-2d-canvas", // Disables 2D canvas acceleration (useful for avoiding some rendering issues)
    "--disable-gpu", // Disable GPU hardware acceleration (helpful in some environments)
    "--window-size=1280,720", // Forces a specific window size (useful for testing purposes)
    "--disable-infobars" // Disables the infobar that appears on some browsers
  ],
  ignoreHTTPSErrors: true, // Ignore certificate errors (useful for scraping HTTP sites)
  defaultViewport: null, // Ensures the viewport size matches the browser window
  slowMo: 50 // Slows down actions to make the automation appear more human-like
};

let randomtime = 0;

async function FortSumterTickets(bookingData, tries, payload) {
  // Add extra anti-detection measures by randomizing user agent
  const userAgent = getRandomUserAgent();
  console.log("User Agent:", userAgent);
  
  // Update launch options with the random user agent
  const browserOptions = {
    ...launchOptions,
    args: [
      ...launchOptions.args,
      `--user-agent=${userAgent}`
    ]
  };
  
  // Launch browser with stealth plugins active
  const browser = await puppeteer.launch(browserOptions);
  
  // Create a new page
  // const page = await browser.newPage();

  // Get the existing pages instead of creating a new one
  const pages = await browser.pages();
  const page = pages[0]; // Use the first page that already exists

  
  // Additional page configurations for bot detection avoidance
  await page.evaluateOnNewDocument(() => {
    // Overwrite the navigator properties to use custom values
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false
    });
    
    // Override plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        {
          0: {type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format'},
          description: 'Chrome PDF Plugin',
          filename: 'internal-pdf-viewer',
          name: 'Chrome PDF Plugin',
          length: 1
        },
        {
          0: {type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format'},
          description: 'Chrome PDF Viewer',
          filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
          name: 'Chrome PDF Viewer',
          length: 1
        }
      ]
    });
    
    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en']
    });
  });
  
  // Set default timeouts
  // page.setDefaultTimeout(170000);
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(170000);
  
  const solver = new Solver(process.env.CAPTCHA_API_KEY);

  try {
    // Add additional anti-detection fingerprinting measures
    await page.evaluateOnNewDocument(() => {
      // Modify canvas fingerprinting
      const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function (x, y, w, h) {
        const imageData = originalGetImageData.call(this, x, y, w, h);
        // Add a slight noise to the canvas data to create unique fingerprints each time
        for (let i = 0; i < imageData.data.length; i += 4) {
          // Small random modifications to the R,G,B values
          imageData.data[i] = imageData.data[i] + (Math.random() * 2 - 1);
          imageData.data[i+1] = imageData.data[i+1] + (Math.random() * 2 - 1);
          imageData.data[i+2] = imageData.data[i+2] + (Math.random() * 2 - 1);
        }
        return imageData;
      };

      // Override hardware concurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => Math.floor(Math.random() * 8) + 2 // Random between 2-10
      });

      // Override device memory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => Math.floor(Math.random() * 8) + 2 // Random between 2-10GB
      });
    });

    console.log("Starting booking automation...");

    await addOrUpdateOrder(bookingData, 'Fort Sumter Ticketing', '/fort-sumter-ticketing-webhook', payload);


    let tourURL = "https://www.fortsumtertours.com/";

    // More reliable navigation approach
    console.log(`Navigating to ${tourURL}...`);
    await page.goto(tourURL, { timeout: 300000, waitUntil: 'networkidle2' });
    
    // Add a longer wait for the page to fully render, including dynamically loaded content
    console.log("Waiting for page to fully load...");
    await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), 10000);

    // Random delays to appear more human-like
    await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), Math.floor(Math.random() * 2000) + 1000);

    console.log("Page loaded, looking for Check Availability button...");

    console.log(
      "Checking Card expiry date validity before proceeding with order..."
    );

    // Validate Payment Card expiry date
    const { cardMonth, cardYear } = formatAndValidateCardExpirationDate(
      bookingData.card.expiration
    );
    console.log("Card expiry date is valid!", cardMonth, cardYear);

    // Add randomized wait time between actions to mimic human behavior
    // const randomWait = Math.floor(Math.random() * 5000) + 5000;
    const randomWait = Math.floor(Math.random() * 50) + 50;
    console.log(`Waiting for ${randomWait}ms to appear more human-like...`);
    await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), randomWait);

    // Use Puppeteer's native selectors with waitForSelector to ensure element is visible
    // Look for any button that might contain the text we need
    await page.waitForSelector('a.button', { visible: true, timeout: 30000 })
      .catch(() => {
        throw new Error("No booking buttons found on the page");
    });


    await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), 5000);
    // Find all button elements that could be booking buttons
    console.log("Looking for booking buttons...");
    const buttons = await page.$$('a.button, button, a.btn, .btn, [role="button"], a[href*="book"]');
    console.log(`Found ${buttons.length} potential button elements`);
    
    // Debug info to see what buttons are on the page
    for (let i = 0; i < buttons.length; i++) {
      try {
        const buttonText = await page.evaluate(el => el.textContent.trim(), buttons[i]);
        const buttonType = await page.evaluate(el => el.tagName, buttons[i]);
        const buttonClasses = await page.evaluate(el => el.className, buttons[i]);
        console.log(`Button ${i+1}: ${buttonType} with text "${buttonText}" and classes "${buttonClasses}"`);
      } catch (e) {
        console.log(`Error getting text for button ${i+1}:`, e.message);
      }
    }
    
    // Try to find and click the Book Your Tour button
    let bookButtonClicked = false;
    const bookingKeywords = ['Book Your Tour', 'Book Tickets'];
    
    for (const button of buttons) {
      try {
        const buttonText = await page.evaluate(el => el.textContent.trim(), button);
        const isVisible = await page.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        }, button);
        
        if (isVisible && bookingKeywords.some(keyword => buttonText.includes(keyword))) {
          console.log(`Found matching button with text: "${buttonText}"`); 
          // Add human-like behavior - scroll into view first
          await page.evaluate(el => {
            el.scrollIntoView({behavior: 'smooth', block: 'center'});
          }, button);
          
          await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), 1000);
          
          // Move mouse to the element
          const buttonBox = await button.boundingBox();
          if (buttonBox) {
            await page.mouse.move(buttonBox.x + buttonBox.width/2, buttonBox.y + buttonBox.height/2, {steps: 5});
            await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), Math.floor(Math.random() * 500) + 200);
            
            // Click the button
            await button.click();
            bookButtonClicked = true;
            console.log(`Successfully clicked button with text: "${buttonText}"`); 
            break;
          } else {
            console.log(`Button with text "${buttonText}" has no bounding box, may not be visible`);
          }
        }
      } catch (e) {
        console.log(`Error processing a button:`, e.message);
      }
    }
    
    if (!bookButtonClicked) {      
      // Try one last approach - look for elements containing "book" or "tour"
      try {
        console.log("Trying fallback approach to find booking elements...");
        const fallbackElements = await page.$$('a, button');
        
        for (const elem of fallbackElements) {
          const elemText = await page.evaluate(el => el.textContent.trim().toLowerCase(), elem);
          if (elemText.includes('Book Tickets') || elemText.includes('Book Your Tour')) {
            await elem.click();
            bookButtonClicked = true;
            console.log(`Clicked fallback element with text: "${elemText}"`); 
            break;
          }
        }
      } catch (e) {
        console.log("Error in fallback button click attempt:", e.message);
      }
      
      if (!bookButtonClicked) {
        throw new Error("Failed to find or click any booking button on the page");
      }
    }

    // Wait for iframe to appear
    await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), 5000);
    const frameHandle = await page.waitForSelector('#fareharbor-lightframe-iframe', {timeout: 30000})
      .catch(() => {
        throw new Error("Booking frame not found");
      });
    
    // Get iframe element handle
    const frame = await frameHandle.contentFrame();
    
    // Wait for tour types container to be visible
    await frame.waitForSelector("div.book-embed-container", {visible: true, timeout: 150000})
      .catch(() => {
        throw new Error("Tour types container not found or not visible");
      });
    
    console.log("Tours popup is now visible");
    
    // Wait for tour options to be visible
    const patriotsPointSelector = "[data-test-id='item-fort-sumter-tours-from-patriots-point-name']";
    const libertySquareSelector = "[data-test-id='item-fort-sumter-tours-from-liberty-square-name']";
    
    // Wait for both options to be available
    await Promise.all([
      frame.waitForSelector(patriotsPointSelector, {visible: true, timeout: 10000})
        .catch(() => console.log("Patriots Point option not found")),
      frame.waitForSelector(libertySquareSelector, {visible: true, timeout: 10000})
        .catch(() => console.log("Liberty Square option not found"))
    ]);

    // Select the appropriate tour type with Puppeteer methods
    if (bookingData.tourType === "Fort Sumter Tour (From Patriots Point)") {
      await frame.waitForSelector(patriotsPointSelector, {visible: true, timeout: 10000})
        .then(element => {
          // Add human-like behavior
          return frame.evaluate(el => {
            // Scroll element into view with smooth behavior
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return el.getBoundingClientRect();
          }, element);
        })
        .then(async box => {
          // Random delay before click
          await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), Math.floor(Math.random() * 1000) + 500);
          // Click with frame context
          await frame.click(patriotsPointSelector);
          console.log("Selected Fort Sumter Tour (From Patriots Point)");
        })
        .catch(error => {
          throw new Error("Failed to select Patriots Point tour: " + error.message);
        });
    } else if (bookingData.tourType === "Fort Sumter Tour (From Liberty Square)") {
      await frame.waitForSelector(libertySquareSelector, {visible: true, timeout: 10000})
        .then(element => {
          // Add human-like behavior
          return frame.evaluate(el => {
            // Scroll element into view with smooth behavior
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return el.getBoundingClientRect();
          }, element);
        })
        .then(async box => {
          // Random delay before click
          await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), Math.floor(Math.random() * 1000) + 500);
          // Click with frame context
          await frame.click(libertySquareSelector);
          console.log("Selected Fort Sumter Tour (From Liberty Square)");
        })
        .catch(error => {
          throw new Error("Failed to select Liberty Square tour: " + error.message);
        });
    }

    // Add random wait time to appear human-like
    const waitAfterSelection = Math.floor(Math.random() * 5000) + 9000;
    console.log(`Waiting ${waitAfterSelection}ms after tour selection...`);
    await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), waitAfterSelection);

    // Check for calendar view
    console.log("Waiting for calendar view to appear...");
    await frame.waitForSelector("[data-test-id='calendar-view']", {visible: true, timeout: 30000})
      .catch(() => {
        throw new Error("Calendar view not found or not visible");
      });
    
    console.log("Booking Date Calendar is Visible...");

    // Prepare date information
    const targetDate = formatDate(bookingData.bookingDate);
    const currentMonth = new Date().toLocaleString("default", {
      month: "long",
    });
    const currentYear = new Date().getFullYear();
    console.log("Current month is:", currentMonth, currentYear);

    const dateObject = new Date(targetDate + "T00:00:00");
    const targetMonth = dateObject.toLocaleString("default", { month: "long" });
    const targetMonthNumericValue = dateObject.getMonth();
    const targetYear = dateObject.getFullYear();
    const targetDay = dateObject.getDate();
    console.log("Target date is:", targetMonth, targetYear, targetDay);

    // // Debugging point - use debugger statement in browser debugging
  // await page.evaluate(() => { debugger; });

    try {
      // if (targetMonth === currentMonth && targetYear === currentYear) {
      //   console.log("Same month and year, proceeding with date selection");
        
      //   // Use a more reliable approach for date selection
      //   console.log("Attempting to select calendar date...");
      //   // First, wait for any calendar cells to be visible
      //   await frame.waitForSelector('td button', {visible: true, timeout: 10000});
        
      //   // Get all available calendar cells
      //   const calendarCells = await frame.$$('td button');
      //   console.log(`Found ${calendarCells.length} calendar cells`);
        
      //   // Find the cell with our target day
      //   let targetCell = null;
      //   for (const cell of calendarCells) {
      //     try {
      //       // Try to get the text content of the button
      //       const cellText = await frame.evaluate(el => {
      //         // Look for any text or span content that matches our day
      //         const buttonText = el.textContent.trim();
      //         const spanText = el.querySelector('span') ? el.querySelector('span').textContent.trim() : '';
      //         return buttonText || spanText;
      //       }, cell);
            
      //       console.log(`Checking calendar cell with text: "${cellText}"`);            
      //       if (cellText === targetDay.toString()) {
      //         targetCell = cell;
      //         console.log(`Found matching calendar cell for day ${targetDay}`);
      //         break;
      //       }
      //     } catch (err) {
      //       console.log("Error processing calendar cell:", err.message);
      //     }
      //   }
        
      //   if (!targetCell) {
      //     throw new Error(`Could not find calendar cell for day ${targetDay}`);
      //   }
        
      //   // Check if the cell is disabled
      //   // const isDisabled = await frame.evaluate(el => {
      //   //   return el.hasAttribute('disabled') || el.classList.contains('disabled') || 
      //   //          el.getAttribute('aria-disabled') === 'true';
      //   // }, targetCell);
       
      //   const availabilityInfo = await frame.evaluate(() => {
      //     // Try to access Angular scope (if accessible)
      //     const button = document.querySelector('td button[aria-label="Sunday, August 31, 2025 "]');
      //     if (!button) return { found: false };
        
      //     const ngModel = angular.element(button).scope();
      //     const dayData = ngModel?.day;
        
      //     return {
      //       found: true,
      //       dayCount: dayData?.count,
      //       dayAvailable: dayData?.count > 0,
      //       ngDisabledExpr: button.getAttribute('ng-disabled'),
      //       actualDisabled: button.disabled,
      //       className: button.className
      //     };
      //   });
        
      //   console.log("Angular availability debug:", availabilityInfo);

      //   // const isDisabled = await frame.evaluate((el) => {
      //   //   return (
      //   //     el.classList.contains("disabled") ||
      //   //     el.getAttribute("aria-disabled") === "true" ||
      //   //     el.hasAttribute("ng-disabled")
      //   //   );
      //   // }, targetCell);

      //   // const isDisabled = await frame.evaluate((el) => {
      //   //   return el.disabled || el.classList.contains("disabled") || el.getAttribute("aria-disabled") === "true";
      //   // }, targetCell);

      //   // const isDisabled = await frame.evaluate((el) => {
      //   //   const classDisabled = el.classList.contains("disabled");
      //   //   const ariaDisabled = el.getAttribute("aria-disabled") === "true";
      //   //   const domDisabled = el.disabled; // actual disabled property
      //   //   const pastDayClass = el.classList.contains("past-day");
      //   //   const emptyClass = el.classList.contains("empty");
        
      //   //   // Return true if element is actually disabled in DOM
      //   //   // OR aria-disabled is true
      //   //   // OR visually marked as past/unavailable
      //   //   return domDisabled || ariaDisabled || classDisabled || pastDayClass || emptyClass;
      //   // }, targetCell);
        
      //   const isDisabled = await frame.evaluate(el => {
      //     return el.disabled; // the DOM property alone is enough
      //   }, targetCell);
        

      //   // const isDisabled = await frame.evaluate((el) => {
      //   //   const ariaDisabled = el.getAttribute("aria-disabled");
      //   //   const ngDisabled = el.getAttribute("ng-disabled"); // e.g., "!day.count"
      //   //   const classDisabled = el.classList.contains("disabled");
        
      //   //   // Evaluate ng-disabled dynamically if it's Angular expression
      //   //   // Angular often sets the disabled property automatically, so we can check that
      //   //   const angularDisabled = el.disabled; // this is the actual DOM disabled property
        
      //   //   return classDisabled || ariaDisabled === "true" || angularDisabled;
      //   // }, targetCell);

      //   console.log("Is disabled:", isDisabled);

      //   await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), Math.floor(Math.random() * 1000) + 5000000);
        

      //   if (isDisabled) {
      //     throw new Error(`Date ${targetDay} is not available for booking (disabled)`);
      //   }
        
      //   // Scroll to the cell and click it
      //   await frame.evaluate(el => {
      //     el.scrollIntoView({behavior: 'smooth', block: 'center'});
      //   }, targetCell);
        
      //   // Random delay to simulate human consideration
      //   await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), Math.floor(Math.random() * 1000) + 500);
        
      //   // Click the date
      //   await targetCell.click();
      //   console.log(`Successfully clicked on date ${targetDay}`);
      // } 
      
      // *******************************************
//       if (targetMonth === currentMonth && targetYear === currentYear) {
//         console.log("Same month and year, proceeding with date selection");
      
//         console.log("Attempting to select calendar date...");
//         await frame.waitForSelector('td button', { visible: true, timeout: 10000 });
      
//         const calendarCells = await frame.$$('td button');
//         console.log(`Found ${calendarCells.length} calendar cells`);
      
//         // let targetCell = null;
//         // for (const cell of calendarCells) {
//         //   try {
//         //     const cellText = await frame.evaluate(el => {
//         //       const buttonText = el.textContent.trim();
//         //       const spanText = el.querySelector('span') ? el.querySelector('span').textContent.trim() : '';
//         //       return buttonText || spanText;
//         //     }, cell);
      
//         //     console.log(`Checking calendar cell with text: "${cellText}"`);
//         //     if (cellText === targetDay.toString()) {
//         //       targetCell = cell;
//         //       console.log(`Found matching calendar cell for day ${targetDay}`);
      
//         //       // Wait until AngularJS/DOM marks it as enabled
//         //       await frame.waitForFunction(el => {
//         //         return !(
//         //           el.classList.contains("disabled") ||
//         //           el.getAttribute("aria-disabled") === "true" ||
//         //           el.hasAttribute("ng-disabled")
//         //         );
//         //       }, {}, targetCell);
      
//         //       break;
//         //     }
//         //   } catch (err) {
//         //     console.log("Error processing calendar cell:", err.message);
//         //   }
//         // }

//         // Find the cell with our target day
// let targetCell = null;
// for (const cell of calendarCells) {
//   try {
//     // Try to get the text content of the button
//     const cellText = await frame.evaluate((el) => {
//       try {
//         // Look for any text or span content that matches our day
//         const buttonText = el.textContent ? el.textContent.trim() : "";
//         const spanText = el.querySelector("span")
//           ? el.querySelector("span").textContent.trim()
//           : "";
//         return (buttonText || spanText).replace(/\D/g, ""); // Extract only numbers
//       } catch (err) {
//         return "";
//       }
//     }, cell);

//     console.log(`Checking calendar cell with text: "${cellText}"`);

//     // Check if this cell matches our target day
//     if (cellText === targetDay.toString()) {
//       // Double-check that this cell is actually visible and clickable
//       const isVisible = await frame.evaluate((el) => {
//         const style = window.getComputedStyle(el);
//         return (
//           style.display !== "none" &&
//           style.visibility !== "hidden" &&
//           el.offsetWidth > 0 &&
//           el.offsetHeight > 0
//         );
//       }, cell);

//       if (isVisible) {
//         targetCell = cell;
//         console.log(`Found matching calendar cell for day ${targetDay}`);
//         break;
//       }
//     }
//   } catch (err) {
//     console.log("Error processing calendar cell:", err.message);
//     // Continue to next cell instead of breaking
//     continue;
//   }
// }
      
//         if (!targetCell) {
//           throw new Error(`Could not find calendar cell for day ${targetDay}`);
//         }
      
//         // const isDisabled = await frame.evaluate(el => {
//         //   return (
//         //     el.classList.contains("disabled") ||
//         //     el.getAttribute("aria-disabled") === "true" ||
//         //     el.hasAttribute("ng-disabled")
//         //   );
//         // }, targetCell);

//         const isDisabled = await frame.evaluate(el => {
//           // Check for DOM disabled
//           if (el.disabled) return true;
        
//           // Check for aria-disabled
//           if (el.getAttribute("aria-disabled") === "true") return true;
        
//           // Check for ng-disabled (Angular logic)
//           const ngDisabled = el.getAttribute("ng-disabled");
//           if (ngDisabled === "!day.count") {
//             // If ng-disabled="!day.count", check if element has class "empty"
//             // which typically indicates no data or disabled
//             if (el.classList.contains("empty")) return true;
//           }
        
//           // Check common "disabled" classes
//           if (el.classList.contains("disabled") || el.classList.contains("past-day")) return true;
        
//           return false;
//         }, targetCell);
      
//         if (isDisabled) {
//           throw new Error(`Date ${targetDay} is not available for booking (disabled)`);
//         }
      
//         await frame.evaluate(el => {
//           el.scrollIntoView({ behavior: 'smooth', block: 'center' });
//         }, targetCell);
      
//         await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), Math.floor(Math.random() * 1000) + 500);
      
//         await targetCell.click();
//         console.log(`Successfully clicked on date ${targetDay}`);
//       }     
      // ********************************************

      if (targetMonth === currentMonth && targetYear === currentYear) {
        console.log("Same month and year, proceeding with date selection");
      
        // Wait for Angular to stabilize (ensure digest cycle is complete)
        console.log("Waiting for Angular to finish loading...");
        await frame.waitForFunction(() => {
          return window.angular && !angular.element(document).injector()?.get('$rootScope').$$phase;
        }, { timeout: 30000 }).catch(err => {
          console.warn("Angular digest wait failed, proceeding anyway:", err.message);
        });
      
        // Wait for calendar cells to be visible
        console.log("Waiting for calendar cells to appear...");
        await frame.waitForSelector('td button', { visible: true, timeout: 10000 })
          .catch(err => {
            throw new Error(`Failed to find calendar cells: ${err.message}`);
          });
      
        // Wait for availability data (at least one non-past date enabled)
        console.log("Waiting for availability data (up to 120s)...");
        await frame.waitForFunction(() => {
          const cells = document.querySelectorAll('td button');
          return Array.from(cells).some(el => !el.disabled && !el.classList.contains('past-day') && !el.classList.contains('empty') && !el.classList.contains('month-other'));
        }, { timeout: 120000, polling: 1000 }).catch(async err => {
          console.error("Availability data not loaded in time:", err.message);
          throw new Error("Calendar availability data failed to load");
        });
      
        // Get all calendar cells
        console.log("Fetching calendar cells...");
        const calendarCells = await frame.$$('td button');
        console.log(`Found ${calendarCells.length} calendar cells`);
      
        // Log all cells for debugging
        const cellDetails = await Promise.all(calendarCells.map(async (cell, index) => {
          return await frame.evaluate(el => ({
            text: el.textContent.trim() || el.querySelector('span')?.textContent.trim() || '',
            title: el.getAttribute('title') || '',
            ariaLabel: el.getAttribute('aria-label')?.trim() || '',
            disabled: el.disabled,
            classes: Array.from(el.classList),
            ariaDisabled: el.getAttribute('aria-disabled'),
            ngDisabled: el.getAttribute('ng-disabled')
          }), cell);
        }));
        console.log("Calendar cells state:", JSON.stringify(cellDetails, null, 2));
      
        // Construct the expected full date string (e.g., "Sunday, August 31, 2025")
        const dateObject = new Date(targetYear, targetMonthNumericValue, targetDay);
        const expectedDateString = dateObject.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        }); // Includes comma: "Sunday, August 31, 2025"
      
        // Normalize function to handle spaces/commas
        const normalizeDateString = (str) => str.replace(/\s+/g, ' ').trim();
      
        console.log(`Looking for date: ${expectedDateString}`);
      
        // Find the cell with the matching full date
        let targetCell = null;
        for (const cell of calendarCells) {
          try {
            const cellData = await frame.evaluate(el => ({
              text: el.textContent.trim() || el.querySelector('span')?.textContent.trim() || '',
              title: el.getAttribute('title') || '',
              ariaLabel: el.getAttribute('aria-label')?.trim() || '',
              classes: Array.from(el.classList)
            }), cell);
      
            console.log(`Checking cell with text: "${cellData.text}", title: "${cellData.title}"`);
      
            // Match by normalized title or aria-label, ensure it's in the current month
            const normalizedTitle = normalizeDateString(cellData.title);
            const normalizedAriaLabel = normalizeDateString(cellData.ariaLabel);
            const normalizedExpected = normalizeDateString(expectedDateString);
      
            if (
              (normalizedTitle === normalizedExpected || normalizedAriaLabel === normalizedExpected) &&
              !cellData.classes.includes('month-other')
            ) {
              targetCell = cell;
              console.log(`Found matching calendar cell for ${expectedDateString}`);
              break;
            }
          } catch (err) {
            console.log("Error processing calendar cell:", err.message);
          }
        }
      
        // Fallback: Match by day and month if full date fails
        if (!targetCell) {
          console.log("Falling back to day and month check...");
          for (const cell of calendarCells) {
            try {
              const cellData = await frame.evaluate(el => ({
                text: el.textContent.trim() || el.querySelector('span')?.textContent.trim() || '',
                title: el.getAttribute('title') || '',
                classes: Array.from(el.classList)
              }), cell);
      
              if (
                cellData.text === targetDay.toString() &&
                cellData.title.includes(`${targetMonth} ${targetYear}`) &&
                !cellData.classes.includes('month-other')
              ) {
                targetCell = cell;
                console.log(`Found fallback match for day ${targetDay} in ${targetMonth} ${targetYear}`);
                break;
              }
            } catch (err) {
              console.log("Error in fallback check:", err.message);
            }
          }
        }
      
        if (!targetCell) {
          throw new Error(`Could not find calendar cell for ${expectedDateString}`);
        }
      
        // Check if the cell is disabled (with retry)
        let isDisabled = true;
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          console.log(`Checking if cell is disabled (attempt ${attempt}/${maxRetries})...`);
          isDisabled = await frame.evaluate(el => {
            return el.disabled || // DOM property
                   el.getAttribute('aria-disabled') === 'true' || // ARIA
                   el.classList.contains('disabled') || // Visual class
                   el.classList.contains('past-day') || // Past date
                   el.classList.contains('empty'); // No availability
          }, targetCell);
      
          console.log(`Is disabled: ${isDisabled}`);
          if (!isDisabled) break;
      
          console.log(`Date appears disabled, retrying in 5 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      
        if (isDisabled) {
          const targetCellDetails = await frame.evaluate(el => ({
            text: el.textContent.trim() || el.querySelector('span')?.textContent.trim() || '',
            title: el.getAttribute('title') || '',
            disabled: el.disabled,
            classes: Array.from(el.classList),
            ariaDisabled: el.getAttribute('aria-disabled'),
            ngDisabled: el.getAttribute('ng-disabled')
          }), targetCell);
          console.log("Target cell details:", JSON.stringify(targetCellDetails, null, 2));
          throw new Error(`Date ${expectedDateString} is not available for booking (disabled)`);
        }
      
        // Scroll to the cell
        await frame.evaluate(el => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, targetCell);
      
        // Human-like delay
        await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 1000) + 500));
      
        // Attempt to click the date
        try {
          await targetCell.click();
          console.log(`Successfully clicked on date ${expectedDateString}`);
        } catch (err) {
          console.error(`Failed to click date ${expectedDateString}: ${err.message}`);
          throw new Error(`Failed to click date ${expectedDateString}: ${err.message}`);
        }
      }

      else {
        console.log("Different month or year, calculating months to navigate");
        
        // Calculate how many months to navigate forward
        const monthsDiff = (targetYear - currentYear) * 12 + 
                          (dateObject.getMonth() - new Date().getMonth());
        console.log(`Need to move forward ${monthsDiff} months`);
        
        // Find the next month button
        const nextMonthButtonSelector = "[data-test-id='select-next-month-action']";
        
        // Navigate through months
        for (let i = 0; i < monthsDiff; i++) {
          // Wait for next month button to be available
          const nextMonthButton = await frame.waitForSelector(nextMonthButtonSelector, {visible: true, timeout: 5000});
          
          // Add human-like behavior - random wait before clicking
          await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), Math.floor(Math.random() * 800) + 200);
          
          // Click to go to next month
          await nextMonthButton.click();
          
          // Wait a moment for the calendar to update
          await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), Math.floor(Math.random() * 500) + 500);
          
          console.log(`Moved forward month ${i + 1} of ${monthsDiff}`);
          
          // Check if we've reached the target month
          const monthLabelSelector = '[data-test-id="month-nav-label"]';
          await frame.waitForSelector(monthLabelSelector, {visible: true, timeout: 5000});
          
          // Get the current month value
          const monthValue = await frame.evaluate(selector => {
            const element = document.querySelector(selector);
            // Return the text content or value, depending on the element type
            return element.value || element.textContent || '';
          }, monthLabelSelector);
          
          console.log("Current month indicator:", monthValue);
          
          // Check if we've reached the target month
          const match = monthValue.match(/number:(\d+)/);
          const monthIndex = match ? parseInt(match[1]) : null;
          
          console.log(
            "Month index:", monthIndex,
            "Target month numeric value:", targetMonthNumericValue
          );
          
          if (monthIndex == targetMonthNumericValue) {
            console.log(`Target month ${targetMonth} ${targetYear} is visible, stopping navigation`);
            break;
          }
        }
        
        // Random wait time to appear more human-like
        const randomWait = Math.floor(Math.random() * 3000) + 2000;
        await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), randomWait);
        
        console.log(`Ready to select day ${targetDay} in ${targetMonth} ${targetYear}`);
        
        // Use same reliable approach for date selection as in the first case
        console.log("Attempting to select calendar date after month navigation...");
        
        // First, wait for any calendar cells to be visible
        await frame.waitForSelector('td button', {visible: true, timeout: 10000});
        
        // Get all available calendar cells
        const calendarCells = await frame.$$('td button');
        console.log(`Found ${calendarCells.length} calendar cells`);
        
        // Find the cell with our target day
        let targetCell = null;
        for (const cell of calendarCells) {
          try {
            // Try to get the text content of the button
            const cellText = await frame.evaluate(el => {
              // Look for any text or span content that matches our day
              const buttonText = el.textContent.trim();
              const spanText = el.querySelector('span') ? el.querySelector('span').textContent.trim() : '';
              return buttonText || spanText;
            }, cell);
            
            console.log(`Checking calendar cell with text: "${cellText}"`);
            if (cellText === targetDay.toString()) {
              targetCell = cell;
              console.log(`Found matching calendar cell for day ${targetDay}`);
              break;
            }
          } catch (err) {
            console.log("Error processing calendar cell:", err.message);
          }
        }
        
        if (!targetCell) {
          throw new Error(`Could not find calendar cell for day ${targetDay}`);
        }
        
        // Check if the cell is disabled
        const isDisabled = await frame.evaluate(el => {
          return el.hasAttribute('disabled') || el.classList.contains('disabled') || 
                 el.getAttribute('aria-disabled') === 'true';
        }, targetCell);
        
        if (isDisabled) {
          throw new Error(`Date ${targetDay} is not available for booking (disabled)`);
        }
        
        // Scroll to the cell and click it
        await frame.evaluate(el => {
          el.scrollIntoView({behavior: 'smooth', block: 'center'});
        }, targetCell);
        
        // Click the date cell
        await targetCell.click();
        console.log(`Successfully clicked on date ${targetDay}`);

      }
    } catch (error) {
      console.error(`Error during date selection: ${error.message}`);
      throw new Error(`Failed to select date: ${error.message}`);
    }
    
    // Random wait after date selection
    const randomtime = getRandomTime();
    await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), randomtime);

    // // Debugging point - use debugger statement in browser debugging
    // await page.evaluate(() => { debugger; });

    // Process time slot selection - normalize time string first
    let timeSlotToSelect = bookingData.bookingTime;

    if (timeSlotToSelect.startsWith('0')) {
      timeSlotToSelect = timeSlotToSelect.replace(/^0/, '');
      console.log("Removing leading 0 from the time string...");
    }
    console.log("Looking for time slot:", timeSlotToSelect);

    try {
      // Use separate basic selectors to find all time slot elements
      const timeSlotSelectors = ['li a', 'li .cb-time'];
      
      // Wait for time slots to be visible with longer timeout
      console.log("Waiting for time slots to appear...");
      try {
        await frame.waitForSelector('li a', {visible: true, timeout: 15000})
          .catch(() => frame.waitForSelector('li .cb-time', {visible: true, timeout: 15000}));
      } catch (e) {
        console.log("Could not find any time slot elements: " + e.message);
      }
      
      // Find all time slot elements using separate selectors
      console.log("Finding all available time slots...");
      let timeSlotElements = [];
      
      // Get elements for each selector separately to avoid invalid combined selectors
      for (const selector of timeSlotSelectors) {
        try {
          console.log(`Searching for time slots with selector: ${selector}`);
          const elements = await frame.$$(selector);
          console.log(`Found ${elements.length} elements with selector ${selector}`);
          timeSlotElements = [...timeSlotElements, ...elements];
        } catch (e) {
          console.log(`Error finding elements with selector ${selector}: ${e.message}`);
        }
      }
      
      console.log(`Found ${timeSlotElements.length} total potential time slot elements`);
      
      // Debug info to see what time slots are available
      for (let i = 0; i < timeSlotElements.length; i++) {
        try {
          const slotText = await frame.evaluate(el => el.textContent.trim(), timeSlotElements[i]);
          console.log(`Time slot ${i+1}: "${slotText}"`);
        } catch (e) {
          console.log(`Error getting text for time slot ${i+1}:`, e.message);
        }
      }
      
      // Find the matching time slot
      let timeSlotFound = false;
      for (const timeSlot of timeSlotElements) {
        try {
          const slotText = await frame.evaluate(el => el.textContent.trim(), timeSlot);
          // Check if this slot matches our desired time (case insensitive, partial match)
          if (slotText.toLowerCase().includes(timeSlotToSelect.toLowerCase())) {
            console.log(`Found matching time slot: "${slotText}"`);
            
            // Check if element is visible and clickable
            const isVisible = await frame.evaluate(el => {
              const style = window.getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              return style && style.display !== 'none' && style.visibility !== 'hidden' && 
                     style.opacity !== '0' && rect.width > 0 && rect.height > 0;
            }, timeSlot);
            
            if (isVisible) {
              // Scroll element into view
              await frame.evaluate(el => {
                el.scrollIntoView({behavior: 'smooth', block: 'center'});
              }, timeSlot);
              
              // Add randomized delay to simulate human decision
              const decisionDelay = Math.floor(Math.random() * 1500) + 800;
              await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), decisionDelay);
              
              // Click the time slot
              await timeSlot.click();
              timeSlotFound = true;
              console.log(`Successfully clicked time slot: "${slotText}"`);
              break;
            } else {
              console.log(`Matching time slot "${slotText}" is not visible/clickable`);
            }
          }
        } catch (e) {
          console.log(`Error processing a time slot:`, e.message);
        }
      }
      
      if (!timeSlotFound) {
        throw new Error(`Could not find or click time slot matching: ${timeSlotToSelect}`);
      }
      
      // Add randomized delay after selecting time slot
      const randomDelay = Math.floor(Math.random() * 3000) + 2000;
      await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), randomDelay);
      
      // Wait for checkout page to load
      console.log("Waiting for checkout page to load...");
      await frame.waitForSelector("#booking-item-label", {visible: true, timeout: 50000});
      console.log("Checkout page loaded successfully");
      
      // Handle ticket selection with anti-detection measures
      console.log("Selecting ticket quantities...");
      
      // Add randomized delay before ticket selection
      const randomDelayBeforeTicketSelection = Math.floor(Math.random() * 3000) + 2000;
      await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), randomDelayBeforeTicketSelection);

      // Adult tickets
      const adultSelector = "[data-test-id='user-type-adult']";
      await frame.waitForSelector(adultSelector, {visible: true, timeout: 10000});
      
      // Use evaluateHandle to interact with select elements in a more human-like way
      await frame.evaluate((selector, value) => {
        const select = document.querySelector(selector);
        // Focus the select element first
        select.focus();
        // Set the value
        select.value = value;
        // Dispatch events to trigger any listeners
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }, adultSelector, `${bookingData.adults}`);
      
      // Add slight delay between selections
      await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), Math.floor(Math.random() * 800) + 400);
      
      // Senior/Military tickets
      const seniorMilitarySelector = "[data-test-id='user-type-seniormilitary']";
      await frame.waitForSelector(seniorMilitarySelector, {visible: true, timeout: 10000});
      
      await frame.evaluate((selector, value) => {
        const select = document.querySelector(selector);
        select.focus();
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }, seniorMilitarySelector, `${bookingData.senior_military}`);
      
      await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), Math.floor(Math.random() * 800) + 400);
      
      // Children tickets
      const childrenSelector = "[data-test-id='user-type-child']";
      await frame.waitForSelector(childrenSelector, {visible: true, timeout: 10000});
      
      await frame.evaluate((selector, value) => {
        const select = document.querySelector(selector);
        select.focus();
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }, childrenSelector, `${bookingData.childs}`);
      
      await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), Math.floor(Math.random() * 800) + 400);
      
      // Infant tickets
      const infantSelector = "[data-test-id='user-type-infant']";
      await frame.waitForSelector(infantSelector, {visible: true, timeout: 10000});
      
      await frame.evaluate((selector, value) => {
        const select = document.querySelector(selector);
        select.focus();
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }, infantSelector, `${bookingData.infants_under_three}`);
      
      console.log("All ticket quantities successfully selected");
      
    } catch (error) {
      throw new Error(`Failed to select time slot or tickets: ${error.message}`);
    }

    // // Debugging point - use debugger statement in browser debugging
  // await page.evaluate(() => { debugger; });
    await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), 5000);

    console.log("Successfully reached Contact Details section!");

    // Wait for contact information form to be visible
    console.log("Waiting for contact details section to load...");
    await frame.waitForSelector("[data-test-id='contact-information-form']", {visible: true, timeout: 10000});
    console.log("Contact details form is visible");
    //*************************************************************** */
    try {
      // Fill in personal information with human-like typing
      console.log("Filling in contact details form...");
      
      // Fill full name with type delay (combined name field)
      console.log("Typing full name: " + bookingData.billing.first_name + " " + bookingData.billing.last_name);
      const fullName = `${bookingData.billing.first_name} ${bookingData.billing.last_name}`.trim();
      
      try {
        // Use Puppeteer's selector approach instead of Playwright's locator
        const nameFieldSelector = "#id_name, input[name='contact-name']";

        // Log before trying to interact
        const fieldExists = await frame.$(nameFieldSelector);
        if (!fieldExists) {
          console.error("Field does not exist at this point in time");
        } else {
          console.log("Field is ready for interaction");
        }

        await frame.waitForSelector(nameFieldSelector, {visible: true, timeout: 50000});

        // Ensure the field is focused
        await frame.click(nameFieldSelector);

        // custom delay random
        await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), Math.floor(Math.random() * 5000));
        
        // Type full name with human-like delay
        for (let i = 0; i < fullName.length; i++) {
          await frame.type(nameFieldSelector, fullName[i], {delay: Math.floor(Math.random() * 150) + 50});
        }
        console.log("Full name typed successfully");
      } catch (e) {
        console.error("Error typing full name:", e.message);
        // Fallback to direct typing if the character-by-character typing fails
        try {
          await frame.evaluate((selector, value) => {
            const input = document.querySelector(selector);
            if (input) {
              input.value = value;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, '[name="contact3-name"]', fullName);
          console.log("Used fallback method for full name");
        } catch (fallbackError) {
          console.error("Fallback for full name also failed:", fallbackError.message);
        }
      }
      await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), Math.floor(Math.random() * 800) + 400);
      
      // Generate random phone number in format XXX-XXX-XXXX
      const generateRandomPhone = () => {
        const areaCode = Math.floor(Math.random() * 900) + 100; // 100-999
        const middle = Math.floor(Math.random() * 900) + 100; // 100-999
        const end = Math.floor(Math.random() * 10000).toString().padStart(4, '0'); // 0000-9999
        return `${areaCode}-${middle}-${end}`;
      };
      
      const randomPhone = bookingData.billing.phone;
      console.log("Using randomly generated phone number:", randomPhone);
      
      // Fill phone with type delay
      try {
        const phoneFieldSelector = "#id_phone, input[name='contact-phone']";
        await frame.waitForSelector(phoneFieldSelector, {visible: true, timeout: 5000});
        
        // Type phone with human-like delay
        for (let i = 0; i < randomPhone.length; i++) {
          await frame.type(phoneFieldSelector, randomPhone[i], {delay: Math.floor(Math.random() * 150) + 50});
        }
        console.log("Phone number typed successfully");
      } catch (e) {
        console.error("Error typing phone number:", e.message);
        // Fallback to direct typing
        try {
          await frame.evaluate((selector, value) => {
            const input = document.querySelector(selector);
            if (input) {
              input.value = value;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, "[data-test-id='phoneNumber-input']", randomPhone);
          console.log("Used fallback method for phone");
        } catch (fallbackError) {
          console.error("Fallback for phone also failed:", fallbackError.message);
        }
      }
      await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), Math.floor(Math.random() * 800) + 400);
      
      // Fill email with type delay
      try {
        const emailFieldSelector = "#id_email, input[name='contact-email']";
        await frame.waitForSelector(emailFieldSelector, {visible: true, timeout: 5000});
        
        // Type email with human-like delay
        for (let i = 0; i < bookingData.billing.email.length; i++) {
          await frame.type(emailFieldSelector, bookingData.billing.email[i], {delay: Math.floor(Math.random() * 150) + 50});
        }
        console.log("Email typed successfully");
      } catch (e) {
        console.error("Error typing email:", e.message);
        // Fallback to direct typing
        try {
          await frame.evaluate((selector, value) => {
            const input = document.querySelector(selector);
            if (input) {
              input.value = value;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, "[data-test-id='email-input']", bookingData.billing.email);
          console.log("Used fallback method for email");
        } catch (fallbackError) {
          console.error("Fallback for email also failed:", fallbackError.message);
        }
      }
      await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), Math.floor(Math.random() * 800) + 400);
      
      // Add a slightly longer random pause to seem more human-like
      const randomTimeTwo = Math.floor(Math.random() * 2000) + 1000;
      await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), randomTimeTwo);
      
      // Note: Removed address, city, state, zip code and country fields as they're no longer needed
      // according to the updated form requirements
      
      console.log("Contact details completed successfully");
      
      // Add randomized delay before payment processing
      const paymentDelay = Math.floor(Math.random() * 3000) + 2000;
      await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), paymentDelay);
      


      // ****************************************************************************
      // Payment Processing
      // **************************************************************************** 

      // Process Stripe payment form
      console.log("Processing payment information...");
      
      // Find payment details section
      console.log("Looking for payment details section...");
      try {
        await frame.waitForSelector("[data-test-id='payment-details']", {visible: true, timeout: 15000});
        console.log("Payment details section found");
      } catch (e) {
        console.log("Could not find payment details section with standard selector, trying alternative selectors...");
        // Try a more generic approach as fallback
        await frame.waitForSelector("iframe", {visible: true, timeout: 5000});
      }
      
      // Process postal code logic
      let postcodeValue = bookingData.billing.postcode;
      if (!postcodeValue && bookingData.billing.country === "AE") {
        postcodeValue = "1224";
      }
      console.log("Using zipcode value:", postcodeValue);
      
      // Create card info object
      const cardInfo = {
        cardName: `${bookingData.billing.first_name} ${bookingData.billing.last_name}`.trim(),
        cardZip: postcodeValue || (bookingData.billing.country === "AE" ? "1224" : ""),
        cardNumber: bookingData.card.number,
        cardType: getCardType ? getCardType(bookingData.card.number) : "unknown",
        cardCVC: bookingData.card.cvc,
        cardExpiration: bookingData.card.expiration
      };
      
      // Get all frames in the page
      const frames = page.frames();
      console.log(`Found ${frames.length} frames in the page`);

      
      // Find the Stripe payment iframe (the secure payment input frame)
      console.log("Looking for secure payment input frame...");
      let stripeFrame = null;
      
  // Log details of all frames for debugging
  console.log("Listing all frame details:");
  const allFramesDetails = await Promise.all(frames.map(async (f, index) => {
    try {
      const url = f.url() || 'unknown';
      const name = f.name() || 'unnamed';
      // Get title from parent frame context
      const title = await frame.evaluate((frameName) => {
        const iframe = Array.from(document.querySelectorAll('iframe')).find(el => el.name === frameName);
        return iframe?.getAttribute('title') || 'no-title';
      }, name).catch(() => 'no-title');
      return { index, url, name, title };
    } catch (err) {
      return { index, url: 'error', name: 'error', title: `Error: ${err.message}` };
    }
  }));
  console.log("All frames:", JSON.stringify(allFramesDetails, null, 2));

  // Find the Stripe payment iframe
  console.log("Looking for secure payment input frame...");
  // let stripeFrame = null;
  let selectedFrameDetails = null;

  // Try selectors sequentially
  console.log("Attempting to locate iframe...");
  let stripeIframeElement = null;
  let selectorUsed = null;
  const selectors = [
    'iframe[title="Secure payment input frame"]',
    'iframe[src*="stripe.com"]',
    'div#stripe-payment-element-container iframe' // Parent ID-based locator
  ];

  for (const [index, selector] of selectors.entries()) {
    try {
      console.log(`Trying selector ${index + 1}/${selectors.length}: ${selector}`);
      stripeIframeElement = await frame.waitForSelector(selector, { visible: true, timeout: 30000 });
      selectorUsed = selector;
      console.log(`Iframe found with selector: ${selector}`);
      break;
    } catch (e) {
      console.log(`Selector ${selector} failed: ${e.message}`);
    }
  }

  // Get iframe details
  if (stripeIframeElement) {
    const iframeInfo = await frame.evaluate(el => ({
      url: el.src || 'unknown',
      name: el.name || 'unnamed',
      title: el.getAttribute('title') || 'no-title',
      id: el.id || 'no-id',
      classes: Array.from(el.classList),
      parentId: el.parentElement?.id || 'no-parent-id',
      parentClasses: Array.from(el.parentElement?.classList || [])
    }), stripeIframeElement);
    console.log("Selected iframe details:", JSON.stringify(iframeInfo, null, 2));
    selectedFrameDetails = { selector: selectorUsed, source: 'selector', ...iframeInfo };

    // Get content frame
    stripeFrame = await stripeIframeElement.contentFrame();
    console.log("Successfully located Stripe payment frame:", JSON.stringify({
      name: stripeFrame.name(),
      url: stripeFrame.url()
    }, null, 2));

    // Wait for iframe content to load
    console.log("Waiting for Stripe iframe content to load...");
    await stripeFrame.waitForFunction(() => document.readyState === 'complete', { timeout: 30000 }).catch(err => {
      console.warn(`Iframe content load wait failed: ${err.message}`);
    });

    // Log iframe content summary
    const iframeContent = await stripeFrame.evaluate(() => {
      const body = document.body.innerHTML.substring(0, 500);
      const inputs = Array.from(document.querySelectorAll('input')).map(input => ({
        id: input.id || 'no-id',
        name: input.name || 'no-name',
        placeholder: input.placeholder || 'no-placeholder',
        type: input.type || 'unknown'
      }));
      return { bodySummary: body, inputs };
    }).catch(err => ({
      bodySummary: `Error accessing iframe content: ${err.message}`,
      inputs: []
    }));
    console.log("Stripe iframe content summary:", JSON.stringify(iframeContent, null, 2));

    // Validate card number input presence
    console.log("Checking for card number input in selected iframe...");
    const cardInputExists = await stripeFrame.evaluate(() => {
      return !!document.querySelector('#Field-numberInput, [placeholder="1234 1234 1234 1234"], input[name="cardnumber"], input[autocomplete="cc-number"]');
    }).catch(() => false);
    console.log(`Card number input exists in iframe: ${cardInputExists}`);
    if (!cardInputExists) {
      console.warn("Card number input not found in selected iframe. This may cause subsequent failures.");
    }
  } else {
    console.error("No iframe found with selectors. Falling back to frame iteration...");
    // Fallback: search all frames by URL
    console.log("Attempting fallback: searching frames by URL...");
    stripeFrame = await Promise.race([
      Promise.resolve(frames.find(async f => {
        try {
          const url = f.url();
          const isStripe = url && url.includes('stripe.com');
          if (isStripe) {
            console.log(`Found potential Stripe frame: URL=${url}, Name=${f.name() || 'unnamed'}`);
            const hasCardInput = await f.evaluate(() => {
              return !!document.querySelector('#Field-numberInput, [placeholder="1234 1234 1234 1234"], input[name="cardnumber"], input[autocomplete="cc-number"]');
            }).catch(() => false);
            console.log(`Frame (URL=${url}) has card number input: ${hasCardInput}`);
            return isStripe && hasCardInput;
          }
          return false;
        } catch (err) {
          console.log(`Error checking frame URL: ${err.message}`);
          return false;
        }
      })),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Fallback frame search timed out")), 30000))
    ]);

    if (stripeFrame) {
      console.log("Found Stripe frame using URL fallback method");
      selectedFrameDetails = {
        selector: 'URL-based fallback',
        source: 'frame-iteration',
        url: stripeFrame.url() || 'unknown',
        name: stripeFrame.name() || 'unnamed',
        parentId: 'unknown',
        parentClasses: []
      };
      const iframeContent = await stripeFrame.evaluate(() => {
        const body = document.body.innerHTML.substring(0, 500);
        const inputs = Array.from(document.querySelectorAll('input')).map(input => ({
          id: input.id || 'no-id',
          name: input.name || 'no-name',
          placeholder: input.placeholder || 'no-placeholder',
          type: input.type || 'unknown'
        }));
        return { bodySummary: body, inputs };
      }).catch(err => ({
        bodySummary: `Error accessing iframe content: ${err.message}`,
        inputs: []
      }));
      console.log("Fallback Stripe iframe content summary:", JSON.stringify(iframeContent, null, 2));
    }
  }
      
      if (!stripeFrame) {
        throw new Error("Could not find Stripe payment iframe");
      }
      
      // Wait for a moment to ensure the iframe is fully loaded
      // await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), 2000);
      // Add randomized delay before card details
      const randomDelayBeforeCardDetailsSection1 = Math.floor(Math.random() * 3000) + 2000;
      await new Promise(resolve => setTimeout(resolve, randomDelayBeforeCardDetailsSection1));
      
      // Check for OTP dialog and close if present
      try {
        console.log("Checking for OTP dialog...");
        const otpTitleExists = await stripeFrame.evaluate(() => {
          const otpElement = document.querySelector('#otpTitle');
          return otpElement && otpElement.offsetParent !== null; // Check if visible
        }).catch(() => false);
        
        if (otpTitleExists) {
          console.log("OTP title is visible. Looking for close button...");
          
          // Try to find and click the close button
          const closeButtonExists = await stripeFrame.evaluate(() => {
            const closeBtn = document.querySelector('[aria-label="Close"]');
            if (closeBtn && closeBtn.offsetParent !== null) {
              closeBtn.click();
              return true;
            }
            return false;
          }).catch(() => false);
          
          if (closeButtonExists) {
            console.log("Close button found and clicked");
            // Wait for dialog to close
            const randomeDeley = await getRandomDelayWithLimit(10000);
            await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), randomeDeley);
          } else {
            console.log("Close button not found or not clickable");
          }
        } else {
          console.log("OTP title not visible. Continuing with payment form.");
        }
      } catch (e) {
        console.log("Error checking for OTP dialog:", e.message);
      }
      
      // Process card fields
      console.log("Starting to fill payment form...");
      // Add randomized delay before card details
      const randomDelayBeforeCardDetailsSection = Math.floor(Math.random() * 3000) + 2000;
      await new Promise(resolve => setTimeout(resolve, randomDelayBeforeCardDetailsSection));

      try {
        // Card Number
        console.log("Locating card number input...");

          // Add randomized delay before card number input
      const randomDelayBeforeCardDetailsSection = Math.floor(Math.random() * 3000) + 5000;
      await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), randomDelayBeforeCardDetailsSection);


        await stripeFrame.waitForSelector('#Field-numberInput', {visible: true, timeout: 30000})
          .catch(async () => {
            console.log("Trying alternative selector for card number field");
            await stripeFrame.waitForSelector('input[placeholder="1234 1234 1234 1234"]', {visible: true, timeout: 5000});
          });
        
        const cardNumberSelector = '[placeholder="1234 1234 1234 1234"]';
        console.log("Card number field found. Starting to type card number...");
        
        // Remove spaces from card number if present
        const cleanCardNumber = cardInfo.cardNumber.replace(/\s+/g, '');
        
        // Type card number with human-like delays
        for (let i = 0; i < cleanCardNumber.length; i++) {
          try {
            await stripeFrame.type(cardNumberSelector, cleanCardNumber[i], {delay: Math.floor(Math.random() * 150) + 50});
            
            // Add occasional longer pause between groups of 4 digits
            if ((i + 1) % 4 === 0 && i < cleanCardNumber.length - 1) {
              await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), Math.floor(Math.random() * 300) + 100);
            }
          } catch (e) {
            console.error(`Error typing digit ${i+1} of card number: ${e.message}`);
            throw e;
          }
        }
        console.log("Successfully typed card number");
        
        // Add a small delay between card fields
        await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), 1000);
        
        // Expiration Date
        console.log("Locating expiration date input...");
        const expirySelector = '#Field-expiryInput, [placeholder="MM / YY"]';
        
        await stripeFrame.waitForSelector(expirySelector, {visible: true, timeout: 5000})
          .catch(async () => {
            console.log("Trying alternative selector for expiry field");
            await stripeFrame.waitForSelector('#Field-expiryInput, [placeholder="MM / YY"]', {visible: true, timeout: 5000});
          });
        
        // Get the expiration from card info and format it correctly (remove any separators)
        const expiryDate = cardInfo.cardExpiration.replace(/[\s\/\-\.]+/g, '');
        console.log("Starting to type expiration date...");
        
        // Type expiry with human-like delays
        for (let i = 0; i < expiryDate.length; i++) {
          await stripeFrame.type(expirySelector, expiryDate[i], {delay: Math.floor(Math.random() * 150) + 50});
        }
        
        console.log("Successfully typed expiration date");
        
        // Add a small delay between card fields
        await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), 1000);
        
        // CVC/Security Code
        console.log("Locating CVC/security code input...");
        const cvcSelector = '#Field-cvcInput, [placeholder="CVC"]';
        
        await stripeFrame.waitForSelector(cvcSelector, {visible: true, timeout: 5000})
          .catch(async () => {
            console.log("Trying alternative selector for CVC field");
            await stripeFrame.waitForSelector('#Field-cvcInput, [placeholder="CVC"]', {visible: true, timeout: 5000});
          });
        
        console.log("Starting to type CVC...");
        // Type CVC with human-like delays
        for (let i = 0; i < cardInfo.cardCVC.length; i++) {
          await stripeFrame.type(cvcSelector, cardInfo.cardCVC[i], {delay: Math.floor(Math.random() * 150) + 50});
        }
        
        console.log("Successfully typed CVC");
        
        // Billing Country
        console.log("Looking for country dropdown...");
        const billingCountrySelector = '#Field-countryInput, [name="country"]';
        
        try {
          // Wait for country selector to be available
          await stripeFrame.waitForSelector(billingCountrySelector, {visible: true, timeout: 5000})
            .catch(async () => {
              console.log("Standard country selector not found, trying alternatives...");
              await stripeFrame.waitForSelector('select[id*="Field-countryInput" i], select[name*="country" i]', {visible: true, timeout: 5000});
            });
          
          // Select country
          const country = bookingData.billing.country || "US";
          console.log(`Selecting country: ${country}`);
          
          await stripeFrame.select(billingCountrySelector, country)
            .catch(async () => {
              console.log("Trying alternative selector for country...");
              await stripeFrame.select('select[id*="country" i], select[name*="country" i]', country);
            });
          
          console.log("Country selected successfully");
        } catch (e) {
          console.error(`Error selecting country: ${e.message}`);
          // Continue anyway as this field might not be required or present on all forms
        }
        
        // Postal Code / ZIP
        console.log("Looking for postal code / ZIP input...");
        const postalCodeSelector = '#Field-postalCodeInput, [name="postalCode"]';
        
        try {
          // Wait for postal code field to be available
          await stripeFrame.waitForSelector(postalCodeSelector, {visible: true, timeout: 5000})
            .catch(async () => {
              console.log("Standard postal code selector not found, trying alternatives...");
              await stripeFrame.waitForSelector('input[id*="Field-postalCodeInput" i], input[name*="postalCode" i]', {visible: true, timeout: 5000});
            });
          
          // Get postal code value
          const postalCode = cardInfo.cardZip || bookingData.billing.postcode || '';
          console.log(`Using postal code: ${postalCode}`);
          
          // Type postal code with human-like delays
          for (let i = 0; i < postalCode.length; i++) {
            await stripeFrame.type(postalCodeSelector, postalCode[i], {delay: Math.floor(Math.random() * 150) + 50})
              .catch(async () => {
                console.log("Trying alternative selector for postal code...");
                await stripeFrame.type('input[id*="Field-postalCodeInput" i], input[name*="postalCode" i]', postalCode[i], {delay: Math.floor(Math.random() * 150) + 50});
              });
          }
          
          console.log("Postal code entered successfully");
        } catch (e) {
          console.error(`Error entering postal code: ${e.message}`);
          // Continue anyway as this field might be auto-filled based on country
        }
        
      } catch (e) {
        console.error(`Error completing payment form: ${e.message}`);
        throw e;
      }
      
      // Handle save card info checkbox
      try {
        console.log("Handling save card info checkbox...");
        const saveCardSelector = '#checkbox-linkOptIn';
        const fallbackSelector = 'input[type="checkbox"][name="linkOptIn"], input[type="checkbox"][aria-label*="save my information" i]';
      
        // Check if the checkbox exists and is checked
        const saveCardExists = await stripeFrame.evaluate((selector) => {
          const checkbox = document.querySelector(selector);
          return checkbox && checkbox.offsetParent !== null && checkbox.checked;
        }, saveCardSelector).catch(() => false);
      
        if (saveCardExists) {
          console.log("Unchecking save card checkbox...");
          try {
            await stripeFrame.waitForSelector(saveCardSelector, { visible: true, timeout: 5000 });
            await stripeFrame.click(saveCardSelector, { delay: 200 });
          } catch (e) {
            console.error(`Error unchecking save card checkbox: ${e.message}`);
            if (e.message.includes('Execution context was destroyed')) {
              console.log("Navigation detected. Re-acquiring iframe...");
              const { stripeFrame: newStripeFrame } = await locateStripeFrame(page, frame);
              stripeFrame = newStripeFrame;
              await stripeFrame.waitForSelector(saveCardSelector, { visible: true, timeout: 5000 });
              await stripeFrame.click(saveCardSelector, { delay: 200 });
              console.log("Checkbox unchecked after re-acquiring iframe");
            } else {
              await stripeFrame.click(fallbackSelector, { delay: 200 }).catch(() => {
                console.warn("Failed to uncheck with fallback selector");
              });
            }
          }
        } else if (saveCardExists === false) {
          console.log("Save card checkbox not found or already unchecked. Skipping...");
        }
      
        // Give the form a moment to process
        await stripeFrame.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), 2000);
      
        console.log("Checkbox handling complete");
      } catch (e) {
        console.error(`Error in checkbox handling: ${e.message}`);
      }
      
      console.log("Payment form filled successfully.");
      // Finished filling out payment information
      
      // // Type CVV with delays
      // await cvvFrame.waitForSelector('[name="cvc"]', {visible: true, timeout: 10000});
      
      // for (let i = 0; i < bookingData.card_cvv.length; i++) {
      //   await cvvFrame.type('[name="cvc"]', bookingData.card_cvv[i], {delay: Math.floor(Math.random() * 150) + 50});
      // }
      
      // Add short pause after filling payment info
      await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), Math.floor(Math.random() * 1000) + 500);
      
      console.log("Payment information entered successfully");
      
    } catch (error) {
      throw new Error(`Failed to fill form or enter payment details: ${error.message}`);
    }

    // Check for complete and pay button
    console.log("Looking for Complete and Pay button...");
    
    try {
      // Find the complete and pay button in the frame
      await frame.waitForSelector(
        '[data-test-id="complete-and-pay-submit-button"]',
        { visible: true, timeout: 15000 }
      );
      console.log("Complete and Pay button is visible");

      // Check if button is enabled before proceeding
      const isButtonEnabled = await frame.evaluate((selector) => {
        try {
          const button = document.querySelector(selector);
          return button && !button.disabled;
        } catch (e) {
          console.error(`Error when checking button status: ${e.message}`);
          // Return false on error so we wait and retry
          return false;
        }
      }, '[data-test-id="complete-and-pay-submit-button"]');

      if (!isButtonEnabled) {
        console.log("Complete and Pay button is not enabled yet. Waiting...");
        // Wait for button to become enabled
        await page.evaluate(
          (timeout) => new Promise((resolve) => setTimeout(resolve, timeout)),
          5000
        );
      }

      // Solve CAPTCHA using puppeteer-extra-plugin-recaptcha
      console.log("Starting hCaptcha solving process...");

      // Check if CAPTCHA API key is available
      console.log("CAPTCHA API Key available:", !!process.env.CAPTCHA_API_KEY);

      // Get the site key from environment variable
      const sitekey = process.env.BAY_CRUISE_TICKETING_SITE_KEY;

      if (!sitekey) {
        console.warn(
          "No site key found in environment variables, attempting to extract from page"
        );
      }

      // Try to extract site key from page if not available in environment variables
      const extractedSiteKey = await page.evaluate(() => {
        try {
          // Use a safer selector that doesn't rely on attribute value containing specific text
          const hcaptchaIframes = Array.from(
            document.querySelectorAll("iframe")
          ).filter(
            (iframe) =>
              iframe.src && iframe.src.includes("hcaptcha.com/captcha")
          );

          if (hcaptchaIframes.length > 0) {
            for (const iframe of hcaptchaIframes) {
              const src = iframe.getAttribute("src");
              const siteKeyMatch = src.match(/sitekey=([^&]+)/);
              if (siteKeyMatch && siteKeyMatch[1]) {
                return siteKeyMatch[1];
              }
            }
          }
          return null;
        } catch (e) {
          console.error(`Error extracting site key: ${e.message}`);
          return null;
        }
      });

      const captchaSiteKey = sitekey || extractedSiteKey;

      if (!captchaSiteKey) {
        throw new Error("Could not find hCaptcha site key");
      }

      console.log("Using hCaptcha site key for solving...");

      // Method 1: Try using the puppeteer-extra recaptcha plugin first
      try {
        console.log(
          "Attempting to solve invisible hCaptcha using puppeteer-extra-plugin-recaptcha..."
        );

        // Get all frames in the page
        const frames = page.frames();
        console.log(`Found ${frames.length} frames in the page`);
        
        // Find the frame containing the hCaptcha
        const captchaFrame = frames.find(frame => {
          return frame.url().includes('hcaptcha.com');
        });
        
        if (captchaFrame) {
          console.log("Found hCaptcha iframe at URL:", captchaFrame.url());
          
          // Specify that this is an hCaptcha and provide the sitekey
          const solved = await page.solveRecaptchas({
            captchaType: "hcaptcha",
            sitekey: captchaSiteKey,
            isInvisible: true,
            frameUrl: captchaFrame.url() // Target the specific frame
          });
          
          console.log("CAPTCHA solving result:", solved);
          
          if (solved && solved.solutions && solved.solutions.length > 0) {
            console.log(
              "Successfully solved invisible hCaptcha with puppeteer-extra-plugin-recaptcha"
            );
          } else {
            throw new Error(
              "No hCaptcha solutions found with puppeteer-extra-plugin-recaptcha"
            );
          }
        } else {
          console.log("Could not find hCaptcha iframe, attempting to solve without frame targeting");
          
          // Fallback to regular approach
          const solved = await page.solveRecaptchas({
            captchaType: "hcaptcha",
            sitekey: captchaSiteKey,
            isInvisible: true
          });
          
          console.log("CAPTCHA solving result:", solved);
          
          if (solved && solved.solutions && solved.solutions.length > 0) {
            console.log(
              "Successfully solved invisible hCaptcha with puppeteer-extra-plugin-recaptcha"
            );
          } else {
            throw new Error(
              "No hCaptcha solutions found with puppeteer-extra-plugin-recaptcha"
            );
          }
        }
      } catch (recaptchaPluginError) {
        console.error(
          "Error using recaptcha plugin:",
          recaptchaPluginError.message
        );

        // Method 2: Fallback to manual 2Captcha integration if plugin failed
        console.log("Falling back to manual 2Captcha integration...");

        // Initialize the 2captcha solver with API key
        const apiKey = process.env.CAPTCHA_API_KEY;
        console.log("2Captcha API key available:", !!apiKey, "(length:", apiKey?.length || 0, ")");
        const solver = new Solver(apiKey);

        // Solve the hCaptcha
        console.log("Sending request to 2Captcha service...");
        console.log("Using site key:", captchaSiteKey);
        console.log("Page URL for captcha:", page.url());

        const { data: token } = await solver.hcaptcha({
          sitekey: captchaSiteKey,
          pageurl: page.url(),
          invisible: true,
        });

        if (!token) {
          throw new Error("No captcha token returned from 2Captcha");
        }

        console.log("Successfully received token from 2Captcha!");

        // Inject the token into the page
        await page.evaluate((token) => {
          console.log("Searching for CAPTCHA response fields in DOM...");

          // Find existing fields
          const fields = [
            ...document.querySelectorAll(
              'textarea[name="h-captcha-response"], ' +
                'textarea[name="g-recaptcha-response"]'
            ),
          ];

          console.log(`Found ${fields.length} response fields`);

          // Set token in fields
          fields.forEach((field) => {
            field.value = token;

            // Trigger events to notify page of changes
            ["input", "change", "blur"].forEach((eventType) => {
              field.dispatchEvent(new Event(eventType, { bubbles: true }));
            });
          });

          // Create fallback field if none found
          if (fields.length === 0) {
            console.log("No existing fields found, creating fallback field");
            const newField = document.createElement("textarea");
            newField.name = "h-captcha-response";
            newField.style.display = "none";
            newField.value = token;
            document.body.appendChild(newField);
          }

          // Trigger hCaptcha API if available
          if (typeof hcaptcha !== "undefined") {
            console.log("hCaptcha API detected, submitting via API");
            const widgets = hcaptcha.getWidgets();

            widgets.forEach((widget) => {
              hcaptcha.submit(widget.id);
            });
          }

          return true;
        }, token);

        console.log("CAPTCHA token injected successfully");
      }

      // Wait a moment after solving CAPTCHA before clicking the button
      await page.evaluate(
        (timeout) => new Promise((resolve) => setTimeout(resolve, timeout)),
        Math.floor(Math.random() * 2000) + 1000
      );

      // Now click the Complete and Pay button
      console.log("Clicking Complete and Pay button...");

      // Scroll to the button first
      await frame.evaluate((selector) => {
        const button = document.querySelector(selector);
        if (button) {
          button.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, '[data-test-id="complete-and-pay-submit-button"]');

      // Add human-like delay
      await page.evaluate(
        (timeout) => new Promise((resolve) => setTimeout(resolve, timeout)),
        Math.floor(Math.random() * 1000) + 500
      );

      // Click the button using JavaScript for more reliable interaction
      console.log("Attempting to click Complete and Pay button using JavaScript...");
      
      try {
        // First try JavaScript click for more reliable interaction
        await frame.evaluate(() => {
          const button = document.querySelector('[data-test-id="complete-and-pay-submit-button"]');
          if (button) {
            console.log('Button found, clicking with JavaScript...');
            button.click();
            return true;
          } else {
            console.log('Button not found in DOM');
            return false;
          }
        });
        
        console.log("JavaScript click completed");
        
        // As a fallback, also try the puppeteer click
        // await frame.click('[data-test-id="complete-and-pay-submit-button"]');
        // console.log("Complete and Pay button clicked (Puppeteer method)");
      } catch (clickError) {
        console.error("Error during button click:", clickError.message);
        // Try one more time with force: true as last resort
        await frame.click('[data-test-id="complete-and-pay-submit-button"]', { force: true });
        console.log("Forced click on Complete and Pay button");
      }

      // Wait for a short time to let any immediate errors appear
      await page.evaluate(
        (timeout) => new Promise((resolve) => setTimeout(resolve, timeout)),
        2000
      );

      // Check for payment error messages
      console.log("Checking for payment error messages...");

      // Check for flash error message
      const flashErrorExists = await frame
        .evaluate(() => {
          const errorContainer = document.querySelector(
            '[data-test-id="test-flash-message-indicator"]'
          );
          return errorContainer && errorContainer.offsetParent !== null; // Check if visible
        })
        .catch(() => false);

      console.log("Payment message container visible:", flashErrorExists);

      if (flashErrorExists) {
        // Get the error message text
        const errorMessage = await frame.evaluate(() => {
          const errorContainer = document.querySelector(
            '[data-test-id="test-flash-message-indicator"]'
          );
          return errorContainer ? errorContainer.textContent.trim() : "";
        });

        console.log("Payment Message:", errorMessage);

        // Handle different error scenarios
        if (errorMessage.includes("Your card was declined")) {
          throw new Error("Payment failed: Card was declined.");
        } else if (
          errorMessage.includes(
            "We are unable to authenticate your payment method"
          )
        ) {
          throw new Error(
            "Payment failed: Unable to authenticate payment method."
          );
        } else if (
          errorMessage.includes(
            "An error occurred while processing your payment"
          )
        ) {
          throw new Error("Payment not completed: Processing error occurred.");
        } else if (errorMessage.includes("Something went wrong")) {
          console.log("Something went wrong. Please try again later.");
          throw new Error("Something went wrong. Please try again later.");
        } else if (errorMessage) {
          console.log("Payment message:", errorMessage);
          throw new Error("Payment not completed: " + errorMessage);
        }
      } else {
        console.log("Payment message error div is not visible.");
      }

      // Wait longer for payment processing and to check for different outcomes
      console.log("Waiting for payment processing and confirmation...");
      await page.evaluate(
        (timeout) => new Promise((resolve) => setTimeout(resolve, timeout)),
        12000
      );
// ***************************************************
      // Check for insufficient funds error
      console.log("Checking for insufficient funds error...");
      let insufficientFundsError = false;
      
      // Verify frame is valid before evaluating
      if (frame && typeof frame.evaluate === 'function') {
        try {
          insufficientFundsError = await frame.evaluate(() => {
            const elements = Array.from(document.querySelectorAll("*"));
            const errorElement = elements.find(
              (el) =>
                el.textContent &&
                el.textContent.includes(
                  "Could not process payment because the account has insufficient funds"
                )
            );
            return errorElement && errorElement.offsetParent !== null; // Check if visible
          }).catch(() => false);
          console.log("Insufficient funds error visible:", insufficientFundsError);
        } catch (frameError) {
          console.error("Error checking for insufficient funds:", frameError.message);
          insufficientFundsError = false;
        }
      } else {
        console.error("Frame is not available or invalid for checking insufficient funds error");
        insufficientFundsError = false;
      }

      if (insufficientFundsError) {
        throw new Error(
          "Payment failed due to insufficient funds. Please try another card or contact your card issuer."
        );
      }

      // Check for booking confirmation header
      console.log("Checking for booking confirmation...");
      let bookingConfirmationExists = false;
      
      // Verify frame is valid before evaluating
      if (frame && typeof frame.evaluate === 'function') {
        try {
          bookingConfirmationExists = await frame.evaluate(() => {
            const header = document.querySelector(
              '[data-test-id="booking-confirmation-header"]'
            );
            return header && header.offsetParent !== null; // Check if visible
          });
          console.log("Booking confirmation header visible:", bookingConfirmationExists);
        } catch (frameError) {
          console.error("Error checking for booking confirmation:", frameError.message);
          bookingConfirmationExists = false;
        }
      } else {
        console.error("Frame is not available or invalid for checking booking confirmation");
        bookingConfirmationExists = false;
      }

      // Check for "Thanks for booking with us!" message
      // Use a longer timeout for final confirmation
      const confirmationTimeout = 30000; // 30 seconds (30 seconds)
      console.log(
        `Waiting up to ${
          confirmationTimeout / 1000
        } seconds for thank you message...`
      );

      // Using evaluate with setTimeout to implement a custom wait with text checking
      let thankYouMessageVisible = false;
      
      // Verify frame is valid before evaluating
      if (frame && typeof frame.evaluate === 'function') {
        try {
          console.log("Starting thank you message check in frame...");
          thankYouMessageVisible = await frame.evaluate((timeout) => {
            return new Promise((resolve) => {
              // Check immediately first
              const checkForMessage = () => {
                // More comprehensive search - check all elements and common confirmation texts
                const elements = Array.from(document.querySelectorAll("*"));
                
                // Look for common confirmation phrases
                const confirmationPhrases = [
                  "Thanks for booking with us",
                  "Thank you for booking",
                  "Thanks for your booking",
                  "booking confirmation",
                  "order confirmed",
                  "successfully booked",
                  "booking complete"
                ];
                
                // Check if any element contains any of the phrases
                const thankYouElement = elements.find(el => {
                  if (!el || !el.textContent) return false;
                  const text = el.textContent.toLowerCase();
                  return confirmationPhrases.some(phrase => text.includes(phrase.toLowerCase()));
                });
                
                if (thankYouElement && thankYouElement.offsetParent !== null) {
                  console.log("Found confirmation text:", thankYouElement.textContent.trim());
                  return true;
                }
                
                // Also check for booking confirmation elements by specific selectors
                const confirmSelectors = [
                  '[data-test-id="booking-confirmation-header"]',
                  '.confirmation-header',
                  '.booking-success',
                  '.success-message',
                  '.thank-you-message',
                  '.confirmation-page'
                ];
                
                for (const selector of confirmSelectors) {
                  const element = document.querySelector(selector);
                  if (element && element.offsetParent !== null) {
                    console.log("Found confirmation element with selector:", selector);
                    return true;
                  }
                }
                
                return false;
              };

              // Check now
              if (checkForMessage()) {
                resolve(true);
                return;
              }

              // Set up interval checking
              const startTime = Date.now();
              const interval = setInterval(() => {
                if (checkForMessage()) {
                  clearInterval(interval);
                  resolve(true);
                } else if (Date.now() - startTime > timeout) {
                  clearInterval(interval);
                  resolve(false);
                }
              }, 1000); // Check every second
            });
          }, confirmationTimeout);
        } catch (frameError) {
          console.error("Error checking for thank you message:", frameError.message);
          thankYouMessageVisible = false;
        }
      } else {
        console.error("Frame is not available or invalid for checking thank you message");
        thankYouMessageVisible = false;
      }

      // Make sure we strictly enforce finding the thank you message
      if (thankYouMessageVisible) {
        console.log("Thank you message found! Booking confirmed successfully!");
        try {
              await Order.findOneAndUpdate(
                { orderId: bookingData.id, websiteName: 'Fort Sumter Ticketing' },  // Match by both orderId and websiteName
                { status: 'Passed', failureReason: null },  // Update the status field to 'Failed'
                { new: true }  // Return the updated document
              );
            } catch (err) {
              console.error("Error updating order status:", err);
            }
      } else {
        // If message wasn't found after timeout, throw an error to trigger catch block
        throw new Error("Booking confirmation message 'Thanks for booking with us!' not found after timeout");
      }

      // Create successful-orders-screenshots directory if it doesn't exist
      const successDir = path.join(__dirname, "successful-orders-screenshots");
      if (!fs.existsSync(successDir)) {
        await fs.promises.mkdir(successDir, { recursive: true });
      }

      // Take screenshot of confirmation page with order ID in filename
      const screenshotFileName = `${bookingData.id}-order-success.png`;
      const screenshotPath = path.join(successDir, screenshotFileName);
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });

      console.log(`Saved confirmation screenshot locally`);

      // Send confirmation email with screenshot
      console.log("Sending confirmation email...");
      await sendEmail(
        bookingData.id, // order number
        `Try ${
          tries + 1
        }. The final screen snip is attached for your reference.`, // order description
        "farhan.qat123@gmail.com", // recipient email address
        ["tickets@fortsumterticketing.com"], // CC email addresses
        // [],
        screenshotPath, // path to the screenshot
        screenshotFileName,
        true, // Success status
        "FortSumterTicketing"
      );

      // Process service charges
      console.log("Processing service charges...");
      const serviceChargesAmount = bookingData.bookingServiceCharges.replace(
        "$",
        ""
      );
      // const isServiceChargesDeducted = await ServiceCharges(
      //   serviceChargesAmount,
      //   bookingData.id,
      //   bookingData.card.number,
      //   bookingData.card.expiration,
      //   bookingData.card.cvc,
      //   bookingData.billing?.postcode,
      //   bookingData.billing?.email,
      //   "Fort Sumter Ticketing"
      // );

      // Update order status
      // if (isServiceChargesDeducted) {
      //   console.log("Service charges processed, updating order status...");
      //   // Order status options: auto-draft, pending, processing, on-hold, completed, cancelled, refunded, failed, checkout-draft
      //   const updatedOrder = await updateOrderStatus(
      //     "Fort Sumter Ticketing",
      //     bookingData.id,
      //     "completed"
      //   );
      //   console.log(
      //     `Order #${bookingData.id} status changed to ${updatedOrder?.status} successfully!`
      //   );
      // }

      return { success: true, message: "Booking completed successfully!" };
    } catch (error) {
      console.error("Error during checkout process:", error.message);
      
      
       try {
            await Order.findOneAndUpdate(
              { orderId: bookingData.id, websiteName: 'Fort Sumter Ticketing' },  // Match by both orderId and websiteName
              { status: 'Failed', failureReason: error?.message || error },  // Update the status field to 'Failed'
              { new: true }  // Return the updated document
            );
          } catch (err) {
            console.error("Error updating order status:", err);
          }
      

      // Create directory for error screenshots
      const errorsDir = path.join(__dirname, "errors-screenshots");
      if (!fs.existsSync(errorsDir)) {
        await fs.promises.mkdir(errorsDir, { recursive: true });
      }
      
      // Take screenshot of error state with order ID
      const screenshotFileName = `${bookingData.id}-error-screenshot.png`;
      const screenshotPath = path.join(errorsDir, screenshotFileName);
      await page.screenshot({
        path: screenshotPath,
        fullPage: true
      });
      
      // // Send error email
      try {
        await sendEmail(
          bookingData.id, // order number
          `Try ${tries + 1}.The final screen snip is attached for your reference. ${error.message ? `ERRMSG: ` + error.message : ""}`, // order description
          "farhan.qat123@gmail.com", // recipient email address
          ['tickets@fortsumterticketing.com'], // CC email addresses
          // [],
          screenshotPath, // path to the screenshot
          screenshotFileName,
          false, // Failed status
          "FortSumterTicketing"
        );
      } catch (emailError) {
        console.log("Sending mail Error", emailError);
      }
      
      return {
        success: false,
        error: error.message,
        errorScreenshot: screenshotFileName,
      };
    }

  } finally {
    // Close browser if it exists
    if (browser) {
      console.log("Closing browser...");
      // await browser.close();
    }
  }
}


module.exports = { FortSumterTickets };
