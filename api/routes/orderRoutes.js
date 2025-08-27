const express = require('express');
const { getOrders, getMachines, updateOrderStatus, addMachine, editMachine, deleteMachine, updateTriggeredMachine, updateServiceChargesStatus } = require('../controllers/orderController');
const router = express.Router();
const protect = require('../middleware/authMiddleware');

// Protected Routes
router.get('/orders', protect, getOrders);   // Get all orders
router.get('/machines', protect, getMachines); // Get all machines for dropdown
router.put('/order/status', protect, updateOrderStatus);
router.put('/order/update-triggered-machine', protect, updateTriggeredMachine);

router.put('/update-service-charges-status', updateServiceChargesStatus);

// Route for adding a new machine
router.post('/machine/add', protect, addMachine);

// Route for editing an existing machine
router.put('/machine/edit', protect, editMachine);

// Route for deleting a machine
router.delete('/machine/delete/:machineId', protect, deleteMachine);

module.exports = router;
