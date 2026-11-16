const express = require("express");
const teamService = require("../services/teamService");
const { requireRole } = require("../middleware/auth");
const { sendError } = require("../utils/httpError");

const router = express.Router();

const handle = (fn, fallback, status = 200) => async (req, res) => {
  try {
    const data = await fn(req);
    return res.status(status).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, fallback);
  }
};

// Everyone in the company can see who's on the team
router.get(
  "/members",
  handle((req) => teamService.listMembers(req.companyId), "Failed to load team")
);

// Only Owners change roles
router.patch(
  "/members/:id",
  requireRole("Owner"),
  handle(
    (req) => teamService.changeRole(req.user, req.params.id, req.body?.role, req.companyId),
    "Failed to change role"
  )
);

// Owners remove anyone (but themselves); Admins remove Members
router.delete(
  "/members/:id",
  requireRole("Owner", "Admin"),
  handle(
    (req) => teamService.removeMember(req.user, req.params.id, req.companyId),
    "Failed to remove member"
  )
);

// Approve someone who signed up with a company email (approval mode)
router.post(
  "/members/:id/approve",
  requireRole("Owner", "Admin"),
  handle((req) => teamService.approveMember(req.params.id, req.companyId), "Failed to approve member")
);

// Who can join: allowed email domains + approval switch.
// Owners and Admins can view; only Owners can change.
router.get(
  "/settings",
  requireRole("Owner", "Admin"),
  handle((req) => teamService.getSettings(req.companyId), "Failed to load settings")
);

router.patch(
  "/settings",
  requireRole("Owner"),
  handle((req) => teamService.updateSettings(req.companyId, req.body || {}), "Failed to save settings")
);

router.get(
  "/invites",
  requireRole("Owner", "Admin"),
  handle((req) => teamService.listInvites(req.companyId), "Failed to load invites")
);

router.post(
  "/invites",
  requireRole("Owner", "Admin"),
  handle(
    (req) => teamService.createInvite(req.user, req.body || {}, req.companyId),
    "Failed to create invite",
    201
  )
);

router.delete(
  "/invites/:id",
  requireRole("Owner", "Admin"),
  handle((req) => teamService.revokeInvite(req.params.id, req.companyId), "Failed to revoke invite")
);

module.exports = router;
