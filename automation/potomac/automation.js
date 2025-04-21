const { chromium, firefox } = require('playwright');
const { expect } = require('@playwright/test');
const { incrementTickets, expectedIncrementTickets, getCardType, formatDate, formatCardDate, typeWithDelay, sendEmail, toTitleCase, getRandomTime, removeSpaces, getRandomUserAgent } = require('./helper');
const { Solver } = require('@2captcha/captcha-solver');
const fs = require('fs');  
const path  = require('path');
const { ServiceCharges } = require('./automation/service-charges');
require('dotenv').config();


async function potomacTourBooking(bookingData, tries) {
    const browser = await firefox.launch(launchOptions);
    const userAgent = getRandomUserAgent();
    console.log('User Agent:', userAgent);
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: userAgent,
    });
    const page = await context.newPage();
    await page.setDefaultTimeout(170000);
    await expect.configure({timeout: 130000});

    const solver = new Solver(process.env.CAPTCHA_API_KEY)

}

module.exports = { potomacTourBooking };