const express = require("express");
const { chat } = require("../controllers/aiController");
const { createRateLimit } = require("../utils/rateLimit");

const router = express.Router();

// Per-user limit so a stuck client can't burn the free Gemini quota
const aiLimit = createRateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: "Too many questions in a minute. Please wait a moment.",
  keyFn: (req) => req.user?.id || req.ip,
});

router.post("/chat", aiLimit, chat);

module.exports = router;
