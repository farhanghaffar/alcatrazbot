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
        while (tries < maxRetries - 1 && !bookingResult.success && !bookingResult?.error?.includes('Payment not completed')) {
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
    console.log('Order data:', JSON.stringify(req.body));
    
    const reqBody = req.body;

    try {
        // Extract relevant data from WooCommerce order
        const orderData = {
            id: reqBody.id,
            tourType: reqBody?.line_items[0]?.name,
            bookingDate: '',
            bookingTime: '',
            bookingServiceCharges: '',
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

        console.log('After manipulation, data is: ', orderData);

        // Send response immediately to prevent webhook timeouts
        res.status(200).json({
            message: 'Webhook received. Processing in background.'
        });

        
        // Run booking automation in background
        // if(  
        //     (Number(orderData?.adults) || 0) +
        //     (Number(orderData?.childs) || 0) +
        //     (Number(orderData?.juniors) || 0) +
        //     (Number(orderData?.seniors) || 0) <= 4
        // ) {
            setImmediate(async () => {
                try {
                    console.log('Starting booking automation process...');
                    let tries = 0;
                    const maxRetries = 3;
                    let bookingResult = await alcatrazBookTour(orderData, tries);
                    
                    // Retry logic
                    while (tries < maxRetries - 1 && !bookingResult.success && !bookingResult?.error?.includes('Payment not completed')) {
                        tries++;
                        console.log(`Retry attempt #${tries}...`);
                        bookingResult = await alcatrazBookTour(orderData, tries);
                    }
            
                    if (bookingResult.success) {
                        console.log('Booking automation completed successfully');
                    } else {
                        console.error('Booking automation failed:', bookingResult.error);
                    }
                } catch (automationError) {
                    console.error('Error in booking automation:', automationError);
                }
            });
        // }
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(200).json({
            message: 'Internal server error',
            error: error.message
        });
    }
});

// To charge service fee for booking 
app.post('/charge', async (req, res) => {
    try {
      const { paymentMethodId, amount, currency, description } = req.body;
  
      // Convert dollars to cents
      const amountInCents = Math.round(amount * 100);
      
      if (isNaN(amountInCents) || amountInCents < 50) {
        throw new Error('Invalid amount');
      }
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: currency || 'usd',
        payment_method: paymentMethodId,
        // Restrict to card only if needed
        payment_method_types: ['card'],
        // Include description here
        description,
        confirmation_method: 'manual',
        confirm: true,
      });
      
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
});

// Create HTTPS server with error handling
try {
    // const server = https.createServer(sslOptions, app);
    const server = http.createServer(app);
    
    server.listen(PORT, () => {
        console.log(`HTTPS Server is running on port ${PORT}`);
        console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
        console.log(`Health check endpoint: http://localhost:${PORT}/health`);
    });

    server.on('error', (error) => {
        console.error('Server error:', error);
        process.exit(1);
    });
} catch (error) {
    console.error('Error creating HTTPS server:', error);
    process.exit(1);
}
