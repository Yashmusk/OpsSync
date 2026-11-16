const mongoose = require("mongoose");

// Slugs that can't be used as company links because the app uses those paths
const RESERVED_SLUGS = [
  "api", "app", "admin", "login", "logout", "signup", "register", "join",
  "invite", "invites", "settings", "account", "help", "support", "about",
  "pricing", "terms", "privacy", "static", "assets", "www", "opssync",
];

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    // Used in the company link: opssync.app/<slug>
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, "Invalid company link"],
    },

    // Work email domains (e.g. "nutrabay.com") whose owners can create their
    // own account from the company link. Empty = invite links only.
    allowedDomains: {
      type: [String],
      default: [],
    },

    // When true, self sign-ups wait for an Owner/Admin to approve them
    requireApproval: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Look up which company (if any) owns an email domain
companySchema.index({ allowedDomains: 1 });

module.exports = mongoose.model("Company", companySchema);
module.exports.RESERVED_SLUGS = RESERVED_SLUGS;
