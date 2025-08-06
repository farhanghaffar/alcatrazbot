/**
 * MongoDB Connection Module
 * Handles connection, reconnection, and provides access to database instance
 */

const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

// MongoDB Atlas Connection Setup
const MONGODB_URI = process.env.MONGODB_URI; // From Atlas "Drivers" tab
const DB_NAME = process.env.MONGODB_DB_NAME || "alcatraz_automation"; // Use specific database name
let mongoClient = null;

// Global variable to store the DB connection
let globalDb = null;

// Maximum number of retries
const MAX_RETRIES = 5;
// Initial backoff delay in ms (will be increased with exponential backoff)
const INITIAL_BACKOFF = 1000;

/**
 * Connect to MongoDB with retry logic
 * @param {number} retryAttempt - Current retry attempt (0-based)
 * @returns {Promise<object>} - MongoDB database instance
 */
async function connectWithRetry(retryAttempt = 0) {
  const options = {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    // Enable reconnection
    retryWrites: true,
    retryReads: true,
    // Add connection pool settings
    maxPoolSize: 10,
    minPoolSize: 2,
  };

  try {
    // Check if we already have a valid connection
    if (
      mongoClient &&
      mongoClient.topology &&
      mongoClient.topology.isConnected()
    ) {
      console.log("✅ Using existing MongoDB connection!");
      return mongoClient.db(DB_NAME);
    }

    console.log(
      `MongoDB connection attempt ${retryAttempt + 1}/${MAX_RETRIES + 1}`
    );

    // Create new client if it doesn't exist or was closed
    if (!mongoClient) {
      mongoClient = new MongoClient(MONGODB_URI, options);
    }

    await mongoClient.connect();
    console.log("✅ Connected to MongoDB Atlas!");

    // Setup connection monitoring
    setupConnectionMonitoring();

    const db = mongoClient.db(DB_NAME);
    globalDb = db; // Store in global variable for access
    console.log(`✅ Connected to database: ${DB_NAME}`);
    return db;
  } catch (err) {
    console.error(
      `❌ MongoDB connection error (attempt ${retryAttempt + 1}/${
        MAX_RETRIES + 1
      }):`,
      err
    );

    // Close client if it exists
    if (mongoClient) {
      try {
        await mongoClient.close();
      } catch (closeError) {
        console.error("Error closing MongoDB client:", closeError);
      }
      mongoClient = null;
    }

    // If we haven't reached max retries, try again with exponential backoff
    if (retryAttempt < MAX_RETRIES) {
      const backoffTime = INITIAL_BACKOFF * Math.pow(2, retryAttempt);
      console.log(`Retrying in ${backoffTime}ms...`);

      await new Promise((resolve) => setTimeout(resolve, backoffTime));
      return connectWithRetry(retryAttempt + 1);
    }

    // Max retries reached
    throw new Error(
      `Failed to connect to MongoDB after ${MAX_RETRIES + 1} attempts`
    );
  }
}

/**
 * Setup MongoDB connection event listeners
 * Ensures we don't add duplicate event handlers
 */
function setupConnectionMonitoring() {
  if (!mongoClient) return;

  // Remove existing listeners to prevent duplicates
  mongoClient.removeAllListeners("connectionClosed");
  mongoClient.removeAllListeners("connectionReady");
  mongoClient.removeAllListeners("error");
  mongoClient.removeAllListeners("topologyDescriptionChanged");

  // Add new listeners
  mongoClient.on("connectionClosed", (event) => {
    console.log("MongoDB connection closed:", event);
  });

  mongoClient.on("connectionReady", () => {
    console.log("MongoDB connection ready");
  });

  mongoClient.on("error", async (err) => {
    console.error("MongoDB connection error:", err);

    // If there's an error with the connection, try to reconnect
    if (mongoClient) {
      try {
        // Only attempt to reconnect if we've lost connection
        if (!mongoClient.topology || !mongoClient.topology.isConnected()) {
          console.log("Lost connection to MongoDB, attempting to reconnect...");
          // Use a simple reconnect approach to avoid recursion
          setTimeout(async () => {
            try {
              globalDb = await connectWithRetry();
              console.log("Reconnection successful");
            } catch (error) {
              console.error("Reconnection failed:", error);
            }
          }, 5000); // Wait 5 seconds before attempting reconnect
        }
      } catch (reconnectError) {
        console.error("Error during MongoDB reconnection:", reconnectError);
      }
    }
  });

  // Monitor for topology changes (like server selection changes)
  mongoClient.on("topologyDescriptionChanged", (event) => {
    const { previousDescription, newDescription } = event;

    if (previousDescription.type !== newDescription.type) {
      console.log(
        `MongoDB topology changed from ${previousDescription.type} to ${newDescription.type}`
      );
    }
  });
}

/**
 * Connect to MongoDB with retry logic
 * @returns {Promise<object>} - MongoDB database instance
 */
async function connectToMongoDB() {
  // If we already have a valid connection, return it
  if (
    globalDb &&
    mongoClient &&
    mongoClient.topology &&
    mongoClient.topology.isConnected()
  ) {
    console.log("✅ Reusing existing MongoDB connection!");
    return globalDb;
  }

  return connectWithRetry();
}

/**
 * Get the MongoDB database instance
 * @returns {object|null} - MongoDB database instance or null if not connected
 */
function getDb() {
  // If we have a connection but no globalDb, ensure we use the right database
  if (
    mongoClient &&
    mongoClient.topology &&
    mongoClient.topology.isConnected() &&
    !globalDb
  ) {
    globalDb = mongoClient.db(DB_NAME);
  }
  return globalDb;
}

/**
 * Get the MongoDB client
 * @returns {MongoClient|null} - MongoDB client or null if not connected
 */
function getClient() {
  return mongoClient;
}

/**
 * Close the MongoDB connection
 * @param {boolean} force - Force close, even with active operations
 * @returns {Promise<void>}
 */
async function closeConnection(force = false) {
  if (mongoClient) {
    try {
      await mongoClient.close(force);
      console.log("✅ MongoDB connection closed");
      mongoClient = null;
      globalDb = null;
    } catch (error) {
      console.error("❌ Error closing MongoDB connection:", error);
      throw error;
    }
  }
}

/**
 * Check if the MongoDB connection is active
 * @returns {boolean} - true if connected, false otherwise
 */
function isConnected() {
  return (
    mongoClient && mongoClient.topology && mongoClient.topology.isConnected()
  );
}

/**
 * Fetch paginated records from any MongoDB collection
 * @param {string} collectionName - Name of the collection to query
 * @param {object} query - MongoDB query filter
 * @param {object} options - Query options
 * @param {number} options.page - Page number (1-based, defaults to 1)
 * @param {number} options.limit - Records per page (defaults to 10)
 * @param {object} options.sort - Sort criteria (e.g., { createdAt: -1 })
 * @param {object} options.projection - Fields to include/exclude
 * @returns {Promise<{data: Array, metadata: {total: number, page: number, limit: number, pages: number}}>}
 */
async function getPaginatedRecords(collectionName, query = {}, options = {}) {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database connection not available');
    }

    // Set default options
    const page = parseInt(options.page, 10) || 1;
    const limit = parseInt(options.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const sort = options.sort || { _id: -1 }; // Default to newest first
    const projection = options.projection || {};

    // Get total count for pagination metadata
    const total = await db.collection(collectionName).countDocuments(query);
    
    // Get paginated data
    const data = await db.collection(collectionName)
      .find(query)
      .project(projection)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();
    
    // Calculate total pages
    const pages = Math.ceil(total / limit);
    
    // Return data with pagination metadata
    return {
      data,
      metadata: {
        total,
        page,
        limit,
        pages,
        hasNextPage: page < pages,
        hasPrevPage: page > 1
      }
    };
  } catch (error) {
    console.error('\u274c Error fetching paginated records:', error);
    throw error;
  }
}

module.exports = {
  connectToMongoDB,
  getDb,
  getClient,
  closeConnection,
  isConnected,
  getPaginatedRecords,
  ObjectId
};
