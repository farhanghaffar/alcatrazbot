const { getDb } = require('./mongodb');
const crypto = require('crypto');

/**
 * Initialize users collection schema with validation rules
 */
async function initializeUsersSchema() {
  try {
    const db = await getDb();
    const collectionName = 'users';

    // Check if collection exists, create if it doesn't
    const collections = await db.listCollections().toArray();
    const collectionExists = collections.some(col => col.name === collectionName);

    if (!collectionExists) {
      await db.createCollection(collectionName);
    }

    // Define schema validation
    const schema = {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['fullName', 'email', 'password', 'createdAt'],
          properties: {
            fullName: {
              bsonType: 'string',
              description: 'Full name of the user'
            },
            email: {
              bsonType: 'string',
              description: 'Email address of the user'
            },
            password: {
              bsonType: 'string',
              description: 'Password (stored as SHA-256 hash)'
            },
            role: {
              enum: ['admin', 'user'],
              description: 'User role - admin or user'
            },
            createdAt: {
              bsonType: 'date',
              description: 'Date when the user was created'
            },
            updatedAt: {
              bsonType: ['date', 'null'],
              description: 'Date when the user was last updated'
            },
            deletedAt: {
              bsonType: ['date', 'null'],
              description: 'Soft delete date'
            },
            isDisabled: {
              bsonType: 'bool',
              description: 'Whether the user account is disabled'
            }
          }
        }
      },
      validationLevel: 'moderate',
      validationAction: 'warn'
    };

    // Apply schema validation to the collection
    await db.command({
      collMod: collectionName,
      validator: schema.validator,
      validationLevel: schema.validationLevel,
      validationAction: schema.validationAction
    });

    // Create email index for uniqueness
    await db.collection(collectionName).createIndex({ email: 1 }, { unique: true });
    
    console.log(`✅ Schema initialized for ${collectionName} collection`);
  } catch (error) {
    console.error('❌ Error initializing users schema:', error);
    throw error;
  }
}

// JWT secret key - in production, this should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'cityexperience_jwt_secret_key';

/**
 * Simple password hashing function using SHA-256
 * @param {string} password - Plain text password
 * @returns {string} - Hashed password
 */
function hashPassword(password) {
  return crypto
    .createHash('sha256')
    .update(password)
    .digest('hex');
};

/**
 * Generate a JWT token
 * @param {Object} user - User object
 * @returns {string} - JWT token
 */
function generateToken(user) {
  const payload = {
    id: user._id.toString(),
    email: user.email,
    role: user.role
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};

/**
 * Create a new user in the database
 * @param {object} userData User data
 * @returns {Promise<object>} Result with success flag and message
 */
async function createUser(userData) {
  try {
    const db = await getDb();
    
    // Basic validation
    if (!userData.fullName || !userData.email || !userData.password) {
      return { 
        success: false, 
        message: 'Missing required fields'
      };
    }
    
    // Check if email exists
    const existingUser = await db.collection('users').findOne({ email: userData.email });
    if (existingUser) {
      return { 
        success: false, 
        message: 'Email already in use' 
      };
    }
    
    // Create user object
    const user = {
      fullName: userData.fullName,
      email: userData.email,
      password: hashPassword(userData.password),
      role: userData.role || 'user',
      createdAt: new Date(),
      updatedAt: null,
      deletedAt: null,
      isDisabled: false,
      lastLogin: null
    };
    
    // Insert user
    const result = await db.collection('users').insertOne(user);
    
    return {
      success: true,
      message: 'User created successfully',
      userId: result.insertedId.toString()
    };
  } catch (error) {
    console.error('❌ Error creating user:', error);
    return { 
      success: false, 
      message: 'Database error' 
    };
  }
}

/**
 * Authenticate a user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} - Authentication result with JWT token
 */
async function authenticateUser(email, password) {
  try {
    const db = await getDb();
    
    // Find user by email
    const user = await db.collection('users').findOne({ 
      email,
      deletedAt: null,
      isDisabled: false
    });
    
    // User not found or password doesn't match
    if (!user || hashPassword(password) !== user.password) {
      return {
        success: false,
        message: 'Invalid email or password'
      };
    }
    
    // Generate JWT token
    const token = generateToken(user);
    
    // Update last login time
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    );
    
    return {
      success: true,
      message: 'Authentication successful',
      userId: user._id.toString(),
      token,
      fullName: user.fullName,
      email: user.email,
      role: user.role
    };
  } catch (error) {
    console.error('❌ Error authenticating user:', error);
    return { 
      success: false, 
      message: 'Authentication failed', 
      error: error.message 
    };
  }
}

/**
 * Get all users
 * @returns {Promise<Array>} List of users
 */
async function getAllUsers() {
  try {
    const db = await getDb();
    
    const users = await db.collection('users')
      .find({ deletedAt: null })
      .project({ password: 0 }) // Exclude password
      .toArray();
    
    return { success: true, users };
  } catch (error) {
    console.error('❌ Error getting users:', error);
    return { 
      success: false, 
      message: 'Failed to get users' 
    };
  }
}

/**
 * Get user by ID
 * @param {string} id User ID
 * @returns {Promise<object>} User object
 */
async function getUserById(id) {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(id), deletedAt: null },
      { projection: { password: 0 } } // Exclude password
    );
    
    if (!user) {
      return { 
        success: false, 
        message: 'User not found' 
      };
    }
    
    return { 
      success: true, 
      user 
    };
  } catch (error) {
    console.error('❌ Error getting user:', error);
    return { 
      success: false, 
      message: 'Failed to get user' 
    };
  }
}

/**
 * Update user
 * @param {string} id User ID
 * @param {object} updates Fields to update
 * @returns {Promise<object>} Update result
 */
async function updateUser(id, updates) {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    
    // Prepare update data
    const updateData = {};
    if (updates.fullName) updateData.fullName = updates.fullName;
    if (updates.email) updateData.email = updates.email;
    if (updates.role) updateData.role = updates.role;
    if (updates.isDisabled !== undefined) updateData.isDisabled = updates.isDisabled;
    if (updates.password) updateData.password = hashPassword(updates.password);
    
    updateData.updatedAt = new Date();
    
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(id), deletedAt: null },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return { 
        success: false, 
        message: 'User not found' 
      };
    }
    
    return { 
      success: true, 
      message: 'User updated successfully' 
    };
  } catch (error) {
    console.error('❌ Error updating user:', error);
    return { 
      success: false, 
      message: 'Failed to update user' 
    };
  }
}

/**
 * Delete user (soft delete)
 * @param {string} id User ID
 * @returns {Promise<object>} Delete result
 */
async function deleteUser(id) {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(id), deletedAt: null },
      { $set: { deletedAt: new Date() } }
    );
    
    if (result.matchedCount === 0) {
      return { 
        success: false, 
        message: 'User not found' 
      };
    }
    
    return { 
      success: true, 
      message: 'User deleted successfully' 
    };
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    return { 
      success: false, 
      message: 'Failed to delete user' 
    };
  }
}

module.exports = {
  initializeUsersSchema,
  createUser,
  authenticateUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
};
