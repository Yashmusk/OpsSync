const authService = require("../services/authService");
const { sendError } = require("../utils/httpError");

const wrap = (fn, fallback, status = 200) => async (req, res) => {
  try {
    const data = await fn(req);
    return res.status(status).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, fallback);
  }
};

module.exports = {
  registerCompany: wrap((req) => authService.registerCompany(req.body || {}), "Failed to create company", 201),
  login: wrap((req) => authService.login(req.body || {}), "Failed to log in"),
  me: wrap(async (req) => ({ user: req.user, company: req.company }), "Failed to load profile"),
  checkSlug: wrap(
    async (req) => ({
      slug: String(req.query.slug || "").toLowerCase(),
      suggested: authService.slugify(req.query.name || req.query.slug),
      ...(await authService.checkSlug(String(req.query.slug || "").toLowerCase())),
    }),
    "Failed to check link"
  ),
  publicCompany: wrap((req) => authService.getPublicCompany(req.params.slug), "Failed to load company"),
  signupToCompany: wrap(
    (req) => authService.signupToCompany(req.params.slug, req.body || {}),
    "Failed to create account",
    201
  ),
  getInvite: wrap((req) => authService.getInvite(req.params.token), "Failed to load invite"),
  acceptInvite: wrap((req) => authService.acceptInvite(req.params.token, req.body || {}), "Failed to join company", 201),
};
