const express = require("express");
const cors = require("cors");
const activityRoutes = require("./routes/activityRoutes");
require("dotenv").config();

const connectDB = require("./config/db");

const app = express();

app.use(cors());
app.use(express.json());

// Connect MongoDB
connectDB();

const customerRoutes = require("./routes/customerRoutes");

app.use("/api/customers", customerRoutes);
app.use("/api/activities", activityRoutes);
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "OpsSync API is running 🚀",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`OpsSync server running on port ${PORT}`);
});