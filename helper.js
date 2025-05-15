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

async function sendEmailForDeclinedServiceChargesCardPayments(
  clientName,
  tourName = "Alcatraz tour",
  serviceChargesAmount,
  alcatrazChargesAmount,
  address1,
  address2,
  addressCity,
  addressState,
  addressCountry,
  recipientEmail,
  phonenumber,
  ccEmails,
  ticketingSite = ""
) {
  console.log(
    "Data to Send Email:",
    clientName,
    tourName,
    serviceChargesAmount,
    alcatrazChargesAmount,
    address1,
    address2,
    addressCity,
    addressState,
    addressCountry,
    recipientEmail,
    phonenumber,
    ccEmails,
    ticketingSite
  );

  // Create a transporter object using Gmail SMTP
  let transporter = nodemailer.createTransport({
    service: "gmail", // Gmail service
    auth: {
      user: senderEmailAddress, // Your Gmail address
      pass: senderEmailPassword, // Your Gmail password or app-specific password
    },
  });

  let subject = "Service Charges Payment Declined – Action Required";
  let html = `
   <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px;">
    <p>Hi ${clientName},</p>

    <p>
      Thank you for choosing us for your upcoming <strong>${tourName}</strong>—we appreciate your business and look forward to your visit!
    </p>

    <p>
      We were able to charge the card and secure your tickets, but the service fee transaction was declined by the bank.
      Can you please submit payment for <strong>$${serviceChargesAmount}</strong> via the following link to complete the transaction?
    </p>

    <p>
      <a href="https://buy.stripe.com/9AQ03u0tpcto8FyeVh" style="color: #007bff;">https://buy.stripe.com/9AQ03u0tpcto8FyeVh</a>
    </p>

    <p>Here is a copy of your receipt details that outline the 2 charges:</p>

    <table style="width: 100%; border-collapse: collapse; border: 1px solid #ccc;">
      <tr style="background-color: #f9f9f9;">
        <td colspan="2" style="padding: 10px; border: 1px solid #ccc;">
          Please note: You will receive two charges on your credit card bill for this order:
        </td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ccc;"><a href="https://www.alcatrazticketing.com/" style="color: #007bff;">Alcatraz.click</a></td>
        <td style="padding: 10px; border: 1px solid #ccc;">$${serviceChargesAmount}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ccc;">Alcatraz City Cruises</td>
        <td style="padding: 10px; border: 1px solid #ccc;">$${alcatrazChargesAmount}</td>
      </tr>
    </table>

    <h3 style="color: #00bcd4; margin-top: 30px;">Billing address</h3>
    <div style="border: 1px solid #ccc; padding: 20px 10px">
    <p style="margin: 0;">
    ${address1}<br>
    ${address2 && address2}<br>
    ${addressCity}<br>
    ${addressState}<br>
    ${addressCountry}<br>
    ${recipientEmail}<br>
    ${phonenumber}<br>
    </p>
    </div>

    <p style="margin-top: 30px;">Once completed, your order will be finalized. Your tickets have already been delivered and can be used by scanning the QR code for entry.</p>

    <p>Thank you,<br><strong>The Ticketing Team</strong></p>
    
    <div style="background-color: #E8E8E8; padding: 15px 0 0 0">
        <h4><a href="http://alcatraz.click/" style="text-decoration: none; color: #108a00;">Alcatraz Island Tour Tickets in the San Francisco Bay</a></h4>
        <p>Book Alcatraz Island tour tickets for an unforgettable visit to the historic prison. Explore cellblocks, scenic views, and rich history in San Francisco!</p>
        <h5>Alcatraz Tickets</h5>
    </div>
  </div>
`;

  // Prepare the email content
  let mailOptions = {
    from: "farhan.qat321@gmail.com", // Sender address
    to: recipientEmail, // Main recipient email
    cc: ccEmails, // CC recipients
    subject: subject, // Dynamic subject
    html: html, // HTML body
  };

  // Send the email
  return transporter.sendMail(mailOptions); // Return the promise to handle errors outside
}

async function sendEmailForDeclinedCardPayments(
  clientName,
  tourName = "Alcatraz tour",
  recipientEmail,
  ccEmails,
  ticketingSite = ""
) {

  // Create a transporter object using Gmail SMTP
  let transporter = nodemailer.createTransport({
    service: "gmail", // Gmail service
    auth: {
      user: senderEmailAddress, // Your Gmail address
      pass: senderEmailPassword, // Your Gmail password or app-specific password
    },
  });

  let subject = "Payment Declined – Action Needed to Secure Your Alcatraz Tickets";
  let html = `
   <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px;">
    <p>Hi ${clientName},</p>

    <p>
      Thank you for choosing us for your upcoming <strong>${tourName}</strong>—we appreciate your business and look forward to your visit!
    </p>

    <p style="color: #d9534f;">
      We wanted to bring to your attention that the transaction was <strong>declined by your card-issuing bank</strong>.
    </p>

    <p>To proceed with your booking, please either:</p>
    <ol style="">
     <li> <strong>Contact your bank</strong> to approve the charge, or</li>
     <li> <strong>Provide an alternative payment method</strong> through our <strong>secure website at 
        <a href="https://alcatrazticketing.com" style="color: #007bff;">alcatrazticketing.com</a></strong>
      </li>
    </ol>

    <p>
      We want to ensure your tickets are finalized without any interruption, so we appreciate your prompt attention to this matter.
    </p>

    <p>If you have any questions or need assistance, please don't hesitate to reach out.</p>

    <p>Best regards,<br>
    <strong>The Alcatraz Ticketing Team</strong></p>
    
    <div style="background-color: #E8E8E8; padding: 15px 0 0 0">
        <h4><a href="http://alcatraz.click/" style="text-decoration: none; color: #108a00;">Alcatraz Island Tour Tickets in the San Francisco Bay</a></h4>
        <p>Book Alcatraz Island tour tickets for an unforgettable visit to the historic prison. Explore cellblocks, scenic views, and rich history in San Francisco!
    </p>
        <h5>Alcatraz Tickets</h5>
    </div>
    
  </div>
`;

  // Prepare the email content
  let mailOptions = {
    from: "farhan.qat321@gmail.com", // Sender address
    to: recipientEmail, // Main recipient email
    cc: ccEmails, // CC recipients
    subject: subject, // Dynamic subject
    html: html, // HTML body
  };

  // Send the email
  return transporter.sendMail(mailOptions); // Return the promise to handle errors outside
}

function addOneHour(timeSlot) {
  // Split the time slot into start and end times
  const [start, end] = timeSlot.split(' - ');

  // Helper function to increase time by 1 hour
  function increaseByOneHour(time) {
    let [hours, minutes] = time.split(':');
    let period = minutes.includes('AM') ? 'AM' : 'PM';
    
    hours = parseInt(hours);
    minutes = minutes.split(' ')[0]; // Remove AM/PM for minutes part

    // Add 1 hour to the start time
    hours += 1;
    if (hours === 12 && period === 'AM') {
      period = 'PM'; // Convert 12:00 AM to 12:00 PM
    }
    if (hours > 12) {
      hours = 1; // After 12:00 PM, start again from 1:00 PM
      if (period === 'PM') period = 'AM'; // Toggle between AM and PM
    }

    return `${hours}:${minutes} ${period}`;
  }

  // Increase the end time by 1 hour
  const newEnd = increaseByOneHour(start);

  return `${start} - ${newEnd}`;
}

module.exports = { incrementTickets, expectedIncrementTickets, sendServiceChargesDeductionEmail, getCardType, formatDate, formatCardDate, typeWithDelay, sendEmail, toTitleCase, getRandomTime, removeSpaces, getRandomUserAgent, formatAndValidateCardExpirationDate, sendEmailForDeclinedServiceChargesCardPayments, sendEmailForDeclinedCardPayments, addOneHour };