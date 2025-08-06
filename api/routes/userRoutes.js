const express = require('express');
const router = express.Router();
const { 
  createUser, 
  authenticateUser, 
  getAllUsers, 
  getUserById, 
  updateUser, 
  deleteUser 
} = require('../../db/usersSchema');
const { isConnected, getDb } = require('../../db/mongodb');
const { verifyToken, isAdmin, isOwnerOrAdmin } = require('../middleware/auth');

/**
 * Check if any admin user already exists in the database
 * @returns {Promise<boolean>} true if admin exists, false otherwise
 */
const checkIfAdminExists = async () => {
  try {
    const db = getDb();
    const adminUser = await db.collection('users').findOne({ 
      role: 'admin',
      deletedAt: null,
      isDisabled: false
    });
    
    return !!adminUser; // Convert to boolean
  } catch (error) {
    console.error('❌ Error checking for admin user:', error);
    throw error;
  }
};

/**
 * First-time setup endpoint for creating the initial admin user
 * @route POST /api/users/setup-first-admin
 */
router.post('/setup-first-admin', async (req, res) => {
  try {
    if (!isConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection unavailable'
      });
    }

    // Check if any admin users already exist
    const adminExists = await checkIfAdminExists();
    
    if (adminExists) {
      return res.status(403).json({
        success: false,
        message: 'Setup already completed. Admin user already exists.'
      });
    }
    
    const { fullName, email, password } = req.body;
    
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    const result = await createUser({
      fullName,
      email,
      password,
      role: 'admin' // Force role to be admin
    });
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.status(201).json({
      success: true,
      message: 'First admin user created successfully. You can now log in and create additional users.',
      userId: result.userId
    });
  } catch (error) {
    console.error('❌ Error in first-time setup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete first-time setup',
      error: error.message
    });
  }
});

/**
 * Admin-only endpoint to create new users
 * @route POST /api/users
 */
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    if (!isConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection unavailable'
      });
    }

    const { fullName, email, password, role } = req.body;
    
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    const result = await createUser({
      fullName,
      email,
      password,
      role: role || 'user' // Default to 'user' if not specified
    });
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      userId: result.userId
    });
  } catch (error) {
    console.error('❌ Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message
    });
  }
});

/**
 * Login user
 * @route POST /api/users/login
 */
router.post('/login', async (req, res) => {
  try {
    if (!isConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection unavailable'
      });
    }
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    const result = await authenticateUser(email, password);
    res.json(result);
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * Get all users
 * @route GET /api/users
 */
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    if (!isConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection unavailable'
      });
    }
    
    const result = await getAllUsers();
    res.json(result);
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * Get user by ID
 * @route GET /api/users/:id
 */
router.get('/:id', verifyToken, isOwnerOrAdmin('id'), async (req, res) => {
  try {
    if (!isConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection unavailable'
      });
    }
    
    const result = await getUserById(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * Update user
 * @route PUT /api/users/:id
 */
router.put('/:id', verifyToken, isOwnerOrAdmin('id'), async (req, res) => {
  try {
    if (!isConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection unavailable'
      });
    }
    
    const result = await updateUser(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * Delete user
 * @route DELETE /api/users/:id
 */
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    if (!isConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection unavailable'
      });
    }
    
    const result = await deleteUser(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
