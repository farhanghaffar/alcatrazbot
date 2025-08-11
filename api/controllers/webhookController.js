const Order = require('../models/order'); // Import the existing Order model

const handleAlcatrazWebhook = async (req, res) => {
    try {
        const orderData = req.body; // Get the order data from the request body

        if (!orderData.id) {
            return res.status(400).json({ message: "Invalid order data" });
        }

        // Prepare the order details
        const orderDetails = {
            orderId: orderData.id,
            payload: orderData,
            webhookEndpoint: "/alcatraz-webhook",
            websiteName: "Alcatraz Ticketing",
            status: "Not Triggered",
            failureReason: null,
            triggerable: true,
        };

        // Save the order directly in the database
        const newOrder = await Order.create(orderDetails);

        // Return success response
        return res.status(200).json({
            message: 'Order successfully received and stored',
            order: newOrder,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: 'Error processing the webhook',
            error: error.message,
        });
    }
};

const handleStatueWebhook = async (req, res) => {
    try {
        const orderData = req.body; // Get the order data from the request body

        if (!orderData.id) {
            return res.status(400).json({ message: "Invalid order data" });
        }

        // Prepare the order details
        const orderDetails = {
            orderId: orderData.id,
            payload: orderData,
            webhookEndpoint: "/webhook",
            websiteName: "Statue Ticketing",
            status: "Not Triggered",
            failureReason: null,
            triggerable: true,
        };

        // Save the order directly in the database
        const newOrder = await Order.create(orderDetails);

        // Return success response
        return res.status(200).json({
            message: 'Order successfully received and stored',
            order: newOrder,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: 'Error processing the webhook',
            error: error.message,
        });
    }
};

const handlePotomacWebhook = async (req, res) => {
    try {
        const orderData = req.body; // Get the order data from the request body

        if (!orderData.id) {
            return res.status(400).json({ message: "Invalid order data" });
        }

        // Prepare the order details
        const orderDetails = {
            orderId: orderData.id,
            payload: orderData,
            webhookEndpoint: "/potomac-webhook",
            websiteName: "Potomac Ticketing",
            status: "Not Triggered",
            failureReason: null,
            triggerable: true,
        };

        // Save the order directly in the database
        const newOrder = await Order.create(orderDetails);

        // Return success response
        return res.status(200).json({
            message: 'Order successfully received and stored',
            order: newOrder,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: 'Error processing the webhook',
            error: error.message,
        });
    }
};

const handleBayCruiseTicketsWebhook = async (req, res) => {
    try {
        const orderData = req.body; // Get the order data from the request body

        if (!orderData.id) {
            return res.status(400).json({ message: "Invalid order data" });
        }

        // Prepare the order details
        const orderDetails = {
            orderId: orderData.id,
            payload: orderData,
            webhookEndpoint: "/bay-cruise-tickets-webhook",
            websiteName: "BayCruise Tickets",
            status: "Not Triggered",
            failureReason: null,
            triggerable: true,
        };

        // Save the order directly in the database
        const newOrder = await Order.create(orderDetails);

        // Return success response
        return res.status(200).json({
            message: 'Order successfully received and stored',
            order: newOrder,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: 'Error processing the webhook',
            error: error.message,
        });
    }
};

const handleBostonHarborCruiseTicketsWebhook = async (req, res) => {
    try {
        const orderData = req.body; // Get the order data from the request body

        if (!orderData.id) {
            return res.status(400).json({ message: "Invalid order data" });
        }

        // Prepare the order details
        const orderDetails = {
            orderId: orderData.id,
            payload: orderData,
            webhookEndpoint: "/boston-harbor-cruise-tickets-webhook",
            websiteName: "Boston Harbor Cruise Tickets",
            status: "Not Triggered",
            failureReason: null,
            triggerable: true,
        };

        // Save the order directly in the database
        const newOrder = await Order.create(orderDetails);

        // Return success response
        return res.status(200).json({
            message: 'Order successfully received and stored',
            order: newOrder,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: 'Error processing the webhook',
            error: error.message,
        });
    }
};

const handleNiagaraCruiseTicketsWebhook = async (req, res) => {
    try {
        const orderData = req.body; // Get the order data from the request body

        if (!orderData.id) {
            return res.status(400).json({ message: "Invalid order data" });
        }

        // Prepare the order details
        const orderDetails = {
            orderId: orderData.id,
            payload: orderData,
            webhookEndpoint: "/niagara-cruise-tickets-webhook",
            websiteName: "NiagaraCruise Tickets",
            status: "Not Triggered",
            failureReason: null,
            triggerable: true,
        };

        // Save the order directly in the database
        const newOrder = await Order.create(orderDetails);

        // Return success response
        return res.status(200).json({
            message: 'Order successfully received and stored',
            order: newOrder,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: 'Error processing the webhook',
            error: error.message,
        });
    }
};

const handleFortSumterTicketingWebhook = async (req, res) => {
    try {
        const orderData = req.body; // Get the order data from the request body

        if (!orderData.id) {
            return res.status(400).json({ message: "Invalid order data" });
        }

        // Prepare the order details
        const orderDetails = {
            orderId: orderData.id,
            payload: orderData,
            webhookEndpoint: "/fort-sumter-ticketing-webhook",
            websiteName: "Fort Sumter Ticketing",
            status: "Not Triggered",
            failureReason: null,
            triggerable: true,
        };

        // Save the order directly in the database
        const newOrder = await Order.create(orderDetails);

        // Return success response
        return res.status(200).json({
            message: 'Order successfully received and stored',
            order: newOrder,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: 'Error processing the webhook',
            error: error.message,
        });
    }
};

const handleKennedySpaceCenterTicketingWebhook = async (req, res) => {
    try {
        const orderData = req.body; // Get the order data from the request body

        if (!orderData.id) {
            return res.status(400).json({ message: "Invalid order data" });
        }

        // Prepare the order details
        const orderDetails = {
            orderId: orderData.id,
            payload: orderData,
            webhookEndpoint: "/kennedy-space-center-ticketing-webhook",
            websiteName: "Kennedy Space Center Ticketing",
            status: "Not Triggered",
            failureReason: null,
            triggerable: true,
        };

        // Save the order directly in the database
        const newOrder = await Order.create(orderDetails);

        // Return success response
        return res.status(200).json({
            message: 'Order successfully received and stored',
            order: newOrder,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: 'Error processing the webhook',
            error: error.message,
        });
    }
};

module.exports = {
    handleAlcatrazWebhook,
    handleStatueWebhook,
    handlePotomacWebhook,
    handleBayCruiseTicketsWebhook,
    handleBostonHarborCruiseTicketsWebhook,
    handleNiagaraCruiseTicketsWebhook,
    handleFortSumterTicketingWebhook,
    handleKennedySpaceCenterTicketingWebhook,
};
