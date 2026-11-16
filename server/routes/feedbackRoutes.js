const express = require("express");

const {
  getFeedback,
  createFeedback,
  updateFeedback,
} = require("../controllers/feedbackController");

const router = express.Router();

router.get("/", getFeedback);
router.post("/", createFeedback);
// Status changes (Open / In Progress / Resolved)
router.patch("/:id", updateFeedback);

module.exports = router;
