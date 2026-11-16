const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = require("./config/db");
const { requireAuth, getSecret } = require("./middleware/auth");

const authRoutes = require("./routes/authRoutes");
const teamRoutes = require("./routes/teamRoutes");
const customerRoutes = require("./routes/customerRoutes");
const activityRoutes = require("./routes/activityRoutes");
const followUpRoutes = require("./routes/followUpRoutes");
const productRoutes = require("./routes/productRoutes");
const saleRoutes = require("./routes/saleRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const insightRoutes = require("./routes/insightRoutes");
const aiRoutes = require("./routes/aiRoutes");

// Refuse to start without a proper signing secret for login tokens
try {
  getSecret();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const app = express();
const isProduction = process.env.NODE_ENV === "production";

// Hosts like Render/Railway put a proxy in front of the app. Trusting it makes
// req.ip the real visitor's IP, so rate limits are per person, not global.
const trustProxy = process.env.TRUST_PROXY ?? (isProduction ? "1" : "");
if (trustProxy) {
  app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
}

// Only the OpsSync frontend may call the API from a browser.
// CLIENT_URL can list several origins, comma-separated (e.g. Vercel URL + custom domain).
const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

if (isProduction && allowedOrigins.length === 0) {
  console.warn("Warning: CLIENT_URL is not set, so the API accepts requests from any website.");
}

app.use(
  cors({
    origin: (origin, callback) => {
      // No origin = curl, health checks, server-to-server: allowed
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
  })
);
app.use(express.json({ limit: "200kb" }));

// Health check for the hosting platform and uptime monitors
app.get("/api/health", (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({ success: dbUp, database: dbUp ? "connected" : "disconnected" });
});

// Public: sign up, log in, company login pages, invite links
app.use("/api/auth", authRoutes);

// Everything below requires a logged-in user and is scoped to their company
app.use("/api/team", requireAuth, teamRoutes);
app.use("/api/customers", requireAuth, customerRoutes);
app.use("/api/activities", requireAuth, activityRoutes);
app.use("/api/follow-ups", requireAuth, followUpRoutes);
app.use("/api/products", requireAuth, productRoutes);
app.use("/api/sales", requireAuth, saleRoutes);
app.use("/api/feedback", requireAuth, feedbackRoutes);
app.use("/api/dashboard", requireAuth, dashboardRoutes);
app.use("/api/insights", requireAuth, insightRoutes);
app.use("/api/ai", requireAuth, aiRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "OpsSync API is running 🚀",
  });
});

// Unexpected errors (e.g. malformed JSON) — never leak internals
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Invalid JSON body" });
  }
  console.error("Unhandled error:", error);
  return res.status(500).json({ success: false, message: "Something went wrong" });
});

const PORT = process.env.PORT || 5000;

// Only accept requests once the database is reachable
connectDB().then(() => {
  // If MongoDB goes down later (e.g. it crashes), make it obvious in the logs
  mongoose.connection.on("disconnected", () => {
    console.error("MongoDB disconnected — requests will fail until it is back");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("MongoDB reconnected");
  });

  app.listen(PORT, () => {
    console.log(`OpsSync server running on port ${PORT}`);
  });
});
