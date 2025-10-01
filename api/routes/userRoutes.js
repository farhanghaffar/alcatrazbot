// api/routes/userRoutes.js
const express = require('express');
const { protect, checkRole } = require('../middleware/authMiddleware'); // will be updated
const { createUser, getUsers, updateRole } = require('../controllers/userController'); 

const router = express.Router();

// Only Admin can manage user roles
router.post('/', protect, checkRole('Admin'), createUser); // Create new user
router.get('/', protect, checkRole('Manager'), getUsers); // Get all users (Managers need to assign)
router.put('/:userId/role', protect, checkRole('Admin'), updateRole); // Update user role

module.exports = router;