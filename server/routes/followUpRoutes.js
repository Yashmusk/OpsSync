
const express = require("express");

const {
  getAllFollowUps,
  createFollowUp,
} = require("../controllers/followUpController");

const router = express.Router();

// Get all follow-ups
router.get("/", getAllFollowUps);

// Create a follow-up
router.post("/", createFollowUp);

module.exports = router;
