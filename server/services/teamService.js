const crypto = require("crypto");
const Company = require("../models/Company");
const User = require("../models/User");
const Invite = require("../models/Invite");
const { HttpError } = require("../utils/httpError");
const { isValidId } = require("../utils/tenant");
const { hashToken } = require("./authService");
const {
  normalizeDomain,
  isValidDomain,
  isPublicDomain,
} = require("../utils/emailDomains");

const MAX_DOMAINS = 5;

const { ROLES } = User;
const INVITE_DAYS = 7;

const toMember = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status || "Active",
  joinedAt: user.createdAt,
  lastLoginAt: user.lastLoginAt,
});

const listMembers = async (companyId) => {
  const users = await User.find({ company: companyId }).sort({ createdAt: 1 });
  return users.map(toMember);
};

const findMember = async (memberId, companyId) => {
  if (!isValidId(memberId)) throw new HttpError(404, "Team member not found");
  const member = await User.findOne({ _id: memberId, company: companyId });
  if (!member) throw new HttpError(404, "Team member not found");
  return member;
};

const ownerCount = (companyId) => User.countDocuments({ company: companyId, role: "Owner" });

// Only Owners can change roles. A company must always keep at least one Owner.
const changeRole = async (actor, memberId, role, companyId) => {
  if (!ROLES.includes(role)) throw new HttpError(400, "Invalid role");

  const member = await findMember(memberId, companyId);

  if (member.role === "Owner" && role !== "Owner" && (await ownerCount(companyId)) <= 1) {
    throw new HttpError(400, "A company needs at least one Owner. Make someone else an Owner first.");
  }

  member.role = role;
  await member.save();
  return toMember(member);
};

// Owners can remove anyone but themselves; Admins can remove Members only
const removeMember = async (actor, memberId, companyId) => {
  const member = await findMember(memberId, companyId);

  if (String(member._id) === actor.id) {
    throw new HttpError(400, "You can't remove yourself");
  }
  if (actor.role === "Admin" && member.role !== "Member") {
    throw new HttpError(403, "Admins can only remove Members");
  }
  if (member.role === "Owner" && (await ownerCount(companyId)) <= 1) {
    throw new HttpError(400, "A company needs at least one Owner");
  }

  await User.deleteOne({ _id: member._id, company: companyId });
  return { id: String(member._id) };
};

const toInvite = (invite) => ({
  id: String(invite._id),
  role: invite.role,
  expiresAt: invite.expiresAt,
  usedCount: invite.usedCount,
  maxUses: invite.maxUses,
  createdAt: invite.createdAt,
  createdBy: invite.createdBy?.name || null,
});

// Owners can invite Admins or Members; Admins can invite Members
const createInvite = async (actor, { role = "Member", maxUses = 25 } = {}, companyId) => {
  if (!["Admin", "Member"].includes(role)) throw new HttpError(400, "Invites can be for Admin or Member");
  if (actor.role === "Admin" && role !== "Member") {
    throw new HttpError(403, "Admins can only invite Members");
  }

  const uses = Number.parseInt(maxUses, 10);
  const token = crypto.randomBytes(24).toString("base64url");

  const invite = await Invite.create({
    company: companyId,
    tokenHash: hashToken(token),
    role,
    createdBy: actor.id,
    expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
    maxUses: Number.isInteger(uses) && uses >= 1 && uses <= 100 ? uses : 25,
  });

  // The raw token is only returned once, at creation
  return { ...toInvite(invite), token };
};

const listInvites = async (companyId) => {
  const invites = await Invite.find({
    company: companyId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .populate("createdBy", "name");

  return invites.filter((invite) => invite.usedCount < invite.maxUses).map(toInvite);
};

const revokeInvite = async (inviteId, companyId) => {
  if (!isValidId(inviteId)) throw new HttpError(404, "Invite not found");

  const invite = await Invite.findOneAndUpdate(
    { _id: inviteId, company: companyId, revokedAt: null },
    { revokedAt: new Date() },
    { new: true }
  );

  if (!invite) throw new HttpError(404, "Invite not found");
  return { id: String(invite._id) };
};

// Owners/Admins approve people who signed up with a company email
const approveMember = async (memberId, companyId) => {
  const member = await findMember(memberId, companyId);
  if (member.status !== "Pending") throw new HttpError(400, "This person already has access");
  member.status = "Active";
  await member.save();
  return toMember(member);
};

/* ---------------- Who can join (company settings) ---------------- */

const getSettings = async (companyId) => {
  const company = await Company.findById(companyId);
  return {
    allowedDomains: company.allowedDomains,
    requireApproval: company.requireApproval,
  };
};

const updateSettings = async (companyId, data = {}) => {
  const company = await Company.findById(companyId);

  if (data.allowedDomains !== undefined) {
    if (!Array.isArray(data.allowedDomains)) throw new HttpError(400, "allowedDomains must be a list");

    const domains = [...new Set(data.allowedDomains.map(normalizeDomain).filter(Boolean))];

    if (domains.length > MAX_DOMAINS) throw new HttpError(400, `You can add up to ${MAX_DOMAINS} domains`);

    for (const domain of domains) {
      if (!isValidDomain(domain)) throw new HttpError(400, `"${domain}" isn't a valid email domain`);
      if (isPublicDomain(domain)) {
        throw new HttpError(400, `${domain} is a public email provider — anyone could join. Use your company's own domain.`);
      }
      const owner = await Company.exists({ allowedDomains: domain, _id: { $ne: company._id } });
      if (owner) throw new HttpError(409, `${domain} is already used by another company on OpsSync`);
    }

    company.allowedDomains = domains;
  }

  if (data.requireApproval !== undefined) {
    company.requireApproval = Boolean(data.requireApproval);
  }

  await company.save();
  return { allowedDomains: company.allowedDomains, requireApproval: company.requireApproval };
};

module.exports = {
  approveMember,
  getSettings,
  updateSettings,
  listMembers,
  changeRole,
  removeMember,
  createInvite,
  listInvites,
  revokeInvite,
};
