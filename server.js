const express = require('express');
const bodyParser = require('body-parser');
const { statueTicketingBookTour } = require('./statueticketing-booking');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { alcatrazBookTour } = require('./alcatraz-booking');
const cors = require('cors');
const { ServiceCharges } = require('./automation/service-charges');
require('dotenv').config();
const { potomacTourBooking } = require('./automation/potomac/automation');
const { BayCruiseTickets } = require('./automation/bay-cruise-tickets/automation');
const { bostonHarborCruise } = require('./automation/boston-harbor-cruise/automation');
const { NiagaraCruiseTickets } = require('./automation/niagara-cruise-tickets/automation');
const { FortSumterTickets } = require('./automation/fort-sumter-tickets/automation');
const { KennedySpaceCenterTickets } = require('./automation/kennedy-space-center-tickets/automation');
// Import MongoDB connection and schemas
const { connectToMongoDB, getDb, closeConnection, isConnected, getPaginatedRecords, ObjectId } = require('./db/mongodb');
const { initializeFailedOrdersSchema } = require('./db/failedOrdersSchema');
const { initializeUsersSchema } = require('./db/usersSchema');

// Import utility modules
const { recordFailedOrder, getFailedOrderById, updateFailedOrder, getPendingFailedOrders } = require('./utils/db/failedOrders');
const { processOrderWithRetries, processManualRetry } = require('./utils/retry/orderProcessor');
const { initCronJobs } = require('./utils/cron');

// Users schema is now imported directly in the routes files

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 4000;

// SSL options with error handling
// let sslOptions;
// try {
//     sslOptions = {
//         key: fs.readFileSync(path.join(__dirname, 'certificates', 'key.pem')),
//         cert: fs.readFileSync(path.join(__dirname, 'certificates', 'cert.pem'))
//     };
// } catch (error) {
//     console.error('Error loading SSL certificates:', error);
//     console.log('Please run: node certificates/generate-certificates.js');
//     process.exit(1);
// }

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Cors middleware
app.use(cors());

// API routes
app.use('/api', require('./api/routes'));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Middleware to verify WooCommerce webhook signature
const verifyWooCommerceWebhook = (req, res, next) => {
    const signature = req.headers['x-wc-webhook-signature'];
    const payload = JSON.stringify(req.body);
    const secret = process.env.WOOCOMMERCE_WEBHOOK_SECRET || 'z6>9w P`}@5^9A~X,sX)-Qw)B< Z#e@j4xbCp:7hW-z{fl{ ?]';

    const hash = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('base64');

    if (hash === signature) {
        next();
    } else {
        res.status(401).json({ error: 'Invalid webhook signature' });
    }
};

// Webhook endpoint with verification | https://www.statueticketing.com/
app.post('/webhook', async (req, res) => {
    console.log('Order data:', JSON.stringify(req.body));
    
    const reqBody = req.body;

    try {
        // Extract relevant data from WooCommerce order
        const orderData = {
            id: reqBody.id,
            tourType: '',
            bookingDate: '',
            bookingTime: '',
            bookingServiceCharges: '',
            bookingSubTotal: '',
            personNames: [],
            adults: 0,
            childs: 0,
            military: 0,
            seniors: 0,
            card: {
                cvc: '',
                expiration: '',
                number: '',
            },
            billing: {
                first_name: reqBody?.billing?.first_name,
                last_name: reqBody?.billing?.last_name,
                company: reqBody?.billing?.company,
                address_1: reqBody?.billing?.address_1,
                address_2: reqBody?.billing?.address_2,
                city: reqBody?.billing?.city,
                state: reqBody?.billing?.state,
                postcode: reqBody?.billing?.postcode,
                country: reqBody?.billing?.country,
                email: reqBody?.billing?.email,
                phone: reqBody?.billing?.phone
            },
        };

        reqBody?.line_items[0]?.meta_data.forEach(item => {
            switch (item.key) {
                case 'Tour Type':
                    orderData.tourType = item?.value;
                    break;
                case 'Booking Date':
                    orderData.bookingDate = item?.value;
                    break;
                case 'Booking Time':
                    orderData.bookingTime = item?.value;
                    break;
                case 'Person Names':
                    orderData.personNames = item?.value.split(', ').map(name => name.trim());
                    break;
                case 'Service Charges':
                    orderData.bookingServiceCharges = item?.value;
                    break;
                default:
                    // Check for keywords "child", "adult", "military", and "senior" in the key to update counts
                    if (item.key.toLowerCase().includes('child')) {
                        const childCount = item?.value.split(' x ')[0];
                        orderData.childs = parseInt(childCount, 10);
                    } else if (item.key.toLowerCase().includes('senior')) {
                        const seniorCount = item?.value.split(' x ')[0];
                        orderData.seniors = parseInt(seniorCount, 10);
                    } else if (item.key.toLowerCase().includes('adult')) {
                        const adultCount = item?.value.split(' x ')[0];
                        orderData.adults = parseInt(adultCount, 10);
                    } else if (item.key.toLowerCase().includes('military')) {
                        const militaryCount = item?.value.split(' x ')[0];
                        orderData.military = parseInt(militaryCount, 10);
                    }
                    break;
            }
        });

        reqBody.meta_data.forEach(item => {
            if (item.key.toLowerCase() === 'credit_card_cvc') {
                orderData.card.cvc = item?.value;
            } else if (item.key.toLowerCase() === 'credit_card_expiration') {
                orderData.card.expiration = item?.value;
            } else if (item.key.toLowerCase() === 'credit_card_number') {
                orderData.card.number = item.value;
            }
        });

        console.log('After manipulation, data is: ', orderData);

        // Send response immediately to avoid webhook timeouts
        res.status(200).json({
            message: 'Webhook received. Processing in background.'
        });

        // Now, run the automation process in the background.
        // (Optionally, wrap the background processing in setImmediate if you want to decouple further.)
        let tries = 0;
        const maxRetries = 3;
        let bookingResult = await statueTicketingBookTour(orderData, tries);

        // Retry logic
        while (tries < maxRetries - 1 && !bookingResult.success && !bookingResult?.error?.includes('Payment not completed') && !bookingResult?.error?.includes('Expected format is MM/YY.') && !bookingResult?.error?.includes('Month should be between 1 and 12.') && !bookingResult?.error?.includes('The card has expired.')) {
            tries++;
            console.log(`Retry attempt #${tries}...`);
            bookingResult = await statueTicketingBookTour(orderData, tries);
        }
        
        if (bookingResult.success) {
            console.log('Booking automation completed successfully');
        } else {
            console.error('Booking automation failed:', bookingResult.error);
        }
    } catch (error) {
        console.error('Error processing webhook:', error);
        // Response already sent, so you can log the error.
    }
});

// Webhook endpoint with verification | https://www.alcatrazticketing.com/
app.post('/alcatraz-webhook', async (req, res) => {
    console.log('🎫 Alcatraz Webhook Received - Order ID:', req.body?.id);
    console.log('📄 Request body:', JSON.stringify(req.body, null, 2).substring(0, 500) + '...');
    
    // Send response immediately to prevent webhook timeouts
    res.status(200).json({
        message: 'Webhook received. Processing in background.'
    });
    
    // Store the complete original webhook payload for future retries
    const originalWebhookPayload = JSON.parse(JSON.stringify(req.body));
    const reqBody = req.body;

    try {
        // Extract relevant data from WooCommerce order
        const orderData = {
            id: reqBody.id,
            orderId: reqBody.id.toString(), // Ensure string format for DB
            tourType: reqBody?.line_items[0]?.name,
            bookingDate: '',
            bookingTime: '',
            bookingServiceCharges: '',
            bookingSubTotal: '',
            personNames: [],
            adults: 0,
            childs: 0,
            juniors: 0,
            seniors: 0,
            card: {
                cvc: '',
                expiration: '',
                number: '',
            },
            billing: {
                first_name: reqBody?.billing?.first_name,
                last_name: reqBody?.billing?.last_name,
                company: reqBody?.billing?.company,
                address_1: reqBody?.billing?.address_1,
                address_2: reqBody?.billing?.address_2,
                city: reqBody?.billing?.city,
                state: reqBody?.billing?.state,
                postcode: reqBody?.billing?.postcode,
                country: reqBody?.billing?.country,
                email: reqBody?.billing?.email,
                phone: reqBody?.billing?.phone
            },
        };

        reqBody?.line_items[0]?.meta_data.forEach(item => {
            switch (item.key) {
                case '_booking_tourType':
                    orderData.tourType += ' ' + item?.value;
                    break;
                case '_booking_date':
                    orderData.bookingDate = item?.value;
                    break;
                case '_booking_time':
                    orderData.bookingTime = item?.value;
                    break;
                case '_booking_serviceCharges':
                    orderData.bookingServiceCharges = item?.value;
                    break;
                case '_booking_subTotal':
                    orderData.bookingSubTotal = item?.value;
                    break;
                // case 'Person Names':
                //     orderData.personNames = item?.value.split(', ').map(name => name.trim());
                //     break;
                default:
                    // Check for keywords "child", "adult", "juniors" and "senior" in the key to update counts
                    if (item.key.toLowerCase() === '_booking_children') {
                        orderData.childs = parseInt(item.value, 10);
                    } else if (item.key.toLowerCase() === '_booking_seniors') {
                        orderData.seniors = parseInt(item.value, 10);
                    } else if (item.key.toLowerCase() === '_booking_adults') {
                        orderData.adults = parseInt(item.value, 10);
                    } else if (item.key.toLowerCase() === '_booking_juniors') {
                        orderData.juniors = parseInt(item.value, 10);
                    }
                    break;
            }
        });

        reqBody.meta_data.forEach(item => {
            if (item.key.toLowerCase() === 'credit_card_cvc') {
                orderData.card.cvc = item?.value;
            } else if (item.key.toLowerCase() === 'credit_card_expiration') {
                orderData.card.expiration = item?.value;
            } else if (item.key.toLowerCase() === 'credit_card_number') {
                orderData.card.number = item.value;
            }
        });
        
        console.log('Extracted order data ready for processing');
        
        // Process booking with built-in retries using the generic function
        const result = await processOrderWithRetries({
            orderData,
            originalWebhookPayload, // Pass the complete original webhook payload
            bookingFunction: alcatrazBookTour,
            webhookUrl: '/alcatraz-webhook',
            websiteName: 'Alcatraz Island Tours',
            terminalErrorPatterns: [
                'Payment not completed',
                'Expected format is MM/YY.',
                'Month should be between 1 and 12.',
                'The card has expired.'
            ]
        });
        
        if (result.success) {
            console.log('✅ Alcatraz booking completed successfully');
        }
        // Failed case is handled inside the processOrderWithRetries function
        
    } catch (error) {
        console.error('❌ Error processing Alcatraz webhook:', error);
        // Response already sent, so we can only log the error
    }
});

// To charge service fee for booking 
// app.post('/charge', async (req, res) => {
//     try {
//       const { paymentMethodId, amount, currency, description } = req.body;
//   
//       // Convert dollars to cents
//       const amountInCents = Math.round(amount * 100);
//       
//       if (isNaN(amountInCents) || amountInCents < 50) {
//         throw new Error('Invalid amount');
//       }
//       
//       const paymentIntent = await stripe.paymentIntents.create({
//         amount: amountInCents,
//         currency: currency || 'usd',
//         payment_method: paymentMethodId,
//         // Restrict to card only if needed
//         payment_method_types: ['card'],
//         // Include description here
//         description,
//         confirmation_method: 'manual',
//         confirm: true,
//       });
//       
//       res.status(200).json({ success: true });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
// });

// To charge service fee for booking 
app.post('/charge', async (req, res) => {
    try {
      const { paymentMethodId, amount, currency, description } = req.body;
  
      // Convert dollars to cents
      const amountInCents = Math.round(amount * 100);
      
      if (isNaN(amountInCents) || amountInCents < 50) {
        throw new Error('Invalid amount');
      }

    // Extract the site name from the description (first word before space)
    const siteNameMatch = description.match(/^([^\s]+)/);
    const siteName = siteNameMatch ? siteNameMatch[0] : 'Alcatraz';  // Default to 'DefaultSite' if no match

    // Create dynamic statement descriptor (Prefix + Suffix)
    let statementDescriptorPrefix = siteName.toUpperCase();  
    const maxPrefixLength = 17; 

    // Truncate the prefix if it's longer than 15 characters (to leave space for "* SC")
    if (statementDescriptorPrefix.length > maxPrefixLength) {
      statementDescriptorPrefix = statementDescriptorPrefix.slice(0, maxPrefixLength);
    }

    const statementDescriptorSuffix = "SC"; 

    // Construct the full statement descriptor
    const statementDescriptor = `${statementDescriptorPrefix}* ${statementDescriptorSuffix}`;
    console.log("Statement Descriptor:", statementDescriptor);
    
    if (statementDescriptor.length > 22) {
      throw new Error('Statement descriptor exceeds 22 characters');
    }
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: currency || 'usd',
        payment_method: paymentMethodId,
        // Restrict to card only if needed
        payment_method_types: ['card'],
        // Include description here
        description,
        statement_descriptor: statementDescriptor,
        confirmation_method: 'manual',
        confirm: true,
      });
      
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

// Enhanced health check endpoint
app.get('/health', (req, res) => {
  try {
    const dbStatus = getDb() ? 'connected' : 'disconnected';
    res.json({
      status: 'healthy',
      time: new Date().toISOString(),
      db: dbStatus,
      uptime: process.uptime()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// Webhook endpoint with verification | http://potomacticketing.com/
app.post('/potomac-webhook', async (req, res) => {
    console.log('Order data:', JSON.stringify(req.body));
    
    const reqBody = req.body;

    try {
        // Extract relevant data from WooCommerce order
        const orderData = {
            id: reqBody.id,
            tourType: '',
            bookingDate: '',
            bookingTime: '',
            bookingServiceCharges: '',
            bookingSubTotal: '',
            personNames: [],
            ticketQuantity: 0,
            card: {
                cvc: '',
                expiration: '',
                number: '',
            },
            billing: {
                first_name: reqBody?.billing?.first_name,
                last_name: reqBody?.billing?.last_name,
                company: reqBody?.billing?.company,
                address_1: reqBody?.billing?.address_1,
                address_2: reqBody?.billing?.address_2,
                city: reqBody?.billing?.city,
                state: reqBody?.billing?.state,
                postcode: reqBody?.billing?.postcode,
                country: reqBody?.billing?.country,
                email: reqBody?.billing?.email,
                phone: reqBody?.billing?.phone
            },
        };

        reqBody?.line_items[0]?.meta_data.forEach(item => {
            switch (item.key) {
                case 'Tour Type':
                    orderData.tourType = item?.value;
                    break;
                case 'Booking Date':
                    orderData.bookingDate = item?.value;
                    break;
                case 'Booking Time':
                    orderData.bookingTime = item?.value;
                    break;
                case 'Service Charges':
                    orderData.bookingServiceCharges = item?.value;
                    break;
                case 'One Day Pass Quantity':
                    orderData.ticketQuantity = item?.value;
                    break;
                
                case 'Two Day Pass Quantity':
                    orderData.ticketQuantity = item?.value;
                    break;

                default:
                    break;
            }
        });

        reqBody.meta_data.forEach(item => {
            if (item.key.toLowerCase() === 'credit_card_cvc') {
                orderData.card.cvc = item?.value;
            } else if (item.key.toLowerCase() === 'credit_card_expiration') {
                orderData.card.expiration = item?.value;
            } else if (item.key.toLowerCase() === 'credit_card_number') {
                orderData.card.number = item.value;
            }
        });

        console.log('Potomac: After manipulation, data is: ', orderData);

        // Send response immediately to prevent webhook timeouts
        res.status(200).json({
            message: 'Potomac Webhook received. Processing in background.'
        });

        setImmediate(async () => {
            try {
                console.log('Starting booking automation process...');
                let tries = 0;
                const maxRetries = 3;
                let bookingResult = await potomacTourBooking(orderData, tries);
                
                // Retry logic
                while (tries < maxRetries - 1 && !bookingResult.success && !bookingResult?.error?.includes('Payment not completed') && !bookingResult?.error?.includes('Expected format is MM/YY.') && !bookingResult?.error?.includes('Month should be between 1 and 12.') && !bookingResult?.error?.includes('The card has expired.')) {
                    tries++;
                    console.log(`Retry attempt #${tries}...`);
                    bookingResult = await potomacTourBooking(orderData, tries);
                }
        
                if (bookingResult.success) {
                    console.log('Potomac Booking automation completed successfully');
                } else {
                    console.error('Potomac Booking automation failed:', bookingResult.error);
                }
            } catch (automationError) {
                console.error('Potomac Error in booking automation:', automationError);
            }
        });

        
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(200).json({
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Webhook endpoint with verification | https://baycruisetickets.com/
app.post('/bay-cruise-tickets-webhook', async (req, res) => {
    console.log('Bay Cruises Tickets: Order data:', JSON.stringify(req.body));
    
    const reqBody = req.body;

    try {
        // Extract relevant data from WooCommerce order
        const orderData = {
            id: reqBody.id,
            tourType: '',
            bookingDate: '',
            bookingTime: '',
            bookingServiceCharges: '',
            bookingSubTotal: '',
            personNames: [],
            ticketQuantity: 0,
            adults: 0,
            childs: 0,
            juniors: 0,
            seniors: 0,
            military: 0,
            child_under_five: 0,
            card: {
                cvc: '',
                expiration: '',
                number: '',
            },
            billing: {
                first_name: reqBody?.billing?.first_name,
                last_name: reqBody?.billing?.last_name,
                company: reqBody?.billing?.company,
                address_1: reqBody?.billing?.address_1,
                address_2: reqBody?.billing?.address_2,
                city: reqBody?.billing?.city,
                state: reqBody?.billing?.state,
                postcode: reqBody?.billing?.postcode,
                country: reqBody?.billing?.country,
                email: reqBody?.billing?.email,
                phone: reqBody?.billing?.phone
            },
        };

        reqBody?.line_items[0]?.meta_data.forEach(item => {
            switch (item.key) {
                case 'Tour Type':
                    orderData.tourType = item?.value;
                    break;
                case 'Booking Date':
                    orderData.bookingDate = item?.value;
                    break;
                case 'Booking Time':
                    orderData.bookingTime = item?.value;
                    break;
                case 'Service Charges':
                    orderData.bookingServiceCharges = item?.value;
                    break;
                case 'Subtotal':
                    orderData.bookingSubTotal = item?.value;
                    break;

                default:
                    // Check for keywords "child", "adult", "juniors" and "senior" in the key to update counts
                    if (item.key.toLowerCase() === 'child (ages 5-11) quantity') {
                        orderData.childs = parseInt(item.value, 10);
                    } else if (item.key.toLowerCase() === 'senior (ages 65+) quantity') {
                        orderData.seniors = parseInt(item.value, 10);
                    } else if (item.key.toLowerCase() === 'adult quantity') {
                        orderData.adults = parseInt(item.value, 10);
                    } else if (item.key.toLowerCase() === 'junior (ages 12-17) quantity') {
                        orderData.juniors = parseInt(item.value, 10);
                    } else if (item.key.toLowerCase() === 'military quantity') {
                        orderData.military = parseInt(item.value, 10);
                    } else if (item.key.toLowerCase() === 'child (under 5) quantity') {
                        orderData.child_under_five = parseInt(item.value, 10);
                    }
                    break;
            }
        });

        reqBody.meta_data.forEach(item => {
            if (item.key.toLowerCase() === 'credit_card_cvc') {
                orderData.card.cvc = item?.value;
            } else if (item.key.toLowerCase() === 'credit_card_expiration') {
                orderData.card.expiration = item?.value;
            } else if (item.key.toLowerCase() === 'credit_card_number') {
                orderData.card.number = item.value;
            }
        });

        console.log('Bay Cruises Tickets: After manipulation, data is: ', orderData);

        // Send response immediately to prevent webhook timeouts
        res.status(200).json({
            message: 'Bay Cruises Tickets: Webhook received. Processing in background.'
        });

        setImmediate(async () => {
            try {
                console.log('Starting booking automation process...');
                let tries = 0;
                const maxRetries = 3;
                let bookingResult = await BayCruiseTickets(orderData, tries);
                
                // Retry logic
                while (tries < maxRetries - 1 && !bookingResult.success && !bookingResult?.error?.includes('Payment not completed') && !bookingResult?.error?.includes('Expected format is MM/YY.') && !bookingResult?.error?.includes('Month should be between 1 and 12.') && !bookingResult?.error?.includes('The card has expired.')) {
                    tries++;
                    console.log(`Retry attempt #${tries}...`);
                    bookingResult = await BayCruiseTickets(orderData, tries);
                }
        
                if (bookingResult.success) {
                    console.log('Bay Cruises Tickets: Booking automation completed successfully');
                } else {
                    console.error('Bay Cruises Tickets: Booking automation failed:', bookingResult.error);
                }
            } catch (automationError) {
                console.error('Bay Cruises Tickets: Error in booking automation:', automationError);
            }
        });

        
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(200).json({
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Webhook endpoint with verification | http://bostoncruisetickets.com/
app.post('/boston-harbor-cruise-tickets-webhook', async (req, res) => {
    console.log('Order data:', JSON.stringify(req.body));
    
    const reqBody = req.body;

    try {
        // Extract relevant data from WooCommerce order
        const orderData = {
            id: reqBody.id,
            tourType: '',
            bookingDate: '',
            bookingTime: '',
            bookingServiceCharges: '',
            bookingSubTotal: '',
            personNames: [],
            ticketQuantity: 0,
            adults: 0,
            childs: 0,
            child_under_three: 0,
            card: {
                cvc: '',
                expiration: '',
                number: '',
            },
            billing: {
                first_name: reqBody?.billing?.first_name,
                last_name: reqBody?.billing?.last_name,
                company: reqBody?.billing?.company,
                address_1: reqBody?.billing?.address_1,
                address_2: reqBody?.billing?.address_2,
                city: reqBody?.billing?.city,
                state: reqBody?.billing?.state,
                postcode: reqBody?.billing?.postcode,
                country: reqBody?.billing?.country,
                email: reqBody?.billing?.email,
                phone: reqBody?.billing?.phone
            },
        };

        reqBody?.line_items[0]?.meta_data.forEach(item => {
            switch (item.key) {
                case 'Tour Type':
                    orderData.tourType = item?.value;
                    break;
                case 'Booking Date':
                    orderData.bookingDate = item?.value;
                    break;
                case 'Booking Time':
                    orderData.bookingTime = item?.value;
                    break;
                case 'Service Charges':
                    orderData.bookingServiceCharges = item?.value;
                    break;
                case 'Subtotal':
                    orderData.bookingSubTotal = item?.value;
                    break;

                default:
                    // Check for keywords "child", "adult", "juniors" and "senior" in the key to update counts
                    if (item.key.toLowerCase() === 'child (3-11) quantity') {
                        orderData.childs = parseInt(item.value, 10);
                    } else if (item.key.toLowerCase() === 'adult quantity') {
                        orderData.adults = parseInt(item.value, 10);
                    } else if (item.key.toLowerCase() === 'child (under 3) quantity') {
                        orderData.child_under_three = parseInt(item.value, 10);
                    }
                    break;
            }
        });

        reqBody.meta_data.forEach(item => {
            if (item.key.toLowerCase() === 'credit_card_cvc') {
                orderData.card.cvc = item?.value;
            } else if (item.key.toLowerCase() === 'credit_card_expiration') {
                orderData.card.expiration = item?.value;
            } else if (item.key.toLowerCase() === 'credit_card_number') {
                orderData.card.number = item.value;
            }
        });

        console.log('Boston Harbor Cruise: After manipulation, data is: ', orderData);

        // Send response immediately to prevent webhook timeouts
        res.status(200).json({
            message: 'Boston Harbor Cruise Tickets Webhook received. Processing in background.'
        });

        setImmediate(async () => {
            try {
                console.log('Starting Boston harbor cruise booking automation process...');
                let tries = 0;
                const maxRetries = 3;
                let bookingResult = await bostonHarborCruise(orderData, tries);
                
                // Retry logic
                while (tries < maxRetries - 1 && !bookingResult.success && !bookingResult?.error?.includes('Payment not completed') && !bookingResult?.error?.includes('Expected format is MM/YY.') && !bookingResult?.error?.includes('Month should be between 1 and 12.') && !bookingResult?.error?.includes('The card has expired.')) {
                    tries++;
                    console.log(`Retry attempt #${tries}...`);
                    bookingResult = await bostonHarborCruise(orderData, tries);
                }
        
                if (bookingResult.success) {
                    console.log('Boston Harbar Cruise Booking automation completed successfully');
                } else {
                    console.error('Boston Harbar Cruise Booking automation failed:', bookingResult.error);
                }
            } catch (automationError) {
                console.error('Error in Boston Harbar Cruise booking automation:', automationError);
            }
        });

        
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(200).json({
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Webhook endpoint with verification |  https://niagaracruisetickets.com/
app.post('/niagara-cruise-tickets-webhook', async (req, res) => {
    console.log('Order data:', JSON.stringify(req.body));
    
    const reqBody = req.body;

    try {
        // Extract relevant data from WooCommerce order
        const orderData = {
            id: reqBody.id,
            tourType: '',
            bookingDate: '',
            bookingTime: '',
            bookingServiceCharges: '',
            bookingSubTotal: '',
            personNames: [],
            ticketQuantity: 0,
            adults: 0,
            childs: 0,
            infant_under_two: 0,
            card: {
                cvc: '',
                expiration: '',
                number: '',
            },
            billing: {
                first_name: reqBody?.billing?.first_name,
                last_name: reqBody?.billing?.last_name,
                company: reqBody?.billing?.company,
                address_1: reqBody?.billing?.address_1,
                address_2: reqBody?.billing?.address_2,
                city: reqBody?.billing?.city,
                state: reqBody?.billing?.state,
                postcode: reqBody?.billing?.postcode,
                country: reqBody?.billing?.country,
                email: reqBody?.billing?.email,
                phone: reqBody?.billing?.phone
            },
        };

        reqBody?.line_items[0]?.meta_data.forEach(item => {
            switch (item.key) {
                case 'Tour Type':
                    orderData.tourType = item?.value;
                    break;
                case 'Booking Date':
                    orderData.bookingDate = item?.value;
                    break;
                case 'Booking Time':
                    orderData.bookingTime = item?.value;
                    break;
                case 'Service Charges':
                    orderData.bookingServiceCharges = item?.value;
                    break;
                case 'Subtotal':
                    orderData.bookingSubTotal = item?.value;
                    break;

                default:
                    // Check for keywords "child", "adult", "juniors" and "senior" in the key to update counts
                    if (item.key.toLowerCase() === 'child (3 - 12)  quantity') {
                        orderData.childs = parseInt(item.value, 10);
                    } else if (item.key.toLowerCase() === 'adult (13+)  quantity') {
                        orderData.adults = parseInt(item.value, 10);
                    } else if (item.key.toLowerCase() === 'infant (2 and under) quantity') {
                        orderData.infant_under_two = parseInt(item.value, 10);
                    }
                    break;
            }
        });

        reqBody.meta_data.forEach(item => {
            if (item.key.toLowerCase() === 'credit_card_cvc') {
                orderData.card.cvc = item?.value;
            } else if (item.key.toLowerCase() === 'credit_card_expiration') {
                orderData.card.expiration = item?.value;
            } else if (item.key.toLowerCase() === 'credit_card_number') {
                orderData.card.number = item.value;
            }
        });

        console.log('Niagara Cruise: After manipulation, data is: ', orderData);

        // Send response immediately to prevent webhook timeouts
        res.status(200).json({
            message: 'Niagara Cruise Tickets Webhook received. Processing in background.'
        });

        setImmediate(async () => {
            try {
                console.log('Starting Niagara cruise booking automation process...');
                let tries = 0;
                const maxRetries = 3;
                let bookingResult = await NiagaraCruiseTickets(orderData, tries);
                
                // Retry logic
                while (tries < maxRetries - 1 && !bookingResult.success && !bookingResult?.error?.includes('Payment not completed') && !bookingResult?.error?.includes('Expected format is MM/YY.') && !bookingResult?.error?.includes('Month should be between 1 and 12.') && !bookingResult?.error?.includes('The card has expired.')) {
                    tries++;
                    console.log(`Retry attempt #${tries}...`);
                    bookingResult = await NiagaraCruiseTickets(orderData, tries);
                }
        
                if (bookingResult.success) {
                    console.log('Niagara Cruise Booking automation completed successfully');
                } else {
                    console.error('Niagara Cruise Cruise Booking automation failed:', bookingResult.error);
                }
            } catch (automationError) {
                console.error('Error in Niagara Cruise booking automation:', automationError);
            }
        });

        
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(200).json({
            message: 'Internal server error',
            error: error.message
        });
    }
});


// Webhook endpoint with verification | https://fortsumterticketing.com/
app.post('/fort-sumter-ticketing-webhook', async (req, res) => {
    console.log('Fort Sumter Tickets: Order data:', JSON.stringify(req.body));
    
    const reqBody = req.body;

    try {
        // Extract relevant data from WooCommerce order
        const orderData = {
            id: reqBody.id,
            tourType: '',
            bookingDate: '',
            bookingTime: '',
            bookingServiceCharges: '',
            bookingSubTotal: '',
            personNames: [],
            ticketQuantity: 0,
            adults: 0,
            childs: 0,
            senior_military: 0,
            infants_under_three: 0,
            card: {
                cvc: '',
                expiration: '',
                number: '',
            },
            billing: {
                first_name: reqBody?.billing?.first_name,
                last_name: reqBody?.billing?.last_name,
                company: reqBody?.billing?.company,
                address_1: reqBody?.billing?.address_1,
                address_2: reqBody?.billing?.address_2,
                city: reqBody?.billing?.city,
                state: reqBody?.billing?.state,
                postcode: reqBody?.billing?.postcode,
                country: reqBody?.billing?.country,
                email: reqBody?.billing?.email,
                phone: reqBody?.billing?.phone
            },
        };

        reqBody?.line_items[0]?.meta_data.forEach(item => {
            switch (item.key) {
                case 'Tour Type':
                    orderData.tourType = item?.value;
                    break;
                case 'Booking Date':
                    orderData.bookingDate = item?.value;
                    break;
                case 'Booking Time':
                    orderData.bookingTime = item?.value;
                    break;
                case 'Service Charges':
                    orderData.bookingServiceCharges = item?.value;
                    break;
                case 'Subtotal':
                    orderData.bookingSubTotal = item?.value;
                    break;

                default:
                    // Check for keywords "child", "adult", "juniors" and "senior" in the key to update counts
                    if (item.key.toLowerCase() === 'children (4-11) quantity') {
                        orderData.childs = parseInt(item.value, 10);
                    } else if (item.key.toLowerCase() === 'adult (12-61) quantity') {
                        orderData.adults = parseInt(item.value, 10);
                    } else if (item.key.toLowerCase() === 'senior/military (62 & older/active military) quantity') {
                        orderData.senior_military = parseInt(item.value, 10);
                    } else if (item.key.toLowerCase() === 'infants (ages 3 & younger) quantity') {
                        orderData.infants_under_three = parseInt(item.value, 10);
                    }
                    break;
            }
        });

        reqBody.meta_data.forEach(item => {
            if (item.key.toLowerCase() === 'credit_card_cvc') {
                orderData.card.cvc = item?.value;
            } else if (item.key.toLowerCase() === 'credit_card_expiration') {
                orderData.card.expiration = item?.value;
            } else if (item.key.toLowerCase() === 'credit_card_number') {
                orderData.card.number = item.value;
            }
        });

        console.log('Fort Sumter Tickets: After manipulation, data is: ', orderData);

        // Send response immediately to prevent webhook timeouts
        res.status(200).json({
            message: 'Fort Sumter Tickets: Webhook received. Processing in background.'
        });

        setImmediate(async () => {
            try {
                console.log('Starting booking automation process...');
                let tries = 0;
                const maxRetries = 3;
                let bookingResult = await FortSumterTickets(orderData, tries);
                
                // Retry logic
                while (tries < maxRetries - 1 && !bookingResult.success && !bookingResult?.error?.includes('Payment not completed') && !bookingResult?.error?.includes('Expected format is MM/YY.') && !bookingResult?.error?.includes('Month should be between 1 and 12.') && !bookingResult?.error?.includes('The card has expired.')) {
                    tries++;
                    console.log(`Retry attempt #${tries}...`);
                    bookingResult = await FortSumterTickets(orderData, tries);
                }
        
                if (bookingResult.success) {
                    console.log('Fort Sumter Tickets: Booking automation completed successfully');
                } else {
                    console.error('Fort Sumter Tickets: Booking automation failed:', bookingResult.error);
                }
            } catch (automationError) {
                console.error('Fort Sumter Tickets: Error in booking automation:', automationError);
            }
        });

        
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(200).json({
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Webhook endpoint with verification | https://www.kennedyspacecenter.com/
app.post('/kennedy-space-center-ticketing-webhook', async (req, res) => {
    console.log('Kennedy SpaceCenter Tickets: Order data:', JSON.stringify(req.body));
    
    const reqBody = req.body;

    try {
        // Extract relevant data from WooCommerce order
        const orderData = {
            id: reqBody.id,
            tourType: '',
            bookingDate: '',
            bookingTime: '',
            bookingServiceCharges: '',
            bookingSubTotal: '',
            personNames: [],
            ticketQuantity: 0,
            adults: 0,
            childs: 0,
            senior_military: 0,
            infants_under_three: 0,
            card: {
                cvc: '',
                expiration: '',
                number: '',
            },
            billing: {
                first_name: reqBody?.billing?.first_name,
                last_name: reqBody?.billing?.last_name,
                company: reqBody?.billing?.company,
                address_1: reqBody?.billing?.address_1,
                address_2: reqBody?.billing?.address_2,
                city: reqBody?.billing?.city,
                state: reqBody?.billing?.state,
                postcode: reqBody?.billing?.postcode,
                country: reqBody?.billing?.country,
                email: reqBody?.billing?.email,
                phone: reqBody?.billing?.phone
            },
        };

        reqBody?.line_items[0]?.meta_data.forEach(item => {
            switch (item.key) {
                case 'Tour Type':
                    orderData.tourType = item?.value;
                    break;
                case 'Booking Date':
                    orderData.bookingDate = item?.value;
                    break;
                case 'Booking Time':
                    orderData.bookingTime = item?.value;
                    break;
                case 'Service Charges':
                    orderData.bookingServiceCharges = item?.value;
                    break;
                case 'Subtotal':
                    orderData.bookingSubTotal = item?.value;
                    break;

                default:
                    // Check for keywords "child" and "adult" in the key to update counts
                    if (item.key.toLowerCase() === 'child quantity') {
                        orderData.childs = parseInt(item.value, 10);
                    } else if (item.key.toLowerCase() === 'adult quantity') {
                        orderData.adults = parseInt(item.value, 10);
                    }
                    break;
            }
        });

        reqBody.meta_data.forEach(item => {
            if (item.key.toLowerCase() === 'credit_card_cvc') {
                orderData.card.cvc = item?.value;
            } else if (item.key.toLowerCase() === 'credit_card_expiration') {
                orderData.card.expiration = item?.value;
            } else if (item.key.toLowerCase() === 'credit_card_number') {
                orderData.card.number = item.value;
            }
        });

        console.log('Kennedy SpaceCenter Tickets: After manipulation, data is: ', orderData);

        // Send response immediately to prevent webhook timeouts
        res.status(200).json({
            message: 'Kennedy SpaceCenter Tickets: Webhook received. Processing in background.'
        });

        setImmediate(async () => {
            try {
                console.log('Starting booking automation process...');
                let tries = 0;
                const maxRetries = 3;
                let bookingResult = await KennedySpaceCenterTickets(orderData, tries);
                
                // Retry logic
                // while (tries < maxRetries - 1 && !bookingResult.success && !bookingResult?.error?.includes('Payment not completed') && !bookingResult?.error?.includes('Expected format is MM/YY.') && !bookingResult?.error?.includes('Month should be between 1 and 12.') && !bookingResult?.error?.includes('The card has expired.')) {
                //     tries++;
                //     console.log(`Retry attempt #${tries}...`);
                //     bookingResult = await KennedySpaceCenterTickets(orderData, tries);
                // }
        
                if (bookingResult.success) {
                    console.log('Kennedy SpaceCenter Tickets: Booking automation completed successfully');
                } else {
                    console.error('Kennedy SpaceCenter Tickets: Booking automation failed:', bookingResult.error);
                }
            } catch (automationError) {
                console.error('Kennedy SpaceCenter Tickets: Error in booking automation:', automationError);
            }
        });

        
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(200).json({
            message: 'Internal server error',
            error: error.message
        });
    }
});

// === API ROUTES ===
// API routes are already mounted at line 55
// DO NOT mount routes twice
// const apiRoutes = require('./api/routes');
// app.use('/api', apiRoutes);

// === FAILED ORDERS ENDPOINTS ===
// These have been moved to the modular API router structure

// API endpoint to manually trigger cron job for testing
app.post('/api/trigger-cron-retry', async (req, res) => {
  try {
    // Check database connection
    if (!isConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection unavailable'
      });
    }

    const { runCronJobImmediately } = require('./utils/cron/failedOrderRetry');
    await runCronJobImmediately();
    
    res.status(200).json({
      success: true,
      message: 'Cron job triggered successfully'
    });
  } catch (error) {
    console.error('❌ Error triggering cron job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger cron job',
      error: error.message
    });
  }
});

// API endpoint to update a failed order - custom URL path as requested
app.patch('/api/update-order/:id', async (req, res) => {
  try {
    // Check database connection first
    if (!isConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection unavailable',
        databaseStatus: 'disconnected'
      });
    }
    
    const { id } = req.params;
    const updates = req.body;
    
    // Check if ID is valid ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }
    
    // Validate update data
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No update data provided'
      });
    }
    
    // Remove _id from updates if present to prevent errors
    if (updates._id) delete updates._id;
    
    // Add updatedAt timestamp
    updates.updatedAt = new Date();
    
    // Only allow specific fields to be updated for security
    const allowedFields = [
      'status', 'failureReason', 'failureCount', 'websiteName', 
      'updatedAt', 'webhookUrl', 'notes'
    ];
    
    const sanitizedUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        // Special handling for fields with specific requirements
        if (key === 'status') {
          // Status must be one of these values per schema
          const validStatuses = ['failed', 'retried', 'resolved'];
          if (validStatuses.includes(updates[key])) {
            sanitizedUpdates[key] = updates[key];
          }
        } 
        else if (key === 'failureCount') {
          // Convert to integer for schema validation
          sanitizedUpdates[key] = parseInt(updates[key], 10);
        }
        else if (key === 'updatedAt' || key === 'deletedAt') {
          // Convert string dates to Date objects or use current time
          if (updates[key] === null) {
            sanitizedUpdates[key] = null;
          } else if (updates[key] === true || updates[key] === 'now') {
            // Use current time when true or 'now' is passed
            sanitizedUpdates[key] = new Date();
          } else {
            // Try to convert string to date
            try {
              sanitizedUpdates[key] = new Date(updates[key]);
            } catch (e) {
              console.warn(`Invalid date format for ${key}, using current time`);
              sanitizedUpdates[key] = new Date();
            }
          }
        }
        else {
          sanitizedUpdates[key] = updates[key];
        }
      }
    });
    
    // If no valid fields to update
    if (Object.keys(sanitizedUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }
    
    // Update the order
    const result = await getDb().collection('failed_orders').updateOne(
      { _id: new ObjectId(id) },
      { $set: sanitizedUpdates }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Failed order not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Order updated successfully',
      modifiedCount: result.modifiedCount,
      updatedFields: Object.keys(sanitizedUpdates)
    });
  } catch (error) {
    console.error('\u274c Error updating failed order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order',
      error: error.message
    });
  }
});

// Global error handling - Must be at the top level before server initialization
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION ❌', error);
  // Log to monitoring service if available
  // Don't exit the process here, let it be handled by PM2
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED PROMISE REJECTION ❌', { reason, promise });
  // Log to monitoring service if available
});

// Start Server with optional MongoDB connection
(async () => {
  let server;
  
  // Start the HTTP server immediately
  server = http.createServer(app);
  server.listen(PORT, () => {
    console.log(`\u2705 Server running on http://localhost:${PORT}`);
    console.log(`\ud83d\udccc Webhook: http://localhost:${PORT}/webhook`);
    console.log(`\ud83e\ude7a Health: http://localhost:${PORT}/health`);
    console.log(`\ud83d\udd04 PM2 managed process`);
  });

  server.on('error', (error) => {
    console.error('\u274c Server error:', error);
    // Don't exit - let PM2 handle restarts
  });
  
  // Implement graceful shutdown
  setupGracefulShutdown(server);
  
  // Try to connect to MongoDB in the background
  try {
    console.log('Attempting to connect to MongoDB...');
    // The connectToMongoDB function already has built-in retry logic from mongodb.js
    await connectToMongoDB();
    console.log('\u2705 MongoDB connected successfully');
    
    // Initialize the failed orders schema
    try {
      await initializeFailedOrdersSchema();
      console.log('✅ Failed orders schema initialized successfully');
    } catch (schemaError) {
      console.error('❌ Failed to initialize failed orders schema:', schemaError);
      // Continue anyway as this is not critical for server operation
    }
    
    // Initialize users schema
    try {
      await initializeUsersSchema();
      console.log('✅ Users schema initialized successfully');
    } catch (schemaError) {
      console.error('❌ Failed to initialize users schema:', schemaError);
      // Continue anyway as this is not critical for server operation
    }
    
    // Initialize cron jobs
    try {
      initCronJobs();
      console.log('\u2705 Cron jobs initialized successfully');
    } catch (cronError) {
      console.error('\u274c Failed to initialize cron jobs:', cronError);
      // Continue anyway as this is not critical for server operation
    }
    
    // Set up monitoring for connection events
    setupConnectionMonitoring();
  } catch (dbError) {
    console.error('\u274c MongoDB connection failed:', dbError);
    console.log('\u26a0\ufe0f Server will continue running without database functionality');
    console.log('\u26a0\ufe0f Failed order tracking will be unavailable until database connects');
    
    // The mongodb.js module already handles reconnection internally
    // Just set up monitoring to update app.locals.db when connection is restored
    setupConnectionMonitoring();
  }
})();

/**
 * Monitor MongoDB connection status and update app.locals.db when connection is restored
 * Uses the isConnected and getDb functions from mongodb.js
 */
function setupConnectionMonitoring() {
  const checkInterval = 30000; // Check every 30 seconds
  console.log(`🔄 Connection monitoring active (checks every ${checkInterval/1000} seconds)`);
  
  const connectionMonitor = setInterval(async () => {
    // Check if database connection is lost and attempt to reconnect
    if (!getDb() && !isConnected()) {
      console.log('⚠️ Database connection lost, attempting to reconnect...');
      try {
        await connectToMongoDB();
        console.log('✅ MongoDB connection restored');
        
        // Initialize the failed orders schema
        await initializeFailedOrdersSchema();
        console.log('✅ Failed orders schema initialized after reconnection');
      } catch (err) {
        console.error('❌ Failed to reconnect to database:', err);
      }
    }
  }, checkInterval);
  
  // Add event listeners for process termination to clean up the interval
  process.once('SIGTERM', () => clearInterval(connectionMonitor));
  process.once('SIGINT', () => clearInterval(connectionMonitor));
}

// Graceful shutdown function
function setupGracefulShutdown(server) {
  // Handle SIGTERM (from PM2 or Docker)
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    gracefulShutdown(server);
  });
  
  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    gracefulShutdown(server);
  });
}

async function gracefulShutdown(server) {
  try {
    // Stop accepting new connections
    server.close(() => {
      console.log('✅ HTTP server closed');
    });
    
    // Close MongoDB connection using the module
    await closeConnection(true);
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
}
