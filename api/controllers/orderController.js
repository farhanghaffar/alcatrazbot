const Order = require('../models/Order');
const Machine = require('../models/Machine');

// Get all orders
// Fetch the orders with the selectedMachine populated
const getOrders = async (req, res) => {
  try {
    const { search, startDate, endDate, websiteName } = req.query;

    // Build the query object dynamically based on the filters
    const query = {};

    // Search functionality (matching order ID, customer name, failure reason, or status)
    if (search) {
      const searchTerm = search.trim(); // Trim spaces to avoid extra characters
      const regex = new RegExp(searchTerm, 'i');  // Use case-insensitive regex

      query.$or = [
        { orderId: { $regex: regex } },  // Partial match for order ID
        { 'payload.billing.first_name': { $regex: regex } }, // Partial match for first name
        { 'payload.billing.last_name': { $regex: regex } },  // Partial match for last name
        { status: { $regex: regex } } // Partial match for order status
      ];
    }

    // Date range filter (if both start and end date are provided)
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);  // Set end date to 11:59:59.999 PM
      query.createdAt = { $gte: start, $lte: end };
    } else if (startDate) {
      const start = new Date(startDate);
      query.createdAt = { $gte: start };
    } else if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);  // Set end date to 11:59:59.999 PM
      query.createdAt = { $lte: end };
    }

    // Filter by website name if provided
    if (websiteName) {
      query.websiteName = websiteName;
    }

    // Fetch the orders with the selectedMachine populated (get machine's name)
    const orders = await Order.find(query)
      .populate('triggeredMachine', 'name') // Populate selectedMachine field with 'name'
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    console.error('Error fetching orders: ', err);
    res.status(500).send('Server error');
  }
};


// Update the triggered machine on an order
const updateTriggeredMachine = async (req, res) => {
  const { orderId, triggeredMachineId } = req.body; // Get the triggered machine from the request

  try {
    // Find the order by its ID and update the triggeredMachine field
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { triggeredMachine: triggeredMachineId }, // Only update triggeredMachine
      { new: true } // Return the updated order
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    return res.status(200).json(updatedOrder); // Send back the updated order with triggeredMachine
  } catch (err) {
    console.error('Error updating triggered machine:', err);
    res.status(500).send('Server error');
  }
};



// Get all machines for dropdown
const getMachines = async (req, res) => {
  try {
    const machines = await Machine.find();
    res.json(machines);
  } catch (err) {
    res.status(500).send('Server error');
  }
};

const updateOrderStatus = async (req, res) => {
  const { orderId, status } = req.body;

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ msg: 'Order not found' });
    }

    // Update the status
    order.status = status;
    await order.save();
    
    res.json({ msg: 'Order status updated successfully', order });
  } catch (err) {
    res.status(500).send('Server error');
  }
};

const addMachine = async (req, res) => {
  const { name, url } = req.body;

  // Check if machine with the same name already exists
  try {
    const existingMachine = await Machine.findOne({ name });
    
    if (existingMachine) {
      return res.status(400).json({ message: 'Machine with this name already exists!' });
    }

    // Create a new machine
    const newMachine = new Machine({ name, url });
    await newMachine.save();
    
    return res.status(201).json({ message: 'Machine added successfully', newMachine });
  } catch (err) {
    return res.status(500).json({ message: 'Error adding machine', error: err });
  }
};

const editMachine = async (req, res) => {
  const { machineId, name, url } = req.body;

  try {
    // Check if machine name already exists, but exclude the current machine
    const existingMachine = await Machine.findOne({ name, _id: { $ne: machineId } });
    if (existingMachine) {
      return res.status(400).json({ message: 'Machine with this name already exists!' });
    }

    // Update the machine
    const updatedMachine = await Machine.findByIdAndUpdate(machineId, { name, url }, { new: true });
    
    if (!updatedMachine) {
      return res.status(404).json({ message: 'Machine not found' });
    }

    return res.status(200).json({ message: 'Machine updated successfully', updatedMachine });
  } catch (err) {
    return res.status(500).json({ message: 'Error updating machine', error: err });
  }
};

const deleteMachine = async (req, res) => {
  const { machineId } = req.params;

  try {
    const deletedMachine = await Machine.findByIdAndDelete(machineId);
    
    if (!deletedMachine) {
      return res.status(404).json({ message: 'Machine not found' });
    }

    return res.status(200).json({ message: 'Machine deleted successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Error deleting machine', error: err });
  }
};


module.exports = { getOrders, getMachines, updateOrderStatus, deleteMachine, addMachine, editMachine, updateTriggeredMachine };
