const mongoose = require("mongoose");

// A join link for a company. Only a SHA-256 hash of the token is stored,
// so a database leak doesn't expose usable invite links.
const inviteSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },

    role: {
      type: String,
      enum: ["Admin", "Member"],
      default: "Member",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    // Reusable link (e.g. shared in a team WhatsApp group) up to maxUses
    maxUses: {
      type: Number,
      default: 25,
      min: 1,
    },

    usedCount: {
      type: Number,
      default: 0,
    },

    revokedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

inviteSchema.methods.isUsable = function isUsable() {
  return (
    !this.revokedAt &&
    this.expiresAt > new Date() &&
    this.usedCount < this.maxUses
  );
};

module.exports = mongoose.model("Invite", inviteSchema);
