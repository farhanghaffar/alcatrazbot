const { expect } = require('@playwright/test');
const nodemailer = require('nodemailer');
const path = require('path');
const UserAgent = require('user-agents');
require("dotenv").config();

const senderEmailAddress = process.env.SENDER_EMAIL;
const senderEmailPassword = process.env.SENDER_EMAIL_PSWD;

// Function to send email
async function sendEmail(orderNumber, orderDescription, recipientEmail, ccEmails, screenshotPath, screenshotFileName, passed = false, automationSite = '') {
  // Create a transporter object using Gmail SMTP
  let transporter = nodemailer.createTransport({
    service: 'gmail', // Gmail service
    auth: {
      user: senderEmailAddress, // Your Gmail address
      pass: senderEmailPassword   // Your Gmail password or app-specific password
    }
  });

  let subject = '';
  let html = '';
  if(passed) {
    subject = `${automationSite} Order #${orderNumber} Automation Successful`;
    html = `<p>A new order of <b>${automationSite}</b> with ID <strong>${orderNumber}</strong> has successfully automated. ${orderDescription}</p>`;
  } else {
    subject = `${automationSite} Order #${orderNumber} Automation Failed`;
    html = `<p>A new order automation of <b>${automationSite}</b> with ID <strong>${orderNumber}</strong> was unfortunately failed. ${orderDescription}</p>`;
  }

  // Prepare the email content
  let mailOptions = {
    from: 'farhan.qat321@gmail.com',  // Sender address
    to: recipientEmail, // Main recipient email
    cc: ccEmails, // CC recipients
    subject: subject, // Dynamic subject
    // text: `A new order with ID ${orderNumber} has successfully automated. ${orderDescription}`, // Plain text body
    html: html, // HTML body
    attachments: [
      {
        filename: screenshotFileName, // Name of the file to attach
        path: screenshotPath, // Path to the screenshot passed as parameter
      }
    ]
  };

  // Send the email
  return transporter.sendMail(mailOptions);  // Return the promise to handle errors outside
}

function getRandomUserAgent() {
    const useMobile = Math.random() < 0.6; // 60% chance for mobile
    let userAgent;

    do {
      if (useMobile) {
        userAgent = new UserAgent({ deviceCategory: 'mobile' }).toString();
      } else {
        userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();

        if (userAgent.includes('Windows')) {
          // Force Firefox on Windows using regex match
          userAgent = new UserAgent({ deviceCategory: 'desktop' }, /Firefox/).toString();
        }
      }
    } while (userAgent.includes('Chrome'));

    return userAgent;
}


async function incrementTickets(frameHandle, ticketType, quantity) {
    // for(let i = 0; i < quantity; i++) {
    //     await frameHandle.locator(`[data-bdd="${ticketType}"]`).getByLabel('Increment').first().click();
    //     await new Promise(resolve => setTimeout(resolve, 500));
    // }
    for(let i = 0; i < quantity; i++) {
      let ticketSelectionDiv = frameHandle.locator(`.ticket-qty-selector-item`).filter({hasText: ticketType, has: frameHandle.locator('button[data-bdd="increment-button"]')});
      const ticketSelectionDivVisible = await ticketSelectionDiv.first().isVisible();
      if(!ticketSelectionDivVisible) {
        ticketSelectionDiv = frameHandle.locator(`[data-bdd="ticket-selection-list-item"]`).filter({hasText: ticketType, has: frameHandle.locator('button[data-bdd="increment-button"]')});
      }
      await ticketSelectionDiv.getByLabel('Increment').first().click();
      await new Promise(resolve => setTimeout(resolve, 500));
  }
}
async function expectedIncrementTickets(frameHandle, ticketType, quantity) {
      // await expect(frameHandle.getByRole('paragraph').filter({ hasText: `${ticketType}: ${quantity}` }).first()).toBeVisible(); 
}

function getCardType(cardNumber) {
    if (cardNumber.startsWith('4')) {
        return 'Visa';
      } else if (cardNumber.startsWith('5')) {
        return 'Mastercard';
      } else if (cardNumber.startsWith('6')) {
        return 'Discover';
      } else if (cardNumber.startsWith('35') || cardNumber.startsWith('2131') || cardNumber.startsWith('1800')) {
        return 'JCB';
      } else if (cardNumber.startsWith('36') || cardNumber.startsWith('38') || cardNumber.startsWith('39')) {
        return 'Diners Club';
      } else {
        return null;
      }
}

function formatDate(inputDate) {
  // Split the input string into month, day, and year
  const [month, day, year] = inputDate.split('/');

  // Construct the desired date format as 'YYYY-MM-DD'
  const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

  return formattedDate;
}

function formatCardDate(inputDate) {
  const [month, year] = inputDate.split('/');

  // Convert the year part to a full 4-digit year, assuming '20' prefix
  const fullYear = `20${year}`;

  return { cardMonth: month, cardYear: fullYear };
}

async function typeWithDelay(locator, text, maxDelay = 3000) {
  for (let i = 0; i < text.length; i++) {
      await locator.type(text[i], {
          delay: Math.random() * maxDelay, // Random delay up to `maxDelay`
      });
  }
}

function toTitleCase(str) {
  return str
    .toLowerCase() // Convert the string to lowercase first
    .split(' ') // Split the string by spaces
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize the first character of each word
    .join(' '); // Join the words back together
}

function getRandomTime() {
  return Math.floor(Math.random() * 10000);  // Random time between 0 and 9999 milliseconds
}

function removeSpaces(inputString) {
  return inputString.replace(/\s+/g, '');  // Remove all spaces
}

// Function to send service charges deduction email
async function sendServiceChargesDeductionEmail(orderNumber, serviceChargesAmount, recipientEmail, ccEmails, screenshotPath, screenshotFileName, passed = false, ticketingSite = "") {
  // Create a transporter object using Gmail SMTP
  let transporter = nodemailer.createTransport({
    service: 'gmail', // Gmail service
    auth: {
      user: senderEmailAddress, // Your Gmail address
      pass: senderEmailPassword   // Your Gmail password or app-specific password
    }
  });

  let subject = '';
  let html = '';
  if(passed) {
    subject = `Service Charges on ${ticketingSite} for Order #${orderNumber} Charged Successfully`;
    html = `<p>The service charges on <b>${ticketingSite}</b> for your order with ID <strong>${orderNumber}</strong> have been successfully processed. The service charge amount is $<strong>${serviceChargesAmount}</strong>.</p>`;
  } else {
    subject = `Service Charges Deduction on ${ticketingSite} for Order #${orderNumber} Failed`;
    html = `<p>Unfortunately, the service charges on <b>${ticketingSite}</b> for your order with ID <strong>${orderNumber}</strong> could not be processed. The service charge amount was $<strong>${serviceChargesAmount}</strong>.</p>`;
  }

  // Prepare the email content
  let mailOptions = {
    from: 'farhan.qat321@gmail.com',  // Sender address
    to: recipientEmail, // Main recipient email
    cc: ccEmails, // CC recipients
    subject: subject, // Dynamic subject
    // text: `A new order with ID ${orderNumber} has successfully automated. ${orderDescription}`, // Plain text body
    html: html, // HTML body
    attachments: [
      {
        filename: screenshotFileName, // Name of the file to attach
        path: screenshotPath, // Path to the screenshot passed as parameter
      }
    ]
  };

  // Send the email
  return transporter.sendMail(mailOptions);  // Return the promise to handle errors outside
}

function formatAndValidateCardExpirationDate(inputDate) {
  // Check if the input is in the correct format (MM/YY)
  const regex = /^(0[1-9]|1[0-2])\/(\d{2})$/;
  const match = inputDate.match(regex);

  if (!match) {
      throw new Error(`Card Expiry Date: Invalid date format: "${inputDate}". Expected format is MM/YY.`);
  }

  // Extract the month and year from the matched input
  const [_, month, year] = match;

  // Convert the year part to a full 4-digit year, assuming '20' prefix
  const fullYear = `20${year}`;

  // Convert the month to a number for validation
  const cardMonth = Number(month);
  const cardYear = Number(fullYear);

  // Get the current year and month for comparison
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // Months are 0-indexed

  // Validate the month (should be between 1 and 12)
  if (cardMonth < 1 || cardMonth > 12) {
      throw new Error(`Card Expiry Date: Invalid month: ${cardMonth}. Month should be between 1 and 12.`);
  }

  // Validate the year (should not be a past year)
  if (cardYear < currentYear || (cardYear === currentYear && cardMonth < currentMonth)) {
      throw new Error(`Card Expiry Date: Invalid expiration date: ${month}/${year}. The card has expired.`);
  }
  const cardMonthString = cardMonth.toString()
  const cardYearString = cardYear.toString()

  // Apply padStart only if the month is a single digit
const formattedCardMonth = cardMonthString.length === 1 ? cardMonthString.padStart(2, '0') : cardMonthString;


  // Return valid month and year
  return { cardMonth: formattedCardMonth, cardYear: cardYearString };
}


module.exports = { incrementTickets, expectedIncrementTickets, sendServiceChargesDeductionEmail, getCardType, formatDate, formatCardDate, typeWithDelay, sendEmail, toTitleCase, getRandomTime, removeSpaces, getRandomUserAgent, formatAndValidateCardExpirationDate };