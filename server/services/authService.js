const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const Company = require("../models/Company");
const User = require("../models/User");
const Invite = require("../models/Invite");
const { HttpError } = require("../utils/httpError");
const { issueToken } = require("../middleware/auth");
const {
  getEmailDomain,
  isPublicDomain,
  emailMatchesDomains,
} = require("../utils/emailDomains");

const { RESERVED_SLUGS } = Company;
const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

// A dummy hash so failed logins for unknown emails take as long as real ones
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);

const slugify = (text) =>
  String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const validateAccount = ({ name, email, password }) => {
  if (!String(name || "").trim()) throw new HttpError(400, "Your name is required");
  if (!EMAIL_RE.test(String(email || "").trim())) throw new HttpError(400, "Enter a valid email address");
  if (String(password || "").length < MIN_PASSWORD) {
    throw new HttpError(400, `Password must be at least ${MIN_PASSWORD} characters`);
  }
};

const checkSlug = async (slug) => {
  if (!SLUG_RE.test(slug || "")) {
    return {
      available: false,
      reason: "Use 3-40 lowercase letters, numbers, or hyphens (not at the start or end)",
    };
  }
  if (RESERVED_SLUGS.includes(slug)) return { available: false, reason: "This link is reserved" };
  if (await Company.exists({ slug })) return { available: false, reason: "This link is already taken" };
  return { available: true };
};

const toSession = (user, company) => ({
  token: issueToken(user),
  user: { id: String(user._id), name: user.name, email: user.email, role: user.role },
  company: { id: String(company._id), name: company.name, slug: company.slug },
});

const emailTaken = async (email) => Boolean(await User.exists({ email }));

const registerCompany = async (data) => {
  const companyName = String(data.companyName || "").trim();
  const name = String(data.name || "").trim();
  const email = String(data.email || "").trim().toLowerCase();
  const slug = String(data.slug || slugify(companyName)).trim().toLowerCase();

  if (!companyName) throw new HttpError(400, "Company name is required");
  validateAccount({ name, email, password: data.password });

  const slugCheck = await checkSlug(slug);
  if (!slugCheck.available) throw new HttpError(409, `Company link: ${slugCheck.reason}`);
  if (await emailTaken(email)) throw new HttpError(409, "An account with this email already exists. Log in instead.");

  // Teammates with the owner's work email domain can join from the company link.
  // Public providers (gmail.com etc.) are never allowed.
  // A domain can belong to only one company, so it isn't added if already claimed.
  const ownerDomain = getEmailDomain(email);
  const domainFree =
    ownerDomain && !isPublicDomain(ownerDomain) && !(await Company.exists({ allowedDomains: ownerDomain }));
  const allowedDomains = domainFree ? [ownerDomain] : [];

  const company = await Company.create({ name: companyName, slug, allowedDomains });

  try {
    const user = await User.create({
      company: company._id,
      name,
      email,
      passwordHash: await bcrypt.hash(data.password, BCRYPT_ROUNDS),
      role: "Owner",
      lastLoginAt: new Date(),
    });
    return toSession(user, company);
  } catch (error) {
    // Don't leave an empty company behind if the owner couldn't be created
    await Company.deleteOne({ _id: company._id }).catch(() => {});
    if (error.code === 11000) {
      throw new HttpError(409, "An account with this email already exists. Log in instead.");
    }
    throw error;
  }
};

const login = async ({ email, password, slug }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail })
    .select("+passwordHash")
    .populate("company", "name slug");

  const passwordOk = await bcrypt.compare(String(password || ""), user?.passwordHash || DUMMY_HASH);

  if (!user || !passwordOk || !user.company) {
    throw new HttpError(401, "Incorrect email or password");
  }

  // Logging in from a company's link only works for that company's members
  if (slug && user.company.slug !== String(slug).toLowerCase()) {
    throw new HttpError(403, `This account doesn't belong to this company. Log in at /${user.company.slug} instead.`);
  }

  if (user.status === "Pending") {
    throw new HttpError(
      403,
      `Your account is waiting for approval from a ${user.company.name} admin. You'll be able to log in once they approve it.`
    );
  }

  user.lastLoginAt = new Date();
  await user.save();

  return toSession(user, user.company);
};

const findCompanyBySlug = async (slug) => {
  const company = await Company.findOne({ slug: String(slug || "").toLowerCase() });
  if (!company) throw new HttpError(404, "Company not found");
  return company;
};

// What the company's login page needs: name, and whether self sign-up is open
const getPublicCompany = async (slug) => {
  const company = await findCompanyBySlug(slug);
  return {
    name: company.name,
    slug: company.slug,
    selfSignup: company.allowedDomains.length > 0,
    allowedDomains: company.allowedDomains,
    requireApproval: company.requireApproval,
  };
};

// Self sign-up from the company link with a matching work email (e.g. @nutrabay.com)
const signupToCompany = async (slug, data) => {
  const company = await findCompanyBySlug(slug);
  const name = String(data.name || "").trim();
  const email = String(data.email || "").trim().toLowerCase();

  if (company.allowedDomains.length === 0) {
    throw new HttpError(403, `${company.name} only lets people join through an invite link. Ask your admin for one.`);
  }

  validateAccount({ name, email, password: data.password });

  if (!emailMatchesDomains(email, company.allowedDomains)) {
    const list = company.allowedDomains.map((d) => `@${d}`).join(" or ");
    throw new HttpError(403, `Use your ${list} work email to join ${company.name}.`);
  }

  if (await emailTaken(email)) {
    throw new HttpError(409, "An account with this email already exists. Log in instead.");
  }

  const pending = company.requireApproval;

  try {
    const user = await User.create({
      company: company._id,
      name,
      email,
      passwordHash: await bcrypt.hash(data.password, BCRYPT_ROUNDS),
      role: "Member",
      status: pending ? "Pending" : "Active",
      lastLoginAt: pending ? null : new Date(),
    });

    if (pending) {
      return {
        pending: true,
        company: { name: company.name, slug: company.slug },
        message: `Request sent. A ${company.name} admin needs to approve your account before you can log in.`,
      };
    }
    return toSession(user, company);
  } catch (error) {
    if (error.code === 11000) {
      throw new HttpError(409, "An account with this email already exists. Log in instead.");
    }
    throw error;
  }
};

/* ---------------- Invites ---------------- */

const findUsableInvite = async (token) => {
  const invite = await Invite.findOne({ tokenHash: hashToken(String(token || "")) }).populate(
    "company",
    "name slug"
  );
  if (!invite || !invite.company || !invite.isUsable()) {
    throw new HttpError(404, "This invite link is invalid or has expired. Ask your admin for a new one.");
  }
  return invite;
};

const getInvite = async (token) => {
  const invite = await findUsableInvite(token);
  return { company: { name: invite.company.name, slug: invite.company.slug }, role: invite.role };
};

const acceptInvite = async (token, data) => {
  const name = String(data.name || "").trim();
  const email = String(data.email || "").trim().toLowerCase();
  validateAccount({ name, email, password: data.password });

  const invite = await findUsableInvite(token);
  if (await emailTaken(email)) {
    throw new HttpError(409, "An account with this email already exists. Each email can belong to one company.");
  }

  // Claim a use atomically so a link can't be used more than maxUses times
  const claimed = await Invite.findOneAndUpdate(
    {
      _id: invite._id,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
      $expr: { $lt: ["$usedCount", "$maxUses"] },
    },
    { $inc: { usedCount: 1 } },
    { new: true }
  );
  if (!claimed) throw new HttpError(404, "This invite link is invalid or has expired. Ask your admin for a new one.");

  try {
    const user = await User.create({
      company: invite.company._id,
      name,
      email,
      passwordHash: await bcrypt.hash(data.password, BCRYPT_ROUNDS),
      role: invite.role,
      lastLoginAt: new Date(),
    });
    return toSession(user, invite.company);
  } catch (error) {
    await Invite.updateOne({ _id: invite._id }, { $inc: { usedCount: -1 } }).catch(() => {});
    if (error.code === 11000) {
      throw new HttpError(409, "An account with this email already exists. Each email can belong to one company.");
    }
    throw error;
  }
};

module.exports = {
  slugify,
  hashToken,
  checkSlug,
  registerCompany,
  login,
  getPublicCompany,
  signupToCompany,
  getInvite,
  acceptInvite,
};
