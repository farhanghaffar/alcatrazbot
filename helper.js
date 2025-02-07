const { expect } = require('@playwright/test');
const nodemailer = require('nodemailer');
const path = require('path');

// Function to send email
async function sendEmail(orderNumber, orderDescription, recipientEmail, ccEmails, screenshotPath, screenshotFileName, passed = false) {
  // Create a transporter object using Gmail SMTP
  let transporter = nodemailer.createTransport({
    service: 'gmail', // Gmail service
    auth: {
      user: 'farhan.qat321@gmail.com', // Your Gmail address
      pass: 'tedj tjzy oaso rgsd'   // Your Gmail password or app-specific password
    }
  });

  let subject = '';
  let html = '';
  if(passed) {
    subject = `Order #${orderNumber} Automation Successful`;
    html = `<p>A new order with ID <strong>${orderNumber}</strong> has successfully automated. ${orderDescription}</p>`;
  } else {
    subject = `Order #${orderNumber} Automation Failed`;
    html = `<p>A new order automation with ID <strong>${orderNumber}</strong> was unfortunately failed. ${orderDescription}</p>`;
  }

  // Prepare the email content
  let mailOptions = {
    from: 'farhan.qat321@gmail.com',  // Sender address
    to: recipientEmail, // Main recipient email
    // cc: ccEmails, // CC recipients
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

async function typeWithDelay(locator, text, maxDelay = 5000) {
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

module.exports = { incrementTickets, expectedIncrementTickets, getCardType, formatDate, formatCardDate, typeWithDelay, sendEmail, toTitleCase };