const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const { getDb } = require('../../db/mongodb');

// JWT secret key - should match the one in usersSchema.js
const JWT_SECRET = process.env.JWT_SECRET || 'cityexperience_jwt_secret_key';

/**
 * Middleware to verify JWT token
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const verifyToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }
    
    // Remove Bearer prefix if present
    const tokenString = token.startsWith('Bearer ') ? token.slice(7) : token;
    
    try {
      const decoded = jwt.verify(tokenString, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Middleware to check if user is admin
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin rights required.'
    });
  }
};

/**
 * Middleware to check if user is owner of resource or admin
 * @param {string} idField - Field name in request params that contains resource ID
 */
const isOwnerOrAdmin = (idField) => {
  return (req, res, next) => {
    const userId = req.user.id;
    const resourceId = req.params[idField];
    
    if (req.user.role === 'admin' || userId === resourceId) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own resources.'
      });
    }
  };
};

module.exports = {
  verifyToken,
  isAdmin,
  isOwnerOrAdmin
};
