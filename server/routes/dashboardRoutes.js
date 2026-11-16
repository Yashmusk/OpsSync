const express = require("express");
const { getSummary } = require("../controllers/dashboardController");

const router = express.Router();

// GET /api/dashboard?days=7|30|90
router.get("/", getSummary);

module.exports = router;
