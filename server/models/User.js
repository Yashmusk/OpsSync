const mongoose = require("mongoose");

const ROLES = ["Owner", "Admin", "Member"];

const userSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    // One account per email address across OpsSync
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: true,
      select: false, // never returned unless explicitly requested
    },

    role: {
      type: String,
      enum: ROLES,
      default: "Member",
    },

    // Pending = signed up with a company email but not yet approved
    status: {
      type: String,
      enum: ["Active", "Pending"],
      default: "Active",
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
module.exports.ROLES = ROLES;
