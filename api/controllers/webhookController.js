const e = require("express");
const Order = require("../models/Order"); // Import the existing Order model

const orderExists = async (orderId, websiteName) => {
  try {
    const existingOrder = await Order.findOne({
      orderId,
      websiteName,
    });
    return existingOrder;
  } catch (error) {
    throw error;
  }
};

const handleAlcatrazWebhook = async (req, res) => {
  try {
    const orderData = req.body; // Get the order data from the request body

    if (!orderData.id) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    const existingOrder = await orderExists(orderData.id, "Alcatraz Ticketing");

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
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
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
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

    const existingOrder = await orderExists(orderData.id, "StatueTicketing");

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
    }

    // Prepare the order details
    const orderDetails = {
      orderId: orderData.id,
      payload: orderData,
      webhookEndpoint: "/webhook",
      websiteName: "StatueTicketing",
      status: "Not Triggered",
      failureReason: null,
      triggerable: true,
    };

    // Save the order directly in the database
    const newOrder = await Order.create(orderDetails);

    // Return success response
    return res.status(200).json({
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
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

    const existingOrder = await orderExists(orderData.id, "PotomacTicketing");

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
    }

    // Prepare the order details
    const orderDetails = {
      orderId: orderData.id,
      payload: orderData,
      webhookEndpoint: "/potomac-webhook",
      websiteName: "PotomacTicketing",
      status: "Not Triggered",
      failureReason: null,
      triggerable: true,
    };

    // Save the order directly in the database
    const newOrder = await Order.create(orderDetails);

    // Return success response
    return res.status(200).json({
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
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

    const existingOrder = await orderExists(orderData.id, "BayCruise Tickets");

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
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
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
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

    const existingOrder = await orderExists(
      orderData.id,
      "Boston Harbor Cruise"
    );

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
    }

    // Prepare the order details
    const orderDetails = {
      orderId: orderData.id,
      payload: orderData,
      webhookEndpoint: "/boston-harbor-cruise-tickets-webhook",
      websiteName: "Boston Harbor Cruise",
      status: "Not Triggered",
      failureReason: null,
      triggerable: true,
    };

    // Save the order directly in the database
    const newOrder = await Order.create(orderDetails);

    // Return success response
    return res.status(200).json({
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
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

    const existingOrder = await orderExists(
      orderData.id,
      "NiagaraCruiseTicketing"
    );

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
    }

    // Prepare the order details
    const orderDetails = {
      orderId: orderData.id,
      payload: orderData,
      webhookEndpoint: "/niagara-cruise-tickets-webhook",
      websiteName: "NiagaraCruiseTicketing",
      status: "Not Triggered",
      failureReason: null,
      triggerable: true,
    };

    // Save the order directly in the database
    const newOrder = await Order.create(orderDetails);

    // Return success response
    return res.status(200).json({
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
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

    const existingOrder = await orderExists(
      orderData.id,
      "Fort Sumter Ticketing"
    );

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
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
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
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

    const existingOrder = await orderExists(orderData.id, "Kennedy Space Center Ticketing");

    if (existingOrder) {
      return res.status(200).json({ message: "Order already exists" });
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
      message: "Order successfully received and stored",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error processing the webhook",
      error: error.message,
    });
  }
};

const updateOrderPayload = async (req, res) => {
  try {
    const payload = req.body; // Get the new payload from the request body
    const orderId = payload.id; // Assuming the payload contains an 'id' field for the order
    let sitename = "";

    if (payload?.line_items[0]?.name === "Boston Cruise Tickets") {
      sitename = "Boston Harbor Cruise";
    } else if (payload?.line_items[0]?.name === "Alcatraz Reservation") {
      sitename = "Alcatraz Ticketing";
    } else if (
      payload?.line_items[0]?.name === "Statue of Liberty Reservation"
    ) {
      sitename = "StatueTicketing";
    } else if (payload?.line_items[0]?.name === "Potomac Water Taxi Passes") {
      sitename = "PotomacTicketing";
    } else if (payload?.line_items[0]?.name === "San Francisco Bay Cruises") {
      sitename = "BayCruise Tickets";
    } else if (payload?.line_items[0]?.name === "Niagara City Cruise") {
      sitename = "NiagaraCruiseTicketing";
    } else if (payload?.line_items[0]?.name === "Fort Sumter Tickets") {
      sitename = "Fort Sumter Ticketing";
    } else if (
      payload?.line_items[0]?.name === "Kennedy Space Center Tickets"
    ) {
      sitename = "Kennedy Space Center Ticketing";
    } else {
      return res.status(400).json({ message: "Invalid order data" });
    }

    // Find the order by ID and update its payload
    const updatedOrder = await Order.findOneAndUpdate(
      { orderId: orderId, websiteName: sitename },
      {
        payload: payload,
      },
      { new: true } // Return the updated document
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Return success response
    return res.status(200).json({
      message: "Order payload successfully updated",
    });
  } catch (error) {
    console.error("Error updating order payload:", error);
    return res.status(500).json({
      message: "Error updating the order payload",
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
  updateOrderPayload,
};
