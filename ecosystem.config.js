module.exports = {
    apps: [{
      name: "booking-service",
      script: "server.js",
      instances: 1, // Explicitly set to single instance
      autorestart: true, // Restart on crash
      watch: false, // Disable watch for production-like stability
      max_memory_restart: "1G", // Reduced from 1G, adjust based on monitoring
      restart_delay: 3000, // 5-second delay between restarts
      max_restarts: 50, // Prevent infinite restart loops
      env: {
        NODE_ENV: "development",
        // MONGODB_URI: "mongodb+srv://admin:alcatraz6543@alcatrazmanagementclust.p4cghtd.mongodb.net/?retryWrites=true&w=majority&appName=AlcatrazManagementCluster", // Replace with actual URI
        // PORT: 3000
      },
      env_production: {
        NODE_ENV: "production",
        // MONGODB_URI: "your-production-mongodb-uri", // Replace with actual URI
        // PORT: 3000
      },
      error_file: "./pm2_logs/err.log",
      out_file: "./pm2_logs/out.log",
      log_file: "./pm2_logs/combined.log",
      time: true, // Add timestamps to logs
      log_date_format: "YYYY-MM-DD HH:mm:ss", // Consistent log format
      merge_logs: true // Useful even for single instance to ensure consistent logging
    }]
  };