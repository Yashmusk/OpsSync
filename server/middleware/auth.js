const jwt = require("jsonwebtoken");
const User = require("../models/User");

const TOKEN_TTL = "7d";

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set in server/.env (at least 32 characters)");
  }
  return secret;
};

const issueToken = (user) =>
  jwt.sign(
    { sub: String(user._id), company: String(user.company._id || user.company) },
    getSecret(),
    { expiresIn: TOKEN_TTL }
  );

const unauthorized = (res, message = "Please log in to continue") =>
  res.status(401).json({ success: false, message });

// Verifies the token and pins the request to the user's company.
// Every data query must use req.companyId — never a company id from the client.
const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return unauthorized(res);

  let payload;
  try {
    payload = jwt.verify(token, getSecret());
  } catch {
    return unauthorized(res, "Your session has expired. Please log in again.");
  }

  try {
    const user = await User.findById(payload.sub).populate("company", "name slug");

    // User deleted, or moved/removed from the company since the token was issued
    if (!user || !user.company || String(user.company._id) !== payload.company) {
      return unauthorized(res, "Your access has changed. Please log in again.");
    }

    // Accounts waiting for approval can't use the workspace yet
    if (user.status === "Pending") {
      return unauthorized(res, "Your account is waiting for approval.");
    }

    req.user = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
    };
    req.company = {
      id: String(user.company._id),
      name: user.company.name,
      slug: user.company.slug,
    };
    req.companyId = user.company._id; // ObjectId, safe to use in aggregations

    return next();
  } catch (error) {
    return next(error);
  }
};

// Usage: requireRole("Owner", "Admin")
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "You don't have permission to do this. Ask your company owner or admin.",
    });
  }
  return next();
};

module.exports = { issueToken, requireAuth, requireRole, getSecret };
