const express = require("express");
const auth = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const { createRateLimit } = require("../utils/rateLimit");

const router = express.Router();

// Slow down password guessing: 10 attempts / 15 min per IP + email
const loginLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Please wait a few minutes and try again.",
  keyFn: (req) => `${req.ip}|${String(req.body?.email || "").toLowerCase()}`,
});

// Generous enough for a whole office joining over one Wi-Fi (same IP),
// still stops scripted mass sign-ups
const signupLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: "Too many sign-ups from this network. Please try again later.",
});

router.post("/register-company", signupLimit, auth.registerCompany);
router.post("/login", loginLimit, auth.login);
router.get("/me", requireAuth, auth.me);
router.get("/check-slug", auth.checkSlug);
router.get("/company/:slug", auth.publicCompany);
// Self sign-up from the company link with a matching work email
router.post("/company/:slug/signup", signupLimit, auth.signupToCompany);
router.get("/invites/:token", auth.getInvite);
router.post("/invites/:token/accept", signupLimit, auth.acceptInvite);

module.exports = router;
