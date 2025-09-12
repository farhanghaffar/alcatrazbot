const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const { ServiceCharges } = require('./automation/service-charges');
const { alcatrazBookTour } = require('./alcatraz-booking');
const { statueTicketingBookTour } = require('./statueticketing-booking');
const { potomacTourBooking } = require('./automation/potomac/automation');
const { BayCruiseTickets } = require('./automation/bay-cruise-tickets/automation');
const { bostonHarborCruise } = require('./automation/boston-harbor-cruise/automation');
const { NiagaraCruiseTickets } = require('./automation/niagara-cruise-tickets/automation');
const { FortSumterTickets } = require('./automation/fort-sumter-tickets/automation');
const { KennedySpaceCenterTickets } = require('./automation/kennedy-space-center-tickets/automation');
const mongoose = require('mongoose');
const authRoutes = require('./api/routes/authRoutes');
const orderRoutes = require('./api/routes/orderRoutes');
const webhookRoutes = require('./api/routes/webhookRoutes');
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
app.use(express.json());

// DB Connection
mongoose.connect(process.env.MONGO_URI,{retryReads: true,
    retryWrites: true,
    serverSelectionTimeoutMS: 5000,
maxPoolSize: 10 })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log('MongoDB Connection Error ==>', err));

// Routes
app.use('/api', authRoutes);  // Authentication routes
app.use('/api', orderRoutes); // Order and machine routes
app.use('/api', webhookRoutes);
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
        let bookingResult = await statueTicketingBookTour(orderData, tries, reqBody);

        // Retry logic
        while (tries < maxRetries - 1 && !bookingResult.success && !bookingResult?.error?.includes('Payment not completed') && !bookingResult?.error?.includes('Expected format is MM/YY.') && !bookingResult?.error?.includes('Month should be between 1 and 12.') && !bookingResult?.error?.includes('The card has expired.') && !bookingResult?.error?.includes('Order Rejected') && !bookingResult?.error?.includes('Tickets are not available for the date you selected.')) {
            tries++;
            console.log(`Retry attempt #${tries}...`);
            bookingResult = await statueTicketingBookTour(orderData, tries, reqBody);
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
                let bookingResult = await alcatrazBookTour(orderData, tries, reqBody);

                // Retry logic
                while (tries < maxRetries - 1 && !bookingResult.success && !bookingResult?.error?.includes('Payment not completed') && !bookingResult?.error?.includes('Expected format is MM/YY.') && !bookingResult?.error?.includes('Month should be between 1 and 12.') && !bookingResult?.error?.includes('The card has expired.') && !bookingResult?.error?.includes('Order Rejected') && !bookingResult?.error?.includes('Tickets are not available for the date you selected.')) {
                    tries++;
                    console.log(`Retry attempt #${tries}...`);
                    bookingResult = await alcatrazBookTour(orderData, tries, reqBody);
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

app.post('/charge-service-fee', async (req, res) => {
    try {
        const reqBody = req.body;

        const orderDetails = {
            orderId: reqBody.id,
            sChargesAmount: reqBody?.line_items[0]?.meta_data
                .find(item => item.key === 'Service Charges' || item.key === '_booking_serviceCharges')
                ?.value.replace(/[^0-9.-]+/g, ''),
            siteName: '',
            userEmail: reqBody?.billing?.email || '',
            postalCode: reqBody?.billing?.postcode || '',
            cardNumber: reqBody?.meta_data.find(item => item.key.toLowerCase() === 'credit_card_number')?.value || '',
            cardExpiryDate: reqBody?.meta_data.find(item => item.key.toLowerCase() === 'credit_card_expiration')?.value || '',
            cardCVC: reqBody?.meta_data.find(item => item.key.toLowerCase() === 'credit_card_cvc')?.value || '',
            sChargesCurrency: reqBody?.line_items[0]?.meta_data
                .find(item => item.key === 'Service Charges' || item.key === '_booking_serviceCharges')
                ?.value.includes('CA$') ? 'CAD' : 'USD',
        }

        if (reqBody?.line_items[0]?.name === 'Boston Cruise Tickets') {
            orderDetails.siteName = 'Boston Harbor Cruise';
        } else if (reqBody?.line_items[0]?.name === 'Alcatraz Reservation') {
            orderDetails.siteName = 'Alcatraz Ticketing';
        } else if (reqBody?.line_items[0]?.name === 'Statue of Liberty Reservation') {
            orderDetails.siteName = 'StatueTicketing';
        } else if (reqBody?.line_items[0]?.name === 'Potomac Water Taxi Passes') {
            orderDetails.siteName = 'PotomacTicketing';
        } else if (reqBody?.line_items[0]?.name === 'San Francisco Bay Cruises') {
            orderDetails.siteName = 'BayCruise Tickets';
        } else if (reqBody?.line_items[0]?.name === 'Niagara City Cruise') {
            orderDetails.siteName = 'NiagaraCruiseTicketing';
        } else if (reqBody?.line_items[0]?.name === 'Fort Sumter Tickets') {
            orderDetails.siteName = 'Fort Sumter Ticketing';
        } else if (reqBody?.line_items[0]?.name === 'Kennedy Space Center Tickets') {
            orderDetails.siteName = 'Kennedy Space Center Ticketing';
        } else {
            return res.status(400).json({ message: "Invalid order data" });
        }
        
         res
           .status(200)
           .json({ message: "Service fee charge started in background" });

         setImmediate(async () => {
           try {
             const status = await ServiceCharges(
               orderDetails?.sChargesAmount,
               orderDetails?.orderId,
               orderDetails?.cardNumber,
               orderDetails?.cardExpiryDate,
               orderDetails?.cardCVC,
               orderDetails?.postalCode,
               orderDetails?.userEmail,
               orderDetails?.siteName,
               orderDetails?.sChargesCurrency
             );

             if (status)
               console.log(
                 `Service fee charged successfully for OrderId : ${orderDetails.orderId} , Website Name : ${orderDetails.siteName}`
               );
             else
               console.error(
                 `Error occured during charging service fee for OrderId : ${orderDetails.orderId} , WebsiteName : ${orderDetails.siteName}`
               );
           } catch (error) {
             console.error(error);
           }
         });

    } catch (error) {
        console.error('Error charging service fees:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
});

app.get('/', (req, res) => {
    res.status(200).json({ status: 'healthy' });
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
                let bookingResult = await potomacTourBooking(orderData, tries, reqBody);

                // Retry logic
                while (tries < maxRetries - 1 && !bookingResult.success && !bookingResult?.error?.includes('Payment not completed') && !bookingResult?.error?.includes('Expected format is MM/YY.') && !bookingResult?.error?.includes('Month should be between 1 and 12.') && !bookingResult?.error?.includes('The card has expired.') && !bookingResult?.error?.includes('Order Rejected') && !bookingResult?.error?.includes('Tickets are not available for the date you selected.')) {
                    tries++;
                    console.log(`Retry attempt #${tries}...`);
                    bookingResult = await potomacTourBooking(orderData, tries, reqBody);
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
                let bookingResult = await bostonHarborCruise(orderData, tries, reqBody);

                // Retry logic
                while (tries < maxRetries - 1 && !bookingResult.success && !bookingResult?.error?.includes('Payment not completed') && !bookingResult?.error?.includes('Expected format is MM/YY.') && !bookingResult?.error?.includes('Month should be between 1 and 12.') && !bookingResult?.error?.includes('The card has expired.') && !bookingResult?.error?.includes('Order Rejected') && !bookingResult?.error?.includes('Tickets are not available for the date you selected.')) {
                    tries++;
                    console.log(`Retry attempt #${tries}...`);
                    bookingResult = await bostonHarborCruise(orderData, tries, reqBody);
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
                let bookingResult = await NiagaraCruiseTickets(orderData, tries, reqBody);

                // Retry logic
                while (tries < maxRetries - 1 && !bookingResult.success && !bookingResult?.error?.includes('Payment not completed') && !bookingResult?.error?.includes('Expected format is MM/YY.') && !bookingResult?.error?.includes('Month should be between 1 and 12.') && !bookingResult?.error?.includes('The card has expired.') && !bookingResult?.error?.includes('Order Rejected') && !bookingResult?.error?.includes('Tickets are not available for the date you selected.')) {
                    tries++;
                    console.log(`Retry attempt #${tries}...`);
                    bookingResult = await NiagaraCruiseTickets(orderData, tries, reqBody);
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
                let bookingResult = await FortSumterTickets(orderData, tries, reqBody);
                
                // Retry logic
                // while (tries < maxRetries - 1 && !bookingResult.success && !bookingResult?.error?.includes('Payment not completed') && !bookingResult?.error?.includes('Expected format is MM/YY.') && !bookingResult?.error?.includes('Month should be between 1 and 12.') && !bookingResult?.error?.includes('The card has expired.')) {
                //     tries++;
                //     console.log(`Retry attempt #${tries}...`);
                //     bookingResult = await FortSumterTickets(orderData, tries, reqBody);
                // }

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

// Create HTTPS server with error handling
// try {
//     // const server = https.createServer(sslOptions, app);
//     const server = http.createServer(app);

//     server.listen(PORT, () => {
//         console.log(`HTTPS Server is running on port ${PORT}`);
//         console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
//         console.log(`Health check endpoint: http://localhost:${PORT}/health`);
//     });

//     server.on('error', (error) => {
//         console.error('Server error:', error);
//         process.exit(1);
//     });
// } catch (error) {
//     console.error('Error creating HTTPS server:', error);
//     process.exit(1);
// }

try {
    const PORT = process.env.PORT || 4000; // Make sure the port is defined, default to 4000
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
        console.log(`Health check endpoint: http://localhost:${PORT}/health`);
    });

    app.on('error', (error) => {
        console.error('Server error:', error);
        process.exit(1);
    });
} catch (error) {
    console.error('Error starting the server:', error);
    process.exit(1);
}


module.exports = app;