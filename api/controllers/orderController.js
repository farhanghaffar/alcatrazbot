const Order = require('../models/Order');
const Machine = require('../models/Machine');

// Get all orders
const getOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 })
    res.json(orders);
  } catch (err) {
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


module.exports = { getOrders, getMachines, updateOrderStatus, deleteMachine, addMachine, editMachine };
