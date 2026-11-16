const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // Fail fast instead of hanging for 30s when MongoDB isn't running
      serverSelectionTimeoutMS: 5000,
    });
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    console.error(
      "Is MongoDB running? On Windows, start it from an admin terminal with: net start MongoDB"
    );
    process.exit(1);
  }
};

module.exports = connectDB;
