const mongoose = require("mongoose");
// DB Connection
const dbConnect = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      retryReads: true,
      retryWrites: true,
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });
    console.log("MongoDB Connected...");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
};

module.exports = dbConnect;
